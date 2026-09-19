import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll 0x7a8bd5..0x7a8c01: Location.Z + CollisionHeight * float[0xaae3b0]=1/3; 0x7a8c38: caster rotation; 0x7a8c85..0x7a8c8c: SetSizeScale(2).
    { phase: "shot", effectClass: "LineageEffect.m_u000_c", host: "caster", position: "center", heightOffset: 1 / 3, rotation: "caster", scale: 2, projectile: { target: "target" } },
    // Engine.dll 0x78f386 / 0x790963..0x79099c: LastTargetLocation - HitRot.Vector() * target radius * 1.2; 0x790a10: m_u000_d; no pawn light.
    { phase: "explosion", effectClass: "LineageEffect.m_u000_d", host: "target", owner: "target", position: "lastTarget", rotation: "hit", radiusOffset: -1.2 }
];

export default effects;
