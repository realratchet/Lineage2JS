import RAPIER from "@dimforge/rapier3d";
import { Object3D, Vector2, Vector3 } from "three";
import { IEngineComponent } from "@client/game/components";
import CollisionWorld, { CheckResult_T, CollisionBackend_T, CollisionQuery_T, RayCheckResult_T } from "@client/physics/collision-world";
import { encompassesVolume, findVolumeTransition } from "@client/physics/volume-bsp";
import Player from "@client/player";
import WaterHitEffect from "@client/rendering/water-hit-effect";

import type BaseActor from "@client/base-actor";
import type GameManager from "@client/game/game-manager";
import type MovableObject from "@client/objects/movable-object";
import type RotatingObject from "@client/objects/rotating-object";
import type RenderManager from "@client/rendering/render-manager";
import type UnderWaterEffect from "@client/rendering/under-water-effect";
import type { ICollidable } from "@client/objects/objects";
import type { SectorObject } from "@client/objects/zone-object";

const tmpSimDirection = new Vector3();
const tmpWaterSurfaceEnd = new Vector3();
const tmpWaterFloorStart = new Vector3();
const tmpWaterHitStart = new Vector3();
const tmpWaterHitEnd = new Vector3();
const tmpWaterHitPosition = new Vector3();
const tmpDown = new Vector3(0, 0, -1);
const tmpSunBeamSample = new Vector2();
const arrMoverPawns: BaseActor[] = [];
const arrWaitingMovers: [MovableObject, number][] = [];
const arrActiveMovers: MovableObject[] = [];

type SimulatedPawnState_T = { expires: number, nextTurn: number };

class PhysicsManager implements IEngineComponent<GameManager> {
    protected static readonly PLAYER_PHYSICS_HZ = 60;
    protected static readonly PHYSICS_HZ = 30;
    protected static readonly PLAYER_PHYSICS_INTERVAL_MS = 1000 / PhysicsManager.PLAYER_PHYSICS_HZ;
    protected static readonly PHYSICS_INTERVAL_MS = 1000 / PhysicsManager.PHYSICS_HZ;
    protected static readonly MAX_PHYSICS_TICKS = 8;
    protected static readonly UNDERWATER_SUN_BEAM_DEPTH = 2000;
    protected static readonly UNDERWATER_SUN_BEAM_TRACE_START = 200;
    protected static readonly UNDERWATER_SAMPLE_DISTANCE_SQ = 40000;
    protected static readonly WATER_HIT_SURFACE_HEIGHT = 20;
    protected static readonly WATER_HIT_MIN_SURFACE_HEIGHT = 0.85;

    protected manGame: GameManager;
    protected waterHitEffect: WaterHitEffect;

    protected readonly simPawns = new PawnSimulation(); // for en-masse pawn phys sim
    protected readonly simEmitters = new EmitterSimulation();
    protected simCharGroups: GD.ICharacterGroup[] = null;

    protected readonly physicsWorld = new RAPIER.World(new Vector3(0, 0, -9.8 * 100));
    protected readonly collisionWorld = new CollisionWorld(this.physicsWorld, PhysicsManager.getCollisionBackend());
    protected readonly collidables = new Set<ICollidable>();
    protected readonly movableObjects = new Set<MovableObject>();
    protected readonly activeMovableObjects = new Set<MovableObject>();
    protected readonly waitingMovableObjects = new Map<MovableObject, number>();
    protected readonly rotatingObjects = new Set<RotatingObject>();
    protected readonly triggerPosition = new Vector3(Infinity, Infinity, Infinity);
    protected readonly lastMoverTriggerPosition = new Vector3(Infinity, Infinity, Infinity);
    protected readonly underWaterPosition = new Vector3(Infinity, Infinity, Infinity);
    protected readonly lastUnderWaterSamplingLocation = new Vector3(Infinity, Infinity, Infinity);
    protected underWaterVolume: GD.IWaterVolumeDecodeInfo = null;
    protected hasUnderWaterSample = false;
    protected wasUnderWaterDay = false;
    protected isUnderWaterDay = false;
    protected waterHitEffectName: string = null;
    protected waterHitElapsed = 0;
    protected waterHitInterval = 0;
    protected moverPosition = 0;

    protected nextPlayerPhysicsTick: number;
    protected nextPhysicsTick: number;

