import C = L2JS.Core;
import G = L2JS.Client;
import GR = L2JS.Client.Rendering;
import GA = L2JS.Client.Assets;
import GD = L2JS.Client.Decoding;

declare namespace EnumKeys {
    type BspNodeFlags_T = keyof typeof import("@unreal/bsp/un-bsp-node").BspNodeFlags_T;
    type PolyFlags_T = keyof typeof import("@unreal/un-polys").PolyFlags_T;
}