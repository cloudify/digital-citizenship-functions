/*
 * This function will process events triggered by newly created messages.
 * For each new input message, the delivery preferences associated to the
 * recipient of the message gets retrieved and a notification gets delivered
 * to each configured channel.
 */

import * as t from "io-ts";

import * as winston from "winston";

import * as ApplicationInsights from "applicationinsights";

import { configureAzureContextTransport } from "./utils/logging";

import { DocumentClient as DocumentDBClient } from "documentdb";

import * as documentDbUtils from "./utils/documentdb";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { isNone, none, Option } from "fp-ts/lib/Option";
import { getRequiredStringEnv } from "./utils/env";
import { readableReport } from "./utils/validation_reporters";

import { IContext } from "azure-functions-types";

import * as NodeMailer from "nodemailer";
import * as sendGridTransport from "nodemailer-sendgrid-transport";

import * as HtmlToText from "html-to-text";

import { MessageBodyMarkdown } from "./api/definitions/MessageBodyMarkdown";

import { CreatedMessageEventSenderMetadata } from "./models/created_message_sender_metadata";
import { EmailNotification, NotificationModel } from "./models/notification";
import { NotificationEvent } from "./models/notification_event";

import { markdownToHtml } from "./utils/markdown";

import { MessageSubject } from "./api/definitions/MessageSubject";
import defaultEmailTemplate from "./templates/html/default";
import {
  isTransient,
  of as RuntimeErrorOf,
  PermanentError,
  RuntimeError,
  TransientError
} from "./utils/errors";

import {
  IQueueMessage,
  updateMessageVisibilityTimeout
} from "./utils/azure_queues";

import { createQueueService, QueueService } from "azure-storage";
import { NotificationChannelEnum } from "./api/definitions/NotificationChannel";
import { NotificationChannelStatusValueEnum } from "./api/definitions/NotificationChannelStatusValue";

import { ActiveMessage } from "./models/message";
import {
  getNotificationStatusUpdater,
  NOTIFICATION_STATUS_COLLECTION_NAME,
  NotificationStatusModel,
  NotificationStatusUpdater
} from "./models/notification_status";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Setup DocumentDB

const cosmosDbUri = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_URI");
const cosmosDbKey = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_KEY");
const cosmosDbName = getRequiredStringEnv("COSMOSDB_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);

const notificationsCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  "notifications"
);

const notificationStatusCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  NOTIFICATION_STATUS_COLLECTION_NAME
);

export const EMAIL_NOTIFICATION_QUEUE_NAME = "emailnotifications";
const queueConnectionString = getRequiredStringEnv("QueueStorageConnection");

const documentClient = new DocumentDBClient(cosmosDbUri, {
  masterKey: cosmosDbKey
});

const notificationStatusModel = new NotificationStatusModel(
  documentClient,
  notificationStatusCollectionUrl
);

const notificationModel = new NotificationModel(
  documentClient,
  notificationsCollectionUrl
);

const appInsightsClient = new ApplicationInsights.TelemetryClient();
const queueService = createQueueService(queueConnectionString);

//
// setup NodeMailer
//

const sendgridKey = getRequiredStringEnv("CUSTOMCONNSTR_SENDGRID_KEY");

const mailerTransporter = NodeMailer.createTransport(
  sendGridTransport({
    auth: {
      api_key: sendgridKey
    }
  })
);

//
// options used when converting an HTML message to pure text
// see https://www.npmjs.com/package/html-to-text#options
//

const HTML_TO_TEXT_OPTIONS: HtmlToTextOptions = {
  ignoreImage: true, // ignore all document images
  tables: true
};

//
// Main function
//

/**
 * Input and output bindings for this function
 * see EmailNotificationsQueueHandler/function.json
 */
const ContextWithBindings = t.interface({
  bindings: t.partial({
    notificationEvent: NotificationEvent
  })
});

type ContextWithBindings = t.TypeOf<typeof ContextWithBindings> & IContext;

type OutputBindings = never;

/**
 * Generates the HTML for the email from the Markdown content and the subject
 */
export async function generateDocumentHtml(
  subject: MessageSubject,
  markdown: MessageBodyMarkdown,
  senderMetadata: CreatedMessageEventSenderMetadata
): Promise<string> {
  // converts the markdown body to HTML
  const bodyHtml = (await markdownToHtml.process(markdown)).toString();

  // compose the service name from the department name and the service name
  const senderServiceName = `${senderMetadata.departmentName}<br />${
    senderMetadata.serviceName
  }`;

  // wrap the generated HTML into an email template
  const documentHtml = defaultEmailTemplate(
    subject, // title
    "", // TODO: headline
    senderMetadata.organizationName, // organization name
    senderServiceName, // service name
    subject,
    bodyHtml,
    "" // TODO: footer
  );

  return documentHtml;
}

