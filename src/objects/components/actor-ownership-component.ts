import { Object3D } from "three";
import { ObjectComponent, type IObject } from "../../game/components";
import { ScriptComponent } from "../../game/script-component";
import { getProperty, updateLevelActor, type ScriptHost_T, type ScriptValue_T } from "../../ue-script/vm";

export type OwnedActor_T = Object3D & IObject;

export function setActorOwner(object: OwnedActor_T, owner: OwnedActor_T): void {
    if (owner !== null && (!owner || !owner.isObject3D || typeof owner.getComponent !== "function")) throw new Error(`Invalid actor owner for '${object.name}'.`);
    const previous = getProperty(object as any, "Owner") as unknown as OwnedActor_T;

    if (previous) {
        const script = previous.getComponent<ScriptComponent>("script");

        if (script.getVM().isProbing(previous as any, "LostChild")) script.call("LostChild", [object as any]);
        const current = getProperty(object as any, "Owner") as unknown as OwnedActor_T;

        (current.findComponent<ActorOwnershipComponent>("actorOwnership") || current.addComponent(new ActorOwnershipComponent())).lostChild(object);
    }

    (object as any).scriptOwner = owner;
    setScriptObjectProperty(object, "Owner", owner as unknown as ScriptHost_T);
    if (owner) {
        const script = owner.getComponent<ScriptComponent>("script");

        if (script.getVM().isProbing(owner as any, "GainedChild")) script.call("GainedChild", [object as any]);
        const current = getProperty(object as any, "Owner") as unknown as OwnedActor_T;

        (current.findComponent<ActorOwnershipComponent>("actorOwnership") || current.addComponent(new ActorOwnershipComponent())).gainedChild(object);
    }
    (object as any).scriptOwner = getProperty(object as any, "Owner");
    setScriptObjectProperty(object, "bNetDirty", true);
}

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

    public gainedChild(object: Object3D): void {
        if (!object) return;
        const arrChildren = getProperty(this.getParent() as any, "Child") as unknown as Object3D[];

        if (!arrChildren.includes(object)) arrChildren.push(object);
        this.scriptChildren.add(object);
    }

    public lostChild(object: Object3D): void {
        if (!object) return;
        const parent = this.getParent(), vm = this.getComponent<ScriptComponent>("script").getVM();

        if (vm.invokeNative(parent as any, parent as any, 303, "IsA", ["L2Pickup"]) && getProperty(parent as any, "DropEffectActor") === object) setScriptObjectProperty(parent as any, "DropEffectActor", null);
        const arrChildren = getProperty(parent as any, "Child") as unknown as Object3D[];

        for (let index = arrChildren.length - 1; index >= 0; index--)
            if (arrChildren[index] === object) arrChildren.splice(index, 1);
        this.scriptChildren.delete(object);
    }

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
