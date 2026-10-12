import { Object3D, Vector3 } from "three";
import { EPhysics_T } from "../assets/unreal/un-aactor";
import type RenderManager from "./render-manager";

const tmpLocation = new Vector3();

export class QuestArrow {
    public canDraw: () => boolean = null;
    public getDestination: () => { x: number, y: number, z: number } = null;
    public onArrival: () => void = null;
    public createEffect: (path: string) => Object3D = null;
    protected effect: Object3D = null;

    public constructor(protected readonly render: RenderManager) {}

    public reset() {
        if (this.effect && this.effect.parent) this.render.removeTransientEffect(this.effect);
        this.effect = null;
    }

    public draw() {
        if (!this.createEffect || !this.getDestination || !this.canDraw()) return;

        const destination = this.getDestination(), player = this.render.player;
        const height = player.getCollisionHeight();

        tmpLocation.copy(player.position);
        tmpLocation.z += height;

        if (destination && tmpLocation.distanceTo(destination as Vector3) <= 128) {
            this.onArrival();
            return;
        }

        if (!destination) {
            if (!this.effect) return;

            this.reset();
            const effect = this.createEffect("LineageEffect.e_u088_b"), properties = (effect as any).scriptProperties;

            properties.set("Physics", EPhysics_T.PHYS_Trailer);
            properties.set("bRelativeTrail", true);
            properties.set("RelativeTrailOffset", [0, 0, height * 1.75]);
            effect.position.copy(player.position);
            effect.position.z += height * 1.75;
            this.render.addTransientEffect(effect, player);
            return;
        }

        if (!this.effect) {
            this.effect = this.createEffect("LineageEffect.e_u088_a");
            this.render.addTransientEffect(this.effect);
        }

        const effect = this.effect;

        effect.position.copy(tmpLocation);
        effect.position.z += height * 0.75;
        effect.rotation.set(0, 0, Math.atan2(destination.y - tmpLocation.y, destination.x - tmpLocation.x));
        effect.updateMatrixWorld(true);
        effect.visible = true;
        try {
            effect.traverseVisible(object => { if ((object as any).particlePool) (object as any).onRender(); });
            this.render.renderer.render(effect, this.render.camera);
        } finally { effect.visible = false; }
    }
}

export default QuestArrow;
