import type { StageZone } from './types/StageZone.type';

type Positioned = { id: number; x: number; y: number };

/** 같은 구역에 다시 들어와도 이 시간 안에는 효과를 주지 않는다 (구역 경계에서 떨리며 연속 발동하는 것 방지) */
const RETRIGGER_MS = 1500;

/**
 * 구슬이 구역에 '들어오는 순간'에만 효과를 준다. 구역 안에 머무는 동안은 다시 주지 않는다.
 * 게임 루프와 시뮬레이터가 같이 쓴다.
 */
export class ZoneTracker {
  private _inside = new Set<string>();
  private _lastTriggered = new Map<string, number>();
  private _time = 0;

  constructor(private readonly _zones: StageZone[] = []) {}

  update(
    deltaMs: number,
    marbles: Positioned[],
    addVelocity: (id: number, dx: number, dy: number) => void,
    onTrigger?: (zone: StageZone, marble: Positioned) => void
  ) {
    if (this._zones.length === 0) return;
    this._time += deltaMs;

    for (const marble of marbles) {
      this._zones.forEach((zone, index) => {
        const key = `${index}:${marble.id}`;
        const inside =
          marble.x >= zone.x && marble.x <= zone.x + zone.w && marble.y >= zone.y && marble.y <= zone.y + zone.h;
        if (!inside) {
          this._inside.delete(key);
          return;
        }
        if (this._inside.has(key)) return;
        this._inside.add(key);

        const last = this._lastTriggered.get(key);
        if (last !== undefined && this._time - last < RETRIGGER_MS) return;
        this._lastTriggered.set(key, this._time);

        const side = zone.randomSide && Math.random() < 0.5 ? -1 : 1;
        addVelocity(marble.id, zone.velocity.x * side, zone.velocity.y);
        onTrigger?.(zone, marble);
      });
    }
  }
}
