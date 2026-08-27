import RAPIER, { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { Box3, Quaternion, Vector3 } from "three";
import type { CollisionBspIndex_T, CollisionHull_T, CollisionPrimitive_T, ICollidable } from "./objects";
import { GameObject } from "../game/components";
import { ColliderComponent } from "../physics/components/physics-component";

const tmpPosition = new Vector3();
const tmpQuaternion = new Quaternion();
const tmpCapA = new Vector3();
const tmpCapB = new Vector3();
const HULL_FLIP = 0x40000000;
const CLIP_EPSILON = 0.01;

type HullPlane_T = { normal: Vector3, constant: number };
type BSPColliderDesc_T = { desc: ColliderDesc, nodeIndex: number };
type HullGeometry_T = { vertices: Float32Array, indices: Uint32Array };

class BSPCollider extends GameObject implements ICollidable {
    declare public readonly isCollidable: boolean;

    protected readonly colliderDescs: BSPColliderDesc_T[] = [];
    protected readonly analyticalHulls: CollisionHull_T[] = [];
    protected readonly analyticalBounds = new Box3();
    protected readonly analyticalPrimitive: CollisionPrimitive_T<"bsp">;
    protected readonly colliders: RAPIER.Collider[] = [];
    protected rigidbody: RAPIER.RigidBody = null;

    public constructor(nodes: GD.IBSPNodeDecodeInfo_T[]) {
        super();

        (this as any).isCollidable = true;

        this.name = "BSPCollision";

        const cacheHulls = new Set<string>();

        for (let i = 0, len = nodes.length; i < len; i++) {
            const collision = nodes[i].collision;

            if (!collision || !collision.bounds.isValid) continue;

            const key = `${collision.flags.join(",")}/${collision.bounds.min.join(",")}/${collision.bounds.max.join(",")}`;

            if (cacheHulls.has(key)) continue;

            cacheHulls.add(key);

            const min = collision.bounds.min;
            const max = collision.bounds.max;
            const bounds = new Box3(new Vector3().fromArray(min), new Vector3().fromArray(max));
            const center = new Vector3((min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5);
            const geometry = buildHullGeometry(nodes, collision, center);

            this.analyticalHulls.push({
                planes: collision.flags.map(flag => {
                    const nodeIndex = flag & ~HULL_FLIP;
                    const plane = nodes[nodeIndex].plane;
                    const scale = flag & HULL_FLIP ? -1 : 1;

                    return [plane[0] * scale, plane[1] * scale, plane[2] * scale, plane[3] * scale, nodeIndex];
                }),
                bounds
            });
            this.analyticalBounds.union(bounds);

            if (geometry.indices.length < 3) throw new Error(`BSP collision hull ${i} has no faces.`);

            const colliderDesc = ColliderDesc.trimesh(geometry.vertices, geometry.indices);

            colliderDesc.setTranslation(center.x, center.y, center.z);
            this.colliderDescs.push({ desc: colliderDesc, nodeIndex: i });
        }

        this.analyticalPrimitive = { kind: "bsp", hulls: this.analyticalHulls, index: buildHullIndex(this.analyticalHulls), bounds: this.analyticalBounds, supportsZeroExtent: true, supportsNonZeroExtent: true, supportsPointCheck: true };
        this.addComponent(new ColliderComponent());
    }

    public createCollider(physicsWorld: RAPIER.World): RAPIER.Collider {
        if (this.colliders.length > 0) return this.colliders[0];
        if (this.colliderDescs.length === 0) throw new Error("BSP collision has no hulls.");

        this.rigidbody = physicsWorld.createRigidBody(RigidBodyDesc.fixed());

        for (const info of this.colliderDescs) {
            try {
                this.colliders.push(physicsWorld.createCollider(info.desc, this.rigidbody));
            } catch (e) {
                throw new Error(`Failed to create BSP collision hull ${info.nodeIndex}: ${e}`);
            }
        }

        this.rigidbody.setTranslation(this.getWorldPosition(tmpPosition), false);
        this.rigidbody.setRotation(this.getWorldQuaternion(tmpQuaternion), false);

        return this.colliders[0];
    }

    public releaseCollider() {
        this.colliders.length = 0;
        this.rigidbody = null;
    }

    public getCollider(): RAPIER.Collider { return this.colliders[0]; }
    public getColliders(): RAPIER.Collider[] { return this.colliders; }
    public getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }
    public getCollisionPrimitive(): CollisionPrimitive_T { return this.analyticalPrimitive; }
}

function buildHullIndex(hulls: CollisionHull_T[]): CollisionBspIndex_T {
    const cellSize = 1024;
    const cacheCells = new Map<string, number[]>();
    const largeHullIndices: number[] = [];

    for (let i = 0, len = hulls.length; i < len; i++) {
        const bounds = hulls[i].bounds;
        const minX = Math.floor(bounds.min.x / cellSize), minY = Math.floor(bounds.min.y / cellSize);
        const maxX = Math.floor(bounds.max.x / cellSize), maxY = Math.floor(bounds.max.y / cellSize);
        const cellCount = (maxX - minX + 1) * (maxY - minY + 1);

        if (!Number.isFinite(cellCount) || cellCount <= 0 || cellCount > 4096) {
            largeHullIndices.push(i);
            continue;
        }

        for (let x = minX; x <= maxX; x++)
            for (let y = minY; y <= maxY; y++) {
                const key = `${x},${y}`;
                let arrIndices = cacheCells.get(key);

                if (!arrIndices) {
                    arrIndices = [];
                    cacheCells.set(key, arrIndices);
                }

                arrIndices.push(i);
            }
    }

    const cells = [...cacheCells].map(([key, arrIndices]) => ({ key: [...key.split(",").map(Number), 0], arrIndices }));

    cells.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]);

    const keys = new Int32Array(cells.length * 3);
    const offsets = new Uint32Array(cells.length + 1);
    let hullIndexCount = 0;

    for (let i = 0, len = cells.length; i < len; i++) {
        keys.set(cells[i].key, i * 3);
        offsets[i] = hullIndexCount;
        hullIndexCount += cells[i].arrIndices.length;
    }

    offsets[cells.length] = hullIndexCount;

    const hullIndices = new Uint32Array(hullIndexCount);

    for (let i = 0, len = cells.length; i < len; i++) hullIndices.set(cells[i].arrIndices, offsets[i]);

    return { cellSize, keys, offsets, hullIndices, largeHullIndices: new Uint32Array(largeHullIndices), marks: new Uint32Array(hulls.length), queryTag: 0 };
}

