import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll 0x79dcd1/0x79dd0f: -X * radius * float[0xab0d1c]=2/3; mode 1 at 0x79dd69, class at 0x79dd83.
    { phase: "casting", effectClass: "LineageEffect.m_u044_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", speedRate: 1 },
    // 0x7a8198..0x7a8204: non-NPC Pawn, named GetLArmBoneName; vtable+0x220 -> 0x5e2e68 -> 0x60b9b0 reads LeftArmBone (+0x41c).
    // 0x7a8263/0x7a8298/0x7a82ba..0x7a82f1: m_u044_b, AttachToBone(false), RelativeRotation=(0,16384,0), RelativeLocation=(0,-7,0).
    { phase: "shot", effectClass: "LineageEffect.m_u044_b", host: "target", owner: "target", targetIsNpc: false, boneProperty: "LeftArmBone", bonePropertyRequired: true, relativeRotation: [0, 16384, 0], relativeLocation: [0, -7, 0], rotation: "zero" }
];

export default effects;
