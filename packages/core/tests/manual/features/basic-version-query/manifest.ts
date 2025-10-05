import type { ScenarioManifest } from '../../../../../../tests/manual/src/types';

const manifest: ScenarioManifest = {
  package: 'core',
  feature: 'basic-version-query',
  title: 'Basic Version Query',
  description:
    'This test verifies that the UDL GraphQL server is running and can respond to queries.',
  dependsOn: [],
};

export default manifest;
