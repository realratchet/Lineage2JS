import GMath from "@client/assets/unreal/un-gmath";
import FRotator from "@client/assets/unreal/un-rotator";
import FScale from "@client/assets/unreal/un-scale";
import FVector from "@client/assets/unreal/un-vector";
import { UObject } from "@l2js/core";

abstract class FCoords extends UObject {
    declare public ["constructor"]: typeof FCoords;

    declare public origin: GA.FVector;
    declare public xAxis: GA.FVector;
    declare public yAxis: GA.FVector;
    declare public zAxis: GA.FVector;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Origin": "origin",
            "XAxis": "xAxis",
            "YAxis": "yAxis",
            "ZAxis": "zAxis",
        });
    }

    
    public toString(): string {
        return `Corrds=(name=${this.objectName}, orig=${this.origin}, x=${this.xAxis}, y=${this.yAxis}, ${this.zAxis})`;
    }

    public constructor(origin?: FVector, xAxis?: FVector, yAxis?: FVector, zAxis?: FVector) {
        super();

        this.origin = origin || this.origin;
        this.xAxis = xAxis || this.xAxis;
        this.yAxis = yAxis || this.yAxis;
        this.zAxis = zAxis || this.zAxis;
    }

    public mul(other: FCoords): FCoords;
    public mul(other: FRotator): FCoords;
    public mul(other: FVector): FCoords;
    public mul(other: FScale): FCoords;
    public mul(other: unknown): FCoords {
        if (other instanceof FCoords) return mulCoords(this, other);
        if (other instanceof FRotator) return mulRotator(this, other);
        if (other instanceof FVector) return mulVector(this, other);
        if (other instanceof FScale) return mulScale(this, other);

        debugger;
        throw new Error("Invalid multiplication");
    }

    public div(other: FRotator): FCoords;
    public div(other: FVector): FCoords;
    public div(other: FScale): FCoords;
    public div(other: unknown): FCoords {
        if (other instanceof FRotator) return divRotator(this, other);
        if (other instanceof FVector) return divVector(this, other);
        if (other instanceof FScale) return divScale(this, other);

        debugger;
        throw new Error("Invalid division");
    }

    public multiply(other: FCoords): FCoords {
        const _this = FCoords.make();

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

    static fromRotator({ pitch, yaw, roll }: GA.FRotator) {
        const tmpCoords = FCoords.make();
        let _this = FCoords.make();

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

function multiplyAxis(coords: FCoords, inVector: GA.FVector) {
    const outVector = FVector.make();

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

function multiplyOrigin(coord: FCoords, inVector: GA.FVector) {
    const outVector = FVector.make();

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

function mulCoords(coord: FCoords, other: FCoords): FCoords {
    const origin = coord.origin.transformPointBy(other);
    const xAxis = coord.xAxis.transformVectorBy(other);
    const yAxis = coord.yAxis.transformVectorBy(other);
    const zAxis = coord.zAxis.transformVectorBy(other);

    return FCoords.make(origin, xAxis, yAxis, zAxis);
}

function mulRotator(coord: FCoords, other: FRotator): FCoords {
    coord = coord.mul(
        FCoords.make
            (
                FVector.make(0, 0, 0),
                FVector.make(+GMath().cos(other.yaw), +GMath().sin(other.yaw), +0),
                FVector.make(-GMath().sin(other.yaw), +GMath().cos(other.yaw), +0),
                FVector.make(+0, +0, +1)
            )
    );

    // Apply pitch rotation.
    coord = coord.mul(
        FCoords.make
            (
                FVector.make(0, 0, 0),
                FVector.make(+GMath().cos(other.pitch), +0, +GMath().sin(other.pitch)),
                FVector.make(+0, +1, +0),
                FVector.make(-GMath().sin(other.pitch), +0, +GMath().cos(other.pitch))
            )
    );

    // Apply roll rotation.
    coord = coord.mul(
        FCoords.make
            (
                FVector.make(0, 0, 0),
                FVector.make(+1, +0, +0),
                FVector.make(+0, +GMath().cos(other.roll), -GMath().sin(other.roll)),
                FVector.make(+0, +GMath().sin(other.roll), +GMath().cos(other.roll))
            )
    );

    return coord;
}

function mulVector(coord: FCoords, other: FVector): FCoords {
    return FCoords.make(
        coord.origin.sub(other),
        coord.xAxis, coord.yAxis, coord.zAxis
    );
}

function mulScale(coord: FCoords, other: FScale): FCoords {
    throw new Error("not implemented")
}

function divRotator(coord: FCoords, other: FRotator): FCoords {
    const roll = FCoords.make
    (
        FVector.make(0, 0, 0),
        FVector.make(+1, -0, +0),
        FVector.make(-0, +GMath().cos(other.roll), +GMath().sin(other.roll)),
        FVector.make(+0, -GMath().sin(other.roll), +GMath().cos(other.roll))
    );

    const pitch = FCoords.make
    (
        FVector.make(0, 0, 0),
        FVector.make(+GMath().cos(other.pitch), +0, -GMath().sin(other.pitch)),
        FVector.make(+0, +1, -0),
        FVector.make(+GMath().sin(other.pitch), +0, +GMath().cos(other.pitch))
    );

    const yaw = FCoords.make
    (
        FVector.make(0, 0, 0),
        FVector.make(+GMath().cos(other.yaw), -GMath().sin(other.yaw), -0),
        FVector.make(+GMath().sin(other.yaw), +GMath().cos(other.yaw), +0),
        FVector.make(-0, +0, +1)
    );

    coord = coord.mul(
        FCoords.make
            (
                FVector.make(0, 0, 0),
                FVector.make(+1, -0, +0),
                FVector.make(-0, +GMath().cos(other.roll), +GMath().sin(other.roll)),
                FVector.make(+0, -GMath().sin(other.roll), +GMath().cos(other.roll))
            )
    );

    // Apply inverse pitch rotation.
    coord = coord.mul(
        FCoords.make
            (
                FVector.make(0, 0, 0),
                FVector.make(+GMath().cos(other.pitch), +0, -GMath().sin(other.pitch)),
                FVector.make(+0, +1, -0),
                FVector.make(+GMath().sin(other.pitch), +0, +GMath().cos(other.pitch))
            )
    );

    // Apply inverse yaw rotation.
    coord = coord.mul(
        FCoords.make
            (
                FVector.make(0, 0, 0),
                FVector.make(+GMath().cos(other.yaw), -GMath().sin(other.yaw), -0),
                FVector.make(+GMath().sin(other.yaw), +GMath().cos(other.yaw), +0),
                FVector.make(-0, +0, +1)
            )
    );

    return coord;
}

function divVector(coord: FCoords, other: FVector): FCoords {
    const origin = coord.origin.add(other);

    return FCoords.make(
        origin,
        coord.xAxis, coord.yAxis, coord.zAxis
    );
}

function divScale(coord: FCoords, other: FScale): FCoords {
    throw new Error("not implemented");
}