import { World, Collider, RigidBody, ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import type { ActorCollisionProfile_T, CollisionHull_T, CollisionPrimitive_T, CollisionTriangleIndex_T, ICollidable } from "./objects";
import LitActorMesh, { MeshLight } from "@client/objects/lit-actor";
import { Box3, Quaternion, Vector3 } from "three";
import buildTriangleIndex from "@client/physics/triangle-index";

const tmpPosition = new Vector3();
const tmpQuaternion = new Quaternion();
const tmpScale = new Vector3();
const tmpSimpleBounds = new Box3();
const HULL_FLIP = 0x40000000;

class CollidingMesh extends LitActorMesh implements ICollidable {
    public readonly isCollidable: boolean = true;

    protected colliderDesc: ColliderDesc;
    protected rigidbodyDesc: RigidBodyDesc;
    protected rigidbody: RigidBody;
    protected collider: Collider;
    protected colliderIndices: Uint32Array;
    protected colliderVertices: Float32Array;
    protected collisionNodes: Int32Array;
    protected collisionBounds: Float32Array;
    protected collisionProfile: ActorCollisionProfile_T;
    protected staticMeshCollision: GD.IStaticMeshCollisionDecodeInfo;
    protected collisionIndex: CollisionTriangleIndex_T;
    protected readonly analyticalBounds = new Box3();
    protected readonly analyticalCenter = new Vector3();
    protected readonly simpleCollisionBounds = new Box3();
    protected analyticalPrimitive: CollisionPrimitive_T = null;
    protected readonly basedActors = new Set<ICollidable>();

    public constructor(props: { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo: MeshLight, colliderIndices: Uint32Array, scaledGlow: number, isSunAffected?: boolean, ambient?: { glow: number, vector: number[], isUnlit: boolean }, collision?: ActorCollisionProfile_T, staticMeshCollision?: GD.IStaticMeshCollisionDecodeInfo, collisionIndex?: CollisionTriangleIndex_T }) {
        super(props);

        this.collisionProfile = props.collision;
        this.staticMeshCollision = props.staticMeshCollision;
        this.collisionIndex = props.collisionIndex;

        if (props.colliderIndices && props.geometry.hasAttribute("position") && props.colliderIndices.length > 0)
            this.makeCollider(props.colliderIndices, props.geometry.getAttribute("position").array as Float32Array);
        else this.isCollidable = false;
    }

    public makeCollider(indices: Uint32Array, vertices: Float32Array) {
        this.colliderIndices = indices;
        this.colliderVertices = vertices;
        this.colliderDesc = ColliderDesc.trimesh(vertices, indices);
        this.rigidbodyDesc = RigidBodyDesc.fixed();

        const collisionModel = this.staticMeshCollision?.collisionModel;
        const simpleCollisionHulls = collisionModel ? buildCollisionHulls(collisionModel) : null;

        this.simpleCollisionBounds.makeEmpty();
        if (simpleCollisionHulls)
            for (const hull of simpleCollisionHulls) this.simpleCollisionBounds.union(hull.bounds);

        if (this.staticMeshCollision?.nodes.length) {
            this.collisionNodes = this.staticMeshCollision.nodes;
            this.collisionBounds = this.staticMeshCollision.bounds;
        } else {
            this.collisionNodes = null;
            this.collisionBounds = null;
        }

        if (this.collisionProfile?.useCylinderCollision) {
            this.analyticalPrimitive = { kind: "cylinder", center: this.analyticalCenter, radius: this.collisionProfile.collisionRadius, halfHeight: this.collisionProfile.collisionHeight, bounds: this.analyticalBounds, supportsZeroExtent: true, supportsNonZeroExtent: true, supportsPointCheck: true };
        } else {
            this.analyticalPrimitive = {
                kind: "staticMesh",
                vertices: this.colliderVertices,
                indices: this.colliderIndices,
                collisionNodes: this.collisionNodes,
                collisionBounds: this.collisionBounds,
                index: this.collisionIndex || (this.colliderIndices.length < 384 ? null : buildTriangleIndex(this.colliderVertices, this.colliderIndices)),
                simpleCollisionHulls,
                useSimpleLineCollision: !!collisionModel && this.staticMeshCollision.useSimpleLineCollision,
                useSimpleBoxCollision: !!collisionModel && this.staticMeshCollision.useSimpleBoxCollision,
                matrixWorld: this.matrixWorld,
                bounds: this.analyticalBounds,
                supportsZeroExtent: true,
                supportsNonZeroExtent: true,
                supportsPointCheck: true
            };
        }
    }

    public createCollider(physicsWorld: World): Collider {
        this.getWorldScale(tmpScale);

        if (tmpScale.x !== 1 || tmpScale.y !== 1 || tmpScale.z !== 1) {
            const vertices = new Float32Array(this.colliderVertices.length);
            const indices = new Uint32Array(this.colliderIndices);

            for (let i = 0, len = vertices.length; i < len; i += 3) {
                vertices[i] = this.colliderVertices[i] * tmpScale.x;
                vertices[i + 1] = this.colliderVertices[i + 1] * tmpScale.y;
                vertices[i + 2] = this.colliderVertices[i + 2] * tmpScale.z;
            }

            if (tmpScale.x * tmpScale.y * tmpScale.z < 0)
                for (let i = 0, len = indices.length; i < len; i += 3)
                    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];

            this.colliderDesc = ColliderDesc.trimesh(vertices, indices);
        }

        this.rigidbody = physicsWorld.createRigidBody(this.rigidbodyDesc);
        this.collider = physicsWorld.createCollider(this.colliderDesc, this.rigidbody);

        this.rigidbody.setTranslation(this.getWorldPosition(tmpPosition), false);
        this.rigidbody.setRotation(this.getWorldQuaternion(tmpQuaternion), false);

        return this.collider;
    }

    public releaseCollider() {
        this.collider = null;
        this.rigidbody = null;
    }

    public getCollider(): Collider { return this.collider; }
    public getRigidbody(): RigidBody { return this.rigidbody; }
    public getCollisionProfile(): ActorCollisionProfile_T { return this.collisionProfile; }
    public getBasedActors(): ReadonlySet<ICollidable> { return this.basedActors; }
    public addBasedActor(actor: ICollidable) { this.basedActors.add(actor); }
    public removeBasedActor(actor: ICollidable) { this.basedActors.delete(actor); }
    public getCollisionPrimitive(): CollisionPrimitive_T | null {
        if (!this.analyticalPrimitive) return null;

        if (this.analyticalPrimitive.kind === "cylinder") {
            this.getWorldPosition(this.analyticalCenter);
            this.analyticalBounds.min.set(this.analyticalCenter.x - this.analyticalPrimitive.radius, this.analyticalCenter.y - this.analyticalPrimitive.radius, this.analyticalCenter.z - this.analyticalPrimitive.halfHeight);
            this.analyticalBounds.max.set(this.analyticalCenter.x + this.analyticalPrimitive.radius, this.analyticalCenter.y + this.analyticalPrimitive.radius, this.analyticalCenter.z + this.analyticalPrimitive.halfHeight);
        } else {
            this.updateWorldMatrix(true, false);
            this.analyticalBounds.setFromArray(this.colliderVertices).applyMatrix4(this.matrixWorld);

            if (!this.simpleCollisionBounds.isEmpty())
                this.analyticalBounds.union(tmpSimpleBounds.copy(this.simpleCollisionBounds).applyMatrix4(this.matrixWorld));
        }

        return this.analyticalPrimitive;
    }
}

function buildCollisionHulls(model: GD.IBSPCollisionModelDecodeInfo): CollisionHull_T[] {
    const hulls: CollisionHull_T[] = [];
    const cacheHulls = new Set<string>();

    for (const collision of model.hulls) {
        if (!collision.bounds.isValid) continue;

        const key = `${collision.flags.join(",")}/${collision.bounds.min.join(",")}/${collision.bounds.max.join(",")}`;

        if (cacheHulls.has(key)) continue;

        cacheHulls.add(key);

        hulls.push({
            planes: collision.flags.map(flag => {
                const nodeIndex = flag & ~HULL_FLIP;
                const plane = model.planes[nodeIndex];
                const scale = flag & HULL_FLIP ? -1 : 1;

                if (!plane) throw new Error(`Collision model plane '${nodeIndex}' is missing.`);

                return [plane[0] * scale, plane[1] * scale, plane[2] * scale, plane[3] * scale, nodeIndex];
            }),
            bounds: new Box3(new Vector3().fromArray(collision.bounds.min), new Vector3().fromArray(collision.bounds.max))
        });
    }

    return hulls;
}

export default CollidingMesh;
export { CollidingMesh };
