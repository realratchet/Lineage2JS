import { AxesHelper, BoxGeometry, BoxHelper, BufferGeometry, EdgesGeometry, Float32BufferAttribute, Line, LineBasicMaterial, LineSegments, MathUtils, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, SphereGeometry, Vector3, Vector4 } from "three";
import { RAD2DEG } from "three/src/math/MathUtils";
import BaseActor from "./base-actor";
import RenderManager from "./rendering/render-manager";
import { SectorObject } from "./objects/zone-object";
import type { ICollidable } from "./objects/objects";
import RAPIER from "@dimforge/rapier3d";

class Player extends BaseActor implements ICollidable {
    public readonly isPlayer = true;
    public readonly type = "Player";

    protected readonly mesh: THREE.Mesh;
    protected readonly raycaster = new Raycaster();

    protected readonly gravityHelper: THREE.Line;

    protected lastGoodGravityIntersection: THREE.Intersection = null;

    protected velocity = new Vector3();
    protected goToPosition = {
        needsToGo: false,
        position: new Vector3()
    };


    protected createGravityGeometry() {
        const geometry = new BufferGeometry();
        const position = new Float32BufferAttribute([
            0, -this.collisionSize.y * 0.5, 0,
            0, -this.collisionSize.y * 0.5 - 10, 0
        ], 3);

        geometry.setAttribute("position", position);

        return geometry;
    }

