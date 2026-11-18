import { makePrebuiltLayout } from "@l2js/core/unreal/un-struct";
import getPackageSignature from "@l2js/engine/package-signature";
const definitions = Object.create(null);
const data = [];
__DEFINITIONS__
const signatures = __SIGNATURES__;
const cacheSignatures = new WeakMap();
export default function getPrebuiltClass(struct, native) {
    const variants = definitions[struct.name.toLowerCase()];
    if (!variants) return null;
    for (const definition of variants) {
        if (!isCompatible(definition, native)) continue;
        const value = getData(definition.data);

        value.create = definition.create;
        return value;
    }
    return null;
}

function getData(index) {
    const value = data[index];

    return typeof value === "function" ? data[index] = value() : value;
}

function isCompatible(definition, native) {
    const expected = signatures[definition.source];
    for (const name of definition.packages) {
        if (!native.loader.hasPackage(name, "Script")) return false;
        const pkg = native.loader.getPackage(name, "Script");
        if (!pkg.header) return false;
        let actual = cacheSignatures.get(pkg);
        if (actual === undefined) {
            actual = getPackageSignature(pkg);
            cacheSignatures.set(pkg, actual);
        }
        if (actual !== expected[name]) return false;
    }
    return true;
}
