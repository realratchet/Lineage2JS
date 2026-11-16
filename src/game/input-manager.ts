import { EInputKey_T, EInputAction_T } from "@l2js/engine/un-interactions";
import loginServer from "../network/login-server";
import { Box3, Camera, Raycaster, Vector2, Vector3 } from "three";
import { IEngineComponent } from "./components";
import { getProperty, setProperty, getInputProperties } from "../ue-script/vm";
import type { ScriptHost_T } from "../ue-script/vm";
import type { IScriptFieldDecodeInfo } from "../assets/unreal/contracts/script";
import { ZUpOrbitControls } from "../rendering/camera/controllers/zup-orbit-controls";
import { ZUpPointerLockControls } from "../rendering/camera/controllers/zup-pointer-lock-controls";
import type GameManager from "./game-manager";
import type RenderManager from "../rendering/render-manager";
import type PhysicsManager from "../physics/physics-manager";
import type PawnMovementComponent from "../physics/components/pawn-movement-component";
import type { ICollidable } from "../objects/objects";
import type BaseActor from "../base-actor";
import type GroundPickup from "../objects/ground-pickup";
import type CollidingMesh from "../objects/colliding-mesh";
import type StaticMeshActor from "../objects/static-mesh-actor";
import { EActorViewType_T } from "../assets/unreal/un-aactor";
import type { CollisionQuery_T } from "../physics/collision-world";
import SpecialView from "../rendering/camera/special-view";
import VolumeCamera from "../rendering/camera/volume-camera";
import BehindViewCamera from "../rendering/camera/behind-view-camera";
import { sinRotator } from "../assets/unreal/utils/rotator";
import type { ReplayScene_T, ReplayCameraInstruction_T } from "../network/l2-replay-file";
import type { Vector3Arr } from "@l2js/engine";
import { PStopType_T } from "../objects/components/npc-lifecycle-component";
import InputBindings, { parseInputCommand, parseInputNumber, parseInputToken } from "./input-bindings";
import type { InputCommandExecutor_T } from "./input-bindings";
import type ConfigCache from "../ue-script/config-cache";
import { isReplayCameraInput } from "../network/l2-replay-input";

const CLICK_MAX_MOVEMENT_SQ = 16;
const MOUSE_TARGET_INTERVAL_MS = 50;
const tmpScreenPosition = new Vector2();
const tmpMouseIntersection = new Vector3();
const tmpPickBounds = new Box3();
const dirForward = new Vector3();
const dirRight = new Vector3();
const cameraVelocity = new Vector3();
const tmpCameraView = new Vector3();
const tmpCameraTraceStart = new Vector3();
const tmpCameraTraceDelta = new Vector3();
const tmpVolumeOffset = new Vector3();
const tmpVolumeRotation: Vector3Arr = [0, 0, 0];
const hitCheckCameraExtent = new Vector3(0.1, 0.1, 0.1);
const tmpCameraUp = new Vector3();
const tmpKeyboardDestination = new Vector3();
const tmpKeyboardOrigin = new Vector3();
const arrMouseIntersections: THREE.Intersection[] = [];
const tmpCameraFloat = new Float32Array(1);
const tmpCameraBits = new Uint32Array(tmpCameraFloat.buffer);
type ReplayCameraState_T = {
    height: number,
    adjusted: boolean,
    rotating: boolean,
    yaw: number,
    pitch: number,
    rightMouseDownTime: number,
    preset: [string, any][],
    pawn: [string, any][],
    hidden: boolean,
    enableRotate: boolean
};

function lookAtCameraRotation(camera: Camera, pitch: number, yaw: number): void {
    const sinPitch = sinRotator(pitch);

    tmpCameraUp.copy(camera.up);
    camera.up.set(-sinPitch * sinRotator(yaw + 16384), -sinPitch * sinRotator(yaw), sinRotator(pitch + 16384));
    camera.lookAt(tmpCameraView.copy(camera.position).add(dirForward));
    camera.up.copy(tmpCameraUp);
}

function addCameraRotation(value: number, delta: number): number {
    if (Number.isNaN(value) && Number.isNaN(delta)) {
        tmpCameraFloat[0] = value;
        const left = tmpCameraBits[0];
        tmpCameraFloat[0] = delta;
        const right = tmpCameraBits[0];
        // x87 FADD selects the larger NaN payload, then the positive sign on equal payloads.
        const a = left & 0x7fffffff, b = right & 0x7fffffff;

        return Math.fround(a > b || a === b && left < right ? value : delta);
    }
    return Math.fround(value + delta);
}
function getBatchIntersectionActor(intersection: THREE.Intersection): { actorIndex: number, actorName: string, actorUuid: string } | null {
    const object = intersection.object as any;

    if (!object.isBatch || !intersection.face || !object.perActorAmbient || !object.batchElements) return null;

    const vertexIndex = intersection.face.a;

    for (let actorIndex = 0; actorIndex < object.perActorAmbient.length; actorIndex++) {
        const actor = object.perActorAmbient[actorIndex];

        if (vertexIndex >= actor.startVertex && vertexIndex < actor.startVertex + actor.count) {
            const actorUuid = object.batchActorUuids[actorIndex];
            const actorName = actorUuid.slice(actorUuid.indexOf("_") + 1, actorUuid.lastIndexOf("_"));

            return { actorIndex, actorName, actorUuid };
        }
    }

    return null;
}

function isLandmarkSurface(actor: ICollidable | null): boolean {
    if (!actor) return false;
    if ((actor as any).isTerrain || (actor as any).isStaticMeshActor || (actor as any).isVehicle) return true;

    const primitive = actor.getCollisionPrimitive ? actor.getCollisionPrimitive() : null;

    return !!primitive && primitive.kind === "bsp";
}

const HALF_PI = Math.PI / 2;
const MAX_ORBIT_PITCH = Math.PI / 2 - 1e-6;
const MAX_ACTOR_DELTA = Math.fround(0.4);
const MIN_ACTOR_DELTA = Math.fround(0.0005);
const INPUT_AXIS_SCALE = Math.fround(0.01);
const CAMERA_HEIGHT_STEP_SCALE = Math.fround(0.8);
type InputSource_T = "physical" | "injected";

const FOLLOW_CAMERA_DISTANCE = 300;
const FOLLOW_CAMERA_HEIGHT = 120;
const arrKeyboardCommands = ["KeyboardMoveStart", "KeyboardMoveFinish", "LeftTurningStart", "LeftTurningFinish", "RightTurningStart", "RightTurningFinish", "ModMaxAirSpeedStart", "ModMaxAirSpeedFinish", "KeyboardPermanentMove"];
const arrCameraCommands = ["CameraRotationOn", "CameraRotationOff", "UseAutoTrackingPawnOn", "UseAutoTrackingPawnOff"];
const arrCameraAxes = ["CameraYaw", "CameraPitch"];
const arrCameraZoomCommands = ["ZoomInPress", "ZoomOutPress"];
const arrInputButtons = ["Button", "Pulse", "Toggle", "Count"];
const keyboardKeyNames: Record<string, string> = {
    ControlLeft: "Ctrl", ControlRight: "Ctrl", ShiftLeft: "Shift", ShiftRight: "Shift", AltLeft: "Alt", AltRight: "Alt",
    ArrowLeft: "Left", ArrowUp: "Up", ArrowRight: "Right", ArrowDown: "Down", PrintScreen: "PrintScrn",
    NumpadMultiply: "GreyStar", NumpadAdd: "GreyPlus", NumpadSubtract: "GreyMinus", NumpadDivide: "GreySlash", NumpadDecimal: "NumPadPeriod", NumpadEnter: "Enter",
    Backquote: "Tilde", BracketLeft: "LeftBracket", BracketRight: "RightBracket", Quote: "SingleQuote", Equal: "Equals", NumpadComma: "Separator"
};

function getKeyboardKey(code: string, bindings: InputBindings): EInputKey_T | null {
    if (/^Key[A-Z]$/.test(code)) return bindings.getKey(code.slice(3));
    if (/^Digit[0-9]$/.test(code)) return bindings.getKey(code.slice(5));
    if (/^Numpad[0-9]$/.test(code)) return bindings.getKey(`NumPad${code.slice(6)}`);
    return bindings.getKey(keyboardKeyNames[code] || code);
}

function findInputProperty(actor: ScriptHost_T, name: string, type: "Byte" | "Float"): IScriptFieldDecodeInfo | null {
    const properties = getInputProperties(actor), lowerName = name.toLowerCase();

    for (let index = 0; index < properties.length; index++) {
        const field = properties[index];

        if (field.type === type && field.name.toLowerCase() === lowerName) return field;
    }
    return null;
}

function getInputValue(actor: ScriptHost_T, field: IScriptFieldDecodeInfo): number {
    const value = getProperty(actor, field.id);
    const result = field.arrayDimensions > 1 ? (value as number[])[0] : value;

    if (typeof result !== "number") throw new Error(`Input property '${field.id}' has no numeric value.`);
    return result;
}

function setInputValue(actor: ScriptHost_T, field: IScriptFieldDecodeInfo, value: number): void {
    if (field.arrayDimensions > 1) {
        const array = getProperty(actor, field.id) as number[];

        array[0] = value;
        setProperty(actor, field.id, array);
    } else setProperty(actor, field.id, value);
}

export class InputManager implements IEngineComponent<GameManager> {
    public speedCameraFPS = 5;
    public readonly raycaster = new Raycaster();
    public readonly controls: { orbit: ZUpOrbitControls, fps: ZUpPointerLockControls } = { orbit: null, fps: null };

