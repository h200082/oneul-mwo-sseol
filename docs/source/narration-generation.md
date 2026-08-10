# Azure AI Speech 나레이션 생성 절차와 최종 채택 상태

## 현재 배포 상태

최종 빌드는 50개 음식 문구를 모두 자막으로 표시하고, 현재 문구와 일치하는 50개 메뉴 모두를 `src/assets/narration/`의 MP3·WAV 정적 음원으로 재생한다. `audioUrl: null`인 항목은 없다. 보존 파일은 활성 50개와 역사적 MP3 3개를 합친 53개다. 현재 릴리스 빌드의 `dist/` 기대 payload는 활성 음원 50개다. 파스타·곰탕·샤부샤부의 이전 MP3는 역사적 provenance로 보존한다. 활성 구성은 Flash 계열 45개와 Full 5개, 물리 파일 구성은 Flash 계열 48개와 Full 5개다. 김치볶음밥은 leading-only bit-exact PCM trim WAV, 곰탕·햄버거는 내부 gap-trim WAV이며, 떡볶이 onset retake B·족발 copy retake와 새 칼국수를 포함한 나머지 remaining-batch 선택본은 raw MP3다.

제작에는 유료 Microsoft Azure AI Speech Standard S0의 `southeastasia` 리전을 사용했다. 주된 모델은 public preview인 MAI-Voice-2-Flash이며, 돈가스·불고기덮밥·삼겹살·닭갈비·치킨 5개는 MAI-Voice-2 원본을 채택했다. 정확한 활성 음성 ID는 `ko-KR-Haena:MAI-Voice-2-Flash`, `ko-KR-Junho:MAI-Voice-2-Flash`, `ko-KR-Junho:MAI-Voice-2`다. 브라우저 런타임에는 Azure 키·엔드포인트·Speech SDK가 없으며 게임 플레이 중 Azure 생성 호출은 발생하지 않는다.

## 현재 표현형 후보 생성 도구

| 스크립트 | 역할 | 결과 |
|---|---|---|
| `scripts/narration/generate-azure-expressive-pilot.mjs` | 대표 6문장을 Haena·Junho에 같은 스타일과 타이밍으로 적용한 12개 일대일 A/B 후보 | 김치찌개는 현재 활성; 파스타·샤부샤부는 당시 선정 이력만 보존 |
| `scripts/narration/generate-azure-expressive-retakes.mjs` | 부대찌개·육개장·라면을 두 연기 방향씩 재시안 | 부대찌개·육개장 최종본 채택 |
| `scripts/narration/generate-azure-ramyeon-soft-retakes.mjs` | 라면 Haena 후보 2개를 더 부드러운 속도로 재시안 | 라면 `soft-excited` 최종본 채택 |
| `scripts/narration/generate-azure-full-batch-01.mjs` | 된장찌개부터 콩나물국밥까지 첫 확장 배치 8종을 메뉴별 voice/style로 생성 | 순두부찌개·감자탕·갈비탕·콩나물국밥 원본 채택 |
| `scripts/narration/generate-azure-full-batch-01-retake-01.mjs` | 발음·속도 검토가 필요했던 4종 재시안 | 된장찌개는 현재 활성; 곰탕은 당시 선정 이력만 보존 |
| `scripts/narration/generate-azure-full-batch-01-retake-03.mjs` | 삼계탕 문구를 한 호흡으로 재시안 | “복날 체력바 전부 회복!” 최종본 채택 |
| `scripts/narration/generate-azure-seolleongtang-copy-pilot-01.mjs` | 동일 voice/style/rate에서 설렁탕 문구 A/B/C만 공정 비교 | B “설렁탕 국밥계 탱커 등장!” 최종본 채택 |
| `scripts/narration/generate-azure-full-batch-02.mjs` | 돼지국밥부터 치킨마요덮밥까지 8종의 한 호흡 후보 생성 | 원본 5종은 활성, 청국장은 원본의 말미 음량을 조정한 B 후보 승인, 제육덮밥은 교체 배치 승인, 불고기덮밥은 기본 문구 불일치로 미연결 |
| `scripts/narration/adjust-cheonggukjang-terminal-punch.mjs` | 청국장 원본의 1.7725–2.4175초 MPEG `global_gain`만 로컬 감쇠 | 사용자 승인 B는 요청 -5 dB의 무손실 근사치 -4.5 dB 적용, Azure 요청 0회 |
| `scripts/narration/trim-shabu-shabu-silence.mjs` | 승인된 샤부샤부 slow-retake를 Chrome WebAudio로 24kHz float PCM 디코딩하고 양끝 무음만 trim | 발화 PCM 38,760 sample bit-exact 보존, 5ms boundary fade는 보존 무음에만 적용, Azure 요청 0회 |
| `scripts/narration/trim-gomtang-internal-gaps.mjs` | 곰탕 slow-retake의 두 긴 내부 저에너지 구간 중심만 로컬 제거 | 보존 PCM bit-exact, 최장 gap 140ms 이하, 사용자 승인 WAV 활성, Azure 요청 0회 |
| `scripts/narration/generate-azure-final-retake-batch-01.mjs` | 현재 문구의 파스타·불고기덮밥 최종 재시안 2종 생성 | 원본·후속 gap-trim 후보 모두 사용자 청취에서 거절되어 미연결 |
| `scripts/narration/trim-final-retake-internal-gaps.mjs` | 파스타·불고기덮밥 최종 재시안의 긴 내부 저에너지 구간을 로컬 단축 | 청취 비교용 provenance만 보존, 런타임 통합 금지 |
| `scripts/narration/generate-azure-replacement-pilot-02.mjs` | 기존 최종 raw·gap-trim 거절 뒤 파스타·불고기덮밥을 Flash에서 한 블록/인접 두 블록으로 공정 비교 | 1차 블라인드 결선 후보 4개 생성; 자동 통합 없음 |
| `scripts/narration/generate-azure-replacement-pilot-02-mai-voice-2.mjs` | 같은 문구·style·rate·구조를 MAI-Voice-2로 비교 | Flash와 함께 1차 블라인드 평가; 자동 통합 없음 |
| `scripts/narration/finalTiebreakApprovedAudioSelections.mjs` | 두 블라인드 단계의 reveal map·생성 manifest·원본/자산 hash·승인 원문 고정 | 파스타 Flash 두 블록과 불고기덮밥 Full 한 블록 raw MP3 활성 |
| `scripts/narration/remainingBatch01Group3ApprovedAudioSelections.mjs` | G3 source manifest·승인 5종의 source/target hash와 profile·당시 보류 2종·승인/보류 원문 고정 | 이 단계에서 김밥·샌드위치·길거리 토스트·삼겹살·갈비구이 raw MP3 활성; 떡볶이·햄버거 raw source withheld/pending |
| `scripts/narration/hamburgerFastRepeatApprovedAudioSelection.mjs` | G3 보류 뒤 만든 햄버거 내부 gap-trim WAV의 source/output/manifest/PCM hash·절단 계약·후속 승인 원문 고정 | `hamburger-fast-repeat-trim.wav` 후속 승인·활성 |
| `scripts/narration/generate-azure-tteokbokki-onset-retake-01.mjs` | 잘린 onset 피드백 뒤 같은 Haena Flash·문구·구조에서 첫 블록 rate만 바꾼 A/B 생성 | A는 비교 이력으로 미선정, B raw MP3 후속 승인 |
| `scripts/narration/tteokbokkiOnsetRetakeApprovedAudioSelection.mjs` | 떡볶이 A/B manifest·source/target hash·A rejection·B 승인 원문 고정 | `tteokbokki-onset-retake-b.mp3` byte-identical 활성 |
| `scripts/narration/remainingBatch01Group4ApprovedAudioSelections.mjs` | G4 source manifest·승인 6종 source/target identity·족발 raw 보류·승인/수정 원문 고정 | 닭갈비·보쌈·불고기·치킨·피자·닭한마리 raw MP3 활성; 족발 보류 |
| `scripts/narration/azureJokbalCopyRetake01.mjs`·`generate-azure-jokbal-copy-retake-01.mjs` | 핵심 단어 “더”를 복구한 족발 한 블록 preview 생성·검수 | 후속 직접 청취 승인 후보 생성 |
| `scripts/narration/jokbalCopyRetake01ApprovedAudioSelection.mjs` | 족발 retake source/target·manifest·구 raw rejection·이전/최종 승인 원문·520–535ms gap human override 고정 | `jokbal-copy-retake-01.mp3` byte-identical 활성 |