/**
 * Promise wrapper around Transporter#sendMail
 */
export async function sendMail(
  transporter: NodeMailer.Transporter,
  options: NodeMailer.SendMailOptions
): Promise<Either<Error, NodeMailer.SentMessageInfo>> {
  return new Promise<Either<Error, NodeMailer.SentMessageInfo>>(resolve => {
    transporter.sendMail(options, (err, res) => {
      const result: Either<Error, NodeMailer.SentMessageInfo> = err
        ? left(err)
        : right(res);
      resolve(result);
    });
  });
}

/**
 * Handles the notification logic.
 *
 * This function will fetch the notification data and its associated message.
 * It will then send the email.
 */
export async function handleNotification(
  lMailerTransporter: NodeMailer.Transporter,
  lAppInsightsClient: ApplicationInsights.TelemetryClient,
  lNotificationModel: NotificationModel,
  emailNotificationEvent: NotificationEvent
): Promise<Either<RuntimeError, NotificationEvent>> {
  const { message, notificationId, senderMetadata } = emailNotificationEvent;

  // fetch the notification
  const errorOrMaybeNotification = await lNotificationModel.find(
    notificationId,
    message.id
  );

  if (isLeft(errorOrMaybeNotification)) {
    const error = errorOrMaybeNotification.value;
    // we got an error while fetching the notification
    return left(
      TransientError(
        `Error while fetching the notification|notification=${notificationId}|message=${
          message.id
        }|error=${error.code}`
      )
    );
  }

  const maybeEmailNotification = errorOrMaybeNotification.value;

  if (isNone(maybeEmailNotification)) {
    // it may happen that the object is not yet visible to this function due to latency
    // as the notification object is retrieved from database (?)
    return left(
      TransientError(
        `Notification not found|notification=${notificationId}|message=${
          message.id
        }`
      )
    );
  }

  const errorOrEmailNotification = EmailNotification.decode(
    maybeEmailNotification.value
  );

  if (isLeft(errorOrEmailNotification)) {
    const error = readableReport(errorOrEmailNotification.value);
    return left(
      PermanentError(
        `Wrong format for email notification|notification=${notificationId}|message=${
          message.id
        }|${error}`
      )
    );
  }

  const emailNotification = errorOrEmailNotification.value.channels.EMAIL;

  // use the provided subject if present, or else use the default subject line
  // TODO: generate the default subject from the service/client metadata
  const subject = message.content.subject
    ? message.content.subject
    : ("A new notification for you." as MessageSubject);

  const documentHtml = await generateDocumentHtml(
    subject,
    message.content.markdown,
    senderMetadata
  );

  // converts the HTML to pure text to generate the text version of the message
  const bodyText = HtmlToText.fromString(documentHtml, HTML_TO_TEXT_OPTIONS);

  // trigger email delivery
  // TODO: make everything configurable via settings
  // see https://nodemailer.com/message/
  const sendResult = await sendMail(lMailerTransporter, {
    from: "no-reply@italia.it",
    headers: {
      "X-Italia-Messages-MessageId": message.id,
      "X-Italia-Messages-NotificationId": notificationId
    },
    html: documentHtml,
    messageId: message.id,
    subject,
    text: bodyText,
    to: emailNotification.toAddress
    // priority: "high", // TODO: set based on kind of notification
    // disableFileAccess: true,
    // disableUrlAccess: true,
  });

  const eventName = "notification.email.delivery";
  const eventContent = {
    addressSource: emailNotification.addressSource,
    messageId: message.id,
    notificationId,
    transport: "sendgrid"
  };

  if (isLeft(sendResult)) {
    // track the event of failed delivery
    lAppInsightsClient.trackEvent({
      name: eventName,
      properties: {
        ...eventContent,
        success: "false"
      }
    });
    const error = sendResult.value;
    return left(
      TransientError(
        `Error while sending email|notification=${notificationId}|message=${
          message.id
        }|error=${error.message}`
      )
    );
  }

  // track the event of successful delivery
  lAppInsightsClient.trackEvent({
    name: eventName,
    properties: {
      ...eventContent,
      success: "true"
    }
  });

  // TODO: handling bounces and delivery updates
  // see https://nodemailer.com/usage/#sending-mail
  // see #150597597
  return right(emailNotificationEvent);
}

