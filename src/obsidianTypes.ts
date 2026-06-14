import { Cell } from './planet';

// ── Obsidian tile types ─────────────────────────────────────────────────────
// Obsidian tiles are permanent, unmovable, unmergeable blockers that spawn
// at the start of each game. They add strategic challenge by reducing the
// usable surface area of the planet.

export type ObsidianVariant = 'a' | 'b' | 'c' | 'd';

export interface ObsidianState {
  variant: ObsidianVariant;
}

/** Fixed number of obsidian tiles per game — keeps scores comparable. */
export const OBSIDIAN_COUNT = 10;

const VARIANTS: ObsidianVariant[] = ['a', 'b', 'c', 'd'];

function randomVariant(): ObsidianVariant {
  return VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
}

/**
 * Pick OBSIDIAN_COUNT random cells from the planet and assign each a
 * random visual variant.  The returned Map keys are cell IDs.
 */
export function generateObsidianPlacements(
  cells: Cell[],
): Record<number, ObsidianState> {
  // Shuffle cell indices using Fisher-Yates and take the first N
  const indices = cells.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const chosen = indices.slice(0, OBSIDIAN_COUNT);
  const result: Record<number, ObsidianState> = {};
  for (const cellId of chosen) {
    result[cellId] = { variant: randomVariant() };
  }
  return result;
}
