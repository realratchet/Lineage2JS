import { ClampToEdgeWrapping, Color, LinearFilter, Material, Matrix4, Mesh, MeshBasicMaterial, Object3D, OrthographicCamera, PlaneGeometry, RGBAFormat, Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget } from "three";
import GLOBAL_UNIFORMS from "../materials/global-uniforms";

const PROJECTOR_CLIPPING_RANGE = 0.2; // AShadowProjector::CheckVisible 0x93dc80: GL2ProjectorCR * 32768 * 0.0625 kilounits.
const SHADOW_RANGE = PROJECTOR_CLIPPING_RANGE * 2048;
const SHADOW_BAND_Z = 200; // AShadowProjector::CheckVisible 0x93dc80.

const LIGHT_DISTANCE = 704;
const SHADOW_DARKNESS = 255 / 255;

const SHADOW_SIZE = 1024; // Retail uses one 256x256 projector per actor; this covers the full shared range.
const MAX_CASTERS = 16;

const SHADOW_BLUR_PASSES = 3; // One-texel separable gaussian; scaling the taps produces discrete silhouettes.

const BLUR_VERTEX = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4( position.xy, 0.0, 1.0 );
}`;

const BLUR_FRAGMENT = `
uniform sampler2D tSource;
uniform vec2 direction;
varying vec2 vUv;
void main() {
    vec4 sum = texture2D( tSource, vUv ) * 0.2270270270;
    sum += texture2D( tSource, vUv + direction * 1.3846153846 ) * 0.3162162162;
    sum += texture2D( tSource, vUv - direction * 1.3846153846 ) * 0.3162162162;
    sum += texture2D( tSource, vUv + direction * 3.2307692308 ) * 0.0702702703;
    sum += texture2D( tSource, vUv - direction * 3.2307692308 ) * 0.0702702703;
    gl_FragColor = sum;
}`;

const tmpFocusPos = new Vector3();
const tmpCasterPos = new Vector3();
const tmpLightPos = new Vector3();
const tmpClearColor = new Color();
const arrSwappedObjects: Mesh[] = [];
const arrSwappedMaterials: (Material | Material[])[] = [];
const arrHiddenAttachments: Object3D[] = [];
const arrCasting: Object3D[] = [];
const arrTraverse: Object3D[] = [];

// NDC -> texture space, folded into the projector matrix
const matBias = new Matrix4().set(
    0.5, 0.0, 0.0, 0.5,
    0.0, 0.5, 0.0, 0.5,
    0.0, 0.0, 0.5, 0.5,
    0.0, 0.0, 0.0, 1.0
);

export class ShadowProjector {
    public readonly target = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat, depthBuffer: true });
    protected readonly blurTarget = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat, depthBuffer: false });
    protected readonly blurScene = new Scene();
    protected readonly blurCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    protected readonly blurGeometry = new PlaneGeometry(2, 2);
    protected readonly blurMaterial = new ShaderMaterial({ vertexShader: BLUR_VERTEX, fragmentShader: BLUR_FRAGMENT, depthTest: false, depthWrite: false, uniforms: { tSource: { value: null }, direction: { value: new Vector2() } } });

    // the sun is directional, so the casters share one orthographic projection instead of a cone
    protected readonly camera = new OrthographicCamera(-SHADOW_RANGE, SHADOW_RANGE, SHADOW_RANGE, -SHADOW_RANGE, 1, LIGHT_DISTANCE * 2);
    protected readonly silhouette = new MeshBasicMaterial({ color: 0x000000 });

    public constructor() {
        this.target.texture.wrapS = ClampToEdgeWrapping;
        this.target.texture.wrapT = ClampToEdgeWrapping;

        GLOBAL_UNIFORMS.shadowMap.value = this.target.texture;
        GLOBAL_UNIFORMS.shadowDarkness.value = SHADOW_DARKNESS;
        this.blurScene.add(new Mesh(this.blurGeometry, this.blurMaterial));
    }

    protected blur(renderer: THREE.WebGLRenderer) {
        const step = 1 / SHADOW_SIZE;
        const uniforms = this.blurMaterial.uniforms;

        for (let pass = 0; pass < SHADOW_BLUR_PASSES; pass++) {
            uniforms.tSource.value = this.target.texture;
            (uniforms.direction.value as Vector2).set(step, 0);
            renderer.setRenderTarget(this.blurTarget);
            renderer.render(this.blurScene, this.blurCamera);

            uniforms.tSource.value = this.blurTarget.texture;
            (uniforms.direction.value as Vector2).set(0, step);
            renderer.setRenderTarget(this.target);
            renderer.render(this.blurScene, this.blurCamera);
        }
    }

    public update(renderer: THREE.WebGLRenderer, focus: THREE.Object3D, casters: Iterable<THREE.Object3D>, lightDirection: Vector3) {
        focus.getWorldPosition(tmpFocusPos);

        // LightDirection is where the light travels, so step back along it to stand at the light
        tmpLightPos.copy(lightDirection).multiplyScalar(-LIGHT_DISTANCE).add(tmpFocusPos);

        this.camera.position.copy(tmpLightPos);
        this.camera.up.set(0, 0, 1);
        this.camera.lookAt(tmpFocusPos);
        this.camera.updateMatrixWorld(true);
        this.camera.updateProjectionMatrix();

        arrCasting.length = 0;

        for (const caster of casters) {
            if (arrCasting.length >= MAX_CASTERS) break;
            if (!caster.visible) continue;

            caster.getWorldPosition(tmpCasterPos);

            const dx = tmpCasterPos.x - tmpFocusPos.x;
            const dy = tmpCasterPos.y - tmpFocusPos.y;
            const dz = tmpCasterPos.z - tmpFocusPos.z;

            if (dz <= -SHADOW_BAND_Z || dz >= SHADOW_BAND_Z) continue;
            if (Math.sqrt(dx * dx + dy * dy) > SHADOW_RANGE) continue;

            arrCasting.push(caster);
        }

        if (arrCasting.length === 0) {
            GLOBAL_UNIFORMS.shadowActive.value = 0;
            return;
        }

        arrSwappedObjects.length = 0;
        arrSwappedMaterials.length = 0;
        arrHiddenAttachments.length = 0;

        for (const caster of arrCasting)
            swapMaterials(caster, this.silhouette);

        const prevTarget = renderer.getRenderTarget();
        const prevAutoClear = renderer.autoClear;
        const prevClearAlpha = renderer.getClearAlpha();

        renderer.getClearColor(tmpClearColor);

        try {
            renderer.setRenderTarget(this.target);
            renderer.setClearColor(0x000000, 0);
            renderer.clear(true, true, false);
            renderer.autoClear = false;

            for (const caster of arrCasting) renderer.render(caster, this.camera);

            renderer.autoClear = prevAutoClear;

            if (SHADOW_BLUR_PASSES > 0) this.blur(renderer);
        } finally {
            renderer.autoClear = prevAutoClear;
            renderer.setRenderTarget(prevTarget);
            renderer.setClearColor(tmpClearColor, prevClearAlpha);

            for (let i = 0, len = arrSwappedObjects.length; i < len; i++)
                arrSwappedObjects[i].material = arrSwappedMaterials[i];

            for (const attachment of arrHiddenAttachments) attachment.visible = true;
        }

        (GLOBAL_UNIFORMS.shadowMatrix.value as Matrix4)
            .copy(matBias)
            .multiply(this.camera.projectionMatrix)
            .multiply(this.camera.matrixWorldInverse);

        GLOBAL_UNIFORMS.shadowActive.value = 1;
    }

    public dispose() {
        this.target.dispose();
        this.blurTarget.dispose();
        this.blurGeometry.dispose();
        this.blurMaterial.dispose();
        this.silhouette.dispose();
    }
}

function swapMaterials(root: Object3D, material: Material): void {
    arrTraverse.length = 0;
    arrTraverse.push(root);

    while (arrTraverse.length > 0) {
        const object = arrTraverse.pop()!;
        const mesh = object as Mesh;

        if (!object.visible) continue;

        // FShadowSceneNode::FilterAttachment 0x93dad0 tests bActorShadows, not the owner's flag.
        if (object !== root && (object as any).scriptProperties?.get("bActorShadows") === false) {
            arrHiddenAttachments.push(object);
            object.visible = false;
            continue;
        }

        for (const child of object.children) arrTraverse.push(child);

        if (!mesh.material) continue;

        arrSwappedObjects.push(mesh);
        arrSwappedMaterials.push(mesh.material);
        mesh.material = material;
    }
}

export default ShadowProjector;
