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
        const parent = this.getParent();
        const action = parent.getAnimationAction();
        const clip = action ? action.getClip() : null;
        const animationName = clip ? clip.name : null;
        const animationFrame = action && clip.duration > 0 ? action.time / clip.duration : 0;
        const lowerName = animationName ? animationName.toLowerCase() : "";
        const weaponType = Number(parent.getUnrealScriptProperty("CurWeaponType")) || 0;
        const attackEffectFrame = clip ? Number((clip as any).attackEffectFrame) || 0 : 0;
        const attackEndEffectFrame = clip ? Number((clip as any).attackEndEffectFrame) || 0 : 0;
        const isMoving = this.movementComponent.getVelocity().lengthSq() > 0;
        const isRunning = this.movementComponent.isRunning();
        const isDying = this.movementComponent.isDying();
        const isBowRunning = weaponType === 5 && isRunning;
        const isSpecialAttack = lowerName.startsWith("spatk01_") || lowerName.startsWith("spatk02_");

        for (const simulation of this.simulations) simulation.update(deltaTime, animationName, animationFrame, 0, attackEffectFrame, attackEndEffectFrame, isMoving, isRunning, isDying, isBowRunning, isSpecialAttack);
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
