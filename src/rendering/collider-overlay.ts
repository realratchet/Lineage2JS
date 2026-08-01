import { BufferAttribute, BufferGeometry, CylinderGeometry, DoubleSide, Mesh, MeshBasicMaterial, Object3D } from "three";
import RAPIER from "@dimforge/rapier3d";

class ColliderOverlay extends Object3D {
    protected readonly material = new MeshBasicMaterial({
        color: 0xff00ff, transparent: true, opacity: 0.35, depthTest: true, depthWrite: false, side: DoubleSide, wireframe: true
    });

    public constructor() {
        super();

        this.name = "ColliderOverlay";
        this.visible = false;
        this.renderOrder = 10000;
        this.matrixAutoUpdate = false;
    }

    public rebuild(colliders: Iterable<RAPIER.Collider>) {
        this.clear();

        for (const collider of colliders) {
            const geometry = buildShapeGeometry(collider.shape);

            if (!geometry) continue;

            const mesh = new Mesh(geometry, this.material);
            const translation = collider.translation();
            const rotation = collider.rotation();

            mesh.position.set(translation.x, translation.y, translation.z);
            mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            mesh.renderOrder = this.renderOrder;
            mesh.frustumCulled = false;

            this.add(mesh);
        }

        this.updateMatrixWorld(true);
    }

    public clear(): this {
        for (const child of this.children as Mesh[])
            child.geometry.dispose();

        return super.clear();
    }
}

function buildShapeGeometry(shape: RAPIER.Shape): BufferGeometry | null {
    const vertices = (shape as any).vertices as Float32Array;
    const indices = (shape as any).indices as Uint32Array;

    if (vertices && indices) {
        const geometry = new BufferGeometry();

        geometry.setAttribute("position", new BufferAttribute(vertices.slice(), 3));
        geometry.setIndex(new BufferAttribute(indices.slice(), 1));

        return geometry;
    }

    const halfHeight = (shape as any).halfHeight as number;
    const radius = (shape as any).radius as number;

    if (halfHeight !== undefined && radius !== undefined)
        return new CylinderGeometry(radius, radius, halfHeight * 2, 16, 1);

    return null;
}

export default ColliderOverlay;
export { ColliderOverlay };
