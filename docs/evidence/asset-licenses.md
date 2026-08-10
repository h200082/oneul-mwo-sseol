# 외부 에셋 및 오픈소스 출처 기록

에셋이나 라이브러리를 프로젝트에 추가하는 시점에 바로 기록합니다. 무료 자료도 반드시 원문 URL과 라이선스를 확인합니다.

현재 프로토타입에는 제3자 음식·배경 이미지, 녹음 음성·사운드 샘플, 폰트를 포함하지 않았다. 활성 음식 이미지 50종은 모두 Codex 내장 ImageGen으로 이 프로젝트를 위해 직접 생성했다. 유료 Microsoft Azure AI Speech Standard S0 기반 AI 합성 음성은 `src/assets/narration/`에 활성 50개와 역사적 MP3 3개, 총 53개를 보존한다. 활성 구성은 MAI-Voice-2-Flash 계열 45개와 MAI-Voice-2 5개이며, historical 3개까지 포함한 물리 파일 53개는 Flash 계열 48개와 Full 5개다. 현재 기본 문구와 일치하는 50종을 모두 런타임에 연결하며, 현재 릴리스 빌드의 `dist/` 기대 payload는 활성 음원 50개다. 파스타·곰탕·샤부샤부의 이전 MP3는 역사적 provenance로 보존한다. 김치볶음밥은 앞 공백만 제거한 bit-exact PCM WAV, 햄버거는 승인된 내부 gap trim WAV이며 떡볶이 onset retake B와 족발 copy retake는 승인된 raw MP3다. 프롬프트와 사람의 선별·후처리·품질 검토를 아래에 기록한다.

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
| 이미지 후처리 도구 | Pillow 12.3.0 | 크로마키 제거 결과 크롭·리사이즈·투명 WebP 인코딩·검사 | https://github.com/python-pillow/Pillow | Pillow contributors | MIT-CMU | 가능 | 저작권·라이선스 고지 유지 | 2026-08-08 |
| AI 합성 음성 생성 서비스 | Microsoft Azure AI Speech Standard S0, MAI-Voice-2-Flash(public preview)·MAI-Voice-2 | Azure 기반 나레이션 53종 보존(활성 50종·historical 3종; 로컬 파생본 포함) | [Microsoft 합성 음성 공개 설계 지침](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/speech-service/text-to-speech/concepts-disclosure-guidelines) | Microsoft | 유료 Azure 서비스·public preview 사용 조건 적용 | Azure 계정 계약과 최종 제품 약관 기준 | `southeastasia`에서 생성 후 사람이 선별한 정적 음원만 배포; 릴리스 `dist/` 기대 payload 50종, 키·SDK·API는 런타임 미포함 | 2026-08-10 |

## 직접 제작 또는 AI 생성 자료

