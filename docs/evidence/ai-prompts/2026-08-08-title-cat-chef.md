# 고양이 셰프 타이틀 화면

- 날짜: 2026-08-08
- 도구·모델: OpenAI Codex 내장 ImageGen
- 작업 목적: 첫 접속에서 게임 장르와 핵심 조작을 즉시 전달하는 오리지널 타이틀 화면 제작
- 관련 파일: `src/assets/title/chef-cat-v1.webp`, `src/assets/title/title-food-*.webp`, `src/app/AppController.ts`, `src/app/app.css`

> 제목 변경 기록: 아래 프롬프트는 제작 당시 가제 `오늘 뭐 썰?`을 사용한 원문이다. 2026-08-10 최종 게임 제목을 `뭐 먹을 거냥?`으로 확정했으며, 이미지 자산에는 글자가 없어 재생성하지 않고 런타임 텍스트만 변경했다.

## 사용자 요구

게임 제목 `오늘 뭐 썰?`과 함께 귀여운 고양이 요리사가 나이프와 포크를 들고, 하늘에서 내려오는 음식을 가르는 장면을 첫 화면에 보여준다. `게임 시작`을 누르면 기존의 바로 시작하기·게임 방법·친구 방 참가 메뉴로 이동한다.

## 대표 이미지 생성 프롬프트

```text
Use case: stylized-concept
Asset type: mobile casual arcade game mascot character for a title screen
Primary request: Create one original cute orange-and-cream cat chef in a lively mid-air slicing pose, ready to cut falling food. The character holds exactly one compact kitchen chef knife naturally in the right paw and exactly one dinner fork naturally in the left paw. The pose should feel fast, playful, confident, and readable at small mobile size.
Subject: full body visible, large expressive eyes, delighted determined smile, fluffy but clean orange-and-cream fur, oversized white chef toque, warm ivory double-breasted chef jacket and short apron, curled tail contributing to the action silhouette. Natural limb anatomy; the knife and fork must be clearly separate and not intersect the body.
Style/medium: polished high-end 2.5D casual mobile game illustration, soft dimensional shading, crisp silhouette, charming arcade mascot, visually compatible with appetizing semi-realistic food illustrations. Not flat clip art and not photorealistic.
Composition/framing: centered full-body isolated character, diagonal upward slicing action from lower-left to upper-right, generous empty padding around ears, toque, utensils, paws, and tail. No cropped parts.
Lighting/mood: warm cheerful arcade energy, subtle rim lighting only on the character.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Constraints: one cat only; exactly two visible arms and two visible legs; exactly one knife and one fork; anatomically natural grip; crisp edges; no cast shadow; no contact shadow; no food; no plates; no text; no title; no logo; no watermark. Do not use #00ff00 anywhere in the character or utensils.
Avoid: extra limbs or fingers, duplicated utensils, crossed utensils, oversized threatening weapon, gore, aggression, uncanny expression, babyish toddler proportions, chef standing still, circular badge framing.
```

## 후처리와 사람의 검토

- 단색 크로마키 배경을 투명 알파로 제거하고 녹색 번짐을 완화했다.
- 캐릭터의 두 팔·두 다리, 나이프 1개, 포크 1개, 자연스러운 그립과 표정을 확인했다.
- 투명 WebP로 변환해 1122×1402px, 약 94KB로 최적화했다.
- 타이틀 음식은 프로젝트에서 직접 생성한 승인 음식 4종을 224px 이하 전용 WebP로 축소해 게임용 50종 전체 선로딩과 분리했다.
- 게임 제목은 이미지에 합성하지 않고 HTML 텍스트로 표시해 가독성과 접근성을 유지했다.
- Pixel 7과 320×568 화면에서 제목·캐릭터·시작 버튼의 첫 뷰포트 노출을 확인하고, 최종 캡처를 `docs/evidence/screenshots/title-screen-320x568.png`에 보관했다.

## 화면·동작 설계

- 고양이 셰프는 짧은 도약과 베기 동작을 반복한다.
- 라면·김밥·떡볶이·피자가 서로 다른 속도와 회전으로 낙하한다.
- 칼날 궤적과 작은 스파크는 장식으로만 사용하고 입력을 막지 않는다.
- 동작 감소 설정에서는 반복 애니메이션을 제거한다.
- QR 초대 링크는 타이틀을 거치지 않고 기존 참가 화면으로 바로 이동한다.
- 브라우저 자동 재생 정책 때문에 `게임 시작` 탭으로 오디오를 해제하지만, BGM은 실제 플레이가 시작될 때만 재생한다.

## 출처와 라이선스

고양이 셰프와 타이틀 음식은 모두 이 프로젝트를 위해 AI 생성·후처리한 자체 자료다. 제3자 캐릭터·게임 화면·상표·외부 이미지 에셋을 사용하지 않았다.
