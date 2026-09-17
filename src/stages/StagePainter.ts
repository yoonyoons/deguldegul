import type { Marble } from '../marble';
import type { RenderParameters } from '../rouletteRenderer';
import type { StageZone } from '../types/StageZone.type';

/**
 * 맵 전용 그림을 그린다. 장면 좌표(맵 단위)로 그리는 단계는 카메라 변환이 걸린 상태에서 불린다.
 *   renderBackground → (맵 물체) → renderObjects → (스킬 효과, 구슬) → renderForeground
 */
export interface StagePainter {
  renderBackground(ctx: CanvasRenderingContext2D, params: RenderParameters): void;
  renderObjects(ctx: CanvasRenderingContext2D, params: RenderParameters): void;
  renderForeground(ctx: CanvasRenderingContext2D, params: RenderParameters): void;
  /**
   * 화면 좌표로 결과를 그린다. true를 돌려주면 기본 결과 표시를 그리지 않는다.
   * getMarbleImage는 커스텀 구슬 이미지(없으면 undefined)
   */
  renderResult(
    ctx: CanvasRenderingContext2D,
    params: RenderParameters,
    width: number,
    height: number,
    getMarbleImage: (marble: Marble) => CanvasImageSource | undefined
  ): boolean;
  onZoneTrigger(zone: StageZone, x: number, y: number): void;
}
