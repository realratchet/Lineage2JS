import { DoubleSide, Object3D, PerspectiveCamera, Scene, Vector3 } from "three";
import { ColorByte } from "../utils/color-byte";
import type { WebGLRenderer } from "three";
import type LitSkinnedMesh from "../objects/lit-skinned-mesh";

export type RadarState_T = { party: Vector3Like[], target: Vector3Like, markers: Vector3Like[] };

type Vector3Like = { x: number, y: number, z: number };

const UNREAL_TO_RADIANS = Math.PI / 32768;
const RADAR_WIDTH = 128;
const RADAR_HEIGHT = 96;
const CAMERA_DISTANCE = 256;
const DOT_SCALE = 35 / 1500;
const DOT_RADIUS = 35;
const arrMeshNames = ["radar_back", "radar_dot_party", "radar_dot_target", "radar_dot_tutorial1", "radar_dot_tutorial2", "radar_center", "radar_n"];

const tmpDirection = new Vector3();
const tmpOffset = new Vector3();
const tmpColorByte = new ColorByte().set(127, 127, 127);

export class Radar { // Engine.dll UCanvas::DrawRadarBack 0x7FDFF0, DrawRadarTarget 0x7EFAF0, DrawRadarEtc 0x7EEFE0: hidden L2Radar actors with LineageDecos meshes in a 128x96 viewport.
    public isVisible = false;
    public uiScale = 1;
    public getState: () => RadarState_T = null;
    protected readonly scene = new Scene();
    protected readonly camera = new PerspectiveCamera();
    protected readonly actors = new Map<string, Object3D>();
    protected isTutorialFirst = false;

    public setMeshes(meshes: LitSkinnedMesh[]) {
        meshes.forEach((mesh, index) => {
            const actor = new Object3D();

            tmpOffset.copy(mesh.meshOrigin).multiply(mesh.scale).negate().applyQuaternion(mesh.quaternion); // MeshToWorld 0x946530 subtracts Origin in mesh space.
            mesh.position.add(tmpOffset);
            mesh.isUnlit = true; // RendMap 6 (REN_PlainTex) while drawing, 0x7FE187.
            mesh.updateActorLighting(null, [], tmpColorByte);
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.side = DoubleSide; // radar_center faces +Z yet retail shows it to the up-looking camera (L2.4_20 frame 2459388).
            actor.add(mesh);
            actor.rotation.order = "ZYX";
            actor.visible = false;
            this.scene.add(actor);
            this.actors.set(arrMeshNames[index], actor);
        });
    }

    public static getMeshNames() { return arrMeshNames; }

    public render(renderer: WebGLRenderer, view: PerspectiveCamera, origin: Vector3Like, width: number, height: number) {
        if (!this.isVisible || this.actors.size === 0 || !this.getState) return;

        const state = this.getState();

        view.getWorldDirection(tmpDirection);

        const yaw = Math.atan2(tmpDirection.y, tmpDirection.x) / UNREAL_TO_RADIANS;
        const pitch = Math.max(-0x2000, Math.min(-0x1200, Math.asin(Math.max(-1, Math.min(1, tmpDirection.z))) / UNREAL_TO_RADIANS - 0x800));
        const w = RADAR_WIDTH * this.uiScale, h = RADAR_HEIGHT * this.uiScale;

        this.camera.fov = 2 * Math.atan(Math.tan(13.5 * Math.PI / 180) / (width / height)) * 180 / Math.PI; // FovAngle 27 horizontal, aspect from the full viewport (FCameraSceneNode 0x8E6168).
        this.camera.aspect = width / height;
        this.camera.near = 1;
        this.camera.far = 1024;
        this.camera.updateProjectionMatrix();

        this.setRect(renderer, width - w, height - h, w, h, width, true);

        renderer.clearDepth();
        this.draw(renderer, "radar_back", 0, 0, 0, 0, 0, pitch, yaw);
        renderer.clearDepth();

        for (const member of state.party) this.drawDot(renderer, "radar_dot_party", member, origin, pitch, yaw);
        if (state.target) this.drawDot(renderer, "radar_dot_target", state.target, origin, pitch, yaw);

        for (const marker of state.markers) {
            this.isTutorialFirst = !this.isTutorialFirst; // 0x7EFD6E toggles the mesh on every call.
            renderer.clearDepth();
            this.drawDot(renderer, this.isTutorialFirst ? "radar_dot_tutorial1" : "radar_dot_tutorial2", marker, origin, pitch, yaw);
        }

        renderer.clearDepth();
        this.camera.position.set(0, 0, -CAMERA_DISTANCE);
        this.camera.up.set(-1, 0, 0);
        this.camera.lookAt(0, 0, 0);
        this.drawActor(renderer, "radar_center", -6, 0, 0, 0, -0x4000);

        const camPitch = pitch * UNREAL_TO_RADIANS, camYaw = yaw * UNREAL_TO_RADIANS;

        this.draw(renderer, "radar_n", -Math.sin(camPitch) * Math.cos(camYaw) * 6, -Math.sin(camPitch) * Math.sin(camYaw) * 6 - 50, Math.cos(camPitch) * 6, pitch + 16384, yaw, pitch, yaw);

        this.setRect(renderer, 0, 0, width, height, width, false);
    }

    protected setRect(renderer: WebGLRenderer, x: number, y: number, w: number, h: number, width: number, isScissor: boolean) {
        const target = renderer.getRenderTarget();

        if (!target) {
            renderer.setViewport(x, y, w, h);
            renderer.setScissor(x, y, w, h);
            renderer.setScissorTest(isScissor);
            return;
        }

        const scale = target.width / width;

        target.viewport.set(x * scale, y * scale, w * scale, h * scale);
        target.scissor.set(x * scale, y * scale, w * scale, h * scale);
        target.scissorTest = isScissor;
        renderer.setRenderTarget(target);
    }

    protected drawDot(renderer: WebGLRenderer, name: string, position: Vector3Like, origin: Vector3Like, pitch: number, yaw: number) {
        const dx = position.x - origin.x, dy = position.y - origin.y, length = Math.hypot(dx, dy);
        const radius = Math.min(length * DOT_SCALE, DOT_RADIUS) / (length || 1);

        this.draw(renderer, name, dx * radius, dy * radius, 0, 0, 0, pitch, yaw);
    }

    protected draw(renderer: WebGLRenderer, name: string, x: number, y: number, z: number, actorPitch: number, actorYaw: number, pitch: number, yaw: number) {
        const p = pitch * UNREAL_TO_RADIANS, q = yaw * UNREAL_TO_RADIANS;

        this.camera.position.set(-Math.cos(p) * Math.cos(q) * CAMERA_DISTANCE, -Math.cos(p) * Math.sin(q) * CAMERA_DISTANCE, -Math.sin(p) * CAMERA_DISTANCE);
        this.camera.up.set(0, 0, 1);
        this.camera.lookAt(0, 0, 0);
        this.drawActor(renderer, name, x, y, z, actorPitch, actorYaw);
    }

    protected drawActor(renderer: WebGLRenderer, name: string, x: number, y: number, z: number, actorPitch: number, actorYaw: number) {
        const actor = this.actors.get(name);

        if (!actor) return;

        actor.position.set(x, y, z);
        actor.rotation.set(0, -actorPitch * UNREAL_TO_RADIANS, actorYaw * UNREAL_TO_RADIANS);
        actor.visible = true;
        renderer.render(this.scene, this.camera);
        actor.visible = false;
    }
}

export default Radar;
