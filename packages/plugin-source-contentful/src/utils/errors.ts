/**
 * Custom error classes for the Contentful plugin.
 *
 * These provide more specific error information for debugging and handling.
 */

/**
 * Base error class for all Contentful plugin errors.
 */
export class ContentfulPluginError extends Error {
  /** Plugin identifier */
  readonly plugin = '@udl/plugin-source-contentful';

  constructor(
    message: string,
    public readonly code: string
  ) {
    super(`[${code}] ${message}`);
    this.name = 'ContentfulPluginError';
  }
}

/**
 * Error thrown when plugin configuration is invalid.
 */
export class ContentfulConfigError extends ContentfulPluginError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ContentfulConfigError';
  }
}

/**
 * Error thrown when Contentful API requests fail.
 */
export class ContentfulApiError extends ContentfulPluginError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly requestId?: string
  ) {
    super(message, 'API_ERROR');
    this.name = 'ContentfulApiError';
  }

  /**
   * Creates an API error from a Contentful SDK error.
   */
  static fromError(error: unknown): ContentfulApiError {
    if (error instanceof Error) {
      // Try to extract Contentful-specific error info
      const errorWithDetails = error as {
        message: string;
        status?: number;
        statusText?: string;
        sys?: { id?: string };
        requestId?: string;
      };

      const statusCode = errorWithDetails.status;
      const requestId = errorWithDetails.requestId ?? errorWithDetails.sys?.id;

      return new ContentfulApiError(error.message, statusCode, requestId);
    }

    return new ContentfulApiError(String(error));
  }
}

/**
 * Error thrown when sync operations fail.
 */
export class ContentfulSyncError extends ContentfulPluginError {
  constructor(
    message: string,
    public readonly isInitialSync: boolean
  ) {
    super(message, 'SYNC_ERROR');
    this.name = 'ContentfulSyncError';
  }
}

/**
 * Error thrown when node transformation fails.
 */
export class ContentfulTransformError extends ContentfulPluginError {
  constructor(
    message: string,
    public readonly contentType?: string,
    public readonly entryId?: string
  ) {
    super(message, 'TRANSFORM_ERROR');
    this.name = 'ContentfulTransformError';
  }
}

/**
 * Wraps an async function to catch and rethrow errors as ContentfulApiError.
 *
 * @param fn - The async function to wrap
 * @param errorMessage - Context message to add to the error
 * @returns The wrapped function result
 */
export async function wrapApiCall<T>(
  fn: () => Promise<T>,
  errorMessage: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ContentfulPluginError) {
      throw error;
    }
    throw new ContentfulApiError(
      `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Checks if an error is a rate limit error from Contentful.
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof ContentfulApiError) {
    return error.statusCode === 429;
  }
  if (error instanceof Error) {
    const errorWithStatus = error as { status?: number };
    return errorWithStatus.status === 429;
  }
  return false;
}

/**
 * Checks if an error is an authentication error.
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof ContentfulApiError) {
    return error.statusCode === 401 || error.statusCode === 403;
  }
  if (error instanceof Error) {
    const errorWithStatus = error as { status?: number };
    return errorWithStatus.status === 401 || errorWithStatus.status === 403;
  }
  return false;
}

/**
 * Checks if an error is a not found error.
 */
export function isNotFoundError(error: unknown): boolean {
  if (error instanceof ContentfulApiError) {
    return error.statusCode === 404;
  }
  if (error instanceof Error) {
    const errorWithStatus = error as { status?: number };
    return errorWithStatus.status === 404;
  }
  return false;
}
