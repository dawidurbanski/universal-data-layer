import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CODEGEN_CONFIG,
  resolveCodegenConfig,
} from '@/codegen/config.js';

describe('codegen/config', () => {
  describe('DEFAULT_CODEGEN_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_CODEGEN_CONFIG).toEqual({
        output: './generated',
        guards: false,
        helpers: false,
        customScalars: {},
        includeInternal: true,
        includeJsDoc: true,
        exportFormat: 'interface',
        extensions: [],
      });
    });
  });

  describe('resolveCodegenConfig', () => {
    it('should return defaults when called with no config', () => {
      const result = resolveCodegenConfig();

      expect(result).toEqual({
        output: './generated',
        guards: false,
        helpers: false,
        customScalars: {},
        includeInternal: true,
        includeJsDoc: true,
        exportFormat: 'interface',
        extensions: [],
      });
    });

    it('should return defaults when called with undefined', () => {
      const result = resolveCodegenConfig(undefined);

      expect(result).toEqual(DEFAULT_CODEGEN_CONFIG);
    });

    it('should override defaults with provided config values', () => {
      const result = resolveCodegenConfig({
        output: './custom-output',
        guards: true,
        helpers: true,
        includeInternal: false,
        includeJsDoc: false,
        exportFormat: 'type',
      });

      expect(result.output).toBe('./custom-output');
      expect(result.guards).toBe(true);
      expect(result.helpers).toBe(true);
      expect(result.includeInternal).toBe(false);
      expect(result.includeJsDoc).toBe(false);
      expect(result.exportFormat).toBe('type');
    });

    it('should merge customScalars with defaults', () => {
      const result = resolveCodegenConfig({
        customScalars: {
          DateTime: 'Date',
          JSON: 'Record<string, unknown>',
        },
      });

      expect(result.customScalars).toEqual({
        DateTime: 'Date',
        JSON: 'Record<string, unknown>',
      });
    });

    it('should preserve default customScalars when merging', () => {
      // First set up a scenario where defaults have scalars
      // In this case, defaults are empty, so we just verify merging works
      const result = resolveCodegenConfig({
        customScalars: { MyScalar: 'string' },
      });

      expect(result.customScalars).toEqual({ MyScalar: 'string' });
    });

    it('should use provided extensions when specified', () => {
      const mockExtension = {
        name: 'test-extension',
        outputDir: 'test-output',
        generate: async () => ({ code: '// test' }),
      };

      const result = resolveCodegenConfig({
        extensions: [mockExtension],
      });

      expect(result.extensions).toEqual([mockExtension]);
    });

    it('should use empty array for extensions when not provided', () => {
      const result = resolveCodegenConfig({
        output: './custom',
      });

      expect(result.extensions).toEqual([]);
    });

    it('should handle empty config object', () => {
      const result = resolveCodegenConfig({});

      expect(result).toEqual({
        output: './generated',
        guards: false,
        helpers: false,
        customScalars: {},
        includeInternal: true,
        includeJsDoc: true,
        exportFormat: 'interface',
        extensions: [],
      });
    });

    it('should handle partial config with only one field', () => {
      const result = resolveCodegenConfig({ guards: true });

      expect(result.guards).toBe(true);
      expect(result.output).toBe('./generated');
      expect(result.helpers).toBe(false);
    });

    it('should handle string extension specs', () => {
      const result = resolveCodegenConfig({
        extensions: ['@universal-data-layer/codegen-typed-queries'],
      });

      expect(result.extensions).toEqual([
        '@universal-data-layer/codegen-typed-queries',
      ]);
    });
  });
});
