import { SectorObject } from "@client/objects/zone-object";
import type { L2Environment } from "@client/rendering/l2-env";
import { Color, Object3D, Vector3 } from "three";
import hsvToRgb from "@client/utils/hsv-to-rgb";

// Preallocated vectors to avoid GC
const tmpVec3_1 = new Vector3();
const tmpColor_1 = new Color();

// Constants defining LightType
const LT_STEADY = 1;
const LT_PULSE = 2;
const LT_BLINK = 3;
const LT_FLICKER = 4;
const LT_STROBE = 5;
const LT_SUBTLE_PULSE = 7;
const LT_TEXTURE_PALETTE_LOOP = 9;

// Constants defining LightEffect
const LE_STATIC_SPOT = 8;
const LE_SPOTLIGHT = 12;
const LE_NON_INCIDENCE = 13;
const LE_CYLINDER = 17;
const LE_SUNLIGHT = 19;
const LE_QUADRATIC_NON_INCIDENCE = 20;

class ColorHSV {
    public readonly hue: number;
    public readonly saturation: number;
    public readonly value: number;

    public constructor(hue: number, saturation: number, value: number) {
        this.hue = hue;
        this.saturation = saturation;
        this.value = value;
    }

    public toColor(target: Color = new Color()): Color {
        const [r, g, b] = hsvToRgb(this.hue, this.saturation, 255);
        return target.setRGB(r, g, b);
    }
}

interface IDynamicLightConstructor {
    lightMethod: "Light" | "Sunlight";
    isDynamic: boolean;
    colorHSV: ColorHSV;
    cone: number;
    isDirectional: boolean;
    lightEffect: number;
    lightType: number;
    radius: number;
    isSunlightColor: boolean;
    period: number;
    phase: number;
};

class DynamicLight extends Object3D {
    public readonly lightMethod: "Light" | "Sunlight";
    public readonly isDynamic: boolean;
    public readonly colorHSV: ColorHSV;
    public readonly cone: number;
    public readonly isDirectional: boolean;
    public readonly lightEffect: number;
    public readonly lightType: number;
    public readonly radius: number;
    public readonly isSunlightColor: boolean;
    public readonly period: number;
    public readonly phase: number;
    public isTimeBased: boolean = false;
    public needsUpdate: boolean = true;

    // Internal state for LT_STROBE
    private strobeState: { lastUpdateTime: number, toggle: number } | null = null;

    // Track last computed color for change detection
    private lastComputedColor: Color | null = null;

    // Render state properties (Mirrors FDynamicLight)
    public alpha: number = 1;
    public color: Color = new Color(1, 1, 1);
    public lightDirection: Vector3 = new Vector3(0, 0, 0);
    public lightPosition: Vector3 = new Vector3(0, 0, 0);
    public lightRadius: number = 0;
    public isDynamicLight: boolean = false;


    public constructor(props: IDynamicLightConstructor) {
        super();

        this.lightMethod = props.lightMethod;
        this.isDynamic = props.isDynamic;
        this.colorHSV = props.colorHSV;
        this.cone = props.cone;
        this.isDirectional = props.isDirectional;
        this.lightEffect = props.lightEffect;
        this.lightType = props.lightType;
        this.radius = props.radius;
        this.isSunlightColor = props.isSunlightColor;
        this.period = props.period;
        this.phase = props.phase; // Retained props.phase as 'actor' is undefined in this scope

        this.isTimeBased = props.isSunlightColor ||
            this.lightType === LT_PULSE ||
            this.lightType === LT_BLINK ||
            this.lightType === LT_FLICKER ||
            this.lightType === LT_STROBE ||
            this.lightType === LT_SUBTLE_PULSE ||
            this.lightType === LT_TEXTURE_PALETTE_LOOP;
    }

