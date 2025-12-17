/**
 * Response normalization utilities.
 *
 * Transforms GraphQL responses to extract entities and replace with refs,
 * enabling deduplication of repeated data in responses.
 */

export {
  normalizeResponse,
  normalizeGraphQLResult,
  defaultGetEntityKey,
  type NormalizedResponse,
  type NormalizeOptions,
} from './normalize.js';
