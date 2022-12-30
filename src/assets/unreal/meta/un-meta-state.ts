import UMetaStruct from "./un-meta-struct";
import BufferValue from "../../buffer-value";

class UMetaState extends UMetaStruct {
    protected probeMask: bigint;
    protected ignoreMask: bigint;
    protected stateFlags: number;
    protected labelTableOffset: number;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        const uint64 = new BufferValue(BufferValue.uint64);
        const uint32 = new BufferValue(BufferValue.uint32);
        const uint16 = new BufferValue(BufferValue.uint16);

        this.probeMask = pkg.read(uint64).value as bigint;
        this.ignoreMask = pkg.read(uint64).value as bigint;
        this.stateFlags = pkg.read(uint32).value as number;
        this.labelTableOffset = pkg.read(uint16).value as number;
    }
}

export default UMetaState;
export { UMetaState };

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