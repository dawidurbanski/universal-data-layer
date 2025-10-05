import React from 'react';

export interface Scenario {
  id: string;
  package: string;
  feature: string;
  title: string;
  description?: string;
  dependsOn?: string[];
  component?: React.ComponentType;
  docsPath?: string;
}

export type ScenarioManifest = Omit<Scenario, 'id' | 'component' | 'docsPath'>;