모든 스크립트는 기본이 드라이런이며 이때 네트워크 요청과 파일 쓰기를 하지 않는다. 다만 기록된 문구가 현재 카탈로그와 다르면 드라이런·`--execute` 모두 비용 계산, 네트워크, 출력 디렉터리 생성보다 먼저 `stale` 오류로 중단한다. 실행 가능한 현재 문구만 `--execute`에서 Azure를 호출하고, 합성 전 `voices/list`로 필요한 음성 ID와 스타일을 검증한다. 기존 파일은 덮어쓰지 않고 자동 재시도하지 않으며 키를 오류·로그·manifest에 기록하지 않는다.

### 안전한 드라이런

```powershell
node .\scripts\narration\generate-azure-expressive-pilot.mjs
node .\scripts\narration\generate-azure-expressive-retakes.mjs
node .\scripts\narration\generate-azure-ramyeon-soft-retakes.mjs
node .\scripts\narration\generate-azure-full-batch-01.mjs
node .\scripts\narration\generate-azure-full-batch-01-retake-01.mjs
node .\scripts\narration\generate-azure-full-batch-01-retake-03.mjs
node .\scripts\narration\generate-azure-seolleongtang-copy-pilot-01.mjs
node .\scripts\narration\generate-azure-full-batch-02.mjs
node .\scripts\narration\adjust-cheonggukjang-terminal-punch.mjs
node .\scripts\narration\trim-shabu-shabu-silence.mjs
node .\scripts\narration\trim-gomtang-internal-gaps.mjs
node .\scripts\narration\generate-azure-final-retake-batch-01.mjs
node .\scripts\narration\trim-final-retake-internal-gaps.mjs
node .\scripts\narration\generate-azure-replacement-pilot-02.mjs
node .\scripts\narration\generate-azure-replacement-pilot-02-mai-voice-2.mjs
node .\scripts\narration\generate-azure-tteokbokki-onset-retake-01.mjs
node .\scripts\narration\generate-azure-jokbal-copy-retake-01.mjs
```

### 승인된 제작 환경

키는 현재 PowerShell 세션의 환경변수로만 설정한다. `.env`, 소스 코드, 명령 인자, 문서에 값을 기록하지 않는다.

```powershell
$env:AZURE_SPEECH_KEY='<Azure Speech key>'
$env:AZURE_SPEECH_REGION='southeastasia'
```

명시적 `--execute`는 사용자 승인 아래 검수용 새 출력 폴더를 지정할 때만 사용했다. 출력은 `tmp/narration-preview/` 아래의 배포 전 후보이며, 최종 선택본만 `src/assets/narration/`으로 복사해 `src/data/menuNarrationAudioManifest.ts`에서 정적으로 import한다. 특정 청구 금액은 이 문서에서 확정하지 않으며 Azure Cost Management의 확정 사용 내역을 최종 기준으로 확인한다.

