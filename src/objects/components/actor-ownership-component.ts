import { Object3D } from "three";
import { ObjectComponent, type IObject } from "../../game/components";
import { ScriptComponent } from "../../game/script-component";
import type { ScriptHost_T, ScriptValue_T } from "../../ue-script/vm";

type OwnedActor_T = Object3D & IObject & ScriptHost_T;

export function setScriptObjectProperty(object: Object3D, field: string, value: ScriptValue_T): void {
    const properties = (object as any).scriptProperties as Map<string, ScriptValue_T>;

    if (!properties) return;

    for (const key of properties.keys())
        if (key.slice(key.lastIndexOf(".") + 1).toLowerCase() === field.toLowerCase()) {
            properties.set(key, value);
            return;
        }

    properties.set(field, value);
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
        setScriptObjectProperty(object, "Owner", parent);
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