import eU063A from "./native/e-u063-a";
import eU064A from "./native/e-u064-a";
import eU064Cloud from "./native/e-u064-cloud";
import eU065A from "./native/e-u065-a";
import eU066A from "./native/e-u066-a";
import eU067A from "./native/e-u067-a";
import eU067Hand from "./native/e-u067-hand";
import sU010A from "./native/s-u010-a";
import sU005 from "./native/s-u005";
import pU004A from "./native/p-u004-a";
import mU019A from "./native/m-u019-a";
import mU019B from "./native/m-u019-b";
import mU018A from "./native/m-u018-a";
import mU018B from "./native/m-u018-b";
import mU013A from "./native/m-u013-a";
import mU013C from "./native/m-u013-c";
import mU007A from "./native/m-u007-a";
import mU007B from "./native/m-u007-b";
import mU033A from "./native/m-u033-a";
import mU033B from "./native/m-u033-b";
import mU003 from "./native/m-u003";
import mU004 from "./native/m-u004";
import mU000 from "./native/m-u000";
import mU016 from "./native/m-u016";
import mU006 from "./native/m-u006";
import mU022 from "./native/m-u022";
import mU021 from "./native/m-u021";
import mU024 from "./native/m-u024";
import mU026 from "./native/m-u026";
import type { NpcSkillEffectPhase_T } from "@l2js/engine/contracts/pawn";

type NativeSkillEffect_T = {
    phase: NpcSkillEffectPhase_T;
    effectClass: string;
    host: "caster" | "target";
    owner?: "target";
    attach?: "trail" | "rightHand";
    bone?: number;
    isAbsolute?: boolean;
    rotation?: "caster" | "desiredCaster" | "targetPosition" | "targetDirection" | "hit";
    position?: "center" | "lastTarget";
    initialPosition?: "center";
    radiusOffset?: number;
    heightOffset?: number;
    offsetRotation?: "desiredCaster" | "targetDirection";
    relativeTrailOffset?: number;
    lifeSpan?: "shotTime";
    physics?: "none";
    useSkillSpeed?: boolean;
    adjustParticleLife?: boolean | "shotTime";
    scale?: "casterRadius" | "cancelCasterRadius";
    delay?: number;
    hitDelay?: number;
    offset?: [number, number, number];
    pawnLight?: { color: [number, number, number], radius: number, lifeTime?: number, spot?: boolean, target?: "caster", position?: "center", rotation?: "hit", radiusOffset?: number };
    trailerPrePivot?: "casterMeshOrigin";
    projectile?: { target: "caster" | "target", speed?: number, acceleration?: number, path?: [number, number, number][] };
};

