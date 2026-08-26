export interface IEngineComponent<T extends IEngineComponent<T>> {
    startTicking?(currentTime: number): void; // for syncing clocks
    onInit?(): Promise<this>;
    onBeforeEngineTick?(currentTime: number, deltaTime: number): void;
    onEngineTick?(currentTime: number, deltaTime: number): void;
    onAfterEngineTick?(currentTime: number, deltaTime: number): void;
    setParent(parent: T): this;
    getParent(): T;
}

export interface IComponent { };