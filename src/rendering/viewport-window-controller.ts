import { Matrix4, Quaternion, Vector3 } from "three";
import { sinRotator } from "@l2js/engine/utils/rotator";
import Rotator from "../utils/rotator";
import type LocalSpaceSkeleton from "../objects/local-space-skeleton";

export enum ECALCSTEP_T {
    STEP_TARGET_PLAYER,
    STEP_MOVE_BACK,
    STEP_ROTATE_FLOAT,
    STEP_TARGET_FLOAT,
    STEP_MOVE_FLOAT
}

const tmpDirection = new Vector3();
const tmpPosition = new Vector3();
const tmpCameraBasis = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(-1, 0, 0)));
let pathElapsed = 0;

function getDirection(rotation: Rotator, target: Vector3): Vector3 {
    const cosPitch = sinRotator(rotation.pitch + 0x4000);
    return target.set(Math.fround(cosPitch * sinRotator(rotation.yaw + 0x4000)), Math.fround(cosPitch * sinRotator(rotation.yaw)), sinRotator(rotation.pitch));
}

function roundPosition(position: Vector3): void {
    position.set(Math.fround(position.x), Math.fround(position.y), Math.fround(position.z));
}

export class ViewportWindowController {
    public readonly location = new Vector3();
    public readonly rotation = new Rotator();
    public readonly viewRotation = new Rotator();
    public readonly quaternion = new Quaternion();
    public calcStep = ECALCSTEP_T.STEP_TARGET_PLAYER;
    protected readonly targetLocation = new Vector3();
    protected readonly targetRotation = new Rotator();
    protected readonly originalLocation = new Vector3();
    protected readonly arrCameraPath = [new Vector3(), new Vector3(), new Vector3()];
    protected targetSkeleton: LocalSpaceSkeleton = null;

    public constructor(pawnLocation: Vector3, pawnRotation: Rotator) {
        this.location.copy(pawnLocation).addScaledVector(getDirection(pawnRotation, tmpDirection), 200);
        roundPosition(this.location);
        this.rotation.set(pawnRotation.pitch, (pawnRotation.yaw + 32768) | 0, pawnRotation.roll);
        this.updateViewRotation();
    }

    public setCalcStep(step: ECALCSTEP_T, pawnRotation: Rotator, floatLocation?: Vector3, skeleton?: LocalSpaceSkeleton): void {
        this.calcStep = step;

        switch (step) {
            case ECALCSTEP_T.STEP_TARGET_PLAYER: break;
            case ECALCSTEP_T.STEP_MOVE_BACK:
                this.targetRotation.set(this.rotation.pitch, this.rotation.yaw, this.rotation.roll);
                this.targetLocation.copy(this.location).addScaledVector(getDirection(this.rotation, tmpDirection).normalize(), -200);
                roundPosition(this.targetLocation);
                break;
            case ECALCSTEP_T.STEP_ROTATE_FLOAT:
                this.targetRotation.set(-5400, (pawnRotation.yaw + 32768) | 0, pawnRotation.roll);
                this.targetLocation.copy(floatLocation);
                this.targetLocation.z = Math.fround(this.targetLocation.z - 5);
                this.targetLocation.addScaledVector(getDirection(this.targetRotation, tmpDirection), -100);
                roundPosition(this.targetLocation);
                this.arrCameraPath[0].copy(this.location);
                this.arrCameraPath[1].copy(this.location).addScaledVector(getDirection(pawnRotation, tmpDirection), 200);
                roundPosition(this.arrCameraPath[1]);
                this.arrCameraPath[2].copy(this.targetLocation);
                break;
            case ECALCSTEP_T.STEP_TARGET_FLOAT:
                this.originalLocation.copy(this.location);
                break;
            case ECALCSTEP_T.STEP_MOVE_FLOAT:
                this.targetSkeleton = skeleton;
                break;
            default: throw new Error(`Unknown viewport calculation step ${step}`);
        }
    }

    public calcView(deltaTime: number, pawnRotation: Rotator, floatLocation?: Vector3): void {
        const dt = Math.fround(deltaTime);

        switch (this.calcStep) {
            case ECALCSTEP_T.STEP_TARGET_PLAYER:
            case ECALCSTEP_T.STEP_TARGET_FLOAT: break;
            case ECALCSTEP_T.STEP_MOVE_BACK: {
                tmpDirection.subVectors(this.targetLocation, this.location);
                roundPosition(tmpDirection);
                const distance = Math.fround(400 * dt);

                if (tmpDirection.length() <= distance) {
                    tmpPosition.copy(this.targetLocation);
                    // Engine 1070CE1E calls SetCalcStep before storing the new Location at 1070CE97.
                    this.setCalcStep(ECALCSTEP_T.STEP_ROTATE_FLOAT, pawnRotation, floatLocation);
                    this.location.copy(tmpPosition);
                } else this.location.addScaledVector(tmpDirection.normalize(), distance);

                roundPosition(this.location);
                pathElapsed = 0;
                break;
            }
            case ECALCSTEP_T.STEP_ROTATE_FLOAT: {
                pathElapsed = Math.min(Math.fround(pathElapsed + dt), 2);
                const elapsed = pathElapsed - 1;
                const q = pathElapsed <= 1 ? 0.5 - 0.5 * elapsed * elapsed : 0.5 + 0.5 * elapsed * elapsed;
                const p = 1 - q;
                const [start, middle, end] = this.arrCameraPath;
                tmpPosition.set((p * start.x + 2 * q * middle.x) * p + q * q * end.x, (p * start.y + 2 * q * middle.y) * p + q * q * end.y, (p * start.z + 2 * q * middle.z) * p + q * q * end.z);
                this.rotation.pitch = Math.trunc(this.rotation.pitch - dt * 2700);

                if (pathElapsed === 2) this.setCalcStep(ECALCSTEP_T.STEP_TARGET_FLOAT, pawnRotation);

                this.location.copy(tmpPosition);
                roundPosition(this.location);
                break;
            }
            case ECALCSTEP_T.STEP_MOVE_FLOAT: break;
            default: throw new Error(`Unknown viewport calculation step ${this.calcStep}`);
        }

        this.updateViewRotation();
    }

    protected updateViewRotation(): void {
        this.viewRotation.set(this.rotation.pitch, this.rotation.yaw, this.rotation.roll);

        if (this.calcStep === ECALCSTEP_T.STEP_MOVE_FLOAT && this.targetSkeleton && this.targetSkeleton.bones.length) {
            this.targetSkeleton.getBoneWorldPosition(0, tmpDirection).sub(this.location);
            roundPosition(tmpDirection);
            this.viewRotation.set(Math.trunc(Math.atan2(tmpDirection.z, Math.hypot(tmpDirection.x, tmpDirection.y)) * 32768 / Math.PI), Math.trunc(Math.atan2(tmpDirection.y, tmpDirection.x) * 32768 / Math.PI), 0);
        }

        this.viewRotation.toQuaternion(this.quaternion).multiply(tmpCameraBasis);
    }
}

export default ViewportWindowController;
