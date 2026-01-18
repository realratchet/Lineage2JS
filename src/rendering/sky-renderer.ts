import { Scene, PerspectiveCamera, Vector3, WebGLRenderer, Sprite, SpriteMaterial, Texture, Color, AdditiveBlending } from "three";
import L2Environment from "./l2-env";
import { ColorByte } from "@client/utils/color-byte";

const tmpColor = new ColorByte();
const tmpColor2 = new ColorByte();

export default class SkyRenderer {
    private scene: Scene;
    private camera: PerspectiveCamera;

    // Celestials
    private sunResults: { sprite: Sprite, data: any }[] = [];
    private moonResults: { sprite: Sprite, data: any }[] = [];

    // Settings
    private skyZoneLocation: Vector3 | null = null;

    constructor() {
        this.scene = new Scene();
        this.camera = new PerspectiveCamera();
        // We handle camera updates manually
        this.scene.autoUpdate = false;
    }

    public init(celestialsData: any[], textureGetter: (uuid: string) => Promise<Texture> | Texture | null) {
        this.scene.clear();
        this.sunResults = [];
        this.moonResults = [];

        celestialsData.forEach(cel => {
            if (!cel.sprites || cel.sprites.length === 0) return;

            // For now, take the first sprite. TODO: Handle animations/multiple sprites
            const spriteData = cel.sprites[0];
            const uuid = typeof spriteData === 'string' ? spriteData : spriteData.uuid || spriteData.material;

            const mat = new SpriteMaterial({
                transparent: true,
                blending: AdditiveBlending,
                depthWrite: false,
                depthTest: false
            });

            const tex = textureGetter(uuid);
            if (tex instanceof Promise) {
                tex.then(t => { mat.map = t; mat.needsUpdate = true; });
            } else if (tex) {
                mat.map = tex;
            }

            const sprite = new Sprite(mat);
            this.scene.add(sprite);

            const result = { sprite, data: cel };
            if (cel.type === "Sun") this.sunResults.push(result);
            else if (cel.type === "Moon") this.moonResults.push(result);
        });
    }

    /**
     * Initialize from pre-decoded sector celestials (textures already loaded)
     * @param celestials Array of { type, sprite (texture), data }
     */
    public initFromSector(celestials: { type: string; sprite: any; data: any }[]) {
        console.log(`[SkyRenderer] initFromSector called with ${celestials.length} celestials`);
        this.scene.clear();
        this.sunResults = [];
        this.moonResults = [];

        celestials.forEach(cel => {
            console.log(`[SkyRenderer] Adding celestial: type=${cel.type}, hasSprite=${!!cel.sprite}, lat=${cel.data?.lat}, lon=${cel.data?.lon}, radius=${cel.data?.radius}, drawScale=${cel.data?.drawScale}, celestialScale=${cel.data?.celestialScale}, position=${JSON.stringify(cel.data?.position)}`);
            const mat = new SpriteMaterial({
                transparent: true,
                blending: AdditiveBlending,
                depthWrite: false,
                depthTest: false
            });

            if (cel.sprite) {
                mat.map = cel.sprite;
            }

            const sprite = new Sprite(mat);
            this.scene.add(sprite);

            const result = { sprite, data: cel.data };
            if (cel.type === "Sun") this.sunResults.push(result);
            else if (cel.type === "Moon") this.moonResults.push(result);
        });

        console.log(`[SkyRenderer] Initialized: suns=${this.sunResults.length}, moons=${this.moonResults.length}`);
    }

