function accessFiles<T>(mode: IDBTransactionMode, access: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("replay-files", 1);

        request.onupgradeneeded = () => request.result.createObjectStore("files");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const database = request.result, transaction = database.transaction("files", mode);
            let result: T;

            transaction.oncomplete = () => { database.close(); resolve(result); };
            transaction.onabort = () => { database.close(); reject(transaction.error); };
            try { access(transaction.objectStore("files"), value => result = value); }
            catch (error) { transaction.abort(); reject(error); }
        };
    });
}

export function listReplayFiles(): Promise<string[]> {
    return accessFiles("readonly", (store, result) => {
        const request = store.getAllKeys();

        request.onsuccess = () => result(request.result as string[]);
    });
}

export async function readReplayFile(name: string): Promise<Blob> {
    const file = await accessFiles<Blob>("readonly", (store, result) => {
        const request = store.get(name);

        request.onsuccess = () => result(request.result);
    });

    if (!file) throw new Error(`Replay file '${name}' does not exist.`);
    return file;
}

export function deleteReplayFile(name: string): Promise<void> {
    return accessFiles("readwrite", store => { store.delete(name); });
}

export function saveReplayFile(bytes: Uint8Array, name: string = null): Promise<string> {
    if (name !== null && !/^[^\\/]+\.l2r$/i.test(name)) throw new Error(`Invalid replay filename '${name}'.`);
    const blob = new Blob([bytes], { type: "application/octet-stream" });

    return accessFiles("readwrite", (store, result) => {
        const request = store.getAllKeys();

        request.onsuccess = () => {
            const names = new Set(request.result.map(value => String(value).toLowerCase()));

            if (name === null) {
                let index = 0;

                do { name = `Rep${String(index++).padStart(5, "0")}.l2r`; } while (names.has(name.toLowerCase()));
            } else if (names.has(name.toLowerCase())) name = String(request.result.find(value => String(value).toLowerCase() === name.toLowerCase()));
            store.add(blob, name);
            result(name);
        };
    });
}
