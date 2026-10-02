import type { NpcSkillSound_T } from "../un-pawn";
import type { QuaternionArr, Vector3Arr } from "../library-types";
import type { IScriptFunctionDecodeInfo } from "../script-dump-loader";

export type SkillCoords_T = { origin: Vector3Arr, xAxis: Vector3Arr, yAxis: Vector3Arr, zAxis: Vector3Arr };

export type SkillScriptHost_T = {
    scriptClassId: string;
    scriptProperties: Map<string, any>;
    handlesUnrealNative(index: number, name: string): boolean;
    callUnrealNative(call: { name: string, args: any[] }): any;
};

export type SkillActor_T = {
    name: string;
    isActor?: boolean;
    isMovableObject?: boolean;
    scriptClassId: string;
    scriptProperties: Map<string, any>;
    scriptOwner: SkillActor_T;
    scriptBase: SkillActor_T;
    getUnrealScriptProperty(name: string): any;
};

export type SkillProjectile_T = {
    detachFromBase(): void;
    prepareInterpolation(factor: number, displacement: Vector3Arr): number;
    prepareHermiteInterpolation(displacement: Vector3Arr, rotation: QuaternionArr, duration: number, tangentScale: number, finalDirectionZ: number): void;
};

export type SkillEffectHost_T = {
    createEffect(caster: SkillActor_T, classId: string): SkillActor_T;
    addEffect(effect: SkillActor_T, owner: SkillActor_T | null): void;
    removeEffect(effect: SkillActor_T): void;
    isAlive(actor: SkillActor_T): boolean;
    isA(actor: SkillActor_T, classId: string, caster: SkillActor_T): boolean;
    call(actor: SkillActor_T, name: string): void;
    getPosition(actor: SkillActor_T, out: Vector3Arr, world?: boolean): Vector3Arr;
    setPosition(actor: SkillActor_T, value: Vector3Arr): void;
    getRotation(actor: SkillActor_T, out: QuaternionArr, world?: boolean): QuaternionArr;
    setRotation(actor: SkillActor_T, value: QuaternionArr): void;
    getCollisionRadius(actor: SkillActor_T): number;
    getCollisionHeight(actor: SkillActor_T): number;
    getEffectTargetLocation(actor: SkillActor_T, out: Vector3Arr): Vector3Arr;
    getMeshOrigin(actor: SkillActor_T, out: Vector3Arr): boolean;
    matchBone(actor: SkillActor_T, bone: string): number;
    getBoneCoords(actor: SkillActor_T, bone: string, out: SkillCoords_T, fallback?: number): void;
    getBonePosition(actor: SkillActor_T, bone: string, out: Vector3Arr, offset?: Vector3Arr): Vector3Arr;
    getBoneAlias(actor: SkillActor_T, alias: string, origin: Vector3Arr): string;
    attachToBone(actor: SkillActor_T, effect: SkillActor_T, bone: string | number, absolute?: boolean): boolean;
    getDesiredRotationYaw(actor: SkillActor_T): number;
    getHitNormal(actor: SkillActor_T, out: Vector3Arr): Vector3Arr;
    adjustParticleLife(actor: SkillActor_T, time: number): void;
    setParticleScale(actor: SkillActor_T, scale: number, all?: boolean): void;
    setParticleDelay(actor: SkillActor_T, time: number): void;
    createDamageEffect(actor: SkillActor_T): SkillActor_T | null;
    isRendered(actor: SkillActor_T): boolean;
    isLowDetail(): boolean;
    playAttackSounds(actor: SkillActor_T, critical?: boolean): void;
    playSkillSound(actor: SkillActor_T, sound: NpcSkillSound_T, target?: SkillActor_T): void;
    addViewShakeState(duration: number, rotationScale: number, rotationFrequency: number, positionFrequency: number, amplitude: Vector3Arr, velocity: Vector3Arr, position: Vector3Arr, origin: Vector3Arr, strength: number, range: number, type?: "damage" | "upDown"): void;
    triggerL2Event(name: string, position: Vector3Arr, radius: number): void;
    addPawnLight(actor: SkillActor_T, owner: SkillActor_T | null, color: readonly number[], radius: number, lifeTime: number, position: Vector3Arr, direction: Vector3Arr, target: Vector3Arr): unknown;
    hasPawnLight(actor: SkillActor_T, light: unknown): boolean;
    removePawnLight(actor: SkillActor_T, light: unknown): void;
    getProjectile(actor: SkillActor_T): SkillProjectile_T | null;
    initProjectile(actor: SkillActor_T, caster: SkillActor_T, target: SkillActor_T, onHit: (actor: SkillActor_T, hit: boolean, impact: SkillActor_T) => void, path?: Vector3Arr[], speed?: number, acceleration?: number): SkillProjectile_T;
    executeProgram(caster: SkillActor_T, context: SkillScriptHost_T, program: IScriptFunctionDecodeInfo): boolean;
};
