import { Bone, Matrix4, Object3D, Quaternion, SkinnedMesh, Vector3 } from "three";

const tmpMatrix = new Matrix4();
const tmpParentMatrix = new Matrix4();
const tmpDeltaMatrix = new Matrix4();
const tmpDelta = new Vector3();
const tmpDirection = new Vector3();
const tmpForce = new Vector3();
const tmpNormal = new Vector3();
const tmpPoint = new Vector3();
const tmpBoneQuaternion = new Quaternion();
const tmpParentQuaternion = new Quaternion();
const tmpScale = new Vector3();
const arrParents: Object3D[] = [];

const BEND_STIFFNESS = 2.4; // NCBoneSimul::Init2 0x77e8da.
const BEND_DAMPING = 0.8; // NCBoneSimul::Init2 0x77e8e4.
const INTEGRATION_SCALE = 4; // NCBoneSimul::EulerIntegrate 0x76b380.
const SIMULATION_STEP = 0.1; // NCBoneSimul::NCBoneSimul 0x76d048.
const SIMULATION_TIME_SCALE = 15; // NCBoneSimul::Simulate caller 0x1068bde5.
const STABILITY_LENGTH_SCALE = 6; // NCBoneSimul::CheckBalsan 0x76bf10.
const COLLISION_RESOLVE_LIMIT = 100; // NCBoneSimul::Simulate 0x7745a0.
const USER_FORCE_DELTA_MIN = 0.005; // NCBoneSimul::CalcForces 0x76d34d.
const USER_FORCE_FRAME_SCALE = 40; // NCBoneSimul::CalcForces 0x76d35d.
const USER_FORCE_FRAME_LIMIT = 5; // NCBoneSimul::CalcForces 0x76d371.
const USER_FORCE_IDLE_SCALE = 0.04; // NCBoneSimul::CalcForces 0x76d310.
const USER_FORCE_MOVING_SCALE = 0.1; // NCBoneSimul::CalcForces 0x76d333.
const USER_FORCE_VECTOR_LIMIT = 0.9; // NCBoneSimul::CalcForces 0x76d403.
const TIP_FORCE_THRESHOLD = 0.8; // NCBoneSimul::CalcForces 0x76d88d.
const TIP_FORCE_SCALE = 1.3; // NCBoneSimul::CalcForces 0x76d8ac.

type Topology_T = {
    prefix: string;
    first: number;
    count: number;
    rows: number;
    columns: number;
    pinned: number[];
    shearSprings: boolean;
    bendSprings: boolean;
};

type Particle_T = {
    position: Vector3;
    velocity: Vector3;
    force: Vector3;
    userForce: Vector3;
    inverseMass: number;
};

type Spring_T = {
    first: number;
    second: number;
    restLength: number;
    stiffness: number;
    damping: number;
    type: number;
};

type CollisionPlane_T = {
    bone: Bone;
    distance: number;
    normal: Vector3;
    point: Vector3;
};

type CollisionSphere_T = {
    bone: Bone;
    offset: Vector3;
    center: Vector3;
    radius: number;
};

const topologies = new Map<number, Topology_T>([
    [2, { prefix: "hair", first: 2, count: 12, rows: 3, columns: 4, pinned: [0, 4, 8], shearSprings: false, bendSprings: false }],
    [5, { prefix: "hair", first: 14, count: 3, rows: 1, columns: 3, pinned: [0], shearSprings: true, bendSprings: true }],
    [6, { prefix: "hair", first: 2, count: 4, rows: 1, columns: 4, pinned: [0], shearSprings: true, bendSprings: true }],
    [7, { prefix: "hair", first: 2, count: 12, rows: 3, columns: 4, pinned: [0, 4, 8], shearSprings: true, bendSprings: true }],
    [9, { prefix: "bone", first: 2, count: 18, rows: 6, columns: 3, pinned: [0, 6, 12], shearSprings: true, bendSprings: true }]
]);

