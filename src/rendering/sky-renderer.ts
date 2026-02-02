import { Scene, PerspectiveCamera, Vector3, WebGLRenderer, Mesh, MeshBasicMaterial, PlaneGeometry, Texture, Color, DoubleSide, CustomBlending, OneFactor, OneMinusSrcColorFactor, SphereGeometry, BackSide, AdditiveBlending, BufferAttribute } from "three";
import L2Environment from "./l2-env";
import { ColorByte } from "@client/utils/color-byte";

// Constants from Analysis (CELESTIAL_POSITIONING_COMPLETE.md)
const DEG2RAD = Math.PI / 180;
const HALF_PI = Math.PI / 2;
const NEG_PI = -Math.PI;
const X_ROTATION_ANGLE = 30 * DEG2RAD;
const PI = Math.PI;

const MATERIAL_U_SIZE = 32; // Used for scaling instead of texture size
const DEFAULT_CELESTIAL_RADIUS = 15000; // Calibrated for ~0.5 degree angular size
const SKY_DOME_RADIUS = 20000;
const CLOUD_LAYER_RADIUS = 18000;

const TMP_VEC3 = new Vector3();


export default class SkyRenderer {
    private celestialScene = new Scene();
    private skyDome: Mesh;
    private clouds: Mesh;
    private sun: Mesh;
    private moon: Mesh;
    private camera: PerspectiveCamera | null = null;

    private sunData: any = null;

    public moons: { data: any, texture: Texture | null }[] = [];
    public activeMoonIndex: number = 0;
    public moonMultiplier: number = 1.0;

    constructor() {
        const spriteGeom = new PlaneGeometry(1, 1);
        const uv = spriteGeom.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
            uv.setY(i, 1 - uv.getY(i));
        }

        // 1. Sky Dome
        // 1. Sky Dome
        const skyMat = new MeshBasicMaterial({
            vertexColors: true,
            side: BackSide,
            depthWrite: false,
            fog: false
        });
        this.skyDome = new Mesh(new SphereGeometry(SKY_DOME_RADIUS, 32, 32), skyMat);
        this.skyDome.frustumCulled = false;

