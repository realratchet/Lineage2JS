import UParticleEmitter from "./un-particle-emitter"

class USpriteEmitter extends UParticleEmitter {
    protected projectionNormal: FVector; // Normal vector of the projection plane used when UseDirectionAs is set to PTDU_Normal, PTDU_UpAndNormal or PTDU_RightAndNormal.
    protected realProjectionNormal: FVector;
    protected spriteDirection: EParticleDirectionUsage_T = EParticleDirectionUsage_T.PTDU_None; // Here you can specify how the 2D image should be displayed. See EParticleDirectionUsage enum below for details.

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "ProjectionNormal": "projectionNormal",
            "UseDirectionAs": "spriteDirection",
            "RealProjectionNormal": "realProjectionNormal"
        });
    }

    public getDecodeInfo(library: DecodeLibrary) {
        return Object.assign(super.getDecodeInfo(library), {
            type: "SpriteEmitter",
            spriteDirection: directionNames[this.spriteDirection],
            object: this.texture?.loadSelf().getDecodeInfo(library)
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