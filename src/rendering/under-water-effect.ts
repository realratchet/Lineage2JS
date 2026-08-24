import { MeshBasicMaterial, Object3D, PerspectiveCamera, Vector3, WebGLRenderer } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import ColorByte from "@client/utils/color-byte";
import type BaseEmitter from "@client/objects/emitters/base-emitter";
import Rotator from "@client/utils/rotator";
import type CollisionWorld from "@client/physics/collision-world";
import { findVolumeTransition } from "@client/physics/volume-bsp";

const SAMPLE_DISTANCE_SQ = 40000;
const SUN_BEAM_DEPTH = 2000;
const SUN_BEAM_TRACE_START = 200;

const tmpSamplingLocation = new Vector3();
const tmpSurfaceTraceEnd = new Vector3();
const tmpFloorTraceStart = new Vector3();
const tmpDown = new Vector3(0, 0, -1);
const tmpRotator = new Rotator();

class UnderWaterEffect extends Object3D {
    protected floatingSolid: Object3D = null;
    protected sunBeam: Object3D = null;
    protected sunBeamEmitter: BaseEmitter = null;
    protected readonly lastSamplingLocation = new Vector3();
    protected readonly cellophaneMaterial: MeshBasicMaterial;
    protected readonly cellophaneQuad: FullScreenQuad;
    protected volume: GD.IWaterVolumeDecodeInfo = null;
    protected hasSampled = false;
    protected isDay = false;

    public constructor() {

        super();

        this.visible = false;
        this.cellophaneMaterial = new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
        this.cellophaneQuad = new FullScreenQuad(this.cellophaneMaterial);
    }

    public setEffects(floatingSolid: Object3D, sunBeam: Object3D): void {
        if (this.floatingSolid || this.sunBeam) throw new Error("Underwater effects are already set.");

        this.floatingSolid = floatingSolid;
        this.sunBeam = sunBeam;

        sunBeam.traverse(child => {
            if (!(child as any).particlePool) return;
            if (this.sunBeamEmitter) throw new Error(`Underwater SunBeam '${sunBeam.name}' has more than one particle emitter.`);

            this.sunBeamEmitter = child as BaseEmitter;
        });

        if (!this.sunBeamEmitter) throw new Error(`Underwater SunBeam '${sunBeam.name}' has no particle emitter.`);

        tmpRotator.set(0, 0x4000, 0).toQuaternion(sunBeam.quaternion);

        this.add(floatingSolid, sunBeam);
    }

    public setVolume(volume: GD.IWaterVolumeDecodeInfo | null, envCellophane: ColorByte): void {
        if (this.volume !== volume) this.hasSampled = false;

        this.volume = volume;
        this.visible = !!volume;

        if (!volume) return;

        const color = volume.cellophane ?? [envCellophane.r, envCellophane.g, envCellophane.b, envCellophane.a];

        this.cellophaneMaterial.color.setRGB(color[0] / 255, color[1] / 255, color[2] / 255);
        this.cellophaneMaterial.opacity = color[3] / 255;
    }

    public update(camera: PerspectiveCamera, isDay: boolean, collisionWorld: CollisionWorld): void {
        if (!this.visible || !this.floatingSolid || !this.sunBeam) return;

        this.floatingSolid.position.copy(camera.position);
        tmpSamplingLocation.copy(camera.position);

        if (!isDay) {
            this.isDay = false;
            this.hasSampled = false;
            this.sunBeam.visible = false;
            return;
        }

        if (!this.isDay) this.hasSampled = false;
        this.isDay = true;

        if (this.hasSampled && this.lastSamplingLocation.distanceToSquared(tmpSamplingLocation) <= SAMPLE_DISTANCE_SQ) return;

        this.lastSamplingLocation.copy(tmpSamplingLocation);
        this.hasSampled = true;

        tmpSurfaceTraceEnd.copy(tmpSamplingLocation);
        tmpSurfaceTraceEnd.z += SUN_BEAM_DEPTH;

        const surfaceTime = findVolumeTransition(tmpSamplingLocation, tmpSurfaceTraceEnd, this.volume.bsp, true);

        if (surfaceTime <= 0 || surfaceTime >= 1) {
            this.sunBeam.visible = false;
            return;
        }

        const surfaceZ = tmpSamplingLocation.z + SUN_BEAM_DEPTH * surfaceTime;

        this.sunBeam.position.set(tmpSamplingLocation.x, tmpSamplingLocation.y, surfaceZ);
        tmpFloorTraceStart.set(tmpSamplingLocation.x, tmpSamplingLocation.y, surfaceZ - SUN_BEAM_TRACE_START);

        const floorHit = collisionWorld.rayCheck(tmpFloorTraceStart, tmpDown, SUN_BEAM_DEPTH - SUN_BEAM_TRACE_START, undefined, undefined, false);

        if (!floorHit || floorHit.distance <= 0 || floorHit.distance >= SUN_BEAM_DEPTH - SUN_BEAM_TRACE_START) {
            this.sunBeam.visible = false;
            return;
        }

        const depth = surfaceZ - floorHit.location.z;

        this.sunBeam.visible = true;
        this.sunBeamEmitter.setStartLocationRangeXZ(depth * 0.2, -depth);
    }

    public renderCellophane(renderer: WebGLRenderer): void {
        if (!this.visible) return;

        this.cellophaneQuad.render(renderer);
    }

    public dispose(): void {
        this.cellophaneQuad.dispose();
        this.cellophaneMaterial.dispose();
    }
}

export default UnderWaterEffect;
export { UnderWaterEffect };
