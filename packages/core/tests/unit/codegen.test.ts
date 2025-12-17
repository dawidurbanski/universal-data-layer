/**
 * Tests for packages/core/src/codegen.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCodegen } from '@/codegen.js';
import type { RunCodegenOptions } from '@/codegen.js';
import type { NodeStore } from '@/nodes/store.js';
import type { GraphQLSchema } from 'graphql';
import type { ContentTypeDefinition } from '@/codegen/types/index.js';

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

// Mock codegen module
vi.mock('@/codegen/index.js', () => ({
  inferSchemaFromStore: vi.fn(),
  TypeScriptGenerator: vi.fn(),
  TypeGuardGenerator: vi.fn(),
  resolveCodegenConfig: vi.fn(),
  loadExtensions: vi.fn(),
}));

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  inferSchemaFromStore,
  TypeScriptGenerator,
  TypeGuardGenerator,
  resolveCodegenConfig,
  loadExtensions,
} from '@/codegen/index.js';

describe('runCodegen', () => {
  // Store spies for console
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  // Mock generators
  const mockTsGenerate = vi.fn().mockReturnValue('// Generated types');
  const mockGuardGenerate = vi.fn().mockReturnValue('// Generated guards');

  // Mock store
  const mockStore = {
    getAll: vi.fn().mockReturnValue([]),
  } as unknown as NodeStore;

  // Default config
  const defaultResolvedConfig = {
    output: './generated',
    guards: false,
    helpers: false,
    customScalars: {},
    includeInternal: true,
    includeJsDoc: true,
    exportFormat: 'interface' as const,
    extensions: [],
  };

  // Sample schemas
  const sampleSchemas: ContentTypeDefinition[] = [
    {
      name: 'Product',
      fields: [
        { name: 'id', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
      ],
    },
    {
      name: 'Category',
      fields: [{ name: 'id', type: 'string', required: true }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup console spies
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Setup default mocks
    vi.mocked(resolveCodegenConfig).mockReturnValue(defaultResolvedConfig);
    vi.mocked(inferSchemaFromStore).mockReturnValue(sampleSchemas);
    vi.mocked(loadExtensions).mockResolvedValue([]);
    vi.mocked(TypeScriptGenerator).mockImplementation(
      () =>
        ({
          generate: mockTsGenerate,
        }) as unknown as InstanceType<typeof TypeScriptGenerator>
    );
    vi.mocked(TypeGuardGenerator).mockImplementation(
      () =>
        ({
          generate: mockGuardGenerate,
        }) as unknown as InstanceType<typeof TypeGuardGenerator>
    );
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should skip codegen when no nodes are found in store', async () => {
    vi.mocked(inferSchemaFromStore).mockReturnValue([]);

    const options: RunCodegenOptions = {
      config: {},
      store: mockStore,
    };

    await runCodegen(options);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'ℹ️  No nodes found in store, skipping codegen'
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should generate TypeScript types and write files', async () => {
    const options: RunCodegenOptions = {
      config: {},
      store: mockStore,
      basePath: '/test/project',
    };

    await runCodegen(options);

    // Should create directories
    expect(mkdir).toHaveBeenCalledWith('/test/project/generated', {
      recursive: true,
    });
    expect(mkdir).toHaveBeenCalledWith('/test/project/generated/types', {
      recursive: true,
    });

    // Should write types file
    expect(writeFile).toHaveBeenCalledWith(
      '/test/project/generated/types/index.ts',
      '// Generated types'
    );

    // Should write main index
    expect(writeFile).toHaveBeenCalledWith(
      '/test/project/generated/index.ts',
      expect.stringContaining(
        "export type { Product, Category } from './types/index'"
      )
    );
  });

  it('should use process.cwd() when basePath is not provided', async () => {
    const originalCwd = process.cwd();
    vi.spyOn(process, 'cwd').mockReturnValue('/default/cwd');

    const options: RunCodegenOptions = {
      config: {},
      store: mockStore,
    };

    await runCodegen(options);

    expect(mkdir).toHaveBeenCalledWith('/default/cwd/generated', {
      recursive: true,
    });

    vi.spyOn(process, 'cwd').mockReturnValue(originalCwd);
  });

  it('should pass owners filter to inferSchemaFromStore', async () => {
    const options: RunCodegenOptions = {
      config: {},
      store: mockStore,
      owners: ['plugin-a', 'plugin-b'],
    };

    await runCodegen(options);

    expect(inferSchemaFromStore).toHaveBeenCalledWith(mockStore, {
      owners: ['plugin-a', 'plugin-b'],
    });
  });

  it('should pass types filter to inferSchemaFromStore when config.types is provided', async () => {
    const options: RunCodegenOptions = {
      config: {
        types: ['Product', 'Category'],
      } as unknown as RunCodegenOptions['config'],
      store: mockStore,
      owners: ['plugin-a'], // Should be ignored when types is specified
    };

    await runCodegen(options);

    expect(inferSchemaFromStore).toHaveBeenCalledWith(mockStore, {
      types: ['Product', 'Category'],
    });
  });

  it('should not pass owners when empty array', async () => {
    const options: RunCodegenOptions = {
      config: {},
      store: mockStore,
      owners: [],
    };

    await runCodegen(options);

    expect(inferSchemaFromStore).toHaveBeenCalledWith(mockStore, {});
  });

  it('should generate type guards when guards option is enabled', async () => {
    vi.mocked(resolveCodegenConfig).mockReturnValue({
      ...defaultResolvedConfig,
      guards: true,
    });

    const options: RunCodegenOptions = {
      config: { guards: true },
      store: mockStore,
      basePath: '/test/project',
    };

    await runCodegen(options);

    // Should create guards directory
    expect(mkdir).toHaveBeenCalledWith('/test/project/generated/guards', {
      recursive: true,
    });

    // Should write guards file
    expect(writeFile).toHaveBeenCalledWith(
      '/test/project/generated/guards/index.ts',
      '// Generated guards'
    );

    // Index should include guard exports
    const indexCall = vi
      .mocked(writeFile)
      .mock.calls.find(
        (call) => call[0] === '/test/project/generated/index.ts'
      );
    expect(indexCall?.[1]).toContain(
      "export { isProduct, assertProduct, isCategory, assertCategory } from './guards/index'"
    );
  });

  it('should not create directories that already exist', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const options: RunCodegenOptions = {
      config: {},
      store: mockStore,
      basePath: '/test/project',
    };

    await runCodegen(options);

    // Should not call mkdir for existing directories
    expect(mkdir).not.toHaveBeenCalled();
  });

  it('should pass includeJsDoc and includeInternal to TypeScriptGenerator', async () => {
    vi.mocked(resolveCodegenConfig).mockReturnValue({
      ...defaultResolvedConfig,
      includeJsDoc: false,
      includeInternal: false,
    });

    const options: RunCodegenOptions = {
      config: { includeJsDoc: false, includeInternal: false },
      store: mockStore,
    };

    await runCodegen(options);

    expect(TypeScriptGenerator).toHaveBeenCalledWith({
      includeJsDoc: false,
      includeInternal: false,
    });
  });

  it('should pass includeJsDoc to TypeGuardGenerator', async () => {
    vi.mocked(resolveCodegenConfig).mockReturnValue({
      ...defaultResolvedConfig,
      guards: true,
      includeJsDoc: false,
    });

    const options: RunCodegenOptions = {
      config: { guards: true, includeJsDoc: false },
      store: mockStore,
    };

    await runCodegen(options);

    expect(TypeGuardGenerator).toHaveBeenCalledWith({
      includeJsDoc: false,
    });
  });

  it('should log completion message with owners', async () => {
    const options: RunCodegenOptions = {
      config: {},
      store: mockStore,
      owners: ['plugin-a', 'plugin-b'],
    };

    await runCodegen(options);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '✅ Generated types in plugin-a, plugin-b'
    );
  });

  describe('extensions', () => {
    const mockExtension = {
      name: 'test-extension',
      outputDir: 'custom',
      generate: vi.fn(),
    };

    const mockSchema = {} as GraphQLSchema;

    beforeEach(() => {
      vi.mocked(resolveCodegenConfig).mockReturnValue({
        ...defaultResolvedConfig,
        extensions: [mockExtension],
      });
      vi.mocked(loadExtensions).mockResolvedValue([mockExtension]);
    });

    it('should run extensions when configured', async () => {
      mockExtension.generate.mockResolvedValue({
        code: '// Extension code',
        wildcardExport: true,
      });

      const options: RunCodegenOptions = {
        config: { extensions: [mockExtension] },
        store: mockStore,
        basePath: '/test/project',
        schema: mockSchema,
      };

      await runCodegen(options);

      expect(loadExtensions).toHaveBeenCalledWith([mockExtension]);
      expect(mockExtension.generate).toHaveBeenCalledWith({
        schema: mockSchema,
        types: sampleSchemas,
        basePath: '/test/project',
        config: expect.objectContaining({ extensions: [mockExtension] }),
      });

      // Should create extension directory
      expect(mkdir).toHaveBeenCalledWith('/test/project/generated/custom', {
        recursive: true,
      });

      // Should write extension file
      expect(writeFile).toHaveBeenCalledWith(
        '/test/project/generated/custom/index.ts',
        '// Extension code'
      );
    });

    it('should skip extension when no schema is provided', async () => {
      const options: RunCodegenOptions = {
        config: { extensions: [mockExtension] },
        store: mockStore,
        basePath: '/test/project',
        // No schema provided
      };

      await runCodegen(options);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  Extension "test-extension" requires a schema but none is available'
      );
      expect(mockExtension.generate).not.toHaveBeenCalled();
    });

    it('should handle extension that returns null', async () => {
      mockExtension.generate.mockResolvedValue(null);

      const options: RunCodegenOptions = {
        config: { extensions: [mockExtension] },
        store: mockStore,
        basePath: '/test/project',
        schema: mockSchema,
      };

      await runCodegen(options);

      // Should not create extension directory
      expect(mkdir).not.toHaveBeenCalledWith(
        '/test/project/generated/custom',
        expect.anything()
      );
    });

    it('should handle extension that throws error', async () => {
      const error = new Error('Extension failed');
      mockExtension.generate.mockRejectedValue(error);

      const options: RunCodegenOptions = {
        config: { extensions: [mockExtension] },
        store: mockStore,
        basePath: '/test/project',
        schema: mockSchema,
      };

      await runCodegen(options);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  Extension "test-extension" failed:',
        error
      );
    });

    it('should not run extensions when loadExtensions returns empty array', async () => {
      vi.mocked(loadExtensions).mockResolvedValue([]);

      const options: RunCodegenOptions = {
        config: { extensions: [mockExtension] },
        store: mockStore,
        basePath: '/test/project',
        schema: mockSchema,
      };

      await runCodegen(options);

      expect(mockExtension.generate).not.toHaveBeenCalled();
    });

    it('should use wildcard export by default for extensions', async () => {
      mockExtension.generate.mockResolvedValue({
        code: '// Extension code',
        // wildcardExport not specified
      });

      const options: RunCodegenOptions = {
        config: { extensions: [mockExtension] },
        store: mockStore,
        basePath: '/test/project',
        schema: mockSchema,
      };

      await runCodegen(options);

      const indexCall = vi
        .mocked(writeFile)
        .mock.calls.find(
          (call) => call[0] === '/test/project/generated/index.ts'
        );
      expect(indexCall?.[1]).toContain("export * from './custom/index'");
    });

    it('should use named exports when wildcardExport is false', async () => {
      mockExtension.generate.mockResolvedValue({
        code: '// Extension code',
        wildcardExport: false,
        exports: ['fetchProduct', 'fetchCategory'],
      });

      const options: RunCodegenOptions = {
        config: { extensions: [mockExtension] },
        store: mockStore,
        basePath: '/test/project',
        schema: mockSchema,
      };

      await runCodegen(options);

      const indexCall = vi
        .mocked(writeFile)
        .mock.calls.find(
          (call) => call[0] === '/test/project/generated/index.ts'
        );
      expect(indexCall?.[1]).toContain(
        "export { fetchProduct, fetchCategory } from './custom/index'"
      );
    });

    it('should not add export line when wildcardExport is false and exports is empty', async () => {
      mockExtension.generate.mockResolvedValue({
        code: '// Extension code',
        wildcardExport: false,
        exports: [],
      });

      const options: RunCodegenOptions = {
        config: { extensions: [mockExtension] },
        store: mockStore,
        basePath: '/test/project',
        schema: mockSchema,
      };

      await runCodegen(options);

      const indexCall = vi
        .mocked(writeFile)
        .mock.calls.find(
          (call) => call[0] === '/test/project/generated/index.ts'
        );
      // Should have extension comment but no export line
      expect(indexCall?.[1]).toContain('// Extension: custom');
      expect(indexCall?.[1]).not.toContain("from './custom/index'");
    });
  });

  describe('generateIndexFile', () => {
    it('should generate proper index file header', async () => {
      const options: RunCodegenOptions = {
        config: {},
        store: mockStore,
        basePath: '/test/project',
      };

      await runCodegen(options);

      const indexCall = vi
        .mocked(writeFile)
        .mock.calls.find(
          (call) => call[0] === '/test/project/generated/index.ts'
        );
      const content = indexCall?.[1] as string;

      expect(content).toContain('Auto-generated by universal-data-layer');
      expect(content).toContain('DO NOT EDIT MANUALLY');
    });

    it('should include // Types comment', async () => {
      const options: RunCodegenOptions = {
        config: {},
        store: mockStore,
        basePath: '/test/project',
      };

      await runCodegen(options);

      const indexCall = vi
        .mocked(writeFile)
        .mock.calls.find(
          (call) => call[0] === '/test/project/generated/index.ts'
        );
      expect(indexCall?.[1]).toContain('// Types');
    });

    it('should include // Type Guards comment when guards are enabled', async () => {
      vi.mocked(resolveCodegenConfig).mockReturnValue({
        ...defaultResolvedConfig,
        guards: true,
      });

      const options: RunCodegenOptions = {
        config: { guards: true },
        store: mockStore,
        basePath: '/test/project',
      };

      await runCodegen(options);

      const indexCall = vi
        .mocked(writeFile)
        .mock.calls.find(
          (call) => call[0] === '/test/project/generated/index.ts'
        );
      expect(indexCall?.[1]).toContain('// Type Guards');
    });
  });

  describe('directory creation', () => {
    it('should only create guards directory when guards are enabled', async () => {
      vi.mocked(resolveCodegenConfig).mockReturnValue({
        ...defaultResolvedConfig,
        guards: true,
      });
      vi.mocked(existsSync).mockReturnValue(false);

      const options: RunCodegenOptions = {
        config: { guards: true },
        store: mockStore,
        basePath: '/test/project',
      };

      await runCodegen(options);

      expect(mkdir).toHaveBeenCalledWith('/test/project/generated/guards', {
        recursive: true,
      });
    });

    it('should not create guards directory when guards are disabled', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const options: RunCodegenOptions = {
        config: {},
        store: mockStore,
        basePath: '/test/project',
      };

      await runCodegen(options);

      expect(mkdir).not.toHaveBeenCalledWith(
        '/test/project/generated/guards',
        expect.anything()
      );
    });

    it('should check if guards directory exists before creating', async () => {
      vi.mocked(resolveCodegenConfig).mockReturnValue({
        ...defaultResolvedConfig,
        guards: true,
      });
      // First three calls (outputDir, typesDir, guardsDir) return different values
      vi.mocked(existsSync)
        .mockReturnValueOnce(false) // outputDir
        .mockReturnValueOnce(false) // typesDir
        .mockReturnValueOnce(true); // guardsDir - already exists

      const options: RunCodegenOptions = {
        config: { guards: true },
        store: mockStore,
        basePath: '/test/project',
      };

      await runCodegen(options);

      // Guards directory should not be created since it exists
      expect(mkdir).not.toHaveBeenCalledWith(
        '/test/project/generated/guards',
        expect.anything()
      );
    });

    it('should check if extension directory exists before creating', async () => {
      const mockExtension = {
        name: 'test-extension',
        outputDir: 'custom',
        generate: vi.fn().mockResolvedValue({
          code: '// Extension code',
        }),
      };

      vi.mocked(resolveCodegenConfig).mockReturnValue({
        ...defaultResolvedConfig,
        extensions: [mockExtension],
      });
      vi.mocked(loadExtensions).mockResolvedValue([mockExtension]);

      // Extension directory exists
      vi.mocked(existsSync)
        .mockReturnValueOnce(false) // outputDir
        .mockReturnValueOnce(false) // typesDir
        .mockReturnValueOnce(true); // extension dir - already exists

      const options: RunCodegenOptions = {
        config: { extensions: [mockExtension] },
        store: mockStore,
        basePath: '/test/project',
        schema: {} as GraphQLSchema,
      };

      await runCodegen(options);

      // Extension directory should not be created since it exists
      expect(mkdir).not.toHaveBeenCalledWith(
        '/test/project/generated/custom',
        expect.anything()
      );
    });
  });

  describe('logging', () => {
    it('should log the number of node types being generated', async () => {
      const options: RunCodegenOptions = {
        config: {},
        store: mockStore,
      };

      await runCodegen(options);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '⸆⸉ Generating types for 2 node type(s)...'
      );
    });

    it('should log when running an extension', async () => {
      const mockExtension = {
        name: 'my-extension',
        outputDir: 'custom',
        generate: vi.fn().mockResolvedValue({ code: '// code' }),
      };

      vi.mocked(resolveCodegenConfig).mockReturnValue({
        ...defaultResolvedConfig,
        extensions: [mockExtension],
      });
      vi.mocked(loadExtensions).mockResolvedValue([mockExtension]);

      const options: RunCodegenOptions = {
        config: { extensions: [mockExtension] },
        store: mockStore,
        schema: {} as GraphQLSchema,
      };

      await runCodegen(options);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '⸆⸉ Running extension "my-extension"...'
      );
    });
  });
});
