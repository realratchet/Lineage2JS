import { SectorObject } from "@client/objects/zone-object";
import type { L2Environment } from "@client/rendering/l2-env";
import { Color, Object3D, Vector3 } from "three";
import hsvToRgb from "@client/utils/hsv-to-rgb";
import ColorByte from "@client/utils/color-byte";

// Preallocated vectors to avoid GC
const tmpVec3_1 = new Vector3();
const tmpColorByte_1 = new ColorByte();

// Constants for sun/moon direction calculation (from IDA analysis)
const DEG2RAD = 0.017453292519943295;
const HALF_PI = Math.PI / 2;  // 1.5707963267948966
const NEG_PI = -Math.PI;      // -3.1415927

/**
 * Calculate sun modifier info based on time of day.
 * Extracted from UL2NEnvManager::GetSunModifierInfo
 * @param timeOfDay - Time in hours (0-24)
 * @param baseYawDegrees - Base yaw angle in degrees (from envManager.field_0x170)
 * @returns [pitch, yaw, brightness] in radians
 */
function getSunModifierInfo(timeOfDay: number, baseYawDegrees: number = 180): [number, number, number] {
    const brightness = 0;
    const yaw = baseYawDegrees * DEG2RAD;
    let pitch: number;

    if (timeOfDay >= 5.0 && timeOfDay < 24.0) {
        // Daytime sun arc: ~10° per hour
        pitch = (timeOfDay - 6.0) * 0.17453292519943295 - HALF_PI;
    } else if (timeOfDay >= 1.0 && timeOfDay < 5.0) {
        // Early morning (wraps around midnight)
        pitch = (timeOfDay + 24.0 - 6.0) * 0.17453292519943295 - HALF_PI;
    } else {
        // Midnight - sun is straight down
        pitch = NEG_PI;
    }

    return [pitch, yaw, brightness];
}

/**
 * Calculate moon modifier info based on time of day.
 * Extracted from UL2NEnvManager::GetMoonModifierInfo
 * @param timeOfDay - Time in hours (0-24)
 * @param baseYawDegrees - Base yaw angle in degrees (from envManager.field_0x170)
 * @returns [pitch, yaw, brightness] in radians
 */
function getMoonModifierInfo(timeOfDay: number, baseYawDegrees: number = 180): [number, number, number] {
    const brightness = 0;
    const yaw = baseYawDegrees * DEG2RAD;
    let pitch: number;

    // Moon visible from ~19h to ~7h (nighttime)
    // From IDA: if (time < 7 || time >= 19) then compute pitch, else hidden
    if (timeOfDay >= 7.0 && timeOfDay < 19.0) {
        // Daytime - moon is hidden
        pitch = NEG_PI;
    } else {
        // Nighttime moon arc
        // For evening (19-24), we need to continue the arc from where it left off
        // At 19h: should be rising (negative pitch, below horizon)
        // At midnight: pitch = 0 * 30deg - 90deg = -90deg (horizon)
        // At 7h: pitch = 7 * 30deg - 90deg = 120deg (setting)
        let moonTime = timeOfDay;
        if (timeOfDay >= 19.0) {
            // Continue arc: 19h -> -5, 24h -> 0 (so it connects with midnight)
            moonTime = timeOfDay - 24;
        }
        pitch = moonTime * 0.5235987755982988 - HALF_PI;
    }

    return [pitch, yaw, brightness];
}

/**
 * Convert pitch and yaw angles to a direction vector.
 * Uses the formula from ANMovableSunLight::GetSunLightDirection
 * @param pitch - Pitch angle in radians
 * @param yaw - Yaw angle in radians
 * @param target - Target vector to store result
 * @returns Direction vector
 */
function pitchYawToDirection(pitch: number, yaw: number, target: Vector3): Vector3 {
    // Direction calculation based on spherical coordinates
    // X = cos(pitch) * cos(yaw)
    // Y = cos(pitch) * sin(yaw)  
    // Z = sin(pitch)
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);

    target.set(
        cosPitch * cosYaw,   // X
        cosPitch * sinYaw,   // Y
        sinPitch             // Z
    );

    return target;
}

/**
 * Determine if it's "night" based on EnvNight logic.
 * EnvNight == 3 means night in the game.
 * @param timeOfDay - Time in hours (0-24)
 * @returns true if nighttime (moon should be used)
 */
