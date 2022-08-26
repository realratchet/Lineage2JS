import { AxesHelper, Box3, Box3Helper, BoxBufferGeometry, BoxHelper, BufferGeometry, Color, Float32BufferAttribute, Line, LineBasicMaterial, MathUtils, Matrix4, Mesh, MeshBasicMaterial, Plane, PlaneHelper, Quaternion, Raycaster, SphereBufferGeometry, Vector3, Vector4 } from "three";
import { RAD2DEG } from "three/src/math/MathUtils";
import BaseActor from "./base-actor";
import RenderManager from "./rendering/render-manager";
import { SectorObject } from "./objects/zone-object";
import type { ICollidable } from "./objects/objects";
import RAPIER from "@dimforge/rapier3d";

const EPSILON = 0.125;

class Player extends BaseActor implements ICollidable {
    public readonly isPlayer = true;
    public readonly type = "Player";

    protected readonly mesh: THREE.Mesh;
    protected readonly raycaster = new Raycaster();

    // protected readonly collisionBounds: THREE.Box3;
    protected readonly collisionSize: THREE.Vector3;
    protected readonly gravityHelper: THREE.Line;

    protected lastGoodGravityIntersection: THREE.Intersection = null;

    protected velocity = new Vector3();
    protected goToPosition = {
        needsToGo: false,
        position: new Vector3()
    };

    constructor() {
        super();

        this.collisionSize = new Vector3(15, 50, 15);
        // this.collisionBounds = new Box3().setFromCenterAndSize(new Vector3(), this.collisionSize);

        const geometry = new BoxBufferGeometry(this.collisionSize.x, this.collisionSize.y, this.collisionSize.z);
        const material = new MeshBasicMaterial({ color: 0xfcfcfc });

        geometry.translate(0, this.collisionSize.y * 0.5, 0);

        const mesh = new Mesh(geometry, material);

        this.gravityHelper = new Line(this.createGravityGeometry(), new LineBasicMaterial({ color: 0xff00ff, depthWrite: false, transparent: true }));

        const axes = new AxesHelper(20);

        axes.position.set(0, this.collisionSize.y, 0);

        this.add(mesh, this.gravityHelper, axes);
    }

    public readonly isCollidable = true;

    protected colliderDesc: RAPIER.ColliderDesc;
    protected rigidbodyDesc: RAPIER.RigidBodyDesc;

    protected collider: RAPIER.Collider;
    protected rigidbody: RAPIER.RigidBody;

    public createCollider(physicsWorld: RAPIER.World) {
        this.colliderDesc = RAPIER.ColliderDesc.cuboid(this.collisionSize.x * 0.5, this.collisionSize.y * 0.5, this.collisionSize.z * 0.5);
        this.rigidbodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
        this.rigidbodyDesc
            .setGravityScale(0)
            .lockTranslations()
            .enabledTranslations(false, true, false)
            .lockRotations()
            .setTranslation(this.position.x, this.position.y, this.position.z);

        this.rigidbodyDesc.mass = 70;

        this.rigidbody = physicsWorld.createRigidBody(this.rigidbodyDesc);
        this.collider = physicsWorld.createCollider(this.colliderDesc, this.rigidbody);

        return this.collider;
    }

