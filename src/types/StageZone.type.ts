/** 구슬이 들어오면 속도를 한 번 바꿔주는 구역. 좌표는 맵 단위이고 (x, y)는 왼쪽 위 */
export interface StageZone {
  /** 연출 종류. 물리 효과는 velocity로만 정해진다 */
  effect: 'boost' | 'slip' | 'cone';
  x: number;
  y: number;
  w: number;
  h: number;
  /** 들어온 순간 더해줄 속도(질량과 무관하게 모든 구슬에 같은 속도 변화) */
  velocity: { x: number; y: number };
  /** true면 x 방향을 매번 무작위로 뒤집는다 */
  randomSide?: boolean;
}