## 첫 확장 배치 8종 생성 이력·현재 활성 7종

당시 기존 6종과 아래 8종을 합쳐 14종을 사람이 청취·선정했다. 후속 문구 교정에서 파스타·샤부샤부와 아래 곰탕의 기본 문구가 바뀌어 세 음원은 연결을 해제했다. 이후 여러 승인 단계를 거친 활성 22종에 remaining-batch G1 7종·G2 6종, 새 문구 칼국수 retake 1종, G3 최초 승인 5종, 후속 햄버거 로컬 trim 1종, 떡볶이 onset retake B 1종, G4 승인 6종과 족발 copy retake 1종을 추가해 현재 총 50종을 import한다. 아래 곰탕 MP3 행은 예전 문구의 retired historical fixture다.

| 메뉴 | 승인 문구 | voice·선정 source | 크기 | 길이 | SHA-256 |
|---|---|---|---:|---:|---|
| 된장찌개 | 된장 나오면 밥상 끝장! | Junho joyful · `tmp/narration-preview/full-batch-01-retake-01/doenjang-jjigae.mp3` | 35,520 B | 1.776초 | `21C6A74CF04A18472110C1E8694D4D80E5D8D7136E442418E4BC202ABF05A63A` |
| 순두부찌개 | 순두부의 순은, 순삭의 순! | Junho joyful→joyful · `tmp/narration-preview/full-batch-01/sundubu-jjigae.mp3` | 39,840 B | 1.992초 | `F7FAC8707F15323C97007012609A513CE8F7E1D5D2FF8A3A89E3C086986E4F8D` |
| 감자탕 | 감자는 조연, 뼈가 주연! | Junho determined→determined · `tmp/narration-preview/full-batch-01/gamjatang.mp3` | 69,120 B | 3.456초¹ | `5A24FAD64D4B82A6482C3BB7D6BA0B5838FE5805FA4E8E8320E66EBD5CC97A76` |
| 설렁탕 | 설렁탕 국밥계 탱커 등장! | Junho joyful · `tmp/narration-preview/seolleongtang-copy-pilot-01/B-gukbap-tank.mp3` | 48,480 B | 2.424초¹ | `DEB1856C1C63AACFC528DAD71A9B80660AF352319218EDD027746E7E118167F6` |
| 곰탕 (retired 이력) | 곰은 없고 진국만 있다! | Junho determined→determined · `tmp/narration-preview/full-batch-01-retake-01/gomtang.mp3` | 35,520 B | 1.776초 | `63CB397FD55E02EEF0B93E9B43425A7FC1C0E8E991C809E5E16EFE5F1333B5B9` |
| 갈비탕 | 갈비탕은 뼈대부터 다르다! | Junho determined→determined · `tmp/narration-preview/full-batch-01/galbitang.mp3` | 35,520 B | 1.776초 | `C52E856E8F68AA6A84F1160F172E6D46E96C11656E896F7A3CEE0BE3CC6ED020` |
| 삼계탕 | 복날 체력바 전부 회복! | Junho joyful · `tmp/narration-preview/full-batch-01-retake-03/samgyetang.mp3` | 35,520 B | 1.776초 | `518D96B965B75225D0BC47B3C678868F5994A5C35EC6A6EF48FD64A98886CC9C` |
| 콩나물국밥 | 한 숟갈에 인간 복귀! | Haena determined→joyful · `tmp/narration-preview/full-batch-01/kongnamul-gukbap.mp3` | 35,520 B | 1.776초 | `67ADB756CCF7017FBD3E3E16903A5BD7FFEE96AB4343D425DA41A0A627A47D92` |

¹ 감자탕 3.456초와 설렁탕 B 2.424초는 자동 QA의 2.0초 검토 기준을 넘지만, 실제 청취에서 발음·강세·자연스러움이 더 낫다고 판단해 사람이 예외 승인했다. 두 파일은 속도를 높여 재합성하지 않았다. 활성 7종의 source pin·`durationReview`와 곰탕 retired provenance는 `scripts/narration/fullBatch01ApprovedAudioSelections.mjs`에 기록한다. `src/data/menuNarrationAudioManifest.ts`는 런타임 URL 매핑만 담당하며 해시·길이를 중복 기록하지 않는다.

## 두 번째 확장 배치 승인 5종

8종 후보를 청취한 사용자가 청국장·제육덮밥의 재시안을 요청하고 불고기덮밥은 현재 기본 문구와 음성이 다름을 확인한 뒤, 나머지에 대해 “나머지는 괜찮다”라고 승인했다. 따라서 아래 5종만 원본을 무덮어쓰기 복사해 이 단계의 런타임에 연결했다. 불고기덮밥은 이 배치에서는 `audioUrl: null`을 유지했고, 후속 2단계 블라인드 최종 승자를 별도로 통합했다. 제육덮밥은 후속 교체 배치 청취 뒤, 청국장은 원본 말미 감쇠 A/B 비교 뒤 각각 별도로 승인했다.

