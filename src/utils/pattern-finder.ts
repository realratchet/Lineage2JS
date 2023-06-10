import { BufferValue } from "@l2js/core";

function findPattern(pkg: UPackage, pattern: number[]) {
    const prevOffset = pkg.tell();
    const uint8 = new BufferValue(BufferValue.uint8);

    let index = -1, patternMatch = 0, maxPattern = 0;

    pkg.seek(0, "set");

    try {
        pkg.seek(0, "set");

        while (patternMatch !== pattern.length) {

            const preIndex = pkg.tell();
            const v = pkg.read(uint8).value as number;

            if (v === pattern[patternMatch]) {
                if (patternMatch === 0) index = preIndex;

                patternMatch++;
            } else {
                maxPattern = Math.max(maxPattern, patternMatch);
                index = -1;
                patternMatch = 0;
            }
        }

    } catch (e) {
        index = -1;
        patternMatch = 0;
    }


    pkg.seek(prevOffset, "set");

    return { index, patternMatch, maxPattern };
}

export default findPattern;
export { findPattern };