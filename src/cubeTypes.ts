export type CubeKind = 'water' | 'forest' | 'meadow' | 'rock' | 'village' | 'desert' | 'snow';

export interface CubeTypeConfig {
  kind: CubeKind;
  emoji: string;
  label: string;
  levels: {
    name: string;
    color: string;
  }[];
  rareVariant: {
    name: string;
    color: string;
  };
}

export const CUBE_TYPES: CubeTypeConfig[] = [
  {
    kind: 'water',
    emoji: '💧',
    label: 'Vesi',
    levels: [
      { name: 'Lammikko', color: '#60a5fa' },
      { name: 'Järvi', color: '#3b82f6' },
      { name: 'Meri', color: '#2563eb' },
      { name: 'Valtameri', color: '#1e40af' },
    ],
    rareVariant: { name: 'Luminen arktinen meri', color: '#bfdbfe' },
  },
  {
    kind: 'forest',
    emoji: '🌲',
    label: 'Metsä',
    levels: [
      { name: 'Taimi', color: '#86efac' },
      { name: 'Pensaikko', color: '#4ade80' },
      { name: 'Metsä', color: '#16a34a' },
      { name: 'Ikimetsä', color: '#14532d' },
    ],
    rareVariant: { name: 'Lumimetsä', color: '#e0f2fe' },
  },
  {
    kind: 'meadow',
    emoji: '🌿',
    label: 'Niitty',
    levels: [
      { name: 'Ruohikko', color: '#bef264' },
      { name: 'Niitty', color: '#a3e635' },
      { name: 'Aromaasto', color: '#84cc16' },
      { name: 'Preeria', color: '#65a30d' },
    ],
    rareVariant: { name: 'Kukkaniitty', color: '#f9a8d4' },
  },
  {
    kind: 'rock',
    emoji: '🪨',
    label: 'Kallio',
    levels: [
      { name: 'Kivi', color: '#a8a29e' },
      { name: 'Kallio', color: '#78716c' },
      { name: 'Vuori', color: '#57534e' },
      { name: 'Vuorijonot', color: '#292524' },
    ],
    rareVariant: { name: 'Tuliperäinen vuori', color: '#ef4444' },
  },
  {
    kind: 'village',
    emoji: '🏡',
    label: 'Kylä',
    levels: [
      { name: 'Talo', color: '#fcd34d' },
      { name: 'Kylä', color: '#f59e0b' },
      { name: 'Kaupunki', color: '#d97706' },
      { name: 'Metropoli', color: '#92400e' },
    ],
    rareVariant: { name: 'Lentävä kaupunki', color: '#c4b5fd' },
  },
  {
    kind: 'desert',
    emoji: '🏜️',
    label: 'Autiomaa',
    levels: [
      { name: 'Hiekka', color: '#fef08a' },
      { name: 'Autiomaa', color: '#facc15' },
      { name: 'Erämaa', color: '#eab308' },
      { name: 'Suolainen tasanko', color: '#ca8a04' },
    ],
    rareVariant: { name: 'Kristallierämaa', color: '#a5f3fc' },
  },
  {
    kind: 'snow',
    emoji: '❄️',
    label: 'Lumi',
    levels: [
      { name: 'Lumisade', color: '#e0f2fe' },
      { name: 'Lumimaa', color: '#bae6fd' },
      { name: 'Jäätikkö', color: '#7dd3fc' },
      { name: 'Arktinen maa', color: '#38bdf8' },
    ],
    rareVariant: { name: 'Ikijää', color: '#f0f9ff' },
  },
];

export const CUBE_KIND_LIST: CubeKind[] = CUBE_TYPES.map((t) => t.kind);

export function getCubeConfig(kind: CubeKind): CubeTypeConfig {
  return CUBE_TYPES.find((t) => t.kind === kind)!;
}

export interface CubeState {
  kind: CubeKind;
  level: number; // 1-4
  rare: boolean;
}

export function getCubeColor(cube: CubeState): string {
  const config = getCubeConfig(cube.kind);
  if (cube.rare) return config.rareVariant.color;
  return config.levels[cube.level - 1].color;
}

export function getCubeName(cube: CubeState): string {
  const config = getCubeConfig(cube.kind);
  if (cube.rare) return config.rareVariant.name;
  return config.levels[cube.level - 1].name;
}
