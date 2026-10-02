import { Matrix4, Object3D, Quaternion, Vector3 } from "three";
import type { SkillActor_T, SkillCoords_T, SkillEffectHost_T, SkillProjectile_T, SkillScriptHost_T } from "@l2js/engine/skills/skill-effect-host";
import type { QuaternionArr, Vector3Arr } from "@l2js/engine/library-types";
import type { IScriptFunctionDecodeInfo } from "@l2js/engine/script-dump-loader";
import { ScriptComponent } from "../../game/script-component";
import type { IObject } from "../../game/components";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type AnimationComponent from "./animation-component";
import type LitSkinnedMesh from "../lit-skinned-mesh";
import type PawnMovementComponent from "../../physics/components/pawn-movement-component";
import type SoundComponent from "../../audio/components/sound-component";
import type EffectsComponent from "../../rendering/components/effects-component";
import { NPawnLightComponent, type PawnLight_T } from "../../rendering/components/pawn-light-component";
import type { NpcSkillSound_T } from "@l2js/engine/contracts/pawn";
import type { ProjectileActor_T } from "../../physics/components/projectile-component";
import NProjectileComponent from "../../physics/components/projectile-component";
import NMover from "../../physics/mover";
import type { ScriptHost_T } from "../../ue-script/vm";

const tmpPosition = new Vector3();
const tmpDirection = new Vector3();
const tmpAmplitude = new Vector3();
const tmpVelocity = new Vector3();
const tmpShakePosition = new Vector3();
const tmpShakeOrigin = new Vector3();
const tmpLightPosition = new Vector3();
const tmpLightDirection = new Vector3();
const tmpLightTarget = new Vector3();
const tmpQuaternion = new Quaternion();
const tmpMatrix = new Matrix4();

type RuntimeActor_T = Object3D & IObject & ScriptHost_T & { scriptProperties: Map<string, any>, scriptClassId: string };

export class SkillEffectHost implements SkillEffectHost_T {
    protected readonly renderManager: RenderManager;
    protected readonly addEffectCallback: (effect: Object3D, owner: SkillActor_T | null) => void;
    protected readonly removeEffectCallback: (effect: Object3D) => void;

    public constructor(renderManager: RenderManager, addEffect: (effect: Object3D, owner: SkillActor_T | null) => void, removeEffect: (effect: Object3D) => void) {
        this.renderManager = renderManager;
        this.addEffectCallback = addEffect;
        this.removeEffectCallback = removeEffect;
    }

    public createEffect(caster: SkillActor_T, classId: string): SkillActor_T {
        const effect = this.actor(caster).getComponent<ScriptComponent>("script").createObject(classId) as any;

        if (!effect.isObject3D) throw new Error(`Skill effect '${classId}' is not an actor.`);
        return effect;
    }

    public addEffect(effect: SkillActor_T, owner: SkillActor_T | null): void { this.addEffectCallback(this.object(effect), owner); }
    public removeEffect(effect: SkillActor_T): void { this.removeEffectCallback(this.object(effect)); }
    public isAlive(actor: SkillActor_T): boolean { return !!this.object(actor).parent; }

    public isA(actor: SkillActor_T, classId: string, caster: SkillActor_T): boolean {
        const classes = (this.script(caster).getVM() as any).library.scriptClasses;

        for (let cls = classes[actor.scriptClassId]; cls; cls = classes[cls.superClassId])
            if (cls.id.toLowerCase() === classId.toLowerCase()) return true;

        return false;
    }

    public call(actor: SkillActor_T, name: string): void { this.script(actor).call(name); }

    public getPosition(actor: SkillActor_T, out: Vector3Arr, world: boolean = false): Vector3Arr {
        const object = this.object(actor);

        if (world) object.getWorldPosition(tmpPosition);
        else tmpPosition.copy(object.position);

        tmpPosition.toArray(out);
        return out;
    }

    public setPosition(actor: SkillActor_T, value: Vector3Arr): void { this.object(actor).position.fromArray(value); }

    public getRotation(actor: SkillActor_T, out: QuaternionArr, world: boolean = false): QuaternionArr {
        const object = this.object(actor);

        if (world) object.getWorldQuaternion(tmpQuaternion);
        else tmpQuaternion.copy(object.quaternion);

        tmpQuaternion.toArray(out);
        return out;
    }

    public setRotation(actor: SkillActor_T, value: QuaternionArr): void { this.object(actor).quaternion.fromArray(value); }
    public getCollisionRadius(actor: SkillActor_T): number { return actor.isActor ? this.actor(actor).getCollisionRadius() : Number(actor.getUnrealScriptProperty("CollisionRadius")); }
    public getCollisionHeight(actor: SkillActor_T): number { return actor.isActor ? this.actor(actor).getCollisionHeight() : Number(actor.getUnrealScriptProperty("CollisionHeight")); }