function normalizeBoneName(name: string): string { return name.replaceAll(" ", "_").toLowerCase(); }

function getObjectWorldMatrix(object: Object3D, target: Matrix4): Matrix4 {
    arrParents.length = 0;

    while (object) {
        arrParents.push(object);
        object = object.parent;
    }

    target.identity();

    for (let i = arrParents.length - 1; i >= 0; i--) {
        const parent = arrParents[i];

        parent.updateMatrix();
        target.multiply(parent.matrix);
    }

    return target;
}

function findBone(parts: SkinnedMesh[], name: string): Bone {
    const normalized = normalizeBoneName(name);

    for (const part of parts) {
        const bone = part.skeleton.bones.find(bone => normalizeBoneName(bone.name) === normalized);

        if (bone) return bone;
    }

    throw new Error(`Character assembly has no '${name}' bone.`);
}

function makeParticles(count: number): Particle_T[] {
    const particles = new Array<Particle_T>(count);

    for (let i = 0; i < count; i++) particles[i] = { position: new Vector3(), velocity: new Vector3(), force: new Vector3(), userForce: new Vector3(), inverseMass: 1 };

    return particles;
}

class DynamicHairSimulation {
    public readonly mesh: SkinnedMesh;
    public readonly info: GD.IDynamicHairDecodeInfo;

    protected topology: Topology_T = null;
    protected bones: Bone[] = null;
    protected basePositions: Vector3[] = null;
    protected baseQuaternions: Quaternion[] = null;
    protected bonePositions: Vector3[] = null;
    protected boneQuaternions: Quaternion[] = null;
    protected current: Particle_T[] = null;
    protected destination: Particle_T[] = null;
    protected springs: Spring_T[] = null;
    protected planes: CollisionPlane_T[] = null;
    protected spheres: CollisionSphere_T[] = null;
    protected actionNames: Set<string> = null;
    protected actionSpheres: CollisionSphere_T[] = null;
    protected headBone: Bone = null;
    protected readonly previousSimulationMatrix = new Matrix4();
    protected readonly previousSimulationPosition = new Vector3();
    protected readonly previousHeadPosition = new Vector3();
    protected readonly headMovement = new Vector3();
    protected userForceScale = 0;
    protected animationName: string = null;
    protected isActionCollision = false;
    protected contactNormals: Vector3[] = null;
    protected contacts: Uint8Array = null;
    protected isApplied = false;
    protected needsReset = true;

    public constructor(mesh: SkinnedMesh, info: GD.IDynamicHairDecodeInfo) {
        this.mesh = mesh;
        this.info = info;
    }

    public initialize(parts: SkinnedMesh[]): void {
        const topology = topologies.get(this.info.type);

        if (!topology) throw new Error(`Skeletal mesh '${this.mesh.name}' uses unsupported bone simulation '${this.info.type}'.`);

        this.topology = topology;
        this.bones = new Array<Bone>(topology.count);
        this.basePositions = new Array<Vector3>(topology.count);
        this.baseQuaternions = new Array<Quaternion>(topology.count);
        this.bonePositions = new Array<Vector3>(topology.count);
        this.boneQuaternions = new Array<Quaternion>(topology.count);
        this.current = makeParticles(topology.count);
        this.destination = makeParticles(topology.count);
        this.contactNormals = new Array<Vector3>(topology.count);
        this.contacts = new Uint8Array(topology.count);

        for (let i = 0; i < topology.count; i++) {
            const name = `${topology.prefix}${String(topology.first + i).padStart(2, "0")}`;
            const bone = this.mesh.skeleton.bones.find(bone => normalizeBoneName(bone.name) === name);

            if (!bone) throw new Error(`Skeletal mesh '${this.mesh.name}' bone simulation '${this.info.type}' has no '${name}' bone.`);

            this.bones[i] = bone;
            this.basePositions[i] = bone.position.clone();
            this.baseQuaternions[i] = bone.quaternion.clone();
            this.bonePositions[i] = new Vector3();
            this.boneQuaternions[i] = new Quaternion();
            this.contactNormals[i] = new Vector3();
        }

        for (const index of topology.pinned) {
            this.current[index].inverseMass = 0;
            this.destination[index].inverseMass = 0;
        }

        this.planes = this.info.config.planes.map(info => ({ bone: findBone(parts, info.bone), distance: info.distance, normal: new Vector3(), point: new Vector3() }));
        this.spheres = this.info.config.spheres.map(info => ({ bone: findBone(parts, info.bone), offset: new Vector3().fromArray(info.offset), center: new Vector3(), radius: info.radius }));
        this.actionNames = new Set(this.info.config.actions.map(info => info.name.toLowerCase()));
        this.actionSpheres = this.info.config.sphereIndices.map(index => this.spheres[index]);
        this.headBone = this.spheres.length > 0 ? this.spheres[0].bone : findBone(parts, "Bip01 head");

        this.updateBonePose();
        this.resetParticles();
        this.buildSprings();
        this.updateCollisionObjects();
        this.resetMotion();
    }

