import { Box3, Material, Matrix4, Mesh, NormalBlending, Sphere, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { MESHES_CHANGED_EVENT, MESH_SCALE_CHANGED_EVENT } from "../../objects/components/animation-component";
import { PAWN_COLLISION_SIZE_CHANGED_EVENT, type PawnMovementComponent } from "../../physics/components/pawn-movement-component";
import type BaseActor from "../../base-actor";
import type RenderManager from "../render-manager";
import GLOBAL_UNIFORMS from "../../materials/global-uniforms";
import PawnMesh, { createPawnMeshes } from "../../objects/pawn-mesh";
import type LitSkinnedMesh from "../../objects/lit-skinned-mesh";
import type { SectorObject } from "../../objects/zone-object";
import { SCRIPT_NATIVE_EVENT } from "../../game/script-component";
import type { ScriptNativeCall_T } from "../../ue-script/vm";
import { EActorViewType_T } from "../../assets/unreal/un-aactor";
import MeshStaticMaterial from "../../materials/mesh-static-material/mesh-static-material";

export const EQUIPMENT_MESHES_CHANGED_EVENT = "equipmentMeshesChanged";

const tmpSphere = new Sphere();
const tmpBox = new Box3();
const tmpSphereBox = new Box3();
const tmpMatrix = new Matrix4();
const tmpOrigin = new Matrix4();
const tmpVec = new Vector3();
const tmpActorCenter = new Vector3();
const arrAmbientLeaves: number[] = [];
const tmpWhite = new Vector3(1, 1, 1);

export class PawnRenderableComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "pawnRenderable";
    public isRendered: boolean = false;
    public readonly texModifierColor = new Vector3(1, 1, 1);
    protected readonly renderManager: RenderManager;
    protected readonly worldSphere = new Sphere();
    protected readonly lightingSphere = new Sphere();
    protected readonly primitiveSphere = new Sphere();
    protected readonly worldBox = new Box3();
    protected readonly boundsMatrix = new Matrix4();
    protected boundsNeedUpdate = true;
    protected readonly predictedBox = new Box3();
    protected ambientSector: SectorObject = null;
    protected readonly ambientZone = { isSunAffected: false, ambient: [0, 0, 0], version: 0 };
    protected meshes: Mesh[] = [];
    protected equipmentMeshes: Mesh[] = [];
    protected batches: PawnMesh[] = [];
    protected lastRenderTime = -Infinity;
    protected texModifierAlpha = -1;
    protected readonly fadeMaterials = new Map<MeshStaticMaterial, MeshStaticMaterial>();
    protected readonly fadeMeshes = new Map<Mesh, { source: Material | Material[], material: Material | Material[] }>();

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public onAttach(): void { this.renderManager.registerPawnRenderable(this); }
    public onDetach(): void {
        this.clearAlphaTexModifier();
        this.releaseBatches();
        this.renderManager.unregisterPawnRenderable(this);
    }

    public tickActorView(deltaTime: number): void {
        const pawn = this.getParent(), type = pawn.getUnrealScriptProperty("L2ActorViewtype");
        if (type !== EActorViewType_T.EAVT_InSighting && type !== EActorViewType_T.EAVT_OutSighting) return;

        const duration = pawn.getUnrealScriptProperty("L2ActorViewDuration") as number;
        const elapsed = (pawn.getUnrealScriptProperty("L2ActorViewElapsedTime") as number) + deltaTime;

        if (elapsed >= duration) {
            this.clearAlphaTexModifier();
            pawn.setUnrealScriptProperty("L2ActorViewtype", type === EActorViewType_T.EAVT_InSighting ? EActorViewType_T.EAVT_InSight : EActorViewType_T.EAVT_OutSight);
            pawn.setUnrealScriptProperty("L2ActorViewElapsedTime", 0);
            return;
        }

        pawn.setUnrealScriptProperty("L2ActorViewElapsedTime", Math.fround(elapsed));
        this.texModifierAlpha = Math.trunc(Math.max(0, Math.min(255, Math.fround(type === EActorViewType_T.EAVT_InSighting ? elapsed / duration * 255 : 255 - 255 / duration * elapsed)))) / 255;
    }

    public updateActorView(distance: number, range: number): boolean {
        const pawn = this.getParent();
        const type = distance <= range - 256 ? EActorViewType_T.EAVT_InSight : distance < range ? EActorViewType_T.EAVT_InSighting : distance < range + 256 ? EActorViewType_T.EAVT_OutSighting : EActorViewType_T.EAVT_OutSight;
        const previous = pawn.getUnrealScriptProperty("L2ActorViewtype") as EActorViewType_T;
        let elapsed = 0;

        // AActor::SetActorViewType 0x104f4780 preserves repeated requests and mirrors reversals.
        switch (previous) {
            case EActorViewType_T.EAVT_None:
                pawn.setUnrealScriptProperty("L2ActorViewDuration", 1);
                if (type === EActorViewType_T.EAVT_InSight || type === EActorViewType_T.EAVT_OutSight) {
                    this.clearAlphaTexModifier();
                    elapsed = pawn.getUnrealScriptProperty("L2ActorViewElapsedTime") as number;
                }
                break;
            case EActorViewType_T.EAVT_InSight:
            case EActorViewType_T.EAVT_InSighting:
                if (type === EActorViewType_T.EAVT_InSight || type === EActorViewType_T.EAVT_InSighting) return this.prepareActorView(previous);
                if (previous === EActorViewType_T.EAVT_InSighting) {
                    if (type === EActorViewType_T.EAVT_OutSight) this.clearAlphaTexModifier();
                    else elapsed = Math.fround((pawn.getUnrealScriptProperty("L2ActorViewDuration") as number) - (pawn.getUnrealScriptProperty("L2ActorViewElapsedTime") as number));
                }
                break;
            case EActorViewType_T.EAVT_OutSight:
            case EActorViewType_T.EAVT_OutSighting:
                if (type === EActorViewType_T.EAVT_OutSight || type === EActorViewType_T.EAVT_OutSighting) return this.prepareActorView(previous);
                if (previous === EActorViewType_T.EAVT_OutSight && type === EActorViewType_T.EAVT_InSighting) this.texModifierAlpha = 0;
                if (previous === EActorViewType_T.EAVT_OutSighting) {
                    if (type === EActorViewType_T.EAVT_InSight) this.clearAlphaTexModifier();
                    else elapsed = Math.fround((pawn.getUnrealScriptProperty("L2ActorViewDuration") as number) - (pawn.getUnrealScriptProperty("L2ActorViewElapsedTime") as number));
                }
                break;
            default: return this.prepareActorView(previous);
        }

        pawn.setUnrealScriptProperty("L2ActorViewtype", type);
        pawn.setUnrealScriptProperty("L2ActorViewElapsedTime", elapsed);
        return this.prepareActorView(type);
    }

    protected prepareActorView(type: EActorViewType_T): boolean {
        if (this.texModifierAlpha >= 0) {
            for (const batch of this.batches) {
                const material = batch.material as MeshStaticMaterial;
                if (!material.transparent) {
                    material.transparent = true;
                    material.needsUpdate = true;
                }
            }
            for (const mesh of this.meshes) this.prepareAlphaMaterial(mesh);
            for (const mesh of this.equipmentMeshes) this.prepareAlphaMaterial(mesh);
        }
        return type !== EActorViewType_T.EAVT_OutSight;
    }

    protected prepareAlphaMaterial(mesh: Mesh): void {
        if (mesh.layers.mask === 0 || this.fadeMeshes.get(mesh)?.material === mesh.material) return;
        const source = mesh.material;
        const material = Array.isArray(source) ? source.map(value => this.getAlphaMaterial(value)) : this.getAlphaMaterial(source);

        if (material !== source) {
            this.fadeMeshes.set(mesh, { source, material });
            mesh.material = material;
        }
    }

    protected getAlphaMaterial(source: Material): Material {
        if (!(source as MeshStaticMaterial).isStaticMeshMaterial || source.blending !== NormalBlending) return source;
        let material = this.fadeMaterials.get(source as MeshStaticMaterial);

        if (!material) {
            material = (source as MeshStaticMaterial).clone();
            for (const [name, uniform] of Object.entries((source as MeshStaticMaterial).uniforms))
                if ((uniform.value as any)?.isTexture) material.uniforms[name].value = uniform.value;
            material.transparent = true;
            this.fadeMaterials.set(source as MeshStaticMaterial, material);
        }
        return material;
    }

    protected clearAlphaTexModifier(): void {
        this.texModifierAlpha = -1;
        for (const [mesh, entry] of this.fadeMeshes)
            if (mesh.material === entry.material) mesh.material = entry.source;
        this.fadeMeshes.clear();
        for (const material of this.fadeMaterials.values()) material.dispose();
        this.fadeMaterials.clear();
        for (const batch of this.batches) {
            const material = batch.material as MeshStaticMaterial;
            if (material.transparent) {
                material.transparent = false;
                material.needsUpdate = true;
            }
        }
    }

    public createSkin(): void {
        const pawn = this.getParent();
        if (!this.meshes.length || !pawn.findComponent("script") || pawn.getUnrealScriptProperty("bCreatedResource")) return;

        // APawn::CreateSkin 0x8b56e4..0x8b57aa; decoded meshes precede this render preparation phase.
        if (pawn.getUnrealScriptProperty("LoadingResourceRef") === 0) pawn.setUnrealScriptProperty("LoadingResourceRef", -1);
        pawn.setUnrealScriptProperty("bCreatedResource", true);
    }

    protected releaseBatches(): void {
        for (const batch of this.batches) {
            batch.release();
            this.renderManager.releaseGeometry(batch.geometry);
        }
        this.batches.length = 0;
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<unknown> {
        if (type === SCRIPT_NATIVE_EVENT) {
            const call = data as ScriptNativeCall_T;

            if (call.name.toLowerCase() !== "getrenderboundingsphere") return COMPONENT_EVENT_NOT_HANDLED;
            if (call.context !== this.getParent()) throw new Error(`'${call.context.scriptClassId}' cannot use '${this.getParent().type}' render bounds.`);

            const sphere = this.getPrimitiveRenderSphere();

            return [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius];
        }

        if (type === PAWN_COLLISION_SIZE_CHANGED_EVENT || type === MESH_SCALE_CHANGED_EVENT) this.invalidateBounds();
        else if (type === MESHES_CHANGED_EVENT) this.setMeshes(data as Mesh[]);
        else if (type === EQUIPMENT_MESHES_CHANGED_EVENT) {
            this.equipmentMeshes = data as Mesh[];
            if (this.isAttached()) this.setMeshes(this.meshes); // equipment detaches during a pawn's component clear, possibly after this one
        }
        else return COMPONENT_EVENT_NOT_HANDLED;

        return;
    }

    protected setMeshes(meshes: Mesh[]): void {
        const alpha = this.texModifierAlpha;
        this.clearAlphaTexModifier();
        this.texModifierAlpha = alpha;
        const geometries = this.batches.map(batch => batch.geometry);

        for (const geometry of geometries) this.renderManager.retainGeometry(geometry);
        try {
            this.releaseBatches();
            this.meshes = meshes;
            this.lastRenderTime = -Infinity;
            this.batches = createPawnMeshes([...meshes, ...this.equipmentMeshes], this.renderManager.renderer);

            for (const batch of this.batches) {
                this.getParent().add(batch);
                this.renderManager.retainGeometry(batch.geometry);
            }
        } finally {
            for (const geometry of geometries) this.renderManager.releaseGeometry(geometry);
        }

        for (const mesh of [...meshes, ...this.equipmentMeshes, ...this.batches]) {
            // FDynamicActor::Render 0x8eef4e sets Pawn.bRendered before mesh submission.
            mesh.onBeforeRender = (_renderer, scene, _camera, _geometry, material) => {
                if ((mesh as PawnMesh).isPawnMesh) (mesh as PawnMesh).updateBatch(_camera);
                const uniforms = (material as any).uniforms;

                if (uniforms && uniforms.texModifierAlpha) {
                    const alpha = scene === this.renderManager.scene && material.blending === NormalBlending ? this.texModifierAlpha : -1;
                    if (uniforms.texModifierAlpha.value !== alpha) {
                        uniforms.texModifierAlpha.value = alpha;
                        (material as any).uniformsNeedUpdate = true;
                    }
                }

                if (uniforms && uniforms.texModifierColor && !uniforms.texModifierColor.value.equals(this.texModifierColor)) {
                    uniforms.texModifierColor.value.copy(this.texModifierColor);
                    (material as any).uniformsNeedUpdate = true;
                }

                if (scene === this.renderManager.scene) {
                    this.isRendered = true;
                    const time = Math.fround(GLOBAL_UNIFORMS.globalTimeSeconds.value);

                    if (this.lastRenderTime !== time) {
                        this.getParent().setUnrealScriptProperty("LastRenderTime", time);
                        this.lastRenderTime = time;
                    }
                }
            };
            mesh.onAfterRender = (_renderer, _scene, _camera, _geometry, material) => {
                const uniforms = (material as any).uniforms;

                if (uniforms && uniforms.texModifierAlpha && uniforms.texModifierAlpha.value !== -1) {
                    uniforms.texModifierAlpha.value = -1;
                    (material as any).uniformsNeedUpdate = true;
                }

                if (uniforms && uniforms.texModifierColor && !uniforms.texModifierColor.value.equals(tmpWhite)) {
                    uniforms.texModifierColor.value.copy(tmpWhite);
                    (material as any).uniformsNeedUpdate = true;
                }
            };
        }

        this.invalidateBounds();
    }

    protected invalidateBounds(): void {
        this.boundsNeedUpdate = true;
    }

    protected updateBounds(): void {
        const parent = this.getParent();

        parent.updateWorldMatrix(true, false);
        if (!this.boundsNeedUpdate && this.boundsMatrix.equals(parent.matrixWorld)) return;

        this.boundsNeedUpdate = false;
        this.boundsMatrix.copy(parent.matrixWorld);
        this.worldBox.makeEmpty();
        tmpSphereBox.makeEmpty();

        if (!this.meshes.length) {
            this.worldBox.copy(parent.getCollisionPrimitive().bounds);
            this.worldBox.getBoundingSphere(this.worldSphere);
            return;
        }

        const mesh = this.meshes[0] as LitSkinnedMesh;

        mesh.updateMatrix();
        tmpMatrix.multiplyMatrices(parent.matrixWorld, tmpOrigin.makeRotationZ(Math.PI / 2)).multiply(mesh.matrix);
        if (mesh.isLitSkinnedMesh) tmpMatrix.multiply(tmpOrigin.makeTranslation(-mesh.meshOrigin.x, -mesh.meshOrigin.y, -mesh.meshOrigin.z));

        // FDynamicActor::Update 0x8e7c75..0x8e7fad uses the primary MeshToWorld for all pawn parts.
        for (const part of this.meshes) {
            if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
            if (!part.geometry.boundingSphere) part.geometry.computeBoundingSphere();

            this.worldBox.union(tmpBox.copy(part.geometry.boundingBox).applyMatrix4(tmpMatrix));
            tmpSphere.copy(part.geometry.boundingSphere).applyMatrix4(tmpMatrix);
            tmpSphereBox.expandByPoint(tmpVec.copy(tmpSphere.center).addScalar(-tmpSphere.radius));
            tmpSphereBox.expandByPoint(tmpVec.copy(tmpSphere.center).addScalar(tmpSphere.radius));
        }

        tmpSphereBox.getCenter(this.worldSphere.center);
        tmpSphereBox.getSize(tmpVec);
        this.worldSphere.radius = Math.max(tmpVec.x, tmpVec.y, tmpVec.z) * 0.5;
    }

    public getRenderSphere(): Sphere {
        this.updateBounds();
        return this.worldSphere;
    }

    public getPrimitiveRenderSphere(): Sphere {
        const parent = this.getParent();
        const mesh = this.meshes[0] as LitSkinnedMesh;

        if (!mesh || !mesh.isLitSkinnedMesh) throw new Error(`Native render bounds without a skeletal mesh are not implemented for '${parent.scriptClassId}'.`);
        if (!mesh.geometry.boundingSphere) throw new Error(`'${mesh.name}' has no decoded primitive sphere.`);

        parent.updateWorldMatrix(true, false);
        mesh.updateMatrix();
        tmpMatrix.multiplyMatrices(parent.matrixWorld, tmpOrigin.makeRotationZ(Math.PI / 2)).multiply(mesh.matrix).multiply(tmpOrigin.makeTranslation(-mesh.meshOrigin.x, -mesh.meshOrigin.y, -mesh.meshOrigin.z));

        const e = tmpMatrix.elements;

        // Core.dll FSphere::TransformBy 0x101145a0..0x10114748 stores each squared basis length before FSQRT.
        for (let i = 0; i < 16; i++) e[i] = Math.fround(e[i]);
        const scaleSquared = Math.max(Math.fround(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]), Math.fround(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]), Math.fround(e[8] * e[8] + e[9] * e[9] + e[10] * e[10]));
        const center = this.primitiveSphere.center.copy(mesh.geometry.boundingSphere.center).applyMatrix4(tmpMatrix);

        center.set(Math.fround(center.x), Math.fround(center.y), Math.fround(center.z));
        this.primitiveSphere.radius = Math.fround(mesh.geometry.boundingSphere.radius * Math.sqrt(scaleSquared));
        return this.primitiveSphere;
    }

    public getLightingSphere(): Sphere {
        this.lightingSphere.copy(this.getRenderSphere());
        if (!this.meshes.length || !(this.meshes[0] as LitSkinnedMesh).isLitSkinnedMesh) return this.lightingSphere;

        const parent = this.getParent();

        // USubSkeletalMeshInstance::Render 0x959b1e..0x959cd5 offsets only the lighting sphere by the animated root.
        parent.getBoneWorldPosition(0, tmpVec);
        tmpActorCenter.set(0, 0, parent.getCollisionHeight()).applyMatrix4(parent.matrixWorld);
        this.lightingSphere.center.add(tmpVec.sub(tmpActorCenter));

        return this.lightingSphere;
    }

    public getRenderBox(): Box3 {
        this.updateBounds();
        return this.worldBox;
    }

    public getAmbientZone(sector: SectorObject) {
        const bounds = this.getRenderBox();

        if (this.ambientSector === sector && this.predictedBox.containsBox(bounds)) return this.ambientZone;

        const parent = this.getParent();
        const zone = this.ambientZone;

        this.ambientSector = sector;
        this.predictedBox.copy(bounds);
        // AActor::UpdateRenderData 0x7cfdac..0x7cfdf5 retains leaves until the render box leaves this margin.
        if (parent.getComponent<PawnMovementComponent>("pawnMovement").getPhysicsMode() !== "none") this.predictedBox.expandByScalar(128);

        sector.boxLeafIndices(this.predictedBox, arrAmbientLeaves, (parent.getUnrealScriptProperty("ForcedRegionTag") as string) ?? "None", parent.getUnrealScriptProperty("ForcedRegion") as number);
        zone.isSunAffected = false;
        zone.ambient.fill(0);

        for (const index of arrAmbientLeaves) {
            const info = sector.bspZones[sector.bspLeaves[index].zone].zoneInfo;

            zone.isSunAffected = zone.isSunAffected || info.isSunAffected;
            if (info.ambient)
                for (let i = 0; i < 3; i++) zone.ambient[i] = Math.max(zone.ambient[i], info.ambient[i]);
        }

        zone.version++;
        parent.setUnrealScriptProperty("bSunAffect", zone.isSunAffected);
        return zone;
    }
}

export default PawnRenderableComponent;
