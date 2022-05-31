import { Group, Object3D, Mesh, Float32BufferAttribute, Uint16BufferAttribute, BufferGeometry, Sphere, Box3, SphereBufferGeometry, MeshBasicMaterial, Color, AxesHelper, LineBasicMaterial, Line, LineSegments } from "three";
import decodeMaterial from "./material-decoder";

const cacheGeometries = new WeakMap<IGeometryDecodeInfo, THREE.BufferGeometry>();

function fetchGeometry(info: IGeometryDecodeInfo): THREE.BufferGeometry {
    if (cacheGeometries.has(info)) return cacheGeometries.get(info);

    const arrUvs = info.attributes.uvs instanceof Array ? info.attributes.uvs : [info.attributes.uvs];
    const geometry = new BufferGeometry();

    arrUvs.forEach((arrUv, i) => {
        if (!arrUv) return;

        geometry.setAttribute(`uv${i === 0 ? "" : i + 1}`, new Float32BufferAttribute(arrUv, 2));
    });

    if (info.attributes.normals)
        geometry.setAttribute("normal", new Float32BufferAttribute(info.attributes.normals, 3));

    if (info.attributes.positions)
        geometry.setAttribute("position", new Float32BufferAttribute(info.attributes.positions, 3));

    if (info.indices) geometry.setIndex(new Uint16BufferAttribute(info.indices, 1));

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

function decodeEdges(library: IDecodeLibrary, info: IEdgesObjectDecodeInfo): THREE.Line {
    const material = new LineBasicMaterial({
        color: info.color ? new Color().fromArray(info.color) : 0xffff00
    });
    const mesh = new LineSegments(fetchGeometry(library.geometries[info.geometry] as IGeometryDecodeInfo), material);

    applySimpleProperties(library, mesh, info);

    return mesh;
}

function decodeStaticMesh(library: IDecodeLibrary, info: IStaticMeshObjectDecodeInfo): THREE.Mesh {
    const materials = decodeMaterial(library, library.materials[info.materials]);
    const mesh = new Mesh(fetchGeometry(library.geometries[info.geometry] as IGeometryDecodeInfo), materials);

    applySimpleProperties(library, mesh, info);

    return mesh;
}

function decodeLight(library: IDecodeLibrary, info: ILightDecodeInfo): THREE.Mesh {
    const geo = new SphereBufferGeometry(info.radius, 32, 32);
    const mat = new MeshBasicMaterial({ color: new Color().fromArray(info.color), wireframe: true });
    const msh = new Mesh(geo, mat);

    msh.add(new AxesHelper(info.radius));

    applySimpleProperties(library, msh, info);

    return msh;
}

function decodeObject3D(library: IDecodeLibrary, info: IBaseObjectDecodeInfo): THREE.Object3D {
    switch (info.type) {
        case "Level":
        case "TerrainInfo":
        case "StaticMeshActor": return decodeSimpleObject(library, Object3D, info);
        case "Light": return decodeLight(library, info as ILightDecodeInfo);
        case "Model":
        case "TerrainSegment":
        case "StaticMesh": return decodeStaticMesh(library, info as IStaticMeshObjectDecodeInfo);
        case "Edges": return decodeEdges(library, info as IEdgesObjectDecodeInfo);
        default: throw new Error(`Unsupported object type: ${info.type}`);
    }
}

export default decodeObject3D;
export { decodeObject3D };