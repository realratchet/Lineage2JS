import { Mesh, Sphere, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { MESHES_CHANGED_EVENT, MESH_SCALE_CHANGED_EVENT } from "../../objects/components/animation-component";
import { PAWN_COLLISION_SIZE_CHANGED_EVENT } from "../../physics/components/pawn-movement-component";
import type BaseActor from "../../base-actor";
import type RenderManager from "../render-manager";
import GLOBAL_UNIFORMS from "../../materials/global-uniforms";
import PawnMesh, { createPawnMeshes } from "../../objects/pawn-mesh";

const tmpSphere = new Sphere();
const tmpWhite = new Vector3(1, 1, 1);

export class PawnRenderableComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "pawnRenderable";
    public isRendered: boolean = false;
    public readonly texModifierColor = new Vector3(1, 1, 1);
    protected readonly renderManager: RenderManager;
    protected readonly localSphere = new Sphere();
    protected readonly worldSphere = new Sphere();
    protected meshes: Mesh[] = [];
    protected batches: PawnMesh[] = [];
    protected lastRenderTime = -Infinity;

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public onAttach(): void { this.renderManager.registerPawnRenderable(this); }
    public onDetach(): void {
        this.releaseBatches();
        this.renderManager.unregisterPawnRenderable(this);
    }

    protected releaseBatches(): void {
        for (const batch of this.batches) {
            batch.release();
            this.renderManager.releaseGeometry(batch.geometry);
        }
        this.batches.length = 0;
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<unknown> {
        if (type === PAWN_COLLISION_SIZE_CHANGED_EVENT || type === MESH_SCALE_CHANGED_EVENT) this.updateLocalSphere();
        else if (type === MESHES_CHANGED_EVENT) this.setMeshes(data as Mesh[]);
        else return COMPONENT_EVENT_NOT_HANDLED;

        return;
    }

    protected setMeshes(meshes: Mesh[]): void {
        const geometries = this.batches.map(batch => batch.geometry);

        for (const geometry of geometries) this.renderManager.retainGeometry(geometry);
        try {
            this.releaseBatches();
            this.meshes = meshes;
            this.lastRenderTime = -Infinity;
            this.batches = createPawnMeshes(meshes, this.renderManager.renderer);

            for (const batch of this.batches) {
                this.getParent().add(batch);
                this.renderManager.retainGeometry(batch.geometry);
            }
        } finally {
            for (const geometry of geometries) this.renderManager.releaseGeometry(geometry);
        }

        for (const mesh of [...meshes, ...this.batches]) {
            // FDynamicActor::Render 0x8eef4e sets Pawn.bRendered before mesh submission.
            mesh.onBeforeRender = (_renderer, scene, _camera, _geometry, material) => {
                if ((mesh as PawnMesh).isPawnMesh) (mesh as PawnMesh).updateBatch(_camera);
                const uniforms = (material as any).uniforms;

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

                if (uniforms && uniforms.texModifierColor && !uniforms.texModifierColor.value.equals(tmpWhite)) {
                    uniforms.texModifierColor.value.copy(tmpWhite);
                    (material as any).uniformsNeedUpdate = true;
                }
            };
        }

        this.updateLocalSphere();
    }

    protected updateLocalSphere(): void {
        this.localSphere.makeEmpty();

        for (const mesh of this.meshes) {
            mesh.updateMatrix();

            if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
            if (mesh.geometry.boundingSphere) this.localSphere.union(tmpSphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrix));
        }
    }

    public getRenderSphere(): Sphere {
        const parent = this.getParent();

        if (this.localSphere.isEmpty()) return parent.getCollisionPrimitive().bounds.getBoundingSphere(this.worldSphere);

        parent.updateWorldMatrix(true, false);

        return this.worldSphere.copy(this.localSphere).applyMatrix4(parent.matrixWorld);
    }
}

export default PawnRenderableComponent;
