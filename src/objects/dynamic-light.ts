import { SectorObject } from "./zone-object";
import type { L2Environment } from "../rendering/l2-env";
import { Color, Object3D, Vector3 } from "three";
import hsvToRgb from "@l2js/engine/utils/hsv-to-rgb";
import ColorByte from "../utils/color-byte";

const tmpVec3_1 = new Vector3();
const tmpColorByte_1 = new ColorByte();

// ~0.1 degree of rotation on a unit direction vector, squared
const DIRECTION_CHANGE_EPSILON_SQ = 3e-6;

const DEG2RAD = 0.017453292519943295;
const HALF_PI = Math.PI / 2;  // 1.5707963267948966
const NEG_PI = -Math.PI;      // -3.1415927

// UL2NEnvManager::GetSunModifierInfo (0x7b74a0), baseYawDegrees comes from envManager.field_0x170, returns [polar, yaw, brightness] in radians
function getSunModifierInfo(timeOfDay: number, baseYawDegrees: number = 180): [number, number, number] {
    const brightness = 0;
    const yaw = baseYawDegrees * DEG2RAD;
    let pitch: number;

    if (timeOfDay >= 5.0 && timeOfDay < 24.0) {
        pitch = (timeOfDay - 6.0) * 0.17453292519943295 - HALF_PI;
    } else if (timeOfDay >= 1.0 && timeOfDay < 5.0) {
        pitch = (timeOfDay + 24.0 - 6.0) * 0.17453292519943295 - HALF_PI;
    } else {
        pitch = NEG_PI;
    }

    return [pitch, yaw, brightness];
}

// UL2NEnvManager::GetMoonModifierInfo (0x7b7570), baseYawDegrees comes from envManager.field_0x170, returns [polar, yaw, brightness] in radians
function getMoonModifierInfo(timeOfDay: number, baseYawDegrees: number = 180): [number, number, number] {
    const brightness = 0;
    const yaw = baseYawDegrees * DEG2RAD;
    let polar: number;

    if (timeOfDay >= 7.0 && timeOfDay < 23.0)
        polar = NEG_PI;
    else
        polar = timeOfDay * 0.5235987755982988 - HALF_PI;

    return [polar, yaw, brightness];
}

const SUN_TILT = 30 * DEG2RAD; // ANMovableSunLight::Tick 0x869af0 applies envManager+0x174 about X.

function sunModifierToDirection(polar: number, yaw: number, target: Vector3): Vector3 {
    const sinPolar = Math.sin(polar);
    const x = sinPolar * Math.cos(yaw);
    const y = sinPolar * Math.sin(yaw);
    const z = Math.cos(polar);

    const cosTilt = Math.cos(SUN_TILT);
    const sinTilt = Math.sin(SUN_TILT);

    return target.set(-x, -(y * cosTilt - z * sinTilt), -(y * sinTilt + z * cosTilt));
}

function isNightTime(timeOfDay: number): boolean {
    return timeOfDay < 7.0 || timeOfDay >= 23.0;
}

const LT_STEADY = 1;
const LT_PULSE = 2;
const LT_BLINK = 3;
const LT_FLICKER = 4;
const LT_STROBE = 5;
const LT_SUBTLE_PULSE = 7;
const LT_TEXTURE_PALETTE_LOOP = 9;

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

