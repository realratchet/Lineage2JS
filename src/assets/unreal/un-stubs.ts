import { UObject } from "@l2js/core";

// Stubs for classes we don't implement yet, so their objects still deserialize.
// Anything not listed here keeps throwing in un-package.ts.

abstract class UProjector extends UObject { }
abstract class UAntiPortalActor extends UObject { }
abstract class UPawn extends UObject { }
abstract class ULineagePlayerController extends UObject { }
abstract class UAmbientSound extends UObject { }

export { UProjector, UAntiPortalActor, UPawn, ULineagePlayerController, UAmbientSound };
