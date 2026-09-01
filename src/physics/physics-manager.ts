import RAPIER from "@dimforge/rapier3d";
import { Object3D, Vector3 } from "three";
import { IEngineComponent, IObject } from "../game/components";
import CollisionWorld, { CheckResult_T, CollisionBackend_T, CollisionQuery_T, RayCheckResult_T } from "./collision-world";
import Player from "../player";
import { ColliderComponent, IPhysicsComponent } from "./components/physics-component";
import NpcSimulationComponent from "./components/npc-simulation-component";
import PawnMovementComponent from "./components/pawn-movement-component";

import type BaseActor from "../base-actor";
import type GameManager from "../game/game-manager";
import type { ICollidable } from "../objects/objects";
import type { SectorObject } from "../objects/zone-object";
import type { ICharacterGroup, ICharacterArmorSelection } from "@l2js/engine/contracts/pawn";

const arrMoverPawns: BaseActor[] = [];
const emptyPhysicsComponents = new Set<IPhysicsComponent<any>>();

export class PhysicsManager implements IEngineComponent<GameManager> {
    protected static readonly PLAYER_PHYSICS_HZ = 60;
    protected static readonly PHYSICS_HZ = 30;
    protected static readonly PLAYER_PHYSICS_INTERVAL_MS = 1000 / PhysicsManager.PLAYER_PHYSICS_HZ;
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
    protected nextPlayerPhysicsTick: number;
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