type DynamicLightConstructor_T = {
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
    public readonly isSunlight: boolean;
    public isTimeBased: boolean = false;
    public needsUpdate: boolean = true;

    protected strobeState: { lastUpdateTime: number, toggle: number } | null = null;
    protected flickerTime?: number;
    protected flickerIntensity = 0;

    protected lastComputedColor: ColorByte | null = null;
    protected lastComputedDirection: Vector3 | null = null;
    protected lastEnvVersion: number = -1;

    public alpha: number = 1;
    public color: ColorByte = new ColorByte(255, 255, 255);
    public lightDirection: Vector3 = new Vector3(0, 0, 0);
    public lightPosition: Vector3 = new Vector3(0, 0, 0);
    public lightRadius: number = 0;
    public isDynamicLight: boolean = false;


    public constructor(props: DynamicLightConstructor_T) {
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
        this.phase = props.phase;
        this.isSunlight = props.lightEffect === LE_SUNLIGHT;

        this.isTimeBased = props.isSunlightColor || props.lightMethod === "Sunlight";
    }

    public update(envManager: L2Environment, levelBrightness: number) {
        const timeSeconds = performance.now() / 1000;

        // if (this.name === "Light104")
        //     debugger;

        const baseColor = tmpColorByte_1;
        let brightness: number;

        if (this.isSunlightColor) {
            envManager.getBaseColorPlaneStaticMeshSunLight(baseColor);
            brightness = envManager.getBrightnessStaticMeshSunLight() || 0;
        } else {
            this.colorHSV.toColor(baseColor);
            brightness = this.colorHSV.value;
        }

        let intensity: number = 0.0;
        const timeVal = (timeSeconds * 35 * 65536) / Math.max(Math.floor(this.period), 1) + (this.phase << 8);

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
            // FDynamicLight::Update, UnRenderLight.cpp line 70: Intensity = 0.9f + 0.09f * GMath.SinTab(...)
            intensity = 0.9 + 0.09 * Math.sin(angle);
        else if (this.lightType === LT_TEXTURE_PALETTE_LOOP) {
            this.isDynamicLight = true;
        }

        this.color.copy(baseColor);

        if (brightness !== 255) this.color.multiplyByte(brightness);

        this.color.multiplyScalar(Math.min(1, Math.max(0, intensity * levelBrightness)));


        if (this.lightEffect === LE_SUNLIGHT) {
            const timeOfDay = envManager.getTimeOfDay();

            let pitch: number, yaw: number;
            if (this.lightMethod === "Sunlight") {
                if (isNightTime(timeOfDay)) {
                    [pitch, yaw] = getMoonModifierInfo(timeOfDay);
                } else {
                    [pitch, yaw] = getSunModifierInfo(timeOfDay);
                }
                sunModifierToDirection(pitch, yaw, this.lightDirection);
            } else {
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

        const currentEnvVersion = envManager.getEnvVersion();
        const envChanged = this.lastEnvVersion !== currentEnvVersion;

        if (envChanged) {
            this.lastEnvVersion = currentEnvVersion;
        }

        if (this.isDynamic) {
            this.needsUpdate = true;
        } else {
            if (this.isTimeBased || envChanged) {
                if (this.lastComputedColor === null || this.lastComputedDirection === null || envChanged) {
                    this.needsUpdate = true;
                    this.lastComputedColor = this.color.clone();
                    this.lastComputedDirection = this.lightDirection.clone();
                } else {
                    const colorChanged = !this.color.equals(this.lastComputedColor);
                    const directionChanged = this.lightDirection.distanceToSquared(this.lastComputedDirection) > DIRECTION_CHANGE_EPSILON_SQ;
                    this.needsUpdate = colorChanged || directionChanged;

                    if (colorChanged) {
                        this.lastComputedColor.copy(this.color);
                    }
                    if (directionChanged) {
                        this.lastComputedDirection.copy(this.lightDirection);
                    }
                }
            } else {
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

    // CalcSortKey, UnRenderVisibility.cpp line 397
    public getSortKey(samplePosition: Vector3, sampleRadius: number): number {
        if (this.lightEffect === LE_SUNLIGHT) return Number.MAX_SAFE_INTEGER;

        const reach = this.lightRadius + sampleRadius;
        const distanceSquared = this.lightPosition.distanceToSquared(samplePosition);

        if (this.lightEffect === LE_SPOTLIGHT || this.lightEffect === LE_STATIC_SPOT) {
            const spotDot = tmpVec3_1.subVectors(samplePosition, this.lightPosition).normalize().dot(this.lightDirection);
            const cone = 1 - this.cone / 256;

            if (spotDot <= 0 || spotDot <= cone * cone) return 0;
        }

        return Math.round((1 - distanceSquared / (reach * reach)) * this.colorHSV.value * 1024);
    }

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
            // SampleIntensity 0x903da8 returns N·Direction * -2 below zero.
            const dot = -direction.dot(sampleNormal);
            if (dot > 0)
                return dot * 2;
            else return 0;
        } else if (this.lightEffect === LE_CYLINDER) {
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
export { DynamicLight, ColorHSV, getSunModifierInfo, getMoonModifierInfo, sunModifierToDirection };
