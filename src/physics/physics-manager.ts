import { ENetMode_T } from "@l2js/engine/un-level-info";
import RAPIER from "@dimforge/rapier3d";
import { Object3D, Quaternion, Vector3 } from "three";
import { IEngineComponent, IObject } from "../game/components";
import CollisionWorld, { CheckResult_T, CollisionBackend_T, CollisionQuery_T, RayCheckResult_T, PhysicsVolumeHit_T, ActorLineHit_T, CollisionActor_T } from "./collision-world";
import Player from "../player";
import { ColliderComponent, IPhysicsComponent } from "./components/physics-component";
import NpcSimulationComponent from "./components/npc-simulation-component";
import PawnMovementComponent from "./components/pawn-movement-component";
import type { ScriptComponent } from "../game/script-component";

import { pointPrimitive, queryPrimitive } from "./collision-primitive";
import type BaseActor from "../base-actor";
import type CollidingMesh from "../objects/colliding-mesh";
import type PhysicsVolume from "../objects/physics-volume";
import type Actor from "../objects/actor";
import type Volume from "../objects/volume";
import type MusicVolume from "../objects/music-volume";
import type GameManager from "../game/game-manager";
import type { ICollidable } from "../objects/objects";
import type { SectorObject } from "../objects/zone-object";
import type { ICharacterGroup, ICharacterArmorSelection } from "@l2js/engine/contracts/pawn";
import type { default as UnScriptVM, ScriptHost_T, ScriptValue_T } from "../ue-script/vm";
import type RenderManager from "../rendering/render-manager";
import type TransformComponent from "../objects/components/transform-component";
import Rotator from "../utils/rotator";
import { EPhysics_T } from "../assets/unreal/un-aactor";
import type { Vector3Arr } from "@l2js/engine";

const arrMoverPawns: BaseActor[] = [];
const emptyPhysicsComponents = new Set<IPhysicsComponent<any>>();
const tmpZoneLocation = new Vector3();
const tmpVolumeLocation = new Vector3();
const tmpPlacementExtent = new Vector3();
const tmpWaterHitStart = new Vector3();
const tmpWaterHitEnd = new Vector3();
const tmpWaterHitLocation = new Vector3();
const zeroWaterExtent = new Vector3();
const tmpAttachedLocation = new Vector3();
const tmpAttachedBasePosition = new Vector3();
const tmpAttachedBaseQuaternion = new Quaternion();
const tmpActorRotation = new Rotator();

function callZoneEvent(pawn: BaseActor | Actor | CollidingMesh, host: ScriptHost_T, name: string, args: ScriptValue_T[]): ScriptValue_T {
    const object = host as any;

    if (object.findComponent) return object.getComponent("script").call(name, args);
    return pawn.getComponent<ScriptComponent>("script").getVM().call(host, name, args);
}

export class PhysicsManager implements IEngineComponent<GameManager> {
    protected static readonly PHYSICS_HZ = 30;
    protected static readonly PHYSICS_INTERVAL_MS = 1000 / PhysicsManager.PHYSICS_HZ;
    protected static readonly MAX_PHYSICS_TICKS = 8;
    protected static readonly PAWN_DECODE_CONCURRENCY = 3;
    protected manGame: GameManager;

    protected readonly simEmitters = new EmitterSimulation();
    protected simCharGroups: ICharacterGroup[] = null;

    protected readonly physicsWorld = new RAPIER.World(new Vector3(0, 0, -9.8 * 100));
    protected readonly collisionWorld = new CollisionWorld(this.physicsWorld, PhysicsManager.getCollisionBackend());
    protected readonly physicsComponents = new Set<IPhysicsComponent<any>>();
    protected readonly physicsComponentsByName = new Map<string, Set<IPhysicsComponent<any>>>();
    protected readonly triggerPosition = new Vector3(Infinity, Infinity, Infinity);
    protected readonly lastMoverTriggerPosition = new Vector3(Infinity, Infinity, Infinity);
    protected nextPhysicsTick: number;

    protected static getCollisionBackend(): CollisionBackend_T {
        const backend = new URLSearchParams(location.search).get("collisionBackend") || "ue";

        if (backend !== "ue" && backend !== "rapier" && backend !== "compare") throw new Error(`Unknown collision backend '${backend}'.`);

        return backend;
    }

    public setParent(parent: GameManager): this {
        this.manGame = parent;

        return this;
    }
    public getParent(): GameManager { return this.manGame; }

    public startTicking(currentTime: number): void {
        this.physicsWorld.timestep = 1 / PhysicsManager.PHYSICS_HZ;
        this.physicsWorld.step();

        this.nextPhysicsTick = currentTime + PhysicsManager.PHYSICS_INTERVAL_MS;
    }

    public onBeforeEngineTick(currentTime: number, deltaTime: number): void {
        const manRender = this.manGame.getComponent("render");

        const updatedPhysicsComponent = this.updatePhysicsComponents(currentTime, deltaTime);

        // nothing reads the rapier world under the analytical backend
        const stepsRapier = this.collisionWorld.usesRapier();
        let physicsTicks = 0;

        while (this.nextPhysicsTick <= currentTime && physicsTicks++ < PhysicsManager.MAX_PHYSICS_TICKS) {
            this.simEmitters.tick(this.nextPhysicsTick, Math.fround(PhysicsManager.PHYSICS_INTERVAL_MS / 1000), manRender);
            if (stepsRapier) this.physicsWorld.step();
            this.nextPhysicsTick += PhysicsManager.PHYSICS_INTERVAL_MS;
        }

        if (physicsTicks > 0) this.simEmitters.syncParticles();

        if (this.nextPhysicsTick <= currentTime)
            this.nextPhysicsTick = currentTime + PhysicsManager.PHYSICS_INTERVAL_MS;

        if (updatedPhysicsComponent || physicsTicks > 0 && this.simEmitters.getSize() > 0)
            manRender.needsUpdate = true;
    }

