# 냥손톱 도구 아이콘

- 날짜: 2026-08-10
- 도구·모델: OpenAI Codex 내장 ImageGen
- 작업 목적: 기본 베기 도구 `냥손톱`을 나타내는 오리지널 고양이 발바닥 UI 아이콘 제작
- 관련 파일: `src/assets/tools/nyang-claw-paw.webp`, `src/app/AppController.ts`, `src/app/app.css`

## 대표 이미지 생성 프롬프트

```text
Use case: stylized-concept
Asset type: game UI icon for a selectable slicing tool named Nyang Claw
Primary request: a single adorable cat paw pad icon, viewed straight-on, with a rounded cream-and-warm-orange paw silhouette and soft coral-pink toe beans and central pad. The paw should feel playful, charming, and suitable for a cheerful Korean mobile arcade food game. Suggest tiny retractable claws only through three very small polished ivory tips at the top edge, cute rather than sharp or dangerous.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal
Style/medium: polished 2.5D vector-like game UI illustration, clean shapes, subtle internal highlights, crisp silhouette, readable at 64px
Composition/framing: one centered paw, symmetrical, generous even padding, no crop
Color palette: cream, warm orange, coral pink, dark navy accents; do not use any green in the subject
Constraints: background must be one perfectly uniform #00ff00 color with no shadows, gradients, texture, reflections, floor plane, lighting variation, contact shadow, or glow; subject fully separated from background; crisp edges; no text; no border frame; no extra objects; no watermark
Avoid: realistic fur strands, photorealism, scary claws, weapons, knife, food, letters, logos
```

## 후처리와 검토

- 단색 크로마키 배경을 투명 알파로 제거하고 녹색 번짐을 완화했다.
- 투명 WebP로 저장해 1254×1254px, 약 48KB로 최적화했다.
- 네 모서리 알파값이 0인지, 부분 투명 경계가 남아 있는지, 피사체에 녹색 테두리가 보이지 않는지 확인했다.
- 체크무늬 배경에서 형태와 여백을 검수하고 도구 카드의 64px 안팎 크기에서도 발바닥과 작은 발톱이 읽히는지 확인했다.

## 출처와 라이선스

이 아이콘은 이 프로젝트를 위해 AI 생성·후처리한 자체 자료다. 제3자 캐릭터·상표·외부 이미지 에셋을 사용하지 않았다.