    public update(envManager: L2Environment, levelBrightness: number) {
        const timeSeconds = envManager.getTimeSeconds();

        // Use preallocated vector for baseColor calculation
        const baseColor = tmpColor_1;
        let brightness: number;

        if (this.isSunlightColor) {
            // Updated L2Environment.getBaseColorPlaneStaticMeshSunLight to accept target
            envManager.getBaseColorPlaneStaticMeshSunLight(baseColor);
            brightness = envManager.getBrightnessStaticMeshSunLight() || 0;
        } else {
            this.colorHSV.toColor(baseColor);
            brightness = this.colorHSV.value;
        }

        let intensity: number = 0.0;
        const timeVal = (timeSeconds * 35 * 65536) / Math.max(Math.floor(this.period), 1) + (this.phase << 8);

        // Approximation of unreal GMath sin logic using standard Math.sin
        // Mapping typical 0-65536 range to radians
        const angle = (Math.floor(timeVal) & 0xFFFF) / 65536.0 * Math.PI * 2;

        if (this.lightType === LT_STEADY)
            intensity = 1.0;
        else if (this.lightType === LT_PULSE)
            intensity = 0.6 + 0.39 * Math.sin(angle);
        else if (this.lightType === LT_BLINK) {
            if ((Math.floor((timeSeconds * 35 * 65536) / (this.period + 1) + (this.phase << 8))) & 1)
                intensity = 0.0;
            else
                intensity = 1.0;
        }
        else if (this.lightType === LT_FLICKER) {
            const rand = Math.random();
            if (rand < 0.5)
                intensity = 0.0;
            else
                intensity = rand;
        }
        else if (this.lightType === LT_STROBE) {
            if (!this.strobeState) {
                this.strobeState = { lastUpdateTime: timeSeconds, toggle: 0 };
            }

            if (this.strobeState.lastUpdateTime !== timeSeconds) {
                this.strobeState.lastUpdateTime = timeSeconds;
                this.strobeState.toggle ^= 1;
            }

            if (this.strobeState.toggle) intensity = 0.0;
            else intensity = 1.0;
        }
        else if (this.lightType === LT_SUBTLE_PULSE)
            intensity = 0.9 + 0.09 * Math.sin(angle);
        else if (this.lightType === LT_TEXTURE_PALETTE_LOOP) {
            this.isDynamicLight = true;
        }

        // Apply to this.color (reusing this.color instance)
        // Note: Color uses multiplyScalar for RGB scaling
        this.color.copy(baseColor).multiplyScalar((brightness / 255) * intensity * levelBrightness);


        if (this.lightEffect === LE_SUNLIGHT) {
            // Use tmpVec3_1 for direction calculation
            tmpVec3_1.set(1, 0, 0).applyQuaternion(this.quaternion);
            this.lightDirection.copy(tmpVec3_1);

            this.lightPosition.set(0, 0, 0);
            this.lightRadius = 0;
        } else if (this.lightEffect === LE_SPOTLIGHT || this.lightEffect === LE_STATIC_SPOT) {
            this.lightPosition.copy(this.position);
            tmpVec3_1.set(1, 0, 0).applyQuaternion(this.quaternion);
            this.lightDirection.copy(tmpVec3_1);

            this.lightRadius = this.worldLightRadius();
        } else {
            this.lightPosition.copy(this.position);
            this.lightRadius = this.worldLightRadius();
        }

        this.alpha = 1.0;
        this.isDynamicLight = this.isDynamic;

        // Change detection: only update lit actors when light actually changes
        if (this.isDynamic) {
            // Dynamic lights can move/change properties, always need updates
            this.needsUpdate = true;
        } else {
            // Static lights: check if time-based animation changed the color
            if (this.isTimeBased) {
                // Compare computed color with last frame
                if (this.lastComputedColor === null) {
                    // First update
                    this.needsUpdate = true;
                    this.lastComputedColor = this.color.clone();
                } else {
                    // Check if color changed
                    const colorChanged = !this.color.equals(this.lastComputedColor);
                    this.needsUpdate = colorChanged;

                    if (colorChanged) {
                        this.lastComputedColor.copy(this.color);
                    }
                }
            } else {
                // LT_STEADY or other non-time-based: only update once
                if (this.lastComputedColor === null) {
                    this.needsUpdate = true;
                    this.lastComputedColor = this.color.clone();
                } else {
                    this.needsUpdate = false;
                }
            }
        }
    }

