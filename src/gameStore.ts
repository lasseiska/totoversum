import { create } from 'zustand';
import * as THREE from 'three';
import { CubeKind, CubeState, CUBE_KIND_LIST, getCubeColor } from './cubeTypes';
import { Cell, buildPlanetCells } from './planet';
import { computeActiveSynergies, SynergyNotification } from './synergies';
import { useParticleStore } from './particleStore';
import { ObsidianState, generateObsidianPlacements } from './obsidianTypes';
import { audioManager } from './audioManager';

// We need the planet radius to position particles correctly in world space
const PLANET_RADIUS = 2.5;

// ── Balanced tile generator ──────────────────────────────────────────────────
// Instead of a pre-built random bag, tiles are generated on-demand with:
//  • Pity timer  – kinds unseen for PITY_WINDOW tiles get a boost
//  • Anti-streak – the same kind appearing 2× in a row is suppressed
//  • Merge help  – kinds already on the planet (but <3 copies) get a small nudge

const QUEUE_SIZE = 8;   // how many upcoming tiles to keep in the queue
const PITY_WINDOW = 8;  // tiles since last seen before pity kicks in

let _recentKinds: CubeKind[] = [];

function generateBalancedKind(
    grid?: Record<number, CubeState | null>,
): CubeKind {
    // Count kinds currently on the planet
    const onPlanet: Partial<Record<CubeKind, number>> = {};
    if (grid) {
        Object.values(grid).forEach((cube) => {
            if (cube) onPlanet[cube.kind] = (onPlanet[cube.kind] ?? 0) + 1;
        });
    }

    const weights: number[] = CUBE_KIND_LIST.map((kind) => {
        let w = 1.0;

        // Pity timer – boost rare / unseen kinds
        const lastIdx = _recentKinds.lastIndexOf(kind);
        const since = lastIdx === -1
            ? PITY_WINDOW + 1
            : _recentKinds.length - 1 - lastIdx;
        if (since >= PITY_WINDOW) w += 1.5;

        // Anti-streak – suppress if same kind appeared in last 2 tiles
        const tail = _recentKinds.slice(-2);
        if (tail.filter((k) => k === kind).length >= 2) w *= 0.25;

        // Merge help – nudge kinds with 1-2 on the planet (close to mergeable)
        const cnt = onPlanet[kind] ?? 0;
        if (cnt >= 1 && cnt <= 2) w += 0.4;
        // Suppress overly dominant kinds
        if (cnt > 8) w *= 0.5;

        return w;
    });

    // Weighted random pick
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < CUBE_KIND_LIST.length; i++) {
        r -= weights[i];
        if (r <= 0) {
            _recentKinds.push(CUBE_KIND_LIST[i]);
            if (_recentKinds.length > 30) _recentKinds = _recentKinds.slice(-20);
            return CUBE_KIND_LIST[i];
        }
    }

    const fallback = CUBE_KIND_LIST[CUBE_KIND_LIST.length - 1];
    _recentKinds.push(fallback);
    return fallback;
}

function generateTile(grid?: Record<number, CubeState | null>): CubeState {
    return { kind: generateBalancedKind(grid), level: 1, rare: false };
}

function buildInitialQueue(): CubeState[] {
    return Array.from({ length: QUEUE_SIZE }, () => generateTile());
}

export type AnimEvent = 'place' | 'merge-result';

export interface CellAnim {
    type: AnimEvent;
    startTime: number; // performance.now()
}

let _nextNotifId = 1;

export interface GameState {
    cells: Cell[];
    grid: Record<number, CubeState | null>;
    obsidian: Record<number, ObsidianState>;
    cellAnims: Record<number, CellAnim | null>;
    bag: CubeState[];
    score: number;
    synergyBonus: number;
    synergyNotifications: SynergyNotification[];
    gameOver: boolean;
    lastMergeId: number | null;
    totoStandId: number | null;
    totoFaceId: number | null;
    isDragging: boolean;
    isMuted: boolean;
    isAudioInitialized: boolean;
    bgmVolume: number;
    sfxVolume: number;

    placeCube: (cellId: number) => void;
    setIsDragging: (dragging: boolean) => void;
    resetGame: () => void;
    clearAnim: (cellId: number) => void;
    clearSynergyNotification: (id: number) => void;
    toggleMute: () => void;
    initializeAudio: () => void;
    setBgmVolume: (vol: number) => void;
    setSfxVolume: (vol: number) => void;
}

