import { BufferGeometry, Material, Mesh, Object3D } from "three";

export interface IEngineComponent<T extends IEngineComponent<T>> {
    startTicking?(currentTime: number): void; // for syncing clocks
    onInit?(): Promise<this>;
    onBeforeEngineTick?(currentTime: number, deltaTime: number): void;
    onEngineTick?(currentTime: number, deltaTime: number): void;
    onAfterEngineTick?(currentTime: number, deltaTime: number): void;
    setParent(parent: T): this;
    getParent(): T;
}

export const COMPONENT_EVENT_NOT_HANDLED = Symbol("componentEventNotHandled");

export type ComponentEventResult_T<T> = T | typeof COMPONENT_EVENT_NOT_HANDLED;

export interface IObject {
    addComponent<T extends IComponent<any>>(component: T): T;
    removeComponent(component: IComponent<any>): boolean;
    getComponent<T extends IComponent<any>>(componentName: string): T;
    findComponent<T extends IComponent<any>>(componentName: string): T | null;
    getComponents<T extends IComponent<any>>(componentName?: string): T[];
    dispatchComponentEvent<T = unknown>(type: string, data?: unknown, source?: IComponent<any>): ComponentEventResult_T<T>;
    updateComponents(currentTime: number, deltaTime: number): void;
    detachComponents(): void;
};

export interface IComponent<TParent extends IObject = IObject> {
    readonly componentName: string;
    readonly updateOrder?: number;
    setParent(parent: TParent | null): this;
    getParent(): TParent;
    isAttached(): boolean;
    getComponent<T extends IComponent<any>>(componentName: string): T;
    findComponent<T extends IComponent<any>>(componentName: string): T | null;
    getComponents<T extends IComponent<any>>(componentName?: string): T[];
    dispatchEvent<T = unknown>(type: string, data?: unknown): ComponentEventResult_T<T>;
    onAttach?(): void;
    onDetach?(): void;
    onUpdate?(currentTime: number, deltaTime: number): void;
    onEvent?(type: string, data: unknown): ComponentEventResult_T<unknown>;
};

class ComponentCollection<TParent extends IObject> {
    protected readonly parent: TParent;
    protected readonly components: IComponent<any>[] = [];
    protected readonly updateComponents: IComponent<any>[] = [];

    public constructor(parent: TParent) {
        this.parent = parent;
    }

    public add<T extends IComponent<any>>(component: T): T {
        if (!component.componentName) throw new Error("A component has no componentName.");
        if (component.isAttached()) throw new Error(`Component '${component.componentName}' is already attached.`);

        this.components.push(component);
        if (component.onUpdate) {
            const updateOrder = component.updateOrder || 0;
            let index = this.updateComponents.length;

            while (index > 0 && (this.updateComponents[index - 1].updateOrder || 0) > updateOrder) index--;
            this.updateComponents.splice(index, 0, component);
        }
        component.setParent(this.parent);
        component.onAttach?.();

        return component;
    }

    public remove(component: IComponent<any>): boolean {
        const index = this.components.indexOf(component);

        if (index < 0) return false;

        component.onDetach?.();
        this.components.splice(index, 1);
        const updateIndex = this.updateComponents.indexOf(component);
        if (updateIndex >= 0) this.updateComponents.splice(updateIndex, 1);
        component.setParent(null);

        return true;
    }

    public get<T extends IComponent<any>>(componentName: string): T {
        const component = this.find<T>(componentName);

        if (!component) throw new Error(`Component '${componentName}' is not attached.`);

        return component;
    }

    public find<T extends IComponent<any>>(componentName: string): T | null {
        for (const component of this.components)
            if (component.componentName === componentName) return component as T;

        return null;
    }

    public getAll<T extends IComponent<any>>(componentName?: string): T[] {
        if (!componentName) return this.components.slice() as T[];

        return this.components.filter(component => component.componentName === componentName) as T[];
    }

