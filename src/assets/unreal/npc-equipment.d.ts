declare namespace L2JS.Engine {
    interface ICharacterEquipment {
        rightHand: number;
        leftHand: number;
        head?: number;
        hair?: number;
        enchantLevel?: number;
    }

    interface IWeaponEnchantMesh {
        mesh: string;
        skin: string;
        scale: [number, number, number];
        offset: [number, number, number];
        colors: number[][];
    }

    interface IWeaponEnchantEffect {
        path: string;
        offset: [number, number, number];
        scale: number;
        velocityScale: number;
        opacity: number;
        num: number;
    }

    interface IPawnEquipmentDecodeInfo {
        weaponType: number;
        items: { mesh: string; skins: string[]; bone: string | number; enchantMesh?: IWeaponEnchantMesh; enchantEffect?: IWeaponEnchantEffect }[];
    }

    interface INpcBowDecodeInfo {
        weaponMesh: string;
        weaponSkins: string[];
        curvature: number;
        attackRange: number;
        ammo: number;
    }

    interface INpcEquipment {
        rightHand: number;
        leftHand?: number;
        chest?: number;
        attackRange: number;
    }
}