export async function processRuntimeError(
  lQueueService: QueueService,
  notificationStatusUpdater: NotificationStatusUpdater,
  queueMessage: IQueueMessage,
  error: RuntimeError
): Promise<Either<boolean, Option<OutputBindings>>> {
  if (isTransient(error)) {
    winston.warn(
      `EmailNotificationQueueHandler|Transient error|${error.message}`
    );
    const shouldTriggerARetry = await updateMessageVisibilityTimeout(
      lQueueService,
      EMAIL_NOTIFICATION_QUEUE_NAME,
      queueMessage
    );
    const errorOrNotificationStatus = await notificationStatusUpdater(
      NotificationChannelStatusValueEnum.QUEUED
    );
    if (isLeft(errorOrNotificationStatus)) {
      winston.warn(
        `EmailNotificationQueueHandler|Transient error|${
          errorOrNotificationStatus.value.message
        }`
      );
    }
    return left(shouldTriggerARetry);
  } else {
    winston.error(
      `EmailNotificationQueueHandler|Permanent error|${error.message}`
    );
    const errorOrNotificationStatus = await notificationStatusUpdater(
      NotificationChannelStatusValueEnum.FAILED
    );
    if (isLeft(errorOrNotificationStatus)) {
      // if we get an error updating the notification status
      // we retry the whole procedure (it will log the error anyway)
      const transientError = errorOrNotificationStatus.value;
      return await processRuntimeError(
        lQueueService,
        notificationStatusUpdater,
        queueMessage,
        transientError
      );
    } else {
      // return no bindings so message processing stops here
      return right(none);
    }
  }
}

/**
 * Function handler
 */
export async function index(
  context: ContextWithBindings
): Promise<OutputBindings | Error | void> {
  const stopProcessing = undefined;
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);

  winston.debug(`STARTED|${context.invocationId}`);

  winston.debug(
    `EmailNotificationsHandlerIndex|Dequeued email notification|${JSON.stringify(
      context.bindings
    )}`
  );

  // since this function gets triggered by a queued message that gets
  // deserialized from a json object, we must first check that what we
  // got is what we expect.
  const errorOrNotificationEvent = NotificationEvent.decode(
    context.bindings.notificationEvent
  );
  if (isLeft(errorOrNotificationEvent)) {
    winston.error(
      `EmailNotificationsHandler|Fatal! No valid message found in bindings.|${readableReport(
        errorOrNotificationEvent.value
      )}`
    );
    return stopProcessing;
  }
  const emailNotificationEvent = errorOrNotificationEvent.value;

  const notificationStatusUpdater = getNotificationStatusUpdater(
    notificationStatusModel,
    NotificationChannelEnum.EMAIL,
    emailNotificationEvent.message.id,
    emailNotificationEvent.notificationId
  );

  try {
    // Check if the message is not expired
    const errorOrActiveMessage = ActiveMessage.decode(
      emailNotificationEvent.message
    );
    if (isLeft(errorOrActiveMessage)) {
      const errorMsg = readableReport(errorOrActiveMessage.value);
      const errorOrUpdateNotificationStatus = await notificationStatusUpdater(
        NotificationChannelStatusValueEnum.EXPIRED
      );
      if (isLeft(errorOrUpdateNotificationStatus)) {
        // retry in case we cannot save the notification status to the database
        throw TransientError(errorOrUpdateNotificationStatus.value.message);
      }
      // if the message is expired no more processing is necessary
      throw PermanentError(errorMsg);
    }

    const errorOrEmailNotificationEvt = await handleNotification(
      mailerTransporter,
      appInsightsClient,
      notificationModel,
      emailNotificationEvent
    );
    if (isLeft(errorOrEmailNotificationEvt)) {
      // something went wrong sending the email
      throw errorOrEmailNotificationEvt.value;
    }

    // try to save notification status to database
    const errorOrUpdatedNotificationStatus = await notificationStatusUpdater(
      NotificationChannelStatusValueEnum.SENT_TO_CHANNEL
    );
    if (isLeft(errorOrUpdatedNotificationStatus)) {
      // this will trigger a retry as it's considered a transient error
      throw errorOrUpdatedNotificationStatus.value;
    }

    winston.debug(
      `EmailNotificationsHandler|Email notification succeeded|notification=${
        emailNotificationEvent.notificationId
      }|message=${emailNotificationEvent.message.id}`
    );

    return stopProcessing;
    //
  } catch (error) {
    const shouldTriggerARetry = await processRuntimeError(
      queueService,
      notificationStatusUpdater,
      context.bindingData,
      RuntimeErrorOf(error)
    );
    if (shouldTriggerARetry) {
      throw TransientError(`EmailNotificationsHandler|Retry|${error.message}`);
    }
    return stopProcessing;
  }
}
