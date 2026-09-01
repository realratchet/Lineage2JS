import { Group, Object3D, Mesh, Float32BufferAttribute, Uint16BufferAttribute, BufferGeometry, Sphere, Box3, SphereGeometry, MeshBasicMaterial, Color, AxesHelper, LineBasicMaterial, Line, LineSegments, Uint8BufferAttribute, Uint32BufferAttribute, BufferAttribute, Box3Helper, PlaneHelper, Plane, Vector3, Vector2, Material, Points, PointsMaterial, Skeleton, Bone, SkeletonHelper, KeyframeTrack, VectorKeyframeTrack, QuaternionKeyframeTrack, AnimationClip, Matrix4, Matrix3, Quaternion, Vector4, PlaneGeometry, NormalBlending, AdditiveBlending, CustomBlending, OneFactor, OneMinusSrcColorFactor, SrcAlphaFactor, OneMinusSrcAlphaFactor, DoubleSide, BoxHelper } from "three";
import decodeMaterial, { canonicalizeStaticMeshMaterials, decodeStaticMeshMaterial } from "./material-decoder";
import ZoneObject, { SectorObject, FogInfoObject } from "../../objects/zone-object";
import decodeTexture from "./texture-decoder";
import Terrain from "../../objects/terrain";
import CollidingMesh from "../../objects/colliding-mesh";
import SpriteEmitter from "../../objects/emitters/sprite-emitter";
import MeshEmitter from "../../objects/emitters/mesh-emitter";
import BeamEmitter from "../../objects/emitters/beam-emitter";
import DynamicLight, { ColorHSV } from "../../objects/dynamic-light";
import { batchTerrainSectors, createStaticMeshBatchJob, decodeStaticMeshInstance, makeSwayAttribute, stepStaticMeshBatchJob, StaticMeshBatchJob_T } from "./object-batching";
import MovableObject from "../../objects/movable-object";
import RotatingObject from "../../objects/rotating-object";
import SwayingObject from "../../objects/swaying-object";
import TerrainDecoration from "../../objects/terrain-decoration";
import LocalSpaceSkeleton from "../../objects/local-space-skeleton";
import BSPCollider from "../../objects/bsp-collider";
import LitSkinnedMesh from "../../objects/lit-skinned-mesh";
import UnScriptVM from "../../ue-script/vm";
import Rotator from "../../utils/rotator";
import { GameObject } from "../../game/components";
import type { ParticleMaterialInitSettings_T } from "../../materials/particle-material/particle-material";
import type { DecodeLibrary, IGeometryDecodeInfo, IndexTypedArray, IndexTypedArrayAttribute, IBaseObjectDecodeInfo, IBaseObjectOrInstanceDecodeInfo } from "@l2js/engine";
import type { IAnimationNotifyDecodeInfo, ISkinNotifyDecodeInfo } from "@l2js/engine/contracts/anim-notify";
import type { IEmitterSpawnSoundDecodeInfo, IEmitterActorDecodeInfo, IEmitterDecodeInfo, IMeshEmitterDecodeInfo, ISpriteEmitterDecodeInfo, EmitterConfig_T } from "@l2js/engine/contracts/emitter";
import type { ILightDecodeInfo, ISunLightDecodeInfo } from "@l2js/engine/contracts/light";
import type { IBaseMaterialDecodeInfo, IShaderDecodeInfo, IParticleMaterialDecodeInfo } from "@l2js/engine/contracts/material";
import type { IRotatingDecodeInfo, IEdgesObjectDecodeInfo, IStaticMeshObjectDecodeInfo, IStaticMeshActorDecodeInfo } from "@l2js/engine/contracts/mesh";
import type { IBoneDecodeInfo, IKeyframeDecodeInfo_T, IAnimationSequenceDecodeInfo, ISkinnedMeshObjectDecodeInfo } from "@l2js/engine/contracts/skeletal-mesh";
import type { ITerrainSegmentDecodeInfo, ITerrainDecorationDecodeInfo } from "@l2js/engine/contracts/terrain";
import type { ITextureDecodeInfo } from "@l2js/engine/contracts/texture";
import type { IBaseZoneDecodeInfo, IBSPSectionDecodeInfo_T } from "@l2js/engine/contracts/zone";

