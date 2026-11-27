import { type Bone, Matrix4, Quaternion, Vector3 } from "three";
import type BaseActor from "../base-actor";
import type LitSkinnedMesh from "./lit-skinned-mesh";

type ClothParticle_T = {
    bone: Bone;
    rest: Vector3;
    restRotation: Quaternion;
    tangent: Vector3;
    anchor: Vector3;
    previousAnchor: Vector3;
    position: Vector3;
    velocity: Vector3;
    force: Vector3;
    localPosition: Vector3;
    rotation: Quaternion;
    pinned: boolean;
};

type ClothSpring_T = { a: ClothParticle_T; b: ClothParticle_T; length: number };

const chainLength = 6;
const springStiffness = 4;
const springDamping = 0.6;
const poseStiffness = 5;
const drag = 1.5;
const gravity = -0.2;
const integrationScale = 4;
const anchorFollow = 0.85;
const collisionDistance = 5;
const maxStep = 1 / 120;
const maxDelta = 1 / 10;
const tmpInverse = new Matrix4();
const tmpBasis = new Matrix4();
const tmpMeshRotation = new Matrix4();
const tmpRotation = new Quaternion();
const tmpRestRotation = new Quaternion();
const tmpParentInverse = new Quaternion();
const tmpDirection = new Vector3();
const tmpTangent = new Vector3();
const tmpClothX = new Vector3();
const tmpClothY = new Vector3();
const tmpClothZ = new Vector3();
const tmpVelocity = new Vector3();
const tmpNormal = new Vector3();
const tmpPawnPosition = new Vector3();
const tmpOrigin = new Vector3();

export class CloakSimulation {
    protected readonly mesh: LitSkinnedMesh;
    protected readonly arrParticles: ClothParticle_T[] = [];
    protected readonly arrSprings: ClothSpring_T[] = [];
    protected readonly resetDistance: number;
    protected attachment: Bone = null;
    protected restPitch = 0;
    protected initialized = false;

    public static create(mesh: LitSkinnedMesh): CloakSimulation {
        const skeleton = mesh.skeleton;
        if (skeleton.matchRefBone("Bone02") < 0 || skeleton.matchRefBone("Bone13") < 0) return null;

        return new CloakSimulation(mesh, skeleton.matchRefBone("Bone19") >= 0 ? 3 : 2);
    }

    protected constructor(mesh: LitSkinnedMesh, chains: number) {
        this.mesh = mesh;
        const skeleton = mesh.skeleton, root = skeleton.bones[0];

        // NCCloakSimul::Init 0x77cc16..0x77cd74 pins the first bone of each six-bone chain.
        for (let chain = 0; chain < chains; chain++) {
            for (let joint = 0; joint < chainLength; joint++) {
                const index = this.arrParticles.length;
                const name = `Bone${String(index + 2).padStart(2, "0")}`;
                const bone = skeleton.bones[skeleton.matchRefBone(name)];
                const parent = joint ? this.arrParticles[index - 1] : null;

                if (!bone || bone.parent !== (parent ? parent.bone : root))
                    throw new Error(`Cloak mesh '${mesh.name}' has an invalid chain at '${name}'.`);

                const rotation = parent ? parent.restRotation : root.quaternion;
                const rest = bone.position.clone().applyQuaternion(rotation).add(parent ? parent.rest : root.position);

                this.arrParticles.push({
                    bone, rest, restRotation: rotation.clone().multiply(bone.quaternion),
                    tangent: new Vector3(), anchor: new Vector3(), previousAnchor: new Vector3(),
                    position: new Vector3(), velocity: new Vector3(), force: new Vector3(),
                    localPosition: new Vector3(), rotation: new Quaternion(), pinned: joint === 0
                });

                if (joint) this.addSpring(index - 1, index);
                if (chain && joint) this.addSpring(index - chainLength, index);
            }
        }

        let maxDistance = 0;
        for (let i = 0; i < this.arrParticles.length; i++) {
            const particle = this.arrParticles[i];
            const next = i % chainLength < chainLength - 1 ? i + 1 : i;
            particle.tangent.subVectors(this.arrParticles[next].rest, this.arrParticles[next - 1].rest).normalize();
            maxDistance = Math.max(maxDistance, particle.rest.distanceTo(this.arrParticles[0].rest));
        }

        this.resetDistance = maxDistance;
    }

