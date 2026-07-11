# Chessriend 업적(Achievement) 카탈로그

Chessriend에 도입할 업적의 **설계 카탈로그**입니다. "어떤 업적을 둘지"를 정의한 기획 문서이며, 코드/DB 구현은 포함하지 않습니다. 새 도메인을 추가해야 하는 업적까지 함께 다룹니다.

## 이 문서를 읽는 법

- 형식: `[업적명] - [업적 내용]`
  - **업적명**은 기능을 그대로 드러내는 임시 이름입니다. 최종 이름은 자유롭게 변경하세요.
  - **업적 내용**은 달성 조건입니다.
- 각 업적에는 **근거/필요**(어느 데이터로 판정하는지, 혹은 무엇을 새로 만들어야 하는지)를 표기합니다.

### 구현 난이도 범례

| 표시 | 의미 |
|------|------|
| ✅ | **현재 데이터로 즉시 가능** — 기존 `games` / `game_analyses` 단순 조회·집계로 판정 |
| 🧩 | **기보·분석 채굴** — 기존 데이터(`moves[].san/fen`, `evaluations[]`)를 **파싱**하면 판정 가능. 새 테이블 불필요, 판정 로직만 필요 |
| 🏗️ | **새 도메인/테이블 필요** — User·활동 로그·통계·컬렉션 등 새 인프라가 있어야 판정 가능 |

## 앱 철학 적합성 검증

Chessriend의 핵심 철학은 **"내 게임이니까 더 애정을 가질 수 있게"** — 경쟁/대전 성과가 아니라, 자기 게임을 가져와 분석·메모·복기하는 **비경쟁적 학습/애정**에 초점이 있습니다.

- ❌ **제외**: 다른 사용자와의 순위/리더보드, 승수 grind(예: "Blitz 50승"), streak 미달성 시 수치심(confirmshaming), 운에 의존하거나 과도한 반복을 강요하는 업적.
- ✅ **채택**: 첫걸음, 누적 마일스톤, 분석 품질·탐험, **내 게임의 특별한 순간 재발견(기보 채굴)**, 성장 여정(과거의 나 vs 지금의 나), 복기 습관(수치심 없는 설계), 수집·큐레이션.
- **통과 기준**: ① 5초 안에 조건 이해, ② 한 문장으로 의의 설명(Story 테스트), ③ 너무 흔하지 않음(Rarity, 활성 사용자 30% 룰).
- **설계 톤**: "이 게임엔 스머더드 메이트가 있었네!"처럼 한 게임이 **여러 업적을 동시에** 달성할 수 있게 하고, 분석 후 "이 게임의 숨은 보석들"을 재발견하는 경험으로 만든다.

## 데이터 추적 현황

| 행동 | 추적 데이터 | 타임스탬프 | 사용자 단위 집계 |
|------|------------|-----------|----------------|
| 게임 가져오기 | `games.imported_at` | ✅ 있음 | `games.owner_username` |
| 각 수(move) | `moves[].san`, `moves[].fen`, `timeSpent` (JSONB) | — | 게임을 통해 간접 |
| 게임 분석 | `game_analyses.analyzed_at`, `depth`, `evaluations[]`(evalBefore/After, cpLoss, classification) | ✅ 있음 | 게임을 통해 간접 |
| 메모 작성 | `games.annotations.moveComments` (JSONB) | ❌ 없음 | 게임을 통해 간접 |
| 변형선 작성 | `games.annotations.variations` (JSONB) | ❌ 없음 | 게임을 통해 간접 |
| 출처 / 시간대 | `games.source`, `games.time_category` | — | `games.owner_username` |
| 앱 접속 / 로그인 | **없음** | — | **없음** |
| 복기 체류 시간 / 재방문 | **없음** | — | **없음** |

> 핵심: **모든 수의 SAN·FEN이 이미 저장**돼 있어 체스 묘기 판정이 가능하다(🧩). 반면 메모·접속·복기 행동의 **시각**은 없어 습관/성장 추적은 새 도메인이 필요하다(🏗️).

---

# Part A. 현재 데이터로 즉시 가능한 업적 (✅)

## A-1. 첫걸음 / 온보딩
첫 세션 안에 닿게 설계 — 시작하자마자 작은 성취감을 줍니다.

- `[첫 게임 가져오기] - 게임을 처음으로 가져왔을 때` · 근거: `games.imported_at` 첫 레코드
- `[첫 게임 분석] - 게임 분석을 처음으로 실행했을 때` · 근거: `game_analyses` 첫 레코드
- `[첫 메모] - 어떤 수에든 메모를 처음 작성·저장했을 때` · 근거: `annotations.moveComments`가 1개 이상
- `[첫 변형선] - 변형선(variation)을 처음 만들었을 때` · 근거: `annotations.variations`가 1개 이상

