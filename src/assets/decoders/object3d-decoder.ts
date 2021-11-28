import { Group, Object3D, Mesh, Float32BufferAttribute, Uint16BufferAttribute, BufferGeometry, Sphere, Box3 } from "three";
import decodeMaterial from "./material-decoder";

function applySimpleProperties<T extends THREE.Object3D>(object: T, info: IBaseObjectDecodeInfo) {

    if (info.name) object.name = info.name;
    if (info.position) object.position.fromArray(info.position);
    if (info.scale) object.scale.fromArray(info.scale);
    if (info.rotation) object.rotation.fromArray(info.rotation);
    if (info.children) info.children.forEach(ch => object.add(decodeObject3D(ch)));

    return object;
}

function decodeSimpleObject(Constructor: (typeof Object3D | typeof Group), info: IBaseObjectDecodeInfo) {
    const object = new Constructor();

    applySimpleProperties(object, info);

    return object;
}

function decodeStaticMesh(info: IStaticMeshObjectDecodeInfo): THREE.Mesh {
    const attrPosition = new Float32BufferAttribute(info.geometry.attributes.positions, 3);
    const attrNormal = new Float32BufferAttribute(info.geometry.attributes.normals, 3);
    const attrUv = new Float32BufferAttribute(info.geometry.attributes.uvs, 2);
    const attrIndices = new Uint16BufferAttribute(info.geometry.indices, 1);

    const geometry = new BufferGeometry();

    geometry.setAttribute("position", attrPosition);
    geometry.setAttribute("normal", attrNormal);
    geometry.setAttribute("uv", attrUv);
    geometry.setIndex(attrIndices);

    info.geometry.groups.forEach(group => geometry.addGroup(...group));

    if (info.geometry.bounds) {
        if (info.geometry.bounds.sphere) {
            geometry.boundingSphere = new Sphere();
            geometry.boundingSphere.center.fromArray(info.geometry.bounds.sphere.center);
            geometry.boundingSphere.radius = info.geometry.bounds.sphere.radius;
        }

        if (info.geometry.bounds.box) {
            geometry.boundingBox = geometry.boundingBox || new Box3();
            geometry.boundingBox.min.fromArray(info.geometry.bounds.box.min);
            geometry.boundingBox.max.fromArray(info.geometry.bounds.box.max);
        }
    }

    const materials = info.materials.map(info => decodeMaterial(info));
    const mesh = new Mesh(geometry, materials);

    applySimpleProperties(mesh, info);

    return mesh;
}

function decodeObject3D(info: IBaseObjectDecodeInfo): THREE.Object3D {
    switch (info.type) {
        case "StaticMeshActor": return decodeSimpleObject(Object3D, info);
        case "Model":
        case "StaticMesh": return decodeStaticMesh(info as IStaticMeshObjectDecodeInfo);
        default: throw new Error(`Unsupported object type: ${info.type}`);
    }
}

export default decodeObject3D;
export { decodeObject3D };