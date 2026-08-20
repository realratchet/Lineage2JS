import UVolume from "./un-volume";

abstract class UPhysicsVolume extends UVolume {
    declare public readonly isPhysicsVolume: boolean;

    declare protected zoneVelocity: GA.FVector;
    declare protected gravity: GA.FVector;
    declare protected terminalVelocity: number;
    declare protected priority: number;
    declare protected fluidFriction: number;
    declare protected isWaterVolume: boolean;
    declare protected isL2WaterVolume: boolean;
    declare protected useDistanceFogColor: boolean;
    declare protected useCellophane: boolean;
    declare protected cellophaneColor: GA.FColor;
    // protected locationPriority: number;
    // protected locationName: string;

    // protected _bPainCausing: any;
    // protected _zoneVelocity: any;
    // protected _gravity: any;
    // protected _groundFriction: any;
    // protected _terminalVelocity: any;
    // protected _damagePerSec: any;
    // protected _damageType: any;
    // protected _priority: any;
    // protected _entrySound: any;
    // protected _exitSound: any;
    // protected _entryActor: any;
    // protected _exitActor: any;
    // protected _fluidFriction: any;
    // protected _viewFlash: any;
    // protected _viewFog: any;
    // protected _bDestructive: any;
    // protected _bNoInventory: any;
    // protected _bMoveProjectiles: any;
    // protected _bBounceVelocity: any;
    // protected _bNeutralZone: any;
    // protected _bWaterVolume: any;
    // protected _painTimer: any;
    // protected _bUseDistanceFogColor: any;
    // protected _bUseCellophane: any;
    // protected _cellophaneColor: any;
    // protected _kExtraLinearDamping: any;
    // protected _kExtraAngularDamping: any;
    // protected _kBuoyancy: any;
    // protected _nextPhysicsVolume: any;
    // protected _bL2WaterVolume: any;
    // protected _bL2StepVolume: any;
    // protected _stepSoundID: any;

    declare protected waitHitEffect: string;
    declare protected runHitEffect: string;

    public constructor() {
        super();

        (this as any).isPhysicsVolume = true;
    }

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
    //         "LocationPriority": "locationPriority",
    //         "LocationName": "locationName",
    //         "DecoList": "decoList",

    //         "bPainCausing": "_bPainCausing",
            "ZoneVelocity": "zoneVelocity",
            "Gravity": "gravity",
    //         "GroundFriction": "_groundFriction",
            "TerminalVelocity": "terminalVelocity",
    //         "DamagePerSec": "_damagePerSec",
    //         "DamageType": "_damageType",
            "Priority": "priority",
    //         "EntrySound": "_entrySound",
    //         "ExitSound": "_exitSound",
    //         "EntryActor": "_entryActor",
    //         "ExitActor": "_exitActor",
            "FluidFriction": "fluidFriction",
    //         "ViewFlash": "_viewFlash",
    //         "ViewFog": "_viewFog",
    //         "bDestructive": "_bDestructive",
    //         "bNoInventory": "_bNoInventory",
    //         "bMoveProjectiles": "_bMoveProjectiles",
    //         "bBounceVelocity": "_bBounceVelocity",
    //         "bNeutralZone": "_bNeutralZone",
            "bWaterVolume": "isWaterVolume",
    //         "PainTimer": "_painTimer",
            "bUseDistanceFogColor": "useDistanceFogColor",
            "bUseCellophane": "useCellophane",
            "CellophaneColor": "cellophaneColor",
    //         "KExtraLinearDamping": "_kExtraLinearDamping",
    //         "KExtraAngularDamping": "_kExtraAngularDamping",
    //         "KBuoyancy": "_kBuoyancy",
    //         "NextPhysicsVolume": "_nextPhysicsVolume",
            "bL2WaterVolume": "isL2WaterVolume",
    //         "bL2StepVolume": "_bL2StepVolume",
    //         "StepSoundID": "_stepSoundID",

            "WaitHitEffect": "waitHitEffect",
            "RunHitEffect": "runHitEffect",
        });
    }

    public getDecodeInfo(library: GD.DecodeLibrary): GD.IWaterVolumeDecodeInfo | null {
        if (!this.isWaterVolume && !this.isL2WaterVolume && this.constructor.friendlyName !== "WaterVolume") return null;
        if (!this.brush) return null;

        const zoneVelocity = this.zoneVelocity ? this.zoneVelocity.getElements() : [0, 0, 0] as GD.Vector3Arr;
        const gravity = this.gravity ? this.gravity.getElements() : [0, 0, -1500] as GD.Vector3Arr;
        // L2.water.trace 4621-4622: Env.int fog replaces DistanceFog unless bUseDistanceFogColor.
        const fog = this.useDistanceFogColor && this.hasDistanceFog && this.distanceFogColor ? {
            color: this.distanceFogColor.toArray() as GD.ColorArr,
            start: this.distanceFogStart,
            end: this.distanceFogEnd
        } : null;

        return {
            ...super.getDecodeInfo(library),
            type: "WaterVolume",
            priority: this.priority ?? this.locationPriority ?? 0,
            fluidFriction: this.fluidFriction ?? 2.4,
            gravity,
            terminalVelocity: this.terminalVelocity ?? 2500,
            zoneVelocity,
            fog,
            cellophane: this.useCellophane && this.cellophaneColor ? this.cellophaneColor.toArray() as GD.ColorArr : null,
            waitHitEffect: this.waitHitEffect ?? null,
            runHitEffect: this.runHitEffect ?? null,
            bsp: this.getWorldBspInfo()
        };
    }
}

export default UPhysicsVolume;
export { UPhysicsVolume };
