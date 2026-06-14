import * as THREE from 'three';

/**
 * Goldberg Polyhedron via Dual Mesh
 *
 * Algorithm:
 *  1. Subdivide an icosahedron → produces the "primal" triangular mesh
 *  2. For each unique primal-vertex, collect all primal-triangle centroids
 *     that share that vertex.  These centroids form the *dual polygon* (hex or pent).
 *  3. Sort the polygon vertices CCW around the cell centre.
 *  4. Two cells are neighbours if they share a primal edge.
 *
 * Result: ~80 cells for detail=1, ~320 for detail=2
 * We use detail=2 which gives a good sphere coverage (~250-280 unique cells,
 * which matches the spec of ~72 hexagons for GP(2,0) when we thin on a coarser
 * level; we'll use detail=1 to stay close to the spec's "~72 ruutua").
 */

export interface Cell {
    id: number;
    center: THREE.Vector3;       // unit sphere centre of this cell
    polygonVerts: THREE.Vector3[]; // sorted CCW on unit sphere
    neighborIds: number[];
    inscribedRadius: number;     // distance from centre to nearest edge midpoint (unit sphere)
}

// ──────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────

/** Round a number to fixed decimal places for use as a hash key. */
function fmt(n: number, dp = 5): string {
    return n.toFixed(dp);
}

function vecKey(v: THREE.Vector3, dp = 5): string {
    return `${fmt(v.x, dp)},${fmt(v.y, dp)},${fmt(v.z, dp)}`;
}

interface Triangle {
    verts: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    centroid: THREE.Vector3;
}

/** Extract triangles from an IcosahedronGeometry of given subdivision detail. */
function icosahedronTriangles(detail: number): Triangle[] {
    const geo = new THREE.IcosahedronGeometry(1, detail);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const triangles: Triangle[] = [];

    for (let i = 0; i < pos.count; i += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
        const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1).normalize();
        const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2).normalize();
        const centroid = a.clone().add(b).add(c).divideScalar(3).normalize();
        triangles.push({ verts: [a, b, c], centroid });
    }

    geo.dispose();
    return triangles;
}

/**
 * Sort polygon vertices counter-clockwise around a centre point,
 * projected onto the tangent plane at `centre` on the unit sphere.
 */
function sortPolyVerts(verts: THREE.Vector3[], centre: THREE.Vector3): THREE.Vector3[] {
    // Build a local 2D coordinate frame on the tangent plane
    const arbitrary = Math.abs(centre.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(arbitrary, centre).normalize();
    const v = new THREE.Vector3().crossVectors(centre, u).normalize();

    // Project each vert onto (u, v) and compute angle
    const withAngle = verts.map((pt) => {
        const d = pt.clone().sub(centre);
        const angle = Math.atan2(d.dot(v), d.dot(u));
        return { pt, angle };
    });

    withAngle.sort((a, b) => a.angle - b.angle);
    return withAngle.map((w) => w.pt);
}

// ──────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────

/**
 * Build the Goldberg-polyhedron cell grid.
 *
 * @param detail  IcosahedronGeometry subdivision detail (1 → ~42 cells, 2 → ~162 cells).
 *                Default 2 gives an excellent sphere coverage.
 */
export function buildPlanetCells(detail = 2): Cell[] {
    const triangles = icosahedronTriangles(detail);

    // ── Step 1: collect unique primal vertices ──
    // Map from vertex key → canonical Vector3
    const vertMap = new Map<string, THREE.Vector3>();
    const KEY_DP = 4;

    for (const tri of triangles) {
        for (const v of tri.verts) {
            const k = vecKey(v, KEY_DP);
            if (!vertMap.has(k)) vertMap.set(k, v.clone());
        }
    }

    // Assign each unique vertex an id
    const vertIds = new Map<string, number>();
    const cells: Cell[] = [];

    vertMap.forEach((vec, k) => {
        vertIds.set(k, cells.length);
        cells.push({
            id: cells.length,
            center: vec,           // will be recomputed from polygon centroid below
            polygonVerts: [],
            neighborIds: [],
            inscribedRadius: 0,
        });
    });

    // ── Step 2: for each triangle, attach centroid to each of its 3 vertices ──
    // Also track which vertex pairs share a triangle face (= dual-edge = primal-adjacency)
    const vertTris = new Map<number, THREE.Vector3[]>(); // vertId → [centroids]

    for (const tri of triangles) {
        const ids = tri.verts.map((v) => {
            const k = vecKey(v, KEY_DP);
            return vertIds.get(k)!;
        });

        for (const vid of ids) {
            if (!vertTris.has(vid)) vertTris.set(vid, []);
            vertTris.get(vid)!.push(tri.centroid);
        }

        // Neighbour relationships: every pair of verts in this triangle are neighbours
        for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
                const a = ids[i];
                const b = ids[j];
                if (!cells[a].neighborIds.includes(b)) cells[a].neighborIds.push(b);
                if (!cells[b].neighborIds.includes(a)) cells[b].neighborIds.push(a);
            }
        }
    }

    // ── Step 3: build sorted polygon for each cell ──
    cells.forEach((cell) => {
        const centroids = vertTris.get(cell.id) ?? [];
        // Recompute centre as average of centroid ring
        const avg = new THREE.Vector3();
        centroids.forEach((c) => avg.add(c));
        avg.divideScalar(centroids.length).normalize();
        cell.center = avg;
        cell.polygonVerts = sortPolyVerts(centroids, avg);

        // ── Step 4: compute inscribed radius ──
        // = shortest distance from centre to any edge midpoint
        const pverts = cell.polygonVerts;
        let minDist = Infinity;
        for (let i = 0; i < pverts.length; i++) {
            const a = pverts[i];
            const b = pverts[(i + 1) % pverts.length];
            const mid = a.clone().add(b).multiplyScalar(0.5).normalize();
            const d = avg.angleTo(mid); // arc distance on unit sphere
            if (d < minDist) minDist = d;
        }
        cell.inscribedRadius = minDist;
    });

    return cells;
}
