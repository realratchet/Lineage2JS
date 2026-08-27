import { Scene, PerspectiveCamera, Vector3, WebGLRenderer, Mesh, MeshBasicMaterial, DoubleSide, CustomBlending, OneFactor, SrcAlphaFactor, PlaneGeometry, Group, BufferAttribute, Fog, Color, OneMinusSrcAlphaFactor } from "three";
import L2Environment from "./l2-env";
import { ColorByte } from "@client/utils/color-byte";
import { SectorObject } from "@client/objects/zone-object";
import EnvInfo from "@client/rendering/env-info";
import { EEnvCycle } from "@l2js/engine/env-consts";

const DEG2RAD = Math.PI / 180;
const HALF_PI = Math.PI / 2;
const NEG_PI = -Math.PI;
const X_ROTATION_ANGLE = 30 * DEG2RAD;
const PI = Math.PI;

const MATERIAL_U_SIZE = 32;
const DEFAULT_CELESTIAL_RADIUS = 15000;
const PF_TwoSided = 0x100;

const TMP_VEC3 = new Vector3();
const CELESTIAL_TILT_AXIS = new Vector3(1, 0, 0);
const tmpColorByte = new ColorByte();
const tmpModifierColorByte = new ColorByte();
const tmpFogColor = new Color();


class CelestialMaterial extends MeshBasicMaterial {
    public constructor() {
        super({
            transparent: true,
            blending: CustomBlending,
            blendSrc: SrcAlphaFactor, // Trace: D3DBLEND_SRCALPHA (5)
            blendDst: OneFactor,      // Trace: D3DBLEND_ONE (2) -> Additive Alpha
            depthWrite: false,
            depthTest: false,
            side: DoubleSide
        });
    }
}



class Celestial extends Mesh {
    public static readonly _geometry = new PlaneGeometry(-1, -1);

    public constructor() {
        super(Celestial._geometry, new CelestialMaterial());

        this.frustumCulled = false;
        this.visible = false;
    }
}

export default class SkyRenderer {
    protected envInfo: EnvInfo;

    protected celestialScene = new Scene();
    public sun: Celestial = new Celestial();
    protected camera: PerspectiveCamera | null = null;

    protected sunData: any = null;
    public config = {
        celestials: true,
        haze1: true,
        starsClouds: true,
        haze2: true,
    };
    protected skyLayerGroup: Group = new Group();

    public skyLayers: {
        skybox: Mesh[];
        haze: Mesh[];
        clouds: { mesh: Mesh, index: number }[];
    } = { skybox: [], haze: [], clouds: [] };

    protected moonActors: { mesh: Mesh; data: any; envType: EEnvCycle }[] = [];

    public constructor() {
        this.celestialScene.add(this.skyLayerGroup);
        this.celestialScene.add(this.sun);

        this.sun.renderOrder = -9000;
    }


