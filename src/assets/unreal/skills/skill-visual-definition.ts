import getNativeEffect, { type NativeSkillEffect_T } from "./native-effects";
import { call, if_, while_, return_, compile } from "./skill-program";
import type { NativeSkillBinding_T } from "./native-skill-bindings";
import type { NpcSkillAttack_T, NpcSkillEffectAction_T, NpcSkillEffectPhase_T } from "../un-pawn";
import type { IScriptFunctionDecodeInfo } from "../script-dump-loader";

export type SkillVisualDefinition_T = {
    actions: NpcSkillEffectAction_T[] | null;
    effects: NativeSkillEffect_T[];
    soundPhases: NpcSkillEffectPhase_T[];
    finalShotOnly: boolean;
    transientRejected: boolean;
    associatedActors: boolean;
    programs: Record<NpcSkillEffectPhase_T, IScriptFunctionDecodeInfo>;
};

const programs = Object.fromEntries((["casting", "preshot", "shot", "explosion"] as NpcSkillEffectPhase_T[]).map(phase => [phase, {
    id: `SkillVisualEffect.${phase}`, owner: "SkillVisualEffect", name: phase, nativeIndex: 0, operatorPrecedence: 0, flags: 0, replicationOffset: 0, fields: [],
    program: compile([
        if_(call("BeginPhase", phase), [
            while_(call("NextAction"), [
                if_(call("NotifyAction"), [], [return_(call("PhaseResult"))])
            ]),
            call("EndPhase")
        ]),
        return_(call("PhaseResult"))
    ])
}])) as Record<NpcSkillEffectPhase_T, IScriptFunctionDecodeInfo>;

export function createSkillVisualDefinition(actions: NpcSkillEffectAction_T[] | null, native: NativeSkillBinding_T = null): SkillVisualDefinition_T {
    return { actions, effects: native ? native.effects.flatMap(name => getNativeEffect(name, native.effectGroup)) : [], soundPhases: native ? native.soundPhases : [], finalShotOnly: !!native?.finalShotOnly, transientRejected: !!native?.rejectTransient, associatedActors: !!native?.associatedActors, programs };
}

export function getSkillHitTimeOffset(skill: NpcSkillAttack_T): number {
    const hasVisual = skill.visual.actions !== null;

    return hasVisual && skill.flyingTime >= 0.15 ? skill.flyingTime : skill.castStyle === 3 ? 0 : !hasVisual && [2, 5, 8, 10].includes(skill.castStyle) ? 0.4 : 0.15;
}

export function hasSkillEffectPhase(skill: NpcSkillAttack_T, phase: NpcSkillEffectPhase_T): boolean {
    return (skill.visual.actions || skill.visual.effects).some(effect => effect.phase === phase);
}

export function getSkillPreviewListTarget(skill: NpcSkillAttack_T): "selected" | "primary" | null {
    if (skill.previewTarget === "self" && skill.visual.actions?.some(action => action.onMultiTarget)) return "selected";
    if (skill.visual.associatedActors || skill.visual.effects.some(effect => effect.phase === "shot" && effect.pawnLightOnly && effect.associatedActors)) return "primary";
    return null;
}

export default createSkillVisualDefinition;
