export const isFirefox = /Firefox\//.test(navigator.userAgent);

export let supportsBitmap = false;
let capabilities: Promise<void> = null;

export function initializeBrowserCapabilities(): Promise<void> {
    return capabilities ??= probeBitmap().then(supported => { supportsBitmap = supported; });
}

async function probeBitmap(): Promise<boolean> {
    const image = new Image();

    // The same top-down, RGBA-bitfield BITMAPV4 format used by NDomLayer.
    image.src = "data:image/bmp;base64,Qk2KAAAAAAAAAHoAAABsAAAAAgAAAP7///8BACAAAwAAABAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAAD/AAAAAP8AAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAD/AP8AgAAAAAARIjP/";
    try {
        await image.decode();
        if (image.naturalWidth !== 2 || image.naturalHeight !== 2) return false;

        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 2;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const actual = context.getImageData(0, 0, 2, 2).data;
        const expected = [255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 0, 0, 17, 34, 51, 255];

        return actual.every((value, index) => Math.abs(value - expected[index]) <= 1);
    } catch {
        return false;
    } finally {
        image.removeAttribute("src");
    }
}
