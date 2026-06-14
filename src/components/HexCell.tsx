import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CubeState } from '../cubeTypes';
import { ObsidianState } from '../obsidianTypes';
import { useGameStore, CellAnim } from '../gameStore';
import { TileDecoration, ObsidianDecoration } from './TileDecoration';

interface HexCellProps {
    id: number;
    center: THREE.Vector3;           // unit sphere centre of this cell
    polygonVerts: THREE.Vector3[];   // CCW sorted polygon verts on unit sphere
    cellRadius: number;              // inscribed radius on unit sphere
    cube: CubeState | null;
    obsidian: ObsidianState | null;
    anim: CellAnim | null;
    planetRadius: number;
    hasOccupiedNeighbor: boolean;    // true if any adjacent cell has a tile or obsidian
    onClick: (id: number) => void;
}

// ── Animation helpers ──────────────────────────
function elasticOut(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const p = 0.4, s = p / 4;
    return Math.pow(2, -10 * t) * Math.sin(((t - s) * Math.PI * 2) / p) + 1;
}

function mergeSpring(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 1 + 0.5 * Math.sin(Math.PI * t) * Math.exp(-3.5 * t);
}

const PLACE_MS = 420;
const MERGE_MS = 600;

// ── Geometry builder ───────────────────────────
/**
 * Build a fan-triangulated flat polygon geometry from sorted polygon verts
 * projected onto the sphere surface.
 * @param pverts  CCW sorted polygon verts (unit sphere)
 * @param center  cell centre (unit sphere)
 * @param radius  planet radius
 * @param gap     fraction to shrink polygon (0 = full tile, 0.06 = small gap between tiles)
 * @param lift    outward lift factor above sphere surface
 */
