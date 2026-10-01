import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll 0x79d652..0x79d6d0: m_u038_a at caster Location-height, caster Rotation/Owner.
    // 0x79d730..0x79d7e4: unscaled negative mesh Origin.Z and player-only -2/3 radius pivot; 0x79d802: AdjustParticleLife(ShotTime).
    { phase: "casting", effectClass: "LineageEffect.m_u038_a", host: "caster", rotation: "caster", trailerPrePivot: { meshOriginScale: -1, radiusOffset: -2 / 3 }, adjustParticleLife: "shotTime" }
];

export default effects;
