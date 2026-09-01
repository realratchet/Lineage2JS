// import FVector from "./un-vector";
// import FRotator from "./un-rotator";
import GMath from "./un-gmath";
import FMatrix from "./un-matrix";
import { APackage, UExport, type FObjectArray } from "@l2js/core";
import UObject from "./un-object";
import { generateUUID } from "three/src/math/MathUtils";
import type { UTextureModifyInfo } from "./un-texture-modify-info";
import type { ULevelInfo } from "./un-level-info";
import type { UPointRegion } from "./un-point-region";
import type { UPhysicsVolume } from "./un-physics-volume";
import type { FVector } from "./un-vector";
import type { FRotator } from "./un-rotator";
import type { FColor } from "./un-color";
import type { FScale } from "./un-scale";
import type { UTexture } from "./un-texture";
import type { UModel } from "./model/un-model";
import type { Matrix4Arr, Vector3Arr } from "./library-types";
import type { IBaseObjectDecodeInfo } from "./decode-library";

export type IActorCollisionDecodeInfo = {
    collideActors: boolean,
    collideWorld: boolean,
    blockActors: boolean,
    blockPlayers: boolean,
    blockZeroExtent: boolean,
    blockNonZeroExtent: boolean,
    worldGeometry: boolean,
    useCylinderCollision: boolean,
    collisionRadius: number,
    collisionHeight: number
};

export type IRotatingDecodeInfo = {
    rotator: Vector3Arr,
    rate: Vector3Arr
};

export type IEdgesObjectDecodeInfo = IBaseObjectDecodeInfo & {
    type: "Edges",
    geometry: string,
    color?: [number, number, number],
    ignoreDepth?: boolean
};

export abstract class UAActor extends UObject {
    declare public readonly texModifyInfo: UTextureModifyInfo;
    declare public readonly isDynamicActorFilterState: boolean;
    declare public readonly levelInfo: ULevelInfo;
    declare public readonly region: UPointRegion;
    declare public readonly drawScale: number;
    declare public readonly tag: string;
    declare public readonly l2MoveEvent: string;
    declare public readonly group: string;
    declare public readonly isSunAffected: boolean;
    declare public readonly physicsVolume: UPhysicsVolume;
    declare public readonly location: FVector;
    declare public readonly rotation: FRotator;
    declare public readonly scale: FVector;
    declare public readonly swayRotationOrig: FRotator;

    declare public readonly hasDistanceFog: boolean;
    declare public readonly distanceFogEnd: number;
    declare public readonly distanceFogStart: number;
    declare public readonly distanceFogColor: FColor;

    declare public readonly isHiddenInEditor: boolean;
    declare public readonly isLightChanged: boolean;
    declare public readonly isDeleteMe: boolean;
    declare public readonly isPendingDelete: boolean;
    declare public readonly isSelected: boolean;

    declare public readonly mainScale: FScale;
    // protected dummy: boolean;

    // protected _mesh: any;
    declare public readonly forcedRegionTag: string;
    declare public readonly forcedVisibilityZoneTag: string;

    declare public readonly skins: FObjectArray<UTexture>;
    declare public readonly style: ERenderStyle_T;
    declare public readonly isIgnoredRange: boolean;
    declare public readonly isDirectional: boolean;

    declare public readonly postScale: FScale;
    declare public readonly polyFlags: number;
    declare public readonly brush: UModel;
    declare public readonly prePivot: FVector;
    declare public readonly postPivot: FVector;
    declare public readonly isRangeIgnored: boolean;
    declare public readonly isBlockingActors: boolean;
    declare public readonly isBlockingPlayers: boolean;
    declare public readonly isCollidingActors: boolean;
    declare public readonly isCollidingWorld: boolean;
    declare public readonly isBlockingZeroExtentTraces: boolean;
    declare public readonly isBlockingNonZeroExtentTraces: boolean;
    declare public readonly isWorldGeometry: boolean;
    declare public readonly isUsingCylinderCollision: boolean;
    declare public readonly isBlockingKarma: boolean;
    declare public readonly isDynamicLight: boolean;
    declare public readonly isStaticLighting: boolean;
    declare public readonly dontBatch: boolean;

    declare public readonly isCastingShadow: boolean;
    declare public readonly scaleGlow: number;
    declare public ambientGlow: number;