    public restorePose(): void {
        if (!this.isApplied) return;

        for (let i = 0, len = this.bones.length; i < len; i++) {
            this.bones[i].position.copy(this.basePositions[i]);
            this.bones[i].quaternion.copy(this.baseQuaternions[i]);
        }

        this.isApplied = false;
    }

    public reset(): void { this.needsReset = true; }

    public update(deltaTime: number, animationName: string, isMoving: boolean): void {
        if (!this.bones || deltaTime < 0 || !Number.isFinite(deltaTime)) throw new Error(`Invalid dynamic hair delta '${deltaTime}'.`);

        this.updateAction(animationName);

        for (let i = 0, len = this.bones.length; i < len; i++) {
            this.basePositions[i].copy(this.bones[i].position);
            this.baseQuaternions[i].copy(this.bones[i].quaternion);
        }

        this.updateBonePose();

        if (this.needsReset) {
            this.resetParticles();
            this.resetMotion();
            this.needsReset = false;
        } else this.updateMotion(deltaTime, isMoving);

        this.updateCollisionObjects();

        if (deltaTime > 0) {
            const simulationTime = deltaTime * this.info.config.safeFactor * SIMULATION_TIME_SCALE;
            let currentTime = SIMULATION_STEP;

            do {
                this.simulate(SIMULATION_STEP);
                currentTime += SIMULATION_STEP;
            } while (simulationTime > currentTime);
        }

        this.applyPose();
    }

    protected updateAction(animationName: string): void {
        if (animationName === this.animationName) return;

        this.animationName = animationName;
        this.isActionCollision = animationName !== null && this.actionNames.has(animationName.toLowerCase());
    }

    protected updateBonePose(): void {
        for (let i = 0, len = this.bones.length; i < len; i++) {
            getObjectWorldMatrix(this.bones[i], tmpMatrix).decompose(this.bonePositions[i], this.boneQuaternions[i], tmpScale);
        }
    }

    protected resetParticles(): void {
        for (let i = 0, len = this.bones.length; i < len; i++) {
            this.current[i].position.copy(this.bonePositions[i]);
            this.current[i].velocity.set(0, 0, 0);
            this.current[i].force.set(0, 0, 0);
            this.current[i].userForce.set(0, 0, 0);
            this.destination[i].position.copy(this.bonePositions[i]);
            this.destination[i].velocity.set(0, 0, 0);
            this.destination[i].force.set(0, 0, 0);
            this.destination[i].userForce.set(0, 0, 0);
        }
    }

    protected resetMotion(): void {
        getObjectWorldMatrix(this.bones[0].parent, this.previousSimulationMatrix);
        this.previousSimulationPosition.setFromMatrixPosition(this.previousSimulationMatrix);
        getObjectWorldMatrix(this.headBone, tmpMatrix);
        this.previousHeadPosition.setFromMatrixPosition(tmpMatrix);
        this.headMovement.set(0, 0, 0);
        this.userForceScale = 0;
    }

