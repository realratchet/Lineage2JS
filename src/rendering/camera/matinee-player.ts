import { Vector3 } from "three";
import type { PerspectiveCamera } from "three";
import type { MatineeAction_T, MatineeScene_T } from "../../assets/decode-worker/decode-protocol";
import type { Vector3Arr } from "@l2js/engine";
import { sinRotator } from "@l2js/engine/utils/rotator";
import sampleMatineePath, { interpolateMatineePath } from "./matinee-path";

const tmpLookAt = new Vector3();

type Pose_T = { location: Vector3Arr, rotation: Vector3Arr };
type MatineeActionInfo_T = MatineeAction_T & { samples: Vector3Arr[], pctStart: number, pctEnd: number, pctDuration: number };
type MatineeSceneInfo_T = { tag: string, actions: MatineeActionInfo_T[], duration: number };

function shortestDelta(from: number, to: number) { // Engine 0x1065bbb4 uses 65535 and [-32767,32767].
    let delta = to - from;

    while (delta > 32767) delta -= 65535;
    while (delta < -32767) delta += 65535;

    return delta;
}

function applyPose(camera: PerspectiveCamera, location: Vector3Arr, rotation: Vector3Arr) {
    const sp = sinRotator(rotation[0]), cp = sinRotator(rotation[0] + 0x4000);
    const sy = sinRotator(rotation[1]), cy = sinRotator(rotation[1] + 0x4000);

    camera.position.fromArray(location);
    camera.up.set(0, 0, 1);
    tmpLookAt.set(Math.fround(cp * cy), Math.fround(cp * sy), sp).add(camera.position);
    camera.lookAt(tmpLookAt);
}

export class MatineePlayer {
    protected readonly camera: PerspectiveCamera;
    protected readonly scenes = new Map<string, MatineeSceneInfo_T>();
    protected readonly pose: Pose_T = { location: [0, 0, 0], rotation: [0, 0, 0] };
    protected queue: MatineeActionInfo_T[] = [];
    protected elapsed = 0;
    protected duration = 0;
    protected isReverse = false;
    protected isStarted = false;

    public constructor(camera: PerspectiveCamera, scenes: MatineeScene_T[]) {
        this.camera = camera;

        for (const scene of scenes) {
            const actions = scene.actions.map((action, index) => {
                const previous = scene.actions[(index + scene.actions.length - 1) % scene.actions.length];
                const path = scene.actions.length > 1 ? sampleMatineePath(previous.location, previous.startControlPoint, action.location, action.endControlPoint, action.pathStyle) : { samples: [], length: 0 };
                const duration = action.constantPathVelocity && action.pathVelocity !== 0 ? Math.fround(path.length / action.pathVelocity) : action.duration;

                return { ...action, duration, samples: path.samples, pctStart: 0, pctEnd: 0, pctDuration: 0 };
            });
            const duration = Math.fround(actions.reduce((sum, action) => sum + action.duration, 0));
            let elapsed = 0;

            for (const action of actions) {
                action.pctStart = Math.fround(elapsed / duration);
                action.pctEnd = Math.fround((elapsed + action.duration) / duration);
                action.pctDuration = Math.fround((elapsed + action.duration) / duration - action.pctStart);
                elapsed = Math.fround(elapsed + action.duration);
            }

            this.scenes.set(scene.tag.toLowerCase(), { tag: scene.tag, actions, duration });
        }
    }

    public hasScene(tag: string) { return this.scenes.has(tag.toLowerCase()); }

    public trigger(tag: string, isReverse = false) {
        const scene = this.scenes.get(tag.toLowerCase());

        if (!scene) throw new Error(`Lobby has no SceneManager tagged '${tag}'.`);

        this.queue = scene.actions.slice();
        this.elapsed = 0;
        this.duration = scene.duration;
        this.isReverse = isReverse;
        this.isStarted = false;
    }

    public isPlaying() { return this.queue.length > 0; }

    public tick(deltaTime: number): boolean {
        if (this.queue.length === 0) return false;

        if (!this.isStarted) {
            const first = this.queue[0];

            this.isStarted = true;
            this.pose.rotation = first.rotation.slice() as Vector3Arr;

            if (first.action === "ActionWarp") {
                this.pose.location = first.location.slice() as Vector3Arr;
                this.queue = [];
                applyPose(this.camera, this.pose.location, this.pose.rotation);
                return true;
            }
        } else this.elapsed = Math.fround(this.elapsed + Math.fround(deltaTime));

        let pct = Math.fround(this.elapsed / this.duration);

        if (pct > 1) {
            this.queue = [];
            return true;
        }

        pct = Math.max(Math.fround(0.0001), pct);

        if (this.isReverse) pct = Math.fround(1 - pct);

        let index = 0;

        while (this.queue[index].pctEnd < pct) index++;

        const action = this.queue[index], previous = this.queue[(index + this.queue.length - 1) % this.queue.length];
        const alpha = Math.max(Math.fround(0.0001), Math.min(100, Math.fround((pct - action.pctStart) / (action.pctDuration || 1))));

        interpolateMatineePath(action.samples, alpha, this.pose.location);

        for (let i = 0; i < 3; i++) {
            this.pose.rotation[i] = Math.trunc(Math.fround(previous.rotation[i] + Math.fround(shortestDelta(previous.rotation[i], action.rotation[i]) * alpha)));
        }

        applyPose(this.camera, this.pose.location, this.pose.rotation);

        return true;
    }
}

export default MatineePlayer;
