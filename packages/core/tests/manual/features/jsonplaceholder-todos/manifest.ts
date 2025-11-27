import type { ScenarioManifest } from '../../../../../../tests/manual/src/types';

const manifest: ScenarioManifest = {
  package: 'core',
  feature: 'jsonplaceholder-todos',
  title: 'JSONPlaceholder Todos',
  description:
    'Demonstrates fetching and sourcing Todo items from the JSONPlaceholder API with generated types, guards, and helpers',
  dependsOn: [],
};

export default manifest;
