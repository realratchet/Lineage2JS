import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7a9104; Explosion 0x78f4aa, target attachment 0x78f6eb.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u033_a", host: "caster", position: "center", rotation: "caster" },
    { phase: "shot", effectClass: "LineageEffect.e_u033_b", host: "caster", position: "center", rotation: "caster", radiusOffset: 2 / 3, offsetRotation: "desiredCaster", projectile: { target: "target" } },
    { phase: "explosion", effectClass: "LineageEffect.e_u033_c", host: "target", owner: "target", bone: 0, isAbsolute: true, useSkillSpeed: true, pawnLight: { color: [1, 0, 0], radius: 30, lifeTime: 0.3, spot: true, position: "lastTarget", rotation: "hit", radiusOffset: -2.4 } }
];

export default effects;
