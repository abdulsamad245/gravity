import { describe, expect, it } from 'vitest';
import {
  canvasObjectSchema,
  exportedDocumentSchema,
} from '../../src/shared/validation/canvas-object.schema';

const valid = {
  id: 'abc',
  type: 'sticky',
  x: 10,
  y: 20,
  width: 100,
  height: 100,
  rotation: 0,
  fill: '#ffd43b',
  text: 'hello',
  z: 1,
};

describe('canvasObjectSchema (import boundary)', () => {
  it('accepts a valid object', () => {
    expect(canvasObjectSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects unknown types and non-positive dimensions', () => {
    expect(canvasObjectSchema.safeParse({ ...valid, type: 'blob' }).success).toBe(false);
    expect(canvasObjectSchema.safeParse({ ...valid, width: 0 }).success).toBe(false);
  });

  it('accepts code blocks with a supported language', () => {
    expect(
      canvasObjectSchema.safeParse({
        ...valid,
        type: 'code',
        language: 'typescript',
        text: 'const answer: number = 42;',
      }).success,
    ).toBe(true);
    expect(canvasObjectSchema.safeParse({ ...valid, type: 'code', language: 'brainfuck' }).success).toBe(false);
  });
});

describe('exportedDocumentSchema (round-trip)', () => {
  it('validates the JSON export envelope', () => {
    const doc = {
      app: 'Gravity',
      version: 1,
      exportedAt: new Date().toISOString(),
      objects: [valid],
    };
    expect(exportedDocumentSchema.safeParse(doc).success).toBe(true);
    expect(exportedDocumentSchema.safeParse({ ...doc, objects: [{ bad: true }] }).success).toBe(false);
  });
});