| 메뉴 | 승인 문구 | 선정 `sourcePreviewPath` | 크기 | 실제 길이 | SHA-256 |
|---|---|---|---:|---:|---|
| 돼지국밥 | 돼지국밥 한술에 부산 도착! | `tmp/narration-preview/full-batch-02/dwaeji-gukbap.mp3` | 38,880 B | 1.944초 | `46798287828F7F991835FFF7D532B64A3F46A4DAB0B8207607427A9DDE452B66` |
| 순대국 | 순대국 든든 버프 풀충전! | `tmp/narration-preview/full-batch-02/sundae-guk.mp3` | 51,360 B | 2.568초² | `386B15214E6FE6A07530F1D4ED6BE4032EFBAC2CECE522A409730B882B865922` |
| 집밥백반 | 백반 한상 반찬 슬롯 만렙! | `tmp/narration-preview/full-batch-02/home-style-baekban.mp3` | 47,040 B | 2.352초² | `179D4F0056E9B41843AABFA46BCC13C0CA4C1E79D99177AC8F076D1F8BDC36EC` |
| 비빔밥 | 고추장 아래 만민평등! | `tmp/narration-preview/full-batch-02/bibimbap.mp3` | 36,000 B | 1.800초 | `ADCA8D1CCAFF1856EF75BB2ED35A4B50EE23129DDD0E73390243A553BE776DA4` |
| 치킨마요덮밥 | 치킨마요 소스줄은 생명줄! | `tmp/narration-preview/full-batch-02/chicken-mayo-deopbap.mp3` | 40,800 B | 2.040초² | `7F98D7CD654836EA3F788F78777551DE3C6F82C3C14B7FD48CBC6B8932467F3C` |

² 순대국·집밥백반·치킨마요덮밥은 자동 QA의 2.0초 검토 기준을 넘지만 사용자가 실제로 듣고 승인한 선택본이다. 정확한 승인 문구·source·바이트·실제 길이·SHA-256은 `scripts/narration/fullBatch02ApprovedAudioSelections.mjs`에 고정했다.
## 교체 배치 제육덮밥 승인 1종

사용자는 새 후보와 이전 후보를 비교한 뒤 “제육덮밥은 새 음원이 나아”라고 승인했다. 아래 파일만 `replacement-batch-01`에서 무덮어쓰기 복사했다. 같은 교체 배치의 청국장 원본 후보·불고기덮밥·곰탕·파스타·샤부샤부는 당시 연결하지 않았으며, 청국장 활성본은 별도의 `full-batch-02` 원본 말미 감쇠 B다. 파스타·불고기덮밥은 이후 별도 표현형 pilot과 2단계 블라인드를 거쳐 승인됐다.

| 메뉴 | 승인 문구 | 선정 `sourcePreviewPath` | 크기 | 실제 길이 | SHA-256 |
|---|---|---|---:|---:|---|
| 제육덮밥 | 제육덮밥 메뉴 고민 강제 종료! | `tmp/narration-preview/replacement-batch-01/jeyuk-deopbap.mp3` | 43,680 B | 2.184초³ | `96A12781D4278EB221BDC925D7B9F8AF92AC7F65716A252C1D0759B217E9EC3F` |

³ 2.184초로 자동 QA의 2.0초 기준을 넘지만 실제 청취 비교로 승인했다. source·바이트·91개 MPEG frame·실제 길이·해시·승인 원문은 `scripts/narration/replacementBatch01ApprovedAudioSelections.mjs`에 고정했다.
## 청국장 말미 감쇠 B 승인 1종

사용자는 `full-batch-02` 청국장 원본의 말미 음량을 낮춘 A/B를 비교한 뒤 “청국장은 B가 좋아”라고 승인했다. B는 1.7725–2.4175초 구간의 MPEG Layer III `global_gain`을 24ms 진입·이탈로 조정했다. 요청 -5 dB는 무손실 1.5 dB 양자화 단위에 따라 실제 -4.5 dB로 적용됐으며, 원본과 같은 110 frame·2.640초·24kHz mono·160kbps를 유지한다. 단어 정렬 정보가 없으므로 조정 구간을 특정 단어라고 단정하지 않는다.

| 메뉴 | 승인 문구 | 선정 `sourcePreviewPath` | 크기 | 실제 길이 | SHA-256 |
|---|---|---|---:|---:|---|
| 청국장 | 청국장 향부터 어그로 만렙! | `tmp/narration-preview/cheonggukjang-punch-adjust-01/cheonggukjang-terminal-minus-5db.mp3` | 52,800 B | 2.640초⁴ | `9029284574B771A2042FCFE6804AB1633F1137C91D4F49D635E5871D99902874` |

⁴ 자동 QA의 2.0초 기준을 넘지만 사용자가 비교 청취로 승인했다. 원본·조정 manifest, 실제 적용 감쇠, source·바이트·110 MPEG frame·길이·해시·승인 원문은 `scripts/narration/cheonggukjangPunchAdjustedApprovedAudioSelection.mjs`에 고정했다. 로컬 조정에는 Azure·네트워크 호출이 없었다.

## 샤부샤부 양끝 무음 trim 승인 1종

사용자는 slow-retake의 발화를 듣고 “샤부샤부 좋아 맘에들어”라고 승인했다. Chrome WebAudio 24kHz mono 디코딩 기준 -40dBFS active 경계의 앞 75ms·뒤 135ms를 남기고 양끝 무음 275ms·132ms만 제거했다. 5ms fade는 보존된 경계 무음에만 적용했으며 active 발화 38,760 Float32 sample은 source와 sample별 완전히 동일하다. 결과는 브라우저에서 직접 디코딩 가능한 IEEE 32-bit float WAV다.

| 메뉴 | 승인 문구 | 선정 `sourcePreviewPath` | 크기 | 실제 길이 | SHA-256 |
|---|---|---|---:|---:|---|
| 샤부샤부 | 채소도 먹었다고 주장 가능합니다! | `tmp/narration-preview/shabu-shabu-silence-trim-01/shabu-shabu-trimmed.wav` | 175,244 B | 1.825초⁵ | `A6C3C08897A015C0CC973EAD300A69F3456DE1A835B4673F594B60E64504A2FA` |