const cacheGeometries = new WeakMap<IGeometryDecodeInfo, THREE.BufferGeometry>();
const cacheAnimationSets = new Map<string, Record<string, AnimationClip>>();

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
    if (info.attributes.colors) geometry.setAttribute("color", new BufferAttribute(info.attributes.colors, 3, info.attributes.colors instanceof Uint8Array || info.attributes.colors instanceof Uint8ClampedArray));
    if (info.attributes.colorsInstance) geometry.setAttribute("colorInstance", new BufferAttribute(info.attributes.colorsInstance, 3, info.attributes.colorsInstance instanceof Uint8Array || info.attributes.colorsInstance instanceof Uint8ClampedArray));
    if (info.attributes.skinIndex) geometry.setAttribute("skinIndex", new BufferAttribute(info.attributes.skinIndex, 4));
    if (info.attributes.skinWeight) geometry.setAttribute("skinWeight", new BufferAttribute(info.attributes.skinWeight, 4));
    if (info.attributes.skinIndex2) geometry.setAttribute("skinIndex2", new BufferAttribute(info.attributes.skinIndex2, 4));
    if (info.attributes.skinWeight2) geometry.setAttribute("skinWeight2", new BufferAttribute(info.attributes.skinWeight2, 4));
    if (info.attributes.nodeIndex) geometry.setAttribute("nodeIndex", new BufferAttribute(info.attributes.nodeIndex, 1));
    if (info.attributes.sway) geometry.setAttribute("sway", new BufferAttribute(info.attributes.sway, 4));
    if ((info.attributes as any).terrainIndex) geometry.setAttribute("terrainIndex", new BufferAttribute((info.attributes as any).terrainIndex, 1));

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

        if ((info.bounds as any).box) {
            geometry.boundingBox = geometry.boundingBox || new Box3();
            geometry.boundingBox.min.fromArray((info.bounds as any).box.min);
            geometry.boundingBox.max.fromArray((info.bounds as any).box.max);
        }
    }

    cacheGeometries.set(info, geometry);

    return geometry;
}

function applySimpleProperties<T extends THREE.Object3D>(library: DecodeLibrary, object: T, info: IBaseObjectDecodeInfo) {

    if (info.name) object.name = info.name;
    if (info.scriptClassId) {
        (object as any).scriptClassId = info.scriptClassId;
        (object as any).scriptProperties = new Map(Object.entries(info.scriptProperties || {}));
    }
    if (info.position) object.position.fromArray(info.position);
    if (info.scale) object.scale.fromArray(info.scale);

    if (info.quaternion) object.quaternion.fromArray(info.quaternion);
    else if (info.rotation) object.rotation.fromArray(info.rotation);

    if (info.children) info.children.forEach(ch => object.add(decodeObject3D(library, ch)));

    return object;
}


type EmitterSpawnSound_T = IEmitterSpawnSoundDecodeInfo & { dataUri: string };

class EmitterActor extends GameObject {
    public spawnSound: EmitterSpawnSound_T = null;
    public readonly emitterRotation = new Quaternion();

    protected emitterRotator: Rotator = null;
    protected readonly inverseInitialRotation = new Quaternion();
    protected ratePitch: number = 0;
    protected rateYaw: number = 0;
    protected rateRoll: number = 0;
    protected rotationTime: number;

    public setRotating(info: IRotatingDecodeInfo): void {
        this.emitterRotator = new Rotator(...info.rotator);
        this.emitterRotator.toQuaternion(this.inverseInitialRotation).invert();
        [this.ratePitch, this.rateYaw, this.rateRoll] = info.rate;
    }

    public updateEmitterRotation(currentTime: number): void {
        if (!this.emitterRotator) return;
        if (this.rotationTime === currentTime) return;

        if (this.rotationTime === undefined) {
            this.rotationTime = currentTime;
            return;
        }

        const dt = (currentTime - this.rotationTime) / 1000;

        this.emitterRotator.pitch += this.ratePitch * dt;
        this.emitterRotator.yaw += this.rateYaw * dt;
        this.emitterRotator.roll += this.rateRoll * dt;
        this.emitterRotator.toQuaternion(this.emitterRotation).premultiply(this.inverseInitialRotation);
        this.rotationTime = currentTime;
    }
}

