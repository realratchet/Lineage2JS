import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Shot 0x7a5359..0x7a53d8: trailer with caster Owner and null host, rate Pawn+0x600; SpawnSkillEffect 0x7983de skips the location mode.
    { phase: "shot", effectClass: "LineageEffect.m_u006_d", host: "caster", attach: "trail", templatePivot: true, useSkillSpeed: true },
    // 0x7a5400..0x7a54b7: every nonnull list entry, entry host/owner, absolute bone 0, rate Pawn+0x600; no primary-target fallback.
    { phase: "shot", effectClass: "LineageEffect.m_u006_e", host: "target", owner: "target", bone: 0, isAbsolute: true, useSkillSpeed: true, associatedActors: "all" }
];

export default effects;