⁵ -40dBFS 기준 active 발화는 1.490초, 최장 내부 gap은 65ms로 목표를 통과한다. 원본 2.232초에서 결과 1.825초로 줄었고 peak -0.462dBFS·clipping 0을 유지했다. exact source/output hash·sample 구간·PCM 보존 hash·승인 원문은 `scripts/narration/shabuShabuSilenceTrimApprovedAudioSelection.mjs`에 고정했다. 분석 경계는 음향 threshold 기준이며 단어 정렬 정보는 없다.

## 곰탕 내부 공백 trim 승인 1종

사용자는 현재 문구의 slow-retake 발화에 대해 먼저 “곰탕도 발화부분은 괜찮은 거 같아”라고 평가했고, 두 긴 내부 저에너지 구간만 줄인 WAV를 듣고 “곰탕은 맘에들어.”라고 최종 승인했다. Chrome WebAudio 24kHz mono Float32 PCM 기준 560ms·405ms 구간의 저에너지 중심 426.208ms·269.375ms를 제거해 약 133.792ms·135.625ms를 남겼다. 보존한 모든 PCM segment의 source/output SHA-256은 같고 sample mismatch는 0이다. 정규화·재샘플링·fade는 적용하지 않았으며 join delta는 각각 1.81e-6·2.12e-6이다.

| 메뉴 | 승인 문구 | 선정 `sourcePreviewPath` | 크기 | 실제 길이 | SHA-256 |
|---|---|---|---:|---:|---|
| 곰탕 | 곰은 없어도 곰처럼 든든! | `tmp/narration-preview/gomtang-gap-trim-01/gomtang-gap-trim-01.wav` | 225,876 B | 2.352초⁶ | `1148C05A7A088B5D59255C97DBF6252210E1E0437EA3A531434FAE0FDF2FDDB8` |

⁶ -45/-40dBFS 기준 최장 내부 gap은 135/140ms다. 전체 길이는 2.0초 기준을 넘지만 사용자가 실제 후보를 듣고 승인했다. source·output·manifest·PCM hash, 제거 sample 구간, 승인 원문은 `scripts/narration/gomtangGapTrimApprovedAudioSelection.mjs`에 고정했다. 에너지 경계는 단어 정렬이 아니며 로컬 편집에 Azure·네트워크 호출은 없었다.

## 파스타·불고기덮밥 최종 재시안 거절 이력

현재 카탈로그 문구로 생성한 `final-retake-batch-01` 원본과 긴 내부 저에너지 구간만 줄인 로컬 WAV를 비교 청취했지만, 사용자는 파스타와 불고기덮밥 두 후보를 모두 거절했다. 파일은 재현·감사 provenance로만 `tmp/narration-preview/`에 보존하고 `src/assets/narration/`, 활성 ID, 정적 URL map에는 포함하지 않는다. 거절 상태와 raw/local candidate SHA-256은 `scripts/narration/finalRetakeGapTrimRejectedAudioSelections.mjs`에 고정했다.

| 메뉴 | raw 최종 재시안 | 로컬 gap-trim 후보 | 상태 |
|---|---|---|---|
| 파스타 | `final-retake-batch-01/pasta.mp3` · `6446A97C…EAF7` | `pasta-gap-trim-01/pasta-gap-trim-01.wav` · `21585115…EBEC` | 해당 후보 거절·미배포 |
| 불고기덮밥 | `final-retake-batch-01/bulgogi-deopbap.mp3` · `ED24EC06…A5E1` | `bulgogi-deopbap-gap-trim-01/bulgogi-deopbap-gap-trim-01.wav` · `3955599A…CCC9` | 해당 후보 거절·미배포 |

## 파스타·불고기덮밥 2단계 블라인드 최종 승인

위의 초기 `final-retake-batch-01` raw와 로컬 gap-trim 거절 이력은 그대로 유지한다. 그 뒤 Flash/Full과 한 블록/인접 두 블록 후보를 새로 합성해 1차 블라인드에서 문구별 결선 2개를 고르고, 2차 결선에서 두 메뉴 모두 R을 선택했다. 최종 선택 원문은 “둘다 R이 더 자연스럽고 어떤 단어에 강세를 줘야 할지, 어떻게 이어나가야 할 지 아는느낌이야. 자연스러워”다. 두 파일은 정규화·trim·transcode 없이 공개 결선 파일과 byte-identical한 raw MP3로 새 자산명에 무덮어쓰기 복사했다.

