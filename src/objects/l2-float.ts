import { AnimationAction, Sphere, Vector3 } from "three";
import { GameObject } from "../game/components";
import ActorMeshComponent from "../rendering/components/actor-mesh-component";
import ActorOwnershipComponent from "./components/actor-ownership-component";
import AnimationComponent from "./components/animation-component";
import UnScriptVM from "../ue-script/vm";
import Rotator from "../utils/rotator";
import { TagState_T } from "../assets/unreal/un-l2-float";
import { EPhysics_T } from "../assets/unreal/un-aactor";
import type { DecodeLibrary } from "@l2js/engine";
import type RenderManager from "../rendering/render-manager";
import type AssetManager from "../assets/asset-manager";
import type LocalSpaceSkeleton from "./local-space-skeleton";
import type LitSkinnedMesh from "./lit-skinned-mesh";

type WaterTrace_T = (start: Vector3, end: Vector3, hit: Vector3) => void;

const tmpWaterPosition = new Vector3();
const tmpTraceStart = new Vector3();
const tmpTraceEnd = new Vector3();
const tmpTraceHit = new Vector3();
const tmpDisplacement = new Vector3();
const tmpEffectRotation = new Rotator();

class FloatMeshComponent extends ActorMeshComponent {
    public getMesh() { return this.mesh; }
}

class FloatAnimationComponent extends AnimationComponent {
    public constructor(renderManager: RenderManager, mesh: LitSkinnedMesh) {
        super(renderManager);

        this.meshes = [mesh];
        this.actorAnimations = (mesh as any).meshAnimations;
        this.isAnimationsInit = true;
        (mesh as any).hasStartedAnimation = true;
    }

    public onDetach(): void {
        this.stop();
        this.renderManager.mixer.uncacheRoot(this.meshes[0]);
    }
}

export class L2Float extends GameObject {
    public readonly scriptClassId = "engine.L2Float";
    public readonly scriptProperties = new Map<string, any>();
    public state = TagState_T.L2TAG_WAIT;
    public fishType: number;
    public gut = false;
    protected readonly renderManager: RenderManager;
    protected readonly library: DecodeLibrary;
    protected readonly meshComponent: FloatMeshComponent;
    protected readonly animation: FloatAnimationComponent;
    protected readonly nativeRotation: Rotator;
    protected readonly originalLocation = new Vector3();
    protected readonly oldEffectLocation = new Vector3();
    protected readonly worldSphere = new Sphere();
    protected readonly traceWater: WaterTrace_T;
    protected effectType = 0;
    protected effectElapsed = 0;
    protected waterEffectTimer = 0;

    public constructor(renderManager: RenderManager, library: DecodeLibrary, location: Vector3, rotation: Rotator, fishType: number, traceWater: WaterTrace_T) {
        super();

        (this as any).isActor = true;
        this.renderManager = renderManager;
        this.library = library;
        this.traceWater = traceWater;
        this.fishType = fishType;
        this.nativeRotation = new Rotator(rotation.pitch, rotation.yaw, rotation.roll);
        this.nativeRotation.toQuaternion(this.quaternion);
        this.position.copy(location);
        this.originalLocation.copy(location);
        new UnScriptVM(library).initializeHost(this);

        const rate = this.scriptProperties.get("RotationRate");
        if (!Array.isArray(rate) || rate.some(value => value !== 0)) throw new Error(`L2Float has unsupported RotationRate ${rate}`);
        if (!traceWater) throw new Error(`L2Float requires the native water-surface trace`);

        const meshPath = "LineageDecos.float_m00";
        library.scriptMeshes[meshPath.toLowerCase()] = library.pawnActors[0];
        this.scriptProperties.set("Mesh", meshPath);
        this.scriptProperties.set("Physics", EPhysics_T.PHYS_Rotating);
        this.addComponent(new ActorOwnershipComponent());
        this.meshComponent = this.addComponent(new FloatMeshComponent(library, renderManager));
        this.meshComponent.onUpdate();
        this.animation = this.addComponent(new FloatAnimationComponent(renderManager, this.meshComponent.getMesh()));
        this.playAnimation(this.getCurAnimName(), 0.1, true);
    }

    public getSkeleton(): LocalSpaceSkeleton { return this.meshComponent.getMesh().skeleton as LocalSpaceSkeleton; }
    public getAnimationAction(): AnimationAction { return this.animation.getAction(); }