## A-2. 누적 마일스톤
점진적 목표 — 진행바로 시각화하기 좋습니다. (N 단계는 예시)

- `[게임 수집가] - 게임을 N개 가져왔을 때 (10 / 50 / 100 / 500)` · 근거: `COUNT(games WHERE owner_username = ?)`
- `[분석가] - 게임을 N개 분석했을 때 (5 / 20 / 50 / 100)` · 근거: `COUNT(game_analyses)`
- `[메모광] - 누적 메모를 N개 작성했을 때 (10 / 50 / 100)` · 근거: 모든 게임 `moveComments.size` 합산
- `[한 게임 정독] - 한 게임에 메모를 N개 이상 작성했을 때 (10 / 20)` · 근거: 단일 게임 `moveComments.size`

## A-3. 분석 품질 / 깊이
- `[깊은 분석] - depth N 이상으로 분석했을 때 (예: 25+)` · 근거: `game_analyses.depth`
- `[실수 발견] - 분석으로 블런더/실수를 누적 N개 발견했을 때` · 근거: `evaluations[].classification` ∈ {blunder, mistake} 집계
- `[탁월수 목격] - 분석에서 brilliant 수가 나온 게임을 가졌을 때` · 근거: `evaluations[].classification == "brilliant"`
- `[클린 게임] - 한 게임 분석에 블런더/실수가 0개일 때` · 근거: 단일 게임 `evaluations[]` 전수 검사

## A-4. 탐험 / 완성
- `[양다리] - chess.com과 lichess 두 출처 게임을 모두 보유했을 때` · 근거: `COUNT(DISTINCT games.source) == 2`
- `[시간대 마스터] - Bullet / Blitz / Rapid / Classical 4종 게임을 모두 보유했을 때` · 근거: `COUNT(DISTINCT games.time_category) == 4`

## A-5. 숨겨진 업적 (조건 비공개)
- `[재방문 복기] - 이미 메모가 있는 게임을 다시 분석했을 때` · 근거: `moveComments` 존재 + `game_analyses` 재실행/갱신
- `[꼼꼼한 사람] - 한 게임에 메모와 변형선을 둘 다 남겼을 때` · 근거: `moveComments`와 `variations` 동시 존재

---

# Part B. 기보·분석 채굴 업적 (🧩 — 기존 데이터, 판정 로직 필요)