| 메뉴 | 활성 자산·생성 원본 | voice·구조 | 크기 | 실제 길이 | SHA-256 |
|---|---|---|---:|---:|---|
| 파스타 | `src/assets/narration/pasta-final-tiebreak.mp3` · `tmp/narration-preview/replacement-pilot-02/pasta-B.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.56 · +22% · 인접 두 블록/no break · 104 MPEG frame | 49,920 B | 2.496초 | `EDB4D142066DDCC6C75D7B58AD9FBB6D2AB85D7CE562CBBDEB6A824854947431` |
| 불고기덮밥 | `src/assets/narration/bulgogi-deopbap-final-tiebreak.mp3` · `tmp/narration-preview/replacement-pilot-02-mai-voice-2/bulgogi-deopbap-A.mp3` | `ko-KR-Junho:MAI-Voice-2` · joyful 0.60 · +28% · 한 블록 · 77 MPEG frame | 36,960 B | 1.848초 | `B37C038201C660C6FB58CF0345D017526E074EF900914B835441106A9909D1BD` |

생성 manifest, 1차·2차 봉인 reveal map, 각 공개 후보와 활성 자산의 바이트·SHA-256, 모델·구조, 승인 원문은 `scripts/narration/finalTiebreakApprovedAudioSelections.mjs`에 고정했다. 이 결과는 메뉴 2개와 각 조건 1 take의 최종 제작물 선택이다. 파스타의 Flash/두 블록 선택이나 불고기덮밥의 Full/한 블록 선택을 전체 모델 또는 구조의 일반적 우월성으로 해석하지 않는다.

## Remaining batch G1·G2와 칼국수 재합성 승인

G1 승인 원문은 “너무 괜찮아, 그동안 만들던 방식중 이렇게 모두 퀄리티가 괜찮게 나온 적은 처음이라 굉장히 만족스러워, 김치볶음밥 처음 빈 공백 편집해서 줄이기만 하면 될 거 같아.”이며, 김치볶음밥 voice 고정 원문은 “특히 김치볶음밥의 여자 목소리는 매우 자연스러워서 좋은 거 같아.”다. G2 승인 원문은 오탈자까지 포함해 “칼국수 뺴고 나머지 전부 괜찮아 승인할게. 칼국수는 문구를 바꾸자. "칼은 위협용" 으로 문구 바꿔서 재생성 해줘”다. 새 retake 승인 원문은 “괜찮아 승인할게 다음꺼도 얼른 진행하자”다.

활성 14종의 정확한 파일명·source·바이트·길이·SHA-256·모델·profile 표는 `docs/source/ai-usage.md`의 “AI 합성 음성 보존 이력”에 기록하고, 기계 판독 provenance는 `scripts/narration/remainingBatch01Group1ApprovedAudioSelections.mjs`, `scripts/narration/remainingBatch01Group2ApprovedAudioSelections.mjs`, `scripts/narration/kalguksuCopyRetake01ApprovedAudioSelection.mjs`에 고정했다. 김치볶음밥 WAV는 앞 24,194 sample만 제거하고 tail·fade·gain·normalize·resample 없이 retained PCM을 bit-exact 보존했다. 짬뽕 3.432초 raw take는 자동 길이 기준을 넘지만 사람이 청취 승인한 예외다. 구 칼국수 “칼은 이름에만, 국물은 따뜻!” 후보는 77,760 B·3.888초·SHA-256 `5AB16C2DF6ED341A498FA2D00DB3DDC0C90A5EC22968A27918043FED16E3438C`로 거절·미배포 상태를 유지하고, 새 “칼은 위협용!” retake 28,320 B·1.416초·SHA-256 `B01D2033A30E36F6F30C0D4F73B3FA23673EAEA6B9605512720394898A506F25`만 활성화했다.

## Remaining batch G3 최초 승인 5종·후속 햄버거·떡볶이 승인

G3 최초 승인·보류 원문은 `떡볶이는 앞에 "떡볶"이가 안들리고 앞부분이 짤린거 같아. 떡볶이는 짤린거 말고는 괜찮아. 햄버거는 햄부기 3번 반복하는데 더 빠르게 반복해줘. 이 둘 말고는 괜찮아`다. “이 둘 말고는 괜찮아”에 따라 당시에는 아래 5종만 후처리 없이 source와 byte-identical한 raw MP3로 활성화했다. 햄버거와 떡볶이는 그 뒤 각각 별도 후보 청취와 명시적 승인을 거쳐 아래 현재 활성 표에 추가됐다.

| 메뉴 | 활성 자산·선정 `sourcePreviewPath` | voice·profile | 크기 | 실제 길이 | SHA-256 |
|---|---|---|---:|---:|---|
| 김밥 | `src/assets/narration/gimbap-remaining-batch-01.mp3` · `tmp/narration-preview/remaining-batch-01/gimbap.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.48 · +18%/-1% · 한 블록 | 40,320 B | 2.016초 | `3D1948080A77B27876D9DF1BFB7F96A7A3D2746E9117037163B8A7BFCF69497D` |
| 샌드위치 | `src/assets/narration/sandwich-remaining-batch-01.mp3` · `tmp/narration-preview/remaining-batch-01/sandwich.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.48 · +22%/-1% · 인접 두 블록 | 54,720 B | 2.736초 | `A2F7BFB4D6EF6AEB4448534E6001D5DE4F432DE2DC1EF4C4BEDEE8DD552D8760` |
| 길거리 토스트 | `src/assets/narration/korean-toast-remaining-batch-01.mp3` · `tmp/narration-preview/remaining-batch-01/korean-toast.mp3` | `ko-KR-Haena:MAI-Voice-2-Flash` · joyful 0.46 · +20%/-1% · 한 블록 | 56,160 B | 2.808초 | `A019F0DDEB0A7282419F124042514A17599662CFB691E10465B398BC0CA81DE0` |
| 떡볶이 | `src/assets/narration/tteokbokki-onset-retake-b.mp3` · `tmp/narration-preview/tteokbokki-onset-retake-01/B.mp3` | `ko-KR-Haena:MAI-Voice-2-Flash` · joyful 0.50 · +12%/+22% · 인접 두 블록 · 100ms preroll · B · 135 MPEG frame | 64,800 B | 3.240초 | `6B6B9AE5B73AE5AFE86EBE8DBBCF4A4347674F889597A9FA8B721F6C3391CF87` |
| 햄버거 | `src/assets/narration/hamburger-fast-repeat-trim.wav` · `tmp/narration-preview/hamburger-fast-repeat-trim-01/hamburger-fast-repeat-trim-01.wav` | `ko-KR-Haena:MAI-Voice-2-Flash` · joyful 0.42 · +16%/-2% · 한 블록 · 두 내부 저에너지 중심 trim | 224,244 B | 2.3354166666666667초 | `DB5ABA82C39A1C5EBAA5C0F417B6394815ACE3A4710BF527C240B6AF0AA3A35F` |
| 삼겹살 | `src/assets/narration/samgyeopsal-remaining-batch-01.mp3` · `tmp/narration-preview/remaining-batch-01/samgyeopsal.mp3` | `ko-KR-Junho:MAI-Voice-2` · joyful 0.40 · +22%/-1% · 한 블록 · neutral/no impersonation | 39,360 B | 1.968초 | `FAD7E255933AD9BAFA538CD0FB5B35C43C6FAA8288E8E589A2086F090E081E36` |
| 갈비구이 | `src/assets/narration/grilled-galbi-remaining-batch-01.mp3` · `tmp/narration-preview/remaining-batch-01/grilled-galbi.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.48 · +20%/-1% · 인접 두 블록 | 35,520 B | 1.776초 | `88125BF703A2A4E6915ABA848227F2912B3B0EDD0880ED3262F70A964D3F7A92` |

