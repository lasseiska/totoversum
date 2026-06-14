import { useMemo, Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CubeState, CubeKind } from '../cubeTypes';
import { ObsidianVariant } from '../obsidianTypes';

interface TileDecorationProps {
    cube: CubeState;
    blockPos: THREE.Vector3;
    blockQuat: THREE.Quaternion;
    scale: number;
    planetRadius: number;
    cellRadius: number;   // inscribed radius on unit sphere
    alignRotY: number;    // rotation around sphere normal to align with hex cell
}

const BASE_URL = import.meta.env.BASE_URL;

const BASE = `${BASE_URL}assets/kenney/`;
const SNOW_BASE = `${BASE_URL}assets/snowtiles/`;
const SAND_BASE = `${BASE_URL}assets/sandtiles/`;
const TOWN_BASE = `${BASE_URL}assets/towntiles/`;
const FOREST_BASE = `${BASE_URL}assets/foresttiles/`;
const ROCK_BASE = `${BASE_URL}assets/rocktiles/`;
const WATER_BASE = `${BASE_URL}assets/watertiles/`;
const MEADOW_BASE = `${BASE_URL}assets/meadowtiles/`;
const OBSIDIAN_BASE = `${BASE_URL}assets/obsidiantiles/`;

// ── Asset mapping: kind × level → GLB filename ──────────────────────────────
function getModelPath(kind: CubeKind, level: number, rare: boolean): string {
    switch (kind) {
        case 'village': {
            if (rare) return `${TOWN_BASE}towntile_lv5.glb`;
            const v = ['towntile_lv1', 'towntile_lv2', 'towntile_lv3', 'towntile_lv4'];
            return `${TOWN_BASE}${v[level - 1]}.glb`;
        }
        case 'forest': {
            if (rare) return `${FOREST_BASE}foresttile_lv5.glb`;
            const f = ['foresttile_lv1', 'foresttile_lv2', 'foresttile_lv3', 'foresttile_lv4'];
            return `${FOREST_BASE}${f[level - 1]}.glb`;
        }
        case 'rock': {
            if (rare) return `${ROCK_BASE}rocktile_lv5.glb`;
            const r = ['rocktile_lv1', 'rocktile_lv2', 'rocktile_lv3', 'rocktile_lv4'];
            return `${ROCK_BASE}${r[level - 1]}.glb`;
        }
        case 'water': {
            if (rare) return `${WATER_BASE}watertile_lv5.glb`;
            const w = ['watertile_lv1', 'watertile_lv2', 'watertile_lv3', 'watertile_lv4'];
            return `${WATER_BASE}${w[level - 1]}.glb`;
        }
        case 'meadow': {
            if (rare) return `${MEADOW_BASE}meadowtile_lv5.glb`;
            const m = ['meadowtile_lv1', 'meadowtile_lv3', 'meadowtile_lv2', 'meadowtile_lv4'];
            return `${MEADOW_BASE}${m[level - 1]}.glb`;
        }
        case 'desert': {
            if (rare) return `${SAND_BASE}sandtile_lv5.glb`;
            const d = ['sandtile_lv1', 'sandtile_lv2', 'sandtile_lv3', 'sandtile_lv4'];
            return `${SAND_BASE}${d[level - 1]}.glb`;
        }
        case 'snow': {
            if (rare) return `${SNOW_BASE}snowtile_lv5.glb`;
            const s = ['snowtile_lv1', 'snowtile_lv2', 'snowtile_lv3', 'snowtile_lv4'];
            return `${SNOW_BASE}${s[level - 1]}.glb`;
        }
    }
}

// Level height boost — higher levels grow taller (Y only), NOT wider
const LEVEL_HEIGHT_BOOST: Record<number, number> = { 1: 1.0, 2: 1.05, 3: 1.10, 4: 1.18 };

// Per-kind rotation offset (radians) to compensate for different hex orientations
// in each GLB model.  Town and desert happen to align with the cell polygon
// at 0 offset; the rest need a 30° (π/6) nudge.
const KIND_ROT_OFFSET: Record<CubeKind, number> = {
    village: 0,
    desert:  0,
    forest:  Math.PI / 6,
    rock:    Math.PI / 6,
    snow:    Math.PI / 6,
    water:   Math.PI / 6,
    meadow:  Math.PI / 6,
};

