import { Box3, Raycaster, Vector2, Vector3 } from "three";
import { IEngineComponent } from "./components";
import { ZUpOrbitControls } from "../rendering/camera/controllers/zup-orbit-controls";
import { ZUpPointerLockControls } from "../rendering/camera/controllers/zup-pointer-lock-controls";
import type GameManager from "./game-manager";
import type RenderManager from "../rendering/render-manager";
import type PhysicsManager from "../physics/physics-manager";
import type { ICollidable } from "../objects/objects";

const CLICK_MAX_MOVEMENT_SQ = 16;
const tmpScreenPosition = new Vector2();
const tmpMouseIntersection = new Vector3();
const tmpPickBounds = new Box3();
const dirForward = new Vector3();
const dirRight = new Vector3();
const cameraVelocity = new Vector3();
const arrMouseIntersections: THREE.Intersection[] = [];

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
    if ((actor as any).isTerrain || (actor as any).isStaticMeshActor) return true;

    const primitive = actor.getCollisionPrimitive ? actor.getCollisionPrimitive() : null;

    return !!primitive && primitive.kind === "bsp";
}

export class InputManager implements IEngineComponent<GameManager> {
    public speedCameraFPS = 5;
    public readonly raycaster = new Raycaster();
    public readonly controls: { orbit: ZUpOrbitControls, fps: ZUpPointerLockControls } = { orbit: null, fps: null };

    protected manGame: GameManager;
    protected renderManager: RenderManager;
    protected physicsManager: PhysicsManager;
    protected readonly dirKeys = { left: false, right: false, up: false, down: false, shift: false };
    protected readonly mouseDownPosition = new Vector2();
    protected isOrbitControls = true;
    protected isPrimaryMouseDown = false;
    protected hasMouseDragged = false;
    protected followPlayer = false;
    protected shiftTimeDown = 0;
    protected activeSector = 0;
    protected readonly keyDownHandler: (event: KeyboardEvent) => void;
    protected readonly keyUpHandler: (event: KeyboardEvent) => void;
    protected readonly mouseDownHandler: (event: MouseEvent) => void;
    protected readonly mouseMoveHandler: (event: MouseEvent) => void;
    protected readonly mouseUpHandler: (event: MouseEvent) => void;

    public constructor() {
        this.keyDownHandler = this.onHandleKeyDown.bind(this);
        this.keyUpHandler = this.onHandleKeyUp.bind(this);
        this.mouseDownHandler = this.onHandleMouseDown.bind(this);
        this.mouseMoveHandler = this.onHandleMouseMove.bind(this);
        this.mouseUpHandler = this.onHandleMouseUp.bind(this);
    }

    public setParent(parent: GameManager): this { this.manGame = parent; return this; }
    public getParent(): GameManager { return this.manGame; }

    public async onInit(): Promise<this> {
        const renderManager = this.renderManager = this.manGame.getComponent("render");
        const viewport = renderManager.viewport;

        this.physicsManager = this.manGame.getComponent("physics");
        this.controls.orbit = new ZUpOrbitControls(renderManager.camera, renderManager.renderer.domElement);
        this.controls.fps = new ZUpPointerLockControls(renderManager.camera, renderManager.renderer.domElement);
        this.controls.orbit.target.set(-87086.51708877791, 239936.94718888338, -3685.930229617832);
        this.controls.orbit.update();
        this.controls.orbit.addEventListener("change", () => renderManager.needsUpdate = true);
        this.controls.fps.addEventListener("change", () => renderManager.needsUpdate = true);
        this.controls.fps.addEventListener("lock", this.onPointerControlsLocked.bind(this));
        this.controls.fps.addEventListener("unlock", this.onPointerControlsUnlocked.bind(this));

        viewport.addEventListener("mousedown", this.mouseDownHandler);
        viewport.addEventListener("mousemove", this.mouseMoveHandler);
        viewport.addEventListener("mouseup", this.mouseUpHandler);
        window.addEventListener("keydown", this.keyDownHandler);
        window.addEventListener("keyup", this.keyUpHandler);

        return this;
    }

    public getOrbitTarget(): Vector3 { return this.controls.orbit.target; }
    public isUsingOrbitControls(): boolean { return this.isOrbitControls; }

    public setFollowPlayer(follow: boolean): void {
        this.followPlayer = follow;
        this.controls.orbit.setNativeLikeControls(follow);
        this.renderManager.onFollowPlayerChanged(follow);
    }

