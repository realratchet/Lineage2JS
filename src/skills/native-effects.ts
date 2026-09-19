import eU063A from "./native/e-u063-a";
import eU064A from "./native/e-u064-a";
import eU064Cloud from "./native/e-u064-cloud";
import eU065A from "./native/e-u065-a";
import eU066A from "./native/e-u066-a";
import eU067A from "./native/e-u067-a";
import eU067Hand from "./native/e-u067-hand";
import eU082 from "./native/e-u082";
import eU033 from "./native/e-u033";
import sU010A from "./native/s-u010-a";
import sU005 from "./native/s-u005";
import sU003, { bowImpact } from "./native/s-u003";
import sNpcSpearAttack from "./native/s-npc-spear-attack";
import pU004A from "./native/p-u004-a";
import mU019A from "./native/m-u019-a";
import mU019B from "./native/m-u019-b";
import mU018A from "./native/m-u018-a";
import mU018B from "./native/m-u018-b";
import mU013A from "./native/m-u013-a";
import mU013C from "./native/m-u013-c";
import mU007A from "./native/m-u007-a";
import mU007B from "./native/m-u007-b";
import mU009 from "./native/m-u009";
import mU033A from "./native/m-u033-a";
import mU033B from "./native/m-u033-b";
import mU003 from "./native/m-u003";
import mU004 from "./native/m-u004";
import mU000 from "./native/m-u000";
import sQueenAntStrike from "./native/s-queen-ant-strike";
import sZakenSelfTel from "./native/s-zaken-self-tel";
import sZakenDualAttack from "./native/s-zaken-dual-attack";
import sDietrichSuspension from "./native/s-dietrich-suspension";
import sGustavWind from "./native/s-gustav-wind";
import sWildCannon from "./native/s-wild-cannon";
import sEvilShackleBossA from "./native/s-evil-shackle-boss-a";
import mU016 from "./native/m-u016";
import mU006 from "./native/m-u006";
import sRecharge from "./native/s-recharge";
import sHealQueenAnt from "./native/s-heal-queen-ant";
import sGreaterHeal from "./native/s-greater-heal";
import sTeleportPc from "./native/s-teleport-pc";
import mU021 from "./native/m-u021";
import mU024 from "./native/m-u024";
import mU026 from "./native/m-u026";
import eU802 from "./native/e-u802";
import eU524 from "./native/e-u524";
import sAntarasJump from "./native/s-antaras-jump";
import sAntarasTail from "./native/s-antaras-tail";
import sAntarasDebuff from "./native/s-antaras-debuff";
import sAntarasMouth from "./native/s-antaras-mouth";
import sAntarasNormalAttack from "./native/s-antaras-normal-attack";
import sAntarasNormalAttackEx from "./native/s-antaras-normal-attack-ex";
import sAntarasBreath from "./native/s-antaras-breath";
import sNpcChillFlame from "./native/s-npc-chill-flame";
import sNpcBeamStraight from "./native/s-npc-beam-straight";
import sNpcBeamCurveMagicOnly from "./native/s-npc-beam-curve-magic-only";
import sNpcWindOfHand from "./native/s-npc-wind-of-hand";
import sNpcDoubleWindOfHand from "./native/s-npc-double-wind-of-hand";
import sNpcStrikeRange from "./native/s-npc-strike-range";
import sSelfRangeHasteBossA from "./native/s-self-range-haste-boss-a";
import sNpcWeakness from "./native/s-npc-weakness";
import sNpcAcumenEmpowerBerserker from "./native/s-npc-acumen-empower-berserker";
import sStunShotBossA from "./native/s-stun-shot-boss-a";
import sRange80HpDrain from "./native/s-range-80-hp-drain";
import sRegeneration from "./native/s-regeneration";
import sWindWalk from "./native/s-wind-walk";
import type { NpcSkillEffectPhase_T } from "@l2js/engine/contracts/pawn";

