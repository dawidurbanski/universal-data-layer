import { http, HttpResponse } from 'msw';
import contentTypes from './fixtures/content-types.json';
import entries from './fixtures/entries.json';
import assets from './fixtures/assets.json';

export const handlers = [
  // Content Types endpoint
  http.get(
    'https://cdn.contentful.com/spaces/:spaceId/environments/:env/content_types',
    () => {
      return HttpResponse.json(contentTypes);
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
          items: [...entries, ...assets],
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
