import { Color, Fog, Frustum, LinearFilter, PerspectiveCamera, Scene, Vector3, Vector4, WebGLRenderer, WebGLRenderTarget } from "three";
import GLOBAL_UNIFORMS from "../materials/global-uniforms";

type ViewObjectState_T = { object: any, visible: boolean, renderOrder: number, groups: any[], index: any, indexData: any, values: Record<string, any>, buffers: Record<string, any>, vectors: Record<string, Vector3> };
type ViewMaterialState_T = { material: THREE.Material, visible: boolean };

const arrSectorProperties = ["lastZoneMask", "visibleLeaves", "visibleEmitterUuids", "visibilityCacheInitialized", "visibilityCacheFrustumCulling", "visibilityCacheTopLevelOnly", "visibilityCacheDistanceSq", "visibilityCacheEmitterDistanceSq", "visibilityCacheEnvVersion", "visibilityCacheTimeStep", "lastLoggedZone", "lastLoggedLeaf", "lastLoggedStaticMeshLeaf"];
const arrBatchProperties = ["visibleGroupKey", "needsRelightPass"];
const arrBatchBuffers = ["elemVisibility", "elemDistances", "elemRelight"];

function saveBuffer(state: ViewObjectState_T, name: string, source: any) {
    state.values[name] = source;
    if (!source) return;

    let buffer = state.buffers[name];
    if (!buffer || buffer.length !== source.length) buffer = state.buffers[name] = new source.constructor(source.length);
    buffer.set(source);
}

function saveVector(state: ViewObjectState_T, name: string, source: Vector3) {
    state.values[name] = source;
    if (!source) return;

    let vector = state.vectors[name];
    if (!vector) vector = state.vectors[name] = new Vector3();
    vector.copy(source);
}

export class ViewportWindow {
    public readonly camera = new PerspectiveCamera(60, 1, 10, 65536);
    public readonly target = new WebGLRenderTarget(256, 256, { minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: true, stencilBuffer: true });
    public readonly frustum = new Frustum();
    protected cacheObjects = new WeakMap<THREE.Object3D, ViewObjectState_T>();
    protected readonly arrObjects: ViewObjectState_T[] = [];
    protected readonly arrMaterials: ViewMaterialState_T[] = [];
    protected cacheMaterials = new WeakMap<THREE.Material, ViewMaterialState_T>();
    protected readonly savedViewport = new Vector4();
    protected readonly savedScissor = new Vector4();
    protected readonly savedClearColor = new Color();
    protected readonly savedFogColor = new Color();
    protected readonly savedUniformFogColor = new Color();
    protected savedUniformFogNear = 0;
    protected savedUniformFogFar = 0;
    protected readonly savedBillboardRight = new Vector3();
    protected readonly savedBillboardUp = new Vector3();
    protected savedTarget: WebGLRenderTarget;
    protected savedCubeFace = 0;
    protected savedMipmapLevel = 0;
    protected savedScissorTest = false;
    protected savedClearAlpha = 1;
    protected savedAutoClear = false;
    protected savedFog: Scene["fog"];
    protected savedFogNear = 0;
    protected savedFogFar = 0;
    protected savedShadowActive = 0;
    protected materialCount = 0;

    public constructor(screenWidth: number) {
        if (!Number.isFinite(screenWidth) || screenWidth < 2) throw new Error(`Invalid viewport screen width ${screenWidth}`);

        // Engine.dll 10477D20: horizontal FOV for the 256-square camera target; the UI stretches it to 252x254.
        this.camera.fov = 2 * Math.atan(Math.tan(Math.PI / 6) * 126 / Math.trunc(screenWidth / 2)) * 180 / Math.PI;
        this.camera.updateProjectionMatrix();
        this.target.texture.name = "ViewportWindow.scene";
    }