    protected manGame: GameManager;
    protected inputBindings: InputBindings = null;
    protected renderManager: RenderManager;
    protected physicsManager: PhysicsManager;
    protected readonly hitCheckCameraQuery: CollisionQuery_T = { location: tmpCameraTraceStart, delta: tmpCameraTraceDelta, extent: hitCheckCameraExtent, sourceIsPlayer: false, ignorePawns: true }; // TRACE_World 0x86
    protected readonly dirKeys = { left: false, right: false, up: false, down: false, shift: false };
    protected readonly mouseDownPosition = new Vector2();
    protected readonly mousePosition = new Vector2();
    protected isMouseInViewport = false;
    protected mousePickDistance = 0;
    protected mouseTarget: ICollidable = null;
    protected mouseCursor = 0;
    protected mousePickup: GroundPickup = null;
    protected lastMouseTargetTime = -Infinity;
    protected isOrbitControls = true;
    protected isPrimaryMouseDown = false;
    protected hasMouseDragged = false;
    protected followPlayer = false;
    protected isCameraLocked = false;
    protected isFreeCamera = false;
    protected isPawnFreeCamera = false;
    protected isCameraHeightAdjusted = false;
    protected replayCameraState: ReplayCameraState_T = null;
    protected readonly specialView = new SpecialView(this);
    protected volumeCamera: VolumeCamera;
    protected behindViewCamera: BehindViewCamera;
    protected shiftTimeDown = 0;
    protected rightMouseDownTime = -Infinity;
    protected activeSector = 0;
    protected readonly keyboardMovingKeys = new Map<EInputKey_T, number>();
    protected readonly arrInputDurations = new Float64Array(255);
    protected readonly keyDownHandler: (event: KeyboardEvent) => void;
    protected readonly keyUpHandler: (event: KeyboardEvent) => void;
    protected readonly mouseDownHandler: (event: MouseEvent) => void;
    protected readonly mouseMoveHandler: (event: MouseEvent) => void;
    protected readonly mouseUpHandler: (event: MouseEvent) => void;
    protected readonly inputCommandExecutor: InputCommandExecutor_T;

    public constructor() {
        this.keyDownHandler = this.onHandleKeyDown.bind(this);
        this.keyUpHandler = this.onHandleKeyUp.bind(this);
        this.mouseDownHandler = this.onHandleMouseDown.bind(this);
        this.mouseMoveHandler = this.onHandleMouseMove.bind(this);
        this.mouseUpHandler = this.onHandleMouseUp.bind(this);
        this.inputCommandExecutor = this.executeInputCommand.bind(this);
    }

    public setParent(parent: GameManager): this {
        this.manGame = parent;
        return this;
    }
    public getParent(): GameManager { return this.manGame; }
    public initBindings(config: ConfigCache): void {
        this.inputBindings = new InputBindings(config);
    }

