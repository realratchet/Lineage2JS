import { Mesh, Vector3 } from "three";
import { RigidBodyDesc } from "@dimforge/rapier3d";
import CollidingMesh from "./colliding-mesh";
import LitActorMesh from "./lit-actor";
import TransformComponent from "./components/transform-component";
import decodeObject3D from "../assets/decoders/object3d-decoder";
import UnScriptVM from "../ue-script/vm";
import { getRotatorQuaternionElements, sinRotator } from "@l2js/engine/utils/rotator";
import type RenderManager from "../rendering/render-manager";
import type DecodeLibrary from "@l2js/engine/decode-library";
import type { IStaticMeshObjectDecodeInfo } from "@l2js/engine/static-mesh/un-static-mesh";

const tmpQuaternion: [number, number, number, number] = [0, 0, 0, 1];

class VehicleMast extends LitActorMesh {
    public readonly isVehicleMesh = true;

    public release(): void {
        this.geometry.dispose();
    }
}

export class Vehicle extends CollidingMesh {
    public readonly isVehicle = true;
    public readonly isVehicleMesh = true;
    protected readonly mast: VehicleMast;
    protected readonly renderManager: RenderManager;
    protected readonly resources = new Set<THREE.Material | THREE.Texture>();

    public constructor(library: DecodeLibrary, objectId: number, renderManager: RenderManager) {
        const cls = Object.values(library.scriptClasses).find(cls => cls.name === "PassengerShip");

        if (!cls) throw new Error(`Vehicle library has no PassengerShip class.`);

        const vm = new UnScriptVM(library), host = { scriptClassId: cls.id, scriptProperties: new Map() };
        vm.initializeHost(host);
        const properties = host.scriptProperties;
        const baseInfo = library.leafActors.flat().find(info => info.name === "StaticMesh") as IStaticMeshObjectDecodeInfo;
        const mastInfo = library.leafActors.flat().find(info => info.name === "StaticVehicleMast") as IStaticMeshObjectDecodeInfo;

        if (!baseInfo || !mastInfo) throw new Error(`Vehicle library has no hull/mast.`);

        const base = decodeObject3D(library, baseInfo).children[0] as Mesh;
        const mast = decodeObject3D(library, mastInfo).children[0] as Mesh;
        const ambient = { glow: properties.get("AmbientGlow") as number, vector: [0, 0, 0], isUnlit: !!properties.get("bUnlit"), hardwareLighting: true };
        const geometryInfo = library.geometries[baseInfo.geometry];

        super({ geometry: base.geometry.clone(), materials: base.material, lightInfo: null, scaledGlow: properties.get("ScaleGlow") as number, ambient, colliderIndices: geometryInfo.colliderIndices, staticMeshCollision: geometryInfo.staticMeshCollision, collision: { isPawn: true, collideActors: !!properties.get("bCollideActors"), collideWorld: !!properties.get("bCollideWorld"), blockActors: !!properties.get("bBlockActors"), blockPlayers: !!properties.get("bBlockPlayers"), blockZeroExtent: !!properties.get("bBlockZeroExtentTraces"), blockNonZeroExtent: !!properties.get("bBlockNonZeroExtentTraces"), worldGeometry: !!properties.get("bWorldGeometry"), useCylinderCollision: !!properties.get("bUseCylinderCollision"), collisionRadius: properties.get("CollisionRadius") as number, collisionHeight: properties.get("CollisionHeight") as number } });

        this.renderManager = renderManager;
        this.addComponent(new TransformComponent(renderManager, this.basedActors));
        this.name = `PassengerShip_${objectId}`;
        this.actorUuid = this.uuid;
        this.scriptClassId = cls.id;
        this.scriptProperties = properties;
        this.scriptProperties.set("L2ServerObjectID", objectId);
        this.mast = new VehicleMast({ geometry: mast.geometry.clone(), materials: mast.material, scaledGlow: properties.get("ScaleGlow") as number, ambient });
        this.add(this.mast);
        this.setScriptRuntime(vm, null);
        renderManager.retainMeshResources([this, this.mast], this.resources);
    }

    public checkLoadingResource(): boolean { return false; }
    public beginPlay(): void { this.scriptComponent.beginPlay(); }
    public tick(deltaTime: number): void { this.scriptComponent.tick(deltaTime); }

    public startTrip(destination: Vector3, moveSpeed: number, rotationSpeed: number): void {
        this.setUnrealScriptProperty("bTrip", true);
        this.setUnrealScriptProperty("MoveSpeed", Math.fround(moveSpeed));
        this.setUnrealScriptProperty("RotationSpeed", rotationSpeed);
        this.setUnrealScriptProperty("TripTarget", destination.toArray());
    }

    public getLocalLocation(location: Vector3, target: Vector3): Vector3 {
        const yaw = (this.getUnrealScriptProperty("Rotation") as number[])[1];
        const sine = sinRotator(-yaw), cosine = sinRotator(-yaw + 16384);
        const x = Math.fround(location.x - this.position.x), y = Math.fround(location.y - this.position.y), z = Math.fround(location.z - this.position.z);

        return target.set(Math.fround(x * cosine - y * sine), Math.fround(x * sine + y * cosine), z);
    }

    public makeCollider(indices: Uint32Array, vertices: Float32Array): void {
        super.makeCollider(indices, vertices);
        this.rigidbodyDesc = RigidBodyDesc.kinematicPositionBased();
    }

    public setLocation(position: Vector3, heading: number): void {
        this.position.copy(position);
        const rotation = this.scriptProperties.get("Rotation") as [number, number, number];
        rotation[1] = heading + 16384;
        getRotatorQuaternionElements(...rotation, tmpQuaternion);
        this.quaternion.fromArray(tmpQuaternion);
        this.syncCollisionTransform();
        this.renderManager.getPhysicsManager().updatePawnCollision(this);
    }

    public release(notifyDestroyed = true): void {
        this.renderManager.getPhysicsManager().setPawnLevel(this, null);
        super.release(notifyDestroyed);
        this.geometry.dispose();
        this.renderManager.releaseMeshResources(this.resources);
        this.mast.release();
    }
}

export default Vehicle;