    public getPhysicsComponents<T extends IPhysicsComponent<any>>(componentName: string): ReadonlySet<T> {
        return (this.physicsComponentsByName.get(componentName) || emptyPhysicsComponents) as ReadonlySet<T>;
    }

    public getParticleEmitters(): ReadonlySet<any> { return this.simEmitters.getEmitters(); }
    public setTriggerPosition(position: Vector3): void { this.triggerPosition.copy(position); }

    // emitters live under sector.zones, not staticMeshGroup - always walk the whole sector
    public setEmitterWarmupGate(root: Object3D, allowed: boolean): void { EmitterSimulation.setWarmupGate(root, allowed); }
    public isEmitterEffectFinished(effect: Object3D): boolean { return EmitterSimulation.isEffectFinished(effect); }

    public addPawn(pawn: BaseActor, expires: number = Infinity, nextTurn: number = Infinity, simulate: boolean = false): void {
        if (simulate) {
            const simulation = pawn.findComponent<NpcSimulationComponent>("npcSimulation") || pawn.addComponent(new NpcSimulationComponent());
            simulation.configure(expires, nextTurn);
        }
        this.registerSimulationObjects(pawn);

        arrMoverPawns.length = 0;
        for (const movement of this.getPhysicsComponents<PawnMovementComponent>("pawnMovement")) arrMoverPawns.push(movement.getParent());

        pawn.ignoreOverlappingActors(arrMoverPawns);
    }

    public removePawn(pawn: BaseActor): boolean {
        this.collisionWorld.setPawnLevel(pawn, null);
        const movement = pawn.findComponent<PawnMovementComponent>("pawnMovement");

        if (!movement || !movement.isPhysicsAdded(this)) return false;

        this.unregisterSimulationObjects(pawn);

        return true;
    }

    public async simulatePawns(count: number = NpcSimulationComponent.DEFAULT_COUNT): Promise<void> {
        const this_ = this, manAsset = this.manGame.getComponent("asset"), manRender = this.manGame.getComponent("render");
        const groups = this.simCharGroups || (this.simCharGroups = await manAsset.getCharGroups());
        const arrWorkers: Promise<void>[] = [];
        let next = 0;

        // Ten character decodes at once starve the fucking worker pool.
        async function worker(): Promise<void> {
            while (next < count) {
                const index = next++;
                const group = groups[Math.floor(Math.random() * groups.length)];
                const hair = group.hairStyles[Math.floor(Math.random() * group.hairStyles.length)];
                const colours = group.hairColours[hair];
                const armor: ICharacterArmorSelection = { chest: 0, legs: 0, gloves: 0, boots: 0 };
                const pawn = new Player(manRender);

                for (const slot of Object.keys(armor) as (keyof ICharacterArmorSelection)[]) {
                    const items = group.armor[slot];

                    armor[slot] = items.length > 0 && Math.random() < 0.75 ? items[Math.floor(Math.random() * items.length)].id : 0;
                }

                pawn.name = `SimPawn${index}`;

                await manAsset.loadCharacter(manRender, group.index, Math.floor(Math.random() * group.faceVariants), hair, colours[Math.floor(Math.random() * colours.length)], armor, pawn);

                manRender.scene.add(pawn);
                pawn.position.copy(this_.manGame.getComponent("input").getOrbitTarget());
                pawn.updateMatrixWorld(true);
                this_.addPawn(pawn, this_.manGame.getCurrentTime() + NpcSimulationComponent.LIFETIME, 0, true);
                manRender.needsUpdate = true;
            }
        }

        for (let i = 0; i < PhysicsManager.PAWN_DECODE_CONCURRENCY; i++) arrWorkers.push(worker());

        await Promise.all(arrWorkers);
    }

    public getColliders(): RAPIER.Collider[] {
        const colliders: RAPIER.Collider[] = [];

        this.physicsWorld.colliders.forEach(collider => colliders.push(collider));

        return colliders;
    }

