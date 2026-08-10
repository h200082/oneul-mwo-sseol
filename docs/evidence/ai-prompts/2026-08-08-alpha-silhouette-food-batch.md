# 실제 음식 실루엣 판정과 비원형 음식 6종 확장

- 작업일: 2026-08-08
- 사용 도구: Codex, Codex 내장 ImageGen, 공식 `remove_chroma_key.py`, Pillow
- 목적: 음식이 아닌 고정 원을 베던 임시 판정을 제거하고, 그림의 실제 불투명 면적을 점수에 반영하면서 맛있고 서로 다른 실루엣의 대표 음식을 확장

## 사람의 문제 정의와 결정

초기 프로토타입은 이미지가 없는 메뉴 45종도 같은 조작 난이도로 검증하고 원의 분할 면적을 안정적으로 계산하기 위해 반지름 64px 공통 원을 사용했다. 비원형 치킨과 라면 v2를 적용한 뒤에는 보이는 그림과 성공 범위가 달라지는 문제가 더 커졌다. 사용자는 “그림 그대로의 모습에 판정되어야 하며 다양한 음식을 베는 행위가 점수로 전해져야 한다”고 결정했다.

이에 다음 원칙을 확정했다.

- 베기 성공과 점수는 음식 WebP의 알파 실루엣을 사용한다.
- 투명 여백·구멍·분리된 조각 사이의 빈 공간은 베기로 인정하지 않는다.
- 선 양쪽 알파 가중 면적 중 작은 쪽 비율에 200을 곱해 기존 0~100점 체계를 유지한다.
- 선 위 픽셀은 양쪽에 절반씩 배분하고, 1% 미만의 아주 작은 조각과 2px 미만 접촉은 접선 노이즈로 거부한다.
- 모바일 입력은 양끝 최대 32px 보정과 3.5px 접촉 오차를 유지하되, 보정 후 선분이 실제 실루엣의 양 끝을 덮어야 한다.
- 포획은 조작 피로를 줄이기 위해 기존의 넓은 길게 누르기 판정을 유지한다.
- 이미지나 마스크 읽기에 실패한 메뉴만 기존 원 판정으로 안전하게 대체한다.

## Codex 주요 지시

```text
비원형 이미지의 실제 불투명 픽셀을 기준으로 베기 성공과 면적 점수를 계산한다. 투명한 모서리나 음식 조각 사이의 공기를 가른 선이 100점이 되면 안 된다. 이동하는 음식의 실제 접촉은 토큰 로컬 경로로 판정하고, 화면에서 사용자가 그은 방향은 절단선 방향으로 유지한다. 이미지 로드·Canvas 읽기 실패와 이미지 없는 메뉴는 기존 원형 판정으로 게임을 계속할 수 있어야 한다. 길게 누르기 포획 범위는 이번 변경에서 좁히지 않는다.
```

## 이미지 공통 프롬프트 규격

아래 6개 프롬프트는 모두 Codex 내장 ImageGen에 각각 한 번씩 입력했다. 각 프롬프트에는 다음 공통 조건을 포함했다.

```text
Use case: stylized-concept
Asset type: transparent mobile arcade game food sprite, final size 512×512
Style: polished hand-painted 2D casual arcade icon, bold simplified forms, crisp dark inner lines, thick continuous warm-cream outer outline, warm upper-left lighting, subtle dimensional shading, high color contrast, not photorealistic
Background: perfectly flat uniform solid #00ff00 chroma-key background, no gradient or texture
Composition: dense opaque core through the canvas center; major food forms remain readable at 112px and 47px
Constraints: one connected subject; no detached garnish, hands, people, text, logo, watermark, packaging, cast shadow, glow, or translucent edge effects
```

### 갈비탕 `galbitang.webp`

```text
Two thick meaty bone-in Korean beef short ribs rise left and right in a broad Y shape from one compact low brass soup pot. Both ribs overlap the broth and central beef mass so the subject is one connected silhouette. Show clear warm amber broth, glossy tender brown beef, large ivory bone tips, one broad glass-noodle bundle, and restrained dark-olive scallion pieces. Emphasize juicy meat, clear rich broth, warm highlights, and a freshly served appearance. Avoid a round-bowl-dominant silhouette, thin noodle hairs, steam, sauce droplets, plate, or spoon.
```

### 오므라이스 `omurice.webp`

```text
One plump buttery Korean omurice folds into a curved crescent. The omelette is split open near the center and one thick egg flap bends upward to the right, exposing a generous mound of glossy orange fried rice. The egg and rice define one connected hooked-comet silhouette. Show soft golden folds, moist fried rice, a few large carrot and pea accents, and one bold ketchup ribbon contained on the egg. Avoid a plain oval mound, plate, utensils, detached rice grains, or ketchup splashes.
```