    protected addSpring(first: number, second: number): void {
        const a = this.arrParticles[first], b = this.arrParticles[second];
        this.arrSprings.push({ a, b, length: a.rest.distanceTo(b.rest) });
    }

    public reset(): void { this.initialized = false; }

    public update(pawn: BaseActor, deltaTime: number): void {
        if (deltaTime <= 0) return;

        const mesh = this.mesh, arrParticles = this.arrParticles;
        mesh.updateWorldMatrix(true, false);
        const world = mesh.matrixWorld;
        const scale = world.getMaxScaleOnAxis();
        const collar = arrParticles[0];

        const yaw = pawn.getRotationYaw() * Math.PI / 32768;
        tmpNormal.set(-Math.cos(yaw), -Math.sin(yaw), 0);
        this.updateAnchors(yaw, scale);

        if (!this.initialized || collar.anchor.distanceTo(collar.previousAnchor) > this.resetDistance * scale) {
            for (const particle of arrParticles) {
                particle.position.copy(particle.anchor);
                particle.velocity.set(0, 0, 0);
            }
            this.initialized = true;
        } else {
            tmpDirection.subVectors(collar.anchor, collar.previousAnchor).multiplyScalar(anchorFollow);
            for (const particle of arrParticles) {
                particle.position.add(tmpDirection);
                particle.previousAnchor.add(tmpDirection);
            }

            pawn.getWorldPosition(tmpPawnPosition);
            const collarDepth = tmpDirection.subVectors(collar.anchor, tmpPawnPosition).dot(tmpNormal);
            tmpOrigin.copy(tmpPawnPosition).addScaledVector(tmpNormal, Math.max(0, Math.min(collarDepth, collisionDistance * scale)));

            const duration = Math.min(deltaTime, maxDelta), steps = Math.ceil(duration / maxStep), step = duration / steps;

            for (let i = 1; i <= steps; i++) this.step(step, i / steps, deltaTime, scale);
        }

        tmpInverse.copy(world).invert();

        for (const particle of arrParticles) {
            particle.previousAnchor.copy(particle.anchor);
            particle.localPosition.copy(particle.position).applyMatrix4(tmpInverse);
        }
        tmpRotation.setFromRotationMatrix(tmpMeshRotation.extractRotation(world)).invert();
        tmpRestRotation.setFromRotationMatrix(tmpBasis).premultiply(tmpRotation);
        this.applyPose();
    }

    protected updateAnchors(yaw: number, scale: number): void {
        const mesh = this.mesh, attachment = mesh.parent.parent as Bone;

        if (this.attachment !== attachment) {
            let owner = attachment.parent;
            while ((owner as Bone).isBone) owner = owner.parent;
            const body = owner as LitSkinnedMesh;
            const skeleton = body.skeleton, index = skeleton.bones.indexOf(attachment);
            const bind = tmpBasis.copy(skeleton.boneInverses[index]).invert().premultiply(body.bindMatrixInverse).premultiply(body.matrix).multiply(mesh.matrix);

            this.restPitch = tmpDirection.setFromMatrixColumn(bind, 0).normalize().z;
            this.attachment = attachment;
        }

        // Keep the drape aligned with the pawn while the animated cape bone moves the collar.
        tmpClothX.copy(tmpNormal).multiplyScalar(Math.sqrt(Math.max(0, 1 - this.restPitch * this.restPitch)));
        tmpClothX.z = this.restPitch;
        tmpClothZ.set(Math.sin(yaw), -Math.cos(yaw), 0);
        tmpClothY.crossVectors(tmpClothZ, tmpClothX);
        tmpBasis.makeBasis(tmpClothX, tmpClothY, tmpClothZ);

        const particles = this.arrParticles;
        for (let i = 0; i < particles.length; i += chainLength) {
            const collar = particles[i];
            collar.anchor.copy(collar.rest).applyMatrix4(mesh.matrixWorld);

            for (let j = 1; j < chainLength; j++) {
                const particle = particles[i + j];
                particle.anchor.subVectors(particle.rest, collar.rest).multiplyScalar(scale).applyMatrix4(tmpBasis).add(collar.anchor);
            }
        }
    }