export type NativeSkillEffect_T = {
    phase: NpcSkillEffectPhase_T;
    effectClass: string;
    host: "caster" | "target" | "source";
    targetIsCaster?: boolean;
    owner?: "target" | "none" | "source";
    attach?: "trail" | "rightHand";
    bone?: number | string;
    boneFallback?: number;
    positionBone?: string;
    positionBoneProperty?: string;
    specificStage?: number;
    boneOffset?: [number, number, number];
    height?: "targetFeet" | "targetMeshOrigin" | "targetMeshOriginOrFeet";
    locList?: { delay: number, interval: number, random?: { count: number, range: number } }; // Server populates LocList.
    location?: [number, number, number];
    boneProperty?: string;
    releaseProjectile?: boolean;
    damageEffect?: boolean;
    weaponId?: number;
    relativeLocation?: [number, number, number];
    relativeLocationOnNamedBone?: boolean;
    relativeRotation?: [number, number, number];
    relativeRotationOnNamedBone?: boolean;
    isAbsolute?: boolean;
    rotation?: "caster" | "target" | "desiredCaster" | "targetPosition" | "targetDirection" | "targetDisplacement" | "hit" | "reverseHitHorizontal" | "bone";
    position?: "center" | "lastTarget" | "location" | "source" | "meshOrigin";
    initialPosition?: "center";
    radiusOffset?: number;
    forwardOffset?: number;
    heightOffset?: number;
    offsetRotation?: "caster" | "desiredCaster" | "targetDirection";
    relativeTrailOffset?: number;
    lifeSpan?: "shotTime" | "firstShotTime";
    lifeSpanOffset?: number;
    physics?: "none";
    useSkillSpeed?: boolean;
    speedRate?: number;
    adjustParticleLife?: boolean | "shotTime";
    scale?: number | "casterRadius" | "cancelCasterRadius" | "targetRadius";
    delay?: number;
    hitDelay?: number;
    offset?: [number, number, number];
    pawnLight?: { color: [number, number, number], radius: number, lifeTime?: number, spot?: boolean, target?: "caster", position?: "center" | "lastTarget", rotation?: "hit", radiusOffset?: number };
    trailerPrePivot?: "casterMeshOrigin";
    projectile?: { target: "caster" | "target", speed?: number, acceleration?: number, path?: [number, number, number][], interpolation?: number, hermite?: { duration: number, tangentScale: number, finalDirectionZ: number } };
};

