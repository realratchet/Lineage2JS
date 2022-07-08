import { FNTimeColor, FNTimeHSV } from "./un-time-light";

const staticMeshLight = [
    [0, 138, 182, 0],
    [1, 138, 182, 120],
    [2, 138, 100, 120],
    [3, 138, 182, 120],
    [4, 138, 182, 120],
    [5, 138, 182, 120],
    [6, 138, 182, 0],
    [6, 29, 153, 100],
    [7, 29, 153, 140],
    [8, 29, 153, 160],
    [9, 29, 153, 160],
    [10, 1, 255, 160],
    [11, 1, 255, 160],
    [12, 1, 255, 160],
    [13, 1, 255, 160],
    [14, 1, 255, 160],
    [15, 1, 255, 160],
    [16, 1, 255, 160],
    [17, 1, 255, 160],
    [18, 1, 255, 160],
    [19, 1, 255, 160],
    [20, 1, 255, 160],
    [21, 24, 100, 190],
    [22, 24, 100, 190],
    [23, 24, 100, 190],
    [24, 24, 100, 0]
].map(([t, h, s, v]) => new FNTimeHSV(t, h, s, v));

const staticMeshAmbient = [
    [0, 75, 103, 131],
    [1, 64, 88, 111],
    [2, 64, 88, 111],
    [3, 64, 88, 111],
    [4, 64, 88, 111],
    [5, 64, 88, 111],
    [6, 71, 77, 95],
    [7, 67, 71, 88],
    [8, 67, 71, 88],
    [9, 120, 120, 120],
    [10, 120, 120, 120],
    [11, 120, 120, 120],
    [12, 120, 120, 120],
    [13, 120, 120, 120],
    [14, 120, 120, 120],
    [15, 120, 120, 120],
    [16, 120, 120, 120],
    [17, 120, 120, 120],
    [18, 120, 120, 120],
    [19, 120, 120, 120],
    [20, 120, 120, 120],
    [21, 120, 120, 120],
    [22, 132, 118, 104],
    [23, 132, 118, 104],
    [24, 75, 103, 131],
].map(([t, r, g, b]) => new FNTimeColor(t, r, g, b));

function selectByTime<T extends IBaseTimedConstructable>(timeOfDay: number, array: T[]): T {
    for (let i = 0, len = array.length; i < len; i++) {
        const elem = array[i];

        if (timeOfDay <= elem.time)
            return elem;
    }

    return null;
}

export { selectByTime, staticMeshLight, staticMeshAmbient };