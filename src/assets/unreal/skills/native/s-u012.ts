import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7a6526 -> 0xab1e38; mode 1 at 0x7a6519; 0x7a653a retains caster for Shot sound.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.s_u012_a", host: "caster", attach: "trail", rotation: "zero", speedRate: 1, soundWithoutEffect: true }];

export default effects;
