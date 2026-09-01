import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { ANIMATION_NOTIFY_EVENT, NPC_ENTER_EVENT } from "../../audio/components/sound-component";
import type { Object3D } from "three";
import type BaseActor from "../../base-actor";
import type RenderManager from "../render-manager";
import type { ScriptNativeCall_T, ScriptValue_T } from "../../ue-script/vm";
import { SCRIPT_NATIVE_EVENT, ScriptComponent } from "../../game/script-component";
import Rotator from "../../utils/rotator";
import type { IAnimationNotifyDecodeInfo, INpcEnterEvent, Vector3Arr } from "@l2js/engine";

const ENTER_EFFECT_RADIUS_SCALE = 0.1;
const tmpRotator = new Rotator();

class EffectsComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "effects";
    protected readonly renderManager: RenderManager;

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<ScriptValue_T> {
        switch (type) {
            case ANIMATION_NOTIFY_EVENT: return this.onAnimationNotify(data as IAnimationNotifyDecodeInfo);
            case NPC_ENTER_EVENT: return this.onNpcEnter(data as INpcEnterEvent);
            case SCRIPT_NATIVE_EVENT: return this.onScriptNative(data as ScriptNativeCall_T);
            default: return COMPONENT_EVENT_NOT_HANDLED;
        }
    }

    protected onAnimationNotify(notify: IAnimationNotifyDecodeInfo): ComponentEventResult_T<ScriptValue_T> {
        const info = notify.object;

        if (!info) return COMPONENT_EVENT_NOT_HANDLED;

        switch (info.type) {
            case "screenFade": this.renderManager.screenFadeBlink(info); return;
            case "viewShake": this.renderManager.addViewShake(this.getParent(), info); return;
            default: return COMPONENT_EVENT_NOT_HANDLED;
        }
    }

    protected onNpcEnter(event: INpcEnterEvent): ComponentEventResult_T<ScriptValue_T> {
        if (!event.effect || event.effect.toLowerCase() === "none") return COMPONENT_EVENT_NOT_HANDLED;

        const parent = this.getParent();
        const script = this.getComponent<ScriptComponent<BaseActor>>("script");
        const effect = script.createObject(event.effect);

        if (!(effect as any).isObject3D) throw new Error(`NPC enter effect '${event.effect}' is not an actor.`);

        const actor = effect as unknown as Object3D;
        const collisionRadius = parent.getCollisionRadius();

        parent.getWorldPosition(actor.position);
        actor.traverse(child => {
            const emitter = child as any;

            if (typeof emitter.setSizeScale === "function") emitter.setSizeScale(collisionRadius * ENTER_EFFECT_RADIUS_SCALE);
        });
        this.renderManager.addTransientEffect(actor);
    }

    protected onScriptNative(call: ScriptNativeCall_T): ComponentEventResult_T<ScriptValue_T> {
        const name = call.name.toLowerCase();

        if (call.index === 278 || name === "spawn") {
            const script = this.getComponent<ScriptComponent<BaseActor>>("script");
            const object = script.createObject(call.args[0] as string);

            if ((object as any).isObject3D) {
                const actor = object as unknown as Object3D;
                const context = call.context as any;
                const location = call.args[3];
                const rotation = call.args[4];

                if (Array.isArray(location)) actor.position.fromArray(location as Vector3Arr);
                else if (context.isObject3D) context.getWorldPosition(actor.position);
                else this.getParent().getWorldPosition(actor.position);

                if (Array.isArray(rotation)) {
                    const [pitch, yaw, roll] = rotation as Vector3Arr;

                    tmpRotator.set(pitch, yaw, roll).toQuaternion(actor.quaternion);
                }

                const owner = call.args[1] as any;

                this.renderManager.addTransientEffect(actor, owner && owner.isActor ? owner : null);
            }

            return object;
        }

        if (call.index !== 279 && name !== "destroy" && name !== "ndestroy") return COMPONENT_EVENT_NOT_HANDLED;

        const context = call.context as any;

        if (!context.isObject3D) throw new Error(`'${context.scriptClassId}' cannot be destroyed as an actor.`);

        this.renderManager.removeTransientEffect(context as Object3D);
        return true;
    }
}

export default EffectsComponent;
export { EffectsComponent };
