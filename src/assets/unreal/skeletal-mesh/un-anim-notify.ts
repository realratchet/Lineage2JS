import { UObject } from "@l2js/core";
import type { USound } from "../un-sound";
import type { FVector } from "../un-vector";
import type { FRotator } from "../un-rotator";
import type { FColor } from "../un-color";
import type { DecodeLibraryBuilder } from "../decode-library-builder";

function requireNotifyProperty<T>(notify: UObject, name: string, value: T | undefined): T {
    if (value === undefined) throw new Error(`Animation notify '${notify.name}' has undefined mapped property '${name}'.`);

    return value;
}

function pullSound(builder: DecodeLibraryBuilder, value: USound | null): string {
    if (!value) return null;

    const sound = value.loadSelf();
    const soundName = sound.objectName ?? sound.uuid;

    return builder.pullSound(sound) ? soundName : null;
}

function pullSounds(builder: DecodeLibraryBuilder, values: (USound | null)[]): string[] {
    const names: string[] = [];

    for (let i = 0, len = values.length; i < len; i++) {
        const name = pullSound(builder, values[i]);

        if (name) names.push(name);
    }

    return names;
}

enum EViewShakeType_T {
    VST_DAMAGE,
    VST_VIBRATION,
    VST_USER,
    VST_UP,
    VST_DOWN,
    VST_UPDOWN,
    VST_DOWNUP
}

