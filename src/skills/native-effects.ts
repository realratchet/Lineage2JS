import eU063A from "./native/e-u063-a";
import eU064A from "./native/e-u064-a";
import eU064Cloud from "./native/e-u064-cloud";
import eU065A from "./native/e-u065-a";
import eU066A from "./native/e-u066-a";
import eU067A from "./native/e-u067-a";
import eU067Hand from "./native/e-u067-hand";
import sU010A from "./native/s-u010-a";
import pU004A from "./native/p-u004-a";
import mU019A from "./native/m-u019-a";
import mU019B from "./native/m-u019-b";
import mU018A from "./native/m-u018-a";
import mU018B from "./native/m-u018-b";
import mU013A from "./native/m-u013-a";
import mU013C from "./native/m-u013-c";
import mU007A from "./native/m-u007-a";
import mU007B from "./native/m-u007-b";
import mU033A from "./native/m-u033-a";
import mU033B from "./native/m-u033-b";
import type { NpcSkillEffectPhase_T } from "@l2js/engine/contracts/pawn";

type NativeSkillEffect_T = {
    phase: NpcSkillEffectPhase_T;
    effectClass: string;
    host: "caster" | "target";
    attach?: "trail" | "rightHand";
    bone?: number;
    isAbsolute?: boolean;
    rotation?: "caster" | "desiredCaster" | "targetPosition" | "targetDirection";
    position?: "center";
    radiusOffset?: number;
    scale?: "casterRadius" | "cancelCasterRadius";
    delay?: number;
    hitDelay?: number;
    offset?: [number, number, number];
    pawnLight?: { color: [number, number, number], radius: number };
};

const nativeEffects: Record<string, NativeSkillEffect_T[]> = {
    "lineageeffect.e_u063_a": eU063A,
    "lineageeffect.e_u064_a": eU064A,
    "lineageeffect.e_u064_cloud": eU064Cloud,
    "lineageeffect.e_u065_a": eU065A,
    "lineageeffect.e_u066_a": eU066A,
    "lineageeffect.e_u067_a": eU067A,
    "lineageeffect.e_u067_hand": eU067Hand,
    "lineageeffect.s_u010_a": sU010A,
    "lineageeffect.p_u004_a": pU004A,
    "lineageeffect.m_u019_a": mU019A,
    "lineageeffect.m_u019_b": mU019B,
    "lineageeffect.m_u018_a": mU018A,
    "lineageeffect.m_u018_b": mU018B,
    "lineageeffect.m_u013_a": mU013A,
    "lineageeffect.m_u013_c": mU013C,
    "lineageeffect.m_u007_a": mU007A,
    "lineageeffect.m_u007_b": mU007B,
    "lineageeffect.m_u033_a": mU033A,
    "lineageeffect.m_u033_b": mU033B
};

function getNativeEffect(name: string): NativeSkillEffect_T[] {
    const effects = nativeEffects[name.toLowerCase()];

    if (!effects) throw new Error(`Native effect '${name}' is not implemented.`);

    return effects;
}

export default getNativeEffect;
export { type NativeSkillEffect_T };
