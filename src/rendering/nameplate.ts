import { AlwaysDepth, CanvasTexture, DepthTexture, DoubleSide, LessEqualDepth, NearestFilter, NoColorSpace, Sprite, SpriteMaterial, Uniform, Vector2 } from "three";
import { FontType_T, type default as NWindowCanvas } from "../nwindow/nwindow-canvas";

export class Nameplate extends Sprite {
    protected readonly canvas = document.createElement("canvas");
    protected readonly opaqueDepth = new Uniform(null);
    protected readonly opaqueDepthSize = new Uniform(new Vector2());
    protected readonly opaqueDepthEnabled = new Uniform(false);
    protected nameText: string = null;
    protected titleText: string = null;
    protected nameColor = 0;
    protected titleColor = 0;
    protected bracket: string = null;
    protected crest: HTMLCanvasElement = null;
    protected allyCrest: HTMLCanvasElement = null;
    public width = 0;
    public height = 0;

    public constructor() {
        super(new SpriteMaterial({ depthTest: true, depthWrite: false, sizeAttenuation: false, side: DoubleSide, forceSinglePass: true, toneMapped: false, fog: false }));

        (this as any).isNameplate = true;
        this.renderOrder = 10000;
        this.material.map = this.createTexture();
        this.frustumCulled = false;
        this.material.onBeforeCompile = shader => {
            shader.uniforms.opaqueDepth = this.opaqueDepth;
            shader.uniforms.opaqueDepthSize = this.opaqueDepthSize;
            shader.uniforms.opaqueDepthEnabled = this.opaqueDepthEnabled;
            shader.fragmentShader = `uniform sampler2D opaqueDepth;
uniform vec2 opaqueDepthSize;
uniform bool opaqueDepthEnabled;
${shader.fragmentShader}`.replace("#include <logdepthbuf_fragment>", `#include <logdepthbuf_fragment>
if (opaqueDepthEnabled) {
    #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
        float nameplateDepth = gl_FragDepth;
    #else
        float nameplateDepth = gl_FragCoord.z;
    #endif
    if (nameplateDepth > texture2D(opaqueDepth, gl_FragCoord.xy / opaqueDepthSize).r) discard;
}`);
        };
    }

    public setOpaqueDepth(texture: DepthTexture, width: number, height: number) {
        this.opaqueDepth.value = texture;
        this.opaqueDepthSize.value.set(width, height);
        this.opaqueDepthEnabled.value = !!texture;
        this.material.depthFunc = texture ? AlwaysDepth : LessEqualDepth;
    }

    protected createTexture() {
        const texture = new CanvasTexture(this.canvas);

        texture.minFilter = texture.magFilter = NearestFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = NoColorSpace;
        texture.repeat.x = -1; // ue2-conventions.ts mirrors the camera projection.
        texture.offset.x = 1;

        return texture;
    }

    public update(canvas: NWindowCanvas, name: string, title: string, nameColor: number, titleColor: number, bracket: string, crest: HTMLCanvasElement = null, allyCrest: HTMLCanvasElement = null) {
        if (name === this.nameText && title === this.titleText && nameColor === this.nameColor && titleColor === this.titleColor && bracket === this.bracket && crest === this.crest && allyCrest === this.allyCrest) return;

        this.nameText = name;
        this.titleText = title;
        this.nameColor = nameColor;
        this.titleColor = titleColor;
        this.bracket = bracket;
        this.crest = crest;
        this.allyCrest = allyCrest;

        const nameWidth = canvas.measureText(name, FontType_T.LARGE), lineHeight = canvas.getLineHeight(FontType_T.LARGE);
        const crestWidth = (crest ? 16 : 0) + (allyCrest ? 8 : 0);
        const top = title ? -lineHeight * 2 : -16;
        const bottom = Math.max(0, lineHeight - 15);

        this.width = Math.max(nameWidth + crestWidth + (bracket ? 38 + (crest ? 4 : 0) : 0), title ? canvas.measureText(title, FontType_T.LARGE) : 0);
        this.height = bottom - top;
        const isResized = this.canvas.width !== this.width || this.canvas.height !== this.height;

        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.center.set(this.width ? 1 - Math.trunc(this.width / 2) / this.width : 0.5, bottom / this.height);

        const context = this.canvas.getContext("2d"), crestX = Math.trunc(this.width / 2) - Math.trunc((nameWidth + crestWidth) / 2), nameX = crestX + crestWidth;

        context.imageSmoothingEnabled = false;
        if (allyCrest) context.drawImage(allyCrest, 0, 4, 8, 12, crestX, -14 - top, 8, 12);
        if (crest) context.drawImage(crest, 0, 4, 16, 12, crestX + (allyCrest ? 8 : 0), -14 - top, 16, 12);
        canvas.renderText(context, nameX, -15 - top, nameColor, name, FontType_T.LARGE);
        if (title) canvas.renderText(context, Math.trunc(this.width / 2) - Math.trunc(canvas.measureText(title, FontType_T.LARGE) / 2), -lineHeight * 2 - top, titleColor, title, FontType_T.LARGE);
        if (bracket) {
            const texture = canvas.getTexture(bracket);

            context.drawImage(texture, 0, 0, 19, 16, crestX - 19 - (crest ? 2 : 0), -16 - top, 19, 16);
            context.drawImage(texture, 0, 0, 19, 16, nameX + nameWidth, -16 - top, 19, 16);
        }
        if (isResized) {
            this.material.map.dispose();
            this.material.map = this.createTexture();
        } else this.material.map.needsUpdate = true;
    }

    public dispose() {
        this.removeFromParent();
        this.material.map.dispose();
        this.material.dispose();
    }

    public raycast() {}
}

export default Nameplate;