    protected updateMotion(deltaTime: number, isMoving: boolean): void {
        getObjectWorldMatrix(this.bones[0].parent, tmpMatrix);
        tmpPoint.setFromMatrixPosition(tmpMatrix);
        tmpDeltaMatrix.multiplyMatrices(tmpMatrix, tmpParentMatrix.copy(this.previousSimulationMatrix).invert());

        for (const particle of this.current) {
            particle.userForce.copy(particle.position).sub(this.previousSimulationPosition);
            particle.position.applyMatrix4(tmpDeltaMatrix);
            tmpDirection.copy(particle.position).sub(tmpPoint);
            particle.userForce.multiplyScalar(-1).add(tmpDirection);
            this.limitUserForce(particle.userForce);
        }

        this.previousSimulationMatrix.copy(tmpMatrix);
        this.previousSimulationPosition.copy(tmpPoint);

        getObjectWorldMatrix(this.headBone, tmpMatrix);
        tmpPoint.setFromMatrixPosition(tmpMatrix);
        this.headMovement.subVectors(tmpPoint, this.previousHeadPosition);
        this.previousHeadPosition.copy(tmpPoint);
        this.limitUserForce(this.headMovement);

        this.userForceScale = Math.min(Math.max(deltaTime, USER_FORCE_DELTA_MIN) * USER_FORCE_FRAME_SCALE, USER_FORCE_FRAME_LIMIT) * (isMoving ? USER_FORCE_MOVING_SCALE : USER_FORCE_IDLE_SCALE);
    }

    protected limitUserForce(force: Vector3): void {
        const max = Math.max(Math.abs(force.x), Math.abs(force.y), Math.abs(force.z));

        if (max >= 1.5) force.multiplyScalar(USER_FORCE_VECTOR_LIMIT / max);
    }

    protected buildSprings(): void {
        const topology = this.topology;
        const config = this.info.config;

        this.springs = [];

        for (let row = 0; row < topology.rows; row++)
            for (let column = 0; column < topology.columns - 1; column++)
                this.addSpring(row * topology.columns + column, row * topology.columns + column + 1, config.structuralStiffness, config.structuralDamping, 1);

        for (let column = 0; column < topology.columns; column++)
            for (let row = 0; row < topology.rows - 1; row++)
                this.addSpring(row * topology.columns + column, (row + 1) * topology.columns + column, config.structuralStiffness, config.structuralDamping, 1);

        if (topology.shearSprings)
            for (let row = 0; row < topology.rows - 1; row++)
                for (let column = 0; column < topology.columns - 1; column++) {
                    this.addSpring(row * topology.columns + column, (row + 1) * topology.columns + column + 1, config.shearStiffness, config.shearDamping, 2);
                    this.addSpring((row + 1) * topology.columns + column, row * topology.columns + column + 1, config.shearStiffness, config.shearDamping, 2);
                }

        if (topology.bendSprings) {
            for (let row = 0; row < topology.rows; row++)
                for (let column = 0; column < topology.columns - 2; column++)
                    this.addSpring(row * topology.columns + column, row * topology.columns + column + 2, BEND_STIFFNESS, BEND_DAMPING, 3);

            for (let column = 0; column < topology.columns; column++)
                for (let row = 0; row < topology.rows - 2; row++)
                    this.addSpring(row * topology.columns + column, (row + 2) * topology.columns + column, BEND_STIFFNESS, BEND_DAMPING, 3);
        }
    }

    protected addSpring(first: number, second: number, stiffness: number, damping: number, type: number): void {
        const restLength = this.current[first].position.distanceTo(this.current[second].position);

        if (restLength <= 0) throw new Error(`Dynamic hair '${this.mesh.name}' spring '${first}-${second}' has no length.`);

        this.springs.push({ first, second, restLength, stiffness, damping, type });
    }

