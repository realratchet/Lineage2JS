import { EInputAction_T, EInputKey_T } from "@l2js/engine/un-interactions";
import type ConfigCache from "../ue-script/config-cache";
import { parseScriptInteger, parseScriptFloat } from "../ue-script/vm";

export type InputCommandExecutor_T = (command: string, action: EInputAction_T, amount: number, viewport: boolean) => boolean;
type InputAlias_T = { name: string, command: string };
export type InputToken_T = { token: string, rest: string };

const arrInputKeyNames = [
    "None", "LeftMouse", "RightMouse", "Cancel", "MiddleMouse", "Unknown05", "Unknown06", "Unknown07",
    "Backspace", "Tab", "Unknown0A", "Unknown0B", "Unknown0C", "Enter", "Unknown0E", "Unknown0F",
    "Shift", "Ctrl", "Alt", "Pause", "CapsLock", "Unknown15", "Unknown16", "Unknown17",
    "Unknown18", "Unknown19", "Unknown1A", "Escape", "Unknown1C", "Unknown1D", "Unknown1E", "Unknown1F",
    "Space", "PageUp", "PageDown", "End", "Home", "Left", "Up", "Right",
    "Down", "Select", "Print", "Execute", "PrintScrn", "Insert", "Delete", "Help",
    "0", "1", "2", "3", "4", "5", "6", "7",
    "8", "9", "Unknown3A", "Unknown3B", "Unknown3C", "Unknown3D", "Unknown3E", "Unknown3F",
    "Unknown40", "A", "B", "C", "D", "E", "F", "G",
    "H", "I", "J", "K", "L", "M", "N", "O",
    "P", "Q", "R", "S", "T", "U", "V", "W",
    "X", "Y", "Z", "Unknown5B", "Unknown5C", "Unknown5D", "Unknown5E", "Unknown5F",
    "NumPad0", "NumPad1", "NumPad2", "NumPad3", "NumPad4", "NumPad5", "NumPad6", "NumPad7",
    "NumPad8", "NumPad9", "GreyStar", "GreyPlus", "Separator", "GreyMinus", "NumPadPeriod", "GreySlash",
    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8",
    "F9", "F10", "F11", "F12", "F13", "F14", "F15", "F16",
    "F17", "F18", "F19", "F20", "F21", "F22", "F23", "F24",
    "Unknown88", "Unknown89", "Unknown8A", "Unknown8B", "Unknown8C", "Unknown8D", "Unknown8E", "Unknown8F",
    "NumLock", "ScrollLock", "Unknown92", "Unknown93", "Unknown94", "Unknown95", "Unknown96", "Unknown97",
    "Unknown98", "Unknown99", "Unknown9A", "Unknown9B", "Unknown9C", "Unknown9D", "Unknown9E", "Unknown9F",
    "LShift", "RShift", "LControl", "RControl", "UnknownA4", "UnknownA5", "UnknownA6", "UnknownA7",
    "UnknownA8", "UnknownA9", "UnknownAA", "UnknownAB", "UnknownAC", "UnknownAD", "UnknownAE", "UnknownAF",
    "UnknownB0", "UnknownB1", "UnknownB2", "UnknownB3", "UnknownB4", "UnknownB5", "UnknownB6", "UnknownB7",
    "UnknownB8", "Unicode", "Semicolon", "Equals", "Comma", "Minus", "Period", "Slash",
    "Tilde", "UnknownC1", "UnknownC2", "UnknownC3", "UnknownC4", "UnknownC5", "UnknownC6", "UnknownC7",
    "Joy1", "Joy2", "Joy3", "Joy4", "Joy5", "Joy6", "Joy7", "Joy8",
    "Joy9", "Joy10", "Joy11", "Joy12", "Joy13", "Joy14", "Joy15", "Joy16",
    "UnknownD8", "UnknownD9", "UnknownDA", "LeftBracket", "Backslash", "RightBracket", "SingleQuote", "UnknownDF",
    "UnknownE0", "UnknownE1", "UnknownE2", "UnknownE3", "MouseX", "MouseY", "MouseZ", "MouseW",
    "JoyU", "JoyV", "JoySlider1", "JoySlider2", "MouseWheelUp", "MouseWheelDown", "Unknown10E", "Unknown10F",
    "JoyX", "JoyY", "JoyZ", "JoyR", "UnknownF4", "UnknownF5", "Attn", "CrSel",
    "ExSel", "ErEof", "Play", "Zoom", "NoName", "PA1", "OEMClear", "",
];
let executingAlias = false;

export function parseInputCommand(text: string, command: string): string | null {
    let index = 0;

    while (text[index] === " " || text[index] === "\t") index++;
    if (text.slice(index, index + command.length).toLowerCase() !== command.toLowerCase()) return null;
    index += command.length;
    const next = text.charCodeAt(index);

    if (next >= 48 && next <= 57 || next >= 65 && next <= 90 || next >= 97 && next <= 122) return null;
    while (text[index] === " " || text[index] === "\t") index++;
    return text.slice(index);
}

export function parseInputNumber(text: string, marker: string, floating: boolean, defaultValue?: number): number {
    let index = 0;

    for (; index <= text.length - marker.length; index++) {
        const previous = text.charCodeAt(index - 1);

        if (previous >= 48 && previous <= 57 || previous >= 65 && previous <= 90 || previous >= 97 && previous <= 122) continue;
        if (text.slice(index, index + marker.length).toLowerCase() === marker.toLowerCase()) break;
    }
    // UInput::Exec leaves missing Dir=/Speed= locals uninitialized.
    if (index > text.length - marker.length) {
        if (defaultValue !== undefined) return defaultValue;
        throw new Error(`Input command requires '${marker}'.`);
    }
    text = text.slice(index + marker.length);
    return floating ? parseScriptFloat(text) : parseScriptInteger(text);
}

