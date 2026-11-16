import { Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { SCRIPT_NATIVE_EVENT, ScriptComponent } from "../../game/script-component";
import type AudioManager from "../audio-manager";
import type BaseActor from "../../base-actor";
import type { ScriptNativeCall_T, ScriptValue_T } from "../../ue-script/vm";
import type { DecodeLibrary } from "@l2js/engine";
import type { IAnimationNotifyDecodeInfo, IAnimationSoundNotifyDecodeInfo, IAnimationAttackVoiceNotifyDecodeInfo, IAnimationSwimSoundNotifyDecodeInfo } from "@l2js/engine/contracts/anim-notify";
import type { INpcEnterEvent, NpcSkillSound_T } from "@l2js/engine/contracts/pawn";
import type PawnAttackComponent from "../../objects/components/pawn-attack-component";
import type PawnMovementComponent from "../../physics/components/pawn-movement-component";
import type Actor from "../../objects/actor";

export const ANIMATION_NOTIFY_EVENT = "animationNotify";
export const NPC_ENTER_EVENT = "npcEnter";
const tmpPosition = new Vector3();
const SOUND_VOLUME_SCALE = Math.fround(1 / 255);

export class SoundComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "sound";
    protected readonly audioManager: AudioManager;
    protected library: DecodeLibrary = null;

    public constructor(audioManager: AudioManager) {
        super();

        this.audioManager = audioManager;
    }

    public setLibrary(library: DecodeLibrary): this { this.library = library; return this; }

    public playAttackSounds(critical: boolean = false, shield: boolean = false, soulshot: boolean = false): void {
        const profile = this.library.pawnSounds;

        if (!profile) return;

        const actor = this.getParent();

        actor.getWorldPosition(tmpPosition);
        tmpPosition.z += actor.getCollisionHeight();

        // Engine.dll Action_Attack 0x8bdb40..0x8bdd15: shield, critical, soulshot, defense.
        if (!shield && (critical || soulshot)) {
            const sound = critical ? profile.critical : profile.soulshot;

            if (sound.sound) this.play(sound.sound, sound.volume / 255, 1, sound.radius, sound.radius * 100, true, `Pawn '${actor.name}' impact`, tmpPosition, this.library, undefined, true);
        } else {
            // Engine.dll GetDefenseItemSound 0x8b689b..0x8b6a60: unresolved equipment sound falls back to the pawn profile.
            const item = shield ? profile.shield : profile.item;
            const itemSound = item && item.sounds.length ? item.sounds[Math.floor(Math.random() * item.sounds.length)] : null;
            const defense = itemSound ? item : profile.defense;
            const defenseSound = itemSound || (defense.sounds.length ? defense.sounds[Math.floor(Math.random() * defense.sounds.length)] : null);

            // Engine.dll Action_Attack 0x8bdd15..0x8bddf2: defense then damage at target Location, volume/255 and pitch1.
            if (defenseSound) this.play(defenseSound, defense.volume / 255, 1, defense.radius, defense.radius * 100, true, `Pawn '${actor.name}' defense`, tmpPosition, this.library, undefined, true);
        }

        const damage = profile.damage;

        // Engine.dll GetDamageSound 0x8b717f..0x8b719c / 0x8b7268..0x8b7276: inclusive integer random gate.
        if (damage.sounds.length === 0 || Math.floor(Math.random() * 100) > damage.random) return;

        const damageSound = damage.sounds[Math.floor(Math.random() * damage.sounds.length)];

        if (damageSound) this.play(damageSound, damage.volume / 255, 1, damage.radius, damage.radius * 100, true, `Pawn '${actor.name}' damage`, tmpPosition, this.library, undefined, true);
    }

    public playSkillSound(info: NpcSkillSound_T, actor: BaseActor = this.getParent(), assets: DecodeLibrary = this.library, onStarted?: (duration: number) => void): void {
        if (info.charClassId !== undefined && info.charClassId !== this.getParent().charClassId) return;

        const library = assets || this.library;
        const soundName = library.sounds[info.sound];

        if (!soundName) throw new Error(`Skill sound '${info.sound}' failed to decode.`);

        // Engine.dll 0x797e6f..0x797e98: sound position is the receiving Pawn's Location.
        actor.getWorldPosition(tmpPosition);
        tmpPosition.z += actor.getCollisionHeight();
        // Engine.dll APawn::PlaySkillSound 0x797e55: volume / 255, table radius, pitch 1.
        this.play(soundName, info.volume / 255, 1, info.radius, info.radius * 100, true, `Skill sound '${info.sound}'`, tmpPosition, library, onStarted, true, false, actor);
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<ScriptValue_T | void> {
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
            case "native":
                if (info.className.toLowerCase() !== "animnotify_attackitem") return COMPONENT_EVENT_NOT_HANDLED;
                if (!this.getParent().getComponent<PawnAttackComponent>("pawnAttack").isPhysicalAttacking()) return;

                const item = this.library.pawnEquipment?.attackSound;
                const itemSound = item?.sounds.length ? item.sounds[Math.floor(Math.random() * item.sounds.length)] : null;
                const set = itemSound ? item : this.library.pawnSounds?.attack;
                const sound = itemSound || (set?.sounds.length ? set.sounds[Math.floor(Math.random() * set.sounds.length)] : null);

                // Engine.dll AnimNotify_AttackItem 0x94c1ca..0x94c212: item volume/255 at Pawn.Location.
                if (sound) this.play(sound, set.volume / 255, 1, set.radius, set.radius * 100, true, `Pawn '${this.getParent().name}' attack item`, null, this.library, undefined, true);
                return;
            case "sound": this.playAnimationSound(info); return;
            case "attackVoice": this.playAttackVoice(info); return;
            case "swimSound": this.playSwimSound(info); return;
            default: return COMPONENT_EVENT_NOT_HANDLED;
        }
    }

    protected playAttackVoice(info: IAnimationAttackVoiceNotifyDecodeInfo): void { // UAnimNotify_AttackVoice::Notify 0x94c940 / APawn::GetAttackVoiceSound 0x8add10.
        const actor = this.getParent();

        if (!actor.getComponent<ScriptComponent>("script").getVM().isA(actor, "Pawn")) return;
        if (actor.getUnrealScriptProperty("bNpc")) return;

        const network = this.audioManager.getParent().getComponent("network");

        if (network.isInWorld() && !network.isPlayingReplay()) {
            const target = actor.getComponent<PawnAttackComponent>("pawnAttack").getActionTarget();

            if (!target || !target.getComponent<ScriptComponent>("script").getVM().isA(target, "Pawn")) return;
        }

        if (Math.floor(Math.random() * 32768) % 100 > info.random) return;

        const profile = this.library.pawnSounds;

        if (!profile) return;

        const voices = profile.attackVoice;
        const weapon = actor.getUnrealScriptProperty("CurWeaponType") as number;

        if (!voices || !voices[weapon]) throw new Error(`Pawn '${actor.name}' has no attack voice profile for weapon '${weapon}'.`);
        const sounds = voices[weapon];

        if (sounds.length === 0) return;
        const sound = sounds[Math.floor(Math.random() * 32768) % sounds.length];

        if (!sound) return;

        actor.getWorldPosition(tmpPosition);
        tmpPosition.z += actor.getCollisionHeight();
        this.play(sound, Math.fround(info.volume * SOUND_VOLUME_SCALE), 1, info.radius, info.radius * 100, true, `Pawn '${actor.name}' attack voice`, tmpPosition, this.library, undefined, true, true);
    }

    protected playAnimationSound(info: IAnimationSoundNotifyDecodeInfo): void {
        const actor = this.getParent();

        if (Math.floor(Math.random() * 32768) % 100 >= info.random) return;

        let soundName = info.sound;
        let library = this.library;

        if (!soundName) {
            const boots = this.library.pawnSounds?.boots;
            const bootsSound = boots?.length ? boots[Math.floor(Math.random() * boots.length)] : null;

            // Engine.dll AnimNotify_Sound 0x94d9f4..0x94dafd adds GetBootsSound before the surface step.
            if (bootsSound) this.play(bootsSound, info.volume / 255, 1, info.radius, info.radius * 100, true, `Pawn '${actor.name}' boots`);

            const isWalking = actor.isWalkingMovement(), isSwimming = actor.isSwimmingMovement();
            let sounds: (string | null)[] = isSwimming
                ? isWalking ? info.waterWalkSounds : info.waterRunSounds
                : isWalking ? info.defaultWalkSounds : info.defaultRunSounds;

            if (actor.scriptClassId && !isSwimming) {
                const base = actor.getUnrealScriptProperty("Base") as unknown as Actor;
                const foot = actor.getUnrealScriptProperty("FootVolume") as unknown as Actor;
                const terrain = !!base && !!base.scriptClassId && actor.getComponent<ScriptComponent>("script").getVM().isA(base, "TerrainInfo");
                const authored = base && base.scriptClassId && !terrain ? base.getStepSoundData() : null;

                if (authored) {
                    soundName = authored.sound;
                    library = authored.library;
                } else if (foot && foot.getUnrealScriptProperty("bL2WaterVolume")) sounds = isWalking ? info.waterWalkSounds : info.waterRunSounds;
                else if (foot && foot.getUnrealScriptProperty("bL2StepVolume")) {
                    const stepLibrary = foot.getComponent<ScriptComponent>("script").getVM().getLibrary();
                    const stepSounds = stepLibrary.stepSounds[foot.getUnrealScriptProperty("StepSoundID") as number];

                    if (stepSounds?.length) {
                        sounds = stepSounds;
                        library = stepLibrary;
                    }
                } else if (terrain) {
                    const render = this.audioManager.getParent().getComponent("render");

                    if (actor === render.player) {
                        actor.getWorldPosition(tmpPosition);
                        tmpPosition.z += actor.getCollisionHeight();
                        const sector = render.getCurrentSWLevel(tmpPosition);
                        const grassSounds = isWalking ? info.grassWalkSounds : info.grassRunSounds;

                        if (sector && grassSounds.some(sound => sound) && sector.getDecoLayerAlpha(tmpPosition) > 1) sounds = grassSounds;
                    }
                }
            }

            if (!soundName) {
                const available = sounds.filter(sound => sound);

                if (available.length === 0) return;
                soundName = available[Math.floor(Math.random() * available.length)];
            }
        }

        const attack = actor.findComponent<PawnAttackComponent>("pawnAttack");
        const isCombat = !!info.sound && (!!attack && attack.isAttacking() || actor.getComponent<PawnMovementComponent>("pawnMovement").isDying());

        this.play(soundName, info.volume / 255, 1, info.radius, info.radius * 100, true, `Pawn '${actor.name}'`, null, library, undefined, isCombat);
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

    protected onScriptNative(call: ScriptNativeCall_T): ComponentEventResult_T<ScriptValue_T | void> {
        const name = call.name.toLowerCase();

        if (call.index !== 264 && name !== "playsound" && name !== "playownedsound" && name !== "demoplaysound" && name !== "playsoundonvehicle") return COMPONENT_EVENT_NOT_HANDLED;

        const soundRef = call.args[0];

        if (soundRef === null || soundRef === undefined || soundRef === "None") return;
        if (typeof soundRef !== "string") throw new Error(`UnrealScript ${call.name} has invalid sound '${soundRef}'.`);
        if (!this.library) throw new Error(`UnrealScript ${call.name} has no decode library.`);

        const script = (call.self as any).findComponent?.("script") as ScriptComponent;
        const source = script ? script.getVM().getLibrary() : this.library;
        const library = source.sounds[soundRef] ? source : this.library;
        let soundName = library.sounds[soundRef] || soundRef;

        if (!library.soundBlobCache.has(soundName)) soundName = soundName.slice(soundName.lastIndexOf(".") + 1);

        const actor = this.getParent();
        const volume = call.args.length > 2 ? Number(call.args[2]) : Number(actor.getUnrealScriptProperty("TransientSoundVolume"));
        const radius = call.args.length > 4 ? Number(call.args[4]) : Number(actor.getUnrealScriptProperty("TransientSoundRadius"));
        const pitch = call.args.length > 5 ? Number(call.args[5]) : 1;
        const attenuate = call.args.length > 6 ? !!call.args[6] : true;

        if (!Number.isFinite(volume) || !Number.isFinite(radius) || !Number.isFinite(pitch)) throw new Error(`UnrealScript ${call.name} has invalid sound parameters.`);

        this.play(soundName, volume, pitch, radius, radius * 100, attenuate, `UnrealScript ${call.name}`, null, library);
    }

    protected play(soundName: string, volume: number, pitch: number, refDistance: number, maxDistance: number, attenuate: boolean, source: string, position: Vector3 = null, library: DecodeLibrary = this.library, onStarted?: (duration: number) => void, isCombat: boolean = false, skipIfPlaying: boolean = false, owner: BaseActor = this.getParent()): void {
        if (!library) throw new Error(`${source} has no decode library.`);

        const sound = library.soundBlobCache.get(soundName);

        if (!sound || !sound.data && !sound.uri) throw new Error(`${source} has no decoded sound '${soundName}'.`);

        if (!position) this.getParent().getWorldPosition(tmpPosition);
        this.audioManager.playOneShotSound(sound.data || sound.uri, position || tmpPosition, volume, pitch, refDistance, maxDistance, attenuate, onStarted, isCombat || this.audioManager.hasCombatSounds(this.getParent()), owner, soundName, skipIfPlaying);
    }
}

export default SoundComponent;
