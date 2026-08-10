# 음식 이미지 50종 최종 라이브러리·덱 단위 선로딩

## 작업 정보

- 작업 날짜: 2026-08-08
- 프로젝트: 오늘 뭐 썰?
- 사용 도구: Codex, Codex 내장 ImageGen, 로컬 크로마키 제거 스크립트, Pillow 12.3.0 기반 WebP 후처리
- 목적: 메뉴 풀 50종 모두를 실제 음식 이미지로 제공하고, 음식별 고유한 외곽을 실제 알파 베기 판정에 사용하면서 모바일 시작 부하는 한 판의 20종으로 제한
- 런타임 AI 사용: 없음. 생성형 AI는 제작 과정에서만 사용하며 게임 실행 중에는 AI 모델이나 외부 AI API를 호출하지 않음

## 해결하려는 문제

초기 프로토타입은 일부 메뉴만 이미지가 있고 나머지는 도형 폴백이었다. 먼저 만든 이미지도 그릇 중심의 원형 구도가 반복되어 음식마다 베는 느낌이 충분히 다르지 않았다. 반대로 외곽 변화만 강하게 요구하면 음식이 무엇인지 알아보기 어렵거나 먹음직스럽지 않고, 젓가락·숟가락·집게로 억지로 많은 양을 들어 올리는 생성 오류가 생겼다.

최종 작업의 우선순위는 다음과 같이 정했다.

1. 한눈에 음식 종류를 알아볼 수 있어야 한다.
2. 색·광택·재료 표현이 자연스럽고 먹음직스러워야 한다.
3. 원형 그릇 반복을 피하고 가로형·세로형·길쭉한 형태·불규칙한 외곽 등 베기 실루엣이 달라야 한다.
4. 형태를 바꾸기 위해 부자연스러운 도구 사용, 과도한 양, 넘쳐 흐르는 비위생적 연출을 만들지 않는다.
5. 정사각형으로 늘이지 않고 원본 종횡비를 유지한다.
6. 50종 전체를 홈에서 한꺼번에 받지 않고, 실제 라운드의 결정적 20종 덱만 시작 전에 준비한다.

## 주요 생성 프롬프트·지시 요약

아래 문장은 여러 소수 묶음 생성과 교정 과정에서 반복해 사용한 핵심 지시를 제출용으로 요약한 것이다.

### 공통 생성 지시

> 한국 일상 메뉴를 한눈에 식별할 수 있는 고품질 2D 음식 스티커로 표현한다. 음식은 윤기·굽기·재료 색이 자연스럽고 먹음직스러워야 한다. 모든 음식을 원형 그릇에 담지 말고 음식의 실제 구조를 살려 가로형, 세로형, 길쭉한 형태, 비대칭 형태 등 서로 다른 알파 실루엣을 만든다. 원본 종횡비를 유지할 수 있도록 음식 외곽 주변에는 깨끗한 단색 크로마키 배경만 둔다. 글자, 로고, 사람, 손, 테이블, 장면 배경은 넣지 않는다.

### 부정 지시

> 젓가락·숟가락·집게를 단순한 형태 변화 장치처럼 반복하지 않는다. 도구가 실제 식사 동작과 맞지 않으면 제거한다. 한 번에 비현실적으로 많은 면·밥·채소가 들려 올라오지 않게 한다. 국물이나 재료가 그릇 밖으로 넘쳐 흐르지 않게 하고, 과도한 지방·타거나 마른 질감·정체를 알 수 없는 추상 형태를 피한다.

### 사람 피드백을 반영한 교정 사례

- 짜장면: 젓가락에 들린 면의 양이 지나치게 많지 않도록 축소
- 삼계탕: 닭을 집게로 드는 어색한 장면을 제거
- 비빔밥: 젓가락으로 밥과 많은 채소가 함께 들리는 비현실적 장면을 제거
- 순대국: 숟가락으로 순대를 떠올리는 어색한 동작을 제거
- 삼겹살: 비계 비율을 줄이고 고기·김치의 색을 먹음직스럽게 교정하며 넘침 표현을 제외
- 콩나물국밥·육개장 등: 한눈에 메뉴가 구분되고 자연스러운 재료 배치가 되도록 재생성·선별
- 볶음밥: 후속 교정안보다 공중에 밥알이 흩날리는 기존 역동 시안이 더 적합하다는 사람의 판단으로 기존 시안을 유지

