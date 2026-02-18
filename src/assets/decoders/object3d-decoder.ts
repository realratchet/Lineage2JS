import { Group, Object3D, Mesh, Float32BufferAttribute, Uint16BufferAttribute, BufferGeometry, Sphere, Box3, SphereGeometry, MeshBasicMaterial, Color, AxesHelper, LineBasicMaterial, Line, LineSegments, Uint8BufferAttribute, Uint32BufferAttribute, BufferAttribute, Box3Helper, PlaneHelper, Plane, Vector3, Vector2, Material, SkinnedMesh, Points, PointsMaterial, Skeleton, Bone, SkeletonHelper, KeyframeTrack, VectorKeyframeTrack, QuaternionKeyframeTrack, AnimationClip, Matrix4, Quaternion, Vector4, PlaneBufferGeometry, NormalBlending, AdditiveBlending, CustomBlending, OneFactor, OneMinusSrcColorFactor, SrcAlphaFactor, OneMinusSrcAlphaFactor, DoubleSide, BoxHelper } from "three";
import decodeMaterial from "./material-decoder";
import ZoneObject, { ILightInfo, SectorObject, FogInfoObject } from "../../objects/zone-object";
import decodeTexture from "./texture-decoder";
import Terrain from "@client/objects/terrain";
import CollidingMesh from "@client/objects/colliding-mesh";
import SpriteEmitter from "@client/objects/emitters/sprite-emitter";
import MeshEmitter from "@client/objects/emitters/mesh-emitter";
import { MeshLight } from "@client/objects/lit-actor";
import DynamicLight, { ColorHSV } from "@client/objects/dynamic-light";

const cacheGeometries = new WeakMap<GD.IGeometryDecodeInfo, THREE.BufferGeometry>();

function getAttributeForTypedArray(IndexArrayConstructor: GD.IndexTypedArray): GD.IndexTypedArrayAttribute {
    switch (IndexArrayConstructor) {
        case Uint8Array: return Uint8BufferAttribute;
        case Uint16Array: return Uint16BufferAttribute;
        case Uint32Array: return Uint32BufferAttribute;
        default: throw new Error(`Unsupported index array constructor ${IndexArrayConstructor.name}`);
    }
}

