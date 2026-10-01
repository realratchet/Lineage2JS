import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79e3c7/0x79e405: negative X * radius * float[0xab0d1c]=2/3; class 0x79e479; caster host/owner 0x7a12f4/0x7a12f5.
    { phase: "casting", effectClass: "LineageEffect.m_u001_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    // Shot 0x7a8e41..0x7a8e45: copy rate 1; 0x7a8e99: mode 1 trailer; class 0x7a8ea6; 0x7a8ed7..0x7a8ee9: SetSizeScale(target radius * float[0xaabad4]=1/9).
    // 0x7a8d32..0x7a8e2c: ordered list; 0x7a8d64 retains the previous emitter on null, then 0x7a8e08 dereferences that null target.
    { phase: "shot", effectClass: "LineageEffect.m_u001_b", host: "target", owner: "target", attach: "trail", scale: "targetRadius", speedRate: 1, associatedActors: "targetExcepted", rejectNullAfterSpawn: true }
];

export default effects;
