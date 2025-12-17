import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadExtensions } from '@/codegen/extensions.js';
import type { CodegenExtension } from '@/codegen/types/index.js';

// To test the dynamic import branches, we need to create fixture modules that can be imported.
// Since we can't easily mock dynamic import(), we use vi.doMock with vi.importActual patterns.

describe('loadExtensions', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('with direct extension objects', () => {
    it('returns an empty array when given an empty specs array', async () => {
      const result = await loadExtensions([]);
      expect(result).toEqual([]);
    });

    it('passes through a single direct extension object', async () => {
      const extension: CodegenExtension = {
        name: 'test-extension',
        outputDir: 'test',
        generate: vi.fn().mockResolvedValue({ code: '// test' }),
      };

      const result = await loadExtensions([extension]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(extension);
    });

    it('handles multiple direct extension objects', async () => {
      const extension1: CodegenExtension = {
        name: 'ext-1',
        outputDir: 'ext1',
        generate: vi.fn().mockResolvedValue({ code: '// ext1' }),
      };
      const extension2: CodegenExtension = {
        name: 'ext-2',
        outputDir: 'ext2',
        generate: vi.fn().mockResolvedValue({ code: '// ext2' }),
      };

      const result = await loadExtensions([extension1, extension2]);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(extension1);
      expect(result[1]).toBe(extension2);
    });
  });

  describe('with string package names (dynamic import)', () => {
    it('loads extension from default export', async () => {
      const mockExtension: CodegenExtension = {
        name: 'default-export-ext',
        outputDir: 'default',
        generate: vi.fn().mockResolvedValue({ code: '// default' }),
      };

      // Mock the dynamic import using vi.doMock
      vi.doMock('vitest-test-default-export-package', () => ({
        default: mockExtension,
      }));

      // Re-import the function to pick up the mock
      const { loadExtensions: loadExtensionsFresh } = await import(
        '@/codegen/extensions.js'
      );

      const result = await loadExtensionsFresh([
        'vitest-test-default-export-package',
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockExtension);
    });

    it('loads extension from named extension export when default is not available', async () => {
      const mockExtension: CodegenExtension = {
        name: 'named-export-ext',
        outputDir: 'named',
        generate: vi.fn().mockResolvedValue({ code: '// named' }),
      };

      // Explicitly set default to undefined to ensure the fallback to `extension` works
      vi.doMock('vitest-test-named-export-package', () => ({
        default: undefined,
        extension: mockExtension,
      }));

      const { loadExtensions: loadExtensionsFresh } = await import(
        '@/codegen/extensions.js'
      );

      const result = await loadExtensionsFresh([
        'vitest-test-named-export-package',
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockExtension);
    });

    it('prefers default export over named extension export', async () => {
      const defaultExtension: CodegenExtension = {
        name: 'default-ext',
        outputDir: 'default',
        generate: vi.fn().mockResolvedValue({ code: '// default' }),
      };
      const namedExtension: CodegenExtension = {
        name: 'named-ext',
        outputDir: 'named',
        generate: vi.fn().mockResolvedValue({ code: '// named' }),
      };

      vi.doMock('vitest-test-both-exports-package', () => ({
        default: defaultExtension,
        extension: namedExtension,
      }));

      const { loadExtensions: loadExtensionsFresh } = await import(
        '@/codegen/extensions.js'
      );

      const result = await loadExtensionsFresh([
        'vitest-test-both-exports-package',
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(defaultExtension);
      expect(result[0]).not.toBe(namedExtension);
    });

    it('warns and skips when extension has no valid generate function', async () => {
      const invalidExtension = {
        name: 'invalid-ext',
        outputDir: 'invalid',
        // Missing generate function
      };

      vi.doMock('vitest-test-invalid-package', () => ({
        default: invalidExtension,
      }));

      const { loadExtensions: loadExtensionsFresh } = await import(
        '@/codegen/extensions.js'
      );

      const result = await loadExtensionsFresh(['vitest-test-invalid-package']);

      expect(result).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  Extension "vitest-test-invalid-package" does not export a valid CodegenExtension'
      );
    });

    it('warns and skips when extension is null', async () => {
      vi.doMock('vitest-test-null-package', () => ({
        default: null,
        extension: undefined,
      }));

      const { loadExtensions: loadExtensionsFresh } = await import(
        '@/codegen/extensions.js'
      );

      const result = await loadExtensionsFresh(['vitest-test-null-package']);

      expect(result).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  Extension "vitest-test-null-package" does not export a valid CodegenExtension'
      );
    });

    it('warns and skips when generate is not a function', async () => {
      const invalidExtension = {
        name: 'invalid-ext',
        outputDir: 'invalid',
        generate: 'not a function',
      };

      vi.doMock('vitest-test-invalid-generate-package', () => ({
        default: invalidExtension,
      }));

      const { loadExtensions: loadExtensionsFresh } = await import(
        '@/codegen/extensions.js'
      );

      const result = await loadExtensionsFresh([
        'vitest-test-invalid-generate-package',
      ]);

      expect(result).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  Extension "vitest-test-invalid-generate-package" does not export a valid CodegenExtension'
      );
    });

    it('warns and skips when import fails', async () => {
      // This package doesn't exist and isn't mocked, so import will fail
      const result = await loadExtensions([
        'vitest-test-nonexistent-package-12345',
      ]);

      expect(result).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '⚠️  Failed to load extension "vitest-test-nonexistent-package-12345":'
        ),
        expect.any(Error)
      );
    });
  });

  describe('with mixed specs (objects and strings)', () => {
    it('handles mixed specs correctly', async () => {
      const directExtension: CodegenExtension = {
        name: 'direct-ext',
        outputDir: 'direct',
        generate: vi.fn().mockResolvedValue({ code: '// direct' }),
      };

      const dynamicExtension: CodegenExtension = {
        name: 'dynamic-ext',
        outputDir: 'dynamic',
        generate: vi.fn().mockResolvedValue({ code: '// dynamic' }),
      };

      vi.doMock('vitest-test-mixed-package', () => ({
        default: dynamicExtension,
      }));

      const { loadExtensions: loadExtensionsFresh } = await import(
        '@/codegen/extensions.js'
      );

      const result = await loadExtensionsFresh([
        directExtension,
        'vitest-test-mixed-package',
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(directExtension);
      expect(result[1]).toBe(dynamicExtension);
    });

    it('continues processing remaining specs when one fails', async () => {
      const directExtension: CodegenExtension = {
        name: 'direct-ext',
        outputDir: 'direct',
        generate: vi.fn().mockResolvedValue({ code: '// direct' }),
      };

      // First spec will fail because package doesn't exist
      // Second spec (direct extension) should still be processed
      const result = await loadExtensions([
        'vitest-test-failing-package-xyz',
        directExtension,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(directExtension);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '⚠️  Failed to load extension "vitest-test-failing-package-xyz":'
        ),
        expect.any(Error)
      );
    });

    it('continues processing when invalid extension is in the middle', async () => {
      const extension1: CodegenExtension = {
        name: 'ext-1',
        outputDir: 'ext1',
        generate: vi.fn().mockResolvedValue({ code: '// ext1' }),
      };
      const extension2: CodegenExtension = {
        name: 'ext-2',
        outputDir: 'ext2',
        generate: vi.fn().mockResolvedValue({ code: '// ext2' }),
      };

      vi.doMock('vitest-test-invalid-middle-package', () => ({
        default: { name: 'invalid', outputDir: 'invalid' }, // Missing generate
      }));

      const { loadExtensions: loadExtensionsFresh } = await import(
        '@/codegen/extensions.js'
      );

      const result = await loadExtensionsFresh([
        extension1,
        'vitest-test-invalid-middle-package',
        extension2,
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(extension1);
      expect(result[1]).toBe(extension2);
    });
  });
});
