import { Object3D } from "three";
import { ObjectComponent, type IObject } from "../../game/components";
import { ScriptComponent } from "../../game/script-component";
import { updateLevelActor, type ScriptHost_T, type ScriptValue_T } from "../../ue-script/vm";

type OwnedActor_T = Object3D & IObject;

export function setScriptObjectProperty(object: Object3D, field: string, value: ScriptValue_T): void {
    const properties = (object as any).scriptProperties as Map<string, ScriptValue_T>;

    if (!properties) return;
    const name = field.slice(field.lastIndexOf(".") + 1).toLowerCase();

    for (const key of properties.keys())
        if (key.slice(key.lastIndexOf(".") + 1).toLowerCase() === name) {
            properties.set(key, value);
            if (name === "level") updateLevelActor(object as any);
            return;
        }

    properties.set(field, value);
    if (name === "level") updateLevelActor(object as any);
}

export class ActorOwnershipComponent extends ObjectComponent<OwnedActor_T> {
    public readonly componentName = "actorOwnership";
    protected readonly scriptChildren = new Set<Object3D>();

    public getScriptChildren(): ReadonlySet<Object3D> { return this.scriptChildren; }

    public gainScriptChild(object: Object3D): void {
        const parent = this.getParent();
        const owner = (object as any).scriptOwner as OwnedActor_T;

        if (owner === parent) return;
        if (owner) owner.getComponent<ActorOwnershipComponent>("actorOwnership").loseScriptChild(object);

        (object as any).scriptOwner = parent;
        setScriptObjectProperty(object, "Owner", parent as unknown as ScriptHost_T);
        this.scriptChildren.add(object);

        const script = this.findComponent<ScriptComponent>("script");

        if (script?.hasFunction("GainedChild")) script.call("GainedChild", [object as unknown as ScriptHost_T]);
    }

    public loseScriptChild(object: Object3D): void {
        const parent = this.getParent();

        if ((object as any).scriptOwner !== parent) return;

        (object as any).scriptOwner = null;
        setScriptObjectProperty(object, "Owner", null);
        this.scriptChildren.delete(object);

        const script = this.findComponent<ScriptComponent>("script");

        if (script?.hasFunction("LostChild")) script.call("LostChild", [object as unknown as ScriptHost_T]);
    }
}

export default ActorOwnershipComponent;
