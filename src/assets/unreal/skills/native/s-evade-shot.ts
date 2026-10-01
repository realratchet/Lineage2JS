import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Explosion 0x78e963 rejects null hits; 0x78ea26..0x78ea65 lights the hit Pawn at LastTargetLocation - HitRot*1.2*radius.
    { phase: "explosion", effectClass: "LineageEffect.sp_agility_ta", host: "impactActor", hitActor: true, pawnLightOnly: true, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2 } },
    // 0x78ea6f..0x78eae9: SpawnActor with projectile Owner; 0x78eb27..0x78eb46: PHYS_Trailer, bTrailerPrePivot set, bTrailerSameRotation cleared.
    { phase: "explosion", effectClass: "LineageEffect.sp_agility_ta", host: "impactActor", hitActor: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2, physics: "trailer" },
    // 0x78eb4d..0x78e94f: hit-Pawn DamageEffect with hit actor Owner.
    { phase: "explosion", effectClass: "LineageEffect.sp_agility_ta", host: "impactActor", owner: "impactActor", hitActor: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2, damageEffect: "only" }
];

export default effects;
