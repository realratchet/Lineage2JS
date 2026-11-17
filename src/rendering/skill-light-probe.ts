import { Color, Object3D, ShaderMaterial, Sphere, Texture, Vector3, WebGLRenderer, WebGLRenderTarget, NoBlending } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import type BaseActor from "../base-actor";
import type BaseEmitter from "../objects/emitters/base-emitter";
import NPawnLightComponent from "./components/pawn-light-component";
import GLOBAL_UNIFORMS, { NUM_SKILL_LIGHTS } from "../materials/global-uniforms";
import type { SkillEffectLighting_T } from "../assets/unreal/conf-files/un-conf-system";

const tmpPosition = new Vector3();
const tmpColor = new Color();
const tmpLightPosition = new Vector3();
const tmpLightColor = new Color();
const arrWhite = [1, 1, 1];

type EffectLight_T = { emitters: BaseEmitter[], position: Vector3, color: Color, radius: number, distance: number };

export class SkillLightProbe {
    public mode: SkillEffectLighting_T = "pawnOnly";
    public version = 0;
    public hasLights = false;
    protected lastTime = 0;
    protected readonly effects = new Map<Object3D, EffectLight_T>();
    protected readonly arrLights: EffectLight_T[] = [];
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
        if (emitters.length) this.effects.set(effect, { emitters, position: new Vector3(), color: new Color(0, 0, 0), radius: 0, distance: 0 });
    }

    public remove(effect: Object3D): void { this.effects.delete(effect); }

    public update(renderer: WebGLRenderer, focus: Vector3): void {
        const now = performance.now();
        const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 0;

        this.lastTime = now;
        this.version++;
        this.hasLights = false;
        this.arrLights.length = 0;

        for (const [effect, light] of this.effects) {
            if (!effect.parent) {
                this.effects.delete(effect);
                continue;
            }
            if (this.mode === "none") {
                light.color.setRGB(0, 0, 0);
                light.radius = 0;
                continue;
            }

            tmpLightPosition.set(0, 0, 0);
            tmpLightColor.setRGB(0, 0, 0);
            let radius = 0, weight = 0, peak = 0;

            if (effect.visible) {
                for (const emitter of light.emitters) {
                    const emitterRadius = emitter.sampleLight(tmpPosition, tmpColor);

                    if (emitterRadius === 0) continue;
                    const texture = emitter.getLightTexture();

                    peak = Math.max(peak, tmpColor.r, tmpColor.g, tmpColor.b);
                    if (texture) {
                        const textureColor = this.getTextureColor(renderer, texture);
                        if (!textureColor) continue;
                        tmpColor.multiply(textureColor);
                    }
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
                tmpLightPosition.z += radius * 0.25;
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

            if (weight === 0 && Math.max(light.color.r, light.color.g, light.color.b) < 0.004) {
                light.color.setRGB(0, 0, 0);
                light.radius = 0;
                continue;
            }
            if (light.radius > 0) {
                light.distance = Math.max(0, light.position.distanceTo(focus) - light.radius);
                this.arrLights.push(light);
            }
        }

        this.arrLights.sort(compareLights);
        this.arrLights.length = Math.min(this.arrLights.length, NUM_SKILL_LIGHTS);
        this.hasLights = this.arrLights.length > 0;
        GLOBAL_UNIFORMS.skillLightCount.value = this.mode === "all" ? this.arrLights.length : 0;

        for (let i = 0; i < this.arrLights.length; i++) {
            const light = this.arrLights[i];
            GLOBAL_UNIFORMS.skillLightPositions.value[i].set(light.position.x, light.position.y, light.position.z, light.radius);
            GLOBAL_UNIFORMS.skillLightColors.value[i].set(light.color.r, light.color.g, light.color.b);
        }
    }

    public sample(actor: Object3D, sphere: Sphere): NPawnLightComponent | null {
        if (this.mode === "none" || !this.hasLights || !sphere) return null;

        let total = 0, radius = 0;

        tmpLightPosition.set(0, 0, 0);
        tmpLightColor.setRGB(0, 0, 0);

        for (const light of this.arrLights) {
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

    protected getTextureColor(renderer: WebGLRenderer, texture: Texture): Color | null {
        let color = this.cacheTextures.get(texture);

        if (color) return color;

        const target = renderer.getRenderTarget();
        const face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();

        try {
            this.material.uniforms.map.value = texture;
            renderer.setRenderTarget(this.target);
            const program = (renderer.properties.get(this.material) as { currentProgram: { isReady(): boolean } }).currentProgram;
            const isReady = program && program.isReady();
            this.quad.render(renderer);
            if (!isReady) return null;
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
        this.arrLights.length = 0;
        this.hasLights = false;
        GLOBAL_UNIFORMS.skillLightCount.value = 0;
        this.material.uniforms.map.value = null;
        this.target.dispose();
        this.material.dispose();
        this.quad.dispose();
    }
}

function compareLights(a: EffectLight_T, b: EffectLight_T): number {
    return a.distance - b.distance || Math.max(b.color.r, b.color.g, b.color.b) - Math.max(a.color.r, a.color.g, a.color.b);
}

export default SkillLightProbe;
