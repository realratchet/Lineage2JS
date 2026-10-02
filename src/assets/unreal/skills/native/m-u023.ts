import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79def5/0x79df38..0x79df63: player backoff 2/3 radius, NPC backoff 1; 0x79df77: SpeedRate=1; 0x79dfd5..0x79dfee: caster Location override.
    { phase: "casting", effectClass: "LineageEffect.m_u023_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, npcForwardOffset: -1, scale: "casterRadius", initialPosition: "center", speedRate: 1 },
    // Shot 0x7a8360..0x7a8429 / 0x7a842e..0x7a84c2: m_u023_b, trailer and mode 1; target host/owner for the target-list loop and its single-target branch.
    { phase: "shot", effectClass: "LineageEffect.m_u023_b", host: "target", owner: "target", attach: "trail", associatedActors: "targetExcepted", speedRate: 1 }
];

export default effects;
