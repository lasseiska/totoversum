import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../gameStore';
import { computeActiveSynergies } from '../synergies';

interface SynergyConnectionsProps {
    planetRadius: number;
}

/**
 * Compute arc points between two cell centres on the sphere surface.
 * Uses nlerp (normalised lerp) which is a fine approximation for nearby cells.
 */
function computeArcPoints(
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
    segments = 10,
): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const aN = a.clone().normalize();
    const bN = b.clone().normalize();

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const p = aN.clone().lerp(bN, t).normalize();
        // Lift arc above surface, extra lift in the middle for a nice curve
        const lift = 1.035 + Math.sin(t * Math.PI) * 0.025;
        p.multiplyScalar(radius * lift);
        points.push(p);
    }
    return points;
}

export function SynergyConnections({ planetRadius }: SynergyConnectionsProps) {
    const cells = useGameStore((s) => s.cells);
    const grid = useGameStore((s) => s.grid);
    const groupRef = useRef<THREE.Group>(null!);

    const pairs = useMemo(
        () => computeActiveSynergies(grid, cells),
        [grid, cells],
    );

    // Build tube geometries for all synergy arcs
    const arcs = useMemo(() => {
        return pairs.map((pair) => {
            const a = cells[pair.cellIdA].center;
            const b = cells[pair.cellIdB].center;
            const pts = computeArcPoints(a, b, planetRadius);
            const curve = new THREE.CatmullRomCurve3(pts);
            const geometry = new THREE.TubeGeometry(curve, 12, planetRadius * 0.007, 5, false);
            const hdrColor = new THREE.Color(pair.synergy.color).multiplyScalar(4.0);
            return { geometry, color: hdrColor, key: pair.key };
        });
    }, [pairs, cells, planetRadius]);

    // Pulsing glow animation
    useFrame(({ clock }) => {
        if (!groupRef.current) return;
        const t = clock.getElapsedTime();
        const pulse = 0.35 + 0.45 * Math.sin(t * 2.5);
        groupRef.current.children.forEach((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                (child.material as THREE.MeshBasicMaterial).opacity = pulse;
            }
        });
    });

    if (arcs.length === 0) return null;

    return (
        <group ref={groupRef}>
            {arcs.map((arc) => (
                <mesh key={arc.key} geometry={arc.geometry} renderOrder={1}>
                    <meshBasicMaterial
                        color={arc.color}
                        transparent
                        opacity={0.6}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                        blending={THREE.AdditiveBlending}
                    />
                </mesh>
            ))}
        </group>
    );
}
