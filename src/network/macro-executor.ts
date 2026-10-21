import * as GamePackets from "./game-packets";
import getCommandTokens, { CommandType_T } from "./command-parser";
import type NetworkManager from "./network-manager";
import type { NetObject_T } from "./network-actors";

type MacroRow_T = { command: GamePackets.Macro_T["commands"][number], duration: number, start: number, elapsed: number };
type MacroExecution_T = { macro: GamePackets.Macro_T, active: boolean, current: number, rows: MacroRow_T[] };

const PLAIN_CHAT_COMMAND = 0x20000000; // NWindow command classifier 0x1004bbd0.

export class MacroExecutor {
    protected readonly executions = new Map<number, MacroExecution_T>();

    public constructor(protected readonly network: NetworkManager, protected readonly macros: ReadonlyMap<number, GamePackets.Macro_T>, protected readonly objects: ReadonlyMap<number, NetObject_T>, protected readonly shortcuts: ReadonlyMap<number, GamePackets.ShortCut_T>) {}

    protected get ui() { return this.network.getParent().getComponent("gui"); }
    protected get game() { return this.network.getGameClient(); }

    public clear() { this.executions.clear(); }

    public activate(id: number) { // NWindow 0x10074e00 / 0x100a994c.
        const macro = this.macros.get(id);

        if (!this.network.isInWorld() || !macro) return;

        let execution = this.executions.get(id);

        if (!execution) {
            const rows: MacroRow_T[] = new Array(macro.commands.length);

            for (const command of macro.commands) {
                const index = command.index > 0 ? command.index - 1 : command.index;

                if (index < 0 || index >= rows.length) throw new Error(`Invalid macro row index ${command.index}.`);
                rows[index] = { command, duration: 0, start: 0, elapsed: 0 };
            }

            for (let i = 0; i < rows.length; i++)
                if (!rows[i]) throw new Error(`Macro ${id} has an uninitialized row ${i}.`);

            execution = { macro, rows, active: false, current: 0 };
            this.executions.set(id, execution);
        }

        execution.active = true;
    }

    public reset() { // NWindow 0x100a76c0.
        for (const execution of this.executions.values()) {
            if (!execution.active) continue;

            execution.active = false;
            execution.current = 0;
            for (const row of execution.rows) row.duration = row.start = row.elapsed = 0;
        }
    }

    protected getMacroCommandType(text: string): number {
        if (text[0] !== "/" && text[0] !== "／") return PLAIN_CHAT_COMMAND;

        const tokens = getCommandTokens(text);
        const entry = Object.entries(this.ui.getStrings().commands).find(([, name]) => `/${name.toLowerCase()}` === tokens[0].toLowerCase());

        return entry ? Number(entry[0]) : -1;
    }

