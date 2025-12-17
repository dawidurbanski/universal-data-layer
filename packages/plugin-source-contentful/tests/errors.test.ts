import { describe, it, expect } from 'vitest';
import {
  ContentfulPluginError,
  ContentfulConfigError,
  ContentfulApiError,
  ContentfulSyncError,
  ContentfulTransformError,
  isRateLimitError,
  isAuthError,
  isNotFoundError,
  wrapApiCall,
} from '@/utils/errors.js';

describe('ContentfulPluginError', () => {
  it('creates error with code and message', () => {
    const error = new ContentfulPluginError(
      'Something went wrong',
      'TEST_ERROR'
    );

    expect(error.message).toBe('[TEST_ERROR] Something went wrong');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.plugin).toBe('@universal-data-layer/plugin-source-contentful');
    expect(error.name).toBe('ContentfulPluginError');
  });
});

describe('ContentfulConfigError', () => {
  it('creates config error', () => {
    const error = new ContentfulConfigError('Missing spaceId');

    expect(error.message).toBe('[CONFIG_ERROR] Missing spaceId');
    expect(error.code).toBe('CONFIG_ERROR');
    expect(error.name).toBe('ContentfulConfigError');
  });
});

describe('ContentfulApiError', () => {
  it('creates API error with status code', () => {
    const error = new ContentfulApiError('Not found', 404, 'req-123');

    expect(error.message).toBe('[API_ERROR] Not found');
    expect(error.statusCode).toBe(404);
    expect(error.requestId).toBe('req-123');
    expect(error.name).toBe('ContentfulApiError');
  });

  it('creates API error from Error object', () => {
    const originalError = new Error('Network error');
    const error = ContentfulApiError.fromError(originalError);

    expect(error.message).toBe('[API_ERROR] Network error');
    expect(error.name).toBe('ContentfulApiError');
  });

  it('creates API error from string', () => {
    const error = ContentfulApiError.fromError('Unknown error');

    expect(error.message).toBe('[API_ERROR] Unknown error');
  });

  it('extracts status code from error with status property', () => {
    const originalError = Object.assign(new Error('Forbidden'), {
      status: 403,
    });
    const error = ContentfulApiError.fromError(originalError);

    expect(error.statusCode).toBe(403);
  });
});

describe('ContentfulSyncError', () => {
  it('creates sync error for initial sync', () => {
    const error = new ContentfulSyncError('Sync failed', true);

    expect(error.message).toBe('[SYNC_ERROR] Sync failed');
    expect(error.isInitialSync).toBe(true);
    expect(error.name).toBe('ContentfulSyncError');
  });

  it('creates sync error for delta sync', () => {
    const error = new ContentfulSyncError('Token expired', false);

    expect(error.isInitialSync).toBe(false);
  });
});

describe('ContentfulTransformError', () => {
  it('creates transform error with entry info', () => {
    const error = new ContentfulTransformError(
      'Invalid field',
      'blogPost',
      'entry-123'
    );

    expect(error.message).toBe('[TRANSFORM_ERROR] Invalid field');
    expect(error.contentType).toBe('blogPost');
    expect(error.entryId).toBe('entry-123');
    expect(error.name).toBe('ContentfulTransformError');
  });
});

describe('isRateLimitError', () => {
  it('returns true for ContentfulApiError with 429 status', () => {
    const error = new ContentfulApiError('Rate limited', 429);
    expect(isRateLimitError(error)).toBe(true);
  });

  it('returns false for ContentfulApiError with other status', () => {
    const error = new ContentfulApiError('Not found', 404);
    expect(isRateLimitError(error)).toBe(false);
  });

  it('returns true for Error with status 429', () => {
    const error = Object.assign(new Error('Rate limited'), { status: 429 });
    expect(isRateLimitError(error)).toBe(true);
  });

  it('returns false for non-error values', () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError('error')).toBe(false);
  });
});

describe('isAuthError', () => {
  it('returns true for 401 status', () => {
    const error = new ContentfulApiError('Unauthorized', 401);
    expect(isAuthError(error)).toBe(true);
  });

  it('returns true for 403 status', () => {
    const error = new ContentfulApiError('Forbidden', 403);
    expect(isAuthError(error)).toBe(true);
  });

  it('returns false for other status codes', () => {
    const error = new ContentfulApiError('Not found', 404);
    expect(isAuthError(error)).toBe(false);
  });
});

describe('isNotFoundError', () => {
  it('returns true for 404 status', () => {
    const error = new ContentfulApiError('Not found', 404);
    expect(isNotFoundError(error)).toBe(true);
  });

  it('returns false for other status codes', () => {
    const error = new ContentfulApiError('Server error', 500);
    expect(isNotFoundError(error)).toBe(false);
  });
});

describe('wrapApiCall', () => {
  it('returns result on success', async () => {
    const result = await wrapApiCall(async () => 'success', 'Test operation');

    expect(result).toBe('success');
  });

  it('wraps errors in ContentfulApiError', async () => {
    await expect(
      wrapApiCall(async () => {
        throw new Error('Network failure');
      }, 'Test operation')
    ).rejects.toThrow(ContentfulApiError);
  });

  it('preserves ContentfulPluginError subclasses', async () => {
    const configError = new ContentfulConfigError('Bad config');

    await expect(
      wrapApiCall(async () => {
        throw configError;
      }, 'Test operation')
    ).rejects.toThrow(configError);
  });

  it('includes context message in wrapped error', async () => {
    await expect(
      wrapApiCall(async () => {
        throw new Error('Original error');
      }, 'Fetching content types')
    ).rejects.toThrow('Fetching content types: Original error');
  });
});