function decodeEmitterObject(library: DecodeLibrary, info: IEmitterActorDecodeInfo) {
    const object = decodeSimpleObject(library, EmitterActor, info);

    if (info.spawnSound) {
        const sound = library.soundBlobCache.get(info.spawnSound.soundName);

        if (!sound?.uri) throw new Error(`Emitter '${info.name}' spawn sound '${info.spawnSound.soundName}' has no audio URI.`);

        object.spawnSound = { ...info.spawnSound, dataUri: sound.uri };
    }

    if (info.rotating) object.setRotating(info.rotating);

    // object.add(new AxesHelper(100));

    if (info.moveEvent && info.moveEvent !== "None") (object as any).moveEvent = info.moveEvent;

    // library.leafActors (and this wrapper's bounds/zoneMask) are keyed by info.uuid,
    // not each sub-emitter's own uuid - propagate it down so render-manager's Pass 2
    // can look up BSP visibility for the actual particlePool-bearing children
    for (let i = 0; i < object.children.length; i++) {
        const child = object.children[i] as any;

        // AEmitter::Render (0x8a2b60) renders Emitters(i) in ascending array order.
        child.setRenderOrder(i);

        if (info.bounds) child.emitterActorUuid = info.uuid;
        else child.isActorAttachedEmitter = true;
    }

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
    let infoGeo = library.geometries[info.geometry];
    const infoMats = library.materials[info.materials];
    const sway = info.sway ? makeSwayAttribute((infoGeo.attributes.positions as Float32Array).length / 3, info.sway) : null;

    if (sway) infoGeo = { ...infoGeo, attributes: { ...infoGeo.attributes, sway } };

    const materials = decodeStaticMeshMaterial(library, infoMats, !!infoGeo.attributes.colors, false, !!sway) || new MeshBasicMaterial({ color: 0xff00ff });
    const geometry = fetchGeometry(infoGeo as IGeometryDecodeInfo);

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

// function decodeLight(library: DecodeLibrary, info: ILightDecodeInfo): THREE.Mesh {
//     const geo = new SphereGeometry(info.radius, 32, 32);
//     const mat = new MeshBasicMaterial({ color: new Color().fromArray(info.color), wireframe: true });
//     const msh = new Mesh(geo, mat);

//     msh.add(new AxesHelper(info.radius));

//     applySimpleProperties(library, msh, info);

//     return msh;
// }

function decodeStaticMeshActor(library: DecodeLibrary, info: IStaticMeshActorDecodeInfo): CollidingMesh {
    const instanceInfo = info.instance;
    const { geometry, materials, collider, lights, staticMeshCollision, collisionIndex } = decodeStaticMeshInstance(library, instanceInfo, fetchGeometry);
    const scaledGlow = info.scaledGlow;
    const isSunAffected = info.isSunAffected ?? true;
    const ambient = info.ambient;

    const props = { geometry, materials, lightInfo: lights, colliderIndices: collider, scaledGlow, isSunAffected, ambient, collision: info.collision, staticMeshCollision, collisionIndex };
    const object = info.mover ? new MovableObject({ ...props, mover: info.mover })
        : info.swaying ? new SwayingObject({ ...props, swaying: info.swaying })
            : info.rotating ? new RotatingObject({ ...props, rotating: info.rotating })
                : new CollidingMesh(props);

    object.material = canonicalizeStaticMeshMaterials(object.material);

    // if (info.name === "StaticMeshActor140")
    //     debugger;

    // debugger;

    (object as any).meshInstance = {
        uuid: instanceInfo.uuid,
        name: instanceInfo.name
    };

    (object as any).mesh = {
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

    // object.add(new Mesh(geometry, new MeshBasicMaterial({ color: 0xffffff, wireframe: true })))

    return object;
}

function decodeZoneObject(library: DecodeLibrary, info: IBaseZoneDecodeInfo) {
    const object = new ZoneObject();

    if (info.name) object.name = info.name;
    if (info.bounds?.isValid) object.setRenderBounds(info.bounds.min, info.bounds.max);
    if (info.fog) object.setFogInfo(info.fog.start, info.fog.end, info.fog.color);
    if (info.isFogZone) object.isFogZone = true;
    if (info.isSunAffected) object.isSunAffected = true;
    if (info.type === "Sky") {
        (object as any).type = "Sky";
        (object as any).isSkyZoneInfo = true;

        // original position for SkyRenderer only, applying it would double-transform the already-world-space children
        if (info.position) {
            (object as any).skyOrigin = new Vector3().fromArray(info.position);
        } else if ((info as any).location) {
            (object as any).skyOrigin = new Vector3().fromArray((info as any).location);
        }
    }
    if (info.children) info.children.forEach(ch => object.add(decodeObject3D(library, ch)));

    // object.visible = false;

    return object;
}

function decodeBSPSection(library: DecodeLibrary, sectionInfo: IBSPSectionDecodeInfo_T, sectionIndex: number): THREE.Mesh {
    const geometryInfo = library.geometries[sectionInfo.geometry];
    if (!geometryInfo) {
        throw new Error(`Geometry not found for section ${sectionInfo.uuid}`);
    }

    const geometry = fetchGeometry(geometryInfo);
    const materialInfo = library.materials[sectionInfo.material];
    if (!materialInfo) {
        throw new Error(`Material not found for section ${sectionInfo.uuid}`);
    }

    // if (sectionInfo.sectionName.startsWith("Texture_Cm_o_wall010_")) debugger;

    const materials = decodeMaterial(library, materialInfo);

    if (sectionInfo.isUnlit) {
        if (Array.isArray(materials)) {
            materials.forEach(m => (m as any).setUnlit?.());
        } else {
            (materials as any).setUnlit?.();
        }
    }

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
    (mesh as any).sectionIndex = sectionIndex;
    (mesh as any).priority = sectionInfo.priority;

    return mesh;
}

function decodeLight(library: DecodeLibrary, info: ILightDecodeInfo | ISunLightDecodeInfo): DynamicLight {
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

export function decodeSectorCore(library: DecodeLibrary) {
    const sector = new SectorObject();

    sector.name = library.name;
    sector.brightness = library.brightness;
    sector.scriptVM = new UnScriptVM(library);

    if (library.sector) {
        sector.index = new Vector2().fromArray(library.sector);
        const sectorSize = 256 * 128;
        const minX = (sector.index.x - 20) * sectorSize;
        const minZ = (sector.index.y - 18) * sectorSize;
        sector.gridBounds.min.set(minX, -262144, minZ);
        sector.gridBounds.max.set(minX + sectorSize, 262144, minZ + sectorSize);
    }

    library.bspZones.forEach(bspZone => sector.zones.add(decodeZoneObject(library, bspZone.zoneInfo)));

    sector.setBSPInfo(library.bspZones, library.bspNodes, library.bspLeaves);
    sector.setLights(library.lightActors.map(info => decodeLight(library, info)))
    library.skyZoneInfos.forEach(info => sector.add(decodeObject3D(library, info)));
    sector.musicVolumes = library.musicVolumes;
    sector.waterVolumes = library.waterVolumes;
    sector.ambientSounds = library.ambientSounds;

    for (const volume of sector.waterVolumes) sector.scriptVM.initializeHost(volume);

    for (const pawnInfo of library.pawnActors)
        sector.pawns.add(decodeObject3D(library, pawnInfo));

    // traverseBSP/static mesh visibility need these even without renderable BSP sections
    (sector as any).decodeLibrary = library;
    sector.nodeToSection = library.nodeToSection;
    sector.nodeZoneMasks = library.nodeZoneMasks;

    if (library.bspNodes.some(node => !!node.collision)) sector.add(new BSPCollider(library.bspNodes));

    if (library.bspSections && library.bspSections.length > 0) {
        const bspGroup = new Group();
        bspGroup.name = "BSP_Sections";

        sector.bspSections = library.bspSections;
        sector.bspGroup = bspGroup;

        const opaqueSections: IBSPSectionDecodeInfo_T[] = [];
        const transparentSections: IBSPSectionDecodeInfo_T[] = [];

        library.bspSections.forEach(section => {
            if (section.priority === "opaque") {
                opaqueSections.push(section);
            } else {
                transparentSections.push(section);
            }
        });

        opaqueSections.forEach(section => {
            try {
                const sectionIndex = library.bspSections.indexOf(section);
                const mesh = decodeBSPSection(library, section, sectionIndex);
                mesh.visible = true;
                bspGroup.add(mesh);
            } catch (e) {
                console.warn(`Failed to decode BSP section ${section.uuid}:`, e);
            }
        });

        transparentSections.forEach(section => {
            try {
                const sectionIndex = library.bspSections.indexOf(section);
                const mesh = decodeBSPSection(library, section, sectionIndex);
                mesh.visible = true;
                bspGroup.add(mesh);
            } catch (e) {
                console.warn(`Failed to decode BSP section ${section.uuid}:`, e);
            }
        });

        sector.add(bspGroup);
    }

    return sector;
}

export type SectorStaticMeshDecodeJob_T = StaticMeshBatchJob_T;

export function createSectorStaticMeshDecodeJob(library: DecodeLibrary, sector: SectorObject): SectorStaticMeshDecodeJob_T {
    const staticMeshGroup = new Group();
    staticMeshGroup.name = "StaticMeshActors";

    return createStaticMeshBatchJob(library, sector, staticMeshGroup, fetchGeometry, decodeObject3D);
}

export function stepSectorStaticMeshDecodeJob(job: SectorStaticMeshDecodeJob_T): boolean {
    if (!stepStaticMeshBatchJob(job)) return false;

    finishSectorStaticMeshes(job.library, job.sector);
    return true;
}

function finishSectorStaticMeshes(library: DecodeLibrary, sector: SectorObject) {

    // here, not decodePackage - the live app builds static meshes via this progressive path (asset-manager processPendingBuilds)
    attachMoveEventActors(sector);

    library.celestials.forEach(celestialInfo => {
        try {
            // console.log(`[Celestials] Processing celestial: type=${celestialInfo.type}, sprites=${celestialInfo.sprites?.length || 0}`);
            if (celestialInfo.sprites && celestialInfo.sprites.length > 0) {
                const spriteUuid = celestialInfo.sprites[0];
                const materialInfo = library.materials[spriteUuid] as IBaseMaterialDecodeInfo;
                // NSun only ever uses .sprite
                const material = celestialInfo.type === "Moon" ? decodeMaterial(library, materialInfo) : null;
                let spriteTextureInfo = materialInfo as ITextureDecodeInfo | IShaderDecodeInfo;
                let texture = null;

                if (spriteTextureInfo && spriteTextureInfo.materialType === "shader") {
                    const shaderInfo = spriteTextureInfo as IShaderDecodeInfo;
                    if (shaderInfo.diffuse && library.materials[shaderInfo.diffuse]) {
                        spriteTextureInfo = library.materials[shaderInfo.diffuse] as ITextureDecodeInfo;
                    }
                }

                if (spriteTextureInfo) {
                    const mapData = decodeTexture(library, spriteTextureInfo as ITextureDecodeInfo);
                    texture = (mapData as any)?.texture || null;
                }

                sector.celestials.push({
                    type: celestialInfo.type,
                    sprite: texture,
                    material,
                    data: celestialInfo
                });
            }
        } catch (e) {
            console.warn("Failed to decode celestial", celestialInfo, e);
        }
    });

    library.fogInfos.forEach(info => {
        try {
            const fogObject = decodeObject3D(library, info);
            sector.fogInfos.push(fogObject as FogInfoObject);
            sector.add(fogObject);
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

export function decodeSectorStaticMeshes(library: DecodeLibrary, sector: SectorObject) {
    const job = createSectorStaticMeshDecodeJob(library, sector);

    while (!stepSectorStaticMeshDecodeJob(job)) { }

    return sector;
}

export function decodePackage(library: DecodeLibrary) {
    const sector = decodeSectorCore(library);
    decodeSectorStaticMeshes(library, sector);

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

function attachMoveEventActors(sector: SectorObject) {
    const swayByTag = new Map<string, SwayingObject>();

    for (const child of (sector as any).staticMeshGroup?.children ?? [])
        if ((child as any).isSwayingObject)
            for (const tag of (child as any).swaying.tags) swayByTag.set(tag, child);

    if (swayByTag.size === 0) return;

    sector.zones.traverse(object => {
        const moveEvent = (object as any).moveEvent;
        if (!moveEvent) return;

        const sway = swayByTag.get(moveEvent);
        if (sway) sway.attachActor(object);
    });
}

function decodeTerrainInfo(library: DecodeLibrary, info: IBaseObjectDecodeInfo) {
    const group = new Object3D();
    applySimpleProperties(library, group, info);

    const sectors: Terrain[] = [];
    const decorations: TerrainDecoration[] = [];
    group.children.forEach(child => {
        if ((child as any).isTerrain) {
            sectors.push(child as Terrain);
        } else if ((child as any).isTerrainDecoration) {
            decorations.push(child as TerrainDecoration);
        }
    });

    const sectorsByUuid = new Map<string, Terrain>();
    sectors.forEach(sector => sectorsByUuid.set(sector.terrainSegmentUuid, sector));
    decorations.forEach(decoration => {
        const terrain = sectorsByUuid.get(decoration.terrainSegment);
        if (!terrain) throw new Error(`Terrain segment '${decoration.terrainSegment}' not found for decoration '${decoration.name}'`);
        decoration.setTerrain(terrain);
    });

    batchTerrainSectors(library, group, sectors);

    return group;
}

function decodeTerrainSegment(library: DecodeLibrary, info: IStaticMeshObjectDecodeInfo) {
    const infoGeo = library.geometries[info.geometry];
    const { geometry, materials } = decodeStaticMeshData(library, info);

    const { min, max } = (infoGeo.bounds as any).box;

    const bounds = new Box3();

    bounds.min.fromArray(min);
    bounds.max.fromArray(max);

    const terrainInfo = info as any as ITerrainSegmentDecodeInfo;
    const terrain = new Terrain(geometry, materials, {
        bounds,
        mapX: terrainInfo.mapX,
        mapY: terrainInfo.mapY,
        offsetX: terrainInfo.offsetX,
        offsetY: terrainInfo.offsetY,
        heightmapX: terrainInfo.heightmapX,
        heightmapY: terrainInfo.heightmapY
    }, terrainInfo.lighting);

    applySimpleProperties(library, terrain, info);
    terrain.terrainSegmentUuid = info.uuid;

    return terrain;
}

function decodeTerrainDecoration(library: DecodeLibrary, info: ITerrainDecorationDecodeInfo) {
    const mesh = info.mesh;
    let geometryInfo = library.geometries[mesh.geometry];
    const sway = mesh.sway ? makeSwayAttribute((geometryInfo.attributes.positions as Float32Array).length / 3, mesh.sway) : null;

    if (sway) geometryInfo = { ...geometryInfo, attributes: { ...geometryInfo.attributes, sway } };

    const geometry = fetchGeometry(geometryInfo);
    const materialInfo = library.materials[mesh.materials];
    const materials = decodeStaticMeshMaterial(library, materialInfo, !!geometryInfo.attributes.colors, true, !!sway, true) || new MeshBasicMaterial({ color: 0xff00ff });

    return new TerrainDecoration(geometry, materials, info);
}

function decodeBone(library: DecodeLibrary, info: IBoneDecodeInfo): Bone {
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

function decodeAnimation(library: DecodeLibrary, name: string, info: IKeyframeDecodeInfo_T[], sequence: IAnimationSequenceDecodeInfo, notifications: IAnimationNotifyDecodeInfo[], skinNotify: ISkinNotifyDecodeInfo) {
    const tracks = info.map(info => {
        let KeyframeTrackConstructor: typeof KeyframeTrack;

        switch (info.type) {
            case "Quaternion": KeyframeTrackConstructor = QuaternionKeyframeTrack; break;
            case "Vector": KeyframeTrackConstructor = VectorKeyframeTrack; break;
        }

        return new KeyframeTrackConstructor(info.name, info.times, info.values)
    });

    const clip = new AnimationClip(name, -1, tracks);

    (clip as any).attackEffectFrame = sequence.attackEffectFrame;
    (clip as any).attackEndEffectFrame = sequence.attackEndEffectFrame;
    (clip as any).animationNotifies = notifications;
    (clip as any).skinNotify = skinNotify;

    return clip;
}

function decodeAnimations(library: DecodeLibrary, info: ISkinnedMeshObjectDecodeInfo): Record<string, AnimationClip> {
    if (info.animationSet && cacheAnimationSets.has(info.animationSet))
        return cacheAnimationSets.get(info.animationSet)!;

    if (info.animationSet && Object.keys(info.animations).length === 0)
        throw new Error(`Animation set '${info.animationSet}' has not been decoded.`);

    const animations = Object.keys(info.animations).reduce((acc, k) => {
        acc[k] = decodeAnimation(library, k, info.animations[k], info.animationSequences[k], info.animationNotifies[k] || [], info.skinNotifies[k]);

        return acc;
    }, {} as Record<string, AnimationClip>);

    if (info.animationSet) cacheAnimationSets.set(info.animationSet, animations);

    return animations;
}

function prepareSkinnedMaterials(materials: THREE.Material | THREE.Material[], extendedBoneInfluences: boolean): void {
    const arrMaterials = Array.isArray(materials) ? materials : [materials];

    for (const material of arrMaterials) {
        if (extendedBoneInfluences) (material as any).setExtendedBoneInfluences?.();
        (material as any).setActorLit?.();
    }
}

function decodeSkinnedMesh(library: DecodeLibrary, info: ISkinnedMeshObjectDecodeInfo) {
    const geometry = fetchGeometry(library.geometries[info.geometry]);
    const infoMats = library.materials[info.materials];

    // LodMesh wire data is points + wedges only, UE builds vertex normals at load (UnMesh.cpp)
    if (!geometry.getAttribute("normal")) {
        geometry.computeVertexNormals();

        // wedges keep UE's winding, which ue2-conventions.ts undoes by flipping X in clip space
        const arrNormals = geometry.getAttribute("normal").array as Float32Array;

        for (let i = 0, len = arrNormals.length; i < len; i++) arrNormals[i] = -arrNormals[i];
    }

    const materials = decodeMaterial(library, infoMats) || new MeshBasicMaterial({ color: 0xff00ff });
    const extendedBoneInfluences = geometry.getAttribute("skinWeight2") !== undefined;

    const bones = decodeBones(library, info.skeleton);
    const skeleton = new LocalSpaceSkeleton(bones);

    const mesh = new LitSkinnedMesh(geometry, materials);

    mesh.scaledGlow = info.scaledGlow ?? 1;
    mesh.ambientGlow = info.ambient?.glow ?? 0;
    mesh.isUnlit = info.ambient?.isUnlit ?? false;

    if (info.dynamicHair) mesh.dynamicHairInfo = info.dynamicHair;

    prepareSkinnedMaterials(materials, extendedBoneInfluences);

    mesh.position.fromArray(info.meshOrigin);
    mesh.quaternion.fromArray(info.meshRotOriginQuaternion);
    mesh.scale.fromArray(info.meshScale);

    mesh.add(bones[0]);
    mesh.bind(skeleton);

    bones[0].visible = false; // projectObject returns at an invisible node, so the chain stays out of the renderer's per-frame walk

    skeleton.mesh = mesh;
    mesh.bindMode = "detached"; // the skeleton already brings its bones into mesh space

    const animations = decodeAnimations(library, info);
    const skinMaterials: Record<number, THREE.Material> = {};

    if (info.skinMaterials) {
        for (const [key, uuid] of Object.entries(info.skinMaterials)) {
            const material = decodeMaterial(library, library.materials[uuid]);

            if (Array.isArray(material)) throw new Error(`Skin material '${uuid}' decoded as a material group.`);

            prepareSkinnedMaterials(material, extendedBoneInfluences);
            skinMaterials[parseInt(key, 10)] = material;
        }
    }

    (mesh as any).meshAnimations = animations; // .animations is taken by three's own AnimationClip[] slot
    (mesh as any).animationNotifies = info.animationNotifies;
    (mesh as any).skinMaterials = skinMaterials;

    applySimpleProperties(library, mesh, info);

    return mesh;
}

function decodeEmitterConfig(info: IEmitterDecodeInfo) {
    return {
        acceleration: info.acceleration,
        lifetime: info.lifetime,
        maxParticles: info.maxParticles,
        drawScale: info.drawScale,
        rotationOffset: info.rotationOffset,
        initial: {
            particlesPerSecond: info.initial.particlesPerSecond,
            scale: info.initial.scale,
            velocity: info.initial.velocity,
            position: info.initial.position,
            offset: info.initial.offset,
            angularVelocity: info.initial.angularVelocity,
        },
        particlesPerSecond: info.particlesPerSecond,
        blendingMode: info.blendingMode,
        opacity: info.opacity,
        changesOverLifetime: {
            scale: info.changesOverLifetime.scale,
            velocity: (info.changesOverLifetime as any).velocity ?? null,
            color: (info.changesOverLifetime as any).color ?? null
        },
        fadeIn: info.fadeIn,
        fadeOut: info.fadeOut,
        colorMultiplierRange: info.colorMultiplierRange,
        angularVelocity: info.angularVelocity,
        revolutionCenterOffsetRange: info.revolutionCenterOffsetRange,
        revolutionsPerSecondRange: info.revolutionsPerSecondRange,
        initialTimeRange: info.initialTimeRange,
        startMassRange: info.startMassRange,
        sphereRadiusRange: info.sphereRadiusRange,
        startLocationPolarRange: info.startLocationPolarRange,
        addVelocityMultiplierRange: info.addVelocityMultiplierRange,
        velocityLossRange: info.velocityLossRange,
        warmupTime: info.warmupTime,
        warmupTicksPerSecond: info.warmupTicksPerSecond,
        settings: info.settings
    };
}

function decodeMeshEmitter(library: DecodeLibrary, info: IMeshEmitterDecodeInfo) {
    const infoGeo = library.geometries[info.mesh.geometry] as IGeometryDecodeInfo;

    const geometry = fetchGeometry(infoGeo as IGeometryDecodeInfo);
    const materials = decodeMaterial(library, {
        materialType: "particle",
        material: info.mesh.materials,
        opacity: info.opacity,
        blendingMode: info.blendingMode
    } as IParticleMaterialDecodeInfo) as any as ParticleMaterialInitSettings_T | ParticleMaterialInitSettings_T[];

    const emitter = new MeshEmitter(Object.assign(decodeEmitterConfig(info), { geometry, materials }));

    applySimpleProperties(library, emitter, info);

    return emitter;
}


function decodeSpriteEmitter(library: DecodeLibrary, info: ISpriteEmitterDecodeInfo) {
    const material = decodeMaterial(library, {
        materialType: "particle",
        material: info.texture,
        opacity: info.opacity,
        blendingMode: info.blendingMode
    } as IParticleMaterialDecodeInfo) as any as ParticleMaterialInitSettings_T;

    if (!isFinite(info.maxParticles))
        debugger;

    // debugger;

    const emitter = new SpriteEmitter(Object.assign(decodeEmitterConfig(info), {
        material,
        spriteDirection: info.spriteDirection,
        projectionNormal: info.projectionNormal
    }));

    applySimpleProperties(library, emitter, info);

    return emitter;
}

function decodeBeamEmitter(library: DecodeLibrary, info: any) {
    const material = decodeMaterial(library, {
        materialType: "particle",
        material: info.texture,
        opacity: info.opacity,
        blendingMode: info.blendingMode
    } as IParticleMaterialDecodeInfo) as any as ParticleMaterialInitSettings_T;

    const emitter = new BeamEmitter(Object.assign(decodeEmitterConfig(info), {
        material,
        beam: info.beam
    }));

    applySimpleProperties(library, emitter, info);

    return emitter;
}

function decodeFogInfo(library: DecodeLibrary, info: IBaseZoneDecodeInfo) {
    const object = new FogInfoObject();

    if (info.name) object.name = info.name;
    if (info.position) object.position.fromArray(info.position);

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

export function decodeObject3D(library: DecodeLibrary, info: IBaseObjectOrInstanceDecodeInfo | EmitterConfig_T): THREE.Object3D {
    switch (info.type) {
        case "Group":
        case "Level":
        case "TerrainInfo": return decodeTerrainInfo(library, info as IBaseObjectDecodeInfo);
        case "Emitter": return decodeEmitterObject(library, info as IEmitterActorDecodeInfo);
        case "StaticMeshActor": return decodeStaticMeshActor(library, info as IStaticMeshActorDecodeInfo);
        // case "Light": return decodeLight(library, info as ILightDecodeInfo);
        case "TerrainSegment": return decodeTerrainSegment(library, info as IStaticMeshObjectDecodeInfo);
        case "TerrainDecoration": return decodeTerrainDecoration(library, info as ITerrainDecorationDecodeInfo);
        case "Model":
        case "StaticMesh": return decodeStaticMeshWrapped(library, info as IStaticMeshObjectDecodeInfo);
        case "Edges": return decodeEdges(library, info as IEdgesObjectDecodeInfo);
        case "SkinnedMesh": return decodeSkinnedMesh(library, info as ISkinnedMeshObjectDecodeInfo);
        case "SpriteEmitter": return decodeSpriteEmitter(library, info as ISpriteEmitterDecodeInfo);
        case "MeshEmitter": return decodeMeshEmitter(library, info as IMeshEmitterDecodeInfo);
        case "BeamEmitter": return decodeBeamEmitter(library, info);
        case "L2FogInfo": return decodeFogInfo(library, info as IBaseZoneDecodeInfo);
        case "Zone":
        case "Sky":
        case "SkyZoneInfo": return decodeZoneObject(library, info as any);
        default: throw new Error(`Unsupported object type: ${info.type}`);
    }
}

export default decodeObject3D;
