import DecodeWorkerClient from "./assets/decode-worker/decode-worker-client";
import type { HTMLViewportElement_T } from "./rendering/render-manager";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";

type PrecacheView_T = {
    progress: HTMLProgressElement,
    summary: HTMLElement,
    detail: HTMLElement,
    errors: HTMLElement,
    cancel: HTMLButtonElement
};

function createView(): PrecacheView_T {
    const viewport = document.querySelector("viewport") as HTMLViewportElement_T;
    const viewerUrl = new URL(location.href);

    viewerUrl.searchParams.delete("precacheSectors");
    viewport.classList.add("sector-precache");
    viewport.innerHTML = `<main><h1>Sector cache</h1><p class="precache-summary">Preparing workers...</p><progress value="0" max="1"></progress><p class="precache-detail"></p><pre></pre><div><button type="button">Cancel</button><a>Open viewer</a></div></main>`;
    (viewport.querySelector("a") as HTMLAnchorElement).href = viewerUrl.href;

    return {
        progress: viewport.querySelector("progress"),
        summary: viewport.querySelector(".precache-summary"),
        detail: viewport.querySelector(".precache-detail"),
        errors: viewport.querySelector("pre"),
        cancel: viewport.querySelector("button")
    };
}

function formatDuration(ms: number): string {
    const seconds = Math.round(ms / 1000);
    const minutes = Math.floor(seconds / 60);

    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

function formatBytes(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function buildSectorCache(view: PrecacheView_T, loadSettings: LoadSettings_T): Promise<void> {
    const assetList = await (await fetch("asset-list.json")).json();
    const sectors = Object.keys(assetList.supported)
        .filter(path => /^maps\/\d+_\d+\.unr$/.test(path))
        .map(path => path.slice("maps/".length, -".unr".length))
        .sort();
    const activeSectors = new Set<string>();
    const failures: string[] = [];
    const startTime = performance.now();
    let cursor = 0;
    let completed = 0;
    let cached = 0;
    let built = 0;
    let writtenBytes = 0;
    let cancelled = false;
    let client: DecodeWorkerClient = null;

    view.progress.max = sectors.length;
    view.cancel.onclick = () => {
        cancelled = true;
        view.cancel.disabled = true;
        view.cancel.textContent = "Stopping...";
    };

    function updateProgress() {
        view.progress.value = completed;
        view.summary.textContent = `${completed} / ${sectors.length} · ${built} built · ${cached} cached · ${failures.length} failed`;
        view.detail.textContent = activeSectors.size > 0 ? `Processing ${Array.from(activeSectors).join(", ")} · ${formatDuration(performance.now() - startTime)}` : formatDuration(performance.now() - startTime);
    }

    async function getClient(): Promise<DecodeWorkerClient> {
        if (client) return client;

        client = new DecodeWorkerClient(1);

        try {
            await client.ready;
            return client;
        } catch (e) {
            client.terminate();
            client = null;
            throw e;
        }
    }

    updateProgress();

    try {
        while (!cancelled && cursor < sectors.length) {
            const sector = sectors[cursor++];
            let keepWorker = false;

            activeSectors.add(sector);
            updateProgress();

            try {
                const worker = await getClient();
                const result = await worker.precacheSector(sector, loadSettings);

                if (result.cached) {
                    cached++;
                    keepWorker = true;
                } else {
                    built++;
                    writtenBytes += result.bytes;
                }
            } catch (e) {
                const message = `${sector}: ${(e as Error).message ?? String(e)}`;

                failures.push(message);
                view.errors.textContent = failures.join("\n");
            }

            if (!keepWorker && client) {
                client.terminate();
                client = null;
            }

            activeSectors.delete(sector);
            completed++;
            updateProgress();
        }
    } finally {
        if (client) client.terminate();
    }

    const duration = formatDuration(performance.now() - startTime);

    view.cancel.disabled = true;
    view.cancel.textContent = cancelled ? "Canceled" : "Complete";
    view.detail.textContent = `${duration} · ${formatBytes(writtenBytes)} written this run`;
    document.title = cancelled ? "Sector cache canceled" : "Sector cache complete";
}

export async function runSectorPrecache(loadSettings: LoadSettings_T): Promise<void> {
    const view = createView();

    try {
        await buildSectorCache(view, loadSettings);
    } catch (e) {
        view.summary.textContent = `Sector cache failed: ${(e as Error).message ?? String(e)}`;
        view.cancel.disabled = true;
        document.title = "Sector cache failed";
        console.error("[decode-cache] sector precache failed:", e);
    }
}

export default runSectorPrecache;