function fetchGeometry(info: GD.IGeometryDecodeInfo) {
    if (cacheGeometries.has(info)) return cacheGeometries.get(info);

    const arrUvs = info.attributes.uvs instanceof Array ? info.attributes.uvs : [info.attributes.uvs];
    const geometry = new BufferGeometry();

    arrUvs.forEach((arrUv, i) => {
        if (!arrUv) return;

        geometry.setAttribute(`uv${i === 0 ? "" : i + 1}`, new BufferAttribute(arrUv, 2));
    });

    if (info.attributes.normals) geometry.setAttribute("normal", new BufferAttribute(info.attributes.normals, 3));
    if (info.attributes.positions) geometry.setAttribute("position", new BufferAttribute(info.attributes.positions, 3));
    if (info.attributes.colors) geometry.setAttribute("color", new BufferAttribute(info.attributes.colors, 3, info.attributes.colors instanceof Uint8Array || info.attributes.colors instanceof Uint8ClampedArray));
    if (info.attributes.colorsInstance) geometry.setAttribute("colorInstance", new BufferAttribute(info.attributes.colorsInstance, 3, info.attributes.colorsInstance instanceof Uint8Array || info.attributes.colorsInstance instanceof Uint8ClampedArray));
    if (info.attributes.skinIndex) geometry.setAttribute("skinIndex", new BufferAttribute(info.attributes.skinIndex, 4));
    if (info.attributes.skinWeight) geometry.setAttribute("skinWeight", new BufferAttribute(info.attributes.skinWeight, 4));
    if (info.attributes.nodeIndex) geometry.setAttribute("nodeIndex", new BufferAttribute(info.attributes.nodeIndex, 1));
    if ((info.attributes as any).terrainIndex) geometry.setAttribute("terrainIndex", new BufferAttribute((info.attributes as any).terrainIndex, 1));

    if (info.indices) {
        const AttributeConstructor = getAttributeForTypedArray(info.indices.constructor as GD.IndexTypedArray);

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

function applySimpleProperties<T extends THREE.Object3D>(library: GD.DecodeLibrary, object: T, info: IBaseObjectDecodeInfo) {

    if (info.name) object.name = info.name;
    if (info.position) object.position.fromArray(info.position);
    if (info.scale) object.scale.fromArray(info.scale);

    if (info.quaternion) object.quaternion.fromArray(info.quaternion);
    else if (info.rotation) object.rotation.fromArray(info.rotation);

    if (info.children) info.children.forEach(ch => object.add(decodeObject3D(library, ch)));

    return object;
}


function decodeEmitterObject(library: GD.DecodeLibrary, info: GD.IBaseObjectDecodeInfo) {
    const object = decodeSimpleObject(library, Object3D, info);

    object.add(new AxesHelper(100));

    return object;
}


function decodeSimpleObject(library: GD.DecodeLibrary, Constructor: (typeof Object3D | typeof Group), info: GD.IBaseObjectDecodeInfo) {
    const object = new Constructor();

    applySimpleProperties(library, object, info);

    return object;
}

function decodeEdges(library: GD.DecodeLibrary, info: GD.IEdgesObjectDecodeInfo): THREE.Line {
    const ignoreDepth = "ignoreDepth" in info ? info.ignoreDepth : false;
    const material = new LineBasicMaterial({
        color: info.color ? new Color().fromArray(info.color) : 0xffff00,
        depthTest: !ignoreDepth,
        depthWrite: !ignoreDepth,
        transparent: ignoreDepth
    });

    const mesh = new LineSegments(fetchGeometry(library.geometries[info.geometry] as GD.IGeometryDecodeInfo), material);

    applySimpleProperties(library, mesh, info);

    return mesh;
}

function decodeStaticMeshData(library: GD.DecodeLibrary, info: GD.IStaticMeshObjectDecodeInfo) {
    const infoGeo = library.geometries[info.geometry];
    const infoMats = library.materials[info.materials];

    const materials = decodeMaterial(library, infoMats) || new MeshBasicMaterial({ color: 0xff00ff });
    const geometry = fetchGeometry(infoGeo as GD.IGeometryDecodeInfo);

    if (infoGeo.attributes.colors) {
        (materials instanceof Array ? materials : [materials]).forEach(mat => {
            if (!mat) return;

            mat.vertexColors = true;
        });
    }

    return { geometry, materials };
}

function decodeStaticMeshWrapped(library: GD.DecodeLibrary, info: GD.IStaticMeshObjectDecodeInfo): THREE.Object3D {
    const obj = new Object3D();
    const { geometry, materials } = decodeStaticMeshData(library, info);
    const mesh = new Mesh(geometry, materials);

    applySimpleProperties(library, mesh, info);

    // obj.add(new Mesh(mesh.geometry, new MeshBasicMaterial({ color: 0xffffff, wireframe: true })))
    obj.add(mesh);

    return obj;
}

// function decodeLight(library: GD.DecodeLibrary, info: GD.ILightDecodeInfo): THREE.Mesh {
//     const geo = new SphereGeometry(info.radius, 32, 32);
//     const mat = new MeshBasicMaterial({ color: new Color().fromArray(info.color), wireframe: true });
//     const msh = new Mesh(geo, mat);

//     msh.add(new AxesHelper(info.radius));

//     applySimpleProperties(library, msh, info);

//     return msh;
// }

function decodeStaticMeshActor(library: GD.DecodeLibrary, info: GD.IStaticMeshActorDecodeInfo): CollidingMesh {
    const instanceInfo = info.instance;
    const { geometry, materials, collider, lights, lods } = decodeStaticMeshInstance(library, instanceInfo);
    const scaledGlow = info.scaledGlow;
    const isSunAffected = info.isSunAffected ?? true;  // Default to true for backwards compatibility
    const ambient = info.ambient;

    const object = new CollidingMesh({ geometry, materials, lightInfo: lights, colliderIndices: collider, scaledGlow, isSunAffected, ambient, lods });

    // if (info.name === "StaticMeshActor140")
    //     debugger;

    // debugger;

    object.userData.meshInstance = {
        uuid: instanceInfo.uuid,
        name: instanceInfo.name
    };

    object.userData.mesh = {
        uuid: instanceInfo.mesh.uuid,
        name: instanceInfo.mesh.name
    };

    // if (collider) {
    //     const mat = new MeshBasicMaterial({ opacity: 0.5, wireframe: false, color: 0xff00ff, transparent: true, depthWrite: false, depthTest: true });
    //     const geo = new BufferGeometry();
    //     const indices = new Uint32BufferAttribute(collider, 1);

    //     geo.setIndex(indices)
    //     geo.setAttribute("position", geometry.getAttribute("position"));

    //     const wire = new Mesh(geo, mat);

    //     object.add(wire);
    // }

    applySimpleProperties(library, object, info);

    if (info.name) object.lod0.name = `${info.name}_LOD0`;

    // object.add(new Mesh(geometry, new MeshBasicMaterial({ color: 0xffffff, wireframe: true })))

    return object;
}

function decodeStaticMeshInstance(library: GD.DecodeLibrary, info: GD.IStaticMeshInstanceDecodeInfo) {

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

    let lods: [Object3D, number][] | null = null;

    if (meshInfo.lods) {
        lods = meshInfo.lods.map(([info, distance]) => {
            return [decodeStaticMeshWrapped(library, info), distance];
        });
    }

    const infoMats = library.materials[meshInfo.materials];

    const materials = decodeMaterial(library, infoMats) || (new MeshBasicMaterial({ color: 0xff00ff }) as Material);

    (materials instanceof Array ? materials : [materials]).forEach(mat => {
        if (info.attributes.colors) (mat as any)?.setInstanced?.();
    });

    if (infoGeo.attributes.colors) {
        (materials instanceof Array ? materials : [materials]).forEach(mat => {
            if (!mat) return;

            mat.vertexColors = true;
        });
    }

    const collider = infoGeo.colliderIndices || null;
    const lights = decodeStaticMeshActorLight(library, info.lights);

    return { geometry, materials, collider, lights, lods };
}

function decodeStaticMeshActorLight(library: GD.DecodeLibrary, info?: GD.ILightInstanceDecodeInfo): MeshLight | null {
    if (!info) return null;

    const matrix = new Matrix4().fromArray(info.matrix);
    const buffer = info.flags;

    const [scene, environment] = [info.scene, info.environment].map(elems =>
        elems.map(([uuid, byteOffset, length]) => ({
            light: uuid,
            flags: new Uint8Array(buffer, byteOffset, length)
        }))
    )

    return { matrix, scene, environment };
}

function decodeZoneObject(library: GD.DecodeLibrary, info: GD.IBaseZoneDecodeInfo) {
    const object = new ZoneObject();

    if (info.name) object.name = info.name;
    if (info.name) object.name = info.name;
    if (info.bounds?.isValid) object.setRenderBounds(info.bounds.min, info.bounds.max);
    if (info.fog) object.setFogInfo(info.fog.start, info.fog.end, info.fog.color);
    if (info.isFogZone) object.isFogZone = true;
    if (info.isSunAffected) object.isSunAffected = true;
    if (info.type === "Sky") {
        (object as any).type = "Sky";
        (object as any).isSkyZoneInfo = true;

        // Store the original position for SkyRenderer, but DON'T apply it to the object
        // to avoid double-transforming children (which are already in world space).
        if (info.position) {
            object.userData.skyOrigin = new Vector3().fromArray(info.position);
        } else if ((info as any).location) {
            object.userData.skyOrigin = new Vector3().fromArray((info as any).location);
        }
    }
    if (info.children) info.children.forEach(ch => object.add(decodeObject3D(library, ch)));

    // object.visible = false;

    return object;
}

function decodeBSPSection(library: GD.DecodeLibrary, sectionInfo: GD.IBSPSectionDecodeInfo_T, sectionIndex: number): THREE.Mesh {
    const geometryInfo = library.geometries[sectionInfo.geometry];
    if (!geometryInfo) {
        throw new Error(`Geometry not found for section ${sectionInfo.uuid}`);
    }

    const geometry = fetchGeometry(geometryInfo);
    const materialInfo = library.materials[sectionInfo.material];
    if (!materialInfo) {
        throw new Error(`Material not found for section ${sectionInfo.uuid}`);
    }

    const materials = decodeMaterial(library, materialInfo);

    if (sectionInfo.isUnlit) {
        if (Array.isArray(materials)) {
            materials.forEach(m => (m as any).setUnlit?.());
        } else {
            (materials as any).setUnlit?.();
        }
    }

    // Apply BSP Section overrides
    (Array.isArray(materials) ? materials : [materials]).forEach(m => {
        if (!m) return;
        if (sectionInfo.depthWrite !== undefined) m.depthWrite = sectionInfo.depthWrite;
        if (sectionInfo.depthTest !== undefined) m.depthTest = sectionInfo.depthTest;
        if (sectionInfo.side !== undefined) m.side = sectionInfo.side;
        if (sectionInfo.fog !== undefined) (m as any).fog = sectionInfo.fog;
        if (sectionInfo.blendingMode !== undefined) {
            (m as any).setBlendingMode?.(sectionInfo.blendingMode);
        }
    });

    const mesh = new Mesh(geometry, materials);

    mesh.name = `BSPSection_${sectionInfo.sectionName}`;
    mesh.userData.sectionIndex = sectionIndex;
    mesh.userData.priority = sectionInfo.priority;

    return mesh;
}

function decodeLight(library: GD.DecodeLibrary, info: GD.ILightDecodeInfo | GD.ISunLightDecodeInfo): DynamicLight {
    const light = new DynamicLight({
        lightMethod: info.type,
        isDynamic: info.dynamic,
        colorHSV: new ColorHSV(...info.hsv),
        isSunlightColor: info.isSunlightColor,
        cone: info.cone,
        isDirectional: info.directional,
        lightEffect: info.lightEffect,
        lightType: info.lightType,
        radius: info.radius,
        period: info.period,
        phase: info.phase
    });

    applySimpleProperties(library, light, info);

    return light

    // return {
    //     type: info.type,
    //     isDynamic: info.dynamic,

    //     color: new Color().fromArray(info.color),
    //     cone: info.cone,
    //     isDirectional: info.directional,
    //     lightEffect: info.lightEffect,
    //     lightType: info.lightType,
    //     radius: info.radius,
    // };
}

function decodeSector(library: GD.DecodeLibrary) {
    const sector = new SectorObject();

    sector.name = library.name;
    sector.brightness = library.brightness;

    if (library.sector) sector.index = new Vector2().fromArray(library.sector);

    library.bspZones.forEach(bspZone => sector.zones.add(decodeZoneObject(library, bspZone.zoneInfo)));

    sector.setBSPInfo(library.bspZones, library.bspNodes, library.bspLeaves);
    sector.setLights(library.lightActors.map(info => decodeLight(library, info)))
    library.skyZoneInfos.forEach(info => sector.add(decodeObject3D(library, info)));

    // NEW: Render BSP sections (UE2-style section-based rendering)
    if (library.bspSections && library.bspSections.length > 0) {
        const bspGroup = new Group();
        bspGroup.name = "BSP_Sections";

        // Store BSP rendering data in sector for dynamic visibility updates
        sector.bspSections = library.bspSections;
        sector.nodeToSection = library.nodeToSection;
        sector.nodeZoneMasks = library.nodeZoneMasks;
        sector.bspGroup = bspGroup;
        // Store library reference for updateVisibleBSPSections
        (sector as any).decodeLibrary = library;

        // Separate opaque and transparent sections for proper rendering order
        const opaqueSections: GD.IBSPSectionDecodeInfo_T[] = [];
        const transparentSections: GD.IBSPSectionDecodeInfo_T[] = [];

        library.bspSections.forEach(section => {
            if (section.priority === "opaque") {
                opaqueSections.push(section);
            } else {
                transparentSections.push(section);
            }
        });

        // Add opaque sections first (initially all visible, will be culled dynamically)
        opaqueSections.forEach(section => {
            try {
                const sectionIndex = library.bspSections.indexOf(section);
                const mesh = decodeBSPSection(library, section, sectionIndex);
                mesh.visible = true; // Will be updated by updateVisibleBSPSections
                bspGroup.add(mesh);
            } catch (e) {
                console.warn(`Failed to decode BSP section ${section.uuid}:`, e);
            }
        });

        // Add transparent sections after opaque
        transparentSections.forEach(section => {
            try {
                const sectionIndex = library.bspSections.indexOf(section);
                const mesh = decodeBSPSection(library, section, sectionIndex);
                mesh.visible = true; // Will be updated by updateVisibleBSPSections
                bspGroup.add(mesh);
            } catch (e) {
                console.warn(`Failed to decode BSP section ${section.uuid}:`, e);
            }
        });

        sector.add(bspGroup);
    }

    // ACCURATE UE2: Decode static mesh actors from leaf association
    const staticMeshGroup = new Group();
    staticMeshGroup.name = "StaticMeshActors";
    const uniqueActors = new Map<string, GD.IBaseObjectOrInstanceDecodeInfo>();

    library.leafActors.forEach((leaf: GD.IBaseObjectOrInstanceDecodeInfo[]) => {
        leaf.forEach((actor: GD.IBaseObjectOrInstanceDecodeInfo) => {
            if (actor.type === "StaticMeshActor") {
                uniqueActors.set(actor.uuid, actor);
            }
        });
    });

    uniqueActors.forEach(actor => {
        try {
            const object = decodeObject3D(library, actor);
            staticMeshGroup.add(object);
            sector.staticMeshMap.set(actor.uuid, object);
        } catch (e) {
            console.warn(`Failed to decode static mesh actor ${actor.uuid}:`, e);
        }
    });

    sector.add(staticMeshGroup);
    sector.staticMeshGroup = staticMeshGroup;

    // Decode celestials (NSun, NMoon) with their textures
    library.celestials.forEach(celestialInfo => {
        try {
            console.log(`[Celestials] Processing celestial: type=${celestialInfo.type}, sprites=${celestialInfo.sprites?.length || 0}`);
            if (celestialInfo.sprites && celestialInfo.sprites.length > 0) {
                const spriteUuid = typeof celestialInfo.sprites[0] === 'string'
                    ? celestialInfo.sprites[0]
                    : celestialInfo.sprites[0].uuid || celestialInfo.sprites[0].material;

                let spriteTextureInfo = library.materials[spriteUuid] as GD.ITextureDecodeInfo | GD.IShaderDecodeInfo;
                let texture = null;

                // Handle Shader materials by extracting the diffuse texture
                if (spriteTextureInfo && spriteTextureInfo.materialType === "shader") {
                    const shaderInfo = spriteTextureInfo as GD.IShaderDecodeInfo;
                    if (shaderInfo.diffuse && library.materials[shaderInfo.diffuse]) {
                        spriteTextureInfo = library.materials[shaderInfo.diffuse] as GD.ITextureDecodeInfo;
                    }
                }

                if (spriteTextureInfo) {
                    const mapData = decodeTexture(library, spriteTextureInfo as GD.ITextureDecodeInfo);
                    // decodeTexture returns { texture, size } not { map }
                    texture = (mapData as any)?.texture || null;
                }

                sector.celestials.push({
                    type: celestialInfo.type,
                    sprite: texture,
                    data: celestialInfo
                });
            }
        } catch (e) {
            console.warn("Failed to decode celestial", celestialInfo, e);
        }
    });

    // Add Fog Infos
    library.fogInfos.forEach(info => {
        try {
            const fogObject = decodeObject3D(library, info);
            sector.fogInfos.push(fogObject as FogInfoObject); // Keep reference in array
            sector.add(fogObject); // Add to scene graph
        } catch (e) {
            console.warn("Failed to decode fog info", e);
        }
    });

    // library.bspColliders.forEach(collider => {
    //     const box = new Box3();

    //     if (collider.isValid) {
    //         box.min.fromArray(collider.min)
    //         box.max.fromArray(collider.max)
    //     }

    //     const helper = new Box3Helper(box);

    //     sector.helpers.add(helper);
    // });

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
    //             ([fn, arr]: [(...values: number[]) => number, GD.Vector3Arr]) => {
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

function decodePackage(library: GD.DecodeLibrary) {
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

function decodeTerrainSegment(library: GD.DecodeLibrary, info: GD.IStaticMeshObjectDecodeInfo) {
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

    const terrainInfo = info as any as GD.ITerrainSegmentDecodeInfo;
    const terrain = new Terrain(geometry, materials, {
        segments: [16, 16],
        heightfield,
        bounds,
        mapX: terrainInfo.mapX,
        mapY: terrainInfo.mapY,
        offsetX: terrainInfo.offsetX,
        offsetY: terrainInfo.offsetY,
        heightmapX: terrainInfo.heightmapX,
        heightmapY: terrainInfo.heightmapY
    }, terrainInfo.lighting);

    applySimpleProperties(library, terrain, info);

    return terrain;
}

function decodeBone(library: GD.DecodeLibrary, info: GD.IBoneDecodeInfo): Bone {
    const bone = new Bone();

    bone.name = info.name;

    if (info.position) bone.position.fromArray(info.position);
    if (info.scale) bone.scale.fromArray(info.scale);
    if (info.quaternion) bone.quaternion.fromArray(info.quaternion);

    // if (info.name.includes("R")) {
    //     const geo = new SphereGeometry(5);
    //     const mat = new MeshBasicMaterial({ color: 0xff0000, transparent: true, depthWrite: false, depthTest: false });

    //     const m = new Mesh(geo, mat);

    //     bone.add(m);
    // } /*else if (info.name.includes("L")) {
    //     const geo = new SphereGeometry(5);
    //     const mat = new MeshBasicMaterial({ color: 0x0000ff, transparent: true, depthWrite: false, depthTest: false });

    //     const m = new Mesh(geo, mat);

    //     bone.add(m);
    // } */ else {
    //     const geo = new SphereGeometry(5);
    //     const mat = new MeshBasicMaterial({ color: 0xff00ff, transparent: true, depthWrite: false, depthTest: false });

    //     const m = new Mesh(geo, mat);

    //     bone.add(m);
    // }

    return bone;
}

function decodeBones(library: GD.DecodeLibrary, infos: GD.IBoneDecodeInfo[]): Bone[] {
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

function decodeAnimation(library: GD.DecodeLibrary, name: string, info: IKeyframeDecodeInfo_T[]) {
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

function decodeSkinnedMesh(library: GD.DecodeLibrary, info: GD.ISkinnedMeshObjectDecodeInfo) {
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
    }, {} as Record<string, AnimationClip>);

    mesh.userData.animations = animations;


    return mesh;
}

function decodeEmitterConfig(info: GD.IEmitterDecodeInfo) {
    return {
        acceleration: info.acceleration,
        lifetime: info.lifetime,
        maxParticles: info.maxParticles,
        initial: {
            particlesPerSecond: info.initial.particlesPerSecond,
            scale: info.initial.scale,
            velocity: info.initial.velocity,
            position: info.initial.location,
            angularVelocity: info.initial.angularVelocity,
        },
        particlesPerSecond: info.particlesPerSecond,
        blendingMode: info.blendingMode,
        opacity: info.opacity,
        changesOverLifetime: {
            scale: info.changesOverLifetime.scale
        },
        fadeIn: info.fadeIn,
        fadeOut: info.fadeOut,
        colorMultiplierRange: info.colorMultiplierRange,
        allSettings: info.allSettings
    };
}

function decodeMeshEmitter(library: GD.DecodeLibrary, info: GD.IMeshEmitterDecodeInfo) {
    const infoGeo = library.geometries[info.mesh.geometry] as GD.IGeometryDecodeInfo;

    const geometry = fetchGeometry(infoGeo as GD.IGeometryDecodeInfo);
    const materials = decodeMaterial(library, {
        materialType: "particle",
        material: info.mesh.materials,
        opacity: info.opacity,
        blendingMode: info.blendingMode
    } as GD.IParticleMaterialDecodeInfo) || new MeshBasicMaterial({ color: 0xff00ff });

    const emitter = new MeshEmitter(Object.assign(decodeEmitterConfig(info), { geometry, materials }));

    applySimpleProperties(library, emitter, info);

    return emitter;
}


function decodeSpriteEmitter(library: GD.DecodeLibrary, info: GD.ISpriteEmitterDecodeInfo) {
    const material = decodeMaterial(library, {
        materialType: "particle",
        material: info.texture,
        opacity: info.opacity,
        blendingMode: info.blendingMode
    } as GD.IParticleMaterialDecodeInfo) as any as GD.ParticleMaterialInitSettings_T;

    if (!isFinite(info.maxParticles))
        debugger;

    // debugger;

    const emitter = new SpriteEmitter(Object.assign(decodeEmitterConfig(info), { material }));

    applySimpleProperties(library, emitter, info);

    return emitter;
}

function decodeFogInfo(library: GD.DecodeLibrary, info: GD.IBaseZoneDecodeInfo) {
    const object = new FogInfoObject();

    if (info.name) object.name = info.name;
    if (info.position) object.position.fromArray(info.position); // L2FogInfo is an Actor, has location

    // Convert array ranges [min, max] to objects {A, B} for compatibility with render-manager
    const toRange = (arr: number[] | undefined) => arr ? { A: arr[0], B: arr[1] } : { A: 0, B: 0 };

    object.affectRange = toRange(info.affectRange as any);
    object.fogRange1 = toRange(info.fogRange1 as any);
    object.fogRange2 = toRange(info.fogRange2 as any);
    object.fogRange3 = toRange(info.fogRange3 as any);
    object.fogRange4 = toRange(info.fogRange4 as any);
    object.fogRange5 = toRange(info.fogRange5 as any);
    object.colors = info.colors as any;
    object.zoneMask = (info as any).zoneMask ?? 0n;

    return object;
}

function decodeObject3D(library: GD.DecodeLibrary, info: GD.IBaseObjectOrInstanceDecodeInfo): THREE.Object3D {
    switch (info.type) {
        case "Group":
        case "Level":
        case "TerrainInfo": return decodeSimpleObject(library, Object3D, info as GD.IBaseObjectDecodeInfo);
        case "Emitter": return decodeEmitterObject(library, info as GD.IBaseObjectDecodeInfo);
        case "StaticMeshActor": return decodeStaticMeshActor(library, info as GD.IStaticMeshActorDecodeInfo);
        // case "Light": return decodeLight(library, info as GD.ILightDecodeInfo);
        case "TerrainSegment": return decodeTerrainSegment(library, info as GD.IStaticMeshObjectDecodeInfo);
        case "Model":
        case "StaticMesh": return decodeStaticMeshWrapped(library, info as GD.IStaticMeshObjectDecodeInfo);
        case "Edges": return decodeEdges(library, info as GD.IEdgesObjectDecodeInfo);
        case "SkinnedMesh": return decodeSkinnedMesh(library, info as GD.ISkinnedMeshObjectDecodeInfo);
        case "SpriteEmitter": return decodeSpriteEmitter(library, info as GD.ISpriteEmitterDecodeInfo);
        case "MeshEmitter": return decodeMeshEmitter(library, info as GD.IMeshEmitterDecodeInfo);
        case "L2FogInfo": return decodeFogInfo(library, info as GD.IBaseZoneDecodeInfo);
        case "Zone":
        case "Sky":
        case "SkyZoneInfo": return decodeZoneObject(library, info as any);
        default: throw new Error(`Unsupported object type: ${info.type}`);
    }
}

export default decodeObject3D;
export { decodeObject3D, decodePackage };