    protected static getCollisionBackend(): CollisionBackend_T {
        const backend = new URLSearchParams(location.search).get("collisionBackend") || "ue";

        if (backend !== "ue" && backend !== "rapier" && backend !== "compare") throw new Error(`Unknown collision backend '${backend}'.`);

        return backend;
    }

    public setParent(parent: GameManager): this {
        this.manGame = parent;

        const manRender = parent.getComponent("render");

        this.waterHitEffect = new WaterHitEffect(manRender.player, manRender);

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

        this.simPawns.maintainSimulatedPawns(manRender, currentTime);
        this.simEmitters.setFrameTime(deltaTime);

        let playerPhysicsTicks = 0;

        while (this.nextPlayerPhysicsTick <= currentTime && playerPhysicsTicks++ < PhysicsManager.MAX_PHYSICS_TICKS) {
            manRender.player.updatePhysics(this.nextPlayerPhysicsTick, 1 / PhysicsManager.PLAYER_PHYSICS_HZ);
            this.nextPlayerPhysicsTick += PhysicsManager.PLAYER_PHYSICS_INTERVAL_MS;
        }

        if (this.nextPlayerPhysicsTick <= currentTime)
            this.nextPlayerPhysicsTick = currentTime + PhysicsManager.PLAYER_PHYSICS_INTERVAL_MS;

        // nothing reads the rapier world under the analytical backend
        const stepsRapier = this.collisionWorld.usesRapier();
        let physicsTicks = 0;

        while (this.nextPhysicsTick <= currentTime && physicsTicks++ < PhysicsManager.MAX_PHYSICS_TICKS) {
            this.updateMovableObjects(this.nextPhysicsTick);
            this.updateRotatingObjects(PhysicsManager.PHYSICS_INTERVAL_MS);
            this.simPawns.tickSimulatedPawns(this.nextPhysicsTick, 1 / PhysicsManager.PHYSICS_HZ);
            this.updateWaterHitEffect(manRender.player, manRender.getLoadedSectors(), PhysicsManager.PHYSICS_INTERVAL_MS);
            this.updateUnderWaterSunBeam(manRender.underWaterEffect);
            this.simEmitters.tick(this.nextPhysicsTick);
            if (stepsRapier) this.physicsWorld.step();
            this.nextPhysicsTick += PhysicsManager.PHYSICS_INTERVAL_MS;
        }

        if (this.nextPhysicsTick <= currentTime)
            this.nextPhysicsTick = currentTime + PhysicsManager.PHYSICS_INTERVAL_MS;

        if (physicsTicks > 0 && (this.simEmitters.size > 0 || this.rotatingObjects.size > 0 || this.activeMovableObjects.size > 0))
            manRender.needsUpdate = true;
    }

    public getSimulatedPawns(): ReadonlySet<BaseActor> { return this.simPawns.getPawns(); }

    public setActiveSector(sector: SectorObject): void { this.simEmitters.setActiveSector(sector); }
    public setTriggerPosition(position: Vector3): void { this.triggerPosition.copy(position); }
    public setUnderWaterState(position: Vector3, isDay: boolean): void { this.underWaterPosition.copy(position); this.isUnderWaterDay = isDay; }

    public setMoverPosition(position: number): void {
        this.moverPosition = position;
        this.activeMovableObjects.clear();
        this.waitingMovableObjects.clear();
        this.movableObjects.forEach(mover => mover.setPosition(position));
    }

    // emitters live under sector.zones, not staticMeshGroup - always walk the whole sector
    public setEmitterWarmupGate(root: Object3D, allowed: boolean): void { EmitterSimulation.setWarmupGate(root, allowed); }
    public isEmitterEffectFinished(effect: Object3D): boolean { return EmitterSimulation.isEffectFinished(effect); }

    public addPawn(pawn: BaseActor, expires: number = Infinity, nextTurn: number = Infinity): void {
        const manRender = this.manGame.getComponent("render");

        this.registerSimulationObjects(pawn);

        arrMoverPawns.length = 0;
        arrMoverPawns.push(manRender.player);

        for (const actor of this.simPawns.getPawns()) arrMoverPawns.push(actor);

        pawn.ignoreOverlappingActors(arrMoverPawns);
        this.simPawns.addPawn(pawn, expires, nextTurn);
    }

    public removePawn(pawn: BaseActor): boolean {
        if (!this.simPawns.removePawn(pawn)) return false;

        this.unregisterSimulationObjects(pawn);

        return true;
    }

