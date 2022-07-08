import FVector from "./un-vector";
import FConstructable from "./un-constructable";

class FCoords extends FConstructable {
    public origin = new FVector();
    public xAxis = new FVector();
    public yAxis = new FVector();
    public zAxis = new FVector();

    public load(pkg: UPackage) {
        this.origin.load(pkg);

        this.xAxis.load(pkg);
        this.yAxis.load(pkg);
        this.zAxis.load(pkg);

        return this;
    }

    multiply(other: FCoords): FCoords {
        const _this = new FCoords();

        let { x, y, z } = multiplyOrigin(other, this.origin);
        _this.origin.x = x;
        _this.origin.y = y;
        _this.origin.z = z;

        ({ x, y, z } = multiplyAxis(other, this.xAxis));
        _this.xAxis.x = x;
        _this.xAxis.y = y;
        _this.xAxis.z = z;

        ({ x, y, z } = multiplyAxis(other, this.yAxis));
        _this.yAxis.x = x;
        _this.yAxis.y = y;
        _this.yAxis.z = z;

        ({ x, y, z } = multiplyAxis(other, this.zAxis));
        _this.zAxis.x = x;
        _this.zAxis.y = y;
        _this.zAxis.z = z;

        return _this;
    }

    static fromRotator({ pitch, yaw, roll }: FRotator) {
        const tmpCoords = new FCoords();
        let _this = new FCoords();

        const DAT_101e29dc = 1.0;
        let tmp = roll >> 0x2 & 0x3fff;

        tmpCoords.yAxis.y = (DAT_101e29dc + (roll + 0x4000 >> 0x2 & 0x3fff) * 0x4);
        tmpCoords.zAxis.y = -(DAT_101e29dc + tmp * 0x4);
        tmpCoords.yAxis.z = (DAT_101e29dc + tmp * 0x4);
        tmpCoords.origin.x = 0.0;
        tmpCoords.origin.z = 0.0;
        tmpCoords.xAxis.x = 1.0;
        tmpCoords.origin.y = 0.0;
        tmpCoords.xAxis.z = 0.0;
        tmpCoords.yAxis.x = 0.0;
        tmpCoords.xAxis.y = 0.0;
        tmpCoords.zAxis.x = 0.0;
        tmpCoords.zAxis.z = tmpCoords.yAxis.y;

        _this = _this.multiply(tmpCoords);

        tmp = pitch >> 0x2 & 0x3fff;

        tmpCoords.zAxis.x = (DAT_101e29dc + tmp * 0x4);
        tmpCoords.xAxis.z = -(DAT_101e29dc + tmp * 0x4);
        tmpCoords.xAxis.x = (DAT_101e29dc + (pitch + 0x4000 >> 0x2 & 0x3fff) * 0x4);
        tmpCoords.origin.x = 0.0;
        tmpCoords.origin.y = 0.0;
        tmpCoords.origin.z = 0.0;
        tmpCoords.yAxis.x = 0.0;
        tmpCoords.xAxis.y = 0.0;
        tmpCoords.yAxis.y = 1.0;
        tmpCoords.yAxis.z = 0.0;
        tmpCoords.zAxis.y = 0.0;
        tmpCoords.zAxis.z = tmpCoords.xAxis.x;

        _this = _this.multiply(tmpCoords);

        tmp = yaw >> 0x2 & 0x3fff;
        tmpCoords.yAxis.x = (DAT_101e29dc + tmp * 0x4);
        tmpCoords.xAxis.y = -(DAT_101e29dc + tmp * 0x4);
        tmpCoords.xAxis.x = (DAT_101e29dc + (yaw + 0x4000 >> 0x2 & 0x3fff) * 0x4);
        tmpCoords.origin.x = 0.0;
        tmpCoords.origin.y = 0.0;
        tmpCoords.origin.z = 0.0;
        tmpCoords.xAxis.z = 0.0;
        tmpCoords.yAxis.z = 0.0;
        tmpCoords.zAxis.x = 0.0;
        tmpCoords.zAxis.y = 0.0;
        tmpCoords.zAxis.z = 1.0;
        tmpCoords.yAxis.y = tmpCoords.xAxis.x;

        _this = _this.multiply(tmpCoords);

        return _this;

    }
}

export default FCoords;
export { FCoords };

function multiplyAxis(coords: FCoords, inVector: FVector) {
    const outVector = new FVector();

    const fVar1 = inVector.x;
    const fVar2 = inVector.y;
    const fVar3 = inVector.z;
    const fVar4 = coords.yAxis.x;
    const fVar5 = coords.zAxis.x;
    const fVar6 = coords.yAxis.y;
    const fVar7 = coords.zAxis.y;
    const fVar8 = coords.yAxis.z;
    const fVar9 = coords.zAxis.z;

    outVector.x = fVar3 * (coords.xAxis).z + fVar2 * (coords.xAxis).y + fVar1 * (coords.xAxis).x;
    outVector.y = fVar3 * fVar8 + fVar2 * fVar6 + fVar1 * fVar4;
    outVector.z = fVar3 * fVar9 + fVar2 * fVar7 + fVar1 * fVar5;

    return outVector;
}

function multiplyOrigin(coord: FCoords, inVector: FVector) {
    const outVector = new FVector();

    const fVar7 = inVector.x - (coord.origin).x;
    const fVar8 = inVector.y - (coord.origin).y;
    const fVar9 = inVector.z - (coord.origin).z;
    const fVar1 = (coord.yAxis).x;
    const fVar2 = (coord.zAxis).x;
    const fVar3 = (coord.yAxis).y;
    const fVar4 = (coord.zAxis).y;
    const fVar5 = (coord.yAxis).z;
    const fVar6 = (coord.zAxis).z;

    outVector.x = fVar9 * (coord.xAxis).z + fVar8 * (coord.xAxis).y + fVar7 * (coord.xAxis).x;
    outVector.y = fVar9 * fVar5 + fVar8 * fVar3 + fVar7 * fVar1;
    outVector.z = fVar9 * fVar6 + fVar8 * fVar4 + fVar7 * fVar2;

    return outVector;
}