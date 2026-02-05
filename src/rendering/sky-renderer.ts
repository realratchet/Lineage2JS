import { Scene, PerspectiveCamera, Vector3, WebGLRenderer, Mesh, MeshBasicMaterial, Texture, DoubleSide, CustomBlending, OneFactor, OneMinusSrcColorFactor, PlaneGeometry, Group, AdditiveBlending, NormalBlending } from "three";
import L2Environment from "./l2-env";
import { ColorByte } from "@client/utils/color-byte";
import { SectorObject } from "@client/objects/zone-object";
import EnvInfo from "@client/rendering/env-info";

// Constants from Analysis (CELESTIAL_POSITIONING_COMPLETE.md)
const DEG2RAD = Math.PI / 180;
const HALF_PI = Math.PI / 2;
const NEG_PI = -Math.PI;
const X_ROTATION_ANGLE = 30 * DEG2RAD;
const PI = Math.PI;

const MATERIAL_U_SIZE = 32; // Used for scaling instead of texture size
const DEFAULT_CELESTIAL_RADIUS = 15000; // Calibrated for ~0.5 degree angular size

const TMP_VEC3 = new Vector3();
const tmpColorByte = new ColorByte();


class CelestialMaterial extends MeshBasicMaterial {
    public constructor() {
        super({
            transparent: true,
            blending: CustomBlending,
            blendSrc: OneFactor,
            blendDst: OneMinusSrcColorFactor,
            depthWrite: false,
            depthTest: false,
            side: DoubleSide
        });
    }
}


class Celestial extends Mesh {
    public static readonly _geometry = new PlaneGeometry(1, -1);

    public constructor() {
        super(Celestial._geometry, new CelestialMaterial());

        this.frustumCulled = false;
        this.visible = false;
    }
}

export default class SkyRenderer {
    private envInfo: EnvInfo;

    private celestialScene = new Scene();
    private sun: Celestial = new Celestial();
    private moon: Celestial = new Celestial();
    private camera: PerspectiveCamera | null = null;

    private sunData: any = null;
    private skyLayerGroup: Group = new Group();

    private skyLayers: {
        skybox: Mesh[];
        haze: Mesh[];
        clouds: { mesh: Mesh, index: number }[];
        stars: Mesh[];
    } = { skybox: [], haze: [], clouds: [], stars: [] };

    public moons: { data: any, texture: Texture | null }[] = [];
    public activeMoonIndex: number = 0;
    public moonMultiplier: number = 1.0;


    public constructor() {
        this.celestialScene.add(this.skyLayerGroup);
        this.celestialScene.add(this.sun);
        this.celestialScene.add(this.moon);

        this.sun.renderOrder = -8;
        this.moon.renderOrder = -7;
    }

    public setActiveMoon(index: number) {
        if (index >= 0 && index < this.moons.length) {
            this.activeMoonIndex = index;
            this.updateActiveMoonMaterial();
        }
    }

    private updateActiveMoonMaterial() {
        const activeMoon = this.moons[this.activeMoonIndex];
        if (activeMoon && activeMoon.texture) {
            (this.moon.material as MeshBasicMaterial).map = activeMoon.texture;
            (this.moon.material as MeshBasicMaterial).needsUpdate = true;
        }
    }

