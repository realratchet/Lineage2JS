import { Color, Object3D, Sphere, Vector2, Vector3 } from "three";
import { ObjectComponent } from "../../game/components";
import type BaseActor from "../../base-actor";

type PawnLight_T = { owner: Object3D, position: Vector3, direction: Vector3, targetPosition: Vector3, cone: number, color: Color, radius: number, lifeTime: number, attenuation: Vector2 };

class NPawnLightComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "nPawnLight";
    public version = 0;
    protected readonly lights: PawnLight_T[] = [];

    public add(owner: Object3D, color: readonly number[], radius: number, lifeTime: number, position: Vector3 = null, direction: Vector3 = null, targetPosition: Vector3 = null): PawnLight_T {
        // Engine.dll 0x79583f / 0x79ed26: steady, owner-relative pawn lights.
        const light = { owner, position: position ? position.clone() : new Vector3(), direction: direction ? direction.clone() : new Vector3(), targetPosition: targetPosition ? targetPosition.clone() : null, cone: direction ? Math.cos(Math.fround(Math.PI / 2) / 2) : -1, color: new Color(color[0], color[1], color[2]), radius: (radius + 1) * 25, lifeTime, attenuation: new Vector2() };

        this.lights.unshift(light);
        this.version++;
        return light;
    }

    public remove(light: PawnLight_T): void {
        const index = this.lights.indexOf(light);

        if (index < 0) return;
        this.lights.splice(index, 1);
        this.version++;
    }

    public getLights(): readonly PawnLight_T[] { return this.lights; }
    public clear(): void { this.lights.length = 0; this.version++; }
    public onDetach(): void { this.clear(); }

    public onUpdate(_currentTime: number, deltaTime: number): void {
        if (!this.lights.length) return;

        this.version++;

        // Engine.dll FNPawnLight::Update 0x7956d0; APawn::Tick 0x866246.
        for (let i = this.lights.length - 1; i >= 0; i--) {
            const light = this.lights[i];

            light.lifeTime -= deltaTime;
            if (deltaTime === 0 || light.lifeTime <= 0.0001) this.lights.splice(i, 1);
        }
    }

    public updateLighting(sphere: Sphere): void {
        for (const light of this.lights) {
            if (light.owner) light.owner.getWorldPosition(light.position);
            if (light.targetPosition) {
                // Engine.dll GetDirection 0x795431..0x79547e: mode 3 aims at the stored target position.
                light.direction.subVectors(light.targetPosition, light.position).normalize();
                if (light.direction.lengthSq() === 0) light.direction.set(1, 0, 0);
            }

            // D3DDrv SetPawnLight RVA 0x1c9f3..0x1cac4 fits reciprocal attenuation over the lighting sphere.
            const distance = sphere.center.distanceTo(light.position);
            const near = Math.max(0, distance - sphere.radius) + 1;
            const far = Math.min(light.radius, distance + sphere.radius) - 1;
            const nearIntensity = 1 / lightFalloff(near, light.radius);
            const farIntensity = 1 / lightFalloff(far, light.radius);
            const constant = Math.max(0, nearIntensity - (farIntensity - nearIntensity) / (far - near) * near);

            light.attenuation.set(constant, (nearIntensity - constant) / near);
            if (!Number.isFinite(light.attenuation.x) || !Number.isFinite(light.attenuation.y)) throw new Error(`Invalid pawn light attenuation for '${this.getParent().name}'.`);
        }
    }
}

// D3DDrv RVA 0x18f60, without the cancelling x87 divide/multiply by distance/radius.
function lightFalloff(distance: number, radius: number): number {
    if (distance > radius) return 0;

    const alpha = distance / radius;

    return (2 * alpha * alpha * alpha - 3 * alpha * alpha + 1) * 2;
}

export default NPawnLightComponent;
export { type PawnLight_T };
