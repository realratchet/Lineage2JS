import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x7a18f6/0x7a1948/0x7a1954: s_u505_a, PHYS_None, ShotTime.
    // 0x7a1984 -> 0x79e29c uses bone 2; only named attachment reaches RelativeRotation(0,16384,0) at 0x7a1994..0x7a19ba.
    { phase: "casting", effectClass: "LineageEffect.s_u505_a", host: "caster", position: "center", physics: "none", lifeSpan: "shotTime", boneProperty: "LeftHandBone", boneFallback: 2, relativeRotation: [0, 16384, 0], relativeRotationOnNamedBone: true },
    // Engine.dll Shot 0x7af924/0x7af976: s_u505_b, PHYS_None; LeftHandBone at 0x7af987, NAME_None fallback 2 at 0x7af9c5.
    { phase: "shot", effectClass: "LineageEffect.s_u505_b", host: "caster", position: "center", physics: "none", boneProperty: "LeftHandBone", boneFallback: 2 },
    // Engine.dll 0x7918db rejects null hits; 0x7919ee adds the hit-Pawn white light before DamageEffect and s_u505_c.
    { phase: "explosion", effectClass: "LineageEffect.s_u505_c", host: "impactActor", hitActor: true, pawnLightOnly: true, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2 } },
    // 0x7919f3..0x791a5f: hit-Pawn DamageEffect first, with hit actor Owner and the shared radius-adjusted impact transform.
    { phase: "explosion", effectClass: "LineageEffect.s_u505_c", host: "impactActor", owner: "impactActor", hitActor: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2, damageEffect: "only" },
    // 0x791a62..0x791ad5: s_u505_c follows DamageEffect; actual-hit CollisionRadius factor1.2 at 0x791919..0x7919a6.
    { phase: "explosion", effectClass: "LineageEffect.s_u505_c", host: "impactActor", owner: "impactActor", hitActor: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2 }
];

export default effects;
