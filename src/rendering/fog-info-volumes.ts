import { BoxGeometry, Color, CustomBlending, Data3DTexture, HalfFloatType, InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, MathUtils, Mesh, OneFactor, PlaneGeometry, RedFormat, RepeatWrapping, Scene, ShaderMaterial, Uniform, WebGLRenderTarget, type Camera, type WebGLRenderer } from "three";
import { interpolateFogInfoColor } from "./l2-env";
import { ColorByte } from "../utils/color-byte";
import GLOBAL_UNIFORMS from "../materials/global-uniforms";
import type { SectorObject } from "../objects/zone-object";

const MAX_VOLUMES = 2048;
const BLOBS = 2;
const NOISE_SIZE = 32;
const tmpColorByte = new ColorByte();
const tmpColor = new Color();

function createNoise() {
    const texture = new Data3DTexture(Uint8Array.from({ length: NOISE_SIZE * NOISE_SIZE * NOISE_SIZE }, () => Math.random() * 256), NOISE_SIZE, NOISE_SIZE, NOISE_SIZE);

    texture.format = RedFormat;
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.wrapS = texture.wrapT = texture.wrapR = RepeatWrapping;
    texture.needsUpdate = true;

    return texture;
}

export class FogInfoVolumes {
    protected readonly scene = new Scene();
    protected readonly skyScene = new Scene();
    protected readonly geometry = new InstancedBufferGeometry();
    protected readonly spheres = new InstancedBufferAttribute(new Float32Array(MAX_VOLUMES * 4), 4);
    protected readonly colors = new InstancedBufferAttribute(new Float32Array(MAX_VOLUMES * 4), 4);
    protected readonly target = new WebGLRenderTarget(1, 3, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
    protected readonly tile = new Uniform(0);
    protected opacity = 0;
    public enabled = false;

    public constructor() {

        const box = new BoxGeometry(2, 2, 2);

        this.geometry.index = box.index;
        this.geometry.setAttribute("position", box.getAttribute("position"));
        this.geometry.setAttribute("volumeSphere", this.spheres);
        this.geometry.setAttribute("volumeColor", this.colors);

        const mesh = new Mesh(this.geometry, new ShaderMaterial({
            blending: CustomBlending,
            blendSrc: OneFactor,
            blendDst: OneFactor,
            depthTest: false,
            depthWrite: false,
            defines: { NOISE_SIZE },
            uniforms: { tile: this.tile, noise: new Uniform(createNoise()), fogNear: GLOBAL_UNIFORMS.fogNear, fogFar: GLOBAL_UNIFORMS.fogFar, globalTimeSeconds: GLOBAL_UNIFORMS.globalTimeSeconds },
            vertexShader: `
                attribute vec4 volumeSphere;
                attribute vec4 volumeColor;

                varying vec4 vColor;
                varying vec3 vOffset;
                varying vec3 vRay;
                varying vec2 vShape;

                void main() {
                    vec3 worldPosition = volumeSphere.xyz + position * volumeSphere.w;
                    vec4 viewPosition = viewMatrix * vec4(worldPosition, 1.0);

                    vColor = volumeColor;
                    vOffset = cameraPosition - volumeSphere.xyz;
                    vRay = worldPosition - cameraPosition;
                    vShape = vec2(volumeSphere.w * volumeSphere.w, -viewPosition.z);
                    gl_Position = projectionMatrix * viewPosition;
                }
            `,
            fragmentShader: `
                uniform int tile;
                uniform float fogNear;
                uniform float fogFar;
                uniform float globalTimeSeconds;
                uniform mediump sampler3D noise;

                varying vec4 vColor;
                varying vec3 vOffset;
                varying vec3 vRay;
                varying vec2 vShape;

                float sampleNoise(vec3 position) {
                    vec3 cell = floor(position), blend = fract(position);

                    return texture(noise, (cell + blend * blend * (3.0 - 2.0 * blend) + 0.5) / float(NOISE_SIZE)).r;
                }

                float billow(vec3 position) { return 0.65 * sampleNoise(position / 1400.0 - globalTimeSeconds * vec3(0.04, 0.02, 0.024)) + 0.35 * sampleNoise(position / 520.0 - globalTimeSeconds * vec3(-0.07, 0.04, 0.06)); }

                void main() {
                    float rayLength = length(vRay);
                    vec3 direction = vRay / rayLength;
                    float along = dot(vOffset, direction);
                    vec3 closest = vOffset - along * direction;
                    float endSq = vShape.x - dot(closest, closest);
                    if (endSq <= 0.0) discard;

                    float halfEnd = sqrt(endSq), from = clamp(along, -halfEnd, halfEnd);
                    float scale = vColor.a * clamp((fogFar - from + along) / (fogFar - fogNear), 0.0, 1.0) / vShape.x; // sectors unload at fogFar
                    float depths[8];
                    float total = 0.0, plain = 0.0, shade = 0.0;

                    for (int i = 0; i < 8; i++) {
                        float slice = float(i + 1) / 8.0, to = clamp(along + fogFar * slice * slice * rayLength / vShape.y, -halfEnd, halfEnd);

                        if (to > from) {
                            float wisp = billow(cameraPosition + (0.5 * (from + to) - along) * direction), depth = (endSq * (to - from) - (to * to * to - from * from * from) / 3.0) * scale;

                            total += depth * (0.35 + 1.3 * smoothstep(0.3, 0.7, wisp));
                            plain += depth;
                            shade += depth * wisp;
                            from = to;
                        }
                        depths[i] = total;
                    }
                    if (total <= 0.0) discard;

                    if (tile == 0) gl_FragColor = vec4(depths[0], depths[1], depths[2], depths[3]);
                    else if (tile == 1) gl_FragColor = vec4(depths[4], depths[5], depths[6], depths[7]);
                    else gl_FragColor = vec4(vColor.rgb * (0.84 + 0.32 * shade / plain), 1.0) * total;
                }
            `
        }));

        mesh.frustumCulled = false;
        this.scene.add(mesh);

        const sky = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
            transparent: true,
            depthTest: false,
            depthWrite: false,
            uniforms: { fogInfoMap: GLOBAL_UNIFORMS.fogInfoMap, fogInfoTexel: GLOBAL_UNIFORMS.fogInfoTexel, fogInfoOpacity: GLOBAL_UNIFORMS.fogInfoOpacity },
            vertexShader: `
                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    gl_Position = vec4(position.xy, 0.0, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D fogInfoMap;
                uniform vec3 fogInfoTexel;
                uniform float fogInfoOpacity;

                varying vec2 vUv;

                void main() {
                    float v = clamp(vUv.y, fogInfoTexel.z, 1.0 - fogInfoTexel.z);
                    vec4 color = texture2D(fogInfoMap, vec2(vUv.x, (v + 2.0) / 3.0));

                    gl_FragColor = vec4(color.rgb / max(color.a, 0.0001), (1.0 - exp(-texture2D(fogInfoMap, vec2(vUv.x, (v + 1.0) / 3.0)).a)) * fogInfoOpacity);
                }
            `
        }));

        sky.frustumCulled = false;
        this.skyScene.add(sky);

        GLOBAL_UNIFORMS.fogInfoMap.value = this.target.texture;
    }

    public fade(visible: boolean, amount: number) { this.opacity = MathUtils.clamp(this.opacity + (visible ? amount : -amount), 0, 1); }

    public draw(renderer: WebGLRenderer, camera: Camera, sectors: SectorObject[], timeOfDay: number, fogPreset: string) {
        if (!this.enabled || !this.opacity) return;

        const spheres = this.spheres.array, colors = this.colors.array;
        const rangeKey = `fogRange${fogPreset}` as "fogRange1", time = GLOBAL_UNIFORMS.globalTimeSeconds.value;
        let count = 0;

        for (const sector of sectors) {
            for (const fogInfo of sector.fogInfos) {
                let range = fogInfo[rangeKey];
                if (!range || (range.A === 0 && range.B === 0)) range = fogInfo.fogRange1;
                if (!(range.B > 0)) continue;

                const end = Math.max(fogInfo.affectRange.A, fogInfo.affectRange.B), color = interpolateFogInfoColor(timeOfDay, fogInfo.colors, tmpColorByte);

                for (let blob = 0; blob < BLOBS; blob++) {
                    if (count === MAX_VOLUMES) throw new Error(`More than ${MAX_VOLUMES} fog blobs are loaded`);

                    const phase = fogInfo.position.x * 0.0131 + fogInfo.position.y * 0.0173 + blob * 2.4, offset = count++ * 4;

                    spheres[offset] = fogInfo.position.x + end * 0.35 * Math.sin(time * 0.11 + phase);
                    spheres[offset + 1] = fogInfo.position.y + end * 0.35 * Math.cos(time * 0.09 + phase * 1.7);
                    spheres[offset + 2] = fogInfo.position.z - end * 0.3 + end * 0.12 * Math.sin(time * 0.07 + phase * 2.3);
                    spheres[offset + 3] = end * (0.6 + 0.08 * Math.sin(time * 0.05 + phase * 3.1));
                    colors[offset] = color.r / 255;
                    colors[offset + 1] = color.g / 255;
                    colors[offset + 2] = color.b / 255;
                    colors[offset + 3] = 1 / range.B;
                }
            }
        }
        if (!count) return;

        this.geometry.instanceCount = count;
        this.spheres.needsUpdate = this.colors.needsUpdate = true;

        const target = renderer.getRenderTarget(), width = target ? target.width : renderer.domElement.width, height = target ? target.height : renderer.domElement.height;
        const tileWidth = Math.ceil(width / 4), tileHeight = Math.ceil(height / 4), alpha = renderer.getClearAlpha();

        this.target.setSize(tileWidth, tileHeight * 3);
        this.target.scissorTest = false;
        renderer.getClearColor(tmpColor);
        renderer.setRenderTarget(this.target);
        renderer.setClearColor(0, 0);
        renderer.clear();
        this.target.scissorTest = true;
        for (let tile = 0; tile < 3; tile++) {
            this.target.viewport.set(0, tile * tileHeight, tileWidth, tileHeight);
            this.target.scissor.copy(this.target.viewport);
            this.tile.value = tile;
            renderer.setRenderTarget(this.target);
            renderer.render(this.scene, camera);
        }
        renderer.setRenderTarget(target);
        renderer.setClearColor(tmpColor, alpha);

        GLOBAL_UNIFORMS.fogInfoTexel.value.set(1 / width, 1 / height, 0.5 / tileHeight);
        GLOBAL_UNIFORMS.fogInfoRange.value = GLOBAL_UNIFORMS.fogFar.value;
        GLOBAL_UNIFORMS.fogInfoOpacity.value = this.opacity;
        renderer.render(this.skyScene, camera);
    }
}

export default FogInfoVolumes;
