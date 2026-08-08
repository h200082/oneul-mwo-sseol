# 외부 에셋 및 오픈소스 출처 기록

에셋이나 라이브러리를 프로젝트에 추가하는 시점에 바로 기록합니다. 무료 자료도 반드시 원문 URL과 라이선스를 확인합니다.

현재 프로토타입에는 제3자 이미지·사운드·음성·폰트를 포함하지 않았다. 활성 대표 음식 5종과 교체 전 원본 2종은 Codex 내장 ImageGen으로 이 프로젝트를 위해 직접 생성했으며, 프롬프트와 사람의 검토·후처리를 아래에 기록한다. 직접 의존성 버전은 `package.json`과 `package-lock.json`, 라이선스명은 설치된 패키지 메타데이터로 확인했으며 제출 버전 동결 후 다시 점검한다.

| 구분 | 이름·파일 | 사용 위치 | 원문 URL | 제작자 | 라이선스 | 상업적 이용 | 수정·재배포 조건 | 확인일 |
|---|---|---|---|---|---|---|---|---|
| 게임 엔진 | Phaser 4.2.1 | 브라우저 게임 런타임 | https://github.com/phaserjs/phaser | Phaser Studio | MIT | 가능 | 저작권·라이선스 고지 유지 | 2026-07-27 |
| 빌드 도구 | Vite 8.1.5 | 개발 서버·프로덕션 빌드 | https://github.com/vitejs/vite | Vite contributors | MIT | 가능 | 저작권·라이선스 고지 유지 | 2026-07-27 |
| 언어·컴파일러 | TypeScript 7.0.2 | 타입 검사·JavaScript 변환 | https://github.com/microsoft/TypeScript | Microsoft | Apache-2.0 | 가능 | 라이선스·NOTICE 조건 및 변경 고지 준수 | 2026-07-27 |
| 테스트 도구 | Vitest 4.1.10 | 단위 테스트 | https://github.com/vitest-dev/vitest | Vitest contributors | MIT | 가능 | 저작권·라이선스 고지 유지 | 2026-07-27 |
| 테스트 도구 | Playwright Test 1.62.0 | 브라우저 E2E 테스트 | https://github.com/microsoft/playwright | Microsoft | Apache-2.0 | 가능 | 라이선스·NOTICE 조건 및 변경 고지 준수 | 2026-07-27 |
| 타입 정의 | `@types/node` 24.13.3 | 개발 타입 검사 | https://github.com/DefinitelyTyped/DefinitelyTyped | DefinitelyTyped contributors | MIT | 가능 | 저작권·라이선스 고지 유지 | 2026-07-27 |
| QR 생성 | qrcode 1.5.4 | 방 초대 QR PNG data URL 생성 | https://github.com/soldair/node-qrcode | node-qrcode contributors | MIT | 가능 | 저작권·라이선스 고지 유지 | 2026-07-27 |
| 타입 정의 | `@types/qrcode` 1.5.6 | QR 생성 코드 타입 검사 | https://github.com/DefinitelyTyped/DefinitelyTyped | DefinitelyTyped contributors | MIT | 가능 | 저작권·라이선스 고지 유지 | 2026-07-27 |
| 백엔드 SDK | Firebase JavaScript SDK 12.16.0 | 익명 인증·Cloud Firestore 방·결과 동기화 | https://github.com/firebase/firebase-js-sdk | Google LLC | Apache-2.0 | 가능 | 라이선스·NOTICE 조건 및 변경 고지 준수 | 2026-07-31 |
| 규칙 테스트 | `@firebase/rules-unit-testing` 5.0.1 | Firestore Security Rules 통합 테스트 | https://github.com/firebase/firebase-js-sdk | Google LLC | Apache-2.0 | 가능 | 라이선스·NOTICE 조건 및 변경 고지 준수 | 2026-07-31 |
| 개발 도구 | Firebase CLI 15.24.0 | 로컬 Firestore 에뮬레이터 실행 | https://github.com/firebase/firebase-tools | Google LLC | MIT | 가능 | `npx`로 고정 버전 실행, 저작권·라이선스 고지 유지 | 2026-07-31 |

## 직접 제작 또는 AI 생성 자료

| 이름·파일 | 제작 방법·도구 | 주요 입력 또는 근거 로그 | 사람의 수정 내용 | 사용 위치 |
|---|---|---|---|---|
| `public/favicon.svg` | 직접 작성한 SVG 도형 | `ai-prompts/2026-07-27-core-prototype.md` | 브라우저 표시와 경로 검증 | 브라우저 파비콘 |
| 프로토타입 도형·배경 | Phaser Graphics로 런타임 생성 | `ai-prompts/2026-07-27-core-prototype.md` | 모바일 가독성·색상·배치 조정 | 현재 게임 화면 |
| 절차형 효과음·진동 패턴 | Web Audio Oscillator·Gain과 표준 Vibration API로 런타임 직접 생성 | `ai-prompts/2026-08-05-sensory-feedback.md` | 이벤트별 음높이·길이·gain과 진동 패턴을 직접 검토하고 방 모드 볼륨 축소 | 베기·포획·놓침·카운트다운·후반·결과 피드백 |
| 방 초대 QR 이미지 | `qrcode`로 실행 중 PNG data URL 생성 | `ai-prompts/2026-07-27-room-lobby-prototype.md` | 실제 초대 URL·오류 대체 경로 검증 | 방 대기실 |
| `src/assets/food/*.webp` 활성 5종·교체 전 2종 | Codex 내장 ImageGen 생성 후 크로마키 제거·WebP 최적화 | `ai-prompts/2026-08-01-food-visual-slice.md`, `ai-prompts/2026-08-08-food-action-sticker-v2.md` | 결과 선별, 배경 제거, 512×512 정규화, 비원형 실루엣·47px 가독성·모바일 용량 검토 | 게임 토큰과 공동 결과 음식 카드 |
