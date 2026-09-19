import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x7a153f..0x7a15c1: direction * radius * 2, m_u800_a; 0x7a15e2..0x7a15f8: ShotTime, RelativeTrailOffset.X=radius*2.
    // 0x7a1630..0x7a168a: light radius 30, RGB .7/.3/.3, ShotTime; 0x7a168f..0x7a16a9: caster spot target.
    { phase: "casting", effectClass: "LineageEffect.m_u800_a", host: "caster", attach: "trail", position: "center", radiusOffset: 2, offsetRotation: "targetDirection", relativeTrailOffset: 2, lifeSpan: "shotTime", pawnLight: { color: [0.7, 0.3, 0.3], radius: 30, spot: true, target: "caster" } },
    // Engine.dll Shot 0x7b0b03..0x7b0b79: m_u800_b, target host/owner, trailer=true, location mode 1.
    { phase: "shot", effectClass: "LineageEffect.m_u800_b", host: "target", owner: "target", attach: "trail" }
];

export default effects;
