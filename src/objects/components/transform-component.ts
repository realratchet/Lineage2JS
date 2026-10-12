import { Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { SCRIPT_NATIVE_EVENT, ScriptComponent } from "../../game/script-component";
import { ScriptHost_T, ScriptNativeCall_T, ScriptValue_T } from "../../ue-script/vm";
import Rotator from "../../utils/rotator";
import LocalSpaceSkeleton from "../local-space-skeleton";
import { setScriptObjectProperty } from "./actor-ownership-component";
import type AnimationComponent from "./animation-component";
import type PawnMovementComponent from "../../physics/components/pawn-movement-component";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type { ICollidable } from "../objects";
import type { Vector3Arr } from "@l2js/engine";

const tmpRotator = new Rotator();
const tmpBasePosition = new Vector3();
const tmpBaseQuaternion = new Quaternion();
const tmpBaseInverseQuaternion = new Quaternion();
const tmpBoneMatrix = new Matrix4();
const tmpLocation = new Vector3();

export class TransformComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "transform";
    protected readonly renderManager: RenderManager;
    protected base: (ICollidable & Object3D) = null;
    protected readonly basedActors = new Set<ICollidable>();
    protected readonly basePosition = new Vector3();
    protected readonly baseQuaternion = new Quaternion();
    protected readonly baseRelativePosition = new Vector3();
    protected readonly visitedBases = new Set<ICollidable>();

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<ScriptValue_T> {
        if (type !== SCRIPT_NATIVE_EVENT) return COMPONENT_EVENT_NOT_HANDLED;

        const call = data as ScriptNativeCall_T;
        const context = call.context as any;
        const name = call.index === 267 ? "setlocation" : call.index === 299 ? "setrotation" : call.name.toLowerCase();

        if (call.index === 298 || name === "setbase") {
            const base = call.args[0] as any;

            if (typeof context.setBase === "function") context.setBase(base);
            else {
                if (!context.isObject3D) throw new Error(`'${context.scriptClassId}' cannot be based.`);
                if (base && !base.isObject3D) throw new Error(`'${context.scriptClassId}' cannot use '${base}' as a base.`);

                (base || this.renderManager.scene).attach(context);
                if (context.scriptProperties instanceof Map) context.scriptProperties.set("Base", base);
            }

            return;
        }

        switch (name) {
            case "setlocation": {
                if (context !== this.getParent()) throw new Error(`'${context.scriptClassId}' cannot move '${this.getParent().type}'.`);

                const location = tmpLocation.fromArray(call.args[0] as Vector3Arr);
                return this.renderManager.getPhysicsManager().farMoveActor(this.getParent(), location);
            }
            case "setrotation": {
                const parent = this.getParent();

                if (context !== parent) throw new Error(`'${context.scriptClassId}' cannot rotate '${parent.type}'.`);
                if (parent.getUnrealScriptProperty("bStatic") || !parent.getUnrealScriptProperty("bMovable")) return false;

                const rotation = (call.args[0] as Vector3Arr).map(value => value | 0) as Vector3Arr;
                const oldRotation = parent.getUnrealScriptProperty("Rotation") as Vector3Arr;

                if (rotation.every((value, index) => value === oldRotation[index])) return true;
                for (const actor of this.basedActors)
                    if (!(actor as BaseActor).scriptBase) throw new Error(`SetRotation with unboned attachments is not implemented for '${parent.scriptClassId}'.`);
                if (!parent.getCollisionProfile().useCylinderCollision) throw new Error(`SetRotation without cylinder collision is not implemented for '${parent.scriptClassId}'.`);
                if (this.base && !parent.scriptBase && !this.base.getCollisionProfile?.().worldGeometry) throw new Error(`SetRotation relative to a moving base is not implemented for '${parent.scriptClassId}'.`);

                // Engine.dll MoveActor 0x85b4f4..0x85b584: cylinder rotation skips collision/SetZone.
                parent.setUnrealScriptProperty("Rotation", rotation);
                this.getComponent<PawnMovementComponent>("pawnMovement").syncRotationYaw(rotation[1]);
                tmpRotator.set(rotation[0], rotation[1], rotation[2]).toQuaternion(parent.quaternion);
                parent.rotateZ(-Math.PI / 2);
                parent.updateMatrixWorld(true);
                this.renderManager.needsUpdate = true;
                return true;
            }
            case "getbonecoordswithboneindex": {
                if (context !== this.getParent()) throw new Error(`'${context.scriptClassId}' cannot use '${this.getParent().type}' bones.`);

                this.getComponent<AnimationComponent>("animation").getBoneWorldMatrix(Number(call.args[0]), tmpBoneMatrix);
                const matrix = tmpBoneMatrix.elements;

                return { Origin: [matrix[12], matrix[13], matrix[14]], XAxis: [matrix[0], matrix[1], matrix[2]], YAxis: [matrix[4], matrix[5], matrix[6]], ZAxis: [matrix[8], matrix[9], matrix[10]] };
            }
            case "attachtobone": {
                if (context !== this.getParent()) throw new Error(`'${context.scriptClassId}' cannot use '${this.getParent().type}' bones.`);

                return this.attachObjectToBone(call.args[0] as unknown as Object3D, call.args[1] as string);
            }
            case "attachtobonewithindex": {
                if (context !== this.getParent()) throw new Error(`'${context.scriptClassId}' cannot use '${this.getParent().type}' bones.`);

                return this.attachObjectToBone(call.args[0] as unknown as Object3D, Number(call.args[1]));
            }
            case "detachfrombone": {
                if (context !== this.getParent()) throw new Error(`'${context.scriptClassId}' cannot use '${this.getParent().type}' bones.`);

                return this.detachBoneObject(call.args[0] as unknown as Object3D);
            }
            case "setrelativelocation": {
                if (!context.isObject3D) throw new Error(`'${context.scriptClassId}' has no relative location.`);

                context.position.fromArray(call.args[0] as Vector3Arr);
                return true;
            }
            case "setrelativerotation": {
                if (!context.isObject3D) throw new Error(`'${context.scriptClassId}' has no relative rotation.`);

                const [pitch, yaw, roll] = call.args[0] as Vector3Arr;

                tmpRotator.set(pitch, yaw, roll).toQuaternion(context.quaternion);
                return true;
            }
            default: return COMPONENT_EVENT_NOT_HANDLED;
        }
    }

    public onDetach(): void {
        for (const actor of this.basedActors) (actor as BaseActor).getComponent<TransformComponent>("transform").base = null;

        this.basedActors.clear();
        this.setBase(null);
    }

    public getBase(): ICollidable | null { return this.base; }
    public getBasedActors(): ReadonlySet<ICollidable> { return this.basedActors; }
    public addBasedActor(actor: ICollidable): void { this.basedActors.add(actor); }
    public removeBasedActor(actor: ICollidable): void { this.basedActors.delete(actor); }
    public getBasePosition(): Vector3 { return this.basePosition; }
    public getBaseQuaternion(): Quaternion { return this.baseQuaternion; }
    public getBaseRelativePosition(): Vector3 { return this.baseRelativePosition; }

    public beginTouch(other: BaseActor): void { beginTouch(this.getParent(), other); }

    public endTouch(other: BaseActor, noNotifySelf = false): void { endTouch(this.getParent(), other, noNotifySelf); }

    public releaseTouching(): void { releaseTouching(this.getParent()); }

    public setBase(actor: ICollidable | null): boolean {
        const parent = this.getParent();
        const base = actor as ICollidable & Object3D;

        if (base === this.base) return true;

        this.visitedBases.clear();

        for (let current = base; current; current = current.getBaseActor ? current.getBaseActor() as ICollidable & Object3D : null) {
            if (current === parent || this.visitedBases.has(current)) return false;

            this.visitedBases.add(current);
        }

        if (this.base && this.base.removeBasedActor) this.base.removeBasedActor(parent);

        this.base = base;

        if (!base) return true;

        if (base.addBasedActor) base.addBasedActor(parent);

        base.getWorldPosition(this.basePosition);
        base.getWorldQuaternion(this.baseQuaternion);
        this.updateBaseRelativePosition();

        return true;
    }

    public updateBaseTransform(position: Vector3, quaternion: Quaternion): void {
        this.basePosition.copy(position);
        this.baseQuaternion.copy(quaternion);
    }

    public updateBaseRelativePosition(): void {
        if (!this.base) return;

        this.base.getWorldPosition(tmpBasePosition);
        this.base.getWorldQuaternion(tmpBaseQuaternion);
        this.baseRelativePosition.copy(this.getParent().position).sub(tmpBasePosition).applyQuaternion(tmpBaseInverseQuaternion.copy(tmpBaseQuaternion).invert());
    }

    public attachObjectToBone(object: Object3D, boneNameOrIndex: string | number, absolute: boolean = false): boolean {
        const parent = this.getParent();
        const oldBase = (object as any).scriptBase as BaseActor;

        if (oldBase && oldBase !== parent) oldBase.detachBoneObject(object);

        for (const mesh of this.getComponent<AnimationComponent>("animation").getMeshes()) {
            const skeleton = (mesh as any).skeleton as LocalSpaceSkeleton;

            if (!skeleton || !skeleton.attachObject(object, boneNameOrIndex, absolute)) continue;

            const properties = (object as any).scriptProperties as Map<string, ScriptValue_T>;
            let relativeLocation: ScriptValue_T = null;
            let relativeRotation: ScriptValue_T = null;

            if (properties)
                for (const [key, value] of properties) {
                    const name = key.slice(key.lastIndexOf(".") + 1).toLowerCase();

                    if (name === "relativelocation") relativeLocation = value;
                    else if (name === "relativerotation") relativeRotation = value;
                }

            if (relativeLocation !== null && !Array.isArray(relativeLocation)) throw new Error(`'${(object as any).scriptClassId}' has invalid RelativeLocation.`);
            if (relativeRotation !== null && !Array.isArray(relativeRotation)) throw new Error(`'${(object as any).scriptClassId}' has invalid RelativeRotation.`);

            if (relativeLocation === null) object.position.set(0, 0, 0);
            else object.position.fromArray(relativeLocation as Vector3Arr);

            if (relativeRotation === null) object.quaternion.identity();
            else {
                const [pitch, yaw, roll] = relativeRotation as Vector3Arr;

                tmpRotator.set(pitch, yaw, roll).toQuaternion(object.quaternion);
            }

            (object as any).scriptBase = parent;
            setScriptObjectProperty(object, "Base", parent);

            const script = this.findComponent<ScriptComponent<BaseActor>>("script");

            if (oldBase !== parent && script?.hasFunction("Attach")) script.call("Attach", [object as unknown as ScriptHost_T]);

            return true;
        }

        return false;
    }

    public detachBoneObject(object: Object3D): boolean {
        for (const mesh of this.getComponent<AnimationComponent>("animation").getMeshes()) {
            const skeleton = (mesh as any).skeleton as LocalSpaceSkeleton;

            if (!skeleton || !skeleton.detachObject(object)) continue;

            (object as any).scriptBase = null;
            setScriptObjectProperty(object, "Base", null);

            const script = this.findComponent<ScriptComponent<BaseActor>>("script");

            if (script?.hasFunction("Detach")) script.call("Detach", [object as unknown as ScriptHost_T]);

            return true;
        }

        return false;
    }

}