G3 단계에서 떡볶이 raw source는 앞 “떡볶” onset이 잘린 문제로 `retake-requested-leading-copy-clipped`, 햄버거 raw source는 “햄부기” 3회 반복을 더 빠르게 해야 해 `retake-requested-faster-repetition`이었다. 둘 다 당시 inactive/pending·source-only·raw-withheld였고, 그 시점의 `src/assets/narration/` 물리 44개와 `dist/` 41개에는 포함하지 않았다. 이 역사적 상태와 exact parent manifest·source hash는 `scripts/narration/remainingBatch01Group3ApprovedAudioSelections.mjs`에 그대로 고정했다.

이후 햄버거 로컬 trim을 들은 사용자가 `햄버거도 승인할게`라고 승인했다. 활성 `hamburger-fast-repeat-trim.wav`는 IEEE 32-bit float PCM·24kHz mono·56,050 sample이며, 원본 `remaining-batch-01/hamburger.mp3` 83,520 B·174 MPEG frame·4.176초·SHA-256 `CB0977A8A37F398974AC49675E944BA3FF25A44252746014467A814F486E7219`에서 sample 구간 `[15346,40445)`, `[56938,76013)`만 제거했다. schema 1 trim manifest는 9,898 B·SHA-256 `434EA7754878CB2AFFE8C7C6C528361A88990B062060EC0DFE4AD508CC0ABD07`, 결과 PCM SHA-256은 `77B1F1DF1593D62BB14BEA23E8E8407E3D8EC047AAD1FEF458B23025E576F3D0`다. retained PCM은 bit-exact이고 fade·normalize·resample·gain·추가 Azure 요청이 없으며 Chrome WAV 재디코딩 mismatch도 0 sample이다. 정확한 계약은 `scripts/narration/hamburgerFastRepeatApprovedAudioSelection.mjs`에 고정했다.

떡볶이는 위 onset 피드백 뒤 같은 Haena Flash·joyful 0.50·-1%·인접 두 블록·100ms preroll 조건에서 첫 블록 rate만 달리해 A `+22%/+22%`와 B `+12%/+22%`를 생성했다. 사용자의 최종 원문은 `B 승인`이다. A는 57,120 B·119 MPEG frame·2.856초·SHA-256 `3363427C60805BFD84E244F33F35772E214FAA53C524F8167B20F6E3F178581D`인 historical rejection으로 미배포 보존하고, B만 preview와 byte-identical한 64,800 B·135 frame·3.240초 raw MP3로 활성화했다. schema 2 생성 manifest는 4,819 B·SHA-256 `3A343828E04C68E5FB5438CE7F372196A6A035B34CD08C3BEC3AC0AF79C093F1`이며 trim·normalize·transcode 등 후처리는 없다. A rejection·B source/target hash·승인 원문은 `scripts/narration/tteokbokkiOnsetRetakeApprovedAudioSelection.mjs`에 고정했다. 현재 물리 파일은 53개이고 릴리스 빌드의 `dist/` 기대 payload는 활성 음원 50개이며 `audioUrl: null`인 메뉴는 없다.

## Remaining batch G4 승인 6종·족발 retake 최종 승인

G4 승인·수정 원문은 `족발은 "발을 먹는데? 손이 더 바쁘다" 에서 "더"가 빠졌어 중요한 요소야 수정해줘.  나머지는 다 맘에 들어`다. “나머지는 다 맘에 들어”에 따라 아래 6종은 `remaining-batch-01` preview와 byte-identical한 raw MP3로 활성화했다. source manifest는 42,007 B·schema 2·SHA-256 `C2A6A2846C37A76C1FCF4A8E7F1E7F6255248D007D0712288EC934736CBF107E`이며, 후처리·추가 Azure 요청은 없다.

