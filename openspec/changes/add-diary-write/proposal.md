# Proposal

## Why

하루를 한 줄로 짧게 남길 수 있는 다이어리가 필요하다. 지금 저장소에는 OpenSpec 설정만 있고 앱이 없으므로, 첫 변경으로 "쓰고, 쌓인 기록을 보는" 최소 기능을 만든다.

## What Changes

- 화면 상단에 오늘 날짜를 `YYYY-MM-DD` 형식으로 자동 표시한다.
- 한 줄 입력칸과 저장 버튼을 둔다. Enter 키로도 저장한다.
- 같은 날 여러 번 작성할 수 있고, 각 기록에 작성 날짜와 시간(`HH:mm`)을 함께 저장한다.
- 기록은 브라우저 `localStorage`에 저장되어 새로고침 후에도 남는다.
- 저장된 기록 전체를 최신순 목록으로 보여준다. 목록 영역은 5개 높이까지 보이고, 넘치면 목록 안에서 스크롤한다.
- 공백만 입력하면 저장하지 않으며, 한 줄은 최대 100자로 제한한다.
- 기술 구성: Vanilla JS + Tailwind(Play CDN) + `localStorage`, 빌드 단계 없음.

범위 밖 (다음 변경으로 미룸):
- 기록 수정·삭제
- 검색·필터, 날짜별 묶어 보기
- 내보내기·동기화 등 다른 기기와의 공유

## Capabilities

### New Capabilities
- `diary-entries`: 한 줄 다이어리 기록의 작성, 저장, 목록 표시

### Modified Capabilities
- 없음

## Impact

- 새 파일: `index.html`, `app.js` (저장소 루트)
- 외부 의존성: Tailwind Play CDN 스크립트 (인터넷 연결 필요)
- 데이터: 브라우저 `localStorage` 키 `diary.entries` — 같은 브라우저·기기에서만 유지되며, 사이트 데이터를 지우면 기록도 사라진다.
