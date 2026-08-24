import ParticleMaterial from "@client/materials/particle-material/particle-material";
import InstancedParticleMaterial from "@client/materials/particle-material/instanced-particle-material";
import { Mesh, PlaneGeometry, Vector3 } from "three";
import * as THREE from "three";
import BaseEmitter from "./base-emitter";
import InstancedSpriteMesh from "./instanced-sprite-mesh";

const geometry = new PlaneGeometry(2, 2);

// scratch vectors for onBeforeRender, reused per particle per frame to avoid allocating
const tmpProjUp = new Vector3();
const tmpProjFront = new Vector3();
const tmpProjRight = new Vector3();
const tmpDirection = new Vector3();
const tmpUp = new Vector3();
const tmpRight = new Vector3();
const tmpNonParallel = new Vector3();
const tmpProjTemp = new Vector3();
const tmpRealProj = new Vector3();
const tmpViewDir = new Vector3();
const tmpViewLocation = new Vector3();
const tmpOrigRight = new Vector3();
const tmpOrigUp = new Vector3();
const tmpSpinScaled = new Vector3();
const tmpNormal = new Vector3();
const tmpMatrix = new THREE.Matrix4();

class SpriteEmitter extends BaseEmitter {
    public spriteDirection: GD.SpriteDirections_T;
    public projectionNormal: THREE.Vector3;

    public constructor(config: SpriteEmitterConfig_T) {
        super(config);
        this.finishConstruction(config);
    }

    protected initSettings(config: SpriteEmitterConfig_T): void {
        this.isSpriteEmitter = true;
        this.material = config.material;
        this.spriteDirection = config.spriteDirection || "camera";
        this.projectionNormal = new Vector3().fromArray(config.projectionNormal ?? [0, 0, 1]);

        // Both camera-facing sprites and PTDU_Normal use one basis for the whole
        // emitter, so neither needs a mesh/draw call per particle. Velocity-driven
        // modes still require a per-particle basis and stay on the legacy path.
        this.isInstancedRendering = this.spriteDirection === "camera" || this.spriteDirection === "normal";
    }

    protected initParticleMesh() {
        const usesSubdivision = this.texSubdivU > 1 || this.texSubdivV > 1;
        const mesh = new ParticleMesh(new ParticleMaterial({ ...this.material, usesSubdivision }));
        mesh.spriteDirection = this.spriteDirection;
        mesh.projectionNormal = this.projectionNormal;
        return mesh;
    }

    protected createInstancedMesh(capacity: number): InstancedSpriteMesh {
        const usesSubdivision = this.texSubdivU > 1 || this.texSubdivV > 1;
        return new InstancedSpriteMesh(new InstancedParticleMaterial({
            ...this.material,
            usesSubdivision,
            spriteDirection: this.spriteDirection,
            projectionNormal: this.projectionNormal
        }), capacity);
    }
}

export default SpriteEmitter;
export { SpriteEmitter };

class ParticleMesh extends Mesh<THREE.BufferGeometry, ParticleMaterial> {
    public spriteDirection: GD.SpriteDirections_T = "camera";
    public projectionNormal: THREE.Vector3 = new Vector3(0, 0, 1);

    public constructor(material: ParticleMaterial) {
        super(geometry, material);
    }

