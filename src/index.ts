import "../style/style.scss";
import startCore from "./core";
import runSkillViewer from "./skill-viewer/skill-viewer";
import { setLoadingProgress } from "./loading-progress";

const params = new URLSearchParams(location.search);

async function start(): Promise<void> {
    if (params.has("clearCache")) {
        setLoadingProgress(null, "Clearing cached game files", true, false);
        const root = await navigator.storage.getDirectory();
        for await (const name of root.keys()) await root.removeEntry(name, { recursive: true });

        const url = new URL(location.href);
        url.searchParams.delete("clearCache");
        history.replaceState(history.state, "", url);
    }

    if (params.has("skillViewer")) await runSkillViewer(params.get("skillViewer") === "player");
    else await startCore();
}

void start();
