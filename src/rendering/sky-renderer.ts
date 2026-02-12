import {
    Scene, PerspectiveCamera, Vector3, WebGLRenderer, Mesh, MeshBasicMaterial,
    Texture, DoubleSide, CustomBlending, OneFactor, SrcAlphaFactor,
    PlaneGeometry, Group, BufferAttribute, Fog, Color,
    OneMinusSrcAlphaFactor
} from 'three';
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
            blendSrc: SrcAlphaFactor, // Trace: D3DBLEND_SRCALPHA (5)
            blendDst: OneFactor,      // Trace: D3DBLEND_ONE (2) -> Additive Alpha
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
    public sun: Celestial = new Celestial();
    public moon: Celestial = new Celestial();
    private camera: PerspectiveCamera | null = null;

    private sunData: any = null;
    public config = {
        celestials: true,    // Sun & Moon
        haze1: true,         // Horizon Clearing
        starsClouds: true,   // Stars & Clouds
        haze2: true,          // Dome Atmosphere
    };
    private skyLayerGroup: Group = new Group();

    public skyLayers: {
        skybox: Mesh[];
        haze: Mesh[];
        clouds: { mesh: Mesh, index: number }[];
    } = { skybox: [], haze: [], clouds: [] };


    public moons: { data: any, texture: Texture | null }[] = [];
    public activeMoonIndex: number = 0;

    public constructor() {
        this.celestialScene.add(this.skyLayerGroup);
        this.celestialScene.add(this.sun);
        this.celestialScene.add(this.moon);

        this.sun.renderOrder = -9000;
        this.moon.renderOrder = -8999;
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


        const stetup = envInfo.setup

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

            // Enable Fog for all sky components to blend with horizon (as seen in trace: D3DRS_FOGENABLE=TRUE)
            // Note: This is now handled by the decodeBSPSection based on sectionInfo.fog
            // which we set to true for isSky in un-model.ts

            mesh.frustumCulled = false; // Always render sky components

            // 2. Geometry Centering (Relative to Sky Origin)
            // Translate geometry so it is centered on (0,0,0) local relative to the sky assembly
            mesh.geometry.translate(-skyOrigin.x, -skyOrigin.y, -skyOrigin.z);
            mesh.geometry.computeBoundingBox();

            // 3. Sky Scene Attachment
            // Add to skyLayerGroup so it follows the camera position (infinite sky effect)
            this.skyLayerGroup.add(mesh);
            mesh.position.set(0, 0, 0);
            mesh.rotation.set(0, 0, 0);
            mesh.scale.set(1, 1, 1);
            mesh.updateMatrix();

            // 4. Layer & Render Order Config
            meshCount++;
            if (type === "skybox") {
                mesh.renderOrder = -9500 + meshCount;
                this.skyLayers.skybox.push(mesh);
            } else if (type === "haze") {
                mesh.renderOrder = -7000 + meshCount;

                // Check for PF_TwoSided (0x100)
                // Mesh name format: BSPSection_.../flags/...
                const nameParts = mesh.name.split('/');
                const flags = nameParts.length > 1 ? parseInt(nameParts[1]) || 0 : 0;

                const PF_TwoSided = 0x100;

                if (!(flags & PF_TwoSided)) {
                    // If NOT TwoSided, we assume this is the AddLast/Glow mesh (Haze 2)
                    // Render AFTER normal haze (-6500 range)
                    mesh.renderOrder = -6500 + meshCount;
                }

                // Note: Material properties like blending, transparency, depth, and fog 
                // are now handled by the decoding pipeline (un-model.ts + object3d-decoder.ts).

                mesh.visible = true;

                // Ensure color attribute exists for Debug/UV visualization
                if (!mesh.geometry.attributes.color) {
                    const count = mesh.geometry.attributes.position.count;
                    mesh.geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
                }

                this.skyLayers.haze.push(mesh);
            } else if (type === "cloud") {
                mesh.renderOrder = -8000 + (index * 100) + meshCount;
                this.skyLayers.clouds.push({ mesh, index });


            }
        }

        // Use filter to capture all meshes for each layer (multiple BSP flags)
        children.filter(o => skybox && o.name.includes(skybox)).forEach(m => processMesh(m, "skybox"));
        children.filter(o => hazering && o.name.includes(hazering)).forEach(m => processMesh(m, "haze"));

        clouds.forEach((pattern, i) => {
            if (pattern) {
                children.filter(o => o.name.includes(pattern)).forEach(m => processMesh(m, "cloud", i));
            }
        });

        // Analysis confirms StarField meshes are already included in the `clouds` array via Env.int
        // (Cloud2=StarField_Final01, Cloud3=StarField_Final02)
        // So no manual addition is needed. The processMesh loop above handles them.
    }

    public update(camera: PerspectiveCamera, env: L2Environment, skyColor: ColorByte, _hazeColor: ColorByte, hazeColors: ColorByte[], cloudColors: ColorByte[], _fogColor: ColorByte, fogStart: number, fogEnd: number, _sector: SectorObject | null, clearColor: ColorByte, skyVisibility: number) {
        if (!this.envInfo) return;

        this.camera = camera;

        // Sync Celestial Assembly to Camera
        this.skyLayerGroup.position.copy(camera.position);

        // Re-enable Sky Layers group (individual layers will be filtered in updateSkyLayers)
        this.skyLayerGroup.visible = true;

        // Apply Fog to Celestial Scene
        const fogColorThree = new Color().setRGB(_fogColor.r / 255, _fogColor.g / 255, _fogColor.b / 255);
        if (!this.celestialScene.fog) {
            this.celestialScene.fog = new Fog(fogColorThree, fogStart, fogEnd);
        } else {
            const f = this.celestialScene.fog as Fog;
            f.color.copy(fogColorThree);
            f.near = fogStart;
            f.far = fogEnd;
        }

        // Re-enable and Update Celestials
        this.updateSun(env.getTimeOfDay(), camera, env, _fogColor, fogStart, fogEnd);
        this.updateMoon(env.getTimeOfDay(), camera, env, _fogColor, fogStart, fogEnd);

        this.updateSkyLayers(env, skyColor, _hazeColor, hazeColors, cloudColors, _fogColor, skyVisibility, clearColor);
    }

    private updateSkyLayers(_env: L2Environment, _skyColor: ColorByte, _hazeColor: ColorByte, hazeColors: ColorByte[], cloudColors: ColorByte[], fogColor: ColorByte, skyVisibility: number, _clearColor: ColorByte) {
        if (!this.envInfo) return;

        // applyModifierColor emulates D3DRS_TEXTUREFACTOR (TFACTOR) modulation
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

        // 1. Prepare base colors
        // modulatedSky is for elements that use the pure sky color (like stars modulation)
        // const modulatedHazeBase = _hazeColor.clone();

        // Skybox - DISABLED MESH (Use Renderer Clear Color)
        this.skyLayers.skybox.forEach(mesh => {
            mesh.visible = false;
        });


        // Haze - isolate Layer 1 (Clearing) and Layer 2 (Dome)
        this.skyLayers.haze.forEach((mesh) => {

            // Dome is large/lower order (-7998), Ring is small/higher order (-5997)
            const material = mesh.material as any;
            const isLayer2 = mesh.renderOrder < -7000;

            if (isLayer2) {
                mesh.visible = this.config.haze2;
                material.fog = false;
            } else {
                mesh.visible = this.config.haze1;
                material.fog = false;
            }

            if (!mesh.visible) return;



            // Use the first stop as the global modulation color (TFACTOR)
            const targetColor = hazeColors[0];
            const modulator = new ColorByte().set(targetColor.r, targetColor.g, targetColor.b, 255);

            applyModifierColor(material, modulator);
            material.needsUpdate = true;
        });

        // Clouds
        this.skyLayers.clouds.forEach(({ mesh, index }) => {

            mesh.visible = this.config.starsClouds;
            if (!mesh.visible) return;

            // The cloudColors[index] from RenderManager already contains the blended 
            // result of Baseline + Regional Overrides (Lerp math).
            const modulated = cloudColors[index] || cloudColors[0];

            applyModifierColor(mesh.material, modulated);

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
        const multiplier = celestialType === "sun" ? 8.0 : 1.0;
        return (envScale * baseScale * multiplier * actorDrawScale * MATERIAL_U_SIZE);
    }

    private updateSun(timeOfDay: number, camera: PerspectiveCamera, env: L2Environment, fogColor: ColorByte, fogStart: number, fogEnd: number) {
        if (!this.sunData || !this.config.celestials) {
            this.sun.visible = false;
            return;
        }
        const [lat] = this.getCelestialPositioningAngles(timeOfDay, "sun");
        if (lat !== NEG_PI) {
            this.sun.visible = true;
            const radius = this.sunData.radius || DEFAULT_CELESTIAL_RADIUS;
            this.sun.position.copy(camera.position).add(this.calculateCelestialOffset(timeOfDay, "sun", radius));
            const scale = this.calculateCelestialScale("sun", this.sunData.celestialScale ?? 1.0, this.sunData.drawScale ?? 1.0, env);
            this.sun.scale.setScalar(scale);
            this.sun.lookAt(camera.position);

            env.getSunColor(tmpColorByte);

            // Apply Fog to Sun Color (CPU-side blending to match Trace TFACTOR)
            // If fog is enabled and dense, Sun should take on Fog Color
            if (fogEnd > 0 && fogEnd > fogStart) {
                // Linear Fog: f = (end - dist) / (end - start)
                // In Three.js/OpenGL standard, this is visibility factor. 0 = Full Fog, 1 = No Fog.
                // But we want to mix Fog Color IN. So blendFactor = 1 - visibility.
                const dist = radius;
                let visibility = (fogEnd - dist) / (fogEnd - fogStart);
                visibility = Math.max(0, Math.min(1, visibility));

                // Mix Sun Color with Fog Color
                // Result = Sun * visibility + Fog * (1 - visibility)
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

    private updateMoon(timeOfDay: number, camera: PerspectiveCamera, env: L2Environment, fogColor: ColorByte, fogStart: number, fogEnd: number) {
        if (this.moons.length === 0 || this.activeMoonIndex < 0 || !this.config.celestials) {
            this.moon.visible = false;
            return;
        }
        const [lat] = this.getCelestialPositioningAngles(timeOfDay, "moon");
        if (lat !== NEG_PI) {
            this.moon.visible = true;
            const activeMoon = this.moons[this.activeMoonIndex];
            const radius = activeMoon.data.radius || DEFAULT_CELESTIAL_RADIUS;
            const offset = this.calculateCelestialOffset(timeOfDay, "moon", radius);
            this.moon.position.copy(camera.position).add(offset);
            const scale = this.calculateCelestialScale("moon", activeMoon.data.celestialScale ?? 1.0, activeMoon.data.drawScale ?? 1.0, env);
            this.moon.scale.setScalar(scale);
            this.moon.lookAt(camera.position);

            const mat = this.moon.material as MeshBasicMaterial;

            // Accurate Coloring: Use White as base (Env MoonColor is dead code/red)
            tmpColorByte.set(255, 255, 255);

            // Apply CPU-side fog blending
            const dist = offset.length(); // Radial distance from camera
            if (dist > fogStart) {
                let visibility = (fogEnd - dist) / (fogEnd - fogStart);
                visibility = Math.max(0, Math.min(1, visibility));

                const fogFactor = 1.0 - visibility;
                tmpColorByte.lerp(fogColor, fogFactor);
            }

            mat.color.setRGB(tmpColorByte.r / 255, tmpColorByte.g / 255, tmpColorByte.b / 255);
            mat.opacity = 1.0;
        } else this.moon.visible = false;
    }

    public render(renderer: WebGLRenderer) {
        if (!this.camera) return;

        renderer.render(this.celestialScene, this.camera);
    }
}