export type TouchActor_T = ScriptHost_T & Pick<BaseActor, "getUnrealScriptProperty" | "getComponent" | "isPendingKill">;

export function beginTouch(parent: TouchActor_T, other: TouchActor_T): void {
    if (!other || other === parent) throw new Error(`Invalid touch actor '${other}'.`);

    if (touchTo(parent, other)) touchTo(other, parent);
}

export function endTouch(parent: TouchActor_T, other: TouchActor_T, noNotifySelf = false): void {
    if (!other || other === parent) throw new Error(`Invalid touch actor '${other}'.`);

    const touching = parent.getUnrealScriptProperty("Touching") as unknown as TouchActor_T[], otherTouching = other.getUnrealScriptProperty("Touching") as unknown as TouchActor_T[];
    if (!noNotifySelf && touching.includes(other) && !parent.isPendingKill()) {
        const script = parent.getComponent<ScriptComponent>("script");

        if (script.hasFunction("UnTouch")) script.call("UnTouch", [other]);
    }

    for (let i = touching.length - 1; i >= 0; i--)
        if (touching[i] === other) touching.splice(i, 1);

    if (!otherTouching.includes(parent)) return;

    if (!other.isPendingKill()) {
        const otherScript = other.getComponent<ScriptComponent>("script");

        if (otherScript.hasFunction("UnTouch")) otherScript.call("UnTouch", [parent]);
    }

    for (let i = otherTouching.length - 1; i >= 0; i--)
        if (otherTouching[i] === parent) otherTouching.splice(i, 1);
}

export function releaseTouching(parent: TouchActor_T): void {
    if (!parent.scriptProperties) return;

    const touching = parent.getUnrealScriptProperty("Touching") as unknown as TouchActor_T[];

    for (let i = 0; i < touching.length; i++) {
        const other = touching[i];

        if (!other || !(other.getUnrealScriptProperty("Touching") as unknown as TouchActor_T[]).includes(parent)) continue;

        endTouch(parent, other, true);
        i--;
    }
}

function touchTo(actor: TouchActor_T, other: TouchActor_T): boolean {
    const touching = actor.getUnrealScriptProperty("Touching") as unknown as TouchActor_T[];

    if (touching.includes(other)) return true;

    touching.push(other);

    if (!actor.isPendingKill()) {
        const script = actor.getComponent<ScriptComponent>("script");

        if (script.hasFunction("Touch")) script.call("Touch", [other]);
    }

    return touching.includes(other);
}

export default TransformComponent;
