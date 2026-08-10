# 음식별 고양이 나레이션 문구·기기별 설정·AI 합성 음성 최종 통합

- 날짜: 2026-08-09
- 도구·모델: OpenAI Codex
- 작업 목적: 음식별 고양이 말풍선 50종과 기기별 설정을 구현하고, 사람이 청취한 Azure AI 합성 음성 14종 중 현재 문구와 일치하는 11종을 정적 에셋으로 안전하게 통합
- 관련 파일: `src/data/menuNarrations.ts`, `src/data/menuNarrationAudioManifest.ts`, `src/assets/narration/`, `src/feedback/narrationPreference.ts`, `src/feedback/SensoryFeedback.ts`, `src/app/AppController.ts`, `src/app/GameHost.ts`, `src/game/createGame.ts`, `src/game/scenes/PrototypeScene.ts`, `scripts/narration/`, `tests/menuNarrations.test.ts`, `tests/narrationPreference.test.ts`, `tests/gameHostNarrationPrepare.test.ts`, `tests/browserSensoryFeedbackOutput.test.ts`, `tests/sensoryFeedback.test.ts`, `tests/azureSpeechBatch.test.ts`, `tests/azureExpressivePilot.test.ts`, `tests/azureExpressiveRetakes.test.ts`, `tests/azureRamyeonSoftRetakes.test.ts`, `tests/e2e/narration-preference.spec.ts`, `tests/e2e/narration-audio.spec.ts`

## 사용자 요구와 AI 활용 범위

- MVP 음식 50종마다 짧고 재미있는 전용 나레이션을 제공한다.
- 참가자 전원이 같은 방에서 플레이하더라도 방장 기기에만 재생하지 않고, 각 기기 사용자가 자신의 나레이션 설정을 자유롭게 조절한다.
- 음성을 끈 사용자도 내용을 알 수 있도록 같은 문구를 게임 화면 상단의 작은 고양이 말풍선으로 표시한다.
- 기존 제안 중 자연스럽지 않거나 특정 제3자의 유명 문구·말투를 직접 연상시키는 표현을 교정한다.
- 실제 TTS 파일 제작과 유료 API 호출은 별도 승인 없이는 진행하지 않는 안전 경계를 먼저 적용했고, 이후 사용자의 명시적 승인 아래 후보 생성·청취·최종 선정을 수행했다.

AI는 사용자 초안의 의도와 음식별 특징을 바탕으로 문구를 다듬고, 짧은 라운드 속도에 맞는 길이·톤·대체 문구를 구조화했다. 또한 자막, 기기별 설정, 표현형 음성 후보 제작, 승인 파일의 덱 단위 선로딩과 재생 제어를 제안·구현했고, 최종 반영 여부는 사람이 직접 듣고 결정했다.

## 50종 문구 데이터

`MENU_CATALOG`의 음식 50종과 일대일 대응하는 `MENU_NARRATIONS`를 만들었다. 각 항목은 다음 정보를 가진다.

- `menuId`: 음식 카탈로그와 연결되는 식별자
- `text`: 게임에 실제 표시할 기본 문구
- `tone`: `playful`, `alert`, `deadpan`, `epic` 중 하나
- `alternatives`: 추후 희귀 대사 기능 등에 사용할 수 있는 대체 문구 2개 이상
- `audioUrl`: 승인된 사전 생성 음성 파일의 경로. 현재 11종은 정적 MP3를 연결하고 나머지 39종은 `null`

모든 음식은 말풍선 자막을 표시한다. 현재 김치찌개·부대찌개·육개장·라면 4종과 첫 확장 배치의 된장찌개·순두부찌개·감자탕·설렁탕·갈비탕·삼계탕·콩나물국밥 7종, 총 11종만 승인된 정적 MP3를 재생할 수 있다. 파스타·샤부샤부·곰탕은 음원 생성·청취 이력은 보존하지만 후속 기본 문구가 달라져 런타임 연결을 해제했다. 나머지 39종은 `audioUrl: null`인 자막 전용 항목으로 동작한다.

## 현재 기본 문구 샘플과 후속 교정

초기 사용자 검토 대상과 후속 교정 대상을 현재 카탈로그 기준으로 다시 고정했다.