    public getRenderSphere(): Sphere {
        const mesh = this.meshComponent.getMesh();
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        mesh.updateWorldMatrix(true, false);
        return this.worldSphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
    }

    public getCurAnimName(): string {
        if (this.state === TagState_T.L2TAG_WAIT) return this.scriptProperties.get("WaitAnimName");
        if (this.state !== TagState_T.L2TAG_BATTLE) throw new Error(`Unknown L2Float state ${this.state}`);

        return this.scriptProperties.get("BattleWaitAnimName")[this.fishType % 3 + (this.gut ? 0 : 3)];
    }

    public startCombat(gut: boolean): void {
        this.state = TagState_T.L2TAG_BATTLE;
        this.gut = gut;
        this.playAnimation(this.scriptProperties.get("BattleAnimName"), 0.1, false);
    }

    public setMode(gut: boolean): void {
        if (this.gut === gut) return;

        // Engine 1047841D plays GetCurAnimName before updating the Gut bit.
        this.playAnimation(this.getCurAnimName(), 0.5, true);
        this.gut = gut;
    }

    public setEffectType(type: number): void {
        this.effectType = type;
        this.effectElapsed = 0;
    }

    protected playAnimation(name: string, tween: number, loop: boolean): void {
        this.animation.play(name, tween, 1, loop, true);
    }

    public onAnimationFinished(action: AnimationAction): void { this.animation.onAnimationFinished(action, false); }

    public tick(deltaTime: number): void {
        const dt = Math.fround(deltaTime);

        if (this.state === TagState_T.L2TAG_BATTLE) {
            if (!this.animation.isAnimating()) this.playAnimation(this.getCurAnimName(), 0.5, true);
            this.effectElapsed = Math.fround(this.effectElapsed + dt);
            const elapsed = this.effectElapsed;

            if (this.effectType === 0) {
                const distance = this.originalLocation.z - this.position.z;
                this.position.z = Math.fround(this.position.z + Math.sign(distance) * Math.min(Math.abs(distance), Math.fround(20 * elapsed)));
            } else if (this.effectType === 1 || this.effectType === 2) {
                if (elapsed <= 0.5) this.position.z = Math.fround(this.originalLocation.z + (this.effectType === 1 ? -(40 * elapsed - 160 * elapsed * elapsed) : 20 * elapsed - 80 * elapsed * elapsed));
                else this.effectElapsed = this.effectType = 0;
            }
        }

        if (this.waterEffectTimer <= 0) {
            this.getSkeleton().getBoneWorldPosition(1, tmpWaterPosition);
            tmpTraceStart.copy(tmpWaterPosition).z += 50;
            tmpTraceEnd.copy(tmpWaterPosition);
            tmpTraceHit.set(0, 0, 0);
            this.traceWater(tmpTraceStart, tmpTraceEnd, tmpTraceHit);
            if (tmpTraceHit.z !== 0) tmpWaterPosition.copy(tmpTraceHit);

            const asset = this.renderManager.manGame.getComponent<AssetManager>("asset");
            const effect = asset.createScriptObject(this.renderManager, this.library, "LineageEffect.e_u075_w");
            effect.position.copy(tmpWaterPosition);

            if (this.state === TagState_T.L2TAG_WAIT) effect.quaternion.copy(this.quaternion);
            else {
                tmpDisplacement.copy(tmpWaterPosition).sub(this.oldEffectLocation);
                tmpEffectRotation.set(Math.trunc(Math.atan2(tmpDisplacement.z, Math.hypot(tmpDisplacement.x, tmpDisplacement.y)) * 32768 / Math.PI), Math.trunc(Math.atan2(tmpDisplacement.y, tmpDisplacement.x) * 32768 / Math.PI), 0).toQuaternion(effect.quaternion);
            }

            for (const emitter of effect.scriptProperties.get("Emitters")) {
                emitter.setSizeScale(0.5);
                emitter.setSpeedScale(this.state === TagState_T.L2TAG_WAIT ? 1 : 2);
            }
            this.renderManager.addTransientEffect(effect, this as any);
            this.oldEffectLocation.copy(tmpWaterPosition);
            this.waterEffectTimer = this.state === TagState_T.L2TAG_WAIT ? 1 : Math.fround(0.05);
        }

        this.waterEffectTimer = Math.fround(this.waterEffectTimer - dt);
    }

}

export default L2Float;
