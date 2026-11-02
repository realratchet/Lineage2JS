export function setLoadingProgress(value: number | null, text: string, cover = false) {
    const element = document.querySelector<HTMLElement>(".loading-progress");
    const progress = element.querySelector("progress");

    element.hidden = false;
    element.classList.toggle("loading-cover", cover);
    if (value === null) progress.removeAttribute("value");
    else progress.value = value;
    element.querySelector("p").textContent = text;
}

export function hideLoadingProgress() { document.querySelector<HTMLElement>(".loading-progress").hidden = true; }