| 이름·파일 | 제작 방법·도구 | 주요 입력 또는 근거 로그 | 사람의 수정 내용 | 사용 위치 |
|---|---|---|---|---|
| `public/favicon.svg` | 직접 작성한 SVG 도형 | `ai-prompts/2026-07-27-core-prototype.md` | 브라우저 표시와 경로 검증 | 브라우저 파비콘 |
| 프로토타입 도형·배경 | Phaser Graphics로 런타임 생성 | `ai-prompts/2026-07-27-core-prototype.md` | 모바일 가독성·색상·배치 조정 | 현재 게임 화면 |
| 절차형 효과음·진동 패턴 | Web Audio Oscillator·Gain과 표준 Vibration API로 런타임 직접 생성 | `ai-prompts/2026-08-05-sensory-feedback.md` | 이벤트별 음높이·길이·gain과 진동 패턴을 직접 검토하고 방 모드 볼륨 축소 | 베기·포획·놓침·카운트다운·후반·결과 피드백 |
| 절차형 아케이드 배경음 | 외부 음원·샘플 없이 Web Audio Oscillator·Gain으로 120 BPM·64-step 오리지널 스코어를 런타임 직접 합성 | `ai-prompts/2026-08-08-procedural-arcade-bgm.md` | G 장조 펜타토닉 저·중역 음형, 4단계 리듬 밀도, 효과음 순간 자동 덕킹과 모바일 오디오 수명주기를 검토 | 게임 진행 배경음 |
| 음식별 나레이션 문구 50종 | 사용자 초안과 Codex 교정으로 독자 문구·대안·연기 톤을 구조화 | `ai-prompts/2026-08-09-food-narration-system.md` | 사람 청취로 검토해 50종 모두에 음원을 연결 | 음식 등장 고양이 말풍선과 선택적 음성 |
| `src/assets/narration/` MP3·WAV 보존 이력 53종 | Azure AI Speech MAI-Voice-2-Flash·MAI-Voice-2 후보와 로컬 파생본을 사람이 직접 청취·선별 | `ai-prompts/2026-08-09-food-narration-system.md`, 로컬 생성 manifest, `scripts/narration/finalTiebreakApprovedAudioSelections.mjs`, `scripts/narration/remainingBatch01Group1ApprovedAudioSelections.mjs`, `scripts/narration/remainingBatch01Group2ApprovedAudioSelections.mjs`, `scripts/narration/kalguksuCopyRetake01ApprovedAudioSelection.mjs`, `scripts/narration/remainingBatch01Group3ApprovedAudioSelections.mjs`, `scripts/narration/hamburgerFastRepeatApprovedAudioSelection.mjs`, `scripts/narration/tteokbokkiOnsetRetakeApprovedAudioSelection.mjs`, `scripts/narration/remainingBatch01Group4ApprovedAudioSelections.mjs`, `scripts/narration/jokbalCopyRetake01ApprovedAudioSelection.mjs` | 활성 50개를 선정하고 이전 MP3 3개를 historical로 보존; 음성 복제·성대모사 없음 | 현재 문구와 일치하는 50개를 덱 단위 선로딩·릴리스 `dist/` 기대 payload에 포함, 3개는 역사적 파일 |
| 방 초대 QR 이미지 | `qrcode`로 실행 중 PNG data URL 생성 | `ai-prompts/2026-07-27-room-lobby-prototype.md` | 실제 초대 URL·오류 대체 경로 검증 | 방 대기실 |
| `src/assets/food/*.webp` 활성 50종(기존 승인 8종 유지·신규/교정 42종) | Codex 내장 ImageGen 생성 후 로컬 크로마키 제거·투명 WebP 최적화 | `ai-prompts/2026-08-08-final-food-library-50.md`와 그 문서에 연결된 선행 이미지 로그 | 음식 식별성·먹음직스러움·비원형 실루엣을 우선해 결과를 선별·교정하고, 배경 제거, 긴 변 512px, 원본 종횡비 보존, 알파·크로마 잔여·용량·50종 매핑을 검토 | 게임 토큰과 공동 결과 음식 카드 |
| `src/assets/title/chef-cat-v1.webp`, `src/assets/title/title-food-*.webp` | Codex 내장 ImageGen으로 오리지널 고양이 셰프를 생성하고 크로마키 제거·투명 WebP 최적화, 기존 자체 제작 음식 4종을 타이틀 전용으로 축소 | `ai-prompts/2026-08-08-title-cat-chef.md` | 캐릭터 해부·도구 수·그립·투명 알파를 검토하고 모바일 첫 화면에서 제목·버튼을 가리지 않도록 배치 | 최초 접속 타이틀 화면 |

## AI 합성 음성 보존 인벤토리 53종 (현재 활성 50종)

생성 리전은 `southeastasia`이며 활성 음성은 `ko-KR-Haena:MAI-Voice-2-Flash`, `ko-KR-Junho:MAI-Voice-2-Flash`, `ko-KR-Junho:MAI-Voice-2`다. 전체 53개는 활성 50개와 historical 3개다. 활성 모델 구성은 Flash 45개·Full 5개이고 historical을 포함한 물리 구성은 Flash 48개·Full 5개다. 기존 historical·거절 provenance는 유지한다. 신규 승인·거절·profile·source/target hash는 `scripts/narration/remainingBatch01Group1ApprovedAudioSelections.mjs`, `scripts/narration/remainingBatch01Group2ApprovedAudioSelections.mjs`, `scripts/narration/kalguksuCopyRetake01ApprovedAudioSelection.mjs`, `scripts/narration/remainingBatch01Group3ApprovedAudioSelections.mjs`, `scripts/narration/hamburgerFastRepeatApprovedAudioSelection.mjs`, `scripts/narration/tteokbokkiOnsetRetakeApprovedAudioSelection.mjs`, `scripts/narration/remainingBatch01Group4ApprovedAudioSelections.mjs`, `scripts/narration/jokbalCopyRetake01ApprovedAudioSelection.mjs`에 고정했다. 브라우저 런타임에는 Azure 키·엔드포인트·Speech SDK가 없고 Azure 생성 호출도 발생하지 않는다.