| 음식 | 현재 기본 문구 |
|---|---|
| 김치찌개 | 밥 한 공기론 합의 불가! |
| 설렁탕 | 설렁탕 국밥계 탱커 등장! |
| 콩나물국밥 | 한 숟갈에 인간 복귀! |
| 순대국 | 순대국 든든 버프 풀충전! |
| 청국장 | 청국장 향부터 어그로 만렙! |
| 초밥 | 그릇은 쌓이고 통장은 비어간다! |
| 칼국수 | 칼은 이름에만, 국물은 따뜻! |
| 냉면 | 중요한 건 꺾이지 않는 면발! |
| 짜장면 | 짜장면 등장, 젓가락 급가속! |
| 떡볶이 | 떡볶이 포획! 쿨피스 지원 요청! |
| 삼겹살 | 누가 고기 굽는 소리를 내었는가! |
| 갈비구이 | 체면 내려놓고 뼈를 들어라! |
| 피자 | 피자 먹고 팔자 피자! |
| 닭한마리 | 메뉴 이름이 설명서다! |

제출 전 19개 기본 문구를 추가 교정했다. 정확한 현재 문구 계약은 `src/data/menuNarrations.ts`와 `tests/menuNarrations.test.ts`에 함께 고정했다. 이 과정에서 파스타·샤부샤부·곰탕의 기존 MP3는 새 자막과 일치하지 않아 retired 처리했고, 불고기덮밥을 포함한 historical Azure 생성기는 현재 카탈로그로 비용·네트워크·파일 쓰기 전에 재합성을 거부한다.

나머지 문구도 음식 이름과 먹는 상황에서 나온 짧은 언어유희를 중심으로 작성했다. 특정 방송·영화·광고 등의 문장을 그대로 인용하지 않았고, 실존 인물이나 캐릭터의 목소리를 흉내 내도록 지시하지 않았다. 알아볼 수 있는 유명 문구와 지나치게 가까운 후보는 기본 문구와 대체 문구에서 제거하거나 독자적인 표현으로 바꿨다.

## 기기별 설정과 항상 표시되는 자막

- 나레이션 사용 여부는 Firebase 방 상태가 아니라 각 브라우저의 `localStorage`에 저장한다. 따라서 같은 방의 참가자도 서로 다른 설정을 사용할 수 있다.
- 기본값은 켜짐이며, 홈 우상단의 말풍선 아이콘과 게임 중 `VOX` 버튼에서 전환할 수 있다.
- 마스터 효과음이 꺼져 있으면 실제 나레이션 재생도 꺼지지만, 사용자가 선택한 나레이션 설정 자체는 보존된다.
- 음식이 등장하면 오디오 설정과 관계없이 같은 문구가 고양이 말풍선에 표시되고, 일정 시간 뒤 페이드아웃된다.
- 게임 결과, 홈 복귀, 장면 종료 시 진행 중인 나레이션과 자막 타이머를 정리한다.

방 문서 구조·Firestore 보안 규칙·참가자 준비 절차는 변경하지 않았다.

## 정적 음원 제작·런타임 구조

브라우저에서 실시간 TTS를 호출하지 않고, 검수 완료된 짧은 MP3만 정적 에셋으로 배포한다.

- 현재 20종 덱에 포함된 음식 중 `audioUrl`이 있는 항목만 게임 시작 전에 선로딩한다.
- 불러오기·디코딩 실패는 음식 이미지와 게임 시작을 막지 않는다.
- 한 번에 하나의 나레이션만 재생하며 새 음식이 등장하면 앞 음성을 정리한다.
- 음성이 실제 재생되는 동안에만 BGM을 -6dB로 낮추고 효과음은 유지한다.
- 준비되지 않은 음성은 뒤늦게 재생하거나 다음 음식에 재사용하지 않는다.
- 저장소와 프로덕션 브라우저 런타임에는 Azure 키·엔드포인트·Speech SDK·런타임 TTS API가 포함되지 않는다. 게임 플레이 중 Azure 생성 호출은 0회다.

## Azure 제작 기록과 사람 검수

후보 음원은 유료 Microsoft Azure AI Speech Standard S0 리소스의 `southeastasia` 리전에서 만들었다. 사용 모델은 public preview인 MAI-Voice-2-Flash이며, 정확한 음성 ID는 `ko-KR-Haena:MAI-Voice-2-Flash`와 `ko-KR-Junho:MAI-Voice-2-Flash`다.

