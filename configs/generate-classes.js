import fs from "node:fs";
import path from "node:path";
import { AAssetLoader, UObject, ObjectFlags_T, UProperty, UClass } from "@l2js/core";
import * as Library from "../src/assets/unreal/un-package";
import templateClass from "!!raw-loader!./templates/prebuilt-class.js";
import templateClassTag from "!!raw-loader!./templates/prebuilt-class-tag.js";
import templateModule from "!!raw-loader!./templates/prebuilt-classes.js";

class AssetLoader extends AAssetLoader {
    constructor(files) { super(); this.init(files, Library); }
    createPackage(Constructor, file) { return new Constructor(this, file); }
    createNativePackage(Constructor) { return new Constructor(this); }
}

function reference(object) { return [object.pkg.name, object.exp.index + 1]; }

function signature(pkg) {
    const header = pkg.header;

    return [header.version, Array.from(new Uint8Array(header.guid.value.buffer, header.guid.value.byteOffset, header.guid.value.byteLength)), header.nameCount, header.exportCount, header.importCount];
}

async function main() {
    const manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    const files = manifest.files;
    const loader = new AssetLoader(files);
    const native = loader.getNativePackage();
    const packages = Object.keys(files).filter(file => path.extname(file).toLowerCase() === ".u" && !path.basename(file).startsWith("dec-")).sort();
    const definitions = {};
    const signatures = {};
    const skipped = [];

    Library.UPackage.prototype["readArrayBuffer"] = async function () {
        const buffer = fs.readFileSync(this.path);

        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    };

    // Default values stay package-owned; generation only needs the overriding field names.
    UClass.prototype["loadProperty"] = function (pkg, tag) {
        const name = this.getPropertyVarName(tag);
        if (this.findValidProperty(name)) this.defaultProperties.set(name, null);
        pkg.seek(pkg.tell() + tag.dataSize, "set");
    };

    await native.decode();
    for (const file of packages) await loader.getPackage(file).decode();

    for (const pkg of [native, ...packages.map(file => loader.getPackage(file))]) {
        if (pkg !== native) signatures[pkg.name] = signature(pkg);

        for (const exp of pkg.exports) {
            const type = exp.idClass === 0 ? "Class" : pkg.getPackageName(exp.idClass);
            if (type !== "Class" && type !== "Struct") continue;

            const struct = pkg.fetchObject(exp.index + 1).loadSelf();
            const bases = struct.collectDependencies().reverse();
            let lastNative = null;
            const properties = new Map();
            const defaults = [];
            const inheritedProps = {};

            for (const base of bases) {
                if (!base.exp || base.exp.anyFlags(ObjectFlags_T.RF_Native)) lastNative = base;
                const names = inheritedProps[base.friendlyName] = [];

                for (const field of base.childPropFields.values()) {
                    if (!(field instanceof UProperty)) continue;
                    properties.set(field.propertyName, reference(field));
                    names.push(field.propertyName);
                }
                if (base.defaultProperties.size) defaults.push([reference(base), Array.from(base.defaultProperties.keys())]);
            }

            let Constructor;
            try { Constructor = lastNative ? native.getConstructor(lastNative.friendlyName) : native.getStructConstructor(struct.friendlyName); }
            catch (error) {
                if (!String(error.message).includes("is not yet implemented")) throw error;
                skipped.push({ name: pkg.getObjectPath(exp), reason: error.message });
                continue;
            }

            const unserialized = Constructor.collectUnserializedProperties();
            const names = [...properties.keys(), ...unserialized.map(prop => prop[0])];
            if (new Set(names).size !== names.length) throw new Error(`Duplicate properties in '${struct.name}'.`);
            const indices = Object.fromEntries(names.map((name, index) => [name, index]));
            const lower = Object.fromEntries(names.map((name, index) => [name.toLowerCase(), index]));
            const propertyMap = Object.create(Constructor.prototype).getPropertyMap();
            const dependencies = Array.from(new Set(bases.map(base => base.pkg.name).concat(Array.from(properties.values()).map(ref => ref[0])))).filter(name => name !== "__native__");
            const definition = { packages: dependencies, name: struct.friendlyName, native: lastNative ? reference(lastNative) : null, layout: { properties: Array.from(properties), unserialized }, defaults, inheretenceChain: bases.map(base => base.friendlyName), inheritedProps, propertyMap, mappedProperties: Object.entries(propertyMap), indices, lower, tag: Constructor === UObject ? struct.getDynamicTag(struct.friendlyName) : null };

            definitions[pkg.getObjectPath(exp).toLowerCase()] = definition;
        }
    }

    const lines = [];
    const cacheData = new Map();
    function emit(value) {
        if (value === null || typeof value !== "object") return JSON.stringify(value);
        const key = JSON.stringify(value);
        if (cacheData.has(key)) return `data[${cacheData.get(key)}]`;
        const literal = Array.isArray(value) ? `[${value.map(emit).join(",")}]` : `{${Object.entries(value).map(([name, value]) => `${JSON.stringify(name)}:${emit(value)}`).join(",")}}`;
        const index = cacheData.size;
        cacheData.set(key, index);
        lines.push(`data[${index}] = ${literal};`);
        return `data[${index}]`;
    }
    for (const [key, definition] of Object.entries(definitions)) {
        const name = definition.name;
        if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error(`Invalid class name '${name}'.`);
        const replacements = { KEY: JSON.stringify(key), DEFINITION: emit(definition), NAME: name, FRIENDLY_NAME: JSON.stringify(name), TO_STRING: definition.tag ? templateClassTag.trimEnd().replace("__TAG__", () => JSON.stringify(definition.tag)) : "" };
        lines.push(templateClass.trimEnd().replace(/__(KEY|DEFINITION|NAME|FRIENDLY_NAME|TO_STRING)__/g, (_, key) => replacements[key]));
    }
    const replacements = { DEFINITIONS: lines.join("\n"), SIGNATURES: JSON.stringify(signatures) };
    fs.writeFileSync(manifest.output, templateModule.replace(/__(DEFINITIONS|SIGNATURES)__/g, (_, key) => replacements[key]));
    fs.writeFileSync(manifest.output + ".stats.json", JSON.stringify({ classes: Object.keys(definitions).length, skipped: skipped.length, skippedLayouts: skipped }, null, 4) + "\n");
}

void (async function () {
    try { await main(); }
    catch (error) { console.error(error); process.exitCode = 1; }
})();
