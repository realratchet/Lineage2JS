import { Color, Object3D, ShaderMaterial, Sphere, Texture, Vector3, WebGLRenderer, WebGLRenderTarget, NoBlending } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import type BaseActor from "../base-actor";
import type BaseEmitter from "../objects/emitters/base-emitter";
import NPawnLightComponent from "./components/pawn-light-component";

const tmpPosition = new Vector3();
const tmpColor = new Color();
const tmpLightPosition = new Vector3();
const tmpLightColor = new Color();
const arrWhite = [1, 1, 1];

type EffectLight_T = { emitters: BaseEmitter[], position: Vector3, color: Color, radius: number };

export class SkillLightProbe {
    public enabled = true;
    public version = 0;
    public hasLights = false;
    protected lastTime = 0;
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
        if (emitters.length) this.effects.set(effect, { emitters, position: new Vector3(), color: new Color(0, 0, 0), radius: 0 });
    }

    public remove(effect: Object3D): void { this.effects.delete(effect); }

    public update(renderer: WebGLRenderer): void {
        const now = performance.now();
        const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 0;

        this.lastTime = now;
        this.version++;
        this.hasLights = false;

        for (const [effect, light] of this.effects) {
            if (!effect.parent) { this.effects.delete(effect); continue; }
            if (!this.enabled) { light.color.setRGB(0, 0, 0); light.radius = 0; continue; }

            tmpLightPosition.set(0, 0, 0);
            tmpLightColor.setRGB(0, 0, 0);
            let radius = 0, weight = 0, peak = 0;

            if (effect.visible) {
                for (const emitter of light.emitters) {
                    const emitterRadius = emitter.sampleLight(tmpPosition, tmpColor);

                    if (emitterRadius === 0) continue;
                    const texture = emitter.getLightTexture();

                    peak = Math.max(peak, tmpColor.r, tmpColor.g, tmpColor.b);
                    if (texture) tmpColor.multiply(this.getTextureColor(renderer, texture));
                    const brightness = Math.max(tmpColor.r, tmpColor.g, tmpColor.b);

                    tmpLightPosition.addScaledVector(tmpPosition, brightness);
                    tmpLightColor.add(tmpColor);
                    radius = Math.max(radius, emitterRadius);
                    weight += brightness;
                }
            }

            const current = Math.max(light.color.r, light.color.g, light.color.b);

            if (weight > 0) {
                tmpLightPosition.divideScalar(weight);
                tmpLightColor.multiplyScalar(0.45 * peak / weight); // hue weighted by texture emission, intensity from particle colour

                if (light.radius === 0) {
                    light.position.copy(tmpLightPosition);
                    light.radius = radius;
                } else {
                    light.position.lerp(tmpLightPosition, 1 - Math.exp(-dt / 0.15));
                    light.radius += (radius - light.radius) * (1 - Math.exp(-dt / 0.3));
                }
            }

            const target = Math.max(tmpLightColor.r, tmpLightColor.g, tmpLightColor.b);

            light.color.lerp(tmpLightColor, 1 - Math.exp(-dt / (target > current ? 0.2 : 0.35)));

            if (weight === 0 && Math.max(light.color.r, light.color.g, light.color.b) < 0.004) { light.color.setRGB(0, 0, 0); light.radius = 0; continue; }
            if (light.radius > 0) this.hasLights = true;
        }
    }

    public sample(actor: Object3D, sphere: Sphere): NPawnLightComponent | null {
        if (!this.enabled || !this.hasLights || !sphere) return null;

        let total = 0, radius = 0;

        tmpLightPosition.set(0, 0, 0);
        tmpLightColor.setRGB(0, 0, 0);

        for (const light of this.effects.values()) {
            if (light.radius === 0) continue;

            const distance = Math.max(0, light.position.distanceTo(sphere.center) - sphere.radius);
            const strength = Math.max(light.color.r, light.color.g, light.color.b) * Math.pow(Math.max(0, 1 - distance / light.radius), 2);

            if (strength <= 0) continue;

            tmpLightPosition.addScaledVector(light.position, strength);
            tmpLightColor.r += light.color.r * strength;
            tmpLightColor.g += light.color.g * strength;
            tmpLightColor.b += light.color.b * strength;
            radius += light.radius * strength;
            total += strength;
        }
        if (total <= 0) return null;

        let component = this.pawns.get(actor);

        if (!component) {
            component = new NPawnLightComponent();
            component.add(null, arrWhite, 1, Infinity);
            component.setParent(actor as BaseActor);
            this.pawns.set(actor, component);
        }
        const light = component.getLights()[0];

        light.position.copy(tmpLightPosition).divideScalar(total); // strength-weighted blend, picking the strongest effect jumps between overlapping cast effects
        light.color.copy(tmpLightColor).multiplyScalar(1 / total);
        light.radius = radius / total;
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
