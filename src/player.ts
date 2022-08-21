import { AxesHelper, Box3, BoxBufferGeometry, BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, SphereBufferGeometry, Vector3 } from "three";
import { RAD2DEG } from "three/src/math/MathUtils";
import BaseActor from "./base-actor";
import RenderManager from "./rendering/render-manager";
import { SectorObject } from "./zone-object";


class Player extends BaseActor {
    public readonly isPlayer = true;
    public readonly type = "Player";

    protected readonly mesh: THREE.Mesh;
    protected readonly raycaster = new Raycaster();

    protected readonly collisionBounds: THREE.Box3;
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
        this.collisionBounds = new Box3().setFromCenterAndSize(new Vector3(), this.collisionSize);

        const geometry = new BoxBufferGeometry(this.collisionSize.x, this.collisionSize.y, this.collisionSize.z);
        const material = new MeshBasicMaterial({ color: 0xfcfcfc });

        const mesh = new Mesh(geometry, material);

        this.gravityHelper = new Line(this.createGravityGeometry(), new LineBasicMaterial({ color: 0xff00ff, depthWrite: false, transparent: true }));

        this.add(mesh, this.gravityHelper);
        this.add(new AxesHelper(15));
    }

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

    public tryToGo(deltaTime: number) {
        if (!this.goToPosition.needsToGo) return;

        this.addPointHelper(this.goToPosition.position);

        const lookPosition = new Vector3()
            .copy(this.goToPosition.position)
            .setY(this.position.y);

        this.lookAt(lookPosition);

        const feetLevel = this.collisionSize.y * 0.5;
        const feetPosition = new Vector3().copy(this.position);
        feetPosition.y -= feetLevel;

        const desiredDistance = feetPosition.distanceTo(this.goToPosition.position);

        const playerSpeed = 125 * 4;
        const stepSize = Math.min(desiredDistance, playerSpeed * (deltaTime / 1000));

        const lookDirection = new Vector3().copy(lookPosition).sub(this.position).normalize()
        const newPosition = new Vector3().copy(lookDirection).multiplyScalar(stepSize).add(this.position);

        this.raycaster.ray.origin.copy(newPosition);
        this.raycaster.ray.origin.y += 1e10;

        this.raycaster.ray.direction.set(0, -1, 0).applyQuaternion(new Quaternion().setFromRotationMatrix(this.matrixWorld)).normalize();
        this.raycaster.far = Infinity;

        const terrains = this.getTerrains();
        const intersection = this.raycaster.intersectObjects(terrains)[0] || null;


        if (intersection) {
            // const normalIntersection = new Vector3().copy(intersection.point).sub(feetPosition).normalize();

            // console.log(intersection.point.y - feetPosition.y);
            if (intersection.point.y - feetPosition.y > 15) {
                // const slope = normalIntersection.angleTo(lookDirection) * RAD2DEG;

                // if (slope > 15) {
                this.goToPosition.needsToGo = false;
                return;
                // }

                // console.log(slope * RAD2DEG);
            }


            this.position.copy(intersection.point);

            this.lastGoodGravityIntersection = intersection;
            this.addPointHelper(intersection.point, 0x0000ff);

            if (this.goToPosition.position.distanceToSquared(this.position) < 1)
                this.goToPosition.needsToGo = false;

            this.position.y += feetLevel;

            
            const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), intersection.face.normal);

            this.quaternion.multiply(quaternion);
        }
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
        const sector = rm.scene.children[2].children[0].children[0] as SectorObject;

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

    public getGravityIntersection() {
        this.raycaster.ray.origin.set(0, -this.collisionSize.y * 0.5, 0).applyMatrix4(this.matrixWorld);
        this.raycaster.ray.direction.set(0, -1, 0).applyQuaternion(new Quaternion().setFromRotationMatrix(this.matrixWorld)).normalize();
        this.raycaster.far = Infinity;

        const terrains = this.getTerrains();
        const intersection = this.raycaster.intersectObjects(terrains);

        return intersection[0] || null;
    }

    protected applyGravity(deltaTime: number) {
        const gravityIntersection = this.getGravityIntersection();
        const feetLevel = this.collisionSize.y * 0.5;

        this.updateMatrixWorld(true);

        if (!gravityIntersection) {
            if (this.lastGoodGravityIntersection) {
                this.position.y = this.lastGoodGravityIntersection.point.y + feetLevel;
                this.velocity.y = 0;
            }
        } else {
            const distanceSq = this.position.distanceToSquared(gravityIntersection.point);
            const feetLevelSq = feetLevel * feetLevel;

            if (distanceSq > feetLevelSq) {
                this.lastGoodGravityIntersection = gravityIntersection;

                this.velocity.y -= 9.8 * (deltaTime / 1000);

                const vDelta = new Vector3().copy(this.velocity).multiplyScalar(deltaTime / 1000);

                this.position.add(vDelta);

                this.position.y = Math.max(gravityIntersection.point.y, this.position.y)

                const distanceSq = this.position.distanceToSquared(gravityIntersection.point);

                if (distanceSq <= feetLevelSq)
                    this.velocity.y = 0;

                // this.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), gravityIntersection.face.normal);
            } else {
                this.velocity.y = 0;
            }
        }
    }

    public update(renderManager: RenderManager, currentTime: number, deltaTime: number) {
        super.update(renderManager, currentTime, deltaTime);

        // if (!global.physicsEnabled) return;

        this.tryToGo(deltaTime);
        this.applyGravity(deltaTime);


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