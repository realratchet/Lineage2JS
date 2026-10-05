import { Mesh, Sphere } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { MESHES_CHANGED_EVENT } from "../../objects/components/animation-component";
import { PAWN_COLLISION_SIZE_CHANGED_EVENT } from "../../physics/components/pawn-movement-component";
import type BaseActor from "../../base-actor";
import type RenderManager from "../render-manager";

const tmpSphere = new Sphere();

export class PawnRenderableComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "pawnRenderable";
    public isRendered: boolean = false;
    protected readonly renderManager: RenderManager;
    protected readonly localSphere = new Sphere();
    protected readonly worldSphere = new Sphere();
    protected meshes: Mesh[] = [];

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public onAttach(): void { this.renderManager.registerPawnRenderable(this); }
    public onDetach(): void { this.renderManager.unregisterPawnRenderable(this); }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<unknown> {
        if (type === PAWN_COLLISION_SIZE_CHANGED_EVENT) this.updateLocalSphere();
        else if (type === MESHES_CHANGED_EVENT) this.setMeshes(data as Mesh[]);
        else return COMPONENT_EVENT_NOT_HANDLED;

        return;
    }

    protected setMeshes(meshes: Mesh[]): void {
        this.meshes = meshes;

        for (const mesh of meshes) {
            // FDynamicActor::Render 0x8eef4e sets Pawn.bRendered before mesh submission.
            mesh.onBeforeRender = (_renderer, scene) => {
                if (scene === this.renderManager.scene) this.isRendered = true;
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
