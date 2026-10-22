import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { SCRIPT_NATIVE_EVENT } from "../../game/script-component";
import type { ScriptNativeCall_T, ScriptValue_T } from "../../ue-script/vm";
import type PhysicsVolume from "../../objects/physics-volume";
import type MusicVolume from "../../objects/music-volume";
import type { ActorCollisionProfile_T, CollisionPrimitive_T } from "../../objects/objects";
import type CollisionWorld from "../collision-world";
import type CollisionOctree from "../collision-octree";
import { Box3 } from "three";

const tmpBounds = new Box3();

export class VolumeCollisionComponent extends ObjectComponent<PhysicsVolume | MusicVolume> {
    public readonly componentName = "volumeCollision";
    public readonly actor: PhysicsVolume | MusicVolume;
    public readonly primitive: CollisionPrimitive_T;
    public active: boolean;
    protected readonly world: CollisionWorld;
    protected readonly tree: CollisionOctree;

    public constructor(world: CollisionWorld, tree: CollisionOctree, actor: PhysicsVolume | MusicVolume, primitive: CollisionPrimitive_T) {
        super();

        this.actor = actor;
        this.world = world;
        this.tree = tree;
        this.primitive = primitive;
    }

    public onDetach(): void { this.removeCollision(); }
    public getCollisionProfile(): ActorCollisionProfile_T {
        const actor = this.getParent();

        return { collideActors: !!actor.getUnrealScriptProperty("bCollideActors"), collideWorld: !!actor.getUnrealScriptProperty("bCollideWorld"), blockActors: !!actor.getUnrealScriptProperty("bBlockActors"), blockPlayers: !!actor.getUnrealScriptProperty("bBlockPlayers"), blockZeroExtent: !!actor.getUnrealScriptProperty("bBlockZeroExtentTraces"), blockNonZeroExtent: !!actor.getUnrealScriptProperty("bBlockNonZeroExtentTraces"), worldGeometry: !!actor.getUnrealScriptProperty("bWorldGeometry"), useCylinderCollision: this.primitive.kind === "cylinder", collisionRadius: actor.getUnrealScriptProperty("CollisionRadius") as number, collisionHeight: actor.getUnrealScriptProperty("CollisionHeight") as number };
    }

    public removeCollision(): void {
        this.active = false;
        this.tree.removeActor(this.getParent().actorUuid);
    }

    public getCollisionPrimitive(): CollisionPrimitive_T {
        const actor = this.getParent(), primitive = this.primitive;
        if (primitive.kind === "cylinder") {
            primitive.center.fromArray(actor.getUnrealScriptProperty("Location") as number[]);
            primitive.radius = actor.getUnrealScriptProperty("CollisionRadius") as number;
            primitive.halfHeight = actor.getUnrealScriptProperty("CollisionHeight") as number;
            primitive.bounds.min.set(primitive.center.x - primitive.radius, primitive.center.y - primitive.radius, primitive.center.z - primitive.halfHeight);
            primitive.bounds.max.set(primitive.center.x + primitive.radius, primitive.center.y + primitive.radius, primitive.center.z + primitive.halfHeight);
        }
        return primitive;
    }

    public updateCollision(): void {
        const actor = this.getParent();
        if (!actor.getUnrealScriptProperty("bCollideActors") || actor.isPendingKill()) return this.removeCollision();

        this.active = true;
        const primitive = this.getCollisionPrimitive();
        this.tree.updateActor(actor.actorUuid, primitive.kind === "cylinder" ? tmpBounds.copy(primitive.bounds).expandByScalar(1) : primitive.bounds);
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<ScriptValue_T> {
        if (type !== SCRIPT_NATIVE_EVENT) return COMPONENT_EVENT_NOT_HANDLED;
        const call = data as ScriptNativeCall_T;
        if (call.index !== 262 && call.name.toLowerCase() !== "setcollision") return COMPONENT_EVENT_NOT_HANDLED;
        if (call.context !== this.getParent()) throw new Error(`SetCollision context does not match '${this.getParent().name}'.`);

        this.world.setCollision(this.getParent(), call.args[0] as boolean, call.args[1] as boolean, call.args[2] as boolean);
    }
}

export default VolumeCollisionComponent;
