export interface HitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CLOSE_HIT_PADDING = 8;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function closeButtonSize(h: number): number {
  return clamp(h * 0.045, 20, 34);
}

/**
 * 원형 닫기 버튼(동그라미 + X)을 중심 좌표에 그리고 히트 영역을 돌려준다.
 * 무언가에 걸쳐놓을 때는 뒤가 비치므로 불투명한 색을 넘겨야 한다.
 */
export function drawCloseCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  fill: string = 'rgba(0, 0, 0, 0.5)'
): HitRect {
  const arm = size * 0.22;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy - arm);
  ctx.lineTo(cx + arm, cy + arm);
  ctx.moveTo(cx + arm, cy - arm);
  ctx.lineTo(cx - arm, cy + arm);
  ctx.stroke();
  ctx.restore();

  return {
    x: cx - size / 2 - CLOSE_HIT_PADDING,
    y: cy - size / 2 - CLOSE_HIT_PADDING,
    w: size + CLOSE_HIT_PADDING * 2,
    h: size + CLOSE_HIT_PADDING * 2,
  };
}