function initGrid(cells: Cell[]): Record<number, CubeState | null> {
    const g: Record<number, CubeState | null> = {};
    cells.forEach((c) => (g[c.id] = null));
    return g;
}

function initAnims(cells: Cell[]): Record<number, CellAnim | null> {
    const a: Record<number, CellAnim | null> = {};
    cells.forEach((c) => (a[c.id] = null));
    return a;
}

function findGroup(
    cellId: number,
    kind: CubeKind,
    level: number,
    grid: Record<number, CubeState | null>,
    cells: Cell[],
): Set<number> {
    const visited = new Set<number>();
    const queue = [cellId];
    while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        const cube = grid[id];
        if (!cube || cube.kind !== kind || cube.level !== level) continue;
        visited.add(id);
        cells[id].neighborIds.forEach((n) => queue.push(n));
    }
    return visited;
}

function centerCell(group: Set<number>, cells: Cell[]): number {
    const ids = Array.from(group);
    const avg = new THREE.Vector3();
    ids.forEach((id) => avg.add(cells[id].center));
    avg.normalize();
    let best = ids[0];
    let bestDist = Infinity;
    ids.forEach((id) => {
        const d = cells[id].center.distanceTo(avg);
        if (d < bestDist) {
            bestDist = d;
            best = id;
        }
    });
    return best;
}

const INITIAL_CELLS = buildPlanetCells(2);
const INITIAL_OBSIDIAN = generateObsidianPlacements(INITIAL_CELLS);