    public tryToGo(groundObjects: IntersectionResult[], deltaTime: number) {
        if (!this.goToPosition.needsToGo) {
            const linVel = new Vector3().copy(this.velocity).add(this.rigidbody.translation() as THREE.Vector3);
            this.rigidbody.setNextKinematicTranslation(linVel);
            // this.rigidbody.setLinvel(this.velocity, true);
            return;
        }

        // this.addPointHelper(this.goToPosition.position);

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

        const object = new Mesh(new SphereGeometry(10), new MeshBasicMaterial({ color }))
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
    // protected lastGoodIntersection: IntersectionResult = null;

    // public update(renderManager: RenderManager, currentTime: number, deltaTime: number) {
    //     super.update(renderManager, currentTime, deltaTime);

    //     // if (!global.physicsEnabled) return;

    //     // this.getGravityIntersections();

    //     // return;

    //     const dt = deltaTime / 1000;
    //     const groundObjects = this.getGravityIntersections();

    //     const rm = this.getRenderManager();
    //     const desiredPosition = new Vector3().copy(this.position);
    //     const gravityStep = new Vector3().copy(rm.physicsWorld.gravity as THREE.Vector3).multiplyScalar(dt);

    //     const gravityIntersection = groundObjects.length === 0 ? this.lastGoodIntersection : groundObjects[0];

    //     this.lastGoodIntersection = gravityIntersection;

    //     const isOnFloor = gravityIntersection && gravityIntersection.toi <= 1;
    //     const friction = 0.9;
    //     const playerSpeed = 125 * 4;

    //     // if (this.goToPosition.position.distanceToSquared(desiredPosition) < 2) {
    //     //     desiredPosition.copy(this.goToPosition.position);
    //     //     this.goToPosition.needsToGo = false;
    //     // }

    //     (() => {
    //         if (isOnFloor) {
    //             this.velocity.set(0, 0, 0);
    //             return;
    //         }

    //         // console.log(gravityStep.toArray().join(", "));
    //         this.velocity.add(gravityStep);
    //     })();


    //     const runVelocity = (() => {
    //         if (!this.goToPosition.needsToGo) return new Vector3();

    //         this.addPointHelper(this.goToPosition.position);

    //         const lookPosition = new Vector3()
    //             .copy(this.goToPosition.position)
    //             .setY(this.position.y);

    //         this.lookAt(lookPosition);

    //         const lookDirection = new Vector3().copy(lookPosition).sub(this.position).normalize();
    //         const distanceVector = new Vector3().copy(lookDirection).multiplyScalar(playerSpeed * dt);

    //         const highUpVector = new Vector3().copy(distanceVector).setY(1e5).add(this.position);
    //         const collisions = this.getRayIntersection(highUpVector, new Vector3(0, -1, 0), Infinity);

    //         if (collisions.length === 0) return new Vector3();

    //         const intersection = collisions[0];

    //         this.addPointHelper(intersection.position, 0x0000ff);

    //         const runVelocity = new Vector3().subVectors(intersection.position, this.position);

    //         const dtOffset = new Vector3().subVectors(this.goToPosition.position, intersection.position);

    //         const lenToDestinionSq = dtOffset.lengthSq();
    //         const lenVelocitySq = runVelocity.lengthSq();

    //         if (lenToDestinionSq < lenVelocitySq) {
    //             // runVelocity.copy(dtOffset);
    //             runVelocity.set(0, 0, 0);
    //             this.goToPosition.needsToGo = false;
    //             desiredPosition.copy(this.goToPosition.position);
    //         }

    //         return runVelocity;
    //     })();

    //     if (!isOnFloor) //dampen sideways movement when falling
    //         this.velocity.multiplyScalar(friction)

    //     desiredPosition.add(this.velocity).add(runVelocity);

    //     if (gravityIntersection)
    //         desiredPosition.y = Math.max(desiredPosition.y, gravityIntersection.position.y);

    //     this.rigidbody.setTranslation(desiredPosition as THREE.Vector3, true);

    //     // this.rigidbody.setTranslation(gravityIntersection.position as THREE.Vector3, true);

    //     // this.rigidbody.setNextKinematicTranslation(desiredPosition);
    //     // this.rigidbody.nextTranslation();

    //     // this.rigidbody.setLinvel(this.velocity, true);

    //     // this.applyGravity(groundObjects, deltaTime);
    //     // this.tryToGo(groundObjects, deltaTime);




    //     // if (this.nextTrace < currentTime) {

    //     //     // this.smallest = Infinity;
    //     //     this.traceBSP();
    //     //     // console.log(this.smallest);
    //     //     this.nextTrace = currentTime + 100;
    //     // }


    //     // const gravity = this.testGravity();

    //     // // this.position.y -= 9.8 * (deltaTime / 1000);

    //     // const helperMaterial = this.gravityHelper.material as THREE.LineBasicMaterial;

    //     // if (!gravity) {
    //     //     console.log(this.velocity);

    //     //     this.velocity.y -= 9.8 * (deltaTime / 1000);

    //     //     const vDelta = new Vector3().copy(this.velocity).multiplyScalar(deltaTime / 1000);

    //     //     this.position.add(vDelta);
    //     //     helperMaterial.color.setHex(0xff0000);
    //     // } else {
    //     //     this.position.y = gravity.point.y + this.collisionSize.y * 0.5 + 0.1;
    //     //     this.velocity.y = 0;
    //     //     helperMaterial.color.setHex(0x00ff00);

    //     // }
    // }


    // protected isFalling = true;
    // protected playerSpeed = 125 * 3;
    // protected stepHeight = 10;

    // public update(renderManager: RenderManager, currentTime: number, deltaTime: number) {
    //     super.update(renderManager, currentTime, deltaTime);

    //     let isExternalForceApplied = false;

    //     const groundObjects = this.getGravityIntersections();
    //     const appliedVelocity = new Vector3();
    //     const itsct = groundObjects[0];
    //     const dt = deltaTime / 1000;
    //     const playerSpeed = this.playerSpeed;
    //     const origin = new Vector3().copy(this.rigidbody.translation() as THREE.Vector3);
    //     const playerHeight = this.collisionSize.y;
    //     const playerHeightHalf = playerHeight * 0.5;
    //     const gravity = renderManager.physicsWorld.gravity;
    //     const gravityStep = new Vector3().copy(gravity as THREE.Vector3).multiplyScalar(dt);

    //     const itsctGround = groundObjects.length ? groundObjects[0] : null;
    //     const isOnFloor = itsctGround ? (itsct.toi <= this.collisionSize.y) : false;

    //     this.isFalling = isOnFloor;

    //     if (isOnFloor) origin.copy(itsctGround.position);

    //     (() => {
    //         if (!isOnFloor) this.velocity.add(gravityStep);
    //         else this.velocity.set(0, 0, 0);
    //     })();


    //     const inputVelocity = new Vector3();

    //     (() => {

    //         if (!this.goToPosition.needsToGo || !isOnFloor) return new Vector3();

    //         this.addPointHelper(this.goToPosition.position);

    //         const lookPosition = new Vector3()
    //             .copy(this.goToPosition.position)
    //             .setY(this.position.y);

    //         this.lookAt(lookPosition);

    //         const stepHeight = this.stepHeight;
    //         const lookDirection = new Vector3().copy(lookPosition).sub(this.position).normalize();
    //         const distanceVector = new Vector3().copy(lookDirection).multiplyScalar(playerSpeed * dt);

    //         const rayOrigin = new Vector3(lookDirection.x * 7.5, stepHeight, lookDirection.z * 7.5).add(origin as THREE.Vector3);
    //         const stepCollider = this.getRayIntersections(rayOrigin, lookDirection, playerSpeed * dt)

    //         if (stepCollider.length > 0) {
    //             this.goToPosition.needsToGo = false;
    //             // inputVelocity.subVectors(stepCollider[0].position, origin as THREE.Vector3);
    //             // inputVelocity.y = inputVelocity.y - playerHeightHalf;
    //             return new Vector3();
    //         }

    //         inputVelocity.add(distanceVector);
    //     })();

    //     const desiredPosition = new Vector3().copy(origin as THREE.Vector3);

    //     desiredPosition.add(this.velocity).add(inputVelocity);

    //     if (itsctGround)
    //         desiredPosition.y = Math.max(itsctGround.position.y, desiredPosition.y - playerHeightHalf);

    //     if (this.goToPosition.needsToGo && desiredPosition.distanceToSquared(this.goToPosition.position) < (playerSpeed * dt) ** 2) {
    //         desiredPosition.copy(this.goToPosition.position);
    //         this.goToPosition.needsToGo = false;
    //     }

    //     this.rigidbody.setTranslation(desiredPosition, false);
    // }
}

export default Player;
export { Player };

const normalToSlope = (() => {

    const vecXY = new Vector3(), vecYZ = new Vector3();

    return function normalToSlope(vec3: THREE.Vector3) {
        vecXY.set(vec3.x, vec3.y, 0).normalize();
        vecYZ.set(0, vec3.y, vec3.z).normalize();

        const pitch = Math.acos(vecYZ.dot(Player.DefaultUp));
        const roll = Math.acos(vecXY.dot(Player.DefaultUp));

        return [
            vec3.z < 0 ? -pitch : pitch,
            vec3.x < 0 ? -roll : roll
        ];

    };
})();

type IntersectionResult = {
    position: THREE.Vector3,
    object: ICollidable
} & RAPIER.RayColliderIntersection;