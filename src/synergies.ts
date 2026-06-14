import { CubeKind, CubeState } from './cubeTypes';
import { Cell } from './planet';

// ── Synergy definitions ─────────────────────────────────────────────────────

export interface SynergyDef {
    kinds: [CubeKind, CubeKind];
    name: string;
    emoji: string;
    description: string;
    color: string;
    bonusPerPair: number;
}

export const SYNERGIES: SynergyDef[] = [
    { kinds: ['forest', 'water'],   name: 'Sademetsä',        emoji: '🌴', description: 'Metsä + Vesi',     color: '#22d3ee', bonusPerPair: 15 },
    { kinds: ['village', 'meadow'], name: 'Viljelysmaa',      emoji: '🌾', description: 'Kylä + Niitty',    color: '#fbbf24', bonusPerPair: 15 },
    { kinds: ['rock', 'snow'],      name: 'Vuoristohuippu',   emoji: '🏔️', description: 'Kallio + Lumi',    color: '#c4b5fd', bonusPerPair: 15 },
    { kinds: ['meadow', 'water'],   name: 'Kosteikko',        emoji: '🐸', description: 'Niitty + Vesi',    color: '#34d399', bonusPerPair: 10 },
    { kinds: ['village', 'water'],  name: 'Satamakaupunki',   emoji: '⚓', description: 'Kylä + Vesi',      color: '#60a5fa', bonusPerPair: 12 },
    { kinds: ['forest', 'rock'],    name: 'Vuoristometsä',    emoji: '🏕️', description: 'Metsä + Kallio',   color: '#6ee7b7', bonusPerPair: 10 },
    { kinds: ['village', 'forest'], name: 'Puutarhakaupunki', emoji: '🏡', description: 'Kylä + Metsä',     color: '#a3e635', bonusPerPair: 12 },
    { kinds: ['desert', 'rock'],    name: 'Kanjoni',          emoji: '🏜️', description: 'Autiomaa + Kallio', color: '#fb923c', bonusPerPair: 10 },
];

export function findSynergy(a: CubeKind, b: CubeKind): SynergyDef | undefined {
    return SYNERGIES.find(s =>
        (s.kinds[0] === a && s.kinds[1] === b) ||
        (s.kinds[0] === b && s.kinds[1] === a),
    );
}

// ── Active synergy pair computation ─────────────────────────────────────────

export interface ActiveSynergyPair {
    synergy: SynergyDef;
    cellIdA: number;
    cellIdB: number;
    key: string;
}

export function computeActiveSynergies(
    grid: Record<number, CubeState | null>,
    cells: Cell[],
): ActiveSynergyPair[] {
    const seen = new Set<string>();
    const result: ActiveSynergyPair[] = [];

    for (const cell of cells) {
        const cube = grid[cell.id];
        if (!cube) continue;

        for (const nid of cell.neighborIds) {
            const ncube = grid[nid];
            if (!ncube) continue;

            const synergy = findSynergy(cube.kind, ncube.kind);
            if (!synergy) continue;

            const key = `${Math.min(cell.id, nid)}-${Math.max(cell.id, nid)}`;
            if (seen.has(key)) continue;
            seen.add(key);

            result.push({ synergy, cellIdA: cell.id, cellIdB: nid, key });
        }
    }

    return result;
}

// ── Notification type ───────────────────────────────────────────────────────

export interface SynergyNotification {
    id: number;
    synergy: SynergyDef;
    bonus: number;
}
