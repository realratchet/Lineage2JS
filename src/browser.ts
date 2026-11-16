export const isFirefox = /Firefox\//.test(navigator.userAgent);

export let supportsBitmap = false;

export async function initializeBrowserCapabilities(): Promise<void> {
    supportsBitmap = await probeBitmap();
}

async function probeBitmap(): Promise<boolean> {
    const image = new Image();

    // The same top-down, RGBA-bitfield BITMAPV4 format used by NDomLayer.
    const loaded = await new Promise<boolean>(resolve => {
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = "data:image/bmp;base64,Qk2KAAAAAAAAAHoAAABsAAAAAgAAAP7///8BACAAAwAAABAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAAD/AAAAAP8AAAAA/0JHUnMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAD/AP8AgAAAAAARIjP/";
    });
    if (!loaded) return false;

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const actual = context.getImageData(0, 0, 2, 2).data;
    const expected = [255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 0, 0, 17, 34, 51, 255];

    return actual.every((value, index) => Math.abs(value - expected[index]) <= 1);
}
