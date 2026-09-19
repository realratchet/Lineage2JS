import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x7a18f6/0x7a1948/0x7a1954: s_u505_a, PHYS_None, ShotTime.
    // 0x7a1984 -> 0x79e29c uses bone 2; only named attachment reaches RelativeRotation(0,16384,0) at 0x7a1994..0x7a19ba.
    { phase: "casting", effectClass: "LineageEffect.s_u505_a", host: "caster", position: "center", physics: "none", lifeSpan: "shotTime", boneProperty: "LeftHandBone", boneFallback: 2, relativeRotation: [0, 16384, 0], relativeRotationOnNamedBone: true },
    // Engine.dll Shot 0x7af924/0x7af976: s_u505_b, PHYS_None; LeftHandBone at 0x7af987, NAME_None fallback 2 at 0x7af9c5.
    { phase: "shot", effectClass: "LineageEffect.s_u505_b", host: "caster", position: "center", physics: "none", boneProperty: "LeftHandBone", boneFallback: 2 },
    // Engine.dll Explosion 0x791919..0x7919a6: LastTargetLocation - rotated (1.2 * target radius); s_u505_c at 0x791a6b, target owner at 0x791a8e.
    { phase: "explosion", effectClass: "LineageEffect.s_u505_c", host: "target", owner: "target", position: "lastTarget", rotation: "hit", radiusOffset: -1.2, damageEffect: true }
];

export default effects;