    public updateDynamicEntries(currentTime: number): void { this.collisionWorld.updateDynamicEntries(currentTime); }
    public updatePawnCollision(pawn: BaseActor | CollidingMesh): void { this.collisionWorld.updatePawnCollision(pawn); }
    public setCollision(pawn: CollisionActor_T, collideActors?: boolean, blockActors?: boolean, blockPlayers?: boolean): void { this.collisionWorld.setCollision(pawn, collideActors, blockActors, blockPlayers); }
    public setPawnLevel(pawn: BaseActor | CollidingMesh, level: ScriptHost_T | null): void {
        if (!level) return this.collisionWorld.setPawnLevel(pawn, null);
        const sector = this.manGame.getComponent("render").getLoadedSectors().find(sector => sector.levelInfoActor === level);
        if (!sector) throw new Error(`Pawn '${pawn.name}' has an unregistered LevelInfo.`);
        this.collisionWorld.setPawnLevel(pawn, sector.physicsVolumeActors);
    }
    public moveActor(query: CollisionQuery_T, pawn: BaseActor = null, rotation: Vector3Arr = null, test: boolean = false): CheckResult_T | null {
        if (!pawn) return this.collisionWorld.moveActor(query);

        const hasMovement = query.delta.lengthSq() !== 0;
        const oldRotation = rotation ? pawn.getUnrealScriptProperty("Rotation") as Vector3Arr : null;
        if (!hasMovement && (!rotation || rotation.every((value, index) => value === oldRotation[index]))) return null;

        // shortcut: ordinary cylinder pawn movement, extend before mesh or encroacher translation.
        const transform = pawn.getComponent<TransformComponent>("transform"), hasBasedActors = !test && transform.getBasedActors().size > 0;
        const oldLocation = hasBasedActors ? pawn.getUnrealScriptProperty("Location") as Vector3Arr : null;
        const previousRotation = hasBasedActors ? oldRotation || pawn.getUnrealScriptProperty("Rotation") as Vector3Arr : null;
        if (hasBasedActors) transform.checkBasedMovement();
        const contacts: ActorLineHit_T[] = [];
        const notify = !test && hasMovement && (query.sourceProfile.collideActors || query.sourceProfile.collideWorld);
        const location = query.location, ignoreBases = query.ignoreBases;
        let hit = this.collisionWorld.moveActor(query, notify ? contacts : null);
        if (hit) hit = { ...hit, location: hit.location.clone(), normal: hit.normal.clone() };
        pawn.setUnrealScriptProperty("Location", location.toArray());
        if (rotation) this.setActorRotation(pawn, rotation);
        if (hasBasedActors && !transform.moveBasedActors(oldLocation, previousRotation)) {
            const delta = (pawn.getUnrealScriptProperty("Location") as Vector3Arr).map((value, index) => Math.fround(value - oldLocation[index])) as Vector3Arr;
            pawn.setUnrealScriptProperty("Location", oldLocation);
            this.setActorRotation(pawn, previousRotation);
            transform.rollbackBasedActors(delta);
            location.fromArray(pawn.getUnrealScriptProperty("Location") as Vector3Arr);
            return hit;
        }
        if (!test) {
            if (hasMovement || hasBasedActors) transform.updateRelativeLocation();
            if (rotation && (!hasMovement && !hasBasedActors || !pawn.getUnrealScriptProperty("bOnlyDrawIfAttached"))) transform.updateRelativeRotation();
        }
        if (notify) {
            this.collisionWorld.notifyMove(pawn, contacts, hit, ignoreBases);
            this.setPawnZone(pawn);
        }
        if (test) this.setPawnZone(pawn, true);
        location.fromArray(pawn.getUnrealScriptProperty("Location") as number[]);
        return hit;
    }
    public singleLineCheck(query: CollisionQuery_T): CheckResult_T | null { return this.collisionWorld.singleLineCheck(query); }
    public isBlockedBy(source: ScriptHost_T, target: ScriptHost_T, vm: UnScriptVM): boolean { return this.collisionWorld.isBlockedBy(source, target, vm); }
    protected setActorRotation(pawn: BaseActor | CollidingMesh, rotation: Vector3Arr): void {
        pawn.setUnrealScriptProperty("Rotation", rotation);
        tmpActorRotation.set(rotation[0], rotation[1], rotation[2]).toQuaternion(pawn.quaternion);
        const movement = pawn.findComponent<PawnMovementComponent>("pawnMovement");
        if (movement) {
            movement.syncRotationYaw(rotation[1]);
            pawn.rotateZ(-Math.PI / 2);
            pawn.updateMatrixWorld(true);
            movement.syncCollisionLocation();
        } else (pawn as CollidingMesh).syncCollisionTransform();
    }
    public rotateActor(pawn: BaseActor | CollidingMesh, rotation: Vector3Arr): boolean {
        const physics = pawn.getUnrealScriptProperty("Physics"), profile = pawn.getCollisionProfile();

        if (profile.collideActors && (physics === EPhysics_T.PHYS_Karma || physics === EPhysics_T.PHYS_KarmaRagDoll)) throw new Error(`MoveActor rotation of a Karma pawn is not implemented for '${pawn.name}'.`);
        const transform = pawn.getComponent<TransformComponent>("transform");
        transform.checkBasedMovement();
        const oldRotation = pawn.getUnrealScriptProperty("Rotation") as Vector3Arr, location = pawn.getUnrealScriptProperty("Location") as Vector3Arr;

        // ULevel::MoveActor 0x1058baaf..0x1058c5b9: zero-delta ordinary mesh pawn.
        if (profile.collideActors) this.collisionWorld.removePawnCollision(pawn);
        this.setActorRotation(pawn, rotation);
        if (transform.getBasedActors().size > 0 && !transform.moveBasedActors(location, oldRotation)) {
            this.setActorRotation(pawn, oldRotation);
            if (profile.collideActors) this.collisionWorld.updatePawnCollision(pawn);
            transform.rollbackBasedActors([0, 0, 0]);
            if (this.collisionWorld.usesRapier()) this.physicsWorld.queryPipeline.update(this.physicsWorld.islands, this.physicsWorld.bodies, this.physicsWorld.colliders);
            return false;
        }
        if (!pawn.getUnrealScriptProperty("bOnlyDrawIfAttached")) {
            transform.updateRelativeLocation();
            transform.updateRelativeRotation();
        }
        if (profile.collideActors) this.collisionWorld.updatePawnCollision(pawn);
        if (this.collisionWorld.usesRapier()) this.physicsWorld.queryPipeline.update(this.physicsWorld.islands, this.physicsWorld.bodies, this.physicsWorld.colliders);
        if (profile.collideActors || profile.collideWorld) {
            this.collisionWorld.notifyMove(pawn, [], null, false);
            this.setPawnZone(pawn);
        }
        this.manGame.getComponent("render").needsUpdate = true;
        return true;
    }
    public findSpot(extent: Vector3, location: Vector3): boolean { return this.collisionWorld.findSpot(extent, location); }
    public farMoveActor(pawn: BaseActor | CollidingMesh, destination: Vector3, test: boolean = false, noCheck: boolean = false, attached: boolean = false): boolean {
        if (pawn.getUnrealScriptProperty("bStatic") || !pawn.getUnrealScriptProperty("bMovable")) return false;
        const movement = pawn.findComponent<PawnMovementComponent>("pawnMovement");
        if (movement) movement.resetPhysicInit(); // ULevel::FarMoveActor 0x85af66
        else if (pawn.getCollisionProfile().isPawn) pawn.setUnrealScriptProperty("bPhysicInit", false);
        if (pawn.scriptBase) throw new Error(`FarMoveActor on bone attachments is not implemented for '${pawn.name}'.`);

        const previous = pawn.getUnrealScriptProperty("Location") as number[];
        const location = new Vector3(Math.fround(destination.x), Math.fround(destination.y), Math.fround(destination.z));
        const level = pawn.getUnrealScriptProperty("Level") as ScriptHost_T;
        const profile = pawn.getCollisionProfile();
        const script = pawn.getComponent<ScriptComponent>("script");

        if (!level) throw new Error(`Pawn '${pawn.name}' has no owning level for FarMoveActor.`);
        if (!profile.isPawn) throw new Error(`FarMoveActor without a pawn source is not implemented for '${pawn.name}'.`);

        this.collisionWorld.removePawnCollision(pawn);
        let result = true;
        if (!noCheck && (pawn.getUnrealScriptProperty("bCollideWorld") || pawn.getUnrealScriptProperty("bCollideWhenPlacing") && (level as any).getUnrealScriptProperty("NetMode") !== ENetMode_T.NM_Client))
            result = this.findSpot(tmpPlacementExtent.set(profile.collisionRadius, profile.collisionRadius, profile.collisionHeight), location);
        if (result && !test && !noCheck) result = !this.collisionWorld.checkEncroachment(pawn, location, true, script.getVM());
        const current = pawn.getUnrealScriptProperty("Location") as number[];
        if (!test && previous.some((value, index) => value !== current[index])) return result;

        if (result) {
            if (!test) {
                pawn.setUnrealScriptProperty("bJustTeleported", true);
                if (!attached) pawn.setBase(null);
                for (const actor of pawn.getBasedActors()) {
                    const child = actor as BaseActor | CollidingMesh;

                    if (child.scriptBase) continue;

                    const childLocation = child.getUnrealScriptProperty("Location") as number[], baseLocation = pawn.getUnrealScriptProperty("Location") as number[];
                    tmpAttachedLocation.set(Math.fround(location.x + childLocation[0] - baseLocation[0]), Math.fround(location.y + childLocation[1] - baseLocation[1]), Math.fround(location.z + childLocation[2] - baseLocation[2]));
                    this.farMoveActor(child, tmpAttachedLocation, false, true, true);
                }
            }
            this.collisionWorld.removePawnCollision(pawn);
            pawn.setUnrealScriptProperty("Location", location.toArray());
            if (movement) movement.syncCollisionLocation();
            else (pawn as CollidingMesh).syncCollisionTransform();
            if (!test)
                for (const actor of pawn.getBasedActors()) {
                    const child = actor as BaseActor | CollidingMesh;

                    if (child.scriptBase || child.getBaseActor() !== pawn) continue;

                    const transform = child.getComponent<TransformComponent>("transform");
                    transform.updateBaseTransform(pawn.getWorldPosition(tmpAttachedBasePosition), pawn.getWorldQuaternion(tmpAttachedBaseQuaternion));
                    transform.updateBaseRelativePosition();
                }
        }
        this.collisionWorld.updatePawnCollision(pawn);
        if (result && this.collisionWorld.usesRapier()) this.physicsWorld.queryPipeline.update(this.physicsWorld.islands, this.physicsWorld.bodies, this.physicsWorld.colliders);
        if (result) this.setPawnZone(pawn, test);
        if (!test) this.manGame.getComponent("render").needsUpdate = true;
        return result;
    }
    public physicsVolumeLineCheck(start: Vector3, end: Vector3, source: ScriptHost_T = null, sourceIsPawn: boolean = false): PhysicsVolumeHit_T | null {
        return this.collisionWorld.physicsVolumeLineCheck(start, end, source, sourceIsPawn);
    }
    public physicsVolumePointCheck(location: Vector3, volumes: PhysicsVolume[]): PhysicsVolume[] { return this.collisionWorld.physicsVolumePointCheck(location, volumes); }
    public getPhysicsVolume(level: SectorObject, location: Vector3, actor: BaseActor | Actor | CollidingMesh, useTouching: boolean = false): PhysicsVolume {
        const main = this.manGame.getComponent("render").getLevel();
        let selected = (main || level).getDefaultPhysicsVolume();

        if ((actor as BaseActor).scriptBase) return (actor as BaseActor).scriptBase.getUnrealScriptProperty("PhysicsVolume") as unknown as PhysicsVolume || selected;

        const candidates = useTouching ? actor.getUnrealScriptProperty("Touching") as unknown as PhysicsVolume[] : this.physicsVolumePointCheck(location, level.physicsVolumeActors);
        for (const volume of candidates) {
            if (!volume) continue;
            const script = volume.getComponent("script") as any;
            if (!script.getVM().invokeNative(volume, volume, 303, "IsA", ["PhysicsVolume"])) continue;
            if ((volume.getUnrealScriptProperty("Priority") as number) <= (selected.getUnrealScriptProperty("Priority") as number)) continue;
            if (useTouching && !volume.encompasses(location)) continue;
            selected = volume;
        }

        return selected;
    }
    public updatePawnWaterHitEffect(owner: BaseActor | CollidingMesh, volume: PhysicsVolume): void {
        if (!volume || !volume.getUnrealScriptProperty("bL2WaterVolume")) return;

        if (volume !== owner.getUnrealScriptProperty("FootVolume")) owner.setUnrealScriptProperty("HitWaterEffectTimer", 0);
        if (!volume.getUnrealScriptProperty("Brush")) return;
        const primitive = this.collisionWorld.getPhysicsVolumePrimitive(volume);
        if (!primitive) throw new Error(`Water volume '${volume.name}' has no registered primitive.`);

        // APawn::UpdateWaterHitEffect 0x858010; shortcut: GL2UseHitWateEffect stays enabled until graphics settings expose it.
        const location = owner.getUnrealScriptProperty("Location") as number[], height = owner.getCollisionHeight();
        tmpWaterHitStart.set(Math.fround(location[0]), Math.fround(location[1]), Math.fround(location[2] + height + 20));
        tmpWaterHitEnd.set(tmpWaterHitStart.x, tmpWaterHitStart.y, Math.fround(location[2] - height));
        const hit = queryPrimitive(primitive, tmpWaterHitStart, tmpWaterHitEnd, zeroWaterExtent);
        const time = hit ? Math.fround(Math.min(1, Math.max(0, hit.time - 0.5 / tmpWaterHitStart.distanceTo(tmpWaterHitEnd)))) : 1;

        if (time === 0) {
            owner.setUnrealScriptProperty("bSwimAfloat", false);
            owner.setUnrealScriptProperty("HitLocation", [0, 0, 0]);
            return;
        }

        owner.setUnrealScriptProperty("bSwimAfloat", true);
        tmpWaterHitLocation.set(0, 0, 0);
        if (hit) {
            tmpWaterHitLocation.lerpVectors(tmpWaterHitStart, tmpWaterHitEnd, time);
            tmpWaterHitLocation.set(Math.fround(tmpWaterHitLocation.x), Math.fround(tmpWaterHitLocation.y), Math.fround(tmpWaterHitLocation.z));
        }
        if (tmpWaterHitLocation.z - location[2] <= height * 0.8500000238418579) {
            owner.setUnrealScriptProperty("HitLocation", [0, 0, 0]);
            return;
        }

        if (pointPrimitive(primitive, tmpWaterHitLocation, zeroWaterExtent)) tmpWaterHitLocation.set(0, 0, 0);
        owner.setUnrealScriptProperty("HitLocation", tmpWaterHitLocation.toArray());
    }

