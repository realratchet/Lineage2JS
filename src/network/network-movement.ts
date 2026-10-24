import type NetworkManager from "./network-manager";
import type PawnMovementComponent from "../physics/components/pawn-movement-component";
import type NProjectileComponent from "../physics/components/projectile-component";
import { Vector3 } from "three";
import BaseActor from "../base-actor";
import Player from "../player";
import PawnAttackComponent from "../objects/components/pawn-attack-component";
import Vehicle from "../objects/vehicle";
import { sinRotator } from "../assets/unreal/utils/rotator";
import * as GamePackets from "./game-packets";
import { PStopType_T, type NpcLifecycleComponent } from "../objects/components/npc-lifecycle-component";
import { getProperty, type ScriptHost_T } from "../ue-script/vm";
import PacketReader from "./packet-reader";
import type { NetObject_T } from "./network-actors";
import { setVector } from "./network-location";

type NetVehicle_T = { actor: Vehicle, actorReady: Promise<void>, objectId: number, position: Vector3, heading: number, destination: Vector3, moveSpeed: number, rotationSpeed: number, isStarted: boolean, riders: Map<number, Vector3> };

export const tmpLocation: GamePackets.Location_T = { x: 0, y: 0, z: 0 };

const tmpTeleportPosition = new Vector3();

const tmpVehicleLocation = new Vector3();

export const tmpVehicleOrigin = new Vector3();

export class NetworkMovement {
    public isMounted = false;
    public isRunning = true;
    public lastValidateAt = 0;
    public wasMoving = false;
    public readonly stuckPosition = new Vector3();
    public readonly vehicles = new Map<number, NetVehicle_T>();
    public readonly mounts = new Map<number, GamePackets.Ride_T>();
    public readonly riders = new Map<number, BaseActor>();
    public observation: GamePackets.Location_T = null;
    public specialCamera: GamePackets.SpecialCamera_T = null;
    public cameraMode = 0;
    public stuckCheckAt = 0;

    public constructor(protected readonly network: NetworkManager) {}

    public readLocation(packet: PacketReader): GamePackets.Location_T {
        tmpLocation.x = packet.d();
        tmpLocation.y = packet.d();
        tmpLocation.z = packet.d();

        return tmpLocation;
    }

    public adjustPawnLocation(object: NetObject_T, position: GamePackets.Location_T) {
        setVector(object.position, position);

        const actor = object.actor;

        if (!actor || object.kind === "user" || object.isDead) return;

        const base = actor.getBaseActor() as Vehicle;

        if (base && base.isVehicle) return;

        const controller = actor.getUnrealScriptProperty("Controller") as ScriptHost_T;

        if (!controller || getProperty(controller, "bDead")) return;

        const arrReservedMovePoint = getProperty(controller, "ReservedMovePoint") as unknown[];

        if (arrReservedMovePoint && arrReservedMovePoint.length) return;

        // AdjustPawnLocation 0x7425a0: remote living pawns, more than 200 units from the server feet position.
        if (actor.position.distanceTo(object.position) > 200) actor.adjustLocation(object.position);
    }

    public onMoveToLocation(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d());

        if (!object) return;

        const destination = setVector(new Vector3(), this.readLocation(packet));
        object.pendingFly = null;
        object.pendingVehicleMove = null;

        setVector(object.position, this.readLocation(packet));

        if (object.isDead) return;

        object.destination = destination;
        object.pendingAttack = null;
        this.network.combat.stopSkill(object.objectId);

        if (object.waitType === GamePackets.WaitType_T.WT_SITTING || object.waitType === GamePackets.WaitType_T.WT_START_FAKEDEATH || object.chairStaticObjectId) {
            object.waitType = GamePackets.WaitType_T.WT_STANDING;
            object.chairStaticObjectId = 0;
            this.network.combat.setIdleAnimation(object, false);
        }

        if (!object.actor) return;

        this.adjustPawnLocation(object, object.position);

