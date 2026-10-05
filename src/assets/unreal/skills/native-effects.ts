import sBaiumNormalAttack from "./native/s-baium-normal-attack";
import sThunderbolt from "./native/s-thunderbolt";
import sEnergyWave from "./native/s-energy-wave";
import sEarthQuake from "./native/s-earth-quake";
import sGroupHold from "./native/s-group-hold";
import eU082 from "./native/e-u082";
import eU033 from "./native/e-u033";
import sU010A from "./native/s-u010-a";
import sU010B, { attackEffects as sU010Attack } from "./native/s-u010-b";
import eU011 from "./native/e-u011";
import sRecall, { castingEffects as sRecallCasting } from "./native/s-recall";
import sU015B from "./native/s-u015-b";
import sU005 from "./native/s-u005";
import sU007 from "./native/s-u007";
import sU020 from "./native/s-u020";
import sU003, { bowImpact } from "./native/s-u003";
import sNpcSpearAttack from "./native/s-npc-spear-attack";
import pU004A from "./native/p-u004-a";
import mU019A from "./native/m-u019-a";
import mU019B from "./native/m-u019-b";
import mU018A from "./native/m-u018-a";
import mU018B from "./native/m-u018-b";
import sU016 from "./native/s-u016";
import sU017 from "./native/s-u017";
import mU017 from "./native/m-u017";
import mU008 from "./native/m-u008";
import sU009 from "./native/s-u009";
import sU012 from "./native/s-u012";
import mU013A from "./native/m-u013-a";
import mU013C from "./native/m-u013-c";
import mU007A from "./native/m-u007-a";
import mU007B from "./native/m-u007-b";
import mU009 from "./native/m-u009";
import sNpcHydroBlast from "./native/s-npc-hydro-blast";
import mU003 from "./native/m-u003";
import mU004 from "./native/m-u004";
import mU000 from "./native/m-u000";
import sQueenAntStrike from "./native/s-queen-ant-strike";
import sZakenSelfTel from "./native/s-zaken-self-tel";
import sZakenTelPc from "./native/s-zaken-tel-pc";
import sZakenDualAttack from "./native/s-zaken-dual-attack";
import sDietrichSuspension from "./native/s-dietrich-suspension";
import sGustavWind from "./native/s-gustav-wind";
import sWildCannon from "./native/s-wild-cannon";
import sEvilShackleBossA from "./native/s-evil-shackle-boss-a";
import mU016 from "./native/m-u016";
import mU006, { shotEffects as mU006Shot, explosionEffects as mU006Explosion } from "./native/m-u006";
import sRecharge from "./native/s-recharge";
import sHealQueenAnt from "./native/s-heal-queen-ant";
import sGreaterHeal from "./native/s-greater-heal";
import sTeleportPc from "./native/s-teleport-pc";
import mU021 from "./native/m-u021";
import mU024 from "./native/m-u024";
import mU034 from "./native/m-u034";
import mU023 from "./native/m-u023";
import mU030 from "./native/m-u030";
import mU044 from "./native/m-u044";
import mU038 from "./native/m-u038";
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
import sRange80HpDrain, { drainEffects } from "./native/s-range-80-hp-drain";
import sRegeneration from "./native/s-regeneration";
import sWindWalk from "./native/s-wind-walk";
import sSiegeHammer from "./native/s-siege-hammer";
import sDoubleDaggerAttack from "./native/s-double-dagger-attack";
import sPowerStrike from "./native/s-power-strike";
import sHeal from "./native/s-heal";
import mU028 from "./native/m-u028";
import sU001 from "./native/s-u001";
import sU006 from "./native/s-u006";
import sU011 from "./native/s-u011";
import sU509 from "./native/s-u509";
import sU513 from "./native/s-u513";
import { blasterShot, stormShot, blasterExplosion, stormExplosion } from "./native/s-sonic-blaster";
import sSonicBuster from "./native/s-sonic-buster";
import sForceBuster from "./native/s-force-buster";
import sEvadeShot from "./native/s-evade-shot";
import type { NpcSkillEffectPhase_T } from "../un-pawn";

