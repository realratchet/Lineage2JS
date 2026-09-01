import { Material, Mesh } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { MESHES_CHANGED_EVENT } from "./animation-component";
import type AnimationComponent from "./animation-component";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type { ISkinNotifyDecodeInfo, IGroupedSkinNotifyDecodeInfo, ISkinNotifyEntryDecodeInfo, IRandomSkinNotifyDecodeInfo } from "@l2js/engine/contracts/anim-notify";

class SkinNotifyComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "skinNotify";
    protected readonly renderManager: RenderManager;
    protected cycleElapsed = 0;
    protected cycleDuration = 0;
    protected skinIndex = -1;
    protected readonly faces: SkinNotifyFaceState_T[] = [];

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<void> {
        if (type !== MESHES_CHANGED_EVENT) return COMPONENT_EVENT_NOT_HANDLED;

        this.setMeshes(data as Mesh[]);
    }

    public onUpdate(_currentTime: number, deltaTime: number): void {
        const action = this.getComponent<AnimationComponent>("animation").getAction();

        if (!action) return;

        const clip = action.getClip();
        const info = (clip as any).skinNotify as ISkinNotifyDecodeInfo;

        if (!info) return;

        const currentFrame = clip.duration > 0 ? Math.max(0, action.time / clip.duration * info.frameCount) : 0;
        let skinIndex = 0;

        switch (info.mode) {
            case "fixed":
                skinIndex = selectSkinNotifyIndex(info.timeline, currentFrame);
                break;
            case "grouped": {
                let group: IGroupedSkinNotifyDecodeInfo["groups"][number] = null;

                for (const next of info.groups) {
                    if (next.startFrame > currentFrame) break;
                    group = next;
                }

                if (!group || clip.duration <= 0) break;

                const channelAnimRate = action.getEffectiveTimeScale() / clip.duration;

                if (channelAnimRate !== 0)
                    skinIndex = selectSkinNotifyIndex(group.timeline, (currentFrame - group.startFrame) / (info.frameCount * channelAnimRate));
                break;
            }
            case "random":
                this.cycleElapsed += deltaTime;

                if (this.cycleDuration === 0) this.cycleDuration = randomSkinNotifyDuration(info);

                while (this.cycleElapsed >= this.cycleDuration) {
                    this.cycleElapsed -= this.cycleDuration;
                    this.cycleDuration = randomSkinNotifyDuration(info);
                }

                skinIndex = selectSkinNotifyIndex(info.timeline, this.cycleElapsed);
                break;
            default: throw new Error(`Unknown skin notify mode '${(info as any).mode}'.`);
        }

        if (skinIndex === this.skinIndex) return;

        for (const face of this.faces) {
            const material = face.materials[skinIndex];

            if (!material) throw new Error(`Face mesh '${face.mesh.name}' has no skin material '${skinIndex}'.`);

            face.mesh.material = material;
        }

        if (this.faces.length > 0) this.renderManager.invalidatePawnLighting(this.getParent());

        this.skinIndex = skinIndex;
    }

    protected setMeshes(meshes: Mesh[]): void {
        this.faces.length = 0;
        this.skinIndex = -1;

        for (const mesh of meshes) {
            const materials = (mesh as any).skinMaterials as Record<number, Material>;

            if (materials && Object.keys(materials).length > 0) this.faces.push({ mesh, materials });
        }
    }
}

type SkinNotifyFaceState_T = {
    mesh: Mesh;
    materials: Record<number, Material>;
};

function selectSkinNotifyIndex(timeline: ISkinNotifyEntryDecodeInfo[], time: number): number {
    let skinIndex = 0;

    for (const entry of timeline) {
        if (entry.time > time) break;
        skinIndex = entry.skinIndex;
    }

    return skinIndex;
}

function randomSkinNotifyDuration(info: IRandomSkinNotifyDecodeInfo): number {
    const duration = info.intervalMin + Math.random() * (info.intervalMax - info.intervalMin);

    if (duration <= 0) throw new Error(`Invalid skin notify interval '${info.intervalMin}-${info.intervalMax}'.`);

    return duration;
}

export default SkinNotifyComponent;
export { SkinNotifyComponent };
