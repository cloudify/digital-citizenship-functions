/**
 * A Notification is a communication that gets sent to a user that received
 * a Message. A notification can be sent on multiple channels, based on the
 * User's preference.
 */

import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { Either } from "../utils/either";

import { FiscalCode, isFiscalCode } from "../utils/fiscalcode";

/**
 * A notification can be sent over multiple channels and each channel
 * can be in a certain status describing.
 */
export const enum NotificationChannelStatus {
  // still processing the notification
  NOTIFICATION_QUEUED = "QUEUED",
  // the email has been sent to the channel
  NOTIFICATION_SENT_TO_CHANNEL = "SENT_TO_CHANNEL",
}

/**
 * Attributes for the email channel
 */
export interface INotificationChannelEmail {
  readonly kind: "INotificationChannelEmail";
  readonly status: NotificationChannelStatus;
  readonly fromAddress?: string;
  readonly toAddress: string;
}

/**
 * Base interface for Notification objects
 */
export interface INotification {
  readonly fiscalCode: FiscalCode;
  readonly messageId: string;
  readonly emailNotification?: INotificationChannelEmail;
}

/**
 * Type guard for INotification objects
 */
// tslint:disable-next-line:no-any
export function isINotification(arg: any): arg is INotification {
  return isFiscalCode(arg.fiscalCode) &&
    typeof arg.messageId === "string" && arg.messageId.length > 0;
}

/**
 * Interface for new Notification objects
 */
export interface INewNotification extends INotification, DocumentDb.NewDocument {
  readonly kind: "INewNotification";
}

/**
 * Interface for retrieved Notification objects
 */
export interface IRetrievedNotification extends Readonly<INotification>, Readonly<DocumentDb.RetrievedDocument> {
  readonly kind: "IRetrievedNotification";
}

/**
 * A model for handling Notifications
 */
export class NotificationModel {
  private dbClient: DocumentDb.DocumentClient;
  private collectionUrl: DocumentDbUtils.DocumentDbCollectionUrl;

  /**
   * Creates a new Notification model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(dbClient: DocumentDb.DocumentClient, collectionUrl: DocumentDbUtils.DocumentDbCollectionUrl) {
    // tslint:disable-next-line:no-object-mutation
    this.dbClient = dbClient;
    // tslint:disable-next-line:no-object-mutation
    this.collectionUrl = collectionUrl;
  }

  /**
   * Creates a new Notification
   *
   * @param notification The new Notification
   */
  public async createNotification(
    notification: INewNotification,
  ): Promise<Either<DocumentDb.QueryError, IRetrievedNotification>> {
    const maybeCreatedDocument = await DocumentDbUtils.createDocument(
      this.dbClient,
      this.collectionUrl,
      notification,
      notification.messageId, // partitionKey
    );
    return maybeCreatedDocument.mapRight((createdDocument) => ({
      ...createdDocument,
      kind: "IRetrievedNotification",
    } as IRetrievedNotification));
  }

  /**
   * Returns the Notification associated to the provided notification ID
   *
   * @param messageId       The ID of the message this notification is for (used as partitionKey)
   * @param notificationId  The ID of the Notification
   *
   * TODO: should perhaps return an Option (mapping 404 error to empty)
   */
  public async findNotification(
    messageId: string,
    notificationId: string,
  ): Promise<Either<DocumentDb.QueryError, IRetrievedNotification>> {
    const documentUrl = DocumentDbUtils.getDocumentUrl(
      this.collectionUrl,
      notificationId,
    );

    const errorOrDocument = await DocumentDbUtils.readDocument<INotification>(
      this.dbClient,
      documentUrl,
      messageId,
    );

    return errorOrDocument.mapRight((document) => ({
      ...document,
      kind: "IRetrievedNotification",
    } as IRetrievedNotification));
  }

  /**
   * Updates an existing Notification
   */
  public async updateNotification(
    messageId: string,
    notificationId: string,
    f: (current: INotification) => INotification,
  ): Promise<Either<DocumentDb.QueryError, IRetrievedNotification>> {
    // fetch the notification
    const errorOrCurrent = await this.findNotification(messageId, notificationId);
    if (errorOrCurrent.isLeft) {
      // if the query returned an error, forward it
      return errorOrCurrent;
    }

    const currentNotification = errorOrCurrent.right;

    const updatedNotification = f({
      emailNotification: currentNotification.emailNotification,
      fiscalCode: currentNotification.fiscalCode,
      messageId: currentNotification.messageId,
    });

    const newNotificationDocument = {
      ...updatedNotification,
      id: currentNotification.id,
      kind: "INewNotification",
    };

    const maybeReplacedDocument = await DocumentDbUtils.replaceDocument<INotification>(
      this.dbClient,
      DocumentDbUtils.getDocumentUrlFromDocument(currentNotification),
      newNotificationDocument,
      messageId,
    );

    return maybeReplacedDocument.mapRight((replacedDocument) => ({
      ...replacedDocument,
      kind: "IRetrievedNotification",
    } as IRetrievedNotification));
  }

  /**
   * Returns all the Notifications for the provided message
   *
   * @param messageId The Id of the message
   */
  public findNotificationsForMessage(messageId: string): DocumentDbUtils.IResultIterator<IRetrievedNotification> {
    return DocumentDbUtils.queryDocuments(
      this.dbClient,
      this.collectionUrl,
      {
        parameters: [{
          name: "@messageId",
          value: messageId,
        }],
        query: "SELECT * FROM notifications n WHERE (n.messageId = @messageId)",
      },
    );
  }

}