const nativeEffects: Record<string, NativeSkillEffect_T[]> = {
    "lineageeffect.m_u800_a": sNpcAcumenEmpowerBerserker.filter(effect => effect.effectClass === "LineageEffect.m_u800_a"),
    "lineageeffect.m_u800_b": sNpcAcumenEmpowerBerserker.filter(effect => effect.effectClass === "LineageEffect.m_u800_b"),
    "lineageeffect.m_u036_a": sSelfRangeHasteBossA.filter(effect => effect.effectClass === "LineageEffect.m_u036_a"),
    "lineageeffect.m_u036_b": sSelfRangeHasteBossA.filter(effect => effect.effectClass === "LineageEffect.m_u036_b"),
    "lineageeffect.e_u524_meteor": eU524.filter(effect => effect.effectClass === "LineageEffect.e_u524_meteor"),
    "lineageeffect.e_u524_a": eU524.filter(effect => effect.effectClass === "LineageEffect.e_u524_a"),
    "lineageeffect.e_u802_fallback": eU802.filter(effect => effect.effectClass === "LineageEffect.e_u802_fallback"),
    "lineageeffect.e_u802_refract": eU802.filter(effect => effect.effectClass === "LineageEffect.e_u802_refract"),
    "lineageeffect.e_u033_a": eU033.filter(effect => effect.effectClass === "LineageEffect.e_u033_a"),
    "lineageeffect.e_u033_b": eU033.filter(effect => effect.effectClass === "LineageEffect.e_u033_b"),
    "lineageeffect.e_u033_c": eU033.filter(effect => effect.effectClass === "LineageEffect.e_u033_c"),
    "lineageeffect.e_u082_rainbow": eU082.filter(effect => effect.effectClass === "LineageEffect.e_u082_rainbow"),
    "lineageeffect.e_u082_core": eU082.filter(effect => effect.effectClass === "LineageEffect.e_u082_core"),
    "lineageeffect.e_u082_a": eU082.filter(effect => effect.effectClass === "LineageEffect.e_u082_a"),
    "lineageeffect.e_u046_a": sAntarasBreath.filter(effect => effect.effectClass === "LineageEffect.e_u046_a"),
    "lineageeffect.e_u046_b": sAntarasBreath.filter(effect => effect.effectClass === "LineageEffect.e_u046_b"),
    "lineageeffect.e_u046_c": sAntarasBreath.filter(effect => effect.effectClass === "LineageEffect.e_u046_c"),
    "lineageeffect.e_u043_a": sAntarasJump,
    "lineageeffect.e_u051_a": sAntarasTail,
    "lineageeffect.e_u050_b": sAntarasDebuff,
    "lineageeffect.e_u044_b": sAntarasMouth,
    "lineageeffect.e_u049_a": sAntarasNormalAttack,
    "lineageeffect.m_u027_a": sNpcChillFlame.filter(effect => effect.effectClass === "LineageEffect.m_u027_a"),
    "lineageeffect.m_u027_b": sNpcChillFlame.filter(effect => effect.effectClass === "LineageEffect.m_u027_b"),
    "lineageeffect.e_u034_a": sNpcBeamStraight.filter(effect => effect.effectClass === "LineageEffect.e_u034_a"),
    "lineageeffect.e_u034_b": sNpcBeamStraight.filter(effect => effect.effectClass === "LineageEffect.e_u034_b"),
    "lineageeffect.e_u034_c": sNpcBeamStraight.filter(effect => effect.effectClass === "LineageEffect.e_u034_c"),
    "lineageeffect.e_u058_r": sNpcWindOfHand.filter(effect => effect.effectClass === "LineageEffect.e_u058_r"),
    "lineageeffect.e_u058_a": sNpcWindOfHand.filter(effect => effect.effectClass === "LineageEffect.e_u058_a"),
    "lineageeffect.e_u058_b": sNpcWindOfHand.filter(effect => effect.effectClass === "LineageEffect.e_u058_b"),
    "lineageeffect.e_u057_a": sNpcStrikeRange.filter(effect => effect.effectClass === "LineageEffect.e_u057_a"),
    "lineageeffect.e_u057_b": sNpcStrikeRange.filter(effect => effect.effectClass === "LineageEffect.e_u057_b"),
    "lineageeffect.e_u073_a": sWildCannon.filter(effect => effect.effectClass === "LineageEffect.e_u073_a"),
    "lineageeffect.e_u073_b": sWildCannon.filter(effect => effect.effectClass === "LineageEffect.e_u073_b"),
    "lineageeffect.e_u073_ground": sWildCannon.filter(effect => effect.effectClass === "LineageEffect.e_u073_ground"),
    "lineageeffect.e_u504_a": sEvilShackleBossA.filter(effect => effect.effectClass === "LineageEffect.e_u504_a"),
    "lineageeffect.e_u504_rh": sEvilShackleBossA.filter(effect => effect.effectClass === "LineageEffect.e_u504_rh"),
    "lineageeffect.e_u504_b": sEvilShackleBossA.filter(effect => effect.effectClass === "LineageEffect.e_u504_b"),
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
    "lineageeffect.m_u009_a": mU009.filter(effect => effect.effectClass === "LineageEffect.m_u009_a"),
    "lineageeffect.m_u009_c": mU009.filter(effect => effect.effectClass === "LineageEffect.m_u009_c"),
    "lineageeffect.m_u033_a": mU033A,
    "lineageeffect.m_u033_b": mU033B,
    "lineageeffect.nspear_sp": sNpcSpearAttack,
    "lineageeffect.m_u003_a": mU003.filter(effect => effect.effectClass === "LineageEffect.m_u003_a"),
    "lineageeffect.m_u003_b": mU003.filter(effect => effect.effectClass === "LineageEffect.m_u003_b"),
    "lineageeffect.m_u003_c": mU003.filter(effect => effect.effectClass === "LineageEffect.m_u003_c"),
    "lineageeffect.s_u019_a": sRange80HpDrain.filter(effect => effect.effectClass === "LineageEffect.s_u019_a"),
    "lineageeffect.s_u019_b": sRange80HpDrain.filter(effect => effect.effectClass === "LineageEffect.s_u019_b"),
    "lineageeffect.s_u019_c": sRange80HpDrain.filter(effect => effect.effectClass === "LineageEffect.s_u019_c"),
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
    "lineageeffect.m_u022_a": sRecharge.filter(effect => effect.effectClass === "LineageEffect.m_u022_a"),
    "lineageeffect.m_u001_a": sHealQueenAnt.filter(effect => effect.effectClass === "LineageEffect.m_u001_a"),
    "lineageeffect.m_u001_b": sHealQueenAnt.filter(effect => effect.effectClass === "LineageEffect.m_u001_b"),
    "lineageeffect.m_u032_a": sGreaterHeal.filter(effect => effect.effectClass === "LineageEffect.m_u032_a"),
    "lineageeffect.m_u032_b": sGreaterHeal.filter(effect => effect.effectClass === "LineageEffect.m_u032_b"),
    "lineageeffect.e_u031_a": sTeleportPc.filter(effect => effect.effectClass === "LineageEffect.e_u031_a"),
    "lineageeffect.e_u005_a": sTeleportPc.filter(effect => effect.effectClass === "LineageEffect.e_u005_a"),
    "lineageeffect.m_u022_b": sRecharge.filter(effect => effect.effectClass === "LineageEffect.m_u022_b"),
    "lineageeffect.m_u014_a": sRegeneration.filter(effect => effect.effectClass === "LineageEffect.m_u014_a"),
    "lineageeffect.m_u010_a": sWindWalk.filter(effect => effect.effectClass === "LineageEffect.m_u010_a"),
    "lineageeffect.m_u010_c": sWindWalk.filter(effect => effect.effectClass === "LineageEffect.m_u010_c"),
    "lineageeffect.m_u014_b": sRegeneration.filter(effect => effect.effectClass === "LineageEffect.m_u014_b"),
    "lineageeffect.m_u021_a": mU021.filter(effect => effect.effectClass === "LineageEffect.m_u021_a"),
    "lineageeffect.m_u021_b": mU021.filter(effect => effect.effectClass === "LineageEffect.m_u021_b"),
    "lineageeffect.m_u024_a": mU024.filter(effect => effect.effectClass === "LineageEffect.m_u024_a"),
    "lineageeffect.m_u024_b": mU024.filter(effect => effect.effectClass === "LineageEffect.m_u024_b"),
    "lineageeffect.m_u024_c": mU024.filter(effect => effect.effectClass === "LineageEffect.m_u024_c"),
    "lineageeffect.m_u025_a": sDietrichSuspension.filter(effect => effect.effectClass === "LineageEffect.m_u025_a"),
    "lineageeffect.m_u025_b": sDietrichSuspension.filter(effect => effect.effectClass === "LineageEffect.m_u025_b"),
    "lineageeffect.m_u025_c": sDietrichSuspension.filter(effect => effect.effectClass === "LineageEffect.m_u025_c"),
    "lineageeffect.m_u038_a": sGustavWind.filter(effect => effect.effectClass === "LineageEffect.m_u038_a"),
    "lineageeffect.m_u038_b": sGustavWind.filter(effect => effect.effectClass === "LineageEffect.m_u038_b"),
    "lineageeffect.m_u038_c": sGustavWind.filter(effect => effect.effectClass === "LineageEffect.m_u038_c"),
    "lineageeffect.m_u038_d": sGustavWind.filter(effect => effect.effectClass === "LineageEffect.m_u038_d"),
    "lineageeffect.m_u026_a": mU026.filter(effect => effect.effectClass === "LineageEffect.m_u026_a"),
    "lineageeffect.m_u026_b": mU026.filter(effect => effect.effectClass === "LineageEffect.m_u026_b"),
    "lineageeffect.m_u026_c": mU026.filter(effect => effect.effectClass === "LineageEffect.m_u026_c"),
    "lineageeffect.m_u026_d": mU026.filter(effect => effect.effectClass === "LineageEffect.m_u026_d")
};

