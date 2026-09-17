import type { Roulette } from './roulette';

// 경기 화면 위의 x1/x2/x3 속도 버튼. 고른 속도는 브라우저가 기억한다.
// 화면 가운데를 누르고 있는 빨리 감기는 이 속도에 곱해진다.

const STORAGE_KEY = 'dgd_speed';
const SPEEDS = [1, 2, 3];

function readSpeed(): number {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return SPEEDS.includes(saved) ? saved : 1;
  } catch {
    return 1;
  }
}

export function initSpeedControl(roulette: Roulette) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('#speedControls button[data-speed]'));

  const apply = (speed: number) => {
    roulette.setSpeed(speed);
    buttons.forEach((button) => {
      const active = Number(button.dataset.speed) === speed;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const speed = Number(button.dataset.speed);
      apply(speed);
      try {
        localStorage.setItem(STORAGE_KEY, String(speed));
      } catch {
        // 이번 방문 동안만 유지한다
      }
    });
  });

  apply(readSpeed());
}
