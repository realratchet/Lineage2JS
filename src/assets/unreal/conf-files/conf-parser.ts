
export function findSection(fileContents: string, sectionName: string): number {
    const sectionHeader = `[${sectionName}]\r\n`;
    const indexOf = fileContents.indexOf(sectionHeader);

    if (indexOf === -1)
        throw new Error(`Section '${sectionName}' was not found in file contents!`);

    return indexOf + sectionHeader.length;
}

export function consumeNextValue(fileContents: string, startOffset: number): [string, string, number] {
    let offset = startOffset;

    while (fileContents[offset] === ";")
        offset = fileContents.indexOf("\r\n", offset) + 2;

    const eqSign = fileContents.indexOf("=", offset);

    if (eqSign === -1)
        throw new Error(`Could not find assignment: ${fileContents.slice(offset)}`);

    const lineEnd = fileContents.indexOf("\r\n", eqSign + 1);

    if (lineEnd === -1)
        throw new Error(`Could not find eol: ${fileContents.slice(eqSign + 1)}`);

    const varName = fileContents.slice(offset, eqSign).trim();
    const varValue = fileContents.slice(eqSign + 1, lineEnd).trim();

    return [varName, varValue, lineEnd - startOffset + 2];
}

export function consumeHSV(line: string): [number, number, number, number] {
    const offsetLeft = line.indexOf("(");

    if (offsetLeft === -1)
        throw new Error(`Could not find '(': ${line}`);

    const offsetRight = line.indexOf(")", offsetLeft);

    if (offsetRight === -1)
        throw new Error(`Could not find ')': ${line}`);

    let t = 0, h = 0, s = 0, b = 0;

    for (const param of line.slice(offsetLeft + 1, offsetRight).split(",")) {
        const [k, v] = param.split("=").map(v => v.trim());

        switch (k.toLowerCase()) {
            case "t": t = parseInt(v); break;
            case "hue": h = parseInt(v); break;
            case "sat": s = parseInt(v); break;
            case "bri": b = parseInt(v); break;
            default: throw new Error(`Unknown light parameter: ${k}`);
        }
    }

    return [t, h, s, b];
}

export function consumeRGB(line: string): [number, number, number, number] {
    const offsetLeft = line.indexOf("(");

    if (offsetLeft === -1)
        throw new Error(`Could not find '(': ${line}`);

    const offsetRight = line.indexOf(")", offsetLeft);

    if (offsetRight === -1)
        throw new Error(`Could not find ')': ${line}`);

    let t = 0, r = 0, g = 0, b = 0;

    for (const param of line.slice(offsetLeft + 1, offsetRight).split(",")) {
        const [k, v] = param.split("=").map(v => v.trim());

        switch (k.toLowerCase()) {
            case "t": t = parseInt(v); break;
            case "r": r = parseInt(v); break;
            case "g": g = parseInt(v); break;
            case "b": b = parseInt(v); break;
            default: throw new Error(`Unknown light parameter: ${k}`);
        }
    }

    return [t, r, g, b];
}

export function consumeScale(line: string): [number, number] {
    const offsetLeft = line.indexOf("(");

    if (offsetLeft === -1)
        throw new Error(`Could not find '(': ${line}`);

    const offsetRight = line.indexOf(")", offsetLeft);

    if (offsetRight === -1)
        throw new Error(`Could not find ')': ${line}`);

    let t = 0, s = 0;

    for (const param of line.slice(offsetLeft + 1, offsetRight).split(",")) {
        const [k, v] = param.split("=").map(v => v.trim());

        switch (k.toLowerCase()) {
            case "t": t = parseInt(v); break;
            case "s": s = parseFloat(v); break;
            default: throw new Error(`Unknown light parameter: ${k}`);
        }
    }

    return [t, s];
}

export function consumeTuple(line: string): Record<string, string> {
    const offsetLeft = line.indexOf("(");
    if (offsetLeft === -1) return {};

    const offsetRight = line.indexOf(")", offsetLeft);
    if (offsetRight === -1) return {};

    const result: Record<string, string> = {};
    const content = line.slice(offsetLeft + 1, offsetRight);

    // Split by comma, but careful about potential nested parens if any (though usually simple here)
    const parts = content.split(",");
    for (const part of parts) {
        const [k, v] = part.split("=").map(s => s.trim());
        if (k && v) {
            result[k.toLowerCase()] = v;
        }
    }
    return result;
}
