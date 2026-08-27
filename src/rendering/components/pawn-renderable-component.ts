import { Mesh, Sphere } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { MESHES_CHANGED_EVENT } from "../../objects/components/animation-component";
import type BaseActor from "../../base-actor";
import type RenderManager from "../render-manager";

const tmpSphere = new Sphere();

class PawnRenderableComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "pawnRenderable";
    protected readonly renderManager: RenderManager;
    protected readonly localSphere = new Sphere();
    protected readonly worldSphere = new Sphere();

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public onAttach(): void { this.renderManager.registerPawnRenderable(this); }
    public onDetach(): void { this.renderManager.unregisterPawnRenderable(this); }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<unknown> {
        if (type !== MESHES_CHANGED_EVENT) return COMPONENT_EVENT_NOT_HANDLED;

        this.setMeshes(data as Mesh[]);

        return;
    }

    protected setMeshes(meshes: Mesh[]): void {
        this.localSphere.makeEmpty();

        for (const mesh of meshes) {
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
export { PawnRenderableComponent };
