import { Color, Object3D, ShaderMaterial, Sphere, Texture, Vector3, WebGLRenderer, WebGLRenderTarget, NoBlending } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import type BaseActor from "../base-actor";
import type BaseEmitter from "../objects/emitters/base-emitter";
import NPawnLightComponent from "./components/pawn-light-component";

const tmpPosition = new Vector3();
const tmpColor = new Color();
const arrWhite = [1, 1, 1];

type EffectLight_T = { emitters: BaseEmitter[], position: Vector3, color: Color, radius: number };

export class SkillLightProbe {
    public enabled = true;
    public version = 0;
    public hasLights = false;
    protected readonly effects = new Map<Object3D, EffectLight_T>();
    protected readonly pawns = new WeakMap<Object3D, NPawnLightComponent>();
    protected readonly cacheTextures = new WeakMap<Texture, Color>();
    protected readonly pixels = new Uint8Array(8 * 8 * 4);
    protected readonly target = new WebGLRenderTarget(8, 8, { depthBuffer: false });
    protected readonly material = new ShaderMaterial({
        uniforms: { map: { value: null } }, blending: NoBlending, depthTest: false, depthWrite: false,
        vertexShader: "varying vec2 texCoord; void main() { texCoord = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: "uniform sampler2D map; varying vec2 texCoord; void main() { gl_FragColor = texture2D(map, texCoord); }"
    });
    protected readonly quad = new FullScreenQuad(this.material);

    public add(effect: Object3D): void {
        if (this.effects.has(effect)) return;

        const emitters: BaseEmitter[] = [];

        effect.traverse(child => { if ((child as any).particlePool) emitters.push(child as BaseEmitter); });
        if (emitters.length) this.effects.set(effect, { emitters, position: new Vector3(), color: new Color(), radius: 0 });
    }

    public remove(effect: Object3D): void { this.effects.delete(effect); }

    public update(renderer: WebGLRenderer): void {
        this.version++;
        this.hasLights = false;

        for (const [effect, light] of this.effects) {
            if (!effect.parent) { this.effects.delete(effect); continue; }
            if (!this.enabled) continue;

            light.position.set(0, 0, 0);
            light.color.setRGB(0, 0, 0);
            light.radius = 0;
            let weight = 0;

            if (!effect.visible) continue;

            for (const emitter of light.emitters) {
                const radius = emitter.sampleLight(tmpPosition, tmpColor);

                if (radius === 0) continue;
                const texture = emitter.getLightTexture();

                if (texture) tmpColor.multiply(this.getTextureColor(renderer, texture));
                const brightness = Math.max(tmpColor.r, tmpColor.g, tmpColor.b);

                light.position.addScaledVector(tmpPosition, brightness);
                light.color.add(tmpColor);
                light.radius = Math.max(light.radius, radius);
                weight += brightness;
            }
            if (weight <= 0) { light.radius = 0; continue; }

            this.hasLights = true;
            light.position.divideScalar(weight);
            light.color.multiplyScalar(0.45 / Math.max(1, weight));
        }
    }

    public sample(actor: Object3D, sphere: Sphere): NPawnLightComponent | null {
        if (!this.enabled || !this.hasLights || !sphere) return null;

        let selected: EffectLight_T = null, strongest = 0;

        for (const light of this.effects.values()) {
            if (light.radius === 0) continue;

            const distance = Math.max(0, light.position.distanceTo(sphere.center) - sphere.radius);
            const strength = Math.max(light.color.r, light.color.g, light.color.b) * Math.pow(Math.max(0, 1 - distance / light.radius), 2);

            if (strength > strongest) { strongest = strength; selected = light; }
        }
        if (!selected) return null;

        let component = this.pawns.get(actor);

        if (!component) {
            component = new NPawnLightComponent();
            component.add(null, arrWhite, 1, Infinity);
            component.setParent(actor as BaseActor);
            this.pawns.set(actor, component);
        }
        const light = component.getLights()[0];

        light.position.copy(selected.position);
        light.color.copy(selected.color);
        light.radius = selected.radius;
        component.updateLighting(sphere);
        return component;
    }

    protected getTextureColor(renderer: WebGLRenderer, texture: Texture): Color {
        let color = this.cacheTextures.get(texture);

        if (color) return color;

        const target = renderer.getRenderTarget();
        const face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();

        try {
            this.material.uniforms.map.value = texture;
            renderer.setRenderTarget(this.target);
            this.quad.render(renderer);
            renderer.readRenderTargetPixels(this.target, 0, 0, 8, 8, this.pixels);
        } finally {
            renderer.setRenderTarget(target, face, mip);
            this.material.uniforms.map.value = null;
        }

        color = new Color(0, 0, 0);
        let weight = 0;

        for (let i = 0; i < this.pixels.length; i += 4) {
            const r = this.pixels[i] / 255, g = this.pixels[i + 1] / 255, b = this.pixels[i + 2] / 255;
            const brightness = Math.max(r, g, b);

            color.r += r * brightness;
            color.g += g * brightness;
            color.b += b * brightness;
            weight += brightness;
        }
        if (weight > 0) color.multiplyScalar(1 / weight);
        this.cacheTextures.set(texture, color);
        return color;
    }

    public dispose(): void {
        this.effects.clear();
        this.hasLights = false;
        this.material.uniforms.map.value = null;
        this.target.dispose();
        this.material.dispose();
        this.quad.dispose();
    }
}

export default SkillLightProbe;
