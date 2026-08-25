export interface IEngineComponent<T extends IEngineComponent<T>> {
    onBeforeEngineTick?(currentTime: number, deltaTime: number): void;
    onEngineTick?(currentTime: number, deltaTime: number): void;
    onAfterEngineTick?(currentTime: number, deltaTime: number): void;
    setParent(parent: T): this;
    getParent(): T;
}


