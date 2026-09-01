import BaseConfigFile from "./un-base-config";

// system/lineagewarrior.int declares stance-indexed animation names per playable class.
export type WarriorAnimations_T = {
    wait: string;
    walk: string;
    run: string;
    death: string;
    falling: string;
    swim: string;
    swimWait: string;
};

const ANIM_KEYS: Record<keyof WarriorAnimations_T, string> = {
    wait: "WaitAnimName",
    walk: "WalkAnimName",
    run: "RunAnimName",
    death: "DeathAnimName",
    falling: "FallAnimName",
    swim: "SwimAnimName",
    swimWait: "SwimWaitAnimName"
};

export class UConfigWarrior extends BaseConfigFile {
    protected readonly classAnimations = new Map<string, WarriorAnimations_T>();

    public async load(): Promise<this> {
        const fileContents = this.decodeConfig();
        const sections = fileContents.split(/\r?\n\[/);

        for (const section of sections) {
            const header = section.indexOf("]");

            if (header === -1) continue;

            const className = section.slice(0, header).replace("[", "").trim();
            const animations = {} as WarriorAnimations_T;

            for (const field of Object.keys(ANIM_KEYS) as (keyof WarriorAnimations_T)[]) {
                const match = new RegExp(`^${ANIM_KEYS[field]}\\[0\\]=(.+)$`, "m").exec(section);

                if (match) animations[field] = match[1].trim();
            }

            if (animations.wait) this.classAnimations.set(className.toLowerCase(), animations);
        }

        if (this.classAnimations.size === 0) throw new Error(`'${this.path}' declared no playable classes.`);

        return this;
    }

    public getAnimations(className: string): WarriorAnimations_T {
        const animations = this.classAnimations.get(className.toLowerCase());

        if (!animations) throw new Error(`'${this.path}' has no '${className}' class.`);

        return animations;
    }

    public getClassNames(): string[] { return [...this.classAnimations.keys()]; }
}

export default UConfigWarrior;
