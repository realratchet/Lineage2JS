import { Scene, PerspectiveCamera, Vector3, WebGLRenderer, Mesh, MeshBasicMaterial, PlaneGeometry, Texture, Color, AdditiveBlending, NormalBlending, DoubleSide, CustomBlending, OneFactor, OneMinusSrcColorFactor } from "three";
import L2Environment from "./l2-env";
import { ColorByte } from "@client/utils/color-byte";

// Constants from Analysis (CELESTIAL_POSITIONING_COMPLETE.md)
const DEG2RAD = Math.PI / 180;
const HALF_PI = Math.PI / 2;
const NEG_PI = -Math.PI;
const X_ROTATION_ANGLE = 30 * DEG2RAD;
const PI = Math.PI;

const MATERIAL_U_SIZE = 32; // Used for scaling instead of texture size

const TMP_VEC3 = new Vector3();

export default class SkyRenderer {
    private celestialScene = new Scene();
    private sun: Mesh;
    private moon: Mesh;
    private camera: PerspectiveCamera | null = null;

    private sunData: any = null;
    private moonData: any = null;

    constructor() {
        const geometry = new PlaneGeometry(1, 1);

        // Sun Material
        const sunMat = new MeshBasicMaterial({
            transparent: true,
            blending: CustomBlending,
            blendSrc: OneFactor,
            blendDst: OneMinusSrcColorFactor,
            depthWrite: false,
            depthTest: false,
            side: DoubleSide
        });
        this.sun = new Mesh(geometry, sunMat);
        this.sun.visible = false;
        this.sun.frustumCulled = false;

        // Moon Material
        const moonMat = new MeshBasicMaterial({
            transparent: true,
            blending: CustomBlending,
            blendSrc: OneFactor,
            blendDst: OneMinusSrcColorFactor,
            depthWrite: false,
            depthTest: false,
            side: DoubleSide,
            color: 0xffffff // White base color
        });
        this.moon = new Mesh(geometry, moonMat);
        this.moon.visible = false;
        this.moon.frustumCulled = false;

        this.celestialScene.add(this.sun);
        this.celestialScene.add(this.moon);
    }

    public initFromSector(celestials: any[]) {
        if (!celestials) return;

        celestials.forEach(celestial => {
            if (celestial.type === "Sun") {
                this.sunData = celestial.data;
                if (celestial.sprite) {
                    const tex = celestial.sprite;
                    tex.flipY = true;
                    tex.needsUpdate = true;
                    (this.sun.material as MeshBasicMaterial).map = tex;
                    (this.sun.material as MeshBasicMaterial).needsUpdate = true;
                }
            } else if (celestial.type === "Moon") {
                this.moonData = celestial.data;
                if (celestial.sprite) {
                    const tex = celestial.sprite;
                    tex.flipY = true;
                    tex.needsUpdate = true;
                    (this.moon.material as MeshBasicMaterial).map = tex;
                    (this.moon.material as MeshBasicMaterial).needsUpdate = true;
                }
            }
        });
    }

    public update(camera: PerspectiveCamera, env: L2Environment, skyZone: any) {
        this.camera = camera;
        const timeOfDay = env.getTimeOfDay();

        this.updateSun(timeOfDay, camera, env);
        this.updateMoon(timeOfDay, camera, env);
    }

    private getCelestialPositioningAngles(
        timeOfDay: number,
        celestialType: "sun" | "moon"
    ): [number, number] {
        const longitude = PI; // 180 * DEG2RAD

        let latitude: number;
        if (celestialType === "sun") {
            if (timeOfDay >= 5.0 && timeOfDay < 24.0) {
                latitude = (timeOfDay - 6.0) * (10 * DEG2RAD) - HALF_PI;
            } else if (timeOfDay >= 1.0 && timeOfDay < 5.0) {
                latitude = (timeOfDay + 24.0 - 6.0) * (10 * DEG2RAD) - HALF_PI;
            } else {
                latitude = NEG_PI;
            }
        } else { // moon
            if (timeOfDay < 7.0 || timeOfDay >= 23.0) {
                let moonTime = timeOfDay;
                if (timeOfDay >= 23.0) {
                    moonTime = timeOfDay - 24.0;
                }
                // 0.5235987755982988 is PI/6 (30 degrees)
                latitude = moonTime * 0.5235987755982988 - HALF_PI;
            } else {
                latitude = NEG_PI;
            }
        }

        return [latitude, longitude];
    }

