declare module "*.wasm" {
    const value: string;
    export default value;
}

declare module "@generated/classes" {
    export default function getPrebuiltClass(struct: any, pkg: any): any;
}

declare module "pako/lib/zlib/constants.js";
declare module "three-wasm/SortedIndexBuffer" {
    class SortedIndexState {
        public indices: Uint32Array;
        public apply(x: number, y: number, z: number, entering: boolean): boolean;
        public dispose(): void;
    }

    export class SortedIndexBuffer {
        public constructor(positions: Float32Array, source: Uint8Array | Uint16Array | Uint32Array, firstVertex?: number);
        public createState(): SortedIndexState;
        public dispose(): void;
    }
}
