import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79ff2a; Shot 0x7adb2c -> 0x7ac0c6, location mode 2.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u004_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    // Engine.dll Shot 0x7ada66..0x7adb27: ordered nonnull list when bTargetExcepted; 0x7adb20 retains the last spawn for Shot sound.
    { phase: "shot", effectClass: "LineageEffect.m_u004_b", host: "target", owner: "target", attach: "trail", position: "center", associatedActors: "targetExcepted" }
];

export default effects;