    protected calculateForces(): void {
        const config = this.info.config;

        for (let i = 0, len = this.current.length; i < len; i++) {
            const particle = this.current[i];

            particle.force.copy(tmpForce.fromArray(config.gravity));

            if (particle.inverseMass === 0) particle.force.set(0, 0, 0);
            else {
                particle.force.addScaledVector(particle.velocity, -config.velocityDamping);
                particle.force.addScaledVector(this.headMovement, -this.userForceScale);
                particle.force.addScaledVector(particle.userForce, this.userForceScale);

                if (i === 3 || i === 7 || i === 11) {
                    const impulse = Math.random() * 2 - 1;

                    if (impulse > TIP_FORCE_THRESHOLD) particle.force.addScaledVector(this.planes[0].normal, impulse * TIP_FORCE_SCALE);
                }
            }
        }

        for (const spring of this.springs) {
            const first = this.current[spring.first];
            const second = this.current[spring.second];

            tmpDelta.subVectors(second.position, first.position);

            const length = tmpDelta.length();

            if (length === 0) continue;

            const magnitude = -(spring.damping * tmpDirection.subVectors(second.velocity, first.velocity).dot(tmpDelta) / length + spring.stiffness * (length - spring.restLength));

            tmpForce.copy(tmpDelta).multiplyScalar(magnitude / length);
            first.force.sub(tmpForce);
            second.force.add(tmpForce);
        }

        // TODO: Retail action-force paths still need a live trace.
    }

    protected integrate(deltaTime: number): void {
        for (let i = 0, len = this.current.length; i < len; i++) {
            const source = this.current[i];
            const target = this.destination[i];

            if (source.inverseMass === 0) {
                target.position.copy(source.position);
                target.velocity.set(0, 0, 0);
                target.userForce.copy(source.userForce);
                continue;
            }

            target.velocity.copy(source.velocity).addScaledVector(source.force, deltaTime * source.inverseMass * INTEGRATION_SCALE);
            target.position.copy(source.position).addScaledVector(source.velocity, deltaTime);
            target.userForce.copy(source.userForce);
        }
    }

    protected isStable(): boolean {
        for (const spring of this.springs)
            if (this.destination[spring.first].position.distanceTo(this.destination[spring.second].position) >= spring.restLength * STABILITY_LENGTH_SCALE) return false;

        for (const particle of this.destination)
            if (!Number.isFinite(particle.position.x + particle.position.y + particle.position.z + particle.velocity.x + particle.velocity.y + particle.velocity.z)) return false;

        return true;
    }

    protected updateCollisionObjects(): void {
        for (const plane of this.planes) {
            getObjectWorldMatrix(plane.bone, tmpMatrix);
            tmpNormal.set(0, 1, 0).transformDirection(tmpMatrix);
            tmpPoint.setFromMatrixPosition(tmpMatrix).addScaledVector(tmpNormal, plane.distance);

            plane.normal.copy(tmpNormal);
            plane.point.copy(tmpPoint);
        }

        for (const sphere of this.spheres) {
            getObjectWorldMatrix(sphere.bone, tmpMatrix);
            sphere.center.copy(sphere.offset).applyMatrix4(tmpMatrix);
        }
    }

