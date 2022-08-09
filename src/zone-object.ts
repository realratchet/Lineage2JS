import { Box3, Color, Fog, Object3D, Sphere } from "three";

const tmpColor = new Color();

class ZoneObject extends Object3D {
    protected readonly childZones: ZoneObject[] = [];
    protected readonly childObjects: Object3D[] = [];

    public fog: Fog = null;

    public readonly boundsRender = new Box3();
    public readonly boundsRenderSphere = new Sphere();

    public readonly isZoneObject = true;
    public readonly type = "Zone";

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

    public update(enableZoneCulling: boolean, frustum: THREE.Frustum) {
        if (enableZoneCulling && !frustum.intersectsSphere(this.boundsRenderSphere)) {
            this.children = [];
            return false;
        }

        this.children = this.childObjects;
        this.childZones.forEach(z => z.update(enableZoneCulling, frustum));

        return true;
    }
}

export default ZoneObject;
export { ZoneObject };