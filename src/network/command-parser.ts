function getCommandTokens(text: string) {
    const tokens: string[] = [];
    let token = "", depth = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === "[") depth++;
        else if (char === "]") {
            depth--;
            if (token) { tokens.push(token); token = ""; }
        } else if (depth === 0 && " \u3000\n\t\r={}$".includes(char)) {
            if (token) { tokens.push(token); token = ""; }
        } else token += char;
    }
    if (token) tokens.push(token);

    return tokens;
}

export default getCommandTokens;
