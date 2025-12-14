/**
 * File Output Handler
 *
 * Handles writing generated code to files with support for single-file
 * and multi-file output modes, content hashing for incremental updates,
 * and barrel file generation.
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import type { ContentTypeDefinition } from '@/codegen/types/schema.js';

/**
 * Output mode for generated files
 */
export type OutputMode = 'single' | 'multi';

/**
 * Options for file writer
 */
export interface FileWriterOptions {
  /**
   * Output directory or file path.
   * If ends with .ts, uses single-file mode.
   * Otherwise, uses multi-file mode with this as the directory.
   * @default './generated'
   */
  output?: string;

  /**
   * Output mode: 'single' for one file, 'multi' for separate files.
   * Auto-detected from output path if not specified.
   */
  mode?: OutputMode;

  /**
   * Whether to include a timestamp in the header.
   * @default false (for reproducible builds)
   */
  includeTimestamp?: boolean;

  /**
   * Whether to use content hashing to skip unchanged files.
   * @default true
   */
  incrementalWrite?: boolean;

  /**
   * Custom header text to include in generated files.
   */
  customHeader?: string;

  /**
   * Whether to generate barrel (index.ts) files in multi-file mode.
   * @default true
   */
  generateBarrel?: boolean;
}

/**
 * Result of a write operation
 */
export interface WriteResult {
  /**
   * Files that were written (created or updated)
   */
  written: string[];

  /**
   * Files that were skipped (unchanged)
   */
  skipped: string[];

  /**
   * Files that were deleted (clean operation)
   */
  deleted: string[];
}

/**
 * Generated file content
 */
export interface GeneratedFile {
  /**
   * Relative path from output directory
   */
  path: string;

  /**
   * File content
   */
  content: string;

  /**
   * Content type name (for multi-file mode)
   */
  typeName?: string;
}

/**
 * Default writer options
 */
const DEFAULT_OPTIONS: Required<FileWriterOptions> = {
  output: './generated',
  mode: 'multi',
  includeTimestamp: false,
  incrementalWrite: true,
  customHeader: '',
  generateBarrel: true,
};

/**
 * File writer for generated code.
 *
 * @example
 * ```ts
 * const writer = new FileWriter({ output: './generated' });
 *
 * // Write types to multiple files
 * const result = writer.writeTypes(schemas, typesCode);
 *
 * // Write guards to multiple files
 * writer.writeGuards(schemas, guardsCode);
 *
 * // Or write everything at once
 * writer.writeAll({
 *   types: { schemas, code: typesCode },
 *   guards: { schemas, code: guardsCode },
 * });
 * ```
 */
export class FileWriter {
  private options: Required<FileWriterOptions>;

  constructor(options: FileWriterOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Auto-detect mode from output path
    if (!options.mode && options.output) {
      this.options.mode = options.output.endsWith('.ts') ? 'single' : 'multi';
    }
  }

  /**
   * Write generated types code to file(s).
   *
   * @param schemas - The schemas that were used to generate the code
   * @param code - The generated TypeScript code
   * @returns Write result with paths of written/skipped files
   */
  writeTypes(schemas: ContentTypeDefinition[], code: string): WriteResult {
    return this.write('types', schemas, code);
  }

  /**
   * Write generated type guards code to file(s).
   *
   * @param schemas - The schemas that were used to generate the code
   * @param code - The generated TypeScript code
   * @returns Write result with paths of written/skipped files
   */
  writeGuards(schemas: ContentTypeDefinition[], code: string): WriteResult {
    return this.write('guards', schemas, code);
  }

  /**
   * Write all generated code at once.
   *
   * @param files - Object containing types and guards code
   * @returns Combined write result
   */
  writeAll(files: {
    types?: { schemas: ContentTypeDefinition[]; code: string };
    guards?: { schemas: ContentTypeDefinition[]; code: string };
  }): WriteResult {
    const result: WriteResult = { written: [], skipped: [], deleted: [] };

    if (files.types) {
      const typesResult = this.writeTypes(
        files.types.schemas,
        files.types.code
      );
      result.written.push(...typesResult.written);
      result.skipped.push(...typesResult.skipped);
    }

    if (files.guards) {
      const guardsResult = this.writeGuards(
        files.guards.schemas,
        files.guards.code
      );
      result.written.push(...guardsResult.written);
      result.skipped.push(...guardsResult.skipped);
    }

    // Generate root barrel file in multi-file mode
    if (this.options.mode === 'multi' && this.options.generateBarrel) {
      const barrelResult = this.writeRootBarrel(files);
      result.written.push(...barrelResult.written);
      result.skipped.push(...barrelResult.skipped);
    }

    return result;
  }

