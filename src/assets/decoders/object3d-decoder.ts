import { Group, Object3D, Mesh, Float32BufferAttribute, Uint16BufferAttribute, BufferGeometry, Sphere, Box3, SphereBufferGeometry, MeshBasicMaterial, Color, AxesHelper, LineBasicMaterial, Line, LineSegments, Uint8BufferAttribute, Uint32BufferAttribute, BufferAttribute, Box3Helper, PlaneHelper, Plane, Vector3, Vector2, Material, SkinnedMesh, Points, PointsMaterial, Skeleton, Bone, SkeletonHelper, KeyframeTrack, VectorKeyframeTrack, QuaternionKeyframeTrack, AnimationClip, Matrix4, Quaternion, Vector4 } from "three";
import decodeMaterial from "./material-decoder";
import ZoneObject, { SectorObject } from "../../objects/zone-object";
import decodeTexture from "./texture-decoder";
import Terrain from "@client/objects/terrain";
import CollidingMesh from "@client/objects/colliding-mesh";

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
    if (info.attributes.skinIndex) geometry.setAttribute("skinIndex", new BufferAttribute(info.attributes.skinIndex, 4));
    if (info.attributes.skinWeight) geometry.setAttribute("skinWeight", new BufferAttribute(info.attributes.skinWeight, 4));

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

function decodeStaticMeshData(library: DecodeLibrary, info: IStaticMeshObjectDecodeInfo) {
    const infoGeo = library.geometries[info.geometry];
    const infoMats = library.materials[info.materials];

    const materials = decodeMaterial(library, infoMats) || new MeshBasicMaterial({ color: 0xff00ff });
    const geometry = fetchGeometry(infoGeo as IGeometryDecodeInfo)

    if (infoGeo.attributes.colors) {
        (materials instanceof Array ? materials : [materials]).forEach(mat => {
            if (!mat) return;

            mat.vertexColors = true;
        });
    }

    return { geometry, materials };
}

function decodeStaticMeshWrapped(library: DecodeLibrary, info: IStaticMeshObjectDecodeInfo): THREE.Object3D {
    const obj = new Object3D();
    const { geometry, materials } = decodeStaticMeshData(library, info);
    const mesh = new Mesh(geometry, materials);

    applySimpleProperties(library, mesh, info);

    // obj.add(new Mesh(mesh.geometry, new MeshBasicMaterial({ color: 0xffffff, wireframe: true })))
    obj.add(mesh);

    return obj;
}

function decodeLight(library: DecodeLibrary, info: ILightDecodeInfo): THREE.Mesh {
    const geo = new SphereBufferGeometry(info.radius, 32, 32);
    const mat = new MeshBasicMaterial({ color: new Color().fromArray(info.color), wireframe: true });
    const msh = new Mesh(geo, mat);

    msh.add(new AxesHelper(info.radius));

    applySimpleProperties(library, msh, info);

    return msh;
}

function decodeStaticMeshActor(library: DecodeLibrary, info: IStaticMeshActorDecodeInfo): CollidingMesh {
    const instanceInfo = info.instance;
    const { geometry, materials, collider } = decodeStaticMeshInstance(library, instanceInfo);

    const object = new CollidingMesh(geometry, materials, collider);

    object.userData.meshInstance = {
        uuid: instanceInfo.uuid,
        name: instanceInfo.name
    };

    object.userData.mesh = {
        uuid: instanceInfo.mesh.uuid,
        name: instanceInfo.mesh.name
    };

    if (collider) {
        // const mat = new MeshBasicMaterial({ opacity: 0.5, wireframe: false, color: 0xff00ff, transparent: true, depthWrite: false, depthTest: true });
        // const geo = new BufferGeometry();
        // const indices = new Uint32BufferAttribute(collider, 1);

        // geo.setIndex(indices)
        // geo.setAttribute("position", geometry.getAttribute("position"));

        // const wire = new Mesh(geo, mat);

        // object.add(wire);
    }

    applySimpleProperties(library, object, info);

    return object;
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

    const materials = decodeMaterial(library, infoMats) || (new MeshBasicMaterial({ color: 0xff00ff }) as Material);

    (materials instanceof Array ? materials : [materials]).forEach(mat => (mat as any)?.setInstanced?.());

    if (infoGeo.attributes.colors) {
        (materials instanceof Array ? materials : [materials]).forEach(mat => {
            if (!mat) return;

            mat.vertexColors = true;
        });
    }

    const collider = infoGeo.colliderIndices || null;

    return { geometry, materials, collider };
}

