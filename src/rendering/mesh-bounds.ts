import { Box3, Matrix4, Sphere, Vector3 } from "three";
import ShadowProjector from "../objects/shadow-projector";

type Sway_T = { position: any, sway: any, positionVersion: number, swayVersion: number, margin: Vector3, bounds: Box3, bounded: boolean };
type Instances_T = { matrix: any, version: number, count: number, sway: Sway_T, bounds: Box3 };

const tmpInstanceBox = new Box3();
const tmpBox = new Box3();
const tmpInstanceMatrix = new Matrix4();
const tmpVertex = new Vector3();

function version(attribute: any): number { return attribute ? (attribute.isInterleavedBufferAttribute ? attribute.data : attribute).version : -1; }

export class MeshBounds {
    protected readonly cacheSway = new WeakMap<THREE.BufferGeometry, Sway_T>();
    protected readonly cacheInstances = new WeakMap<THREE.Object3D, Instances_T>();

    public constructor(protected readonly bounds: ShadowProjector) {}

    public isStatic(geometry: THREE.BufferGeometry): boolean {
        const sway = this.getSway(geometry);
        return sway.bounded && sway.margin.lengthSq() === 0;
    }

    protected getSway(geometry: THREE.BufferGeometry): Sway_T {
        const position = geometry.attributes.position, sway = geometry.attributes.sway, positionVersion = version(position), swayVersion = version(sway);
        let cached = this.cacheSway.get(geometry);
        if (cached && cached.position === position && cached.sway === sway && cached.positionVersion === positionVersion && cached.swayVersion === swayVersion) return cached;
        cached = { position, sway, positionVersion, swayVersion, margin: new Vector3(), bounds: new Box3(), bounded: true };
        let lastAngle = NaN, lastPhase = NaN, tangent = 0, x = 0, y = 0;
        for (let i = 0; i < position.count; i++) {
            tmpVertex.fromBufferAttribute(position, i);
            cached.bounds.expandByPoint(tmpVertex);
            if (!sway || sway.getY(i) <= 0) continue;
            const angle = sway.getZ(i), phase = sway.getW(i);
            if (angle === 0) continue;
            if (Math.abs(angle) >= 90) { cached.bounded = false; continue; }
            if (angle !== lastAngle) { tangent = Math.abs(Math.tan(angle * Math.PI / 180)); lastAngle = angle; }
            if (phase !== lastPhase) { x = Math.abs(Math.cos(phase)); y = Math.abs(Math.sin(phase)); lastPhase = phase; }
            const distance = tangent * Math.max(tmpVertex.z - sway.getX(i), 0);
            cached.margin.x = Math.max(cached.margin.x, x * distance);
            cached.margin.y = Math.max(cached.margin.y, y * distance);
        }
        this.cacheSway.set(geometry, cached);
        return cached;
    }

    public *prepare(root: THREE.Object3D): Generator<void, void, unknown> {
        const geometries = new Set<THREE.BufferGeometry>(), instanced: THREE.InstancedMesh[] = [];
        root.traverse(object => {
            const geometry = (object as THREE.Mesh).geometry;
            if (geometry?.attributes.position) geometries.add(geometry);
            if ((object as THREE.InstancedMesh).isInstancedMesh) instanced.push(object as THREE.InstancedMesh);
        });
        for (const geometry of geometries) {
            const position = geometry.attributes.position, sway = geometry.attributes.sway, positionVersion = version(position), swayVersion = version(sway);
            const existing = this.cacheSway.get(geometry);
            if (existing && existing.position === position && existing.sway === sway && existing.positionVersion === positionVersion && existing.swayVersion === swayVersion && (geometry.boundingSphere || geometry.morphAttributes.position?.length)) continue;
            const cached: Sway_T = { position, sway, positionVersion, swayVersion, margin: new Vector3(), bounds: new Box3(), bounded: true };
            let lastAngle = NaN, lastPhase = NaN, tangent = 0, x = 0, y = 0;
            for (let start = 0; start < position.count; start += 8192) {
                for (let i = start, end = Math.min(start + 8192, position.count); i < end; i++) {
                    tmpVertex.fromBufferAttribute(position, i);
                    cached.bounds.expandByPoint(tmpVertex);
                    if (!sway || sway.getY(i) <= 0) continue;
                    const angle = sway.getZ(i), phase = sway.getW(i);
                    if (angle === 0) continue;
                    if (Math.abs(angle) >= 90) { cached.bounded = false; continue; }
                    if (angle !== lastAngle) { tangent = Math.abs(Math.tan(angle * Math.PI / 180)); lastAngle = angle; }
                    if (phase !== lastPhase) { x = Math.abs(Math.cos(phase)); y = Math.abs(Math.sin(phase)); lastPhase = phase; }
                    const distance = tangent * Math.max(tmpVertex.z - sway.getX(i), 0);
                    cached.margin.x = Math.max(cached.margin.x, x * distance);
                    cached.margin.y = Math.max(cached.margin.y, y * distance);
                }
                yield;
            }
            this.cacheSway.set(geometry, cached);
            if (!geometry.boundingBox && !geometry.morphAttributes.position?.length && geometry.attributes.position === position && version(position) === positionVersion)
                geometry.boundingBox = cached.bounds.clone();
            if (!geometry.boundingSphere && !geometry.morphAttributes.position?.length && geometry.attributes.position === position && version(position) === positionVersion) {
                const sphere = new Sphere();
                cached.bounds.getCenter(sphere.center);
                let radiusSq = 0;
                for (let start = 0; start < position.count; start += 8192) {
                    for (let i = start, end = Math.min(start + 8192, position.count); i < end; i++) {
                        tmpVertex.fromBufferAttribute(position, i);
                        radiusSq = Math.max(radiusSq, sphere.center.distanceToSquared(tmpVertex));
                    }
                    yield;
                }
                if (!geometry.boundingSphere && !geometry.morphAttributes.position?.length && geometry.attributes.position === position && version(position) === positionVersion) {
                    sphere.radius = Math.sqrt(radiusSq);
                    geometry.boundingSphere = sphere;
                }
            }
        }
        for (const object of instanced) {
            if (!object.boundingBox) object.computeBoundingBox();
            yield;
            if ((object as any).isTerrainDecoration && this.getBounds({ object, geometry: object.geometry }, tmpBox, true)) yield;
        }
    }

    public getBounds(item: any, target: Box3, whole = false): boolean {
        const object = item.object, geometry = item.geometry;
        const sway = this.getSway(geometry);
        if (!sway.bounded) return false;
        if (object.isTerrainDecoration) {
            let cached = this.cacheInstances.get(object);
            if (!cached || cached.matrix !== object.instanceMatrix || cached.version !== object.instanceMatrix.version || cached.count !== object.count || cached.sway !== sway) {
                cached = { matrix: object.instanceMatrix, version: object.instanceMatrix.version, count: object.count, sway, bounds: new Box3() };
                for (let i = 0; i < object.count; i++) {
                    object.getMatrixAt(i, tmpInstanceMatrix);
                    tmpInstanceBox.copy(sway.bounds).expandByVector(sway.margin).applyMatrix4(tmpInstanceMatrix);
                    cached.bounds.union(tmpInstanceBox);
                }
                this.cacheInstances.set(object, cached);
            }
            target.copy(cached.bounds);
        } else {
            target.copy(!whole && item.group ? this.bounds.getReceiverBounds(geometry, item.group) : sway.bounds).expandByVector(sway.margin);
        }
        target.applyMatrix4(object.matrixWorld);
        return true;
    }
}

export default MeshBounds;
