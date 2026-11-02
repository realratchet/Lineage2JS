import UObject from "./un-object";
import type FRotator from "./un-rotator";
import type FVector from "./un-vector";

export abstract class UNMagicInfo extends UObject {
    public static readonly plainStructFields = true;

    declare public agent: UObject;
    declare public dummyPtr: number;
    declare public magicId: number;
    declare public levelId: number;
    declare public aniIndex: number;
    declare public flexibleAniIndex: number;
    declare public stageShot: number;
    declare public stagePreshot: number;
    declare public skillHitTime: number;
    declare public shotTime: number;
    declare public tweenTime: number;
    declare public activeTime: number;
    declare public targetPawn: UObject;
    declare public magicSpeed: number;
    declare public magicAniStatus: number;
    declare public magicType: number;
    declare public isTargetExcepted: boolean;
    declare public nSlice: number;
    declare public normalRotationRate: FRotator;
    declare public skillRotationRate: FRotator;
    public associatedActor: UObject[] = [];
    public effectActor: UObject[] = [];
    public effectId: number[] = [];
    public locList: FVector[] = [];
    declare public anis: string[];
    declare public aniDues: number[];
    declare public lastShotName: string;
    declare public pendingNotify: number;
    declare public pendingPreshotNotify: number;

    protected getPropertyMap() {
        return {
            "Agent": "agent",
            "DummyPtr": "dummyPtr",
            "MagicID": "magicId",
            "LevelID": "levelId",
            "AniIndex": "aniIndex",
            "FlexibleAniIndex": "flexibleAniIndex",
            "StageShot": "stageShot",
            "StagePreshot": "stagePreshot",
            "SkillHitTime": "skillHitTime",
            "ShotTime": "shotTime",
            "TweenTime": "tweenTime",
            "ActiveTime": "activeTime",
            "TargetPawn": "targetPawn",
            "MagicSpeed": "magicSpeed",
            "MagicAniStatus": "magicAniStatus",
            "MagicType": "magicType",
            "bTargetExcepted": "isTargetExcepted",
            "nSlice": "nSlice",
            "NormalRotationRate": "normalRotationRate",
            "SkillRotationRate": "skillRotationRate",
            "AssociatedActor": "associatedActor",
            "EffectActor": "effectActor",
            "EffectID": "effectId",
            "LocLIst": "locList",
            "Anis": "anis",
            "AniDues": "aniDues",
            "LastShotName": "lastShotName",
            "PendingNotify": "pendingNotify",
            "PendingPreshotNotify": "pendingPreshotNotify"
        };
    }
}

export default UNMagicInfo;
