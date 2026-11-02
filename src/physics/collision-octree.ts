import { Box3, Vector3 } from "three";

const tmpBounds = new Box3();
const ACTORBOX_EPSILON = Math.fround(4.2);
const WORLD_RADIUS = 11 * 32768;

type CollisionOctreeActor_T = { uuid: string, bounds: Box3, singleNode: boolean, nodes: OctreeNode[], queryTag: number };

class OctreeNode {
    public readonly actors: CollisionOctreeActor_T[] = [];
    public children: OctreeNode[] = null;
    public readonly x: number;
    public readonly y: number;
    public readonly z: number;
    public readonly radius: number;

    public constructor(x: number, y: number, z: number, radius: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.radius = radius;
    }

    public filterActor(actor: CollisionOctreeActor_T): void {
        if (this.children) {
            const { min, max } = actor.bounds;
            if (actor.singleNode) {
                let child = 0;
                if (min.x > this.x) child |= 4;
                else if (max.x > this.x) return this.storeActor(actor);
                if (min.y > this.y) child |= 2;
                else if (max.y > this.y) return this.storeActor(actor);
                if (min.z > this.z) child |= 1;
                else if (max.z > this.z) return this.storeActor(actor);
                return this.children[child].filterActor(actor);
            }
            if (!(min.x <= this.x - this.radius && max.x >= this.x + this.radius && min.y <= this.y - this.radius && max.y >= this.y + this.radius && min.z <= this.z - this.radius && max.z >= this.z + this.radius)) {
                for (let child = 7; child >= 0; child--) {
                    if (child & 4 ? max.x <= this.x : min.x >= this.x) continue;
                    if (child & 2 ? max.y <= this.y : min.y >= this.y) continue;
                    if (child & 1 ? max.z <= this.z : min.z >= this.z) continue;
                    this.children[child].filterActor(actor);
                }
                return;
            }
        }
        this.storeActor(actor);
    }

    protected storeActor(actor: CollisionOctreeActor_T): void {
        // FOctreeNode::StoreActor 0x89bf80 splits before storing the fourth actor.
        if (!this.children && this.actors.length >= 3 && this.radius * 0.5 > 100) {
            const radius = this.radius * 0.5, actors = this.actors.slice();
            actors.push(actor);
            this.children = [];
            for (let child = 0; child < 8; child++)
                this.children.push(new OctreeNode(this.x + (child & 4 ? radius : -radius), this.y + (child & 2 ? radius : -radius), this.z + (child & 1 ? radius : -radius), radius));
            this.actors.length = 0;
            for (const entry of actors) {
                const index = entry.nodes.indexOf(this);
                if (index >= 0) entry.nodes.splice(index, 1);
                this.filterActor(entry);
            }
            return;
        }
        this.actors.push(actor);
        actor.nodes.push(this);
    }

    public pointCheck(location: Vector3, queryTag: number, actors: string[]): void {
        for (const actor of this.actors) {
            if (actor.queryTag === queryTag) continue;
            actor.queryTag = queryTag;
            if (actor.bounds.containsPoint(location)) actors.push(actor.uuid);
        }
        if (!this.children || location.x === this.x || location.y === this.y || location.z === this.z) return;
        const child = (location.x > this.x ? 4 : 0) | (location.y > this.y ? 2 : 0) | (location.z > this.z ? 1 : 0);
        this.children[child].pointCheck(location, queryTag, actors);
    }
}

export class CollisionOctree {
    protected readonly root = new OctreeNode(0, 0, 0, WORLD_RADIUS);
    protected readonly actors = new Map<string, CollisionOctreeActor_T>();
    protected queryTag: number = 0;

    public addActor(uuid: string, bounds: Box3, singleNode: boolean = false): void {
        const actor: CollisionOctreeActor_T = this.actors.get(uuid) || { uuid, bounds: new Box3(), singleNode, nodes: [], queryTag: 0 };
        this.removeActor(uuid);
        expandBounds(bounds, actor.bounds);
        actor.singleNode = singleNode;
        actor.queryTag = 0;
        this.actors.set(uuid, actor);
        const { min, max } = actor.bounds;
        if (max.x < -WORLD_RADIUS || min.x > WORLD_RADIUS || max.y < -WORLD_RADIUS || min.y > WORLD_RADIUS || max.z < -WORLD_RADIUS || min.z > WORLD_RADIUS) {
            console.warn(`[collision] Actor '${uuid}' has a collision box outside the world.`);
            return;
        }
        this.root.filterActor(actor);
    }

    public updateActor(uuid: string, bounds: Box3): void {
        const actor = this.actors.get(uuid);
        if (actor && actor.bounds.equals(expandBounds(bounds, tmpBounds))) return;
        this.addActor(uuid, bounds, true);
    }

    public removeActor(uuid: string): void {
        const actor = this.actors.get(uuid);
        if (!actor) return;
        for (const node of actor.nodes) {
            const index = node.actors.indexOf(actor);
            if (index < 0) throw new Error(`Collision actor '${uuid}' has an invalid octree membership.`);
            node.actors.splice(index, 1);
        }
        actor.nodes.length = 0;
        this.actors.delete(uuid);
    }

    public pointCheck(location: Vector3): string[] {
        const actors: string[] = [];
        this.queryTag = (this.queryTag + 1) >>> 0;
        this.root.pointCheck(location, this.queryTag, actors);
        return actors;
    }
}

function expandBounds(bounds: Box3, result: Box3): Box3 {
    const { min, max } = bounds;
    if (!Number.isFinite(min.x) || !Number.isFinite(min.y) || !Number.isFinite(min.z) || !Number.isFinite(max.x) || !Number.isFinite(max.y) || !Number.isFinite(max.z)) throw new Error(`Collision octree bounds are not finite.`);
    result.min.set(Math.fround(Math.fround(min.x) - ACTORBOX_EPSILON), Math.fround(Math.fround(min.y) - ACTORBOX_EPSILON), Math.fround(Math.fround(min.z) - ACTORBOX_EPSILON));
    result.max.set(Math.fround(Math.fround(max.x) + ACTORBOX_EPSILON), Math.fround(Math.fround(max.y) + ACTORBOX_EPSILON), Math.fround(Math.fround(max.z) + ACTORBOX_EPSILON));
    return result;
}

export default CollisionOctree;