    getCollider(): RAPIER.Collider { return this.collider; }
    getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }


    protected createGravityGeometry() {
        const geometry = new BufferGeometry();
        const position = new Float32BufferAttribute([
            0, -this.collisionSize.y * 0.5, 0,
            0, -this.collisionSize.y * 0.5 - 10, 0
        ], 3);

        geometry.setAttribute("position", position);

        return geometry;
    }

    public goTo(position: Vector3) {
        this.goToPosition.needsToGo = true;
        this.goToPosition.position.copy(position);
    }

    public getRayIntersection(position: THREE.Vector3, direction: THREE.Vector3, maxToi: number) {
        const rm = this.getRenderManager();
        const ray = new RAPIER.Ray(position, direction);
        const collection: IntersectionResult[] = [];

        rm.physicsWorld.intersectionsWithRay(ray, maxToi, false, i => {
            const object = rm.colliderMap.get(i.collider);

            if (object !== this) {
                const position = new Vector3()
                    .copy(ray.dir as THREE.Vector3)
                    .multiplyScalar(i.toi)
                    .add(ray.origin as THREE.Vector3);

                collection.push({
                    ...i,
                    position,
                    object
                });
            }

            return true;
        });

        return collection;
    }

    public getGravityIntersections() { return this.getRayIntersection(this.rigidbody.translation() as THREE.Vector3, new Vector3(0, -1, 0), Infinity); }

    public tryToGo(groundObjects: IntersectionResult[], deltaTime: number) {
        if (!this.goToPosition.needsToGo) {
            const linVel = new Vector3().copy(this.velocity).add(this.rigidbody.translation() as THREE.Vector3);
            this.rigidbody.setNextKinematicTranslation(linVel);
            // this.rigidbody.setLinvel(this.velocity, true);
            return;
        }

        this.addPointHelper(this.goToPosition.position);

        const lookPosition = new Vector3()
            .copy(this.goToPosition.position)
            .setY(this.position.y);

        this.lookAt(lookPosition);

        const lookDirection = new Vector3().copy(lookPosition).sub(this.position).normalize();

        // if (groundObjects.length > 0) {
        const dirVelocity = new Vector3().copy(lookDirection).multiplyScalar(125 * 4).multiplyScalar(deltaTime);
        const linVel = new Vector3().copy(this.velocity).add(dirVelocity).add(this.rigidbody.translation() as THREE.Vector3);

        this.rigidbody.setNextKinematicTranslation(linVel);
        // } else {
        //     this.rigidbody.setLinvel(this.velocity, true);
        // }

        // const feetLevel = this.collisionSize.y * 0.5;
        // const feetPosition = new Vector3().copy(this.position);
        // feetPosition.y -= feetLevel;

        // const desiredDistance = feetPosition.distanceTo(this.goToPosition.position);

        // const playerSpeed = 125 * 4;
        // const stepSize = Math.min(desiredDistance, playerSpeed * (deltaTime / 1000));

        // const lookDirection = new Vector3().copy(lookPosition).sub(this.position).normalize()
        // const newPosition = new Vector3().copy(lookDirection).multiplyScalar(stepSize).add(this.position);

        // this.raycaster.ray.origin.copy(newPosition);
        // this.raycaster.ray.origin.y += 1e10;

        // this.raycaster.ray.direction.set(0, -1, 0).applyQuaternion(new Quaternion().setFromRotationMatrix(this.matrixWorld)).normalize();
        // this.raycaster.far = Infinity;

        // const terrains = this.getTerrains();
        // const intersection = this.raycaster.intersectObjects(terrains)[0] || null;


        // if (intersection) {
        //     // const normalIntersection = new Vector3().copy(intersection.point).sub(feetPosition).normalize();

        //     // console.log(intersection.point.y - feetPosition.y);
        //     if (intersection.point.y - feetPosition.y > 15) {
        //         // const slope = normalIntersection.angleTo(lookDirection) * RAD2DEG;

        //         // if (slope > 15) {
        //         this.goToPosition.needsToGo = false;
        //         return;
        //         // }

        //         // console.log(slope * RAD2DEG);
        //     }


        //     this.position.copy(intersection.point);

        //     this.lastGoodGravityIntersection = intersection;
        //     this.addPointHelper(intersection.point, 0x0000ff);

        //     if (this.goToPosition.position.distanceToSquared(this.position) < 1)
        //         this.goToPosition.needsToGo = false;

        //     this.position.y += feetLevel;


        //     // const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), intersection.face.normal);

        //     // this.quaternion.multiply(quaternion);
        // }
    }

    public addPointHelper(point: Vector3, color: number = 0xff0000, time: number = 100) {
        const renderManager = this.getRenderManager();

        const object = new Mesh(new SphereBufferGeometry(10), new MeshBasicMaterial({ color }))
        object.position.copy(point);
        renderManager.scene.add(object);
        setTimeout(function () {
            renderManager.scene.remove(object);
            object.material.dispose();
            object.geometry.dispose();
        }, time);
    }

    public getRenderManager() {
        return ((global as any).renderManager as RenderManager);
    }

    public getSector() {
        const rm = this.getRenderManager();
        const sector = rm.getSector(this.position);

        return sector;
    }

    public getTerrains() {
        const terrains: THREE.Mesh[] = [];
        const sector = this.getSector();

        sector.traverseVisible(object => {
            if (!object.name.includes("TerrainSector")) return;
            if (!(object as any).geometry) return;

            terrains.push(object as THREE.Mesh);
        });

        return terrains;
    }

    // public getGravityIntersection() {
    //     this.raycaster.ray.origin.set(0, -this.collisionSize.y * 0.5, 0).applyMatrix4(this.matrixWorld);
    //     this.raycaster.ray.direction.set(0, -1, 0).applyQuaternion(new Quaternion().setFromRotationMatrix(this.matrixWorld)).normalize();
    //     this.raycaster.far = Infinity;

    //     const terrains = this.getTerrains();
    //     const intersection = this.raycaster.intersectObjects(terrains);

    //     return intersection[0] || null;
    // }

    protected applyGravity(groundObjects: IntersectionResult[], deltaTime: number) {
        if (groundObjects.length > 0) {
            this.velocity.set(0, 0, 0);
            return;
        }

        const rm = this.getRenderManager();

        this.velocity.add(rm.physicsWorld.gravity as THREE.Vector3).multiplyScalar(deltaTime);

        // const gravityIntersection = this.getGravityIntersection();
        // const feetLevel = this.collisionSize.y * 0.5;

        // this.updateMatrixWorld(true);

        // if (!gravityIntersection) {
        //     if (this.lastGoodGravityIntersection) {
        //         this.position.y = this.lastGoodGravityIntersection.point.y + feetLevel;
        //         this.velocity.y = 0;
        //     }
        // } else {
        //     const distanceSq = this.position.distanceToSquared(gravityIntersection.point);
        //     const feetLevelSq = feetLevel * feetLevel;

        //     if (distanceSq > feetLevelSq) {
        //         this.lastGoodGravityIntersection = gravityIntersection;

        //         this.velocity.y -= 9.8 * (deltaTime / 1000);

        //         const vDelta = new Vector3().copy(this.velocity).multiplyScalar(deltaTime / 1000);

        //         this.position.add(vDelta);

        //         this.position.y = Math.max(gravityIntersection.point.y, this.position.y)

        //         const distanceSq = this.position.distanceToSquared(gravityIntersection.point);

        //         if (distanceSq <= feetLevelSq)
        //             this.velocity.y = 0;

        //         // this.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), gravityIntersection.face.normal);
        //     } else {
        //         this.velocity.y = 0;
        //     }
        // }
    }

    protected nextTrace = 0;

    // // public traceBSP(nodeIndex: number, hits: any[] = []) {
    // //     const sector = this.getSector();
    // //     const bspNodes = sector.bspNodes;
    // //     const node = bspNodes[nodeIndex];

    // //     // if (node.collision) {

    // //     //     for (const flag of node.collision.flags) {
    // //     //         const hullFlip = Boolean(flag & 0x40000000);
    // //     //         const hullIndex = flag & ~0x40000000;

    // //     //         const hullnode = bspNodes[hullIndex];

    // //     //         if (hullIndex !== nodeIndex)
    // //     //             debugger;

    // //     //         // To do: perform correct hull planes intersection test
    // //     //         t = this.hullNodeAABBIntersect(origin, tmin, dirNormalized, tmax, extents, hullnode, hullFlip);
    // //     //     }
    // //     // }

    // //     // let startSide = this.nodeAABBOverlap(origin, extents, node);
    // //     // let endSide =   this.nodeAABBOverlap(origin + dirNormalized * tmax, extents, node);

    // //     // for (let i = 0; i < bspNodes.length; i++) {
    // //     // const node = bspNodes[i];

    // //     // if (!node.collision) continue;

    // //     const collisionBox = new Box3().setFromCenterAndSize(this.position, this.collisionSize);

    // //     if (node.collision) {

    // //         // const isOverlapping = collisionBox.intersectsBox(node.collision.bounds);

    // //         // const isOverlapping = false;

    // //         const intersections = node.collision.flags.map(flag => {
    // //             const hullFlip = Boolean(flag & 0x40000000);
    // //             const hullIndex = flag & ~0x40000000;
    // //             const hullPlane = bspNodes[hullIndex].plane;
    // //             const plane = new Plane(new Vector3(hullPlane.x, hullPlane.y, hullPlane.z), hullPlane.w);

    // //             if (hullFlip) {
    // //                 plane.constant = -plane.constant;
    // //             }

    // //             const a = plane.distanceToPoint(collisionBox.min);

    // //             // debugger;

    // //             return a;

    // //             // const t = this.hullPlaneAABB(collisionBox, hullPlane);
    // //         });

    // //         const isOverlapping = intersections.some(i => Math.abs(i) < 100);

    // //         if (isOverlapping) {

    // //             const color = isOverlapping ? 0xff0000 : 0x00ff00;

    // //             const boxHelper = new Box3Helper(node.collision.bounds, new Color(color));
    // //             const boxHelper2 = new Box3Helper(collisionBox, new Color(0xff00ff));

    // //             [boxHelper, boxHelper2].forEach(helper => {
    // //                 sector.helpers.add(helper);
    // //                 (helper as any).material.depthTest = false;
    // //                 (helper as any).material.depthWrite = false;
    // //                 (helper as any).material.transparent = true;
    // //             });

    // //             setTimeout(() => {
    // //                 [boxHelper, boxHelper2].forEach(helper => {
    // //                     sector.helpers.remove(helper);
    // //                     (helper as any).geometry.dispose();
    // //                     (helper as any).material.dispose();
    // //                 });
    // //             }, 100);
    // //         }
    // //     }

    // //     const plane = new Plane(
    // //         new Vector3(node.plane.x, node.plane.y, node.plane.z),
    // //         -node.plane.w
    // //     );

    // //     const dt1 = plane.distanceToPoint(collisionBox.min);
    // //     const dt2 = plane.distanceToPoint(collisionBox.max);

    // //     if (node.front >= 0 && (dt1 >= 0 || dt2 >= 0)) this.traceBSP(node.front, hits);
    // //     if (node.back >= 0 && (dt1 <= 0 || dt2 <= 0)) this.traceBSP(node.back, hits);


    // //     // const isOverlapping = this.nodeAABBOverlap(this.position, this.collisionSize, i);
    // //     // // const isOverlapping = collisionBox.intersectsBox(node.collision.bounds);
    // //     // // const color = isOverlapping === -1
    // //     // //     ? 0xff0000
    // //     // //     : isOverlapping === 0
    // //     // //         ? 0xffff00
    // //     // //         : 0x00ff00;

    // //     // // const color = isOverlapping !== 1 ? 0xff0000 : 0x00ff00;
    // //     // const color = isOverlapping ? 0xff0000 : 0x00ff00;

    // //     // // if (isOverlapping)
    // //     // //     debugger;

    // //     // const boxHelper = new Box3Helper(node.collision.bounds, new Color(color));
    // //     // const boxHelper2 = new Box3Helper(collisionBox, new Color(0xff00ff));

    // //     // const plane = new Plane(
    // //     //     new Vector3(node.plane.x, node.plane.y, node.plane.w),
    // //     //     node.plane.w
    // //     // );

    // //     // const planeHelper = new PlaneHelper(plane, 10000);

    // //     // [boxHelper, boxHelper2, planeHelper].forEach(helper => {
    // //     //     sector.helpers.add(helper);
    // //     //     (helper as any).material.depthTest = false;
    // //     //     (helper as any).material.depthWrite = false;
    // //     //     (helper as any).material.transparent = true;
    // //     // });

    // //     // setTimeout(() => {
    // //     //     [boxHelper, boxHelper2, planeHelper].forEach(helper => {
    // //     //         sector.helpers.remove(helper);
    // //     //         (helper as any).geometry.dispose();
    // //     //         (helper as any).material.dispose();
    // //     //     });
    // //     // }, 100);

    // //     // }

    // // }

    // // -1 = inside, 0 = intersects, 1 = outside
    // public nodeAABBOverlap(origin: THREE.Vector3, extents: THREE.Vector3, nodeIndex: number) {
    //     const sector = this.getSector();

    //     const bspNodes = sector.bspNodes;
    //     const node = bspNodes[nodeIndex];

    //     const plane = new Plane(
    //         new Vector3(node.plane.x, node.plane.y, node.plane.z),
    //         node.plane.w
    //     )

    //     const box = new Box3().setFromCenterAndSize(origin, extents);

    //     return plane.intersectsBox(box);

    //     // const plane = node.plane;

    //     // const e = extents.x * Math.abs(plane.x) + extents.y * Math.abs(plane.y) + extents.z * Math.abs(plane.z);
    //     // const s = origin.x * plane.x + origin.y * plane.y + origin.z * plane.z - plane.w;

    //     // if (s - e > 0) return -1;

    //     // if (s + e < 0) return 1;

    //     return 0;
    // }

    protected traceBSP() {
        const bounds = new Box3().setFromCenterAndSize(this.position, this.collisionSize);

        // const extents = new Vector3(
        //     // Math.abs(bounds.min.x) > Math.abs(bounds.max.x) ? bounds.min.x : bounds.max.x,
        //     // Math.abs(bounds.min.y) > Math.abs(bounds.max.y) ? bounds.min.y : bounds.max.y,
        //     // Math.abs(bounds.min.z) > Math.abs(bounds.max.z) ? bounds.min.z : bounds.max.z,
        // )

        const extents = new Vector3().copy(this.collisionSize);

        const startPosition = new Vector3(-84209.61041235727, -3730.723876953125, 245388.68808961584);
        const endPosition = new Vector3().copy(this.position);

        const vMin = min(startPosition, endPosition);
        const vMax = max(startPosition, endPosition);

        const aabbMin = new Vector3().subVectors(vMin, extents);
        const aabbMax = new Vector3().addVectors(vMax, extents);


        const result = this.checkNode(0, 0, 1, startPosition, endPosition, extents, { bounds, aabbMin, aabbMax }, { plane: null, pathFraction: 1, position: "outside" });

        // debugger;

        return result;
    }

    protected checkNode(
        nodeIndex: number,
        startFraction: number, endFraction: number,
        start: Vector3, end: Vector3, extents: Vector3,
        boundsAabb: { bounds: Box3; aabbMin: Vector3; aabbMax: Vector3; },
        result: { pathFraction: number, plane: any, position: "inside" | "outside" | "intersecting" }): any {

        if (result.pathFraction <= startFraction) {
            // already hit something nearer
            return result;
        }


        const sector = this.getSector();
        const bspNodes = sector.bspNodes;
        const node = bspNodes[nodeIndex]

        if (node.collision) {
            // debugger;

            const box1 = new Box3(boundsAabb.aabbMin, boundsAabb.aabbMax);
            const box2 = new Box3(node.collision.bounds.min, node.collision.bounds.max);

            // const itsct = box1.intersectsBox(box2);

            const boxHelper = new Box3Helper(box1, new Color(0xff0000));
            const boxHelper2 = new Box3Helper(box2, new Color(0x0000ff));

            const size = box1.getSize(new Vector3());

            const helpers = [boxHelper, boxHelper2];

            helpers.forEach(helper => {
                sector.helpers.add(helper);
                (helper as any).material.depthTest = false;
                (helper as any).material.depthWrite = false;
                (helper as any).material.transparent = true;
            });

            setTimeout(() => {
                helpers.forEach(helper => {
                    sector.helpers.remove(helper);
                    (helper as any).geometry.dispose();
                    (helper as any).material.dispose();
                });
            }, 100);

            if (this.aabbDontIntersect(
                boundsAabb.aabbMin, boundsAabb.aabbMax,
                node.collision.bounds.min, node.collision.bounds.max
            )) return result;

            debugger;

            result = this.checkBrush(nodeIndex, start, end, boundsAabb.bounds, result);

            // debugger;

            return result;
        }

        // this is a node
        const plane = new Plane(
            new Vector3(node.plane.x, node.plane.y, node.plane.z),
            node.plane.w
        );

        const startDistance = plane.distanceToPoint(start);
        const endDistance = plane.distanceToPoint(end);

        // Offset used for non-ray tests.
        const ox = Math.abs(extents.x * plane.normal.x);
        const oy = Math.abs(extents.y * plane.normal.y);
        const oz = Math.abs(extents.z * plane.normal.z);
        const offset = ox + oy + oz;

        if (node.front >= 0 && startDistance >= offset && endDistance >= offset) {
            // both points are in front of the plane
            // so check the front child
            return this.checkNode(
                node.front,
                startFraction,
                endFraction,
                start,
                end,
                extents,
                boundsAabb,
                result
            );
        }

        if (startDistance < -offset && endDistance < -offset) {
            // both points are behind the plane
            // so check the back child
            return this.checkNode(
                node.back,
                startFraction,
                endFraction,
                start,
                end,
                extents,
                boundsAabb,
                result
            );
        }

        // the line spans the splitting plane
        // Default values assume startDistance == endDistance.
        let side = 0;
        let fraction1 = 1;
        let fraction2 = 0;

        const sides = [node.front, node.back];

        // split the segment into two
        if (startDistance < endDistance) {
            // back
            side = 1;

            const inverseDistance = 1 / (startDistance - endDistance);
            fraction1 = (startDistance - offset + EPSILON) * inverseDistance;
            fraction2 = (startDistance + offset + EPSILON) * inverseDistance;
        }

        if (endDistance < startDistance) {
            // front
            const inverseDistance = 1 / (startDistance - endDistance);
            fraction1 = (startDistance + offset + EPSILON) * inverseDistance;
            fraction2 = (startDistance - offset - EPSILON) * inverseDistance;
        }

        // make sure the numbers are valid
        fraction1 = clamp0To1(fraction1);
        fraction2 = clamp0To1(fraction2);

        // calculate the middle point for the first side
        if (sides[side] >= 0) {
            const middleFraction =
                startFraction + (endFraction - startFraction) * fraction1;

            const middle = new Vector3().lerpVectors(start, end, fraction1);

            // check the first side
            result = this.checkNode(
                sides[side],
                startFraction,
                middleFraction,
                start,
                middle,
                extents,
                boundsAabb,
                result
            );
        }

        // calculate the middle point for the second side
        if (sides[1 - side] >= 0) {
            const middleFraction =
                startFraction + (endFraction - startFraction) * fraction2;

            const middle = new Vector3().lerpVectors(start, end, fraction2);

            // check the second side
            result = this.checkNode(
                sides[1 - side],
                middleFraction,
                endFraction,
                middle,
                end,
                extents,
                boundsAabb,
                result
            );
        }

        return result;
    }
    protected checkBrush(nodeIndex: number, start: Vector3, end: Vector3, bounds: Box3, currentResult: { pathFraction: number; plane: any; position: "inside" | "outside" | "intersecting" }): { pathFraction: number; plane: any; position: "inside" | "outside" | "intersecting" } {
        const sector = this.getSector();
        const bspNodes = sector.bspNodes;

        let startFraction = -1;
        let endFraction = 1;
        let startsOut = false;
        let endsOut = false;
        let collisionPlane = null;

        const flags = bspNodes[nodeIndex].collision.flags;

        for (const flag of flags) {
            const flipPlane = Boolean(flag & 0x40000000);
            const nodeIndex = flag & ~0x40000000;
            // const hullNode = bspNodes[hullIndex]

            // if (!hullNode.collision)
            //     debugger;

            const node = bspNodes[nodeIndex];

            const plane = new Plane(
                new Vector3(node.plane.x, node.plane.y, node.plane.z),//.multiplyScalar(flipPlane ? -1 : 1),
                node.plane.w
            );

            const offset = new Vector3(
                plane.normal.x < 0 ? bounds.max.x : bounds.min.x,
                plane.normal.y < 0 ? bounds.max.y : bounds.min.y,
                plane.normal.z < 0 ? bounds.max.z : bounds.min.z,
            );

            const bSO = new Vector3().addVectors(start, offset);
            const bEO = new Vector3().addVectors(end, offset);

            let startDistance: number;
            let endDistance: number;

            if (flipPlane) {
                startDistance = plane.constant - bSO.dot(plane.normal);
                endDistance = plane.constant - bEO.dot(plane.normal);
            } else {
                startDistance = bSO.dot(plane.normal) - plane.constant;
                endDistance = bEO.dot(plane.normal) - plane.constant;
            }

            if (startDistance > 0) startsOut = true;
            if (endDistance > 0) endsOut = true;

            // make sure the trace isn't completely on one side of the brush
            // NOTE: Q3 does an episilone compare here. Dunno if we need to.
            // if (d1 > 0 && ( d2 >= SURFACE_CLIP_EPSILON || d2 >= d1 )  )
            if (startDistance > 0 && endDistance > 0) {
                // both are in front of the plane, its outside of this brush
                return {
                    plane: null,
                    pathFraction: 1.0,
                    position: "outside"
                } as { pathFraction: number; plane: any; position: "inside" | "outside" | "intersecting" };
            }

            if (startDistance <= 0 && endDistance <= 0) {
                // both are behind this plane, it will get clipped by another one
                continue;
            }

            if (startDistance > endDistance) {
                // line is entering into the brush
                const fraction = (startDistance - EPSILON) / (startDistance - endDistance);

                if (fraction > startFraction) {
                    startFraction = fraction;
                    collisionPlane = plane;
                }

            } else {
                // line is leaving the brush
                const fraction =
                    (startDistance + EPSILON) / (startDistance - endDistance);

                if (fraction < endFraction)
                    endFraction = fraction;

            }
        }

        if (startsOut === false) {
            return {
                plane: currentResult.plane,
                pathFraction: currentResult.pathFraction,
                position: endsOut ? "intersecting" : "inside"
            };
        }

        if (startFraction < endFraction) {
            if (startFraction > -1 && startFraction < currentResult.pathFraction) {
                return {
                    plane: collisionPlane,
                    pathFraction: clamp0To1(startFraction),
                    position: "outside"
                };
            }
        }

        // No collision. Do nothing.
        return currentResult;
    }

    protected aabbDontIntersect(
        mina: THREE.Vector3, maxa: THREE.Vector3,
        minb: THREE.Vector3, maxb: THREE.Vector3,
    ): boolean {
        return (
            (mina.x > (maxb.x + EPSILON)) ||
            (mina.y > (maxb.y + EPSILON)) ||
            (mina.z > (maxb.z + EPSILON)) ||
            (maxa.x < (minb.x - EPSILON)) ||
            (maxa.y < (minb.y - EPSILON)) ||
            (maxa.z < (minb.z - EPSILON))
        );
    }

    // protected traceBSP() {
    //     const bounds = new Box3().setFromCenterAndSize(this.position, this.collisionSize);

    //     const extents = new Vector3(
    //         Math.abs(bounds.min.x) > Math.abs(bounds.max.x) ? bounds.min.x : bounds.max.x,
    //         Math.abs(bounds.min.y) > Math.abs(bounds.max.y) ? bounds.min.y : bounds.max.y,
    //         Math.abs(bounds.min.z) > Math.abs(bounds.max.z) ? bounds.min.z : bounds.max.z,
    //     )

    //     const origin = new Vector3(-84209.61041235727, -3730.723876953125, 245388.68808961584);
    //     const destination = new Vector3().copy(this.position);

    //     const tmin = 0;//Math.max(...origin.min(destination).toArray());
    //     const tmax = 50;//Math.max(...origin.max(destination).toArray());

    //     const dirNormalized = new Vector3().subVectors(destination, origin).normalize();

    //     const hits: any = [];

    //     this.trace(origin, tmin, dirNormalized, tmax, extents, 0, hits);
    // }

    // smallest: number = Infinity;

    // protected trace(origin: Vector3, tmin: number, dirNormalized: Vector3, tmax: number, extents: Vector3, nodeIndex: number, hits: any[]) {
    //     const sector = this.getSector();
    //     const bspNodes = sector.bspNodes;
    //     const node = bspNodes[nodeIndex];

    //     if (node.collision) {
    //         let t = tmax;

    //         for (const flag of node.collision.flags) {
    //             const hullFlip = Boolean(flag & 0x40000000);
    //             const hullIndex = flag & ~0x40000000;

    //             this.smallest = Math.min(this.smallest, t = this.hullNodeAABBIntersect(origin, tmin, dirNormalized, tmax, extents, hullIndex, hullFlip));
    //         }

    //         // this.smallest = Math.min(this.smallest, t);
    //         if (t >= tmin && t < tmax) {
    //             debugger;
    //             // SweepHit hit = { (float)t, vec3(node->PlaneX, node->PlaneY, node->PlaneZ), nullptr };
    //             // if (dot(to_dvec3(hit.Normal), dirNormalized) > 0.0)
    //             // 	hit.Normal = -hit.Normal;
    //             // hits.push_back(hit);
    //         }
    //     }

    //     const endVector = new Vector3().addVectors(origin, dirNormalized).multiplyScalar(tmax);

    //     const startSide = this.nodeAABBOverlap(origin, extents, nodeIndex);
    //     const endSide = this.nodeAABBOverlap(endVector, extents, nodeIndex);

    //     if (node.front >= 0 && (startSide <= 0 || endSide <= 0)) {
    //         this.trace(origin, tmin, dirNormalized, tmax, extents, node.front, hits);
    //     }

    //     if (node.back >= 0 && (startSide >= 0 || endSide >= 0)) {
    //         this.trace(origin, tmin, dirNormalized, tmax, extents, node.back, hits);
    //     }
    // }

    // protected hullNodeAABBIntersect(origin: Vector3, tmin: number, dirNormalized: Vector3, tmax: number, extents: Vector3, nodeIndex: number, flipPlane: boolean): number {

    //     const sector = this.getSector();
    //     const bspNodes = sector.bspNodes;
    //     const node = bspNodes[nodeIndex];

    //     // Find plane intersection points
    //     const e = extents.x * Math.abs(node.plane.x) + extents.y * Math.abs(node.plane.y) + extents.z * Math.abs(node.plane.z);

    //     let s;
    //     if (!flipPlane)
    //         s = origin.x * node.plane.x + origin.y * node.plane.y + origin.z * node.plane.z - node.plane.w;
    //     else
    //         s = node.plane.w - origin.x * node.plane.x - origin.y * node.plane.y - origin.z * node.plane.z;

    //     const d = 1.0 / (dirNormalized.x + dirNormalized.y + dirNormalized.z);
    //     const t0 = (e - s) * d;
    //     const t1 = (e + s) * d;
    //     let t = tmax;

    //     if (t0 >= tmin) t = Math.min(t, t0);
    //     if (t1 >= tmin) t = Math.min(t, t1);

    //     return t;
    // }

    // protected nodeAABBOverlap(center: Vector3, extents: Vector3, nodeIndex: number) {
    //     const sector = this.getSector();
    //     const bspNodes = sector.bspNodes;
    //     const node = bspNodes[nodeIndex];

    //     const e = extents.x * Math.abs(node.plane.x) + extents.y * Math.abs(node.plane.y) + extents.z * Math.abs(node.plane.z);
    //     const s = center.x * node.plane.x + center.y * node.plane.y + center.z * node.plane.z - node.plane.w;

    //     if (s - e > 0) return -1;
    //     if (s + e < 0) return 1;

    //     return 0;
    // }

    protected lastGoodIntersection: IntersectionResult = null;

    public update(renderManager: RenderManager, currentTime: number, deltaTime: number) {
        super.update(renderManager, currentTime, deltaTime);

        // if (!global.physicsEnabled) return;

        const dt = deltaTime / 1000;
        const groundObjects = this.getGravityIntersections();

        const rm = this.getRenderManager();
        const desiredPosition = new Vector3().copy(this.position);
        const gravityStep = new Vector3().copy(rm.physicsWorld.gravity as THREE.Vector3).multiplyScalar(dt);

        const gravityIntersection = groundObjects.length === 0 ? this.lastGoodIntersection : groundObjects[0];

        this.lastGoodIntersection = gravityIntersection;

        const isOnFloor = gravityIntersection && gravityIntersection.toi <= this.collisionSize.y * 0.5;
        const friction = 0.9;
        const playerSpeed = 125 * 4;

        // if (this.goToPosition.position.distanceToSquared(desiredPosition) < 2) {
        //     desiredPosition.copy(this.goToPosition.position);
        //     this.goToPosition.needsToGo = false;
        // }

        (() => {
            if (isOnFloor) {
                this.velocity.set(0, 0, 0);
                return;
            }

            // console.log(gravityStep.toArray().join(", "));
            this.velocity.add(gravityStep);
        })();


        const runVelocity = (() => {
            if (!this.goToPosition.needsToGo) return new Vector3();

            this.addPointHelper(this.goToPosition.position);

            const lookPosition = new Vector3()
                .copy(this.goToPosition.position)
                .setY(this.position.y);

            this.lookAt(lookPosition);

            const lookDirection = new Vector3().copy(lookPosition).sub(this.position).normalize();
            const distanceVector = new Vector3().copy(lookDirection).multiplyScalar(playerSpeed * dt);

            const highUpVector = new Vector3().copy(distanceVector).setY(1e5).add(this.position);
            const collisions = this.getRayIntersection(highUpVector, new Vector3(0, -1, 0), Infinity);

            if (collisions.length === 0) return new Vector3();

            const intersection = collisions[0];

            this.addPointHelper(intersection.position, 0x0000ff);

            const runVelocity = new Vector3().subVectors(intersection.position, this.position);

            const dtOffset = new Vector3().subVectors(this.goToPosition.position, intersection.position);

            const lenToDestinionSq = dtOffset.lengthSq();
            const lenVelocitySq = runVelocity.lengthSq();

            if (lenToDestinionSq < lenVelocitySq) {
                // runVelocity.copy(dtOffset);
                runVelocity.set(0, 0, 0);
                this.goToPosition.needsToGo = false;
                desiredPosition.copy(this.goToPosition.position);
            }

            return runVelocity;
        })();

        if (!isOnFloor) //dampen sideways movement when falling
            this.velocity.multiplyScalar(friction)

        desiredPosition.add(this.velocity).add(runVelocity);


        desiredPosition.y = Math.max(desiredPosition.y, gravityIntersection.position.y);



        this.rigidbody.setTranslation(desiredPosition as THREE.Vector3, true);

        // this.rigidbody.setTranslation(gravityIntersection.position as THREE.Vector3, true);

        // this.rigidbody.setNextKinematicTranslation(desiredPosition);
        // this.rigidbody.nextTranslation();

        // this.rigidbody.setLinvel(this.velocity, true);

        // this.applyGravity(groundObjects, deltaTime);
        // this.tryToGo(groundObjects, deltaTime);




        // if (this.nextTrace < currentTime) {

        //     // this.smallest = Infinity;
        //     this.traceBSP();
        //     // console.log(this.smallest);
        //     this.nextTrace = currentTime + 100;
        // }


        // const gravity = this.testGravity();

        // // this.position.y -= 9.8 * (deltaTime / 1000);

        // const helperMaterial = this.gravityHelper.material as THREE.LineBasicMaterial;

        // if (!gravity) {
        //     console.log(this.velocity);

        //     this.velocity.y -= 9.8 * (deltaTime / 1000);

        //     const vDelta = new Vector3().copy(this.velocity).multiplyScalar(deltaTime / 1000);

        //     this.position.add(vDelta);
        //     helperMaterial.color.setHex(0xff0000);
        // } else {
        //     this.position.y = gravity.point.y + this.collisionSize.y * 0.5 + 0.1;
        //     this.velocity.y = 0;
        //     helperMaterial.color.setHex(0x00ff00);

        // }
    }

}

export default Player;
export { Player };

function clamp0To1(toClamp: number) {
    return toClamp > 0 ? (toClamp < 1 ? toClamp : 1) : 0;
}

function max(lhs: THREE.Vector3, rhs: THREE.Vector3) {
    return new Vector3(
        lhs.x > rhs.x ? lhs.x : rhs.x,
        lhs.y > rhs.y ? lhs.y : rhs.y,
        lhs.z > rhs.z ? lhs.z : rhs.z
    );
}

function min(lhs: THREE.Vector3, rhs: THREE.Vector3) {
    return new Vector3(
        lhs.x < rhs.x ? lhs.x : rhs.x,
        lhs.y < rhs.y ? lhs.y : rhs.y,
        lhs.z < rhs.z ? lhs.z : rhs.z
    );
}

type IntersectionResult = {
    position: THREE.Vector3,
    object: ICollidable
} & RAPIER.RayColliderIntersection;