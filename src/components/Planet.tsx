import { useMemo } from 'react';
import { useGameStore } from '../gameStore';
import { HexCell } from './HexCell';
import { Toto } from './Toto';
import { SynergyConnections } from './SynergyConnections';
import { Cell } from '../planet';


const PLANET_RADIUS = 2.5;

export function Planet() {
    const { cells, grid, obsidian, cellAnims, bag, placeCube } = useGameStore();
    const hasBag = bag.length > 0;

    // For each empty cell, check if any neighbour is occupied (tile or obsidian)
    const occupiedNeighbors = useMemo(() => {
        const flags: Record<number, boolean> = {};
        (cells as Cell[]).forEach((cell) => {
            // Occupied cells don't need this flag (they get terrain fill directly)
            if (grid[cell.id] !== null || obsidian[cell.id]) {
                flags[cell.id] = false;
                return;
            }
            // Check if any neighbour has a tile or obsidian
            flags[cell.id] = cell.neighborIds.some(
                (nid) => grid[nid] !== null || !!obsidian[nid]
            );
        });
        return flags;
    }, [cells, grid, obsidian]);

    const handleClick = (cellId: number) => {
        if (!hasBag) return;
        placeCube(cellId);
    };

    return (
        <group>
            {/* Planet core sphere */}
            <mesh>
                <sphereGeometry args={[PLANET_RADIUS * 0.995, 64, 64]} />
                <meshStandardMaterial
                    color="#0e0e1e"
                    roughness={0.92}
                    metalness={0.08}
                />
            </mesh>

            {/* Hex / pent tiles */}
            {(cells as Cell[]).map((cell) => (
                <HexCell
                    key={cell.id}
                    id={cell.id}
                    center={cell.center}
                    polygonVerts={cell.polygonVerts}
                    cellRadius={cell.inscribedRadius}
                    cube={grid[cell.id]}
                    obsidian={obsidian[cell.id] ?? null}
                    anim={cellAnims[cell.id]}
                    planetRadius={PLANET_RADIUS}
                    hasOccupiedNeighbor={occupiedNeighbors[cell.id] ?? false}
                    onClick={handleClick}
                />
            ))}
            {/* Toto the bull-boy */}
            <Toto planetRadius={PLANET_RADIUS} />

            {/* Synergy glow arcs */}
            <SynergyConnections planetRadius={PLANET_RADIUS} />
        </group>
    );
}
