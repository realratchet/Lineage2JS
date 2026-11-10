import { WebGLRenderer, LinearFilter, NearestFilter, LinearMipmapLinearFilter, NearestMipmapNearestFilter } from "three";

const cacheTextureFilters = new WeakMap<THREE.Texture, [THREE.MinificationTextureFilter, THREE.MagnificationTextureFilter]>();
const cacheTextureReferences = new Set<WeakRef<THREE.Texture>>();
const textureFinalizer = new FinalizationRegistry<WeakRef<THREE.Texture>>(texture => cacheTextureReferences.delete(texture));
const cacheTextureLOD = new WeakMap<THREE.Texture, [number, number]>();
let textureRenderer: WebGLRenderer = null;
let textureDetail = 0;
let useTrilinear = true;

export function setUseTrilinear(enabled: boolean) {
    if (useTrilinear === enabled) return;

    useTrilinear = enabled;
    for (const reference of cacheTextureReferences) {
        const texture = reference.deref();
        if (texture) updateTextureFiltering(texture);
        else cacheTextureReferences.delete(reference);
    }
}

export function updateTextureFiltering(texture: THREE.Texture, minFilter: THREE.MinificationTextureFilter = null): void {
    if (texture.isRenderTargetTexture || (texture as any).isCanvasTexture) return;

    let filters = cacheTextureFilters.get(texture);
    if (!filters) {
        const originalMin = minFilter ?? texture.minFilter;
        if (texture.magFilter !== LinearFilter || originalMin !== LinearFilter && originalMin !== LinearMipmapLinearFilter) return;

        filters = [originalMin, texture.magFilter];
        cacheTextureFilters.set(texture, filters);
        const reference = new WeakRef(texture);

        cacheTextureReferences.add(reference);
        textureFinalizer.register(texture, reference);
    } else if (minFilter !== null) filters[0] = minFilter;

    const nextMin = useTrilinear ? filters[0] : filters[0] === LinearFilter ? NearestFilter : NearestMipmapNearestFilter;
    const magFilter = useTrilinear ? filters[1] : NearestFilter;
    if (texture.minFilter === nextMin && texture.magFilter === magFilter) return;

    texture.minFilter = nextMin;
    texture.magFilter = magFilter;
    texture.needsUpdate = true;
}

export function copyTextureFiltering(source: THREE.Texture, target: THREE.Texture): void {
    const filters = cacheTextureFilters.get(source);

    target.minFilter = filters ? filters[0] : source.minFilter;
    target.magFilter = filters ? filters[1] : source.magFilter;
    updateTextureFiltering(target);
}

export function setTextureDetail(renderer: WebGLRenderer, detail: number): void {
    if (textureRenderer === renderer && textureDetail === detail) return;

    textureRenderer = renderer;
    textureDetail = detail;
    for (const reference of cacheTextureReferences) {
        const texture = reference.deref();
        if (texture) updateTextureLOD(texture);
        else cacheTextureReferences.delete(reference);
    }
}

function updateTextureLOD(texture: THREE.Texture): void {
    const bounds = cacheTextureLOD.get(texture);
    if (!bounds || !textureRenderer) return;

    const object = textureRenderer.properties.get(texture).__webglTexture;
    if (!object) return;

    const gl = textureRenderer.getContext() as WebGL2RenderingContext;
    const target = (texture as any).isCubeTexture ? gl.TEXTURE_CUBE_MAP : (texture as any).isCompressedArrayTexture ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;
    const binding = target === gl.TEXTURE_CUBE_MAP ? gl.TEXTURE_BINDING_CUBE_MAP : target === gl.TEXTURE_2D_ARRAY ? gl.TEXTURE_BINDING_2D_ARRAY : gl.TEXTURE_BINDING_2D;
    const previous = gl.getParameter(binding);

    gl.bindTexture(target, object);
    gl.texParameteri(target, gl.TEXTURE_BASE_LEVEL, Math.max(bounds[0], Math.min(bounds[1], textureDetail)));
    gl.bindTexture(target, previous);
}

export function registerTextureLOD(texture: THREE.Texture, bounds: [number, number]): void {
    if (!Number.isInteger(bounds[0]) || !Number.isInteger(bounds[1]) || bounds[0] < 0 || bounds[1] < 0) throw new Error(`Invalid texture LOD bounds for '${texture.name}'.`);

    cacheTextureLOD.set(texture, bounds);
    const onUpdate = texture.onUpdate;

    texture.onUpdate = function () {
        if (onUpdate) onUpdate.call(this, texture);
        updateTextureLOD(texture);
    };
    updateTextureLOD(texture);
}

export function getTextureLODBounds(texture: THREE.Texture): [number, number] { return cacheTextureLOD.get(texture); }

export function copyTextureLOD(source: THREE.Texture, target: THREE.Texture): void {
    const bounds = cacheTextureLOD.get(source);
    if (bounds) registerTextureLOD(target, bounds);
}