G3에서 김밥·샌드위치·길거리 토스트·삼겹살·갈비구이 5종만 활성화한 승인·보류 원문은 `떡볶이는 앞에 "떡볶"이가 안들리고 앞부분이 짤린거 같아. 떡볶이는 짤린거 말고는 괜찮아. 햄버거는 햄부기 3번 반복하는데 더 빠르게 반복해줘. 이 둘 말고는 괜찮아`다. 당시 떡볶이·햄버거 raw source는 inactive/pending·raw-withheld였으며 이 역사적 상태는 유지한다. 이후 사용자가 `햄버거도 승인할게`라고 승인한 `hamburger-fast-repeat-trim.wav`(224,244 B·2.3354166666666667초·SHA-256 `DB5ABA82C39A1C5EBAA5C0F417B6394815ACE3A4710BF527C240B6AF0AA3A35F`, PCM SHA-256 `77B1F1DF1593D62BB14BEA23E8E8407E3D8EC047AAD1FEF458B23025E576F3D0`)를 활성화했다. 이어 동일 onset 피드백의 떡볶이 retake A/B 중 사용자가 `B 승인`이라고 선택해 `tteokbokki-onset-retake-b.mp3`(64,800 B·135 MPEG frame·3.240초·SHA-256 `6B6B9AE5B73AE5AFE86EBE8DBBCF4A4347674F889597A9FA8B721F6C3391CF87`)를 byte-identical하게 활성화했다. A는 57,120 B·2.856초·SHA-256 `3363427C60805BFD84E244F33F35772E214FAA53C524F8167B20F6E3F178581D`인 historical rejection으로 미배포 보존한다. exact profile·source/target·manifest hash와 승인 이력은 `docs/source/ai-usage.md`, `docs/source/narration-generation.md`, 두 승인 provenance 스크립트에 교차 기록했다.

G4 승인·보류 원문은 `족발은 "발을 먹는데? 손이 더 바쁘다" 에서 "더"가 빠졌어 중요한 요소야 수정해줘.  나머지는 다 맘에 들어`다. 닭갈비·보쌈·불고기·치킨·피자·닭한마리 6종은 raw MP3로 활성화했고, exact source/target identity는 `scripts/narration/remainingBatch01Group4ApprovedAudioSelections.mjs`에 고정했다. 구 족발 raw `remaining-batch-01/jokbal.mp3`(54,720 B·114 frame·2.736초·SHA-256 `9D4505FE633998516A2AABE750920CE2CD14E98709CE87512D67B674D24966BD`)는 “더” 누락으로 거절·미배포 상태를 유지한다. 현재 문구 `발을 먹는데? 손이 더 바쁘다!`의 retake는 51,840 B·108 frame·2.592초·SHA-256 `94D19FF391315524B09503A6962E13418FE5DD97ED098D7D9C9E116756B2B23D`, manifest는 3,359 B·SHA-256 `E33C781E071BEB700426FC2C03D7079033844EC4DD3991230853BBFA77C22F41`다. 생성 직후에는 청취 대기였으나 사용자가 `족발 승인할게`라고 직접 승인했다. 측정 question→punch gap 520–535ms는 자동 reject 기준 500ms를 20–35ms 넘지만 이 승인으로 human override했고, stable 자산 `jokbal-copy-retake-01.mp3`를 활성화했다. 정확한 profile·source/target hash·이전/최종 원문·gap override는 `scripts/narration/jokbalCopyRetake01ApprovedAudioSelection.mjs`에 고정했다.

