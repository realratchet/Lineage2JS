// import FVector from "./un-vector";
// import FRotator from "./un-rotator";
import UObject from "@l2js/core";
import { generateUUID } from "three/src/math/MathUtils";

abstract class UAActor extends UObject {
    declare protected texModifyInfo: GA.UTextureModifyInfo;
    declare protected isDynamicActorFilterState: boolean;
    declare protected level: GA.ULevel;
    declare protected region: GA.UPointRegion;
    declare protected drawScale: number;
    declare protected tag: string;
    declare protected group: string;
    declare protected isSunAffected: boolean;
    declare protected physicsVolume: GA.UPhysicsVolume;
    declare public readonly location: GA.FVector;
    declare public readonly rotation: GA.FRotator;
    declare public readonly scale: GA.FVector;
    declare protected swayRotationOrig: GA.FRotator;

    declare protected hasDistanceFog: boolean;
    declare protected distanceFogEnd: number;
    declare protected distanceFogStart: number;
    declare protected distanceFogColor: GA.FColor;

    declare protected isHiddenInEditor: boolean;
    declare protected isLightChanged: boolean;
    declare protected isDeleteMe: boolean;
    declare protected isPendingDelete: boolean;
    declare protected isSelected: boolean;

    declare protected mainScale: GA.FScale;
    // protected dummy: boolean;

    // protected _mesh: any;
    declare protected forcedRegionTag: string;

    declare protected skins: C.FObjectArray<GA.UTexture>;
    declare protected style: ERenderStyle_T;
    declare protected isIgnoredRange: boolean;
    declare protected isDirectional: boolean;

    declare protected postScale: GA.FScale;
    declare protected polyFlags: number;
    declare protected brush: GA.UModel;
    declare protected prePivot: GA.FVector;
    declare protected postPivot: GA.FVector;
    declare protected isRangeIgnored: boolean;
    declare protected isBlockingActors: boolean;
    declare protected isBlockingPlayers: boolean;
    declare protected isBlockingKarma: boolean;
    declare protected isDynamicLight: boolean;
    declare protected isStaticLighting: boolean;

    declare protected isCastingShadow: boolean;


    public getRegion() { return this.region; }
    public getZone() { return this.region?.loadSelf().getZone(); }

    protected getRegionLineHelper(library: GD.DecodeLibrary, color: [number, number, number] = [1, 0, 1], ignoreDepth: boolean = false) {
        const lineGeometryUuid = generateUUID();
        const _a = this.region.getZone().location;
        const _b = this.location;

        const a = new FVector(_a.x, _a.z, _a.y);
        const b = new FVector(_b.x, _b.z, _b.y);

        const geoPosition = a.sub(b).applyRotator(this.rotation, true);
        const regionHelper = {
            type: "Edges",
            geometry: lineGeometryUuid,
            color,
            ignoreDepth
        } as GD.IEdgesObjectDecodeInfo;

        library.geometries[lineGeometryUuid] = {
            indices: new Uint8Array([0, 1]),
            attributes: {
                positions: new Float32Array([
                    0, 0, 0,
                    geoPosition.x, geoPosition.y, geoPosition.z
                ])
            }
        };

        return regionHelper;
    }

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "MainScale": "mainScale",

            "bDynamicActorFilterState": "isDynamicActorFilterState",
            "Level": "level",
            "Region": "region",
            "Tag": "tag",
            "bSunAffect": "isSunAffected",
            "PhysicsVolume": "physicsVolume",
            "Location": "location",
            "Rotation": "rotation",
            "SwayRotationOrig": "swayRotationOrig",
            "DrawScale": "drawScale",
            "TexModifyInfo": "texModifyInfo",
            "DrawScale3D": "scale",
            "Group": "group",

            "bDistanceFog": "hasDistanceFog",
            "DistanceFogEnd": "distanceFogEnd",
            "DistanceFogStart": "distanceFogStart",
            "DistanceFogColor": "distanceFogColor",

            "bHiddenEd": "isHiddenInEditor",
            "bLightChanged": "isLightChanged",
            "bSelected": "isSelected",

            "bDeleteMe": "isDeleteMe",
            "bPendingDelete": "isPendingDelete",

            "ForcedRegionTag": "forcedRegionTag",
            "Skins": "skins",
            "Style": "style",
            "bDirectional": "isDirectional",

            "bShadowCast": "isCastingShadow",
            "PostScale": "postScale",
            "PolyFlags": "polyFlags",
            "Brush": "brush",
            "PrePivot": "prePivot",
            "PostPivot": "postPivot",
            "bIgnoredRange": "isRangeIgnored",
            "bBlockActors": "isBlockingActors",
            "bBlockPlayers": "isBlockingPlayers",
            "bBlockKarma": "isBlockingKarma",
            "bDynamicLight": "isDynamicLight",
            "bStaticLighting": "isStaticLighting"
        });
    };
}

export default UAActor;
export { UAActor };

enum ERenderStyle_T {
    STY_None,
    STY_Normal,
    STY_Masked,
    STY_Translucent,
    STY_Modulated,
    STY_Alpha,
    STY_Additive,
    STY_Subtractive,
    STY_Particle,
    STY_AlphaZ,
};

enum EPhysics_T {
    PHYS_None,
    PHYS_Walking,
    PHYS_Falling,
    PHYS_Swimming,
    PHYS_Flying,
    PHYS_Rotating,
    PHYS_Projectile,
    PHYS_Interpolating,
    PHYS_MovingBrush,
    PHYS_Spider,
    PHYS_Trailer,
    PHYS_Ladder,
    PHYS_RootMotion,
    PHYS_Karma,
    PHYS_KarmaRagDoll,
    PHYS_MovingTrailer,
    PHYS_EffectTrailer,
    PHYS_NProjectile,
    PHYS_NMover,
    PHYS_L2Movement,
};

enum EDrawType_T {
    DT_None,
    DT_Sprite,
    DT_Mesh,
    DT_Brush,
    DT_RopeSprite,
    DT_VerticalSprite,
    DT_Terraform,
    DT_SpriteAnimOnce,
    DT_StaticMesh,
    DT_DrawType,
    DT_Particle,
    DT_AntiPortal,
    DT_FluidSurface,
    DT_Sun,
    DT_MusicVolume,
    DT_Custom // need collision detection even without its mesh
};

enum EFilterState_T {
    FS_Maybe,
    FS_Yes,
    FS_No
};

enum EDetailMode_T {
    DM_Low,
    DM_High,
    DM_SuperHigh
};

enum EL2EventCmd_T {
    LEC_None,
    LEC_Show,
    LEC_Play
};