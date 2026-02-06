export type BikeType = 'mountain' | 'gravel' | 'race' | 'trekking';

export interface BikePreset {
  label: string;
  crr: number;
  cda: number;
  efficiency: number;
}

export const bikePresets: Record<BikeType, BikePreset> = {
  mountain: {
    label: 'Mountain',
    crr: 0.009,
    cda: 0.47,
    efficiency: 0.94
  },
  gravel: {
    label: 'Gravel',
    crr: 0.006,
    cda: 0.36,
    efficiency: 0.96
  },
  race: {
    label: 'Race',
    crr: 0.004,
    cda: 0.3,
    efficiency: 0.97
  },
  trekking: {
    label: 'Trekking / Commuter',
    crr: 0.007,
    cda: 0.4,
    efficiency: 0.95
  }
};

export function getBikePreset(type: BikeType): BikePreset {
  return bikePresets[type] ?? bikePresets.gravel;
}