    public async onInit(): Promise<this> {
        const renderManager = this.renderManager = this.manGame.getComponent("render");
        const viewport = renderManager.viewport;

        this.physicsManager = this.manGame.getComponent("physics");
        this.volumeCamera = new VolumeCamera(this.physicsManager);
        this.behindViewCamera = new BehindViewCamera(this.physicsManager);
        this.controls.orbit = new ZUpOrbitControls(renderManager.camera, renderManager.renderer.domElement);
        this.controls.fps = new ZUpPointerLockControls(renderManager.camera, renderManager.renderer.domElement);
        this.controls.orbit.target.copy(renderManager.cameraTarget);
        this.controls.orbit.update();
        this.controls.orbit.onCameraInput = (action, yaw, pitch) => {
            if (action === "axis" && (yaw !== 0 || pitch !== 0)) this.rightMouseDownTime = -Infinity;
            const network = this.manGame.getComponent("network");

            if (network.isInWorld() && (action === "release" || this.followPlayer && !this.isCameraLocked && (action === "wheel" || !this.manGame.getComponent("asset").playerController.scriptProperties.get("bCameraWalking")))) {
                if (action === "axis") network.getGameClient().recordCameraInput("press", 0, 0);
                network.getGameClient().recordCameraInput(action, yaw, pitch);
            }
            if (action === "axis" && (Math.abs(yaw) > 100 || Math.abs(pitch) > 100) && network.isInWorld() && !network.getGameClient().isPlayingReplay()) network.checkTutorialClientEvent(2); // UInput::Exec 0x85037b, 0x8504f5
        };
        this.controls.orbit.onCameraZoom = (direction, distance) => {
            if (!this.manGame.getComponent("network").isInWorld() || !this.followPlayer) return null;

            const properties = this.manGame.getComponent("asset").playerController.scriptProperties;

            if (this.isCameraLocked || properties.get("bDisableZoom") || properties.get("bCameraSpecialMove") || properties.get("bCameraMovingToSpecial")) return distance;

            const replay = this.replayCameraState !== null;
            const minimum = properties.get("MinZoomingDist") as number, maximum = properties.get("MaxZoomingDist") as number, zoom = Math.fround(replay ? properties.get("CurZoomingDist") as number : distance - 250);
            // UInput::Exec ZoomInPress/ZoomOutPress 0x84adfc..0x84b066.
            const step = minimum + this.renderManager.player.getCollisionHeight() * 2 > zoom ? 2.5 : 20;
            const next = Math.fround(zoom + (direction > 0 ? -step : step));

            if (direction > 0 ? next < minimum && !this.isCameraHeightAdjusted : this.isCameraHeightAdjusted) {
                const height = this.renderManager.player.getCollisionHeight() * Math.fround(0.8);

                properties.set("CameraViewHeightAdjust", Math.fround((properties.get("CameraViewHeightAdjust") as number) + (direction > 0 ? height : -height)));
                this.isCameraHeightAdjusted = direction > 0;
            }

            const value = direction > 0 ? Math.max(minimum, next) : Math.min(maximum, next);

            properties.set("CurZoomingDist", value);
            properties.set("DesiredZoomingDist", value);
            if (!replay) this.manGame.getComponent("network").checkTutorialClientEvent(4); // UInput::Exec 0x84b066..0x84b083
            return replay ? Math.max(1e-6, Math.abs(value + 250)) : value + 250;
        };
        this.controls.orbit.addEventListener("change", () => {
            renderManager.needsUpdate = true;
            if (!this.replayCameraState) this.updateControllerRotation();
        });
        this.controls.fps.addEventListener("change", () => renderManager.needsUpdate = true);
        this.controls.fps.addEventListener("lock", this.onPointerControlsLocked.bind(this));
        this.controls.fps.addEventListener("unlock", this.onPointerControlsUnlocked.bind(this));

        viewport.addEventListener("mousedown", this.mouseDownHandler);
        window.addEventListener("mousemove", this.mouseMoveHandler, true);
        window.addEventListener("mouseout", event => { if (!event.relatedTarget) this.isMouseInViewport = false; });
        viewport.addEventListener("mouseup", this.mouseUpHandler);
        window.addEventListener("keydown", this.keyDownHandler);
        window.addEventListener("keydown", event => {
            if (event.code !== "Backquote" || !event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;

            event.preventDefault();
            event.stopPropagation();
            this.manGame.getComponent("ui").toggleDebugView();
        }, true);
        window.addEventListener("keyup", this.keyUpHandler);
        window.addEventListener("blur", () => {
            this.releaseKeyboardMovingKeys();
            this.resetInput();
        });
        window.addEventListener("focus", () => this.resetInput());

        return this;
    }

    public getOrbitTarget(): Vector3 { return this.controls.orbit.target; }
    public isUsingOrbitControls(): boolean { return this.isOrbitControls; }
    public isFollowingPlayer(): boolean { return this.followPlayer || this.isPawnFreeCamera; }
    public isCameraInputLocked(): boolean { return this.isCameraLocked; }
    public isFreeCameraEnabled(): boolean { return this.isFreeCamera; }

    public setFreeCamera(enabled: boolean): void {
        if (enabled && this.isCameraLocked) return;
        if (enabled === this.isFreeCamera) return;

        this.isFreeCamera = enabled;
        if (enabled) this.controls.fps.lock();
        else if (this.controls.fps.isLocked) this.controls.fps.unlock();
        else this.onPointerControlsUnlocked();
    }

    public setCameraLocked(isLocked: boolean): void {
        if (isLocked) this.specialView.reset();

        this.isCameraLocked = isLocked;
        this.controls.orbit.enabled = !isLocked;

        if (isLocked) {
            this.setFreeCamera(false);
            this.setFollowPlayer(false);
        }
    }

    public resetFollowCamera(): void {
        const renderManager = this.renderManager;
        const yaw = renderManager.player.getRotationYaw() * Math.PI / 32768;

        renderManager.player.getCameraTargetPosition(this.controls.orbit.target);
        renderManager.camera.position.set(-Math.cos(yaw) * FOLLOW_CAMERA_DISTANCE, -Math.sin(yaw) * FOLLOW_CAMERA_DISTANCE, FOLLOW_CAMERA_HEIGHT).add(this.controls.orbit.target);
        this.controls.orbit.unclippedDistance = 0;
        this.controls.orbit.update();

        const properties = this.manGame.getComponent("asset").playerController.scriptProperties;
        const zoom = Math.fround(renderManager.camera.position.distanceTo(this.controls.orbit.target) - 250);

        properties.set("CurZoomingDist", zoom);
        properties.set("DesiredZoomingDist", zoom);
        this.setFollowPlayer(true);
        renderManager.updateCameraMatrices();
        this.updateControllerRotation();
    }

    public setFollowPlayer(follow: boolean): void {
        if (!follow) this.releaseKeyboardMovingKeys();

        this.followPlayer = follow;
        this.controls.orbit.setNativeLikeControls(follow);
        this.renderManager.onFollowPlayerChanged(follow);
    }

    public startReplayCamera(scene: ReplayScene_T): void {
        const render = this.renderManager,
            asset = this.manGame.getComponent("asset"),
            properties = asset.playerController.scriptProperties;

        if (this.replayCameraState) throw new Error(`Replay camera is already active.`);

        const preset: [string, any][] = [
            "CurFixedDefaultCameraNo",
            "bDisableZoom",
            "DefaultCameraYaw",
            "DefaultCameraPitch",
            "DefaultCameraDist",
            "bCameraMovingToDefault",
            "bUseDefaultCameraYaw",
            "bUseDefaultCameraPitch",
            "bUseDefaultCameraDist",
            "SavedViewTargetYaw",
            "SavedViewTargetPitch",
            "CurZoomingDist",
            "DesiredZoomingDist",
            "OldZoomingDist",
            "OldCameraRotation",
            "OldCameraLocation",
            "OldViewTargetLocation",
            "Location",
            "Rotation",
            "CurVolumeCameraRadius",
            "bUseAutoTrackingPawn",
            "KeyboardMovingDirFlg",
            "KeyboardMovingPendingTime",
            "ShouldTurnToMovingDir",
            "bKeyboardMovingPermanently",
            "bKeyboardMoving",
            "bDesiredKeyboardMoving",
            "bDesiredKeyboardMovingPermanently",
            "KeyboardMovingDir",
            "TurningPendingTime"
        ].map(name => {
            const value = properties.get(name);

            return [name, Array.isArray(value) ? value.slice() : value];
        });
        const pawn: [string, any][] = ["DesiredRotation", "bTurning", "TurningDir", "fMaxAirSpeedIncRate"].map(name => {
            const value = render.player.getUnrealScriptProperty(name);

            return [name, Array.isArray(value) ? value.slice() : value];
        });
        this.replayCameraState = {
            height: properties.get("CameraViewHeightAdjust") as number,
            adjusted: this.isCameraHeightAdjusted,
            rotating: properties.get("bCameraManuallyRotating") as boolean,
            yaw: properties.get("ManuallyCameraYaw") as number,
            pitch: properties.get("ManuallyCameraPitch") as number,
            rightMouseDownTime: this.rightMouseDownTime,
            preset,
            pawn,
            hidden: render.player.getUnrealScriptProperty("bHidden") as boolean,
            enableRotate: this.controls.orbit.enableRotate
        };
        if ((scene.cameraMode === 1 || properties.get("bCameraWalking")) && !asset.playerController.setCameraMode(scene.cameraMode))
            throw new Error(`Replay camera mode requires an initialized player controller.`);

        this.rightMouseDownTime = -Infinity;
        properties.set("bCameraManuallyRotating", false);
        properties.set("ManuallyCameraYaw", 1);
        properties.set("ManuallyCameraPitch", 0);
        properties.set("CurFixedDefaultCameraNo", scene.fixedCamera);
        properties.set("bCameraMovingToDefault", false);
        properties.set("CurZoomingDist", scene.zoom);
        properties.set("DesiredZoomingDist", scene.desiredZoom);
        properties.set("OldZoomingDist", scene.zoom);
        if (scene.firstPerson) render.player.setUnrealScriptProperty("bHidden", true);

        render.player.getCameraTargetPosition(this.controls.orbit.target);
        this.controls.orbit.unclippedDistance = 0;

        const location = render.player.getUnrealScriptProperty("Location") as number[],
            pitch = Math.trunc(scene.pitch),
            yaw = Math.trunc(scene.yaw),
            cosPitch = sinRotator(pitch + 16384),
            distance = Math.fround(scene.zoom + 250);

        dirForward.set(Math.fround(cosPitch * sinRotator(yaw + 16384)), Math.fround(cosPitch * sinRotator(yaw)), sinRotator(pitch));

        properties.set(
            "OldCameraLocation",
            [Math.fround(location[0] - dirForward.x * distance), Math.fround(location[1] - dirForward.y * distance), Math.fround(location[2] - Math.fround(dirForward.z * distance))]
        );
        properties.set("Location", (properties.get("OldCameraLocation") as number[]).slice());
        properties.set("Rotation", [pitch, yaw, (properties.get("Rotation") as number[])[2]]);
        properties.set("OldViewTargetLocation", location.slice());
        properties.set("OldCameraRotation", [pitch, yaw, 0]);

        const orbitPitch = Math.min(pitch * Math.PI / 32768, MAX_ORBIT_PITCH);

        tmpVolumeOffset.set(Math.cos(orbitPitch) * Math.cos(yaw * Math.PI / 32768), Math.cos(orbitPitch) * Math.sin(yaw * Math.PI / 32768), Math.sin(orbitPitch));
        this.controls.orbit.unclippedOffset = tmpVolumeOffset.multiplyScalar(-Math.max(1e-6, Math.abs(distance)));
        this.controls.orbit.update();
        render.camera.position.copy(this.controls.orbit.target).addScaledVector(dirForward, -distance);
        lookAtCameraRotation(render.camera, pitch, yaw);
        this.setFollowPlayer(true);
        render.updateCameraMatrices();
    }

    public endReplayCamera(): void {
        const state = this.replayCameraState;

        if (!state) return;

        const controller = this.manGame.getComponent("asset").playerController, properties = controller.scriptProperties;

        if (properties.get("bCameraWalking")) controller.setCameraMode(0);

        properties.set("CameraViewHeightAdjust", state.height);
        properties.set("bCameraManuallyRotating", state.rotating);
        properties.set("ManuallyCameraYaw", state.yaw);
        properties.set("ManuallyCameraPitch", state.pitch);
        for (const [name, value] of state.preset) properties.set(name, value);

        const player = this.renderManager.player;

        for (const [name, value] of state.pawn) player.setUnrealScriptProperty(name, value);

        player.setUnrealScriptProperty("bHidden", state.hidden);
        if (player.ridePawn) player.ridePawn.setUnrealScriptProperty("bHidden", state.hidden);

        this.controls.orbit.enableRotate = state.enableRotate;
        this.controls.orbit.unclippedOffset = null;
        this.isCameraHeightAdjusted = state.adjusted;
        this.rightMouseDownTime = state.rightMouseDownTime;
        this.replayCameraState = null;
    }

    public applyReplayCamera(instruction: ReplayCameraInstruction_T): void {
        const { key, action, amount } = instruction;

        if (key >= 8 && key < 200) {
            this.applyKeyboardMove(key, action, amount, "injected");
            return;
        }

        switch (key) {
            case EInputKey_T.IK_MiddleMouse:
            case EInputKey_T.IK_MouseWheelUp:
            case EInputKey_T.IK_MouseWheelDown:
                this.applyKeyboardMove(key, action, amount, "injected");
                break;
            case EInputKey_T.IK_RightMouse:
                if (action === EInputAction_T.IST_Press) this.rightMouseDownTime = performance.now();
                this.applyKeyboardMove(key, action, action === EInputAction_T.IST_Release && amount === 0 ? Math.fround(performance.now() - this.rightMouseDownTime) : amount, "injected");
                break;
            case EInputKey_T.IK_MouseX:
            case EInputKey_T.IK_MouseY:
                if (amount !== 0) this.rightMouseDownTime = -Infinity;
                this.applyKeyboardMove(key, action, amount, "injected");
                break;
            default: throw new Error(`Replay camera key '${key}' is not implemented.`);
        }
    }

    protected applyMaxAirSpeed(speed: number, action: EInputAction_T): void { // UInput::Exec 0x851b54..0x851cf9.
        if (action !== EInputAction_T.IST_Press && action !== EInputAction_T.IST_Hold && action !== EInputAction_T.IST_Release) return;

        const properties = this.manGame.getComponent("asset").playerController.scriptProperties;
        const pawn = properties.get("Pawn") as BaseActor, wait = properties.get("WaitType") as PStopType_T;

        if (!pawn || properties.get("bDead") || wait === PStopType_T.STP_SIT || wait === PStopType_T.STP_FAKE_DEAD || wait === PStopType_T.STP_CHAIR_SIT) return;
        if (action === EInputAction_T.IST_Hold && properties.get("bKeyboardMoving")) return;

        pawn.setUnrealScriptProperty("fMaxAirSpeedIncRate", action === EInputAction_T.IST_Release ? 0 : speed);
    }

    protected applyKeyboardMove(key: EInputKey_T, action: EInputAction_T, amount = 0, source: InputSource_T = null): void {
        const game = this.manGame.getComponent("network").getGameClient();

        if (source !== "injected" && game && game.isPlayingReplay()) {
            if (game.useCameraInst() || !isReplayCameraInput(key, action)) return;
            if (action === EInputAction_T.IST_Axis && !this.manGame.getComponent("asset").playerController.scriptProperties.get("bCameraManuallyRotating")) return;
        }
        if (!this.preProcessInput(key, action)) return;
        this.processInput(key, action, amount);
    }

    protected preProcessInput(key: EInputKey_T, action: EInputAction_T): boolean { // UInput::PreProcess 0x8424b0..0x8425be.
        if (action === EInputAction_T.IST_Press) {
            if (this.keyboardMovingKeys.has(key)) return false;
            this.keyboardMovingKeys.set(key, performance.now());
        } else if (action === EInputAction_T.IST_Release) {
            if (!this.keyboardMovingKeys.has(key)) return key === EInputKey_T.IK_PrintScrn;
            if (key !== EInputKey_T.IK_PrintScrn) this.arrInputDurations[key] = (performance.now() - this.keyboardMovingKeys.get(key)!) / 1000;
            this.keyboardMovingKeys.delete(key);
        }
        return true;
    }

    protected processInput(key: EInputKey_T, action: EInputAction_T, amount: number): void {
        if (!this.inputBindings) throw new Error(`Input bindings are not initialized.`);
        amount = Math.fround(amount);
        const effectiveAmount = action === EInputAction_T.IST_Release && amount === 0 ? Math.fround(this.arrInputDurations[key]) : amount;
        const bound = this.inputBindings.process(key, action, effectiveAmount, this.inputCommandExecutor);

        const game = this.manGame.getComponent("network").getGameClient();

        // UInput::Process 0x84354c..0x84358f appends the original amount after commands during normal recording.
        if (bound && game && game.isRecording() && isReplayCameraInput(key, action) &&
            (action !== EInputAction_T.IST_Axis || this.manGame.getComponent("asset").playerController.scriptProperties.get("bCameraManuallyRotating")))
            game.recordCameraKey(key, action, amount);
    }

    protected executeInputCommand(command: string, action: EInputAction_T, amount: number, viewport: boolean): boolean {
        let rest: string | null;

        for (const name of arrCameraAxes) {
            rest = parseInputCommand(command, name);
            if (rest === null) continue;

            const properties = this.manGame.getComponent("asset").playerController.scriptProperties;

            if (properties.get("bCameraWalking") && properties.get("CameraModeTarget")) return true;
            const speed = parseInputNumber(rest, "Speed=", true, 1);
            const field = name === "CameraYaw" ? "ManuallyCameraYaw" : "ManuallyCameraPitch";
            let value = properties.get(field) as number;

            if (action === EInputAction_T.IST_Hold) {
                value = addCameraRotation(value, Math.fround(amount) * speed);
                properties.set(field, value);
            } else if (action === EInputAction_T.IST_Axis && properties.get("bCameraManuallyRotating")) {
                const scaled = Math.fround(amount) * speed * INPUT_AXIS_SCALE;
                // Engine.dll 0xa10ab4 converts through signed int64 and returns its low32 bits.
                const delta = Math.abs(scaled) < 2 ** 63 ? Math.trunc(scaled) | 0 : 0;

                value = Math.fround(value + delta);
                properties.set(field, value);
                if (delta !== -2147483648 && Math.abs(delta) > 100) {
                    const network = this.manGame.getComponent("network"), game = network.getGameClient();

                    if (game && game.isConnected() && !game.isPlayingReplay()) network.checkTutorialClientEvent(2);
                }
            } else if (name === "CameraYaw") return true;

            if (name === "CameraPitch" && (value < -15000 || value > 15000)) {
                value = value < -15000 ? -15000 : 15000;
                properties.set(field, value);
            }
            return true;
        }

        for (const name of arrInputButtons) {
            rest = parseInputCommand(command, name);
            if (rest === null) continue;

            let actor: ScriptHost_T = this.manGame.getComponent("asset").playerController;
            const propertyName = parseInputToken(rest).token;
            let field = findInputProperty(actor, propertyName, "Byte");

            if (!field && (name === "Button" || name === "Pulse")) {
                actor = getProperty(actor, "Pawn") as ScriptHost_T;
                if (actor) field = findInputProperty(actor, propertyName, "Byte");
            }
            if (!field) return true;
            const value = getInputValue(actor, field);
            let next = value;

            switch (name) {
                case "Button":
                    if (action === EInputAction_T.IST_Press) next = 1;
                    else if (action === EInputAction_T.IST_Release && value !== 0) next = 0;
                    else return true;
                    break;
                case "Pulse":
                    if (action !== EInputAction_T.IST_Press) return true;
                    next = 1;
                    break;
                case "Toggle":
                    if (action !== EInputAction_T.IST_Press) return true;
                    next = value ^ 128;
                    break;
                case "Count": next = value + 1; break;
                default: throw new Error(`Unknown input button command '${name}'.`);
            }
            setInputValue(actor, field, next & 255);
            return true;
        }

        rest = parseInputCommand(command, "Axis");
        if (rest !== null) {
            const actor = this.manGame.getComponent("asset").playerController;
            const field = findInputProperty(actor, parseInputToken(rest).token, "Float");

            if (!field) return true;
            const speed = parseInputNumber(rest, "Speed=", true, 1);
            const base = parseInputNumber(rest, "SpeedBase=", true, 0);
            const invert = parseInputNumber(rest, "Invert=", false, 1);
            const deadZone = parseInputNumber(rest, "DeadZone=", true, 0);
            let delta: number;

            if (base > 0) {
                const magnitude = Math.abs(speed);

                if (magnitude <= deadZone) return true;
                const remapped = Math.fround((speed < 0 ? -1 : 1) * (magnitude - deadZone) / (1 - deadZone));

                delta = invert * base * remapped;
            } else if (action === EInputAction_T.IST_Hold || action === EInputAction_T.IST_Axis) {
                delta = Math.fround(amount) * invert * speed;
                if (action === EInputAction_T.IST_Axis) delta *= INPUT_AXIS_SCALE;
            } else return true;

            setInputValue(actor, field, Math.fround(getInputValue(actor, field) + delta));
            return true;
        }

        for (const name of arrKeyboardCommands) {
            rest = parseInputCommand(command, name);
            if (rest === null) continue;

            const released = parseInputCommand(rest, "OnRelease"), finish = name.endsWith("Finish");
            const selected = released === null ? EInputAction_T.IST_Press : EInputAction_T.IST_Release;

            if (released !== null) rest = released;
            if (action !== selected && action !== EInputAction_T.IST_None && (action !== EInputAction_T.IST_Hold || finish || name === "KeyboardPermanentMove")) return true;

            const phase = action === EInputAction_T.IST_Hold ? action : finish ? EInputAction_T.IST_Release : EInputAction_T.IST_Press;

            switch (name) {
                case "KeyboardMoveStart": case "KeyboardMoveFinish":
                    this.applyKeyboardDirection(parseInputNumber(rest, "Dir=", false), phase, amount);
                    break;
                case "LeftTurningStart": case "LeftTurningFinish":
                case "RightTurningStart": case "RightTurningFinish":
                    this.applyKeyboardTurning(name.startsWith("Left"), phase);
                    break;
                case "ModMaxAirSpeedStart": case "ModMaxAirSpeedFinish":
                    this.applyMaxAirSpeed(finish ? 0 : Math.fround(parseInputNumber(rest, "Speed=", true)), phase);
                    break;
                case "KeyboardPermanentMove":
                    this.applyKeyboardPermanentMove(phase);
                    break;
                default: throw new Error(`Unknown keyboard command '${name}'.`);
            }
            return true;
        }

        rest = parseInputCommand(command, "FixedDefaultCamera");
        if (rest !== null) {
            const released = parseInputCommand(rest, "OnRelease");

            if (released !== null) rest = released;
            if (action !== (released === null ? EInputAction_T.IST_Press : EInputAction_T.IST_Release)) return true;
            if (released !== null && amount > parseInputNumber(rest, "MaxPressedTime=", true, Infinity)) return true;
            this.setFixedDefaultCamera(parseInputCommand(rest, "Down") !== null ? -1 : parseInputCommand(rest, "Up") !== null ? 1 : 0);
            return true;
        }
        if (parseInputCommand(command, "TurnBack") !== null) {
            if (action === EInputAction_T.IST_Press) this.turnBackCamera();
            return true;
        }
        if (parseInputCommand(command, "CameraModeSelectingCancel") !== null) { // UInput::Exec 0x851d01..0x851d38.
            const properties = this.manGame.getComponent("asset").playerController.scriptProperties;

            if (properties.get("bCameraWalking") && properties.get("CameraModeTarget")) properties.set("CameraModeTarget", null);
            return true;
        }
        for (const name of arrCameraZoomCommands) {
            rest = parseInputCommand(command, name);
            if (rest === null) continue;
            if (action === EInputAction_T.IST_Press) this.applyCameraZoom(name === "ZoomInPress", parseInputNumber(rest, "Speed=", true, 1));
            return true;
        }
        if (viewport) {
            if (parseInputCommand(command, "StopMouse") !== null || parseInputCommand(command, "MoveMouse") !== null) return true; // UWindowsViewport::Exec 0x11107f00 pins and hides the cursor
            for (const name of arrCameraCommands) {
                if (parseInputCommand(command, name) === null) continue;
                this.manGame.getComponent("asset").playerController.call(name);
                return true;
            }
        }
        return false;
    }

    protected applyKeyboardDirection(direction: number, action: EInputAction_T, amount = 0): void {
        const controller = this.manGame.getComponent("asset").playerController, properties = controller.scriptProperties;
        const pawn = properties.get("Pawn") as BaseActor, wait = properties.get("WaitType") as PStopType_T;
        const pressed = action === EInputAction_T.IST_Press || action === EInputAction_T.IST_Hold && !properties.get("bKeyboardMoving");

        // UInput::Exec 0x1057c85c..0x1057ca5d: WaitType and bDead gate the controller's keyboard commands.
        if (!pawn || wait === PStopType_T.STP_SIT || wait === PStopType_T.STP_FAKE_DEAD || wait === PStopType_T.STP_CHAIR_SIT || pressed && properties.get("bDead")) return;
        if (!pressed && action !== EInputAction_T.IST_Release) return;

        if (!pressed && properties.get("bKeyboardMovingPermanently")) {
            properties.set("bKeyboardMoving", false);
            properties.set("bDesiredKeyboardMoving", false);
            return;
        }

        this.resetKeyboardMoving(direction, pressed, !pressed && amount < 0.5);
        if (pressed) properties.set("bKeyboardMovingPermanently", false);
    }

    protected applyKeyboardPermanentMove(action: EInputAction_T): void {
        if (action !== EInputAction_T.IST_Press) return;

        const properties = this.manGame.getComponent("asset").playerController.scriptProperties,
            pawn = properties.get("Pawn") as BaseActor,
            wait = properties.get("WaitType") as PStopType_T;

        // UInput::Exec 0x1057caad..0x1057cb8f.
        if (!pawn || wait === PStopType_T.STP_SIT || wait === PStopType_T.STP_FAKE_DEAD || wait === PStopType_T.STP_CHAIR_SIT) return;

        const moving = !properties.get("bKeyboardMovingPermanently");

        properties.set("bKeyboardMovingPermanently", moving);
        if (moving) properties.set("KeyboardMovingDir", (pawn.getUnrealScriptProperty("Rotation") as Vector3Arr)[1]);
        else if (!properties.get("bKeyboardMoving")) {
            pawn.stopPlayerMove();

            const game = this.manGame.getComponent("network").getGameClient();

            if (!game.isPlayingReplay()) {
                const origin = pawn.getUnrealScriptProperty("Location") as Vector3Arr;

                tmpKeyboardOrigin.set(Math.trunc(origin[0]), Math.trunc(origin[1]), Math.trunc(origin[2]));
                game.cannotMoveAnymore(tmpKeyboardOrigin, (pawn.getUnrealScriptProperty("Rotation") as Vector3Arr)[1]);
            }
        }
    }

    protected applyKeyboardTurning(left: boolean, action: EInputAction_T): void {
        const properties = this.manGame.getComponent("asset").playerController.scriptProperties,
            pawn = properties.get("Pawn") as BaseActor;
        const pressed = action === EInputAction_T.IST_Press || action === EInputAction_T.IST_Hold && pawn && !pawn.getUnrealScriptProperty("bTurning");

        // UInput::Exec 0x1057cca2..0x1057d0e7.
        if (!pawn || properties.get("bDead") || !pressed && action !== EInputAction_T.IST_Release) return;

        if (pressed) {
            const wait = properties.get("WaitType") as PStopType_T;

            if (wait === PStopType_T.STP_SIT || wait === PStopType_T.STP_FAKE_DEAD || wait === PStopType_T.STP_CHAIR_SIT || pawn.getUnrealScriptProperty("bFish")) return;

            properties.set("TurningPendingTime", 0);
        }

        if (properties.get("bKeyboardMoving") || properties.get("bCameraWalking")) {
            this.resetKeyboardMoving(left ? 8 : 2, pressed);
            return;
        }

        const game = this.manGame.getComponent("network").getGameClient(),
            rotation = pawn.getUnrealScriptProperty("Rotation") as Vector3Arr;

        if (pressed) {
            if (game.isPlayingReplay()) {
                pawn.setUnrealScriptProperty("bTurning", true);
                pawn.setUnrealScriptProperty("TurningDir", left ? -1 : 1);
            } else if (!pawn.getUnrealScriptProperty("bUpdateMovementAnim")) game.startRotating(rotation[1], left ? -1 : 1);
        } else {
            if (!game.isPlayingReplay()) game.finishRotating(rotation[1], 0);

            pawn.setUnrealScriptProperty("bTurning", false);
            pawn.setUnrealScriptProperty("DesiredRotation", rotation.slice());
            pawn.getComponent<PawnMovementComponent>("pawnMovement").stopRotating();
        }
    }

    protected resetKeyboardMoving(direction: number, pressed: boolean, quickRelease = false): void {
        const controller = this.manGame.getComponent("asset").playerController,
            pawn = controller.scriptProperties.get("Pawn") as BaseActor;
        const destination = controller.resetKeyboardMoving(direction, pressed, quickRelease),
            origin = pawn.getUnrealScriptProperty("Location") as Vector3Arr;
        const game = this.manGame.getComponent("network").getGameClient();

        tmpKeyboardOrigin.set(Math.trunc(origin[0]), Math.trunc(origin[1]), Math.trunc(origin[2]));
        if (destination) {
            tmpKeyboardDestination.set(Math.trunc(destination[0]), Math.trunc(destination[1]), Math.trunc(destination[2]));
            game.moveBackwardToLocation(tmpKeyboardDestination, tmpKeyboardOrigin, true);
        } else if (destination === null) game.cannotMoveAnymore(tmpKeyboardOrigin, (pawn.getUnrealScriptProperty("Rotation") as Vector3Arr)[1]);
    }

    public isRenderingWide() { return this.specialView.isWide(); }
    public isNameHidden() { return this.specialView.isNameHidden(); }

    public updateCamera(): void {
        if (this.isOrbitControls || this.specialView.isActive()) return;

        let forwardVelocity = 0, sidewaysVelocity = 0;
        const camSpeed = this.speedCameraFPS * (this.dirKeys.shift ? Math.min(500, Math.max(Math.pow(2, Math.log10((Date.now() - this.shiftTimeDown) * 0.25)), 2)) : 1);

        // if (this.dirKeys.shift)
        //     console.log("Camspeed:", camSpeed, Date.now() - this.shiftTimeDown)

        if (this.dirKeys.left) sidewaysVelocity -= 1;
        if (this.dirKeys.right) sidewaysVelocity += 1;

        if (this.dirKeys.up) forwardVelocity += 1;
        if (this.dirKeys.down) forwardVelocity -= 1;

        dirForward.set(0, 0, -1).applyQuaternion(this.renderManager.camera.quaternion).multiplyScalar(forwardVelocity);
        dirRight.set(1, 0, 0).applyQuaternion(this.renderManager.camera.quaternion).multiplyScalar(-sidewaysVelocity);
        cameraVelocity.addVectors(dirForward, dirRight).setLength(camSpeed);
        this.renderManager.camera.position.add(cameraVelocity);
    }

    public updateFollowPlayer(deltaTime: number): void {
        const controller = this.manGame.getComponent("asset").playerController;
        const wasMovingToDefault = controller && controller.scriptProperties.get("bCameraMovingToDefault") as boolean;

        if (!controller || !this.manGame.getComponent("network").isInWorld()) this.releaseKeyboardMovingKeys();
        if (controller) {
            const network = this.manGame.getComponent("network");

            if (network.isInWorld()) {
                const level = controller.scriptProperties.get("Level") as BaseActor,
                    actorDelta = Math.fround(Math.max(MIN_ACTOR_DELTA, Math.min(MAX_ACTOR_DELTA, Math.fround(Math.fround(deltaTime / 1000) * (level.getUnrealScriptProperty("TimeDilation") as number)))));

                if (!controller.scriptProperties.get("PlayerInput")) controller.initInputSystem();
                this.readInput(actorDelta);
                if (controller.scriptProperties.get("PlayerInput")) controller.call("PlayerTick", [actorDelta]);
                this.readInput(-1);
                controller.processState(actorDelta);
                controller.updateTimers(actorDelta);

                const game = network.getGameClient(),
                    destination = controller.tickKeyboardMoving(Math.fround(deltaTime / 1000), !game.isPlayingReplay());

                if (destination) {
                    const pawn = controller.scriptProperties.get("Pawn") as BaseActor;

                    tmpKeyboardDestination.fromArray(destination);
                    if (game.isPlayingReplay()) pawn.goTo(tmpKeyboardDestination);
                    else {
                        const origin = pawn.getUnrealScriptProperty("Location") as Vector3Arr;

                        tmpKeyboardDestination.set(Math.trunc(destination[0]), Math.trunc(destination[1]), Math.trunc(destination[2]));
                        tmpKeyboardOrigin.set(Math.trunc(origin[0]), Math.trunc(origin[1]), Math.trunc(origin[2]));
                        game.moveBackwardToLocation(tmpKeyboardDestination, tmpKeyboardOrigin, true);
                    }
                }
            }
        }

        if (controller && getProperty(controller, "bUseHoldCamera")) {
            const yaw = getProperty(controller, "CompensateYaw") as number, pitch = getProperty(controller, "CopmensatePitch") as number;

            if (this.isOrbitControls && this.followPlayer && !this.isCameraLocked)
                this.controls.orbit.rotate(yaw * Math.PI / 32768, pitch * Math.PI / 32768);

            setProperty(controller, "CompensateYaw", 0);
            setProperty(controller, "CopmensatePitch", 0);
            setProperty(controller, "bUseHoldCamera", false);
        }

        const network = this.manGame.getComponent("network"), replay = network.getGameClient()?.isPlayingReplay();

        if (replay || network.isInWorld() && this.isOrbitControls && this.followPlayer && !this.isCameraLocked) {
            const properties = this.manGame.getComponent("asset").playerController.scriptProperties;
            const yaw = properties.get("ManuallyCameraYaw") as number, pitch = properties.get("ManuallyCameraPitch") as number;

            // PlayerCalcView 0x1053cde0 copies desired zoom before the non-volume view.
            if (!properties.get("bUseVolumeCamera") && properties.get("CurZoomingDist") !== properties.get("DesiredZoomingDist")) {
                const zoom = properties.get("DesiredZoomingDist") as number;

                properties.set("CurZoomingDist", zoom);
                this.controls.orbit.unclippedDistance = Math.max(1e-6, Math.abs(zoom + 250));
            }

            if (yaw !== 0 || pitch !== 0) {
                const orbit = this.controls.orbit;
                const cameraYaw = ((Math.round((orbit.getAzimuthalAngle() + HALF_PI) * 32768 / Math.PI) + 32767) & 65535) - 32767,
                    cameraPitch = Math.round((orbit.getPolarAngle() - HALF_PI) * 32768 / Math.PI);
                // Engine.dll 105381bb: signed rotator normalization, pitch limits -15000/16384.
                const nextYaw = ((Math.trunc(cameraYaw + yaw) + 32767) & 65535) - 32767;
                const nextPitch = Math.max(-15000, Math.min(16384, ((Math.trunc(cameraPitch + pitch) + 32767) & 65535) - 32767));

                orbit.rotate((nextYaw - cameraYaw) * Math.PI / 32768, (nextPitch - cameraPitch) * Math.PI / 32768);
                properties.set("ManuallyCameraYaw", 0);
                properties.set("ManuallyCameraPitch", 0);
            }
        }

        const manualYaw = this.controls.orbit.manualYaw;

        this.controls.orbit.manualYaw = 0;
        if (this.isCameraLocked) {
            this.updateControllerRotation();
            return;
        }

        if (this.specialView.update(this.manGame.getComponent("network"), deltaTime / 1000)) {
            this.renderManager.updateCameraMatrices();
            this.updateControllerRotation();
            return;
        }

        if (!this.isOrbitControls || !this.followPlayer) {
            this.updateControllerRotation();
            return;
        }

        const renderManager = this.renderManager;

        const properties = controller.scriptProperties;

        this.controls.orbit.enableRotate = !properties.get("bCameraMovingToDefault") && !properties.get("bDisableCameraManuallyRotating") && !(properties.get("bCameraWalking") && properties.get("CameraModeTarget"));
        if (this.controls.orbit.unclippedOffset) renderManager.camera.position.copy(this.controls.orbit.target).add(this.controls.orbit.unclippedOffset);

        renderManager.player.getCameraTargetPosition(tmpMouseIntersection);
        cameraVelocity.copy(tmpMouseIntersection).sub(this.controls.orbit.target);
        if (!this.updateDefaultCamera(wasMovingToDefault, tmpMouseIntersection) && !this.updateCameraWalking(tmpMouseIntersection)) {
            this.updateAutoTrackingPawn(tmpMouseIntersection, manualYaw);
            renderManager.camera.position.add(cameraVelocity);
        }

        if (this.controls.orbit.unclippedOffset) this.controls.orbit.unclippedOffset.subVectors(renderManager.camera.position, tmpMouseIntersection);

        this.controls.orbit.target.copy(tmpMouseIntersection);
        this.controls.orbit.update();
        if (this.replayCameraState) {
            const properties = controller.scriptProperties,
                oldRotation = properties.get("OldCameraRotation") as number[],
                oldLocation = properties.get("OldCameraLocation") as number[];

            renderManager.camera.getWorldDirection(dirForward);
            tmpVolumeRotation[0] = Math.round(Math.atan2(dirForward.z, Math.hypot(dirForward.x, dirForward.y)) * 32768 / Math.PI);
            tmpVolumeRotation[1] = Math.round(Math.atan2(dirForward.y, dirForward.x) * 32768 / Math.PI);
            tmpVolumeRotation[2] = 0;
            if (properties.get("bUseVolumeCamera")) this.volumeCamera.update(controller, tmpVolumeRotation, this.controls.orbit.target, renderManager.camera.position);
            else if (properties.get("bCameraWalking") && properties.get("bFixView")) renderManager.camera.position.fromArray(oldLocation);
            else this.behindViewCamera.update(controller, tmpVolumeRotation, this.controls.orbit.target, renderManager.camera.position);

            const cosPitch = sinRotator(tmpVolumeRotation[0] + 16384),
                distance = Math.max(1e-6, Math.abs((properties.get("CurZoomingDist") as number) + 250));

            dirForward.set(cosPitch * sinRotator(tmpVolumeRotation[1] + 16384), cosPitch * sinRotator(tmpVolumeRotation[1]), sinRotator(tmpVolumeRotation[0]));

            const orbitPitch = Math.min(tmpVolumeRotation[0] * Math.PI / 32768, MAX_ORBIT_PITCH);

            tmpVolumeOffset.set(
                Math.cos(orbitPitch) * Math.cos(tmpVolumeRotation[1] * Math.PI / 32768),
                Math.cos(orbitPitch) * Math.sin(tmpVolumeRotation[1] * Math.PI / 32768),
                Math.sin(orbitPitch)
            ).multiplyScalar(-distance);
            lookAtCameraRotation(renderManager.camera, tmpVolumeRotation[0], tmpVolumeRotation[1]);
            for (let i = 0; i < 3; i++) {
                oldRotation[i] = tmpVolumeRotation[i];
                oldLocation[i] = Math.fround(renderManager.camera.position.getComponent(i));
            }
        } else this.hitCheckCamera();

        renderManager.updateCameraMatrices();
        this.updateControllerRotation();
    }

    protected updateControllerRotation(): void {
        if (!this.manGame.getComponent("network").isInWorld()) return;

        const properties = this.manGame.getComponent("asset").playerController.scriptProperties;
        const rotation = properties.get("Rotation") as number[];
        const location = properties.get("Location") as number[];

        this.renderManager.camera.getWorldDirection(dirForward);
        rotation[0] = Math.round(Math.atan2(dirForward.z, Math.hypot(dirForward.x, dirForward.y)) * 32768 / Math.PI);
        rotation[1] = Math.round(Math.atan2(dirForward.y, dirForward.x) * 32768 / Math.PI);
        for (let i = 0; i < 3; i++) location[i] = Math.fround(this.renderManager.camera.position.getComponent(i));
    }

    protected applyCameraZoom(inward: boolean, speed: number): void { // UInput::Exec 0x84ad55..0x84b090.
        const properties = this.manGame.getComponent("asset").playerController.scriptProperties;
        const pawn = properties.get("Pawn") as BaseActor;

        if (!pawn || properties.get("bDisableZoom") || properties.get("bCameraSpecialMove") || properties.get("bCameraMovingToSpecial")) return;

        const height = pawn.getCollisionHeight();
        const minimum = properties.get("MinZoomingDist") as number;
        const maximum = properties.get("MaxZoomingDist") as number;
        let current = properties.get("CurZoomingDist") as number;
        let desired = properties.get("DesiredZoomingDist") as number;

        if (minimum + height * 2 > desired) speed = Math.fround(speed / 8);
        current = Math.fround(current + (inward ? -speed : speed));
        desired = Math.fround(desired + (inward ? -speed : speed));

        if (inward) {
            if (desired < minimum) desired = minimum;
            if (current < minimum) {
                current = minimum;
                if (!this.isCameraHeightAdjusted) {
                    this.isCameraHeightAdjusted = true;
                    properties.set("CameraViewHeightAdjust", Math.fround((properties.get("CameraViewHeightAdjust") as number) + height * CAMERA_HEIGHT_STEP_SCALE));
                }
            }
        } else {
            if (this.isCameraHeightAdjusted) {
                this.isCameraHeightAdjusted = false;
                properties.set("CameraViewHeightAdjust", Math.fround((properties.get("CameraViewHeightAdjust") as number) - height * CAMERA_HEIGHT_STEP_SCALE));
            }
            if (desired > maximum) desired = maximum;
            if (current > maximum) current = maximum;
        }

        properties.set("CurZoomingDist", current);
        properties.set("DesiredZoomingDist", desired);
        const network = this.manGame.getComponent("network"), game = network.getGameClient();

        if (game && game.isConnected() && !game.isPlayingReplay()) network.checkTutorialClientEvent(4);
        this.controls.orbit.unclippedDistance = Math.max(1e-6, Math.abs(current + 250));
        this.controls.orbit.update();
    }

    protected turnBackCamera(): void { // UInput::Exec TurnBack 0x105796db..0x105797be.
        const properties = this.manGame.getComponent("asset").playerController.scriptProperties;

        if (properties.get("bCameraSpecialMove") || properties.get("bCameraMovingToSpecial")) return;

        const pawnYaw = (this.renderManager.player.getUnrealScriptProperty("Rotation") as number[])[1];
        const yaw = properties.get("bCameraMovingToDefault") ? properties.get("SavedViewTargetYaw") as number : (properties.get("Rotation") as number[])[1];
        const difference = (yaw - pawnYaw) & 65535;

        properties.set("SavedViewTargetYaw", (pawnYaw + (difference > 32568 && difference < 32968 ? 0 : 32768)) | 0);
        properties.set("bCameraMovingToDefault", true);
        properties.set("bUseDefaultCameraYaw", true);
        const network = this.manGame.getComponent("network"), game = network.getGameClient();

        if (game && game.isConnected() && !game.isPlayingReplay()) network.checkTutorialClientEvent(16); // UInput::Exec 0x8497be..0x8497d9
    }

    protected setFixedDefaultCamera(direction: number): void { // UInput::Exec 0x10579555..0x105796c2.
        const network = this.manGame.getComponent("network"), controller = this.manGame.getComponent("asset").playerController;

        if (!network.isInWorld() || !this.followPlayer || !this.isOrbitControls || this.isCameraLocked) return;

        const properties = controller.scriptProperties, count = properties.get("FixedDefaultViewNum") as number;

        if (count === 0 || properties.get("bCameraWalking") || properties.get("bCameraSpecialMove") || properties.get("bCameraMovingToSpecial")) return;

        const orbit = this.controls.orbit,
            player = this.renderManager.player,
            rotation = player.getUnrealScriptProperty("Rotation") as number[];
        const current = (properties.get("CurFixedDefaultCameraNo") as number) + direction;
        const index = current < 0 ? count - 1 : current >= count ? 0 : current;
        const yaw = ((Math.round((orbit.getAzimuthalAngle() + HALF_PI) * 32768 / Math.PI) + 32767) & 65535) - 32767;
        const pitch = Math.round((orbit.getPolarAngle() - HALF_PI) * 32768 / Math.PI);
        const distance = Math.fround((orbit.unclippedDistance || this.renderManager.camera.position.distanceTo(orbit.target)) - 250);

        properties.set("OldCameraRotation", [pitch, yaw, 0]);
        properties.set("CurZoomingDist", distance);
        properties.set("DesiredZoomingDist", distance);
        properties.set("CurFixedDefaultCameraNo", index);
        for (const field of ["Yaw", "Pitch", "Dist"]) {
            properties.set(`DefaultCamera${field}`, (properties.get(`FixedDefaultCamera${field}`) as number[])[index]);
            properties.set(`bUseDefaultCamera${field}`, true);
        }

        properties.set("CameraViewHeightAdjust", (properties.get("FixedDefaultCameraViewHeight") as number[])[index]);
        properties.set("bDisableZoom", !!((properties.get("FixedDefaultCameraDisableZoom") as number[])[index] & 1));

        const hidden = !!((properties.get("FixedDefaultCameraHidePlayer") as number[])[index] & 1);

        player.setUnrealScriptProperty("bHidden", hidden);
        if (player.ridePawn) player.ridePawn.setUnrealScriptProperty("bHidden", hidden);

        properties.set("SavedViewTargetYaw", rotation[1]);
        properties.set("SavedViewTargetPitch", rotation[0]);
        properties.set("bCameraManuallyRotating", false);
        properties.set("bCameraMovingToDefault", true);
        orbit.enableRotate = false;
    }

    protected updateDefaultCamera(wasMovingToDefault: boolean, target: Vector3): boolean {
        const controller = this.manGame.getComponent("asset").playerController, properties = controller.scriptProperties;

        if (!wasMovingToDefault) return false;
        this.applyScriptCameraRotation(target);
        this.controls.orbit.enableRotate = !properties.get("bCameraMovingToDefault") && !properties.get("bDisableCameraManuallyRotating") && !(properties.get("bCameraWalking") && properties.get("CameraModeTarget"));
        return true;
    }

    protected updateCameraWalking(target: Vector3): boolean {
        const controller = this.manGame.getComponent("asset").playerController, properties = controller.scriptProperties;

        if (!properties.get("bCameraWalking") || !properties.get("CameraModeTarget") || properties.get("bUseVolumeCamera")) return false;

        this.applyScriptCameraRotation(target);
        return true;
    }

    protected applyScriptCameraRotation(target: Vector3): void {
        const properties = this.manGame.getComponent("asset").playerController.scriptProperties;
        const rotation = properties.get("OldCameraRotation") as number[],
            yaw = rotation[1] * Math.PI / 32768,
            pitch = rotation[0] * Math.PI / 32768,
            distance = (properties.get("CurZoomingDist") as number) + 250;

        this.renderManager.camera.position.set(-Math.cos(pitch) * Math.cos(yaw), -Math.cos(pitch) * Math.sin(yaw), -Math.sin(pitch)).multiplyScalar(distance).add(target);
        this.controls.orbit.unclippedDistance = 0;
    }

    protected updateAutoTrackingPawn(target: Vector3, manualYaw: number): void {
        if (cameraVelocity.lengthSq() === 0 || manualYaw !== 0 || !this.manGame.getComponent("network").ui.isAutoTrackingPawnEnabled()) return;

        const controller = this.manGame.getComponent("asset").playerController.scriptProperties;
        const speed = controller.get("AutoTrackingPawnSpeed") as number;

        if (!controller.get("bUseAutoTrackingPawn") || speed === 0 || controller.get("bUseHoldCamera") ||
            controller.get("bCameraMovingToDefault") || controller.get("bFixView") || controller.get("ManuallyCameraYaw")) return;

        const camera = this.renderManager.camera, previousTarget = this.controls.orbit.target;
        // OldCameraRotation.Yaw is integral; recover it from the floating camera basis.
        const previousYaw = Math.round(Math.atan2(previousTarget.y - camera.position.y, previousTarget.x - camera.position.x) * 32768 / Math.PI) & 65535;
        const desiredYaw = Math.trunc(Math.atan2(target.y - camera.position.y, target.x - camera.position.x) * 32768 / Math.PI) & 65535;
        const difference = (desiredYaw - previousYaw) & 65535;
        // Engine.dll CalcBehindView 0x10537f2e..0x1053807b: per-update shortest yaw arc, negative half-turn.
        const yaw = (previousYaw + (difference < 32768 ? Math.trunc(difference * Math.min(1, speed)) : -Math.trunc(((previousYaw - desiredYaw) & 65535) * Math.min(1, speed)))) * Math.PI / 32768;
        const distance = Math.hypot(previousTarget.x - camera.position.x, previousTarget.y - camera.position.y);

        camera.position.x = previousTarget.x - Math.cos(yaw) * distance;
        camera.position.y = previousTarget.y - Math.sin(yaw) * distance;
    }

    protected hitCheckCamera(): void { // ALineagePlayerController::CalcBehindView 0x807ce0, bUseHitCheckCamera branch
        const camera = this.renderManager.camera;
        const target = this.controls.orbit.target;
        const distance = camera.position.distanceTo(target);
        const viewDist = distance + 30;

        tmpCameraView.subVectors(target, camera.position).divideScalar(distance);
        tmpCameraTraceStart.copy(target);
        tmpCameraTraceDelta.copy(tmpCameraView).multiplyScalar(-(viewDist + 30));
        tmpCameraTraceDelta.z -= 10;

        const hit = this.physicsManager.singleLineCheck(this.hitCheckCameraQuery);

        if (!hit) return;

        const hitDist = Math.min(tmpCameraTraceDelta.subVectors(target, hit.location).dot(tmpCameraView), viewDist);

        if (hitDist >= viewDist) return;

        this.controls.orbit.unclippedDistance = distance;
        camera.position.copy(tmpCameraView).multiplyScalar(30 - hitDist).add(target);
    }

    protected clearDirectionKeys(): void {
        this.dirKeys.left = false;
        this.dirKeys.right = false;
        this.dirKeys.up = false;
        this.dirKeys.down = false;
        this.dirKeys.shift = false;
    }

    protected onPointerControlsLocked(): void {
        this.isFreeCamera = true;
        if (this.manGame.getComponent("network").isInWorld()) {
            this.isPawnFreeCamera = true;
            this.setFollowPlayer(false);
            this.renderManager.setPawnCullingCamera(true);
        }

        this.isOrbitControls = false;
        this.controls.orbit.enabled = false;
        this.clearDirectionKeys();
    }

    protected onPointerControlsUnlocked(): void {
        if (!loginServer) this.isFreeCamera = false;

        this.isOrbitControls = true;
        this.controls.orbit.enabled = !this.isCameraLocked;
        if (this.isPawnFreeCamera && !this.isFreeCamera) {
            this.isPawnFreeCamera = false;
            this.renderManager.setPawnCullingCamera(false);
            if (this.manGame.getComponent("network").isInWorld() && !this.isCameraLocked) {
                this.resetFollowCamera();
                this.clearDirectionKeys();
                return;
            }
        }

        this.controls.fps.getDirection(this.controls.orbit.target).multiplyScalar(100).add(this.renderManager.camera.position);
        this.controls.orbit.update();
        this.clearDirectionKeys();
    }

    protected handleKeyboardMove(event: KeyboardEvent, pressed: boolean): boolean {
        if (!this.inputBindings || !this.isOrbitControls) return false;
        const key = getKeyboardKey(event.code, this.inputBindings), target = event.target as HTMLElement;

        if (key === null) return false;
        const bound = !!this.inputBindings.getBinding(key);

        if (!pressed && this.keyboardMovingKeys.has(key)) {
            if (bound) event.preventDefault();
            this.releaseKeyboardMovingKey(key, event.isTrusted ? "physical" : null);
            return bound;
        }

        if (!pressed || event.defaultPrevented || event.altKey || event.metaKey || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) return false;

        const network = this.manGame.getComponent("network");

        if (!network.isInWorld() || !this.followPlayer || !this.isOrbitControls || this.isCameraLocked) return false;

        if (bound) event.preventDefault();
        if (this.keyboardMovingKeys.has(key)) return bound;

        this.applyKeyboardMove(key, EInputAction_T.IST_Press, 0, event.isTrusted ? "physical" : null);
        return bound;
    }

    public resetInput(): void {
        this.keyboardMovingKeys.clear();
        const controller = this.manGame.getComponent("asset").playerController;

        if (!controller) return;
        const properties = getInputProperties(controller);

        for (let index = 0; index < properties.length; index++) {
            const field = properties[index];

            if (field.type === "Byte" || field.type === "Float") setInputValue(controller, field, 0);
        }
    }

    protected readInput(deltaTime: number): void {
        deltaTime = Math.fround(deltaTime);
        if (deltaTime !== -1) this.updateKeyboardMoving(deltaTime * 1000);

        const controller = this.manGame.getComponent("asset").playerController;
        const properties = getInputProperties(controller);
        const scale = deltaTime === -1 ? 0 : Math.fround(20 / deltaTime);

        for (let index = 0; index < properties.length; index++) {
            const field = properties[index];

            if (field.type === "Float") setInputValue(controller, field, Math.fround(getInputValue(controller, field) * scale));
        }
    }

    protected updateKeyboardMoving(deltaTime: number): void {
        if (!this.keyboardMovingKeys.size) return;

        const network = this.manGame.getComponent("network");

        if (!network.isInWorld()) {
            this.releaseKeyboardMovingKeys();
            return;
        }

        const amount = Math.fround(deltaTime / 1000);

        // UInput::ReadInput 0x10574160..0x10574188 dispatches held keys in key-code order.
        for (let key = 0; key < 255; key++) {
            if (!this.keyboardMovingKeys.has(key)) continue;

            this.processInput(key, EInputAction_T.IST_Hold, amount);
        }
    }

    protected releaseKeyboardMovingKey(key: EInputKey_T, source: InputSource_T = null): void {
        const network = this.manGame.getComponent("network");

        if (!network.isInWorld()) {
            this.keyboardMovingKeys.delete(key);
            return;
        }

        this.applyKeyboardMove(key, EInputAction_T.IST_Release, 0, source);
    }

    protected releaseKeyboardMovingKeys(): void {
        for (let key = 0; key < 255; key++)
            if (this.keyboardMovingKeys.has(key)) this.releaseKeyboardMovingKey(key);
    }

    protected onHandleKeyDown(event: KeyboardEvent): void {
        if (this.handleKeyboardMove(event, true)) return;

        const renderManager = this.renderManager;
        const target = event.target as HTMLElement;

        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        if (loginServer && /^F([1-9]|1[0-2])$/.test(event.code || event.key)) return;

        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

        if (event.code === "Backquote") {
            event.preventDefault();
            event.stopPropagation();
            this.manGame.getComponent("ui").toggleDebugView();
            return;
        }

        if (event.key === "F1" || event.code === "F1") {
            event.preventDefault();
            event.stopPropagation();
            renderManager.toggleBSPHelperCamera();
            return;
        }

        if (event.key === "F2" || event.code === "F2") {
            event.preventDefault();
            event.stopPropagation();
            renderManager.toggleFrustumCulling();
            return;
        }

        if (loginServer && /^[1-6+\-t]$/i.test(event.key)) return;

        switch (event.key.toLowerCase()) {
            case "1": this.setBookmark(1); break;
            case "2": this.setBookmark(2); break;
            case "3": this.setBookmark(3); break;
            case "4": this.setBookmark(4); break;
            case "5": this.setBookmark(5); break;
            case "6": this.setBookmark(6); break;
            case "+": this.nextSector(); break;
            case "-": this.prevSector(); break;
            case "w": if (!this.isOrbitControls) this.dirKeys.up = true; break;
            case "a": if (!this.isOrbitControls) this.dirKeys.left = true; break;
            case "d": if (!this.isOrbitControls) this.dirKeys.right = true; break;
            case "s": if (!this.isOrbitControls) this.dirKeys.down = true; break;
            case "shift": if (!this.isOrbitControls) {
                this.shiftTimeDown = Date.now();
                this.dirKeys.shift = true;
            } break;
            case "t": renderManager.player.teleportTo(renderManager.camera.position); break;
        }
    }

    protected setBookmark(index: number): void {
        const camera = this.renderManager.camera;
        const target = this.controls.orbit.target;

        this.renderManager.cancelMusic();
        this.renderManager.cutCamera();

        switch (index) {
            case 1:
                camera.position.set(13202.948810614555, 114479.97315173852, -3573.003864493672);
                target.set(13298.353862721668, 114463.56670278899, -3547.92988464792);
                break;
            case 2:
                camera.position.set(17046.05501814811, 117471.20102308583, -12013.89353241769);
                target.set(17083.7099694609, 117384.69022352276, -11980.75765759009);
                break;
            case 3:
                camera.position.set(15242.674545699758, 110436.41811293362, -12078.741557239728);
                target.set(15174.047463755987, 110487.88810239462, -12027.349302874225);
                break;
            case 4:
                camera.position.set(12918.803737500606, 109998.28664096774, -11769.26992456535);
                target.set(12961.940094338941, 110631.6332572824, -11789.664021556502);
                break;
            case 5:
                camera.position.set(23756.20212599347, 116491.99214326135, -8869.681711370744);
                target.set(23753.308437823456, 116591.94542046914, -8868.697361740096);
                break;
            case 6:
                camera.position.set(17436.46445202629, 109469.23150265992, -6351.127037466889);
                target.set(18965.828211115713, 106770.89206042158, -6064.126549127763);
                break;
            default: throw new Error(`Unknown camera bookmark '${index}'.`);
        }

        this.controls.orbit.update();
    }

    protected setSector(index: number): void {
        const bounds = this.renderManager.getSectorBounds();
        const sector = bounds[index];

        this.renderManager.cancelMusic();
        this.renderManager.cutCamera();
        this.renderManager.camera.position.copy(sector.max);
        this.controls.orbit.target.copy(sector.min).sub(sector.max).setLength(100).add(sector.max);
        this.controls.orbit.update();
        this.activeSector = index;
    }

    protected nextSector(): void {
        const sectors = this.renderManager.getSectorBounds();

        if (sectors.length <= 0) return;

        this.setSector((this.activeSector + 1) % sectors.length);
    }

    protected prevSector(): void {
        const sectors = this.renderManager.getSectorBounds();

        if (sectors.length <= 0) return;

        this.setSector(this.activeSector === 0 ? sectors.length - 1 : this.activeSector - 1);
    }

    protected onHandleKeyUp(event: KeyboardEvent): void {
        if (this.handleKeyboardMove(event, false)) return;

        switch (event.key.toLowerCase()) {
            case "c":
                const target = event.target as HTMLElement;

                if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
                if (loginServer && !this.isFreeCamera) return;
                if (this.isOrbitControls) this.controls.fps.lock();
                else this.controls.fps.unlock();
                break;
            case "w": if (!this.isOrbitControls) this.dirKeys.up = false; break;
            case "a": if (!this.isOrbitControls) this.dirKeys.left = false; break;
            case "d": if (!this.isOrbitControls) this.dirKeys.right = false; break;
            case "s": if (!this.isOrbitControls) this.dirKeys.down = false; break;
            case "shift": if (!this.isOrbitControls) this.dirKeys.shift = false; break;
        }
    }

    protected onHandleMouseDown(event: MouseEvent): void {
        if (event.button === 2) { this.rightMouseDownTime = event.timeStamp; return; }
        if (event.button !== 0 || !this.isOrbitControls || this.isFreeCamera) return;

        this.isPrimaryMouseDown = true;
        this.hasMouseDragged = false;
        this.mouseDownPosition.set(event.clientX, event.clientY);

        if (this.isCameraLocked || this.manGame.getComponent("ui").isInspecting()) return;

        const renderManager = this.renderManager;
        const bounds = renderManager.renderer.domElement.getBoundingClientRect();

        tmpScreenPosition.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
        this.raycaster.setFromCamera(tmpScreenPosition, renderManager.camera);

        arrMouseIntersections.length = 0;
        
        if (!this.followPlayer)
            this.raycaster.intersectObject(renderManager.scene, true, arrMouseIntersections);

        if (arrMouseIntersections.length > 0) {
            const intersection = arrMouseIntersections[0];
            const actor = getBatchIntersectionActor(intersection);

            if (actor) {
                console.log(actor.actorName, {
                    batch: intersection.object.name,
                    element: actor.actorIndex,
                    distance: intersection.distance,
                    point: intersection.point,
                    faceIndex: intersection.faceIndex,
                    uuid: actor.actorUuid
                });
            } else console.log(intersection.object.name, intersection);
        }

        const physicsIntersection = this.traceMouse();
        const pickDistance = this.mousePickDistance;

        renderManager.player.deleteLandmark(true);

        const network = this.manGame.getComponent("network");

        if (network.isInWorld()) {
            if (network.requestPickup(this.raycaster, physicsIntersection ? physicsIntersection.distance : pickDistance, event.shiftKey)) return;
            if (physicsIntersection && network.requestAction(physicsIntersection.actor, event.shiftKey, event.ctrlKey || network.ui.getInputModifiers()[0])) return;

            if (physicsIntersection) {
                tmpMouseIntersection.copy(physicsIntersection.location);
                network.requestMoveTo(tmpMouseIntersection, physicsIntersection.actor);
                if (isLandmarkSurface(physicsIntersection.actor)) renderManager.player.addLandmark(
                    tmpMouseIntersection,
                    physicsIntersection.normal,
                    (physicsIntersection.actor as any).isVehicle ? physicsIntersection.actor as unknown as THREE.Object3D : null
                );
            } else if (pickDistance > 0 && (renderManager.player.isSwimmingMovement() || renderManager.player.isFlyingMovement())) {
                tmpMouseIntersection.copy(this.raycaster.ray.direction).multiplyScalar(pickDistance).add(this.raycaster.ray.origin);
                network.requestMoveTo(tmpMouseIntersection);
            }

            return;
        }

        if (physicsIntersection) {
            tmpMouseIntersection.copy(physicsIntersection.location);
            renderManager.player.goTo(tmpMouseIntersection);
            if (isLandmarkSurface(physicsIntersection.actor)) renderManager.player.addLandmark(
                tmpMouseIntersection,
                physicsIntersection.normal,
                (physicsIntersection.actor as any).isVehicle ? physicsIntersection.actor as unknown as THREE.Object3D : null
            );
        } else if (pickDistance > 0) {
            tmpMouseIntersection.copy(this.raycaster.ray.direction).multiplyScalar(pickDistance).add(this.raycaster.ray.origin);
            renderManager.player.goTo(tmpMouseIntersection);
        }

        renderManager.pickBSPNode(this.raycaster, physicsIntersection ? physicsIntersection.distance : pickDistance);
    }

    protected onHandleMouseMove(event: MouseEvent): void {
        this.mousePosition.set(event.clientX, event.clientY);
        this.isMouseInViewport = true;

        if (!this.isPrimaryMouseDown || this.hasMouseDragged) return;

        const dx = event.clientX - this.mouseDownPosition.x;
        const dy = event.clientY - this.mouseDownPosition.y;

        if (dx * dx + dy * dy > CLICK_MAX_MOVEMENT_SQ) this.hasMouseDragged = true;
    }

    protected onHandleMouseUp(event: MouseEvent): void {
        if (event.button === 2) {
            this.rightMouseDownTime = -Infinity;
            return;
        }
        if (event.button !== 0) return;

        const dx = event.clientX - this.mouseDownPosition.x;
        const dy = event.clientY - this.mouseDownPosition.y;
        const isClick = this.isPrimaryMouseDown && !this.hasMouseDragged && dx * dx + dy * dy <= CLICK_MAX_MOVEMENT_SQ;

        this.isPrimaryMouseDown = false;

        if (isClick && this.manGame.getComponent("ui").isInspecting()) {
            this.manGame.getComponent("ui").inspect(event.clientX, event.clientY);
            return;
        }

        if (isClick && this.isCameraLocked) {
            const bounds = this.renderManager.renderer.domElement.getBoundingClientRect();

            tmpScreenPosition.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
            this.raycaster.setFromCamera(tmpScreenPosition, this.renderManager.camera);

            const hit = this.traceMouse();

            if (hit && (hit.actor as any)?.isActor) this.manGame.getComponent("network").pickLobbyPawn(hit.actor as any as BaseActor);
        }
    }

    protected traceMouse(): ReturnType<PhysicsManager["rayCheck"]> {
        const player = this.renderManager.player;

        this.mousePickDistance = this.getPickDistance(this.raycaster.ray.origin, this.raycaster.ray.direction);

        // UGameEngine::FindMouseTargetObject 0x829c88/0x829dfd uses UViewport.Actor (PlayerController), not its Pawn.
        return this.mousePickDistance > 0 ? this.physicsManager.rayCheck(
            this.raycaster.ray.origin,
            this.raycaster.ray.direction,
            this.mousePickDistance,
            player.getCollider(),
            player.getRigidbody(),
            true,
            this.manGame.getComponent("asset").playerController
        ) : null;
    }

    public getMouseTarget(): ICollidable { return this.mouseTarget; }
    public getMousePickup(): GroundPickup { return this.mousePickup; }

    public traceScreenPoint(clientX: number, clientY: number, target: Vector3): boolean {
        const bounds = this.renderManager.renderer.domElement.getBoundingClientRect();

        tmpScreenPosition.set((clientX - bounds.left) / bounds.width * 2 - 1, 1 - (clientY - bounds.top) / bounds.height * 2);
        this.raycaster.setFromCamera(tmpScreenPosition, this.renderManager.camera);

        const hit = this.traceMouse();

        if (!hit) return false;

        target.copy(hit.location);
        return true;
    }

    public updateMouseTarget(): void { // UGameEngine::FindMouseTargetObject 0x829bc0 retraces every frame, a full-length ray here costs ~0.5ms so it runs at 20Hz
        const now = performance.now();

        if (now - this.lastMouseTargetTime < MOUSE_TARGET_INTERVAL_MS) return;

        this.lastMouseTargetTime = now;

        let actor: ICollidable = null;
        let pickup: GroundPickup = null;
        let cursor = 0;

        const network = this.manGame.getComponent("network");
        const bounds = this.renderManager.renderer.domElement.getBoundingClientRect();

        if (this.isMouseInViewport && this.isOrbitControls && !this.isFreeCamera && !this.isCameraLocked &&
            this.mousePosition.x >= bounds.left && this.mousePosition.x < bounds.right &&
            this.mousePosition.y >= bounds.top && this.mousePosition.y < bounds.bottom &&
            !network.isMouseOverUI(this.mousePosition.x, this.mousePosition.y)) {
            tmpScreenPosition.set((this.mousePosition.x - bounds.left) / bounds.width * 2 - 1, 1 - (this.mousePosition.y - bounds.top) / bounds.height * 2);
            this.raycaster.setFromCamera(tmpScreenPosition, this.renderManager.camera);

            const hit = this.traceMouse();

            pickup = network.getPickup(this.raycaster, hit ? hit.distance : this.mousePickDistance);
            if (!pickup && hit && hit.actor !== this.renderManager.player as ICollidable && network.getActorObjectId(hit.actor)) actor = hit.actor;

            cursor = pickup ? 3 : network.getMouseCursor(actor);
        }

        if (actor === this.mouseTarget && pickup === this.mousePickup && cursor === this.mouseCursor) return;

        if (actor !== this.mouseTarget) {
            if ((this.mouseTarget as CollidingMesh)?.isStaticMeshActor) (this.mouseTarget as CollidingMesh | StaticMeshActor).setUnrealScriptProperty("L2ActorViewtype", EActorViewType_T.EAVT_InSight);
            if ((actor as CollidingMesh)?.isStaticMeshActor) (actor as CollidingMesh | StaticMeshActor).setUnrealScriptProperty("L2ActorViewtype", EActorViewType_T.EAVT_HighLight);
        }

        this.mouseTarget = actor;
        this.mousePickup = pickup;
        this.mouseCursor = cursor;
        this.renderManager.renderer.domElement.style.cursor = cursor ? this.manGame.getComponent("asset").getCursor(cursor) : "";
        this.renderManager.needsUpdate = true;
    }

    protected getPickDistance(origin: Vector3, direction: Vector3): number {
        const player = this.renderManager.player;

        // UGameEngine::FindMouseTargetObject 0x10559f0b..0x10559fd7: normalized view ray * 10000.
        if (player.isSwimmingMovement() || player.isFlyingMovement()) return 10000;

        const sectorBounds = this.renderManager.getSectorBounds();

        if (sectorBounds.length === 0) return this.renderManager.camera.far;

        tmpPickBounds.makeEmpty();

        for (const bounds of sectorBounds) tmpPickBounds.union(bounds);

        let near = 0, far = this.renderManager.camera.far;

        for (let axis = 0; axis < 3; axis++) {
            const delta = direction.getComponent(axis);
            const start = origin.getComponent(axis);
            const min = tmpPickBounds.min.getComponent(axis);
            const max = tmpPickBounds.max.getComponent(axis);

            if (Math.abs(delta) < 1e-12) {
                if (start < min || start > max) return 0;

                continue;
            }

            let a = (min - start) / delta, b = (max - start) / delta;

            if (a > b) [a, b] = [b, a];

            near = Math.max(near, a);
            far = Math.min(far, b);

            if (near > far) return 0;
        }

        return far;
    }
}

export default InputManager;
