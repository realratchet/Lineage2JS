import DDSConstants from "./dds-constants";

class DDSPixelFormat {
    public size: number;
    public flags: number;
    public fourcc: number;
    public bitcount: number;
    public rmask: number;
    public gmask: number;
    public bmask: number;
    public amask: number;
};

class DDSCaps {
    public caps1: number;
    public caps2: number;
    public caps3: number;
    public caps4: number;
};

class DDSHeader10 {
    public dxgiFormat: number;
    public resourceDimension: number;
    public miscFlag: number;
    public arraySize: number;
    public reserved: number;
};

class DDSHeader {
    protected fourcc: number;
    protected size: number;
    protected flags: number;
    protected height: number;
    protected width: number;
    protected pitch: number;
    protected depth: number;
    protected mipmapcount: number;
    protected reserved = new Uint32Array(11);
    protected pf: DDSPixelFormat = new DDSPixelFormat();
    protected caps: DDSCaps = new DDSCaps();
    protected header10: DDSHeader10 = new DDSHeader10();
    protected notused: number;

    constructor() {

        this.reserved[9] = DDSConstants.FOURCC_NVTT;
        this.reserved[10] = (2 << 16) | (0 << 8) | (6);

        this.fourcc = DDSConstants.FOURCC_DDS;
        this.size = 124;
        this.flags = (DDSConstants.DDSD_CAPS | DDSConstants.DDSD_PIXELFORMAT);
        this.height = 0;
        this.width = 0;
        this.pitch = 0;
        this.depth = 0;
        this.mipmapcount = 0;

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

        if (this.pf.fourcc == DDSConstants.FOURCC_ATI2) {
            this.pf.bitcount = DDSConstants.FOURCC_A2XY;
        }
        else {
            this.pf.bitcount = 0;
        }

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

    public setNormalFlag(b: boolean) {
        if (b) this.pf.flags |= DDSConstants.DDPF_NORMAL;
        else this.pf.flags &= ~DDSConstants.DDPF_NORMAL;
    }
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

        return bytes.getUint32(0);
    }
})();