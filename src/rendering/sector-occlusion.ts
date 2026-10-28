import { Box3, BoxGeometry, DoubleSide, Frustum, Matrix4, Mesh, MeshBasicMaterial, Object3D, Scene, WebGLRenderer } from "three";
import MeshBounds from "./mesh-bounds";
import { SectorObject } from "../objects/zone-object";

type Sector_T = { sector: SectorObject, bounds: Box3, objects: Object3D[], proxy: Mesh, query: WebGLQuery, hidden: boolean };
type Occluder_T = { object: THREE.Mesh, geometry: THREE.BufferGeometry, material: THREE.Material, matrix: Matrix4, position: any, positionVersion: number, index: any, indexVersion: number, group: any, groupIndex: number, start: number, count: number, materialIndex: number, version: number, side: number, depthFunc: number, layers: number, drawStart: number, drawCount: number };
const tmpBox = new Box3(), tmpMatrix = new Matrix4();

function version(attribute: any): number { return attribute ? (attribute.isInterleavedBufferAttribute ? attribute.data : attribute).version : -1; }

function isStaticMesh(object: any): boolean {
    if (!object.isMesh || !object.geometry.attributes.position || object.actorRenderable || object.isSkinnedMesh || object.morphTargetInfluences) return false;
    if ((object.isInstancedMesh || object.geometry.isInstancedBufferGeometry) && !object.isTerrainDecoration) return false;
    for (let parent = object; parent && !parent.isSectorObject; parent = parent.parent)
        if (parent.isMovableObject || parent.isRotatingObject || parent.isVehicleMesh || parent.isAgitStaticMeshActor || parent.particlePool) return false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    return materials.length > 0 && materials.every(material => material && (material.isStaticMeshMaterial || material.isTerrainMaterial));
}