| 메뉴·파일 | 음성·선정 원본 | 크기 | 길이 | SHA-256 |
|---|---|---:|---:|---|
| 김치찌개 `kimchi-jjigae.mp3` | Haena · expressive pilot | 45,120 B | 2.256초 | `D2BB932B28737EBB648E5C0C885A44B6F37DE2D6756E71A9B460B5B3CB1A86AF` |
| 부대찌개 `budae-jjigae.mp3` | Junho · radio-command retake | 35,040 B | 1.752초 | `E05D0502895068CCC6E74DBA4F31B478C65015411EB2261D752AE485A70B887D` |
| 육개장 `yukgaejang.mp3` | Haena · rally retake | 46,560 B | 2.328초 | `F90C07224D18DB70C6BB9C45784C8DCBEA2B5D0905DA52D440EF058774F9AFCC` |
| 라면 `ramyeon.mp3` | Haena · soft-excited retake | 44,160 B | 2.208초 | `0CBD4B0926158CE527E479CF04EE630F384E8B4132E4E952B47793DA6EECD28E` |
| 파스타 `pasta.mp3` (retired 이력) | Junho · expressive pilot | 59,520 B | 2.976초 | `76F9A9FF29E507210B75E189309858C908A0EDBAE044F2DF9AC4D602BFFFC253` |
| 파스타 `pasta-final-tiebreak.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.56 · +22% · 인접 두 블록/no break · `replacement-pilot-02` B · 104 MPEG frame | 49,920 B | 2.496초⁷ | `EDB4D142066DDCC6C75D7B58AD9FBB6D2AB85D7CE562CBBDEB6A824854947431` |
| 샤부샤부 `shabu-shabu.mp3` (retired 이력) | Haena · expressive pilot | 63,840 B | 3.192초 | `5A270FC0A36C583BF03718C490F0EDE6F2D3224D65FBBC417975F9C0A9385A42` |
| 샤부샤부 `shabu-shabu.wav` | Junho · determined · `slow-retake-batch-01` 양끝 무음 trim | 175,244 B | 1.825초⁵ | `A6C3C08897A015C0CC973EAD300A69F3456DE1A835B4673F594B60E64504A2FA` |
| 된장찌개 `doenjang-jjigae.mp3` | Junho · joyful · `full-batch-01-retake-01` | 35,520 B | 1.776초 | `21C6A74CF04A18472110C1E8694D4D80E5D8D7136E442418E4BC202ABF05A63A` |
| 순두부찌개 `sundubu-jjigae.mp3` | Junho · joyful→joyful · `full-batch-01` | 39,840 B | 1.992초 | `F7FAC8707F15323C97007012609A513CE8F7E1D5D2FF8A3A89E3C086986E4F8D` |
| 감자탕 `gamjatang.mp3` | Junho · determined→determined · `full-batch-01` | 69,120 B | 3.456초¹ | `5A24FAD64D4B82A6482C3BB7D6BA0B5838FE5805FA4E8E8320E66EBD5CC97A76` |
| 설렁탕 `seolleongtang.mp3` | Junho · joyful · `seolleongtang-copy-pilot-01` B | 48,480 B | 2.424초¹ | `DEB1856C1C63AACFC528DAD71A9B80660AF352319218EDD027746E7E118167F6` |
| 곰탕 `gomtang.mp3` (retired 이력) | Junho · determined→determined · `full-batch-01-retake-01` | 35,520 B | 1.776초 | `63CB397FD55E02EEF0B93E9B43425A7FC1C0E8E991C809E5E16EFE5F1333B5B9` |
| 곰탕 `gomtang.wav` | Junho · joyful · slow-retake 내부 저에너지 gap trim | 225,876 B | 2.352초⁶ | `1148C05A7A088B5D59255C97DBF6252210E1E0437EA3A531434FAE0FDF2FDDB8` |
| 갈비탕 `galbitang.mp3` | Junho · determined→determined · `full-batch-01` | 35,520 B | 1.776초 | `C52E856E8F68AA6A84F1160F172E6D46E96C11656E896F7A3CEE0BE3CC6ED020` |
| 삼계탕 `samgyetang.mp3` | Junho · joyful · `full-batch-01-retake-03` | 35,520 B | 1.776초 | `518D96B965B75225D0BC47B3C678868F5994A5C35EC6A6EF48FD64A98886CC9C` |
| 콩나물국밥 `kongnamul-gukbap.mp3` | Haena · determined→joyful · `full-batch-01` | 35,520 B | 1.776초 | `67ADB756CCF7017FBD3E3E16903A5BD7FFEE96AB4343D425DA41A0A627A47D92` |
| 돼지국밥 `dwaeji-gukbap.mp3` | Junho · joyful · `full-batch-02` | 38,880 B | 1.944초 | `46798287828F7F991835FFF7D532B64A3F46A4DAB0B8207607427A9DDE452B66` |
| 순대국 `sundae-guk.mp3` | Junho · joyful · `full-batch-02` | 51,360 B | 2.568초² | `386B15214E6FE6A07530F1D4ED6BE4032EFBAC2CECE522A409730B882B865922` |
| 청국장 `cheonggukjang.mp3` | Junho · joyful · `full-batch-02` 원본 말미 감쇠 B(-4.5 dB) | 52,800 B | 2.640초⁴ | `9029284574B771A2042FCFE6804AB1633F1137C91D4F49D635E5871D99902874` |
| 집밥백반 `home-style-baekban.mp3` | Junho · joyful · `full-batch-02` | 47,040 B | 2.352초² | `179D4F0056E9B41843AABFA46BCC13C0CA4C1E79D99177AC8F076D1F8BDC36EC` |
| 비빔밥 `bibimbap.mp3` | Junho · determined · `full-batch-02` | 36,000 B | 1.800초 | `ADCA8D1CCAFF1856EF75BB2ED35A4B50EE23129DDD0E73390243A553BE776DA4` |
| 치킨마요덮밥 `chicken-mayo-deopbap.mp3` | Junho · joyful · `full-batch-02` | 40,800 B | 2.040초² | `7F98D7CD654836EA3F788F78777551DE3C6F82C3C14B7FD48CBC6B8932467F3C` |
| 제육덮밥 `jeyuk-deopbap.mp3` | Junho · joyful · `replacement-batch-01` | 43,680 B | 2.184초³ | `96A12781D4278EB221BDC925D7B9F8AF92AC7F65716A252C1D0759B217E9EC3F` |
| 불고기덮밥 `bulgogi-deopbap-final-tiebreak.mp3` | `ko-KR-Junho:MAI-Voice-2` · joyful 0.60 · +28% · 한 블록 · `replacement-pilot-02-mai-voice-2` A · 77 MPEG frame | 36,960 B | 1.848초⁷ | `B37C038201C660C6FB58CF0345D017526E074EF900914B835441106A9909D1BD` |
| 닭갈비 `dakgalbi-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2` · joyful 0.44 · +20%/-1% · 한 블록 | 36,960 B | 1.848초 | `2F196CF507647193E0A71C8E1949249769D87EBD1372D1EEEB4C28024656201F` |
| 보쌈 `bossam-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.46 · +20%/-1% · 한 블록 | 48,480 B | 2.424초 | `B081A8348CA13C6A9B36DA3D8A8EF595AF674F37ED835AE58CB99BE2F336A26A` |
| 족발 `jokbal-copy-retake-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.48 · +22%/+0% · 한 블록 · 108 MPEG frame | 51,840 B | 2.592초 | `94D19FF391315524B09503A6962E13418FE5DD97ED098D7D9C9E116756B2B23D` |
| 불고기 `bulgogi-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.48 · +20%/-1% · 인접 두 블록 | 42,720 B | 2.136초 | `3E396073B5888176DE9BF942C9093E2C43CB5106F2CA9F78A1DC77AB010B4922` |
| 치킨 `fried-chicken-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2` · joyful 0.48 · +26%/-1% · 한 블록 | 52,800 B | 2.640초 | `F7C65BFB9379E60767012B532A4C4FB91BD303F3F4B467CDDD1DEC46BBC1FAC7` |
| 피자 `pizza-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.46 · +18%/+0% · 인접 두 블록 | 43,200 B | 2.160초 | `22995289B0EAA4F3902520000CA6E4D8D4A8F42A1E09099B918986A1197EB671` |
| 닭한마리 `dak-hanmari-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.46 · +18%/-1% · 한 블록 | 40,800 B | 2.040초 | `E87B251F72191AD9841E984DA0A2D16E23C5D17AD70E95AF9AF8C13DF7C4C2EC` |