    public getEffectTargetLocation(actor: SkillActor_T, out: Vector3Arr): Vector3Arr {
        this.actor(actor).getEffectTargetLocation(tmpPosition);
        tmpPosition.toArray(out);
        return out;
    }

    public getMeshOrigin(actor: SkillActor_T, out: Vector3Arr): boolean {
        const mesh = this.mesh(actor);

        if (!mesh) return false;
        mesh.meshOrigin.toArray(out);
        return true;
    }

    public matchBone(actor: SkillActor_T, bone: string): number {
        const mesh = this.mesh(actor);

        return mesh ? (mesh as any).skeleton.matchRefBone(bone) : -1;
    }

    public getBoneCoords(actor: SkillActor_T, bone: string, out: SkillCoords_T, fallback?: number): void {
        this.animation(actor).getBoneWorldMatrix(bone, tmpMatrix, fallback);
        const elements = tmpMatrix.elements;

        tmpPosition.set(elements[12], elements[13], elements[14]).toArray(out.origin);
        tmpDirection.set(elements[0], elements[1], elements[2]).toArray(out.xAxis);
        tmpAmplitude.set(elements[4], elements[5], elements[6]).toArray(out.yAxis);
        tmpVelocity.set(elements[8], elements[9], elements[10]).toArray(out.zAxis);
    }

    public getBonePosition(actor: SkillActor_T, bone: string, out: Vector3Arr, offset?: Vector3Arr): Vector3Arr {
        const boneOffset = offset ? tmpDirection.fromArray(offset) : undefined;

        this.animation(actor).getBoneWorldPosition(bone, tmpPosition, boneOffset);
        tmpPosition.toArray(out);
        return out;
    }

    public getBoneAlias(actor: SkillActor_T, alias: string, origin: Vector3Arr): string {
        const mesh = this.mesh(actor);
        const index = mesh ? mesh.tagAliases.findIndex(name => name.toLowerCase() === alias.toLowerCase()) : -1;

        if (index < 0) {
            origin[0] = origin[1] = origin[2] = 0;
            return "None";
        }

        const tagOrigin = mesh.tagOrigins[index];
        origin[0] = tagOrigin[0];
        origin[1] = tagOrigin[1];
        origin[2] = tagOrigin[2];
        return mesh.tagNames[index];
    }

    public attachToBone(actor: SkillActor_T, effect: SkillActor_T, bone: string | number, absolute: boolean = false): boolean {
        return this.actor(actor).attachObjectToBone(this.object(effect), bone, absolute);
    }

    public getDesiredRotationYaw(actor: SkillActor_T): number { return this.actor(actor).getComponent<PawnMovementComponent>("pawnMovement").getDesiredRotationYaw(); }

    public getHitNormal(actor: SkillActor_T, out: Vector3Arr): Vector3Arr {
        const normal = (this.object(actor) as any).hitActorNormal as Vector3;

        if (!normal) throw new Error(`Actor '${actor.name}' has no hit normal.`);
        normal.toArray(out);
        return out;
    }

    public adjustParticleLife(actor: SkillActor_T, time: number): void { (this.object(actor) as any).adjustParticleLife(time); }

    public setParticleScale(actor: SkillActor_T, scale: number, all: boolean = false): void {
        const object = this.object(actor);
        const apply = (child: Object3D) => {
            const emitter = child as any;

            if (all ? typeof emitter.setSizeScale === "function" : emitter.particlePool) emitter.setSizeScale(scale);
        };

        object.traverse(apply);
    }

    public setParticleDelay(actor: SkillActor_T, time: number): void {
        this.object(actor).traverse((child: any) => {
            if (child.particlePool) child.setDelayed(time);
        });
    }

    public createDamageEffect(actor: SkillActor_T): SkillActor_T | null {
        const effect = this.actor(actor).getComponent<EffectsComponent>("effects").createDamageEffect();

        return effect as unknown as SkillActor_T;
    }

    public isRendered(actor: SkillActor_T): boolean { return this.actor(actor).getComponent<any>("pawnRenderable").isRendered; }
    public isLowDetail(): boolean { return this.renderManager.keepMinFrameRate; }
    public playAttackSounds(actor: SkillActor_T, critical: boolean = false): void { this.actor(actor).getComponent<SoundComponent>("sound").playAttackSounds(critical); }

    public playSkillSound(actor: SkillActor_T, sound: NpcSkillSound_T, target?: SkillActor_T): void {
        this.actor(actor).getComponent<SoundComponent>("sound").playSkillSound(sound, target ? this.actor(target) : undefined);
    }

