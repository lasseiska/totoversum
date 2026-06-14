import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useParticleStore } from '../particleStore';

const MAX_PARTICLES = 600;
const DUMMY_OBJECT = new THREE.Object3D();
const DUMMY_COLOR = new THREE.Color();

interface ParticleData {
    active: boolean;
    life: number;
    maxLife: number;
    velocity: THREE.Vector3;
    position: THREE.Vector3;
    scale: number;
    spinAxis: THREE.Vector3;
    spinSpeed: number;
}

export function ParticleEffects() {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    
    // We keep particle state outside of React state for maximum performance
    const particles = useMemo(() => {
        const p: ParticleData[] = [];
        for (let i = 0; i < MAX_PARTICLES; i++) {
            p.push({
                active: false,
                life: 0,
                maxLife: 1,
                velocity: new THREE.Vector3(),
                position: new THREE.Vector3(),
                scale: 1,
                spinAxis: new THREE.Vector3(0, 1, 0),
                spinSpeed: 0,
            });
        }
        return p;
    }, []);

    // Fetch incoming emission events
    const emissions = useParticleStore((s) => s.emissions);
    const consume = useParticleStore((s) => s.consume);

    // Initialize all instances to invisible
    useEffect(() => {
        if (!meshRef.current) return;
        for (let i = 0; i < MAX_PARTICLES; i++) {
            DUMMY_OBJECT.position.set(0, 0, 0);
            DUMMY_OBJECT.scale.set(0, 0, 0);
            DUMMY_OBJECT.updateMatrix();
            meshRef.current.setMatrixAt(i, DUMMY_OBJECT.matrix);
            meshRef.current.setColorAt(i, DUMMY_COLOR.setHex(0xffffff));
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        
        if (meshRef.current.instanceColor) {
            meshRef.current.instanceColor.needsUpdate = true;
        }
    }, []);

    // Handle new emissions (spawn new particles)
    useEffect(() => {
        if (emissions.length === 0 || !meshRef.current) return;

        let pIdx = 0;

        emissions.forEach((emission) => {
            const count = emission.type === 'merge' ? 45 : 15;
            const baseScale = emission.type === 'merge' ? 0.08 : 0.05;
            const speedMultiplier = emission.type === 'merge' ? 6.0 : 3.0;
            const outwardNrm = emission.position.clone().normalize();

            for (let i = 0; i < count; i++) {
                // Find next dead particle
                while (pIdx < MAX_PARTICLES && particles[pIdx].active) {
                    pIdx++;
                }
                if (pIdx >= MAX_PARTICLES) break; // Engine full!

                const p = particles[pIdx];
                p.active = true;
                
                // Random variation for life and scale
                p.maxLife = 0.5 + Math.random() * 0.4;
                if (emission.type === 'merge') p.maxLife += 0.3; // Merges last longer
                p.life = p.maxLife;
                p.scale = baseScale * (0.6 + Math.random() * 0.8);
                
                // Starting position: Slightly jittered around the source
                p.position.copy(emission.position);
                p.position.x += (Math.random() - 0.5) * 0.2;
                p.position.y += (Math.random() - 0.5) * 0.2;
                p.position.z += (Math.random() - 0.5) * 0.2;
                
                // Velocity: Expand outwards (dominant) + some spherical spread
                const spread = new THREE.Vector3(
                    (Math.random() - 0.5),
                    (Math.random() - 0.5),
                    (Math.random() - 0.5)
                ).normalize();
                
                // Blend outward normal and random spread
                p.velocity.copy(outwardNrm)
                    .multiplyScalar(0.7)
                    .add(spread.multiplyScalar(0.7))
                    .normalize()
                    .multiplyScalar((0.5 + Math.random()) * speedMultiplier);

                // Spin
                p.spinAxis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                p.spinSpeed = (Math.random() * 15) - 7.5;

                // Color
                // We add some lightness variation to make the explosion look less uniform
                const hsl = { h: 0, s: 0, l: 0 };
                DUMMY_COLOR.setStyle(emission.color).getHSL(hsl);
                DUMMY_COLOR.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + (Math.random() - 0.5) * 0.2)));
                
                // Push color far beyond 1.0 to trigger Bloom threshold (HDR glow)
                const glowMultiplier = emission.type === 'merge' ? 6.0 : 3.0;
                DUMMY_COLOR.multiplyScalar(glowMultiplier);

                meshRef.current.setColorAt(pIdx, DUMMY_COLOR);
            }

            consume(emission.id);
        });
        
        if (meshRef.current.instanceColor) {
            meshRef.current.instanceColor.needsUpdate = true;
        }

    }, [emissions, particles, consume]);

    // Animate particles
    useFrame((_, delta) => {
        if (!meshRef.current) return;
        
        // Cap delta to prevent explosion on severe lag
        const dt = Math.min(delta, 0.1);
        let updated = false;

        for (let i = 0; i < MAX_PARTICLES; i++) {
            const p = particles[i];
            
            if (!p.active) continue;
            updated = true;

            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                DUMMY_OBJECT.scale.setScalar(0);
                DUMMY_OBJECT.updateMatrix();
                meshRef.current.setMatrixAt(i, DUMMY_OBJECT.matrix);
                continue;
            }

            // Move
            p.position.addScaledVector(p.velocity, dt);
            
            // Gravity (pulls towards the center of the planet = [0,0,0])
            // Standard gravity pulls DOWN. Here "down" is negative outward normal.
            const gravityForce = p.position.clone().normalize().multiplyScalar(-3.0 * dt);
            p.velocity.add(gravityForce);

            // Drag (air resistance)
            p.velocity.multiplyScalar(0.92);

            // Calculate current scale (fade out at the end, pop out at start)
            const lifePct = p.life / p.maxLife;
            // Ease out elastic-ish pop
            let currentScale = p.scale;
            if (lifePct > 0.8) {
                currentScale *= (1 - lifePct) * 5; // Rapidly scale up from 0 to 1 over the top 20% of life
            } else {
                currentScale *= Math.pow(lifePct / 0.8, 1.5); // Smoothly shrink down to 0
            }

            // Update Dummy Object
            DUMMY_OBJECT.position.copy(p.position);
            DUMMY_OBJECT.quaternion.setFromAxisAngle(p.spinAxis, p.spinSpeed * (p.maxLife - p.life));
            DUMMY_OBJECT.scale.setScalar(currentScale);
            DUMMY_OBJECT.updateMatrix();

            meshRef.current.setMatrixAt(i, DUMMY_OBJECT.matrix);
        }

        if (updated) {
            meshRef.current.instanceMatrix.needsUpdate = true;
        }
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, MAX_PARTICLES]}
            renderOrder={2} // Ensure they render on top of tiles if transparent
        >
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial 
                roughness={0.4} 
                metalness={0.1}
                toneMapped={false} /* Allow colors to pop brightly */
            />
        </instancedMesh>
    );
}