function getRotOffset(kind: CubeKind, level: number): number {
    // Rock LV2 is flat-top, does not need the 30-degree nudge
    if (kind === 'rock' && level === 2) return 0;
    return KIND_ROT_OFFSET[kind] ?? 0;
}

// Sinking ratios. Default is 0.35. Short models sink less so they don't go underground.
const SINK_RATIOS: Record<string, number> = {
    'desert_2': 0.10, // Hiekka lv2 is short
    'forest_1': 0.15, // Taimi lv1 is short
    'meadow_2': 0.15, // Ruohikko lv2 is short
};

function getSinkRatio(kind: CubeKind, level: number): number {
    return SINK_RATIOS[`${kind}_${level}`] ?? 0.35;
}

// Obsidian tiles rotation offset
const OBSIDIAN_ROT_OFFSET = Math.PI / 6;

// Preload all unique models as soon as this module is imported
const PRELOAD_MODELS = [
    'grass', 'grass-hill',
].map(n => `${BASE}${n}.glb`);

const PRELOAD_MEADOW_MODELS = [
    'meadowtile_lv1', 'meadowtile_lv2', 'meadowtile_lv3', 'meadowtile_lv4', 'meadowtile_lv5',
].map(n => `${MEADOW_BASE}${n}.glb`);

const PRELOAD_SAND_MODELS = [
    'sandtile_lv1', 'sandtile_lv2', 'sandtile_lv3', 'sandtile_lv4', 'sandtile_lv5',
].map(n => `${SAND_BASE}${n}.glb`);

const PRELOAD_SNOW_MODELS = [
    'snowtile_lv1', 'snowtile_lv2', 'snowtile_lv3', 'snowtile_lv4', 'snowtile_lv5',
].map(n => `${SNOW_BASE}${n}.glb`);

const PRELOAD_TOWN_MODELS = [
    'towntile_lv1', 'towntile_lv2', 'towntile_lv3', 'towntile_lv4', 'towntile_lv5',
].map(n => `${TOWN_BASE}${n}.glb`);

const PRELOAD_FOREST_MODELS = [
    'foresttile_lv1', 'foresttile_lv2', 'foresttile_lv3', 'foresttile_lv4', 'foresttile_lv5',
].map(n => `${FOREST_BASE}${n}.glb`);

const PRELOAD_ROCK_MODELS = [
    'rocktile_lv1', 'rocktile_lv2', 'rocktile_lv3', 'rocktile_lv4', 'rocktile_lv5',
].map(n => `${ROCK_BASE}${n}.glb`);

const PRELOAD_WATER_MODELS = [
    'watertile_lv1', 'watertile_lv2', 'watertile_lv3', 'watertile_lv4', 'watertile_lv5',
].map(n => `${WATER_BASE}${n}.glb`);

const PRELOAD_OBSIDIAN_MODELS = [
    'obsidiantile_a', 'obsidiantile_b', 'obsidiantile_c', 'obsidiantile_d',
].map(n => `${OBSIDIAN_BASE}${n}.glb`);

[...PRELOAD_MODELS, ...PRELOAD_MEADOW_MODELS, ...PRELOAD_SAND_MODELS, ...PRELOAD_SNOW_MODELS, ...PRELOAD_TOWN_MODELS, ...PRELOAD_FOREST_MODELS, ...PRELOAD_ROCK_MODELS, ...PRELOAD_WATER_MODELS, ...PRELOAD_OBSIDIAN_MODELS].forEach(path => useGLTF.preload(path));

function adjustWaterMaterial(material: THREE.Material, path: string) {
    if (path.includes('watertile') && material instanceof THREE.MeshStandardMaterial) {
        material.metalness = 0.15;
        material.roughness = 0.2;
        material.color.setRGB(1, 1, 1);
    }
}