        // Init color attribute
        const count = this.skyDome.geometry.attributes.position.count;
        this.skyDome.geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));

        this.celestialScene.add(this.skyDome);

        // 2. Clouds
        const cloudMat = new MeshBasicMaterial({
            transparent: true,
            depthWrite: false,
            side: BackSide,
            map: null,
            color: new Color(0xffffff)
        });
        this.clouds = new Mesh(new SphereGeometry(CLOUD_LAYER_RADIUS, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2), cloudMat);
        this.clouds.frustumCulled = false;
        this.clouds.visible = false;
        this.celestialScene.add(this.clouds);

        // 3. Sun
        const sunMat = new MeshBasicMaterial({
            transparent: true,
            blending: CustomBlending,
            blendSrc: OneFactor,
            blendDst: OneMinusSrcColorFactor,
            depthWrite: false,
            depthTest: false,
            side: DoubleSide
        });
        this.sun = new Mesh(spriteGeom, sunMat);
        this.sun.visible = false;
        this.sun.frustumCulled = false;
        this.celestialScene.add(this.sun);

        // 4. Moon
        const moonMat = new MeshBasicMaterial({
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
            depthTest: false,
            side: DoubleSide,
            color: 0xffffff
        });
        this.moon = new Mesh(spriteGeom, moonMat);
        this.moon.visible = false;
        this.moon.frustumCulled = false;
        this.celestialScene.add(this.moon);
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

    public initFromSector(celestials: any[]) {
        if (!celestials) return;

        celestials.forEach(celestial => {
            if (celestial.type === "Sun") {
                this.sunData = celestial.data;
                if (celestial.sprite) {
                    const tex = celestial.sprite;
                    tex.needsUpdate = true;
                    (this.sun.material as MeshBasicMaterial).map = tex;
                    (this.sun.material as MeshBasicMaterial).needsUpdate = true;
                }
            } else if (celestial.type === "Moon") {
                const moonEntry: { data: any, texture: Texture | null } = { data: celestial.data, texture: null };
                if (celestial.sprite) {
                    const tex = celestial.sprite;
                    tex.needsUpdate = true;
                    moonEntry.texture = tex;
                }
                this.moons.push(moonEntry);
            }
        });

        this.moons.sort((a, b) => (a.data.objectName || "").localeCompare(b.data.objectName || ""));

        if (this.moons.length > 0) {
            this.activeMoonIndex = 0;
            this.updateActiveMoonMaterial();
        }
    }

    public update(camera: PerspectiveCamera, env: L2Environment, skyColor: ColorByte, hazeColor: ColorByte, hazeColors: ColorByte[], cloudColor: ColorByte, sector: any) {
        this.camera = camera;
        const timeOfDay = env.getTimeOfDay();

        // Update Sky Dome colors (Vertex Gradient)
        const geo = this.skyDome.geometry;
        const positions = geo.attributes.position;
        const colors = geo.attributes.color;
        const count = positions.count;

        const zenithColor = new Color(skyColor.r / 255, skyColor.g / 255, skyColor.b / 255);
        const horizonColor = new Color(hazeColor.r / 255, hazeColor.g / 255, hazeColor.b / 255);

        const useHazeArray = hazeColors && hazeColors.length > 0;
        // Pre-convert haze array to THREE.Color for speed
        const hazeColorArray = useHazeArray ? hazeColors.map(c => new Color(c.r / 255, c.g / 255, c.b / 255)) : [];

        const tmpColor = new Color();

        for (let i = 0; i < count; i++) {
            const y = positions.getY(i);
            // SKY_DOME_RADIUS = 20000
            // Zenith (Top) is y = 20000
            // Horizon is y = 0
            // Nadir (Bottom) is y = -20000

            // Normalize height 0..1 (from horizon to zenith)
            let h = y / SKY_DOME_RADIUS;

            // Render full sphere, but usually we care about h >= 0
            if (h < 0) {
                // Below horizon: just use horizon color (or fade to black/nadir if desired)
                // Using horizon color for continuity
                if (useHazeArray) {
                    colors.setXYZ(i, hazeColorArray[0].r, hazeColorArray[0].g, hazeColorArray[0].b);
                } else {
                    colors.setXYZ(i, horizonColor.r, horizonColor.g, horizonColor.b);
                }
            } else {
                // Above horizon
                if (useHazeArray) {
                    // Map 0..1 to hazeColors array + zenith
                    // If we have N haze colors, they might represent bands
                    // Let's assume hazeColors distribute from horizon up to some point, then SkyColor
                    // Or hazeColors covers the gradient to SkyColor?

                    // Experiment: Map 0..0.5 to hazeColors, then to SkyColor?
                    // Or spread hazeColors across the whole dome?
                    // Typically haze is low.

                    // Simple approach: Interpolate between Horizon(haze[0]) -> ... -> Zenith(Sky)
                    // If hazeColors has 4 items: 
                    // 0: Horizon
                    // ...
                    // Last: Haze Top
                    // Then -> SkyColor

                    // Total stops: HazeCount + 1 (Zenith)
                    const totalStops = hazeColorArray.length + 1;
                    const segment = h * (totalStops - 1); // 0 .. N
                    const idx = Math.floor(segment);
                    const alpha = segment - idx;

                    let c1: Color, c2: Color;

                    if (idx < hazeColorArray.length - 1) {
                        c1 = hazeColorArray[idx];
                        c2 = hazeColorArray[idx + 1];
                    } else if (idx === hazeColorArray.length - 1) {
                        c1 = hazeColorArray[idx];
                        c2 = zenithColor;
                    } else {
                        c1 = zenithColor;
                        c2 = zenithColor;
                    }

                    tmpColor.copy(c1).lerp(c2, alpha);
                    colors.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);

                } else {
                    // Standard linear blend
                    // Add exponent to push blue up?
                    const t = Math.pow(h, 0.5); // Push horizon up a bit
                    tmpColor.copy(horizonColor).lerp(zenithColor, t);
                    colors.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
                }
            }
        }
        colors.needsUpdate = true;

        this.skyDome.position.copy(camera.position);

        // Update Clouds
        this.updateClouds(camera, cloudColor, sector);

        // Update Celestials
        this.updateSun(timeOfDay, camera, env);
        this.updateMoon(timeOfDay, camera, env);
    }

    private updateClouds(camera: PerspectiveCamera, cloudColor: ColorByte, sector: any) {
        // Find cloud texture from current fog info if available
        // RenderManager passes 'sector' which might have 'fogInfos'
        let texture = null;
        if (sector && sector.fogInfos) {
            for (const fogInfo of sector.fogInfos) {
                if (fogInfo.cloudTexture) {
                    texture = fogInfo.cloudTexture;
                    break;
                }
            }
        }

        if (texture) {
            const mat = this.clouds.material as MeshBasicMaterial;
            if (mat.map !== texture) {
                mat.map = texture;
                mat.needsUpdate = true;
            }
            mat.color.setRGB(cloudColor.r / 255, cloudColor.g / 255, cloudColor.b / 255);
            this.clouds.visible = true;
            this.clouds.position.copy(camera.position);
            // Slowly rotate clouds
            this.clouds.rotation.y += 0.0001;
        } else {
            this.clouds.visible = false;
        }
    }

    private getCelestialPositioningAngles(timeOfDay: number, celestialType: "sun" | "moon"): [number, number] {
        const longitude = PI;
        let latitude: number;
        if (celestialType === "sun") {
            // Unified sun position logic (confirmed by trace visibility at 00:20AM)
            // Sun moves 10 degrees/hour. 06:00 = -90 (Horizon), 15:00 = 0 (Zenith), 24:00 = 90 (Horizon Set).
            // Night (00:00 - 06:00) continues 90 -> 150.
            const t = (timeOfDay < 6.0) ? (timeOfDay + 24.0) : timeOfDay;
            latitude = (t - 6.0) * (10 * DEG2RAD) - HALF_PI;
            // No strict cut-off; sun renders below horizon at night (faintly via EnvColor)
            if (t > 30.0) latitude = NEG_PI; // Safety cap if needed, though t is max 24+6=30.
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
        // multiplier: 8.0x for sun is confirmed in ANSun::Tick (0x86902c: v37 = v17 * 8.0)
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

            // Color Tinging (Dimming)
            // Intensity of 4.0 belongs to the Bloom Pass (Post-Processing), not the Sprite itself.
            // The sprite should use the natural environment color.
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

            // Color Tinging (Dimming)
            (this.moon.material as MeshBasicMaterial).color.setHex(0xffffff);
            (this.moon.material as MeshBasicMaterial).opacity = 1.0;
        } else this.moon.visible = false;
    }

    public render(renderer: WebGLRenderer) {
        if (this.camera) renderer.render(this.celestialScene, this.camera);
    }
}

const tmpColorByte = new ColorByte();
