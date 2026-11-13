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
  // 다시 그리면 목록이 잠깐 비어 scrollTop 이 0 이 되므로 저장해 두었다가 되돌린다.
  const scrollTop = listEl.scrollTop;
  // 편집 중이던 입력 내용도 보존한다 (편집 중에 상단에서 새 기록을 저장하는 경우).
  const draft = readEditDraft();

  listEl.replaceChildren();

  if (entries.length === 0) {
    emptyEl.classList.remove('hidden');
    listEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');

  for (const entry of sortedNewestFirst(entries)) {
    if (entry.id === editingId) {
      listEl.append(buildEditRow(entry, draft));
      continue;
    }

    const li = document.createElement('li');
    li.className = 'flex h-12 items-center gap-3 px-3';
    li.dataset.id = entry.id;

    const stamp = document.createElement('span');
    stamp.className = 'shrink-0 text-sm tabular-nums text-stone-500';
    stamp.textContent = `${entry.date} ${entry.time}`;

    const text = document.createElement('span');
    text.className = 'min-w-0 flex-1 truncate';
    text.textContent = entry.text;
    text.title = entry.text;

    li.append(stamp, text);
    if (entry.updatedAt) li.append(buildEditedMark(entry));
    li.append(buildEditButton(entry));
    listEl.append(li);
  }

  listEl.scrollTop = scrollTop;
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

// ---------- 기록 수정 (add-diary-edit) ----------

const EDIT_WARNING = '내용을 입력해 주세요.';
const EDIT_INPUT_BASE =
  'h-8 min-w-0 flex-1 rounded-md border bg-white px-2 text-sm focus:outline-none focus:ring-2 placeholder:text-red-500';
const EDIT_INPUT_NORMAL = 'border-stone-300 focus:ring-stone-300';
const EDIT_INPUT_WARNING = 'border-red-400 ring-2 ring-red-400 focus:ring-red-400';

// 한 번에 하나만 편집한다.
let editingId = null;

function isComposingKey(event) {
  return event.isComposing || event.keyCode === 229;
}

// 지금 화면에 있는 편집 입력칸의 값. 편집 대상이 바뀌었으면 버린다.
function readEditDraft() {
  const input = listEl.querySelector('[data-edit-input]');
  if (!input || input.closest('li').dataset.id !== editingId) return null;
  return input.value;
}

function findEditInput() {
  return listEl.querySelector('[data-edit-input]');
}

function buildEditedMark(entry) {
  const updated = new Date(entry.updatedAt);
  const mark = document.createElement('span');
  mark.className = 'shrink-0 text-xs text-stone-400';
  mark.textContent = '수정됨';
  mark.title = `수정: ${formatDate(updated)} ${formatTime(updated)}`;
  return mark;
}

function buildEditButton(entry) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = 'edit';
  button.dataset.id = entry.id;
  button.className =
    'shrink-0 rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300';
  button.textContent = '수정';
  button.setAttribute('aria-label', `${entry.date} ${entry.time} 기록 수정`);
  return button;
}

function buildEditRow(entry, draft) {
  const li = document.createElement('li');
  li.className = 'flex h-12 items-center gap-3 bg-stone-50 px-3';
  li.dataset.id = entry.id;

  const stamp = document.createElement('span');
  stamp.className = 'shrink-0 text-sm tabular-nums text-stone-500';
  stamp.textContent = `${entry.date} ${entry.time}`;

  const form = document.createElement('form');
  form.className = 'flex min-w-0 flex-1 items-center gap-2';
  form.noValidate = true;
  form.dataset.editForm = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 100;
  input.autocomplete = 'off';
  input.value = draft ?? entry.text;
  input.dataset.editInput = '';
  input.className = `${EDIT_INPUT_BASE} ${EDIT_INPUT_NORMAL}`;
  input.setAttribute('aria-label', `${entry.date} ${entry.time} 기록 내용`);

  const save = document.createElement('button');
  save.type = 'submit';
  save.className =
    'h-8 shrink-0 rounded-md bg-stone-800 px-2 text-xs font-medium text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400';
  save.textContent = '저장';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.dataset.action = 'cancel';
  cancel.dataset.id = entry.id;
  cancel.className =
    'h-8 shrink-0 rounded-md px-2 text-xs text-stone-600 hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-300';
  cancel.textContent = '취소';

  // 화면 읽기 도구용 경고 (행 높이를 바꾸지 않도록 시각적으로는 숨김)
  const alertEl = document.createElement('span');
  alertEl.className = 'sr-only';
  alertEl.setAttribute('role', 'alert');
  alertEl.dataset.editAlert = '';

  form.append(input, save, cancel, alertEl);
  li.append(stamp, form);
  return li;
}

function showEditWarning(input) {
  input.value = '';
  input.placeholder = EDIT_WARNING;
  input.className = `${EDIT_INPUT_BASE} ${EDIT_INPUT_WARNING}`;
  input.setAttribute('aria-invalid', 'true');
  input.closest('form').querySelector('[data-edit-alert]').textContent = EDIT_WARNING;
}

function hideEditWarning(input) {
  input.placeholder = '';
  input.className = `${EDIT_INPUT_BASE} ${EDIT_INPUT_NORMAL}`;
  input.removeAttribute('aria-invalid');
  input.closest('form').querySelector('[data-edit-alert]').textContent = '';
}

function focusEditButton(id) {
  const button = [...listEl.querySelectorAll('button[data-action="edit"]')].find(
    (b) => b.dataset.id === id,
  );
  if (button) button.focus();
}

function startEdit(id) {
  editingId = id; // 다른 기록을 편집 중이었다면 그 내용은 저장하지 않고 버린다.
  renderList();
  const input = findEditInput();
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function finishEdit(id) {
  editingId = null;
  renderList();
  focusEditButton(id);
}

function handleEditSave(form) {
  const id = form.closest('li').dataset.id;
  const input = form.querySelector('[data-edit-input]');
  const text = input.value.trim();

  if (text === '') {
    showEditWarning(input);
    input.focus();
    return;
  }

  const current = entries.find((e) => e.id === id);
  if (!current) {
    finishEdit(id);
    return;
  }
  if (current.text === text) {
    finishEdit(id); // 내용이 같으면 수정으로 보지 않는다.
    return;
  }

  const next = entries.map((e) => (e.id === id ? { ...e, text, updatedAt: Date.now() } : e));
  if (!saveEntries(next)) {
    alert('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
    return; // 편집 상태와 입력 내용을 그대로 둔다.
  }

  entries = next;
  finishEdit(id);
}

listEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  if (button.dataset.action === 'edit') startEdit(button.dataset.id);
  if (button.dataset.action === 'cancel') finishEdit(button.dataset.id);
});

listEl.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-edit-form]')) return;
  event.preventDefault();
  handleEditSave(event.target);
});

listEl.addEventListener('keydown', (event) => {
  if (!event.target.matches('[data-edit-input]')) return;
  if (isComposingKey(event)) {
    // 한글 조합 중 Enter·Esc 는 조합 확정·취소에만 쓰이게 둔다.
    if (event.key === 'Enter') event.preventDefault();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    finishEdit(event.target.closest('li').dataset.id);
  }
});

listEl.addEventListener('input', (event) => {
  if (event.target.matches('[data-edit-input]')) hideEditWarning(event.target);
});

todayEl.textContent = formatDate(new Date());
renderList();
