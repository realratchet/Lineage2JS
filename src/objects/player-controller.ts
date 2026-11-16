import UnScriptVM, { getLatentAction, resetLatentAction, ScriptHost_T, ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";
import type { DecodeLibrary } from "@l2js/engine";
import type BaseActor from "../base-actor";
import type NpcLifecycleComponent from "./components/npc-lifecycle-component";
import { EPhysics_T } from "../assets/unreal/un-aactor";
import UNativeRegistry from "../ue-script/native-registry";
import type { Vector3Arr } from "@l2js/engine";
import type PawnMovementComponent from "../physics/components/pawn-movement-component";
import { GameObject, COMPONENT_EVENT_NOT_HANDLED } from "../game/components";
import { ScriptComponent } from "../game/script-component";
import ActorOwnershipComponent, { setActorOwner, type OwnedActor_T } from "./components/actor-ownership-component";
import { setScriptObjectProperty } from "./actor-properties";
import { findScriptPropertyKey, getScriptPropertyName } from "../ue-script/script-properties";

const f = Math.fround;
const KEYBOARD_TURNING_INTERVAL = f(0.1);

function getKeyboardMovingYaw(flags: number): number {
    switch (flags) {
        case 1: case 3: case 9: case 11: return 0;
        case 4: case 6: case 12: case 14: return 32768;
        default: return null;
    }
}

function getKeyboardMovingDirection(flags: number, rotation: Vector3Arr): Vector3Arr {
    const vector = UNativeRegistry.getNativeFunc("Rotator2Vector"), normal = UNativeRegistry.getNativeFunc(226);
    let direction: Vector3Arr = [0, 0, 0];

    if (flags & 1) direction = vector([rotation[0], rotation[1], 0]) as Vector3Arr;
    else if (flags & 4) direction = vector([-rotation[0] | 0, rotation[1] + 32768 | 0, 0]) as Vector3Arr;

    if (flags & 10) {
        const side = vector([0, rotation[1] + (flags & 2 ? 16384 : -16384) | 0, 0]) as Vector3Arr;

        direction = normal(direction) as Vector3Arr;
        direction = [f(direction[0] + side[0]), f(direction[1] + side[1]), f(direction[2] + side[2])];
    }

    if (flags & 48) {
        direction = normal(direction) as Vector3Arr;
        direction[2] = f(direction[2] + (flags & 16 ? 1 : -1));
    }

    return normal(direction) as Vector3Arr;
}

export class PlayerController extends GameObject implements ScriptHost_T {
    public readonly scriptClassId: string;
    public readonly scriptProperties = new Map<string, ScriptValue_T>();
    public isEnterChatting = false;
    protected readonly scriptVM: UnScriptVM;

    public constructor(library: DecodeLibrary) {
        super();

        (this as any).isPlayerController = true;
        this.scriptClassId = Object.keys(library.scriptClasses).find(id => id.toLowerCase() === "engine.lineageplayercontroller");

        if (!this.scriptClassId) throw new Error("UnrealScript class 'Engine.LineagePlayerController' is missing.");

        this.scriptVM = new UnScriptVM(library);
        this.scriptVM.initializeHost(this);

        const script = this.addComponent(new ScriptComponent(this.scriptVM, classId => {
            debugger;
            throw new Error(`Player controller object construction for '${classId}' is not implemented.`);
        }, this.scriptClassId, false));

        this.addComponent(new ActorOwnershipComponent());
        script.beginPlay();
    }

    public call(name: string, args: ScriptValue_T[] = []): ScriptValue_T { return this.scriptVM.call(this, name, args); }
    public initInputSystem(): void {
        this.scriptVM.loadFunctions();
        this.call("InitInputSystem");
    }
    public processState(deltaTime: number): void { this.scriptVM.processState(this, deltaTime); }
    public updateTimers(deltaTime: number): void { this.getComponent<ScriptComponent>("script").updateTimers(deltaTime); }

    public getUnrealScriptProperty(id: string): ScriptValue_T {
        if (this.scriptProperties.has(id)) return this.scriptProperties.get(id);

        const key = findScriptPropertyKey(this.scriptProperties, getScriptPropertyName(id));

        return key === undefined ? null : this.scriptProperties.get(key);
    }

    public setUnrealScriptProperty(id: string, value: ScriptValue_T): void { setScriptObjectProperty(this, id, value); }

    public setPawn(pawn: BaseActor): void {
        const previous = this.scriptProperties.get("Pawn") as BaseActor, target = this.scriptProperties.get("ViewTarget");

        if (!pawn && previous) {
            this.setCameraMode(0);
            this.scriptVM.gotoState(this, "None");
            this.scriptVM.invokeNative(this, this, 280, "SetTimer", [0, false]);
            if (this.scriptOwner) setActorOwner(this, null);

            const ownership = this.getComponent<ActorOwnershipComponent>("actorOwnership"),
                arrChildren = this.scriptProperties.get("Child") as OwnedActor_T[];

            for (let index = arrChildren.length - 1; index >= 0; index--)
                if (arrChildren[index]) ownership.loseScriptChild(arrChildren[index]);

            arrChildren.length = 0;
            previous.getComponent<NpcLifecycleComponent>("npcLifecycle").setController(null);
        }

        this.scriptProperties.set("Pawn", pawn);
        this.scriptProperties.set("Level", pawn ? pawn.getUnrealScriptProperty("Level") : null);
        if (pawn) pawn.getComponent<NpcLifecycleComponent>("npcLifecycle").setController(this);
        if (!pawn || !target || target === previous || target === this) this.scriptProperties.set("ViewTarget", pawn || this);
    }

    public setCameraMode(mode: number): boolean { // UGameEngine::OnCameraMode 0x10477410..0x104776f5.
        const properties = this.scriptProperties, pawn = properties.get("Pawn") as BaseActor;

        if (!pawn || !properties.get("Level")) return false;

        const walking = mode === 1;

        if (!walking && !properties.get("bCameraWalking")) return false;

        properties.set("bCameraWalking", walking);
        properties.set("bUseAutoTrackingPawn", false);
        if (walking) properties.set("CameraModeTarget", null);

        pawn.setUnrealScriptProperty("Physics", walking ? EPhysics_T.PHYS_Flying : EPhysics_T.PHYS_Walking);
        pawn.setUnrealScriptProperty("Environment", walking ? 2 : 0);
        pawn.setUnrealScriptProperty("fMaxAirSpeed", walking ? 800 : 120);
        pawn.setUnrealScriptProperty("AirSpeed", walking ? 0 : 120);

        const index = walking ? 1 : 0;
        const disableZoom = !!((properties.get("FixedDefaultCameraDisableZoom") as number[])[index] & 1);

        for (const field of ["Yaw", "Pitch", "Dist"]) {
            properties.set(`DefaultCamera${field}`, (properties.get(`FixedDefaultCamera${field}`) as number[])[index]);
            properties.set(`bUseDefaultCamera${field}`, true);
        }

        properties.set("CameraViewHeightAdjust", (properties.get("FixedDefaultCameraViewHeight") as number[])[index]);
        properties.set("bDisableZoom", disableZoom);
        properties.set("bCameraMovingToDefault", true);
        pawn.setUnrealScriptProperty("bHidden", walking || disableZoom);
        if (!walking) {
            const rotation = pawn.getUnrealScriptProperty("Rotation") as number[];

            properties.set("SavedViewTargetYaw", rotation[1]);
            properties.set("SavedViewTargetPitch", rotation[0]);
        }

        this.isEnterChatting = walking;
        return true;
    }

    public resetKeyboardMoving(direction: number, pressed: boolean, quickRelease = false): Vector3Arr | null | undefined { // ALineagePlayerController::ResetKeyboardMoving 0x10538ea0..0x10539470, network/replay paths.
        const properties = this.scriptProperties, pawn = properties.get("Pawn") as BaseActor;

        if (!pawn) throw new Error(`Keyboard movement requires a pawn.`);

        const previous = properties.get("KeyboardMovingDirFlg") as number,
            flags = pressed ? previous | direction : previous & (direction ^ 255);

        properties.set("KeyboardMovingDirFlg", flags);
        properties.set("KeyboardMovingPendingTime", 0);
        properties.set("ShouldTurnToMovingDir", false);

        const rotation = properties.get("Rotation") as Vector3Arr, origin = pawn.getUnrealScriptProperty("Location") as Vector3Arr;

        if (properties.get("bCameraWalking")) {
            properties.set("bUseAutoTrackingPawn", false);

            let velocity = getKeyboardMovingDirection(flags, rotation), distance = pawn.getUnrealScriptProperty("fMaxAirSpeed") as number;

            if (Math.hypot(...velocity) === 0) {
                velocity = getKeyboardMovingDirection(previous, rotation);
                if (pawn.getUnrealScriptProperty("CameraWalkingAccelMode") === 2) return null;

                const speed = pawn.getUnrealScriptProperty("AirSpeed") as number,
                    acceleration = pawn.getUnrealScriptProperty("fAirSpeedAccel") as number;

                distance = (speed / acceleration + 0.5) * speed * 0.5;
            }

            return [f(origin[0] + velocity[0] * distance), f(origin[1] + f(velocity[1] * distance)), f(origin[2] + f(velocity[2] * distance))];
        }

        const relativeYaw = getKeyboardMovingYaw(flags);
        let yaw = rotation[1], distance: number;

        if (relativeYaw === null) {
            const moving = properties.get("bKeyboardMoving") || properties.get("bDesiredKeyboardMoving");

            if (moving) {
                properties.set("bKeyboardMoving", false);
                properties.set("bDesiredKeyboardMoving", false);
                distance = pawn.getComponent<PawnMovementComponent>("pawnMovement").getCurSpeed() * 0.2;
            }

            properties.set("TurningPendingTime", 0);
            properties.set("KeyboardMovingDirFlg", 0);
            properties.set("bDesiredKeyboardMovingPermanently", quickRelease);
            pawn.setUnrealScriptProperty("bTurning", false);
            if (!moving) return null;
        } else {
            yaw = rotation[1] + relativeYaw | 0;
            properties.set("KeyboardMovingDir", yaw);
            properties.set("bDesiredKeyboardMovingPermanently", false);
            properties.set("bDesiredKeyboardMoving", true);
            distance = (pawn.getUnrealScriptProperty("GroundSpeed") as number) * 5;

            const side = flags & 10;

            if (side === 2 || side === 8) {
                const desired = (pawn.getUnrealScriptProperty("DesiredRotation") as Vector3Arr).slice() as Vector3Arr;

                properties.set("ShouldTurnToMovingDir", true);
                properties.set("TurningPendingTime", 0);
                desired[1] = yaw;
                pawn.setUnrealScriptProperty("DesiredRotation", desired);
                pawn.setUnrealScriptProperty("bTurning", true);
                pawn.setUnrealScriptProperty("TurningDir", relativeYaw === 0 ? side === 2 ? 1 : -1 : side === 2 ? -1 : 1);
            } else pawn.setUnrealScriptProperty("bTurning", false);
        }

        const velocity = UNativeRegistry.getNativeFunc("Rotator2Vector")([0, yaw, 0]) as Vector3Arr;

        return [f(origin[0] + velocity[0] * distance), f(origin[1] + f(velocity[1] * distance)), f(origin[2] + f(velocity[2] * distance))];
    }

    public stopMove(): void { // AController::StopMove 0x1053b4a0..0x1053b7ea.
        const properties = this.scriptProperties, pawn = properties.get("Pawn") as BaseActor;

        properties.set("ReservedMovePoint", []);
        properties.set("ReservedMoveActor", null);
        if (pawn) {
            const origin = pawn.getUnrealScriptProperty("Location") as Vector3Arr,
                rotation = pawn.getUnrealScriptProperty("Rotation") as Vector3Arr;

            properties.set("MoveTarget", null);
            properties.set("Focus", null);
            properties.set("FocalPoint", origin.slice());
            properties.set("DesiredRotation", (properties.get("Rotation") as Vector3Arr).slice());
            properties.set("bRotateToDesired", false);
            pawn.setUnrealScriptProperty("DesiredRotation", rotation.slice());
            pawn.setUnrealScriptProperty("bNotRotationMoving", false);
            pawn.setUnrealScriptProperty("bRotateToDesired", false);
            pawn.setUnrealScriptProperty("bVehicleTargetMove", false);
            pawn.setUnrealScriptProperty("Acceleration", [0, 0, 0]);
            if (properties.get("bCameraWalking")) {
                const velocity = UNativeRegistry.getNativeFunc("Rotator2Vector")(rotation) as Vector3Arr,
                    speed = pawn.getUnrealScriptProperty("AirSpeed") as number;

                properties.set("Destination", [f(origin[0] + f(f(velocity[0] * speed * 10) * 0.5)), f(origin[1] + f(velocity[1] * speed * 5)), f(origin[2] + f(velocity[2] * speed) * 5)]);
            }

            resetLatentAction(this);
            properties.set("bKeyboardMoving", false);
            properties.set("bDesiredKeyboardMoving", false);
        }
    }

    public tickKeyboardMoving(deltaTime: number, network: boolean): Vector3Arr {
        const properties = this.scriptProperties, pawn = properties.get("Pawn") as BaseActor;

        if (!pawn || !properties.get("bKeyboardMoving") && !properties.get("bKeyboardMovingPermanently")) return null;

        const turning = pawn.getUnrealScriptProperty("bTurning"), rotation = pawn.getUnrealScriptProperty("Rotation") as Vector3Arr;
        let yaw = properties.get("KeyboardMovingDir") as number;

        // ALineagePlayerController::Tick 0x10597673..0x105979e2.
        if (turning) {
            const delta = (pawn.getUnrealScriptProperty("TurningDir") as number) * (pawn.getUnrealScriptProperty("KayboardRotationRate") as Vector3Arr)[1] * f(deltaTime);

            properties.set("ManuallyCameraYaw", f((properties.get("ManuallyCameraYaw") as number) + delta));
            if (properties.get("ShouldTurnToMovingDir")) {
                while ((yaw - rotation[1] | 0) < -32767) yaw = yaw + 65536 | 0;
                while ((yaw - rotation[1] | 0) > 32768) yaw = yaw - 65536 | 0;
                if ((yaw - 100 | 0) < rotation[1] && rotation[1] < (yaw + 100 | 0)) properties.set("ShouldTurnToMovingDir", false);
            } else yaw = Math.trunc(rotation[1] + delta) | 0;

            properties.set("KeyboardMovingDir", yaw);
            pawn.setUnrealScriptProperty("DesiredRotation", [rotation[0], yaw, rotation[2]]);
        }
        // AController::MoveTo holds a latent action; actor locomotion is owned by PawnMovementComponent here.
        if (network && (getLatentAction(this) || pawn.isLocomoting())) {
            const pending = (properties.get("KeyboardMovingPendingTime") as number) + f(deltaTime), interval = turning ? KEYBOARD_TURNING_INTERVAL : 3;

            properties.set("KeyboardMovingPendingTime", f(pending));
            if (pending <= interval) return null;

            properties.set("KeyboardMovingPendingTime", f(pending - interval));
        }

        const velocity = UNativeRegistry.getNativeFunc("Rotator2Vector")([0, yaw, 0]) as Vector3Arr,
            distance = (pawn.getUnrealScriptProperty("GroundSpeed") as number) * 5,
            origin = pawn.getUnrealScriptProperty("Location") as Vector3Arr;

        return [f(origin[0] + f(velocity[0] * distance)), f(origin[1] + f(velocity[1] * distance)), f(origin[2] + f(velocity[2] * distance))];
    }

    public getUnderWaterLoopSound(): string {
        const value = this.scriptProperties.get("UnderWaterLoopSound");

        if (typeof value !== "string") throw new Error(`'${this.scriptClassId}.PostBeginPlay' did not load UnderWaterLoopSound.`);

        return value;
    }

    public resolveUnrealObject(id: string): string { return id; }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        if (call.index === 299 || call.name.toLowerCase() === "setrotation") {
            if (call.context !== this) throw new Error(`'${this.scriptClassId}' cannot rotate '${call.context.scriptClassId}'.`);
            if (this.scriptProperties.get("bStatic") || !this.scriptProperties.get("bMovable")) return false;

            const rotation = (call.args[0] as Vector3Arr).map(value => value | 0) as Vector3Arr,
                previous = this.scriptProperties.get("Rotation") as Vector3Arr;

            if (rotation.every((value, index) => value === previous[index])) return true;

            if (this.scriptProperties.get("Base") || (this.scriptProperties.get("Attached") as ScriptValue_T[]).length ||
                this.scriptProperties.get("Mesh") || this.scriptProperties.get("StaticMesh") || this.scriptProperties.get("AntiPortal"))
                throw new Error(`SetRotation with a base, attachments or custom primitive is not implemented for '${this.scriptClassId}'.`);

            if (!this.scriptProperties.get("Level")) throw new Error(`SetRotation requires a level for '${this.scriptClassId}'.`);

            // ULevel::MoveActor 0x1058b4f4..0x1058b584; UPrimitive::UseCylinderCollision returns true.
            this.scriptProperties.set("Rotation", rotation);
            return true;
        }

        switch (call.name.toLowerCase()) {
            case "setviewtarget":
                this.scriptProperties.set("ViewTarget", call.args[0] as ScriptValue_T);
                return undefined;
            default: {
                const result = this.getComponent<ScriptComponent>("script").dispatchNative(call);

                if (result !== COMPONENT_EVENT_NOT_HANDLED) return result;

                throw new Error(`UnrealScript native '${call.name}' (${call.index}) is not implemented for '${this.scriptClassId}'.`);
            }
        }
    }
}

export default PlayerController;
