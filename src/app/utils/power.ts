export interface PowerDistribution {
  id: 'sedentary' | 'commuter' | 'recreational' | 'amateur' | 'pro';
  label: string;
  range: string;
  min: number;
  max?: number;
}

export const POWER_DISTRIBUTIONS: PowerDistribution[] = [
  { id: 'sedentary', label: '"no sports" adult', range: '70–90 W', min: 70, max: 90 },
  { id: 'commuter', label: 'Untrained commuter', range: '80–130 W', min: 80, max: 130 },
  { id: 'recreational', label: 'Recreational cyclist', range: '150–200 W', min: 150, max: 200 },
  { id: 'amateur', label: 'Trained amateur', range: '220–280 W', min: 220, max: 280 },
  { id: 'pro', label: 'Pro', range: '300+ W', min: 300 }
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
