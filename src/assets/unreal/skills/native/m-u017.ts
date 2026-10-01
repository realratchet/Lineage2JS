import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79cb05..0x79cbce: DesiredRotation transforms [-1, 0, 0] * radius * 2/3; mode 1 at 0x79cbb4, class m_u017_a.
    { phase: "casting", effectClass: "LineageEffect.m_u017_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", speedRate: 1 },
    // Engine.dll Shot 0x7a6bd1..0x7a6c66: mode 2 at 0x7a6c66, zero offset/rotation; class m_u017_b at 0x7a6c73; target host/owner; AssociatedActors when bTargetExcepted.
    { phase: "shot", effectClass: "LineageEffect.m_u017_b", host: "target", owner: "target", attach: "trail", position: "center", rotation: "zero", speedRate: 1, associatedActors: "targetExcepted" }
];

export default effects;
