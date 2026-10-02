import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a131a; Shot 0x7afafb..0x7afffd; FNMover mode NMT_USEPATH.
// Init 0x7a1331: negative X; 0x7a136f: radius*float[0xab0d1c]=radius*2/3; class push 0x7a13e3.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u003_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    { phase: "shot", effectClass: "LineageEffect.m_u003_c", host: "target", owner: "target", attach: "trail", position: "center", trailerPrePivot: "casterMeshOrigin" },
    // Engine.dll 0x7afd29/0x7afd35: speed=.1/acceleration=450; 0x7afd6e..0x7afdb2: path (-.2,30,30), (1,0,0).
    { phase: "shot", effectClass: "LineageEffect.m_u003_b", host: "target", position: "center", rotation: "caster", projectile: { target: "caster", speed: 0.1, acceleration: 450, path: [[-0.2, 30, 30], [1, 0, 0]] } },
    // Engine.dll 0x7aff1c/0x7aff28: speed=.1/acceleration=450; 0x7aff61..0x7affa5: path (-.2,-30,30), (1,0,0).
    { phase: "shot", effectClass: "LineageEffect.m_u003_b", host: "target", position: "center", rotation: "caster", projectile: { target: "caster", speed: 0.1, acceleration: 450, path: [[-0.2, -30, 30], [1, 0, 0]] } }
];

export default effects;
