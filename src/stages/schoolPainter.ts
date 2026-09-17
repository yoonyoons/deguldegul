import { initialZoom, Themes, winnerAreaHeight } from '../data/constants';
import { type BoxObject, type Pt, SCHOOL, stairPoints } from '../data/schoolStage';
import type { Marble } from '../marble';
import type { RenderParameters } from '../rouletteRenderer';
import { getSchoolName } from '../schoolName';
import type { StageZone } from '../types/StageZone.type';
import type { StagePainter } from './StagePainter';

// '우리 학교' 맵 그림. 모든 좌표는 맵 단위(구슬 지름 0.5)이고 SCHOOL 배치 값을 그대로 따른다.

const FONT = `'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`;

const DAY = {
  skyTop: '#7cc8f2',
  skyBottom: '#e3f5ff',
  sun: '#fff1a8',
  grass: '#a5d97f',
  field: '#f0d9a4',
  fieldLine: 'rgba(255, 255, 255, 0.55)',
  path: '#d4a86e',
  pathLine: '#f6e3bd',
  trunk: '#8a5a3b',
  blossom: ['#ffc2d6', '#ffadc8', '#ffd6e5'],
  brick: '#c4674b',
  brickLine: '#a5523a',
  stone: '#ddd5c7',
  plaque: '#2f5a44',
  plaqueBorder: '#e2b84a',
  plaqueText: '#fff8dc',
  gateBar: '#5d6b75',
  roof: '#9b5e45',
  building: '#fbecd6',
  window: '#bfe3fb',
  windowFrame: '#b39776',
  stairWall: '#eeeae2',
  stairSlab: '#c7c4bc',
  stairNose: '#f2c230',
  handrail: '#8d6e63',
  corridorWall: '#f8f1e4',
  floor: '#d9c1a0',
  floorLine: '#c5aa84',
  locker: '#8fb7dd',
  lockerLine: '#6c97c0',
  lab: '#e3f3e1',
  special: '#eee6f8',
  roomWall: '#d9cfe8',
  door: '#b27b50',
  plate: '#2e6b4a',
  plateText: '#ffffff',
  classroom: '#fff5e3',
  board: '#2f6a4e',
  boardFrame: '#9a6b46',
  chalk: '#f5f5f0',
  desk: '#c98c58',
  deskTop: '#e2ab70',
  text: '#4a3b2a',
};

type Palette = typeof DAY;

const EVENING: Palette = {
  ...DAY,
  skyTop: '#161a3a',
  skyBottom: '#5a4a78',
  sun: '#f7f3d2',
  grass: '#46643f',
  field: '#8a7658',
  fieldLine: 'rgba(255, 255, 255, 0.25)',
  path: '#8c6d4a',
  pathLine: '#b89a70',
  blossom: ['#d98fab', '#c97a98', '#e7a9c0'],
  brick: '#8e4a38',
  brickLine: '#6f3829',
  stone: '#a79f93',
  gateBar: '#3e4850',
  roof: '#5e3a2c',
  building: '#5b5266',
  window: '#ffd66b',
  windowFrame: '#3f3848',
  stairWall: '#5d5a63',
  stairSlab: '#7d7a80',
  corridorWall: '#625a6a',
  floor: '#7a6650',
  floorLine: '#66543f',
  locker: '#56789a',
  lockerLine: '#3f5d7a',
  lab: '#4d6150',
  special: '#5b5070',
  roomWall: '#6a5f7a',
  door: '#7c5236',
  classroom: '#6e6270',
  board: '#1f4a36',
  boardFrame: '#6c4a30',
  desk: '#8c6040',
  deskTop: '#a77a50',
  text: '#fdf2d0',
};

interface View {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  size: number;
  color: number;
}

interface Spark {
  effect: StageZone['effect'];
  x: number;
  y: number;
  dir: number;
  born: number;
}

const MAX_AMBIENT_PETALS = 40;
const SPARK_MS = 700;
const MAX_DESKS = 5;

