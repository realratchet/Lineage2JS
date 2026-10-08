import NCHtmlViewer from "./nc-html-viewer";

const arrBoardTokens = ["ROOT_BID", "THREAD_ORDER", "BID", "STEP", "PARENT_BID", "CHAR_ID", "CHAR_NAME", "ACCOUNT_ID", "ACCOUNT_NAME", "WORLD_ID", "WRITER", "TITLE", "CONTENT", "POST_DATE", "MODIFY_DATE", "READ_COUNT", "STATUS", "IP", "COMMENT", "THREAD"];

function replaceBoardToken(html: string, index: number, value: string) {
    const token = `<!--${arrBoardTokens[index]}-->`, position = html.indexOf(token);

    return position > 0 ? html.slice(0, position) + value + html.slice(position + token.length) : html;
}

export class CBBSHtmlViewer extends NCHtmlViewer { // CBBSHtmlViewer 0x10190ee0, vtable 0x101a8eb0.
    public boardPending = false;
    public onVariableError: (id: number) => void = null;
    public isInvalidVariableName: (value: string) => boolean = null;
    protected readonly arrBoardParts = Array(9).fill("") as string[];
    protected readonly arrBoardCounts = [0, 0, 0];
    protected boardMode = 0;
    protected boardTimerElapsed = 0;

    public tick(deltaSeconds: number) { // Console Tick 0x1007fa5c: strict greater-than, subtract one interval.
        super.tick(deltaSeconds);

        const elapsed = this.boardTimerElapsed + Math.fround(deltaSeconds), period = 10000 * Math.fround(0.001);

        this.boardTimerElapsed = Math.fround(elapsed);
        if (elapsed > period) {
            this.boardTimerElapsed = Math.fround(elapsed - period);
            this.boardPending = false;
        }
    }

    public resetBoardFragments() { this.arrBoardCounts.fill(0); }

    public dispatchCommand(target: string): number { return super.dispatch(target); }

    public dispatch(target: string): number {
        if (this.boardPending) return 0;

        this.resetBoardFragments();
        const result = super.dispatch(target);

        if (result === 1) this.boardPending = true;
        return result;
    }

    public async setBoardHtml(html: string) { // 0x100421d0: counters count arrivals, including repeated IDs.
        if (!html) return;
        if (html[0] === "<") {
            this.boardPending = false;
            this.boardMode = 0;
            await this.setHtml(html);
            return;
        }
        const match = /^\x08*([^\x08]+)(?:\x08([\s\S]*))?$/.exec(html);

        if (!match) return;
        const index = ["1", "2", "3", "4", "1001", "1002", "101", "102", "103"].indexOf(match[1]);

        if (index >= 0) {
            this.arrBoardParts[index] = match[2] || "";
            this.arrBoardCounts[index < 4 ? 0 : index < 6 ? 1 : 2]++;
        }
        if (this.arrBoardCounts[2] === 3) {
            const content = this.arrBoardParts.slice(6).join("");

            this.arrBoardParts.fill("", 6);
            this.arrBoardCounts[2] = 0;
            this.boardPending = false;
            this.boardMode = 1;
            await this.setHtml(content);
        }
        if (this.arrBoardCounts[0] === 4) {
            let content = this.arrBoardParts[0];
            const arrValues = this.arrBoardParts[1].split("\x08").filter(value => value.length);

            for (let i = 0; i < 18 && arrValues.length; i++)
                content = replaceBoardToken(content, i, arrValues[Math.min(i, arrValues.length - 1)]);
            content = replaceBoardToken(content, 18, this.arrBoardParts[2]);
            content = replaceBoardToken(content, 19, this.arrBoardParts[3]);
            this.arrBoardParts.fill("", 0, 4);
            this.arrBoardCounts[0] = 0;
            this.boardPending = false;
            this.boardMode = 2;
            await this.setHtml(content);
        }
        if (this.arrBoardCounts[1] === 2) {
            let content = this.arrBoardParts[4], writer = "", title = "", body = "";
            const arrValues = this.arrBoardParts[5].split("\x08").filter(value => value.length);

            for (let i = 0; i < 17 && arrValues.length; i++) {
                const value = arrValues[Math.min(i, arrValues.length - 1)];

                if (i === 10) writer = value === " " ? "" : value;
                else if (i === 11) title = value === " " ? "" : value;
                else if (i === 12) body = value === " " ? "" : value;
                else content = replaceBoardToken(content, i, value);
            }
            this.arrBoardParts.fill("", 4, 6);
            this.arrBoardCounts[1] = 0;
            this.boardPending = false;
            this.boardMode = 3;
            const serial = this.loadSerial + 1;

            await this.setHtml(content);
            if (serial !== this.loadSerial) return;

            let index = 0;

            if (writer) {
                for (; index < this.variables.length; index++) {
                    const variable = this.variables[index];

                    if (!variable.isMultiline) {
                        variable.edit.setValue(variable.edit.getValue() + writer);
                        index++;
                        break;
                    }
                }
            }
            for (; index < this.variables.length; index++) {
                const variable = this.variables[index];

                if (!variable.isMultiline && title) variable.edit.setValue(variable.edit.getValue() + title);
            }
            if (body)
                this.variables.forEach(variable => { if (variable.isMultiline) variable.edit.setValue(variable.edit.getValue() + body); });
        }
    }

    protected getVariable(name: string): string { // 0x1003c5c0: CBBSHtmlViewer's variable validator.
        const variable = this.variables.find(entry => entry.name === name);

        if (!variable) return null;
        const value = variable.edit.getValue();
        let error = 0;

        if (value && !variable.isMultiline && this.isInvalidVariableName && this.isInvalidVariableName(value)) error = 204;
        else if (!value.length || value.length > 3000) error = variable.isMultiline ? 329 : 1207;
        else if (/^ +$/.test(value)) error = 329;
        if (error) {
            if (this.onVariableError) this.onVariableError(error);
            return null;
        }
        return value;
    }
}

export default CBBSHtmlViewer;