    public updateCamera(): void {
        if (this.isOrbitControls) return;

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

    public updateFollowPlayer(): void {
        if (!this.isOrbitControls || !this.followPlayer) return;

        const renderManager = this.renderManager;

        renderManager.player.getCameraTargetPosition(tmpMouseIntersection);
        cameraVelocity.copy(tmpMouseIntersection).sub(this.controls.orbit.target);
        renderManager.camera.position.add(cameraVelocity);
        this.controls.orbit.target.copy(tmpMouseIntersection);
        this.controls.orbit.update();
        renderManager.updateCameraMatrices();
    }

    protected clearDirectionKeys(): void {
        this.dirKeys.left = false;
        this.dirKeys.right = false;
        this.dirKeys.up = false;
        this.dirKeys.down = false;
        this.dirKeys.shift = false;
    }

    protected onPointerControlsLocked(): void {
        this.isOrbitControls = false;
        this.controls.orbit.enabled = false;
        this.clearDirectionKeys();
    }

    protected onPointerControlsUnlocked(): void {
        this.isOrbitControls = true;
        this.controls.orbit.enabled = true;
        this.controls.fps.getDirection(this.controls.orbit.target).multiplyScalar(100).add(this.renderManager.camera.position);
        this.controls.orbit.update();
        this.clearDirectionKeys();
    }

    protected onHandleKeyDown(event: KeyboardEvent): void {
        if (document.activeElement?.tagName === "INPUT") return;

        const renderManager = this.renderManager;

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

        if (event.key === "F3" || event.code === "F3") {
            event.preventDefault();
            event.stopPropagation();
            renderManager.toggleVisualizer();
            return;
        }

        if (event.key === "F4" || event.code === "F4") {
            event.preventDefault();
            event.stopPropagation();
            renderManager.nextVisualizerMode();
            return;
        }

        if (event.key === "F5" || event.code === "F5") {
            event.preventDefault();
            event.stopPropagation();
            renderManager.nextVisualizerLeafDetail();
            return;
        }

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
        switch (event.key.toLowerCase()) {
            case "c":
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
        if (event.button !== 0 || !this.isOrbitControls) return;

        this.isPrimaryMouseDown = true;
        this.hasMouseDragged = false;
        this.mouseDownPosition.set(event.clientX, event.clientY);
    }

    protected onHandleMouseMove(event: MouseEvent): void {
        if (!this.isPrimaryMouseDown || this.hasMouseDragged) return;

        const dx = event.clientX - this.mouseDownPosition.x;
        const dy = event.clientY - this.mouseDownPosition.y;

        if (dx * dx + dy * dy > CLICK_MAX_MOVEMENT_SQ) this.hasMouseDragged = true;
    }

    protected onHandleMouseUp(event: MouseEvent): void {
        if (event.button !== 0) return;

        const dx = event.clientX - this.mouseDownPosition.x;
        const dy = event.clientY - this.mouseDownPosition.y;
        const isClick = this.isPrimaryMouseDown && !this.hasMouseDragged && dx * dx + dy * dy <= CLICK_MAX_MOVEMENT_SQ;

        this.isPrimaryMouseDown = false;

        if (!isClick || !this.isOrbitControls) return;

        const renderManager = this.renderManager;
        const bounds = renderManager.renderer.domElement.getBoundingClientRect();

        tmpScreenPosition.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
        this.raycaster.setFromCamera(tmpScreenPosition, renderManager.camera);

        arrMouseIntersections.length = 0;
        
        if (!this.followPlayer) // only use fast intersect when using pawn navigation
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

        const pickDistance = this.getPickDistance(this.raycaster.ray.origin, this.raycaster.ray.direction);
        const physicsIntersection = pickDistance > 0 ? this.physicsManager.rayCheck(this.raycaster.ray.origin, this.raycaster.ray.direction, pickDistance, renderManager.player.getCollider(), renderManager.player.getRigidbody()) : null;

        renderManager.player.deleteLandmark(true);

        if (physicsIntersection) {
            tmpMouseIntersection.copy(physicsIntersection.location);
            renderManager.player.goTo(tmpMouseIntersection);
            if (isLandmarkSurface(physicsIntersection.actor)) renderManager.player.addLandmark(tmpMouseIntersection, physicsIntersection.normal);
        } else if (pickDistance > 0) {
            tmpMouseIntersection.copy(this.raycaster.ray.direction).multiplyScalar(pickDistance).add(this.raycaster.ray.origin);
            renderManager.player.goTo(tmpMouseIntersection);
        }

        renderManager.pickBSPNode(this.raycaster, physicsIntersection ? physicsIntersection.distance : pickDistance);
    }

    protected getPickDistance(origin: Vector3, direction: Vector3): number {
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
