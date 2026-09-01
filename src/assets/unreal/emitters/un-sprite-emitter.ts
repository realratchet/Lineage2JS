import FVector from "../un-vector";
import UParticleEmitter, { type IEmitterDecodeInfo } from "./un-particle-emitter"
import type { DecodeLibraryBuilder } from "../decode-library-builder";

export type ISpriteEmitterDecodeInfo = IEmitterDecodeInfo & {
    type: "SpriteEmitter",
    texture: string,
    spriteDirection?: SpriteDirections_T,
    projectionNormal?: [number, number, number]
};

export type SpriteDirections_T = "camera" | "up" | "right" | "forward" | "normal" | "upNormal" | "rightNormal" | "scale";

abstract class USpriteEmitter extends UParticleEmitter {
    declare protected projectionNormal: FVector; // Normal vector of the projection plane used when UseDirectionAs is set to PTDU_Normal, PTDU_UpAndNormal or PTDU_RightAndNormal.
    declare protected realProjectionNormal: FVector;
    declare protected spriteDirection: EParticleDirectionUsage_T; // Here you can specify how the 2D image should be displayed. See EParticleDirectionUsage enum below for details.

    declare protected refrUScale: number;
    declare protected refrVScale: number;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "ProjectionNormal": "projectionNormal",
            "UseDirectionAs": "spriteDirection",
            "RealProjectionNormal": "realProjectionNormal",
            "RefrUScale": "refrUScale",
            "RefrVScale": "refrVScale",
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder) {
        // debugger;

        return Object.assign(super.getDecodeInfo(builder), {
            type: "SpriteEmitter",
            spriteDirection: directionNames[this.spriteDirection],
            projectionNormal: this.projectionNormal ? this.projectionNormal.getElements() : [0, 0, 1],
            texture: builder.pullMaterial(this.texture)
        });
    }
}

export default USpriteEmitter;
export { USpriteEmitter };

enum EParticleDirectionUsage_T {
    PTDU_None, // Always rotates the sprite towards the viewer. The sprites will always look the same, no matter what direction they are viewed from. Size -> UniformSize will be forced to True, so only the X component of Size -> SizeScale can be used to scale the sprites.
    PTDU_Up, // Also rotates the projection plane towards the viewer, but in a special way, so the particle's movement direction will always be in the projection plane.
    PTDU_Right, // Like PTDU_Up, but the particle texture is rotated 90°.
    PTDU_Forward, // The particle's particle's movement direction is used as the projection plane's normal vector.
    PTDU_Normal, // The ProjectionNormal is used as the projection plane's normal.
    PTDU_UpAndNormal, // This is similar to PTDU_Normal, but the particles can only be rotated around the axis given by the particles' movement direction.
    PTDU_RightAndNormal, // Same as PTDU_UpAndNormal, but the texture is rotated 90°
    PTDU_Scale // Like PTDU_None, but allows you to turn off Size -> UniformSize so the sprites can have different scaling values for X and Y.
};

const directionNames = {
    [EParticleDirectionUsage_T.PTDU_None]: "camera",
    [EParticleDirectionUsage_T.PTDU_Up]: "up",
    [EParticleDirectionUsage_T.PTDU_Right]: "right",
    [EParticleDirectionUsage_T.PTDU_Forward]: "forward",
    [EParticleDirectionUsage_T.PTDU_Normal]: "normal",
    [EParticleDirectionUsage_T.PTDU_UpAndNormal]: "upNormal",
    [EParticleDirectionUsage_T.PTDU_RightAndNormal]: "rightNormal",
    [EParticleDirectionUsage_T.PTDU_Scale]: "scale",
} as Record<EParticleDirectionUsage_T, SpriteDirections_T>;
