import { Scene, PerspectiveCamera, Vector3, WebGLRenderer, Sprite, SpriteMaterial, Texture, Color, AdditiveBlending } from "three";
import L2Environment from "./l2-env";
import { ColorByte } from "@client/utils/color-byte";
import { getTexture } from "@client/assets/assets"; // Assuming global texture getter or similar, will rely on passed function

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

    public update(mainCamera: PerspectiveCamera, env: L2Environment, skyZoneDetails: any) {
        // 1. Sync Camera
        this.camera.copy(mainCamera, false);
        // Reset position to origin or skyzone center for rendering sky elements
        // Celestials are "infinite", so position relative to camera matters mainly for rotation
        // But if we render Sky Geometry, we need absolute SkyZone coordinates.
        // For Sprites, we can attach them to camera or place them far away.

        if (skyZoneDetails && skyZoneDetails.location) {
            const { location } = skyZoneDetails;
            // Sky Camera is at SkyZone Location + MainCamera Rotation (usually)
            // But usually SkyZone implies "Look from this point". 
            // If we rotate, we look around that point.
            this.camera.position.set(location[0], location[1], location[2]);
        } else {
            this.camera.position.set(0, 0, 0);
        }

        this.camera.updateMatrixWorld();

        // 2. Position Celestials
        // This is complex math involving game time -> pitch/yaw
        // For this pass, we will place them at a fixed distance based on time
        const time = env.getTimeOfDay();

        // Simple Orbit Logic (Placeholder for full Ephemeris)
        // 0 = Midnight, 6 = Dawn, 12 = Noon, 18 = Dusk
        // Sun should be up 6-18. Moon 18-6.
        // Angle = (Time / 24) * 2 * PI

        const distance = 4000; // Far enough
        const angle = ((time - 6) / 24) * Math.PI * 2; // -PI/2 at 6am (Horizon), 0 at Noon (Zenith), PI/2 at 6pm (Horizon)
        // Wait, standard mapping: 
        // 6AM -> Rising -> East?
        // Let's use simple rotation around X axis for now

        const sy = Math.sin(angle) * distance;
        const sz = Math.cos(angle) * distance;

        this.sunResults.forEach(res => {
            // Sun Position
            res.sprite.position.set(0, sy, sz).applyQuaternion(this.camera.quaternion);
            // Wait, if we apply quaternion, it locks to camera. We want it in World Space relative to SkyCamera.
            // Actually, we want it fixed in Sky Space.
            // If angle implies "Time of Day", it moves in World.
            // So:
            res.sprite.position.set(0, sy, -sz); // Z is up? No Y is Up in ThreeJS? 
            // Unreal: Z is Up. Three: Y is Up.
            // Let's use:
            // Sun rises East (+X?), sets West (-X?)
            // Rotates around Y (Up)? No, rotates around North-South axis?
            // Simple: Just rotate around X axis (East-West path)

            // 0 -> Midnight -> Down (-Y)
            // 6 -> 6AM -> Right (+X)
            // 12 -> Noon -> Up (+Y)
            // 18 -> 6PM -> Left (-X)

            // Angle 0-24
            const rad = (time / 24) * Math.PI * 2;
            const y = -Math.cos(rad) * distance; // Midnight(0) = -1(Down), Noon(12) = 1(Up)
            const x = Math.sin(rad) * distance;  // 6(PI/2) = 1(East), 18(3PI/2) = -1(West)

            // Adjust to SkyCamera
            res.sprite.position.copy(this.camera.position).add(new Vector3(x, y, 0));

            // Updates
            res.sprite.updateMatrix();

            // Scale
            const scale = res.data.sprites[0]?.scale || 500; // Default scale
            res.sprite.scale.set(scale, scale, 1);
        });

        this.moonResults.forEach(res => {
            // Moon opposite to Sun
            const rad = ((time + 12) % 24 / 24) * Math.PI * 2;
            const y = -Math.cos(rad) * distance;
            const x = Math.sin(rad) * distance;

            res.sprite.position.copy(this.camera.position).add(new Vector3(x, y, 0));
            res.sprite.updateMatrix();

            const scale = res.data.sprites[0]?.scale || 500;
            res.sprite.scale.set(scale, scale, 1);
        });

        this.scene.updateMatrixWorld();
    }

    public render(renderer: WebGLRenderer) {
        renderer.render(this.scene, this.camera);
    }
}