    declare public readonly physics: EPhysics_T;
    declare public readonly rotationRate: FRotator;
    declare public readonly isFixedRotationDir: boolean;
    declare public readonly drawType: EDrawType_T;
    declare public readonly filterState: EFilterState_T;
    declare public readonly detailMode: EDetailMode_T;

    declare public readonly collisionRadius: number;
    declare public readonly collisionHeight: number;

    declare public readonly base: UAActor;
    declare public readonly isUsingLightingFromBase: boolean;

    public getRegion() { return this.region; }
    public getZone() { return this.region?.loadSelf().getZone(); }

    protected getAmbientLightingActor(): UAActor {
        return this.isUsingLightingFromBase && this.base ? this.base.getAmbientLightingActor() : this;
    }

    public localToWorld(): FMatrix {
        const result = FMatrix.make();
        const gm = GMath();
        const SR = gm.sin(this.rotation.roll),
            SP = gm.sin(this.rotation.pitch),
            SY = gm.sin(this.rotation.yaw),
            CR = gm.cos(this.rotation.roll),
            CP = gm.cos(this.rotation.pitch),
            CY = gm.cos(this.rotation.yaw);

        const LX = this.location.x,
            LY = this.location.y,
            LZ = this.location.z,
            PX = this.prePivot.x,
            PY = this.prePivot.y,
            PZ = this.prePivot.z;

        const DX = this.scale.x * this.drawScale,
            DY = this.scale.y * this.drawScale,
            DZ = this.scale.z * this.drawScale;

        result.planeX.x = CP * CY * DX;
        result.planeX.y = CP * DX * SY;
        result.planeX.z = DX * SP;
        result.planeX.w = 0;

        result.planeY.x = DY * (CY * SP * SR - CR * SY);
        result.planeY.y = DY * (CR * CY + SP * SR * SY);
        result.planeY.z = -CP * DY * SR;
        result.planeY.w = 0;

        result.planeZ.x = -DZ * (CR * CY * SP + SR * SY);
        result.planeZ.y = DZ * (CY * SR - CR * SP * SY);
        result.planeZ.z = CP * CR * DZ;
        result.planeZ.w = 0;

        result.planeW.x = LX - CP * CY * DX * PX + CR * CY * DZ * PZ * SP - CY * DY * PY * SP * SR + CR * DY * PY * SY + DZ * PZ * SR * SY;
        result.planeW.y = LY - (CR * CY * DY * PY + CY * DZ * PZ * SR + CP * DX * PX * SY - CR * DZ * PZ * SP * SY + DY * PY * SP * SR * SY);
        result.planeW.z = LZ - (CP * CR * DZ * PZ + DX * PX * SP - CP * DY * PY * SR);
        result.planeW.w = 1;

        return result;
    }

    public getWorldMatrixElements(): Matrix4Arr {
        const gm = GMath();
        const SR = gm.sin(this.rotation.roll),
            SP = gm.sin(this.rotation.pitch),
            SY = gm.sin(this.rotation.yaw),
            CR = gm.cos(this.rotation.roll),
            CP = gm.cos(this.rotation.pitch),
            CY = gm.cos(this.rotation.yaw);

        const LX = this.location.x,
            LY = this.location.y,
            LZ = this.location.z,
            PX = this.prePivot.x,
            PY = this.prePivot.y,
            PZ = this.prePivot.z;

        const DX = this.scale.x * this.drawScale,
            DY = this.scale.y * this.drawScale,
            DZ = this.scale.z * this.drawScale;

        const ue2_XX = CP * CY * DX;
        const ue2_XY = CP * DX * SY;
        const ue2_XZ = DX * SP;

        const ue2_YX = DY * (CY * SP * SR - CR * SY);
        const ue2_YY = DY * (CR * CY + SP * SR * SY);
        const ue2_YZ = -CP * DY * SR;

        const ue2_ZX = -DZ * (CR * CY * SP + SR * SY);
        const ue2_ZY = DZ * (CY * SR - CR * SP * SY);
        const ue2_ZZ = CP * CR * DZ;

        const ue2_WX = LX - CP * CY * DX * PX + CR * CY * DZ * PZ * SP - CY * DY * PY * SP * SR + CR * DY * PY * SY + DZ * PZ * SR * SY;
        const ue2_WY = LY - (CR * CY * DY * PY + CY * DZ * PZ * SR + CP * DX * PX * SY - CR * DZ * PZ * SP * SY + DY * PY * SP * SR * SY);
        const ue2_WZ = LZ - (CP * CR * DZ * PZ + DX * PX * SP - CP * DY * PY * SR);

        // Native UE2 local-to-world matrix, column-major, no axis reordering
        return [
            ue2_XX, ue2_XY, ue2_XZ, 0,
            ue2_YX, ue2_YY, ue2_YZ, 0,
            ue2_ZX, ue2_ZY, ue2_ZZ, 0,
            ue2_WX, ue2_WY, ue2_WZ, 1
        ];
    }

