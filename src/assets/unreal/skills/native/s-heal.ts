import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79eadb..0x79eba4: m_u001_a with Queen Heal's relative caster transform, common tail 0x7a12f4/0x7a12f5.
    { phase: "casting", effectClass: "LineageEffect.m_u001_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    // Shot 0x7abf6e..0x7ac013: null list entries skip; unlike Queen Heal, no SetSizeScale call follows m_u001_b.
    { phase: "shot", effectClass: "LineageEffect.m_u001_b", host: "target", owner: "target", attach: "trail", speedRate: 1, associatedActors: "targetExcepted" }
];

export default effects;
