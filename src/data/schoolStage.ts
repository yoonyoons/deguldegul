import type { MapEntity } from '../types/MapEntity.type';
import type { StageZone } from '../types/StageZone.type';
import type { StageDef } from './maps';

// '우리 학교' 맵. 위에서 아래로: 교문 → 운동장 산책로 → 계단 → 복도·과학실/특별실 → 교실(결승).
// 물리 형태와 그림(schoolPainter)이 같은 좌표를 쓰도록 배치 값은 모두 SCHOOL에 모아둔다.

export type Pt = [number, number];

export interface StairFlight {
  x: number;
  y: number;
  /** 1이면 오른쪽으로, -1이면 왼쪽으로 내려간다 */
  dir: 1 | -1;
}

export interface BoxObject {
  x: number;
  y: number;
  /** 가로/세로 절반 길이 */
  hw: number;
  hh: number;
  rotation: number;
}

const STEP_COUNT = 10;
const STEP_W = 1.15;
const STEP_H = 0.6;
/** 디딤판이 완전히 평평하면 구슬이 멈추므로 끝쪽으로 살짝 기울인다 */
const STEP_TILT = 0.26;

/** 운동장 공(핀) 배치: 줄마다 엇갈리게 */
function ballGrid() {
  const balls: { x: number; y: number }[] = [];
  [59, 62, 65, 68, 71].forEach((y, row) => {
    const xs = row % 2 === 0 ? [5, 8, 11, 14, 17, 20] : [6.5, 9.5, 12.5, 15.5, 18.5, 21.5];
    xs.forEach((x) => {
      balls.push({ x, y });
    });
  });
  return balls;
}

const zones: Record<'cart' | 'slip' | 'cone', StageZone> = {
  // 급식 카트: 복도 첫 경사로에서 앞으로 밀어준다
  cart: { effect: 'boost', x: 8.5, y: 135.8, w: 3.5, h: 4.5, velocity: { x: 6, y: 1.6 } },
  // 미끄럼 주의: 살짝 튀어 오른다
  slip: { effect: 'slip', x: 11, y: 149.5, w: 3, h: 3.6, velocity: { x: -1.5, y: -4.5 } },
  // 꼬깔: 과학실/특별실 갈림길 앞에서 좌우 어느 쪽으로든 밀어낸다
  cone: { effect: 'cone', x: 10, y: 162, w: 6, h: 3.5, velocity: { x: 4.5, y: 0 }, randomSide: true },
};

export const SCHOOL = {
  gate: { left: 9.25, right: 16.75, top: -2.6, doorY: 6.3, doorH: 1.2, bottom: 8 },
  /** 교문 여는 연출 시간. 이 시간이 지나야 구슬이 움직인다 */
  gateOpenMs: 450,
  leftWall: [
    [9.25, -300],
    [9.25, 8],
    [3, 13],
    [3, 74],
    [11, 86],
    [11, 88],
    [6, 91],
    [6, 131],
    [3, 133],
    [3, 186],
    [11, 194],
    [11, 197],
    [10.5, 201],
    [4, 204],
    [4, 213],
    [22, 213],
  ] as Pt[],
  rightWall: [
    [16.75, -300],
    [16.75, 8],
    [23, 13],
    [23, 74],
    [15, 86],
    [15, 88],
    [20, 91],
    [20, 131],
    [23, 133],
    [23, 186],
    [15, 194],
    [15, 197],
    [22, 199],
    [22, 213],
  ] as Pt[],
  /** 구간 경계 (그림 영역 구분용) */
  sections: {
    fieldTop: 13,
    fieldBottom: 74,
    buildingTop: 86,
    stairsTop: 91,
    stairsBottom: 131,
    corridorTop: 133,
    classroomTop: 194,
  },
  /** 운동장 산책로 경사로 */
  walkways: [
    [
      [23, 17],
      [6, 22],
    ],
    [
      [3, 28],
      [20, 33],
    ],
    [
      [23, 39],
      [6, 44],
    ],
    [
      [3, 50],
      [20, 55],
    ],
  ] as Pt[][],
  /** 운동장 공(핀) */
  balls: ballGrid(),
  ballRadius: 0.35,
  flights: [
    { x: 6, y: 93, dir: 1 },
    { x: 20, y: 103, dir: -1 },
    { x: 6, y: 113, dir: 1 },
    { x: 20, y: 123, dir: -1 },
  ] as StairFlight[],
  step: { count: STEP_COUNT, w: STEP_W, h: STEP_H },
  /** 복도 경사로 */
  corridors: [
    [
      [3, 137],
      [19.5, 141.5],
    ],
    [
      [23, 149],
      [5.5, 153.5],
    ],
    [
      [3, 158],
      [11.5, 161],
    ],
  ] as Pt[][],
  cabinet: { x: 21.25, y: 145, hw: 0.45, hh: 0.9, rotation: 0.12 } as BoxObject,
  /** 과학실/특별실 사이 벽 */
  splitter: [
    [13, 167],
    [16.5, 171],
    [16.5, 184],
    [13, 187],
    [9.5, 184],
    [9.5, 171],
    [13, 167],
  ] as Pt[],
  labPegs: [
    { x: 5.2, y: 174 },
    { x: 7.6, y: 177.5 },
    { x: 5.2, y: 181 },
  ],
  specialPegs: [
    { x: 20.8, y: 174 },
    { x: 18.4, y: 177.5 },
    { x: 20.8, y: 181 },
  ],
  pegRadius: 0.45,
  door: { left: 11, right: 15, top: 194, bottom: 197 },
  finalRamp: [
    [10.5, 201],
    [17.5, 205],
  ] as Pt[],
  lectern: { x: 19.75, y: 207.2, hw: 0.8, hh: 0.45, rotation: -0.2 } as BoxObject,
  goalY: 209.5,
  zoomY: 206,
  floorY: 213,
  zones,
};