export function parseInputToken(text: string, capacity = 256): InputToken_T {
    let index = 0, token = "";

    while (text[index] === " " || text[index] === "\t") index++;
    if (text[index] === '"') {
        index++;
        while (index < text.length && text[index] !== '"' && token.length < capacity - 1) token += text[index++];
        if (text[index] === '"') index++;
    } else {
        while (index < text.length && text[index] !== " " && text[index] !== "\t") {
            if (token.length < capacity - 1) token += text[index];
            index++;
        }
    }
    return { token, rest: text.slice(index) };
}

export function parseInputLines(text: string): string[] {
    const lines: string[] = [];
    const end = text.indexOf("\0");
    const length = end < 0 ? text.length : end;
    let index = 0;

    // Core ParseLine 0x10155950 uses a 512-character buffer in UInput::ExecInputCommands.
    while (index < length) {
        let line = "", quoted = false, comment = false, consumed = false, remaining = 512;

        while (index < length) {
            const char = text[index];

            if (char === "\r" || char === "\n" || --remaining <= 0) break;
            if (!quoted) {
                if (char === "/" && text[index + 1] === "/") comment = true;
                if (char === "|") break;
            }
            if (char === '"') quoted = !quoted;
            consumed = true;
            if (!comment) line += char;
            index++;
        }
        while (index < length && (text[index] === "|" || text[index] === "\r" || text[index] === "\n")) index++;
        if (index < length || consumed) lines.push(line);
    }
    return lines;
}

function readInputAlias(text: string): InputAlias_T {
    const alias: InputAlias_T = { name: "None", command: "" };
    let index = 0;

    text = text.trim();
    if (text[0] !== "(" || text[text.length - 1] !== ")") throw new Error(`Invalid Engine.Input alias '${text}'.`);
    text = text.slice(1, -1);
    while (index < text.length) {
        const equals = text.indexOf("=", index);

        if (equals < 0) throw new Error(`Invalid Engine.Input alias '${text}'.`);
        const name = text.slice(index, equals).trim().toLowerCase();
        let start = equals + 1;

        while (text[start] === " " || text[start] === "\t") start++;
        let end = start;
        let value: string;

        if (text[start] === '"') {
            start++;
            end = text.indexOf('"', start);
            if (end < 0) throw new Error(`Invalid Engine.Input alias '${text}'.`);
            value = text.slice(start, end);
            end++;
        } else {
            while (end < text.length && text[end] !== ",") end++;
            value = text.slice(start, end).trim();
        }
        if (name === "alias") alias.name = value;
        else if (name === "command") alias.command = value;
        else throw new Error(`Unknown Engine.Input alias property '${name}'.`);
        while (text[end] === " " || text[end] === "\t") end++;
        if (end < text.length && text[end] !== ",") throw new Error(`Invalid Engine.Input alias '${text}'.`);
        index = end + 1;
    }
    return alias;
}

export class InputBindings {
    protected readonly bindings: string[] = [];
    protected readonly aliases: InputAlias_T[] = [];
    protected readonly cacheCommands = new Map<string, string[]>();

    public constructor(config: ConfigCache) {
        for (let index = 0; index < arrInputKeyNames.length; index++)
            this.bindings.push(arrInputKeyNames[index] ? config.getString("Engine.Input", arrInputKeyNames[index], "user.ini") || "" : "");
        for (let index = 0; index < 40; index++) {
            const value = config.getString("Engine.Input", `Aliases[${index}]`, "user.ini");

            this.aliases.push(value ? readInputAlias(value) : { name: "None", command: "" });
        }
    }

    public getKey(name: string): EInputKey_T | null {
        const key = arrInputKeyNames.findIndex(value => value.toLowerCase() === name.toLowerCase());

        return key >= 0 && key < 255 ? key as EInputKey_T : null;
    }

    public getBinding(key: number): string {
        if (!Number.isInteger(key) || key < 0 || key >= 255) throw new Error(`Invalid input key '${key}'.`);
        return this.bindings[key];
    }

    public process(key: number, action: EInputAction_T, amount: number, execute: InputCommandExecutor_T): boolean {
        const binding = this.getBinding(key);

        if (!binding.length) return false;
        this.executeCommands(binding, action, amount, execute);
        return true;
    }

    protected executeCommands(text: string, action: EInputAction_T, amount: number, execute: InputCommandExecutor_T): void {
        let commands = this.cacheCommands.get(text);

        if (!commands) {
            commands = parseInputLines(text);
            this.cacheCommands.set(text, commands);
        }
        for (let index = 0; index < commands.length; index++) {
            let command = commands[index];
            let viewport = action === EInputAction_T.IST_Press;

            if (action === EInputAction_T.IST_Release) {
                const released = parseInputCommand(command, "OnRelease");

                if (released !== null) {
                    command = released;
                    viewport = true;
                }
            }
            if (execute(command, action, amount, viewport) || executingAlias) continue;
            const token = parseInputToken(command).token.toLowerCase();

            if (!token || token === "none") continue;
            for (let aliasIndex = 0; aliasIndex < this.aliases.length; aliasIndex++) {
                const alias = this.aliases[aliasIndex];

                if (alias.name.toLowerCase() !== token) continue;
                executingAlias = true;
                try {
                    this.executeCommands(alias.command, action, amount, execute);
                } finally {
                    executingAlias = false;
                }
                break;
            }
        }
    }
}

export default InputBindings;