    public worldLightRadius() { return 25 * (this.radius + 1); }

    public sampleIntensity(samplePosition: Vector3, sampleNormal: Vector3): number {
        const direction = this.lightDirection;
        const position = this.lightPosition;
        const radius = this.lightRadius;

        // direction x=0.15,                 y=0.62,              z=0.77
        //           x= 0.14513852987329018, y=0.617647307937804, z=0.7729467058881897
        // position  x=19376.63,        y=-9499.60,         z=116714.14
        //           x=19376.630859375, y=-9499.599609375,  z=116714.140625

        // const v = new Vector3(17102, -10635, 113765.00061035156);
        //           new Vector3(17102, -10635, 113765.00061035156);
        // const n = new Vector3(0, 1, 0);

        if (this.lightEffect === LE_SUNLIGHT) {
            const dot = direction.dot(sampleNormal);
            if (dot < 0)
                return dot * -2;
            else return 0;
        } else if (this.lightEffect === LE_CYLINDER) {
            // Reuse tmpVec3_1 for lightVector
            const lightVector = tmpVec3_1.subVectors(position, samplePosition);
            const distanceSquared = lightVector.lengthSq();
            const distance = Math.sqrt(distanceSquared);

            if (distance < radius)
                return Math.max(0, 1 - ((lightVector.x ** 2) + (lightVector.y ** 2)) / (radius ** 2)) * 2;
            else return 0;
        } else if (this.lightEffect === LE_NON_INCIDENCE) {
            const lightVector = tmpVec3_1.subVectors(position, samplePosition);
            const distanceSquared = lightVector.lengthSq();
            const distance = Math.sqrt(distanceSquared);

            if (lightVector.dot(sampleNormal) > 0 && distance < radius)
                return Math.sqrt(1.02 - distance / radius) * 2;
            else return 0;
        } else if (this.lightEffect === LE_QUADRATIC_NON_INCIDENCE) {
            const lightVector = tmpVec3_1.subVectors(position, samplePosition);
            const distanceSquared = lightVector.lengthSq();
            const radiusSquared = (radius ** 2);

            if (lightVector.dot(sampleNormal) > 0 && distanceSquared < radiusSquared)
                return (1.02 - distanceSquared / radiusSquared) * 2;
            else return 0;
        } else if (this.lightEffect === LE_SPOTLIGHT || this.lightEffect === LE_STATIC_SPOT) {
            const dx = position.x - samplePosition.x;
            const dy = position.y - samplePosition.y;
            const dz = position.z - samplePosition.z;
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            const distance = Math.sqrt(distanceSquared);
            const baseAttenuation = calculateAttenuation(distance, radius, dx, dy, dz, sampleNormal.x, sampleNormal.y, sampleNormal.z);

            if (baseAttenuation > 0) {
                const sine = 1.0 - this.cone / 256.0;
                const rSine = 1.0 / (1.0 - sine);
                const sineRSine = sine * rSine;
                const sineSq = sine * sine;

                const vDotV = -(dx * direction.x + dy * direction.y + dz * direction.z);

                if (vDotV > 0.0 && (vDotV ** 2) > sineSq * distanceSquared)
                    return Math.pow(vDotV * rSine / distance - sineRSine, 2) * baseAttenuation;
            }

            return 0;
        } else {
            const dx = position.x - samplePosition.x;
            const dy = position.y - samplePosition.y;
            const dz = position.z - samplePosition.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            return calculateAttenuation(distance, radius, dx, dy, dz, sampleNormal.x, sampleNormal.y, sampleNormal.z);
        }
    }
}

function calculateAttenuation(distance: number, radius: number, dx: number, dy: number, dz: number, nx: number, ny: number, nz: number) {
    const dot = dx * nx + dy * ny + dz * nz;
    if (dot > 0 && distance <= radius) {
        const a = distance / radius;
        const b = (2 * a * a * a - 3 * a * a + 1);
        const c = Math.abs(dot / radius);

        return b / a * c * 2;
    }
    return 0;
}

export default DynamicLight;
export { DynamicLight, ColorHSV };
