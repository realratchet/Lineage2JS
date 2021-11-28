import { Group, Object3D, Mesh, Float32BufferAttribute, Uint16BufferAttribute, BufferGeometry, Sphere, Box3 } from "three";
import decodeMaterial from "./material-decoder";

const cacheGeometries = new WeakMap<IGeometryDecodeInfo, THREE.BufferGeometry>();

function fetchGeometry(info: IGeometryDecodeInfo): THREE.BufferGeometry {
    if (cacheGeometries.has(info)) return cacheGeometries.get(info);

    const attrPosition = new Float32BufferAttribute(info.attributes.positions, 3);
    const attrNormal = new Float32BufferAttribute(info.attributes.normals, 3);
    const attrUv = new Float32BufferAttribute(info.attributes.uvs, 2);
    const attrIndices = new Uint16BufferAttribute(info.indices, 1);

    const geometry = new BufferGeometry();

    geometry.setAttribute("position", attrPosition);
    geometry.setAttribute("normal", attrNormal);
    geometry.setAttribute("uv", attrUv);
    geometry.setIndex(attrIndices);

    info.groups.forEach(group => geometry.addGroup(...group));

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

function applySimpleProperties<T extends THREE.Object3D>(library: IDecodeLibrary, object: T, info: IBaseObjectDecodeInfo) {

    if (info.name) object.name = info.name;
    if (info.position) object.position.fromArray(info.position);
    if (info.scale) object.scale.fromArray(info.scale);
    if (info.rotation) object.rotation.fromArray(info.rotation);
    if (info.children) info.children.forEach(ch => object.add(decodeObject3D(library, ch)));

    return object;
}

function decodeSimpleObject(library: IDecodeLibrary, Constructor: (typeof Object3D | typeof Group), info: IBaseObjectDecodeInfo) {
    const object = new Constructor();

    applySimpleProperties(library, object, info);

    return object;
}

function decodeStaticMesh(library: IDecodeLibrary, info: IStaticMeshObjectDecodeInfo): THREE.Mesh {
    const materials = decodeMaterial(library, library.materials[info.materials]);
    const mesh = new Mesh(fetchGeometry(library.geometries[info.geometry] as IGeometryDecodeInfo), materials);

    applySimpleProperties(library, mesh, info);

    return mesh;
}

function decodeObject3D(library: IDecodeLibrary, info: IBaseObjectDecodeInfo): THREE.Object3D {
    switch (info.type) {
        case "StaticMeshActor": return decodeSimpleObject(library, Object3D, info);
        case "Model":
        case "StaticMesh": return decodeStaticMesh(library, info as IStaticMeshObjectDecodeInfo);
        default: throw new Error(`Unsupported object type: ${info.type}`);
    }
}

export default decodeObject3D;
export { decodeObject3D };