  /**
   * Clean generated files.
   *
   * @param categories - Categories to clean ('types', 'guards')
   * @returns Write result with deleted files
   */
  clean(
    categories: Array<'types' | 'guards'> = ['types', 'guards']
  ): WriteResult {
    const result: WriteResult = { written: [], skipped: [], deleted: [] };
    const { output, mode } = this.options;

    if (mode === 'single') {
      // Delete single output file
      if (existsSync(output)) {
        rmSync(output, { force: true });
        result.deleted.push(output);
      }
    } else {
      // Delete category directories
      for (const category of categories) {
        const categoryDir = join(output, category);
        if (existsSync(categoryDir)) {
          rmSync(categoryDir, { recursive: true, force: true });
          result.deleted.push(categoryDir);
        }
      }

      // Delete root barrel
      const barrelPath = join(output, 'index.ts');
      if (existsSync(barrelPath)) {
        rmSync(barrelPath, { force: true });
        result.deleted.push(barrelPath);
      }
    }

    return result;
  }

  /**
   * Preview what would be written without actually writing.
   *
   * @param category - The category of code
   * @param schemas - The schemas
   * @param code - The generated code
   * @returns Array of files that would be written
   */
  preview(
    category: 'types' | 'guards',
    schemas: ContentTypeDefinition[],
    code: string
  ): GeneratedFile[] {
    const { mode } = this.options;

    if (mode === 'single') {
      return [
        {
          path: this.options.output,
          content: this.addHeader(code),
        },
      ];
    }

    return this.splitIntoFiles(category, schemas, code);
  }

  /**
   * Internal write method.
   */
  private write(
    category: 'types' | 'guards',
    schemas: ContentTypeDefinition[],
    code: string
  ): WriteResult {
    const { mode, output } = this.options;
    const result: WriteResult = { written: [], skipped: [], deleted: [] };

    if (mode === 'single') {
      // Single file mode - write everything to one file
      const content = this.addHeader(code);
      const writeResult = this.writeFileIfChanged(output, content);
      if (writeResult.written) {
        result.written.push(output);
      } else {
        result.skipped.push(output);
      }
    } else {
      // Multi-file mode - split into separate files
      const files = this.splitIntoFiles(category, schemas, code);
      const categoryDir = join(output, category);

      // Ensure directory exists
      this.ensureDir(categoryDir);

      // Write each file
      for (const file of files) {
        const filePath = join(output, file.path);
        this.ensureDir(dirname(filePath));
        const writeResult = this.writeFileIfChanged(filePath, file.content);
        if (writeResult.written) {
          result.written.push(filePath);
        } else {
          result.skipped.push(filePath);
        }
      }

      // Generate barrel file for category
      if (this.options.generateBarrel && schemas.length > 0) {
        const barrelContent = this.generateCategoryBarrel(category, schemas);
        const barrelPath = join(categoryDir, 'index.ts');
        const writeResult = this.writeFileIfChanged(barrelPath, barrelContent);
        if (writeResult.written) {
          result.written.push(barrelPath);
        } else {
          result.skipped.push(barrelPath);
        }
      }
    }

    return result;
  }

  /**
   * Split generated code into separate files per type.
   */
  private splitIntoFiles(
    category: 'types' | 'guards',
    schemas: ContentTypeDefinition[],
    code: string
  ): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    // For now, we use the combined code approach
    // A more sophisticated implementation could parse and split the code
    // But that would require a TypeScript parser

    // Simple approach: one file per schema, extract by matching patterns
    for (const schema of schemas) {
      const typeName = schema.name;
      const fileName = this.toKebabCase(typeName);
      const fileContent = this.extractTypeCode(category, typeName, code);

      if (fileContent) {
        files.push({
          path: `${category}/${fileName}.ts`,
          content: this.addHeader(fileContent, typeName),
          typeName,
        });
      }
    }

    // If we couldn't split, fall back to single file in category
    if (files.length === 0 && code.trim()) {
      files.push({
        path: `${category}/index.ts`,
        content: this.addHeader(code),
      });
    }

