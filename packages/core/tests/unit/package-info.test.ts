import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  loadPackageJson,
  getPackageVersion,
  getPackageName,
  getPackageType,
} from '@/utils/package-info.js';

vi.mock('fs');
vi.mock('path');
vi.mock('url');

describe('package-info', () => {
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockFileURLToPath = vi.mocked(fileURLToPath);
  const mockDirname = vi.mocked(dirname);
  const mockJoin = vi.mocked(join);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loadPackageJson', () => {
    it('should load package.json using callerUrl when provided', () => {
      const mockCallerUrl = 'file:///path/to/project/udl.config.ts';
      const mockFilePath = '/path/to/project/udl.config.ts';
      const mockDirPath = '/path/to/project';
      const mockPackageJsonPath = '/path/to/project/package.json';
      const mockPackageJson = {
        name: 'test-package',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const result = loadPackageJson(mockCallerUrl);

      expect(mockFileURLToPath).toHaveBeenCalledWith(mockCallerUrl);
      expect(mockDirname).toHaveBeenCalledWith(mockFilePath);
      expect(mockJoin).toHaveBeenCalledWith(mockDirPath, 'package.json');
      expect(mockReadFileSync).toHaveBeenCalledWith(
        mockPackageJsonPath,
        'utf-8'
      );
      expect(result).toEqual(mockPackageJson);
    });

    it('should load package.json using import.meta.url when callerUrl is not provided', () => {
      const mockFilePath = '/default/path/file.ts';
      const mockDirPath = '/default/path';
      const mockPackageJsonPath = '/default/path/package.json';
      const mockPackageJson = {
        name: 'default-package',
        version: '2.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const result = loadPackageJson();

      expect(mockFileURLToPath).toHaveBeenCalled();
      expect(mockDirname).toHaveBeenCalledWith(mockFilePath);
      expect(mockJoin).toHaveBeenCalledWith(mockDirPath, 'package.json');
      expect(mockReadFileSync).toHaveBeenCalledWith(
        mockPackageJsonPath,
        'utf-8'
      );
      expect(result).toEqual(mockPackageJson);
    });

    it('should parse JSON correctly with complex package.json', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@scope/complex-package',
        version: '3.5.2',
        dependencies: {
          foo: '^1.0.0',
        },
        scripts: {
          test: 'vitest',
        },
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const result = loadPackageJson(mockCallerUrl);

      expect(result).toEqual(mockPackageJson);
    });
  });

  describe('getPackageVersion', () => {
    it('should extract version from package.json', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: 'test-package',
        version: '1.2.3',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const version = getPackageVersion(mockCallerUrl);

      expect(version).toBe('1.2.3');
    });

    it('should work without callerUrl parameter', () => {
      const mockFilePath = '/default/path/file.ts';
      const mockDirPath = '/default/path';
      const mockPackageJsonPath = '/default/path/package.json';
      const mockPackageJson = {
        name: 'default-package',
        version: '4.5.6',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const version = getPackageVersion();

      expect(version).toBe('4.5.6');
    });
  });

  describe('getPackageName', () => {
    it('should return full name for universal-data-layer package', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: 'universal-data-layer',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const name = getPackageName(mockCallerUrl);

      expect(name).toBe('universal-data-layer');
    });

    it('should extract name from @universal-data-layer/source-contentful', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/source-contentful',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const name = getPackageName(mockCallerUrl);

      expect(name).toBe('contentful');
    });

    it('should extract name from @universal-data-layer/source-shopify', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/source-shopify',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const name = getPackageName(mockCallerUrl);

      expect(name).toBe('shopify');
    });

    it('should return name part without prefix for @universal-data-layer/other-package', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/other-package',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const name = getPackageName(mockCallerUrl);

      expect(name).toBe('package');
    });

    it('should return full name when namePart is empty', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const name = getPackageName(mockCallerUrl);

      expect(name).toBe('@universal-data-layer/');
    });

    it('should return name part when no type prefix matches', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/standalone-name',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const name = getPackageName(mockCallerUrl);

      expect(name).toBe('standalone-name');
    });

    it('should work without callerUrl parameter', () => {
      const mockFilePath = '/default/path/file.ts';
      const mockDirPath = '/default/path';
      const mockPackageJsonPath = '/default/path/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/source-okendo',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const name = getPackageName();

      expect(name).toBe('okendo');
    });
  });

  describe('getPackageType', () => {
    it('should return "core" for universal-data-layer package', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: 'universal-data-layer',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const type = getPackageType(mockCallerUrl);

      expect(type).toBe('core');
    });

    it('should return "source" for @universal-data-layer/source-contentful', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/source-contentful',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const type = getPackageType(mockCallerUrl);

      expect(type).toBe('source');
    });

    it('should return "source" for @universal-data-layer/source-shopify', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/source-shopify',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const type = getPackageType(mockCallerUrl);

      expect(type).toBe('source');
    });

    it('should return "other" for @universal-data-layer/unknown-type-package', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/unknown-type-package',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const type = getPackageType(mockCallerUrl);

      expect(type).toBe('other');
    });

    it('should return "other" when namePart is empty', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const type = getPackageType(mockCallerUrl);

      expect(type).toBe('other');
    });

    it('should return "other" when no type prefix matches', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/standalone',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const type = getPackageType(mockCallerUrl);

      expect(type).toBe('other');
    });

    it('should return "other" when type prefix does not match valid plugin types', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/invalid-something',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const type = getPackageType(mockCallerUrl);

      expect(type).toBe('other');
    });

    it('should work without callerUrl parameter', () => {
      const mockFilePath = '/default/path/file.ts';
      const mockDirPath = '/default/path';
      const mockPackageJsonPath = '/default/path/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/source-okendo',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const type = getPackageType();

      expect(type).toBe('source');
    });

    it('should return "other" for @universal-data-layer/other-package', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/other-package',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const type = getPackageType(mockCallerUrl);

      expect(type).toBe('other');
    });

    it('should return "core" for @universal-data-layer/core-something', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/core-utils',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const type = getPackageType(mockCallerUrl);

      expect(type).toBe('core');
    });
  });

  describe('edge cases', () => {
    it('should handle package names without hyphens in namePart', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: '@universal-data-layer/justname',
        version: '1.0.0',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const type = getPackageType(mockCallerUrl);
      const name = getPackageName(mockCallerUrl);

      expect(type).toBe('other');
      expect(name).toBe('justname');
    });

    it('should handle package.json with extra fields', () => {
      const mockCallerUrl = 'file:///project/config.ts';
      const mockFilePath = '/project/config.ts';
      const mockDirPath = '/project';
      const mockPackageJsonPath = '/project/package.json';
      const mockPackageJson = {
        name: 'universal-data-layer',
        version: '1.0.0',
        description: 'A test package',
        author: 'Test Author',
        license: 'MIT',
      };

      mockFileURLToPath.mockReturnValue(mockFilePath);
      mockDirname.mockReturnValue(mockDirPath);
      mockJoin.mockReturnValue(mockPackageJsonPath);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const packageJson = loadPackageJson(mockCallerUrl);

      expect(packageJson).toEqual(mockPackageJson);
      expect(packageJson['description']).toBe('A test package');
    });
  });
});
