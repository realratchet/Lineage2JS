import { Object3D } from "three";
import { ObjectComponent, type ScriptActor_T } from "../../game/components";
import type { ScriptComponent } from "../../game/script-component";
import { setScriptObjectProperty } from "../actor-properties";
import { getProperty } from "../../ue-script/vm";

export type OwnedActor_T = ScriptActor_T;

export function setActorOwner(object: OwnedActor_T, owner: OwnedActor_T): void {
    if (owner !== null && (!owner || !owner.isObject3D || typeof owner.getComponent !== "function")) throw new Error(`Invalid actor owner for '${object.name}'.`);
    const previous = getProperty(object, "Owner") as OwnedActor_T;

    if (previous) {
        const script = previous.getComponent<ScriptComponent>("script");

        if (script.getVM().isProbing(previous, "LostChild")) script.call("LostChild", [object]);
        const current = getProperty(object, "Owner") as OwnedActor_T;

        (current.findComponent<ActorOwnershipComponent>("actorOwnership") || current.addComponent(new ActorOwnershipComponent())).lostChild(object);
    }

    object.scriptOwner = owner;
    setScriptObjectProperty(object, "Owner", owner);
    if (owner) {
        const script = owner.getComponent<ScriptComponent>("script");

        if (script.getVM().isProbing(owner, "GainedChild")) script.call("GainedChild", [object]);
        const current = getProperty(object, "Owner") as OwnedActor_T;

        (current.findComponent<ActorOwnershipComponent>("actorOwnership") || current.addComponent(new ActorOwnershipComponent())).gainedChild(object);
    }
    object.scriptOwner = getProperty(object, "Owner") as OwnedActor_T;
    setScriptObjectProperty(object, "bNetDirty", true);
}

export class ActorOwnershipComponent extends ObjectComponent<OwnedActor_T> {
    public readonly componentName = "actorOwnership";
    protected readonly scriptChildren = new Set<Object3D>();

    public getScriptChildren(): ReadonlySet<Object3D> { return this.scriptChildren; }

    public gainedChild(object: Object3D): void {
        if (!object) return;
        const arrChildren = getProperty(this.getParent(), "Child") as OwnedActor_T[];

        if (!arrChildren.includes(object as OwnedActor_T)) arrChildren.push(object as OwnedActor_T);
        this.scriptChildren.add(object);
    }

    public lostChild(object: Object3D): void {
        if (!object) return;
        const parent = this.getParent(), vm = this.getComponent<ScriptComponent>("script").getVM();

        if (vm.invokeNative(parent, parent, 303, "IsA", ["L2Pickup"]) && getProperty(parent, "DropEffectActor") === (object as OwnedActor_T)) setScriptObjectProperty(parent, "DropEffectActor", null);
        const arrChildren = getProperty(parent, "Child") as OwnedActor_T[];

        for (let index = arrChildren.length - 1; index >= 0; index--)
            if (arrChildren[index] === object) arrChildren.splice(index, 1);
        this.scriptChildren.delete(object);
    }

    public gainScriptChild(object: Object3D): void {
        const parent = this.getParent();

        if (getProperty(object as OwnedActor_T, "Owner") === parent) return;

        setActorOwner(object as OwnedActor_T, parent);
    }

    public loseScriptChild(object: Object3D): void {
        const parent = this.getParent();

        if (getProperty(object as OwnedActor_T, "Owner") !== parent) return;

        setActorOwner(object as OwnedActor_T, null);
    }
}

export default ActorOwnershipComponent;
