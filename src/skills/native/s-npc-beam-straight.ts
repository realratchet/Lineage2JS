import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7acc39..0x7acc69: radius * direction; 0x7acc3f/0x7acc6f: FVector::operator/(1.5), giving radius * 2/3.
const effects: NativeSkillEffect_T[] = [
    // 0x7acbd0: DesiredRotation; 0x7acc7a..0x7acc96: caster Location; 0x7acced/0x7accee: caster host/owner.
    { phase: "shot", effectClass: "LineageEffect.e_u034_a", host: "caster", position: "center", rotation: "caster", radiusOffset: 2 / 3, offsetRotation: "desiredCaster" },
    // 0x7acd29..0x7acd48 reuses the launch location; 0x7aee40..0x7aee49 spawns the projectile with caster host/owner.
    { phase: "shot", effectClass: "LineageEffect.e_u034_b", host: "caster", position: "center", rotation: "caster", radiusOffset: 2 / 3, offsetRotation: "desiredCaster", projectile: { target: "target" } },
    // 0x790e4a: SkillSpeedRate; 0x790ed2..0x790ee7: target owner/absolute bone 0; 0x790f2f..0x790fbe: light offset=-2*1.2*radius; 0x791010..0x791031: radius=30, lifetime=.3, white.
    { phase: "explosion", effectClass: "LineageEffect.e_u034_c", host: "target", owner: "target", bone: 0, isAbsolute: true, useSkillSpeed: true, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.3, spot: true, position: "lastTarget", rotation: "hit", radiusOffset: -2.4 } }
];

export default effects;
