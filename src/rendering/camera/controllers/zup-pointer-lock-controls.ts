import { EventDispatcher, PerspectiveCamera, Vector3 } from "three";

/*
 * Z-up equivalent of three/examples/jsm/controls/PointerLockControls, which
 * hardcodes a Y-up Euler order ('YXZ') that only works because three.js's
 * fixed camera-forward (local -Z) is perpendicular to world-up when up is Y —
 * not true when up is Z (there, -Z is straight down). So instead of Euler
 * decomposition we track yaw/pitch directly and rebuild the look direction via
 * spherical coordinates, then hand off to Object3D.lookAt.
 */
const _lookTarget = new Vector3();
const _PI_2 = Math.PI / 2;
/* Stay short of the poles so lookAt never gets a degenerate up-vector. */
const _MAX_PITCH = _PI_2 - 1e-4;

class ZUpPointerLockControls extends EventDispatcher {
    public readonly domElement: HTMLElement;
    public isLocked = false;

    public pointerSpeed = 1.0;

    private yaw: number;
    private pitch: number;

    private readonly camera: PerspectiveCamera;
    private readonly onMouseMove: (event: MouseEvent) => void;
    private readonly onPointerlockChange: () => void;
    private readonly onPointerlockError: () => void;

    public constructor(camera: PerspectiveCamera, domElement: HTMLElement) {
        super();

        this.camera = camera;
        this.domElement = domElement;

        this.syncFromCamera();

        this.onMouseMove = (event: MouseEvent) => {
            if (!this.isLocked) return;

            const movementX = event.movementX || 0;
            const movementY = event.movementY || 0;

            /*
             * Re-sync first: render-manager.ts (bookmark keys, sector jumps) can
             * reposition/reorient the camera directly without going through this
             * controller, which would otherwise leave yaw/pitch stale and snap the
             * view on the next move.
             */
            this.syncFromCamera();

            /* Yaw negated, pitch not: the render is mirrored horizontally (ue2-conventions.ts). */
            this.yaw += movementX * 0.002 * this.pointerSpeed;
            this.pitch -= movementY * 0.002 * this.pointerSpeed;
            this.pitch = Math.max(-_MAX_PITCH, Math.min(_MAX_PITCH, this.pitch));

            this.applyOrientation();

            this.dispatchEvent({ type: "change" });
        };

        this.onPointerlockChange = () => {
            if (this.domElement.ownerDocument.pointerLockElement === this.domElement) {
                this.syncFromCamera();
                this.isLocked = true;
                this.dispatchEvent({ type: "lock" });
            } else {
                this.isLocked = false;
                this.dispatchEvent({ type: "unlock" });
            }
        };

        this.onPointerlockError = () => {
            console.error("ZUpPointerLockControls: Unable to use Pointer Lock API");
        };

        this.connect();
    }

    private syncFromCamera() {
        const dir = this.camera.getWorldDirection(new Vector3());
        this.pitch = Math.asin(Math.max(-1, Math.min(1, dir.z)));
        this.yaw = Math.atan2(dir.y, dir.x);
    }

    private applyOrientation() {
        const cosPitch = Math.cos(this.pitch);

        _lookTarget.set(
            this.camera.position.x + cosPitch * Math.cos(this.yaw),
            this.camera.position.y + cosPitch * Math.sin(this.yaw),
            this.camera.position.z + Math.sin(this.pitch)
        );

        this.camera.lookAt(_lookTarget);
    }

    public connect() {
        this.domElement.ownerDocument.addEventListener("mousemove", this.onMouseMove);
        this.domElement.ownerDocument.addEventListener("pointerlockchange", this.onPointerlockChange);
        this.domElement.ownerDocument.addEventListener("pointerlockerror", this.onPointerlockError);
    }

    public disconnect() {
        this.domElement.ownerDocument.removeEventListener("mousemove", this.onMouseMove);
        this.domElement.ownerDocument.removeEventListener("pointerlockchange", this.onPointerlockChange);
        this.domElement.ownerDocument.removeEventListener("pointerlockerror", this.onPointerlockError);
    }

    public dispose() {
        this.disconnect();
    }

    public getDirection(target: Vector3): Vector3 {
        return target.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    }

    public lock() {
        this.domElement.requestPointerLock();
    }

    public unlock() {
        this.domElement.ownerDocument.exitPointerLock();
    }
}

export default ZUpPointerLockControls;
export { ZUpPointerLockControls };
