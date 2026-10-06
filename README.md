# MINI GAME ZONE 🎮

김민기가 직접 만든 브라우저 미니게임 모음.

| 게임 | 파일 | 한 줄 |
| --- | --- | --- |
| 메테오 런 🚀 | `meteor.html` + `meteor.js` + `meteor.css` | 쏟아지는 운석을 피해 오래 버티는 회피 서바이벌 — 시간이 갈수록 빨라짐 |

- 존(게임 선택): `index.html`
- 에셋: `assets/sprites/` 직접 그린 픽셀 SVG (로켓·운석·별·구름)
- 효과음·배경음: WebAudio API 실시간 생성 (오디오 파일 없음)

## 메테오 런 규칙·조작

- 방향키·A D 또는 마우스 호버·터치 드래그로 로켓을 좌우로 움직입니다
- 운석에 닿으면 추락 — 생존 시간이 점수, 별을 먹으면 +점수
- 15초마다 레벨업 — 운석이 더 자주, 더 빠르게 떨어집니다
- P 일시정지 · R 재시작 · Enter 시작/다시 시작

## 실행

- 배포: https://sterran123.github.io/mini-game-zone/ (GitHub Pages)
- 로컬: `node tools/serve.mjs` → http://localhost:8081 → 존에서 게임 카드 클릭

## 기술 메모

- 순수 HTML/CSS/JS — 프레임워크·빌드 없음
- 효과음·배경음: WebAudio API로 실시간 생성 (오디오 파일 없음)
- 기록 저장: `localStorage` — 최고기록·판별 로그 보존, 손상 시 기본값 복구
- 난이도 값은 `meteor.js` 상단 `CONFIG`에 모여 있음 (운석 생성 간격·낙하 속도·레벨업 주기)

## 만든 사람

김민기 — [소개 페이지](https://sterran123.github.io/about-me/) · MIT License
