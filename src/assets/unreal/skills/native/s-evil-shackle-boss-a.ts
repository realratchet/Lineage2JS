import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x7a0fea..0x7a104d: mode2 caster trailer, rate1; 0x7a1059..0x7a106b: cancel radius scale with float[0xab0600]=9 / radius.
    { phase: "casting", effectClass: "LineageEffect.e_u504_a", host: "caster", attach: "trail", position: "center", scale: "cancelCasterRadius", speedRate: 1 },
    // 0x7a1076..0x7a10d4: zero location/rotation, null host, caster owner; 0x7a10df..0x7a1140: ShotTime+float[0xa61558]=1, right hand or bone2, named RelativeLocation.X=20.
    { phase: "casting", effectClass: "LineageEffect.e_u504_rh", host: "caster", location: [0, 0, 0], boneProperty: "RightHandBone", boneFallback: 2, lifeSpan: "shotTime", lifeSpanOffset: 1, speedRate: 1, relativeLocation: [20, 0, 0], relativeLocationOnNamedBone: true },
    // 0x7a1145..0x7a121b: same e_u504_rh on LeftHandBone; 0x79e29c: NAME_None uses bone2 without the relative-location write.
    { phase: "casting", effectClass: "LineageEffect.e_u504_rh", host: "caster", location: [0, 0, 0], boneProperty: "LeftHandBone", boneFallback: 2, lifeSpan: "shotTime", lifeSpanOffset: 1, speedRate: 1, relativeLocation: [20, 0, 0], relativeLocationOnNamedBone: true },
    // Shot 0x7ac895..0x7ac91e: e_u504_b at target center minus height, target rotation, null host/owner, no projectile.
    { phase: "shot", effectClass: "LineageEffect.e_u504_b", host: "target", owner: "none", rotation: "target" }
];

export default effects;
