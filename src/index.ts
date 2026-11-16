import "../style/style.scss";
import startCore from "./core";
import runSkillViewer from "./skill-viewer/skill-viewer";
import { setLoadingProgress, showLoadingError, loadingTexts } from "./loading-progress";

const params = new URLSearchParams(location.search);
let isStarting = true;

async function start(): Promise<void> {
    if (params.has("clearCache")) {
        setLoadingProgress(null, loadingTexts.clearCache(), true, false);
        const root = await navigator.storage.getDirectory();
        for await (const name of root.keys()) await root.removeEntry(name, { recursive: true });

        const url = new URL(location.href);
        url.searchParams.delete("clearCache");
        history.replaceState(history.state, "", url);
    }

    if (params.has("skillViewer")) await runSkillViewer(params.get("skillViewer") === "player");
    else await startCore();

    isStarting = false;
}

function onLoadingError(error: any) {
    if (isStarting || !document.querySelector<HTMLElement>(".loading-progress").hidden) showLoadingError(error);
}

window.addEventListener("error", event => onLoadingError(event.error ?? event.message));
window.addEventListener("unhandledrejection", event => onLoadingError(event.reason));

void start();
