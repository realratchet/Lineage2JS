import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a131a; Shot 0x7afafb..0x7afffd; FNMover mode NMT_USEPATH.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u003_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    { phase: "shot", effectClass: "LineageEffect.m_u003_c", host: "target", owner: "target", attach: "trail", position: "center", trailerPrePivot: "casterMeshOrigin" },
    { phase: "shot", effectClass: "LineageEffect.m_u003_b", host: "target", position: "center", rotation: "caster", projectile: { target: "caster", speed: 0.1, acceleration: 450, path: [[-0.2, 30, 30], [1, 0, 0]] } },
    { phase: "shot", effectClass: "LineageEffect.m_u003_b", host: "target", position: "center", rotation: "caster", projectile: { target: "caster", speed: 0.1, acceleration: 450, path: [[-0.2, -30, 30], [1, 0, 0]] } }
];

export default effects;
