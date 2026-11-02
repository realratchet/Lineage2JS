import { makePrebuiltLayout } from "@l2js/core/unreal/un-struct";
const definitions = Object.create(null);
const data = [];
__DEFINITIONS__
const signatures = __SIGNATURES__;
const cacheCompatible = new WeakMap();
export default function getPrebuiltClass(struct, native) {
    const definition = definitions[struct.name.toLowerCase()];
    if (!definition) return null;
    for (const name of definition.packages) {
        if (!native.loader.hasPackage(name, "Script")) return null;
        const pkg = native.loader.getPackage(name, "Script");
        if (!pkg.header) return null;
        let compatible = cacheCompatible.get(pkg);
        if (compatible === undefined) {
            const h = pkg.header;
            const actual = [h.version, Array.from(new Uint8Array(h.guid.value.buffer, h.guid.value.byteOffset, h.guid.value.byteLength)), h.nameCount, h.exportCount, h.importCount];
            compatible = JSON.stringify(actual) === JSON.stringify(signatures[name]);
            cacheCompatible.set(pkg, compatible);
        }
        if (!compatible) return null;
    }
    return definition;
}
