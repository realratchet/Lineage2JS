import { Object3D, Scene, Vector3 } from "three";
import type BaseActor from "@client/base-actor";
import type { SectorObject } from "@client/objects/zone-object";
import decodeObject3D from "@client/assets/decoders/object3d-decoder";
import { encompassesVolume, findVolumeTransition } from "@client/physics/volume-bsp";

const SURFACE_HEIGHT = 20;
const MIN_SURFACE_HEIGHT = 0.85;
const SIZE_SCALE = 1 / 9;

const tmpStart = new Vector3();
const tmpEnd = new Vector3();
const tmpPosition = new Vector3();

type SurfaceHit_T = { sector: SectorObject, volume: GD.IWaterVolumeDecodeInfo, time: number };

function isEffectFinished(effect: Object3D): boolean {
    let hasEmitter = false;
    let isFinished = true;

    for (const child of effect.children) {
        const emitter = child as any;

        if (!emitter.particlePool) continue;

        hasEmitter = true;
        if (!emitter.isFinished()) isFinished = false;
    }

    return hasEmitter && isFinished;
}

function disposeEffect(effect: Object3D): void {
    effect.removeFromParent();
    effect.traverse(child => {
        const mesh = child as any;

        if (!mesh.isMesh) return;

        const materials = mesh.material instanceof Array ? mesh.material : [mesh.material];

        for (const material of materials) material.dispose();
        if (mesh.isInstancedSpriteMesh) mesh.geometry.dispose();
    });
}

class WaterHitEffect {
    protected readonly owner: BaseActor;
    protected readonly scene: Scene;
    protected readonly effects = new Set<Object3D>();
    protected effectName: string = null;
    protected elapsed = 0;
    protected interval = 0;

    public constructor(owner: BaseActor, scene: Scene) {

        this.owner = owner;
        this.scene = scene;
    }

    public update(sectors: readonly SectorObject[], deltaTime: number): void {
        for (const effect of this.effects) {
            if (!isEffectFinished(effect)) continue;

            disposeEffect(effect);
            this.effects.delete(effect);
        }

        const hit = this.findSurface(sectors);

        if (!hit || !this.owner.isSwimmingMovement()) {
            this.effectName = null;
            this.elapsed = 0;
            return;
        }

        const speed = this.owner.getSpeed();
        const effectName = speed > 0 ? hit.volume.runHitEffect : hit.volume.waitHitEffect;

        if (!effectName) return;

        this.elapsed += deltaTime / 1000;

        if (effectName === this.effectName && this.elapsed < this.interval) return;

        this.effectName = effectName;
        this.elapsed = 0;
        this.spawn(hit, effectName, speed);
    }

    protected findSurface(sectors: readonly SectorObject[]): SurfaceHit_T | null {
        const height = this.owner.getCollisionHeight();

        tmpStart.copy(this.owner.position);
        tmpEnd.copy(tmpStart);
        tmpEnd.z += height * 2 + SURFACE_HEIGHT;

        let selected: SurfaceHit_T = null;

        for (const sector of sectors) {
            if (!sector.waterVolumes) continue;

            for (const volume of sector.waterVolumes) {
                const startsInside = encompassesVolume(tmpStart, volume.bsp);

                if (!startsInside || encompassesVolume(tmpEnd, volume.bsp)) continue;

                const time = findVolumeTransition(tmpStart, tmpEnd, volume.bsp, true);
                const surfaceHeight = time * (height * 2 + SURFACE_HEIGHT);

                if (surfaceHeight < height * (1 + MIN_SURFACE_HEIGHT)) continue;
                if (!selected || volume.priority >= selected.volume.priority) selected = { sector, volume, time };
            }
        }

        return selected;
    }

    protected spawn(hit: SurfaceHit_T, effectName: string, speed: number): void {
        const library = (hit.sector as any).decodeLibrary as GD.DecodeLibrary;
        const info = library.effectTemplates[effectName] || library.effectTemplates[effectName.toLowerCase()];

        if (!info) throw new Error(`Water hit effect '${effectName}' is not in '${library.name}'.`);

        const effect = decodeObject3D(library, info);

        hit.sector.scriptVM.initializeHost(effect as any);

        tmpPosition.lerpVectors(tmpStart, tmpEnd, hit.time);
        effect.position.copy(tmpPosition);
        effect.scale.multiplyScalar(this.owner.getCollisionRadius() * SIZE_SCALE);
        if (speed > 0) effect.quaternion.copy(this.owner.quaternion);

        this.scene.add(effect);
        this.effects.add(effect);

        const spawnRate = Number(hit.sector.scriptVM.call(effect as any, "GetSpawnRate", [speed]));

        this.interval = 1 / (spawnRate >= 0 ? spawnRate : 2);
    }
}

export default WaterHitEffect;
export { WaterHitEffect };