    public initSkyLevel(envInfo: EnvInfo, skyLevel: SectorObject) {
        this.envInfo = envInfo;

        const skyZoneInfos: any[] = [];
        skyLevel.traverse(obj => {
            if (obj.constructor.name === "USkyZoneInfo" || (obj as any).isSkyZoneInfo) {
                skyZoneInfos.push(obj);
            }
        });

        const celestials = skyLevel.celestials;
        const setup = envInfo.setup;

        this.moonActors.forEach(actor => this.celestialScene.remove(actor.mesh));
        this.moonActors = [];

        celestials.forEach(celestial => {
            if (celestial.type === "Sun") {
                this.sunData = celestial.data;
                if (celestial.sprite) {
                    (this.sun.material as MeshBasicMaterial).map = celestial.sprite;
                    (this.sun.material as MeshBasicMaterial).needsUpdate = true;
                }
            } else if (celestial.type === "Moon") {
                if (Array.isArray(celestial.material) || !("defines" in celestial.material))
                    throw new Error(`NMoon '${celestial.data.objectName}' decoded to an unsupported material shape`);

                const material = celestial.material as any;

                // DrawMoon (0x8EA8A0) hardcodes SRCALPHA/ONE + ZWRITE=0, ignoring the Shader's OutputBlending
                material.side = DoubleSide;
                material.transparent = true;
                material.depthWrite = false;
                material.depthTest = false;
                material.blending = CustomBlending;
                material.blendSrc = SrcAlphaFactor;
                material.blendDst = OneFactor;

                // l2_fog_fragment.glsl mixes toward the real fog color by default; additive needs USE_ADDITIVE_FOG to fade to black instead
                delete material.defines.USE_MODULATED_FOG;
                material.defines.USE_ADDITIVE_FOG = "";

                // that blend weights each layer by its own texture alpha, otherwise the quad adds at alpha 1
                material.defines.USE_MASKING = "";
                material.needsUpdate = true;

                const mesh = new Mesh(Celestial._geometry, material);
                mesh.frustumCulled = false;
                mesh.visible = false;
                this.celestialScene.add(mesh);

                this.moonActors.push({ mesh, data: celestial.data, envType: celestial.data.envType ?? EEnvCycle.Normal });
            }
        });

        this.moonActors.sort((a, b) => (a.data.objectName || "").localeCompare(b.data.objectName || ""));
        this.moonActors.forEach((actor, i) => actor.mesh.renderOrder = -8999 + i);

        const { skybox, hazering, clouds } = envInfo.setup;
        const bspSections = skyLevel.getObjectByName("BSP_Sections");
        if (!bspSections) return;

        let meshCount = 0;
        const children = bspSections.children as Mesh[];

        const skyOrigin = new Vector3();
        const skyZoneInfo = skyZoneInfos[0];

        if (skyZoneInfo) {
            if ((skyZoneInfo as any).skyOrigin) {
                skyOrigin.copy((skyZoneInfo as any).skyOrigin);
            } else {
                skyOrigin.copy(skyZoneInfo.position);
            }
            // console.log(`[SkyRenderer] Using USkyZoneInfo as canonical origin: ${skyOrigin.toArray().map(v => v.toFixed(1))}`);
        } else {
            const skyboxPattern = envInfo.setup.skybox;
            let skyboxMesh = skyboxPattern ? children.find(m => m.name.includes(skyboxPattern)) : null;

            if (!skyboxMesh && children.length > 0) skyboxMesh = children[0];

            if (skyboxMesh) {
                if (!skyboxMesh.geometry.boundingBox) skyboxMesh.geometry.computeBoundingBox();
                skyboxMesh.geometry.boundingBox!.getCenter(skyOrigin);

                skyOrigin.y -= 250;
                console.warn(`[SkyRenderer] USkyZoneInfo NOT FOUND. Falling back to mesh center (${skyboxMesh.name}): ${skyOrigin.toArray().map(v => v.toFixed(1))}`);
            }
        }

        const processMesh = (mesh: Mesh, type: "skybox" | "haze" | "cloud" | "star", index: number = 0) => {
            if (!mesh) return;

            // sky fog comes from decodeBSPSection via sectionInfo.fog, set for isSky in un-model.ts (trace: D3DRS_FOGENABLE=TRUE)

            mesh.frustumCulled = false; // Always render sky components

            mesh.geometry.translate(-skyOrigin.x, -skyOrigin.y, -skyOrigin.z);
            mesh.geometry.computeBoundingBox();

            this.skyLayerGroup.add(mesh);
            mesh.position.set(0, 0, 0);
            mesh.rotation.set(0, 0, 0);
            mesh.scale.set(1, 1, 1);
            mesh.updateMatrix();

            meshCount++;
            if (type === "skybox") {
                mesh.renderOrder = -9500 + meshCount;
                this.skyLayers.skybox.push(mesh);
            } else if (type === "haze") {
                const nameParts = mesh.name.split("/");
                const flags = nameParts.length > 1 ? parseInt(nameParts[1]) || 0 : 0;

                mesh.renderOrder = flags & PF_TwoSided ? -7000 + meshCount : -8500 + meshCount;

                mesh.visible = true;

                if (!mesh.geometry.attributes.color) {
                    const count = mesh.geometry.attributes.position.count;
                    mesh.geometry.setAttribute("color", new BufferAttribute(new Float32Array(count * 3), 3));
                }

                this.skyLayers.haze.push(mesh);
            } else if (type === "cloud") {
                mesh.renderOrder = -8000 + (index * 100) + meshCount;
                this.skyLayers.clouds.push({ mesh, index });


            }
        }

        children.filter(o => skybox && o.name.includes(skybox)).forEach(m => processMesh(m, "skybox"));
        children.filter(o => hazering && o.name.includes(hazering)).forEach(m => processMesh(m, "haze"));

        clouds.forEach((pattern, i) => {
            if (pattern) {
                children.filter(o => o.name.includes(pattern)).forEach(m => processMesh(m, "cloud", i));
            }
        });

        // console.log(`[SkyRenderer] layers: skybox=${this.skyLayers.skybox.length}, haze=${this.skyLayers.haze.length}, clouds=${this.skyLayers.clouds.length} (of ${children.length} bsp meshes; patterns: skybox='${skybox}', haze='${hazering}', clouds=[${clouds.join(", ")}])`);
    }

