import type { Object3D } from "three";
import { findScriptPropertyKey, getScriptPropertyName } from "../ue-script/script-properties";
import { updateLevelActor, type ScriptValue_T } from "../ue-script/vm";

export function setScriptObjectProperty(object: Object3D, field: string, value: ScriptValue_T): void {
    const properties = (object as any).scriptProperties as Map<string, ScriptValue_T>;

    if (!properties) return;
    const name = getScriptPropertyName(field);
    const key = findScriptPropertyKey(properties, name) ?? field;

    properties.set(key, value);
    if (name === "level") updateLevelActor(object as any);
}
