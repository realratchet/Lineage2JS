import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Vector3 } from "three";

const tmpControl = new Vector3();
const tmpPoint = new Vector3();
const tmpDirection = new Vector3();
const tmpView = new Vector3();
const tmpSide = new Vector3();

export class NLineGeometry extends BufferGeometry {
    public alpha = 0;
    protected readonly restLength: number;
    protected readonly arrPoints = new Float32Array(31 * 3);
    protected readonly positions = new BufferAttribute(new Float32Array(62 * 3), 3).setUsage(DynamicDrawUsage);
    protected readonly colors = new BufferAttribute(new Uint8Array(62 * 4), 4, true).setUsage(DynamicDrawUsage);

    public constructor(floatPosition: Vector3, weaponPosition: Vector3) {
        super();

        this.restLength = Math.fround(floatPosition.distanceTo(weaponPosition));
        this.setAttribute("position", this.positions);
        this.setAttribute("color", this.colors);

        const arrIndices = new Uint16Array(180);

        for (let i = 0; i < 30; i++) arrIndices.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3], i * 6);
        for (let i = 0; i < 62; i++) (this.colors.array as Uint8Array).set([200, 200, 200, 0], i * 4);

        this.setIndex(new BufferAttribute(arrIndices, 1));
    }

    public tick(deltaTime: number): void {
        // Engine 105A6CC0 stores the truncated alpha byte each tick, without a fractional accumulator.
        this.alpha = Math.max(0, Math.min(255, Math.trunc(this.alpha + 51 * Math.fround(deltaTime))));
    }

    public update(floatPosition: Vector3, weaponPosition: Vector3, viewOrigin: Vector3): void {
        const distance = floatPosition.distanceTo(weaponPosition);
        tmpControl.copy(floatPosition).sub(weaponPosition).multiplyScalar(Math.fround(2 / 3)).add(weaponPosition);
        tmpControl.z = floatPosition.z;
        if (distance > this.restLength) tmpControl.z += Math.min(distance - this.restLength, Math.fround(0.3 * (weaponPosition.z - floatPosition.z)));
        tmpControl.set(Math.fround(tmpControl.x), Math.fround(tmpControl.y), Math.fround(tmpControl.z));

        for (let i = 0; i <= 30; i++) {
            const q = i / 30, p = 1 - q;
            this.arrPoints[i * 3] = (p * floatPosition.x + 2 * q * tmpControl.x) * p + q * q * weaponPosition.x;
            this.arrPoints[i * 3 + 1] = (p * floatPosition.y + 2 * q * tmpControl.y) * p + q * q * weaponPosition.y;
            this.arrPoints[i * 3 + 2] = (p * floatPosition.z + 2 * q * tmpControl.z) * p + q * q * weaponPosition.z;
        }

        for (let i = 0; i <= 30; i++) {
            tmpPoint.fromArray(this.arrPoints, i * 3);

            if (i < 30) {
                tmpDirection.fromArray(this.arrPoints, (i + 1) * 3).sub(tmpPoint);
                tmpView.copy(tmpPoint).sub(viewOrigin);
                tmpSide.crossVectors(tmpDirection, tmpView).normalize().multiplyScalar(Math.fround(0.1));
            }

            this.positions.setXYZ(i * 2, tmpPoint.x + tmpSide.x, tmpPoint.y + tmpSide.y, tmpPoint.z + tmpSide.z);
            this.positions.setXYZ(i * 2 + 1, tmpPoint.x - tmpSide.x, tmpPoint.y - tmpSide.y, tmpPoint.z - tmpSide.z);
            (this.colors.array as Uint8Array)[i * 8 + 3] = this.alpha;
            (this.colors.array as Uint8Array)[i * 8 + 7] = this.alpha;
        }

        this.positions.needsUpdate = true;
        this.colors.needsUpdate = true;
        this.computeBoundingSphere();
    }
}

export default NLineGeometry;