## 생성·선별 결과

- 최종 활성 이미지: 50종
- 이번 최종 통합의 신규 생성·교정 이미지: 42종
- 이전 단계에서 이미 승인되어 유지한 이미지: 8종
  - 치킨, 갈비탕, 김밥, 가정식 백반, 오므라이스, 라면, 샌드위치, 떡볶이
- 외부 음식 이미지 사용: 없음
- 제외한 결과: 음식 식별이 어렵거나 먹음직스럽지 않은 시안, 원형 구도 반복, 부자연스러운 도구 동작, 과도한 양·지방·넘침이 있는 시안

## 50종 메뉴·파일 매핑

`src/data/menuVisualManifest.ts`가 메뉴 ID, 텍스처 키, WebP 파일명, 원본 크기의 단일 기준이다.

| 음식 | 메뉴 ID | 파일 | 음식 | 메뉴 ID | 파일 |
|---|---|---|---|---|---|
| 김치찌개 | `kimchi-jjigae` | `kimchi-jjigae-v2.webp` | 된장찌개 | `doenjang-jjigae` | `doenjang-jjigae.webp` |
| 순두부찌개 | `sundubu-jjigae` | `sundubu-jjigae.webp` | 부대찌개 | `budae-jjigae` | `budae-jjigae.webp` |
| 감자탕 | `gamjatang` | `gamjatang.webp` | 설렁탕 | `seolleongtang` | `seolleongtang.webp` |
| 곰탕 | `gomtang` | `gomtang.webp` | 갈비탕 | `galbitang` | `galbitang-v2.webp` |
| 육개장 | `yukgaejang` | `yukgaejang.webp` | 삼계탕 | `samgyetang` | `samgyetang.webp` |
| 콩나물국밥 | `kongnamul-gukbap` | `kongnamul-gukbap.webp` | 돼지국밥 | `dwaeji-gukbap` | `dwaeji-gukbap.webp` |
| 순대국 | `sundae-guk` | `sundae-guk.webp` | 청국장 | `cheonggukjang` | `cheonggukjang.webp` |
| 가정식 백반 | `home-style-baekban` | `home-style-baekban-v2.webp` | 비빔밥 | `bibimbap` | `bibimbap.webp` |
| 제육덮밥 | `jeyuk-deopbap` | `jeyuk-deopbap.webp` | 불고기덮밥 | `bulgogi-deopbap` | `bulgogi-deopbap.webp` |
| 치킨마요덮밥 | `chicken-mayo-deopbap` | `chicken-mayo-deopbap.webp` | 카레라이스 | `curry-rice` | `curry-rice.webp` |
| 오므라이스 | `omurice` | `omurice-v2.webp` | 볶음밥 | `fried-rice` | `fried-rice.webp` |
| 김치볶음밥 | `kimchi-fried-rice` | `kimchi-fried-rice.webp` | 돈가스 | `pork-cutlet` | `pork-cutlet.webp` |
| 초밥 | `sushi` | `sushi-v2.webp` | 비빔국수 | `bibim-guksu` | `bibim-guksu.webp` |
| 잔치국수 | `janchi-guksu` | `janchi-guksu.webp` | 칼국수 | `kalguksu` | `kalguksu.webp` |
| 냉면 | `naengmyeon` | `naengmyeon.webp` | 짜장면 | `jjajangmyeon` | `jjajangmyeon.webp` |
| 짬뽕 | `jjamppong` | `jjamppong.webp` | 라면 | `ramyeon` | `ramyeon-v2.webp` |
| 우동 | `udon` | `udon.webp` | 파스타 | `pasta` | `pasta.webp` |
| 쌀국수 | `pho` | `pho.webp` | 떡볶이 | `tteokbokki` | `tteokbokki-v2.webp` |
| 김밥 | `gimbap` | `gimbap-v2.webp` | 샌드위치 | `sandwich` | `sandwich-v2.webp` |
| 햄버거 | `hamburger` | `hamburger.webp` | 길거리 토스트 | `korean-toast` | `korean-toast.webp` |
| 삼겹살 | `samgyeopsal` | `samgyeopsal.webp` | 갈비구이 | `grilled-galbi` | `grilled-galbi.webp` |
| 닭갈비 | `dakgalbi` | `dakgalbi.webp` | 보쌈 | `bossam` | `bossam.webp` |
| 족발 | `jokbal` | `jokbal.webp` | 불고기 | `bulgogi` | `bulgogi.webp` |
| 치킨 | `fried-chicken` | `fried-chicken-v2.webp` | 피자 | `pizza` | `pizza-v2.webp` |
| 닭한마리 | `dak-hanmari` | `dak-hanmari.webp` | 샤부샤부 | `shabu-shabu` | `shabu-shabu.webp` |