    public setActorZone(actor: Actor, test: boolean = false, forceRefresh: boolean = false): void {
        if (actor.isPendingKill()) return;

        const owner = actor.getUnrealScriptProperty("Level");
        const level = this.manGame.getComponent("render").getLoadedSectors().find(sector => sector.levelInfoActor === owner);

        if (!level) throw new Error(`Actor '${actor.name}' has no registered level for SetZone.`);
        const vm = actor.getComponent<ScriptComponent>("script").getVM();

        if (vm.invokeNative(actor, actor, 303, "IsA", ["LevelInfo"])) {
            actor.setUnrealScriptProperty("Region", { Zone: owner, iLeaf: -1, ZoneNumber: 0 });
            return;
        }
        if (forceRefresh) actor.setUnrealScriptProperty("Region", { Zone: owner, iLeaf: -1, ZoneNumber: 0 });

        const oldRegion = actor.getUnrealScriptProperty("Region") as any;
        const region = level.pointRegion(tmpZoneLocation.fromArray(actor.getUnrealScriptProperty("Location") as number[]));
        const changedZone = oldRegion.Zone !== region.Zone;

        if (!oldRegion.Zone) throw new Error(`Actor '${actor.name}' has no initial zone for SetZone.`);
        if (!test && changedZone) {
            callZoneEvent(actor, oldRegion.Zone, "ActorLeaving", [actor]);
            callZoneEvent(actor, actor, "ZoneChange", [region.Zone as any]);
        }
        actor.setUnrealScriptProperty("Region", region as any);
        if (!test && changedZone) callZoneEvent(actor, region.Zone, "ActorEntered", [actor]);

        if (vm.invokeNative(actor, actor, 303, "IsA", ["PhysicsVolume"])) {
            actor.setUnrealScriptProperty("PhysicsVolume", actor);
            return;
        }

        tmpZoneLocation.fromArray(actor.getUnrealScriptProperty("Location") as number[]);
        const touching = !!actor.getUnrealScriptProperty("bCollideActors") && !test && !forceRefresh;
        const body = this.getPhysicsVolume(level, tmpZoneLocation, actor, touching);
        const oldBody = actor.getUnrealScriptProperty("PhysicsVolume") as unknown as PhysicsVolume;

        if (!test && body !== oldBody) {
            if (oldBody) {
                callZoneEvent(actor, oldBody, "ActorLeavingVolume", [actor]);
                callZoneEvent(actor, actor, "PhysicsVolumeChange", [body as any]);
            }
            actor.setUnrealScriptProperty("PhysicsVolume", body as any);
            callZoneEvent(actor, body, "ActorEnteredVolume", [actor]);
        } else actor.setUnrealScriptProperty("PhysicsVolume", body as any);
    }

