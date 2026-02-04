import { Scene, PerspectiveCamera, Vector3, WebGLRenderer, Mesh, MeshBasicMaterial, PlaneGeometry, Texture, Color, DoubleSide, CustomBlending, OneFactor, OneMinusSrcColorFactor, SphereGeometry, BackSide, BufferAttribute, BufferGeometry } from "three";
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
const SKY_DOME_RADIUS = 20000;
const CLOUD_LAYER_RADIUS = 18000;

const TMP_VEC3 = new Vector3();


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
    private skyLevel: SectorObject;
    private envInfo: EnvInfo;

    private celestialScene = new Scene();
    private sun: Celestial = new Celestial();
    private moon: Celestial = new Celestial();
    private camera: PerspectiveCamera | null = null;

    private sunData: any = null;

    public moons: { data: any, texture: Texture | null }[] = [];
    public activeMoonIndex: number = 0;
    public moonMultiplier: number = 1.0;

    public constructor() {
        this.celestialScene.add(this.sun);
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

    public initSkyLevel(envInfo: EnvInfo, skyLevel: SectorObject) {
        this.envInfo = envInfo;
        this.skyLevel = skyLevel;

        if (!skyLevel || !skyLevel.celestials)
            debugger;

        const celestials = skyLevel.celestials;

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

        const { skybox, hazering, clouds } = envInfo.setup;
        // skybox: ColorModifier_SkybackgroundColor_{UUID}
        // hazering: ColorModifier_HazeRing_Final_{UUID}
        // clouds:
        //      - ColorModifier_Cloud_Final_{UUID}
        //      - ColorModifier_StarField_Final01_{UUID}
        //      - ColorModifier_StarField_Final02_{UUID}

        const bspSections = skyLevel.getObjectByName("BSP_Sections");
        /**
         * children:
         *      BSPSection_ColorModifier_SkybackgroundColor_{UUID}/4194304/-1/true
         *      BSPSection_ColorModifier_HazeRing_Final_{UUID}/4194304/-1/true
         *      BSPSection_ColorModifier_HazeRing_Final_{UUID}/4194560/-1/true
         *      BSPSection_ColorModifier_Cloud_Final_{UUID}1/4194560/-1/true
         *      BSPSection_ColorModifier_StarField_Final01_{UUID}/4194560/-1/true
         *      BSPSection_ColorModifier_StarField_Final02_{UUID}/4194560/-1/true
         */

        // debugger;
    }

    public update(camera: PerspectiveCamera, env: L2Environment, skyColor: ColorByte, hazeColor: ColorByte, hazeColors: ColorByte[], cloudColor: ColorByte, sector: any) {
        this.camera = camera;
        const timeOfDay = env.getTimeOfDay();

        // Update Celestials
        this.updateSun(timeOfDay, camera, env);
        this.updateMoon(timeOfDay, camera, env);
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
