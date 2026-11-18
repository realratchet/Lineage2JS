import type { APackage } from "@l2js/core";

export default function getPackageSignature(pkg: APackage): string {
    const { version, guid, nameCount, exportCount, importCount } = pkg.header;
    const bytes = guid.value;

    return JSON.stringify([version, Array.from(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)), nameCount, exportCount, importCount]);
}