    public initSkyLevel(envInfo: EnvInfo, skyLevel: SectorObject) {
        this.envInfo = envInfo;

        // Diagnostic: Find SkyZoneInfo to determine canonical origin
        const skyZoneInfos: any[] = [];
        skyLevel.traverse(obj => {
            if (obj.constructor.name === "USkyZoneInfo" || (obj as any).isSkyZoneInfo) {
                skyZoneInfos.push(obj);
            }
        });
        console.log(`[SkyRenderer] Found ${skyZoneInfos.length} SkyZoneInfo actors in skylevel`);
        skyZoneInfos.forEach(szi => console.log(`  > ${szi.name}: Position(${szi.position.toArray().map((v: number) => v.toFixed(2))})`));

        const celestials = skyLevel.celestials;

        celestials.forEach(celestial => {
            if (celestial.type === "Sun") {
                this.sunData = celestial.data;
                if (celestial.sprite) {
                    (this.sun.material as MeshBasicMaterial).map = celestial.sprite;
                    (this.sun.material as MeshBasicMaterial).needsUpdate = true;
                }
            } else if (celestial.type === "Moon") {
                this.moons.push({ data: celestial.data, texture: celestial.sprite });
            }
        });

        this.moons.sort((a, b) => (a.data.objectName || "").localeCompare(b.data.objectName || ""));

        if (this.moons.length > 0) {
            this.activeMoonIndex = 0;
            this.updateActiveMoonMaterial();
        }

        const { skybox, hazering, clouds } = envInfo.setup;
        const bspSections = skyLevel.getObjectByName("BSP_Sections");
        if (!bspSections) return;

        let meshCount = 0;
        const children = bspSections.children as Mesh[];

        // 1. Determine a common origin for the sky assembly.
        const skyOrigin = new Vector3();
        const skyZoneInfo = skyZoneInfos[0];

        if (skyZoneInfo) {
            // USkyZoneInfo position is the canonical origin for sky rendering.
            // Use userData.skyOrigin if available (to avoid scene graph transform issues), otherwise fallback to position.
            if (skyZoneInfo.userData && skyZoneInfo.userData.skyOrigin) {
                skyOrigin.copy(skyZoneInfo.userData.skyOrigin);
            } else {
                skyOrigin.copy(skyZoneInfo.position);
            }
            console.log(`[SkyRenderer] Using USkyZoneInfo as canonical origin: ${skyOrigin.toArray().map(v => v.toFixed(1))}`);
        } else {
            const skyboxPattern = envInfo.setup.skybox;
            let skyboxMesh = skyboxPattern ? children.find(m => m.name.includes(skyboxPattern)) : null;

            // Robust Fallback: If skybox is filtered out, use the first available sky component (e.g. Clouds) as anchor
            if (!skyboxMesh && children.length > 0) skyboxMesh = children[0];

            if (skyboxMesh) {
                if (!skyboxMesh.geometry.boundingBox) skyboxMesh.geometry.computeBoundingBox();
                skyboxMesh.geometry.boundingBox!.getCenter(skyOrigin);

                // Offset the anchor down so the camera isn't dead-center in the sky assembly.
                // This prevents flat cloud/star layers from slicing exactly through the eyes (Y=0).
                skyOrigin.y -= 250;
                console.warn(`[SkyRenderer] USkyZoneInfo NOT FOUND. Falling back to mesh center (${skyboxMesh.name}): ${skyOrigin.toArray().map(v => v.toFixed(1))}`);
            }
        }

        const processMesh = (mesh: Mesh, type: "skybox" | "haze" | "cloud" | "star", index: number = 0) => {
            if (!mesh) return;

            // 1. Material Setup
            const material = mesh.material as any;
            material.transparent = true;
            material.depthWrite = false;
            material.depthTest = false;
            material.side = DoubleSide;
            material.fog = false;
            if (material.defines) delete material.defines.USE_FOG;
            mesh.frustumCulled = false; // Always render sky components

            // 2. Geometry Centering (Relative to Sky Origin)
            // Translate geometry so it is centered on (0,0,0) local relative to the sky assembly
            mesh.geometry.translate(-skyOrigin.x, -skyOrigin.y, -skyOrigin.z);
            mesh.geometry.computeBoundingBox();

            // 3. Sky Scene Attachment
            // Add to skyLayerGroup so it follows the camera position (infinite sky effect)
            this.skyLayerGroup.add(mesh);
            mesh.position.set(0, 0, 0);
            mesh.position.set(0, 0, 0);
            mesh.rotation.set(0, 0, 0);
            // mesh.scale.set(1, 1, 1);
            mesh.scale.set(1, 1, 1);
            mesh.updateMatrix();

            // 4. Layer & Render Order Config
            meshCount++;
            if (type === "skybox") {
                mesh.renderOrder = -10000 + meshCount;
                this.skyLayers.skybox.push(mesh);
            } else if (type === "haze") {
                mesh.renderOrder = -8000 + meshCount;
                material.blending = NormalBlending; // Match Trace 3040954 (SrcAlpha, InvSrcAlpha)
                material.transparent = true;
                material.depthWrite = false;
                material.depthTest = false;

                mesh.visible = true;
                this.skyLayers.haze.push(mesh);
            } else if (type === "cloud") {
                mesh.renderOrder = -7000 + (index * 100) + meshCount;
                this.skyLayers.clouds.push({ mesh, index });
            } else if (type === "star") {
                mesh.renderOrder = -9000 + meshCount;
                material.blending = CustomBlending;
                material.blendSrc = OneFactor;
                material.blendDst = OneFactor;
                this.skyLayers.stars.push(mesh);
            }

            // 5. Debug Log
            if (['skybox', 'haze', 'cloud', 'star'].includes(type) && (index === 0 || type === 'cloud')) {
                // const box = mesh.geometry.boundingBox!;
                // console.log(`[SkyRenderer] DEBUG ${type} (${mesh.name})`);
                // console.log(`  > Translation Applied: ${skyOrigin.toArray().map(v => v.toFixed(2))}`);
                // console.log(`  > Final GeoBox: Min(${box.min.toArray().map(v => v.toFixed(2))}) Max(${box.max.toArray().map(v => v.toFixed(2))})`);
                // console.log(`  > Mat: Visible=${material.visible}, Opacity=${material.opacity}, DepthTest=${material.depthTest}`);
                // console.log(`  > RenderOrder: ${mesh.renderOrder}, Parent: ${mesh.parent?.type}`);
            }
        };

        // Use filter to capture all meshes for each layer (multiple BSP flags)
        children.filter(o => skybox && o.name.includes(skybox)).forEach(m => processMesh(m, "skybox"));
        children.filter(o => hazering && o.name.includes(hazering)).forEach(m => processMesh(m, "haze"));

        clouds.forEach((pattern, i) => {
            if (pattern) {
                children.filter(o => o.name.includes(pattern)).forEach(m => processMesh(m, "cloud", i));
            }
        });

        // Also add stars if found
        children.filter(o => o.name.includes("StarField")).forEach(s => processMesh(s, "star"));
    }

