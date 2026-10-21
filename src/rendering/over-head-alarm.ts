import { Object3D, OrthographicCamera, Scene, Vector3, type ShaderMaterial, type WebGLRenderer } from "three";
import type LitSkinnedMesh from "../objects/lit-skinned-mesh";
import { ColorByte } from "../utils/color-byte";

type AlarmMarker_T = { x: number, y: number, distance: number };

const tmpOffset = new Vector3();
const tmpColorByte = new ColorByte().set(127, 127, 127);

export class OverHeadAlarm {
    protected readonly scene = new Scene();
    protected readonly camera = new OrthographicCamera(-1, 1, 1, -1, 1, 200000);
    protected readonly actor = new Object3D();
    protected readonly arrMarkers: AlarmMarker_T[] = [];
    protected count = 0;
    protected width = 0;
    protected height = 0;

    public constructor() {
        this.scene.add(this.actor);
        this.camera.position.set(0, -100000, 0);
        this.camera.up.set(0, 0, 1);
        this.camera.lookAt(0, 0, 0);
    }

    public isLoaded() { return this.actor.children.length > 0; }
    public clear() { this.count = 0; }
    public setSize(width: number, height: number) { this.width = width; this.height = height; }

    public setMesh(mesh: LitSkinnedMesh) {
        tmpOffset.copy(mesh.meshOrigin).multiply(mesh.scale).negate().applyQuaternion(mesh.quaternion);
        mesh.position.add(tmpOffset);
        mesh.geometry.computeBoundingSphere();
        mesh.boundingSphere = mesh.geometry.boundingSphere.clone();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
            delete (material as ShaderMaterial).defines.USE_FOG;
        mesh.isUnlit = true;
        mesh.updateActorLighting(null, [], tmpColorByte);
        this.actor.add(mesh);
    }

    public add(x: number, y: number, distance: number) {
        let marker = this.arrMarkers[this.count];

        if (!marker) this.arrMarkers[this.count] = marker = { x: 0, y: 0, distance: 0 };
        marker.x = x;
        marker.y = y;
        marker.distance = distance;
        this.count++;
    }

    public draw(renderer: WebGLRenderer) {
        if (!this.isLoaded()) return;

        this.actor.rotation.z += 500 * Math.PI / 32768; // AL2Alarm::Tick 0x86d414.
        if (!this.count) return;

        this.camera.left = -this.width / 2;
        this.camera.right = this.width / 2;
        this.camera.top = this.height / 2;
        this.camera.bottom = -this.height / 2;
        this.camera.updateProjectionMatrix();
        renderer.clearDepth();

        for (let i = 0; i < this.count; i++) {
            const marker = this.arrMarkers[i];

            this.actor.position.set(marker.x - this.width / 2, 0, this.height / 2 - marker.y);
            this.actor.scale.setScalar(Math.fround(900.1) / marker.distance + Math.fround(0.87)); // UCanvas::DrawActor 0x7ed4d9..0x7ed50d; orthographic zoom1 at0x8e61f3.
            renderer.render(this.scene, this.camera);
        }
    }
}

export default OverHeadAlarm;
