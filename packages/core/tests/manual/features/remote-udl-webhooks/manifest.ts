import type { ScenarioManifest } from '../../../../../../tests/manual/src/types';

const manifest: ScenarioManifest = {
  package: 'core',
  feature: 'remote-udl-webhooks',
  title: 'Remote UDL with Webhooks',
  description:
    'Demonstrates CRUD operations with MSW-mocked REST API and UDL webhook integration for real-time sync',
  dependsOn: [],
};

export default manifest;
