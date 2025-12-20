import { Transform, type TransformCallback } from 'node:stream';
import type { Buffer } from 'node:buffer';

/**
 * Creates a Transform stream that prepends a prefix to each line of output.
 * Handles partial lines by buffering until a newline is received.
 * Preserves ANSI color codes.
 */
export function createPrefixedStream(
  prefix: string,
  outputStream: NodeJS.WritableStream
): Transform {
  let buffer = '';

  return new Transform({
    transform(
      chunk: Buffer,
      _encoding: string,
      callback: TransformCallback
    ): void {
      const text = chunk.toString();
      buffer += text;

      // Process complete lines
      const lines = buffer.split('\n');

      // Keep the last element (incomplete line) in buffer
      // split() always returns at least one element, so pop() is safe
      buffer = lines.pop() as string;

      // Output complete lines with prefix
      for (const line of lines) {
        outputStream.write(`${prefix} ${line}\n`);
      }

      callback();
    },

    flush(callback: TransformCallback): void {
      // Output any remaining buffered content
      if (buffer.length > 0) {
        outputStream.write(`${prefix} ${buffer}\n`);
        buffer = '';
      }
      callback();
    },
  });
}
