import { Vector3 } from "three";
import { Paperdoll_T, type CharInfo_T } from "./game-packets";
import type { NetObject_T } from "./network-actors";
import type NetworkManager from "./network-manager";

type SimulatedPawn_T = { object: NetObject_T, home: Vector3, next: number };

const classesByRace = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 88, 89, 90, 91, 92, 93, 10, 11, 12, 13, 14, 15, 16, 17, 94, 95, 96, 97, 98],
    [18, 19, 20, 21, 22, 23, 24, 99, 100, 101, 102, 25, 26, 27, 28, 29, 30, 103, 104, 105],
    [31, 32, 33, 34, 35, 36, 37, 106, 107, 108, 109, 38, 39, 40, 41, 42, 43, 110, 111, 112],
    [44, 45, 46, 47, 48, 113, 114, 49, 50, 51, 52, 115, 116],
    [53, 54, 55, 56, 57, 117, 118]
];
const skillCandidates = [1177, 1184, 1220, 1230, 1235, 1239, 1011, 1015, 1035, 1040, 1068, 1204, 1056, 1147, 1148, 1164, 1168, 1172, 1181, 1263, 1275, 1340, 1342, 3, 16, 56, 100, 190, 260, 263, 101, 19, 24, 30, 36, 48, 79, 99, 121, 245, 261, 279, 280, 281, 286, 287, 321, 343, 1, 255, 284, 314, 1001, 1004, 1007, 1009, 1032, 1036, 1043, 1062, 1073, 1077, 1078, 1086, 1087, 1243, 1257];
const socials = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export class PawnSimulation {
    public readonly pawns: SimulatedPawn_T[] = [];
    public readonly counts = { move: 0, attack: 0, skill: 0, social: 0, idle: 0 };
    protected readonly objects = new Set<NetObject_T>();
    protected seed = 1;
    protected nextId = 2146990000;
    protected generation = 0;
    protected timer = 0;
    protected loading = false;

    public constructor(protected readonly network: NetworkManager) {}

    protected random(): number {
        this.seed = this.seed + 0x6D2B79F5 | 0;
        let value = Math.imul(this.seed ^ this.seed >>> 15, 1 | this.seed);
        value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    }

    protected pick<T>(values: T[]): T { return values[Math.floor(this.random() * values.length)]; }

    public async spawn(count: number, center: Vector3): Promise<void> {
        if (!Number.isSafeInteger(count) || count <= 0) throw new Error(`Invalid simulated pawn count '${count}'.`);
        if (this.loading) throw new Error(`Simulated pawns are already loading.`);

        const generation = this.generation, network = this.network, game = network.getParent(), origin = center.clone();
        this.loading = true;
        try {
            const strings = await game.getComponent("asset").getGameStrings();
            if (generation !== this.generation) return;
            if (!network.ui) {
                network.ui = game.getComponent("gui");
                network.ui.create();
                await network.ui.setStrings(strings);
            }
            if (generation !== this.generation) return;

            const pools: Record<string, number[]> = { weapon: [], weapon2h: [], shield: [], chest: [], full: [], legs: [], gloves: [], feet: [], head: [] };
            const armorSlots: Record<number, string> = { 6: "head", 9: "gloves", 10: "chest", 11: "legs", 12: "feet", 15: "full" };
            for (const key of Object.keys(strings.itemInfos)) {
                const info = strings.itemInfos[key], id = Number(key);
                if (info.templateClass === "armor" && armorSlots[info.bodyPart]) pools[armorSlots[info.bodyPart]].push(id);
                if (info.templateClass !== "weapon") continue;
                if ([1, 2, 3, 7].includes(info.weaponType)) pools.weapon.push(id);
                else if ([4, 5, 6, 8].includes(info.weaponType)) pools.weapon2h.push(id);
                else if (info.weaponType === 0 && info.shieldPDef > 0) pools.shield.push(id);
            }
            const skills = skillCandidates.filter(id => strings.skillInfos[`${id}:1`]);
            let next = 0;
            const worker = async (): Promise<void> => {
                while (next < count && generation === this.generation) {
                    next++;
                    const race = Math.floor(this.random() * 5), classId = this.pick(classesByRace[race]), sex = this.random() < 0.5 ? 0 : 1;
                    const angle = this.random() * Math.PI * 2, distance = Math.sqrt(this.random()) * 200;
                    while (network.actors.hasServerObject(this.nextId)) this.nextId++;
                    const objectId = this.nextId++;
                    const info: CharInfo_T = { objectId, name: `Crowd${objectId - 2146990000}`, title: "", race, classId, sex, hairStyle: Math.floor(this.random() * (sex ? 7 : 5)), hairColor: Math.floor(this.random() * 4), face: Math.floor(this.random() * 3), enchantLevel: this.random() < 0.2 ? 4 + Math.floor(this.random() * 12) : 0, x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance, z: origin.z, heading: Math.floor(this.random() * 65536), isRunning: this.random() < 0.7, isAlikeDead: false, isInCombat: false, mountType: 0, mountNpcId: 0, cubics: [], abnormalState: 0, paperdoll: this.createPaperdoll(pools), privateStoreType: 0, isSitting: false, runSpd: 160, walkSpd: 80, swimRunSpd: 100, swimWalkSpd: 50, airRunSpd: 300, airWalkSpd: 150, moveMultiplier: 1, attackSpeedMultiplier: 1, collisionRadius: 9, collisionHeight: 23, karma: 0, pvpFlag: 0, recommendations: 0, nameColor: 0xffffff, isHero: false, clanId: 0, clanCrestId: 0, allyId: 0, allyCrestId: 0, largeCrestId: 0, clanRelation: 0, team: 0 };
                    const object = network.actors.spawnSimulatedPlayer(info);
                    this.objects.add(object);
                    const actor = await object.actorReady;
                    if (generation !== this.generation || object.isRemoved) return;
                    if (!actor) throw new Error(`Simulated pawn '${info.name}' failed to load.`);
                    this.pawns.push({ object, home: new Vector3(info.x, info.y, info.z), next: Infinity });
                }
            };
            await Promise.all(Array.from({ length: Math.min(4, count) }, () => worker()));
            if (generation === this.generation) {
                const now = performance.now();
                for (const pawn of this.pawns) if (pawn.next === Infinity) pawn.next = now + this.random() * 4000;
                if (!this.timer) this.timer = window.setInterval(() => this.tick(skills), 100);
            }
        } catch (error) {
            this.clear();
            throw error;
        } finally { this.loading = false; }
    }

    protected createPaperdoll(pools: Record<string, number[]>): number[] {
        const paperdoll = new Array(16).fill(0);
        if (pools.weapon2h.length && this.random() < 0.35) paperdoll[Paperdoll_T.PAPERDOLL_RHAND] = paperdoll[Paperdoll_T.PAPERDOLL_LRHAND] = this.pick(pools.weapon2h);
        else if (pools.weapon.length) {
            paperdoll[Paperdoll_T.PAPERDOLL_RHAND] = this.pick(pools.weapon);
            if (pools.shield.length && this.random() < 0.4) paperdoll[Paperdoll_T.PAPERDOLL_LHAND] = this.pick(pools.shield);
        }
        if (pools.full.length && this.random() < 0.3) paperdoll[Paperdoll_T.PAPERDOLL_CHEST] = paperdoll[Paperdoll_T.PAPERDOLL_LEGS] = this.pick(pools.full);
        else {
            if (pools.chest.length) paperdoll[Paperdoll_T.PAPERDOLL_CHEST] = this.pick(pools.chest);
            if (pools.legs.length) paperdoll[Paperdoll_T.PAPERDOLL_LEGS] = this.pick(pools.legs);
        }
        if (pools.gloves.length && this.random() < 0.85) paperdoll[Paperdoll_T.PAPERDOLL_GLOVES] = this.pick(pools.gloves);
        if (pools.feet.length && this.random() < 0.85) paperdoll[Paperdoll_T.PAPERDOLL_FEET] = this.pick(pools.feet);
        if (pools.head.length && this.random() < 0.3) paperdoll[Paperdoll_T.PAPERDOLL_HEAD] = this.pick(pools.head);
        return paperdoll;
    }

    protected tick(skills: number[]): void {
        const now = performance.now();
        for (const entry of this.pawns) {
            const object = entry.object, actor = object.actor;
            if (object.isRemoved || !actor || !actor.isInteractive() || actor.checkLoadingResource() || now < entry.next) continue;
            entry.next = now + 1500 + this.random() * 2500;
            const other = this.pick(this.pawns).object, kind = Math.floor(this.random() * 8);
            if (kind < 2) {
                this.counts.move++;
                const angle = this.random() * Math.PI * 2, distance = Math.sqrt(this.random()) * 300;
                object.destination = entry.home.clone().add(new Vector3(Math.cos(angle) * distance, Math.sin(angle) * distance, 0));
                actor.goTo(object.destination);
            } else if (kind < 4) {
                if (other === object || other.isRemoved || !other.actor) continue;
                this.counts.attack++;
                const miss = this.random() < 0.15;
                this.network.combat.startServerAttack(object, [{ targetObjectId: other.objectId, actionTarget: other.actor, damage: miss ? 0 : 100, isMiss: miss, isCritical: this.random() < 0.2, isShieldDefense: false, isSpirit: this.random() < 0.5, soulshotGrade: Math.floor(this.random() * 5) }], actor.position);
            } else if (kind < 6) {
                if (!skills.length) continue;
                this.counts.skill++;
                const target = this.random() < 0.5 || other.isRemoved ? object : other;
                this.network.combat.startServerSkill(object, target.objectId, this.pick(skills), 1, 0.8 + this.random() * 1.5, actor.position, false, now);
            } else if (kind === 6) {
                this.counts.social++;
                this.network.combat.onSocialAction(object.objectId, this.pick(socials));
            } else this.counts.idle++;
        }
    }

    public clear(): void {
        this.generation++;
        if (this.timer) window.clearInterval(this.timer);
        this.timer = 0;
        for (const object of this.objects) if (this.network.actors.objects.get(object.objectId) === object) this.network.actors.removeObject(object.objectId);
        this.objects.clear();
        this.pawns.length = 0;
        this.counts.move = this.counts.attack = this.counts.skill = this.counts.social = this.counts.idle = 0;
    }
}

export default PawnSimulation;
