import { Box3, BufferGeometry, Frustum, Matrix4, Object3D, PerspectiveCamera, Sprite, Vector2, Vector3 } from "three";

const tmpPoint = new Vector3();
const tmpProjection = new Matrix4();

type DepthGroup_T = { start: number; count: number; materialIndex: number };
type DepthBounds_T = { box: Box3; frame: number; visible: boolean };
type DepthBatch_T = { bounds: Map<number, DepthBounds_T>; groups: DepthGroup_T[]; pool: DepthGroup_T[]; geometry: BufferGeometry; original: DepthGroup_T[] };

export class NameplateDepthCulling {
    protected readonly frustum = new Frustum();
    protected readonly cacheBatches = new WeakMap<Object3D, DepthBatch_T>();
    protected readonly arrBatches: DepthBatch_T[] = [];
    protected readonly arrHidden: Object3D[] = [];
    protected frame = 0;

    public cull(scene: Object3D, camera: PerspectiveCamera, names: Object3D[], size: Vector2) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const object of names) {
            const sprite = object as Sprite, elements = sprite.matrixWorld.elements, material = sprite.material;
            tmpPoint.set(elements[12], elements[13], elements[14]).applyMatrix4(camera.matrixWorldInverse);
            const x = tmpPoint.x, y = tmpPoint.y, z = tmpPoint.z;
            if (z >= 0) continue;

            const factor = material.sizeAttenuation ? 1 : -z;
            const scaleX = Math.hypot(elements[0], elements[1], elements[2]) * factor, scaleY = Math.hypot(elements[4], elements[5], elements[6]) * factor;
            const cos = Math.cos(material.rotation), sin = Math.sin(material.rotation);
            for (let i = 0; i < 4; i++) {
                const dx = ((i & 1) - sprite.center.x) * scaleX, dy = ((i >> 1) - sprite.center.y) * scaleY;
                tmpPoint.set(x + cos * dx - sin * dy, y + sin * dx + cos * dy, z).applyMatrix4(camera.projectionMatrix);
                minX = Math.min(minX, tmpPoint.x);
                maxX = Math.max(maxX, tmpPoint.x);
                minY = Math.min(minY, tmpPoint.y);
                maxY = Math.max(maxY, tmpPoint.y);
            }
        }
        minX = Math.max(-1, minX - 4 / size.x);
        maxX = Math.min(1, maxX + 4 / size.x);
        minY = Math.max(-1, minY - 4 / size.y);
        maxY = Math.min(1, maxY + 4 / size.y);
        if (minX >= maxX || minY >= maxY) return;

        tmpProjection.copy(camera.projectionMatrix);
        const elements = tmpProjection.elements, halfX = (maxX - minX) / 2, halfY = (maxY - minY) / 2, centerX = (maxX + minX) / 2, centerY = (maxY + minY) / 2;
        for (let i = 0; i < 16; i += 4) {
            elements[i] = (elements[i] - centerX * elements[i + 3]) / halfX;
            elements[i + 1] = (elements[i + 1] - centerY * elements[i + 3]) / halfY;
        }
        this.frustum.setFromProjectionMatrix(tmpProjection.multiply(camera.matrixWorldInverse));
        this.frame++;
        scene.traverseVisible(object => {
            const mesh = object as any;
            if (mesh.isBatch && mesh.batchIndices && mesh.visibleBatchGroups) this.cullBatch(mesh);
            if (!mesh.isMesh || !mesh.frustumCulled || mesh.children.length || this.frustum.intersectsObject(mesh)) return;

            object.visible = false;
            this.arrHidden.push(object);
        });
    }

    protected cullBatch(object: any) {
        let batch = this.cacheBatches.get(object);
        if (!batch) {
            const bounds = new Map<number, DepthBounds_T>();
            for (const element of object.batchElements) {
                const value = { box: new Box3(), frame: -1, visible: false };
                value.box.min.fromArray(element.boundsMin);
                value.box.max.fromArray(element.boundsMax);
                for (const group of element.groups) bounds.set(group.start, value);
            }
            batch = { bounds, groups: [], pool: [], geometry: object.geometry, original: null };
            this.cacheBatches.set(object, batch);
        }
        let offset = 0, count = 0;
        for (const group of object.visibleBatchGroups) {
            const bounds = batch.bounds.get(group.start);
            if (!bounds) throw new Error(`Batch '${object.name}' has no bounds for group ${group.start}.`);

            if (bounds.frame !== this.frame) {
                bounds.frame = this.frame;
                bounds.visible = this.frustum.intersectsBox(bounds.box);
            }
            if (bounds.visible) {
                const last = count ? batch.groups[count - 1] : null;
                if (last && last.materialIndex === group.materialIndex && last.start + last.count === offset) last.count += group.count;
                else {
                    let entry = batch.pool[count];
                    if (!entry) entry = batch.pool[count] = { start: 0, count: 0, materialIndex: 0 };
                    entry.start = offset;
                    entry.count = group.count;
                    entry.materialIndex = group.materialIndex;
                    batch.groups[count++] = entry;
                }
            }
            offset += group.count;
        }
        batch.groups.length = count;
        batch.original = batch.geometry.groups;
        this.arrBatches.push(batch);
        batch.geometry.groups = batch.groups;
    }

    public restore() {
        this.arrHidden.forEach(object => object.visible = true);
        this.arrBatches.forEach(batch => {
            batch.geometry.groups = batch.original;
            batch.original = null;
        });
        this.arrHidden.length = this.arrBatches.length = 0;
    }
}

export default NameplateDepthCulling;
