import UVolume from "./un-volume";
import type { IBoxDecodeInfo } from "./un-box";
import type { IActorCollisionDecodeInfo } from "./un-aactor";
import type { IBaseObjectDecodeInfo } from "./decode-library";
import type { IBSPCollisionNodeDecodeInfo_T } from "./model/un-model";

export type IBlockingVolumeDecodeInfo = IBaseObjectDecodeInfo & {
    type: "BlockingVolume",
    collision: IActorCollisionDecodeInfo,
    rootOutside: boolean,
    bounds: IBoxDecodeInfo,
    nodes: IBSPCollisionNodeDecodeInfo_T[]
};

export abstract class UBlockingVolume extends UVolume {
    // public readonly careUnread = false;

    // protected isFluidClamped: boolean;

    // protected getPropertyMap(): Record<string, string> {
    //     return Object.assign({}, super.getPropertyMap(), {
    //         "bClampFluid": "isFluidClamped"
    //     });
    // }

    public getDecodeInfo(): IBlockingVolumeDecodeInfo {
        const worldBsp = this.getWorldBspInfo();
        const nodes: IBSPCollisionNodeDecodeInfo_T[] = worldBsp.nodes.map(node => ({ plane: node.plane, children: [node.iFront, node.iBack], isCsg: node.isCsg, collision: node.collision }));

        return {
            uuid: this.uuid,
            type: "BlockingVolume",
            name: this.objectName,
            collision: this.getCollisionDecodeInfo(),
            bounds: worldBsp.bounds,
            rootOutside: worldBsp.isRootOutside,
            nodes
        };
    }
}

export default UBlockingVolume;
