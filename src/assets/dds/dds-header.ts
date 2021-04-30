import DDSConstants from "./dds-constants";

class DDSPixelFormat {
    protected _size: Uint32Array;
    protected _flags: Uint32Array;
    protected _fourcc: Uint32Array;
    protected _bitcount: Uint32Array;
    protected _rmask: Uint32Array;
    protected _gmask: Uint32Array;
    protected _bmask: Uint32Array;
    protected _amask: Uint32Array;

    get size() { return this._size[0]; }
    set size(v: number) { this._size[0] = v; }

    get flags() { return this._flags[0]; }
    set flags(v: number) { this._flags[0] = v; }

    get fourcc() { return this._fourcc[0]; }
    set fourcc(v: number) { this._fourcc[0] = v; }

    get bitcount() { return this._bitcount[0]; }
    set bitcount(v: number) { this._bitcount[0] = v; }

    get rmask() { return this._rmask[0]; }
    set rmask(v: number) { this._rmask[0] = v; }

    get gmask() { return this._gmask[0]; }
    set gmask(v: number) { this._gmask[0] = v; }

    get bmask() { return this._bmask[0]; }
    set bmask(v: number) { this._bmask[0] = v; }

    get amask() { return this._amask[0]; }
    set amask(v: number) { this._amask[0] = v; }


    constructor(buffer: ArrayBuffer, offset: number) {
        this._size = new Uint32Array(buffer, offset + 0 * 4, 1);
        this._flags = new Uint32Array(buffer, offset + 1 * 4, 1);
        this._fourcc = new Uint32Array(buffer, offset + 2 * 4, 1);
        this._bitcount = new Uint32Array(buffer, offset + 3 * 4, 1);
        this._rmask = new Uint32Array(buffer, offset + 4 * 4, 1);
        this._gmask = new Uint32Array(buffer, offset + 5 * 4, 1);
        this._bmask = new Uint32Array(buffer, offset + 6 * 4, 1);
        this._amask = new Uint32Array(buffer, offset + 7 * 4, 1);
    }
};

class DDSCaps {
    protected _caps1: Uint32Array;
    protected _caps2: Uint32Array;
    protected _caps3: Uint32Array;
    protected _caps4: Uint32Array;

    get caps1() { return this._caps1[0]; }
    set caps1(v: number) { this._caps1[0] = v; }

    get caps2() { return this._caps2[0]; }
    set caps2(v: number) { this._caps2[0] = v; }

    get caps3() { return this._caps3[0]; }
    set caps3(v: number) { this._caps3[0] = v; }

    get caps4() { return this._caps4[0]; }
    set caps4(v: number) { this._caps4[0] = v; }

    constructor(buffer: ArrayBuffer, offset: number) {
        this._caps1 = new Uint32Array(buffer, offset + 0 * 4, 1);
        this._caps2 = new Uint32Array(buffer, offset + 1 * 4, 1);
        this._caps3 = new Uint32Array(buffer, offset + 2 * 4, 1);
        this._caps4 = new Uint32Array(buffer, offset + 3 * 4, 1);
    }
};

class DDSHeader10 {
    protected _dxgiFormat: Uint32Array;
    protected _resourceDimension: Uint32Array;
    protected _miscFlag: Uint32Array;
    protected _arraySize: Uint32Array;
    protected _reserved: Uint32Array;

    get dxgiFormat() { return this._dxgiFormat[0]; }
    set dxgiFormat(v: number) { this._dxgiFormat[0] = v; }

    get resourceDimension() { return this._resourceDimension[0]; }
    set resourceDimension(v: number) { this._resourceDimension[0] = v; }

    get miscFlag() { return this._miscFlag[0]; }
    set miscFlag(v: number) { this._miscFlag[0] = v; }

    get arraySize() { return this._arraySize[0]; }
    set arraySize(v: number) { this._arraySize[0] = v; }

    get reserved() { return this._reserved[0]; }
    set reserved(v: number) { this._reserved[0] = v; }


    constructor(buffer: ArrayBuffer, offset: number) {
        this._dxgiFormat = new Uint32Array(buffer, offset + 0 * 4, 1);
        this._resourceDimension = new Uint32Array(buffer, offset + 1 * 4, 1);
        this._miscFlag = new Uint32Array(buffer, offset + 2 * 4, 1);
        this._arraySize = new Uint32Array(buffer, offset + 3 * 4, 1);
        this._reserved = new Uint32Array(buffer, offset + 4 * 4, 1);
    }
};