    public setActorVolumes(actor: Actor | BaseActor | CollidingMesh, volumes: (PhysicsVolume | MusicVolume | Volume)[]): void {
        const vm = actor.getComponent<ScriptComponent>("script").getVM();

        if (vm.invokeNative(actor, actor, 303, "IsA", ["LevelInfo"]) || vm.invokeNative(actor, actor, 303, "IsA", ["Volume"])) return;

        tmpVolumeLocation.fromArray(actor.getUnrealScriptProperty("Location") as number[]);
        for (const volume of volumes) {
            if (!volume.encompasses(tmpVolumeLocation)) continue;

            if (actor.getUnrealScriptProperty("bCollideActors") && volume.getUnrealScriptProperty("bCollideActors")) {
                (volume.getUnrealScriptProperty("Touching") as ScriptValue_T[]).push(actor);
                (actor.getUnrealScriptProperty("Touching") as ScriptValue_T[]).push(volume);
            }
            if (!vm.invokeNative(volume, volume, 303, "IsA", ["PhysicsVolume"])) continue;

            const previous = actor.getUnrealScriptProperty("PhysicsVolume") as unknown as PhysicsVolume;
            if ((volume.getUnrealScriptProperty("Priority") as number) > (previous.getUnrealScriptProperty("Priority") as number))
                actor.setUnrealScriptProperty("PhysicsVolume", volume as any);
        }
    }

