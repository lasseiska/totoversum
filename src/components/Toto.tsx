import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../gameStore';

/**
 * Toto – the cute little bull boy who lives on the planet!
 *
 * Behaviour:
 *  - Stands on the NEAREST EMPTY CELL adjacent to the last placed cube (totoStandId)
 *  - Rotates to FACE the placed cube's direction (totoFaceId)
 *  - Idle breathing bob
 *  - Celebrate jump on merge
 */

interface TotoProps {
    planetRadius: number;
}

const BODY_COLOR = '#1a1a1a';   // musta runko
const DARK_COLOR = '#0a0a0a';   // hyvin tumma
const HORN_COLOR = '#e8e0cc';   // luunvalkoinen sarvet
const SNOUT_COLOR = '#2e2220';  // tummanruskea kuono
const HOOF_COLOR = '#080808';   // lähes musta kaviot
const WHITE_COLOR = '#ffffff';

function mat(color: string, roughness = 0.7, metalness = 0): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function Toto({ planetRadius }: TotoProps) {
    const groupRef = useRef<THREE.Group>(null!);
    const bodyRef = useRef<THREE.Group>(null!);
    const celebrateRef = useRef({ active: false, t: 0 });

    const { totoStandId, totoFaceId, lastMergeId, cells } = useGameStore();
    const prevMergeRef = useRef<number | null>(null);

    const mats = useMemo(() => ({
        body: mat(BODY_COLOR, 0.75),
        dark: mat(DARK_COLOR, 0.8),
        horn: mat(HORN_COLOR, 0.5),
        snout: mat(SNOUT_COLOR, 0.55),
        hoof: mat(HOOF_COLOR, 0.5),
        white: mat(WHITE_COLOR, 0.9),
    }), []);

    // ── Stand target: the empty adjacent cell ──────────────────
    const standPos = useMemo(() => {
        if (totoStandId !== null && cells[totoStandId]) {
            return cells[totoStandId].center
                .clone()
                .multiplyScalar(planetRadius * 1.01);
        }
        // Default: north pole
        return new THREE.Vector3(0, planetRadius * 1.01, 0);
    }, [totoStandId, cells, planetRadius]);

    // ── Face target: the placed cube's world position ──────────
    const facePos = useMemo(() => {
        if (totoFaceId !== null && cells[totoFaceId]) {
            return cells[totoFaceId].center
                .clone()
                .multiplyScalar(planetRadius * 1.05);
        }
        return null;
    }, [totoFaceId, cells, planetRadius]);

    // ── Running state ──────────────────────────────────────────
    const currentPos = useRef(new THREE.Vector3(0, planetRadius * 1.01, 0));
    // Quaternion that keeps Toto feet-down on sphere
    const upQuat = useRef(new THREE.Quaternion());
    // Quaternion that rotates Toto left/right to face the cube (applied on top of upQuat)
    const faceYaw = useRef(0);   // target yaw offset (radians)
    const currentYaw = useRef(0);   // smoothed yaw

    useFrame(({ clock }) => {
        if (!groupRef.current || !bodyRef.current) return;

        const t = clock.getElapsedTime();

        // Detect new merge → celebrate
        if (lastMergeId !== prevMergeRef.current) {
            prevMergeRef.current = lastMergeId;
            celebrateRef.current = { active: true, t: 0 };
        }

        // ── 1. Glide to stand position ─────────────────────────
        currentPos.current.lerp(standPos, 0.06);
        groupRef.current.position.copy(currentPos.current);

        // ── 2. Orient feet toward planet centre ────────────────
        const outward = currentPos.current.clone().normalize();
        const targetUpQ = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            outward,
        );
        upQuat.current.slerp(targetUpQ, 0.08);

        // ── 3. Compute yaw to face the placed cube ─────────────
        if (facePos) {
            // Project both stand-pos and face-pos onto tangent plane at stand-pos
            // to find the angle Toto should turn toward the placed cube.
            const localFace = facePos.clone().sub(currentPos.current);

            // Build tangent frame at Toto's position
            const arbitrary = Math.abs(outward.y) < 0.9
                ? new THREE.Vector3(0, 1, 0)
                : new THREE.Vector3(1, 0, 0);
            const tangU = new THREE.Vector3().crossVectors(outward, arbitrary).normalize();
            const tangV = new THREE.Vector3().crossVectors(tangU, outward).normalize();

            const dx = localFace.dot(tangU);
            const dz = localFace.dot(tangV);
            faceYaw.current = -Math.atan2(dx, dz);  // yaw around up-axis
        }

        // Smoothly interpolate yaw
        const yawDiff = ((faceYaw.current - currentYaw.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        currentYaw.current += yawDiff * 0.08;

        // Compose: up-orientation × yaw rotation
        const yawQ = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            currentYaw.current,
        );
        groupRef.current.quaternion.copy(upQuat.current).multiply(yawQ);

        // ── 4. Idle breathing bob ──────────────────────────────
        const bob = Math.sin(t * 2.2) * 0.015;
        bodyRef.current.position.y = bob;

        // ── 5. Celebrate jump ──────────────────────────────────
        if (celebrateRef.current.active) {
            celebrateRef.current.t += 0.055;
            const ct = celebrateRef.current.t;
            const jump = Math.max(0, Math.sin(ct * Math.PI)) * 0.3;
            const spin = Math.sin(ct * 2.5) * 0.3;
            bodyRef.current.position.y = bob + jump;
            bodyRef.current.rotation.z = spin;
            if (ct > 1.3) {
                celebrateRef.current.active = false;
                bodyRef.current.rotation.z = 0;
            }
        }
    });

    // S = base scale unit
    const S = planetRadius * 0.09;

    return (
        <group ref={groupRef}>
            <group ref={bodyRef}>

                {/* ── BODY (small & round) ─ */}
                <mesh position={[0, S * 0.45, 0]} material={mats.body}>
                    <sphereGeometry args={[S * 0.42, 14, 10]} />
                </mesh>

                {/* ── HEAD (large, sits on body) ─ */}
                <mesh position={[0, S * 1.55, 0]} material={mats.body}>
                    <sphereGeometry args={[S * 0.70, 16, 12]} />
                </mesh>

                {/* ── SNOUT (small) ─ */}
                <mesh
                    position={[0, S * 1.28, S * 0.57]}
                    rotation={[Math.PI / 2, 0, 0]}
                    material={mats.snout}
                >
                    <sphereGeometry args={[S * 0.24, 12, 8]} />
                </mesh>

                {/* Nostrils */}
                {[-0.11, 0.11].map((xf, i) => (
                    <mesh key={i} position={[xf * S, S * 1.2, S * 0.80]} material={mats.dark}>
                        <sphereGeometry args={[S * 0.065, 6, 6]} />
                    </mesh>
                ))}

                {/* ── EYES ─ */}
                {[-0.30, 0.30].map((xf, i) => (
                    <group key={i} position={[xf * S, S * 1.68, S * 0.50]}>
                        <mesh material={mats.white}>
                            <sphereGeometry args={[S * 0.20, 10, 10]} />
                        </mesh>
                        <mesh position={[0, 0, S * 0.16]} material={mats.dark}>
                            <sphereGeometry args={[S * 0.11, 8, 8]} />
                        </mesh>
                        <mesh position={[S * 0.05, S * 0.06, S * 0.23]} material={mats.white}>
                            <sphereGeometry args={[S * 0.035, 6, 6]} />
                        </mesh>
                    </group>
                ))}

                {/* ── HORNS (big & proud) ─ */}
                {[-1, 1].map((side, i) => (
                    <group
                        key={i}
                        position={[side * S * 0.42, S * 2.12, S * 0.05]}
                        rotation={[0.15, side * -0.25, side * 0.7]}
                    >
                        <mesh material={mats.horn}>
                            <cylinderGeometry args={[S * 0.06, S * 0.15, S * 0.72, 8]} />
                        </mesh>
                        <mesh position={[0, S * 0.4, 0]} material={mats.horn}>
                            <sphereGeometry args={[S * 0.055, 6, 6]} />
                        </mesh>
                    </group>
                ))}

                {/* ── LEGS (short & stubby, 4 total) ─ */}
                {[
                    [-0.28, 0.28],
                    [-0.24, -0.30],
                ].flatMap(([lx], row) =>
                    [lx, -lx].map((x, col) => {
                        const lz = row === 0 ? 0.24 : -0.26;
                        const id = `${row}-${col}`;
                        return (
                            <group key={id}>
                                <mesh position={[x * S, S * 0.14, lz * S]} material={mats.body}>
                                    <cylinderGeometry args={[S * 0.12, S * 0.1, S * 0.38, 7]} />
                                </mesh>
                                <mesh position={[x * S, S * -0.08, lz * S]} material={mats.hoof}>
                                    <sphereGeometry args={[S * 0.13, 7, 6]} />
                                </mesh>
                            </group>
                        );
                    })
                )}

                {/* ── TAIL ─ */}
                <mesh
                    position={[0, S * 0.5, -S * 0.42]}
                    rotation={[0.5, 0, 0]}
                    material={mats.body}
                >
                    <cylinderGeometry args={[S * 0.05, S * 0.025, S * 0.42, 5]} />
                </mesh>
                <mesh position={[0, S * 0.2, -S * 0.68]} material={mats.dark}>
                    <sphereGeometry args={[S * 0.10, 7, 7]} />
                </mesh>

            </group>
        </group>
    );
}