/** 계단 한 층(flight)의 윤곽선 */
export function stairPoints({ x, y, dir }: StairFlight): Pt[] {
  const points: Pt[] = [[x, y]];
  for (let i = 0; i < STEP_COUNT; i++) {
    const edgeX = x + dir * (i + 1) * STEP_W;
    points.push([edgeX, y + i * STEP_H + STEP_TILT]);
    points.push([edgeX, y + (i + 1) * STEP_H]);
  }
  return points;
}

// 그림이 입혀지므로 선은 은은하게, 네온 번짐은 끈다
const NO_BLOOM = 'rgba(0, 0, 0, 0)';
// 미니맵에서도 보이도록 밝은 배경(라이트 모드)과 어두운 배경 모두에서 대비가 나는 중간 톤
const COLORS = {
  wall: '#8a5a3b',
  walkway: '#b8864b',
  ball: '#8d8d8d',
  stairs: '#7d838a',
  corridor: '#9c7358',
  cabinet: '#5b7bd5',
  splitter: '#8e7cc3',
  peg: '#7fb3d5',
  lectern: '#8d5524',
};

function polyline(points: Pt[], color: string): MapEntity {
  return {
    type: 'static',
    position: { x: 0, y: 0 },
    props: { density: 1, angularVelocity: 0, restitution: 0 },
    shape: { type: 'polyline', rotation: 0, points, color, bloomColor: NO_BLOOM },
  };
}

function circle(x: number, y: number, radius: number, color: string, restitution: number): MapEntity {
  return {
    type: 'static',
    position: { x, y },
    props: { density: 1, angularVelocity: 0, restitution },
    shape: { type: 'circle', radius, color, bloomColor: NO_BLOOM },
  };
}

function box({ x, y, hw, hh, rotation }: BoxObject, color: string, restitution: number): MapEntity {
  return {
    type: 'static',
    position: { x, y },
    props: { density: 1, angularVelocity: 0, restitution },
    shape: { type: 'box', width: hw, height: hh, rotation, color, bloomColor: NO_BLOOM },
  };
}

export const schoolStage: StageDef = {
  title: '우리 학교',
  goalY: SCHOOL.goalY,
  zoomY: SCHOOL.zoomY,
  painter: 'school',
  startDelayMs: SCHOOL.gateOpenMs,
  startCamera: { x: 13, y: 2.2, maxZoom: 1.3 },
  zones: Object.values(zones),
  entities: [
    // 교문 위쪽 벽은 구슬 대기 줄을 가두기만 하므로 하늘에 선이 보이지 않게 한다
    polyline(SCHOOL.leftWall.slice(0, 2), NO_BLOOM),
    polyline(SCHOOL.leftWall.slice(1), COLORS.wall),
    polyline(SCHOOL.rightWall.slice(0, 2), NO_BLOOM),
    polyline(SCHOOL.rightWall.slice(1), COLORS.wall),
    ...SCHOOL.walkways.map((points) => polyline(points, COLORS.walkway)),
    ...SCHOOL.balls.map(({ x, y }) => circle(x, y, SCHOOL.ballRadius, COLORS.ball, 0.4)),
    ...SCHOOL.flights.map((flight) => polyline(stairPoints(flight), COLORS.stairs)),
    ...SCHOOL.corridors.map((points) => polyline(points, COLORS.corridor)),
    // 청소 도구함: 잘 튕긴다
    box(SCHOOL.cabinet, COLORS.cabinet, 0.85),
    polyline(SCHOOL.splitter, COLORS.splitter),
    ...[...SCHOOL.labPegs, ...SCHOOL.specialPegs].map(({ x, y }) => circle(x, y, SCHOOL.pegRadius, COLORS.peg, 0.3)),
    polyline(SCHOOL.finalRamp, COLORS.corridor),
    box(SCHOOL.lectern, COLORS.lectern, 0.5),
  ],
};