    return files;
  }

  /**
   * Extract code for a specific type from combined code.
   */
  private extractTypeCode(
    category: 'types' | 'guards',
    typeName: string,
    code: string
  ): string {
    const lines = code.split('\n');
    const extractedLines: string[] = [];
    let inBlock = false;
    let braceCount = 0;

    // Patterns to match start of type-specific code
    const startPatterns: Record<string, RegExp[]> = {
      types: [
        new RegExp(`^export (interface|type) ${typeName}\\b`),
        new RegExp(`^/\\*\\*.*${typeName}.*\\*/$`),
      ],
      guards: [
        new RegExp(`^export function (is|assert)${typeName}\\b`),
        new RegExp(`^/\\*\\*.*(Type guard|Assertion guard) for ${typeName}`),
      ],
    };

    const patterns = startPatterns[category] || [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const trimmedLine = line.trim();

      // Check if this line starts a relevant block
      if (!inBlock) {
        // Check for JSDoc start
        if (trimmedLine.startsWith('/**')) {
          // Look ahead to see if the next export matches
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = (lines[j] ?? '').trim();
            if (nextLine === '' || nextLine.startsWith('*')) continue;
            if (nextLine.startsWith('*/')) continue;

            // Check if the export matches
            for (const pattern of patterns) {
              if (pattern.test(nextLine)) {
                inBlock = true;
                extractedLines.push(line);
                break;
              }
            }
            break;
          }
          continue;
        }

        // Check for direct export match
        for (const pattern of patterns) {
          if (pattern.test(trimmedLine)) {
            inBlock = true;
            break;
          }
        }
      }

      if (inBlock) {
        extractedLines.push(line);

        // Track braces to know when block ends
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }

        // End of block when braces balance
        if (braceCount === 0 && trimmedLine.endsWith('}')) {
          inBlock = false;
          extractedLines.push(''); // Add blank line between blocks
        }
      }
    }

    // Clean up trailing blank lines
    while (
      extractedLines.length > 0 &&
      extractedLines[extractedLines.length - 1]?.trim() === ''
    ) {
      extractedLines.pop();
    }

    return extractedLines.join('\n');
  }

  /**
   * Generate barrel file for a category.
   */
  private generateCategoryBarrel(
    category: 'types' | 'guards',
    schemas: ContentTypeDefinition[]
  ): string {
    const lines: string[] = [
      this.generateHeaderComment(`${category} barrel`),
      '',
    ];

    for (const schema of schemas) {
      const fileName = this.toKebabCase(schema.name);
      lines.push(`export * from './${fileName}';`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Write root barrel file that re-exports from all categories.
   */
  private writeRootBarrel(files: {
    types?: { schemas: ContentTypeDefinition[]; code: string };
    guards?: { schemas: ContentTypeDefinition[]; code: string };
  }): WriteResult {
    const result: WriteResult = { written: [], skipped: [], deleted: [] };
    const { output } = this.options;
    const lines: string[] = [this.generateHeaderComment('root barrel'), ''];

    if (files.types && files.types.schemas.length > 0) {
      lines.push("export * from './types/index';");
    }
    if (files.guards && files.guards.schemas.length > 0) {
      lines.push("export * from './guards/index';");
    }

    if (lines.length > 2) {
      const barrelPath = join(output, 'index.ts');
      this.ensureDir(output);
      const writeResult = this.writeFileIfChanged(
        barrelPath,
        lines.join('\n') + '\n'
      );
      if (writeResult.written) {
        result.written.push(barrelPath);
      } else {
        result.skipped.push(barrelPath);
      }
    }

    return result;
  }

  /**
   * Add header comment to file content.
   */
  private addHeader(content: string, typeName?: string): string {
    // Check if content already has a header
    if (content.trim().startsWith('/**')) {
      return content;
    }

    const header = this.generateHeaderComment(typeName);
    return `${header}\n\n${content}`;
  }

  /**
   * Generate header comment.
   */
  private generateHeaderComment(context?: string): string {
    const { includeTimestamp, customHeader } = this.options;
    const lines: string[] = [
      '/**',
      ' * Auto-generated by universal-data-layer',
    ];

    if (context) {
      lines.push(` * ${context}`);
    }

    if (includeTimestamp) {
      lines.push(` * Generated at: ${new Date().toISOString()}`);
    }

    lines.push(' * DO NOT EDIT MANUALLY');

    if (customHeader) {
      lines.push(' *');
      for (const line of customHeader.split('\n')) {
        lines.push(` * ${line}`);
      }
    }

    lines.push(' */');

    return lines.join('\n');
  }

  /**
   * Write file if content has changed.
   */
  private writeFileIfChanged(
    filePath: string,
    content: string
  ): { written: boolean } {
    const { incrementalWrite } = this.options;

    if (incrementalWrite && existsSync(filePath)) {
      const existingContent = readFileSync(filePath, 'utf-8');
      const existingHash = this.hash(existingContent);
      const newHash = this.hash(content);

      if (existingHash === newHash) {
        return { written: false };
      }
    }

    this.ensureDir(dirname(filePath));
    writeFileSync(filePath, content, 'utf-8');
    return { written: true };
  }

  /**
   * Compute content hash.
   */
  private hash(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Ensure directory exists.
   */
  private ensureDir(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Convert PascalCase to kebab-case.
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
  }
}

/**
 * Write generated code to files.
 *
 * Convenience function that creates a writer and writes all files.
 *
 * @param files - Object containing types and guards code
 * @param options - Writer options
 * @returns Write result
 */
export function writeGeneratedFiles(
  files: {
    types?: { schemas: ContentTypeDefinition[]; code: string };
    guards?: { schemas: ContentTypeDefinition[]; code: string };
  },
  options: FileWriterOptions = {}
): WriteResult {
  const writer = new FileWriter(options);
  return writer.writeAll(files);
}
