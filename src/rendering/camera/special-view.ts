import { Quaternion, Vector2, Vector3 } from "three";
import getRotatorQuaternionElements, { sinRotator } from "../../assets/unreal/utils/rotator";
import type InputManager from "../../game/input-manager";
import type NetworkManager from "../../network/network-manager";
import type { SpecialCamera_T } from "../../network/game-packets";

const tmpDirection = new Vector3();
const tmpLocation = new Vector3();
const tmpDestination = new Vector3();
const tmpRotation = new Quaternion();
const arrRotation: Vector4Arr = [0, 0, 0, 1];

function wrapAngle(value: number) {
    value %= 65536;
    if (value > 32768) value -= 65536;
    if (value < -32767) value += 65536;

    return value;
}

function approach(value: number, target: number, step: number) {
    return value + Math.sign(target - value) * Math.min(Math.abs(target - value), step);
}

function approachAngle(value: number, target: number, delta: number, speed: number = null) {
    const difference = wrapAngle(target - value);
    const step = speed === null ? (Math.abs(difference) <= 2000 ? 5000 : Math.abs(difference) * 2.5) : speed;

    return wrapAngle(approach(value, value + difference, Math.trunc(delta * step)));
}

function viewDirection(yaw: number, pitch: number, target: Vector3) {
    const cosPitch = sinRotator(pitch + 16384);

    return target.set(cosPitch * sinRotator(yaw + 16384), cosPitch * sinRotator(yaw), sinRotator(pitch));
}

export class SpecialView {
    protected request: SpecialCamera_T = null;
    protected objectId = 0;
    protected isMoving = false;
    protected isReturning = false;
    protected wasEnabled = false;
    protected duration = 0;
    protected distance = 0;
    protected targetDistance = 0;
    protected distanceSpeed = 0;
    protected normalDistance = 0;
    protected readonly normalRotation = new Vector2();
    protected readonly rotation = new Vector2();
    protected readonly baseRotation = new Vector2();
    protected readonly targetRotation = new Vector2();
    protected readonly rotationSpeed = new Vector2();
    protected readonly relative = new Vector2();
    protected readonly targetRelative = new Vector2();
    protected readonly relativeSpeed = new Vector2();

    public constructor(protected readonly input: InputManager) {}

    public isActive() { return this.objectId !== 0; }
    public isWide() { return this.isActive() && !this.isReturning && !!this.request && this.request.wideScreen === 1; } // bRenderWide: set by SetSpecialViewTarget, cleared when release starts (0x1053077e)
    public reset() { if (this.isActive()) this.finish(); }

