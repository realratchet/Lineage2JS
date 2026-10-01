import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a1220: DesiredRotation; 0x7a1275: radius * float[0xab0d1c]=2/3; 0x7a1289..0x7a128d: SpeedRate=1; class 0x7a12e9.
// Engine.dll Shot 0x7a7df6: associated targets unless primary is null; 0x7a7ea1/0x7a8055: class; SpawnSkillEffect 0x7a7eb4/0x7a806a; location mode 2 at 0x7a7e94/0x7a8048.
// TODO: FNPawnLight kind 2/type 7/effect 17/mode 1, lifetime 0.5 and radius 20 (0x7a7ef0..0x7a7f88).
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.s_u010_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", speedRate: 1 },
    { phase: "shot", effectClass: "LineageEffect.s_u011_a", host: "target", owner: "target", attach: "trail", position: "center", associatedActors: "targetExcepted" }
];

export default effects;
