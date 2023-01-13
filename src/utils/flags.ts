function allFlags(flags: number, matchFlags: number): boolean { return (flags & matchFlags) === flags; }
function anyFlags(flags: number, matchFlags: number): boolean { return (flags & matchFlags) !== 0; }

function flagBitsToDict(flags: number, enum_: Record<string, number>) {
    const flagNames = Object.keys(enum_).filter(x => !x.match(/\d+/));
    return flagNames.reduce((acc, name) => {
        if (anyFlags(flags, enum_[name]))
            acc[name] = true;

        return acc;
    }, {} as Record<string, boolean>);
}

export { anyFlags, allFlags, flagBitsToDict }