export type NativeSkillEffect_T = {
    phase: NpcSkillEffectPhase_T;
    effectClass: string;
    host: "caster" | "target" | "source" | "impactActor";
    associatedActors?: "targetExcepted" | "targetExceptedAndPrimary" | "primaryAndSecondary" | "primaryPerAssociated" | "all";
    primaryTargetOnly?: boolean;
    secondaryTargetOnly?: boolean;
    rejectNullAfterSpawn?: boolean;
    soundWithoutEffect?: boolean;
    targetIsCaster?: boolean;
    targetIsNpc?: boolean;
    targetRequired?: "phase" | "position";
    hitActor?: boolean;
    hitActorIsMover?: boolean;
    sourceOwner?: boolean;
    sourceTarget?: boolean;
    owner?: "target" | "none" | "source" | "impactActor";
    attach?: "trail";
    bone?: number | string;
    boneOptional?: boolean;
    boneFallback?: number;
    positionBone?: string;
    missingBoneStopsPhase?: boolean | "beforeTarget";
    positionBoneProperty?: string;
    specificStage?: number;
    boneOffset?: [number, number, number];
    height?: "targetFeet" | "targetMeshOrigin" | "targetMeshOriginOrFeet";
    locList?: { delay: number, interval: number, random?: { count: number, range: number } }; // Server populates LocList.
    location?: [number, number, number];
    boneProperty?: string;
    bonePropertyRequired?: boolean;
    preShotBones?: [string, string];
    releaseProjectile?: true | { first: boolean, spawn: boolean };
    damageEffect?: boolean | "only" | "associated";
    weaponId?: number;
    relativeLocation?: [number, number, number];
    relativeLocationOnNamedBone?: boolean;
    relativeRotation?: [number, number, number];
    relativeRotationOnNamedBone?: boolean;
    isAbsolute?: boolean;
    rotation?: "zero" | "caster" | "target" | "desiredCaster" | "targetPosition" | "targetDirection" | "targetDisplacement" | "hit" | "reverseHitHorizontal" | "hitActorNormal" | "bone";
    position?: "center" | "lastTarget" | "location" | "source" | "meshOrigin";
    initialPosition?: "center";
    radiusOffset?: number;
    npcForwardOffset?: number;
    forwardOffset?: number;
    heightOffset?: number;
    offsetRotation?: "caster" | "desiredCaster" | "targetDirection" | "hit";
    relativeTrailOffset?: number;
    lifeSpan?: "shotTime" | "firstShotTime";
    lifeSpanOffset?: number;
    physics?: "none" | "trailer";
    templatePivot?: boolean;
    randomRoll?: number;
    useSkillSpeed?: boolean | "sourceOwner" | "sourceTarget" | "target";
    speedRate?: number;
    adjustParticleLife?: boolean | "shotTime";
    scale?: number | "casterRadius" | "cancelCasterRadius" | "targetRadius";
    delay?: number;
    hitDelay?: number;
    offset?: [number, number, number];
    pawnLight?: { color: [number, number, number], radius: number, lifeTime?: number, spot?: boolean, target?: "caster", position?: "center" | "lastTarget", rotation?: "hit" | "targetDisplacement", radiusOffset?: number };
    pawnLightOnly?: boolean;
    attackSounds?: boolean | "critical";
    viewShake?: { type?: "damage" | "upDown", duration: number, rotationScale: number, rotationFrequency: number, positionFrequency: number, direction: "random" | "y" | "fixedY", rotationAmplitude: number, rotationVelocity: number, positionAmplitude: [number, number, number], strength: number, range: number, ownerRequired?: boolean, event?: { name: string, radius: number } };
    trailerPrePivot?: "casterMeshOrigin" | { meshOriginScale: number, radiusOffset?: number };
    projectile?: { target: "caster" | "target", speed?: number, acceleration?: number, path?: [number, number, number][], interpolation?: number, hermite?: { duration: number, tangentScale: number, finalDirectionZ: number } };
};