    protected executeMacroRow(execution: MacroExecution_T) { // NWindow 0x100a7f80.
        const row = execution.rows[execution.current], command = row.command;
        const [ctrl, shift] = this.ui.getInputModifiers();
        const player = this.network.getParent().getComponent("render").player;
        let animation = -1;

        switch (command.type) {
            case GamePackets.MacroCommandType_T.SKILL: this.game.requestMagicSkillUse(command.data1, ctrl, shift); return;
            case GamePackets.MacroCommandType_T.ACTION: {
                const actions: Record<number, number> = { 12: 2, 13: 3, 14: 4, 24: 6, 25: 5, 26: 7, 29: 8, 30: 9, 31: 10, 33: 11, 34: 12, 35: 13 };

                animation = command.data1 === 0 ? this.objects.get(this.network.getUserId()).waitType === GamePackets.WaitType_T.WT_SITTING ? 0 : 1 : actions[command.data1] ?? -1;
                break;
            }
            case GamePackets.MacroCommandType_T.CHAT: {
                this.ui.sendMacroText(command.command);

                const type = this.getMacroCommandType(command.command);
                const actions: Record<number, number> = { [CommandType_T.sit]: 0, [CommandType_T.stand]: 1, [CommandType_T.socialhello]: 2, [CommandType_T.socialvictory]: 3, [CommandType_T.socialcharge]: 4, [CommandType_T.socialno]: 5, [CommandType_T.socialyes]: 6, [CommandType_T.socialbow]: 7, [CommandType_T.socialunaware]: 8, [CommandType_T.socialwaitinga]: 9, [CommandType_T.sociallaugh]: 10, [CommandType_T.socialapplause]: 11, [CommandType_T.socialdance]: 12, [CommandType_T.socialsad]: 13 };
                const next = execution.rows[execution.current + 1];

                if (type === PLAIN_CHAT_COMMAND && next && next.command.type === GamePackets.MacroCommandType_T.CHAT && this.getMacroCommandType(next.command.command) === PLAIN_CHAT_COMMAND)
                    row.duration = Math.fround(command.command.length * Math.fround(0.2));

                if (type === CommandType_T.useshortcutforce || type === CommandType_T.useshortcutstand) {
                    const tokens = getCommandTokens(command.command), page = parseInt(tokens[1], 10), slot = parseInt(tokens[2], 10);

                    if (page >= 1 && page <= 10 && slot >= 1 && slot <= 12 && this.shortcuts.get((page - 1) * 12 + slot - 1)?.type === GamePackets.ShortCutType_T.TYPE_MACRO) this.cancelRecursiveMacro();
                }

                animation = type === CommandType_T.sitstand ? this.objects.get(this.network.getUserId()).waitType === GamePackets.WaitType_T.WT_SITTING ? 0 : 1 : actions[type] ?? -1;
                break;
            }
            case GamePackets.MacroCommandType_T.SHORTCUT: {
                if (command.data1 < 0 || command.data1 > 9 || command.data2 < 0 || command.data2 > 11) return;

                this.network.useShortCut(command.data1, command.data2, ctrl, shift);
                if (this.shortcuts.get(command.data1 * 12 + command.data2)?.type === GamePackets.ShortCutType_T.TYPE_MACRO) this.cancelRecursiveMacro();
                return;
            }
            case GamePackets.MacroCommandType_T.ITEM: debugger; throw new Error(`Macro item row has no initialized retail object ID.`);
            case GamePackets.MacroCommandType_T.DELAY: row.duration = Math.fround(command.data1); return;
            default: throw new Error(`Unknown macro row type ${command.type}.`);
        }

        const duration = player.getSocialAnimDuration(animation);

        if (duration > 0) row.duration = Math.fround(duration);
    }

    protected cancelRecursiveMacro() {
        for (const execution of this.executions.values()) execution.active = false;
        this.ui.showNotice(1339); // NWindow 0x10075990, dialog kind 31.
        this.network.playSystemMessageSound(1339);
    }

    protected getActiveMacroRow(): MacroRow_T {
        for (const id of this.macros.keys()) {
            const execution = this.executions.get(id);

            if (execution && execution.active) return execution.rows[execution.current];
        }

        return null;
    }

    public notifyCommand(types: number[], duration: number) {
        const row = this.getActiveMacroRow();

        if (row && row.command.type === GamePackets.MacroCommandType_T.CHAT && types.includes(this.getMacroCommandType(row.command.command))) row.duration = duration;
    }

    public notifySkill(id: number, hitTime: number) { // NWindow 0x100a8850.
        const row = this.getActiveMacroRow();

        if (!row) return;

        const command = row.command;
        let skillId: number;

        if (command.type === GamePackets.MacroCommandType_T.SKILL) skillId = command.data1;
        else if (command.type === GamePackets.MacroCommandType_T.SHORTCUT) {
            if (command.data1 < 0 || command.data1 > 9 || command.data2 < 0 || command.data2 > 11) return;
            skillId = this.shortcuts.get(command.data1 * 12 + command.data2)?.id;
        } else if (command.type === GamePackets.MacroCommandType_T.CHAT) {
            const type = this.getMacroCommandType(command.command), tokens = getCommandTokens(command.command);

            if (type === CommandType_T.useskillforce || type === CommandType_T.useskillstand) skillId = this.ui.getStrings().skillCommands[tokens.slice(1).join(" ").toLowerCase()];
            else if (type === CommandType_T.useshortcutforce || type === CommandType_T.useshortcutstand) {
                const page = parseInt(tokens[1], 10), slot = parseInt(tokens[2], 10);

                if (!(page >= 1 && page <= 10 && slot >= 1 && slot <= 12)) return;
                skillId = this.shortcuts.get((page - 1) * 12 + slot - 1)?.id;
            } else if (id !== 0) return;
        } else return;

        if (id && skillId !== id) return;
        row.duration = Math.fround(Math.trunc(hitTime / 1000) + 1);
    }

