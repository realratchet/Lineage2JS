import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll 0x79d8e0/0x79d917: mode 0 trailer; 0x79d926..0x79d930: RelativeTrailOffset.X=2*radius, no LifeSpan write.
    // 0x79d933..0x79d9f5: pawn light RGB .7/.3/.3, radius 30, spot at caster Location, ShotTime lifetime.
    { phase: "casting", effectClass: "LineageEffect.m_u034_a", host: "caster", attach: "trail", position: "center", radiusOffset: 2, offsetRotation: "targetDirection", relativeTrailOffset: 2, pawnLight: { color: [0.7, 0.3, 0.3], radius: 30, spot: true, target: "caster" } },
    // 0x7a7c2e..0x7a7c9a: caster Location+direction*2*radius, mode 0, zero Rotation, SpeedRate=1.
    { phase: "shot", effectClass: "LineageEffect.m_u034_b", host: "caster", position: "center", radiusOffset: 2, offsetRotation: "targetDirection", rotation: "zero", speedRate: 1 },
    // 0x7a7ca7..0x7a7de8: bTargetExcepted selects list OR primary; mode 2 trailer, zero offset/Rotation, SpeedRate=1.
    { phase: "shot", effectClass: "LineageEffect.m_u034_c", host: "target", owner: "target", attach: "trail", position: "center", rotation: "zero", speedRate: 1, associatedActors: "targetExcepted" }
];

export default effects;
