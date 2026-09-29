import { CommonError, type ErrorDef } from '@turath/common';
import { IdentityError } from './identity/index.js';

/** One folder per service. A new service adds its folder here. */
export * from './identity/index.js';

/** Every error catalogue, so tests can check codes are unique and translated. Add new services here. */
export const ERROR_CATALOGUES: Record<string, Record<string, ErrorDef>> = {
  common: CommonError,
  identity: IdentityError,
};
