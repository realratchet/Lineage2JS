import { Group, Object3D, Mesh, Float32BufferAttribute, Uint16BufferAttribute, BufferGeometry, Sphere, Box3, SphereBufferGeometry, MeshBasicMaterial, Color, AxesHelper, LineBasicMaterial, Line, LineSegments, Uint8BufferAttribute, Uint32BufferAttribute, BufferAttribute, Box3Helper } from "three";
import decodeMaterial from "./material-decoder";
import ZoneObject, { SectorObject } from "../../zone-object";

const cacheGeometries = new WeakMap<IGeometryDecodeInfo, THREE.BufferGeometry>();

function getAttributeForTypedArray(IndexArrayConstructor: IndexTypedArray): IndexTypedArrayAttribute {
    switch (IndexArrayConstructor) {
        case Uint8Array: return Uint8BufferAttribute;
        case Uint16Array: return Uint16BufferAttribute;
        case Uint32Array: return Uint32BufferAttribute;
        default: throw new Error(`Unsupported index array constructor ${IndexArrayConstructor.name}`);
    }
}

function fetchGeometry(info: IGeometryDecodeInfo) {
    if (cacheGeometries.has(info)) return cacheGeometries.get(info);

    const arrUvs = info.attributes.uvs instanceof Array ? info.attributes.uvs : [info.attributes.uvs];
    const geometry = new BufferGeometry();

    arrUvs.forEach((arrUv, i) => {
        if (!arrUv) return;

        geometry.setAttribute(`uv${i === 0 ? "" : i + 1}`, new BufferAttribute(arrUv, 2));
    });

    if (info.attributes.normals) geometry.setAttribute("normal", new BufferAttribute(info.attributes.normals, 3));
    if (info.attributes.positions) geometry.setAttribute("position", new BufferAttribute(info.attributes.positions, 3));
    if (info.attributes.colors) geometry.setAttribute("color", new BufferAttribute(info.attributes.colors, 3));
    if (info.attributes.colorsInstance) geometry.setAttribute("colorInstance", new BufferAttribute(info.attributes.colorsInstance, 3));

    if (info.indices) {
        const AttributeConstructor = getAttributeForTypedArray(info.indices.constructor as IndexTypedArray);

        geometry.setIndex(new AttributeConstructor(info.indices, 1));
    }

    if (info.groups) info.groups.forEach(group => geometry.addGroup(...group));

    if (info.bounds) {
        if (info.bounds.sphere) {
            geometry.boundingSphere = new Sphere();
            geometry.boundingSphere.center.fromArray(info.bounds.sphere.center);
            geometry.boundingSphere.radius = info.bounds.sphere.radius;
        }

        if (info.bounds.box) {
            geometry.boundingBox = geometry.boundingBox || new Box3();
            geometry.boundingBox.min.fromArray(info.bounds.box.min);
            geometry.boundingBox.max.fromArray(info.bounds.box.max);
        }
    }

    cacheGeometries.set(info, geometry);

    return geometry;
}

function applySimpleProperties<T extends THREE.Object3D>(library: DecodeLibrary, object: T, info: IBaseObjectDecodeInfo) {

    if (info.name) object.name = info.name;
    if (info.position) object.position.fromArray(info.position);
    if (info.scale) object.scale.fromArray(info.scale);
    if (info.rotation) object.rotation.fromArray(info.rotation);
    if (info.children) info.children.forEach(ch => object.add(decodeObject3D(library, ch)));

    return object;
}

function decodeSimpleObject(library: DecodeLibrary, Constructor: (typeof Object3D | typeof Group), info: IBaseObjectDecodeInfo) {
    const object = new Constructor();

    applySimpleProperties(library, object, info);

    return object;
}

function decodeEdges(library: DecodeLibrary, info: IEdgesObjectDecodeInfo): THREE.Line {
    const ignoreDepth = "ignoreDepth" in info ? info.ignoreDepth : false;
    const material = new LineBasicMaterial({
        color: info.color ? new Color().fromArray(info.color) : 0xffff00,
        depthTest: !ignoreDepth,
        depthWrite: !ignoreDepth,
        transparent: ignoreDepth
    });

    const mesh = new LineSegments(fetchGeometry(library.geometries[info.geometry] as IGeometryDecodeInfo), material);

    applySimpleProperties(library, mesh, info);

    return mesh;
}

function decodeStaticMesh(library: DecodeLibrary, info: IStaticMeshObjectDecodeInfo): THREE.Mesh {
    const infoGeo = library.geometries[info.geometry];
    const infoMats = library.materials[info.materials];

    const materials = decodeMaterial(library, infoMats) || new MeshBasicMaterial({ color: 0xff00ff })
    const mesh = new Mesh(fetchGeometry(infoGeo as IGeometryDecodeInfo), materials);

    if (infoGeo.attributes.colors) {
        (materials instanceof Array ? materials : [materials]).forEach(mat => {
            if (!mat) return;

            mat.vertexColors = true;
        });
    }

    applySimpleProperties(library, mesh, info);

    return mesh;
}

