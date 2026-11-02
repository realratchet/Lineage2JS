import { BufferGeometry, Float32BufferAttribute, Mesh } from "three";
import CollidingMesh, { type CollidingMeshProps_T } from "./colliding-mesh";
import type LitActorMesh from "./lit-actor";
import type { IStaticMeshActorDecodeInfo } from "@l2js/engine/contracts/mesh";
import type { SectorObject } from "./zone-object";
import type { L2Environment } from "../rendering/l2-env";

export class AgitStaticMeshActor extends CollidingMesh {
    declare public readonly isAgitStaticMeshActor: boolean;
    public readonly agit: IStaticMeshActorDecodeInfo["agit"];
    protected readonly baseMesh: Mesh;
    public readonly emptyGeometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute([], 3));
    protected readonly arrAccessories: LitActorMesh[];
    protected currAccessoryType = 0;

    public constructor(props: CollidingMeshProps_T, agit: IStaticMeshActorDecodeInfo["agit"], accessories: LitActorMesh[]) {
        super(props);

        (this as any).isAgitStaticMeshActor = true;

        this.agit = agit;
        this.arrAccessories = accessories;
        this.baseMesh = new Mesh(this.geometry, this.material);
        this.baseMesh.visible = false;
        this.add(this.baseMesh);

        for (const accessory of accessories) {
            accessory.visible = false;
            this.add(accessory);
        }
    }

    public setAgitStatus(status: number | null) {
        let selected = 0;

        for (let i = 0; i < this.agit.accessories.length; i++)
            if (this.agit.accessories[i].depth === status) selected = i + 1;

        if (selected === this.currAccessoryType) return;

        this.currAccessoryType = selected;
        this.geometry = selected ? this.emptyGeometry : this.baseMesh.geometry;

        for (let i = 0; i < this.arrAccessories.length; i++)
            this.arrAccessories[i].visible = selected === i + 1;
    }

    public needsInitialLighting(): boolean { return this.currAccessoryType === 0 && super.needsInitialLighting(); }

    public update(sector: SectorObject, env: L2Environment, renderer?: THREE.WebGLRenderer) {
        if (this.currAccessoryType === 0) super.update(sector, env, renderer);
    }
}

export default AgitStaticMeshActor;
