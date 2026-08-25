import { IEngineComponent } from "@client/game/components";
import type GameManager from "@client/game/game-manager";

class PhysicsManager implements IEngineComponent<GameManager> {
    protected gameManager: GameManager;

    public setParent(parent: GameManager): this { this.gameManager = parent; return this; }
    public getParent(): GameManager { return this.gameManager; }
}

export default PhysicsManager;
export { PhysicsManager };