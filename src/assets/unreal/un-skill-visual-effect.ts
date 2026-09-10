import UObject from "./un-object";
import type { Constructable_T, UClass } from "@l2js/core";
import type FVector from "./un-vector";

export abstract class USkillAction extends UObject {
    declare public effectClass: UClass;
    declare public onMultiTarget: boolean;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), { "EffectClass": "effectClass", "bOnMultiTarget": "onMultiTarget" });
    }
}

export abstract class FSkillActionInfo extends UObject implements Constructable_T {
    declare public action: USkillAction;
    declare public specificStage: number;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), { "Action": "action", "SpecificStage": "specificStage" });
    }
}

export abstract class USkillVisualEffect extends UObject {
    declare public description: string;
    declare public castingActions: FSkillActionInfo[];
    declare public channelingActions: FSkillActionInfo[];
    declare public preshotActions: FSkillActionInfo[];
    declare public shotActions: FSkillActionInfo[];
    declare public explosionActions: FSkillActionInfo[];
    declare public flyingTime: number;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), { "Desc": "description", "CastingActions": "castingActions", "ChannelingActions": "channelingActions", "PreshotActions": "preshotActions", "ShotActions": "shotActions", "ExplosionActions": "explosionActions", "FlyingTime": "flyingTime" });
    }
}

export abstract class USkillActionLocateEffect extends USkillAction {
    declare public attachOn: number;
    declare public attachBoneName: string;
    declare public isAbsolute: boolean;
    declare public spawnDelay: number;
    declare public useCharacterRotation: boolean;
    declare public offset: FVector;
    declare public relativeToCylinder: boolean;
    declare public spawnOnTarget: boolean;
    declare public sizeScale: boolean;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), { "AttachOn": "attachOn", "AttachBoneName": "attachBoneName", "bAbsolute": "isAbsolute", "SpawnDelay": "spawnDelay", "bUseCharacterRotation": "useCharacterRotation", "offset": "offset", "bRelativeToCylinder": "relativeToCylinder", "bSpawnOnTarget": "spawnOnTarget", "bSizeScale": "sizeScale" });
    }
}

export abstract class USkillActionSwordTrail extends USkillAction {
    declare public durationRatio: number;
    declare public isRightHand: boolean;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), { "DurationRatio": "durationRatio", "bRightHand": "isRightHand" });
    }
}

export default USkillVisualEffect;