// ── Inner component — must be inside a Suspense boundary ─────────────────────
// Auto-normalises any GLB to fit inside a cell by measuring its bounding box.
function KenneyModel({ path, cellRadius, planetRadius, rotY, heightBoost = 1, sinkRatio = 0.35 }: {
    path: string;
    cellRadius: number;     // inscribed radius on unit sphere
    planetRadius: number;
    rotY: number;
    heightBoost?: number;   // Y-axis multiplier for higher levels
    sinkRatio?: number;     // how much of the model height to sink into the planet
}) {
    const { scene } = useGLTF(path);

    // Clone scene so each tile has its own independent object
    const cloned = useMemo(() => {
        const c = scene.clone(true);
        c.traverse(node => {
            if ((node as THREE.Mesh).isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                const mesh = node as THREE.Mesh;
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(mat => adjustWaterMaterial(mat, path));
                } else if (mesh.material) {
                    adjustWaterMaterial(mesh.material, path);
                }
            }
        });
        return c;
    }, [scene, path]);

    // Measure bounding box and compute normalised scale
    const { normalScale, minOffset, scaledHeight } = useMemo(() => {
        const box = new THREE.Box3().setFromObject(cloned);
        const size = box.getSize(new THREE.Vector3());

        // Target diameter = 108% of cell inscribed diameter (tiles fill & slightly overlap)
        const targetDiameter = cellRadius * planetRadius * 2 * 1.08;
        const modelXZDiameter = Math.max(size.x, size.z) || 1;
        const s = targetDiameter / modelXZDiameter;

        // Offset to bring bottom of the model to Y=0 in local coords
        const minOff = -box.min.y;
        
        // Height of the model after applying normalScale
        const hScaled = size.y * s;

        return { normalScale: s, minOffset: minOff, scaledHeight: hScaled };
    }, [cloned, cellRadius, planetRadius]);

    // The total Y translation sinks the model by a ratio of its final boosted height
    const finalYOffset = - (scaledHeight * heightBoost) * sinkRatio;

    return (
        <group rotation-y={rotY}>
            <group
                position={[0, finalYOffset, 0]}
                scale={[normalScale, normalScale * heightBoost, normalScale]}
            >
                {/* Translate primitive so its bottom is at Y=0 */}
                <primitive object={cloned} position={[0, minOffset, 0]} />
            </group>
        </group>
    );
}

// ── Exported tile decoration ──────────────────────────────────────────────────
export function TileDecoration({ cube, blockPos, blockQuat, scale, planetRadius, cellRadius, alignRotY }: TileDecorationProps) {
    const path = getModelPath(cube.kind as CubeKind, cube.level, cube.rare);
    const heightBoost = LEVEL_HEIGHT_BOOST[cube.level] ?? 1;
    const rotOffset = getRotOffset(cube.kind as CubeKind, cube.level);
    const sinkRatio = getSinkRatio(cube.kind as CubeKind, cube.level);

    return (
        <group position={blockPos} quaternion={blockQuat} scale={scale}>
            <Suspense fallback={null}>
                <KenneyModel
                    path={path}
                    cellRadius={cellRadius}
                    planetRadius={planetRadius}
                    rotY={alignRotY + rotOffset}
                    heightBoost={heightBoost}
                    sinkRatio={sinkRatio}
                />
            </Suspense>
        </group>
    );
}

// ── Obsidian tile decoration ──────────────────────────────────────────────────
interface ObsidianDecorationProps {
    variant: ObsidianVariant;
    blockPos: THREE.Vector3;
    blockQuat: THREE.Quaternion;
    scale: number;
    planetRadius: number;
    cellRadius: number;
    alignRotY: number;
}

export function ObsidianDecoration({ variant, blockPos, blockQuat, scale, planetRadius, cellRadius, alignRotY }: ObsidianDecorationProps) {
    const path = `${OBSIDIAN_BASE}obsidiantile_${variant}.glb`;

    return (
        <group position={blockPos} quaternion={blockQuat} scale={scale}>
            <Suspense fallback={null}>
                <KenneyModel
                    path={path}
                    cellRadius={cellRadius}
                    planetRadius={planetRadius}
                    rotY={alignRotY + OBSIDIAN_ROT_OFFSET}
                />
            </Suspense>
        </group>
    );
}