### 김밥 `gimbap.webp`

```text
One thick intact gimbap roll runs diagonally from lower-left to upper-right while three thick cut slices fan outward from its upper end. Every slice overlaps the main roll or another slice so the complete subject stays connected. Show glossy dark navy seaweed, a warm ivory rice ring, and large filling bands of golden egg, yellow pickled radish, orange carrot, dark-olive spinach, and brown beef. Avoid a plate, chopsticks, separated slices, sesame specks, or loose rice grains.
```

### 샌드위치 `sandwich.webp`

```text
Two thick triangular Korean-style sandwich halves lean into each other as asymmetrical twin peaks, with one broad lower-left half and one higher upper-right half joined by a large central overlap. Show golden toast, bold lettuce, juicy tomato, melted cheddar, thick egg, and ham in a few large readable layers. Emphasize crisp toast edges, melted cheese, moist tomato, and a generous cross-section. Avoid a basket, toothpick, loose crumbs, separate lettuce leaves, or excessive tiny layers.
```

### 떡볶이 `tteokbokki.webp`

```text
A compact shallow rectangular Korean street-food tray holds a dense mound of plump tteokbokki. One diagonal skewer carrying three large sauce-coated rice cakes rises across and overlaps the tray; the thick rice cakes, not the wooden skewer, form the main ascending silhouette. Show deep glossy chili-red sauce, ivory rice-cake ends, one broad folded fish-cake ribbon, and restrained scallion. Avoid a round bowl, floating rice cakes, bare-skewer dominance, sauce splashes, or steam.
```

### 집밥 백반 `home-style-baekban.webp`

```text
A compact low trapezoid wooden tray connects one large rice bowl at the front, one soup bowl at upper-left, one generous bulgogi dish at upper-right, and overlapping side dishes of rolled egg and kimchi. All dishes overlap the tray or each other to form one broad scalloped crown silhouette. Show fluffy rice, warm red soup, glossy bulgogi, golden rolled egg, vivid kimchi, and restrained namul in large readable color blocks. Avoid disconnected miniature bowls, a circular banquet layout, empty dishware dominance, or chopsticks.
```

## 사람의 선별·후처리·검증

1. 생성 결과에서 음식이 맛있게 보이는 윤기·수분감·바삭함과 서로 다른 외곽을 사람이 확인했다.
2. 공식 도구의 border 자동 키, soft matte, 투명 임계값 12, 불투명 임계값 220, despill을 적용했다.
3. 알파 외곽을 비율 유지해 최대 440×440px로 맞추고 512×512 투명 캔버스 중앙에 배치했다.
4. WebP 품질 92, method 6으로 저장했다. 최종 파일은 61,032~78,844B이고 모두 네 모서리 알파가 0이다.
5. 각 에셋의 알파 32 이상 픽셀을 8방향 연결 요소로 검사했으며 최대 연결 요소 비율은 모두 100%였다. 불투명 네온 그린 픽셀은 모두 0개였다.
6. `galbitang`, `omurice`, `gimbap`, `sandwich`, `tteokbokki`, `home-style-baekban` 메뉴에 연결했다.

## 구현 및 자동 검증

- `src/domain/alphaSilhouette.ts`: 알파 마스크 생성, 배치 변환, 실제 픽셀 접촉, 선 양쪽 가중 면적, 실제 실루엣 chord 계산
- `src/domain/silhouetteGestureClassifier.ts`: 짧은 선·곡선·폐곡선 거부, strict/extended 선분, 실루엣 전체 덮기, 화면 의도 방향 유지
- `src/data/menuVisuals.ts`: 이미지 decode 뒤 128×128 가중 알파 마스크를 한 번 생성하고 캐시
- `src/game/scenes/PrototypeScene.ts`: 이미지가 있으면 `alpha-mask`, 없거나 추출 실패면 `circle-fallback`; 포획은 기존 범위 유지
- 단위 테스트 27개: 50:50, 편심, 오목형, 분리형 빈 공간, 얇은 부속, threshold, offset/scale, strict/extended, same-side stroke, 짧은 선·곡선·루프
- Playwright: 치킨의 기존 원 안 투명 모서리 스와이프는 라운드를 소비하지 않고, 실제 치킨 몸통 스와이프는 성공함을 검증

## 남은 범위

- 이번 변경으로 활성 이미지는 11종이며, 나머지 39종은 원형 판정 폴백을 사용한다.
- 50종 전체를 연결하기 전 프리로드를 현재 판의 20개 덱으로 제한한다.
- 같은 메뉴의 다중 이미지 변형은 방 시드·라운드 번호로 모든 참가자가 같은 그림을 선택하도록 별도 데이터 구조를 추가한다.
