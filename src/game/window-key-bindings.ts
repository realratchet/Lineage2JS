export type WindowAction_T = "character" | "status" | "skills" | "actions" | "quest" | "clan" | "inventory" | "map" | "systemMenu" | "community" | "macro" | "gm" | "gmPetitions";
export type WindowKeyBindings_T = Record<WindowAction_T, string>;

export const WINDOW_ACTIONS: { id: WindowAction_T, label: string, key: string }[] = [
    { id: "character", label: "Character window", key: "Alt+KeyI" },
    { id: "status", label: "Status", key: "Alt+KeyT" },
    { id: "skills", label: "Skills", key: "Alt+KeyK" },
    { id: "actions", label: "Actions", key: "Alt+KeyC" },
    { id: "quest", label: "Quests", key: "Alt+KeyU" },
    { id: "clan", label: "Clan", key: "Alt+KeyN" },
    { id: "inventory", label: "Inventory", key: "Alt+KeyV" },
    { id: "map", label: "Map", key: "Alt+KeyM" },
    { id: "systemMenu", label: "System menu", key: "Alt+KeyX" },
    { id: "community", label: "Community", key: "Alt+KeyB" },
    { id: "macro", label: "Macros", key: "Alt+KeyR" },
    { id: "gm", label: "GM window", key: "Alt+KeyG" },
    { id: "gmPetitions", label: "GM petitions", key: "Alt+KeyO" }
];

const keyLabels: Record<string, string> = { PageUp: "PgUp", PageDown: "PgDn", Backspace: "Bksp", Delete: "Del", Insert: "Ins", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backquote: "`", Equal: "=", Minus: "-", NumpadAdd: "Num +", NumpadSubtract: "Num -", NumpadMultiply: "Num *", NumpadDivide: "Num /", NumpadDecimal: "Num .", NumpadEnter: "Num Enter" };

export function getDefaultWindowKeyBindings(): WindowKeyBindings_T { return Object.fromEntries(WINDOW_ACTIONS.map(action => [action.id, action.key])) as WindowKeyBindings_T; }

export function getWindowKeyChord(event: KeyboardEvent): string {
    return [event.ctrlKey ? "Ctrl" : "", event.altKey ? "Alt" : "", event.shiftKey ? "Shift" : "", event.code].filter(Boolean).join("+");
}

export function isWindowKeyChord(chord: string) {
    if (!/^(Ctrl\+)?(Alt\+)?(Shift\+)?(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Space|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Backquote|Numpad(Add|Subtract|Multiply|Divide|Decimal|Enter))$/.test(chord)) return false;

    return chord !== "Ctrl+KeyF" && chord !== "Ctrl+Backquote";
}

export function validateWindowKeyBindings(bindings: WindowKeyBindings_T) {
    if (!bindings || typeof bindings !== "object" || Array.isArray(bindings) || Object.keys(bindings).some(id => !WINDOW_ACTIONS.some(action => action.id === id))) throw new Error(`Invalid window key bindings.`);

    const assigned = new Set<string>(), resolved = getDefaultWindowKeyBindings();

    for (const { id } of WINDOW_ACTIONS) {
        const key = bindings[id];

        if (key === undefined) continue;
        if (typeof key !== "string" || key && (!isWindowKeyChord(key) || assigned.has(key))) throw new Error(`Invalid window key binding '${id}'.`);
        if (key) assigned.add(key);
        resolved[id] = key;
    }
    for (const { id } of WINDOW_ACTIONS)
        if (bindings[id] === undefined && assigned.has(resolved[id])) resolved[id] = "";

    return resolved;
}

export function formatWindowKeyChord(chord: string) {
    if (!chord) return "Unbound";

    const arrParts = chord.split("+"), code = arrParts.pop();

    arrParts.push(keyLabels[code] || code.replace(/^Key([A-Z])$/, "$1").replace(/^Digit([0-9])$/, "$1").replace(/^Arrow(Up|Down|Left|Right)$/, "$1").replace(/^Numpad/, "Num "));
    return arrParts.join("+");
}

export function replaceWindowKeyBindings(text: string, bindings: WindowKeyBindings_T) {
    return text.replace(/\bAlt\s*\+\s*([ITKCUNVMXGOBR])\b/gi, (original, key: string) => {
        const action = WINDOW_ACTIONS.find(action => action.key === `Alt+Key${key.toUpperCase()}`)!;

        return bindings[action.id] === action.key ? original : formatWindowKeyChord(bindings[action.id]);
    });
}
