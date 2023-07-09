import { FNTimeColor, FNTimeHSV } from "./un-time-light";

const toHSV = ([t, h, s, v]: number[]) => new FNTimeHSV(t, h, s, v);
const toColor = ([t, r, g, b]: number[]) => new FNTimeColor(t, r, g, b);

const actorLight = [
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
    [24, 24, 100, 0],
].map(toHSV);

const actorAmbient = [
    [0, 75, 103, 131],
    [1, 84, 108, 131],
    [2, 84, 108, 131],
    [3, 84, 108, 131],
    [4, 84, 108, 131],
    [5, 64, 88, 111],
    [6, 90, 97, 120],
    [7, 67, 71, 88],
    [8, 67, 71, 88],
    [9, 67, 71, 88],
    [10, 120, 120, 120],
    [11, 150, 150, 150],
    [12, 150, 150, 150],
    [13, 150, 150, 150],
    [14, 150, 150, 150],
    [15, 150, 150, 150],
    [16, 150, 150, 150],
    [17, 120, 120, 120],
    [18, 120, 120, 120],
    [19, 120, 120, 120],
    [20, 120, 120, 120],
    [21, 120, 120, 120],
    [22, 152, 119, 88],
    [23, 152, 119, 88],
    [24, 75, 103, 131]
].map(toColor);

const terrainLight = [
    [0, 138, 182, 0],
    [1, 138, 182, 200],
    [2, 138, 182, 200],
    [3, 138, 182, 200],
    [4, 138, 182, 200],
    [5, 138, 182, 200],
    [6, 29, 153, 100],
    [7, 29, 153, 450],
    [8, 29, 153, 450],
    [9, 29, 153, 450],
    [10, 1, 255, 160],
    [11, 1, 255, 160],
    [12, 1, 255, 200],
    [13, 1, 255, 200],
    [14, 1, 255, 200],
    [15, 1, 255, 200],
    [16, 1, 255, 160],
    [17, 1, 255, 160],
    [18, 1, 255, 160],
    [19, 1, 255, 160],
    [20, 1, 255, 160],
    [21, 24, 100, 350],
    [22, 24, 100, 350],
    [23, 24, 100, 350],
    [24, 138, 182, 0]
].map(toHSV);

const terrainAmbient = [
    [0, 51, 98, 122],
    [1, 51, 98, 122],
    [2, 51, 98, 122],
    [3, 51, 98, 122],
    [4, 51, 98, 122],
    [5, 51, 98, 122],
    [6, 100, 108, 132],
    [7, 82, 89, 109],
    [8, 82, 89, 109],
    [9, 82, 89, 109],
    [10, 100, 100, 100],
    [11, 120, 120, 120],
    [12, 120, 120, 120],
    [13, 120, 120, 120],
    [14, 120, 120, 120],
    [15, 120, 120, 120],
    [16, 120, 120, 120],
    [17, 100, 100, 100],
    [18, 122, 107, 99],
    [19, 122, 107, 99],
    [20, 122, 107, 99],
    [21, 122, 107, 99],
    [22, 122, 107, 99],
    [23, 123, 96, 72],
    [24, 51, 98, 122]
].map(toColor);

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
].map(toHSV);

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
].map(toColor);

function selectByTime<T extends GD.IBaseTimedConstructable>(timeOfDay: number, array: T[]): T {
    for (let i = 0, len = array.length; i < len; i++) {
        const elem = array[i];

        if (timeOfDay <= elem.time)
            return elem;
    }

    return null;
}

export { selectByTime, terrainLight, terrainAmbient, staticMeshLight, staticMeshAmbient, actorLight, actorAmbient };