    protected getLevelVolumes(level: SectorObject): (PhysicsVolume | MusicVolume | Volume)[] {
        const volumes = new Map<string, PhysicsVolume | MusicVolume | Volume>();
        for (const actor of [...level.physicsVolumeActors, ...level.musicVolumeActors]) volumes.set(actor.actorUuid, actor);
        level.traverse((object: any) => {
            if (object.scriptActor) volumes.set(object.scriptActor.actorUuid, object.scriptActor);
        });

        const arrVolumes: (PhysicsVolume | MusicVolume | Volume)[] = [];
        for (const uuid of level.levelActorUuids) {
            const actor = volumes.get(uuid);
            if (actor) arrVolumes.push(actor);
        }
        return arrVolumes;
    }

    public setPawnVolumes(pawn: BaseActor | CollidingMesh): void {
        const render = this.manGame.getComponent("render"), owner = pawn.getUnrealScriptProperty("Level");
        const levels = render.getLoadedSectors(), level = levels.find(sector => sector.levelInfoActor === owner);

        if (!level) throw new Error(`Pawn '${pawn.name}' has no registered level for SetVolumes.`);

        this.setActorVolumes(pawn, this.getLevelVolumes(level));
        // shortcut: loaded sectors are the attachment roster until native AddSWLevel ordering/lifetime is ported.
        for (const attached of levels)
            if (attached !== level) this.setActorVolumes(pawn, this.getLevelVolumes(attached));
    }