    public async simulatePawns(count: number = PawnSimulation.DEFAULT_COUNT): Promise<void> {
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
                const armor: GD.ICharacterArmorSelection = { chest: 0, legs: 0, gloves: 0, boots: 0 };
                const pawn = new Player(manRender);

                for (const slot of Object.keys(armor) as (keyof GD.ICharacterArmorSelection)[]) {
                    const items = group.armor[slot];

                    armor[slot] = items.length > 0 && Math.random() < 0.75 ? items[Math.floor(Math.random() * items.length)].id : 0;
                }

                pawn.name = `SimPawn${index}`;

                await manAsset.loadCharacter(manRender, group.index, Math.floor(Math.random() * group.faceVariants), hair, colours[Math.floor(Math.random() * colours.length)], armor, pawn);

                manRender.scene.add(pawn);
                pawn.position.copy(manRender.controls.orbit.target);
                pawn.updateMatrixWorld(true);
                this_.addPawn(pawn, performance.now() + PawnSimulation.LIFETIME, 0);
                manRender.needsUpdate = true;
            }
        }

        for (let i = 0; i < PawnSimulation.CONCURRENCY; i++) arrWorkers.push(worker());

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

    protected updateWaterHitEffect(owner: BaseActor, sectors: readonly SectorObject[], deltaTime: number): void {
        if (!owner.isSwimmingMovement()) {
            this.waterHitEffectName = null;
            this.waterHitElapsed = 0;
            return;
        }

        const height = owner.getCollisionHeight();

        tmpWaterHitStart.copy(owner.position);
        tmpWaterHitEnd.copy(tmpWaterHitStart);
        tmpWaterHitEnd.z += height * 2 + PhysicsManager.WATER_HIT_SURFACE_HEIGHT;

        let selectedSector: SectorObject = null;
        let selectedVolume: GD.IWaterVolumeDecodeInfo = null;
        let selectedTime = 0;

        for (const sector of sectors) {
            if (!sector.waterVolumes) continue;

            for (const volume of sector.waterVolumes) {
                const startsInside = encompassesVolume(tmpWaterHitStart, volume.bsp);

                if (!startsInside || encompassesVolume(tmpWaterHitEnd, volume.bsp)) continue;

                const time = findVolumeTransition(tmpWaterHitStart, tmpWaterHitEnd, volume.bsp, true);
                const surfaceHeight = time * (height * 2 + PhysicsManager.WATER_HIT_SURFACE_HEIGHT);

                if (surfaceHeight < height * (1 + PhysicsManager.WATER_HIT_MIN_SURFACE_HEIGHT)) continue;
                if (!selectedVolume || volume.priority >= selectedVolume.priority) {
                    selectedSector = sector;
                    selectedVolume = volume;
                    selectedTime = time;
                }
            }
        }

        if (!selectedVolume) {
            this.waterHitEffectName = null;
            this.waterHitElapsed = 0;
            return;
        }

        const speed = owner.getSpeed();
        const effectName = PhysicsManager.getWaterHitEffectName(selectedSector, selectedVolume, speed > 0);

        if (!effectName) return;

        this.waterHitElapsed += deltaTime / 1000;

        if (effectName === this.waterHitEffectName && this.waterHitElapsed < this.waterHitInterval) return;

        this.waterHitEffectName = effectName;
        this.waterHitElapsed = 0;

        tmpWaterHitPosition.lerpVectors(tmpWaterHitStart, tmpWaterHitEnd, selectedTime);
        this.waterHitInterval = this.waterHitEffect.spawn(selectedSector, effectName, tmpWaterHitPosition, speed);
    }

    protected static getWaterHitEffectName(sector: SectorObject, volume: GD.IWaterVolumeDecodeInfo, isMoving: boolean): string | null {
        if (!volume.scriptClassId) throw new Error(`Water volume '${volume.name}' has no UnrealScript class.`);

        let waitHitEffect: GD.ScriptPropertyValue_T = null;
        let runHitEffect: GD.ScriptPropertyValue_T = null;
        const waitSlot = { get: () => waitHitEffect, set: (value: GD.ScriptPropertyValue_T) => waitHitEffect = value };
        const runSlot = { get: () => runHitEffect, set: (value: GD.ScriptPropertyValue_T) => runHitEffect = value };
        const fn = sector.scriptVM.findFunction(volume.scriptClassId, "GetHitEffectName");

        sector.scriptVM.invoke(volume, fn, [waitSlot, runSlot]);

        const effectName = isMoving ? runHitEffect : waitHitEffect;

        if (effectName === null) return null;
        if (typeof effectName !== "string") throw new Error(`'${volume.scriptClassId}.GetHitEffectName' returned a non-name value.`);

        return effectName;
    }

    protected sampleUnderWaterSunBeam(position: Vector3, volume: GD.IWaterVolumeDecodeInfo, target: Vector2): boolean {
        tmpWaterSurfaceEnd.copy(position);
        tmpWaterSurfaceEnd.z += PhysicsManager.UNDERWATER_SUN_BEAM_DEPTH;

        const surfaceTime = findVolumeTransition(position, tmpWaterSurfaceEnd, volume.bsp, true);

        if (surfaceTime <= 0 || surfaceTime >= 1) return false;

        const surfaceZ = position.z + PhysicsManager.UNDERWATER_SUN_BEAM_DEPTH * surfaceTime;

        tmpWaterFloorStart.set(position.x, position.y, surfaceZ - PhysicsManager.UNDERWATER_SUN_BEAM_TRACE_START);

        const floorHit = this.rayCheck(tmpWaterFloorStart, tmpDown, PhysicsManager.UNDERWATER_SUN_BEAM_DEPTH - PhysicsManager.UNDERWATER_SUN_BEAM_TRACE_START, undefined, undefined, false);

        if (!floorHit || floorHit.distance <= 0 || floorHit.distance >= PhysicsManager.UNDERWATER_SUN_BEAM_DEPTH - PhysicsManager.UNDERWATER_SUN_BEAM_TRACE_START) return false;

        target.set(surfaceZ, surfaceZ - floorHit.location.z);

        return true;
    }

    protected updateUnderWaterSunBeam(effect: UnderWaterEffect): void {
        const volume = effect.getVolume();

        if (!effect.visible || !effect.hasSunBeamEffects()) return;

        if (!this.isUnderWaterDay) {
            this.wasUnderWaterDay = false;
            this.hasUnderWaterSample = false;
            effect.setSunBeamVisible(false);
            return;
        }

        if (!this.wasUnderWaterDay || this.underWaterVolume !== volume) this.hasUnderWaterSample = false;

        this.wasUnderWaterDay = true;
        this.underWaterVolume = volume;

        if (this.hasUnderWaterSample && this.lastUnderWaterSamplingLocation.distanceToSquared(this.underWaterPosition) <= PhysicsManager.UNDERWATER_SAMPLE_DISTANCE_SQ) return;

        this.lastUnderWaterSamplingLocation.copy(this.underWaterPosition);
        this.hasUnderWaterSample = true;

        if (!volume || !this.sampleUnderWaterSunBeam(this.underWaterPosition, volume, tmpSunBeamSample)) {
            effect.setSunBeamVisible(false);
            return;
        }

        effect.setSunBeamSample(this.underWaterPosition, tmpSunBeamSample.x, tmpSunBeamSample.y);
    }

    public registerSimulationObjects(root: Object3D): void {
        root.updateMatrixWorld(true);
        root.traverse((object: ICollidable) => {
            if ((object as any).isTerrainBatch)
                for (const terrain of (object as any).sectors) this.registerCollider(terrain);

            if ((object as any).particlePool) this.simEmitters.add(object);
            if ((object as any).isRotatingObject) this.rotatingObjects.add(object as unknown as RotatingObject);
            if ((object as any).isMovableObject) {
                const mover = object as unknown as MovableObject;

                this.movableObjects.add(mover);
                mover.setPosition(this.moverPosition);
            }

            this.registerCollider(object);
        });

        this.lastMoverTriggerPosition.set(Infinity, Infinity, Infinity);
    }

    public registerCollider(object: ICollidable): void {
        if (!object.isCollidable || this.collidables.has(object)) return;

        const collider = object.createCollider(this.physicsWorld);
        const colliders = object.getColliders ? object.getColliders() : [collider];

        this.collidables.add(object);
        this.collisionWorld.register(object, colliders);
    }

    public unregisterSimulationObjects(root: Object3D): void {
        root.traverse((object: ICollidable) => {
            if ((object as any).isTerrainBatch)
                for (const terrain of (object as any).sectors) this.unregisterCollider(terrain);

            this.simEmitters.remove(object);
            this.rotatingObjects.delete(object as unknown as RotatingObject);
            this.movableObjects.delete(object as unknown as MovableObject);
            this.activeMovableObjects.delete(object as unknown as MovableObject);
            this.waitingMovableObjects.delete(object as unknown as MovableObject);
            this.unregisterCollider(object);
        });
    }

    public refreshCollider(object: ICollidable & { refreshCollisionGeometry(): void }): void {
        this.unregisterCollider(object);
        object.refreshCollisionGeometry();
        this.registerCollider(object);
    }

    public unregisterCollider(object: ICollidable): void {
        if (!this.collidables.has(object)) return;

        const collider = object.getCollider();
        const colliders = object.getColliders ? object.getColliders() : [collider];
        const rigidbody = object.getRigidbody();

        this.collidables.delete(object);
        this.collisionWorld.unregister(colliders);

        if (rigidbody) this.physicsWorld.removeRigidBody(rigidbody);
        else for (const collider of colliders)
            if (collider) this.physicsWorld.removeCollider(collider, false);

        // removed handles are dead; createCollider must not hand the cached set back on re-stream
        if (object.releaseCollider) object.releaseCollider();
    }

    protected scheduleMovableObject(mover: MovableObject, nextUpdate: number): void {
        this.activeMovableObjects.delete(mover);
        this.waitingMovableObjects.delete(mover);

        if (nextUpdate === 0) this.activeMovableObjects.add(mover);
        else if (nextUpdate > 0) this.waitingMovableObjects.set(mover, nextUpdate);
    }

    protected updateMovableObjects(currentTime: number): void {
        const manRender = this.manGame.getComponent("render");

        arrMoverPawns.length = 0;
        arrMoverPawns.push(manRender.player);
        for (const actor of this.simPawns.getPawns()) arrMoverPawns.push(actor);

        if (!this.lastMoverTriggerPosition.equals(this.triggerPosition)) {
            this.lastMoverTriggerPosition.copy(this.triggerPosition);

            this.movableObjects.forEach(mover => {
                const nextUpdate = mover.tryTrigger(currentTime, this.triggerPosition);

                if (nextUpdate !== null) this.scheduleMovableObject(mover, nextUpdate);
            });
        }

        arrWaitingMovers.length = 0;
        for (const entry of this.waitingMovableObjects) arrWaitingMovers.push(entry);
        for (const [mover, wakeTime] of arrWaitingMovers)
            if (currentTime >= wakeTime)
                this.scheduleMovableObject(mover, mover.updateMover(currentTime, arrMoverPawns));

        arrActiveMovers.length = 0;
        for (const mover of this.activeMovableObjects) arrActiveMovers.push(mover);
        for (const mover of arrActiveMovers)
            this.scheduleMovableObject(mover, mover.updateMover(currentTime, arrMoverPawns));
    }

    protected updateRotatingObjects(deltaTime: number): void {
        this.rotatingObjects.forEach(object => object.updateRotation(deltaTime));
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

class PawnSimulation {
    public static readonly DEFAULT_COUNT = 10;
    public static readonly LIFETIME = 15000;
    public static readonly CONCURRENCY = 3;
    protected static readonly TURN_INTERVAL = 1000;

    protected readonly pawns = new Set<BaseActor>();
    protected readonly states = new Map<BaseActor, SimulatedPawnState_T>();

    public getPawns(): ReadonlySet<BaseActor> { return this.pawns; }

    public addPawn(pawn: BaseActor, expires: number, nextTurn: number): void {
        this.pawns.add(pawn);
        this.states.set(pawn, { expires, nextTurn });
    }

    public removePawn(pawn: BaseActor): boolean {
        if (!this.pawns.delete(pawn)) return false;

        this.states.delete(pawn);

        return true;
    }

    public maintainSimulatedPawns(manRender: RenderManager, currentTime: number): void {
        for (const pawn of this.pawns) {
            const state = this.states.get(pawn)!;

            if (currentTime >= state.expires) {
                manRender.removePawn(pawn);
                continue;
            }

            if (currentTime < state.nextTurn) continue;

            state.nextTurn = currentTime + PawnSimulation.TURN_INTERVAL;

            const angle = Math.random() * Math.PI * 2;

            pawn.moveInDirection(tmpSimDirection.set(Math.cos(angle), Math.sin(angle), 0));
        }

        if (this.pawns.size > 0) manRender.needsUpdate = true;
    }

    public tickSimulatedPawns(currentTime: number, deltaTime: number): void {
        for (const pawn of this.pawns)
            pawn.updatePhysics(currentTime, deltaTime);
    }
}

export default PhysicsManager;
export { PhysicsManager };