¹ 자동 QA의 2.0초 hard maximum은 재합성 여부를 판단하는 검토 신호다. 감자탕 3.456초 원본과 설렁탕 B 2.424초는 실제 청취에서 발음·강세·자연스러움을 우선해 사람이 예외 승인했으며, 속도를 높여 재합성하지 않았다.

² 순대국 2.568초·집밥백반 2.352초·치킨마요덮밥 2.040초도 자동 길이 기준을 넘지만 사용자가 “나머지는 괜찮다”라고 실제 청취 승인했다. 두 번째 배치 승인 5종의 source·바이트·길이·해시는 `scripts/narration/fullBatch02ApprovedAudioSelections.mjs`에 고정했다.

³ 제육덮밥 교체본 2.184초도 2.0초 기준을 넘지만 사용자가 “제육덮밥은 새 음원이 나아”라고 비교 청취 승인했다. source·바이트·frame·길이·해시는 `scripts/narration/replacementBatch01ApprovedAudioSelections.mjs`에 고정했으며, 같은 교체 배치의 청국장 원본 후보·불고기덮밥·곰탕·파스타·샤부샤부는 당시 연결하지 않았다. 파스타·불고기덮밥은 후속 별도 pilot과 2단계 블라인드에서 승인됐다. 청국장 활성본은 별도 `full-batch-02` 원본 말미 감쇠 B다.

