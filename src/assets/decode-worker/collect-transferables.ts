/**
 * Prepares a decoded library for postMessage:
 *
 * 1. Sanitizes it in place - values structured clone either rejects (Promises,
 *    functions) or would silently drag the package graph along (live UObjects;
 *    FArray subclasses, whose non-index own fields like `pkg` are cloned because
 *    they are Array exotics) are normalized to plain equivalents or nulled, each
 *    with a path-tagged warning pointing at the producer to fix.
 * 2. Collects every reachable ArrayBuffer as the transfer list. Buffers in `exclude`
 *    (loaded package buffers - transferring one would detach the package inside the
 *    worker) are skipped with a warning and end up deep-copied instead.
 *
 * The library is not reused worker-side after posting, so in-place mutation is safe.
 */

function isNonIndexKey(key: string): boolean {
    return !/^\d+$/.test(key);
}

function prepareLibraryForTransfer(root: any, exclude?: Set<ArrayBuffer>): ArrayBuffer[] {
    const buffers = new Set<ArrayBuffer>();
    const sanitizedValues = new Map<any, any>(); // original -> replacement, preserves aliasing
    const visited = new Set<any>();
    const stack: [any, string][] = [];

    function addBuffer(buffer: ArrayBuffer, path: string) {
        if (exclude?.has(buffer)) {
            console.warn(`[decode-worker] ${path} aliases a package buffer - cloned instead of transferred. Fix the producer to copy (.slice()) its data.`);
            return;
        }

        buffers.add(buffer);
    }

    /**
     * Returns the clone-safe replacement for a value (the value itself when already safe).
     */
    function sanitize(value: any, path: string): any {
        if (value === null || typeof value !== "object") {
            if (typeof value === "function") {
                console.warn(`[decode-worker] ${path} is a function - dropped (cannot be cloned)`);
                return null;
            }

            return value;
        }

        if (sanitizedValues.has(value)) return sanitizedValues.get(value);

        if (typeof value.then === "function") {
            console.warn(`[decode-worker] ${path} is a Promise/thenable - dropped (cannot be cloned)`);
            sanitizedValues.set(value, null);
            return null;
        }

        /* a live UObject would pull pkg/propertyDict (and the package's promiseDecoding) into the clone */
        if (value.isObject === true && typeof value.loadSelf === "function") {
            console.warn(`[decode-worker] ${path} is a live UObject ('${value.objectName ?? "?"}') - dropped (fix the producer to store plain data)`);
            sanitizedValues.set(value, null);
            return null;
        }

        /*
         * Array exotics get ALL own enumerable props cloned, not just indices - FArray
         * subclasses carry Constructor/pkg/tag fields there. Normalize to a plain Array.
         */
        if (Array.isArray(value) && (value.constructor !== Array || Object.keys(value).some(isNonIndexKey))) {
            if (value.constructor !== Array)
                console.warn(`[decode-worker] ${path} is a ${value.constructor?.name ?? "patched array"} - normalized to a plain Array (fix the producer to store plain data)`);

            const plain = new Array(value.length);

            sanitizedValues.set(value, plain);

            for (let i = 0; i < value.length; i++)
                plain[i] = sanitize(value[i], `${path}[${i}]`);

            return plain;
        }

        sanitizedValues.set(value, value);
        return value;
    }

    function pushChild(container: any, key: any, child: any, path: string) {
        const safe = sanitize(child, path);

        if (safe !== child) {
            try {
                if (container instanceof Map) container.set(key, safe);
                else container[key] = safe;
            } catch (e) {
                console.warn(`[decode-worker] could not replace ${path} with its sanitized value:`, e);
            }
        }

        if (safe !== null && typeof safe === "object") stack.push([safe, path]);
    }

    stack.push([sanitize(root, "library"), "library"]);

    while (stack.length > 0) {
        const [value, path] = stack.pop();

        if (value === null || typeof value !== "object" || visited.has(value)) continue;
        visited.add(value);

        if (value instanceof ArrayBuffer) {
            addBuffer(value, path);
            continue;
        }

        if (ArrayBuffer.isView(value)) {
            addBuffer(value.buffer as ArrayBuffer, path);
            continue;
        }

        if (value instanceof Blob) continue;

        if (value instanceof Map) {
            for (const [key, entry] of value)
                pushChild(value, key, entry, `${path}[${typeof key === "string" ? `'${key}'` : "<key>"}]`);
            continue;
        }

        if (value instanceof Set) {
            /* set entries cannot be replaced in place - non-clonable ones get swapped out */
            for (const entry of value) {
                const safe = sanitize(entry, `${path}<entry>`);

                if (safe !== entry) value.delete(entry);
                if (safe !== null && typeof safe === "object") {
                    if (safe !== entry) value.add(safe);
                    stack.push([safe, `${path}<entry>`]);
                }
            }
            continue;
        }

        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++)
                pushChild(value, i, value[i], `${path}[${i}]`);
            continue;
        }

        /* plain object - structured clone copies own enumerable keys only */
        for (const key of Object.keys(value))
            pushChild(value, key, value[key], `${path}.${key}`);
    }

    return [...buffers];
}

export default prepareLibraryForTransfer;
export { prepareLibraryForTransfer };
