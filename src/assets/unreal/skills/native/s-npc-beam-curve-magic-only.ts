import straight from "./s-npc-beam-straight";
import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7acd4d; 0x7acef4/0x7acf1e: PrepareInterpolation(1200, targetLocation - caster.Location).
const effects: NativeSkillEffect_T[] = straight.map(effect => effect.projectile ? { ...effect, projectile: { target: "target", interpolation: 1200 } } : effect);

export default effects;
