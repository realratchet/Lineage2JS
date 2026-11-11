type Range_T = { start: number, count: number };

export class RangeAllocator {
    protected capacity: number;
    protected readonly arrFree: Range_T[];

    public constructor(capacity: number) {

        this.capacity = capacity;
        this.arrFree = [{ start: 0, count: capacity }];
    }

    public getCapacity() { return this.capacity; }

    public allocate(count: number): number {
        const index = this.arrFree.findIndex(range => range.count >= count);

        if (index < 0) return -1;

        const range = this.arrFree[index], start = range.start;

        range.start += count;
        range.count -= count;
        if (range.count === 0) this.arrFree.splice(index, 1);
        return start;
    }

    public free(start: number, count: number): void {
        let index = this.arrFree.findIndex(range => range.start > start);
        if (index < 0) index = this.arrFree.length;
        this.arrFree.splice(index, 0, { start, count });

        const current = this.arrFree[index], next = this.arrFree[index + 1];
        if (next && current.start + current.count === next.start) {
            current.count += next.count;
            this.arrFree.splice(index + 1, 1);
        }

        const previous = this.arrFree[index - 1];
        if (previous && previous.start + previous.count === current.start) {
            previous.count += current.count;
            this.arrFree.splice(index, 1);
        }
    }

    public grow(capacity: number): void {
        if (capacity <= this.capacity) throw new Error(`Range allocator cannot shrink from ${this.capacity} to ${capacity}.`);

        this.free(this.capacity, capacity - this.capacity);
        this.capacity = capacity;
    }
}

export default RangeAllocator;