    private _debugLogged = false;
    public update(mainCamera: PerspectiveCamera, env: L2Environment, skyZoneDetails: any) {
        // 1. Sync Camera Properties (Rotation, FOV, Aspect)
        // We do NOT copy the main camera to avoid inheriting position or incompatible near/far planes.
        this.camera.quaternion.copy(mainCamera.quaternion);
        this.camera.fov = mainCamera.fov;
        this.camera.aspect = mainCamera.aspect;
        this.camera.near = 10;   // Ensure near plane is close enough
        this.camera.far = 20000; // Ensure far plane covers celestial distance (4000)
        this.camera.updateProjectionMatrix();

        // SkyZone location handling (if we ever render geometry that needs it)
        // For infinite celestials, (0,0,0) is fine.
        if (skyZoneDetails && skyZoneDetails.location) {
            const { location } = skyZoneDetails;
            this.camera.position.set(location[0], location[1], location[2]);
        } else {
            this.camera.position.set(0, 0, 0);
        }

        this.camera.updateMatrixWorld();

        // 2. Position Celestials using decoded data
        const time = env.getTimeOfDay();

        // Debug log once to confirm new camera setup
        if (!this._debugLogged) {
            console.log(`[SkyRenderer] update time=${time}, cameraPos=${this.camera.position.toArray()}, mainCamPos=${mainCamera.position.toArray()}`);
            this._debugLogged = true;
        }

        // Position all celestials using their decoded data and environment scale
        const positionCelestial = (res: { sprite: Sprite, data: any }, isSun: boolean, offsetHours: number = 0) => {
            const data = res.data;
            const distance = data.radius ?? 4000;

            // Get time-based scale from environment (this matches the original game's GetSunScale/GetMoonScale)
            const envScale = isSun ? env.getSunScale() : env.getMoonScale();
            // Multiply by actor's drawScale and the celestialScale property
            // The envScale is a multiplier that varies by time of day (typically 0.5 to 2.0)
            const baseScale = (data.drawScale ?? 1) * (data.celestialScale ?? 1);
            // Scale relative to distance for proper angular size
            const scale = distance * envScale * baseScale * 0.2;

            let direction: Vector3;

            // Check if position is a non-zero vector
            const hasValidPosition = data.position &&
                (data.position[0] !== 0 || data.position[1] !== 0 || data.position[2] !== 0);

            if (hasValidPosition) {
                // Position already in Three.js coordinates from decode
                direction = new Vector3().fromArray(data.position).normalize();
            } else if (data.lat !== undefined && data.lon !== undefined && (data.lat !== 0 || data.lon !== 0)) {
                // Use lat/lon to compute direction (skip if both are 0)
                // lat: -90 to 90 (south to north), lon: 0 to 360 (around horizon)
                const latRad = data.lat * Math.PI / 180;
                const lonRad = data.lon * Math.PI / 180;

                // Convert spherical to cartesian (Y-up, Three.js coords)
                // lat=0 is equator, lat=90 is north pole (up)
                const cosLat = Math.cos(latRad);
                direction = new Vector3(
                    cosLat * Math.sin(lonRad),  // X
                    Math.sin(latRad),            // Y (up)
                    cosLat * Math.cos(lonRad)   // Z
                );
            } else {
                // Fallback: compute from time of day
                const rad = ((time + offsetHours) / 24) * Math.PI * 2;
                direction = new Vector3(
                    0,
                    -Math.cos(rad),  // Y: up at noon, down at midnight
                    Math.sin(rad)    // Z: east at dawn, west at dusk
                );
            }

            // Position sprite relative to camera at specified distance
            res.sprite.position.copy(this.camera.position).addScaledVector(direction, distance);
            res.sprite.scale.set(scale, scale, 1);
            res.sprite.updateMatrix();
        };

        this.sunResults.forEach(res => positionCelestial(res, true, 0));
        this.moonResults.forEach(res => positionCelestial(res, false, 12)); // Moon opposite to sun

        this.scene.updateMatrixWorld();
    }

    private _renderLogged = false;
    public render(renderer: WebGLRenderer) {
        renderer.render(this.scene, this.camera);

        if (!this._renderLogged && this.sunResults.length > 0) {
            const sun = this.sunResults[0].sprite;
            const vector = sun.position.clone().project(this.camera);
            console.log(`[SkyRenderer] Sun Screen Pos: ${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)} (Visible if x,y in [-1,1] and z in [0,1])`);

            if (this.moonResults.length > 0) {
                const moon = this.moonResults[0].sprite;
                const mVector = moon.position.clone().project(this.camera);
                console.log(`[SkyRenderer] Moon Screen Pos: ${mVector.x.toFixed(2)}, ${mVector.y.toFixed(2)}, ${mVector.z.toFixed(2)}`);
            }
            this._renderLogged = true;
        }
    }
}
