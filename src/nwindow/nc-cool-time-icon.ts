const arrRotation = Array.from({ length: 360 }, (_, index) => `L2_SkillTime.Rotation_Type.cooltime${index}`);
const arrEnd = Array.from({ length: 9 }, (_, index) => `L2_SkillTime.CooltimeEnd.CooltimeEnd00${index + 1}`);

export class NCCoolTimeIcon {
    public texture: string = null;
    public color = 0xffffff;
    public isFinishing = false;
    protected readonly startedAt = performance.now();
    protected readonly endsAt: number;
    protected readonly duration: number;
    protected readonly firstFrame: number;

    public constructor(duration: number, remaining: number) {
        this.duration = duration * 1000;
        this.endsAt = this.startedAt + remaining * 1000;
        this.firstFrame = Math.trunc(360 * (1 - remaining / duration));
        this.update(performance.now());
    }

    public static getTextures() { return [...arrRotation, ...arrEnd]; }

    public update(now: number) {
        const remaining = this.endsAt - now;

        // NCCoolTimeIcon, NWindow RVA 0x1f190 / 0x1f610: 360 rotation frames, then a 0.5s completion flash.
        this.isFinishing = remaining <= 0;
        this.color = this.isFinishing ? 0x008080 : 0xffffff;
        this.texture = remaining > 0 ? arrRotation[Math.min(359, this.firstFrame + Math.max(0, Math.trunc(360 * (now - this.startedAt) / this.duration)))] : arrEnd[Math.trunc(-remaining * 9 / 500)] || null;
    }
}

export default NCCoolTimeIcon;
