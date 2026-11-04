import { getLoadingDetail } from "./loading-profile";

let timer = 0, startTime = 0, loadingText = "";

function updateLoadingText() {
    const seconds = Math.floor((performance.now() - startTime) / 1000);
    const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

    const detail = timer ? getLoadingDetail() : "";

    document.querySelector(".loading-progress p").textContent = timer ? `${detail || loadingText} · ${elapsed} elapsed` : loadingText;
}

export function setLoadingProgress(value: number | null, text: string, cover = false, timed = true) {
    const element = document.querySelector<HTMLElement>(".loading-progress");
    const progress = element.querySelector("progress");

    element.hidden = false;
    element.classList.toggle("loading-cover", cover);
    if (value === null) progress.removeAttribute("value");
    else progress.value = value;

    loadingText = value === null ? text : `${text} · ${Math.round(value * 100)}%`;
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
}
