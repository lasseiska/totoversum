import { create } from 'zustand';
import * as THREE from 'three';

export type ParticleEmissionType = 'place' | 'merge' | 'rare';

export interface ParticleEmission {
    id: number;
    position: THREE.Vector3;
    color: string;
    type: ParticleEmissionType;
}

interface ParticleState {
    emissions: ParticleEmission[];
    emit: (position: THREE.Vector3, color: string, type: ParticleEmissionType) => void;
    consume: (id: number) => void;
}

let _id = 0;

export const useParticleStore = create<ParticleState>((set) => ({
    emissions: [],
    emit: (position, color, type) => set((state) => ({
        emissions: [...state.emissions, { id: _id++, position, color, type }],
    })),
    consume: (id) => set((state) => ({
        emissions: state.emissions.filter((e) => e.id !== id),
    })),
}));