function decodeZoneObject(library: DecodeLibrary, info: IBaseZoneDecodeInfo) {
    const object = new ZoneObject();

    if (info.name) object.name = info.name;
    if (info.bounds?.isValid) object.setRenderBounds(info.bounds.min, info.bounds.max);
    if (info.fog) object.setFogInfo(info.fog.start, info.fog.end, info.fog.color);
    if (info.children) info.children.forEach(ch => object.add(decodeObject3D(library, ch)));

    // object.visible = false;

    return object;
}

function decodeSector(library: DecodeLibrary) {
    const sector = new SectorObject();

    sector.name = library.name;

    if (library.sector) sector.index = new Vector2().fromArray(library.sector);

    library.bspZones.forEach(bspZone => sector.zones.add(decodeZoneObject(library, bspZone.zoneInfo)));

    sector.setBSPInfo(library.bspZones, library.bspNodes, library.bspLeaves);

    const spriteUuid = library.sun.sprites[0];
    const spriteInfo = library.materials[spriteUuid] as ITextureDecodeInfo;

    sector.setSun(decodeTexture(library, spriteInfo) as MapData_T);

    library.bspColliders.forEach(collider => {
        const box = new Box3();

        if (collider.isValid) {
            box.min.fromArray(collider.min)
            box.max.fromArray(collider.max)
        }

        const helper = new Box3Helper(box);

        sector.helpers.add(helper);
    });

    // sector.bspNodes.forEach(node => {
    //     if (node.zones[0] === 1 || node.zones[1] === 1) {
    //         const normal = new Vector3(node.plane.x, node.plane.y, node.plane.z);
    //         const constant = node.plane.w;
    //         const plane = new Plane(normal, constant);

    //         sector.add(new PlaneHelper(plane, 10000, Math.floor(0xffffff * Math.random())));
    //     }
    // });

    // debugger;

    // const sectorUuid = library.sector;
    // const sectorInfo = library.bspZones[sectorUuid];
    // const zonesUuids = Object.keys(library.zones).filter(uuid => sectorUuid !== uuid);
    // const sector = decodeZoneObject(library, sectorInfo);

    // let boundsNeedUpdate = false;

    // zonesUuids.forEach(uuid => {
    //     const zoneInfo = library.zones[uuid];

    //     sector.add(decodeZoneObject(library, zoneInfo));

    //     if (zoneInfo.bounds?.isValid) {
    //         const { min, max } = zoneInfo.bounds;

    //         boundsNeedUpdate = true;
    //         [[Math.min, sectorInfo.bounds.min], [Math.max, sectorInfo.bounds.max]].forEach(
    //             ([fn, arr]: [(...values: number[]) => number, Vector3Arr]) => {
    //                 for (let i = 0; i < 3; i++)
    //                     arr[i] = fn(arr[i], min[i], max[i]);
    //             }
    //         );
    //     }
    // });

    // if (boundsNeedUpdate) {
    //     sectorInfo.bounds.isValid = true;
    //     sector.setRenderBounds(sectorInfo.bounds.min, sectorInfo.bounds.max);
    // }

    // (sector as SectorObject).setBSPInfo(library.bspZones, library.bspNodes, library.bspLeaves);

    return sector;
}

