import { describe, it, expect, beforeEach } from 'vitest';
import { createPrefixedStream } from '@/utils/prefix-output.js';
import { Writable } from 'node:stream';

describe('createPrefixedStream', () => {
  let output: string[];
  let mockOutputStream: Writable;

  beforeEach(() => {
    output = [];
    mockOutputStream = new Writable({
      write(chunk, _encoding, callback) {
        output.push(chunk.toString());
        callback();
      },
    });
  });

  it('should prefix a single complete line', async () => {
    const stream = createPrefixedStream('[test]', mockOutputStream);

    stream.write(Buffer.from('Hello World\n'));
    stream.end();

    await new Promise((resolve) => stream.on('finish', resolve));

    expect(output).toEqual(['[test] Hello World\n']);
  });

  it('should prefix multiple complete lines', async () => {
    const stream = createPrefixedStream('[test]', mockOutputStream);

    stream.write(Buffer.from('Line 1\nLine 2\nLine 3\n'));
    stream.end();

    await new Promise((resolve) => stream.on('finish', resolve));

    expect(output).toEqual([
      '[test] Line 1\n',
      '[test] Line 2\n',
      '[test] Line 3\n',
    ]);
  });

  it('should buffer partial lines until newline', async () => {
    const stream = createPrefixedStream('[test]', mockOutputStream);

    stream.write(Buffer.from('Hello'));
    stream.write(Buffer.from(' World\n'));
    stream.end();

    await new Promise((resolve) => stream.on('finish', resolve));

    expect(output).toEqual(['[test] Hello World\n']);
  });

  it('should flush remaining buffer on end', async () => {
    const stream = createPrefixedStream('[test]', mockOutputStream);

    stream.write(Buffer.from('No newline'));
    stream.end();

    await new Promise((resolve) => stream.on('finish', resolve));

    expect(output).toEqual(['[test] No newline\n']);
  });

  it('should handle mixed complete and partial lines', async () => {
    const stream = createPrefixedStream('[test]', mockOutputStream);

    stream.write(Buffer.from('Complete\nPart'));
    stream.write(Buffer.from('ial\n'));
    stream.end();

    await new Promise((resolve) => stream.on('finish', resolve));

    expect(output).toEqual(['[test] Complete\n', '[test] Partial\n']);
  });

  it('should preserve ANSI color codes', async () => {
    const stream = createPrefixedStream('[test]', mockOutputStream);

    // ANSI escape code for red text
    const redText = '\x1b[31mRed Text\x1b[0m\n';
    stream.write(Buffer.from(redText));
    stream.end();

    await new Promise((resolve) => stream.on('finish', resolve));

    expect(output).toEqual(['[test] \x1b[31mRed Text\x1b[0m\n']);
  });

  it('should handle empty lines', async () => {
    const stream = createPrefixedStream('[test]', mockOutputStream);

    stream.write(Buffer.from('Line 1\n\nLine 3\n'));
    stream.end();

    await new Promise((resolve) => stream.on('finish', resolve));

    expect(output).toEqual(['[test] Line 1\n', '[test] \n', '[test] Line 3\n']);
  });

  it('should handle empty buffer on flush', async () => {
    const stream = createPrefixedStream('[test]', mockOutputStream);

    stream.write(Buffer.from('Complete line\n'));
    stream.end();

    await new Promise((resolve) => stream.on('finish', resolve));

    // Should only have the complete line, no extra empty line
    expect(output).toEqual(['[test] Complete line\n']);
  });

  it('should use different prefixes independently', async () => {
    const output1: string[] = [];
    const output2: string[] = [];

    const mockStream1 = new Writable({
      write(chunk, _encoding, callback) {
        output1.push(chunk.toString());
        callback();
      },
    });

    const mockStream2 = new Writable({
      write(chunk, _encoding, callback) {
        output2.push(chunk.toString());
        callback();
      },
    });

    const stream1 = createPrefixedStream('[udl]', mockStream1);
    const stream2 = createPrefixedStream('[next]', mockStream2);

    stream1.write(Buffer.from('UDL message\n'));
    stream2.write(Buffer.from('Next message\n'));
    stream1.end();
    stream2.end();

    await Promise.all([
      new Promise((resolve) => stream1.on('finish', resolve)),
      new Promise((resolve) => stream2.on('finish', resolve)),
    ]);

    expect(output1).toEqual(['[udl] UDL message\n']);
    expect(output2).toEqual(['[next] Next message\n']);
  });
});
