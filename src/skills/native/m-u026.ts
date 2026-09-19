import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a06db..0x7a0b79; Shot 0x7adcef; Explosion 0x79042a.
const effects: NativeSkillEffect_T[] = [
    // 0x7a06f2: negative X; 0x7a0730: float[0xab0d1c]=2/3.
    { phase: "casting", effectClass: "LineageEffect.m_u026_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    // 0x7a0883..0x7a08c0: direction*radius; 0x7a0b62..0x7a0b74: ShotTime lifespan and RelativeTrailOffset.X=radius.
    { phase: "casting", effectClass: "LineageEffect.m_u026_b", host: "caster", position: "center", radiusOffset: 1, offsetRotation: "targetDirection", relativeTrailOffset: 1, lifeSpan: "shotTime" },
    // 0x7add07/0x7add27: caster center Z + height*float[0xaae3b0]=height/3.
    { phase: "shot", effectClass: "LineageEffect.m_u026_c", host: "caster", position: "center", heightOffset: 1 / 3, rotation: "caster", projectile: { target: "target" } },
    // 0x79045f/0x7904cb..0x790501: subtract direction*1.2*hit radius; AddPawnLight 0x790561 -> 0x8b5193..0x8b51b4: radius 30, .2 seconds, white.
    { phase: "explosion", effectClass: "LineageEffect.m_u026_d", host: "target", owner: "target", position: "lastTarget", rotation: "hit", radiusOffset: -1.2, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true } }
];

export default effects;