        this.nextPlayerPhysicsTick = currentTime + PhysicsManager.PLAYER_PHYSICS_INTERVAL_MS;
        this.nextPhysicsTick = currentTime + PhysicsManager.PHYSICS_INTERVAL_MS;
    }

    public onBeforeEngineTick(currentTime: number, deltaTime: number): void {
        const manRender = this.manGame.getComponent("render");

        this.simEmitters.setFrameTime(deltaTime);

        let playerPhysicsTicks = 0;
        let updatedPhysicsComponent = false;

        while (this.nextPlayerPhysicsTick <= currentTime && playerPhysicsTicks++ < PhysicsManager.MAX_PHYSICS_TICKS) {
            updatedPhysicsComponent = this.updatePhysicsComponents(this.nextPlayerPhysicsTick, PhysicsManager.PLAYER_PHYSICS_INTERVAL_MS, PhysicsManager.PLAYER_PHYSICS_HZ) || updatedPhysicsComponent;
            this.nextPlayerPhysicsTick += PhysicsManager.PLAYER_PHYSICS_INTERVAL_MS;
        }

        if (this.nextPlayerPhysicsTick <= currentTime)
            this.nextPlayerPhysicsTick = currentTime + PhysicsManager.PLAYER_PHYSICS_INTERVAL_MS;

        // nothing reads the rapier world under the analytical backend
        const stepsRapier = this.collisionWorld.usesRapier();
        let physicsTicks = 0;

        while (this.nextPhysicsTick <= currentTime && physicsTicks++ < PhysicsManager.MAX_PHYSICS_TICKS) {
            updatedPhysicsComponent = this.updatePhysicsComponents(this.nextPhysicsTick, PhysicsManager.PHYSICS_INTERVAL_MS, PhysicsManager.PHYSICS_HZ) || updatedPhysicsComponent;
            this.simEmitters.tick(this.nextPhysicsTick);
            if (stepsRapier) this.physicsWorld.step();
            this.nextPhysicsTick += PhysicsManager.PHYSICS_INTERVAL_MS;
        }

        if (this.nextPhysicsTick <= currentTime)
            this.nextPhysicsTick = currentTime + PhysicsManager.PHYSICS_INTERVAL_MS;

        if (playerPhysicsTicks > 0 && updatedPhysicsComponent || physicsTicks > 0 && (this.simEmitters.size > 0 || updatedPhysicsComponent))
            manRender.needsUpdate = true;
    }

    public getPhysicsComponents<T extends IPhysicsComponent<any>>(componentName: string): ReadonlySet<T> {
        return (this.physicsComponentsByName.get(componentName) || emptyPhysicsComponents) as ReadonlySet<T>;
    }

    public setActiveSector(sector: SectorObject): void { this.simEmitters.setActiveSector(sector); }
    public setTriggerPosition(position: Vector3): void { this.triggerPosition.copy(position); }

    // emitters live under sector.zones, not staticMeshGroup - always walk the whole sector
    public setEmitterWarmupGate(root: Object3D, allowed: boolean): void { EmitterSimulation.setWarmupGate(root, allowed); }
    public isEmitterEffectFinished(effect: Object3D): boolean { return EmitterSimulation.isEffectFinished(effect); }

    public addPawn(pawn: BaseActor, expires: number = Infinity, nextTurn: number = Infinity): void {
        const movement = pawn.getComponent<PawnMovementComponent>("pawnMovement");
        const simulation = pawn.findComponent<NpcSimulationComponent>("npcSimulation") || pawn.addComponent(new NpcSimulationComponent());

        movement.setPhysicsTickRate(PhysicsManager.PHYSICS_HZ);
        simulation.configure(expires, nextTurn);
        this.registerSimulationObjects(pawn);

        arrMoverPawns.length = 0;
        for (const movement of this.getPhysicsComponents<PawnMovementComponent>("pawnMovement")) arrMoverPawns.push(movement.getParent());

        pawn.ignoreOverlappingActors(arrMoverPawns);
    }

    public removePawn(pawn: BaseActor): boolean {
        const simulation = pawn.findComponent<NpcSimulationComponent>("npcSimulation");

        if (!simulation || !simulation.isPhysicsAdded(this)) return false;

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
                this_.addPawn(pawn, performance.now() + NpcSimulationComponent.LIFETIME, 0);
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
    public moveActor(query: CollisionQuery_T): CheckResult_T | null { return this.collisionWorld.moveActor(query); }
    public singleLineCheck(query: CollisionQuery_T): CheckResult_T | null { return this.collisionWorld.singleLineCheck(query); }
    public rayCheck(origin: Vector3, direction: Vector3, maxDistance: number, sourceCollider?: RAPIER.Collider, sourceBody?: RAPIER.RigidBody, sourceIsPlayer: boolean = true): RayCheckResult_T | null {
        return this.collisionWorld.rayCheck(origin, direction, maxDistance, sourceCollider, sourceBody, sourceIsPlayer);
    }

    public registerSimulationObjects(root: Object3D): void {
        root.updateMatrixWorld(true);
        root.traverse(object => {
            if ((object as any).isTerrainBatch)
                for (const terrain of (object as any).sectors) this.registerObjectComponents(terrain);

            if ((object as any).particlePool) this.simEmitters.add(object);
            this.registerObjectComponents(object);
        });

        this.lastMoverTriggerPosition.set(Infinity, Infinity, Infinity);
    }

    public registerCollider(object: ICollidable): void {
        if (!object.isCollidable) return;

        const collider = object.createCollider(this.physicsWorld);
        const colliders = object.getColliders ? object.getColliders() : [collider];

        this.collisionWorld.register(object, colliders);
    }

    public unregisterSimulationObjects(root: Object3D): void {
        root.traverse(object => {
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

        this.collisionWorld.unregister(colliders);

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

    protected updatePhysicsComponents(currentTime: number, deltaTime: number, tickRate: number): boolean {
        const triggerChanged = tickRate === PhysicsManager.PHYSICS_HZ && !this.lastMoverTriggerPosition.equals(this.triggerPosition);
        let didUpdate = false;

        arrMoverPawns.length = 0;
        for (const movement of this.getPhysicsComponents<PawnMovementComponent>("pawnMovement")) arrMoverPawns.push(movement.getParent());

        if (triggerChanged) this.lastMoverTriggerPosition.copy(this.triggerPosition);

        for (const component of this.physicsComponents) {
            if ((component.getPhysicsTickRate ? component.getPhysicsTickRate() : PhysicsManager.PHYSICS_HZ) !== tickRate) continue;
            if (triggerChanged) component.onTriggerPosition?.(currentTime, this.triggerPosition);
            if (component.onPhysicsTick?.(currentTime, deltaTime, arrMoverPawns)) didUpdate = true;
        }

        return didUpdate;
    }
}

class EmitterSimulation {
    protected static readonly OFFSCREEN_HZ = 2;
    protected static readonly OFFSCREEN_INTERVAL_MS = 1000 / EmitterSimulation.OFFSCREEN_HZ;
    protected static readonly MIN_DESIRED_FRAME_RATE = 35;
    protected static readonly AGGRESSIVE_LOD_FRAME_RATE = EmitterSimulation.MIN_DESIRED_FRAME_RATE - 5;
    protected static readonly DROP_DETAIL_FRAME_TIME_MS = 1000 / EmitterSimulation.MIN_DESIRED_FRAME_RATE;
    protected static readonly AGGRESSIVE_LOD_FRAME_TIME_MS = 1000 / EmitterSimulation.AGGRESSIVE_LOD_FRAME_RATE;
    protected static readonly MAX_OFFSCREEN_UPDATES = 32;
    protected static readonly DROP_DETAIL_OFFSCREEN_UPDATES = 8;
    protected static readonly FROZEN_UPDATE_MATRIX_WORLD = function () { };

    protected readonly emitters = new Set<any>();
    protected activeSector: SectorObject = null;
    protected detailFrame = 0;
    protected dropDetail = false;
    protected aggressiveLod = false;

    public get size(): number { return this.emitters.size; }

    public add(emitter: Object3D): void { this.emitters.add(emitter); }
    public remove(emitter: Object3D): void { this.emitters.delete(emitter); }
    public setActiveSector(sector: SectorObject): void { this.activeSector = sector; }

    public setFrameTime(deltaTime: number): void {
        this.dropDetail = deltaTime > EmitterSimulation.DROP_DETAIL_FRAME_TIME_MS;
        this.aggressiveLod = deltaTime > EmitterSimulation.AGGRESSIVE_LOD_FRAME_TIME_MS;
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

    public tick(currentTime: number): void {
        this.detailFrame = (this.detailFrame + 1) % 6;

        const offscreenUpdateLimit = this.aggressiveLod
            ? 0
            : this.dropDetail
                ? EmitterSimulation.DROP_DETAIL_OFFSCREEN_UPDATES
                : EmitterSimulation.MAX_OFFSCREEN_UPDATES;
        let offscreenUpdates = 0;

        for (const emitter of this.emitters) {
            if (!EmitterSimulation.isHierarchyVisible(emitter)) continue;

            let sector: SectorObject = null;
            let parent = emitter.parent;

            while (parent) {
                if ((parent as any).isSectorObject) {
                    sector = parent as SectorObject;
                    break;
                }

                parent = parent.parent;
            }

            const emitterUuid = emitter.emitterActorUuid;
            const isVisible = emitter.isActorAttachedEmitter || (!!sector && emitterUuid !== undefined && sector.visibleEmitterUuids.has(emitterUuid));
            const isOffscreen = (sector && sector !== this.activeSector && !emitter.needsInitialLighting) || !isVisible;

            if (isOffscreen) {
                const wasOffscreen = !!emitter.isOffscreenThrottled;
                const isMaintenanceDue = EmitterSimulation.shouldUpdateOffscreen(emitter, currentTime);

                if (offscreenUpdates < offscreenUpdateLimit && isMaintenanceDue) {
                    offscreenUpdates++;
                    emitter.updateMatrixWorld = Object3D.prototype.updateMatrixWorld;
                    emitter.update(currentTime);
                    EmitterSimulation.freezeParticles(emitter);
                } else if (!wasOffscreen) EmitterSimulation.freezeParticles(emitter);

                emitter.updateMatrixWorld = EmitterSimulation.FROZEN_UPDATE_MATRIX_WORLD;
                continue;
            }

            const shouldUpdate = EmitterSimulation.shouldUpdateVisible(emitter, this.detailFrame, this.dropDetail, this.aggressiveLod);

            emitter.isOffscreenThrottled = false;
            emitter.updateMatrixWorld = Object3D.prototype.updateMatrixWorld;

            if (shouldUpdate) emitter.update(currentTime);
        }
    }

    protected static freezeParticles(emitter: any): void {
        for (const particle of emitter.particlePool) {
            particle.visible = false;
            particle.updateMatrixWorld = EmitterSimulation.FROZEN_UPDATE_MATRIX_WORLD;
        }

        if (emitter.instancedMesh) emitter.instancedMesh.visible = false;
    }

    protected static getPhase(emitter: any): number {
        if (emitter.detailPhase !== undefined) return emitter.detailPhase;

        let hash = 2166136261;
        for (let i = 0; i < emitter.uuid.length; i++) {
            hash ^= emitter.uuid.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }

        return emitter.detailPhase = hash >>> 0;
    }

    protected static shouldUpdateOffscreen(emitter: any, currentTime: number): boolean {
        if (!emitter.isOffscreenThrottled) {
            emitter.isOffscreenThrottled = true;
            emitter.offscreenSince = currentTime;
            emitter.nextOffscreenUpdate = currentTime + EmitterSimulation.OFFSCREEN_INTERVAL_MS + EmitterSimulation.getPhase(emitter) % EmitterSimulation.OFFSCREEN_INTERVAL_MS;
            return true;
        }

        const inactiveTimeout = emitter.secondsBeforeInactive ?? 0;
        if (inactiveTimeout > 0 && currentTime - emitter.offscreenSince > inactiveTimeout * 1000)
            return false;

        if (currentTime < emitter.nextOffscreenUpdate) return false;

        const missedIntervals = Math.floor((currentTime - emitter.nextOffscreenUpdate) / EmitterSimulation.OFFSCREEN_INTERVAL_MS) + 1;
        emitter.nextOffscreenUpdate += missedIntervals * EmitterSimulation.OFFSCREEN_INTERVAL_MS;

        return true;
    }

    protected static shouldUpdateVisible(emitter: any, detailFrame: number, dropDetail: boolean, aggressiveLod: boolean): boolean {
        if (!dropDetail || !emitter.instancedMesh?.visible || emitter.isOffscreenThrottled) return true;

        const phase = EmitterSimulation.getPhase(emitter) + detailFrame;

        // UE2 drop-detail retains roughly 65% of the normal xEmitter budget.
        return aggressiveLod ? (phase & 1) === 0 : phase % 3 !== 0;
    }

    protected static isHierarchyVisible(object: Object3D): boolean {
        for (let current: Object3D = object; current; current = current.parent)
            if (!current.visible) return false;

        return true;
    }
}
export default PhysicsManager;