function decodeLight(library: DecodeLibrary, info: ILightDecodeInfo): THREE.Mesh {
    const geo = new SphereBufferGeometry(info.radius, 32, 32);
    const mat = new MeshBasicMaterial({ color: new Color().fromArray(info.color), wireframe: true });
    const msh = new Mesh(geo, mat);

    msh.add(new AxesHelper(info.radius));

    applySimpleProperties(library, msh, info);

    return msh;
}

function decodeStaticMeshInstance(library: DecodeLibrary, info: IStaticMeshInstanceDecodeInfo) {

    const geometryUuid = info.mesh.geometry;
    const infoGeo = {
        ...library.geometries[geometryUuid],
        attributes: {
            ...library.geometries[geometryUuid].attributes,
            ...Object.fromEntries(Object.keys(info.attributes).map((k: "colors") => [`${k}Instance`, info.attributes[k]]))
        }
    };

    const geometry = fetchGeometry(infoGeo);
    const meshInfo = info.mesh;

    const infoMats = library.materials[meshInfo.materials];

    const materials = decodeMaterial(library, infoMats) || new MeshBasicMaterial({ color: 0xff00ff });
    const mesh = new Mesh(geometry, materials);

    applySimpleProperties(library, mesh, meshInfo);

    (materials instanceof Array ? materials : [materials]).forEach(mat => (mat as any)?.setInstanced?.());

    if (infoGeo.attributes.colors) {
        (materials instanceof Array ? materials : [materials]).forEach(mat => {
            if (!mat) return;

            mat.vertexColors = true;
        });
    }

    return mesh;
}

function decodeZoneObject(library: DecodeLibrary, info: IBaseZoneDecodeInfo) {
    const Constructor = info.type === "Sector" ? SectorObject : ZoneObject;
    const object = new Constructor();

    if (info.name) object.name = info.name;
    if (info.bounds?.isValid) object.setRenderBounds(info.bounds.min, info.bounds.max);
    if (info.fog) object.setFogInfo(info.fog.start, info.fog.end, info.fog.color);
    if (info.children) info.children.forEach(ch => object.add(decodeObject3D(library, ch)));

    return object;
}

function decodeSector(library: DecodeLibrary) {
    const sectorUuid = library.sector;
    const sectorInfo = library.zones[sectorUuid];
    const zonesUuids = Object.keys(library.zones).filter(uuid => sectorUuid !== uuid);
    const sector = decodeZoneObject(library, sectorInfo);

    let boundsNeedUpdate = false;

    zonesUuids.forEach(uuid => {
        const zoneInfo = library.zones[uuid];

        sector.add(decodeZoneObject(library, zoneInfo));

        if (zoneInfo.bounds?.isValid) {
            const { min, max } = zoneInfo.bounds;

            boundsNeedUpdate = true;
            [[Math.min, sectorInfo.bounds.min], [Math.max, sectorInfo.bounds.max]].forEach(
                ([fn, arr]: [(...values: number[]) => number, Vector3Arr]) => {
                    for (let i = 0; i < 3; i++)
                        arr[i] = fn(arr[i], min[i], max[i]);
                }
            );
        }
    });

    if (boundsNeedUpdate) {
        sectorInfo.bounds.isValid = true;
        sector.setRenderBounds(sectorInfo.bounds.min, sectorInfo.bounds.max);
    }

    return sector;
}

function decodePackage(library: DecodeLibrary) {
    const map = new Object3D();

    map.name = library.name;
    map.add(decodeSector(library));

    if (library.helpersZoneBounds) {
        const boundsGroup = new Object3D();
        map.add(boundsGroup);
        map.name = "Bounds Helpers";
        Object.values(library.zones).forEach(zone => {
            const { min, max } = zone.bounds;
            const box = new Box3();
            const color = new Color(Math.floor(Math.random() * 0xffffff));

            box.min.fromArray(min);
            box.max.fromArray(max);

            const helper = new Box3Helper(box, color);
            if ("name" in zone) helper.name = `Bounds[${zone.name}]`;

            boundsGroup.add(helper);
        });
    }

    return map;
}

function decodeObject3D(library: DecodeLibrary, info: IBaseObjectOrInstanceDecodeInfo): THREE.Object3D {
    switch (info.type) {
        case "Group":
        case "Level":
        case "TerrainInfo":
        case "StaticMeshActor": return decodeSimpleObject(library, Object3D, info as IBaseObjectDecodeInfo);
        case "StaticMeshInstance": return decodeStaticMeshInstance(library, info as IStaticMeshInstanceDecodeInfo);
        case "Light": return decodeLight(library, info as ILightDecodeInfo);
        case "Model":
        case "TerrainSegment":
        case "StaticMesh": return decodeStaticMesh(library, info as IStaticMeshObjectDecodeInfo);
        case "Edges": return decodeEdges(library, info as IEdgesObjectDecodeInfo);
        default: throw new Error(`Unsupported object type: ${info.type}`);
    }
}

export default decodeObject3D;
export { decodeObject3D, decodePackage };