import { Vector3 } from "three";
import type { PerspectiveCamera } from "three";
import type { MatineeScene_T } from "../../assets/decode-worker/decode-protocol";
import type { Vector3Arr } from "@l2js/engine";

const tmpLookAt = new Vector3();

type Pose_T = { location: Vector3Arr, rotation: Vector3Arr };

function shortestDelta(from: number, to: number) { return ((((to - from) % 65536) + 98304) % 65536) - 32768; }

function applyPose(camera: PerspectiveCamera, location: Vector3Arr, rotation: Vector3Arr) {
    const pitch = rotation[0] * Math.PI / 32768, yaw = rotation[1] * Math.PI / 32768;

    camera.position.fromArray(location);
    camera.up.set(0, 0, 1);
    tmpLookAt.set(Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)).add(camera.position);
    camera.lookAt(tmpLookAt);
}

export class MatineePlayer {
    protected readonly camera: PerspectiveCamera;
    protected readonly scenes = new Map<string, MatineeScene_T>();
    protected readonly pose: Pose_T = { location: [0, 0, 0], rotation: [0, 0, 0] };
    protected from: Pose_T = null;
    protected queue: MatineeScene_T["actions"] = [];
    protected elapsed = 0;

    public constructor(camera: PerspectiveCamera, scenes: MatineeScene_T[]) {
        this.camera = camera;

        for (const scene of scenes) this.scenes.set(scene.tag.toLowerCase(), scene);
    }

    public hasScene(tag: string) { return this.scenes.has(tag.toLowerCase()); }

    public trigger(tag: string) {
        const scene = this.scenes.get(tag.toLowerCase());

        if (!scene) throw new Error(`Lobby has no SceneManager tagged '${tag}'.`);

        this.queue = scene.actions.slice();
        this.from = null;
        this.elapsed = 0;
        this.advance();
    }

    protected advance() {
        while (this.queue.length > 0 && !(this.queue[0].action === "ActionMoveCamera" && this.queue[0].duration > 0)) {
            const action = this.queue.shift();

            this.pose.location = action.location.slice() as Vector3Arr;
            this.pose.rotation = action.rotation.slice() as Vector3Arr;
        }

        this.from = this.queue.length > 0 ? { location: this.pose.location.slice() as Vector3Arr, rotation: this.pose.rotation.slice() as Vector3Arr } : null;
        this.elapsed = 0;
        applyPose(this.camera, this.pose.location, this.pose.rotation);
    }

    public isPlaying() { return this.queue.length > 0; }

    public tick(deltaTime: number): boolean {
        if (this.queue.length === 0) return false;

        const action = this.queue[0], from = this.from;
        const alpha = Math.min(1, (this.elapsed += deltaTime) / action.duration);

        for (let i = 0; i < 3; i++) {
            this.pose.location[i] = from.location[i] + (action.location[i] - from.location[i]) * alpha;
            this.pose.rotation[i] = from.rotation[i] + shortestDelta(from.rotation[i], action.rotation[i]) * alpha;
        }

        applyPose(this.camera, this.pose.location, this.pose.rotation);

        if (alpha >= 1) {
            this.queue.shift();
            this.advance();
        }

        return true;
    }
}

export default MatineePlayer;
