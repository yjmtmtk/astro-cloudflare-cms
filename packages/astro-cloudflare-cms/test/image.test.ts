import { describe, it, expect } from 'vitest';
import { computeFitDimensions } from '@/lib/image';

describe('computeFitDimensions', () => {
  it('scales landscape down to maxEdge on the long side', () => {
    expect(computeFitDimensions(2560, 1440, 1280)).toEqual({ width: 1280, height: 720 });
  });
  it('scales portrait down to maxEdge on the long side', () => {
    expect(computeFitDimensions(1000, 2000, 1280)).toEqual({ width: 640, height: 1280 });
  });
  it('never upscales', () => {
    expect(computeFitDimensions(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });
  it('handles square', () => {
    expect(computeFitDimensions(3000, 3000, 1280)).toEqual({ width: 1280, height: 1280 });
  });
});
