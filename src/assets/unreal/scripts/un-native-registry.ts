import registerNativeFuncs from "./un-operators";

const NATIVE: GenericObjectContainer_T<any> = {
};

const NATIVE_FUNCS: GenericObjectContainer_T<Function> = {};

const UNativeRegistry = new class UNativeRegistry {
    public getClass(className: string) {
        const clsName = className.toLowerCase();

        if (!(clsName in NATIVE))
            throw new Error(`Native class '${className}' not registered`);

        return NATIVE[clsName];
    }

    public hasNativeFunc(nativeIndex: number | string): boolean { return nativeIndex in NATIVE_FUNCS; }
    public registerNativeFunc(nativeIndex: number | string, func: Function) {
        if (this.hasNativeFunc(nativeIndex))
            throw new Error(`Native index '${nativeIndex}' already registered!`);

        NATIVE_FUNCS[nativeIndex] = func;
    }

    public getNativeFuncName(nativeIndex: number | string) {
        if (!this.hasNativeFunc(nativeIndex))
            throw new Error(`Native index '${nativeIndex}' not registered!`);

        if (NATIVE_FUNCS[nativeIndex].name === "fn_not_implemented")
            debugger;

        return NATIVE_FUNCS[nativeIndex].name;
    }
}();

registerNativeFuncs(UNativeRegistry);

export default UNativeRegistry;
export { UNativeRegistry };