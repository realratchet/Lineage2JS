import { Vector3 } from "three";

const tmpNormalA = new Vector3(), tmpNormalB = new Vector3(), tmpNormalC = new Vector3();

export function computePointNormals(positions: Float32Array, index: Uint8Array | Uint16Array | Uint32Array) { // per point, not per wedge: area-weighted over every face at the position (cruma_inside VB, call 3369562, matches exactly)
    const arrPoints = new Uint32Array(positions.length / 3), cachePoints = new Map<string, number>();
    const pointNormals = new Float32Array(positions.length), normals = new Float32Array(positions.length);

    for (let i = 0; i < arrPoints.length; i++) {
        const key = `${positions[i * 3]},${positions[i * 3 + 1]},${positions[i * 3 + 2]}`;

        if (!cachePoints.has(key)) cachePoints.set(key, i);

        arrPoints[i] = cachePoints.get(key);
    }

    for (let i = 0; i < index.length; i += 3) {
        tmpNormalA.fromArray(positions, index[i] * 3);
        tmpNormalB.fromArray(positions, index[i + 1] * 3).sub(tmpNormalA);
        tmpNormalC.fromArray(positions, index[i + 2] * 3).sub(tmpNormalA);
        tmpNormalB.cross(tmpNormalC);

        for (let k = 0; k < 3; k++) {
            const point = arrPoints[index[i + k]] * 3;

            pointNormals[point] += tmpNormalB.x;
            pointNormals[point + 1] += tmpNormalB.y;
            pointNormals[point + 2] += tmpNormalB.z;
        }
    }

    // wedges keep UE's winding, which ue2-conventions.ts undoes by flipping X in clip space
    for (let i = 0; i < arrPoints.length; i++)
        tmpNormalA.fromArray(pointNormals, arrPoints[i] * 3).normalize().negate().toArray(normals, i * 3);

    return normals;
}

export default computePointNormals;
