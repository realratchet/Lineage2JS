import UAActor from "./un-aactor";
import type FVector from "./un-vector";

export enum TagState_T {
    L2TAG_NONE,
    L2TAG_WAIT,
    L2TAG_BATTLE
}

export abstract class UL2Float extends UAActor {
    declare public readonly state: TagState_T;
    declare public readonly fishType: number;
    declare public readonly gut: boolean;
    declare public readonly waterEffectTimer: number;
    declare public readonly oldEffectLocation: FVector;
    declare public readonly effectElapsedTime: number;
    declare public readonly effectType: number;
    declare public readonly originalLocation: FVector;
    declare public readonly waitAnimName: string;
    declare public readonly battleAnimName: string;
    declare public readonly battleWaitAnimName: string[];

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "State": "state",
            "FishType": "fishType",
            "Gut": "gut",
            "WaterEffectTimer": "waterEffectTimer",
            "OldEffectLoc": "oldEffectLocation",
            "fEffectElapsedTime": "effectElapsedTime",
            "EffectType": "effectType",
            "OrgLocation": "originalLocation",
            "WaitAnimName": "waitAnimName",
            "BattleAnimName": "battleAnimName",
            "BattleWaitAnimName": "battleWaitAnimName"
        });
    }
}

export default UL2Float;
