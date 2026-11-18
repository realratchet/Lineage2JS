import { Box3, Matrix3, Matrix4, Plane, Vector3, type Texture } from "three";
import Actor, { type ActorInfo_T } from "./actor";
import { releaseTouching, type TouchActor_T } from "./components/transform-component";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, ICollidable } from "./objects";
import type { SectorObject } from "./zone-object";
import { EPhysics_T } from "../assets/unreal/un-aactor";
import type { ProjectorDecodeInfo_T } from "../assets/unreal/un-projector";
import type { ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";
import type { Vector3Arr } from "@l2js/engine";
import Rotator from "../utils/rotator";

const tmpRotation = new Rotator();
const tmpBasis = new Matrix4();
const tmpRight = new Vector3();
const tmpUp = new Vector3();
const tmpCorner = new Vector3();
const tmpApex = new Vector3();
const tmpFar = new Vector3();

export class Projector extends Actor implements ICollidable {
    public readonly isProjector = true;
    public readonly isCollidable = true;
    public readonly bounds = new Box3();
    public readonly direction = new Vector3();
    public readonly projectorMatrix = new Matrix4();
    public readonly projectorNormalMatrix = new Matrix3();
    public readonly planes = Array.from({ length: 6 }, () => new Plane());
    public readonly receivers = new Set<TouchActor_T>();
    public readonly materialId: string;
    public readonly texture: Texture;
    public isAttached = false;
    public projectionRevision = 0;
    protected isCollisionActive = false;
    protected readonly size: [number, number];
    protected readonly corners = Array.from({ length: 4 }, () => new Vector3());
    protected readonly collisionPrimitive: CollisionPrimitive_T<"projector"> = { kind: "projector", planes: this.planes, direction: this.direction, bounds: this.bounds, supportsPointCheck: true, supportsZeroExtent: true, supportsNonZeroExtent: true };
    protected readonly collisionProfile: ActorCollisionProfile_T = { collideActors: false, collideWorld: false, blockActors: false, blockPlayers: false, blockZeroExtent: true, blockNonZeroExtent: true, worldGeometry: false, useCylinderCollision: false, isPawn: false, collisionRadius: 0, collisionHeight: 0 };

    public constructor(actorInfo: ActorInfo_T, info: ProjectorDecodeInfo_T, texture: Texture) {
        super(actorInfo);

        this.materialId = info.material;
        this.texture = texture;
        this.size = info.size;
    }

    public getCollisionPrimitive(): CollisionPrimitive_T<"projector"> { return this.collisionPrimitive; }
    public getCollisionProfile(): ActorCollisionProfile_T { return this.collisionProfile; }
    public getCollisionRadius(): number { return 0; }
    public createCollider(): null { return null; }
    public getCollider(): null { return null; }
    public getRigidbody(): null { return null; }

    public activateCollision(): void {
        if (this.isCollisionActive || !this.collisionProfile.collideActors || !this.isAttached) return;
        const sector = this.getLevel() as SectorObject;

        if (!sector.hasFinishedLoading) return;

        this.isCollisionActive = true;
        sector.physicsManager.registerProjectorCollision(this);
    }

    public deactivateCollision(): void {
        if (!this.isCollisionActive) return;

        this.isCollisionActive = false;
        (this.getLevel() as SectorObject).physicsManager.unregisterCollider(this);
        releaseTouching(this);
        this.receivers.clear();
    }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        if (call.index === 262) {
            const [collideActors, blockActors, blockPlayers] = call.args;

            if (!collideActors && this.collisionProfile.collideActors) this.deactivateCollision();
            this.setUnrealScriptProperty("bCollideActors", this.collisionProfile.collideActors = !!collideActors);
            this.setUnrealScriptProperty("bBlockActors", this.collisionProfile.blockActors = !!blockActors);
            this.setUnrealScriptProperty("bBlockPlayers", this.collisionProfile.blockPlayers = !!blockPlayers);
            this.activateCollision();
            return undefined;
        }
        switch (call.name.toLowerCase()) {
            case "attachprojector":
                this.deactivateCollision();
                this.calcMatrix();
                this.isAttached = true;
                this.activateCollision();
                return undefined;
            case "detachprojector":
                this.deactivateCollision();
                this.isAttached = false;
                return undefined;
            case "attachactor":
                if (this.isAttached && call.args[0]) this.receivers.add(call.args[0] as unknown as TouchActor_T);
                return undefined;
            case "detachactor":
                this.receivers.delete(call.args[0] as unknown as TouchActor_T);
                return undefined;
            default: return super.callUnrealNative(call);
        }
    }

    protected calcMatrix(): void {
        this.projectionRevision++;
        const location = this.position.fromArray(this.getUnrealScriptProperty("Location") as Vector3Arr);
        const rotation = this.getUnrealScriptProperty("Rotation") as Vector3Arr;
        const axes = tmpRotation.set(rotation[0], rotation[1], rotation[2]).rotateMatrix(tmpBasis.identity()).elements;
        this.direction.fromArray(axes, 0);
        tmpRight.fromArray(axes, 4);
        tmpUp.fromArray(axes, 8);

        const scale = this.getUnrealScriptProperty("DrawScale") as number, radius = this.getUnrealScriptProperty("ProjectorRadius") as number;
        const width = this.size[0] * scale, height = this.size[1] * scale;
        const distance = this.getUnrealScriptProperty("MaxTraceDistance") as number;
        const halfFov = (this.getUnrealScriptProperty("FOV") as number) * Math.PI / 360;
        const norm = this.getUnrealScriptProperty("Physics") === EPhysics_T.PHYS_Rotating ? 1 : Math.SQRT1_2;
        // AProjector::CalcMatrix 0x8dc425..0x8dc490.
        const cornerRadius = (radius > 0 ? radius * 1.5 : Math.hypot(width, height) * 0.5) * norm;
        this.bounds.makeEmpty();
        this.planes[0].setFromNormalAndCoplanarPoint(this.direction, location).negate();
        for (let i = 0; i < 4; i++) {
            const corner = this.corners[i];

            corner.copy(location).addScaledVector(tmpRight, (i === 0 || i === 3 ? -1 : 1) * cornerRadius).addScaledVector(tmpUp, (i < 2 ? 1 : -1) * cornerRadius);
            this.bounds.expandByPoint(corner);
        }

        const tangent = Math.tan(halfFov);
        tmpApex.copy(location).addScaledVector(this.direction, halfFov ? -width * 0.5 / tangent : 0);
        for (let i = 0; i < 4; i++) {
            const corner = this.corners[i];

            if (halfFov) {
                this.planes[i + 1].setFromCoplanarPoints(tmpApex, corner, this.corners[(i + 1) % 4]);
                tmpFar.copy(corner).addScaledVector(tmpCorner.copy(corner).sub(tmpApex).normalize(), distance / Math.cos(halfFov));
            } else {
                this.planes[i + 1].setFromNormalAndCoplanarPoint(tmpCorner.copy(corner).sub(location).normalize(), corner);
                tmpFar.copy(corner).addScaledVector(this.direction, distance);
            }
            this.bounds.expandByPoint(tmpFar);
        }
        this.planes[5].setFromNormalAndCoplanarPoint(this.direction, tmpFar);

        const depth = this.direction, s = halfFov ? 0.5 / tangent : 1 / width, t = halfFov ? 0.5 / tangent : 1 / height;
        tmpRight.multiplyScalar(s);
        tmpUp.multiplyScalar(-t);
        if (halfFov) {
            tmpRight.addScaledVector(depth, 0.5);
            tmpUp.addScaledVector(depth, 0.5);
        }
        this.projectorMatrix.set(
            tmpRight.x, tmpRight.y, tmpRight.z, -tmpRight.dot(tmpApex) + (halfFov ? 0 : 0.5),
            tmpUp.x, tmpUp.y, tmpUp.z, -tmpUp.dot(tmpApex) + (halfFov ? 0 : 0.5),
            depth.x, depth.y, depth.z, -depth.dot(location),
            halfFov ? depth.x : 0, halfFov ? depth.y : 0, halfFov ? depth.z : 0, halfFov ? -depth.dot(tmpApex) : 1
        );
        tmpRight.normalize();
        tmpUp.normalize();
        this.projectorNormalMatrix.set(tmpRight.x, tmpRight.y, tmpRight.z, tmpUp.x, tmpUp.y, tmpUp.z, -depth.x, -depth.y, -depth.z);
    }
}

export default Projector;