function buildFaceGeometry(
    pverts: THREE.Vector3[],
    center: THREE.Vector3,
    radius: number,
    gap = 0.002,
    lift = 0.003,
): THREE.BufferGeometry {
    const n = pverts.length;
    const outward = center.clone().multiplyScalar(radius * (1 + lift));

    // Shrink polygon toward centre for the gap
    const scaledVerts = pverts.map((v) => {
        const world = v.clone().multiplyScalar(radius);
        return world.clone().lerp(outward, gap);
    });

    const positions: number[] = [];
    const normals: number[] = [];

    const cx = outward.x, cy = outward.y, cz = outward.z;
    const nrm = center.clone().normalize();

    // Fan from centre
    for (let i = 0; i < n; i++) {
        const a = scaledVerts[i];
        const b = scaledVerts[(i + 1) % n];
        // Triangle: centre, a, b
        positions.push(cx, cy, cz, a.x, a.y, a.z, b.x, b.y, b.z);
        normals.push(nrm.x, nrm.y, nrm.z, nrm.x, nrm.y, nrm.z, nrm.x, nrm.y, nrm.z);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geo;
}

// ── Component ─────────────────────────────────
export function HexCell({
    id, center, polygonVerts, cellRadius, cube, obsidian, anim, planetRadius, hasOccupiedNeighbor, onClick,
}: HexCellProps) {
    // Tile mesh (the hex/pent face)
    const tileRef = useRef<THREE.Mesh>(null!);
    const tileMat = useRef<THREE.MeshStandardMaterial>(null!);

    // Group wrapping TileDecoration — we animate its scale
    const blockGroupRef = useRef<THREE.Group>(null!);

    const hovered = useRef(false);
    const scaleY = useRef(cube ? 1 : 0); // block vertical scale for animation

    const clearAnim = useGameStore((s) => s.clearAnim);

    // Build static face geometry once per cell
    const faceGeo = useMemo(
        () => buildFaceGeometry(polygonVerts, center, planetRadius),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [id, planetRadius],
    );

    // Compute block position: exactly at planet surface
    // The KenneyModel component handles sinking the hex base below this point
    const blockPos = useMemo(() => {
        return center.clone().multiplyScalar(planetRadius * 1.0);
    }, [center, planetRadius]);

    // Quaternion so block top face aligns with sphere normal (center direction)
    const blockQuat = useMemo(() => {
        const q = new THREE.Quaternion();
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), center.clone().normalize());
        return q;
    }, [center]);

    // Compute Y-rotation to align Kenney tile edges with hex polygon edges
    const alignRotY = useMemo(() => {
        if (polygonVerts.length === 0) return 0;
        const n = center.clone().normalize();
        // Project first polygon vertex onto the tangent plane at cell center
        const v0 = polygonVerts[0].clone();
        const v0t = v0.sub(n.clone().multiplyScalar(v0.dot(n)));
        // Express this direction in the local frame produced by blockQuat
        const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(blockQuat);
        const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(blockQuat);
        return Math.atan2(v0t.dot(localX), v0t.dot(localZ));
    }, [polygonVerts, center, blockQuat]);

    useFrame(() => {
        if (!tileMat.current) return;

        // Force disable hover state if dragging
        if (useGameStore.getState().isDragging) {
            hovered.current = false;
        }

        const now = performance.now();
        let targetScale = cube ? 1 : 0;

        if (anim && cube) {
            const elapsed = now - anim.startTime;

            if (anim.type === 'place') {
                const t = Math.min(elapsed / PLACE_MS, 1);
                targetScale = elasticOut(t);
                if (t >= 1) clearAnim(id);
            } else if (anim.type === 'merge-result') {
                const t = Math.min(elapsed / MERGE_MS, 1);
                targetScale = mergeSpring(t);
                if (t >= 1) clearAnim(id);
            }
        }

        scaleY.current = targetScale;

        // Animate decoration group scale
        if (blockGroupRef.current) {
            const s = targetScale * (hovered.current && cube ? 1.08 : 1);
            blockGroupRef.current.scale.setScalar(s);
        }

        // Tile face colors — terrain fill system
        // Occupied cells: opaque earth-brown ground that hides the dark planet
        // Adjacent empty cells: spreading terrain effect
        // Far-away empty cells: subtle ghost hex
        if (obsidian) {
            tileMat.current.color.set('#2d1b4e');
            tileMat.current.opacity = 0.85;
        } else if (cube) {
            tileMat.current.color.set('#5c3d2e');   // earth-brown ground under tile
            tileMat.current.opacity = 1.0;           // fully opaque
        } else if (hasOccupiedNeighbor) {
            tileMat.current.color.set('#3a2718');     // darker earth spreading outward
            tileMat.current.opacity = hovered.current ? 0.70 : 0.55;
        } else {
            tileMat.current.color.set('#8899cc');
            tileMat.current.opacity = hovered.current ? 0.22 : 0.12;
        }
    });

    const initialBlockScale = anim?.type === 'place' ? 0 : (cube ? 1 : 0);

    return (
        <group>
            {/* Flat hex/pent tile face */}
            <mesh
                ref={tileRef}
                geometry={faceGeo}
                onPointerOver={(e) => { e.stopPropagation(); if (!useGameStore.getState().isDragging) hovered.current = true; }}
                onPointerOut={(e) => { e.stopPropagation(); hovered.current = false; }}
                onClick={(e) => {
                    e.stopPropagation();
                    // OrbitControls intercepts click if dragging, but delta > 2 is safer
                    if (!cube && !obsidian) onClick(id);
                }}
            >
                <meshStandardMaterial
                    ref={tileMat}
                    color={obsidian ? '#2d1b4e' : (cube ? '#5c3d2e' : (hasOccupiedNeighbor ? '#3a2718' : '#8899cc'))}
                    transparent
                    opacity={obsidian ? 0.85 : (cube ? 1.0 : (hasOccupiedNeighbor ? 0.55 : 0.12))}
                    roughness={0.8}
                    metalness={0.0}
                    side={THREE.FrontSide}
                />
            </mesh>

            {/* TileDecoration (hex prism + per-kind 3D geometry) */}
            {cube !== null && !obsidian && (
                <group
                    ref={blockGroupRef}
                    scale={initialBlockScale}
                >
                    <TileDecoration
                        cube={cube}
                        blockPos={blockPos}
                        blockQuat={blockQuat}
                        scale={1}
                        planetRadius={planetRadius}
                        cellRadius={cellRadius}
                        alignRotY={alignRotY}
                    />
                </group>
            )}

            {/* Obsidian tile (permanent blocker) */}
            {obsidian && (
                <group scale={1}>
                    <ObsidianDecoration
                        variant={obsidian.variant}
                        blockPos={blockPos}
                        blockQuat={blockQuat}
                        scale={1}
                        planetRadius={planetRadius}
                        cellRadius={cellRadius}
                        alignRotY={alignRotY}
                    />
                </group>
            )}
        </group>
    );
}