abstract class UAnimNotify extends UObject {
    public getDecodeInfo(_builder: DecodeLibraryBuilder): GD.IAnimationNotifyObjectDecodeInfo {
        return { type: "native", className: (this.constructor as any).friendlyName, objectName: this.name };
    }
}
abstract class UAnimNotifyIdleSound extends UAnimNotify { }
abstract class UAnimNotifyMatSubAction extends UAnimNotify { }
abstract class UAnimNotifyScripted extends UAnimNotify { }
abstract class UAnimNotifyScript extends UAnimNotify { }
abstract class UAnimNotifySound extends UAnimNotify {
    declare protected sound: USound | null;
    declare protected volume: number;
    declare protected radius: number;
    declare protected random: number;
    declare protected defaultWalkSounds: (USound | null)[];
    declare protected defaultRunSounds: (USound | null)[];
    declare protected grassWalkSounds: (USound | null)[];
    declare protected grassRunSounds: (USound | null)[];
    declare protected waterWalkSounds: (USound | null)[];
    declare protected waterRunSounds: (USound | null)[];
    declare protected defaultActorWalkSounds: (USound | null)[];
    declare protected defaultActorRunSounds: (USound | null)[];

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "Sound": "sound",
            "Volume": "volume",
            "Radius": "radius",
            "Random": "random",
            "DefaultWalkSound": "defaultWalkSounds",
            "DefaultRunSound": "defaultRunSounds",
            "GrassWalkSound": "grassWalkSounds",
            "GrassRunSound": "grassRunSounds",
            "WaterWalkSound": "waterWalkSounds",
            "WaterRunSound": "waterRunSounds",
            "DefaultActorWalkSound": "defaultActorWalkSounds",
            "DefaultActorRunSound": "defaultActorRunSounds"
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder): GD.IAnimationSoundNotifyDecodeInfo {
        return {
            type: "sound",
            className: "AnimNotify_Sound",
            objectName: this.name,
            sound: pullSound(builder, requireNotifyProperty(this, "sound", this.sound)),
            volume: requireNotifyProperty(this, "volume", this.volume),
            radius: requireNotifyProperty(this, "radius", this.radius),
            random: requireNotifyProperty(this, "random", this.random),
            defaultWalkSounds: pullSounds(builder, requireNotifyProperty(this, "defaultWalkSounds", this.defaultWalkSounds)),
            defaultRunSounds: pullSounds(builder, requireNotifyProperty(this, "defaultRunSounds", this.defaultRunSounds)),
            grassWalkSounds: pullSounds(builder, requireNotifyProperty(this, "grassWalkSounds", this.grassWalkSounds)),
            grassRunSounds: pullSounds(builder, requireNotifyProperty(this, "grassRunSounds", this.grassRunSounds)),
            waterWalkSounds: pullSounds(builder, requireNotifyProperty(this, "waterWalkSounds", this.waterWalkSounds)),
            waterRunSounds: pullSounds(builder, requireNotifyProperty(this, "waterRunSounds", this.waterRunSounds)),
            defaultActorWalkSounds: pullSounds(builder, requireNotifyProperty(this, "defaultActorWalkSounds", this.defaultActorWalkSounds)),
            defaultActorRunSounds: pullSounds(builder, requireNotifyProperty(this, "defaultActorRunSounds", this.defaultActorRunSounds))
        };
    }
}
abstract class UAnimNotifySwimSound extends UAnimNotify {
    public getDecodeInfo(_builder: DecodeLibraryBuilder): GD.IAnimationSwimSoundNotifyDecodeInfo {
        return { type: "swimSound", className: "AnimNotify_SwimSound", objectName: this.name, surface: null, underwater: null };
    }
}
abstract class UAnimNotifyDestroyEffect extends UAnimNotify { }
abstract class UAnimNotifyEffect extends UAnimNotify {
    declare protected effectClass: UObject | null;
    declare protected bone: string;
    declare protected offsetLocation: FVector;
    declare protected offsetRotation: FRotator;
    declare protected attach: boolean;
    declare protected tag: string;
    declare protected drawScale: number;
    declare protected drawScale3D: FVector;
    declare protected trailCamera: boolean;
    declare protected independentRotation: boolean;
    declare protected effectScale: number;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "EffectClass": "effectClass",
            "Bone": "bone",
            "OffsetLocation": "offsetLocation",
            "OffsetRotation": "offsetRotation",
            "Attach": "attach",
            "Tag": "tag",
            "DrawScale": "drawScale",
            "DrawScale3D": "drawScale3D",
            "TrailCamera": "trailCamera",
            "IndependentRotation": "independentRotation",
            "EffectScale": "effectScale"
        });
    }

    public getDecodeInfo(_builder: DecodeLibraryBuilder): GD.IAnimationEffectNotifyDecodeInfo {
        const effectClass = requireNotifyProperty(this, "effectClass", this.effectClass);

        return {
            type: "effect",
            className: "AnimNotify_Effect",
            objectName: this.name,
            effectClass: effectClass ? effectClass.name : null,
            bone: requireNotifyProperty(this, "bone", this.bone),
            offsetLocation: requireNotifyProperty(this, "offsetLocation", this.offsetLocation).getElements(),
            offsetRotation: requireNotifyProperty(this, "offsetRotation", this.offsetRotation).toArray() as GD.Vector3Arr,
            attach: requireNotifyProperty(this, "attach", this.attach),
            tag: requireNotifyProperty(this, "tag", this.tag),
            drawScale: requireNotifyProperty(this, "drawScale", this.drawScale),
            drawScale3D: requireNotifyProperty(this, "drawScale3D", this.drawScale3D).getElements(),
            trailCamera: requireNotifyProperty(this, "trailCamera", this.trailCamera),
            independentRotation: requireNotifyProperty(this, "independentRotation", this.independentRotation),
            effectScale: requireNotifyProperty(this, "effectScale", this.effectScale)
        };
    }
}
abstract class UAnimNotifyAttackVoice extends UAnimNotify { }
abstract class UAnimNotifyChanneling extends UAnimNotify { }
abstract class UAnimNotifyAttackPreShot extends UAnimNotify { }
abstract class UAnimNotifyAttackShot extends UAnimNotify { }
abstract class UAnimNotifyAttackItem extends UAnimNotify { }
abstract class UAnimNotifyScreenFade extends UAnimNotify {
    declare protected fadeOutDuration: number;
    declare protected fadeOutColor: FColor;
    declare protected blackOutDuration: number;
    declare protected fadeInDuration: number;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "FadeOutDuration": "fadeOutDuration",
            "FadeOutColor": "fadeOutColor",
            "BlackOutDuration": "blackOutDuration",
            "FadeInDuration": "fadeInDuration"
        });
    }

    public getDecodeInfo(_builder: DecodeLibraryBuilder): GD.IAnimationScreenFadeNotifyDecodeInfo {
        return {
            type: "screenFade",
            className: "AnimNotify_ScreenFade",
            objectName: this.name,
            fadeOutDuration: requireNotifyProperty(this, "fadeOutDuration", this.fadeOutDuration),
            fadeOutColor: requireNotifyProperty(this, "fadeOutColor", this.fadeOutColor).toArray() as GD.Vector4Arr,
            blackOutDuration: requireNotifyProperty(this, "blackOutDuration", this.blackOutDuration),
            fadeInDuration: requireNotifyProperty(this, "fadeInDuration", this.fadeInDuration)
        };
    }
}
abstract class UAnimNotifyViewShake extends UAnimNotify {
    declare protected shakeType: EViewShakeType_T;
    declare protected shakeIntensity: number;
    declare protected shakeVector: FVector;
    declare protected shakeRange: number;
    declare protected shakeCount: number;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "ShakeType": "shakeType",
            "ShakeIntensity": "shakeIntensity",
            "ShakeVector": "shakeVector",
            "ShakeRange": "shakeRange",
            "ShakeCount": "shakeCount"
        });
    }

    public getDecodeInfo(_builder: DecodeLibraryBuilder): GD.IAnimationViewShakeNotifyDecodeInfo {
        const names: GD.IAnimationViewShakeNotifyDecodeInfo["shakeType"][] = ["damage", "vibration", "user", "up", "down", "upDown", "downUp"];
        const type = requireNotifyProperty(this, "shakeType", this.shakeType).valueOf();
        const shakeType = names[type];

        if (!shakeType) throw new Error(`Animation notify '${this.name}' has invalid shake type '${type}'.`);

        return {
            type: "viewShake",
            className: "AnimNotify_ViewShake",
            objectName: this.name,
            shakeType,
            shakeIntensity: requireNotifyProperty(this, "shakeIntensity", this.shakeIntensity),
            shakeVector: requireNotifyProperty(this, "shakeVector", this.shakeVector).getElements(),
            shakeRange: requireNotifyProperty(this, "shakeRange", this.shakeRange),
            shakeCount: requireNotifyProperty(this, "shakeCount", this.shakeCount)
        };
    }
}
abstract class UAnimNotifyBoneScale extends UAnimNotify { }

export default UAnimNotify;
export { EViewShakeType_T, UAnimNotify, UAnimNotifyIdleSound, UAnimNotifyMatSubAction, UAnimNotifyScripted, UAnimNotifyScript, UAnimNotifySound, UAnimNotifySwimSound, UAnimNotifyDestroyEffect, UAnimNotifyEffect, UAnimNotifyAttackVoice, UAnimNotifyChanneling, UAnimNotifyAttackPreShot, UAnimNotifyAttackShot, UAnimNotifyAttackItem, UAnimNotifyScreenFade, UAnimNotifyViewShake, UAnimNotifyBoneScale };
