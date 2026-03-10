import ParticleMaterial from "@client/materials/particle-material";
import { Mesh, PlaneGeometry, Vector3 } from "three";
import * as THREE from "three";
import BaseEmitter from "./base-emitter";

const geometry = new PlaneGeometry(1, 1);

class SpriteEmitter extends BaseEmitter {

    protected material: ParticleMaterialInitSettings_T;
    public spriteDirection: string = "camera";
    public projectionNormal: Vector3 = new Vector3(0, 0, 1);

    // public constructor(props: any) {
    //     debugger;
    //     super(props);
    // }

    protected initSettings(config: SpriteEmitterConfig_T): void {
        this.isSpriteEmitter = true;
        this.material = config.material;
        this.spriteDirection = config.spriteDirection || "camera";
        
        if (config.projectionNormal) {
            this.projectionNormal.fromArray(config.projectionNormal);
        }
    }

    protected initParticleMesh() { 
        const mesh = new ParticleMesh(new ParticleMaterial(this.material)); 
        mesh.spriteDirection = this.spriteDirection;
        mesh.projectionNormal = this.projectionNormal;
        return mesh;
    }
}

export default SpriteEmitter;
export { SpriteEmitter };

class ParticleMesh extends Mesh {
    public spriteDirection: string = "camera";
    public projectionNormal: Vector3 = new Vector3(0, 0, 1);

    constructor(material: THREE.Material) {
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
        
        const projUp = camera.up.clone().normalize();
        const projFront = new Vector3(0, 0, 1).applyQuaternion(camera.quaternion).normalize();
        
        // In Left-Handed UE: ProjRight = Up x Front
        // In Right-Handed ThreeJS: Right = Front x Up
        const projRight = new Vector3().crossVectors(projFront, projUp).normalize();
        
        // Ensure projUp is exactly orthogonal
        projUp.crossVectors(projRight, projFront).normalize();

        const direction = new Vector3();
        let up = new Vector3();
        let right = new Vector3();
        
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
            const nonParallel = Math.abs(direction.x) < 0.5 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
            
            // Note: UE uses Left-handed Cross Product (A ^ B)
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
            let projTemp = new Vector3();

            if (this.spriteDirection === "upNormal" || this.spriteDirection === "rightNormal") {
                const realProj = new Vector3(this.projectionNormal.x, this.projectionNormal.y, this.projectionNormal.z).normalize();
                // ProjTemp = Direction ^ RealProjectionNormal;
                projTemp.crossVectors(realProj, direction).normalize();
            } else {
                // ProjTemp = Direction ^ (Particle->Location - ViewLocation);
                const viewDir = new Vector3().subVectors(particle.position, camera.position);
                projTemp.crossVectors(viewDir, direction).normalize();
            }

            if (this.spriteDirection === "up" || this.spriteDirection === "upNormal") {
                up.copy(direction);
                right.copy(projTemp);
            } else if (this.spriteDirection === "right" || this.spriteDirection === "rightNormal") {
                up.copy(projTemp);
                right.copy(direction);
            } else if (this.spriteDirection === "forward") {
                const nonParallel = Math.abs(direction.x) < 0.5 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
                up.crossVectors(nonParallel, direction).normalize();
                right.crossVectors(up, direction).normalize();
            }
             
        } else {
            // PTDU_None and PTDU_Scale
            up.copy(projUp);
            right.copy(projRight);
        }

        // Apply Roll (Spin)
        if (particle && particle.spin !== 0) {
            const spin = particle.spin;
            const cos = Math.cos(spin);
            const sin = Math.sin(spin);
            
            const origRight = right.clone();
            const origUp = up.clone();
            
            // Rotate Right/Up vectors around the Normal axis
            // In RH: NewRight = Right*cos + Up*sin; NewUp = Up*cos - Right*sin;
            right.copy(origRight).multiplyScalar(cos).add(origUp.clone().multiplyScalar(sin));
            up.copy(origUp).multiplyScalar(cos).sub(origRight.clone().multiplyScalar(sin));
        }

        // We negate the projection front to point *towards* the camera (Standard PlaneGeometry face)
        // ...
        right.negate();
        up.negate();

        // Ensure we supply a pure 1-determinant rotation matrix by computing normal exactly matching right/up cross
        const normal = new Vector3().crossVectors(right, up).normalize();

        const matrix = new THREE.Matrix4().makeBasis(right, up, normal);
        this.quaternion.setFromRotationMatrix(matrix);
    };
}

type SpriteEmitterConfig_T = GD.EmitterConfig_T & {
    material: ParticleMaterialInitSettings_T;
    spriteDirection?: string;
    projectionNormal?: [number, number, number];
};