const nativeEffects: Record<string, NativeSkillEffect_T[]> = {
    "lineageeffect.e_u063_a": eU063A,
    "lineageeffect.e_u064_a": eU064A,
    "lineageeffect.e_u064_cloud": eU064Cloud,
    "lineageeffect.e_u065_a": eU065A,
    "lineageeffect.e_u066_a": eU066A,
    "lineageeffect.e_u067_a": eU067A,
    "lineageeffect.e_u067_hand": eU067Hand,
    "lineageeffect.s_u010_a": sU010A,
    "lineageeffect.s_u005_a": sU005.filter(effect => effect.effectClass === "LineageEffect.s_u005_a"),
    "lineageeffect.s_u005_b": sU005.filter(effect => effect.effectClass === "LineageEffect.s_u005_b"),
    "lineageeffect.p_u004_a": pU004A,
    "lineageeffect.m_u019_a": mU019A,
    "lineageeffect.m_u019_b": mU019B,
    "lineageeffect.m_u018_a": mU018A,
    "lineageeffect.m_u018_b": mU018B,
    "lineageeffect.m_u013_a": mU013A,
    "lineageeffect.m_u013_c": mU013C,
    "lineageeffect.m_u007_a": mU007A,
    "lineageeffect.m_u007_b": mU007B,
    "lineageeffect.m_u033_a": mU033A,
    "lineageeffect.m_u033_b": mU033B,
    "lineageeffect.m_u003_a": mU003.filter(effect => effect.effectClass === "LineageEffect.m_u003_a"),
    "lineageeffect.m_u003_b": mU003.filter(effect => effect.effectClass === "LineageEffect.m_u003_b"),
    "lineageeffect.m_u003_c": mU003.filter(effect => effect.effectClass === "LineageEffect.m_u003_c"),
    "lineageeffect.m_u004_a": mU004.filter(effect => effect.effectClass === "LineageEffect.m_u004_a"),
    "lineageeffect.m_u004_b": mU004.filter(effect => effect.effectClass === "LineageEffect.m_u004_b"),
    "lineageeffect.m_u000_a": mU000.filter(effect => effect.effectClass === "LineageEffect.m_u000_a"),
    "lineageeffect.m_u000_b": mU000.filter(effect => effect.effectClass === "LineageEffect.m_u000_b"),
    "lineageeffect.m_u000_c": mU000.filter(effect => effect.effectClass === "LineageEffect.m_u000_c"),
    "lineageeffect.m_u000_d": mU000.filter(effect => effect.effectClass === "LineageEffect.m_u000_d"),
    "lineageeffect.m_u016_a": mU016.filter(effect => effect.effectClass === "LineageEffect.m_u016_a"),
    "lineageeffect.m_u016_b": mU016.filter(effect => effect.effectClass === "LineageEffect.m_u016_b"),
    "lineageeffect.m_u006_a": mU006.filter(effect => effect.effectClass === "LineageEffect.m_u006_a"),
    "lineageeffect.m_u006_b": mU006.filter(effect => effect.effectClass === "LineageEffect.m_u006_b"),
    "lineageeffect.m_u006_c": mU006.filter(effect => effect.effectClass === "LineageEffect.m_u006_c"),
    "lineageeffect.m_u006_e": mU006.filter(effect => effect.effectClass === "LineageEffect.m_u006_e"),
    "lineageeffect.m_u022_a": mU022.filter(effect => effect.effectClass === "LineageEffect.m_u022_a"),
    "lineageeffect.m_u022_b": mU022.filter(effect => effect.effectClass === "LineageEffect.m_u022_b"),
    "lineageeffect.m_u021_a": mU021.filter(effect => effect.effectClass === "LineageEffect.m_u021_a"),
    "lineageeffect.m_u021_b": mU021.filter(effect => effect.effectClass === "LineageEffect.m_u021_b"),
    "lineageeffect.m_u024_a": mU024.filter(effect => effect.effectClass === "LineageEffect.m_u024_a"),
    "lineageeffect.m_u024_b": mU024.filter(effect => effect.effectClass === "LineageEffect.m_u024_b"),
    "lineageeffect.m_u024_c": mU024.filter(effect => effect.effectClass === "LineageEffect.m_u024_c"),
    "lineageeffect.m_u026_a": mU026.filter(effect => effect.effectClass === "LineageEffect.m_u026_a"),
    "lineageeffect.m_u026_b": mU026.filter(effect => effect.effectClass === "LineageEffect.m_u026_b"),
    "lineageeffect.m_u026_c": mU026.filter(effect => effect.effectClass === "LineageEffect.m_u026_c"),
    "lineageeffect.m_u026_d": mU026.filter(effect => effect.effectClass === "LineageEffect.m_u026_d")
};

const nativeEffectGroups: Record<string, Record<string, NativeSkillEffect_T[]>> = {
    siegeHammer: {
        // Engine.dll Shot 0x7a9444..0x7a95c5: caster center + target direction * radius * 2, caster rotation, target owner.
        "lineageeffect.p_u004_a": [{ phase: "shot", effectClass: "LineageEffect.p_u004_a", host: "caster", owner: "target", position: "center", rotation: "caster", radiusOffset: 2, offsetRotation: "targetDirection" }]
    },
    flameStrike: {
        "lineageeffect.m_u006_a": nativeEffects["lineageeffect.m_u006_a"],
        "lineageeffect.m_u006_b": nativeEffects["lineageeffect.m_u006_b"],
        "lineageeffect.m_u006_c": nativeEffects["lineageeffect.m_u006_c"],
        // Engine.dll Explosion 0x791316 / 0x7913a9: primary hit and trailer; no impact light or SkillSpeedRate override.
        "lineageeffect.m_u006_e": [{ phase: "explosion", effectClass: "LineageEffect.m_u006_e", host: "target", owner: "target", bone: 0, isAbsolute: true }],
        "lineageeffect.m_u006_d": [{ phase: "explosion", effectClass: "LineageEffect.m_u006_d", host: "target", owner: "target", attach: "trail" }]
    },
    corpseBurst: {
        "lineageeffect.m_u003_a": nativeEffects["lineageeffect.m_u003_a"],
        // Engine.dll Shot 0x7a9a40 / 0x7a9ad5: target ownership, SkillSpeedRate; no Blaze explosion light.
        "lineageeffect.m_u006_e": [{ phase: "shot", effectClass: "LineageEffect.m_u006_e", host: "target", owner: "target", bone: 0, isAbsolute: true, useSkillSpeed: true }],
        "lineageeffect.m_u006_d": [{ phase: "shot", effectClass: "LineageEffect.m_u006_d", host: "target", owner: "target", attach: "trail", useSkillSpeed: true }]
    }
};

function getNativeEffect(name: string, group?: string): NativeSkillEffect_T[] {
    const effects = (group === undefined ? nativeEffects : nativeEffectGroups[group])?.[name.toLowerCase()];

    if (!effects) throw new Error(`Native effect '${name}' in group '${group || "default"}' is not implemented.`);

    return effects;
}

export default getNativeEffect;
export { type NativeSkillEffect_T };
