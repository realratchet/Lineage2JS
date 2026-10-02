import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Shot 0x7a54e0..0x7a5576: target host/owner, rate Pawn+0x600, absolute bone 0.
    { phase: "shot", effectClass: "LineageEffect.m_u006_e", host: "target", owner: "target", bone: 0, isAbsolute: true, useSkillSpeed: true },
    // 0x7a557b..0x7a572f: red spot at target Location - (target - caster) direction * radius * 2, .3s.
    { phase: "shot", effectClass: "LineageEffect.m_u006_e", host: "target", pawnLightOnly: true, pawnLight: { color: [1, 0, 0], radius: 30, lifeTime: 0.3, spot: true, position: "center", rotation: "targetDisplacement", radiusOffset: -2 } }
];

export default effects;
