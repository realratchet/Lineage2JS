import { Box3, Color, Fog, Object3D, Sphere } from "three";

const tmpColor = new Color();

class ZoneObject extends Object3D {
    protected boundsRender = new Box3();
    protected boundsRenderSphere = new Sphere();
    protected childZones: ZoneObject[] = [];
    protected childObjects: Object3D[] = [];

    public readonly isZoneObject = true;
    public readonly type = "Zone";

    public fog: Fog = null;

    public setRenderBounds(min: Vector3Arr, max: Vector3Arr): this {

        this.boundsRender.min.fromArray(min);
        this.boundsRender.max.fromArray(max);
        this.boundsRender.getBoundingSphere(this.boundsRenderSphere);

        return this;
    }

    public setFogInfo(start: number, end: number, color: ColorArr): this {
        this.fog = new Fog(tmpColor.fromArray(color), start, end);

        return this;
    }

    public add(object: Object3D): this {

        object.parent = this;

        if ((object as ZoneObject).isZoneObject) this.childZones.push(object as ZoneObject);

        this.childObjects.push(object);

        return this;
    }

    public update(enableZoneCulling: boolean, frustum: THREE.Frustum, cameraPosition: THREE.Vector3) {
        if (enableZoneCulling && !frustum.intersectsSphere(this.boundsRenderSphere) && !this.boundsRender.containsPoint(cameraPosition)) {
            this.children = [];
            return false;
        }

        this.children = this.childObjects;
        this.childZones.forEach(z => z.update(enableZoneCulling, frustum, cameraPosition));

        return true;
    }
}

export default ZoneObject;
export { ZoneObject };