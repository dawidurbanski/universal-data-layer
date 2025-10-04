import type { UDLConfig, OnLoadContext } from 'universal-data-layer';

interface ContentfulPluginOptions {
  spaceId: string;
  accessToken: string;
  environment?: string;
  host?: string;
}

export const config: UDLConfig = {
  type: 'source',
  name: 'contentful',
  version: '0.0.1',
};

export function onLoad(context: OnLoadContext<ContentfulPluginOptions>) {
  const { options, config } = context;
  console.log('Plugin Contentful loaded', options, config);
}