    public update(camera: PerspectiveCamera, env: L2Environment, skyColor: ColorByte, _hazeColor: ColorByte, hazeColors: ColorByte[], cloudColor: ColorByte, _sector: any) {
        this.camera = camera;
        const timeOfDay = env.getTimeOfDay();

        this.skyLayerGroup.position.copy(camera.position);

        // Update Celestials
        this.updateSun(timeOfDay, camera, env);
        this.updateMoon(timeOfDay, camera, env);
        this.updateSkyLayers(env, skyColor, _hazeColor, hazeColors, cloudColor);
    }

    private updateSkyLayers(env: L2Environment, skyColor: ColorByte, _hazeColor: ColorByte, hazeColors: ColorByte[], _cloudColor: ColorByte) {
        if (!this.envInfo) return;

        function updateMaterialProperties(material: any, colorByte: ColorByte) {
            const r = colorByte.r / 255;
            const g = colorByte.g / 255;
            const b = colorByte.b / 255;
            const a = colorByte.a / 255;

            const isStatic = !!(material.isStaticMeshMaterial || material.uniforms?.shDiffuse);

            if (isStatic) {
                material.uniforms.diffuse.value.setRGB(r, g, b);
                material.uniforms.opacity.value = a;
            } else if (material.color) {
                // console.log(`[SkyRenderer] Applying Standard Material Color: ${r.toFixed(2)},${g.toFixed(2)},${b.toFixed(2)} to ${material.uuid}`);
                material.color.setRGB(r, g, b);
                material.opacity = a;
            }
        }

        // Skybox
        this.skyLayers.skybox.forEach(mesh => {
            updateMaterialProperties(mesh.material as any, skyColor);
        });

        // Haze - apply per-vertex gradient coloring
        this.skyLayers.haze.forEach((mesh) => {
            const material = mesh.material as any;
            const geometry = mesh.geometry;
            const colorAttr = geometry.attributes.color;
            const posAttr = geometry.attributes.position;

            if (!colorAttr || !posAttr) return;

            // Use hazeColors array for gradient, fallback to single color
            const colors = (hazeColors && hazeColors.length > 0) ? hazeColors : [_hazeColor];
            if (colors.length === 0) return;

            // Get Y bounds for normalization
            if (!geometry.boundingBox) geometry.computeBoundingBox();
            const box = geometry.boundingBox!;
            const yMin = box.min.y;
            const yMax = box.max.y;
            const yRange = yMax - yMin;

            // DEBUG: Check haze geometry bounds once
            // if (Math.random() < 0.01) console.log(`[SkyRenderer] Haze Mesh: ${mesh.name} | Y: [${yMin.toFixed(1)}, ${yMax.toFixed(1)}] | Range: ${yRange.toFixed(1)} | Pos: ${mesh.position.toArray()}`);

            // Apply per-vertex colors based on Y position (Color Only, Gradient is in Shader)
            for (let i = 0; i < posAttr.count; i++) {
                const y = posAttr.getY(i);
                const t = yRange > 0 ? (y - yMin) / yRange : 0; // 0 = bottom, 1 = top

                // Map t to colors array with interpolation
                const colorIndex = t * (colors.length - 1);
                const lowIdx = Math.floor(colorIndex);
                const highIdx = Math.min(Math.ceil(colorIndex), colors.length - 1);
                const frac = colorIndex - lowIdx;

                const colorLow = colors[lowIdx];
                const colorHigh = colors[highIdx];

                // Interpolate and set vertex color (normalized to 0-1)
                const r = (colorLow.r + (colorHigh.r - colorLow.r) * frac) / 255;
                const g = (colorLow.g + (colorHigh.g - colorLow.g) * frac) / 255;
                const b = (colorLow.b + (colorHigh.b - colorLow.b) * frac) / 255;

                colorAttr.setXYZ(i, r, g, b);
            }
            colorAttr.needsUpdate = true;

            // Also set material opacity from first color's alpha
            if (colors[0].a !== undefined) {
                material.opacity = colors[0].a / 255;
            }
        });

        // Clouds
        this.skyLayers.clouds.forEach(({ mesh, index }) => {
            // RenderManager calculates a single blended cloud color (cloudColor)
            // But Env has separate colors for cloud1, cloud2, cloud3.
            // For now, let's trust Env for individual layer colors if we aren't blending?
            // Actually, if RenderManager blends them, maybe we should use cloudColor? 
            // But cloudColor is 1 value, and we have 3 layers. 
            // Let's stick to env.getCloudColor(index) for now as it supports multiple layers,
            // unless we confirm cloudColor is intended to override all.
            // The issue reported was about HAZERING, so I will stick to fixing haze.
            env.getCloudColor(index, tmpColorByte);
            updateMaterialProperties(mesh.material as any, tmpColorByte);
        });

        // Stars
        this.skyLayers.stars.forEach((mesh) => {
            env.getStarColor(tmpColorByte);
            updateMaterialProperties(mesh.material as any, tmpColorByte);
        });
    }