function decodePackage(library: DecodeLibrary) {
    const sector = decodeSector(library);

    if (library.helpersZoneBounds) {
        const boundsGroup = new Object3D();
        sector.helpers.add(boundsGroup);
        sector.helpers.name = "Bounds Helpers";
        Object.values(library.bspZones).forEach(bspZone => {
            const zone = bspZone.zoneInfo;
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

    return sector;
}

function decodeTerrainSegment(library: DecodeLibrary, info: IStaticMeshObjectDecodeInfo) {
    const infoGeo = library.geometries[info.geometry];
    const { geometry, materials } = decodeStaticMeshData(library, info);

    const positions = infoGeo.attributes.positions;
    const heightfield = new Float32Array(17 * 17);
    const { min, max } = infoGeo.bounds.box;

    const bounds = new Box3();

    bounds.min.fromArray(min);
    bounds.max.fromArray(max);

    for (let x = 0; x < 17; x++) {
        for (let y = 0; y < 17; y++) {
            const value = positions[(y * 17 + x) * 3 + 1];

            heightfield[x * 17 + y] = value;
        }
    }

    const terrain = new Terrain(geometry, materials, { segments: [16, 16], heightfield, bounds });

    applySimpleProperties(library, terrain, info);

    return terrain;
}

function decodeBone(library: DecodeLibrary, info: IBoneDecodeInfo): Bone {
    const bone = new Bone();

    bone.name = info.name;

    if (info.position) bone.position.fromArray(info.position);
    if (info.scale) bone.scale.fromArray(info.scale);
    if (info.quaternion) bone.quaternion.fromArray(info.quaternion);

    // if (info.name.includes("R")) {
    //     const geo = new SphereBufferGeometry(5);
    //     const mat = new MeshBasicMaterial({ color: 0xff0000, transparent: true, depthWrite: false, depthTest: false });

    //     const m = new Mesh(geo, mat);

    //     bone.add(m);
    // } /*else if (info.name.includes("L")) {
    //     const geo = new SphereBufferGeometry(5);
    //     const mat = new MeshBasicMaterial({ color: 0x0000ff, transparent: true, depthWrite: false, depthTest: false });

    //     const m = new Mesh(geo, mat);

    //     bone.add(m);
    // } */ else {
    //     const geo = new SphereBufferGeometry(5);
    //     const mat = new MeshBasicMaterial({ color: 0xff00ff, transparent: true, depthWrite: false, depthTest: false });

    //     const m = new Mesh(geo, mat);

    //     bone.add(m);
    // }

    return bone;
}

function decodeBones(library: DecodeLibrary, infos: IBoneDecodeInfo[]): Bone[] {
    const boneCount = infos.length;
    const bones = new Array(boneCount) as Bone[];

    for (let i = 0; i < boneCount; i++) {
        const info = infos[i];
        const bone = bones[i] = decodeBone(library, info);

        if (i === 0) continue;

        bones[info.parent].add(bone);
    }

    return bones;
}

function decodeAnimation(library: DecodeLibrary, name: string, info: IKeyframeDecodeInfo_T[]) {
    const tracks = info.map(info => {
        let KeyframeTrackConstructor: typeof KeyframeTrack;

        switch (info.type) {
            case "Quaternion": KeyframeTrackConstructor = QuaternionKeyframeTrack; break;
            case "Vector": KeyframeTrackConstructor = VectorKeyframeTrack; break;
        }

        return new KeyframeTrackConstructor(info.name, info.times, info.values)
    });

    const clip = new AnimationClip(name, -1, tracks);

    return clip;
}

function decodeSkinnedMesh(library: DecodeLibrary, info: ISkinnedMeshObjectDecodeInfo) {
    const geometry = fetchGeometry(library.geometries[info.geometry]);
    const infoMats = library.materials[info.materials];

    const materials = decodeMaterial(library, infoMats) || new MeshBasicMaterial({ color: 0xff00ff });

    const bones = decodeBones(library, info.skeleton);
    const skeleton = new Skeleton(bones);

    const mesh = new SkinnedMesh(geometry, materials);

    mesh.add(bones[0]);
    mesh.bind(skeleton);

    const animations = Object.keys(info.animations).reduce((acc, k) => {
        acc[k] = decodeAnimation(library, k, info.animations[k]);

        return acc;
    }, {} as GenericObjectContainer_T<AnimationClip>);

    mesh.userData.animations = animations;


    return mesh;
}

function decodeObject3D(library: DecodeLibrary, info: IBaseObjectOrInstanceDecodeInfo): THREE.Object3D {
    switch (info.type) {
        case "Group":
        case "Level":
        case "TerrainInfo": return decodeSimpleObject(library, Object3D, info as IBaseObjectDecodeInfo);
        case "StaticMeshActor": return decodeStaticMeshActor(library, info as IStaticMeshActorDecodeInfo);
        case "Light": return decodeLight(library, info as ILightDecodeInfo);
        case "TerrainSegment": return decodeTerrainSegment(library, info as IStaticMeshObjectDecodeInfo);
        case "Model":
        case "StaticMesh": return decodeStaticMeshWrapped(library, info as IStaticMeshObjectDecodeInfo);
        case "Edges": return decodeEdges(library, info as IEdgesObjectDecodeInfo);
        case "SkinnedMesh": return decodeSkinnedMesh(library, info as ISkinnedMeshObjectDecodeInfo);
        default: throw new Error(`Unsupported object type: ${info.type}`);
    }
}

export default decodeObject3D;
export { decodeObject3D, decodePackage };