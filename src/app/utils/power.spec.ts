import { describe, it, expect } from 'vitest';
import {
  POWER_DISTRIBUTIONS,
  getDistributionIdForWatts,
  mapRiderType
} from './power';

describe('power profile utilities', () => {
  it('maps watt values to the correct distribution id', () => {
    expect(getDistributionIdForWatts(85)).toBe('sedentary');
    expect(getDistributionIdForWatts(110)).toBe('commuter');
    expect(getDistributionIdForWatts(160)).toBe('recreational');
    expect(getDistributionIdForWatts(260)).toBe('amateur');
    expect(getDistributionIdForWatts(320)).toBe('pro');
  });

  it('returns custom when watts fall outside defined ranges', () => {
    expect(getDistributionIdForWatts(20)).toBe('custom');
  });

  it('maps watts to rider labels', () => {
    expect(mapRiderType(85)).toBe(
      POWER_DISTRIBUTIONS.find((p) => p.id === 'sedentary')?.label
    );
    expect(mapRiderType(170)).toBe(
      POWER_DISTRIBUTIONS.find((p) => p.id === 'recreational')?.label
    );
    expect(mapRiderType(50)).toBe('Custom rider');
  });
});
