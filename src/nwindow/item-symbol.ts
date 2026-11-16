const arrGradeSymbols = ["", "graded", "gradec", "gradeb", "gradea", "grades"]; // 0x1006b440, table 0x10242504.

export function getCrystalGradeSymbol(grade: number): string { return arrGradeSymbols[grade]; }

export default getCrystalGradeSymbol;
