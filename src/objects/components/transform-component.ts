import { Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { SCRIPT_NATIVE_EVENT, ScriptComponent } from "../../game/script-component";
import { getProperty, setProperty, ScriptHost_T, ScriptNativeCall_T, ScriptValue_T } from "../../ue-script/vm";
import Rotator from "../../utils/rotator";
import LocalSpaceSkeleton from "../local-space-skeleton";
import { setScriptObjectProperty } from "./actor-ownership-component";
import type AnimationComponent from "./animation-component";
import type PawnMovementComponent from "../../physics/components/pawn-movement-component";
import type BaseActor from "../../base-actor";
import type CollidingMesh from "../colliding-mesh";
import type RenderManager from "../../rendering/render-manager";
import type { ICollidable } from "../objects";
import type { Vector3Arr } from "@l2js/engine";
import { ENetRole_T } from "../../assets/unreal/un-aactor";
import { pointPrimitive } from "../../physics/collision-primitive";
import type { CollisionQuery_T } from "../../physics/collision-world";

const tmpRotator = new Rotator();
const tmpBasePosition = new Vector3();
const tmpBaseQuaternion = new Quaternion();
const tmpBaseInverseQuaternion = new Quaternion();
const tmpBoneMatrix = new Matrix4();
const tmpLocation = new Vector3();
const tmpRelativeMatrix = new Matrix4();
const tmpOldBaseCoords = new Matrix4();
const tmpNewBaseCoords = new Matrix4();

export class TransformComponent extends ObjectComponent<BaseActor | CollidingMesh> {
    public readonly componentName = "transform";
    protected readonly renderManager: RenderManager;
    protected base: (ICollidable & Object3D) = null;
    protected readonly basedActors: Set<ICollidable>;
    protected readonly basePosition = new Vector3();
    protected readonly baseQuaternion = new Quaternion();
    protected readonly baseRelativePosition = new Vector3();
    protected readonly visitedBases = new Set<ICollidable>();
    protected readonly basedMoveLocation = new Vector3();
    protected readonly basedMoveDelta = new Vector3();
    protected readonly basedMoveExtent = new Vector3();
    protected readonly basedMoveQuery: CollisionQuery_T = { location: this.basedMoveLocation, delta: this.basedMoveDelta, extent: this.basedMoveExtent, sourceIsPlayer: false, ignorePawns: false, ignoreBases: true, zeroExtent: false };

    public constructor(renderManager: RenderManager, basedActors: Set<ICollidable> = new Set()) {
        super();

        this.renderManager = renderManager;
        this.basedActors = basedActors;
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
                let hasAttachments = false;
                for (const actor of this.basedActors)
                    if (!(actor as BaseActor).scriptBase) { hasAttachments = true; break; }
                const physics = this.renderManager.getPhysicsManager(), profile = parent.getCollisionProfile();
                if (!profile.useCylinderCollision || hasAttachments) {
                    if (!profile.isPawn) throw new Error(`SetRotation without a pawn source is not implemented for '${parent.scriptClassId}'.`);

                    return physics.rotateActor(parent, rotation);
                }

                // Engine.dll MoveActor 0x85b4f4..0x85b584: cylinder rotation skips collision/SetZone.
                parent.setUnrealScriptProperty("Rotation", rotation);
                this.getComponent<PawnMovementComponent>("pawnMovement").syncRotationYaw(rotation[1]);
                tmpRotator.set(rotation[0], rotation[1], rotation[2]).toQuaternion(parent.quaternion);
                parent.rotateZ(-Math.PI / 2);
                parent.updateMatrixWorld(true);
                this.updateRelativeRotation();
                this.renderManager.needsUpdate = true;
                return true;
            }
            case "getbonecoords":
            case "getbonecoordswithboneindex": {
                if (context !== this.getParent()) throw new Error(`'${context.scriptClassId}' cannot use '${this.getParent().type}' bones.`);

                this.getComponent<AnimationComponent>("animation").getBoneWorldMatrix(name === "getbonecoords" ? call.args[0] as string : Math.max(0, Number(call.args[0])), tmpBoneMatrix, 0);
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

        const bone = parent.getUnrealScriptProperty("AttachmentBone"), profile = base.getCollisionProfile ? base.getCollisionProfile() : null;
        if (profile && !profile.worldGeometry && !parent.scriptBase && (!bone || bone === "None") && !parent.getUnrealScriptProperty("bOnlyDrawIfAttached") && (!parent.getUnrealScriptProperty("bHardAttach") || parent.getUnrealScriptProperty("Role") === ENetRole_T.ROLE_Authority)) {
            // AActor::SetBase 0x105006f9..0x10500740 stores world-center differences.
            const location = parent.getUnrealScriptProperty("Location") as Vector3Arr, baseLocation = (base as BaseActor).getUnrealScriptProperty("Location") as Vector3Arr;
            parent.setUnrealScriptProperty("RelativeLocation", location.map((value, index) => Math.fround(Math.fround(value) - Math.fround(baseLocation[index]))) as Vector3Arr);
            this.updateRelativeRotation();
        }

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

    public updateRelativeLocation(): void {
        const parent = this.getParent(), base = this.base as BaseActor | CollidingMesh;
        const bone = parent.getUnrealScriptProperty("AttachmentBone");

        if (!base || !base.getUnrealScriptProperty || parent.scriptBase || bone && bone !== "None" || parent.getUnrealScriptProperty("bOnlyDrawIfAttached")) return;

        // ULevel::MoveActor 0x1058c41d..0x1058c45c stores world-center differences.
        const location = parent.getUnrealScriptProperty("Location") as Vector3Arr, baseLocation = base.getUnrealScriptProperty("Location") as Vector3Arr;
        const relative = parent.getUnrealScriptProperty("RelativeLocation") as Vector3Arr;

        for (let i = 0; i < 3; i++) relative[i] = Math.fround(Math.fround(location[i]) - Math.fround(baseLocation[i]));
        parent.setUnrealScriptProperty("RelativeLocation", relative);
    }

    public checkBasedMovement(): void {
        for (const entry of this.basedActors) {
            const actor = entry as BaseActor;

            if (actor.scriptBase) continue;
            if (!actor.getCollisionProfile || !actor.getCollisionProfile().useCylinderCollision || !actor.findComponent<PawnMovementComponent>("pawnMovement")) throw new Error(`MoveActor attachment '${actor.name}' is not an ordinary cylinder pawn.`);
            if (actor.getUnrealScriptProperty("bHardAttach") && !actor.getUnrealScriptProperty("bBlockActors") && !actor.getUnrealScriptProperty("bBlockPlayers")) throw new Error(`MoveActor HardRelMatrix is not implemented for '${actor.name}'.`);
            actor.getComponent<TransformComponent>("transform").checkBasedMovement();
        }
    }

    public moveBasedActors(oldLocation: Vector3Arr, oldRotation: Vector3Arr): boolean {
        const parent = this.getParent(), physics = this.renderManager.getPhysicsManager();
        const rotation = parent.getUnrealScriptProperty("Rotation") as Vector3Arr, location = parent.getUnrealScriptProperty("Location") as Vector3Arr;
        const changed = rotation.some((value, index) => value !== oldRotation[index]);
        const deltaRotation = rotation.map((value, index) => (value & 0xfffc) - (oldRotation[index] & 0xfffc)) as Vector3Arr;
        const delta = location.map((value, index) => Math.fround(Math.fround(value) - Math.fround(oldLocation[index]))) as Vector3Arr;
        const script = parent.getComponent<ScriptComponent>("script"), vm = script.getVM();

        for (const entry of this.basedActors) {
            const actor = entry as BaseActor, movement = actor.findComponent<PawnMovementComponent>("pawnMovement");
            if (actor.scriptBase && !movement) continue;
            const controller = actor === this.renderManager.player ? this.renderManager.getParent().getComponent("asset").playerController : actor.getUnrealScriptProperty("Controller") as ScriptHost_T;

            if (controller) {
                if ((controller as any).isPlayerController || actor.getComponent<ScriptComponent>("script").getVM().invokeNative(actor, controller, 303, "IsA", ["PlayerController"])) {
                    if (getProperty(controller, "ViewTarget") !== parent) {
                        setProperty(controller, "bUseHoldCamera", true);
                        setProperty(controller, "CompensateYaw", Math.fround((getProperty(controller, "CompensateYaw") as number) + deltaRotation[1]));
                        setProperty(controller, "CopmensatePitch", Math.fround((getProperty(controller, "CopmensatePitch") as number) + deltaRotation[0]));
                    } else setProperty(controller, "Rotation", (getProperty(controller, "Rotation") as Vector3Arr).map((value, index) => (value + deltaRotation[index]) | 0));
                } else setProperty(controller, "Rotation", (getProperty(controller, "Rotation") as Vector3Arr).map((value, index) => (value + deltaRotation[index]) | 0));
            }
            const bone = actor.getUnrealScriptProperty("AttachmentBone");

            if (!actor.scriptBase && (!bone || bone === "None")) {
                this.basedMoveDelta.fromArray(delta);
                if (changed) {
                    // ULevel::MoveActor 0x1058bf5e..0x1058c0cb preserves these intermediate float stores.
                    tmpRotator.set(oldRotation[0], oldRotation[1], oldRotation[2]).rotateMatrix(tmpOldBaseCoords.identity());
                    tmpRotator.set(rotation[0], rotation[1], rotation[2]).rotateMatrix(tmpNewBaseCoords.identity());
                    const a = tmpOldBaseCoords.elements, b = tmpNewBaseCoords.elements, relative = actor.getUnrealScriptProperty("RelativeLocation") as Vector3Arr;
                    const x = a[1] * relative[1] + a[2] * relative[2] + a[0] * relative[0];
                    const y = a[5] * relative[1] + a[6] * relative[2] + a[4] * relative[0];
                    const z = a[9] * relative[1] + a[10] * relative[2] + a[8] * relative[0];
                    const px = Math.fround(Math.fround(Math.fround(b[0] * x) + Math.fround(b[4] * y)) + Math.fround(b[8] * z));
                    const py = Math.fround(Math.fround(Math.fround(b[1] * x) + Math.fround(b[5] * y)) + Math.fround(b[9] * z));
                    this.basedMoveDelta.x = Math.fround(Math.fround(px - relative[0]) + delta[0]);
                    this.basedMoveDelta.y = Math.fround(Math.fround(py - relative[1]) + delta[1]);
                    this.basedMoveDelta.z = Math.fround(Math.fround(Math.fround(b[2] * x) + b[6] * y + b[10] * z - relative[2]) + delta[2]);
                }
                actor.setUnrealScriptProperty("OldRotYaw", Math.fround((actor.getUnrealScriptProperty("OldRotYaw") as number) + deltaRotation[1]));
                actor.setUnrealScriptProperty("DesiredRotation", (actor.getUnrealScriptProperty("DesiredRotation") as Vector3Arr).map((value, index) => (value + deltaRotation[index]) | 0));
                movement.addBaseRotation(deltaRotation[1]);
                const childRotation = (actor.getUnrealScriptProperty("Rotation") as Vector3Arr).map((value, index) => (value + deltaRotation[index]) | 0) as Vector3Arr;
                this.basedMoveLocation.fromArray(actor.getUnrealScriptProperty("Location") as Vector3Arr);
                this.basedMoveExtent.set(actor.getCollisionRadius(), actor.getCollisionRadius(), actor.getCollisionHeight());
                this.basedMoveQuery.sourceActor = actor;
                this.basedMoveQuery.sourceIsPlayer = !!(actor as any).isPlayer;
                this.basedMoveQuery.sourceProfile = actor.getCollisionProfile();
                this.basedMoveQuery.sourceCollider = actor.getCollider();
                this.basedMoveQuery.sourceBody = actor.getRigidbody();
                try { physics.moveActor(this.basedMoveQuery, actor, childRotation); }
                finally {
                    this.basedMoveQuery.sourceActor = null;
                    this.basedMoveQuery.sourceProfile = null;
                    this.basedMoveQuery.sourceCollider = null;
                    this.basedMoveQuery.sourceBody = null;
                }
            }
            this.basedMoveLocation.fromArray(actor.getUnrealScriptProperty("Location") as Vector3Arr);
            this.basedMoveExtent.set(actor.getCollisionRadius(), actor.getCollisionRadius(), actor.getCollisionHeight());
            // Acknowledged passengers must not reject their own ship's turn at a railing.
            const passenger = (parent as any).isVehicle && actor.getUnrealScriptProperty("bGetOnVehicle");
            if (!passenger && physics.isBlockedBy(actor, parent, vm) && pointPrimitive(parent.getCollisionPrimitive(), this.basedMoveLocation, this.basedMoveExtent) && script.call("EncroachingOn", [actor])) return false;
            if (actor.getBaseActor() === parent) actor.getComponent<TransformComponent>("transform").updateBaseTransform(parent.getWorldPosition(tmpBasePosition), parent.getWorldQuaternion(tmpBaseQuaternion));
        }
        return true;
    }

    public rollbackBasedActors(delta: Vector3Arr): void {
        const parent = this.getParent(), physics = this.renderManager.getPhysicsManager();

        // ULevel::MoveActor 0x1058c2de..0x1058c36c reverses translation with test=true, preserving child rotation.
        for (const entry of this.basedActors) {
            const actor = entry as BaseActor;

            if (actor.scriptBase) continue;
            this.basedMoveLocation.fromArray(actor.getUnrealScriptProperty("Location") as Vector3Arr);
            this.basedMoveDelta.set(-delta[0], -delta[1], -delta[2]);
            this.basedMoveExtent.set(actor.getCollisionRadius(), actor.getCollisionRadius(), actor.getCollisionHeight());
            this.basedMoveQuery.sourceActor = actor;
            this.basedMoveQuery.sourceIsPlayer = !!(actor as any).isPlayer;
            this.basedMoveQuery.sourceProfile = actor.getCollisionProfile();
            this.basedMoveQuery.sourceCollider = actor.getCollider();
            this.basedMoveQuery.sourceBody = actor.getRigidbody();
            try { physics.moveActor(this.basedMoveQuery, actor, actor.getUnrealScriptProperty("Rotation") as Vector3Arr, true); }
            finally {
                this.basedMoveQuery.sourceActor = null;
                this.basedMoveQuery.sourceProfile = null;
                this.basedMoveQuery.sourceCollider = null;
                this.basedMoveQuery.sourceBody = null;
            }
            if (actor.getBaseActor() === parent) actor.getComponent<TransformComponent>("transform").updateBaseTransform(parent.getWorldPosition(tmpBasePosition), parent.getWorldQuaternion(tmpBaseQuaternion));
        }
    }

    public updateRelativeRotation(): void {
        const parent = this.getParent(), base = this.base as BaseActor | CollidingMesh;
        const bone = parent.getUnrealScriptProperty("AttachmentBone");

        if (!base || !base.getCollisionProfile || base.getCollisionProfile().worldGeometry || parent.scriptBase || bone && bone !== "None") return;

        // AActor::UpdateRelativeRotation 0x104f53e0: bSelfRotation uses a zero base rotation.
        const rotation = parent.getUnrealScriptProperty("Rotation") as Vector3Arr;
        const baseRotation = parent.getUnrealScriptProperty("bSelfRotation") ? [0, 0, 0] : base.getUnrealScriptProperty("Rotation") as Vector3Arr;
        tmpRotator.set(baseRotation[0], baseRotation[1], baseRotation[2]).rotateMatrix(tmpRelativeMatrix.identity(), true);
        tmpRotator.setFromRotationMatrix(tmpRelativeMatrix);
        const inversePitch = tmpRotator.pitch, inverseYaw = tmpRotator.yaw, inverseRoll = tmpRotator.roll;
        tmpRotator.set(rotation[0], rotation[1], rotation[2]).rotateMatrix(tmpRelativeMatrix.identity());
        tmpRotator.set(inversePitch, inverseYaw, inverseRoll).rotateMatrix(tmpRelativeMatrix);
        tmpRotator.setFromRotationMatrix(tmpRelativeMatrix);
        parent.setUnrealScriptProperty("RelativeRotation", [tmpRotator.pitch, tmpRotator.yaw, tmpRotator.roll]);
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