    public capture(renderer: WebGLRenderer, scene: Scene) {
        this.savedTarget = renderer.getRenderTarget();
        this.savedCubeFace = renderer.getActiveCubeFace();
        this.savedMipmapLevel = renderer.getActiveMipmapLevel();
        renderer.getViewport(this.savedViewport);
        renderer.getScissor(this.savedScissor);
        this.savedScissorTest = renderer.getScissorTest();
        renderer.getClearColor(this.savedClearColor);
        this.savedClearAlpha = renderer.getClearAlpha();
        this.savedAutoClear = renderer.autoClear;
        this.savedFog = scene.fog;
        if (scene.fog) {
            this.savedFogColor.copy(scene.fog.color);
            this.savedFogNear = (scene.fog as Fog).near;
            this.savedFogFar = (scene.fog as Fog).far;
        }
        this.savedBillboardRight.copy(GLOBAL_UNIFORMS.cameraBillboardRight.value);
        this.savedBillboardUp.copy(GLOBAL_UNIFORMS.cameraBillboardUp.value);
        this.savedShadowActive = GLOBAL_UNIFORMS.shadowActive.value;
        this.savedUniformFogColor.copy(GLOBAL_UNIFORMS.fogColor.value);
        this.savedUniformFogNear = GLOBAL_UNIFORMS.fogNear.value;
        this.savedUniformFogFar = GLOBAL_UNIFORMS.fogFar.value;
        this.materialCount = 0;

        scene.traverse(object => {
            const node = object as any;
            let state = this.cacheObjects.get(object);
            if (!state) {
                state = { object, visible: false, renderOrder: 0, groups: null, index: null, indexData: null, values: {}, buffers: {}, vectors: {} };
                this.cacheObjects.set(object, state);
            }
            state.visible = object.visible;
            state.renderOrder = object.renderOrder;
            state.groups = node.geometry ? node.geometry.groups : null;
            state.index = node.isBatch && node.geometry ? node.geometry.index : null;
            if (state.index) {
                const source = state.index.array;
                if (!state.indexData || state.indexData.length !== source.length) state.indexData = new source.constructor(source.length);
                state.indexData.set(source);
            }
            if (node.isSectorObject) {
                for (const name of arrSectorProperties) state.values[name] = node[name];
                saveBuffer(state, "visibilityCachePlanes", node.visibilityCachePlanes);
                saveVector(state, "visibilityCachePosition", node.visibilityCachePosition);
            }
            if (node.isBatch || node.isTerrainBatch) {
                for (const name of arrBatchProperties) state.values[name] = node[name];
                for (const name of arrBatchBuffers) saveBuffer(state, name, node[name]);
                saveVector(state, "transparentSortPosition", node.transparentSortPosition);
            }
            this.arrObjects.push(state);

            const materials = node.material;
            if (Array.isArray(materials)) materials.forEach(material => this.captureMaterial(material));
            else if (materials) this.captureMaterial(materials);
        });
    }

    protected captureMaterial(material: THREE.Material) {
        let state = this.cacheMaterials.get(material);
        if (!state) {
            state = { material, visible: false };
            this.cacheMaterials.set(material, state);
        }
        state.visible = material.visible;
        this.arrMaterials[this.materialCount++] = state;
    }

    public restore(renderer: WebGLRenderer, scene: Scene) {
        for (const state of this.arrObjects) {
            const object = state.object;
            object.visible = state.visible;
            object.renderOrder = state.renderOrder;
            if (state.groups) object.geometry.groups = state.groups;
            if (state.index) {
                state.index.array.set(state.indexData);
                state.index.clearUpdateRanges();
                state.index.needsUpdate = true;
            }
            for (const name in state.values) object[name] = state.values[name];
            for (const name in state.buffers)
                if (object[name]) object[name].set(state.buffers[name]);
            for (const name in state.vectors)
                if (object[name]) object[name].copy(state.vectors[name]);
        }
        for (let i = 0; i < this.materialCount; i++) {
            const state = this.arrMaterials[i];
            state.material.visible = state.visible;
        }
        this.arrObjects.length = this.arrMaterials.length = 0;
        scene.fog = this.savedFog;
        if (scene.fog) {
            scene.fog.color.copy(this.savedFogColor);
            (scene.fog as Fog).near = this.savedFogNear;
            (scene.fog as Fog).far = this.savedFogFar;
        }
        GLOBAL_UNIFORMS.cameraBillboardRight.value.copy(this.savedBillboardRight);
        GLOBAL_UNIFORMS.cameraBillboardUp.value.copy(this.savedBillboardUp);
        GLOBAL_UNIFORMS.shadowActive.value = this.savedShadowActive;
        GLOBAL_UNIFORMS.fogColor.value.copy(this.savedUniformFogColor);
        GLOBAL_UNIFORMS.fogNear.value = this.savedUniformFogNear;
        GLOBAL_UNIFORMS.fogFar.value = this.savedUniformFogFar;
        renderer.setViewport(this.savedViewport);
        renderer.setScissor(this.savedScissor);
        renderer.setScissorTest(this.savedScissorTest);
        renderer.setRenderTarget(this.savedTarget, this.savedCubeFace, this.savedMipmapLevel);
        renderer.setClearColor(this.savedClearColor, this.savedClearAlpha);
        renderer.autoClear = this.savedAutoClear;
    }

    public dispose() {
        this.target.dispose();
        this.cacheObjects = new WeakMap();
        this.cacheMaterials = new WeakMap();
        this.arrObjects.length = this.arrMaterials.length = 0;
    }
}

export default ViewportWindow;