    public update(camera: PerspectiveCamera, env: L2Environment, skyColor: ColorByte, _hazeColor: ColorByte, hazeColors: ColorByte[], cloudColors: ColorByte[], _fogColor: ColorByte, fogStart: number, fogEnd: number, _sector: SectorObject | null, clearColor: ColorByte, skyVisibility: number) {
        if (!this.envInfo) return;

        this.camera = camera;

        this.skyLayerGroup.position.copy(camera.position);

        this.skyLayerGroup.visible = true;

        // retail keeps drawing the dome underwater, just fogged to solid water color - which is the clear color
        this.celestialScene.visible = skyVisibility > 0;

        const fogColorThree = tmpFogColor.setRGB(_fogColor.r / 255, _fogColor.g / 255, _fogColor.b / 255);
        if (!this.celestialScene.fog) {
            this.celestialScene.fog = new Fog(fogColorThree, fogStart, fogEnd);
        } else {
            const f = this.celestialScene.fog as Fog;
            f.color.copy(fogColorThree);
            f.near = fogStart;
            f.far = fogEnd;
        }

        this.updateSun(env.getTimeOfDay(), camera, env, _fogColor, fogStart, fogEnd);
        this.updateMoon(env.getTimeOfDay(), camera, env, _fogColor, fogStart, fogEnd);

        this.updateSkyLayers(env, skyColor, _hazeColor, hazeColors, cloudColors, _fogColor, skyVisibility, clearColor);
    }

    protected updateSkyLayers(_env: L2Environment, _skyColor: ColorByte, _hazeColor: ColorByte, hazeColors: ColorByte[], cloudColors: ColorByte[], fogColor: ColorByte, skyVisibility: number, _clearColor: ColorByte) {
        if (!this.envInfo) return;

        function applyModifierColor(material: any, colorByte: ColorByte) {
            const r = colorByte.r / 255;
            const g = colorByte.g / 255;
            const b = colorByte.b / 255;
            const a = colorByte.a / 255;

            if (material.uniforms?.diffuse?.value) {
                material.uniforms.diffuse.value.setRGB(r, g, b);
            }
            if (material.uniforms?.opacity) {
                material.uniforms.opacity.value = a;
            }
        }

        // const modulatedHazeBase = _hazeColor.clone();

        this.skyLayers.skybox.forEach(mesh => {
            mesh.visible = false;
        });


        this.skyLayers.haze.forEach((mesh) => {

            const material = mesh.material as any;
            const nameParts = mesh.name.split("/");
            const flags = nameParts.length > 1 ? parseInt(nameParts[1]) || 0 : 0;
            const isLayer2 = !!(flags & PF_TwoSided);

            if (isLayer2) {
                mesh.visible = this.config.haze1 && this.config.haze2;
                material.fog = false;
            } else {
                mesh.visible = this.config.haze1;
                material.fog = false;
            }

            if (!mesh.visible) return;



            const targetColor = hazeColors[0];
            const modulator = tmpModifierColorByte.set(targetColor.r, targetColor.g, targetColor.b, 255);

            applyModifierColor(material, modulator);
            material.needsUpdate = true;
        });

        this.skyLayers.clouds.forEach(({ mesh, index }) => {

            mesh.visible = this.config.starsClouds;
            if (!mesh.visible) return;

            const modulated = cloudColors[index] || cloudColors[0];

            applyModifierColor(mesh.material, modulated);

        });


    }