/** 결정적인 난수 (별, 나무 모양이 매 프레임 같아야 한다) */
function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function polygon(ctx: CanvasRenderingContext2D, points: Pt[]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 가운데 정렬 글자. 폭을 넘으면 글자 크기를 줄인다 */
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxWidth: number) {
  ctx.font = `bold ${size}px ${FONT}`;
  const width = ctx.measureText(text).width;
  if (width > maxWidth) {
    ctx.font = `bold ${(size * maxWidth) / width}px ${FONT}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function inView(view: View, top: number, bottom: number) {
  return bottom >= view.top - 1 && top <= view.bottom + 1;
}

export class SchoolPainter implements StagePainter {
  private _petals: Petal[] = [];
  private _sparks: Spark[] = [];
  private _lastFrame = 0;
  private _seenStart: number | null = null;

  private palette(params: RenderParameters): Palette {
    return params.theme === Themes.dark ? EVENING : DAY;
  }

  private view({ camera, size }: RenderParameters): View {
    const zoom = camera.zoom * initialZoom;
    const w = size.x / zoom;
    const h = size.y / zoom;
    return { left: camera.x - w / 2, right: camera.x + w / 2, top: camera.y - h / 2, bottom: camera.y + h / 2 };
  }

  /** 0이면 닫힘, 1이면 다 열림 */
  private gateOpening(startedAt: number | null) {
    if (startedAt === null) return 0;
    return Math.min(1, (performance.now() - startedAt) / SCHOOL.gateOpenMs);
  }

  renderBackground(ctx: CanvasRenderingContext2D, params: RenderParameters) {
    const p = this.palette(params);
    const view = this.view(params);
    const night = p === EVENING;
    ctx.save();
    this.drawOutdoor(ctx, p, view, night);
    this.drawBuilding(ctx, p, view, night);
    this.drawStairs(ctx, p, view);
    this.drawCorridor(ctx, p, view);
    this.drawRooms(ctx, p, view);
    this.drawClassroom(ctx, p, view, params);
    ctx.restore();
  }

  renderObjects(ctx: CanvasRenderingContext2D, params: RenderParameters) {
    const p = this.palette(params);
    const view = this.view(params);
    ctx.save();
    if (inView(view, 57, 73)) {
      SCHOOL.balls.forEach(({ x, y }, i) => this.drawBall(ctx, x, y, SCHOOL.ballRadius, i));
    }
    if (inView(view, 143, 147)) this.drawCabinet(ctx, SCHOOL.cabinet);
    if (inView(view, 165, 184)) {
      SCHOOL.labPegs.forEach(({ x, y }) => this.drawFlask(ctx, x, y));
      SCHOOL.specialPegs.forEach(({ x, y }) => this.drawDrum(ctx, x, y));
      this.drawCone(ctx, 13, 167.1);
    }
    if (inView(view, 206, 208.5)) this.drawLectern(ctx, p, SCHOOL.lectern);
    ctx.restore();
  }

  renderForeground(ctx: CanvasRenderingContext2D, params: RenderParameters) {
    const now = performance.now();
    const dt = this._lastFrame ? Math.min(0.05, (now - this._lastFrame) / 1000) : 0;
    this._lastFrame = now;
    const view = this.view(params);
    const p = this.palette(params);

    if (params.startedAt !== this._seenStart) {
      this._seenStart = params.startedAt;
      if (params.startedAt !== null) this.burstPetals();
    }

    ctx.save();
    if (inView(view, SCHOOL.gate.top, SCHOOL.gate.bottom)) {
      this.drawGateDoors(ctx, p, this.gateOpening(params.startedAt));
    }
    this.updatePetals(dt, view);
    this.drawPetals(ctx, p);
    this.drawSparks(ctx, now);
    ctx.restore();
  }

  onZoneTrigger(zone: StageZone, x: number, y: number) {
    this._sparks.push({ effect: zone.effect, x, y, dir: Math.sign(zone.velocity.x) || 1, born: performance.now() });
  }

  // ─── 교문과 운동장 ─────────────────────────────────────────

  private drawOutdoor(ctx: CanvasRenderingContext2D, p: Palette, view: View, night: boolean) {
    const top = SCHOOL.sections.buildingTop;
    if (view.top > top) return;

    const left = view.left - 1;
    const width = view.right - view.left + 2;
    const skyBottom = Math.min(view.bottom, top);
    const sky = ctx.createLinearGradient(0, -20, 0, top);
    sky.addColorStop(0, p.skyTop);
    sky.addColorStop(1, p.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(left, view.top - 1, width, skyBottom - view.top + 1);

    if (night) {
      ctx.fillStyle = 'rgba(255, 255, 240, 0.8)';
      for (let i = 0; i < 60; i++) {
        const x = hash(i) * 30 - 2;
        const y = hash(i + 100) * 40 - 30;
        if (y < view.top || y > view.bottom) continue;
        ctx.fillRect(x, y, 0.08, 0.08);
      }
    }
    // 해 / 달
    if (inView(view, -6, -1)) {
      ctx.fillStyle = p.sun;
      ctx.beginPath();
      ctx.arc(21.5, -3.5, 1.3, 0, Math.PI * 2);
      ctx.fill();
      if (night) {
        ctx.fillStyle = p.skyTop;
        ctx.beginPath();
        ctx.arc(22.1, -3.9, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 잔디와 운동장 흙
    ctx.fillStyle = p.grass;
    ctx.fillRect(left, SCHOOL.gate.bottom, width, top - SCHOOL.gate.bottom);
    ctx.fillStyle = p.field;
    polygon(ctx, [
      [9.25, 8],
      [3, 13],
      [3, 74],
      [11, 86],
      [15, 86],
      [23, 74],
      [23, 13],
      [16.75, 8],
    ]);
    ctx.fill();

    // 트랙 라인
    if (inView(view, 13, 74)) {
      ctx.strokeStyle = p.fieldLine;
      ctx.lineWidth = 0.12;
      ctx.setLineDash([0.6, 0.4]);
      [7, 13, 19].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, 14);
        ctx.lineTo(x, 72);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    // 산책로
    SCHOOL.walkways.forEach(([a, b]) => {
      if (!inView(view, Math.min(a[1], b[1]), Math.max(a[1], b[1]) + 1)) return;
      ctx.fillStyle = p.path;
      polygon(ctx, [a, b, [b[0], b[1] + 0.6], [a[0], a[1] + 0.6]]);
      ctx.fill();
      ctx.strokeStyle = p.pathLine;
      ctx.lineWidth = 0.08;
      ctx.setLineDash([0.4, 0.3]);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1] + 0.3);
      ctx.lineTo(b[0], b[1] + 0.3);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // 벚꽃나무
    const trees: Pt[] = [
      [5.2, 4.2],
      [20.8, 4.2],
      [1.2, 20],
      [24.8, 27],
      [1.2, 40],
      [24.8, 50],
      [1.2, 62],
      [24.8, 72],
    ];
    trees.forEach(([x, y], i) => {
      if (inView(view, y - 3, y + 4)) this.drawTree(ctx, p, x, y, i);
    });

    if (inView(view, 13, 16)) this.drawSignBoard(ctx, p, 5.6, 14.6, '운동장');
    if (inView(view, SCHOOL.gate.top - 1, SCHOOL.gate.bottom + 1)) this.drawGate(ctx, p);
  }

  private drawTree(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, seed: number) {
    ctx.fillStyle = p.trunk;
    ctx.fillRect(x - 0.22, y, 0.44, 3.6);
    for (let i = 0; i < 7; i++) {
      const angle = hash(seed * 10 + i) * Math.PI * 2;
      const dist = hash(seed * 10 + i + 50) * 1.1;
      ctx.fillStyle = p.blossom[i % p.blossom.length];
      ctx.beginPath();
      ctx.arc(
        x + Math.cos(angle) * dist,
        y - 0.3 + Math.sin(angle) * dist * 0.8,
        0.9 + hash(i + seed) * 0.4,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  private drawSignBoard(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, text: string) {
    ctx.fillStyle = p.trunk;
    ctx.fillRect(x - 1.1, y, 0.15, 1.1);
    ctx.fillRect(x + 0.95, y, 0.15, 1.1);
    ctx.fillStyle = p.plate;
    roundRect(ctx, x - 1.4, y - 0.55, 2.8, 1.0, 0.15);
    ctx.fill();
    ctx.fillStyle = p.plateText;
    label(ctx, text, x, y - 0.05, 0.55, 2.5);
  }

  private drawGate(ctx: CanvasRenderingContext2D, p: Palette) {
    const { left, right, bottom } = SCHOOL.gate;
    // 기둥
    [left - 1.2, right].forEach((x) => {
      ctx.fillStyle = p.brick;
      ctx.fillRect(x, -1.2, 1.2, bottom + 1.2);
      ctx.strokeStyle = p.brickLine;
      ctx.lineWidth = 0.05;
      for (let y = -0.6; y < bottom; y += 0.6) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1.2, y);
        ctx.stroke();
      }
      ctx.fillStyle = p.stone;
      ctx.fillRect(x - 0.15, -1.6, 1.5, 0.45);
    });
    // 현판
    ctx.fillStyle = p.plaqueBorder;
    roundRect(ctx, left + 0.25, -3.05, right - left - 0.5, 1.6, 0.2);
    ctx.fill();
    ctx.fillStyle = p.plaque;
    roundRect(ctx, left + 0.4, -2.9, right - left - 0.8, 1.3, 0.15);
    ctx.fill();
    ctx.fillStyle = p.plaqueText;
    label(ctx, getSchoolName(), (left + right) / 2, -2.25, 0.85, right - left - 1.4);
    // 바닥 보도
    ctx.fillStyle = p.stone;
    ctx.fillRect(left - 3, bottom - 0.1, right - left + 6, 0.35);
  }

  /** 교문 철문. 열리면 양쪽 기둥 쪽으로 밀려 들어간다 */
  private drawGateDoors(ctx: CanvasRenderingContext2D, p: Palette, opening: number) {
    const { left, right, doorY, doorH } = SCHOOL.gate;
    const half = (right - left) / 2;
    const leafWidth = half * (1 - opening);
    if (leafWidth <= 0.01) return;
    ctx.strokeStyle = p.gateBar;
    ctx.fillStyle = p.gateBar;
    [
      [left, 1],
      [right, -1],
    ].forEach(([edge, dir]) => {
      const x0 = edge;
      const x1 = edge + dir * leafWidth;
      ctx.fillRect(Math.min(x0, x1), doorY, leafWidth, 0.14);
      ctx.fillRect(Math.min(x0, x1), doorY + doorH - 0.14, leafWidth, 0.14);
      ctx.lineWidth = 0.1;
      const bars = Math.max(1, Math.round(leafWidth / 0.45));
      for (let i = 0; i <= bars; i++) {
        const x = x0 + ((x1 - x0) * i) / bars;
        ctx.beginPath();
        ctx.moveTo(x, doorY - 0.25);
        ctx.lineTo(x, doorY + doorH);
        ctx.stroke();
      }
    });
  }

  private drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, i: number) {
    const kind = i % 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = kind === 0 ? '#ffffff' : kind === 1 ? '#f08a24' : '#ffe066';
    ctx.fill();
    ctx.lineWidth = 0.04;
    ctx.strokeStyle = kind === 0 ? '#222' : kind === 1 ? '#6b3410' : '#2f6fb3';
    if (kind === 0) {
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 1) {
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-r * 0.4, 0, r * 0.8, -1, 1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ─── 건물 ─────────────────────────────────────────────

  private drawBuilding(ctx: CanvasRenderingContext2D, p: Palette, view: View, night: boolean) {
    const { buildingTop } = SCHOOL.sections;
    if (view.bottom < buildingTop - 3) return;
    const left = view.left - 1;
    const width = view.right - view.left + 2;
    const top = Math.max(view.top - 1, buildingTop - 2);

    ctx.fillStyle = p.building;
    ctx.fillRect(left, top, width, view.bottom + 1 - top);
    if (inView(view, buildingTop - 2, buildingTop)) {
      ctx.fillStyle = p.roof;
      ctx.fillRect(left, buildingTop - 2, width, 0.7);
    }

    // 바깥 창문
    const firstRow = Math.max(0, Math.floor((view.top - buildingTop) / 7));
    for (let row = firstRow; buildingTop + 1 + row * 7 < Math.min(view.bottom, SCHOOL.floorY); row++) {
      const y = buildingTop + 1 + row * 7;
      [-3, 0.4, 23.6, 27].forEach((x) => {
        ctx.fillStyle = p.windowFrame;
        ctx.fillRect(x - 0.1, y - 0.1, 2.2, 3.2);
        ctx.fillStyle = p.window;
        if (night) {
          ctx.shadowColor = p.window;
          ctx.shadowBlur = 8;
        }
        ctx.fillRect(x, y, 2, 3);
        ctx.shadowBlur = 0;
        ctx.fillStyle = p.windowFrame;
        ctx.fillRect(x + 0.95, y, 0.1, 3);
      });
    }

    // 현관
    if (inView(view, 86, 91)) {
      ctx.fillStyle = p.floor;
      polygon(ctx, [
        [11, 86],
        [15, 86],
        [15, 88],
        [20, 91],
        [6, 91],
        [11, 88],
      ]);
      ctx.fill();
    }
  }

  private drawStairs(ctx: CanvasRenderingContext2D, p: Palette, view: View) {
    const { stairsTop, stairsBottom } = SCHOOL.sections;
    if (!inView(view, stairsTop, stairsBottom)) return;
    ctx.fillStyle = p.stairWall;
    ctx.fillRect(6, stairsTop, 14, stairsBottom - stairsTop);

    const { count, w, h } = SCHOOL.step;
    SCHOOL.flights.forEach((flight) => {
      if (!inView(view, flight.y - 2, flight.y + count * h + 1)) return;
      const points = stairPoints(flight);
      const end = points[points.length - 1];
      // 계단 판
      ctx.fillStyle = p.stairSlab;
      polygon(ctx, [...points, [end[0], end[1] + 0.5], [flight.x, flight.y + 1.2]]);
      ctx.fill();
      // 미끄럼 방지 띠
      ctx.strokeStyle = p.stairNose;
      ctx.lineWidth = 0.1;
      for (let i = 0; i < count; i++) {
        const edgeX = flight.x + flight.dir * (i + 1) * w;
        const y = flight.y + i * h + 0.3;
        ctx.beginPath();
        ctx.moveTo(edgeX - flight.dir * 0.35, y - 0.04);
        ctx.lineTo(edgeX, y + 0.02);
        ctx.stroke();
      }
      // 난간
      ctx.strokeStyle = p.handrail;
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.moveTo(flight.x + flight.dir * 0.4, flight.y - 1.3);
      ctx.lineTo(end[0], end[1] - 1.3);
      ctx.stroke();
      ctx.lineWidth = 0.06;
      for (let i = 1; i < count; i += 3) {
        const x = flight.x + flight.dir * (i + 0.5) * w;
        const y = flight.y + i * h;
        ctx.beginPath();
        ctx.moveTo(x, y - 1.3 + 0.1);
        ctx.lineTo(x, y + 0.1);
        ctx.stroke();
      }
    });

    if (inView(view, 91, 93)) this.drawPlate(ctx, p, 17.6, 92.3, '계단 3층');
    if (inView(view, 110, 112)) this.drawPlate(ctx, p, 7.4, 111, '2층');
    if (inView(view, 129, 131)) this.drawPlate(ctx, p, 17.4, 129.8, '1층 복도');
  }

  private drawPlate(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, text: string) {
    ctx.fillStyle = p.plate;
    roundRect(ctx, x - 1.6, y - 0.42, 3.2, 0.84, 0.12);
    ctx.fill();
    ctx.fillStyle = p.plateText;
    label(ctx, text, x, y, 0.5, 2.9);
  }

  private drawCorridor(ctx: CanvasRenderingContext2D, p: Palette, view: View) {
    const { corridorTop } = SCHOOL.sections;
    if (!inView(view, corridorTop - 2, 194)) return;
    ctx.fillStyle = p.corridorWall;
    polygon(ctx, [
      [6, 131],
      [20, 131],
      [23, 133],
      [23, 186],
      [15, 194],
      [11, 194],
      [3, 186],
      [3, 133],
    ]);
    ctx.fill();

    // 사물함
    const lockers = (x0: number, x1: number, top: number) => {
      if (!inView(view, top, top + 3.4)) return;
      for (let x = x0; x + 1.15 <= x1; x += 1.2) {
        ctx.fillStyle = p.locker;
        ctx.fillRect(x, top, 1.15, 3.4);
        ctx.strokeStyle = p.lockerLine;
        ctx.lineWidth = 0.05;
        ctx.strokeRect(x, top, 1.15, 3.4);
        for (let v = 0; v < 3; v++) {
          ctx.beginPath();
          ctx.moveTo(x + 0.3, top + 0.35 + v * 0.18);
          ctx.lineTo(x + 0.85, top + 0.35 + v * 0.18);
          ctx.stroke();
        }
        ctx.fillStyle = p.lockerLine;
        ctx.fillRect(x + 0.85, top + 1.7, 0.12, 0.35);
      }
    };
    lockers(12.4, 22.8, 134.2);
    lockers(3.4, 13.5, 143.6);

    // 복도 바닥
    SCHOOL.corridors.forEach(([a, b]) => {
      if (!inView(view, Math.min(a[1], b[1]), Math.max(a[1], b[1]) + 1)) return;
      ctx.fillStyle = p.floor;
      polygon(ctx, [a, b, [b[0], b[1] + 0.7], [a[0], a[1] + 0.7]]);
      ctx.fill();
      ctx.strokeStyle = p.floorLine;
      ctx.lineWidth = 0.05;
      const steps = Math.floor(Math.abs(b[0] - a[0]) / 1.2);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 0.7);
        ctx.stroke();
      }
    });

    if (inView(view, 133, 135)) this.drawPlate(ctx, p, 20.6, 134, '복도');

    // 급식 카트
    const cart = SCHOOL.zones.cart;
    if (inView(view, cart.y - 1, cart.y + cart.h)) this.drawCart(ctx);

    // 미끄럼 주의
    const slip = SCHOOL.zones.slip;
    if (inView(view, slip.y - 1, slip.y + slip.h)) this.drawSlipSign(ctx);

    // 꼬깔 구역 화살표
    const cone = SCHOOL.zones.cone;
    if (inView(view, cone.y, cone.y + cone.h)) {
      ctx.fillStyle = 'rgba(255, 140, 0, 0.75)';
      [
        [cone.x - 0.2, -1],
        [cone.x + cone.w + 0.2, 1],
      ].forEach(([x, dir]) => {
        const y = cone.y + cone.h / 2;
        ctx.beginPath();
        ctx.moveTo(x + dir * 0.6, y);
        ctx.lineTo(x, y - 0.45);
        ctx.lineTo(x, y + 0.45);
        ctx.closePath();
        ctx.fill();
      });
    }
  }

  /** 복도 첫 경사로 위에 비스듬히 선 급식 카트 */
  private drawCart(ctx: CanvasRenderingContext2D) {
    const [[ax, ay], [bx, by]] = SCHOOL.corridors[0];
    const angle = Math.atan2(by - ay, bx - ax);
    const cx = 10.25;
    const cy = ay + ((cx - ax) * (by - ay)) / (bx - ax);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // 몸체
    ctx.fillStyle = '#cfd8dc';
    roundRect(ctx, -1.7, -1.75, 3.4, 1.25, 0.15);
    ctx.fill();
    ctx.strokeStyle = '#78909c';
    ctx.lineWidth = 0.07;
    ctx.stroke();
    // 음식 칸
    ['#ffffff', '#e57373', '#ffb74d', '#81c784'].forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(-1.5 + i * 0.78, -2.05, 0.65, 0.3);
    });
    // 손잡이와 바퀴
    ctx.beginPath();
    ctx.moveTo(-1.7, -1.5);
    ctx.lineTo(-2.2, -2.2);
    ctx.stroke();
    ctx.fillStyle = '#37474f';
    [-1.2, 1.2].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, -0.3, 0.22, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#455a64';
    label(ctx, '급식', 0, -1.12, 0.5, 2.5);
    // 가속 화살표
    ctx.fillStyle = 'rgba(255, 196, 0, 0.9)';
    [2.2, 2.8].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, -1.1);
      ctx.lineTo(x + 0.45, -0.75);
      ctx.lineTo(x, -0.4);
      ctx.lineTo(x + 0.18, -0.75);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  private drawSlipSign(ctx: CanvasRenderingContext2D) {
    const [[ax, ay], [bx, by]] = SCHOOL.corridors[1];
    const floorAt = (x: number) => ay + ((x - ax) * (by - ay)) / (bx - ax);
    // 물웅덩이
    ctx.fillStyle = 'rgba(120, 190, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(12.5, floorAt(12.5) + 0.05, 1.5, 0.22, Math.atan2(by - ay, bx - ax), 0, Math.PI * 2);
    ctx.fill();
    // A자 표지판
    const x = 14.6;
    const base = floorAt(x);
    ctx.fillStyle = '#ffd400';
    polygon(ctx, [
      [x - 0.55, base - 2.3],
      [x + 0.55, base - 2.3],
      [x + 0.8, base],
      [x - 0.8, base],
    ]);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.05;
    ctx.stroke();
    ctx.fillStyle = '#222';
    label(ctx, '미끄럼', x, base - 1.65, 0.36, 1.2);
    label(ctx, '주의', x, base - 1.2, 0.36, 1.2);
    ctx.beginPath();
    ctx.arc(x, base - 0.6, 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCabinet(ctx: CanvasRenderingContext2D, box: BoxObject) {
    ctx.save();
    ctx.translate(box.x, box.y);
    ctx.rotate(box.rotation);
    // 대걸레 자루
    ctx.strokeStyle = '#a1887f';
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.moveTo(-0.15, -box.hh);
    ctx.lineTo(-0.35, -box.hh - 0.6);
    ctx.stroke();
    ctx.fillStyle = '#5b7bd5';
    ctx.fillRect(-box.hw, -box.hh, box.hw * 2, box.hh * 2);
    ctx.strokeStyle = '#3c5aa8';
    ctx.lineWidth = 0.05;
    ctx.strokeRect(-box.hw, -box.hh, box.hw * 2, box.hh * 2);
    for (let v = 0; v < 3; v++) {
      ctx.beginPath();
      ctx.moveTo(-box.hw + 0.15, -box.hh + 0.25 + v * 0.14);
      ctx.lineTo(box.hw - 0.15, -box.hh + 0.25 + v * 0.14);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    label(ctx, '청소', 0, 0.25, 0.3, box.hw * 1.8);
    ctx.restore();
  }

  // ─── 과학실 / 특별실 ─────────────────────────────────────

  private drawRooms(ctx: CanvasRenderingContext2D, p: Palette, view: View) {
    if (!inView(view, 165, 187)) return;
    ctx.fillStyle = p.lab;
    ctx.fillRect(3, 167, 6.5, 19);
    ctx.fillStyle = p.special;
    ctx.fillRect(16.5, 167, 6.5, 19);
    ctx.fillStyle = p.roomWall;
    polygon(ctx, SCHOOL.splitter);
    ctx.fill();
    // 벽에 그린 문
    ctx.fillStyle = p.door;
    ctx.fillRect(11.7, 176, 2.6, 5.5);
    ctx.fillStyle = p.window;
    ctx.fillRect(12.1, 176.5, 1.8, 1.4);
    this.drawPlate(ctx, p, 6.25, 168.4, '과학실');
    this.drawPlate(ctx, p, 19.75, 168.4, '특별실');
  }

  private drawFlask(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(230, 245, 255, 0.95)';
    ctx.fillRect(-0.13, -0.8, 0.26, 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, SCHOOL.pegRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4dd0a8';
    ctx.beginPath();
    ctx.arc(0, 0, SCHOOL.pegRadius - 0.06, 0.15, Math.PI - 0.15);
    ctx.fill();
    ctx.strokeStyle = '#5a7d9a';
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.arc(0, 0, SCHOOL.pegRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawDrum(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#ef6c8f';
    ctx.beginPath();
    ctx.arc(0, 0, SCHOOL.pegRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-0.08, 0.12, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(0, -0.25, 0.05, 0.37);
    ctx.restore();
  }

  private drawCone(ctx: CanvasRenderingContext2D, x: number, apexY: number) {
    ctx.save();
    ctx.translate(x, apexY);
    ctx.fillStyle = '#ff7a1a';
    polygon(ctx, [
      [0, -1.6],
      [0.75, 0],
      [-0.75, 0],
    ]);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    polygon(ctx, [
      [-0.28, -0.95],
      [0.28, -0.95],
      [0.4, -0.62],
      [-0.4, -0.62],
    ]);
    ctx.fill();
    ctx.restore();
  }

  // ─── 교실 ─────────────────────────────────────────────

  private drawClassroom(ctx: CanvasRenderingContext2D, p: Palette, view: View, params: RenderParameters) {
    const { door, goalY, floorY } = SCHOOL;
    if (!inView(view, door.top - 1, floorY)) return;

    ctx.fillStyle = p.classroom;
    polygon(ctx, [
      [11, 197],
      [10.5, 201],
      [4, 204],
      [4, floorY],
      [22, floorY],
      [22, 199],
      [15, 197],
    ]);
    ctx.fill();

    // 교실 문
    ctx.fillStyle = p.door;
    ctx.fillRect(door.left - 0.6, door.top - 0.6, 0.6, door.bottom - door.top + 0.6);
    ctx.fillRect(door.right, door.top - 0.6, 0.6, door.bottom - door.top + 0.6);
    ctx.fillRect(door.left - 0.6, door.top - 0.6, door.right - door.left + 1.2, 0.35);
    this.drawPlate(ctx, p, 17.6, 195.4, '교실');

    // 칠판
    ctx.fillStyle = p.boardFrame;
    ctx.fillRect(14.1, 199.2, 7.7, 3.4);
    ctx.fillStyle = p.board;
    ctx.fillRect(14.35, 199.45, 7.2, 2.9);
    ctx.fillStyle = p.chalk;
    label(ctx, '오늘의 1등은?', 17.95, 200.9, 0.62, 6.4);
    ctx.fillStyle = p.boardFrame;
    ctx.fillRect(14.1, 202.55, 7.7, 0.18);

    // 교실 바닥 경사로
    const [a, b] = SCHOOL.finalRamp;
    ctx.fillStyle = p.floor;
    polygon(ctx, [a, b, [b[0], b[1] + 0.6], [a[0], a[1] + 0.6]]);
    ctx.fill();

    // 시계
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(6.8, 206.3, 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.08;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6.8, 206.3);
    ctx.lineTo(6.8, 205.85);
    ctx.moveTo(6.8, 206.3);
    ctx.lineTo(7.15, 206.3);
    ctx.stroke();

    // 결승선
    const cell = 0.3;
    for (let i = 0; 4 + i * cell < 22; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#222222' : '#ffffff';
      ctx.fillRect(4 + i * cell, goalY - cell / 2, cell, cell / 2);
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#222222';
      ctx.fillRect(4 + i * cell, goalY, cell, cell / 2);
    }
    ctx.fillStyle = p.text;
    ctx.textAlign = 'left';
    ctx.font = `bold 0.45px ${FONT}`;
    ctx.fillText('결승', 4.3, goalY - 0.45);

    // 학생 책상. 맨 오른쪽(결승에 가장 가까운)부터 1등 자리
    const result = params.result;
    for (let i = 0; i < MAX_DESKS; i++) {
      const x = 19.4 - i * 3.1;
      const winner = result?.[i];
      this.drawDesk(ctx, p, x, 211.2, 2.4, winner, i === 0 ? '1등 자리' : undefined);
    }
    ctx.fillStyle = p.floor;
    ctx.fillRect(4, floorY - 0.5, 18, 0.5);
  }

  private drawDesk(
    ctx: CanvasRenderingContext2D,
    p: Palette,
    x: number,
    y: number,
    width: number,
    winner: Marble | undefined,
    title?: string
  ) {
    ctx.save();
    if (winner) {
      ctx.shadowColor = '#ffd54f';
      ctx.shadowBlur = 25;
    }
    ctx.fillStyle = winner ? '#ffe08a' : p.deskTop;
    ctx.fillRect(x - width / 2, y, width, 0.35);
    ctx.shadowBlur = 0;
    ctx.fillStyle = p.desk;
    ctx.fillRect(x - width / 2 + 0.2, y + 0.35, 0.18, 1.3);
    ctx.fillRect(x + width / 2 - 0.38, y + 0.35, 0.18, 1.3);
    ctx.fillRect(x - width / 2 + 0.2, y + 0.35, width - 0.4, 0.5);
    ctx.fillStyle = p.text;
    if (title && !winner) label(ctx, title, x, y - 0.3, 0.38, width);
    if (winner) label(ctx, winner.name, x, y - 0.35, 0.55, width + 0.4);
    ctx.restore();
  }

  private drawLectern(ctx: CanvasRenderingContext2D, p: Palette, box: BoxObject) {
    ctx.save();
    ctx.translate(box.x, box.y);
    ctx.rotate(box.rotation);
    ctx.fillStyle = p.desk;
    ctx.fillRect(-box.hw, -box.hh, box.hw * 2, box.hh * 2);
    ctx.fillStyle = p.deskTop;
    ctx.fillRect(-box.hw - 0.1, -box.hh - 0.12, box.hw * 2 + 0.2, 0.2);
    ctx.fillStyle = p.plateText;
    label(ctx, '교탁', 0, 0.05, 0.32, box.hw * 1.8);
    ctx.restore();
  }

  // ─── 벚꽃잎과 효과 ─────────────────────────────────────

  private burstPetals() {
    const { left, right, doorY } = SCHOOL.gate;
    for (let i = 0; i < 70; i++) {
      this._petals.push({
        x: left + Math.random() * (right - left),
        y: doorY - Math.random() * 2,
        vx: (Math.random() - 0.5) * 8,
        vy: -2 - Math.random() * 4,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 6,
        size: 0.14 + Math.random() * 0.12,
        color: Math.floor(Math.random() * 3),
      });
    }
  }

  private updatePetals(dt: number, view: View) {
    const outdoorBottom = SCHOOL.sections.buildingTop;
    if (view.top < outdoorBottom) {
      let ambient = this._petals.length;
      while (ambient < MAX_AMBIENT_PETALS) {
        this._petals.push({
          x: view.left + Math.random() * (view.right - view.left + 4) - 2,
          y: view.top - Math.random() * (view.bottom - view.top),
          vx: 0.3 + Math.random() * 0.6,
          vy: 0.6 + Math.random() * 0.8,
          angle: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 3,
          size: 0.12 + Math.random() * 0.1,
          color: Math.floor(Math.random() * 3),
        });
        ambient++;
      }
    }
    for (const petal of this._petals) {
      // 공기 저항: 바람(오른쪽 약간)과 느린 낙하 속도로 수렴한다
      petal.vx += (0.5 - petal.vx) * 1.5 * dt;
      petal.vy += (1 - petal.vy) * 1.2 * dt;
      petal.x += petal.vx * dt + Math.sin(petal.y * 1.7) * 0.01;
      petal.y += petal.vy * dt;
      petal.angle += petal.spin * dt;
    }
    this._petals = this._petals.filter(
      (petal) =>
        petal.y < Math.min(view.bottom + 1, outdoorBottom) &&
        petal.y > view.top - (view.bottom - view.top) - 2 &&
        petal.x > view.left - 3 &&
        petal.x < view.right + 3
    );
  }

  private drawPetals(ctx: CanvasRenderingContext2D, p: Palette) {
    for (const petal of this._petals) {
      ctx.save();
      ctx.translate(petal.x, petal.y);
      ctx.rotate(petal.angle);
      ctx.fillStyle = p.blossom[petal.color];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(0, 0, petal.size, petal.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawSparks(ctx: CanvasRenderingContext2D, now: number) {
    this._sparks = this._sparks.filter((spark) => now - spark.born < SPARK_MS);
    for (const spark of this._sparks) {
      const t = (now - spark.born) / SPARK_MS;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.translate(spark.x, spark.y);
      if (spark.effect === 'boost') {
        ctx.strokeStyle = '#ffc400';
        ctx.lineWidth = 0.08;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(-spark.dir * (0.4 + t * 0.6), i * 0.18);
          ctx.lineTo(-spark.dir * (1.2 + t * 1.2), i * 0.18);
          ctx.stroke();
        }
      } else if (spark.effect === 'slip') {
        ctx.fillStyle = '#64b5f6';
        for (let i = 0; i < 4; i++) {
          const angle = Math.PI + (i / 3) * Math.PI;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * (0.3 + t), 0.2 + Math.sin(angle) * (0.3 + t) * 0.6, 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#ff7a1a';
        label(ctx, '!', 0, -0.6 - t * 0.5, 0.7, 1);
      }
      ctx.restore();
    }
  }

  // ─── 결과: 1등 자리 ─────────────────────────────────────

  renderResult(
    ctx: CanvasRenderingContext2D,
    params: RenderParameters,
    width: number,
    height: number,
    getMarbleImage: (marble: Marble) => CanvasImageSource | undefined
  ): boolean {
    const result = params.result;
    if (!result || result.length > MAX_DESKS) return false;

    const panelX = width / 2;
    const panelY = height - winnerAreaHeight;
    const panelW = width / 2;
    const panelH = winnerAreaHeight;

    ctx.save();
    ctx.fillStyle = DAY.boardFrame;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.fillStyle = DAY.board;
    ctx.fillRect(panelX + 8, panelY + 8, panelW - 16, panelH - 16);

    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 250);
    const count = result.length;
    const slotW = (panelW - 16) / count;
    const title = count === 1 ? '1등 자리' : `당첨 자리 ${count}명`;
    ctx.fillStyle = DAY.chalk;
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, panelX + 20, panelY + 16);

    result.forEach((marble, i) => {
      const cx = panelX + 8 + slotW * (i + 0.5);
      const deskW = Math.min(slotW - 12, 220);
      const deskY = panelY + panelH - 58;
      // 책상 (빛남)
      ctx.save();
      ctx.shadowColor = `rgba(255, 213, 79, ${pulse})`;
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(cx - deskW / 2, deskY, deskW, 12);
      ctx.restore();
      ctx.fillStyle = DAY.desk;
      ctx.fillRect(cx - deskW / 2 + 8, deskY + 12, 8, 28);
      ctx.fillRect(cx + deskW / 2 - 16, deskY + 12, 8, 28);
      ctx.fillRect(cx - deskW / 2 + 8, deskY + 12, deskW - 16, 14);

      // 구슬
      const r = Math.min(20, slotW / 5);
      const image = getMarbleImage(marble);
      const marbleY = deskY - r - 2;
      if (image) {
        ctx.drawImage(image, cx - deskW / 2 + 6, marbleY - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = `hsl(${marble.hue} 100% ${params.theme.marbleLightness}%)`;
        ctx.beginPath();
        ctx.arc(cx - deskW / 2 + 6 + r, marbleY, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 이름
      const nameX = cx - deskW / 2 + 12 + r * 2;
      const maxNameW = deskW - (12 + r * 2);
      let size = count === 1 ? 48 : count <= 3 ? 30 : 22;
      ctx.font = `bold ${size}px ${FONT}`;
      const measured = ctx.measureText(marble.name).width;
      if (measured > maxNameW) {
        size = Math.max(10, (size * maxNameW) / measured);
        ctx.font = `bold ${size}px ${FONT}`;
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#1b3a2b';
      ctx.strokeText(marble.name, nameX, deskY - 6);
      ctx.fillStyle = `hsl(${marble.hue} 100% 75%)`;
      ctx.fillText(marble.name, nameX, deskY - 6);

      if (count > 1) {
        ctx.fillStyle = DAY.chalk;
        ctx.font = `bold 14px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(`#${params.winnerRange.start + i + 1}`, cx, deskY + 44);
      }
    });
    ctx.restore();
    return true;
  }
}
