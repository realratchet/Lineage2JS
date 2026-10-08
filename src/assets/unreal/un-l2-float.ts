import UAActor from "./un-aactor";
import type FVector from "./un-vector";

export enum TagState_T {
    L2TAG_NONE,
    L2TAG_WAIT,
    L2TAG_BATTLE
}

export abstract class UL2Float extends UAActor {
    declare public readonly State: TagState_T;
    declare public readonly FishType: number;
    declare public readonly Gut: boolean;
    declare public readonly WaterEffectTimer: number;
    declare public readonly OldEffectLoc: FVector;
    declare public readonly fEffectElapsedTime: number;
    declare public readonly EffectType: number;
    declare public readonly OrgLocation: FVector;
    declare public readonly WaitAnimName: string;
    declare public readonly BattleAnimName: string;
    declare public readonly BattleWaitAnimName: string[];

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "State": "State",
            "FishType": "FishType",
            "Gut": "Gut",
            "WaterEffectTimer": "WaterEffectTimer",
            "OldEffectLoc": "OldEffectLoc",
            "fEffectElapsedTime": "fEffectElapsedTime",
            "EffectType": "EffectType",
            "OrgLocation": "OrgLocation",
            "WaitAnimName": "WaitAnimName",
            "BattleAnimName": "BattleAnimName",
            "BattleWaitAnimName": "BattleWaitAnimName"
        });
    }
}

export default UL2Float;
