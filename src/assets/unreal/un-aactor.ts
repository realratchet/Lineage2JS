import UObject from "./un-object";
import FVector from "./un-vector";
import FRotator from "./un-rotator";
import { generateUUID } from "three/src/math/MathUtils";

class UAActor extends UObject {
    protected readHeadOffset: number = 15;

    protected texModifyInfo: UTextureModifyInfo;
    protected isDynamicActorFilterState: boolean;
    protected level: ULevel;
    protected region: UPointRegion;
    protected drawScale: number = 1;
    protected tag: string;
    protected group: string = "None";
    protected isSunAffected: boolean;
    protected physicsVolume: UPhysicsVolume;
    public readonly location: FVector = new FVector();
    public readonly rotation: FRotator = new FRotator();
    public readonly scale: FVector = new FVector(1, 1, 1);
    protected swayRotationOrig: FRotator = new FRotator();

    protected hasDistanceFog: boolean;
    protected distanceFogEnd: number;
    protected distanceFogStart: number;
    protected distanceFogColor: FColor;

    protected isHiddenInEditor: boolean;
    protected isLightChanged: boolean;
    protected isDeleteMe: boolean;
    protected isPendingDelete: boolean;
    protected isSelected: boolean;

    protected mainScale: FScale;
    protected dummy: boolean;

    public getRegion() { return this.region; }
    public getZone() { return this.region.getZone(); }

    protected getRegionLineHelper(library: IDecodeLibrary, color: [number, number, number] = [1, 0, 1], ignoreDepth: boolean = false) {
        const lineGeometryUuid = generateUUID();
        const _a = this.region.getZone().location;
        const _b = this.location;

        const a = new FVector(_a.x, _a.z, _a.y);
        const b = new FVector(_b.x, _b.z, _b.y);

        const geoPosition = a.sub(b).applyRotator(this.rotation, true);
        const regionHelper = {
            type: "Edges",
            geometry: lineGeometryUuid,
            color,
            ignoreDepth
        } as IEdgesObjectDecodeInfo;

        library.geometries[lineGeometryUuid] = {
            indices: new Uint8Array([0, 1]),
            attributes: {
                positions: new Float32Array([
                    0, 0, 0,
                    geoPosition.x, geoPosition.y, geoPosition.z
                ])
            }
        };

        return regionHelper;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "MainScale": "mainScale",

            "bDummy": "dummy",

            "bDynamicActorFilterState": "isDynamicActorFilterState",
            "Level": "level",
            "Region": "region",
            "Tag": "tag",
            "bSunAffect": "isSunAffected",
            "PhysicsVolume": "physicsVolume",
            "Location": "location",
            "Rotation": "rotation",
            "SwayRotationOrig": "swayRotationOrig",
            "DrawScale": "drawScale",
            "TexModifyInfo": "texModifyInfo",
            "DrawScale3D": "scale",
            "Group": "group",

            "bDistanceFog": "hasDistanceFog",
            "DistanceFogEnd": "distanceFogEnd",
            "DistanceFogStart": "distanceFogStart",
            "DistanceFogColor": "distanceFogColor",

            "bHiddenEd": "isHiddenInEditor",
            "bLightChanged": "isLightChanged",
            "bSelected": "isSelected",

            "bDeleteMe": "isDeleteMe",
            "bPendingDelete": "isPendingDelete",
        });
    };
}

export default UAActor;
export { UAActor };