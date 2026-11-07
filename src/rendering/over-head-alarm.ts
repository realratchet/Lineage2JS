import { Object3D, OrthographicCamera, Scene, Uniform, Vector2, Vector3, type DepthTexture, type ShaderMaterial, type WebGLRenderer } from "three";
import type LitSkinnedMesh from "../objects/lit-skinned-mesh";
import { ColorByte } from "../utils/color-byte";

type AlarmMarker_T = { x: number, y: number, distance: number, anchor: Vector3 };

const tmpOffset = new Vector3();
const tmpColorByte = new ColorByte().set(127, 127, 127);

export class OverHeadAlarm {
    protected readonly scene = new Scene();
    protected readonly camera = new OrthographicCamera(-1, 1, 1, -1, 1, 2e5);
    protected readonly actor = new Object3D();
    protected readonly arrMarkers: AlarmMarker_T[] = [];
    protected readonly worldDepth = new Uniform(null);
    protected readonly worldDepthSize = new Uniform(new Vector2());
    protected readonly worldAnchor = new Uniform(new Vector3());
    protected readonly reversedDepth = new Uniform(false);
    protected count = 0;
    protected width = 0;
    protected height = 0;

    public constructor() {
        this.scene.add(this.actor);
        this.camera.position.set(0, -1e5, 0);
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
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            const shader = material as ShaderMaterial;

            delete shader.defines.USE_FOG;
            shader.uniforms.alarmWorldDepth = this.worldDepth;
            shader.uniforms.alarmWorldDepthSize = this.worldDepthSize;
            shader.uniforms.alarmWorldAnchor = this.worldAnchor;
            shader.uniforms.alarmReversedDepth = this.reversedDepth;
            shader.fragmentShader = `uniform sampler2D alarmWorldDepth;
uniform vec2 alarmWorldDepthSize;
uniform vec3 alarmWorldAnchor;
uniform bool alarmReversedDepth;
${shader.fragmentShader}`.replace("void main() {", `void main() {
    float worldDepth = texture2D(alarmWorldDepth, gl_FragCoord.xy / alarmWorldDepthSize).r;
    if (alarmReversedDepth ? alarmWorldAnchor.z < worldDepth : alarmWorldAnchor.z > worldDepth) discard;`);
        }
        mesh.isUnlit = true;
        mesh.updateActorLighting(null, [], tmpColorByte);
        this.actor.add(mesh);
    }

    public add(x: number, y: number, distance: number, anchor: Vector3) {
        let marker = this.arrMarkers[this.count];

        if (!marker) this.arrMarkers[this.count] = marker = { x: 0, y: 0, distance: 0, anchor: new Vector3() };
        marker.x = x;
        marker.y = y;
        marker.distance = distance;
        marker.anchor.copy(anchor);
        this.count++;
    }

    public draw(renderer: WebGLRenderer, depth: DepthTexture, reversedDepth: boolean) {
        if (!this.isLoaded()) return;

        this.actor.rotation.z += 500 * Math.PI / 32768; // AL2Alarm::Tick 0x86d414.
        if (!this.count) return;

        if (!depth) throw new Error(`Quest alarm requires world depth.`);
        this.worldDepth.value = depth;
        this.worldDepthSize.value.set(depth.image.width, depth.image.height);
        this.reversedDepth.value = reversedDepth;

        this.camera.left = -this.width / 2;
        this.camera.right = this.width / 2;
        this.camera.top = this.height / 2;
        this.camera.bottom = -this.height / 2;
        this.camera.updateProjectionMatrix();
        renderer.state.buffers.depth.setReversed(this.camera.reversedDepth);
        renderer.state.buffers.depth.setClear(1);
        renderer.clearDepth();

        for (let i = 0; i < this.count; i++) {
            const marker = this.arrMarkers[i];

            this.worldAnchor.value.copy(marker.anchor);
            this.actor.position.set(marker.x - this.width / 2, 0, this.height / 2 - marker.y);
            this.actor.scale.setScalar(Math.fround(900.1) / marker.distance + Math.fround(0.87)); // UCanvas::DrawActor 0x7ed4d9..0x7ed50d; orthographic zoom1 at0x8e61f3.
            renderer.render(this.scene, this.camera);
        }
    }
}

export default OverHeadAlarm;
