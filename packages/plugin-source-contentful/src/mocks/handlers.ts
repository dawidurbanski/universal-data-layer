import { http, HttpResponse, type JsonBodyType } from 'msw';

// Default fixtures (used when no override provided)
import defaultContentTypes from './fixtures/content-types.json' with { type: 'json' };
import defaultEntries from './fixtures/entries.json' with { type: 'json' };
import defaultAssets from './fixtures/assets.json' with { type: 'json' };

export interface ContentfulFixtures {
  contentTypes: JsonBodyType;
  entries: JsonBodyType[];
  assets: JsonBodyType[];
}

let fixtures: ContentfulFixtures = {
  contentTypes: defaultContentTypes,
  entries: defaultEntries,
  assets: defaultAssets,
};

// Allow manual tests to override fixtures
export function setContentfulFixtures(custom: Partial<ContentfulFixtures>) {
  fixtures = { ...fixtures, ...custom };
}

export function createContentfulHandlers() {
  return [
    // Content Types endpoint
    http.get(
      'https://cdn.contentful.com/spaces/:spaceId/environments/:env/content_types',
      () => {
        return HttpResponse.json(fixtures.contentTypes);
      }
    ),

    // Sync API endpoint
    http.get(
      'https://cdn.contentful.com/spaces/:spaceId/environments/:env/sync',
      ({ request }) => {
        const url = new URL(request.url);
        const isInitial = url.searchParams.get('initial') === 'true';

        // Note: For delta syncs, the real API uses sync_token to track changes.
        // Our mock just returns empty (no changes) for any non-initial sync.
        if (isInitial) {
          // Initial sync - return all entries and assets
          return HttpResponse.json({
            sys: { type: 'Array' },
            items: [...fixtures.entries, ...fixtures.assets],
            nextSyncUrl:
              'https://cdn.contentful.com/spaces/mock-space/environments/master/sync?sync_token=mock-token-1',
          });
        }

        // Delta sync - return empty (no changes)
        // In a real scenario, you could track changes and return only modified items
        return HttpResponse.json({
          sys: { type: 'Array' },
          items: [],
          deletedEntries: [],
          deletedAssets: [],
          nextSyncUrl: `https://cdn.contentful.com/spaces/mock-space/environments/master/sync?sync_token=mock-token-${Date.now()}`,
        });
      }
    ),
  ];
}

// For backward compatibility and simpler usage
export const contentfulHandlers = createContentfulHandlers();
