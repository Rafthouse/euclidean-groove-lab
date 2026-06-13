import { describe, it, expect } from 'vitest';
import {
  faderDbToGain,
  gainToFaderDb,
  panToGains,
  defaultMixerConfig,
  DEFAULT_FADER_DB,
  FADER_MAX_DB,
  FADER_MIN_DB,
} from './mixerState';

describe('faderDbToGain', () => {
  it('0 dB should give unity gain (1.0)', () => {
    expect(faderDbToGain(0)).toBeCloseTo(1.0, 5);
  });

  it('+12 dB should give gain ~3.98', () => {
    const g = faderDbToGain(12);
    expect(g).toBeGreaterThan(3.9);
    expect(g).toBeLessThan(4.0);
  });

  it('-60 dB should give gain near 0', () => {
    expect(faderDbToGain(-60)).toBeCloseTo(0.001, 4);
  });

  it('should clamp above +12 dB', () => {
    expect(faderDbToGain(20)).toBeCloseTo(faderDbToGain(12), 5);
  });

  it('should clamp below -60 dB', () => {
    expect(faderDbToGain(-100)).toBeCloseTo(0.001, 4);
  });
});

describe('gainToFaderDb', () => {
  it('unity gain back to 0 dB', () => {
    expect(gainToFaderDb(1.0)).toBeCloseTo(0, 5);
  });

  it('gain of 2 should give ~6 dB', () => {
    expect(gainToFaderDb(2)).toBeGreaterThan(5.9);
    expect(gainToFaderDb(2)).toBeLessThan(6.1);
  });
});

describe('panToGains', () => {
  it('center pan (0) should give equal L/R', () => {
    const { left, right } = panToGains(0);
    expect(left).toBeCloseTo(right, 4);
    expect(left).toBeGreaterThan(0.7); // center = ~0.707 each
  });

  it('full left (-100) should give left=1, right=0', () => {
    const { left, right } = panToGains(-100);
    expect(left).toBeCloseTo(1, 3);
    expect(right).toBeCloseTo(0, 3);
  });

  it('full right (+100) should give left=0, right=1', () => {
    const { left, right } = panToGains(100);
    expect(left).toBeCloseTo(0, 3);
    expect(right).toBeCloseTo(1, 3);
  });

  it('should be equal-power (L² + R² ≈ 1)', () => {
    const { left, right } = panToGains(30);
    const sumSquares = left * left + right * right;
    expect(sumSquares).toBeCloseTo(1, 4);
  });
});

describe('defaultMixerConfig', () => {
  it('should create channels for kick, snare, hat, bass, master', () => {
    const config = defaultMixerConfig(false);
    expect(config.map((c) => c.id)).toEqual([
      'kick', 'snare', 'hat', 'bass', 'master',
    ]);
  });

  it('should include ghost when requested', () => {
    const config = defaultMixerConfig(true);
    expect(config.map((c) => c.id)).toEqual([
      'kick', 'snare', 'ghost', 'hat', 'bass', 'master',
    ]);
  });

  it('all channels should have faderDb = 0 dB by default', () => {
    const config = defaultMixerConfig(false);
    for (const ch of config) {
      expect(ch.faderDb).toBe(DEFAULT_FADER_DB);
    }
  });

  it('all channels should have pan = 0 (center)', () => {
    const config = defaultMixerConfig(false);
    for (const ch of config) {
      expect(ch.pan).toBe(0);
    }
  });

  it('rec should default to false', () => {
    const config = defaultMixerConfig(false);
    for (const ch of config) {
      expect(ch.rec).toBe(false);
    }
  });
});