function isNightTime(timeOfDay: number): boolean {
    // Night is roughly 7pm to 7am based on the moon modifier logic
    return timeOfDay < 7.0 || timeOfDay >= 23.0;
}

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

    public toColor(target: ColorByte = new ColorByte()): ColorByte {
        const [r, g, b] = hsvToRgb(this.hue, this.saturation, 255);
        return target.set(r, g, b);
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
    private flickerTime?: number;
    private flickerIntensity = 0;

    // Track last computed color for change detection
    private lastComputedColor: ColorByte | null = null;
    private lastComputedDirection: Vector3 | null = null;
    private lastEnvVersion: number = -1; // Track environment version for forced updates

    // Render state properties (Mirrors FDynamicLight)
    public alpha: number = 1;
    public color: ColorByte = new ColorByte(255, 255, 255);
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

        // Sunlight method actors have dynamic direction based on time of day
        this.isTimeBased = props.isSunlightColor ||
            props.lightMethod === "Sunlight" ||
            this.lightType === LT_PULSE ||
            this.lightType === LT_BLINK ||
            this.lightType === LT_FLICKER ||
            this.lightType === LT_STROBE ||
            this.lightType === LT_SUBTLE_PULSE ||
            this.lightType === LT_TEXTURE_PALETTE_LOOP;
    }

    public update(envManager: L2Environment, levelBrightness: number) {
        const timeSeconds = envManager.getTimeSeconds();

        // if (this.name === "Light104")
        //     debugger;

        // Use preallocated vector for baseColor calculation
        const baseColor = tmpColorByte_1;
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
            // re-roll at ~12hz - a fresh random every frame flags needsUpdate every
            // frame, which relights every affected vertex-lit actor per frame
            const now = performance.now();

            if (this.flickerTime === undefined || now - this.flickerTime >= 83) {
                this.flickerTime = now;
                const rand = Math.random();
                this.flickerIntensity = rand < 0.5 ? 0.0 : rand;
            }

            intensity = this.flickerIntensity;
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
            intensity = 0.95 + 0.05 * Math.sin(angle);
        else if (this.lightType === LT_TEXTURE_PALETTE_LOOP) {
            this.isDynamicLight = true;
        }

        // Copy base color first, then apply modifiers
        this.color.copy(baseColor);

        if (brightness !== 255) this.color.multiplyByte(brightness);

        this.color.multiplyScalar(Math.min(1, Math.max(0, intensity * levelBrightness)));


        if (this.lightEffect === LE_SUNLIGHT) {
            // Dynamic sun/moon direction based on time of day
            const timeOfDay = envManager.getTimeOfDay();

            // Determine if we should use sun or moon modifier
            // For Sunlight actors, use sun during day and moon during night
            let pitch: number, yaw: number;
            if (this.lightMethod === "Sunlight") {
                if (isNightTime(timeOfDay)) {
                    [pitch, yaw] = getMoonModifierInfo(timeOfDay);
                } else {
                    [pitch, yaw] = getSunModifierInfo(timeOfDay);
                }
                pitchYawToDirection(pitch, yaw, this.lightDirection);
            } else {
                // For regular lights with LE_Sunlight effect, use static quaternion
                tmpVec3_1.set(1, 0, 0).applyQuaternion(this.quaternion);
                this.lightDirection.copy(tmpVec3_1);
            }

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
        const currentEnvVersion = envManager.getEnvVersion();
        const envChanged = this.lastEnvVersion !== currentEnvVersion;

        if (envChanged) {
            this.lastEnvVersion = currentEnvVersion;
        }

        if (this.isDynamic) {
            // Dynamic lights can move/change properties, always need updates
            this.needsUpdate = true;
        } else {
            // Static lights: check if time-based animation changed the color or direction
            // Also force update if environment changed (Normal/Dusk/Dawn switch)
            if (this.isTimeBased || envChanged) {
                // Compare computed color and direction with last frame
                if (this.lastComputedColor === null || this.lastComputedDirection === null || envChanged) {
                    // First update or environment changed
                    this.needsUpdate = true;
                    this.lastComputedColor = this.color.clone();
                    this.lastComputedDirection = this.lightDirection.clone();
                } else {
                    // Check if color or direction changed
                    const colorChanged = !this.color.equals(this.lastComputedColor);
                    const directionChanged = !this.lightDirection.equals(this.lastComputedDirection);
                    this.needsUpdate = colorChanged || directionChanged;

                    if (colorChanged) {
                        this.lastComputedColor.copy(this.color);
                    }
                    if (directionChanged) {
                        this.lastComputedDirection.copy(this.lightDirection);
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
            // LE_SUNLIGHT: Directional light using dot(Normal, LightDir)
            // Verified from IDA: positive dot means facing towards light
            const dot = direction.dot(sampleNormal);
            if (dot > 0)
                return dot * 2;  // SUNLIGHT_ATTENUATION_CONSTANT = 2
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
export { DynamicLight, ColorHSV, getSunModifierInfo, getMoonModifierInfo, pitchYawToDirection };
