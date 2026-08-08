# 식욕과 인지도를 우선한 동작형 음식 실루엣 v2

## 작업 목적

- 기존 6종은 외곽 형태를 바꾸는 데 집중해도 정사각 캔버스와 중앙 밀집 구도 때문에 축소 시 다시 둥근 아이콘처럼 보였다.
- 첫 재시도에서 비율을 과도하게 강제한 갈비탕 Y형, 초승달 오므라이스, 창 모양 통김밥은 비원형성은 높았지만 음식 인지도와 식욕이 떨어져 사람 검수에서 폐기했다.
- 최종본은 우선순위를 `음식 인지도 → 맛있음 → 자연스러운 외곽 다양성`으로 바꾸고, 음식 자체를 억지로 늘이지 않았다.
- 집어 올리기, 치즈풀, 갈라진 단면, 흘러나온 밥, 길게 펼친 실제 상차림처럼 식사 과정에서 생기는 형태를 사용했다.

## 사용 도구와 처리 방식

- 생성 모드: Codex 내장 ImageGen
- 배경: 단색 `#00ff00` 크로마키
- 배경 제거: 공식 `remove_chroma_key.py`의 `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`
- 후처리: 알파 16 이상 외곽을 자르고 1.5% 투명 여백을 더한 뒤, 원본 비율을 유지하며 긴 변만 512px로 축소하고 WebP quality 88로 저장
- 판정: 화면에 표시된 WebP의 알파 실루엣을 128px 마스크로 변환해 실제 보이는 면적을 기준으로 베기 점수를 계산

## 공통 생성 지시

```text
Use case: stylized-concept
Asset type: transparent-background arcade game food sprite
Priority order: first instantly recognizable as the named food, second intensely mouthwatering, third a naturally irregular silhouette.
Style/medium: polished hand-painted 3D arcade game illustration, appetizing studio food-lighting cues, bold warm cream outer rim, saturated natural food colors, crisp large details readable at 128px.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local removal.
Constraints: preserve normal food proportions; create asymmetry through a real eating or serving action; food must occupy at least 75% of the visible subject; utensils and action effects stay secondary; no compact badge, giant utensil, detached garnish, steam, shadow, floor plane, text, logo, or watermark; background must be uniform #00ff00 and must not appear in the subject.
```

## 최종 프롬프트 세트

### 김밥

```text
Five familiar plump Korean gimbap slices arranged in a loose diagonal cascade on a very narrow kraft paper liner. Wooden chopsticks naturally lift one final slice slightly toward the upper right, clearly revealing its colorful round cross-section. Show normal short chunky cylinders with glossy black-green seaweed, pearly rice, yellow pickled radish, golden egg, orange carrot, green spinach, and pink ham. Each cut face must look moist, freshly sliced, and brushed with sesame oil. Create a 1.45–1.65:1 diagonal silhouette through the eating action, never by stretching the food. No unnaturally long roll, circular plate, radial arrangement, sushi topping, giant chopsticks, or detached sesame seeds.
```

- 생성 원본: `exec-30dfe6f9-495b-4ed3-a437-8693cfc426c8.png`
- 게임 자산: `src/assets/food/gimbap-v2.webp` (512×341)

### 떡볶이

```text
A familiar serving of glossy Korean tteokbokki in a small shallow rectangular street-food paper tray. Show seven to nine plump cylindrical rice cakes in vivid glossy gochujang-red sauce, one folded fish cake, and a few attached green-onion rings. A small fork lifts exactly one sauce-coated rice cake toward the upper right, with three thick mozzarella strands connecting it back to the tray. The red rice cakes stay dominant and unmistakable; the lift action creates a naturally tall 1.3–1.5:1 silhouette. No skewer tower, stacked spear, noodle-like rice cakes, giant fork, round bowl, or cheese blanket hiding the food.
```

