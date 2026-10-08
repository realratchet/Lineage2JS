import type { Vector3Arr } from "@l2js/engine";

type MatineePath_T = { samples: Vector3Arr[], length: number };

const tmpPoints: Vector3Arr[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
const tmpDir: Vector3Arr = [0, 0, 0];
const tmpS: Vector3Arr = [0, 0, 0], tmpU: Vector3Arr = [0, 0, 0], tmpV: Vector3Arr = [0, 0, 0], tmpW: Vector3Arr = [0, 0, 0];
const q = 1 / 99;

function sampleMatineePath(from: Vector3Arr, startControl: Vector3Arr, to: Vector3Arr, endControl: Vector3Arr, pathStyle: "linear" | "bezier"): MatineePath_T {
    for (let i = 0; i < 3; i++) {
        tmpPoints[0][i] = from[i];
        tmpPoints[3][i] = to[i];
        tmpDir[i] = Math.fround(to[i] - from[i]);
    }

    if (pathStyle === "linear") {
        const square = tmpDir[0] * tmpDir[0] + tmpDir[1] * tmpDir[1] + tmpDir[2] * tmpDir[2];
        const length = Math.fround(Math.sqrt(square)), scale = length * Math.fround(1 / 3);

        for (let i = 0; i < 3; i++) {
            const direction = square >= 1e-8 ? Math.fround(tmpDir[i] / Math.sqrt(square)) : tmpDir[i];
            const offset = Math.fround(direction * scale);

            tmpPoints[1][i] = Math.fround(from[i] + offset);
            tmpPoints[2][i] = Math.fround(to[i] - offset);
        }
    } else {
        for (let i = 0; i < 3; i++) {
            tmpPoints[1][i] = Math.fround(from[i] + startControl[i]);
            tmpPoints[2][i] = Math.fround(to[i] + endControl[i]);
        }
    }

    // Engine 0x103886a0: x87 stores differ between vector components.
    for (let i = 0; i < 3; i++) {
        const p0 = tmpPoints[0][i], p1 = tmpPoints[1][i], p2 = tmpPoints[2][i], p3 = tmpPoints[3][i];
        const b = i === 0 ? Math.fround((p1 - p0) * 3) : i === 2 ? Math.fround(p1 - p0) * 3 : (p1 - p0) * 3;
        const c = i === 0 ? Math.fround(Math.fround(Math.fround(p2 - p1 * 2) + p0) * 3) : i === 1 ? Math.fround(Math.fround(p2 - p1 * 2 + p0) * 3) : Math.fround((p2 - p1 * 2 + p0) * 3);
        const d = i === 0 ? Math.fround(Math.fround(Math.fround(p3 - p2 * 3) + p1 * 3) - p0) : i === 1 ? Math.fround(Math.fround(p3 - p2 * 3) + p1 * 3 - p0) : Math.fround(Math.fround(p3 - Math.fround(p2 * 3)) + Math.fround(p1 * 3) - p0);
        const cq = i === 1 ? Math.fround(c * q * q) : Math.fround(Math.fround(c * q) * q);
        const dq = i === 0 ? Math.fround(Math.fround(Math.fround(d * q) * q) * q) : i === 1 ? Math.fround(Math.fround(d * q * q) * q) : Math.fround(Math.fround(d * q) * q * q);

        tmpS[i] = p0;
        tmpU[i] = Math.fround(Math.fround((i === 2 ? b * q : Math.fround(b * q)) + cq) + dq);
        tmpW[i] = Math.fround(Math.fround(Math.fround(Math.fround(d * 6) * q) * q) * q);
        tmpV[i] = Math.fround(Math.fround(Math.fround(c * 2 * q) * q) + tmpW[i]);
    }

    const samples: Vector3Arr[] = [tmpS.slice() as Vector3Arr];
    let length = 0;

    for (let index = 1; index < 100; index++) {
        let square = 0;

        for (let i = 0; i < 3; i++) {
            const before = tmpS[i];

            tmpS[i] = Math.fround(tmpS[i] + tmpU[i]);
            tmpU[i] = Math.fround(tmpU[i] + tmpV[i]);
            tmpV[i] = Math.fround(tmpV[i] + tmpW[i]);
            square += (tmpS[i] - before) * (tmpS[i] - before);
        }

        length = Math.fround(length + Math.sqrt(square));
        samples.push(tmpS.slice() as Vector3Arr);
    }

    return { samples, length };
}

export function interpolateMatineePath(samples: Vector3Arr[], pct: number, target: Vector3Arr) { // Engine 0x1065a590.
    const position = (samples.length - 1) * pct, index = Math.trunc(position), fraction = Math.fround(position - index);
    const point = samples[index];

    for (let i = 0; i < 3; i++) {
        if (!fraction) target[i] = point[i];
        else {
            const next = samples[index + 1];
            const delta = i === 1 ? next[i] - point[i] : Math.fround(next[i] - point[i]);

            target[i] = Math.fround(point[i] + (i === 0 ? Math.fround(delta * fraction) : delta * fraction));
        }
    }
}

export default sampleMatineePath;
