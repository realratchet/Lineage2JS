import { Box3, Vector3 } from "three";
import MeshBounds from "./mesh-bounds";

type Visibility_T = { frame: number, visible: boolean };

const tmpBox = new Box3();
const tmpCenter = new Vector3();
const tmpSize = new Vector3();

export class BatchAngleVisibility {
    public angle = 0;
    public rejected = 0;
    protected threshold = 0;
    protected frame = 0;
    protected readonly cacheVisibility = new WeakMap<THREE.Object3D, Visibility_T>();

    public constructor(protected readonly bounds: MeshBounds) {}

    public setAngle(degrees: number): void {
        if (!Number.isFinite(degrees) || degrees < 0 || degrees >= 180) throw new Error(`Invalid batch culling angle: ${degrees}`);
        this.angle = degrees;
        this.threshold = Math.sin(degrees * Math.PI / 360) ** 2;
        this.rejected = 0;
    }

    public prepare(camera: THREE.Camera): boolean {
        this.frame++;
        this.rejected = 0;
        return this.angle > 0 && !!(camera as THREE.PerspectiveCamera).isPerspectiveCamera;
    }

    public filter(items: any[], camera: THREE.Camera): void {
        let count = 0;
        for (const item of items) {
            const object = item.object;
            if ((!object.isBatch && !object.isTerrainDecoration) || object.actorRenderable || object.isSkinnedMesh || object.morphTargetInfluences) {
                items[count++] = item;
                continue;
            }
            let cached = this.cacheVisibility.get(object);
            if (!cached) {
                cached = { frame: -1, visible: true };
                this.cacheVisibility.set(object, cached);
            }
            if (cached.frame !== this.frame) {
                cached.frame = this.frame;
                cached.visible = !this.bounds.getBounds(item, tmpBox, true);
                if (!cached.visible) {
                    tmpBox.getCenter(tmpCenter);
                    tmpBox.getSize(tmpSize);
                    cached.visible = tmpSize.lengthSq() * 0.25 >= camera.position.distanceToSquared(tmpCenter) * this.threshold;
                }
            }
            if (cached.visible) items[count++] = item;
            else this.rejected++;
        }
        items.length = count;
    }
}

export default BatchAngleVisibility;
