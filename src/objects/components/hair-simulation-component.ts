import { Mesh, SkinnedMesh } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { MESHES_CHANGED_EVENT } from "./animation-component";
import PawnMovementComponent, { PAWN_TELEPORTED_EVENT } from "../../physics/components/pawn-movement-component";
import DynamicHairSimulation from "../dynamic-hair-simulation";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type LitSkinnedMesh from "../lit-skinned-mesh";

class HairSimulationComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "hairSimulation";
    protected readonly renderManager: RenderManager;
    protected readonly simulations: DynamicHairSimulation[] = [];
    protected movementComponent: PawnMovementComponent = null;

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public onAttach(): void {
        this.movementComponent = this.getComponent<PawnMovementComponent>("pawnMovement");
        this.renderManager.registerHairSimulation(this);
    }

    public onDetach(): void {
        this.restorePose();
        this.renderManager.unregisterHairSimulation(this);
        this.simulations.length = 0;
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<void> {
        if (type === MESHES_CHANGED_EVENT) {
            this.setMeshes(data as Mesh[]);
            return;
        }

        if (type === PAWN_TELEPORTED_EVENT) {
            for (const simulation of this.simulations) simulation.reset();
            return;
        }

        return COMPONENT_EVENT_NOT_HANDLED;
    }

    public restorePose(): void {
        for (const simulation of this.simulations) simulation.restorePose();
    }

    public update(deltaTime: number): void {
        const action = this.getParent().getAnimationAction();
        const animationName = action ? action.getClip().name : null;
        const isMoving = this.movementComponent.getVelocity().lengthSq() > 0;

        for (const simulation of this.simulations) simulation.update(deltaTime, animationName, isMoving);
    }

    protected setMeshes(meshes: Mesh[]): void {
        this.restorePose();
        this.simulations.length = 0;

        const parts = meshes.filter(mesh => (mesh as any).isSkinnedMesh) as SkinnedMesh[];

        for (const part of parts) {
            const info = (part as LitSkinnedMesh).dynamicHairInfo;

            if (!info) continue;

            const simulation = new DynamicHairSimulation(part, info);

            simulation.initialize(parts);
            this.simulations.push(simulation);
        }
    }
}

export default HairSimulationComponent;
export { HairSimulationComponent };