class DDSHeader {
    public readonly buffer = new ArrayBuffer(148);
    protected _fourcc = new Uint32Array(this.buffer, 0 * 4, 1);
    protected _size = new Uint32Array(this.buffer, 1 * 4, 1);
    protected _flags = new Uint32Array(this.buffer, 2 * 4, 1);
    protected _height = new Uint32Array(this.buffer, 3 * 4, 1);
    protected _width = new Uint32Array(this.buffer, 4 * 4, 1);
    protected _pitch = new Uint32Array(this.buffer, 5 * 4, 1);
    protected _depth = new Uint32Array(this.buffer, 6 * 4, 1);
    protected _mipmapcount = new Uint32Array(this.buffer, 7 * 4, 1);
    public readonly reserved = new Uint32Array(this.buffer, 8 * 4, 11);
    public readonly pf = new DDSPixelFormat(this.buffer, (8 + 11) * 4);
    public readonly caps = new DDSCaps(this.buffer, (8 + 11 + 8) * 4);
    protected _notused = new Uint32Array(this.buffer, (8 + 11 + 8 + 4) * 4, 1);
    public readonly header10 = new DDSHeader10(this.buffer, (8 + 11 + 8 + 4 + 1) * 4);

    get fourcc() { return this._fourcc[0]; }
    set fourcc(v: number) { this._fourcc[0] = v; }

    get size() { return this._size[0]; }
    set size(v: number) { this._size[0] = v; }

    get flags() { return this._flags[0]; }
    set flags(v: number) { this._flags[0] = v; }

    get height() { return this._height[0]; }
    set height(v: number) { this._height[0] = v; }

    get width() { return this._width[0]; }
    set width(v: number) { this._width[0] = v; }

    get pitch() { return this._pitch[0]; }
    set pitch(v: number) { this._pitch[0] = v; }

    get depth() { return this._depth[0]; }
    set depth(v: number) { this._depth[0] = v; }

    get mipmapcount() { return this._mipmapcount[0]; }
    set mipmapcount(v: number) { this._mipmapcount[0] = v; }

    get notused() { return this._notused[0]; }
    set notused(v: number) { this._notused[0] = v; }

    constructor() {
        this.fourcc = DDSConstants.FOURCC_DDS;
        this.size = 124;
        this.flags = DDSConstants.DDSD_CAPS | DDSConstants.DDSD_PIXELFORMAT;
        this.height = 0;
        this.width = 0;
        this.pitch = 0;
        this.depth = 0;
        this.mipmapcount = 0;

        this.reserved[9] = DDSConstants.FOURCC_NVTT;
        this.reserved[10] = 2 << 16 | 6;

        this.pf.size = 32;
        this.pf.flags = 0;
        this.pf.fourcc = 0;
        this.pf.bitcount = 0;
        this.pf.rmask = 0;
        this.pf.gmask = 0;
        this.pf.bmask = 0;
        this.pf.amask = 0;

        this.caps.caps1 = DDSConstants.DDSCAPS_TEXTURE;
        this.caps.caps2 = 0;
        this.caps.caps3 = 0;
        this.caps.caps4 = 0;
        this.notused = 0;

        this.header10.dxgiFormat = DDSConstants.DXGI_FORMAT.DXGI_FORMAT_UNKNOWN;
        this.header10.resourceDimension = DDSConstants.D3D10_RESOURCE_DIMENSION.D3D10_RESOURCE_DIMENSION_UNKNOWN;
        this.header10.miscFlag = 0;
        this.header10.arraySize = 0;
        this.header10.reserved = 0;
    }

    public setFourCC(c0: number, c1: number, c2: number, c3: number) {
        // set fourcc pixel format.
        this.pf.flags = DDSConstants.DDPF_FOURCC;
        this.pf.fourcc = makeFourCC(c0, c1, c2, c3);

        if (this.pf.fourcc == DDSConstants.FOURCC_ATI2) this.pf.bitcount = DDSConstants.FOURCC_A2XY;
        else this.pf.bitcount = 0;

        this.pf.rmask = 0;
        this.pf.gmask = 0;
        this.pf.bmask = 0;
        this.pf.amask = 0;
    }

    public setWidth(w: number) {
        this.flags |= DDSConstants.DDSD_WIDTH;
        this.width = w;
    }

    public setHeight(h: number) {
        this.flags |= DDSConstants.DDSD_HEIGHT;
        this.height = h;
    }

    public getWidth(): number { return this.flags & DDSConstants.DDSD_WIDTH ? this.width : 1; }
    public getHeight(): number { return this.flags & DDSConstants.DDSD_HEIGHT ? this.height : 1; }

    public setNormalFlag(b: boolean) {
        if (b) this.pf.flags |= DDSConstants.DDPF_NORMAL;
        else this.pf.flags &= ~DDSConstants.DDPF_NORMAL;
    }

    public isDX10Header() { return this.pf.fourcc === DDSConstants.FOURCC_DX10; }
    public getBuffer(): Uint8Array { return new Uint8Array(this.buffer, 0, this.isDX10Header() ? 148 : 128); }
}

export default DDSHeader;
export { DDSHeader };

const makeFourCC = (function () {
    const bytes = new DataView(new ArrayBuffer(4));

    return function makeFourCC(ch0: number, ch1: number, ch2: number, ch3: number) {
        bytes.setUint8(0, ch0);
        bytes.setUint8(1, ch1);
        bytes.setUint8(2, ch2);
        bytes.setUint8(3, ch3);

        return bytes.getUint32(0, true);
    }
})();