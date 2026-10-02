import { MeshBasicMaterial, Object3D, PerspectiveCamera, Vector3, WebGLRenderer } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import ColorByte from "../utils/color-byte";
import type BaseEmitter from "../objects/emitters/base-emitter";
import Rotator from "../utils/rotator";
import type { IWaterVolumeDecodeInfo } from "@l2js/engine/contracts/volume";

const tmpRotator = new Rotator();

export class UnderWaterEffect extends Object3D {
    protected floatingSolid: Object3D = null;
    protected sunBeam: Object3D = null;
    protected sunBeamEmitter: BaseEmitter = null;
    protected readonly cellophaneMaterial: MeshBasicMaterial;
    protected readonly cellophaneQuad: FullScreenQuad;
    protected volume: IWaterVolumeDecodeInfo = null;

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

    public setVolume(volume: IWaterVolumeDecodeInfo | null, envCellophane: ColorByte): void {
        this.volume = volume;
        this.visible = !!volume;

        if (!volume) return;

        const color = volume.cellophane ?? [envCellophane.r, envCellophane.g, envCellophane.b, envCellophane.a];

        this.cellophaneMaterial.color.setRGB(color[0] / 255, color[1] / 255, color[2] / 255);
        this.cellophaneMaterial.opacity = color[3] / 255;
    }

    public updatePresentation(camera: PerspectiveCamera): void {
        if (!this.visible || !this.floatingSolid || !this.sunBeam) return;

        this.floatingSolid.position.copy(camera.position);
    }

    public getVolume(): IWaterVolumeDecodeInfo | null { return this.volume; }
    public hasSunBeamEffects(): boolean { return !!this.floatingSolid && !!this.sunBeam; }
    public setSunBeamVisible(visible: boolean): void { this.sunBeam.visible = visible; }

    public setSunBeamSample(position: Vector3, surfaceZ: number, depth: number): void {
        this.sunBeam.position.set(position.x, position.y, surfaceZ);
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
