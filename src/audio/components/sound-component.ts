import { Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { SCRIPT_NATIVE_EVENT } from "../../game/script-component";
import type AudioManager from "../audio-manager";
import type BaseActor from "../../base-actor";
import type { ScriptNativeCall_T, ScriptValue_T } from "../../ue-script/vm";
import type { DecodeLibrary } from "@l2js/engine";
import type { IAnimationNotifyDecodeInfo, IAnimationSoundNotifyDecodeInfo, IAnimationSwimSoundNotifyDecodeInfo } from "@l2js/engine/contracts/anim-notify";
import type { INpcEnterEvent, NpcSkillSound_T } from "@l2js/engine/contracts/pawn";

export const ANIMATION_NOTIFY_EVENT = "animationNotify";
export const NPC_ENTER_EVENT = "npcEnter";
const tmpPosition = new Vector3();

export class SoundComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "sound";
    protected readonly audioManager: AudioManager;
    protected library: DecodeLibrary = null;

    public constructor(audioManager: AudioManager) {
        super();

        this.audioManager = audioManager;
    }

    public setLibrary(library: DecodeLibrary): this { this.library = library; return this; }

    public playAttackSounds(): void {
        const profile = this.library.pawnSounds;

        if (!profile) return;

        const actor = this.getParent();

        actor.getWorldPosition(tmpPosition);
        tmpPosition.z += actor.getCollisionHeight();

        // Engine.dll GetDefenseItemSound 0x8b689b..0x8b6a60: unresolved equipment sound falls back to the pawn profile.
        const item = profile.item;
        const itemSound = item && item.sounds.length ? item.sounds[Math.floor(Math.random() * item.sounds.length)] : null;
        const defense = itemSound ? item : profile.defense;
        const defenseSound = itemSound || (defense.sounds.length ? defense.sounds[Math.floor(Math.random() * defense.sounds.length)] : null);

        // Engine.dll Action_Attack 0x8bdd15..0x8bddf2: defense then damage at target Location, volume/255 and pitch1.
        if (defenseSound) this.play(defenseSound, defense.volume / 255, 1, defense.radius, defense.radius * 100, true, `Pawn '${actor.name}' defense`, tmpPosition);

        const damage = profile.damage;

        // Engine.dll GetDamageSound 0x8b717f..0x8b719c / 0x8b7268..0x8b7276: inclusive integer random gate.
        if (damage.sounds.length === 0 || Math.floor(Math.random() * 100) > damage.random) return;

        const damageSound = damage.sounds[Math.floor(Math.random() * damage.sounds.length)];

        if (damageSound) this.play(damageSound, damage.volume / 255, 1, damage.radius, damage.radius * 100, true, `Pawn '${actor.name}' damage`, tmpPosition);
    }

    public playSkillSound(info: NpcSkillSound_T, actor: BaseActor = this.getParent()): void {
        const soundName = this.library.sounds[info.sound];

        if (!soundName) throw new Error(`Skill sound '${info.sound}' failed to decode.`);

        // Engine.dll 0x797e6f..0x797e98: sound position is the receiving Pawn's Location.
        actor.getWorldPosition(tmpPosition);
        tmpPosition.z += actor.getCollisionHeight();
        // Engine.dll APawn::PlaySkillSound 0x797e55: volume / 255, table radius, pitch 1.
        this.play(soundName, info.volume / 255, 1, info.radius, info.radius * 100, true, `Skill sound '${info.sound}'`, tmpPosition);
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<ScriptValue_T> {
        switch (type) {
            case ANIMATION_NOTIFY_EVENT: return this.onAnimationNotify(data as IAnimationNotifyDecodeInfo);
            case NPC_ENTER_EVENT: return this.onNpcEnter(data as INpcEnterEvent);
            case SCRIPT_NATIVE_EVENT: return this.onScriptNative(data as ScriptNativeCall_T);
            default: return COMPONENT_EVENT_NOT_HANDLED;
        }
    }

    protected onAnimationNotify(notify: IAnimationNotifyDecodeInfo): ComponentEventResult_T<void> {
        const info = notify.object;

        if (!info) return COMPONENT_EVENT_NOT_HANDLED;

        switch (info.type) {
            case "sound": this.playAnimationSound(info); return;
            case "swimSound": this.playSwimSound(info); return;
            default: return COMPONENT_EVENT_NOT_HANDLED;
        }
    }

    protected playAnimationSound(info: IAnimationSoundNotifyDecodeInfo): void {
        const actor = this.getParent();

        if (Math.random() * 100 >= info.random) return;

        let soundName = info.sound;

        if (!soundName) {
            const sounds = actor.isSwimmingMovement()
                ? actor.isWalkingMovement() ? info.waterWalkSounds : info.waterRunSounds
                : actor.isWalkingMovement() ? info.defaultWalkSounds : info.defaultRunSounds;

            if (sounds.length === 0) return;

            soundName = sounds[Math.floor(Math.random() * sounds.length)];
        }

        this.play(soundName, info.volume / 255, 1, info.radius, info.radius * 100, true, `Pawn '${actor.name}'`);
    }

    protected playSwimSound(info: IAnimationSwimSoundNotifyDecodeInfo): void {
        const actor = this.getParent();

        if (!actor.isSwimmingMovement()) return;

        const soundSet = actor.isUnderwaterMovement() ? info.underwater : info.surface;

        if (!soundSet) throw new Error(`Swim sound notify '${info.objectName}' has no audio profile.`);
        if (Math.random() * 100 >= soundSet.random) return;

        const soundName = soundSet.sounds[Math.floor(Math.random() * soundSet.sounds.length)];

        this.play(soundName, soundSet.volume / 255, 1, soundSet.radius, soundSet.radius * 100, true, `Pawn '${actor.name}' swim`);
    }

    protected onNpcEnter(event: INpcEnterEvent): ComponentEventResult_T<void> {
        if (!event.sound || event.sound.toLowerCase() === "none") return COMPONENT_EVENT_NOT_HANDLED;
        if (!this.library) throw new Error(`NPC enter sound '${event.sound}' has no decode library.`);

        const soundName = this.library.sounds[event.sound];

        if (!soundName) throw new Error(`NPC enter sound '${event.sound}' failed to decode.`);

        this.play(soundName, event.soundVolume / 255, 1, event.soundRadius, event.soundRadius * 100, true, `NPC enter sound '${event.sound}'`);
    }

    protected onScriptNative(call: ScriptNativeCall_T): ComponentEventResult_T<ScriptValue_T> {
        const name = call.name.toLowerCase();

        if (call.index !== 264 && name !== "playsound" && name !== "playownedsound" && name !== "demoplaysound" && name !== "playsoundonvehicle") return COMPONENT_EVENT_NOT_HANDLED;

        const soundRef = call.args[0];

        if (soundRef === null || soundRef === undefined || soundRef === "None") return;
        if (typeof soundRef !== "string") throw new Error(`UnrealScript ${call.name} has invalid sound '${soundRef}'.`);
        if (!this.library) throw new Error(`UnrealScript ${call.name} has no decode library.`);

        let soundName = this.library.sounds[soundRef] || soundRef;

        if (!this.library.soundBlobCache.has(soundName)) soundName = soundName.slice(soundName.lastIndexOf(".") + 1);

        const actor = this.getParent();
        const volume = call.args.length > 2 ? Number(call.args[2]) : Number(actor.getUnrealScriptProperty("TransientSoundVolume"));
        const radius = call.args.length > 4 ? Number(call.args[4]) : Number(actor.getUnrealScriptProperty("TransientSoundRadius"));
        const pitch = call.args.length > 5 ? Number(call.args[5]) : 1;
        const attenuate = call.args.length > 6 ? !!call.args[6] : true;

        if (!Number.isFinite(volume) || !Number.isFinite(radius) || !Number.isFinite(pitch)) throw new Error(`UnrealScript ${call.name} has invalid sound parameters.`);

        this.play(soundName, volume, pitch, radius, radius * 100, attenuate, `UnrealScript ${call.name}`);
    }

    protected play(soundName: string, volume: number, pitch: number, refDistance: number, maxDistance: number, attenuate: boolean, source: string, position: Vector3 = null): void {
        if (!this.library) throw new Error(`${source} has no decode library.`);

        const sound = this.library.soundBlobCache.get(soundName);

        if (!sound?.uri) throw new Error(`${source} has no decoded sound '${soundName}'.`);

        if (!position) this.getParent().getWorldPosition(tmpPosition);
        this.audioManager.playOneShotSound(sound.uri, position || tmpPosition, volume, pitch, refDistance, maxDistance, attenuate);
    }
}

export default SoundComponent;