    onBeforeRender = (_renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera) => {

        // UE2 math equivalent:
        // FVector ProjUp        = SceneNode->Deproject(FPlane(0,-1000,0,1)) - ProjBase;
        // FVector ProjRight     = SceneNode->Deproject(FPlane(1000,0,0,1)) - ProjBase;
        // FVector ProjFront     = ProjRight ^ ProjUp;
        
        // In Three.js:
        // ProjUp is the camera's up vector
        // ProjFront is the negative look direction (since camera looks down -Z)
        // ProjRight is the cross product of Front and Up
        
        const projUp = tmpProjUp.copy(camera.up).normalize();
        const projFront = tmpProjFront.set(0, 0, 1).applyQuaternion(camera.quaternion).normalize();

        // In Left-Handed UE: ProjRight = Up x Front
        // In Right-Handed ThreeJS: Right = Front x Up
        const projRight = tmpProjRight.crossVectors(projFront, projUp).normalize();

        projUp.crossVectors(projRight, projFront).normalize();

        const direction = tmpDirection;
        const up = tmpUp;
        const right = tmpRight;

        // Get velocity direction if particle is attached
        const particle = (this as any).particleRef;
        const velocity = particle ? particle.velocity : null;
        const hasVelocity = velocity && velocity.lengthSq() > 0.0001;

        if (this.spriteDirection === "normal") {
            direction.set(this.projectionNormal.x, this.projectionNormal.y, this.projectionNormal.z).normalize();

            // PTDU_Normal:
            // Up    = (Direction ^ Direction.GetNonParallel()) * Size.Y;
            // Right = (Direction ^ Up).SafeNormal() * Size.X;
            // GetNonParallel: returns a vector not parallel to this
            const nonParallel = tmpNonParallel.set(1, 0, 0);
            if (Math.abs(direction.x) >= 0.5) nonParallel.set(0, 1, 0);

            // UE uses left-handed cross product (A ^ B)
            // Three.js cross product is right-handed, so the order is reversed: B x A = Right-handed Cross(A, B)
            up.crossVectors(nonParallel, direction).normalize();
            right.crossVectors(up, direction).normalize();

            // But wait, Three.js right is X, up is Y. UE is X forward, Y right, Z up.
            // When translating:
            // - UE +Right maps to Threejs +X
            // - UE +Up maps to Threejs +Y
            // Let's just follow UE math directly but reverse the cross product order due to handedness.

        } else if (hasVelocity && (this.spriteDirection === "up" || this.spriteDirection === "upNormal" ||
                   this.spriteDirection === "right" || this.spriteDirection === "rightNormal" ||
                   this.spriteDirection === "forward")) {

            direction.copy(velocity).normalize();
            const projTemp = tmpProjTemp;

            if (this.spriteDirection === "upNormal" || this.spriteDirection === "rightNormal") {
                const realProj = tmpRealProj.set(this.projectionNormal.x, this.projectionNormal.y, this.projectionNormal.z).normalize();
                // ProjTemp = Direction ^ RealProjectionNormal;
                projTemp.crossVectors(realProj, direction).normalize();
            } else {
                // ProjTemp = Direction ^ (Particle->Location - ViewLocation);
                camera.getWorldPosition(tmpViewLocation);
                this.parent.parent.worldToLocal(tmpViewLocation);
                const viewDir = tmpViewDir.subVectors(particle.position, tmpViewLocation);
                projTemp.crossVectors(viewDir, direction).normalize();
            }

            if (this.spriteDirection === "up" || this.spriteDirection === "upNormal") {
                up.copy(direction);
                right.copy(projTemp);
            } else if (this.spriteDirection === "right" || this.spriteDirection === "rightNormal") {
                up.copy(projTemp);
                right.copy(direction);
            } else if (this.spriteDirection === "forward") {
                const nonParallel = tmpNonParallel.set(1, 0, 0);
                if (Math.abs(direction.x) >= 0.5) nonParallel.set(0, 1, 0);
                up.crossVectors(nonParallel, direction).normalize();
                right.crossVectors(up, direction).normalize();
            }

        } else {
            // PTDU_None and PTDU_Scale
            up.copy(projUp);
            right.copy(projRight);
        }

        if (particle && particle.spin !== 0) {
            const spin = particle.spin;
            const cos = Math.cos(spin);
            const sin = Math.sin(spin);

            const origRight = tmpOrigRight.copy(right);
            const origUp = tmpOrigUp.copy(up);

            // Rotate Right/Up vectors around the Normal axis
            // In RH: NewRight = Right*cos + Up*sin; NewUp = Up*cos - Right*sin;
            right.copy(origRight).multiplyScalar(cos).add(tmpSpinScaled.copy(origUp).multiplyScalar(sin));
            up.copy(origUp).multiplyScalar(cos).sub(tmpSpinScaled.copy(origRight).multiplyScalar(sin));
        }

        // ...
        right.negate();
        up.negate();

        const normal = tmpNormal.crossVectors(right, up).normalize();

        const matrix = tmpMatrix.makeBasis(right, up, normal);
        this.quaternion.setFromRotationMatrix(matrix);
    };
}

type SpriteEmitterConfig_T = GD.EmitterConfig_T & {
    material: ParticleMaterialInitSettings_T;
    spriteDirection?: GD.SpriteDirections_T;
    projectionNormal?: [number, number, number];
};
