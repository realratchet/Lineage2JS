// @ts-nocheck
// import * as C from "node_modules/@l2js/core/index";

import { UObject as UObject_ } from "node_modules/@l2js/core/src/unreal/un-object";

declare module "@l2js/core" {
    abstract class UObject extends UObject_ {
        public uuid: string;
        public getDecodeInfo(library: GD.DecodeLibrary, ...args: any): any;

        /**
         * Force LSP to mark all inheriting classes as needing to implement this to remind about needing to make the class itself abstract.
         */
        public abstract forceAbstract(): void;
        public dumpLayout(): string;

        // public load(pkg: GA.UPackage): this;
        // public load(pkg: GA.UPackage, info: C.UExport): this;
        // public load(pkg: GA.UPackage, info: C.PropertyTag): this;
        // public load(pkg: GA.UPackage, info?: any): this;

        // protected loadWithPropertyTag(pkg: GA.UPackage, tag: C.PropertyTag): this;
        // protected loadWithExport(pkg: GA.UPackage, exp: C.UExport): this;

        // protected preLoad(pkg: GA.UPackage, exp: C.UExport): void;
        // protected doLoad(pkg: GA.UPackage, exp: C.UExport): void;
        // protected postLoad(pkg: GA.UPackage, exp: C.UExport): void;

        public static make<T extends UObject, K extends abstract new (...args: any[]) => T>(this: K, ...args: MakeParams<K>): InstanceType<K>;
        public static class<T extends UObject, K extends abstract new (...args: any[]) => T>(this: K): new (...args: MakeParams<K>) => InstanceType<K>;
    }

    export default UObject;
    export { UObject, UStruct };
}