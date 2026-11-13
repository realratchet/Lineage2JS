import { getLoadingDetail } from "./loading-profile";

type LoadingText_T = { stage: string, done?: number, total?: number, unit?: string, remaining?: number, items?: string[] };
type AreaLoadProgress_T = { total: number, decoded: number, built: number, ready: number, building: number };

export const loadingTexts = {
    clearCache(): LoadingText_T { return { stage: "Clearing cached game files" }; },
    persistentStorage(): LoadingText_T { return { stage: "Allow persistent storage to keep cached game files. You can continue without it." }; },
    sector(name: string, state: "preparing" | "loaded" | "built", done: number, total: number): LoadingText_T { return { stage: `${state === "preparing" ? "Preparing" : state === "loaded" ? "Loaded" : "Built"} sector ${name}`, done, total }; },
    gameData(): LoadingText_T { return { stage: "Loading game data" }; },
    gameDataWorkers(): LoadingText_T { return { stage: "Starting game data workers" }; },
    gameDataParts(done: number, total: number, pending: string[]): LoadingText_T { return { stage: done < total ? "Loading game data" : "Loaded game data", done, total, items: pending }; },
    gameEffects(): LoadingText_T { return { stage: "Preparing game effects and sky" }; },
    loginInterface(): LoadingText_T { return { stage: "Loading interface and game text" }; },
    loginScreens(done: number, total: number, pending: string[]): LoadingText_T { return done < total ? { stage: "Loading login screen", done, total, items: pending } : { stage: "Preparing login scene" }; },
    loginLighting(): LoadingText_T { return { stage: "Preparing login textures and lighting" }; },
    worldData(): LoadingText_T { return { stage: "Waiting for world data" }; },
    destination(): LoadingText_T { return { stage: "Loading destination" }; },
    destinationResponse(): LoadingText_T { return { stage: "Waiting for destination server response" }; },
    playerAppearance(): LoadingText_T { return { stage: "Loading player appearance" }; },
    skills(): LoadingText_T { return { stage: "Loading skills" }; },
    area(): LoadingText_T { return { stage: "Loading terrain, textures and lighting" }; },
    areaParts(progress: AreaLoadProgress_T): LoadingText_T {
        const action = progress.building > 0 ? "Building" : "Loading";

        if (progress.decoded < progress.total) return { stage: `${action} region packages`, done: progress.decoded, total: progress.total, unit: "regions" };
        if (progress.built < progress.total) return { stage: `${action} scenery`, done: progress.built, total: progress.total, unit: "regions" };
        return { stage: `${action} textures and lighting`, done: progress.ready, total: progress.total, unit: "regions" };
    },
    nearbyCharacters(remaining: number): LoadingText_T { return { stage: "Loading nearby characters", remaining }; }
};

let timer = 0, startTime = 0, loadingText: LoadingText_T = null, loadingValue: number | null = null;

function formatLoadingText(): string {
    const parts = [loadingText.stage];

    if (loadingText.total !== undefined) parts.push(`${loadingText.done}/${loadingText.total}${loadingText.unit ? ` ${loadingText.unit}` : ""}`);
    if (loadingText.remaining !== undefined) parts.push(`${loadingText.remaining} remaining`);
    if (loadingText.items?.length) parts.push(loadingText.items.join(", "));
    if (loadingValue !== null) parts.push(`${Math.round(loadingValue * 100)}%`);

    if (timer) {
        const seconds = Math.floor((performance.now() - startTime) / 1000);
        const detail = getLoadingDetail();

        if (detail) parts.push(detail);
        parts.push(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} elapsed`);
    }

    return parts.join(" · ");
}

function updateLoadingText() { document.querySelector(".loading-progress p").textContent = formatLoadingText(); }

export function setLoadingProgress(value: number | null, text: LoadingText_T, cover = false, timed = true) {
    const element = document.querySelector<HTMLElement>(".loading-progress");
    const progress = element.querySelector("progress");

    element.hidden = false;
    element.classList.toggle("loading-cover", cover);
    if (value === null) progress.removeAttribute("value");
    else progress.value = value;

    loadingText = text;
    loadingValue = value;
    if (timed && !timer) {
        startTime = performance.now();
        timer = window.setInterval(updateLoadingText, 1000);
    } else if (!timed) {
        window.clearInterval(timer);
        timer = 0;
    }

    updateLoadingText();
}

export function hideLoadingProgress() {
    window.clearInterval(timer);
    timer = 0;
    document.querySelector<HTMLElement>(".loading-progress").hidden = true;
    document.querySelector(".loading-error").textContent = "";
}

export function showLoadingError(error: any) {
    const errors = document.querySelector(".loading-error");

    errors.textContent += `${errors.textContent ? "\n" : ""}${error instanceof Error ? error.message : String(error)}`;
}
