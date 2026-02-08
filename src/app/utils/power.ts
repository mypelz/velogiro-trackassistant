export interface PowerDistribution {
  id: 'sedentary' | 'commuter' | 'recreational' | 'amateur' | 'pro';
  label: string;
  range: string;
  min: number;
  max?: number;
}

export const POWER_DISTRIBUTIONS: PowerDistribution[] = [
  { id: 'sedentary', label: '"no sports" adult', range: '50–80 W', min: 50, max: 79 },
  { id: 'commuter', label: 'Untrained commuter', range: '80–120 W', min: 80, max: 119 },
  { id: 'recreational', label: 'Recreational cyclist', range: '120–180 W', min: 120, max: 179 },
  { id: 'amateur', label: 'Trained amateur', range: '180–280 W', min: 180, max: 279 },
  { id: 'pro', label: 'Pro', range: '280+ W', min: 279 }
];

export function getDistributionIdForWatts(watts: number): PowerDistribution['id'] | 'custom' {
  for (const profile of POWER_DISTRIBUTIONS) {
    if (watts >= profile.min && (profile.max == null || watts <= profile.max)) {
      return profile.id;
    }
  }

  return 'custom';
}

export function mapRiderType(avgWatts: number): string {
  const id = getDistributionIdForWatts(avgWatts);
  if (id === 'custom') {
    return 'Custom rider';
  }

  const profile = POWER_DISTRIBUTIONS.find((distribution) => distribution.id === id);
  return profile?.label ?? 'Custom rider';
}