function buildHullGeometry(nodes: GD.IBSPNodeDecodeInfo_T[], collision: GD.IBSPNodeCollisionInfo_T, center: Vector3): HullGeometry_T {
    const min = collision.bounds.min;
    const max = collision.bounds.max;
    let faces = makeBoxFaces(min, max);

    for (const flag of collision.flags) {
        const nodeIndex = flag & ~HULL_FLIP;
        const node = nodes[nodeIndex];

        if (!node) throw new Error(`BSP collision references missing node ${nodeIndex}.`);

        const plane = node.plane;
        const scale = flag & HULL_FLIP ? -1 : 1;

        faces = clipFaces(faces, {
            normal: new Vector3(plane[0] * scale, plane[1] * scale, plane[2] * scale),
            constant: plane[3] * scale
        });

        if (faces.length === 0) break;
    }

    const vertices: number[] = [];
    const indices: number[] = [];
    const cacheVertices = new Map<string, number>();

    for (const face of faces) {
        const faceIndices: number[] = [];

        for (const vertex of face) {
            const key = `${Math.round(vertex.x * 1000)},${Math.round(vertex.y * 1000)},${Math.round(vertex.z * 1000)}`;
            let index = cacheVertices.get(key);

            if (index === undefined) {
                index = vertices.length / 3;
                cacheVertices.set(key, index);
                vertices.push(vertex.x - center.x, vertex.y - center.y, vertex.z - center.z);
            }

            if (faceIndices[faceIndices.length - 1] !== index) faceIndices.push(index);
        }

        if (faceIndices[0] === faceIndices[faceIndices.length - 1]) faceIndices.pop();

        for (let i = 1; i < faceIndices.length - 1; i++)
            if (!isDegenerateTriangle(vertices, faceIndices[0], faceIndices[i], faceIndices[i + 1]))
                indices.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
    }

    return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

function isDegenerateTriangle(vertices: number[], ia: number, ib: number, ic: number): boolean {
    const ax = vertices[ib * 3] - vertices[ia * 3];
    const ay = vertices[ib * 3 + 1] - vertices[ia * 3 + 1];
    const az = vertices[ib * 3 + 2] - vertices[ia * 3 + 2];
    const bx = vertices[ic * 3] - vertices[ia * 3];
    const by = vertices[ic * 3 + 1] - vertices[ia * 3 + 1];
    const bz = vertices[ic * 3 + 2] - vertices[ia * 3 + 2];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;

    return cx * cx + cy * cy + cz * cz < 1e-8;
}

function makeBoxFaces(min: GD.Vector3Arr, max: GD.Vector3Arr): Vector3[][] {
    const v000 = new Vector3(min[0], min[1], min[2]);
    const v001 = new Vector3(min[0], min[1], max[2]);
    const v010 = new Vector3(min[0], max[1], min[2]);
    const v011 = new Vector3(min[0], max[1], max[2]);
    const v100 = new Vector3(max[0], min[1], min[2]);
    const v101 = new Vector3(max[0], min[1], max[2]);
    const v110 = new Vector3(max[0], max[1], min[2]);
    const v111 = new Vector3(max[0], max[1], max[2]);

    return [
        [v000, v001, v011, v010],
        [v100, v110, v111, v101],
        [v000, v100, v101, v001],
        [v010, v011, v111, v110],
        [v000, v010, v110, v100],
        [v001, v101, v111, v011]
    ];
}

function clipFaces(faces: Vector3[][], plane: HullPlane_T): Vector3[][] {
    const clippedFaces: Vector3[][] = [];
    const cap: Vector3[] = [];

    for (const face of faces) {
        const clipped: Vector3[] = [];
        let previous = face[face.length - 1];
        let previousDistance = plane.normal.dot(previous) - plane.constant;
        let previousInside = previousDistance <= CLIP_EPSILON;

        for (const current of face) {
            const currentDistance = plane.normal.dot(current) - plane.constant;
            const currentInside = currentDistance <= CLIP_EPSILON;

            if (previousInside !== currentInside) {
                const vertex = previous.clone().lerp(current, previousDistance / (previousDistance - currentDistance));

                clipped.push(vertex);
                cap.push(vertex);
            }

            if (currentInside) clipped.push(current);

            previous = current;
            previousDistance = currentDistance;
            previousInside = currentInside;
        }

        if (clipped.length >= 3) clippedFaces.push(clipped);
    }

    const capFace = sortCap(cap, plane.normal);

    if (capFace.length >= 3) clippedFaces.push(capFace);

    return clippedFaces;
}

function sortCap(vertices: Vector3[], normal: Vector3): Vector3[] {
    const cacheVertices = new Map<string, Vector3>();

    for (const vertex of vertices) {
        const key = `${Math.round(vertex.x * 1000)},${Math.round(vertex.y * 1000)},${Math.round(vertex.z * 1000)}`;

        if (!cacheVertices.has(key)) cacheVertices.set(key, vertex);
    }

    const result = [...cacheVertices.values()];

    if (result.length < 3) return result;

    const center = new Vector3();
    const axisX = new Vector3();
    const axisY = new Vector3();

    for (const vertex of result) center.add(vertex);

    center.multiplyScalar(1 / result.length);

    if (Math.abs(normal.x) > Math.abs(normal.z)) axisX.set(-normal.y, normal.x, 0).normalize();
    else axisX.set(0, -normal.z, normal.y).normalize();

    axisY.crossVectors(normal, axisX).normalize();
    result.sort((a, b) => {
        tmpCapA.copy(a).sub(center);
        tmpCapB.copy(b).sub(center);

        return Math.atan2(axisY.dot(tmpCapA), axisX.dot(tmpCapA)) - Math.atan2(axisY.dot(tmpCapB), axisX.dot(tmpCapB));
    });

    return result;
}

export default BSPCollider;
export { BSPCollider };