    protected checkCollisions(): number {
        let result = 0;

        this.contacts.fill(0);

        for (let i = 0, len = this.destination.length; i < len; i++) {
            if (this.destination[i].inverseMass === 0) continue;
            if (i % this.topology.columns < this.topology.columns - 2) continue;

            const particle = this.destination[i];

            if (!this.isActionCollision) {
                for (const plane of this.planes) {
                    const distance = tmpDelta.subVectors(particle.position, plane.point).dot(plane.normal);

                    if (distance < -0.5) {
                        particle.position.addScaledVector(plane.normal, -(distance + 0.1));
                        return 1;
                    }

                    if (distance < 0.5 && particle.velocity.dot(plane.normal) < 0) {
                        result = 2;
                        this.contacts[i] = 1;
                        this.contactNormals[i].copy(plane.normal);
                    }
                }
            } else {
                for (const sphere of this.actionSpheres) {
                    const radiusSq = sphere.radius * sphere.radius;
                    const distanceSq = tmpDelta.subVectors(particle.position, sphere.center).lengthSq();
                    const difference = distanceSq - radiusSq;

                    if (difference < -0.5) return 1;
                    if (difference >= 0.5) continue;

                    const distance = Math.sqrt(distanceSq);

                    if (distance > 0) this.contactNormals[i].copy(tmpDelta).multiplyScalar(1 / distance);
                    else this.contactNormals[i].set(0, 0, 1);

                    if (particle.velocity.dot(this.contactNormals[i]) < 0) {
                        result = 2;
                        this.contacts[i] = 1;
                    }
                }
            }
        }

        return result;
    }

    protected resolveCollisions(): void {
        const response = this.info.config.collisionResponse;

        for (let i = 0, len = this.destination.length; i < len; i++) {
            if (this.contacts[i] === 0) continue;

            const particle = this.destination[i];
            const normal = this.contactNormals[i];
            const velocity = particle.velocity.dot(normal);

            if (velocity < 0) particle.velocity.addScaledVector(normal, -(1 + response) * velocity);
        }
    }

    protected simulate(deltaTime: number): void {
        let currentTime = 0;
        let targetTime = deltaTime;

        while (currentTime < deltaTime) {
            this.calculateForces();
            this.integrate(targetTime - currentTime);

            if (!this.isStable()) {
                this.resetParticles();
                return;
            }

            let collision = this.checkCollisions();

            if (collision === 1) {
                const current = this.current;

                this.current = this.destination;
                this.destination = current;
                currentTime = (currentTime + deltaTime) * 0.5;
                targetTime = deltaTime;
            } else {
                let iteration = 0;

                if (collision === 2)
                    do {
                        this.resolveCollisions();
                        collision = this.checkCollisions();
                    } while (collision === 2 && ++iteration < COLLISION_RESOLVE_LIMIT);

                const current = this.current;

                this.current = this.destination;
                this.destination = current;
                currentTime = targetTime;
                targetTime = deltaTime;
            }
        }
    }

    protected applyPose(): void {
        for (let i = 0, len = this.bones.length; i < len; i++) {
            if (i % this.topology.columns === this.topology.columns - 1) continue;

            getObjectWorldMatrix(this.bones[i].parent, tmpParentMatrix).decompose(tmpPoint, tmpParentQuaternion, tmpScale);
            const outputBase = i % this.topology.columns === 0 ? tmpParentQuaternion : this.boneQuaternions[i];

            tmpDirection.subVectors(this.current[i + 1].position, this.current[i].position).applyQuaternion(tmpBoneQuaternion.copy(outputBase).invert());

            if (tmpDirection.lengthSq() === 0) continue;

            tmpDirection.normalize();

            const yaw = Math.atan2(tmpDirection.y, tmpDirection.x) * 0.5;
            const pitch = Math.atan2(tmpDirection.z, Math.hypot(tmpDirection.x, tmpDirection.y)) * 0.5;
            const sinYaw = Math.sin(yaw);
            const cosYaw = Math.cos(yaw);
            const sinPitch = Math.sin(pitch);
            const cosPitch = Math.cos(pitch);

            tmpBoneQuaternion.set(-cosYaw * sinPitch, -sinYaw * sinPitch, cosYaw * cosPitch, -sinYaw * cosPitch).premultiply(outputBase);
            this.bones[i].position.copy(this.current[i].position).applyMatrix4(tmpParentMatrix.invert());
            this.bones[i].quaternion.copy(tmpParentQuaternion.invert()).multiply(tmpBoneQuaternion);
        }

        this.isApplied = true;
    }
}

export default DynamicHairSimulation;
export { DynamicHairSimulation };
