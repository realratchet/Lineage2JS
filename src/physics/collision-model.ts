import { Box3, Vector3 } from "three";
import type { CollisionHull_T, CollisionModel_T } from "../objects/objects";
import type { IBSPCollisionNodeDecodeInfo_T } from "@l2js/engine/contracts/mesh";

const HULL_FLIP = 0x40000000;

export function buildCollisionModel(nodes: IBSPCollisionNodeDecodeInfo_T[], rootOutside: boolean): CollisionModel_T {
    const cacheHulls = new Map<string, number>();
    const planes = new Float32Array(nodes.length * 4);
    const children = new Int32Array(nodes.length * 2);
    const isCsg = new Uint8Array(nodes.length);
    const hullIndices = new Int32Array(nodes.length).fill(-1);
    const hulls: CollisionHull_T[] = [];
    const bounds = new Box3();

    for (let i = 0, len = nodes.length; i < len; i++) {
        const node = nodes[i], collision = node.collision;

        planes.set(node.plane, i * 4);
        children[i * 2] = node.children[1];
        children[i * 2 + 1] = node.children[0];
        isCsg[i] = node.isCsg ? 1 : 0;

        if (!collision) continue;
        if (collision.flags.length >= 64) throw new Error(`Collision hull ${i} has ${collision.flags.length} planes, retail SetupHulls stops at 64.`);

        const min = collision.bounds.min, max = collision.bounds.max;
        const key = `${collision.flags.join(",")}/${min.join(",")}/${max.join(",")}`;

        if (cacheHulls.has(key)) {
            hullIndices[i] = cacheHulls.get(key);
            continue;
        }

        const boxPlanes = collision.boxPlanes || [[0, 0, -1, 0.1 - min[2]], [0, 0, 1, max[2] + 0.1], [-1, 0, 0, 0.1 - min[0]], [1, 0, 0, max[0] - 0.1], [0, -1, 0, 0.1 - min[1]], [0, 1, 0, max[1] - 0.1]];
        const hull: CollisionHull_T = {
            planes: collision.flags.map(flag => {
                const nodeIndex = flag & ~HULL_FLIP;
                const plane = nodes[nodeIndex].plane;
                const scale = flag & HULL_FLIP ? -1 : 1;

                return [plane[0] * scale, plane[1] * scale, plane[2] * scale, plane[3] * scale, nodeIndex];
            }),
            boxPlanes: boxPlanes.map(plane => [plane[0], plane[1], plane[2], plane[3], -1]),
            bounds: new Box3(new Vector3().fromArray(min), new Vector3().fromArray(max))
        };

        hullIndices[i] = hulls.length;
        cacheHulls.set(key, hulls.length);
        hulls.push(hull);
        bounds.union(hull.bounds);
    }

    return { planes, children, isCsg, hullIndices, hulls, rootOutside, bounds };
}

export default buildCollisionModel;