초기 `ko-KR-SunHiNeural` 중립 낭독 시안은 국어책처럼 평이해 문구의 유머와 강세를 살리지 못해 최종 에셋에서 제외했다. 이후 같은 6개 문구를 Haena와 Junho로 일대일 A/B 생성하고, setup과 punch를 나눈 표현형 SSML 후보와 선택적 재시안을 사람이 직접 들어 첫 6개를 채택했다. 이어 첫 확장 배치 8종을 생성하고 발음·강세·재미·속도를 청취 검토했으며, 된장찌개·곰탕은 재시안, 삼계탕은 새 문구 재시안, 설렁탕은 동일 연기 조건의 문구 A/B/C 중 B를 선택했다. 당시 기존 6개와 확장 8개, 총 14개를 사람의 청취로 선정했다. 이후 문구 교정으로 3개를 retired 처리해 현재 배포 연결은 11개다. 음성 복제나 실존 인물·캐릭터의 성대모사는 사용하지 않았다.

| 메뉴·파일 | 음성·선정 원본·현재 상태 | 크기 | 길이 | SHA-256 |
|---|---|---:|---:|---|
| 김치찌개 `kimchi-jjigae.mp3` | Haena · expressive pilot | 45,120 B | 2.256초 | `D2BB932B28737EBB648E5C0C885A44B6F37DE2D6756E71A9B460B5B3CB1A86AF` |
| 부대찌개 `budae-jjigae.mp3` | Junho · radio-command retake | 35,040 B | 1.752초 | `E05D0502895068CCC6E74DBA4F31B478C65015411EB2261D752AE485A70B887D` |
| 육개장 `yukgaejang.mp3` | Haena · rally retake | 46,560 B | 2.328초 | `F90C07224D18DB70C6BB9C45784C8DCBEA2B5D0905DA52D440EF058774F9AFCC` |
| 라면 `ramyeon.mp3` | Haena · soft-excited retake | 44,160 B | 2.208초 | `0CBD4B0926158CE527E479CF04EE630F384E8B4132E4E952B47793DA6EECD28E` |
| 파스타 `pasta.mp3` | Junho · expressive pilot · retired 이력 | 59,520 B | 2.976초 | `76F9A9FF29E507210B75E189309858C908A0EDBAE044F2DF9AC4D602BFFFC253` |
| 샤부샤부 `shabu-shabu.mp3` | Haena · expressive pilot · retired 이력 | 63,840 B | 3.192초 | `5A270FC0A36C583BF03718C490F0EDE6F2D3224D65FBBC417975F9C0A9385A42` |
| 된장찌개 `doenjang-jjigae.mp3` | Junho · joyful · `full-batch-01-retake-01` | 35,520 B | 1.776초 | `21C6A74CF04A18472110C1E8694D4D80E5D8D7136E442418E4BC202ABF05A63A` |
| 순두부찌개 `sundubu-jjigae.mp3` | Junho · joyful→joyful · `full-batch-01` | 39,840 B | 1.992초 | `F7FAC8707F15323C97007012609A513CE8F7E1D5D2FF8A3A89E3C086986E4F8D` |
| 감자탕 `gamjatang.mp3` | Junho · determined→determined · `full-batch-01` | 69,120 B | 3.456초¹ | `5A24FAD64D4B82A6482C3BB7D6BA0B5838FE5805FA4E8E8320E66EBD5CC97A76` |
| 설렁탕 `seolleongtang.mp3` | Junho · joyful · `seolleongtang-copy-pilot-01` B | 48,480 B | 2.424초¹ | `DEB1856C1C63AACFC528DAD71A9B80660AF352319218EDD027746E7E118167F6` |
| 곰탕 `gomtang.mp3` | Junho · determined→determined · `full-batch-01-retake-01` · retired 이력 | 35,520 B | 1.776초 | `63CB397FD55E02EEF0B93E9B43425A7FC1C0E8E991C809E5E16EFE5F1333B5B9` |
| 갈비탕 `galbitang.mp3` | Junho · determined→determined · `full-batch-01` | 35,520 B | 1.776초 | `C52E856E8F68AA6A84F1160F172E6D46E96C11656E896F7A3CEE0BE3CC6ED020` |
| 삼계탕 `samgyetang.mp3` | Junho · joyful · `full-batch-01-retake-03` | 35,520 B | 1.776초 | `518D96B965B75225D0BC47B3C678868F5994A5C35EC6A6EF48FD64A98886CC9C` |
| 콩나물국밥 `kongnamul-gukbap.mp3` | Haena · determined→joyful · `full-batch-01` | 35,520 B | 1.776초 | `67ADB756CCF7017FBD3E3E16903A5BD7FFEE96AB4343D425DA41A0A627A47D92` |

¹ 생성 QA의 2.0초 hard maximum은 자동 탈락 기준이 아니라 청취 재검토 신호로 사용했다. 감자탕 3.456초와 설렁탕 B 2.424초는 길이보다 발음·강세·자연스러움이 낫다는 사람의 청취 판단으로 예외 승인했고, 속도를 높인 재합성은 하지 않았다.

