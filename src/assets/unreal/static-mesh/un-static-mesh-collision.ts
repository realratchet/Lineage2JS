import { type APackage, type Constructable_T } from "@l2js/core";

export class FStaticMeshCollisionNode implements Constructable_T {
    declare public vertices: number[]; // vertex
    declare public bounds: Float32Array;

    public load(pkg: APackage): this {
        this.bounds = new Float32Array(6);

        this.vertices = new Array(4).fill(1).map(_ => pkg.read("compat32"));
        for (let i = 0; i < 6; i++)
            this.bounds[i] = pkg.read("float");

        pkg.read("uint8");

        return this;
    }
}

export class FStaticMeshCollisionTriangle implements Constructable_T {
    // declare public matrix: FMatrix;
    declare public vertices: number[];  // vertex

    public load(pkg: APackage): this {

        // this.matrix = FMatrix.make();
        // this.matrix.load(pkg);
        pkg.seek(64);

        this.vertices = new Array(4).fill(1).map(_ => pkg.read("compat32"));

        return this;
    }
}

type StaticMeshCollisionData_T = { indices: Uint32Array, nodes: Int32Array, bounds: Float32Array };

export class FStaticMeshCollisionData {
    declare protected pkg: APackage;
    declare protected trianglesOffset: number;
    declare protected nodesOffset: number;
    protected indices: Uint32Array = null;
    protected nodes: Int32Array = null;
    protected bounds: Float32Array = null;

    public load(pkg: APackage, lazy = false): this {
        this.pkg = pkg;

        if (lazy) {
            const trianglesEnd = pkg.read("int32");
            this.trianglesOffset = pkg.tell();
            if (pkg.read("compat32") === 0) this.indices = new Uint32Array(0);
            pkg.seek(trianglesEnd, "set");

            const nodesEnd = pkg.read("int32");
            this.nodesOffset = pkg.tell();
            if (pkg.read("compat32") === 0) {
                this.nodes = new Int32Array(0);
                this.bounds = new Float32Array(0);
            }
            pkg.seek(nodesEnd, "set");
        } else {
            this.loadTriangles(pkg);
            this.loadNodes(pkg);
        }

        return this;
    }

    protected loadTriangles(pkg: APackage) {
        const count = pkg.read("compat32");
        const indices = new Uint32Array(count * 3);

        for (let i = 0; i < count; i++) {
            pkg.seek(64);
            const v0 = pkg.read("compat32"), v1 = pkg.read("compat32"), v2 = pkg.read("compat32");
            pkg.read("compat32");

            // winding is (v2,v1,v0): only that order reproduces the triangle's own stored plane
            indices[i * 3] = v2;
            indices[i * 3 + 1] = v1;
            indices[i * 3 + 2] = v0;
        }
        this.indices = indices;
    }

    protected loadNodes(pkg: APackage) {
        const count = pkg.read("compat32");
        const nodes = new Int32Array(count * 4);
        const bounds = new Float32Array(count * 6);

        for (let i = 0; i < count; i++) {
            const v0 = pkg.read("compat32"), v1 = pkg.read("compat32"), v2 = pkg.read("compat32"), v3 = pkg.read("compat32");
            nodes[i * 4] = v2;
            nodes[i * 4 + 1] = v3;
            nodes[i * 4 + 2] = v1;
            nodes[i * 4 + 3] = v0;

            for (let j = 0; j < 6; j++) bounds[i * 6 + j] = pkg.read("float");
            pkg.read("uint8");
        }
        this.nodes = nodes;
        this.bounds = bounds;
    }

    public getDecodeInfo(): StaticMeshCollisionData_T {
        if (!this.indices || !this.nodes) {
            const offset = this.pkg.tell();

            try {
                if (!this.indices) {
                    this.pkg.seek(this.trianglesOffset, "set");
                    this.loadTriangles(this.pkg);
                }
                if (!this.nodes) {
                    this.pkg.seek(this.nodesOffset, "set");
                    this.loadNodes(this.pkg);
                }
            } finally {
                this.pkg.seek(offset, "set");
            }
        }

        // Cached source buffers must survive transfers of each library.
        return { indices: this.indices.slice(), nodes: this.nodes.slice(), bounds: this.bounds.slice() };
    }
}
