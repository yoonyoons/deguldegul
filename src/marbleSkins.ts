import type { Roulette } from './roulette';
import { parseName } from './utils/utils';

// 구슬 꾸미기: 이름별로 이미지를 등록해 두고, '커스텀 구슬'이 켜져 있으면 그 이름의 구슬에 입힌다.
// 이미지는 이 브라우저의 IndexedDB에만 저장한다. 서버로 보내지 않는다.

const DB_NAME = 'deguldegul';
const DB_VERSION = 1;
const STORE_NAME = 'marbleSkins';
const ENABLED_KEY = 'dgd_customMarbles';
/** 저장 공간을 아끼려고 올린 이미지를 이 크기의 정사각형으로 줄여서 저장한다 */
const SKIN_SIZE = 256;

type SkinRecord = { name: string; blob: Blob; updatedAt: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'name' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function request<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeEnabled(value: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, value ? '1' : '0');
  } catch {
    // 저장이 막힌 환경에서는 이번 방문 동안만 유지한다
  }
}

function canvasOf(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') as CanvasRenderingContext2D };
}

/** 가운데를 기준으로 정사각형으로 잘라 SKIN_SIZE로 줄인 PNG */
async function toSquareBlob(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const { canvas, ctx } = canvasOf(SKIN_SIZE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SKIN_SIZE, SKIN_SIZE);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('이미지 변환 실패'))), 'image/png');
  });
}

/** 구슬에 그릴 원형 이미지. 원형으로 미리 잘라두어 매 프레임 clip하지 않는다 */
async function toCircleSkin(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const { canvas, ctx } = canvasOf(SKIN_SIZE);
  ctx.beginPath();
  ctx.arc(SKIN_SIZE / 2, SKIN_SIZE / 2, SKIN_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(bitmap, 0, 0, SKIN_SIZE, SKIN_SIZE);
  bitmap.close();
  return canvas;
}

function toast(message: string) {
  const el = document.createElement('div');
  el.classList.add('toast');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/** 이름 입력창의 현재 명단. `이름*3`, `이름/2` 문법은 떼고 중복은 합친다 */
function currentNames(): string[] {
  const input = document.querySelector<HTMLTextAreaElement>('#in_names');
  const names = (input?.value ?? '')
    .split(/[,\r\n]/g)
    .map((v) => parseName(v.trim())?.name.trim())
    .filter((v): v is string => !!v);
  return [...new Set(names)];
}

export function initMarbleSkins(roulette: Roulette) {
  const dialog = document.querySelector<HTMLElement>('#marbleSkins')!;
  const list = document.querySelector<HTMLUListElement>('#skinList')!;
  const addForm = document.querySelector<HTMLFormElement>('#skinAddForm')!;
  const newNameInput = document.querySelector<HTMLInputElement>('#skinNewName')!;
  const fileInput = document.querySelector<HTMLInputElement>('#skinFileInput')!;
  const toggle = document.querySelector<HTMLInputElement>('#chkCustomMarble')!;

  let db: IDBDatabase | null = null;
  const skins = new Map<string, HTMLCanvasElement>();
  const thumbUrls = new Map<string, string>();
  let enabled = readEnabled();
  let pendingName: string | null = null;

  const apply = () => roulette.setMarbleSkins(enabled && skins.size > 0 ? skins : null);

  const setSkin = async (name: string, blob: Blob) => {
    skins.set(name, await toCircleSkin(blob));
    const oldUrl = thumbUrls.get(name);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    thumbUrls.set(name, URL.createObjectURL(blob));
  };

  const removeSkin = (name: string) => {
    skins.delete(name);
    const url = thumbUrls.get(name);
    if (url) URL.revokeObjectURL(url);
    thumbUrls.delete(name);
  };

  const renderList = () => {
    const inList = currentNames();
    const extra = [...skins.keys()].filter((name) => !inList.includes(name));
    list.replaceChildren(
      ...[...inList, ...extra].map((name) => {
        const item = document.createElement('li');
        item.className = 'skin-item';

        const thumbUrl = thumbUrls.get(name);
        const thumb = document.createElement(thumbUrl ? 'img' : 'span');
        thumb.className = 'skin-thumb';
        if (thumb instanceof HTMLImageElement && thumbUrl) {
          thumb.src = thumbUrl;
          thumb.alt = '';
        }

        const label = document.createElement('span');
        label.className = 'skin-name';
        label.textContent = name;
        if (!inList.includes(name)) {
          const note = document.createElement('small');
          note.textContent = '명단에 없음';
          label.append(note);
        }

        const pick = document.createElement('button');
        pick.type = 'button';
        pick.textContent = thumbUrl ? '변경' : '이미지 선택';
        pick.addEventListener('click', () => pickImageFor(name));
        item.append(thumb, label, pick);

        if (thumbUrl) {
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'skin-remove';
          remove.textContent = '삭제';
          remove.addEventListener('click', () => deleteSkin(name));
          item.append(remove);
        }
        return item;
      })
    );
    if (!list.childElementCount) {
      const empty = document.createElement('li');
      empty.className = 'skin-empty';
      empty.textContent = '명단이 비어 있습니다. 아래에 이름을 직접 입력해 등록할 수 있습니다.';
      list.append(empty);
    }
  };

  const pickImageFor = (name: string) => {
    if (!db) {
      toast('이 브라우저에서는 이미지를 저장할 수 없습니다');
      return;
    }
    pendingName = name;
    fileInput.value = '';
    fileInput.click();
  };

  const deleteSkin = async (name: string) => {
    if (!db) return;
    try {
      await request(db, 'readwrite', (store) => store.delete(name));
    } catch (e) {
      console.error('구슬 이미지 삭제 실패', e);
      toast('이미지를 삭제하지 못했습니다');
      return;
    }
    removeSkin(name);
    renderList();
    apply();
  };

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    const name = pendingName;
    pendingName = null;
    if (!file || !name || !db) return;

    try {
      const blob = await toSquareBlob(file);
      const record: SkinRecord = { name, blob, updatedAt: Date.now() };
      await request(db, 'readwrite', (store) => store.put(record));
      await setSkin(name, blob);
    } catch (e) {
      console.error('구슬 이미지 등록 실패', e);
      toast('이미지를 불러오지 못했습니다');
      return;
    }
    newNameInput.value = '';
    renderList();
    apply();
    if (!enabled) toast('설정에서 커스텀 구슬을 켜면 적용됩니다');
  });

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = newNameInput.value.trim();
    if (!name) {
      newNameInput.focus();
      return;
    }
    pickImageFor(name);
  });

  const open = () => {
    renderList();
    dialog.classList.add('open');
  };
  const close = () => dialog.classList.remove('open');

  document.querySelector('#btnMarbleSkins')!.addEventListener('click', open);
  document.querySelector('#closeMarbleSkins')!.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialog.classList.contains('open')) close();
  });

  toggle.checked = enabled;
  toggle.addEventListener('change', () => {
    enabled = toggle.checked;
    writeEnabled(enabled);
    apply();
    if (enabled && skins.size === 0) {
      toast('등록된 구슬 이미지가 없습니다. 구슬 꾸미기에서 등록하세요');
    }
  });

  (async () => {
    try {
      db = await openDb();
      const records = await request<SkinRecord[]>(db, 'readonly', (store) => store.getAll());
      await Promise.all(
        records.map((record) =>
          setSkin(record.name, record.blob).catch((e) => console.error('구슬 이미지 불러오기 실패', record.name, e))
        )
      );
      apply();
    } catch (e) {
      console.error('구슬 꾸미기 저장소를 열 수 없습니다', e);
    }
  })();
}