    public setPawnZone(pawn: BaseActor | CollidingMesh, test: boolean = false, forceRefresh: boolean = false): void {
        if (pawn.getUnrealScriptProperty("bPendingDelete")) return;

        const render = this.manGame.getComponent("render"), owner = pawn.getUnrealScriptProperty("Level");
        const level = render.getLoadedSectors().find(sector => sector.levelInfoActor === owner);

        if (!level) throw new Error(`Pawn '${pawn.name}' has no registered level for SetZone.`);
        if (forceRefresh) pawn.setUnrealScriptProperty("Region", { Zone: owner, iLeaf: -1, ZoneNumber: 0 });

        const oldRegion = pawn.getUnrealScriptProperty("Region") as any;
        const region = level.pointRegion(tmpZoneLocation.fromArray(pawn.getUnrealScriptProperty("Location") as number[]));
        const changedZone = oldRegion.Zone !== region.Zone;

        if (!oldRegion.Zone) throw new Error(`Pawn '${pawn.name}' has no initial zone for SetZone.`);
        if (!test && changedZone) {
            callZoneEvent(pawn, oldRegion.Zone, "ActorLeaving", [pawn as any]);
            callZoneEvent(pawn, pawn, "ZoneChange", [region.Zone as any]);
        }
        pawn.setUnrealScriptProperty("Region", region as any);
        if (!test && changedZone) callZoneEvent(pawn, region.Zone, "ActorEntered", [pawn as any]);

        tmpZoneLocation.fromArray(pawn.getUnrealScriptProperty("Location") as number[]);
        tmpZoneLocation.set(Math.fround(tmpZoneLocation.x), Math.fround(tmpZoneLocation.y), Math.fround(tmpZoneLocation.z));
        const touching = !!pawn.getUnrealScriptProperty("bCollideActors") && !test && !forceRefresh;
        const body = this.getPhysicsVolume(level, tmpZoneLocation, pawn, touching);
        const head = this.getPhysicsVolume(level, tmpVolumeLocation.copy(tmpZoneLocation).setZ(Math.fround(tmpZoneLocation.z + 13)), pawn, touching);
        const foot = this.getPhysicsVolume(level, tmpVolumeLocation.copy(tmpZoneLocation).setZ(Math.fround(tmpZoneLocation.z - pawn.getCollisionHeight())), pawn, touching);
        const oldBody = pawn.getUnrealScriptProperty("PhysicsVolume") as unknown as PhysicsVolume;

        if (body !== oldBody) {
            if (!test) {
                if (oldBody) {
                    callZoneEvent(pawn, oldBody, "PawnLeavingVolume", [pawn as any]);
                    callZoneEvent(pawn, pawn, "PhysicsVolumeChange", [body as any]);
                }
                const controller = pawn.getUnrealScriptProperty("Controller") as ScriptHost_T;
                if (controller) callZoneEvent(pawn, controller, "NotifyPhysicsVolumeChange", [body as any]);
            }
            pawn.setUnrealScriptProperty("PhysicsVolume", body as any);
            if (!test) callZoneEvent(pawn, body, "PawnEnteredVolume", [pawn as any]);
        }
        if (head !== pawn.getUnrealScriptProperty("HeadVolume")) {
            if (!test) {
                const controller = pawn.getUnrealScriptProperty("Controller") as ScriptHost_T;
                if (!controller || !callZoneEvent(pawn, controller, "NotifyHeadVolumeChange", [head as any])) callZoneEvent(pawn, pawn, "HeadVolumeChange", [head as any]);
            }
            pawn.setUnrealScriptProperty("HeadVolume", head as any);
        }
        this.updatePawnWaterHitEffect(pawn, foot);
        if (foot !== pawn.getUnrealScriptProperty("FootVolume")) pawn.setUnrealScriptProperty("FootVolume", foot as any);
    }
    public rayCheck(origin: Vector3, direction: Vector3, maxDistance: number, sourceCollider?: RAPIER.Collider, sourceBody?: RAPIER.RigidBody, sourceIsPlayer: boolean = true, sourceActor?: CollisionQuery_T["sourceActor"]): RayCheckResult_T | null {
        return this.collisionWorld.rayCheck(origin, direction, maxDistance, sourceCollider, sourceBody, sourceIsPlayer, sourceActor);
    }

    public registerSimulationObjects(root: Object3D): void {
        const sectors: SectorObject[] = [];
        root.updateMatrixWorld(true);
        root.traverse(object => {
            if ((object as any).isSectorObject) {
                const sector = object as SectorObject;
                sector.createZoneInfoActors();
                sector.createPhysicsVolumeActors();
                sector.createMusicVolumeActors();
                this.collisionWorld.registerPhysicsVolumes(sector.physicsVolumeActors, (sector as any).decodeLibrary, sector.musicVolumeActors, sector.getDefaultPhysicsVolume());
                sectors.push(sector);
            }
            if ((object as any).isTerrainBatch)
                for (const terrain of (object as any).sectors) this.registerObjectComponents(terrain);

            if ((object as any).particlePool || (object as any).isEmitterActor) this.simEmitters.add(object);
            this.registerObjectComponents(object);
        });

        for (const sector of sectors) {
            const volume = sector.getDefaultPhysicsVolume();
            const actors = new Set([sector.levelInfoActor, ...sector.zoneInfoActors, ...sector.physicsVolumeActors, ...sector.musicVolumeActors, volume]);
            sector.traverse((object: any) => {
                if (object.scriptActor) {
                    actors.add(object.scriptActor);
                }
            });
            const arrVolumes = this.getLevelVolumes(sector);
            const pending = [...actors].filter(actor => actor.isLevelActor && !actor.getComponent<ScriptComponent>("script").getHasBegunPlay());
            for (const actor of pending) {
                actor.setUnrealScriptProperty("Level", sector.levelInfoActor);
                actor.setUnrealScriptProperty("PhysicsVolume", volume as any);
            }
            for (const actor of pending) this.setActorZone(actor, true, true);
            for (const actor of pending) this.setActorVolumes(actor, arrVolumes);
            // shortcut: PreBeginPlay/BeginPlay and state execution remain unimplemented; initialize zones/volumes before PostBeginPlay.
            for (const actor of pending) actor.beginPlay();
        }

        this.lastMoverTriggerPosition.set(Infinity, Infinity, Infinity);
    }

    public registerCollider(object: ICollidable): void {
        if (!object.isCollidable) return;

        const actor = object as any;
        if (actor.scriptVM && actor.scriptActor === null) actor.setScriptRuntime(actor.scriptVM, actor.scriptObjectFactory);

        const primitive = object.getCollisionPrimitive ? object.getCollisionPrimitive() : null;
        const needsCollider = this.collisionWorld.usesRapier() || !primitive || primitive.kind === "cylinder" || (object as any).isMovableObject || (object as any).isRotatingObject || (object as any).isVehicle;
        const collider = needsCollider ? object.createCollider(this.physicsWorld) : null;
        const colliders = needsCollider ? object.getColliders ? object.getColliders() : [collider] : [];

        this.collisionWorld.register(object, colliders);
    }

