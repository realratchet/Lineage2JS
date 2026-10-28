import { Box3, Camera, Color, CubeTexture, CustomBlending, DataTexture, FramebufferTexture, FrontSide, LinearFilter, LinearMipmapLinearFilter, Material, Matrix3, Matrix4, Mesh, MeshBasicMaterial, NoBlending, Object3D, OneFactor, OneMinusSrcAlphaFactor, OrthographicCamera, PerspectiveCamera, PlaneGeometry, RGBAFormat, Scene, ShaderMaterial, SrcAlphaFactor, Texture, Uniform, Vector2, Vector3, WebGLRenderTarget, ZeroFactor } from "three";
import GLOBAL_UNIFORMS from "../materials/global-uniforms";
import { sinRotator } from "../assets/unreal/utils/rotator";
import type BaseActor from "../base-actor";
import type AnimationComponent from "./components/animation-component";
import type PawnRenderableComponent from "../rendering/components/pawn-renderable-component";
import type PawnMesh from "./pawn-mesh";
import type LocalSpaceSkeleton from "./local-space-skeleton";
import type MeshStaticMaterial from "../materials/mesh-static-material/mesh-static-material";
import type { BatchRenderGroup_T } from "./lit-actor";

const PROJECTOR_CLIPPING_RANGE = 0.2; // AShadowProjector::CheckVisible 0x93dc80: GL2ProjectorCR * 32768 * 0.0625 kilounits.
const SHADOW_RANGE = Math.fround(PROJECTOR_CLIPPING_RANGE) * 2048;
const SHADOW_BAND_Z = 200;
const LIGHT_DISTANCE = 704;
const SHADOW_SIZE = 256;
const SHADOW_POOL_SIZE = 20; // UShadowBitmapMaterial::Get 0x93ec08..0x93ec51 reuses targets modulo20.