    public addViewShakeState(duration: number, rotationScale: number, rotationFrequency: number, positionFrequency: number, amplitude: Vector3Arr, velocity: Vector3Arr, position: Vector3Arr, origin: Vector3Arr, strength: number, range: number, type?: "damage" | "upDown"): void {
        this.renderManager.addViewShakeState(duration, rotationScale, rotationFrequency, positionFrequency, this.vector(amplitude, tmpAmplitude), this.vector(velocity, tmpVelocity), this.vector(position, tmpShakePosition), this.vector(origin, tmpShakeOrigin), strength, range, type);
    }

    public triggerL2Event(name: string, position: Vector3Arr, radius: number): void { this.renderManager.triggerL2Event(name, this.vector(position), radius); }

    public addPawnLight(actor: SkillActor_T, owner: SkillActor_T | null, color: readonly number[], radius: number, lifeTime: number, position: Vector3Arr, direction: Vector3Arr, target: Vector3Arr): unknown {
        const object = this.actor(actor);
        const component = object.findComponent<NPawnLightComponent>("nPawnLight") || object.addComponent(new NPawnLightComponent());

        return component.add(owner ? this.object(owner) : null, color, radius, lifeTime, position ? this.vector(position, tmpLightPosition) : null, direction ? this.vector(direction, tmpLightDirection) : null, target ? this.vector(target, tmpLightTarget) : null);
    }

    public hasPawnLight(actor: SkillActor_T, light: unknown): boolean { return !!this.actor(actor).findComponent<NPawnLightComponent>("nPawnLight")?.getLights().includes(light as PawnLight_T); }
    public removePawnLight(actor: SkillActor_T, light: unknown): void { this.actor(actor).findComponent<NPawnLightComponent>("nPawnLight")?.remove(light as PawnLight_T); }

    public getProjectile(actor: SkillActor_T): SkillProjectile_T | null {
        const projectile = this.object(actor).findComponent<NProjectileComponent>("nProjectile");

        return projectile ? this.projectile(projectile) : null;
    }

    public initProjectile(actor: SkillActor_T, caster: SkillActor_T, target: SkillActor_T, onHit: (actor: SkillActor_T, hit: boolean, impact: SkillActor_T) => void, path?: Vector3Arr[], speed: number = 0, acceleration: number = 0): SkillProjectile_T {
        const object = this.object(actor) as ProjectileActor_T;
        const source = this.actor(caster);
        const destination = this.actor(target);
        destination.getWorldPosition(tmpPosition);
        tmpPosition.z += destination.getCollisionHeight();
        const mover = path ? new NMover(object.position, tmpPosition, path as [number, number, number][], speed, acceleration) : null;
        const projectile = object.addComponent(new NProjectileComponent(this.renderManager, source, destination, (effect, hit, impact) => onHit(effect as unknown as SkillActor_T, hit, impact as unknown as SkillActor_T), mover));

        return this.projectile(projectile);
    }

    public executeProgram(caster: SkillActor_T, context: SkillScriptHost_T, program: IScriptFunctionDecodeInfo): boolean {
        return !!this.script(caster).getVM().invoke(context, program);
    }

    protected projectile(component: NProjectileComponent): SkillProjectile_T {
        return {
            detachFromBase: () => component.detachFromBase(),
            prepareInterpolation: (factor, displacement) => component.prepareInterpolation(factor, this.vector(displacement)),
            prepareHermiteInterpolation: (displacement, rotation, duration, tangentScale, finalDirectionZ) => {
                tmpQuaternion.fromArray(rotation);
                component.prepareHermiteInterpolation(this.vector(displacement), tmpQuaternion, duration, tangentScale, finalDirectionZ);
            }
        };
    }

    protected script(actor: SkillActor_T): ScriptComponent { return this.object(actor).getComponent<ScriptComponent>("script"); }
    protected object(actor: SkillActor_T): RuntimeActor_T { return actor as unknown as RuntimeActor_T; }
    protected actor(actor: SkillActor_T): BaseActor { return actor as unknown as BaseActor; }
    protected vector(value: Vector3Arr, out: Vector3 = tmpPosition): Vector3 { return out.fromArray(value); }
    protected animation(actor: SkillActor_T): AnimationComponent { return this.actor(actor).getComponent<AnimationComponent>("animation"); }
    protected mesh(actor: SkillActor_T): LitSkinnedMesh | null { return this.actor(actor).getComponent<AnimationComponent>("animation").getMeshes().find(mesh => (mesh as any).isLitSkinnedMesh) as LitSkinnedMesh || null; }
}

export default SkillEffectHost;