export const useGameStore = create<GameState>((set, get) => ({
    cells: INITIAL_CELLS,
    grid: initGrid(INITIAL_CELLS),
    obsidian: INITIAL_OBSIDIAN,
    cellAnims: initAnims(INITIAL_CELLS),
    bag: buildInitialQueue(),
    score: 0,
    synergyBonus: 0,
    synergyNotifications: [],
    gameOver: false,
    lastMergeId: null,
    totoStandId: null,
    totoFaceId: null,
    isDragging: false,
    isMuted: audioManager.getMuted(),
    isAudioInitialized: audioManager.isInitialized(),
    bgmVolume: audioManager.getBgmVolume(),
    sfxVolume: audioManager.getSfxVolume(),

    placeCube(cellId: number) {
        const { cells, grid, obsidian, cellAnims, bag, score, synergyBonus } = get();
        if (grid[cellId] !== null) return;
        if (obsidian[cellId]) return;  // Cannot place on obsidian
        if (bag.length === 0) return;

        // Play placing sound
        audioManager.playPlace();

        // Snapshot synergies BEFORE placement for diffing
        const prevSynergyKeys = new Set(
            computeActiveSynergies(grid, cells).map((p) => p.key),
        );

        const [current, ...rest] = bag;
        let newBag = [...rest];
        let newScore = score;
        let lastMergeId: number | null = null;

        const workGrid = { ...grid, [cellId]: current };
        const newAnims = { ...cellAnims };

        // Particle effect for placement
        const placePos = cells[cellId].center.clone().multiplyScalar(PLANET_RADIUS * 1.05);
        useParticleStore.getState().emit(placePos, getCubeColor(current), 'place');

        // Place animation for the initial cell
        newAnims[cellId] = { type: 'place', startTime: performance.now() };

        // Chain merge loop
        let changed = true;
        while (changed) {
            changed = false;
            const occupiedIds = Object.keys(workGrid)
                .map(Number)
                .filter((id) => workGrid[id] !== null);

            for (const id of occupiedIds) {
                const cube = workGrid[id];
                if (!cube) continue;
                const group = findGroup(id, cube.kind, cube.level, workGrid, cells);
                if (group.size >= 3) {
                    changed = true;
                    const bonus = group.size >= 4;
                    const newLevel = Math.min(cube.level + 1, 4);
                    const rare = bonus && newLevel === 4;

                    // Clear merged cells (no anim, they disappear immediately)
                    group.forEach((gid) => {
                        workGrid[gid] = null;
                        newAnims[gid] = null;
                    });

                    const center = centerCell(group, cells);
                    workGrid[center] = { kind: cube.kind, level: newLevel, rare };
                    
                    // Merge-result animation on the winner cell
                    newAnims[center] = { type: 'merge-result', startTime: performance.now() };
                    lastMergeId = center;
                    
                    // Trigger particle explosion for the merge
                    const mergeColor = getCubeColor(workGrid[center]!);
                    const mergePos = cells[center].center.clone().multiplyScalar(PLANET_RADIUS * 1.05);
                    useParticleStore.getState().emit(mergePos, mergeColor, 'merge');

                    // Play merge sound
                    audioManager.playMerge(newLevel);

                    newScore += group.size * cube.level * 10;

                    if (bonus) {
                        newBag = [generateTile(workGrid), ...newBag];
                    }
                    break;
                }
            }
        }

        // ── Synergy bonus ────────────────────────────────────
        const newSynergyPairs = computeActiveSynergies(workGrid, cells);
        const freshPairs = newSynergyPairs.filter(
            (p) => !prevSynergyKeys.has(p.key),
        );

        let addedSynergyBonus = 0;
        const notifications: SynergyNotification[] = [];
        for (const pair of freshPairs) {
            addedSynergyBonus += pair.synergy.bonusPerPair;
            notifications.push({
                id: _nextNotifId++,
                synergy: pair.synergy,
                bonus: pair.synergy.bonusPerPair,
            });
        }
        newScore += addedSynergyBonus;

        // Decide where Toto stands and looks.
        const totoFaceId = lastMergeId ?? cellId;
        const faceCell = cells[totoFaceId];
        const emptyNeighbours = faceCell.neighborIds.filter(
            (nid) => workGrid[nid] === null && !obsidian[nid]
        );
        let totoStandId: number | null = null;
        if (emptyNeighbours.length > 0) {
            totoStandId = emptyNeighbours.reduce((best, nid) => {
                const db = cells[best].center.distanceTo(faceCell.center);
                const dn = cells[nid].center.distanceTo(faceCell.center);
                return dn < db ? nid : best;
            }, emptyNeighbours[0]);
        }

        // ── Endless mode: replenish queue + check planet full ─
        newBag = [...newBag, generateTile(workGrid)];
        // Only non-obsidian cells count toward game-over
        const hasEmpty = Object.entries(workGrid).some(
            ([id, v]) => v === null && !obsidian[Number(id)]
        );
        const gameOver = !hasEmpty;
        if (gameOver && !get().gameOver) {
            audioManager.playGameOver();
        }

        set({
            grid: workGrid,
            cellAnims: newAnims,
            bag: newBag,
            score: newScore,
            synergyBonus: synergyBonus + addedSynergyBonus,
            synergyNotifications: [
                ...get().synergyNotifications,
                ...notifications,
            ],
            gameOver,
            lastMergeId,
            totoFaceId,
            totoStandId,
        });
    },

    clearAnim(cellId: number) {
        set((state) => ({
            cellAnims: { ...state.cellAnims, [cellId]: null },
        }));
    },

    clearSynergyNotification(id: number) {
        set((state) => ({
            synergyNotifications: state.synergyNotifications.filter(
                (n) => n.id !== id,
            ),
        }));
    },

    setIsDragging(dragging: boolean) {
        set({ isDragging: dragging });
    },

    resetGame() {
        audioManager.playReset();
        const cells = buildPlanetCells(2);
        set({
            cells,
            grid: initGrid(cells),
            obsidian: generateObsidianPlacements(cells),
            cellAnims: initAnims(cells),
            bag: (() => { _recentKinds = []; return buildInitialQueue(); })(),
            score: 0,
            synergyBonus: 0,
            synergyNotifications: [],
            gameOver: false,
            lastMergeId: null,
            totoStandId: null,
            totoFaceId: null,
        });
    },

    toggleMute() {
        const nextMute = audioManager.toggleMute();
        set({ isMuted: nextMute, isAudioInitialized: audioManager.isInitialized() });
    },

    initializeAudio() {
        if (!get().isAudioInitialized) {
            audioManager.init();
            set({ isAudioInitialized: audioManager.isInitialized() });
        }
    },

    setBgmVolume(vol: number) {
        audioManager.setBgmVolume(vol);
        set({ bgmVolume: vol });
    },

    setSfxVolume(vol: number) {
        audioManager.setSfxVolume(vol);
        set({ sfxVolume: vol });
    },
}));
