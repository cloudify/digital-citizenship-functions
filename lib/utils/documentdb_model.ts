import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { Either } from "./either";

export abstract class DocumentDbModel<TN extends DocumentDb.NewDocument, TR extends DocumentDb.RetrievedDocument> {
  protected dbClient: DocumentDb.DocumentClient;
  protected collectionUrl: DocumentDbUtils.DocumentDbCollectionUrl;

  protected toRetrieved: (result: DocumentDb.RetrievedDocument) => TR;

  /**
   * Creates a new object
   */
  public async create(
    document: TN,
    partitionKey: string,
  ): Promise<Either<DocumentDb.QueryError, TR>> {
    // we don't want to store the "kind" property, let's remove it
    const kindlessDocument = Object.assign(Object.assign({}, document), { kind: undefined });

    const maybeCreatedDocument = await DocumentDbUtils.createDocument(
      this.dbClient,
      this.collectionUrl,
      kindlessDocument,
      partitionKey,
    );
    return maybeCreatedDocument.mapRight(this.toRetrieved);
  }

  public async find(
    id: string, partitionKey: string,
  ): Promise<Either<DocumentDb.QueryError, TR>> {
    const documentUrl = DocumentDbUtils.getDocumentUrl(
      this.collectionUrl,
      id,
    );

    const errorOrDocument = await DocumentDbUtils.readDocument(
      this.dbClient,
      documentUrl,
      partitionKey,
    );

    return errorOrDocument.mapRight(this.toRetrieved);
  }

}