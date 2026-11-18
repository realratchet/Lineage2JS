import UAActor from "./un-aactor"

export enum PMoveType_T { PMT_SLOW, PMT_FAST }

export abstract class UController extends UAActor { }
export abstract class UPlayerController extends UController { }
export abstract class ULineagePlayerController extends UPlayerController { }

export default UController;