    public tick(deltaTime: number) { // NWindow 0x100aaf60.
        const delta = Math.fround(deltaTime / 1000);

        for (const id of this.macros.keys()) {
            const execution = this.executions.get(id);

            if (!execution || !execution.active) continue;
            if (execution.current >= execution.rows.length) { execution.active = false; execution.current = 0; continue; }

            const row = execution.rows[execution.current], command = row.command;

            if (execution.current === 0 && row.start === 0) {
                row.start = row.elapsed = delta;
                this.executeMacroRow(execution);
                continue;
            }

            row.elapsed = Math.fround(row.elapsed + delta);
            let canAdvance = command.type !== GamePackets.MacroCommandType_T.SKILL;

            if (command.type === GamePackets.MacroCommandType_T.SHORTCUT) {
                const shortcut = this.shortcuts.get(command.data1 * 12 + command.data2);

                if (shortcut && shortcut.type === GamePackets.ShortCutType_T.TYPE_MACRO) { execution.active = false; execution.current = 0; this.cancelRecursiveMacro(); continue; }
                if (shortcut && shortcut.type === GamePackets.ShortCutType_T.TYPE_SKILL) canAdvance = false;
            }
            if (command.type === GamePackets.MacroCommandType_T.CHAT) {
                const type = this.getMacroCommandType(command.command);

                if ([CommandType_T.useskill, CommandType_T.useskillforce, CommandType_T.useskillstand, CommandType_T.pickup, CommandType_T.target, CommandType_T.targetnext, CommandType_T.assist].includes(type)) canAdvance = false;
                if (type === CommandType_T.target || type === CommandType_T.targetnext || type === CommandType_T.assist) {
                    const selected = this.objects.get(this.network.getTargetId());
                    let target: NetObject_T = null;

                    if (type === CommandType_T.target) {
                        const name = getCommandTokens(command.command).slice(1).join(" ").toLowerCase();

                        for (const object of this.objects.values()) {
                            if (object.name.toLowerCase() !== name) continue;
                            target = object;
                            if (!object.isSummon) break;
                        }
                    } else if (selected && selected.actor) target = type === CommandType_T.targetnext ? this.network.getNextEnemy(200, selected.objectId) : this.objects.get(selected.selectedId);

                    if (selected && selected.actor && target && target.actor && selected.objectId === target.objectId)
                        this.notifyCommand([CommandType_T.target, CommandType_T.targetnext, CommandType_T.assist], Math.fround(0.001));
                }
                if (type === CommandType_T.useshortcutforce || type === CommandType_T.useshortcutstand) {
                    const tokens = getCommandTokens(command.command), page = parseInt(tokens[1], 10), slot = parseInt(tokens[2], 10);
                    const shortcut = page >= 1 && page <= 10 && slot >= 1 && slot <= 12 ? this.shortcuts.get((page - 1) * 12 + slot - 1) : null;

                    if (shortcut && shortcut.type === GamePackets.ShortCutType_T.TYPE_MACRO) { execution.active = false; execution.current = 0; this.cancelRecursiveMacro(); continue; }
                    if (shortcut && shortcut.type === GamePackets.ShortCutType_T.TYPE_SKILL) canAdvance = false;
                }
            }

            if (!(row.duration > 0 && row.elapsed - row.start > row.duration) && !(canAdvance && row.duration === 0)) continue;

            row.duration = row.start = row.elapsed = 0;
            execution.current++;
            if (execution.current >= execution.rows.length) continue;

            const next = execution.rows[execution.current];

            next.start = next.elapsed = delta;
            this.executeMacroRow(execution);
        }
    }

}

export default MacroExecutor;