- 생성 원본: `exec-840a4c11-901f-4831-9152-65ee3c6e0475.png`
- 게임 자산: `src/assets/food/tteokbokki-v2.webp` (394×512)

### 샌드위치

```text
Two familiar thick toasted sandwich halves in a natural cheese-pull eating moment. One half rests at the lower left and the other is lifted toward the upper right, connected by four thick strands of melted cheese. Clearly show crisp golden toast, green lettuce, red tomato, folded ham, fluffy egg, and molten cheese. Keep both halves at normal proportions and make the separation create a 1.4–1.6:1 diagonal silhouette. No stretched spear-shaped bread, symmetrical bow-tie, square stack, hamburger bun, submarine roll, circular plate, or hair-thin cheese.
```

- 생성 원본: `exec-46b3d932-2ccd-4538-818a-e34c99d85b18.png`
- 게임 자산: `src/assets/food/sandwich-v2.webp` (512×330)

### 갈비탕

```text
A comforting Korean beef short-rib soup captured as one meaty rib is lifted from the broth with small silver tongs. Show a compact dark ttukbaegi at three-quarter angle filled with clear glossy amber broth, two tender bone-in beef ribs, glass noodles, sliced green onion, egg ribbons, and daikon. One succulent rib rises diagonally toward the upper right while the full soup bowl anchors the lower left. The food occupies at least 80% and the tongs less than 15%. No antler-like bones, stretched ribs, empty soup base, giant utensil, top-down circular bowl, or floating ingredients.
```

- 생성 원본: `exec-9b49b0f7-3ef4-4896-97ae-99f1f1ec04e7.png`
- 게임 자산: `src/assets/food/galbitang-v2.webp` (438×512)

### 오므라이스

```text
A classic golden Korean-style omurice at the moment its soft omelet has been cut open and tomato fried rice spills toward the lower right, while a small spoon lifts one bite toward the upper left. Keep a familiar soft golden omelet with browned folds, a glossy ketchup zigzag, and a wide V-shaped opening revealing moist orange rice, onion, carrot, and ham. A narrow boat-shaped ceramic plate supports only the lower edge. Keep the normal food body dominant and create a 1.35–1.55:1 zigzag outline with the opened seam, spilled rice, and lifted bite. No crescent spear, stretched banana shape, closed plain oval, giant spoon, or large circular plate.
```

- 생성 원본: `exec-5166627d-4b4e-4601-8df2-b9f83e28c76e.png`
- 게임 자산: `src/assets/food/omurice-v2.webp` (512×332)

### 가정식 백반

```text
A generous Korean home-style baekban set arranged across one long low dark-walnut serving board with pointed boat-shaped ends. From left to right show glossy white rice, compact doenjang soup, grilled golden mackerel, bright kimchi, seasoned spinach, rolled egg, and savory bulgogi. Keep the dishes in one shallow left-to-right arrangement, with a spoon and chopsticks resting along one edge. Use normal bowls but make the complete table setting a wide, low 1.7–1.9:1 subject instead of a radial cluster. No circular dining table, compact badge, stacked tower, empty tray, giant utensils, or indistinguishable side dishes.
```

- 생성 원본: `exec-0ada0ee2-1352-4640-a4b4-9e77227136c3.png`
- 게임 자산: `src/assets/food/home-style-baekban-v2.webp` (512×175)

## 사람 검수와 결과

- 최종 6종 모두 긴 변 512px이며 정사각형이 아니다.
- 초록색 잔여 픽셀은 알파 16 이상 기준 0개다.
- 실제 캔버스 비율은 세로형 2종, 가로형 4종으로 나뉜다.
- 게임은 각 파일의 가로세로 비율을 `contain`으로 보존하고, 알파 외곽을 그대로 베기 면적과 명중 판정에 사용한다.
- 원본 음식 인지도를 훼손한 첫 재시도는 저장소 자산과 게임 매핑에 포함하지 않았다.
