
import { Matrix4, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget, LinearFilter, RGBAFormat, ClampToEdgeWrapping } from "three";
import GLOBAL_UNIFORMS from "@client/materials/global-uniforms";

// AShadowProjector::CheckVisible (0x93dc80): GL2ProjectorCR * 32768 * 0.0625, i.e. clipping range in
// kilounits, against the horizontal distance to the view target, inside a -200..200 vertical band
const PROJECTOR_CLIPPING_RANGE = 0.2;
const SHADOW_RANGE = PROJECTOR_CLIPPING_RANGE * 2048;
const SHADOW_BAND_Z = 200;

const LIGHT_DISTANCE = 704;
const SHADOW_DARKNESS = 255 / 255;

// lowpoly: retail gives every actor its own 256x256 projector, this is one shared map over the whole
// range - upgrade to per-caster targets when the resolution stops holding up
const SHADOW_SIZE = 1024;
const MAX_CASTERS = 16;

// separable gaussian over the silhouette. The tap offsets below are the precomputed linear-sampling
// weights for a one-texel step, so widening is done by iterating the pass, not by scaling the step -
// scaling it just lands five discrete copies of the silhouette instead of a smooth falloff
const SHADOW_BLUR_PASSES = 3;

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
const arrSwapped: THREE.Material[] = [];
const arrCasting: THREE.Object3D[] = [];

// NDC -> texture space, folded into the projector matrix
const matBias = new Matrix4().set(
    0.5, 0.0, 0.0, 0.5,
    0.0, 0.5, 0.0, 0.5,
    0.0, 0.0, 0.5, 0.5,
    0.0, 0.0, 0.0, 1.0
);

class ShadowProjector {
    public readonly target = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat, depthBuffer: true });
    protected readonly blurTarget = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat, depthBuffer: false });
    protected readonly blurScene = new Scene();
    protected readonly blurCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    protected readonly blurMaterial = new ShaderMaterial({ vertexShader: BLUR_VERTEX, fragmentShader: BLUR_FRAGMENT, depthTest: false, depthWrite: false, uniforms: { tSource: { value: null }, direction: { value: new Vector2() } } });

    // the sun is directional, so the casters share one orthographic projection instead of a cone
    protected readonly camera = new OrthographicCamera(-SHADOW_RANGE, SHADOW_RANGE, SHADOW_RANGE, -SHADOW_RANGE, 1, LIGHT_DISTANCE * 2);
    protected readonly silhouette = new MeshBasicMaterial({ color: 0x000000 });

    public constructor() {
        this.target.texture.wrapS = ClampToEdgeWrapping;
        this.target.texture.wrapT = ClampToEdgeWrapping;

        GLOBAL_UNIFORMS.shadowMap.value = this.target.texture;
        GLOBAL_UNIFORMS.shadowDarkness.value = SHADOW_DARKNESS;
        this.blurScene.add(new Mesh(new PlaneGeometry(2, 2), this.blurMaterial));
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

        arrSwapped.length = 0;

        for (const caster of arrCasting) {
            caster.traverse(object => {
                const mesh = object as THREE.Mesh;
                if (!mesh.material) return;

                arrSwapped.push(mesh.material as THREE.Material);
                mesh.material = this.silhouette;
            });
        }

        const prevTarget = renderer.getRenderTarget();
        const prevAutoClear = renderer.autoClear;

        renderer.setRenderTarget(this.target);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, false);
        renderer.autoClear = false;

        for (const caster of arrCasting) renderer.render(caster, this.camera);

        renderer.autoClear = prevAutoClear;

        if (SHADOW_BLUR_PASSES > 0) this.blur(renderer);

        renderer.setRenderTarget(prevTarget);

        let i = 0;

        for (const caster of arrCasting) {
            caster.traverse(object => {
                const mesh = object as THREE.Mesh;
                if (!mesh.material) return;

                mesh.material = arrSwapped[i++];
            });
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
        this.blurMaterial.dispose();
        this.silhouette.dispose();
    }
}

export default ShadowProjector;
export { ShadowProjector };