    protected step(dt: number, alpha: number, deltaTime: number, scale: number): void {
        for (const particle of this.arrParticles) {
            if (particle.pinned) {
                particle.position.lerpVectors(particle.previousAnchor, particle.anchor, alpha);
                particle.velocity.subVectors(particle.anchor, particle.previousAnchor).multiplyScalar(1 / deltaTime);
            } else {
                tmpDirection.lerpVectors(particle.previousAnchor, particle.anchor, alpha);
                particle.force.subVectors(tmpDirection, particle.position).multiplyScalar(poseStiffness).addScaledVector(particle.velocity, -drag);
                particle.force.z += gravity * scale;
            }
        }

        // NCCloakSimul::CalcForces 0x773af0..0x773c5e applies paired spring and damping forces.
        for (const { a, b, length } of this.arrSprings) {
            tmpDirection.subVectors(b.position, a.position);
            const distance = tmpDirection.length();
            if (distance < 1e-6) continue;

            tmpDirection.multiplyScalar(1 / distance);
            const damping = tmpVelocity.subVectors(b.velocity, a.velocity).dot(tmpDirection) * springDamping;
            const force = (distance - length * scale) * springStiffness + damping;
            if (!a.pinned) a.force.addScaledVector(tmpDirection, force);
            b.force.addScaledVector(tmpDirection, -force);
        }

        for (const particle of this.arrParticles) {
            if (particle.pinned) continue;

            particle.velocity.addScaledVector(particle.force, integrationScale * dt);
            particle.position.addScaledVector(particle.velocity, dt);
        }

        for (let pass = 0; pass < 3; pass++) {
            for (const { a, b, length } of this.arrSprings) {
                tmpDirection.subVectors(b.position, a.position);
                const distance = tmpDirection.length(), limit = length * scale * 1.15;
                if (distance <= limit) continue;

                const correction = 1 - limit / distance;
                if (!a.pinned) a.position.addScaledVector(tmpDirection, correction * 0.5);
                b.position.addScaledVector(tmpDirection, -correction * (a.pinned ? 1 : 0.5));
            }
            for (const particle of this.arrParticles) {
                if (particle.pinned) continue;

                const depth = tmpDirection.subVectors(particle.position, tmpOrigin).dot(tmpNormal);
                if (depth >= 0) continue;

                particle.position.addScaledVector(tmpNormal, -depth);
                particle.velocity.addScaledVector(tmpNormal, -Math.min(0, particle.velocity.dot(tmpNormal)));
            }
        }
    }

    protected applyPose(): void {
        const particles = this.arrParticles;
        for (let i = 0; i < particles.length; i++) {
            const particle = particles[i];
            if (particle.pinned) {
                particle.rotation.copy(particle.restRotation);
                continue;
            }

            const next = i % chainLength < chainLength - 1 ? i + 1 : i;
            const parent = particles[i - 1];

            tmpDirection.subVectors(particles[next].localPosition, particles[next - 1].localPosition).normalize();
            tmpTangent.copy(particle.tangent).applyQuaternion(tmpRestRotation);
            tmpRotation.setFromUnitVectors(tmpTangent, tmpDirection);
            particle.rotation.copy(particle.restRotation).premultiply(tmpRestRotation).premultiply(tmpRotation);

            tmpParentInverse.copy(parent.rotation).invert();
            particle.bone.position.subVectors(particle.localPosition, parent.localPosition).applyQuaternion(tmpParentInverse);
            particle.bone.quaternion.multiplyQuaternions(tmpParentInverse, particle.rotation);
        }
    }
}

export default CloakSimulation;
