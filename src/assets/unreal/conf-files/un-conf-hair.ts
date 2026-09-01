import BaseConfigFile from "./un-base-config";
import type { Vector3Arr } from "../library-types";

export type IDynamicHairCollisionPlaneDecodeInfo = { bone: string; distance: number; };
export type IDynamicHairCollisionSphereDecodeInfo = { bone: string; offset: Vector3Arr; radius: number; };
export type IDynamicHairActionDecodeInfo = { name: string; initial: boolean; initialOffset: Vector3Arr; sphereIndices: number[]; };
export type IDynamicHairConfigDecodeInfo = {
    section: string;
    structuralStiffness: number;
    structuralDamping: number;
    shearStiffness: number;
    shearDamping: number;
    gravity: Vector3Arr;
    velocityDamping: number;
    collisionResponse: number;
    safeFactor: number;
    drawCollisionObject: boolean;
    planes: IDynamicHairCollisionPlaneDecodeInfo[];
    spheres: IDynamicHairCollisionSphereDecodeInfo[];
    actions: IDynamicHairActionDecodeInfo[];
};

function take(values: Map<string, string>, section: string, name: string): string {
    const key = name.toLowerCase();
    const value = values.get(key);

    if (value === undefined) throw new Error(`'[${section}]' has no '${name}'.`);

    values.delete(key);

    return value;
}

function takeNumber(values: Map<string, string>, section: string, name: string): number {
    const value = Number(take(values, section, name));

    if (!Number.isFinite(value)) throw new Error(`'[${section}].${name}' is not a number.`);

    return value;
}

function takeCount(values: Map<string, string>, section: string, name: string): number {
    const value = takeNumber(values, section, name);

    if (!Number.isInteger(value) || value < 0) throw new Error(`'[${section}].${name}' is not a count.`);

    return value;
}

function takeBoolean(values: Map<string, string>, section: string, name: string): boolean {
    const value = take(values, section, name).toLowerCase();

    if (value === "true") return true;
    if (value === "false") return false;

    throw new Error(`'[${section}].${name}' is not a boolean.`);
}

function takeVector(values: Map<string, string>, section: string, name: string): Vector3Arr {
    const value = take(values, section, name);
    const match = /^\(\s*X\s*=\s*([^,]+),\s*Y\s*=\s*([^,]+),\s*Z\s*=\s*([^\)]+)\s*\)$/i.exec(value);

    if (!match) throw new Error(`'[${section}].${name}' is not a vector.`);

    const vector = [Number(match[1]), Number(match[2]), Number(match[3])] as Vector3Arr;

    if (!vector.every(Number.isFinite)) throw new Error(`'[${section}].${name}' is not a vector.`);

    return vector;
}

