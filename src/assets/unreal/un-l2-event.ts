import UObject from "./un-object";
import type { EL2EventCmd_T } from "./un-aactor";

export abstract class UL2Event extends UObject {
    public static readonly plainStructFields = true;

    declare public eventId: number;
    declare public eventCmd: EL2EventCmd_T;

    protected getPropertyMap() {
        return { "EventID": "eventId", "EventCmd": "eventCmd" };
    }
}

export default UL2Event;
