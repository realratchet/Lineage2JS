import { selectAssetFiles, setServedAssets, type AssetFiles_T } from "./assets/asset-source";
import type { HTMLViewportElement_T } from "./rendering/render-manager";

function openHandleStore(mode: IDBTransactionMode) {
    return new Promise<IDBObjectStore>((resolve, reject) => {
        const request = indexedDB.open("asset-source", 1);

        request.onupgradeneeded = () => request.result.createObjectStore("handles");
        request.onsuccess = () => resolve(request.result.transaction("handles", mode).objectStore("handles"));
        request.onerror = () => reject(request.error);
    });
}

function awaitRequest<T>(request: IDBRequest<T>) {
    return new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function readDirectory(handle: any, path: string, files: AssetFiles_T): Promise<AssetFiles_T> {
    const entries: any[] = [];

    for await (const entry of handle.values()) entries.push(entry);

    await Promise.all(entries.map(async entry => {
        if (entry.kind === "directory") await readDirectory(entry, `${path}${entry.name}/`, files);
        else files.push([`${path}${entry.name}`, await entry.getFile()]);
    }));

    return files;
}

async function selectDirectory(handle: any) {
    await selectAssetFiles(await readDirectory(handle, `${handle.name}/`, []));
    await awaitRequest((await openHandleStore("readwrite")).put(handle, "directory"));
}

export async function pickAssetSource(): Promise<void> {
    const servedResponse = await fetch("served-assets.json", { cache: "no-store" });

    if (servedResponse.ok) setServedAssets(await servedResponse.json());
    else if (servedResponse.status !== 404) throw new Error(`served-assets.json: ${servedResponse.statusText}`);

    if (!new URLSearchParams(location.search).has("diskAssets") && (await fetch("asset-list.json", { method: "HEAD" })).ok) return;

    const hasDirectoryPicker = "showDirectoryPicker" in window;
    const stored = hasDirectoryPicker ? await awaitRequest((await openHandleStore("readonly")).get("directory")) : undefined;

    let storedError = "";

    if (stored && await stored.queryPermission({ mode: "read" }) === "granted") {
        try {
            await selectDirectory(stored);
            return;
        } catch (e) {
            storedError = `${stored.name}: ${(e as Error).message}`;
        }
    }

    const viewport = document.querySelector("viewport") as HTMLViewportElement_T;

    viewport.classList.add("asset-source");
    viewport.innerHTML = `<main><h1>Game files</h1><p>Select an installed Lineage II folder, or an InstallShield installer folder (data1.hdr, data1.cab, data2.cab, ...).</p>${stored ? `<button class="continue">Continue with ${stored.name}</button> ` : ""}${hasDirectoryPicker ? `<button class="choose">Choose folder</button>` : `<p>This browser can't remember the folder between launches. On Brave enable <code>brave://flags/#file-system-access-api</code>, otherwise use Chrome, Edge, Opera or Vivaldi.</p><input type="file" webkitdirectory>`}<pre></pre></main>`;

    const errors = viewport.querySelector("pre");

    errors.textContent = storedError;

    await new Promise<void>(resolve => {
        async function select(selectFiles: () => Promise<void>) {
            errors.textContent = "";

            try {
                await selectFiles();
                resolve();
            } catch (e) {
                if ((e as Error).name !== "AbortError") errors.textContent = (e as Error).message;
            }
        }

        if (stored) viewport.querySelector<HTMLButtonElement>("button.continue").onclick = () => select(async () => {
            if (await stored.requestPermission({ mode: "read" }) !== "granted") throw new Error(`Read access to '${stored.name}' was denied.`);

            await selectDirectory(stored);
        });

        if (hasDirectoryPicker) viewport.querySelector<HTMLButtonElement>("button.choose").onclick = () => select(async () => selectDirectory(await (window as any).showDirectoryPicker({ id: "lineage2", mode: "read" })));
        else {
            const input = viewport.querySelector("input");

            input.onchange = () => select(() => selectAssetFiles(Array.from(input.files, file => [file.webkitRelativePath, file])));
        }
    });

    viewport.classList.remove("asset-source");
    viewport.innerHTML = "";
}

export default pickAssetSource;
