import { IEngineComponent } from "@client/game/components";
import type GameManager from "@client/game/game-manager";

class UIManager implements IEngineComponent<GameManager> {
    public moverPosition = 0;

    protected manGame: GameManager;

    public setParent(parent: GameManager): this { this.manGame = parent; return this; }
    public getParent(): GameManager { return this.manGame; }
}

export default UIManager;
export { UIManager };