    private calculateCelestialOffset(
        timeOfDay: number,
        celestialType: "sun" | "moon",
        radius: number
    ): Vector3 {
        const [lat, lon] = this.getCelestialPositioningAngles(timeOfDay, celestialType);

        if (lat === NEG_PI) return new Vector3(0, 0, 0);

        // Step 1: Spherical to Cartesian (UE2 coords: Z-up)
        // x = r * sin(lat) * cos(lon)
        // y = r * sin(lat) * sin(lon)
        // z = r * cos(lat)
        const x = radius * Math.sin(lat) * Math.cos(lon);
        const y = radius * Math.sin(lat) * Math.sin(lon);
        const z = radius * Math.cos(lat);

        const spherical = TMP_VEC3.set(x, y, z);

        // Step 2: Rotate around X-axis (UE2 coords)
        // Angle: 30 degrees (PI/6)
        spherical.applyAxisAngle(new Vector3(1, 0, 0), X_ROTATION_ANGLE);

        // Step 3: Convert to Three.js coordinates
        // Mapping UE (x, y, z) -> Three (x, z, y)  (Swapping Y and Z, no neagtion)
        return new Vector3(spherical.x, spherical.z, spherical.y);
    }

    private calculateCelestialScale(
        celestialType: "sun" | "moon",
        baseScale: number,     // actor.celestialScale
        actorDrawScale: number, // actor.drawScale
        env: L2Environment
    ): number {
        const envScale = celestialType === "sun" ? env.getSunScale() : env.getMoonScale();
        const multiplier = celestialType === "sun" ? 8.0 : 1.0;

        // Formula from Analysis: drawScale(final) = envScale * actor->Scale * multiplier * MATERIAL_U_SIZE
        // We want (0.5 * S) = (envScale * baseScale * multiplier * actorDrawScale * MATERIAL_U_SIZE)
        // So S = (...) * 2

        return (envScale * baseScale * multiplier * actorDrawScale * MATERIAL_U_SIZE);
    }

    private updateSun(timeOfDay: number, camera: PerspectiveCamera, env: L2Environment) {
        if (!this.sunData) return;

        const [lat] = this.getCelestialPositioningAngles(timeOfDay, "sun");

        if (lat !== NEG_PI) {
            this.sun.visible = true;

            // Dynamic Radius from actor data
            const radius = this.sunData.radius || 4000;
            const offset = this.calculateCelestialOffset(timeOfDay, "sun", radius);

            this.sun.position.copy(camera.position).add(offset);

            // Scale
            const baseScale = this.sunData.celestialScale ?? 1.0;
            const drawScale = this.sunData.drawScale ?? 1.0;

            const scale = this.calculateCelestialScale("sun", baseScale, drawScale, env);
            this.sun.scale.setScalar(scale);

            this.sun.lookAt(camera.position);

            // Optional: Log scale debug once
            if (!this.sun.userData.logged) {
                console.log(`[SkyRenderer] Sun Scale Init: ${scale} (Env:${env.getSunScale()} Base:${baseScale} Draw:${drawScale} Tex:${MATERIAL_U_SIZE})`);
                this.sun.userData.logged = true;
            }

        } else {
            this.sun.visible = false;
        }
    }

    private updateMoon(timeOfDay: number, camera: PerspectiveCamera, env: L2Environment) {
        if (!this.moonData) return;

        const [lat] = this.getCelestialPositioningAngles(timeOfDay, "moon");

        if (lat !== NEG_PI) {
            this.moon.visible = true;

            const radius = this.moonData.radius || 4000;
            const offset = this.calculateCelestialOffset(timeOfDay, "moon", radius);

            this.moon.position.copy(camera.position).add(offset);

            // Scale
            const baseScale = this.moonData.celestialScale ?? 1.0;
            const drawScale = this.moonData.drawScale ?? 1.0;

            const scale = this.calculateCelestialScale("moon", baseScale, drawScale, env);
            this.moon.scale.setScalar(scale);

            this.moon.lookAt(camera.position);

            // Log debug
            if (!this.moon.userData.logged) {
                console.log(`[SkyRenderer] Moon Scale Init: ${scale}`);
                this.moon.userData.logged = true;
            }

        } else {
            this.moon.visible = false;
        }
    }

    public render(renderer: WebGLRenderer) {
        if (this.camera) {
            renderer.render(this.celestialScene, this.camera);
        }
    }
}
