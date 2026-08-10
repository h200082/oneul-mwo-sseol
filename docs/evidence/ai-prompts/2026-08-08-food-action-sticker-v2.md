# Food Action Sticker v2 비원형 음식 자산

- 작업일: 2026-08-08
- 목적: 접시·그릇이 만드는 반복적인 원형 토큰을 줄이고, 음식마다 다른 베기 실루엣과 동작성을 제공
- 사용 도구: Codex 내장 ImageGen, 공식 `remove_chroma_key.py`, Pillow
- 이번 활성 교체: `fried-chicken`, `ramyeon`

## 공통 아트 규격

- 512×512 RGBA WebP, 품질 76, 파일당 120KB 이하
- 고채도 2D 모바일 아케이드 음식 스티커, 짙은 내부선과 따뜻한 크림색 외곽선
- 기본 30~45도 상단 시점, 왼쪽 위 조명, 단순하고 선명한 내부 음영
- 원형 접시·그릇이 실루엣을 지배하지 않게 하고 음식 본체와 동작 도구가 외곽을 형성
- 최종 게임 표시 112px와 결과 카드 68px·47px에서 음식 종류와 동작이 식별되어야 함
- 이 자산을 생성한 시점의 임시 판정은 반지름 64px 원이어서 음식 본체와 무게중심을 중앙에 두었다. 같은 날 후속 작업에서 실제 알파 실루엣 판정으로 교체했다.
- 손·사람·문자·상표·포장·워터마크·외부 그림자·글로우 금지

## 생성 프롬프트

### 치킨

```text
Use case: stylized-concept
Asset type: mobile arcade game food sprite
Primary request: one large crispy chicken drumstick and one crispy chicken wing crossing diagonally in an X shape; the edible pieces, not a plate or bowl, define the silhouette
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local removal
Style/medium: polished 2D hand-painted casual arcade icon, bold simplified forms, thick warm cream outer outline, subtle inner shading
Composition/framing: centered three-quarter top-down view, non-circular silhouette, food fills about 78% of the square canvas and remains thick at 128×112px
Constraints: uniform background, crisp edges, no shadow, plate, bowl, basket, text, logo, watermark, packaging, extra detached crumbs, or photorealism
```

### 라면

```text
Use case: stylized-concept
Asset type: mobile arcade game food sprite
Primary request: a compact yellow Korean-style cooking pot at the bottom while thick dark chopsticks lift one broad curtain of wavy ramyeon high above it; the lift creates the main silhouette
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local removal
Subject: yellow two-handle pot, orange-red broth, one half egg, one seaweed patch, cohesive thick noodle bundle connected to the pot
Style/medium: polished 2D hand-painted casual arcade icon, bold simplified forms, thick warm cream outer outline, subtle inner shading
Composition/framing: centered three-quarter top-down view, diagonal energy, overall aspect ratio at most 1.4, readable at 128×112px
Constraints: uniform background, crisp edges, no shadow, plain round-bowl composition, thin noodle hairs, floating ingredients, steam, hands, people, text, logo, watermark, or packaging
```

## 사람의 선별과 후처리

1. 치킨은 접시 없이 바삭한 부위가 교차하는 대각선 실루엣, 라면은 냄비·면 커튼·젓가락이 이어진 세로 실루엣을 선별했다.
2. 공식 배경 제거 도구의 border 자동 키, soft matte, 투명 임계값 12, 불투명 임계값 220, despill을 적용했다.
3. 알파 경계만 크롭한 뒤 512×512 투명 캔버스의 최대 464×440 영역에 비율을 유지해 배치했다. 좌우 최소 24px, 아래 48px 여백을 확보했다.
4. WebP 품질 76·method 6·exact alpha로 저장했다.
5. 최종 파일은 `fried-chicken-v2.webp` 38,500B, `ramyeon-v2.webp` 33,522B이며 모두 512×512, 네 모서리 알파 0이다.
6. 112px 게임 토큰, 68px·47px 결과 카드 축소본에서 실루엣을 사람이 직접 확인했다.
7. 기존 원본은 비교·복구를 위해 보존하고 런타임 매핑만 v2로 변경했다.

## 남은 검증과 확장

- 실제 게임의 중앙·대각선 베기, 길게 누르기 포획, 두 조각 마스크와 투명 모서리 무효 처리는 후속 알파 실루엣 작업에서 자동 검증했다.
- 대표 8개 실루엣군을 검증한 뒤 나머지 메뉴로 확장한다.
- 같은 메뉴의 다중 이미지는 방 시드와 라운드 번호로 모든 참가자가 동일 변형을 보도록 데이터 구조를 먼저 확장한다.
- 50종 연결 전 전체 프리로드를 해당 판의 20개 덱 한정 프리로드로 변경한다.