| 메뉴·문구 | 활성 자산·선정 source | voice·profile | 크기 | 실제 길이 | SHA-256 |
|---|---|---|---:|---:|---|
| 닭갈비 · 닭은 있는데 갈비는 어디 갔지? | `src/assets/narration/dakgalbi-remaining-batch-01.mp3` · `tmp/narration-preview/remaining-batch-01/dakgalbi.mp3` | `ko-KR-Junho:MAI-Voice-2` · joyful 0.44 · +20%/-1% · 한 블록 | 36,960 B | 1.848초 | `2F196CF507647193E0A71C8E1949249769D87EBD1372D1EEEB4C28024656201F` |
| 보쌈 · 배추가 고기를 보쌈했다! | `src/assets/narration/bossam-remaining-batch-01.mp3` · `tmp/narration-preview/remaining-batch-01/bossam.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.46 · +20%/-1% · 한 블록 | 48,480 B | 2.424초 | `B081A8348CA13C6A9B36DA3D8A8EF595AF674F37ED835AE58CB99BE2F336A26A` |
| 족발 · 발을 먹는데? 손이 더 바쁘다! | `src/assets/narration/jokbal-copy-retake-01.mp3` · `tmp/narration-preview/jokbal-copy-retake-01/jokbal.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.48 · +22%/+0% · 한 블록 · 108 MPEG frame | 51,840 B | 2.592초 | `94D19FF391315524B09503A6962E13418FE5DD97ED098D7D9C9E116756B2B23D` |
| 불고기 · 엄마 물고기 말고 불고기! | `src/assets/narration/bulgogi-remaining-batch-01.mp3` · `tmp/narration-preview/remaining-batch-01/bulgogi.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.48 · +20%/-1% · 인접 두 블록 | 42,720 B | 2.136초 | `3E396073B5888176DE9BF942C9093E2C43CB5106F2CA9F78A1DC77AB010B4922` |
| 치킨 · 반반은 우유부단이 아니라 지혜다! | `src/assets/narration/fried-chicken-remaining-batch-01.mp3` · `tmp/narration-preview/remaining-batch-01/fried-chicken.mp3` | `ko-KR-Junho:MAI-Voice-2` · joyful 0.48 · +26%/-1% · 한 블록 | 52,800 B | 2.640초 | `F7C65BFB9379E60767012B532A4C4FB91BD303F3F4B467CDDD1DEC46BBC1FAC7` |
| 피자 · 피자 먹고 팔자 피자! | `src/assets/narration/pizza-remaining-batch-01.mp3` · `tmp/narration-preview/remaining-batch-01/pizza.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.46 · +18%/+0% · 인접 두 블록 | 43,200 B | 2.160초 | `22995289B0EAA4F3902520000CA6E4D8D4A8F42A1E09099B918986A1197EB671` |
| 닭한마리 · 메뉴 이름이 설명서다! | `src/assets/narration/dak-hanmari-remaining-batch-01.mp3` · `tmp/narration-preview/remaining-batch-01/dak-hanmari.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.46 · +18%/-1% · 한 블록 | 40,800 B | 2.040초 | `E87B251F72191AD9841E984DA0A2D16E23C5D17AD70E95AF9AF8C13DF7C4C2EC` |

정확한 6종 source/target identity와 당시 족발 보류 이력은 `scripts/narration/remainingBatch01Group4ApprovedAudioSelections.mjs`에 고정했다. 구 족발 raw는 문구 `발을 먹는데 손이 바쁘다!`인 `remaining-batch-01/jokbal.mp3` 54,720 B·114 frame·2.736초·SHA-256 `9D4505FE633998516A2AABE750920CE2CD14E98709CE87512D67B674D24966BD`이며 핵심 단어 “더” 누락으로 거절·미배포 상태다. 현재 문구 retake의 source manifest는 3,359 B·schema 2·SHA-256 `E33C781E071BEB700426FC2C03D7079033844EC4DD3991230853BBFA77C22F41`이며 생성 시점에는 `runtimeIntegrationAttempted: false`·`listeningReviewRequired: true`였다.

후속 직접 청취에서 사용자는 정확히 `족발 승인할게`라고 승인했다. 자동 검수의 question→punch 목표 180–420ms와 reject 기준 500ms에 대해 실제 gap은 520–535ms였지만, 최종 승인을 근거로 사람이 예외 승인했다. 두 번째 구절의 상대 음량은 -1.2~-0.9dB이고 소리치는 후보로 판정하지 않았다. preview와 byte-identical한 stable 자산을 후처리·추가 Azure 요청 없이 활성화했으며, exact source/target·manifest·구 raw rejection·이전/최종 승인 원문·gap override는 `scripts/narration/jokbalCopyRetake01ApprovedAudioSelection.mjs`에 고정했다.

## 초기 중립 음성 절차의 역사적 위치

`scripts/narration/generate-azure-speech.mjs`와 `ko-KR-SunHiNeural` 설정은 대표 6문장의 최초 발음·연결 확인을 위해 만든 중립 낭독 파일럿이다. 기본 드라이런, `--execute` 전용 호출, 무덮어쓰기·무재시도·키 비노출 안전장치를 검증하는 데 사용했지만, 결과가 평이해 문구의 강세와 유머를 살리지 못했으므로 초기 승인 6개 배포 음원에는 포함하지 않았고, 현재 50개 정적 음원에도 포함하지 않는다. 현재 최종 음원을 다시 만드는 기준은 위의 MAI 표현형 스크립트와 보존된 manifest다.

## 최종 런타임 동작

- 현재 판의 20종 덱 중 승인 음원이 연결된 메뉴만 게임 시작 전에 선로딩한다.
- 로드·디코딩 실패는 게임 시작을 막지 않고 자막만 표시한다.
- 나레이션은 한 번에 하나만 재생하며 새 음식이 등장하면 이전 음성을 정리한다.
- 음성이 실제 재생되는 동안에는 BGM을 약 -14.0dB로 낮추고, 효과음 순간에는 약 -17.5dB로 짧게 낮춘다. 효과음 출력은 +6.0dB, 나레이션 bus는 -2.4dB 재조정해 세 요소의 체감 균형을 맞춘다.
- 각 기기 사용자가 나레이션을 켜고 끌 수 있으며, 말풍선 자막은 음성 설정과 무관하게 표시된다.

## 합성 음성 고지 완료

Microsoft의 공식 [합성 음성 공개 설계 지침](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/speech-service/text-to-speech/concepts-disclosure-guidelines)에 따라 게임 방법에 `data-testid="ai-voice-disclosure"`로 다음 문구를 표시한다.

> 이 게임의 일부 음식 나레이션은 Microsoft Azure AI Speech로 생성한 AI 합성 음성입니다. 실제 인물의 녹음이나 성대모사가 아닙니다.

음성 복제나 실존 인물·캐릭터 성대모사는 사용하지 않았다. 자동 E2E로 일반 홈의 게임 방법을 열었을 때 고지가 보이고 정확한 문구가 유지되는지 확인했다.
