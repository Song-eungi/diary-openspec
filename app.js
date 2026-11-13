'use strict';

const STORAGE_KEY = 'diary.entries';
const CORRUPT_BACKUP_KEY = 'diary.entries.corrupt';

// ---------- 날짜·시간 (항상 로컬 시간 기준, toISOString 은 UTC 라 쓰지 않는다) ----------

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ---------- 저장소 ----------

function loadEntries() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // 아래에서 손상 처리
  }

  // 읽을 수 없는 데이터: 덮어쓰기 전에 원본을 한 번 백업해 둔다.
  try {
    if (localStorage.getItem(CORRUPT_BACKUP_KEY) === null) {
      localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
    }
  } catch {
    // 백업 실패는 무시하고 빈 목록으로 시작
  }
  return [];
}

function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

function createId(now) {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `${now}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- 화면 ----------

const todayEl = document.getElementById('today');
const formEl = document.getElementById('entry-form');
const inputEl = document.getElementById('entry-input');
const warningEl = document.getElementById('entry-warning');
const listEl = document.getElementById('entry-list');
const emptyEl = document.getElementById('empty-message');

let entries = loadEntries();

function showWarning() {
  warningEl.classList.remove('invisible');
}

function hideWarning() {
  warningEl.classList.add('invisible');
}

// createdAt 내림차순, 같으면 배열에서 뒤에 있는(나중에 저장한) 것이 먼저
function sortedNewestFirst(list) {
  return list
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (b.entry.createdAt - a.entry.createdAt) || (b.index - a.index))
    .map(({ entry }) => entry);
}

function renderList() {
  listEl.replaceChildren();

  if (entries.length === 0) {
    emptyEl.classList.remove('hidden');
    listEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');

  for (const entry of sortedNewestFirst(entries)) {
    const li = document.createElement('li');
    li.className = 'flex h-12 items-center gap-3 px-3';

    const stamp = document.createElement('span');
    stamp.className = 'shrink-0 text-sm tabular-nums text-stone-500';
    stamp.textContent = `${entry.date} ${entry.time}`;

    const text = document.createElement('span');
    text.className = 'min-w-0 flex-1 truncate';
    text.textContent = entry.text;
    text.title = entry.text;

    li.append(stamp, text);
    listEl.append(li);
  }
}

function handleSave() {
  const text = inputEl.value.trim();
  if (text === '') {
    showWarning();
    inputEl.focus();
    return;
  }

  const now = new Date();
  const createdAt = now.getTime();
  const entry = {
    id: createId(createdAt),
    date: formatDate(now),
    time: formatTime(now),
    text,
    createdAt,
  };

  const next = [...entries, entry];
  if (!saveEntries(next)) {
    alert('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
    return; // 입력 내용은 지우지 않는다
  }

  entries = next;
  inputEl.value = '';
  hideWarning();
  renderList();
  inputEl.focus();
}

// 버튼 클릭과 Enter 모두 submit 으로 들어온다.
formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  handleSave();
});

// 한글 조합 중 Enter 는 저장하지 않는다 (조합 확정용 Enter 로 두 번 저장되는 것 방지).
inputEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.isComposing || event.keyCode === 229)) {
    event.preventDefault();
  }
});

inputEl.addEventListener('input', hideWarning);

todayEl.textContent = formatDate(new Date());
renderList();