const nativeEffectGroups: Record<string, Record<string, NativeSkillEffect_T[]>> = {
    zakenSelfTel: {
        "lineageeffect.e_u031_a": sZakenSelfTel.filter(effect => effect.effectClass === "LineageEffect.e_u031_a"),
        "lineageeffect.e_u005_a": sZakenSelfTel.filter(effect => effect.effectClass === "LineageEffect.e_u005_a")
    },
    zakenDualAttack: {
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.p_u004_a": sZakenDualAttack
    },
    queenAntStrike: {
        "lineageeffect.m_u000_c": sQueenAntStrike.filter(effect => effect.effectClass === "LineageEffect.m_u000_c"),
        "lineageeffect.m_u000_d": sQueenAntStrike.filter(effect => effect.effectClass === "LineageEffect.m_u000_d")
    },
    npcWeakness: {
        "lineageeffect.m_u007_a": sNpcWeakness,
        "lineageeffect.m_u007_b": mU007B
    },
    npcDoubleWindOfHand: {
        "lineageeffect.e_u058_r": sNpcDoubleWindOfHand.filter(effect => effect.effectClass === "LineageEffect.e_u058_r"),
        "lineageeffect.e_u058_l": sNpcDoubleWindOfHand.filter(effect => effect.effectClass === "LineageEffect.e_u058_l"),
        "lineageeffect.e_u058_a": sNpcDoubleWindOfHand.filter(effect => effect.effectClass === "LineageEffect.e_u058_a"),
        "lineageeffect.e_u058_b": sNpcDoubleWindOfHand.filter(effect => effect.effectClass === "LineageEffect.e_u058_b")
    },
    npcBeamCurveMagicOnly: {
        "lineageeffect.e_u034_a": sNpcBeamCurveMagicOnly.filter(effect => effect.effectClass === "LineageEffect.e_u034_a"),
        "lineageeffect.e_u034_b": sNpcBeamCurveMagicOnly.filter(effect => effect.effectClass === "LineageEffect.e_u034_b"),
        "lineageeffect.e_u034_c": sNpcBeamCurveMagicOnly.filter(effect => effect.effectClass === "LineageEffect.e_u034_c")
    },
    bossStunShot: {
        "lineageeffect.s_u505_a": sStunShotBossA.filter(effect => effect.effectClass === "LineageEffect.s_u505_a"),
        "lineageeffect.s_u003_d": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_d"),
        "lineageeffect.s_u505_b": sStunShotBossA.filter(effect => effect.effectClass === "LineageEffect.s_u505_b"),
        "lineageeffect.s_u003_b": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_b"),
        "lineageeffect.s_u505_c": sStunShotBossA.filter(effect => effect.effectClass === "LineageEffect.s_u505_c")
    },
    bow: {
        "lineageeffect.s_u003_a": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_a"),
        "lineageeffect.s_u003_d": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_d"),
        "lineageeffect.s_u003_b": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_b"),
        "lineageeffect.p_u004_a": bowImpact
    },
    spear: {
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.nspear_sp": sNpcSpearAttack,
        "lineageeffect.p_u004_a": bowImpact
    },
    wildSweep: {
        // Engine.dll SkillEffectShot 0x7ae49b: target-owned impact at the computed target position.
        "lineageeffect.p_u004_a": [{ phase: "shot", effectClass: "LineageEffect.p_u004_a", host: "target", owner: "target", position: "center", rotation: "targetDirection", damageEffect: true }]
    },
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
    rapidSpear: {
        "lineageeffect.m_u006_e": [{ phase: "shot", effectClass: "LineageEffect.m_u006_e", host: "target", owner: "target", bone: 0, isAbsolute: true }],
        "lineageeffect.m_u006_d": [{ phase: "shot", effectClass: "LineageEffect.m_u006_d", host: "target", owner: "target", attach: "trail" }]
    },
    corpseBurst: {
        "lineageeffect.m_u003_a": nativeEffects["lineageeffect.m_u003_a"],
        // Engine.dll Shot 0x7a9a40 / 0x7a9ad5: target ownership, SkillSpeedRate; no Blaze explosion light.
        "lineageeffect.m_u006_e": [{ phase: "shot", effectClass: "LineageEffect.m_u006_e", host: "target", owner: "target", bone: 0, isAbsolute: true, useSkillSpeed: true }],
        "lineageeffect.m_u006_d": [{ phase: "shot", effectClass: "LineageEffect.m_u006_d", host: "target", owner: "target", attach: "trail", useSkillSpeed: true }]
    },
    antarasNormalAttackEx: {
        "lineageeffect.e_u049_a": sAntarasNormalAttackEx
    }
};

function getNativeEffect(name: string, group?: string): NativeSkillEffect_T[] {
    const effects = (group === undefined ? nativeEffects : nativeEffectGroups[group])?.[name.toLowerCase()];

    if (!effects) throw new Error(`Native effect '${name}' in group '${group || "default"}' is not implemented.`);

    return effects;
}

export default getNativeEffect;