    private getCelestialPositioningAngles(timeOfDay: number, celestialType: "sun" | "moon"): [number, number] {
        const longitude = PI;
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
        return [latitude, longitude];
    }

    private calculateCelestialOffset(timeOfDay: number, celestialType: "sun" | "moon", radius: number): Vector3 {
        const [lat, lon] = this.getCelestialPositioningAngles(timeOfDay, celestialType);
        if (lat === NEG_PI) return new Vector3(0, 0, 0);
        const spherical = TMP_VEC3.set(radius * Math.sin(lat) * Math.cos(lon), radius * Math.sin(lat) * Math.sin(lon), radius * Math.cos(lat));
        spherical.applyAxisAngle(new Vector3(1, 0, 0), X_ROTATION_ANGLE);
        return new Vector3(spherical.x, spherical.z, spherical.y);
    }

    private calculateCelestialScale(celestialType: "sun" | "moon", baseScale: number, actorDrawScale: number, env: L2Environment): number {
        const envScale = celestialType === "sun" ? env.getSunScale() : env.getMoonScale();
        const multiplier = celestialType === "sun" ? 8.0 : this.moonMultiplier;
        return (envScale * baseScale * multiplier * actorDrawScale * MATERIAL_U_SIZE);
    }

    private updateSun(timeOfDay: number, camera: PerspectiveCamera, env: L2Environment) {
        if (!this.sunData) return;
        const [lat] = this.getCelestialPositioningAngles(timeOfDay, "sun");
        if (lat !== NEG_PI) {
            this.sun.visible = true;
            const radius = this.sunData.radius || DEFAULT_CELESTIAL_RADIUS;
            this.sun.position.copy(camera.position).add(this.calculateCelestialOffset(timeOfDay, "sun", radius));
            const scale = this.calculateCelestialScale("sun", this.sunData.celestialScale ?? 1.0, this.sunData.drawScale ?? 1.0, env);
            this.sun.scale.setScalar(scale);
            this.sun.lookAt(camera.position);

            env.getSunColor(tmpColorByte);
            (this.sun.material as MeshBasicMaterial).color.setRGB(
                tmpColorByte.r / 255,
                tmpColorByte.g / 255,
                tmpColorByte.b / 255
            );
        } else this.sun.visible = false;
    }

    private updateMoon(timeOfDay: number, camera: PerspectiveCamera, env: L2Environment) {
        if (this.moons.length === 0) return;
        const activeMoon = this.moons[this.activeMoonIndex];
        if (!activeMoon) return;
        const [lat] = this.getCelestialPositioningAngles(timeOfDay, "moon");
        if (lat !== NEG_PI) {
            this.moon.visible = true;
            const radius = activeMoon.data.radius || DEFAULT_CELESTIAL_RADIUS;
            this.moon.position.copy(camera.position).add(this.calculateCelestialOffset(timeOfDay, "moon", radius));
            const scale = this.calculateCelestialScale("moon", activeMoon.data.celestialScale ?? 1.0, activeMoon.data.drawScale ?? 1.0, env);
            this.moon.scale.setScalar(scale);
            this.moon.lookAt(camera.position);

            (this.moon.material as MeshBasicMaterial).color.setHex(0xffffff);
            (this.moon.material as MeshBasicMaterial).opacity = 1.0;
        } else this.moon.visible = false;
    }

    public render(renderer: WebGLRenderer) {
        if (!this.camera) return;

        renderer.render(this.celestialScene, this.camera);
    }
}
