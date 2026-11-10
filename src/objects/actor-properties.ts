import type { Object3D } from "three";
import { findScriptPropertyKey, getScriptPropertyName } from "../ue-script/script-properties";
import { getProperty, updateLevelActor, type ScriptValue_T } from "../ue-script/vm";
import type { SectorObject } from "./zone-object";

export function setScriptObjectProperty(object: Object3D, field: string, value: ScriptValue_T): void {
    const properties = (object as any).scriptProperties as Map<string, ScriptValue_T>;

    if (!properties) return;
    const name = getScriptPropertyName(field);
    const key = findScriptPropertyKey(properties, name) ?? field;

    properties.set(key, value);
    if (name === "level") updateLevelActor(object as any);
    if (name === "bhidden") {
        const level = getProperty(object as any, "XLevel") as unknown as SectorObject;

        if (level && level.isSectorObject) level.setActorHidden((object as any).actorUuid, !!value);
    }
}