### 첫 확장 배치 8종 선정 provenance (현재 활성 7종)

| 메뉴 | 최종 문구 | 선정 `sourcePreviewPath` |
|---|---|---|
| 된장찌개 | 된장 나오면 밥상 끝장! | `tmp/narration-preview/full-batch-01-retake-01/doenjang-jjigae.mp3` |
| 순두부찌개 | 순두부의 순은, 순삭의 순! | `tmp/narration-preview/full-batch-01/sundubu-jjigae.mp3` |
| 감자탕 | 감자는 조연, 뼈가 주연! | `tmp/narration-preview/full-batch-01/gamjatang.mp3` |
| 설렁탕 | 설렁탕 국밥계 탱커 등장! | `tmp/narration-preview/seolleongtang-copy-pilot-01/B-gukbap-tank.mp3` |
| 곰탕 (retired 이력) | 곰은 없고 진국만 있다! | `tmp/narration-preview/full-batch-01-retake-01/gomtang.mp3` |
| 갈비탕 | 갈비탕은 뼈대부터 다르다! | `tmp/narration-preview/full-batch-01/galbitang.mp3` |
| 삼계탕 | 복날 체력바 전부 회복! | `tmp/narration-preview/full-batch-01-retake-03/samgyetang.mp3` |
| 콩나물국밥 | 한 숟갈에 인간 복귀! | `tmp/narration-preview/full-batch-01/kongnamul-gukbap.mp3` |

현재 활성 7종의 source pin·바이트·SHA-256·길이와 곰탕 retired provenance는 `scripts/narration/fullBatch01ApprovedAudioSelections.mjs`에 분리했다. `src/data/menuNarrationAudioManifest.ts`는 활성 11종의 런타임 URL만 매핑하며 해시나 historical ID를 중복 기록하지 않는다.

## 비용·권리·사용자 고지

- 후보 생성은 로컬 제작 단계에서 명시적 `--execute`를 사용한 경우에만 수행했다. 키는 세션 환경변수로만 다뤘고 로그·소스·배포 파일에 저장하지 않았다.
- 특정 청구 금액은 이 문서에서 확정하지 않는다. 최종 비용은 Azure Cost Management의 확정 사용 내역을 기준으로 확인한다.
- 현재 배포 연결 음원은 Azure 합성 음성 11종이며, 추가 3종은 문구 변경으로 retired한 생성 이력이다. 제3자의 녹음 음원은 사용하지 않았다.
- 음성 복제, 실존 인물·캐릭터 성대모사, 제3자 유명 문구의 직접 인용은 사용하지 않았다.
- [Microsoft 합성 음성 공개 설계 지침](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/speech-service/text-to-speech/concepts-disclosure-guidelines)에 따라 게임 방법에 “이 게임의 일부 음식 나레이션은 Microsoft Azure AI Speech로 생성한 AI 합성 음성입니다. 실제 인물의 녹음이나 성대모사가 아닙니다.”를 표시한다.

## 검증 상태

완료된 검증만 다음과 같이 기록한다.

- 나레이션 관련 단위 검증에서 50종 완전성, 활성 11종·39종 자막 전용 매핑, 첫 확장 배치 활성 7종의 source pin·바이트·SHA-256와 곰탕 retired provenance, historical 생성기의 current-catalog stale 차단, 캐시·디코딩·동시 요청·오래된 로드 차단, BGM duck과 정리를 확인했다.
- 대상 Playwright E2E는 7개 통과·환경 조건 1개 건너뜀이다. 핵심 나레이션 4/4를 포함해 설정 보존, 자막 표시, 정적 MP3 준비·재생 경로, 게임 방법의 AI 합성 음성 고지를 확인했다.
- TypeScript 검사와 프로덕션 Vite 빌드 통과. 빌드에는 활성 MP3 11개가 포함되며 금지한 Azure 엔드포인트·키·Speech SDK 문자열은 런타임 JavaScript에서 0건이다.
- 412×915 자동 캡처에서 고양이 말풍선, 게임 제목, VOX·효과음·진동 버튼, 첫 음식이 서로 겹치지 않음을 확인했다: `docs/evidence/screenshots/narration-caption-mobile.png`
- 실제 모바일 기기에서 활성 11개 음원의 체감 음량, BGM duck, iOS·Android 재생 편차를 듣는 검수는 아직 남아 있다.
