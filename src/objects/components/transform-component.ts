import { Object3D, Quaternion, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { SCRIPT_NATIVE_EVENT, ScriptComponent } from "../../game/script-component";
import { ScriptHost_T, ScriptNativeCall_T, ScriptValue_T } from "../../ue-script/vm";
import Rotator from "../../utils/rotator";
import LocalSpaceSkeleton from "../local-space-skeleton";
import type AnimationComponent from "../animation-component";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type { ICollidable } from "../objects";

const tmpRotator = new Rotator();
const tmpBasePosition = new Vector3();
const tmpBaseQuaternion = new Quaternion();
const tmpBaseInverseQuaternion = new Quaternion();

function setScriptObjectProperty(object: Object3D, field: string, value: ScriptValue_T): void {
    const properties = (object as any).scriptProperties as Map<string, ScriptValue_T>;

    if (!properties) return;

    for (const key of properties.keys())
        if (key.slice(key.lastIndexOf(".") + 1).toLowerCase() === field.toLowerCase()) {
            properties.set(key, value);
            return;
        }

    properties.set(field, value);
}

class TransformComponent extends ObjectComponent<BaseActor> {
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
        const name = call.name.toLowerCase();

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

                context.position.fromArray(call.args[0] as GD.Vector3Arr);
                return true;
            }
            case "setrelativerotation": {
                if (!context.isObject3D) throw new Error(`'${context.scriptClassId}' has no relative rotation.`);

                const [pitch, yaw, roll] = call.args[0] as GD.Vector3Arr;

                tmpRotator.set(pitch, yaw, roll).toQuaternion(context.quaternion);
                return true;
            }
            default: return COMPONENT_EVENT_NOT_HANDLED;
        }
    }

    public getBase(): ICollidable | null { return this.base; }
    public getBasedActors(): ReadonlySet<ICollidable> { return this.basedActors; }
    public addBasedActor(actor: ICollidable): void { this.basedActors.add(actor); }
    public removeBasedActor(actor: ICollidable): void { this.basedActors.delete(actor); }
    public getBasePosition(): Vector3 { return this.basePosition; }
    public getBaseQuaternion(): Quaternion { return this.baseQuaternion; }
    public getBaseRelativePosition(): Vector3 { return this.baseRelativePosition; }

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

    public attachObjectToBone(object: Object3D, boneNameOrIndex: string | number): boolean {
        const parent = this.getParent();
        const oldBase = (object as any).scriptBase as BaseActor;

        if (oldBase && oldBase !== parent) oldBase.detachBoneObject(object);

        for (const mesh of this.getComponent<AnimationComponent>("animation").getMeshes()) {
            const skeleton = (mesh as any).skeleton as LocalSpaceSkeleton;

            if (!skeleton || !skeleton.attachObject(object, boneNameOrIndex)) continue;

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
            else object.position.fromArray(relativeLocation as GD.Vector3Arr);

            if (relativeRotation === null) object.quaternion.identity();
            else {
                const [pitch, yaw, roll] = relativeRotation as GD.Vector3Arr;

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

    public gainScriptChild(object: Object3D): void {
        const parent = this.getParent();
        const owner = (object as any).scriptOwner as BaseActor;

        if (owner === parent) return;
        if (owner) owner.loseScriptChild(object);

        (object as any).scriptOwner = parent;
        setScriptObjectProperty(object, "Owner", parent);

        const script = this.findComponent<ScriptComponent<BaseActor>>("script");

        if (script?.hasFunction("GainedChild")) script.call("GainedChild", [object as unknown as ScriptHost_T]);
    }

    public loseScriptChild(object: Object3D): void {
        const parent = this.getParent();

        if ((object as any).scriptOwner !== parent) return;

        (object as any).scriptOwner = null;
        setScriptObjectProperty(object, "Owner", null);

        const script = this.findComponent<ScriptComponent<BaseActor>>("script");

        if (script?.hasFunction("LostChild")) script.call("LostChild", [object as unknown as ScriptHost_T]);
    }
}

export default TransformComponent;
export { TransformComponent };
