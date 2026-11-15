import UObject from "./un-object";

export abstract class UWhenExtinctionCreate extends UObject {
    public static readonly plainStructFields = true;

    declare public respawn: string;
    declare public Name: string;

    protected getPropertyMap(): Record<string, string> {
        return { "respawn": "respawn", "Name": "Name" };
    }
}

export default UWhenExtinctionCreate;