const nativeEffects: Record<string, NativeSkillEffect_T[]> = {
    "lineageeffect.m_u030_a": mU030.filter(effect => effect.effectClass === "LineageEffect.m_u030_a"),
    "lineageeffect.m_u030_b": mU030.filter(effect => effect.effectClass === "LineageEffect.m_u030_b"),
    "lineageeffect.s_u020_a": sU020.filter(effect => effect.effectClass === "LineageEffect.s_u020_a"),
    "lineageeffect.s_u020_b": sU020.filter(effect => effect.effectClass === "LineageEffect.s_u020_b"),
    "lineageeffect.s_u020_c": sU020.filter(effect => effect.effectClass === "LineageEffect.s_u020_c"),
    "lineageeffect.s_u007_a": sU007.filter(effect => effect.effectClass === "LineageEffect.s_u007_a"),
    "lineageeffect.s_u007_b": sU007.filter(effect => effect.effectClass === "LineageEffect.s_u007_b"),
    "lineageeffect.m_u023_a": mU023.filter(effect => effect.effectClass === "LineageEffect.m_u023_a"),
    "lineageeffect.m_u023_b": mU023.filter(effect => effect.effectClass === "LineageEffect.m_u023_b"),
    "lineageeffect.e_u011_a": eU011,
    "lineageeffect.s_u002_a": sPowerStrike,
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
    "lineageeffect.e_u071_a": sZakenTelPc.filter(effect => effect.effectClass === "LineageEffect.e_u071_a"),
    "lineageeffect.e_u071_b": sZakenTelPc.filter(effect => effect.effectClass === "LineageEffect.e_u071_b"),
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
    "lineageeffect.e_u073_door": sWildCannon.filter(effect => effect.effectClass === "LineageEffect.e_u073_door"),
    "lineageeffect.e_u504_a": sEvilShackleBossA.filter(effect => effect.effectClass === "LineageEffect.e_u504_a"),
    "lineageeffect.e_u504_rh": sEvilShackleBossA.filter(effect => effect.effectClass === "LineageEffect.e_u504_rh"),
    "lineageeffect.e_u504_b": sEvilShackleBossA.filter(effect => effect.effectClass === "LineageEffect.e_u504_b"),
    "lineageeffect.e_u063_a": sBaiumNormalAttack,
    "lineageeffect.e_u064_a": sThunderbolt.filter(effect => effect.effectClass === "LineageEffect.e_u064_a"),
    "lineageeffect.e_u064_cloud": sThunderbolt.filter(effect => effect.effectClass === "LineageEffect.e_u064_cloud"),
    "lineageeffect.e_u065_a": sEnergyWave,
    "lineageeffect.e_u066_a": sEarthQuake,
    "lineageeffect.e_u067_a": sGroupHold.filter(effect => effect.effectClass === "LineageEffect.e_u067_a"),
    "lineageeffect.e_u067_hand": sGroupHold.filter(effect => effect.effectClass === "LineageEffect.e_u067_hand"),
    "lineageeffect.s_u010_a": sU010A,
    "lineageeffect.s_u010_b": sU010B,
    "lineageeffect.s_u015_b": sU015B,
    "lineageeffect.s_u005_a": sU005.filter(effect => effect.effectClass === "LineageEffect.s_u005_a"),
    "lineageeffect.s_u005_b": sU005.filter(effect => effect.effectClass === "LineageEffect.s_u005_b"),
    "lineageeffect.p_u004_a": pU004A,
    "lineageeffect.m_u019_a": mU019A,
    "lineageeffect.m_u019_b": mU019B,
    "lineageeffect.m_u018_a": mU018A,
    "lineageeffect.m_u018_b": mU018B,
    "lineageeffect.s_u016_a": sU016.filter(effect => effect.effectClass === "LineageEffect.s_u016_a"),
    "lineageeffect.s_u016_b": sU016.filter(effect => effect.effectClass === "LineageEffect.s_u016_b"),
    "lineageeffect.s_u017_a": sU017.filter(effect => effect.effectClass === "LineageEffect.s_u017_a"),
    "lineageeffect.s_u017_b": sU017.filter(effect => effect.effectClass === "LineageEffect.s_u017_b"),
    "lineageeffect.m_u017_a": mU017.filter(effect => effect.effectClass === "LineageEffect.m_u017_a"),
    "lineageeffect.m_u017_b": mU017.filter(effect => effect.effectClass === "LineageEffect.m_u017_b"),
    "lineageeffect.m_u008_a": mU008.filter(effect => effect.effectClass === "LineageEffect.m_u008_a"),
    "lineageeffect.m_u008_b": mU008.filter(effect => effect.effectClass === "LineageEffect.m_u008_b"),
    "lineageeffect.s_u009_a": sU009,
    "lineageeffect.s_u012_a": sU012,
    "lineageeffect.m_u013_a": mU013A,
    "lineageeffect.m_u013_c": mU013C,
    "lineageeffect.m_u007_a": mU007A,
    "lineageeffect.m_u007_b": mU007B,
    "lineageeffect.m_u009_a": mU009.filter(effect => effect.effectClass === "LineageEffect.m_u009_a"),
    "lineageeffect.m_u009_c": mU009.filter(effect => effect.effectClass === "LineageEffect.m_u009_c"),
    "lineageeffect.m_u033_a": sNpcHydroBlast.filter(effect => effect.effectClass === "LineageEffect.m_u033_a"),
    "lineageeffect.m_u033_b": sNpcHydroBlast.filter(effect => effect.effectClass === "LineageEffect.m_u033_b"),
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
    "lineageeffect.m_u037_d": [{ phase: "shot", effectClass: "LineageEffect.m_u037_d", host: "target", owner: "target", position: "center" }],
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
    "lineageeffect.m_u034_a": mU034.filter(effect => effect.effectClass === "LineageEffect.m_u034_a"),
    "lineageeffect.m_u034_b": mU034.filter(effect => effect.effectClass === "LineageEffect.m_u034_b"),
    "lineageeffect.m_u034_c": mU034.filter(effect => effect.effectClass === "LineageEffect.m_u034_c"),
    "lineageeffect.m_u044_a": mU044.filter(effect => effect.effectClass === "LineageEffect.m_u044_a"),
    "lineageeffect.m_u044_b": mU044.filter(effect => effect.effectClass === "LineageEffect.m_u044_b"),
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
    "lineageeffect.m_u026_d": mU026.filter(effect => effect.effectClass === "LineageEffect.m_u026_d"),
    "lineageeffect.m_u028_a": mU028.filter(effect => effect.effectClass === "LineageEffect.m_u028_a"),
    "lineageeffect.m_u028_b": mU028.filter(effect => effect.effectClass === "LineageEffect.m_u028_b"),
    "lineageeffect.m_u028_c": mU028.filter(effect => effect.effectClass === "LineageEffect.m_u028_c"),
    "lineageeffect.s_u001_a": sU001.filter(effect => effect.effectClass === "LineageEffect.s_u001_a"),
    "lineageeffect.s_u001_b": sU001.filter(effect => effect.effectClass === "LineageEffect.s_u001_b"),
    "lineageeffect.s_u006_a": sU006.filter(effect => effect.effectClass === "LineageEffect.s_u006_a"),
    "lineageeffect.s_u006_b": sU006.filter(effect => effect.effectClass === "LineageEffect.s_u006_b"),
    "lineageeffect.s_u011_a": sU011,
    "lineageeffect.s_u513_a": sU513.filter(effect => effect.effectClass === "LineageEffect.s_u513_a"),
    "lineageeffect.s_u513_b": sU513.filter(effect => effect.effectClass === "LineageEffect.s_u513_b"),
    "lineageeffect.s_u513_c": sU513.filter(effect => effect.effectClass === "LineageEffect.s_u513_c")
};

