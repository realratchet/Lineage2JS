declare namespace L2JS.Engine {
    interface IPickupDecodeInfo {
        items: { mesh: string; skins: string[]; meshIndex: number; collisionRadius: number; collisionHeight: number }[];
        dropType: number;
        dropAnimType: number;
        dropSound: string;
    }
}