    protected getRegionLineHelper(color: [number, number, number] = [1, 0, 1], ignoreDepth: boolean = false) {
        const lineGeometryUuid = generateUUID();
        const _a = this.region.getZone().location;
        const _b = this.location;

        const geoPosition = _a.sub(_b).applyRotator(this.rotation, true);
        const regionHelper = {
            type: "Edges",
            geometry: lineGeometryUuid,
            color,
            ignoreDepth
        } as IEdgesObjectDecodeInfo;

        const geometryInfo = {
            indices: new Uint8Array([0, 1]),
            attributes: {
                positions: new Float32Array([
                    0, 0, 0,
                    geoPosition.x, geoPosition.y, geoPosition.z
                ])
            }
        };

        return { object: regionHelper, uuid: lineGeometryUuid, geometry: geometryInfo };
    }

    public getLevel() { return this.levelInfo.getLevel(); }

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "MainScale": "mainScale",

            "bDynamicActorFilterState": "isDynamicActorFilterState",
            "Level": "levelInfo",
            "Region": "region",
            "Tag": "tag",
            "L2MoveEvent": "l2MoveEvent", // FName right after MeshInstance (cpp/l2_headers/engine/EngineClasses.h:843)
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

            "ScaleGlow": "scaleGlow",
            "AmbientGlow": "ambientGlow",

            "bHiddenEd": "isHiddenInEditor",
            "bLightChanged": "isLightChanged",
            "bSelected": "isSelected",

            "bDeleteMe": "isDeleteMe",
            "bPendingDelete": "isPendingDelete",

            "ForcedRegionTag": "forcedRegionTag",
            "ForcedVisibilityZoneTag": "forcedVisibilityZoneTag",

            "Skins": "skins",
            "Style": "style",
            "bDirectional": "isDirectional",

            "Physics": "physics",
            "RotationRate": "rotationRate",
            "bFixedRotationDir": "isFixedRotationDir",
            "DrawType": "drawType",
            "StaticFilterState": "filterState",
            "DetailMode": "detailMode",

            "CollisionRadius": "collisionRadius",
            "CollisionHeight": "collisionHeight",

            "bShadowCast": "isCastingShadow",
            "PostScale": "postScale",
            "PolyFlags": "polyFlags",
            "Brush": "brush",
            "PrePivot": "prePivot",
            "PostPivot": "postPivot",
            "bIgnoredRange": "isRangeIgnored",
            "bBlockActors": "isBlockingActors",
            "bBlockPlayers": "isBlockingPlayers",
            "bCollideActors": "isCollidingActors",
            "bCollideWorld": "isCollidingWorld",
            "bBlockZeroExtentTraces": "isBlockingZeroExtentTraces",
            "bBlockNonZeroExtentTraces": "isBlockingNonZeroExtentTraces",
            "bWorldGeometry": "isWorldGeometry",
            "bUseCylinderCollision": "isUsingCylinderCollision",
            "bBlockKarma": "isBlockingKarma",
            "bDynamicLight": "isDynamicLight",
            "bStaticLighting": "isStaticLighting",

            "Base": "base",
            "bUseLightingFromBase": "isUsingLightingFromBase",

            "bDontBatch": "dontBatch",
        });
    };
}

export default UAActor;

export enum ERenderStyle_T {
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

export enum EPhysics_T {
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

export enum EDrawType_T {
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

export enum EFilterState_T {
    FS_Maybe,
    FS_Yes,
    FS_No
};

export enum EDetailMode_T {
    DM_Low,
    DM_High,
    DM_SuperHigh
};

export enum EL2EventCmd_T {
    LEC_None,
    LEC_Show,
    LEC_Play
};