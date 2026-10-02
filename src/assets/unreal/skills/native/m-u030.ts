import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79c9cc/0x79ca97..0x79cb00: caster Owner/Rotation, negative mesh Origin.Z, non-NPC backoff; 0x7a1b32/0x7a1b91: 2/3 radius, AdjustParticleLife(ShotTime).
    { phase: "casting", effectClass: "LineageEffect.m_u030_a", host: "caster", location: [0, 0, 0], rotation: "caster", trailerPrePivot: { meshOriginScale: -1, radiusOffset: -2 / 3 }, adjustParticleLife: "shotTime" },
    // Engine.dll Shot 0x7a6d16/0x7a6d64/0x7a6d94/0x7a6d9f: caster Location/Rotation/Owner; 0x7a6dc8..0x7a6dd0: TrailerPrePivot.Z = 2 * mesh Origin.Z.
    { phase: "shot", effectClass: "LineageEffect.m_u030_b", host: "caster", position: "center", rotation: "caster", speedRate: 1, trailerPrePivot: { meshOriginScale: 2 } }
];

export default effects;
