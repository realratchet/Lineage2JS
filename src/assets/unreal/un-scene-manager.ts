import UObject from "./un-object";
import type FVector from "./un-vector";
import type FRotator from "./un-rotator";

export enum EPathStyle_T {
    PATHSTYLE_Linear,
    PATHSTYLE_Bezier
}

export abstract class UInterpolationPoint extends UObject {
    declare public location: FVector;
    declare public rotation: FRotator;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), { "Location": "location", "Rotation": "rotation" });
    }
}

export abstract class UMatAction extends UObject {
    declare public intPoint: UInterpolationPoint;
    declare public duration: number;
    declare public startControlPoint: FVector;
    declare public endControlPoint: FVector;
    declare public isConstantPathVelocity: boolean;
    declare public pathVelocity: number;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), { "IntPoint": "intPoint", "Duration": "duration", "StartControlPoint": "startControlPoint", "EndControlPoint": "endControlPoint", "bConstantPathVelocity": "isConstantPathVelocity", "PathVelocity": "pathVelocity" });
    }
}

export abstract class UActionMoveCamera extends UMatAction {
    declare public pathStyle: EPathStyle_T;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), { "PathStyle": "pathStyle" });
    }
}

export abstract class USceneManager extends UObject {
    declare public tag: string;
    declare public actions: UMatAction[];

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), { "Tag": "tag", "Actions": "actions" });
    }
}

export default USceneManager;
