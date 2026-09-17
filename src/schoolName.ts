import { stages } from './data/maps';

// 교문 현판에 적히는 학교 이름. 설정의 '우리 학교' 맵일 때만 입력칸이 보인다.

const STORAGE_KEY = 'dgd_schoolName';
export const DEFAULT_SCHOOL_NAME = '우리 학교';

let schoolName = '';
try {
  schoolName = localStorage.getItem(STORAGE_KEY) ?? '';
} catch {
  // 저장이 막힌 환경에서는 기본 이름을 쓴다
}

export function getSchoolName(): string {
  return schoolName.trim() || DEFAULT_SCHOOL_NAME;
}

export function initSchoolNameInput() {
  const row = document.querySelector<HTMLElement>('.row-school')!;
  const input = document.querySelector<HTMLInputElement>('#in_schoolName')!;
  const mapSelect = document.querySelector<HTMLSelectElement>('#sltMap')!;

  input.value = schoolName;
  input.addEventListener('input', () => {
    schoolName = input.value;
    try {
      localStorage.setItem(STORAGE_KEY, schoolName.trim());
    } catch {
      // 이번 방문 동안만 유지한다
    }
  });

  // 맵 선택지는 roulette 준비 후에 채워지므로, 바뀔 때마다 선택된 맵을 보고 판단한다
  const sync = () => {
    const stage = stages[Number(mapSelect.value)];
    row.classList.toggle('active', stage?.painter === 'school');
  };
  mapSelect.addEventListener('change', sync);
  sync();
}