export class SectorOcclusion {
    public enabled = true;
    public rejected = 0;
    protected readonly gl: WebGL2RenderingContext;
    protected readonly scene = new Scene();
    protected readonly geometry = new BoxGeometry(1, 1, 1);
    protected readonly material = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide });
    protected readonly sectors = new Map<SectorObject, Sector_T>();
    protected readonly owners = new WeakMap<Object3D, SectorObject>();
    protected readonly hiddenObjects: Object3D[] = [];
    protected readonly hiddenLayers: number[] = [];
    protected readonly opaque: any[] = [];
    protected readonly occluders: Occluder_T[] = [];
    protected occluderCount = 0;
    protected readonly view = new Matrix4();
    protected readonly projection = new Matrix4();
    protected readonly frustum = new Frustum();
    protected camera: THREE.Camera = null;
    protected activeSector: SectorObject = null;
    protected lastItem: any = null;
    protected active = false;
    protected issueQueries = false;
    protected width = 0;
    protected height = 0;
    protected samples = 0;
    protected layers = 0;
    protected readonly contextRestored = () => { for (const record of this.sectors.values()) record.query = null; this.invalidate(); };

    public constructor(protected readonly renderer: WebGLRenderer, protected readonly bounds: MeshBounds) {
        this.gl = renderer.getContext();
        renderer.domElement.addEventListener("webglcontextrestored", this.contextRestored);
    }

    public invalidate(): void {
        this.occluderCount = 0;
        for (const record of this.sectors.values()) {
            if (record.query) this.gl.deleteQuery(record.query);
            record.query = null;
            record.hidden = false;
        }
    }

    public remove(sector: SectorObject): void {
        this.invalidate();
        this.occluders.length = 0;
        const record = this.sectors.get(sector);
        if (!record) return;
        record.proxy.removeFromParent();
        this.sectors.delete(sector);
    }

    public add(sector: SectorObject): void {
        this.remove(sector);
        const record: Sector_T = { sector, bounds: new Box3(), objects: [], proxy: new Mesh(this.geometry, this.material), query: null, hidden: false };
        sector.traverse(object => {
            if (!isStaticMesh(object) || !object.layers.isEnabled(0)) return;
            if (!this.bounds.getBounds({ object, geometry: (object as THREE.Mesh).geometry }, tmpBox, true)) return;
            this.owners.set(object, sector);
            record.bounds.union(tmpBox);
            record.objects.push(object);
        });
        if (record.bounds.isEmpty()) return;
        record.bounds.expandByScalar(1);
        record.bounds.getCenter(record.proxy.position);
        record.bounds.getSize(record.proxy.scale);
        record.proxy.updateMatrixWorld(true);
        record.proxy.frustumCulled = false;
        record.proxy.onBeforeRender = () => {
            record.query = this.gl.createQuery();
            this.gl.beginQuery(this.gl.ANY_SAMPLES_PASSED_CONSERVATIVE, record.query);
        };
        record.proxy.onAfterRender = () => this.gl.endQuery(this.gl.ANY_SAMPLES_PASSED_CONSERVATIVE);
        this.scene.add(record.proxy);
        this.sectors.set(sector, record);
    }

    protected isOccluder(item: any): boolean {
        const object = item.object, material = item.material;
        return this.owners.get(object) === this.activeSector && !object.isTerrainDecoration && this.bounds.isStatic(item.geometry) && material.visible && !material.transparent && material.depthTest && material.depthWrite && material.alphaTest === 0 && !material.alphaHash && !material.alphaToCoverage && !(material.defines && "USE_ALPHATEST" in material.defines) && !material.isSectorFallbackMaterial;
    }

    protected validOccluders(): boolean {
        for (let i = 0; i < this.occluderCount; i++) {
            const state = this.occluders[i], object = state.object, geometry = object.geometry;
            for (let parent: Object3D = object; parent; parent = parent.parent) if (!parent.visible) return false;
            if (geometry !== state.geometry || !object.matrixWorld.equals(state.matrix) || !this.isOccluder(state) || state.material.version !== state.version) return false;
            if (object.layers.mask !== state.layers || state.material.side !== state.side || state.material.depthFunc !== state.depthFunc) return false;
            if (geometry.attributes.position !== state.position || version(state.position) !== state.positionVersion || geometry.index !== state.index || version(state.index) !== state.indexVersion) return false;
            if (geometry.drawRange.start !== state.drawStart || geometry.drawRange.count !== state.drawCount) return false;
            if (state.group && (geometry.groups[state.groupIndex] !== state.group || state.group.start !== state.start || state.group.count !== state.count || state.group.materialIndex !== state.materialIndex)) return false;
            if (Array.isArray(object.material) ? object.material[state.materialIndex] !== state.material : object.material !== state.material) return false;
        }
        return true;
    }

    public begin(camera: THREE.Camera, cullingCamera: THREE.Camera, sector: SectorObject): void {
        this.rejected = 0;
        this.active = this.enabled && !!sector && !this.renderer.getContext().isContextLost() && this.renderer.clippingPlanes.length === 0;
        if (!this.active) { this.invalidate(); return; }
        const target = this.renderer.getRenderTarget();
        const width = target ? target.width : this.gl.drawingBufferWidth, height = target ? target.height : this.gl.drawingBufferHeight, samples = target ? target.samples : 0;
        if (this.activeSector !== sector || !this.view.equals(cullingCamera.matrixWorldInverse) || !this.projection.equals(cullingCamera.projectionMatrix) || this.layers !== cullingCamera.layers.mask || this.width !== width || this.height !== height || this.samples !== samples || !this.validOccluders()) this.invalidate();
        this.activeSector = sector;
        this.view.copy(cullingCamera.matrixWorldInverse);
        this.projection.copy(cullingCamera.projectionMatrix);
        this.layers = cullingCamera.layers.mask;
        this.width = width; this.height = height; this.samples = samples;
        this.camera = camera;
        this.issueQueries = camera.matrixWorldInverse.equals(this.view) && camera.projectionMatrix.equals(this.projection);
        this.frustum.setFromProjectionMatrix(tmpMatrix.multiplyMatrices(this.projection, this.view));

        for (const record of this.sectors.values()) {
            record.proxy.visible = false;
            if (record.query && this.gl.getQueryParameter(record.query, this.gl.QUERY_RESULT_AVAILABLE)) {
                record.hidden = !this.gl.getQueryParameter(record.query, this.gl.QUERY_RESULT);
                this.gl.deleteQuery(record.query);
                record.query = null;
            }
            if (record.sector === sector || !record.sector.visible || !this.frustum.intersectsBox(record.bounds)) continue;
            if (record.bounds.containsPoint(cullingCamera.position) || record.bounds.intersectsPlane(this.frustum.planes[5])) continue;
            record.proxy.visible = this.issueQueries && !record.query;
            if (!record.hidden) continue;
            this.rejected++;
            for (const object of record.objects) if (object.visible) {
                this.hiddenObjects.push(object);
                this.hiddenLayers.push(object.layers.mask);
                object.layers.mask = 0;
            }
        }
    }

    public sort(items: any[]): void {
        if (!this.active || !this.issueQueries) return;
        this.opaque.length = 0;
        let count = 0;
        for (const item of items) {
            if (this.isOccluder(item)) items[count++] = item;
            else this.opaque.push(item);
        }
        this.lastItem = count ? items[count - 1] : null;
        for (const item of this.opaque) items[count++] = item;
    }

    public afterRender(camera: THREE.Camera, scene: Scene, geometry: THREE.BufferGeometry, material: THREE.Material, object: Object3D, group: any): void {
        const last = this.lastItem;
        if (!last || camera !== this.camera || object !== last.object || material !== last.material || group !== last.group || scene === this.scene) return;
        this.lastItem = null;
        const items = this.renderer.renderLists.get(scene, 0).opaque;
        this.occluderCount = 0;
        for (const item of items) {
            if (!this.isOccluder(item)) break;
            const index = this.occluderCount++, geometry = item.geometry, group = item.group;
            const state = this.occluders[index] || (this.occluders[index] = { matrix: new Matrix4() } as Occluder_T);
            state.object = item.object; state.geometry = geometry; state.material = item.material;
            state.matrix.copy(item.object.matrixWorld);
            state.position = geometry.attributes.position; state.positionVersion = version(state.position);
            state.index = geometry.index; state.indexVersion = version(state.index);
            state.group = group; state.groupIndex = group ? geometry.groups.indexOf(group) : -1;
            state.start = group ? group.start : 0; state.count = group ? group.count : 0; state.materialIndex = group ? group.materialIndex : 0;
            state.version = item.material.version; state.drawStart = geometry.drawRange.start; state.drawCount = geometry.drawRange.count;
            state.side = item.material.side; state.depthFunc = item.material.depthFunc; state.layers = item.object.layers.mask;
        }
        this.renderer.render(this.scene, camera);
    }

    public end(): void {
        for (let i = 0; i < this.hiddenObjects.length; i++) this.hiddenObjects[i].layers.mask = this.hiddenLayers[i];
        this.hiddenObjects.length = this.hiddenLayers.length = 0;
        this.lastItem = null;
        this.active = false;
    }

    public dispose(): void {
        this.end();
        this.invalidate();
        this.renderer.domElement.removeEventListener("webglcontextrestored", this.contextRestored);
        this.sectors.clear();
        this.scene.clear();
        this.occluders.length = this.opaque.length = 0;
        this.geometry.dispose();
        this.material.dispose();
    }
}

export default SectorOcclusion;
