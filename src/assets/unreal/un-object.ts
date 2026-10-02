import CoreUObject from "@l2js/core";
import type { DecodeLibrary } from "./decode-library";

export type IDecodableStruct<T = unknown> = { getDecodeInfo(library: DecodeLibrary): T; };

type MakeParams_T<T> = ConstructorParameters<{ new(): never } & T>;

abstract class EngineUObject extends CoreUObject {
    public abstract readonly uuid: string;
    public abstract dumpLayout(): string;

    public static make<T extends EngineUObject, K extends abstract new (...args: any[]) => T>(this: K, ..._args: MakeParams_T<K>): InstanceType<K> {
        debugger;
        throw new Error(`'${this.name}.make' must be installed by the engine.`);
    }

    public static class<T extends EngineUObject, K extends abstract new (...args: any[]) => T>(this: K): new (...args: MakeParams_T<K>) => InstanceType<K> {
        debugger;
        throw new Error(`'${this.name}.class' must be installed by the engine.`);
    }
}

type UObject = EngineUObject;

const UObject = CoreUObject as unknown as typeof EngineUObject;

export default UObject;
export { UObject };
