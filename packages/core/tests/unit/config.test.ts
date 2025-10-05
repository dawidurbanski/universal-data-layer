import { afterEach, describe, expect, it } from 'vitest';
import { createConfig, getConfig } from '@/config.js';

describe('config', () => {
  afterEach(() => {
    // Reset to default config after each test
    createConfig({
      staticPath: '/static/',
      endpoint: 'http://localhost:4000/graphql',
      port: 4000,
      host: 'localhost',
    });
  });

  describe('createConfig', () => {
    it('should create config with default values when no options provided', () => {
      const config = createConfig();

      expect(config).toEqual({
        staticPath: '/static/',
        endpoint: 'http://localhost:4000/graphql',
        port: 4000,
        host: 'localhost',
      });
    });

    it('should override staticPath when provided', () => {
      const config = createConfig({ staticPath: '/custom-static/' });

      expect(config.staticPath).toBe('/custom-static/');
      expect(config.endpoint).toBe('http://localhost:4000/graphql');
    });

    it('should override endpoint when provided', () => {
      const config = createConfig({ endpoint: 'http://example.com/graphql' });

      expect(config.endpoint).toBe('http://example.com/graphql');
    });

    it('should override port and generate new endpoint', () => {
      const config = createConfig({ port: 3000 });

      expect(config.port).toBe(3000);
      expect(config.endpoint).toBe('http://localhost:3000/graphql');
    });

    it('should override host and generate new endpoint', () => {
      const config = createConfig({ host: '0.0.0.0' });

      expect(config.host).toBe('0.0.0.0');
      expect(config.endpoint).toBe('http://0.0.0.0:4000/graphql');
    });

    it('should override both host and port and generate new endpoint', () => {
      const config = createConfig({ host: '0.0.0.0', port: 3000 });

      expect(config.host).toBe('0.0.0.0');
      expect(config.port).toBe(3000);
      expect(config.endpoint).toBe('http://0.0.0.0:3000/graphql');
    });

    it('should update currentConfig when called', () => {
      createConfig({ port: 5000 });
      const currentConfig = getConfig();

      expect(currentConfig.port).toBe(5000);
      expect(currentConfig.endpoint).toBe('http://localhost:5000/graphql');
    });

    it('should use previous config values as defaults', () => {
      // First config
      createConfig({ staticPath: '/first/', port: 3000 });

      // Second config without those options
      const config = createConfig({ host: '127.0.0.1' });

      // Should retain staticPath and port from previous config
      expect(config.staticPath).toBe('/first/');
      expect(config.port).toBe(3000);
      expect(config.host).toBe('127.0.0.1');
      expect(config.endpoint).toBe('http://127.0.0.1:3000/graphql');
    });

    it('should override all options when provided', () => {
      const config = createConfig({
        staticPath: '/assets/',
        endpoint: 'http://api.example.com/graphql',
        port: 8080,
        host: 'api.example.com',
      });

      expect(config).toEqual({
        staticPath: '/assets/',
        endpoint: 'http://api.example.com/graphql',
        port: 8080,
        host: 'api.example.com',
      });
    });
  });

  describe('getConfig', () => {
    it('should return current config', () => {
      const createdConfig = createConfig({ port: 9000 });
      const retrievedConfig = getConfig();

      expect(retrievedConfig).toEqual(createdConfig);
      expect(retrievedConfig.port).toBe(9000);
    });

    it('should return updated config after multiple createConfig calls', () => {
      createConfig({ port: 3000 });
      createConfig({ port: 5000 });

      const config = getConfig();

      expect(config.port).toBe(5000);
    });
  });

  describe('edge cases', () => {
    it('should use default port when currentConfig.port is undefined', () => {
      // First create a config with undefined port by setting only other fields
      // This is a bit contrived but we need to test the || 4000 fallback
      createConfig({ staticPath: '/test/' });

      // Manually manipulate currentConfig to remove port (simulating edge case)
      const currentConfig = getConfig();
      delete currentConfig.port;

      // Now create config without specifying port
      const config2 = createConfig({ staticPath: '/test2/' });

      // Should fall back to default 4000
      expect(config2.port).toBe(4000);
      expect(config2.endpoint).toBe('http://localhost:4000/graphql');
    });

    it('should use default host when currentConfig.host is undefined', () => {
      // First create a config
      createConfig({ staticPath: '/test/' });

      // Manually manipulate currentConfig to remove host (simulating edge case)
      const currentConfig = getConfig();
      delete currentConfig.host;

      // Now create config without specifying host
      const config2 = createConfig({ staticPath: '/test2/' });

      // Should fall back to default 'localhost'
      expect(config2.host).toBe('localhost');
      expect(config2.endpoint).toBe('http://localhost:4000/graphql');
    });

    it('should use default port and host when both are undefined in currentConfig', () => {
      // First create a config
      createConfig({ staticPath: '/test/' });

      // Manually manipulate currentConfig to remove both
      const currentConfig = getConfig();
      delete currentConfig.port;
      delete currentConfig.host;

      // Now create config without specifying port or host
      const config2 = createConfig({ staticPath: '/test2/' });

      // Should fall back to defaults
      expect(config2.port).toBe(4000);
      expect(config2.host).toBe('localhost');
      expect(config2.endpoint).toBe('http://localhost:4000/graphql');
    });
  });
});
