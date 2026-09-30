declare namespace L2JS.Engine {
    interface INpcBowDecodeInfo {
        weaponMesh: string;
        weaponSkins: string[];
        curvature: number;
        attackRange: number;
        ammo: number;
    }

    interface INpcEquipment {
        rightHand: number;
        attackRange: number;
    }
}