    protected getCelestialLatitude(timeOfDay: number, celestialType: "sun" | "moon"): number {
        let latitude: number;
        if (celestialType === "sun") {
            const t = (timeOfDay < 6.0) ? (timeOfDay + 24.0) : timeOfDay;
            latitude = (t - 6.0) * (10 * DEG2RAD) - HALF_PI;
        } else {
            if (timeOfDay < 7.0 || timeOfDay >= 23.0) {
                let moonTime = timeOfDay >= 23.0 ? timeOfDay - 24.0 : timeOfDay;
                latitude = moonTime * (PI / 6) - HALF_PI;
            } else latitude = NEG_PI;
        }
        return latitude;
    }

    protected calculateCelestialOffset(timeOfDay: number, celestialType: "sun" | "moon", radius: number): Vector3 {
        const lat = this.getCelestialLatitude(timeOfDay, celestialType);
        if (lat === NEG_PI) return TMP_VEC3.set(0, 0, 0);
        const spherical = TMP_VEC3.set(radius * Math.sin(lat) * Math.cos(PI), radius * Math.sin(lat) * Math.sin(PI), radius * Math.cos(lat));
        spherical.applyAxisAngle(CELESTIAL_TILT_AXIS, X_ROTATION_ANGLE);
        return spherical;
    }

    protected calculateCelestialScale(celestialType: "sun" | "moon", baseScale: number, actorDrawScale: number, env: L2Environment): number {
        const envScale = celestialType === "sun" ? env.getSunScale() : env.getMoonScale();
        const multiplier = celestialType === "sun" ? 8.0 : 1.0;
        return (envScale * baseScale * multiplier * actorDrawScale * MATERIAL_U_SIZE);
    }

    protected updateSun(timeOfDay: number, camera: PerspectiveCamera, env: L2Environment, fogColor: ColorByte, fogStart: number, fogEnd: number) {
        if (!this.sunData || !this.config.celestials) {
            this.sun.visible = false;
            return;
        }
        const lat = this.getCelestialLatitude(timeOfDay, "sun");
        if (lat !== NEG_PI) {
            this.sun.visible = true;
            const radius = this.sunData.radius || DEFAULT_CELESTIAL_RADIUS;
            this.sun.position.copy(camera.position).add(this.calculateCelestialOffset(timeOfDay, "sun", radius));
            const scale = this.calculateCelestialScale("sun", this.sunData.celestialScale ?? 1.0, this.sunData.drawScale ?? 1.0, env);
            this.sun.scale.setScalar(scale);
            this.sun.lookAt(camera.position);

            env.getSunColor(tmpColorByte);

            if (fogEnd > 0 && fogEnd > fogStart) {
                const dist = radius;
                let visibility = (fogEnd - dist) / (fogEnd - fogStart);
                visibility = Math.max(0, Math.min(1, visibility));

                const fogFactor = 1.0 - visibility;
                if (fogFactor > 0) {
                    tmpColorByte.lerp(fogColor, fogFactor);
                }
            }

            (this.sun.material as MeshBasicMaterial).color.setRGB(
                tmpColorByte.r / 255,
                tmpColorByte.g / 255,
                tmpColorByte.b / 255
            );
        } else this.sun.visible = false;
    }

    protected updateMoon(timeOfDay: number, camera: PerspectiveCamera, env: L2Environment, _fogColor: ColorByte, _fogStart: number, _fogEnd: number) {
        if (this.moonActors.length === 0 || !this.config.celestials) {
            this.moonActors.forEach(actor => actor.mesh.visible = false);
            return;
        }

        const lat = this.getCelestialLatitude(timeOfDay, "moon");
        if (lat === NEG_PI) {
            this.moonActors.forEach(actor => actor.mesh.visible = false);
            return;
        }

        const activeEnv = env.getActiveEnv();

        this.moonActors.forEach(actor => {
            if (actor.envType !== activeEnv) {
                actor.mesh.visible = false;
                return;
            }

            actor.mesh.visible = true;

            const radius = actor.data.radius || DEFAULT_CELESTIAL_RADIUS;
            const offset = this.calculateCelestialOffset(timeOfDay, "moon", radius);
            actor.mesh.position.copy(camera.position).add(offset);
            const scale = this.calculateCelestialScale("moon", actor.data.celestialScale ?? 1.0, actor.data.drawScale ?? 1.0, env);
            actor.mesh.scale.setScalar(scale);
            actor.mesh.lookAt(camera.position);
        });
    }

    public render(renderer: WebGLRenderer) {
        if (!this.camera) return;

        renderer.render(this.celestialScene, this.camera);
    }
}