## 로컬 후처리 과정

`scripts/process_food_art_batch.py`에서 다음 단계를 자동화했다.

1. 생성 PNG의 네 모서리를 표본으로 녹색 또는 자홍색 크로마키 계열을 감지한다.
2. 로컬 `remove_chroma_key.py`에 soft matte, despill, 투명 임계값 12, 불투명 임계값 112를 적용한다.
3. 알파값 32 이상인 실제 음식 외곽을 찾고, 긴 변의 약 1.5%에 해당하는 여백을 추가해 자른다.
4. 원본 종횡비를 유지하면서 긴 변을 512px로 맞춘다.
5. WebP 품질 84에서 시작해 파일이 120KB 이하가 될 때까지 단계적으로 조정한다.
6. 50종이 모두 존재할 때만 보고서를 통과시키고, 시각 검수 뒤 `--apply`로 게임 에셋 폴더에 반영한다.

최종 자동 검사 결과는 다음과 같다.

- 50종 총 용량: 2,316,336바이트
- 용량이 큰 20종의 합계: 1,149,052바이트
- 가장 큰 단일 파일: 볶음밥 74,432바이트
- 파일당 제한 120,000바이트 이하: 통과
- 전체 제한 3,500,000바이트 이하: 통과
- 한 판 20종 예산 1,500,000바이트 이하: 통과
- 보이는 녹색·자홍색 크로마키 잔여 픽셀: 0
- 긴 변 512px·원본 종횡비 유지·알파 외곽 존재: 통과

## 게임 통합과 선로딩

- `src/data/menuVisualManifest.ts`: 50개 메뉴 ID와 50개 WebP를 일대일로 연결한다.
- `src/game/gameDeck.ts`: 식사 시간과 덱 시드로 실제 플레이할 20종을 결정한다.
- `src/game/scenes/PrototypeScene.ts`: 같은 덱 생성 함수를 사용하므로 선로더와 실제 라운드가 어긋나지 않는다.
- `src/data/menuVisuals.ts`: 요청된 메뉴만 이미지 디코드·128px 알파 마스크 생성하며, 같은 메뉴의 동시 요청은 하나의 Promise로 합친다. 실패한 메뉴는 다음 요청에서 재시도할 수 있다.
- `src/app/GameHost.ts`, `src/app/AppController.ts`: 솔로·방 시작·재접속 복구 경로에서 게임을 열기 전에 해당 20종만 준비한다.
- 이미지 또는 캔버스 알파 읽기가 실패하면 게임은 기존 색상 토큰·원형 판정으로 안전하게 폴백한다.

## 사람의 검토와 자동 검증

사람은 생성 결과를 한 번에 승인하지 않고 소수 묶음으로 확인했다. 음식 정체성, 식욕, 자연스러운 재료·도구 관계, 외곽 다양성, 작은 화면 가독성을 기준으로 교정하거나 기존 시안을 유지했다. 최종 50종은 연락 시트로 투명 외곽·크롭·왜곡 여부를 다시 확인한 뒤 반영했다.

자동 검증 범위:

