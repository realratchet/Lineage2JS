import cyrb53 from "./hash-cyrb";

class StringSet {
    private set = new Map<number, string>();

    public add(string: string) { this.set.set(cyrb53(string), string); }
    public has(string: string) { this.set.has(cyrb53(string)); }
    public delete(string: string) { this.set.delete(cyrb53(string)); }

    public hash(): bigint {
        const keys = [...this.set.keys()].sort();
        const masterKey = keys.join(";");
        const hash = cyrb53(masterKey);

        return BigInt(hash);
    }

    public static fromStrings(...strings: string[]) { return new StringSet(strings); }

    public constructor(strings: string[] = []) { strings.forEach(s => this.add(s)); }
}

export default StringSet;
export { StringSet as SmartSet };