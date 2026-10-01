import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7a64b6 -> 0xab1e70; mode 1 at 0x7a64a9; 0x7a653a retains caster for Shot sound.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.s_u009_a", host: "caster", attach: "trail", rotation: "zero", speedRate: 1, soundWithoutEffect: true }];

export default effects;
