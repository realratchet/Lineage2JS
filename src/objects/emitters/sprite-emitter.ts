import ParticleMaterial, { AnimatedParticleMaterial, type ParticleMaterialInitSettings_T } from "../../materials/particle-material/particle-material";
import InstancedParticleMaterial from "../../materials/particle-material/instanced-particle-material";
import { Mesh, PlaneGeometry, Vector3, Matrix4, type BufferGeometry, type WebGLRenderer, type Scene, type Camera } from "three";
import BaseEmitter from "./base-emitter";
import InstancedSpriteMesh from "./instanced-sprite-mesh";
import type { SpriteDirections_T, EmitterConfig_T } from "@l2js/engine/contracts/emitter";

const geometry = new PlaneGeometry(2, 2);

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
const tmpMatrix = new Matrix4();

export class SpriteEmitter extends BaseEmitter {
    public spriteDirection: SpriteDirections_T;
    public projectionNormal: Vector3;

    public constructor(config: SpriteEmitterConfig_T) {
        super(config);
        this.finishConstruction(config);
    }

    protected initSettings(config: SpriteEmitterConfig_T): void {
        this.isSpriteEmitter = true;
        this.material = config.material;
        this.spriteDirection = config.spriteDirection || "camera";
        // USpriteEmitter::Initialize 0x106a9e99 forces UniformSize for PTDU_None.
        if (this.spriteDirection === "camera") this.isUniformScale = true;
        this.projectionNormal = new Vector3().fromArray(config.projectionNormal ?? [0, 0, 1]);

        this.isInstancedRendering = this.material !== null && this.material.type !== "sprite" && (this.spriteDirection === "camera" || this.spriteDirection === "normal" || this.spriteDirection === "up");
    }

    protected initParticleMesh() {
        // USpriteEmitter::RenderParticles 0x97bf12: null Texture skips drawing, not simulation.
        if (this.material === null) return null;

        const usesSubdivision = this.texSubdivU > 1 || this.texSubdivV > 1;
        const settings = { ...this.material, usesSubdivision, blendBetweenSubdivisions: this.isBlendBetweenSubdivisions && !this.isUsingRandomSubdiv, rangeFade: this.rangeFade };
        const mesh = new ParticleMesh(this.material.type === "sprite" ? new AnimatedParticleMaterial(settings) : new ParticleMaterial(settings));
        mesh.spriteDirection = this.spriteDirection;
        mesh.projectionNormal = this.projectionNormal;
        return mesh;
    }

    protected createInstancedMesh(capacity: number): InstancedSpriteMesh {
        const usesSubdivision = this.texSubdivU > 1 || this.texSubdivV > 1;
        return new InstancedSpriteMesh(new InstancedParticleMaterial({
            ...this.material,
            usesSubdivision,
            blendBetweenSubdivisions: this.isBlendBetweenSubdivisions && !this.isUsingRandomSubdiv,
            spriteDirection: this.spriteDirection,
            projectionNormal: this.projectionNormal,
            rangeFade: this.rangeFade
        }), capacity);
    }
}

export default SpriteEmitter;

class ParticleMesh extends Mesh<BufferGeometry, ParticleMaterial | AnimatedParticleMaterial> {
    public spriteDirection: SpriteDirections_T = "camera";
    public projectionNormal: Vector3 = new Vector3(0, 0, 1);
    public particleRef: SpriteParticle_T = null;

    public constructor(material: ParticleMaterial | AnimatedParticleMaterial) {
        super(geometry, material);
    }

    public onBeforeRender = (_renderer: WebGLRenderer, _scene: Scene, camera: Camera) => {

        // FVector ProjUp        = SceneNode->Deproject(FPlane(0,-1000,0,1)) - ProjBase;
        // FVector ProjRight     = SceneNode->Deproject(FPlane(1000,0,0,1)) - ProjBase;
        // FVector ProjFront     = ProjRight ^ ProjUp;

        const projUp = tmpProjUp.copy(camera.up).normalize();
        const projFront = tmpProjFront.set(0, 0, 1).applyQuaternion(camera.quaternion).normalize();

        const projRight = tmpProjRight.crossVectors(projFront, projUp).normalize();

        projUp.crossVectors(projRight, projFront).normalize();

        const direction = tmpDirection;
        const up = tmpUp;
        const right = tmpRight;

        const particle = this.particleRef;

        if (this.spriteDirection === "normal") {
            direction.set(this.projectionNormal.x, this.projectionNormal.y, this.projectionNormal.z).normalize();

            // Up    = (Direction ^ Direction.GetNonParallel()) * Size.Y;
            // Right = (Direction ^ Up).SafeNormal() * Size.X;
            const nonParallel = tmpNonParallel.set(1, 0, 0);
            if (Math.abs(direction.x) >= 0.5) nonParallel.set(0, 1, 0);

            up.crossVectors(nonParallel, direction).normalize();
            right.crossVectors(up, direction).normalize();

        } else if (particle && (this.spriteDirection === "up" || this.spriteDirection === "upNormal" ||
                   this.spriteDirection === "right" || this.spriteDirection === "rightNormal" ||
                   this.spriteDirection === "forward")) {

            // Engine.dll FillVertexBuffer 0x97a72d: Location - OldLocation.
            direction.subVectors(particle.position, particle.oldLocation).normalize();
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
            // Engine.dll FillVertexBuffer 0x97a4ad..0x97a5a3 transforms camera axes into emitter space.
            tmpMatrix.extractRotation(this.parent.matrixWorld).invert();
            up.copy(projUp).transformDirection(tmpMatrix);
            right.copy(projRight).transformDirection(tmpMatrix);
        }

        if (particle && particle.spin !== 0) {
            const spin = particle.spin;
            const cos = Math.cos(spin);
            const sin = Math.sin(spin);

            const origRight = tmpOrigRight.copy(right);
            const origUp = tmpOrigUp.copy(up);

            right.copy(origRight).multiplyScalar(cos).add(tmpSpinScaled.copy(origUp).multiplyScalar(sin));
            up.copy(origUp).multiplyScalar(cos).sub(tmpSpinScaled.copy(origRight).multiplyScalar(sin));
        }

        right.negate();
        up.negate();

        const normal = tmpNormal.crossVectors(right, up).normalize();

        this.matrix.copy(tmpMatrix.makeBasis(right, up, normal)).scale(this.scale).setPosition(this.position);
        this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    };
}

type SpriteEmitterConfig_T = EmitterConfig_T & {
    material: ParticleMaterialInitSettings_T | null;
    spriteDirection?: SpriteDirections_T;
    projectionNormal?: [number, number, number];
};

type SpriteParticle_T = { position: Vector3, oldLocation: Readonly<Vector3>, spin: number };