const nativeEffectGroups: Record<string, Record<string, NativeSkillEffect_T[]>> = {
    drainHealth: {
        "lineageeffect.s_u019_a": drainEffects.filter(effect => effect.effectClass === "LineageEffect.s_u019_a"),
        "lineageeffect.s_u019_b": drainEffects.filter(effect => effect.effectClass === "LineageEffect.s_u019_b"),
        "lineageeffect.s_u019_c": drainEffects.filter(effect => effect.effectClass === "LineageEffect.s_u019_c")
    },
    recall: {
        "lineageeffect.e_u031_a": sZakenSelfTel.filter(effect => effect.effectClass === "LineageEffect.e_u031_a"),
        "lineageeffect.e_u005_a": sRecall
    },
    partyRecall: {
        "lineageeffect.e_u031_a": sRecallCasting,
        "lineageeffect.e_u005_a": sRecall
    },
    seedWind: {
        "lineageeffect.m_u038_a": mU038,
        "lineageeffect.m_u022_b": nativeEffects["lineageeffect.m_u022_b"]
    },
    heal: {
        "lineageeffect.m_u001_a": sHeal.filter(effect => effect.effectClass === "LineageEffect.m_u001_a"),
        "lineageeffect.m_u001_b": sHeal.filter(effect => effect.effectClass === "LineageEffect.m_u001_b")
    },
    zakenSelfTel: {
        "lineageeffect.e_u031_a": sZakenSelfTel.filter(effect => effect.effectClass === "LineageEffect.e_u031_a"),
        "lineageeffect.e_u005_a": sZakenSelfTel.filter(effect => effect.effectClass === "LineageEffect.e_u005_a")
    },
    zakenDualAttack: {
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.p_u004_a": sZakenDualAttack
    },
    tripleSlash: {
        "lineageeffect.s_u010_b": [...sU010B, ...sU010Attack],
        "lineageeffect.s_u010_a": sU010A
    },
    sonicSlash: {
        // Engine.dll Shot 0x7a5aa7..0x7a5ac1: only StageShot=1 calls Action_Attack.
        "lineageeffect.s_u010_b": [...sU010B, ...sU010Attack.map(effect => ({ ...effect, specificStage: 1 }))],
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.s_u015_b": sU015B
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
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.s_u003_a": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_a"),
        "lineageeffect.s_u003_d": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_d"),
        "lineageeffect.s_u003_b": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_b"),
        "lineageeffect.p_u004_a": bowImpact
    },
    bossSpearStun: {
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.nspear_sp": sNpcSpearAttack,
        "lineageeffect.s_u505_c": sStunShotBossA.filter(effect => effect.effectClass === "LineageEffect.s_u505_c")
    },
    spear: {
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.nspear_sp": sNpcSpearAttack,
        "lineageeffect.p_u004_a": bowImpact
    },
    doubleDagger: {
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.nspear_sp": sDoubleDaggerAttack,
        "lineageeffect.p_u004_a": bowImpact
    },
    siegeHammer: {
        "lineageeffect.p_u004_a": sSiegeHammer
    },
    flameStrike: {
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.s_u003_a": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_a"),
        "lineageeffect.s_u003_d": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_d"),
        "lineageeffect.s_u003_b": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_b"),
        "lineageeffect.m_u006_a": nativeEffects["lineageeffect.m_u006_a"],
        "lineageeffect.m_u006_b": nativeEffects["lineageeffect.m_u006_b"],
        "lineageeffect.m_u006_c": nativeEffects["lineageeffect.m_u006_c"],
        "lineageeffect.m_u006_e": mU006Explosion.filter(effect => effect.effectClass === "LineageEffect.m_u006_e"),
        "lineageeffect.m_u006_d": mU006Explosion.filter(effect => effect.effectClass === "LineageEffect.m_u006_d")
    },
    rapidSpear: {
        "lineageeffect.m_u006_e": mU006Shot.filter(effect => effect.effectClass === "LineageEffect.m_u006_e"),
        "lineageeffect.m_u006_d": mU006Shot.filter(effect => effect.effectClass === "LineageEffect.m_u006_d")
    },
    corpseBurst: {
        "lineageeffect.m_u003_a": nativeEffects["lineageeffect.m_u003_a"],
        "lineageeffect.m_u006_e": mU006Shot.filter(effect => effect.effectClass === "LineageEffect.m_u006_e"),
        "lineageeffect.m_u006_d": mU006Shot.filter(effect => effect.effectClass === "LineageEffect.m_u006_d")
    },
    antarasNormalAttackEx: {
        "lineageeffect.e_u049_a": sAntarasNormalAttackEx
    },
    sonicBlaster: {
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.s_u015_a": blasterShot,
        "lineageeffect.s_u015_b": blasterExplosion
    },
    sonicStorm: {
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.s_u015_a": stormShot,
        "lineageeffect.s_u015_b": stormExplosion.filter(effect => effect.effectClass === "LineageEffect.s_u015_b"),
        "lineageeffect.m_u006_d": stormExplosion.filter(effect => effect.effectClass === "LineageEffect.m_u006_d")
    },
    sonicBuster: {
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.m_u006_d": sSonicBuster.filter(effect => effect.effectClass === "LineageEffect.m_u006_d"),
        "lineageeffect.m_u006_e": sSonicBuster.filter(effect => effect.effectClass === "LineageEffect.m_u006_e")
    },
    forceBuster: {
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.m_u006_e": sForceBuster
    },
    evadeShot: {
        "lineageeffect.s_u010_a": sU010A,
        "lineageeffect.s_u003_d": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_d"),
        "lineageeffect.s_u003_b": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_b"),
        "lineageeffect.sp_agility_ta": sEvadeShot
    },
    lethalShot: {
        "lineageeffect.s_u509_a": sU509.filter(effect => effect.effectClass === "LineageEffect.s_u509_a"),
        "lineageeffect.s_u003_d": sU003.filter(effect => effect.effectClass === "LineageEffect.s_u003_d"),
        "lineageeffect.s_u509_d": sU509.filter(effect => effect.effectClass === "LineageEffect.s_u509_d"),
        "lineageeffect.s_u509_c": sU509.filter(effect => effect.effectClass === "LineageEffect.s_u509_c"),
        "lineageeffect.s_u509_b": sU509.filter(effect => effect.effectClass === "LineageEffect.s_u509_b"),
        "lineageeffect.s_u509_e": sU509.filter(effect => effect.effectClass === "LineageEffect.s_u509_e")
    }
};

function getNativeEffect(name: string, group?: string): NativeSkillEffect_T[] {
    const effects = (group === undefined ? nativeEffects : nativeEffectGroups[group])?.[name.toLowerCase()];

    if (!effects) throw new Error(`Native effect '${name}' in group '${group || "default"}' is not implemented.`);

    return effects;
}

export default getNativeEffect;
