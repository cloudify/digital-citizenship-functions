/**
 * This function (a queue handler) processes any event
 * triggered when a user's profile is created or updated.
 *
 */
import * as t from "io-ts";
import * as winston from "winston";

import { IContext } from "azure-functions-types";
import {
  IProfileCreatedEvent,
  IProfileUpdatedEvent
} from "./controllers/profiles";
import { configureAzureContextTransport } from "./utils/logging";

import { readableReport } from "italia-ts-commons/lib/reporters";
import * as request from "superagent";
import { ExtendedProfile } from "./api/definitions/ExtendedProfile";
import { NewMessage } from "./api/definitions/NewMessage";
import { getRequiredStringEnv } from "./utils/env";

// HTTP external requests timeout in milliseconds
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Needed to call notifications API
const notificationApiUrl = getRequiredStringEnv("NOTIFICATION_API_URL");
const adminApiKey = getRequiredStringEnv("NOTIFICATION_API_KEY");

// TODO: decide text for welcome message
// TODO: switch text based on user's preferred_language
const createWelcomeMessageMarkdown = (profile: ExtendedProfile) =>
  `Hello new user ${profile.email || ""}

  We welcome you to the digital citizenship API program  
  This is a welcome message to test the system (if it works)`;

const createWelcomeMessageSubject = (profile: ExtendedProfile) =>
  `Welcome new user ${profile.email || ""}`;

const ContextWithBindings = t.exact(
  t.interface({
    bindings: t.partial({ notificationEvent: t.object })
  })
);

type ContextWithBindings = t.TypeOf<typeof ContextWithBindings> & IContext;

async function sendWelcomeMessage(
  url: string,
  apiKey: string,
  newMessage: NewMessage
): Promise<request.Response> {
  return request("POST", url)
    .set("Content-Type", "application/json")
    .set("Ocp-Apim-Subscription-Key", apiKey)
    .timeout(DEFAULT_REQUEST_TIMEOUT_MS)
    .send(newMessage);
}

export async function index(
  context: ContextWithBindings,
  event: IProfileCreatedEvent | IProfileUpdatedEvent
): Promise<void> {
  const logLevel = isProduction ? "info" : "debug";
  configureAzureContextTransport(context, winston, logLevel);

  winston.debug(
    "ProfileEventsQueueHandler|Received event=%s",
    JSON.stringify(event)
  );

  const url = `${notificationApiUrl}/api/v1/messages/${event.fiscalCode}`;

  const isInboxEnabled = event.newProfile.is_inbox_enabled === true;
  const isProfileCreated = event.kind === "ProfileCreatedEvent";
  const isProfileUpdated =
    event.kind === "ProfileUpdatedEvent" &&
    event.oldProfile.is_inbox_enabled === false;

  const hasJustEnabledInbox =
    isInboxEnabled && (isProfileCreated || isProfileUpdated);

  if (hasJustEnabledInbox) {
    const newMessage = NewMessage.decode({
      content: {
        markdown: createWelcomeMessageMarkdown(event.newProfile),
        subject: createWelcomeMessageSubject(event.newProfile)
      }
    }).getOrElseL(errs => {
      const error = `Invalid welcome message: ${readableReport(errs)}`;
      winston.error(`ProfileEventsQueueHandler|${error}`);
      throw new Error(error);
    });

    // TODO: schedule retries
    const response = await sendWelcomeMessage(url, adminApiKey, newMessage);
    winston.debug(
      `ProfileEventsQueueHandler|Welcome message sent to ${
        event.fiscalCode
      } (response status=${response.status})`
    );
  }
}