⁴ 청국장 2.640초도 자동 길이 기준을 넘지만 사용자가 “청국장은 B가 좋아”라고 비교 청취 승인했다. B는 원본 1.7725–2.4175초의 `global_gain`을 요청 -5 dB에 가장 가까운 무손실 -4.5 dB로 낮춘 파일이며 추가 Azure 요청은 없었다. 정확한 source·바이트·frame·길이·해시·승인 원문은 `scripts/narration/cheonggukjangPunchAdjustedApprovedAudioSelection.mjs`에 고정했다. 단어 정렬 정보는 없다.

⁵ 샤부샤부 WAV는 사용자의 “샤부샤부 좋아 맘에들어” 승인 뒤 slow-retake의 앞 275ms·뒤 132ms만 제거했다. -40dBFS active 발화 1.490초·38,760 Float32 sample과 최장 내부 gap 65ms는 그대로이며 sample mismatch 0, 5ms fade는 보존된 경계 무음에만 적용했다. source·output·PCM hash와 승인 원문은 `scripts/narration/shabuShabuSilenceTrimApprovedAudioSelection.mjs`에 고정했다. Azure·네트워크 호출은 없었다.

⁶ 곰탕 WAV는 사용자의 “곰탕은 맘에들어.” 승인 뒤 560ms·405ms 저에너지 구간의 중심만 줄여 최장 gap을 -45/-40dBFS 기준 135/140ms로 만들었다. retained PCM segment의 source/output SHA는 같고 mismatch·fade·resample·normalize·추가 Azure 요청은 0이다. exact source/output/manifest/PCM hash와 승인 원문은 `scripts/narration/gomtangGapTrimApprovedAudioSelection.mjs`에 고정했다. 단어 정렬 정보는 없다.

⁷ 초기 raw·gap-trim 거절 이력 뒤 새 Flash/Full·한 블록/두 블록 후보를 두 단계로 블라인드 비교했다. 사용자는 최종 결선에서 “둘다 R이 더 자연스럽고 어떤 단어에 강세를 줘야 할지, 어떻게 이어나가야 할 지 아는느낌이야. 자연스러워”라고 승인했다. 두 활성 자산은 결선 공개 MP3와 byte-identical하며 후처리·추가 Azure 요청은 없다. 생성 manifest·두 reveal map·source/target hash·승인 원문은 `scripts/narration/finalTiebreakApprovedAudioSelections.mjs`에 고정했다. 이 두 선택만으로 Flash/Full 또는 한 블록/두 블록의 전역 우월성을 주장하지 않는다.

### 첫 확장 배치 8종 승인 source pin

| 메뉴 | 승인 문구 | 선정 `sourcePreviewPath` |
|---|---|---|
| 된장찌개 | 된장 나오면 밥상 끝장! | `tmp/narration-preview/full-batch-01-retake-01/doenjang-jjigae.mp3` |
| 순두부찌개 | 순두부의 순은, 순삭의 순! | `tmp/narration-preview/full-batch-01/sundubu-jjigae.mp3` |
| 감자탕 | 감자는 조연, 뼈가 주연! | `tmp/narration-preview/full-batch-01/gamjatang.mp3` |
| 설렁탕 | 설렁탕 국밥계 탱커 등장! | `tmp/narration-preview/seolleongtang-copy-pilot-01/B-gukbap-tank.mp3` |
| 곰탕 (retired 이력) | 곰은 없고 진국만 있다! | `tmp/narration-preview/full-batch-01-retake-01/gomtang.mp3` |
| 갈비탕 | 갈비탕은 뼈대부터 다르다! | `tmp/narration-preview/full-batch-01/galbitang.mp3` |
| 삼계탕 | 복날 체력바 전부 회복! | `tmp/narration-preview/full-batch-01-retake-03/samgyetang.mp3` |
| 콩나물국밥 | 한 숟갈에 인간 복귀! | `tmp/narration-preview/full-batch-01/kongnamul-gukbap.mp3` |

게임 방법에는 “이 게임의 일부 음식 나레이션은 Microsoft Azure AI Speech로 생성한 AI 합성 음성입니다. 실제 인물의 녹음이나 성대모사가 아닙니다.”라는 사용자 고지를 표시한다. 실제 비용은 추정치나 문서 기재액이 아니라 Azure Cost Management의 확정 사용 내역을 최종 기준으로 확인한다.
