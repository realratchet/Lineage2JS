import { type APackage, type UExport } from "@l2js/core";
import UObject from "./un-object";
import type UTexture from "./un-texture";

type FontCharacter_T = { startU: number, startV: number, uSize: number, vSize: number, textureIndex: number };

export abstract class UFont extends UObject {
    public readonly characters: FontCharacter_T[] = [];
    public readonly textures: UTexture[] = [];
    public readonly characterRemap = new Map<number, number>();
    public kerning = 0;
    public isRemapped = false;

    public doLoad(pkg: APackage, exp: UExport): void {
        super.doLoad(pkg, exp);

        const version = pkg.header.getArchiveFileVersion();

        // UFont::Serialize (Engine.dll 0x10553da9) converts pre-122 font pages to indexed glyphs.
        if (version < 122) {
            const count = pkg.read("compat32");

            if (count < 0) throw new Error(`Invalid font page count '${count}'.`);
            for (let i = 0; i < count; i++) {
                this.textures.push(pkg.fetchObject<UTexture>(pkg.read("compat32")));
                this.loadCharacters(pkg, i & 0xff);
            }
            pkg.read("int32");
        } else {
            this.loadCharacters(pkg);
            const count = pkg.read("compat32");

            if (count < 0) throw new Error(`Invalid font texture count '${count}'.`);
            for (let i = 0; i < count; i++) this.textures.push(pkg.fetchObject<UTexture>(pkg.read("compat32")));
        }
        if (version >= 119) this.kerning = pkg.read("int32");

        // Retail UFont::Serialize forces GLazyLoad=0 before loading every texture mip.
        for (const texture of this.textures) if (texture) texture.loadSelf();

        if (version >= 69) {
            const count = pkg.read("compat32");

            if (count < 0) throw new Error(`Invalid font remap count '${count}'.`);
            for (let i = 0; i < count; i++) this.characterRemap.set(pkg.read("uint16"), pkg.read("uint16"));
            this.isRemapped = pkg.read("uint32") !== 0;
        }
        this.readHead = pkg.tell();
    }

    protected loadCharacters(pkg: APackage, textureIndex: number = null): void {
        const count = pkg.read("compat32");

        if (count < 0) throw new Error(`Invalid font character count '${count}'.`);
        for (let i = 0; i < count; i++) this.characters.push({ startU: pkg.read("int32"), startV: pkg.read("int32"), uSize: pkg.read("int32"), vSize: pkg.read("int32"), textureIndex: textureIndex === null ? pkg.read("uint8") : textureIndex });
    }
}

export default UFont;
