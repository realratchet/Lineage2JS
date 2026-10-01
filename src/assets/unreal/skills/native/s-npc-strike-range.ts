import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x7a029f..0x7a02d4: e_u057_a at caster center, LifeSpan=ShotTime, RightHandBone; 0x79e29c: NAME_None uses bone 2.
    { phase: "casting", effectClass: "LineageEffect.e_u057_a", host: "caster", position: "center", boneProperty: "RightHandBone", boneFallback: 2, lifeSpan: "shotTime" },
    // Engine.dll Shot 0x7acb63/0x7acbb9: trailer, location mode 1; 0x7acbc6 -> 0x7ac0c6: e_u057_b, target host/owner.
    { phase: "shot", effectClass: "LineageEffect.e_u057_b", host: "target", owner: "target", attach: "trail" }
];

export default effects;
