import BufferValue from "../buffer-value";
import UExport from "./un-export";
import UField from "./un-field";
import UFunction from "./un-function";
import UObject from "./un-object";
import UPackage from "./un-package";
import UStruct from "./un-struct";

const probeNames = [
    "Spawned", "Destroyed", "GainedChild", "LostChild",
    "Probe4", "Probe5", "Trigger", "UnTrigger",
    "Timer", "HitWall", "Falling", "Landed",
    "ZoneChange", "Touch", "UnTouch", "Bump",
    "BeginState", "EndState", "BaseChange", "Attach",
    "Detach", "ActorEntered", "ActorLeaving", "KillCredit",
    "AnimEnd", "EndedRotation", "InterpolateEnd", "EncroachingOn",
    "EncroachedBy", "FootZoneChange", "HeadZoneChange", "PainTimer",
    "SpeechTimer", "MayFall", "Probe34", "Die",
    "Tick", "PlayerTick", "Expired", "Probe39",
    "SeePlayer", "EnemyNotVisible", "HearNoise", "UpdateEyeHeight",
    "SeeMonster", "SeeFriend", "SpecialHandling", "BotDesireability",
    "Probe48", "Probe49", "Probe50", "Probe51",
    "Probe52", "Probe53", "Probe54", "Probe55",
    "Probe56", "Probe57", "Probe58", "Probe59",
    "Probe60", "Probe61", "Probe62", "All"
];


class UState extends UStruct {
    protected probeMask: bigint;
    protected ignoreMask: bigint;
    protected stateFlags: number;
    protected labelTableOffset: number;

    public readonly functions: GenericObjectContainer_T<UFunction> = {};

    public readonly isState = true;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const uint64 = new BufferValue(BufferValue.uint64);
        const uint32 = new BufferValue(BufferValue.uint32);
        const uint16 = new BufferValue(BufferValue.uint16);

        this.probeMask = pkg.read(uint64).value as bigint;
        this.ignoreMask = pkg.read(uint64).value as bigint;
        this.stateFlags = pkg.read(uint32).value as number;
        this.labelTableOffset = pkg.read(uint16).value as number;

        this.readHead = pkg.tell();

        const probes = [] as string[];

        for (let i = 0; i < 64; i++) {
            if (this.probeMask & (1n << BigInt(i))) {
                const pname = probeNames[i];

                probes.push(pname);
            }
        }

        // this.promisesLoading.push(new Promise<void>(async resolve => {
        //     let childPropId = this.firstChildPropId;

        //     while (childPropId > 0) {
        //         const field = await pkg.fetchObject<UFunction>(childPropId);

        //         if (field instanceof UFunction) {
        //             await field.onDecodeReady();

        //             this.functions[field.friendlyName] = field;
        //             // debugger;
        //         }

        //         childPropId = field.nextFieldId;
        //     }

        //     if (Object.keys(this.functions).length > 0)
        //         debugger;

        //     resolve();
        // }));
    }
}

export default UState;
export { UState };