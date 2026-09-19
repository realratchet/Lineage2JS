import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79ba04..0x79ba19: zero offset/rotation; 0x79f2d4/0x79f2fb: trailer, location mode 0.
// 0x79f324..0x79f338: LifeSpan=ShotTime, RelativeTrailOffset.X=radius*2; 0x79f374..0x79f3e6: red .7, radius 30, mode-3 spotlight aimed at caster.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u027_a", host: "caster", attach: "trail", position: "center", relativeTrailOffset: 2, lifeSpan: "shotTime", pawnLight: { color: [0.7, 0, 0], radius: 30, spot: true, target: "caster" } },
    // Engine.dll Shot 0x7ac31a/0x7ac370: trailer, location mode 1; 0x7ac37d..0x7ac392: m_u027_b, target host/owner.
    { phase: "shot", effectClass: "LineageEffect.m_u027_b", host: "target", owner: "target", attach: "trail" }
];

export default effects;
