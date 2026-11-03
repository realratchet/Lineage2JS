// prepares a decoded library for postMessage: sanitizes in place (values structured clone rejects or that
// would drag the package graph along are normalized/nulled with path-tagged warnings) and collects every
// reachable ArrayBuffer as the transfer list - `exclude` buffers skip transfer, they would detach worker-side

const indexKeyPattern = /^\d+$/;

function isNonIndexKey(key: string): boolean { return !indexKeyPattern.test(key); }

export function collectTransferables(root: any, exclude?: Set<ArrayBuffer>, prepared?: object[], validate: boolean = false): ArrayBuffer[] {
    const buffers = new Set<ArrayBuffer>();
    const visited = new Set<any>(prepared);
    const stack: any[] = [];
    let valid = true;

    function push(value: any): void {
        if (validate && typeof value === "function") valid = false;
        if (value !== null && typeof value === "object" && !visited.has(value)) {
            visited.add(value);
            stack.push(value);
        }
    }

    push(root);

    while (stack.length && valid) {
        const value = stack.pop();

        if (validate) {
            if (typeof value.then === "function" || value.isObject === true && typeof value.loadSelf === "function") return null;
            if (Array.isArray(value) && (value.constructor !== Array || Object.keys(value).some(isNonIndexKey))) return null;
        }

        if (value instanceof ArrayBuffer) {
            if (validate && exclude?.has(value)) return null;
            if (!exclude?.has(value)) buffers.add(value);
        } else if (ArrayBuffer.isView(value)) {
            if (validate && exclude?.has(value.buffer as ArrayBuffer)) return null;
            if (!exclude?.has(value.buffer as ArrayBuffer)) buffers.add(value.buffer as ArrayBuffer);
        } else if (value instanceof Blob) continue;
        else if (value instanceof Map || value instanceof Set)
            for (const entry of value.values()) push(entry);
        else if (Array.isArray(value))
            for (let i = 0; i < value.length; i++) push(value[i]);
        else
            for (const key of Object.keys(value)) push(value[key]);
    }

    return valid ? Array.from(buffers) : null;
}

export function prepareLibraryForTransfer(root: any, exclude?: Set<ArrayBuffer>, prepared?: object[]): ArrayBuffer[] {
    const transfer = collectTransferables(root, exclude, prepared, true);
    if (transfer) return transfer;

    const buffers = new Set<ArrayBuffer>();
    const sanitizedValues = new Map<any, any>(); // original -> replacement, preserves aliasing
    const stack: any[] = [];

    if (prepared)
        for (const value of prepared)
            sanitizedValues.set(value, value);

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
            sanitizedValues.set(plain, plain);

            for (let i = 0; i < value.length; i++) {
                const child = value[i];

                plain[i] = child !== null && (typeof child === "object" || typeof child === "function") ? sanitize(child, `${path}[${i}]`) : child;
            }

            stack.push(plain, path);
            return plain;
        }

        sanitizedValues.set(value, value);
        stack.push(value, path);
        return value;
    }

    function pushChild(container: any, key: any, child: any, path: string, kind: "object" | "array" | "map" = "object") {
        if (child === null || typeof child !== "object" && typeof child !== "function" && child === child) return;

        path = kind === "array" ? `${path}[${key}]` : kind === "map" ? `${path}[${typeof key === "string" ? `'${key}'` : "<key>"}]` : `${path}.${key}`;
        const safe = sanitize(child, path);

        if (safe !== child) {
            try {
                if (container instanceof Map) container.set(key, safe);
                else container[key] = safe;
            } catch (e) {
                console.warn(`[decode-worker] could not replace ${path} with its sanitized value:`, e);
            }
        }
    }

    sanitize(root, "library");

    while (stack.length > 0) {
        const path = stack.pop() as string;
        const value = stack.pop();

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
                pushChild(value, key, entry, path, "map");
            continue;
        }

        if (value instanceof Set) {
            /* set entries cannot be replaced in place - non-clonable ones get swapped out */
            for (const entry of value) {
                if (entry === null || typeof entry !== "object" && typeof entry !== "function" && entry === entry) continue;

                const safe = sanitize(entry, `${path}<entry>`);

                if (safe !== entry) value.delete(entry);
                if (safe !== entry && safe !== null && typeof safe === "object") value.add(safe);
            }
            continue;
        }

        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++)
                pushChild(value, i, value[i], path, "array");
            continue;
        }

        /* plain object - structured clone copies own enumerable keys only */
        for (const key of Object.keys(value))
            pushChild(value, key, value[key], path);
    }

    return [...buffers];
}

export default prepareLibraryForTransfer;