        if (object.kind === "user") object.actor.goTo(destination);
        else object.actor.getComponent<PawnMovementComponent>("pawnMovement").addMoveTo(object.position, destination);
    }

    public async onMoveToPawn(packet: PacketReader) {
        const objectId = packet.d(), targetId = packet.d();
        const distance = packet.d();
        const current = this.readLocation(packet), position = { x: current.x, y: current.y, z: current.z }, destination = setVector(new Vector3(), this.readLocation(packet));
        const object = this.network.actors.objects.get(objectId);
        const target = this.network.actors.objects.get(targetId);

        if (!object) return;

        setVector(object.position, position);

        if (object.isDead) return;

        object.pendingAttack = null;
        this.network.combat.stopSkill(object.objectId);

        if (object.waitType === GamePackets.WaitType_T.WT_SITTING || object.waitType === GamePackets.WaitType_T.WT_START_FAKEDEATH || object.chairStaticObjectId) {
            object.waitType = GamePackets.WaitType_T.WT_STANDING;
            object.chairStaticObjectId = 0;
            this.network.combat.setIdleAnimation(object, false);
        }

        object.pendingFly = null;

        object.pendingVehicleMove = null;
        if (!target || !target.actor || !object.actor) {
            object.destination = destination;
            if (object.actor) object.actor.goTo(destination);
            if (!target) return;

            await Promise.all([object.actorReady, target.actorReady]);

            if (object.destination !== destination || object.isRemoved || target.isRemoved || object.isDead || !object.actor || !target.actor) return;
        }

        this.adjustPawnLocation(object, object.position);
        object.destination = null;
        object.pendingFly = null;
        object.pendingVehicleMove = null;
        const offset = Math.fround(distance);

        if (object.kind === "user") object.actor.goToActor(target.actor, offset);
        else object.actor.getComponent<PawnMovementComponent>("pawnMovement").addMoveToward(object.position, target.actor, offset);
    }

    public onStopMove(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d());

        if (!object) return;

        setVector(object.position, this.readLocation(packet));
        object.heading = packet.d() & 0xffff;
        object.pendingRotation = null;
        object.destination = null;
        object.pendingFly = null;
        object.pendingVehicleMove = null;

        if (!object.actor || object.isDead) return;

        this.adjustPawnLocation(object, object.position);
        object.actor.stopMove();
        object.actor.stopMoving();
    }

    public onValidateLocation(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d());

        if (!object) return;

        setVector(object.position, this.readLocation(packet));
        object.heading = packet.d() & 0xffff;

        const actor = object.actor;

        if (!actor) return;

        const controller = actor.getUnrealScriptProperty("Controller") as ScriptHost_T;

        if (!controller || getProperty(controller, "bDead") || getProperty(controller, "WaitType") !== PStopType_T.STP_STAND) return;

        if (actor === this.network.getParent().getComponent("render").player) {
            actor.l2Teleport(object.position);
            actor.setRotationYaw(object.heading);
            return;
        }

        this.adjustPawnLocation(object, object.position);
        actor.validateLocation(object.position);
    }

    public onTeleport(packet: PacketReader) {
        const object = this.network.actors.objects.get(packet.d());

        if (!object) return;

        setVector(object.position, this.readLocation(packet));
        object.destination = null;
        object.pendingFly = null;
        object.pendingVehicleMove = null;
        object.pendingRotation = null;
        this.network.combat.stopSkill(object.objectId);
        object.pendingAttack = null;
        object.pendingTransientSkills.length = 0;

        if (object.kind === "user") this.network.actors.clearKnownObjects();

        if (object.actor) {
            if (object.actor.getUnrealScriptProperty("Controller")) {
                object.actor.stopMove();
            }
            tmpTeleportPosition.copy(object.position);
            tmpTeleportPosition.z = Math.fround(tmpTeleportPosition.z + Math.fround(object.speeds.collisionHeight) + 10);
            if (object.actor === this.network.getParent().getComponent("render").player) {
                object.actor.l2Teleport(tmpTeleportPosition);
            } else this.network.getParent().getComponent("physics").farMoveActor(object.actor, tmpTeleportPosition);
        }
        if (object.kind === "user") void this.finishTeleport();
    }

    protected async finishTeleport() {
        const render = this.network.getParent().getComponent("render");
        const asset = this.network.getParent().getComponent("asset");
        const generation = ++this.network.actors.teleportGeneration;
        const sector = render.getSector(render.player.position);
        const isLoading = !sector || !sector.staticMeshGroup || !render.isSectorWarm(sector); // LoadTeleportMap 0x10567fa0 only loads, with progress, a destination sector that is not resident

        if (isLoading) {
            render.setZoneMusicEnabled(false);
            this.network.ui.showLoading(true);

            while (this.network.actors.inWorld && generation === this.network.actors.teleportGeneration && !asset.isAreaLoaded(render, render.player.position)) await new Promise(resolve => setTimeout(resolve, 100));

            if (!this.network.actors.inWorld || generation !== this.network.actors.teleportGeneration) return;
        }

        this.network.actors.teleportInfoPending = true;
        this.network.session.game.appearing();

        // Lisvus Appearing sends the destination known list before UserInfo.
        while (this.network.actors.inWorld && generation === this.network.actors.teleportGeneration && (this.network.actors.teleportInfoPending || this.network.actors.npcSpawnCount > 0 || this.network.actors.npcSpawnWaiters.length > 0)) await new Promise(resolve => setTimeout(resolve, 100));

        if (!this.network.actors.inWorld || generation !== this.network.actors.teleportGeneration || !isLoading) return;

        render.setZoneMusicEnabled(true);
        this.network.ui.showWorld();
    }

    public onBeginRotation(packet: PacketReader) {
        const objectId = packet.d();

        packet.d(); // OnStartRotating 0x73c9c0 ignores the initial heading.

        const direction = packet.d(), speed = packet.d();

        const object = this.network.actors.objects.get(objectId);

        if (!object) return;

        if (object.actor) object.actor.startRotating(direction, speed);
        else object.pendingRotation = { direction, speed };
    }

    public onStopRotation(packet: PacketReader) {
        const objectId = packet.d(), heading = packet.d();
        const speed = packet.getRemaining() === 0 ? 0 : packet.d();

        if (packet.getRemaining() > 0) packet.c();

        const object = this.network.actors.objects.get(objectId);

        if (!object) return;

        object.heading = heading & 65535;
        object.pendingRotation = null;
        if (object.actor) object.actor.finishRotating(heading, speed);
    }

    public onChangeMoveType(objectId: number, isRunning: boolean, environment: number) {
        const object = this.network.actors.objects.get(objectId);

        if (!object || object.isRunning === isRunning) return;
        object.isRunning = isRunning;
        object.environment = environment;
        if (object.kind === "user") {
            this.isRunning = isRunning;
            this.network.ui.setRunning(isRunning);
        }
        if (object.actor) {
            object.actor.setUnrealScriptProperty("Environment", environment);
            this.network.community.applySpeeds(object.actor, object.speeds, isRunning);
        }
    }

    public onChairSit(packet: PacketReader) {
        const objectId = packet.d(), staticObjectId = packet.d();

        if (objectId <= 0 || staticObjectId <= 0 || packet.getRemaining()) throw new Error("Invalid ChairSit payload.");

        const object = this.network.actors.objects.get(objectId);

        if (!object) return;

        object.destination = null;
        object.pendingFly = null;
        object.pendingVehicleMove = null;
        object.pendingAttack = null;
        this.network.combat.stopSkill(object.objectId);
        object.chairStaticObjectId = staticObjectId;
        object.waitType = GamePackets.WaitType_T.WT_SITTING;
        this.network.combat.setIdleAnimation(object, false);

        const actor = object.actor;

        if (!actor) return;

        actor.stopMoving();
        const animation = (actor.getUnrealScriptProperty("ChairSitAnimName") as string[])[actor.getUnrealScriptProperty("CurWeaponType") as number];

        if (animation.toLowerCase() !== "none") actor.playAnimation(animation, 0.1, actor.getUnrealScriptProperty("NonAttackSpeedRate") as number, false, true); // OnChairSitPacket 0x10481e38..0x10481e8e.
    }

    public onStaticObject(packet: PacketReader) {
        const staticObjectId = packet.d(), objectId = packet.d();

        if (staticObjectId <= 0 || objectId <= 0 || packet.getRemaining()) throw new Error("Invalid StaticObject payload.");

        this.network.actors.staticObjects.set(staticObjectId, objectId);
    }

    public onVehicleLocation(packet: PacketReader, isStopped: boolean) {
        const info = GamePackets.readVehicleLocation(packet);
        let vehicle = this.vehicles.get(info.objectId);

        if (!vehicle) {
            vehicle = { actor: null, actorReady: null, objectId: info.objectId, position: new Vector3(), heading: 0, destination: null, moveSpeed: 0, rotationSpeed: 0, isStarted: false, riders: new Map() };
            this.vehicles.set(info.objectId, vehicle);
            vehicle.actorReady = this.enterVehicle(vehicle);
        }

        setVector(vehicle.position, info);
        vehicle.heading = info.heading;
        if (vehicle.actor) {
            const actor = vehicle.actor, physics = this.network.getParent().getComponent("physics");
            const rotation = (actor.getUnrealScriptProperty("Rotation") as Vector3Arr).slice() as Vector3Arr;

            if (!actor.position.equals(vehicle.position)) physics.farMoveActor(actor, vehicle.position);
            if (rotation[1] !== vehicle.heading + 16384) {
                rotation[1] = vehicle.heading + 16384;
                physics.rotateActor(actor, rotation);
            }
        }

        if (isStopped) vehicle.destination = null; // L2BoatInstance.sendInfo follows VehicleInfo with VehicleDeparture while moving.

    }

    protected async enterVehicle(vehicle: NetVehicle_T): Promise<void> {
        const asset = this.network.getParent().getComponent("asset"), render = this.network.getParent().getComponent("render");
        const library = await asset.loadVehicle();

        if (this.vehicles.get(vehicle.objectId) !== vehicle) return;

        const actor = new Vehicle(library, vehicle.objectId, render);
        actor.setLocation(vehicle.position, vehicle.heading);
        render.scene.add(actor);
        const physics = this.network.getParent().getComponent("physics");
        physics.registerSimulationObjects(actor);
        if (render.getLevel()) {
            const level = render.getLevel().levelInfoActor;
            actor.setUnrealScriptProperty("Level", level as any);
            physics.setPawnLevel(actor, level as any);
            physics.setPawnZone(actor, false, true);
            physics.setPawnVolumes(actor);
        }
        actor.beginPlay();
        if (vehicle.destination) actor.startTrip(vehicle.destination, vehicle.moveSpeed, vehicle.rotationSpeed);
        render.queueShaderCompile(actor);
        render.needsUpdate = true;
        vehicle.actor = actor;
        for (const objectId of vehicle.riders.keys()) this.placeVehicleRider(vehicle, objectId);
    }

    public removeVehicle(objectId: number): void {
        const vehicle = this.vehicles.get(objectId);

        if (!vehicle) return;

        this.vehicles.delete(objectId);
        for (const object of this.network.actors.objects.values())
            if (object.pendingVehicleMove && object.pendingVehicleMove.vehicleId === objectId) object.pendingVehicleMove = null;
        if (!vehicle.actor) return;

        this.network.getParent().getComponent("physics").unregisterSimulationObjects(vehicle.actor);
        vehicle.actor.removeFromParent();
        vehicle.actor.release();
        this.network.getParent().getComponent("render").needsUpdate = true;
    }

    public onVehicleDeparture(packet: PacketReader) {
        const departure = GamePackets.readVehicleDeparture(packet);
        const vehicle = this.vehicles.get(departure.objectId);

        if (!vehicle) return;

        vehicle.moveSpeed = departure.moveSpeed;
        vehicle.rotationSpeed = departure.rotationSpeed;
        vehicle.destination = setVector(vehicle.destination || new Vector3(), departure);
        if (vehicle.actor) vehicle.actor.startTrip(vehicle.destination, vehicle.moveSpeed, vehicle.rotationSpeed);
    }

    public onVehicleStarted(packet: PacketReader) {
        const objectId = packet.d(), state = packet.d();

        if (state !== 0 && state !== 1) throw new Error(`Invalid VehicleStarted state '${state}'.`);

        const vehicle = this.vehicles.get(objectId);

        if (vehicle) vehicle.isStarted = state === 1;
    }

    public updateVehicles(deltaTime: number) {
        for (const vehicle of this.vehicles.values()) {
            if (!vehicle.actor) continue;

            vehicle.actor.tick(deltaTime / 1000);
            vehicle.position.copy(vehicle.actor.position);
            vehicle.heading = (vehicle.actor.getUnrealScriptProperty("Rotation") as number[])[1] - 16384;
            if (!vehicle.actor.getUnrealScriptProperty("bTrip")) vehicle.destination = null;
        }
    }

    protected setVehicleRider(vehicle: NetVehicle_T, objectId: number, local: GamePackets.Location_T) {
        for (const other of this.vehicles.values()) if (other !== vehicle) other.riders.delete(objectId);

        setVector(vehicle.riders.get(objectId) || vehicle.riders.set(objectId, new Vector3()).get(objectId), local);
    }

    public placeVehicleRider(vehicle: NetVehicle_T, objectId: number) {
        const object = this.network.actors.objects.get(objectId);

        if (!object || !object.actor || objectId === this.network.actors.userId || !vehicle.actor) return;

        const base = object.actor.getBaseActor();

        if (base && (base as any).isVehicle) return;

        const local = vehicle.riders.get(objectId), rotation = vehicle.actor.getUnrealScriptProperty("Rotation") as number[];
        const sine = sinRotator(rotation[1]), cosine = sinRotator(rotation[1] + 16384);
        const location = new Vector3(Math.fround(local.x * cosine - local.y * sine), Math.fround(local.x * sine + local.y * cosine), local.z).add(vehicle.actor.position);

        // UGameEngine::OnGetOnVehicle 0x1047618d..0x104761e9 passes the center plus10 to FarMoveActor.
        location.z += 10;
        this.network.getParent().getComponent("physics").farMoveActor(object.actor, location);

        object.position.copy(object.actor.position);
        object.destination = null;
        object.pendingFly = null;
    }

    public getVehicleIdOf(objectId: number): number {
        for (const vehicle of this.vehicles.values())
            if (vehicle.riders.has(objectId)) return vehicle.objectId;

        return 0;
    }

    public getVehicleActor(objectId: number): Vehicle | null { return this.vehicles.get(objectId)?.actor || null; }

    public onGetOnVehicle(packet: PacketReader) {
        const rider = GamePackets.readVehicleRider(packet);
        const vehicle = this.vehicles.get(rider.vehicleId);

        this.network.actors.withActor(rider.objectId, actor => actor.setUnrealScriptProperty("bGetOnVehicle", true)); // UGameEngine::OnGetOnVehicle 0x104760e2.
        if (!vehicle) return;

        this.setVehicleRider(vehicle, rider.objectId, rider);
        this.placeVehicleRider(vehicle, rider.objectId);
    }

    public onGetOffVehicle(packet: PacketReader) {
        const rider = GamePackets.readVehicleRider(packet);
        const vehicle = this.vehicles.get(rider.vehicleId);
        const object = this.network.actors.objects.get(rider.objectId);

        if (vehicle) vehicle.riders.delete(rider.objectId);
        if (!object) return;
        object.pendingVehicleMove = null;

        if (object.actor) object.actor.setUnrealScriptProperty("bGetOnVehicle", false); // UGameEngine::OnGetOffVehicle 0x10476264.
        if (!object.actor || rider.objectId === this.network.actors.userId || !vehicle || !vehicle.actor) return;

        this.network.getParent().getComponent("physics").farMoveActor(object.actor, setVector(new Vector3(), rider));
        object.position.copy(object.actor.position);
        object.destination = null;
        object.pendingFly = null;
    }

    public onMoveToLocationInVehicle(packet: PacketReader) {
        const move = GamePackets.readVehicleRiderMove(packet);
        const vehicle = this.vehicles.get(move.vehicleId), object = this.network.actors.objects.get(move.objectId);

        if (!vehicle || !object) return;

        this.moveInVehicle(object, move.vehicleId, setVector(new Vector3(), move.destination));
    }

    public moveInVehicle(object: NetObject_T, vehicleId: number, position: Vector3): void {
        object.destination = null;
        object.pendingFly = null;
        object.pendingVehicleMove = null;

        if (!object.actor) {
            if (!object.isDead) object.pendingVehicleMove = { vehicleId, position };
            return;
        }

        object.actor.getComponent<PawnMovementComponent>("pawnMovement").moveInVehicle(vehicleId, position);
    }

    public onStopMoveInVehicle(packet: PacketReader) {
        const stop = GamePackets.readVehicleRiderStop(packet);
        const vehicle = this.vehicles.get(stop.vehicleId), object = this.network.actors.objects.get(stop.objectId);

        if (!vehicle || !object) return;

        if (!object.actor) {
            this.moveInVehicle(object, stop.vehicleId, setVector(new Vector3(), stop));
            return;
        }

        const controller = object.actor.getUnrealScriptProperty("Controller") as ScriptHost_T;

        if (getProperty(controller, "bDead")) return;
        // UGameEngine::OnStopMoveInVehicle 0x104767c0: local StopMove, no heading assignment.
        if (stop.objectId === this.network.actors.userId) {
            object.destination = null;
            object.pendingVehicleMove = null;
            object.actor.stopMoving();
            return;
        }

        this.moveInVehicle(object, stop.vehicleId, setVector(new Vector3(), stop));
    }

    public onValidateLocationInVehicle(packet: PacketReader) {
        const stop = GamePackets.readVehicleRiderStop(packet);
        const vehicle = this.vehicles.get(stop.vehicleId), object = this.network.actors.objects.get(stop.objectId);

        if (!vehicle || !vehicle.actor || !object || !object.actor) return;

        const actor = object.actor, controller = actor.getUnrealScriptProperty("Controller") as ScriptHost_T;

        if (!controller || getProperty(controller, "bDead")) return;

        if (actor === this.network.getParent().getComponent("render").player) {
            const rotation = vehicle.actor.getUnrealScriptProperty("Rotation") as number[];
            const sine = sinRotator(rotation[1]), cosine = sinRotator(rotation[1] + 16384);

            tmpVehicleLocation.set(Math.fround(stop.x * cosine - stop.y * sine), Math.fround(stop.x * sine + stop.y * cosine), stop.z).add(vehicle.actor.position);
            tmpVehicleLocation.z -= actor.getCollisionHeight();
            object.position.copy(tmpVehicleLocation);
            actor.l2Teleport(object.position, vehicle.actor);
            object.heading = stop.heading;
            actor.setRotationYaw(stop.heading);
            return;
        }

        this.setVehicleRider(vehicle, stop.objectId, stop);
    }

    public onRide(packet: PacketReader) { this.setRide(GamePackets.readRide(packet)); }

    public setRide(ride: GamePackets.Ride_T): void {
        if (ride.objectId === this.network.actors.userId) {
            this.isMounted = ride.isMounted;
            this.network.actors.updateMountable();
        }

        const previous = this.mounts.get(ride.objectId);

        if (!ride.isMounted) {
            this.mounts.delete(ride.objectId);
            this.endRide(ride.objectId);
            return;
        }

        if (previous && previous.mountType === ride.mountType && previous.npcId === ride.npcId) return;
        if (ride.npcId <= 0) throw new Error(`Mounted pawn '${ride.objectId}' has no NPC class.`);

        this.endRide(ride.objectId);
        this.mounts.set(ride.objectId, ride);
        void this.enterRide(ride);
    }

    public async enterRide(ride: GamePackets.Ride_T): Promise<void> {
        const object = this.network.actors.objects.get(ride.objectId);

        if (!object || !object.actor) return;

        const render = this.network.getParent().getComponent("render"), physics = this.network.getParent().getComponent("physics");
        const rider = object.actor;

        await this.network.actors.appearanceLoads.get(rider);
        if (this.mounts.get(ride.objectId) !== ride || object.isRemoved) return;

        const mount = await this.network.getParent().getComponent("asset").spawnNpc(render, ride.npcId, rider.position.clone(), null, false, object.kind === "user" ? new Player(render) : new BaseActor(render), false);

        if (this.mounts.get(ride.objectId) !== ride || object.isRemoved) {
            render.removePawn(mount);
            return;
        }

        mount.teleportTo(rider.position, true);

        if (!mount.attachObjectToBone(rider, "Bone15")) {
            render.removePawn(mount);
            throw new Error(`Mount '${ride.npcId}' cannot attach '${rider.name}' to Bone15.`);
        }

        // RiderEnter 0x105efd4d uses mesh Origin.Z; placeMeshes already adds CollisionHeight.
        rider.position.set(0, 0, rider.getComponent<any>("animation").getMeshes()[0].meshOrigin.z - rider.getCollisionHeight());
        rider.rotation.set(0, 0, -Math.PI / 2);

        mount.copyMovement(rider);
        mount.setUnrealScriptProperty("bHidden", rider.getUnrealScriptProperty("bHidden"));
        rider.stopMoving();
        physics.removePawn(rider);
        rider.setUnrealScriptProperty("bRide", true);
        rider.setUnrealScriptProperty("CurRideType", ride.mountType);
        mount.ridePawn = rider;
        mount.rideType = ride.mountType;
        mount.name = object.name;
        mount.setRotationYaw(object.heading);
        mount.setFlying(ride.mountType === GamePackets.MountType_T.WYVERN);
        this.riders.set(ride.objectId, rider);
        object.actor = mount;
        for (const movement of physics.getPhysicsComponents<PawnMovementComponent>("pawnMovement")) {
            movement.replaceTarget(rider, mount);
            movement.getParent().findComponent<PawnAttackComponent>("pawnAttack")?.replaceTarget(rider, mount);
        }
        for (const projectile of physics.getPhysicsComponents<NProjectileComponent>("nProjectile")) projectile.replaceTarget(rider, mount);
        render.replaceRetainedSkillTargets(rider, mount);
        this.network.combat.updateAbnormalState(object);
        mount.getComponent<NpcLifecycleComponent>("npcLifecycle").setControllerState(object.waitType, object.isInCombat);
        if (object.environment !== null) mount.setUnrealScriptProperty("Environment", object.environment);
        this.network.community.applySpeeds(mount, object.speeds, object.isRunning);
        if (object.kind === "user") render.setPlayer(mount as Player);
        mount.playMovementAnimation("idle");
        if (object.isDead) mount.playDeathAnimation(() => { });
    }

    public endRide(objectId: number): void {
        const rider = this.riders.get(objectId), object = this.network.actors.objects.get(objectId);

        if (!rider || !object) return;

        const render = this.network.getParent().getComponent("render"), mount = object.actor;
        const position = mount.position.clone(), heading = mount.getRotationYaw();

        mount.getComponent<PawnAttackComponent>("pawnAttack").detachSkillVisuals();
        mount.detachBoneObject(rider);
        mount.ridePawn = null;
        rider.setUnrealScriptProperty("bRide", false);
        rider.setUnrealScriptProperty("CurRideType", 0);
        render.scene.add(rider);
        object.actor = rider;
        this.riders.delete(objectId);
        this.network.combat.updateAbnormalState(object);
        this.network.getParent().getComponent("physics").addPawn(rider);
        if (object.kind === "user") render.setPlayer(rider as Player);
        this.network.community.applySpeeds(rider, object.speeds, object.isRunning);
        if (object.environment !== null) rider.setUnrealScriptProperty("Environment", object.environment);
        rider.teleportTo(position, true);
        rider.setRotationYaw(heading);
        this.network.combat.setIdleAnimation(object);
        if (object.isDead) rider.playDeathAnimation(() => { });
        else if (rider.getComponent<NpcLifecycleComponent>("npcLifecycle").isDead()) rider.revive();
        if (!object.isDead) rider.copyMovement(mount);
        for (const movement of this.network.getParent().getComponent("physics").getPhysicsComponents<PawnMovementComponent>("pawnMovement")) {
            movement.replaceTarget(mount, rider);
            movement.getParent().findComponent<PawnAttackComponent>("pawnAttack")?.replaceTarget(mount, rider);
        }
        for (const projectile of this.network.getParent().getComponent("physics").getPhysicsComponents<NProjectileComponent>("nProjectile")) projectile.replaceTarget(mount, rider);
        render.replaceRetainedSkillTargets(mount, rider);
        render.removePawn(mount);
    }

    public onFlyToLocation(packet: PacketReader) {
        const fly = GamePackets.readFlyToLocation(packet);
        const object = this.network.actors.objects.get(fly.objectId);

        if (!object) return;

        if (object.waitType === GamePackets.WaitType_T.WT_SITTING || object.waitType === GamePackets.WaitType_T.WT_START_FAKEDEATH || object.chairStaticObjectId) {
            object.waitType = GamePackets.WaitType_T.WT_STANDING;
            object.chairStaticObjectId = 0;
            this.network.combat.setIdleAnimation(object, false);
        }

        object.pendingAttack = null;
        this.network.combat.stopSkill(object.objectId);

        if (object.isDead) return;

        this.adjustPawnLocation(object, fly.origin);
        object.pendingVehicleMove = null;
        object.pendingFly = object.actor ? null : { origin: setVector(new Vector3(), fly.origin), destination: setVector(new Vector3(), fly.destination) };
        setVector(object.position, fly.destination);
        object.destination = null;

        if (object.actor) {
            if (object.kind === "user") object.actor.flyTo(object.position);
            else object.actor.addFlyTo(setVector(tmpTeleportPosition, fly.origin), object.position);
        }
    }

    protected placeObserver(position: GamePackets.Location_T, isObserving: boolean) {
        const player = this.network.getParent().getComponent("render").player;
        const user = this.network.actors.objects.get(this.network.actors.userId);

        this.network.actors.clearKnownObjects(); // L2PcInstance.enterObserverMode/leaveObserverMode drop the known list without DeleteObject.
        setVector(user.position, position);
        user.destination = null;
        user.pendingFly = null;
        user.pendingVehicleMove = null;
        player.visible = !isObserving;
        player.teleportTo(user.position, true);
        this.network.getParent().getComponent("input").resetFollowCamera();
    }

    public onObservationMode(packet: PacketReader) {
        const info = GamePackets.readObservationMode(packet);

        this.observation = { x: info.x, y: info.y, z: info.z };
        this.placeObserver(info, true);
        this.network.ui.setObservationMode(true);
    }

    public startReplayObservation(position: GamePackets.Location_T) {
        this.observation = { x: position.x, y: position.y, z: position.z };
        this.network.getParent().getComponent("render").player.visible = false;
    }

    public onObservationReturn(packet: PacketReader) {
        const position = GamePackets.readPoint(packet);

        this.observation = null;
        this.placeObserver(position, false);
        this.network.ui.setObservationMode(false);
    }

    public getVehicleId() { return this.getVehicleIdOf(this.network.actors.userId); }

    public getMount(objectId: number) { return this.mounts.get(objectId) || null; }

    public isObserving() { return this.observation !== null; }

    public getSpecialCamera() { return this.specialCamera; }

    public getCameraMode() { return this.cameraMode; }

    public requestGetOnVehicle(vehicleId: number, position: GamePackets.Location_T) { if (this.network.actors.inWorld && this.vehicles.has(vehicleId)) this.network.session.game.requestGetOnVehicle(vehicleId, position); }

    public requestGetOffVehicle(vehicleId: number, position: GamePackets.Location_T) { if (this.network.actors.inWorld) this.network.session.game.requestGetOffVehicle(vehicleId, position); }

    public observerReturn() { if (this.network.actors.inWorld && this.observation) this.network.session.game.observerReturn(); }

    public startRotating(heading: number, side: number) { if (this.network.actors.inWorld) this.network.session.game.startRotating(heading, side); }

    public finishRotating(heading: number, unknown: number) { if (this.network.actors.inWorld) this.network.session.game.finishRotating(heading, unknown); }

    public requestRecordInfo() { if (this.network.actors.inWorld) this.network.session.game.requestRecordInfo(); }

    public requestShowMiniMap() { if (this.network.actors.inWorld) this.network.session.game.requestShowMiniMap(); }

    public requestMoveInVehicle(vehicle: Vehicle, destination: Vector3) {
        if (!this.network.actors.inWorld) return;

        const player = this.network.getParent().getComponent("render").player;

        vehicle.getLocalLocation(destination, tmpVehicleLocation);
        tmpVehicleOrigin.fromArray(player.getUnrealScriptProperty("Location") as number[]);
        vehicle.getLocalLocation(tmpVehicleOrigin, tmpVehicleOrigin);
        this.network.session.game.requestMoveToLocationInVehicle(vehicle.getUnrealScriptProperty("L2ServerObjectID") as number, tmpVehicleLocation, tmpVehicleOrigin);
    }

    public cannotMoveInVehicle(vehicle: Vehicle, position: Vector3) {
        if (!this.network.actors.inWorld) return;

        vehicle.getLocalLocation(position, tmpVehicleLocation);
        this.network.session.game.cannotMoveAnymoreInVehicle(vehicle.getUnrealScriptProperty("L2ServerObjectID") as number, tmpVehicleLocation, this.network.getParent().getComponent("render").player.getRotationYaw());
    }
}

export default NetworkMovement;