- `tests/menuVisuals.test.ts`: 메뉴 카탈로그와 이미지의 정확한 50종 집합 일치, 고유 ID·텍스처 키·파일명, WebP 알파·크기·용량, 비정사각 자산 수
- `tests/gameDeck.test.ts`: 같은 식사 시간·시드에서 같은 20종 덱 재현
- `tests/menuVisualPreload.test.ts`: 20종 부분 로드, 동일 메뉴 요청 중복 제거, 실패 후 재시도
- `npm run typecheck`, 관련 단위 테스트, 전체 단위 테스트, 프로덕션 빌드: 통과

### 실제 게임 50종 전수 QA

- `tests/e2e/food-library-qa.spec.ts`가 50개 메뉴 각각을 실제 Phaser 첫 라운드로 고정해 이미지 텍스처, 128×128 알파 마스크, 원본 비율 표시 크기, 베기 중심과 포획 중심을 검증한다.
- PowerShell에서 `$env:FOOD_LIBRARY_QA='1'; npx.cmd playwright test tests/e2e/food-library-qa.spec.ts --project=desktop-chromium` 실행 결과 50종 모두 통과했다.
- 각 토큰의 실제 게임 화면 50장을 `.codex/food-game-screens/`에 저장하고 연락 시트와 JSON 보고서를 생성했다.
- 알파 32 가중 면적을 전수 계산한 결과 빈 마스크·중앙선 완전 미스·심각한 분리 자산은 없었다.
- 파스타·떡볶이·보쌈·감자탕은 음식 질량이 명목 중심에서 치우친 측정값을 바탕으로 이미지를 재생성하지 않고 표시·알파 판정·포획 중심을 함께 이동했다. 보정 후 네 자산의 명목 중심 가로·세로 베기 점수는 약 98.3~99.6점이다.
- 포획 반경을 확대하지 않고 음식별 오프셋만 포획 중심에 동일하게 적용해 손가락 판정과 보이는 음식 위치를 일치시켰다.
- 판정 범위로 오해될 수 있던 원형 색상 글로우와 타원 그림자를 제거하고, 같은 음식 WebP를 검게 tint한 알파 그림자 2겹으로 교체했다. 그림자는 실제 음식의 투명 외곽을 그대로 따른다.
- WebGL에서는 낮은 불투명도 0.07·0.16 그림자를 사용하고, tint를 지원하지 않는 Canvas fallback에서는 그림자를 숨겨 흐린 음식 복제 잔상이 생기지 않게 했다.
- 50종 실제 Phaser 컨테이너 검사에서 음식마다 `Ellipse` 0개, 같은 음식 텍스처 `Image` 3개(그림자 2개·원본 1개), `alpha-shadow` 50/50을 확인했다.
- 홈에서는 음식 이미지를 받지 않고, 게임 시작 후 실제 덱 20종만 요청하는 네트워크 회귀 테스트도 통과했다.

자동화 검수로 50종의 등록·표시·판정 중심은 확인했다. 실제 모바일에서의 손가락 가림과 음식별 체감 크기는 최종 배포 전 실기기 플레이로 한 차례 더 확인하며, 필요한 경우 이미지 원본 대신 표시 오프셋·크기만 조정한다.

## 출처·권리 기록

- 음식 이미지 50종은 모두 이 프로젝트를 위해 Codex 내장 ImageGen으로 직접 생성했으며 제3자 음식 이미지를 사용하지 않았다.
- 생성 시안의 사람 선별·교정 지시, 로컬 후처리, 실제 사용 위치를 이 문서와 선행 이미지 로그에 기록했다.
- 사용 조건 근거는 `docs/evidence/asset-licenses.md`와 [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/) Content 항목 확인 기록을 따른다.
- 게임 실행 중 생성형 AI를 호출하지 않으며 생성 원본의 배경은 최종 WebP에서 제거했다.

## 연결된 선행 로그

- `2026-08-01-food-visual-slice.md`
- `2026-08-08-food-action-sticker-v2.md`
- `2026-08-08-alpha-silhouette-food-batch.md`
- `2026-08-08-appetizing-action-silhouettes.md`