const BLUR_VERTEX = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4( position.xy, 0.0, 1.0 );
}`;

// SRCALPHA,ONE accumulates squared alpha into RGBA8 after each offset.
const BLUR_FRAGMENT = `
uniform sampler2D tSource;
varying vec2 vUv;
void main() {
    float alpha = 0.0;
    for (int i = 0; i < 9; i++) {
        int x = i % 3 - 1, y = i / 3 - 1;
        float weight = (x == 0 && y == 0 ? 132.0 : 88.0) / 255.0;
        float sampleAlpha = texture2D(tSource, vUv - vec2(float(x), float(y)) * 1.5 / ${SHADOW_SIZE}.0).a * weight;
        alpha = min(1.0, alpha + floor(sampleAlpha * sampleAlpha * 255.0 + 0.5) / 255.0);
    }
    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}`;


type PawnProjector_T = { actor: BaseActor, origin: Vector3, matrix: Matrix4, view: Matrix4, projection: Matrix4, normals: Matrix3, bounds: Box3, depth: Vector2, fov: number, slot: number, revision: number, frame: number };
type ShadowTarget_T = { target: WebGLRenderTarget, revision: number };
type ShadowTexture_T = { texture: FramebufferTexture, frame: number };
type ReceiverMaterial_T = { material: ShaderMaterial, version: number };
type ReceiverBounds_T = { geometry: THREE.BufferGeometry, position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, index: THREE.BufferAttribute, positionVersion: number, indexVersion: number, start: number, count: number, bounds: Box3 };

const tmpFocusPos = new Vector3();
const tmpCasterPos = new Vector3();
const tmpClearColor = new Color();
const tmpBoneMatrix = new Matrix4();
const tmpDirection = new Vector3();
const tmpUp = new Vector3();
const tmpLeft = new Vector3();
const tmpCorner = new Vector3();
const tmpRay = new Vector3();
const tmpReceiverBounds = new Box3();
const tmpNormalMatrix = new Matrix3();
const arrSwappedObjects: Mesh[] = [];
const arrSwappedMaterials: (Material | Material[])[] = [];
const arrHiddenAttachments: Object3D[] = [];
const arrTraverse: Object3D[] = [];
const arrPawnMeshes: PawnMesh[] = [];
const arrPausedSkeletons: LocalSpaceSkeleton[] = [];

export class ShadowProjector {
    public readonly target = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat, depthBuffer: false });
    protected readonly blurTarget = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat, depthBuffer: true });
    protected readonly blurScene = new Scene();
    protected readonly blurCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    protected readonly blurGeometry = new PlaneGeometry(2, 2);
    protected readonly blurMaterial = new ShaderMaterial({ vertexShader: BLUR_VERTEX, fragmentShader: BLUR_FRAGMENT, depthTest: false, depthWrite: false, blending: NoBlending, uniforms: { tSource: { value: null } } });
    protected readonly camera = new PerspectiveCamera();
    protected readonly silhouette = new MeshBasicMaterial({ color: 0x000000 });
    protected readonly attenuation = createAttenuationCube();
    protected readonly targets: ShadowTarget_T[] = [];
    protected readonly shadowTextures: ShadowTexture_T[] = [];
    protected readonly projectors: PawnProjector_T[] = [];
    protected readonly cacheProjectors = new WeakMap<BaseActor, PawnProjector_T>();
    protected readonly cacheReceivers = new WeakMap<ShaderMaterial, ReceiverMaterial_T>();
    protected readonly cacheReceiverBounds = new WeakMap<THREE.BufferGeometry["groups"][number], ReceiverBounds_T>();
    protected readonly receiverMaterials = new Set<ShaderMaterial>();
    protected readonly receiverMeshes = new WeakSet<Mesh>();
    protected readonly lastFocusPosition = new Vector3();
    protected readonly lastLightDirection = new Vector3();
    protected readonly lastCasters: Object3D[] = [];
    protected readonly cacheSilhouetteMaterials = new WeakMap<Material[], Material[]>();
    protected nextTarget = 0;
    protected frame = 0;
    protected renderingShadow = false;

    public constructor() {
        this.targets.push({ target: this.target, revision: 0 });
        this.camera.matrixAutoUpdate = this.camera.matrixWorldAutoUpdate = false;
        GLOBAL_UNIFORMS.shadowMap.value = this.target.texture;
        GLOBAL_UNIFORMS.shadowDarkness.value = 1;
        this.blurScene.add(new Mesh(this.blurGeometry, this.blurMaterial));
    }

    public attachReceivers(root: Object3D): void {
        root.traverse(object => {
            const mesh = object as Mesh;
            if (!mesh.isMesh || this.receiverMeshes.has(mesh)) return;

            const after = mesh.onAfterRender;
            mesh.onAfterRender = (renderer, scene, camera, geometry, material, group) => {
                after.call(mesh, renderer, scene, camera, geometry, material, group);
                this.drawReceiver(renderer, scene, camera, mesh, material as ShaderMaterial, group);
            };
            this.receiverMeshes.add(mesh);
        });
    }

    public update(_renderer: THREE.WebGLRenderer, focus: Object3D, casters: Iterable<Object3D>, lightDirection: Vector3): void {
        this.frame++;
        focus.getWorldPosition(tmpFocusPos);
        this.lastFocusPosition.copy(tmpFocusPos);
        this.lastLightDirection.copy(lightDirection);
        this.lastCasters.length = this.projectors.length = 0;

        for (const object of casters) {
            if (!object.visible && object !== focus) continue;
            const actor = object as BaseActor;
            if (actor.getUnrealScriptProperty("bHidden") || actor.getUnrealScriptProperty("bHideShadow")) continue;
            object.getWorldPosition(tmpCasterPos);
            const dx = tmpCasterPos.x - tmpFocusPos.x, dy = tmpCasterPos.y - tmpFocusPos.y, dz = tmpCasterPos.z - tmpFocusPos.z;
            if (dz <= -SHADOW_BAND_Z || dz >= SHADOW_BAND_Z || Math.hypot(dx, dy) > SHADOW_RANGE) continue;

            const animation = actor.getComponent<AnimationComponent>("animation");
            if (!animation.getMeshes().length) continue;

            let projector = this.cacheProjectors.get(actor);
            if (!projector) {
                projector = { actor, origin: new Vector3(), matrix: new Matrix4(), view: new Matrix4(), projection: new Matrix4(), normals: new Matrix3(), bounds: new Box3(), depth: new Vector2(), fov: 0, slot: -1, revision: -1, frame: -1 };
                this.cacheProjectors.set(actor, projector);
            }

            this.updateProjection(projector, lightDirection);
            this.lastCasters.push(actor);
            this.projectors.push(projector);
        }

        const retained = this.projectors.length > SHADOW_POOL_SIZE ? this.projectors.length : 0;
        while (this.shadowTextures.length > retained) this.shadowTextures.pop().texture.dispose();
        GLOBAL_UNIFORMS.shadowActive.value = this.projectors.length ? 1 : 0;
    }

    protected updateProjection(projector: PawnProjector_T, lightDirection: Vector3): void {
        const actor = projector.actor, sphere = actor.getComponent<PawnRenderableComponent>("pawnRenderable").getPrimitiveRenderSphere();
        actor.getComponent<AnimationComponent>("animation").getBoneWorldMatrix(0, tmpBoneMatrix);
        const root = tmpCasterPos.setFromMatrixPosition(tmpBoneMatrix);
        const scale = 32767.5 / Math.PI;
        const pitch = Math.trunc(Math.atan2(lightDirection.z, Math.hypot(lightDirection.x, lightDirection.y)) * scale), yaw = Math.trunc(Math.atan2(lightDirection.y, lightDirection.x) * scale);
        const sp = sinRotator(pitch), cp = sinRotator(pitch + 16384), sy = sinRotator(yaw), cy = sinRotator(yaw + 16384);
        tmpDirection.set(Math.fround(cp * cy), Math.fround(cp * sy), sp);
        tmpUp.set(Math.fround(-sp * cy), Math.fround(-sp * sy), cp);
        tmpLeft.set(sy, -cy, 0);

        projector.fov = Math.trunc(Math.atan2(sphere.radius * 2 + 160, LIGHT_DISTANCE) * 180 / Math.PI + 5);
        const halfAngle = projector.fov * Math.PI / 360, tangent = Math.fround(Math.tan(halfAngle)), halfSize = LIGHT_DISTANCE * tangent, factor = Math.fround(0.5 / tangent);
        const origin = projector.origin.copy(root).addScaledVector(tmpDirection, -LIGHT_DISTANCE);
        const u = tmpCorner.copy(tmpLeft).multiplyScalar(-factor).addScaledVector(tmpDirection, 0.5), v = tmpRay.copy(tmpUp).multiplyScalar(-factor).addScaledVector(tmpDirection, 0.5), d = tmpDirection;
        projector.matrix.set(u.x, u.y, u.z, -u.dot(origin), v.x, v.y, v.z, -v.dot(origin), d.x, d.y, d.z, -d.dot(origin), 0, 0, 0, 1);
        projector.normals.set(u.x / u.length(), u.y / u.length(), u.z / u.length(), v.x / v.length(), v.y / v.length(), v.z / v.length(), -d.x, -d.y, -d.z);
        // FCameraSceneNode::UpdateMatrices uses inverse angles before SinTab quantization (Engine10615900).
        const cameraSp = sinRotator(-pitch), cameraCp = sinRotator(16384 - pitch), cameraSy = sinRotator(-yaw), cameraCy = sinRotator(16384 - yaw);
        const xx = Math.fround(cameraCy * cameraCp), xz = Math.fround(cameraCy * cameraSp), yx = Math.fround(-cameraSy * cameraCp), yz = Math.fround(-cameraSy * cameraSp);
        const ox = Math.fround(origin.x), oy = Math.fround(origin.y), oz = Math.fround(origin.z);
        projector.view.set(cameraSy, cameraCy, 0, Math.fround(-ox * cameraSy - oy * cameraCy), xz, yz, cameraCp, Math.fround(-ox * xz - oy * yz - oz * cameraCp), -xx, -yx, cameraSp, Math.fround(ox * xx + oy * yx - oz * cameraSp), 0, 0, 0, 1);
        const near = 10, far = 65536, f = Math.fround(1 / Math.tan(Math.fround(halfAngle))), zScale = Math.fround(far / (far - near)), zOffset = Math.fround(-near * far / (far - near));
        projector.projection.set(f, 0, -1 / SHADOW_SIZE, 0, 0, f, 1 / SHADOW_SIZE, 0, 0, 0, 1 - 2 * zScale, 2 * zOffset, 0, 0, -1, 0);
        const farOffset = LIGHT_DISTANCE / (Math.cos(halfAngle) * Math.sqrt(1 + 2 * tangent * tangent));
        projector.depth.set(LIGHT_DISTANCE, LIGHT_DISTANCE + farOffset);
        projector.bounds.makeEmpty();
        for (let y = -1; y <= 1; y += 2) for (let x = -1; x <= 1; x += 2) {
            tmpCorner.copy(root).addScaledVector(tmpLeft, halfSize * x).addScaledVector(tmpUp, halfSize * y);
            projector.bounds.expandByPoint(tmpCorner);
            tmpRay.copy(tmpCorner).sub(origin).normalize().multiplyScalar(LIGHT_DISTANCE / Math.cos(halfAngle)).add(tmpCorner);
            projector.bounds.expandByPoint(tmpRay);
        }
        projector.frame = -1;
    }

    protected getShadowTarget(renderer: THREE.WebGLRenderer, projector: PawnProjector_T): WebGLRenderTarget {
        if (projector.frame === this.frame && this.targets[projector.slot].revision === projector.revision) return this.targets[projector.slot].target;
        const index = this.nextTarget;
        this.nextTarget = (index + 1) % SHADOW_POOL_SIZE;
        let slot = this.targets[index];
        if (!slot) {
            const target = this.target.clone();
            slot = { target, revision: 0 };
            this.targets.push(slot);
        }
        this.camera.matrixWorldInverse.copy(projector.view);
        this.camera.matrixWorld.copy(projector.view).invert();
        this.camera.matrix.copy(this.camera.matrixWorld);
        this.camera.projectionMatrix.copy(projector.projection);
        this.camera.projectionMatrixInverse.copy(projector.projection).invert();
        this.renderShadow(renderer, projector.actor, this.camera, slot.target, projector.frame === this.frame);
        slot.revision++;
        projector.slot = index;
        projector.revision = slot.revision;
        projector.frame = this.frame;
        return slot.target;
    }

    protected getShadowTexture(renderer: THREE.WebGLRenderer, projector: PawnProjector_T, index: number): Texture {
        if (this.projectors.length <= SHADOW_POOL_SIZE) return this.getShadowTarget(renderer, projector).texture;
        while (this.shadowTextures.length <= index) {
            const texture = new FramebufferTexture(SHADOW_SIZE, SHADOW_SIZE);
            texture.minFilter = texture.magFilter = LinearFilter;
            this.shadowTextures.push({ texture, frame: -1 });
        }
        const cached = this.shadowTextures[index];
        if (cached.frame === this.frame) return cached.texture;

        const target = this.getShadowTarget(renderer, projector), previous = renderer.getRenderTarget();
        try { renderer.copyTextureToTexture(target.texture, cached.texture); }
        finally { renderer.setRenderTarget(previous); }
        cached.frame = this.frame;
        return cached.texture;
    }

    protected drawReceiver(renderer: THREE.WebGLRenderer, scene: Scene, camera: Camera, mesh: Mesh, source: ShaderMaterial, group: THREE.BufferGeometry["groups"][number]): void {
        if (this.renderingShadow || !GLOBAL_UNIFORMS.shadowActive.value || !source.isShaderMaterial || !source.colorWrite) return;
        const terrain = (source as any).isTerrainMaterial;
        if (!(source as any).isStaticMeshMaterial && !terrain || "USE_ACTOR_LIGHTS" in source.defines || "NO_SHADOW_RECEIVE" in source.defines) return;
        if (terrain && group) {
            const next = mesh.geometry.groups[mesh.geometry.groups.indexOf(group) + 1];
            if (next && next.start === group.start && next.count === group.count) return;
        }
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const bounds = group && !("USE_SWAY" in source.defines) && !(mesh as any).isSkinnedMesh && !mesh.morphTargetInfluences ? this.getReceiverBounds(mesh.geometry, group) : mesh.geometry.boundingBox;
        tmpReceiverBounds.copy(bounds).applyMatrix4(mesh.matrixWorld);
        let material: ShaderMaterial = null;
        for (let i = 0; i < this.projectors.length; i++) {
            const projector = this.projectors[i];
            if (!projector.bounds.intersectsBox(tmpReceiverBounds)) continue;
            const texture = this.getShadowTexture(renderer, projector, i);
            if (!material) material = this.getReceiverMaterial(source);
            material.uniforms.shadowMap.value = texture;
            material.uniforms.shadowMatrix.value = projector.matrix;
            material.uniforms.shadowDepthRange.value = projector.depth;
            tmpNormalMatrix.setFromMatrix4(camera.matrixWorld);
            (material.uniforms.shadowNormalMatrix.value as Matrix3).multiplyMatrices(projector.normals, tmpNormalMatrix);
            material.uniformsNeedUpdate = true;
            renderer.renderBufferDirect(camera, scene, mesh.geometry, material, mesh, group);
        }
    }

    public getReceiverBounds(geometry: THREE.BufferGeometry, group: THREE.BufferGeometry["groups"][number]): Box3 {
        const position = geometry.getAttribute("position"), index = geometry.index;
        const buffer = (position as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute ? (position as THREE.InterleavedBufferAttribute).data : position as THREE.BufferAttribute;
        const positionVersion = buffer.version, indexVersion = index ? index.version : -1;
        const prepared = group as BatchRenderGroup_T;
        if (prepared.position === position && prepared.index === index && prepared.positionVersion === positionVersion && prepared.indexVersion === indexVersion && prepared.boundsStart === group.start && prepared.boundsCount === group.count) return prepared.bounds;
        const cached = this.cacheReceiverBounds.get(group);
        if (cached && cached.geometry === geometry && cached.position === position && cached.index === index && cached.positionVersion === positionVersion && cached.indexVersion === indexVersion && cached.start === group.start && cached.count === group.count) return cached.bounds;

        const bounds = cached ? cached.bounds : new Box3();
        bounds.makeEmpty();
        for (let i = group.start, end = Math.min(group.start + group.count, index ? index.count : position.count); i < end; i++) {
            tmpCorner.fromBufferAttribute(position, index ? index.getX(i) : i);
            bounds.expandByPoint(tmpCorner);
        }
        this.cacheReceiverBounds.set(group, { geometry, position, index, positionVersion, indexVersion, start: group.start, count: group.count, bounds });
        return bounds;
    }

    protected getReceiverMaterial(source: ShaderMaterial): ShaderMaterial {
        const cached = this.cacheReceivers.get(source);
        if (cached && cached.version === source.version) return cached.material;
        if (cached) cached.material.dispose();
        // Trace7334112 presents X8R8G8B8; preserve canvas coverage while blending shadow RGB.
        const material = new ShaderMaterial({ vertexShader: source.vertexShader, fragmentShader: source.fragmentShader, defines: { ...source.defines, USE_PROJECTOR_RECEIVER: "" }, uniforms: { ...source.uniforms, shadowMatrix: new Uniform(new Matrix4()), shadowMap: new Uniform(null), shadowNormalMatrix: new Uniform(new Matrix3()), shadowDepthRange: new Uniform(new Vector2()), shadowAttenuation: new Uniform(this.attenuation) }, side: FrontSide, transparent: true, depthWrite: false, blending: CustomBlending, blendSrc: SrcAlphaFactor, blendSrcAlpha: ZeroFactor, blendDst: OneMinusSrcAlphaFactor, blendDstAlpha: OneFactor });
        if ((source as any).isTerrainMaterial) {
            delete material.defines.TERRAIN_OVERLAY;
            delete material.defines.USE_UV_TEXTURE;
        }
        delete material.defines.USE_LIT_ATTRIBUTES;
        material.vertexColors = source.vertexColors;
        const dispose = () => material.dispose();
        source.addEventListener("dispose", dispose);
        material.addEventListener("dispose", () => { source.removeEventListener("dispose", dispose); this.receiverMaterials.delete(material); this.cacheReceivers.delete(source); });
        this.receiverMaterials.add(material);
        this.cacheReceivers.set(source, { material, version: source.version });
        return material;
    }

    protected renderShadow(renderer: THREE.WebGLRenderer, caster: Object3D, camera: Camera, target: WebGLRenderTarget, reusePose: boolean = false): void {
        arrSwappedObjects.length = arrSwappedMaterials.length = arrHiddenAttachments.length = arrPawnMeshes.length = 0;
        const previousTarget = renderer.getRenderTarget(), autoClear = renderer.autoClear, alpha = renderer.getClearAlpha(), visible = caster.visible;
        renderer.getClearColor(tmpClearColor);
        this.renderingShadow = true;
        try {
            caster.visible = true;
            swapMaterials(caster, this.silhouette, this.cacheSilhouetteMaterials, reusePose);
            renderer.setRenderTarget(this.blurTarget);
            renderer.setClearColor(0, 0);
            renderer.clear(true, true, false);
            renderer.autoClear = false;
            renderer.render(caster, camera);
            this.blur(renderer, target);
        } finally {
            renderer.autoClear = autoClear;
            renderer.setRenderTarget(previousTarget);
            renderer.setClearColor(tmpClearColor, alpha);
            this.renderingShadow = false;
            caster.visible = visible;
            for (let i = 0; i < arrSwappedObjects.length; i++) arrSwappedObjects[i].material = arrSwappedMaterials[i];
            for (const attachment of arrHiddenAttachments) attachment.visible = true;
            for (const mesh of arrPawnMeshes) mesh.setSilhouette(false);
            for (const skeleton of arrPausedSkeletons) skeleton.posePaused = false;
            arrPausedSkeletons.length = 0;
            arrSwappedObjects.length = arrSwappedMaterials.length = arrHiddenAttachments.length = arrPawnMeshes.length = 0;
        }
    }

    protected blur(renderer: THREE.WebGLRenderer, target = this.target): void {
        const uniforms = this.blurMaterial.uniforms, autoClear = renderer.autoClear;
        uniforms.tSource.value = this.blurTarget.texture;
        renderer.setRenderTarget(target);
        renderer.clear(true, false, false);
        renderer.autoClear = false;
        try {
            // UShadowBitmapMaterial::Get 0x93e86e..0x93eb37; trace7334037..7334077 uses byte alpha88/132 and SRCALPHA,ONE.
            this.blurMaterial.uniformsNeedUpdate = true;
            renderer.render(this.blurScene, this.blurCamera);
        } finally { renderer.autoClear = autoClear; }
    }

    public dispose(): void {
        for (const slot of this.targets) slot.target.dispose();
        for (const cached of this.shadowTextures) cached.texture.dispose();
        this.shadowTextures.length = 0;
        for (const material of this.receiverMaterials) material.dispose();
        this.blurTarget.dispose();
        this.blurGeometry.dispose();
        this.blurMaterial.dispose();
        this.silhouette.dispose();
        this.attenuation.dispose();
        this.projectors.length = this.lastCasters.length = 0;
    }
}

function createAttenuationCube(): CubeTexture {
    const bases = [[1, 1, 1], [-1, 1, -1], [-1, 1, -1], [-1, -1, 1], [-1, 1, 1], [1, 1, -1]], xs = [[0, 0, -2], [0, 0, 2], [2, 0, 0], [2, 0, 0], [2, 0, 0], [-2, 0, 0]], ys = [[0, -2, 0], [0, -2, 0], [0, 0, 2], [0, 0, -2], [0, -2, 0], [0, -2, 0]];
    const mips: CubeTexture[] = [];
    for (const size of [32, 16]) {
        const faces: DataTexture[] = [];
        for (let face = 0; face < 6; face++) {
            const bytes = new Uint8Array(size * size * 4), dx = xs[face].map(value => Math.fround(value / (size - 1))), dy = ys[face].map(value => Math.fround(value / (size - 1)));
            for (let y = 0; y < size; y++) {
                const v = bases[face].map((value, index) => Math.fround(Math.fround(value + Math.fround(dy[index] * (y + 0.5))) + Math.fround(dx[index] * 0.5)));
                for (let x = 0; x < size; x++) {
                    const length = Math.fround(Math.sqrt(Math.fround(Math.fround(Math.fround(v[0] * v[0]) + Math.fround(v[1] * v[1])) + Math.fround(v[2] * v[2]))));
                    const value = Math.max(0, Math.min(255, Math.floor(Math.fround(v[2] / length) * 255)));
                    bytes.fill(value, (y * size + x) * 4, (y * size + x + 1) * 4);
                    for (let i = 0; i < 3; i++) v[i] = Math.fround(v[i] + dx[i]);
                }
            }
            faces.push(new DataTexture(bytes, size, size));
        }
        mips.push(new CubeTexture(faces));
    }
    const cube = mips[0];
    cube.mipmaps = [mips[1]];
    cube.generateMipmaps = false;
    cube.minFilter = LinearMipmapLinearFilter;
    cube.magFilter = LinearFilter;
    cube.needsUpdate = true;
    return cube;
}

function swapMaterials(root: Object3D, material: Material, cacheSilhouetteMaterials: WeakMap<Material[], Material[]>, reusePose: boolean): void {
    arrTraverse.length = 0;
    arrTraverse.push(root);

    while (arrTraverse.length > 0) {
        const object = arrTraverse.pop()!;
        const mesh = object as Mesh;

        if (!object.visible) continue;
        const skeleton = (object as any).skeleton as LocalSpaceSkeleton;
        if (skeleton && (reusePose || skeleton.hasCurrentPose()) && skeleton.posePaused === false) {
            skeleton.posePaused = true;
            arrPausedSkeletons.push(skeleton);
        }
        if ((object as PawnMesh).isPawnMesh) {
            arrPawnMeshes.push(object as PawnMesh);
            (object as PawnMesh).setSilhouette(true);
            continue;
        }

        // FShadowSceneNode::FilterAttachment 0x93dad0 tests bActorShadows, not the owner's flag.
        const castsShadows = (object as any).scriptProperties?.get("bActorShadows");

        if (object !== root && (castsShadows === false || castsShadows === undefined && (object as any).isEmitterActor)) { // Actor defaults bActorShadows to false and Emitter never sets it.
            arrHiddenAttachments.push(object);
            object.visible = false;
            continue;
        }

        for (const child of object.children) arrTraverse.push(child);

        if (!mesh.material || object.layers.mask === 0) continue; // batched sources stay masked, their PawnMesh draws the silhouette

        arrSwappedObjects.push(mesh);
        arrSwappedMaterials.push(mesh.material);
        if (Array.isArray(mesh.material)) {
            let materials = cacheSilhouetteMaterials.get(mesh.material);

            if (!materials) {
                materials = [];
                cacheSilhouetteMaterials.set(mesh.material, materials);
            }

            materials.length = mesh.material.length;
            for (let i = 0; i < materials.length; i++) materials[i] = getSilhouetteMaterial(mesh.material[i], material);
            mesh.material = materials;
        } else mesh.material = getSilhouetteMaterial(mesh.material, material);
    }
}

function getSilhouetteMaterial(source: Material, opaque: Material): Material {
    return (source as MeshStaticMaterial).isStaticMeshMaterial ? (source as MeshStaticMaterial).getShadowMaterial() || opaque : opaque;
}

export default ShadowProjector;
