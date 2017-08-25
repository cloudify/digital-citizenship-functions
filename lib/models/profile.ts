import * as DocumentDb from "documentdb";
import * as DocumentDbUtils from "../utils/documentdb";

import { FiscalCode } from "../utils/fiscalcode";
import { NonNegativeNumber, toNonNegativeNumber } from "../utils/numbers";

/**
 * Base interface for Profile objects
 */
export interface IProfile {
  fiscalCode: FiscalCode;
  email?: string;
}

/**
 * Interface for new Profile objects
 */
export interface INewProfile extends IProfile, DocumentDb.NewDocument { }

/**
 * Interface for retrieved Profile objects
 *
 * Existing profile records have a version number.
 */
export interface IRetrievedProfile extends IProfile, DocumentDb.RetrievedDocument {
  readonly version: NonNegativeNumber;
}

/**
 * Returns a string with a composite id that has the format:
 * PROFILE_ID-VERSION
 *
 * PROFILE_ID is the base profile ID (i.e. the fiscal code)
 * VERSION is the zero-padded version of the profile
 *
 * @param profileId The base profile ID
 * @param version The version of the profile
 */
function generateVersionedProfileId(profileId: string, version: number): string {
  const paddingLength = 16; // length of Number.MAX_SAFE_INTEGER == 9007199254740991
  const paddedVersion = ("0".repeat(paddingLength) + version).slice(-paddingLength);
  return `${profileId}-${paddedVersion}`;
}

export class ProfileModel {
  private dbClient: DocumentDb.DocumentClient;
  private collectionUrl: DocumentDbUtils.DocumentDbCollectionUrl;

  /**
   * Creates a new Profile model
   *
   * @param dbClient the DocumentDB client
   * @param collectionUrl the collection URL
   */
  constructor(dbClient: DocumentDb.DocumentClient, collectionUrl: DocumentDbUtils.DocumentDbCollectionUrl) {
    this.dbClient = dbClient;
    this.collectionUrl = collectionUrl;
  }

  /**
   * Searches for one profile associated to the provided fiscal code
   *
   * @param fiscalCode
   */
  public findOneProfileByFiscalCode(fiscalCode: FiscalCode): Promise<IRetrievedProfile | null> {
    return DocumentDbUtils.queryOneDocument(
      this.dbClient,
      this.collectionUrl,
      {
        parameters: [{
          name: "@fiscalCode",
          value: fiscalCode,
        }],
        query: "SELECT * FROM profiles p WHERE (p.fiscalCode = @fiscalCode) ORDER BY version DESC",
      },
    );
  }

  /**
   * Create a new Profile
   *
   * @param profile The new Profile object
   */
  public createProfile(profile: IProfile): Promise<IRetrievedProfile> {
    return new Promise((resolve, reject) => {
      // the first version of a profile is 0
      const initialVersion = toNonNegativeNumber(0).get;
      // the ID of each profile version is composed of the profile ID and its version
      // this makes it possible to detect conflicting updates (concurrent creation of
      // profiles with the same profile ID and version)
      const profileId = generateVersionedProfileId(profile.fiscalCode, initialVersion);
      DocumentDbUtils.createDocument(
        this.dbClient,
        this.collectionUrl,
        {
          ...profile,
          id: profileId,
          version: initialVersion,
        },
      ).then(
        (result) => resolve(result),
        (error) => reject(error),
      );
    });
  }

  /**
   * Update an existing profile by creating a new version
   *
   * @param profile The updated Profile object
   */
  public updateProfile(profile: IRetrievedProfile): Promise<IRetrievedProfile> {
    return new Promise((resolve, reject) => {
      const newVersion = toNonNegativeNumber(profile.version + 1).get;
      const profileId = generateVersionedProfileId(profile.fiscalCode, newVersion);
      DocumentDbUtils.createDocument(
        this.dbClient,
        this.collectionUrl,
        {
          ...profile,
          id: profileId,
          version: newVersion,
        },
      ).then(
        (result) => resolve(result),
        (error) => reject(error),
      );
    });
  }

}
