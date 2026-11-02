import { BufferAttribute, BufferGeometry, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import ParticleMaterial, { AnimatedParticleMaterial, type ParticleMaterialInitSettings_T } from "../../materials/particle-material/particle-material";
import BaseEmitter, { EParticleFlags_T } from "./base-emitter";
import { getPawnRotation } from "../../utils/rotator";
import type { EmitterConfig_T } from "@l2js/engine/contracts/emitter";
import type BaseActor from "../../base-actor";
import type AnimationComponent from "../components/animation-component";

type RibbonSettings_T = {
    sampleRate: number, decayRate: number, numPoints: number, accDrop: "none" | "byPoint" | "byTime" | "byTimeDual", pointsDropRate: number, thresholdTime: number, minPoints: number, thresholdTime2: number,
    width: number, pointAxis: "ownerX" | "ownerY" | "ownerZ" | "boneNormal" | "startBoneDirection" | "axisNormal", axisNormal: number[], minSampleDist: number, minSampleDot: number, pointOriginOffset: number,
    textureUScale: number, textureVScale: number, numSheets: number, sheetScale: number[], startBoneOffset: number[], endBoneOffset: number[], boneNameStart: string, boneNameEnd: string,
    useInterpolation: boolean, controlPoints: number, scaleRatio: number, samplePoints: boolean, decayPoints: boolean, decayPointsWhenStopped: boolean, syncDecayWhenKilled: boolean, lengthBasedTextureU: boolean, useSheetScale: boolean, useBones: boolean, useBoneDistance: boolean
};
type RibbonConfig_T = EmitterConfig_T & { material: ParticleMaterialInitSettings_T, ribbon: RibbonSettings_T };

const tmpStart = new Vector3(), tmpEnd = new Vector3(), tmpDirection = new Vector3(), tmpOffset = new Vector3(), tmpOrigin = new Vector3();
const tmpBoneMatrix = new Matrix4(), tmpBoneRotation = new Matrix4(), tmpInverseFrame = new Matrix4();
const tmpFrameRotation = new Quaternion();
const tmpPointA = new Float32Array(13), tmpPointB = new Float32Array(13);

export class RibbonEmitter extends BaseEmitter {
    protected ribbon: RibbonSettings_T;
    protected ribbonGeometry: BufferGeometry = null;
    protected points = new Float32Array(0);
    protected readonly lastPoint = new Float32Array(13);
    protected pointCount = 0;
    protected pointCapacity = 0;
    protected pointLimit: number;
    protected sampleTimer: number;
    protected realSampleRate: number;
    protected isDecaying = false;
    protected isKilled = false;
    protected sheetsUsed: number;
    protected sampleWidth: number;
    declare protected isDepthTesting: boolean;
    declare protected isDepthWriting: boolean;

    public constructor(config: RibbonConfig_T) {
        super(config);
        this.finishConstruction(config);
    }

    protected initSettings(config: RibbonConfig_T): void {
        this.material = config.material;
        this.ribbon = Object.assign({}, config.ribbon);
        this.isFadingIn = !!config.fadeIn;
        this.isFadingOut = !!config.fadeOut;
        if (config.fadeIn) { this.fadeInEndTime = config.fadeIn.time; this.fadeInFactor.fromArray(config.fadeIn.color); }
        if (config.fadeOut) { this.fadeOutStartTime = config.fadeOut.time; this.fadeOutFactor.fromArray(config.fadeOut.color); }
        this.pointLimit = this.ribbon.numPoints;
        this.sampleWidth = this.ribbon.width;
        this.sampleTimer = this.realSampleRate = this.ribbon.sampleRate;
        this.sheetsUsed = Math.max(1, this.ribbon.numSheets);
        this.reservePoints(Math.max(2, this.pointLimit + this.ribbon.controlPoints + 1));
    }

    protected reservePoints(count: number): void {
        if (count <= this.pointCapacity) return;
        const capacity = Math.max(count, this.pointCapacity * 2), points = new Float32Array(capacity * 13);
        points.set(this.points);
        this.points = points;
        this.pointCapacity = capacity;
        const previous = this.ribbonGeometry, geometry = this.ribbonGeometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array((capacity - 1) * 6), 3));
        geometry.setAttribute("uv", new BufferAttribute(new Float32Array((capacity - 1) * 4), 2));
        const indexCount = (capacity - 2) * 6 * this.sheetsUsed;
        geometry.setIndex(new BufferAttribute(capacity * 2 > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount), 1));
        geometry.setDrawRange(0, 0);
        if (previous) {
            this.traverse((child: any) => { if (child.geometry === previous) child.geometry = geometry; });
            previous.dispose();
        }
    }

    protected initParticleMesh() {
        const material = this.material.sprites?.length > 1 ? new AnimatedParticleMaterial(this.material) : new ParticleMaterial(this.material);
        material.depthTest = this.isDepthTesting;
        material.depthWrite = this.isDepthWriting;
        const mesh = new RibbonMesh(this.ribbonGeometry, material);
        mesh.emitter = this;
        mesh.frustumCulled = false;
        mesh.matrixWorldAutoUpdate = false;
        return mesh;
    }

    public reset(): void {
        super.reset();
        this.pointCount = 0;
        this.pointLimit = this.ribbon.numPoints;
        this.sampleWidth = this.ribbon.width;
        this.sampleTimer = this.realSampleRate = this.ribbon.sampleRate;
        this.isDecaying = this.isKilled = false;
        this.lastPoint.fill(0);
        this.ribbonGeometry.setDrawRange(0, 0);
    }

    public attachTrailer(bone: string, length: number, shotTime: number, numPoints: number): void {
        const ribbon = this.ribbon;
        ribbon.boneNameStart = ribbon.boneNameEnd = bone;
        ribbon.startBoneOffset = [Math.fround(length * Math.fround(0.53)), 0, 0];
        ribbon.endBoneOffset = [Math.fround(length * Math.fround(1.06)), 0, 0];
        ribbon.width = ribbon.endBoneOffset[0];
        ribbon.thresholdTime = Math.fround(shotTime * 0.5);
        ribbon.thresholdTime2 = shotTime;
        if (numPoints > 0) this.pointLimit = ribbon.numPoints = numPoints;
        this.fadeOutStartTime = shotTime;
        this.fadeInEndTime = Math.fround(shotTime * Math.fround(1 / 3));
    }

    public getDrawMatrix(target: Matrix4): void {
        if (this.coordinateSystem !== "relative" || !this.parent) { target.identity(); return; }
        const emitter = this.parent as any;
        const owner = (this.ribbon.pointAxis === "boneNormal" || this.ribbon.pointAxis === "startBoneDirection") && emitter.scriptOwner ? emitter.scriptOwner : emitter;
        owner.updateWorldMatrix(true, false);
        owner.getWorldPosition(tmpOrigin);
        if (owner.isActor) getPawnRotation(owner, tmpFrameRotation);
        else owner.getWorldQuaternion(tmpFrameRotation);
        target.makeRotationFromQuaternion(tmpFrameRotation).setPosition(tmpOrigin);
    }

    protected getNewRibbonPoint(start: Vector3, end: Vector3): boolean {
        const owner = (this.parent as any).scriptOwner as BaseActor, ribbon = this.ribbon;
        if (!ribbon.useBones || !owner || ribbon.boneNameStart.toLowerCase() === "none") return false;
        const animation = owner.findComponent<AnimationComponent>("animation");
        if (!animation) return false;
        const mesh = animation.getMeshes().find((mesh: any) => mesh.skeleton && mesh.skeleton.matchRefBone(ribbon.boneNameStart) >= 0) as any;
        if (!mesh) { ribbon.useBones = false; ribbon.pointAxis = "axisNormal"; return false; }
        if (ribbon.pointAxis === "boneNormal" && mesh.skeleton.matchRefBone(ribbon.boneNameEnd) < 0) ribbon.pointAxis = "startBoneDirection";
        // Engine.dll GetNewRibbonPoint 10654F50..106559FE only emits points for PAXIS_BoneNormal.
        if (ribbon.pointAxis !== "boneNormal") return false;
        animation.getBoneWorldMatrix(ribbon.boneNameStart, tmpBoneMatrix);
        start.setFromMatrixPosition(tmpBoneMatrix);
        tmpBoneRotation.extractRotation(tmpBoneMatrix);
        start.add(tmpOffset.fromArray(ribbon.startBoneOffset).applyMatrix4(tmpBoneRotation));
        animation.getBoneWorldMatrix(ribbon.boneNameEnd, tmpBoneMatrix);
        end.setFromMatrixPosition(tmpBoneMatrix);
        tmpBoneRotation.extractRotation(tmpBoneMatrix);
        end.add(tmpOffset.fromArray(ribbon.endBoneOffset).applyMatrix4(tmpBoneRotation));
        tmpDirection.subVectors(end, start);
        this.sampleWidth = ribbon.useBoneDistance ? tmpDirection.length() : ribbon.width;
        const width = ribbon.width;
        if (this.coordinateSystem !== "relative") { end.set(0, 0, 0); return true; }
        tmpDirection.normalize();
        this.getDrawMatrix(tmpInverseFrame);
        tmpInverseFrame.invert();
        start.applyMatrix4(tmpInverseFrame);
        tmpDirection.transformDirection(tmpInverseFrame).applyQuaternion(this.rotationOffset);
        end.copy(start).addScaledVector(tmpDirection, -width * ribbon.pointOriginOffset);
        start.addScaledVector(tmpDirection, width * (1 - ribbon.pointOriginOffset));
        return true;
    }

    protected insertPoints(index: number, count: number): void {
        this.reservePoints(this.pointCount + count);
        this.points.copyWithin((index + count) * 13, index * 13, this.pointCount * 13);
        this.points.fill(0, index * 13, (index + count) * 13);
        this.pointCount += count;
    }

    protected updateParticles(deltaTime: number): void {
        super.updateParticles(deltaTime);
        const particle = this.particles[0], ribbon = this.ribbon;
        if (!this.parent || !this.activeParticles || !(particle.flags & EParticleFlags_T.PTF_Active)) return;
        if (ribbon.samplePoints && !this.killPending) {
            if (!this.getNewRibbonPoint(tmpStart, tmpEnd) || tmpStart.lengthSq() === 0) return;
            const first = this.pointCount === 0;
            if (first) this.insertPoints(0, 1);
            tmpStart.toArray(this.points, 0);
            tmpEnd.toArray(this.points, 3);
            const timer = this.sampleTimer + deltaTime;
            this.sampleTimer = Math.fround(timer);
            let stopped = false;
            if (timer >= this.realSampleRate) {
                const distance = Math.fround(Math.hypot(tmpStart.x - this.lastPoint[0], tmpStart.y - this.lastPoint[1], tmpStart.z - this.lastPoint[2])) + Math.fround(Math.hypot(tmpEnd.x - this.lastPoint[3], tmpEnd.y - this.lastPoint[4], tmpEnd.z - this.lastPoint[5]));
                if (first || distance < ribbon.minSampleDist) {
                    this.sampleTimer = this.realSampleRate;
                    stopped = true;
                } else {
                    this.isDecaying = false;
                    this.sampleTimer = 0;
                    this.insertPoints(1, 1);
                    this.points.copyWithin(13, 0, 6);
                    this.points[25] = this.sampleWidth;
                    for (let i = 0; i < 13; i++) this.lastPoint[i] = this.points[13 + i];
                    if (ribbon.useInterpolation) {
                        if (this.pointCount >= 4) for (let i = 0; i < 6; i++) this.points[32 + i] = (this.points[i] - this.points[39 + i]) / (ribbon.scaleRatio * (i < 3 ? 1 : 2));
                        if (this.pointCount >= 5) {
                            for (let i = 0; i < 13; i++) { tmpPointA[i] = this.points[26 + i]; tmpPointB[i] = this.points[39 + i]; }
                            this.insertPoints(3, ribbon.controlPoints - 1);
                            for (let i = 1; i < ribbon.controlPoints; i++) {
                                const t = 1 - i / ribbon.controlPoints;
                                for (let axis = 0; axis < 6; axis++) this.points[(i + 2) * 13 + axis] = cubicPoint(tmpPointB[axis], tmpPointA[axis], tmpPointB[axis + 6], tmpPointA[axis + 6], t);
                                this.points[(i + 2) * 13 + 12] = this.sampleWidth;
                            }
                        }
                    }
                }
            }
            if (ribbon.decayPoints && stopped) {
                this.isDecaying = true;
                if (this.pointCount > 1) this.pointCount--;
                this.sampleTimer = 0;
            }
            if (this.pointCount >= ribbon.pointsDropRate + ribbon.minPoints && (ribbon.accDrop === "byPoint" && this.pointCount >= this.pointLimit || (ribbon.accDrop === "byTime" || ribbon.accDrop === "byTimeDual") && particle.time >= ribbon.thresholdTime)) this.pointLimit -= ribbon.pointsDropRate;
            else if (ribbon.accDrop === "byTimeDual" && particle.time >= ribbon.thresholdTime2) this.pointLimit = Math.max(0, this.pointLimit - 1);
            this.pointCount = Math.min(this.pointCount, this.pointLimit);
        } else {
            if (this.killPending && !this.isKilled) {
                this.isKilled = true;
                if (ribbon.syncDecayWhenKilled) this.realSampleRate = Math.fround((particle.maxLifetime - particle.time) / (this.pointCount - 1));
            }
            if (ribbon.decayPointsWhenStopped && this.pointCount) {
                const timer = this.sampleTimer + deltaTime;
                this.sampleTimer = Math.fround(timer);
                this.isDecaying = true;
                if (timer >= this.realSampleRate) { this.sampleTimer = 0; this.pointCount--; }
            }
        }
    }

    public syncParticles(): void {
        if (!this.needsParticleSync) return;
        super.syncParticles();
        for (let i = 1; i < this.particlePool.length; i++) this.particlePool[i].visible = false;
        this.buildRibbon();
    }

    protected buildRibbon(): void {
        const count = this.pointCount, ribbon = this.ribbon, geometry = this.ribbonGeometry;
        if (count < 3 || !(this.particles[0].flags & EParticleFlags_T.PTF_Active)) { geometry.setDrawRange(0, 0); return; }
        const positions = geometry.getAttribute("position"), uvs = geometry.getAttribute("uv"), index = geometry.getIndex();
        const fraction = Math.max(0, Math.min(this.realSampleRate, this.sampleTimer)) / this.realSampleRate;
        const interpolate = ribbon.samplePoints && count === this.pointLimit || (!ribbon.samplePoints || this.killPending) && ribbon.decayPointsWhenStopped || ribbon.samplePoints && ribbon.decayPoints && this.isDecaying;
        const growing = ribbon.samplePoints && !this.isDecaying && count < this.pointLimit;
        let startLength = 0, endLength = 0;
        tmpStart.set(0, 0, 0); tmpEnd.set(0, 0, 0);
        for (let i = 1; i < count; i++) {
            const p = i * 13, vertex = (i - 1) * 2;
            const blend = interpolate && (i === 1 && !this.isDecaying || i === count - 1 && !growing);
            for (let axis = 0; axis < 3; axis++) {
                positions.array[vertex * 3 + axis] = this.points[p + axis] + (blend ? (tmpStart.getComponent(axis) - this.points[p + axis]) * fraction : 0);
                positions.array[(vertex + 1) * 3 + axis] = this.points[p + 3 + axis] + (blend ? (tmpEnd.getComponent(axis) - this.points[p + 3 + axis]) * fraction : 0);
            }
            startLength = Math.fround(startLength + tmpStart.distanceTo(tmpOffset.fromBufferAttribute(positions, vertex)));
            tmpStart.copy(tmpOffset);
            endLength = Math.fround(endLength + tmpEnd.distanceTo(tmpOffset.fromBufferAttribute(positions, vertex + 1)));
            tmpEnd.copy(tmpOffset);
            let u = 1;
            if (i !== count - 1) {
                if (ribbon.lengthBasedTextureU) u = 0;
                else if (interpolate && this.isDecaying || growing) {
                    const reciprocal = 1 / (count - 1);
                    u = this.isDecaying ? (reciprocal + (1 / (count - 2) - reciprocal) * fraction) * i : (reciprocal + (1 / count - reciprocal) * fraction) * (i + fraction);
                } else u = (i + fraction) / (count - 1);
            }
            u = Math.max(0, Math.min(1, u)) * ribbon.textureUScale;
            uvs.setXY(vertex, u, 0); uvs.setXY(vertex + 1, u, ribbon.textureVScale);
        }
        if (ribbon.lengthBasedTextureU) {
            let startU = 0, endU = 0;
            for (let i = 2; i < count; i++) {
                const vertex = (i - 1) * 2;
                tmpStart.fromBufferAttribute(positions, vertex - 2); tmpEnd.fromBufferAttribute(positions, vertex);
                startU = Math.fround(startU + tmpStart.distanceTo(tmpEnd) / startLength);
                tmpStart.fromBufferAttribute(positions, vertex - 1); tmpEnd.fromBufferAttribute(positions, vertex + 1);
                endU = Math.fround(endU + tmpStart.distanceTo(tmpEnd) / endLength);
                uvs.setX(vertex, startU * ribbon.textureUScale); uvs.setX(vertex + 1, endU * ribbon.textureUScale);
            }
        }
        let offset = 0;
        for (let sheet = 0; sheet < this.sheetsUsed; sheet++) for (let i = 0; i < count - 2; i++) {
            const vertex = i * 2;
            index.array[offset++] = vertex; index.array[offset++] = vertex + 1; index.array[offset++] = vertex + 2;
            index.array[offset++] = vertex + 1; index.array[offset++] = vertex + 3; index.array[offset++] = vertex + 2;
        }
        positions.needsUpdate = uvs.needsUpdate = index.needsUpdate = true;
        geometry.setDrawRange(0, offset);
    }
}

function cubicPoint(p0: number, p1: number, t0: number, t1: number, t: number): number {
    const square = t * t, cube = square * t;
    return (2 * cube - 3 * square + 1) * p0 + (3 * square - 2 * cube) * p1 + (cube - 2 * square + t) * t0 + (cube - square) * t1;
}

class RibbonMesh extends Mesh<BufferGeometry, ParticleMaterial | AnimatedParticleMaterial> {
    public emitter: RibbonEmitter;
    public onBeforeRender(): void { this.emitter.getDrawMatrix(this.matrixWorld); }
}

export default RibbonEmitter;
