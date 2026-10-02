import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79fcb1..0x79fd7a: DesiredRotation transforms [-1, 0, 0] * radius * 2/3; mode 1 at 0x79fd5e, class m_u008_a.
    { phase: "casting", effectClass: "LineageEffect.m_u008_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: 1, speedRate: 1 },
    // Engine.dll Shot 0x7ad7d6..0x7ad878: mode 2, zero offset/rotation; class m_u008_b at 0x7ad878; associated actors are host/owner.
    // 0x7ad89c..0x7ad911: primary target uses the same class, mode and target host/owner.
    { phase: "shot", effectClass: "LineageEffect.m_u008_b", host: "target", owner: "target", attach: "trail", position: "center", rotation: "zero", speedRate: 1, associatedActors: "targetExcepted" }
];

export default effects;
