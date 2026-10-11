# MINI GAME ZONE 🎮

김민기가 직접 만든 브라우저 미니게임 모음.

| 게임 | 파일 | 한 줄 |
| --- | --- | --- |
| 메테오 런 🚀 | `meteor.html` + `meteor.js` + `meteor.css` | 쏟아지는 운석을 피해 오래 버티는 회피 서바이벌 — 5레벨마다 보스전(탄막 슈팅) |
| 스네이크 🐍 | `snake.html` + `snake.js` + `snake.css` | 먹이를 먹고 길어지는 고전 — 먹을수록 빨라짐 |
| 벽돌깨기 🧱 | `breakout.html` + `breakout.js` + `breakout.css` | 패들로 공을 튕겨 벽돌을 깨는 고전 — 레벨마다 가속, 목숨 3개 |
| 플래피 🐤 | `flap.html` + `flap.js` + `flap.css` | 탭 한 번으로 날아오르는 새를 파이프 사이로 통과 — 원버튼 |
| 두더지 잡기 🔨 | `whack.html` + `whack.js` + `whack.css` | 30초 제한 두더지잡이 — 황금 두더지 +5점, 후반 갈수록 빠름 |
| 2048 🔢 | `g2048.html` + `g2048.js` + `g2048.css` | 같은 숫자 타일을 합쳐 2048을 만드는 슬라이드 퍼즐 |
| 메모리 매치 🃏 | `memory.html` + `memory.js` + `memory.css` | 뒤집힌 카드 16장에서 8쌍 찾기 — 적은 뒤집기·빠른 시간 경쟁 |
| 반응 테스트 ⚡ | `reaction.html` + `reaction.js` + `reaction.css` | 초록 신호에 클릭 — 5회 평균 반응속도(ms) 측정 |
| 테트리스 🧱 | 외부 링크 | 이전에 만든 고전 퍼즐 — 존 카드에서 바로 이동 |

- 존(게임 선택): `index.html` — 검색창·장르 태그 필터·"자주 플레이한 게임" 스트립(이 브라우저의 플레이 횟수 집계, `zone.js`)
- 공통 헬퍼: `shared.js` — 사운드 스위치·움직임 줄이기·자동 일시정지·기록 저장·플레이 카운트
- 에셋: `assets/sprites/` 직접 그린 픽셀 SVG (로켓·운석·별·구름·뱀·벽돌·새·두더지·카드·번개)
- 효과음·배경음: WebAudio API 실시간 생성 (오디오 파일 없음)

## 메테오 런 규칙·조작

- 방향키·A D 또는 마우스 호버·터치 드래그로 로켓을 좌우로 움직입니다
- 운석에 닿으면 추락 — 생존 시간이 점수, 별을 먹으면 +점수
- 12초마다 레벨업 — 운석이 더 자주, 더 빠르게 떨어집니다
- **5레벨마다 보스전**: 운석 대신 보스 UFO가 탄막을 쏩니다 — 탄을 피하면서 자동 사격으로 HP를 깎아 격파하면 ⭐3 보너스. 보스마다 패턴이 늘어납니다 (조준탄 → 3방향 팬 → 원형 탄환)
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
