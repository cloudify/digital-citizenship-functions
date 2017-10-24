import { FiscalCode } from "../api/definitions/FiscalCode";
import { ModelId } from "./documentdb_model_versioned";
import { NonEmptyString } from "./strings";

/**
 * Converts a FiscalCode to a ModelId.
 *
 * Note that this is always possible since a valid FiscalCode is
 * also a valid ModelId.
 */
export function fiscalCodeToModelId(o: FiscalCode): ModelId {
  return (o as string) as ModelId;
}

/**
 * Converts a NonEmptyString to a ModelId.
 *
 * Note that this is always possible since a valid NonEmptyString is
 * also a valid ModelId.
 */
export function nonEmptyStringToModelId(o: NonEmptyString): ModelId {
  return (o as string) as ModelId;
}
