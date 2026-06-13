import { describe, it, expect, beforeEach } from 'vitest';
import {
  nextSlotId,
  resetSlotCounter,
  createFxSlot,
  FX_TYPE_NAMES,
  DEFAULT_PARAMS,
} from './fxTypes';
import type { BuiltInEffectType } from './fxTypes';

beforeEach(() => {
  resetSlotCounter();
});

describe('nextSlotId', () => {
  it('should generate unique ids', () => {
    const a = nextSlotId();
    const b = nextSlotId();
    expect(a).not.toBe(b);
  });
});

describe('createFxSlot', () => {
  const types: BuiltInEffectType[] = [
    'eq', 'compressor', 'delay', 'reverb', 'chorus',
    'distortion', 'filter', 'limiter', 'stereoWidth', 'gate',
  ];

  for (const type of types) {
    it(`should create a valid slot for ${type}`, () => {
      const slot = createFxSlot(type);
      expect(slot.id).toBeTruthy();
      expect(slot.type).toBe(type);
      expect(slot.enabled).toBe(true);
      expect(slot.params).toEqual(DEFAULT_PARAMS[type]);
    });
  }
});

describe('FX_TYPE_NAMES', () => {
  it('should have names for all types', () => {
    expect(FX_TYPE_NAMES.eq).toBe('EQ');
    expect(FX_TYPE_NAMES.compressor).toBe('Compressor');
    expect(FX_TYPE_NAMES.delay).toBe('Delay');
    expect(FX_TYPE_NAMES.reverb).toBe('Reverb');
    expect(FX_TYPE_NAMES.distortion).toBe('Distortion');
    expect(FX_TYPE_NAMES.filter).toBe('Filter');
    expect(FX_TYPE_NAMES.limiter).toBe('Limiter');
    expect(FX_TYPE_NAMES.gate).toBe('Gate');
  });
});
