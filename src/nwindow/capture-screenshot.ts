type SnapshotTile_T = { copy: HTMLElement, url: string, size: number[], position: number[], height: number };

export async function captureScreenshot(world: HTMLCanvasElement, overlay: HTMLCanvasElement, root: HTMLElement): Promise<ImageData> {
    const ratio = window.devicePixelRatio || 1, width = window.innerWidth, height = window.innerHeight, canvas = document.createElement("canvas");
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d", { willReadFrequently: true }), arrTiles: SnapshotTile_T[] = [], animations = new Map<Element, Set<string>>();
    const pattern = /url\(["']?(blob:[^"')]+)["']?\)/g;

    function draw(source: HTMLCanvasElement) {
        const style = getComputedStyle(source);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = source.getBoundingClientRect();
        context.globalAlpha = parseFloat(style.opacity);
        context.drawImage(source, rect.left * ratio, rect.top * ratio, rect.width * ratio, rect.height * ratio);
        context.globalAlpha = 1;
    }
    function encode(image: HTMLImageElement, y: number, height: number): string {
        const crop = document.createElement("canvas");
        crop.width = image.width;
        crop.height = height;
        try {
            crop.getContext("2d").drawImage(image, 0, y, image.width, height, 0, 0, image.width, height);
            const data = crop.toDataURL();
            if (!data.startsWith("data:image/png")) throw new Error(`Screenshot image encoding failed`);
            return data;
        } finally { crop.width = crop.height = 0; }
    }
    function cloneVisible(source: Node): Node {
        const element = source.nodeType === Node.ELEMENT_NODE ? source as HTMLElement : null, style = element ? getComputedStyle(element) : null;
        if (style && style.display === "none") return null;
        const copy = source instanceof HTMLCanvasElement ? document.createElement("img") : source.cloneNode(false);
        if (source instanceof HTMLCanvasElement) {
            for (const attr of source.attributes) (copy as HTMLElement).setAttribute(attr.name, attr.value);
            (copy as HTMLImageElement).src = source.toDataURL();
        }
        if (element) {
            const target = copy as HTMLElement, properties = animations.get(element);
            if (properties) {
                for (const name of properties) target.style.setProperty(name, style.getPropertyValue(name), "important");
                target.style.setProperty("animation", "none", "important");
                target.style.setProperty("transition", "none", "important");
            }
            if (element.matches(":focus-visible")) {
                target.style.outline = style.outline;
                target.style.outlineOffset = style.outlineOffset;
            }
            const matches = [...element.style.backgroundImage.matchAll(pattern)];
            if (matches.length) {
                const bounds = element.getBoundingClientRect();
                if (bounds.width === 0 || bounds.height === 0) target.style.backgroundImage = "none";
                else arrTiles.push({ copy: target, url: matches[0][1], size: style.backgroundSize.split(" ").map(parseFloat), position: style.backgroundPosition.split(" ").map(parseFloat), height: parseFloat(style.height) });
            }
        }
        for (const child of source.childNodes) {
            const visible = cloneVisible(child);
            if (visible) copy.appendChild(visible);
        }
        return copy;
    }

    try {
        // Read the world and UI before yielding; WebGL need not preserve its drawing buffer.
        draw(world);
        draw(overlay);
        for (const animation of root.getAnimations({ subtree: true })) {
            const effect = animation.effect as KeyframeEffect, target = effect.target;
            if (!animations.has(target)) animations.set(target, new Set());
            for (const frame of effect.getKeyframes()) for (const key of Object.keys(frame)) {
                if (["offset", "computedOffset", "easing", "composite"].includes(key)) continue;
                animations.get(target).add(key.replace(/[A-Z]/g, value => `-${value.toLowerCase()}`));
            }
        }
        const clone = cloneVisible(root) as HTMLElement;
        if (!clone) return context.getImageData(0, 0, canvas.width, canvas.height);
        const css = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).join("\n");
        const arrTexts = [css, ...[clone, ...clone.querySelectorAll("[style]")].map(element => element.getAttribute("style") || "")];
        const arrUrls = [...new Set(arrTexts.flatMap(text => [...text.matchAll(pattern)].map(match => match[1])))];
        const images = new Map<string, HTMLImageElement>(), urls = new Map<string, { name: string, data: string }>(), crops = new Map<string, { name: string, data: string }>();
        for (const url of arrUrls) {
            const image = new Image();
            image.src = url;
            await image.decode();
            images.set(url, image);
            if (image.width * image.height <= 4000000) urls.set(url, { name: `--screenshot-image-${urls.size}`, data: encode(image, 0, image.height) });
        }
        for (const tile of arrTiles) {
            const image = images.get(tile.url);
            if (image.width * image.height <= 4000000) continue;
            const scale = tile.size[1] / image.height, top = -tile.position[1] / scale;
            if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Unsupported screenshot atlas sizing`);
            const offset = Math.max(0, Math.floor(top / 1024) * 1024 - 1), height = Math.min(image.height - offset, Math.max(2048, Math.ceil(top + tile.height / scale) - offset + 1)), key = `${tile.url}:${offset}:${height}`;
            if (!crops.has(key)) crops.set(key, { name: `--screenshot-crop-${crops.size}`, data: encode(image, offset, height) });
            tile.copy.style.backgroundImage = `var(${crops.get(key).name})`;
            tile.copy.style.backgroundSize = `${tile.size[0]}px ${height * scale}px`;
            tile.copy.style.backgroundPosition = `${tile.position[0]}px ${tile.position[1] + offset * scale}px`;
        }
        function inline(text: string): string {
            return text.replace(pattern, (_match, url) => {
                const value = urls.get(url);
                if (!value) throw new Error(`Uncropped screenshot atlas`);
                return `var(${value.name})`;
            });
        }
        for (const element of [clone, ...clone.querySelectorAll("[style]")]) if (element.hasAttribute("style")) element.setAttribute("style", inline(element.getAttribute("style")));
        for (const value of [...urls.values(), ...crops.values()]) clone.style.setProperty(value.name, `url("${value.data}")`);
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"), foreign = document.createElementNS(svg.namespaceURI, "foreignObject"), container = document.createElement("div"), style = document.createElement("style");
        svg.setAttribute("width", String(canvas.width));
        svg.setAttribute("height", String(canvas.height));
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        foreign.setAttribute("width", String(width));
        foreign.setAttribute("height", String(height));
        style.textContent = inline(css);
        container.append(style, clone);
        foreign.append(container);
        svg.append(foreign);
        const image = new Image();
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
        await image.decode();
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height);
    } finally { canvas.width = canvas.height = 0; }
}

export default captureScreenshot;
