import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x7a0b7e..0x7a0caa: target direction * caster radius * 2; 0x7a0ced..0x7a0d03: ShotTime and relative trailer X=radius*2.
    // 0x7a0d33..0x7a0d92: spotlight color(.7,0,0), radius30, ShotTime; 0x7a0d97..0x7a0daf: captured caster-center target.
    { phase: "casting", effectClass: "LineageEffect.m_u025_a", host: "caster", attach: "trail", position: "center", radiusOffset: 2, offsetRotation: "targetDirection", relativeTrailOffset: 2, lifeSpan: "shotTime", pawnLight: { color: [0.7, 0, 0], radius: 30, spot: true, target: "caster" } },
    // Shot 0x7af364..0x7af3c4: caster center + direction*radius*2; 0x7af376/0x7af37c: supplied rate1; 0x7af408/0x7af413/0x7af414: m_u025_b, caster owner, null host.
    { phase: "shot", effectClass: "LineageEffect.m_u025_b", host: "caster", position: "center", radiusOffset: 2, offsetRotation: "targetDirection", speedRate: 1 },
    // 0x7af4ff..0x7af570: m_u025_c, rate1, no trailer, target host/owner; SpawnSkillEffect 0x798505..0x798523 takes host Location/Rotation.
    { phase: "shot", effectClass: "LineageEffect.m_u025_c", host: "target", owner: "target", position: "center", rotation: "target", speedRate: 1 }
];

export default effects;