> 새 테이블 없이 `moves[].san` / `moves[].fen` / `evaluations[]`를 파싱해 판정. 한 게임이 여러 업적을 동시에 달성할 수 있고, 분석 후 "이 게임의 숨은 보석"을 재발견하는 핵심 경험을 만든다.
> 참고: chess.com 게임플레이 배지(Castle Victory, Killer King, Back Rank Blues, Under Promotion, En Passant 등)에서 착안. 출처: [Chess.com Help Center — Badges](https://support.chess.com/en/articles/8618496-what-are-achievements)

## B-1. 특수 수 / SAN 패턴 (간단 — 정규식 수준)
- `[첫 캐슬링] - 게임에 캐슬링(O-O / O-O-O)이 포함됐을 때` · 근거: `moves[].san` 매칭
- `[언더프로모션] - 폰을 퀸이 아닌 기물로 승격했을 때 (=N/=B/=R)` · 근거: `san` 정규식 `/=[NBR]/`
- `[앙파상] - 앙파상 포획이 일어난 게임` · 근거: `san`(`exd6` 형태) + 직전 `fen`으로 실제 앙파상 검증
- `[킹의 활약] - 킹이 직접 체크메이트를 만든 게임` · 근거: 마지막 `san`이 `K`로 시작하고 `#`로 끝남

## B-2. 체크메이트 패턴 / FEN 분석
- `[백랭크 메이트] - 1·8랭크에서 체크메이트가 난 게임` · 근거: 마지막 `san`이 `#` + 직전/직후 `fen`에서 킹 위치 파싱
- `[스머더드 메이트] - 나이트가 질식 메이트를 만든 게임` · 근거: 마지막 `san`이 `N…#` + `fen`에서 킹 주변이 자기 기물로 막힘
- `[폰 메이트] - 폰이 체크메이트를 만든 게임` · 근거: 마지막 `san`이 폰 이동(`#`)
- `[승급 부대] - 한 게임에서 폰을 2개 이상 승급했을 때` · 근거: `san`의 `=` 개수, 또는 `fen` 기물 수 비교

## B-3. eval 기반 명장면 (이미 있는 분석 데이터 활용)
- `[역전승] - 한때 eval이 -3.0 이하였는데 비기거나 이긴 게임` · 근거: `min(evaluations[].evalAfter)` < -3.0 && `result`가 내 승/무
- `[탁월수 사냥꾼] - brilliant 수가 N개 이상 나온 게임 (예: 3+)` · 근거: `evaluations[]`의 brilliant 개수
- `[거의 완벽] - 한 게임 내 cpLoss 합이 매우 작을 때 (예: < 50)` · 근거: `sum(evaluations[].cpLoss)`
- `[정적인 한 수] - 포획·체크가 아닌 조용한 수가 최선수였던 순간이 있는 게임` · 근거: best move인 `san`에 `x`/`+` 없음
- `[강적 격파] - 나보다 레이팅이 N 이상 높은 상대를 이긴 게임 (예: +200)` · 근거: `games`의 상대 rating − 내 rating, `result`
  - ※ 리더보드가 아니라 **내 게임의 특별한 순간**으로 한정 — 다른 사용자와 비교하지 않음

---

# Part C. 새 도메인이 필요한 업적 (🏗️)

> 아래는 앱 철학에 부합하지만 새 인프라가 필요하다. 업적별로 **어떤 도메인/테이블**을 만들어야 하는지 명시한다. 모두 기존 헥사고날 구조(`domain` / `application` / `port{in,out}` / `adapter{in/web, out/persistence}`)를 그대로 따른다.

## C-1. `user/` 도메인 — 프로필 / 온보딩 여정
**필요 테이블**: `user_profiles(owner_username PK, bio, preferred_opening, created_at, updated_at)` — `ownerUsername` 문자열을 정규화한 프로필.

- `[프로필 완성] - bio·선호 오프닝 등 프로필을 채웠을 때` · 필요: `user_profiles`
- `[첫 주 여정] - 가입 첫 7일 안에 가져오기·메모·분석을 모두 해봤을 때` · 필요: `user_profiles.created_at` + 활동 로그(C-2)

## C-2. `activity/` 도메인 — 복기 여정 / 습관 (타임스탬프의 핵심)
**필요 테이블**:
- `game_reviews(game_id, owner_username, reviewed_at, review_duration_secs)` — 복기 세션 로그
- `annotation_logs(game_id, move_index, owner_username, char_count, created_at, updated_at)` — 메모 작성 이력(시각·분량)

- `[단골] - 앱에 누적 N회 접속/복기했을 때` · 필요: 세션/접속 로그 (`user_sessions` 또는 `game_reviews`)
- `[꾸준한 복기] - 주당 N회 복기를 M주 연속 했을 때` · 필요: `game_reviews.reviewed_at`
  - ⚠️ **수치심 없는 설계**: 일일 스트릭 압박이 아니라 **주간/월간 규칙성** 기반. 끊겨도 벌점 없음.
- `[돌아온 걸 환영해] - 오래 쉬었다가 돌아와 다시 복기했을 때` · 필요: `game_reviews`의 활동 공백 탐지 (복귀를 축하하는 긍정 프레이밍)
- `[추억 여행] - 오래전(예: 3개월+) 게임을 다시 복기했을 때` · 필요: `games.played_at` vs `game_reviews.reviewed_at` 차이
- `[복기 시간] - 누적 복기 시간이 N시간에 도달했을 때` · 필요: `game_reviews.review_duration_secs` 합산
- `[깊은 노트] - 한 게임에 N글자 이상 메모를 작성했을 때` · 필요: `annotation_logs.char_count`
- `[하루 집중] - 하루에 게임을 N개 분석/복기했을 때` · 필요: `game_reviews`/분석 로그의 날짜 집계

## C-3. `stats/` 도메인 — 자기성장 추적 (과거의 나 vs 지금의 나)
**필요 테이블**:
- `opening_performance(owner_username, opening_eco, game_count, avg_accuracy, updated_at)`
- (선택) `move_statistics` / `mistake_patterns` — 분석 결과를 사용자 단위로 누적·역정규화

- `[블런더 감소] - 최근 N게임의 블런더율이 이전 N게임보다 뚜렷이 줄었을 때` · 필요: 게임별 정확도/블런더율의 시계열 누적
- `[정확도 향상] - 평균 정확도가 개인 최고치를 갱신했을 때(Personal Record)` · 필요: 게임별 accuracy 집계
- `[오프닝 숙련] - 같은 오프닝(ECO)으로 N게임 + 정확도 상승] ` · 필요: `opening_performance`
- `[약점 극복] - 가장 자주 범하던 실수 유형이 이번 기간에 사라졌을 때` · 필요: `mistake_patterns` 시계열
- `[정확도 연속] - N게임 연속 정확도 X% 이상] ` · 필요: 게임별 accuracy(부분적으로 `game_analyses`로도 계산 가능하나 사용자 단위 집계엔 stats 권장)

## C-4. `collection/` 도메인 — 수집 / 큐레이션
**필요 테이블**:
- `game_tags(game_id, owner_username, tag_name, created_at)`
- `game_favorites(game_id, owner_username, is_favorite, marked_at, reason_text)`

- `[인생 게임] - 게임을 "인생 게임"으로 표시했을 때` · 필요: `game_favorites`
- `[컬렉션 빌더] - 한 태그에 N게임 이상 모았을 때` · 필요: `game_tags`
- `[태그 수집가] - 서로 다른 태그를 N종 이상 만들고 각각 M게임 이상 채웠을 때` · 필요: `game_tags`
- `[개인 박물관] - 즐겨찾기 게임에 노트까지 남겨 N개를 큐레이션했을 때` · 필요: `game_favorites` + `annotation_logs`
- `[이야기꾼] - 변형선 N개 + 각 변형선에 충분한 주석을 달았을 때` · 필요: `variations` + `annotation_logs`(분량)

## C-5. `achievement/` 도메인 — 업적 시스템 공통 인프라
모든 업적군이 공유하는 기반. **필요 테이블**:
- `achievements(id, key, name, description, icon_url, rarity, ...)` — 업적 정의
- `user_achievements(owner_username, achievement_id, earned_at, progress)` — 사용자별 달성/진행도

- 역할: 각 도메인의 조건 평가 결과를 받아 업적 언락/진행도 갱신, 조회 API 제공.
- 트리거 시점: 게임 import·분석 완료·복기 로그 기록 시 조건 재평가(이벤트 또는 스케줄러).

---

# Part D. 새 도메인 ↔ 업적군 매핑 요약

| 새 도메인 | 핵심 테이블 | 푸는 업적군 | 대표 업적 |
|-----------|-------------|-------------|-----------|
| `user/` | `user_profiles` | 프로필/온보딩 | 프로필 완성, 첫 주 여정 |
| `activity/` | `game_reviews`, `annotation_logs` | 복기 여정·습관 | 단골, 꾸준한 복기, 추억 여행, 복기 시간, 깊은 노트 |
| `stats/` | `opening_performance`, `mistake_patterns` | 자기성장 추적 | 블런더 감소, 정확도 향상, 오프닝 숙련, 약점 극복 |
| `collection/` | `game_tags`, `game_favorites` | 수집·큐레이션 | 인생 게임, 컬렉션 빌더, 개인 박물관 |
| `achievement/` | `achievements`, `user_achievements` | (공통 인프라) | 모든 업적의 정의·달성·진행도 |

> Part A·B는 새 도메인 없이도 가능하지만, 달성 기록을 영구 저장하려면 `achievement/` 도메인(C-5)은 공통으로 필요하다.

---

# 부록. 업적 설계 원칙 메모

웹 리서치에서 추린, 이 카탈로그가 따르는 원칙:

- **수치심 회피 (Guilt-Free)**: 일일 스트릭 압박·confirmshaming 금지. 휴식은 격려하고 복귀는 축하. (출처: [The Psychology of Hot Streak Game Design](https://uxmag.medium.com/the-psychology-of-hot-streak-game-design-how-to-keep-players-coming-back-every-day-without-shame-3dde153f239c))
- **5초 규칙 + Story 테스트**: 이름·설명만 보고 5초 안에 "왜 어렵고 왜 재밌는지" 이해 가능해야 함. (출처: [Achievement Design 101 — Game Developer](https://www.gamedeveloper.com/design/achievement-design-101))
- **내재 동기 (자율성·능력감·연결감)**: 남과 비교(리더보드) 대신 "과거의 나 vs 지금의 나"로 변화를 수치화. (출처: [Self-Determination Theory](https://selfdeterminationtheory.org/intrinsic-motivation-inventory/))
- **희귀성 (Rarity)**: 활성 사용자 30% 이상이 쉽게 얻는 업적은 의미가 옅음 — 난이도 차등.
- **완성 본능 (Collections)**: 태그/컬렉션은 장기 engagement에 효과적. (출처: [31 Core Gamification Techniques](https://sa-liberty.medium.com/the-31-core-gamification-techniques-part-1-progress-achievement-mechanics-d81229732f07))
