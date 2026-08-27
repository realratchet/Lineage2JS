import { Vector3 } from "three";
import { PhysicsComponent } from "./physics-component";
import type BaseActor from "../../base-actor";

const tmpDirection = new Vector3();

class NpcSimulationComponent extends PhysicsComponent<BaseActor> {
    public static readonly DEFAULT_COUNT = 10;
    public static readonly LIFETIME = 15000;
    protected static readonly TURN_INTERVAL = 1000;

    public readonly componentName = "npcSimulation";
    protected expires = Infinity;
    protected nextTurn = Infinity;

    public configure(expires: number, nextTurn: number): void {
        this.expires = expires;
        this.nextTurn = nextTurn;
    }

    public onPhysicsTick(currentTime: number, _deltaTime: number, _actors: BaseActor[]): boolean {
        const pawn = this.getParent();

        if (currentTime >= this.expires) {
            this.physicsManager.getParent().getComponent("render").removePawn(pawn);
            return true;
        }

        if (currentTime < this.nextTurn) return false;

        this.nextTurn = currentTime + NpcSimulationComponent.TURN_INTERVAL;

        const angle = Math.random() * Math.PI * 2;

        pawn.moveInDirection(tmpDirection.set(Math.cos(angle), Math.sin(angle), 0));

        return true;
    }
}

export default NpcSimulationComponent;
export { NpcSimulationComponent };
