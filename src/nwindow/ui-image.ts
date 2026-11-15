let bitmapSupported = false;
let bitmapProbe: Promise<void> = null;

// Start with PNG so synchronous texture/tint requests are safe before the probe.
export function getCanvasImageUrl(canvas: HTMLCanvasElement): string {
    return bitmapSupported ? URL.createObjectURL(encodeBitmap(canvas)) : canvas.toDataURL("image/png");
}

export function prepareCanvasImageUrls(): Promise<void> {
    return bitmapProbe ??= probeBitmap().then(supported => { bitmapSupported = supported; });
}

function probeBitmap(): Promise<boolean> {
    return new Promise(resolve => {
        const canvas = document.createElement("canvas"), image = new Image();
        let url: string = null, timer: number = null, finished = false;
        const finish = (supported: boolean) => {
            if (finished) return;
            finished = true;
            if (timer !== null) clearTimeout(timer);
            image.onload = image.onerror = null;
            image.removeAttribute("src");
            if (url) URL.revokeObjectURL(url);
            resolve(supported);
        };
        try {
            canvas.width = canvas.height = 2;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            const expected = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 0, 0, 17, 34, 51, 255]);
            context.putImageData(new ImageData(expected, 2, 2), 0, 0);
            url = URL.createObjectURL(encodeBitmap(canvas));
            image.onload = () => {
                try {
                    if (image.naturalWidth !== 2 || image.naturalHeight !== 2) return finish(false);
                    context.clearRect(0, 0, 2, 2);
                    context.drawImage(image, 0, 0);
                    const actual = context.getImageData(0, 0, 2, 2).data;
                    finish(actual.every((value, index) => Math.abs(value - expected[index]) <= 1));
                } catch { finish(false); }
            };
            image.onerror = () => finish(false);
            timer = window.setTimeout(() => finish(false), 1000);
            image.src = url;
        } catch { finish(false); }
    });
}

function encodeBitmap(canvas: HTMLCanvasElement): Blob { // 32bpp BITMAPV4 with RGBA bitfields: raw canvas bytes, no PNG compression pass.
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const header = new DataView(new ArrayBuffer(122));

    header.setUint16(0, 0x4d42, true);
    header.setUint32(2, 122 + pixels.byteLength, true);
    header.setUint32(10, 122, true);
    header.setUint32(14, 108, true);
    header.setInt32(18, canvas.width, true);
    header.setInt32(22, -canvas.height, true);
    header.setUint16(26, 1, true);
    header.setUint16(28, 32, true);
    header.setUint32(30, 3, true);
    header.setUint32(34, pixels.byteLength, true);
    header.setUint32(54, 0x000000ff, true);
    header.setUint32(58, 0x0000ff00, true);
    header.setUint32(62, 0x00ff0000, true);
    header.setUint32(66, 0xff000000, true);
    header.setUint32(70, 0x73524742, true);

    return new Blob([header.buffer, pixels], { type: "image/bmp" });
}