function parseSection(section: string, lines: string[]): IDynamicHairConfigDecodeInfo {
    const values = new Map<string, string>();

    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith(";")) continue;

        const index = trimmed.indexOf("=");

        if (index < 1) continue;

        const name = trimmed.slice(0, index).trim().toLowerCase();

        if (values.has(name)) throw new Error(`Duplicate '[${section}].${trimmed.slice(0, index).trim()}'.`);

        values.set(name, trimmed.slice(index + 1).trim());
    }

    const drawCollisionObject = takeBoolean(values, section, "bDrawCollisionObject");
    const structuralStiffness = takeNumber(values, section, "SstK");
    const structuralDamping = takeNumber(values, section, "SstD");
    const shearStiffness = takeNumber(values, section, "SshK");
    const shearDamping = takeNumber(values, section, "SshD");
    const gravity = takeVector(values, section, "Gravity");
    const velocityDamping = takeNumber(values, section, "Kd");
    const collisionResponse = takeNumber(values, section, "Kr");
    const safeFactor = takeNumber(values, section, "SafeFactor");
    const planeCount = takeCount(values, section, "CollisionPlaneNum");
    const sphereCount = takeCount(values, section, "CollisionSphereNum");
    const actionCount = takeCount(values, section, "ActionListNum");
    const planes = new Array<IDynamicHairCollisionPlaneDecodeInfo>(planeCount);
    const spheres = new Array<IDynamicHairCollisionSphereDecodeInfo>(sphereCount);
    const actions = new Array<IDynamicHairActionDecodeInfo>(actionCount);

    for (let i = 0; i < planeCount; i++) {
        const index = i + 1;

        planes[i] = { bone: take(values, section, `CollisionPlaneBone${index}`), distance: takeNumber(values, section, `CollisionPlaneDist${index}`) };
    }

    for (let i = 0; i < sphereCount; i++) {
        const index = i + 1;

        spheres[i] = {
            bone: take(values, section, `CollisionSphereBone${index}`),
            offset: takeVector(values, section, `CollisionSphereOffset${index}`),
            radius: takeNumber(values, section, `CollisionSphereradius${index}`)
        };
    }

    for (let i = 0; i < actionCount; i++) {
        const index = i + 1;

        actions[i] = {
            name: take(values, section, `ActionName${index}`),
            initial: takeBoolean(values, section, `ActionInitFlag${index}`),
            initialOffset: takeVector(values, section, `ActionInitOffset${index}`),
            sphereIndices: []
        };
    }

    const sphereIndexCount = takeCount(values, section, "SphereIndexNum");
    const sphereIndices = new Array<number>(sphereIndexCount);

    for (let i = 0; i < sphereIndexCount; i++) {
        const index = takeCount(values, section, `SphereIndex${i + 1}`);

        if (index >= sphereCount) throw new Error(`'[${section}].SphereIndex${i + 1}' references sphere '${index}' of '${sphereCount}'.`);

        sphereIndices[i] = index;
    }

    for (const action of actions) action.sphereIndices = sphereIndices.slice();

    if (values.size > 0) throw new Error(`'[${section}]' has unconsumed key '${values.keys().next().value}'.`);

    return { section, structuralStiffness, structuralDamping, shearStiffness, shearDamping, gravity, velocityDamping, collisionResponse, safeFactor, drawCollisionObject, planes, spheres, actions };
}

class UConfigHair extends BaseConfigFile {
    protected readonly sections = new Map<string, IDynamicHairConfigDecodeInfo>();

    public load(): this {
        if (this.sections.size > 0) return this;

        let section: string = null;
        let lines: string[] = [];

        for (const line of this.decodeConfig().split(/\r?\n/)) {
            const match = /^\s*\[([^\]]+)\]\s*$/.exec(line);

            if (match) {
                if (section) {
                    const key = section.toLowerCase();

                    if (this.sections.has(key)) throw new Error(`Duplicate hair section '[${section}]'.`);

                    this.sections.set(key, parseSection(section, lines));
                }

                section = match[1].trim();
                lines = [];
            } else if (section) lines.push(line);
        }

        if (section) {
            const key = section.toLowerCase();

            if (this.sections.has(key)) throw new Error(`Duplicate hair section '[${section}]'.`);

            this.sections.set(key, parseSection(section, lines));
        }

        if (this.sections.size === 0) throw new Error(`'${this.path}' has no hair sections.`);

        return this;
    }

    public getSectionCount(): number { return this.sections.size; }

    public getDecodeInfo(hairMesh: string, bodyMesh: string): IDynamicHairConfigDecodeInfo {
        if (this.sections.size === 0) throw new Error(`'${this.path}' was not loaded.`);

        const composite = bodyMesh ? `${hairMesh}.${bodyMesh}` : null;
        const info = composite ? this.sections.get(composite.toLowerCase()) || this.sections.get(hairMesh.toLowerCase()) : this.sections.get(hairMesh.toLowerCase());

        if (!info) throw new Error(`Hair config has no '[${composite}]' or '[${hairMesh}]' section.`);

        return info;
    }
}

export default UConfigHair;
export { UConfigHair };