    public update(network: NetworkManager, delta: number) { // SetSpecialViewTarget 0x800000, SpecialViewTick 0x800860, ReleaseSpecialViewTarget 0x800700.
        const camera = this.input.controls.orbit.object;
        const request = network.getSpecialCamera();

        if (!network.isInWorld()) {
            if (this.isActive()) this.finish();
            this.request = null;
            return false;
        }

        if (request !== this.request) {
            this.request = request;
            const actor = request ? network.getActor(request.objectId) : null;

            if (actor) {
                if (!this.isActive()) {
                    camera.getWorldDirection(tmpDirection);
                    this.normalRotation.set(Math.trunc(Math.atan2(tmpDirection.y, tmpDirection.x) * 32768 / Math.PI), Math.trunc(Math.atan2(tmpDirection.z, Math.hypot(tmpDirection.x, tmpDirection.y)) * 32768 / Math.PI));
                    this.normalDistance = this.input.controls.orbit.unclippedDistance || camera.position.distanceTo(this.input.controls.orbit.target);
                    this.rotation.copy(this.normalRotation);
                    this.wasEnabled = this.input.controls.orbit.enabled;
                    this.input.controls.orbit.enabled = false;
                }

                viewDirection(request.yaw, request.pitch, tmpDirection);
                if (request.isRelative) {
                    const rotation = actor.getUnrealScriptProperty("Rotation") as Vector3Arr;

                    getRotatorQuaternionElements(rotation[0], rotation[1], rotation[2], arrRotation);
                    tmpDirection.applyQuaternion(tmpRotation.fromArray(arrRotation));
                }

                this.targetRotation.set(request.isRelative ? Math.trunc(Math.atan2(tmpDirection.y, tmpDirection.x) * 32768 / Math.PI) : request.yaw, request.isRelative ? Math.trunc(Math.atan2(tmpDirection.z, Math.hypot(tmpDirection.x, tmpDirection.y)) * 32768 / Math.PI) : request.pitch);
                this.targetDistance = request.distance;
                this.targetRelative.set(request.turn, request.rise);
                const time = Math.fround(request.time * Math.fround(0.001));

                if (this.objectId !== request.objectId || this.isReturning) {
                    this.baseRotation.copy(this.targetRotation);
                    this.distance = request.distance;
                    this.relative.set(0, 0);
                    this.isMoving = true;
                } else this.isMoving = false;

                this.distanceSpeed = time > 0 ? Math.abs(this.targetDistance - this.distance) / time : 1000000;
                this.rotationSpeed.set(time > 0 ? Math.trunc(Math.abs(wrapAngle(this.targetRotation.x - this.baseRotation.x)) / time) : 100 * 32768, time > 0 ? Math.trunc(Math.abs(wrapAngle(this.targetRotation.y - this.baseRotation.y)) / time) : 100 * 32768);
                this.relativeSpeed.set(time > 0 ? Math.trunc(Math.abs(wrapAngle(this.targetRelative.x - this.relative.x)) / time) : 100 * 32768, time > 0 ? Math.trunc(Math.abs(wrapAngle(this.targetRelative.y - this.relative.y)) / time) : 100 * 32768);
                this.duration = Math.fround(request.duration * Math.fround(0.001));
                this.objectId = request.objectId;
                this.isReturning = false;
            } else if (!request && this.isActive() && !this.isReturning) this.release(network);
        }

        if (!this.isActive()) return false;

        const actor = network.getActor(this.objectId);

        if (!actor) {
            this.release(network);
            if (!network.getActor(this.objectId)) this.finish();
            return this.isActive();
        }

        actor.getWorldPosition(tmpLocation);
        tmpLocation.z += actor.getCollisionHeight();

        if (!this.isMoving) {
            this.distance = approach(this.distance, this.targetDistance, delta * this.distanceSpeed);
            this.baseRotation.set(approachAngle(this.baseRotation.x, this.targetRotation.x, delta, this.rotationSpeed.x), approachAngle(this.baseRotation.y, this.targetRotation.y, delta, this.rotationSpeed.y));
        }

        viewDirection(this.baseRotation.x, this.baseRotation.y, tmpDirection);
        tmpDestination.copy(tmpLocation).addScaledVector(tmpDirection, -(this.distance + 220));

        let converged = false;
        if (this.isMoving) {
            const distance = camera.position.distanceTo(tmpDestination);

            camera.position.lerp(tmpDestination, distance === 0 ? 1 : Math.min(1, delta * (distance <= 40 ? 100 : distance * 2.5) / distance));
            tmpDirection.subVectors(tmpLocation, camera.position);
            const yaw = Math.trunc(Math.atan2(tmpDirection.y, tmpDirection.x) * 32768 / Math.PI), pitch = Math.trunc(Math.atan2(tmpDirection.z, Math.hypot(tmpDirection.x, tmpDirection.y)) * 32768 / Math.PI);

            this.rotation.set(approachAngle(this.rotation.x, yaw, delta), approachAngle(this.rotation.y, pitch, delta));
            converged = camera.position.distanceToSquared(tmpDestination) === 0 && wrapAngle(this.rotation.x - yaw) === 0 && wrapAngle(this.rotation.y - pitch) === 0;
        } else {
            camera.position.copy(tmpDestination);
            this.rotation.copy(this.baseRotation);
        }

        this.relative.set(approachAngle(this.relative.x, this.targetRelative.x, delta, this.isMoving ? null : this.relativeSpeed.x), approachAngle(this.relative.y, this.targetRelative.y, delta, this.isMoving ? null : this.relativeSpeed.y));
        viewDirection(this.rotation.x + this.relative.x, this.rotation.y + this.relative.y, tmpDirection);
        camera.lookAt(tmpDestination.copy(camera.position).add(tmpDirection));

        if (converged) {
            this.isMoving = false;
            if (this.isReturning) this.finish();
        } else if (!this.isReturning) {
            this.duration = Math.fround(this.duration - Math.fround(delta));
            if (this.duration <= 0) this.release(network);
        }

        return true;
    }

    protected release(network: NetworkManager) {
        this.objectId = network.getUserId();
        this.isReturning = this.isMoving = true;
        this.baseRotation.copy(this.normalRotation);
        this.distance = this.normalDistance - 250;
        this.targetRelative.set(0, 0);
    }

    protected finish() {
        const orbit = this.input.controls.orbit;

        this.input.getParent().getComponent("render").player.getCameraTargetPosition(orbit.target);
        viewDirection(this.normalRotation.x, this.normalRotation.y, tmpDirection);
        orbit.object.position.copy(orbit.target).addScaledVector(tmpDirection, -this.normalDistance);
        orbit.unclippedDistance = 0;
        orbit.update();
        orbit.enabled = this.wasEnabled;
        this.objectId = 0;
        this.isMoving = this.isReturning = false;
    }
}

export default SpecialView;