    public dispatch<T>(type: string, data: unknown, source: IComponent<any> | null): ComponentEventResult_T<T> {
        let result: ComponentEventResult_T<T> = COMPONENT_EVENT_NOT_HANDLED;

        for (const component of this.components) {
            if (component === source || !component.onEvent) continue;

            const value = component.onEvent(type, data);

            if (value !== COMPONENT_EVENT_NOT_HANDLED) result = value as T;
        }

        return result;
    }

    public update(currentTime: number, deltaTime: number): void {
        for (const component of this.updateComponents) component.onUpdate(currentTime, deltaTime);
    }

    public clear(): void {
        for (let i = this.components.length - 1; i >= 0; i--) {
            const component = this.components[i];

            component.onDetach?.();
            component.setParent(null);
        }

        this.components.length = 0;
        this.updateComponents.length = 0;
    }
}

export abstract class ObjectComponent<TParent extends IObject = IObject> implements IComponent<TParent> {
    public abstract readonly componentName: string;
    protected parent: TParent = null;

    public setParent(parent: TParent | null): this { this.parent = parent; return this; }
    public getParent(): TParent {
        if (!this.parent) throw new Error(`Component '${this.componentName}' is not attached.`);

        return this.parent;
    }
    public isAttached(): boolean { return !!this.parent; }
    public getComponent<T extends IComponent<any>>(componentName: string): T { return this.getParent().getComponent<T>(componentName); }
    public findComponent<T extends IComponent<any>>(componentName: string): T | null { return this.getParent().findComponent<T>(componentName); }
    public getComponents<T extends IComponent<any>>(componentName?: string): T[] { return this.getParent().getComponents<T>(componentName); }
    public dispatchEvent<T = unknown>(type: string, data?: unknown): ComponentEventResult_T<T> { return this.getParent().dispatchComponentEvent<T>(type, data, this); }
}

export class GameObject extends Object3D implements IObject {
    public readonly isGameObject = true;
    protected readonly componentCollection = new ComponentCollection<this>(this);

    public addComponent<T extends IComponent<any>>(component: T): T { return this.componentCollection.add(component); }
    public removeComponent(component: IComponent<any>): boolean { return this.componentCollection.remove(component); }
    public getComponent<T extends IComponent<any>>(componentName: string): T { return this.componentCollection.get<T>(componentName); }
    public findComponent<T extends IComponent<any>>(componentName: string): T | null { return this.componentCollection.find<T>(componentName); }
    public getComponents<T extends IComponent<any>>(componentName?: string): T[] { return this.componentCollection.getAll<T>(componentName); }
    public dispatchComponentEvent<T = unknown>(type: string, data?: unknown, source: IComponent<any> = null): ComponentEventResult_T<T> { return this.componentCollection.dispatch<T>(type, data, source); }
    public updateComponents(currentTime: number, deltaTime: number): void { this.componentCollection.update(currentTime, deltaTime); }
    public detachComponents(): void { this.componentCollection.clear(); }
}

export class GameMesh<TGeometry extends BufferGeometry = BufferGeometry, TMaterial extends Material | Material[] = Material | Material[]> extends Mesh<TGeometry, TMaterial> implements IObject {
    public readonly isGameObject = true;
    protected readonly componentCollection = new ComponentCollection<this>(this);

    public addComponent<T extends IComponent<any>>(component: T): T { return this.componentCollection.add(component); }
    public removeComponent(component: IComponent<any>): boolean { return this.componentCollection.remove(component); }
    public getComponent<T extends IComponent<any>>(componentName: string): T { return this.componentCollection.get<T>(componentName); }
    public findComponent<T extends IComponent<any>>(componentName: string): T | null { return this.componentCollection.find<T>(componentName); }
    public getComponents<T extends IComponent<any>>(componentName?: string): T[] { return this.componentCollection.getAll<T>(componentName); }
    public dispatchComponentEvent<T = unknown>(type: string, data?: unknown, source: IComponent<any> = null): ComponentEventResult_T<T> { return this.componentCollection.dispatch<T>(type, data, source); }
    public updateComponents(currentTime: number, deltaTime: number): void { this.componentCollection.update(currentTime, deltaTime); }
    public detachComponents(): void { this.componentCollection.clear(); }
}

