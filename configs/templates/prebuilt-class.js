Object.assign(__DEFINITION__, { create(Constructor) {
    const definition = this;
    return class __NAME__ extends Constructor {
        static isDynamicClass = true;
        static isPrebuiltClass = true;
        static friendlyName = __FRIENDLY_NAME__;
        static inheretenceChain = globalThis.Object.freeze(definition.inheretenceChain);
        static inheritedProps = globalThis.Object.freeze(definition.inheritedProps);
        static _propertyMapCache = definition.propertyMap;
        static _mappedProperties = definition.mappedProperties;
        static _classLayout = null;
        static _definition = definition;
        static getConstructorName() { return __FRIENDLY_NAME__; }
        getPropertyMap() { return this.constructor._propertyMapCache; }
        findPropReader(name) {
            const ctor = this.constructor;
            const index = ctor._definition.indices[name] ?? ctor._definition.lower[name.toLowerCase()];
            return typeof index !== "number" ? null : ctor._propertyEntries[index][1];
        }
        makeLayout() { makePrebuiltLayout(this); }
        __TO_STRING__
    };
} })