    public unregisterSimulationObjects(root: Object3D): void {
        root.traverse(object => {
            if ((object as any).isSectorObject) {
                const sector = object as SectorObject;
                this.collisionWorld.unregisterPhysicsVolumes(sector.physicsVolumeActors);
            }
            if ((object as any).isTerrainBatch)
                for (const terrain of (object as any).sectors) this.unregisterObjectComponents(terrain);

            this.simEmitters.remove(object);
            this.unregisterObjectComponents(object);
        });
    }

    public refreshCollider(object: ICollidable & IObject & { refreshCollisionGeometry(): void }): void {
        const component = object.findComponent<ColliderComponent>("collider");

        if (!component) throw new Error(`Collidable '${object.name}' has no collider component.`);

        component.refresh(object);
    }

    public unregisterCollider(object: ICollidable): void {
        const collider = object.getCollider();
        const colliders = object.getColliders ? object.getColliders() : [collider];
        const rigidbody = object.getRigidbody();

        this.collisionWorld.unregister(object, colliders);

        for (const movement of this.getPhysicsComponents<PawnMovementComponent>("pawnMovement"))
            movement.removeIgnoredActor(object);

        if (rigidbody) this.physicsWorld.removeRigidBody(rigidbody);
        else for (const collider of colliders)
            if (collider) this.physicsWorld.removeCollider(collider, false);

        // removed handles are dead; createCollider must not hand the cached set back on re-stream
        if (object.releaseCollider) object.releaseCollider();
    }

    protected registerObjectComponents(object: Object3D): void {
        if (!(object as any).isGameObject) return;

        const components = (object as unknown as IObject).getComponents<IPhysicsComponent<any>>();

        for (const component of components)
            if (component.isPhysicsComponent) this.registerPhysicsComponent(component);
    }

    protected unregisterObjectComponents(object: Object3D): void {
        if (!(object as any).isGameObject) return;

        const components = (object as unknown as IObject).getComponents<IPhysicsComponent<any>>();

        for (const component of components)
            if (component.isPhysicsComponent) this.unregisterPhysicsComponent(component);
    }

    public registerPhysicsComponent(component: IPhysicsComponent<any>): void {
        if (component.isPhysicsAdded(this)) return;

        component.onPhysicsAdded(this);

        let components = this.physicsComponentsByName.get(component.componentName);

        if (!components) this.physicsComponentsByName.set(component.componentName, components = new Set());
        components.add(component);

        if (component.onTriggerPosition || component.onPhysicsTick)
            this.physicsComponents.add(component);
    }

    public unregisterPhysicsComponent(component: IPhysicsComponent<any>): void {
        if (!component.isPhysicsAdded(this)) return;

        this.physicsComponents.delete(component);

        const components = this.physicsComponentsByName.get(component.componentName);

        if (components) {
            components.delete(component);
            if (components.size === 0) this.physicsComponentsByName.delete(component.componentName);
        }

        component.onPhysicsRemoved(this);
    }

    protected updatePhysicsComponents(currentTime: number, deltaTime: number): boolean {
        const triggerChanged = !this.lastMoverTriggerPosition.equals(this.triggerPosition);
        let didUpdate = false;

        arrMoverPawns.length = 0;
        for (const movement of this.getPhysicsComponents<PawnMovementComponent>("pawnMovement")) arrMoverPawns.push(movement.getParent());

        if (triggerChanged) this.lastMoverTriggerPosition.copy(this.triggerPosition);

        for (const component of this.physicsComponents) {
            if (triggerChanged) component.onTriggerPosition?.(currentTime, this.triggerPosition);
            if (component.onPhysicsTick?.(currentTime, deltaTime, arrMoverPawns)) didUpdate = true;
        }

        return didUpdate;
    }
}

class EmitterSimulation {
    protected readonly emitters = new Set<any>();
    protected readonly actors = new Set<any>();

    public getSize(): number { return this.emitters.size + this.actors.size; }
    public getEmitters(): ReadonlySet<any> { return this.emitters; }
    public syncParticles(): void { for (const emitter of this.emitters) emitter.syncParticles(); }

    public add(emitter: Object3D): void {
        if ((emitter as any).isEmitterActor) this.actors.add(emitter);
        else this.emitters.add(emitter);
    }
    public remove(emitter: Object3D): void {
        this.emitters.delete(emitter);
        this.actors.delete(emitter);
    }

    public static setWarmupGate(root: Object3D, allowed: boolean): void {
        root.traverse(child => {
            if ((child as any).particlePool) (child as any).warmupGate = allowed;
        });
    }

    public static isEffectFinished(effect: Object3D): boolean {
        let hasEmitter = false;
        let isFinished = true;

        effect.traverse(child => {
            const emitter = child as any;

            if (!emitter.particlePool) return;

            hasEmitter = true;
            if (!emitter.isFinished()) isFinished = false;
        });

        return hasEmitter && isFinished;
    }

    public tick(currentTime: number, deltaTime: number, renderManager?: RenderManager): void {
        for (const actor of this.actors)
            if (actor.updateEmitters(currentTime, deltaTime)) {
                if (!renderManager) throw new Error(`Emitter '${actor.name}' destruction requires its render manager.`);
                renderManager.removeTransientEffect(actor);
            }

        for (const emitter of this.emitters)
            if (!this.actors.has(emitter.parent)) emitter.update(currentTime, deltaTime);
    }
}
export default PhysicsManager;
