import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Matrix4, Vector3 } from "three";
import { CLIPPING_RANGE_SCALE } from "../rendering/l2-env";
import type { IStaticMeshActorDecodeInfo } from "@l2js/engine/contracts/mesh";
import type { StaticMeshLodLevel_T } from "../assets/unreal/static-mesh/static-mesh-lod";

const tmpPivot = new Vector3();

export function expandBillboardBounds(bounds: THREE.Box3, attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, index: number) {
    const radius = Math.abs(attribute.getZ(index));
    if (!radius) return;
    const x = attribute.getX(index), y = attribute.getY(index);
    bounds.min.x = Math.min(bounds.min.x, x - radius);
    bounds.max.x = Math.max(bounds.max.x, x + radius);
    bounds.min.y = Math.min(bounds.min.y, y - radius);
    bounds.max.y = Math.max(bounds.max.y, y + radius);
}

export class StaticMeshLod {
    public mask = 1;
    protected readonly ranges: number[];
    protected readonly duration: number;
    protected readonly x: number;
    protected readonly y: number;
    protected current = -1;
    protected target = -1;
    protected started = 0;
    protected readonly fades: Int8Array;
    protected readonly levels: StaticMeshLodLevel_T[];
    protected readonly geometry: BufferGeometry;
    protected readonly vertex: number;
    protected readonly count: number;
    protected readonly groups?: BufferGeometry["groups"];

    public constructor(geometry: BufferGeometry, actor: IStaticMeshActorDecodeInfo, start: number, positions: Float32Array, matrix?: Matrix4) {
        this.geometry = geometry;
        this.vertex = start;
        this.count = positions.length / 3;
        this.levels = actor.instance.mesh.lods;
        this.ranges = this.levels.map(level => CLIPPING_RANGE_SCALE * level.range);
        this.x = actor.position[0];
        this.y = actor.position[1];
        this.duration = actor.lodViewDuration * 1000;
        this.fades = new Int8Array(this.levels.length);

        for (let i = 1; i < this.levels.length; i++) {
            if (!this.levels[i].billboard) continue;
            let attr = geometry.getAttribute("lodBillboard") as BufferAttribute;
            if (!attr) {
                attr = new BufferAttribute(new Float32Array(geometry.getAttribute("position").count * 3), 3);
                geometry.setAttribute("lodBillboard", attr);
            }
            const scale = matrix ? Math.hypot(matrix.elements[0], matrix.elements[1], matrix.elements[2]) : 1;
            const end = this.levels[i + 1]?.vertex ?? this.count;
            for (let j = this.levels[i].vertex; j < end; j++) {
                tmpPivot.set(0, positions[j * 3 + 1], positions[j * 3 + 2]);
                if (matrix) tmpPivot.applyMatrix4(matrix);
                attr.setXYZ(start + j, tmpPivot.x, tmpPivot.y, positions[j * 3] * scale);
            }
        }

        if (!matrix) {
            this.groups = geometry.groups.slice();
            this.selectGroups();
        }
    }

    protected selectGroups() {
        const geometry = this.geometry;
        geometry.clearGroups();
        for (const group of this.groups) {
            let level = this.levels.length - 1;
            while (level && group.start < this.levels[level].index) level--;
            if (this.mask & (1 << level)) geometry.groups.push(group);
        }
    }

    public get transitioning() { return this.current !== this.target; }

    protected setFade(level: number, fade: number) {
        if (this.fades[level] === fade) return;
        this.fades[level] = fade;
        let attr = this.geometry.getAttribute("lodFade") as BufferAttribute;
        if (!attr) {
            attr = new BufferAttribute(new Int8Array(this.geometry.getAttribute("position").count), 1).setUsage(DynamicDrawUsage);
            this.geometry.setAttribute("lodFade", attr);
        }
        const first = this.vertex + this.levels[level].vertex, end = this.vertex + (this.levels[level + 1]?.vertex ?? this.count);
        (attr.array as Int8Array).fill(fade, first, end);
        attr.addUpdateRange(first, end - first);
        attr.needsUpdate = true;
    }

    public update(camera: Vector3, enabled: boolean, now: number, matrix?: Matrix4): boolean {
        let mask = 1;
        if (!enabled) {
            if (this.current === -1) return false;
            this.current = this.target = -1;
            this.setFade(0, 0);
        } else {
            const x = camera.x - (matrix ? matrix.elements[12] : this.x), y = camera.y - (matrix ? matrix.elements[13] : this.y);
            const distance = Math.sqrt(x * x + y * y);
            let level = Math.max(0, this.target);
            while (level + 1 < this.ranges.length && distance >= this.ranges[level + 1]) level++;
            while (level > 0 && distance < this.ranges[level] * (this.target < 0 ? 1 : 0.99)) level--;

            // AActor::Tick, Engine.dll 0x865b43: both LOD directions advance elapsed / duration.
            if (this.transitioning && now - this.started >= this.duration) this.current = this.target;
            if (this.current < 0 || this.duration <= 0) this.current = this.target = level;
            else if (!this.transitioning && level !== this.target) {
                this.target = level;
                this.started = now;
            } else if (this.transitioning && level === this.current) {
                this.current = this.target;
                this.target = level;
                this.started = now - (this.duration - (now - this.started));
            }

            mask = 1 << this.current;
            if (this.transitioning) {
                const elapsed = (now - this.started) / this.duration;
                const high = Math.min(this.current, this.target), low = Math.max(this.current, this.target);
                const blend = Math.round(127 * (this.current === high ? elapsed : 1 - elapsed));
                mask = (blend < 127 ? 1 << high : 0) | (blend > 0 ? 1 << low : 0);
                if (blend < 127) this.setFade(high, blend);
                if (blend > 0) this.setFade(low, blend - 127);
            } else this.setFade(this.current, 0);
        }

        if (mask === this.mask) return false;
        this.mask = mask;
        if (this.groups) this.selectGroups();
        return true;
    }
}

export default StaticMeshLod;
