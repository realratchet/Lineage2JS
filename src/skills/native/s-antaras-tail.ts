import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7aa02b/0x7aa03a/0x7aa046: forward vector * float[0xab1934]=600, subtracted from caster Location at 0x7aa04f..0x7aa064.
// 0x7aa070..0x7aa0b3: target mesh height; 0x7aa0b1/0x7aa0b8: SpeedRate1; 0x7aa0f5/0x7aa0f6: caster owner, null host.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u051_a", host: "caster", rotation: "caster", forwardOffset: -600, height: "targetMeshOrigin", speedRate: 1 }
];

export default effects;
