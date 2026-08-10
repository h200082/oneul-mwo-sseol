# AI 활용 기술 문서

> 작성 기준일: 2026-08-10
> 대상 프로젝트: **뭐 먹을 거냥?** 실제 음식 알파 실루엣 베기·음식 이미지 50종·AI 합성 나레이션 활성 50종·모바일 멀티플레이 프로토타입

## 1. 프로젝트 및 AI 활용 개요

- 게임 제목: 뭐 먹을 거냥?
- AI 활용 목적: 기획 구체화, 웹 프로젝트 구성, 핵심 알고리즘 구현 보조, 테스트 설계, 제출 문서화
- 핵심 활용 영역: 게임 규칙 정리, 음식 이미지 50종 생성·교정·투명 WebP 후처리, 실제 음식 알파 실루엣 기반 완화 베기·길게 누르기 포획 판정, 덱 20종 선로딩, 홈의 별도 비채점 베기·포획 튜토리얼, 이동 중 입력과 모바일 취소 처리, 첫 실행 ON·명시적 OFF 저장을 적용한 효과음·BGM·진동·나레이션 설정, 음식별 나레이션 문구 50종·고양이 말풍선·사전 생성 AI 합성 음성 활성 50종, 방·대기실 규칙, QR 초대·스캔 흐름, 로컬 멀티탭과 Firebase 실제 기기용 동기화, 공동 결과 집계, 보안 규칙 테스트, 브라우저 테스트, GitHub Pages 배포 준비

현재 게임 실행 중에 생성형 AI 모델이나 외부 AI API를 호출하지 않는다. Azure AI Speech는 제작 단계에서 후보 MP3를 사전 생성하는 데만 사용했고, 현재 릴리스 빌드의 `dist/` 기대 payload는 현재 문구와 일치하는 정적 MP3·WAV 음원 50개다. `src/assets/narration/`의 물리 파일 53개는 활성 50개와 historical 3개이며, 활성 모델 구성은 Flash 계열 45개와 Full 5개, 물리 파일 구성은 Flash 계열 48개와 Full 5개다. 샤부샤부는 현재 문구의 무음 trim WAV, 곰탕·햄버거는 현재 문구의 내부 gap-trim WAV, 김치볶음밥은 leading-only bit-exact PCM trim WAV를 활성화했고 떡볶이 onset retake B·족발 copy retake·파스타·불고기덮밥과 그 밖의 remaining-batch 승인본은 정적 raw MP3를 활성화했다. 브라우저 런타임에는 Azure 키·엔드포인트·Speech SDK가 없다. AI는 제작 과정의 보조 도구로 사용했으며, 게임 규칙과 최종 반영 여부는 사람이 결정했다.

## 2. 사용 도구

| 도구·모델 | 사용 목적 | 사용 시기 |
|---|---|---|
| Codex | 기획 검토, 코드 초안·수정, 테스트 작성, 오류 원인 분석, 문서화 | 개발 전 과정 |
| Codex 내장 ImageGen | 음식 이미지 50종 제작: 기존 승인 8종 유지, 신규 생성·교정 42종 | 2026-08-01 비주얼 수직 슬라이스, 2026-08-08 비원형 확장·50종 최종 통합 |
| Microsoft Azure AI Speech Standard S0 · MAI-Voice-2-Flash(public preview)·MAI-Voice-2 | `southeastasia`에서 한국어 표현형 나레이션 후보 생성: `ko-KR-Haena:MAI-Voice-2-Flash`, `ko-KR-Junho:MAI-Voice-2-Flash`, `ko-KR-Junho:MAI-Voice-2` | 2026-08-09~10 A/B 파일럿·확장 배치·선택적 재시안·로컬 파생본·2단계 블라인드·remaining-batch를 거쳐 물리 파일 53종 보존, 현재 50종 통합 |
| Pillow 12.3.0·로컬 크로마키 제거 도구 | 크로마키 제거, 알파 외곽 크롭, 종횡비 보존 리사이즈, 투명 WebP 인코딩·용량 검사 | 2026-08-08 음식 이미지 50종 최종 통합 |

Azure 음성 모델과 정확한 voice ID는 위 표에 확정 기록했다. Codex·ImageGen의 세부 모델 표기는 실제 작업 기록과 제공 화면에서 확인 가능한 범위만 최종 PDF에 기재한다.

## 3. 기술 구조와 AI 지원 범위

| 영역 | 주요 파일 | 구현 내용 | AI 지원 후 사람의 검토 |
|---|---|---|---|
| 기하 판정 | `src/domain/geometry.ts`, `src/domain/gestureClassifier.ts`, `src/domain/alphaSilhouette.ts`, `src/domain/silhouetteGestureClassifier.ts` | 실제 음식 알파 접촉·가중 면적 분할, 양끝 최대 32px 보정, 이동 대상 접촉 경로와 화면 드래그 방향 분리, 이미지 로드·마스크 생성 실패 시 원형 폴백 | 50:50·편심·오목형·투명 틈·얇은 부속·같은 쪽 선·짧은 탭·접선·루프·offset/scale 경계 테스트 검토 |
| 게임 규칙 | `src/domain/gameRules.ts` | 20개 비복원 추출, 최대 2회 포획, 미포획 메뉴 평균 점수, 공동 순위, 초·중·후반 낙하 속도 곡선 | 확정 기획과 일치하는지 규칙별 테스트 검토 |
| 메뉴 데이터 | `src/data/menus.ts`, `src/data/menuVisualManifest.ts`, `src/data/menuVisuals.ts`, `src/game/gameDeck.ts` | 한국 일상식 50개와 이미지 50종을 일대일 매핑하고, 게임과 선로더가 같은 시드 기반 20종 덱을 사용하며, 원본 비율을 보존하는 `contain` 크기와 128px 알파 마스크를 생성 | 카탈로그와 이미지 ID의 완전 일치·중복 없음, 비정사각 자산 수, 알파·크로마 잔여·모바일 용량, 덱 결정성·부분 선로딩·재시도 검토 |
| 플레이 화면 | `src/game/scenes/PrototypeScene.ts` | 50종 투명 음식의 실제 알파 판정, 로드 실패 시 원형 폴백, 멈춤 없는 드래그, 0.32초 길게 누르기 포획, 진행 링·에너지 끈, 양분 마스크, 비채점 베기 1회→포획 1회의 별도 튜토리얼과 완료·재시도·홈 이동 | 드래그 중 낙하, 투명 모서리 무효, 실제 몸통 성공, 14px 이동 전환, 포획 중 대상 잠금, 절단 방향, `touchcancel`, 튜토리얼이 점수·포획 슬롯·기록을 바꾸지 않는지 검토 |
| 앱 흐름 | `src/app/AppController.ts`, `src/app/GameHost.ts` | DOM 홈, 점심·저녁, 혼자하기, 별도 `튜토리얼 하기`, 방 생성·참가·이탈·대기실·카운트다운과 Phaser 연결; 일반 솔로·방은 자동 연습 없이 원래의 20개 라운드로 진입 | 느린 생성·참가 응답을 action token·화면 세대로 거부하고 요청 중 solo/tutorial/create/join을 함께 잠그며 일반 게임이 첫 실행 상태에 따라 우회하지 않는지 검토 |
| 방·대기실 | `src/domain/room.ts`, `src/rooms/` | 8자리 코드, 2~8인, 사용자 준비 버튼 없는 `waiting → preparing → started`, 잠긴 명단·공통 덱 시드·콘텐츠 버전, 기기별 제한 시간 프리로드와 자동 준비 완료, 전원 준비 후 공통 `startAt` 기준 4초 카운트다운, URL 유지, 동일 `playerId` 멱등 재접속, 시작 후 복귀, 방장 승계·마지막 이탈 삭제, 시작 기준 180초 결과 마감 | 준비 중 한 기기가 미완료면 시작하지 않고, 전원 준비 후에만 같은 시작 정보로 진입하는지와 대기실·게임·결과 대기 중 새로고침·마감 후 복귀를 E2E로 확인 |
| Firebase 백엔드 | `src/firebase/`, `firestore.rules` | 익명 인증 `uid`, Firestore 트랜잭션, 방·결과 실시간 구독, 허용 필드·상태 전이 보안 규칙 | 로컬 게이트웨이와 같은 계약을 유지하고 에뮬레이터에서 권한 경계를 검토 |
| 공동 결과 | `src/domain/roomResults.ts`, `src/domain/roomResultResolution.ts`, `src/app/AppController.ts` | 전원 결과 조기 공개, 서버가 180초+5초를 확인한 뒤 미제출 DNF, 0점 완주 우선, 1~8등·공동 순위, 포획 카드, 최다 중복 메뉴 | 실시간 스냅샷은 pending만 갱신하고 서버 권위 결과에서만 DNF가 생기는지 단위·Rules·두 클라이언트 E2E로 테스트 |
| QR 초대 | `src/rooms/roomInvite.ts`, `src/qr/QrScannerService.ts` | 실제 QR 생성, 초대 URL 파싱, `BarcodeDetector` 스캔과 링크·코드 대체 | 미지원·권한 거부·시간 초과 오류와 정규화 경로 검토 |
| 음식 나레이션 | `src/data/menuNarrations.ts`, `src/data/menuNarrationAudioManifest.ts`, `src/assets/narration/`, `src/feedback/SensoryFeedback.ts` | 음식 50종 자막·활성 MP3·WAV 50종, 첫 실행 ON·명시적 OFF 저장, 사운드 마스터 연동, 현재 덱 음원만 선로딩, 한 번에 하나만 재생, 152 BPM·128-step BGM, 나레이션 중 BGM 원음량 유지·효과음 순간 약 -36.6dB sidechain, 효과음 출력 +6.0dB·나레이션 bus -2.4dB 재조정, 게임 방법 AI 합성 음성 고지 | Haena·Junho Flash/Full 후보를 사람이 청취해 활성 50종을 선정하고 historical 3종을 보존; 저장된 OFF가 재실행 뒤 유지되는지와 source/target hash, 로드·디코딩 실패 fallback, 오래된 비동기 로드 차단, 키·SDK·런타임 Azure 호출 없음과 비성대모사를 검토 |
| 자동 검증 | `tests/`, `playwright.config.ts`, `firebase.json` | 단위 테스트, Firestore Rules 통합 테스트, 데스크톱·모바일 브라우저 검사 | 실패 원인을 확인하고 구현·규칙 또는 테스트 좌표를 수정 |
| 배포 | `.github/workflows/deploy-pages.yml` | 테스트·빌드 후 `dist/`를 Pages에 게시 | 공개 저장소 연결 후 실제 URL과 접근 권한을 사람이 최종 확인 |

## 4. AI 활용 내역

| 날짜 | 대상 | 요청·프롬프트 요약 | 생성 결과 | 검토·수정 및 실제 반영 |
|---|---|---|---|---|
| 2026-07-27 | 제출 환경 | 필수 제출물 5종과 증빙 구조 구성 | 체크리스트, PDF 원본, 로그 템플릿 | 미정 항목을 임의 확정하지 않고 빈 상태로 유지 |
| 2026-07-27 | 최종 기획 | 최대 8인 메뉴 포획·베기 게임의 규칙과 결과 구조 정리 | MVP 게임 기획서 | 내기 유형·여행 모드를 제외하고 사용자 결정 반영 |
| 2026-07-27 | 개발 로드맵 | 기술 위험과 제출 순서를 단계별로 분해 | M0~M9 로드맵 | 코어 조작 검증을 멀티플레이보다 앞에 배치 |
| 2026-07-27 | 코어 프로토타입 | Phaser 웹 게임, 점수 알고리즘, 테스트와 Pages 기반 구현 | 실행 가능한 1인 프로토타입과 자동 테스트 | 브라우저 시각 확인, 예외 수정, 테스트 통과 후 반영 |
| 2026-07-27 | 방·대기실 2차 프로토타입 | 홈, QR 초대, 준비 없는 2~8인 방, 공통 시드 게임 시작·안정화 | DOM 앱 셸, 방 이탈·방장 승계 도메인, 게이트웨이, QR 서비스, 멀티탭 E2E | 느린 응답·미스 입력 상태 누수 방지 후에도 실제 기기간 Firebase는 미구현으로 분리 |
| 2026-07-31 | Firebase 방·공동 결과 3차 프로토타입 | 익명 인증, Firestore 트랜잭션·구독·보안 규칙, 동일 계약의 로컬 대체, 전원 공동 결과 화면 구현 | Firebase 게이트웨이·런타임 선택, 결과 도메인·UI, Rules 에뮬레이터 테스트 | 실제 프로젝트 구성값과 실기기 검증은 구현 완료로 오해하지 않도록 남은 작업으로 분리 |
| 2026-08-01 | 음식 비주얼 수직 슬라이스 | 5종 음식 스티커를 일관된 스타일로 생성하고 플레이·결과 화면에서 재사용 | 투명 WebP 5종, 공용 이미지 매핑, 초·중·후반 속도 곡선, 이미지 로드 테스트 | 원본을 직접 선별하고 크로마키 제거·크롭·512×512 정규화·용량 최적화 후 반영 |
| 2026-08-08 | Food Action Sticker v2 | 원형 그릇 중심 구도를 줄이고 베기마다 다른 실루엣을 제공 | 닭다리·날개 X형 치킨, 젓가락 면 리프트 라면 v2, 투명 WebP·게임 매핑·축소 가독성 검증 | 생성 결과를 직접 선별하고 112/68/47px로 축소 검토, 후속 실제 알파 판정의 기준 자산으로 사용 |
| 2026-08-08 | 실제 알파 실루엣·음식 6종 확장 | 그림과 보이지 않는 원 판정의 불일치를 제거하고 맛·외곽 다양성을 함께 확장 | 알파 가중 면적 판정, transparent-gap 방지, circle fallback, 갈비탕·오므라이스·김밥·샌드위치·떡볶이·백반 WebP | 원형 판정 유지 이유를 재검토한 뒤 베기만 실제 이미지 판정으로 교체하고 포획의 넓은 판정은 유지; 연결성·크로마·용량·브라우저 회귀 검증 |
| 2026-08-08 | 음식 이미지 50종 최종 통합 | 음식 식별성·먹음직스러움·비원형 실루엣·다양한 종횡비를 함께 만족하고, 게임마다 뽑힌 20종만 선로딩 | 기존 승인 8종 유지, 신규 생성·교정 42종, 50종 일대일 매니페스트, 투명 WebP 후처리·부분 선로딩 | 소수 묶음으로 사람 검수·교정을 반복하고 부자연스러운 도구·과도한 양·비위생적 넘침을 제외했으며 알파·용량·매핑·덱 일치 자동 검증 |
| 2026-08-03 | 형태 독립 제스처·피드백 5차 프로토타입 | 최종 음식 이미지는 나중에 50종을 한 번에 교체하고, 지금은 다양한 실루엣을 수용하는 판정·표시·연출 구조를 먼저 확정 | 순수 제스처 분류기, 공통 판정 원 전체 포획, 비율 보존 렌더링, 실제 절단선 양분 마스크, 포획 슬롯, 터치 취소 보호와 회귀 테스트 | 새 이미지를 생성·추가하지 않고 임시 이미지와 도형 폴백만 사용했으며, 마스크 이동·정리와 모바일 `touchcancel`까지 자동 검증 |
| 2026-08-03 | 길게 누르기 포획·완화 베기 6차 프로토타입 | 드래그 중 음식 정지를 제거하고, 엄격한 테두리 교차와 원 그리기 포획의 조작 피로를 낮춤 | 이동 대상 상대 경로와 화면 의도 방향 분리, 엄격·연장 베기 판정, 0.32초 길게 누르기, 14px 이동 시 베기 전환, 진행 링·에너지 끈 | 포획 대기 중 낙하를 유지하고, 사용자 피드백 뒤 `Back.In`의 역방향 정지점을 `Cubic.Out` 단조 이동으로 교체했으며 새 이미지는 생성하지 않음 |
| 2026-08-03 | 모바일 LAN 실행 오류 수정 | 휴대전화의 일반 HTTP LAN 주소에서 `혼자 하기`가 반응하지 않는 원인을 진단하고 방 흐름까지 같은 오류를 예방 | 보안 컨텍스트 전용 `crypto.randomUUID()` 직접 호출을 공용 UUID 도우미로 교체하고 `crypto.getRandomValues()` 폴백·단위·Pixel 7 E2E 추가 | 실제 비보안 LAN에서 API 부재, 캔버스 생성 1개, 페이지 오류 0건을 확인했으며 카메라 QR은 HTTPS가 필요하다는 경계를 유지 |
| 2026-08-04 | 결과 마감·미완주 안전망 | 이탈 참가자 때문에 공동 결과가 무기한 대기하는 P0 위험 제거 | 180초 파생 deadline, Firestore 서버 마감 sentinel, 5초 유예 뒤 권위 결과 조회, DNF 순위·빈 포획, 재접속 복구 | 0점 완주 우선·전원 DNF 내기 없음·부분 스냅샷 비확정·타이머 정리를 단위·Rules·두 클라이언트 E2E로 검토 |
| 2026-08-05 | 효과음·진동 피드백 | 외부 음원 없이 조작·판정의 손맛을 높이고 모바일 미지원 환경을 안전하게 처리 | 앱 수명주기 단일 AudioContext, 12개 의미 큐, 독립 설정 저장, Android 표준 진동, 홈·HUD 토글 | 당시 단계에서는 BGM·AI 밈 음성을 제외하고, 터치 `pointerup` 잠금 해제·백그라운드·결과 전환·미지원 fallback을 자동 검증 |
| 2026-08-09~10 | 음식별 AI 합성 나레이션 통합·문구 후속 교정 | 50종 자막을 유지하면서 문구의 유머와 강세를 살리는 대표 음원만 안전하게 정적 배포 | Azure S0 `southeastasia`의 Haena·Junho MAI-Voice-2-Flash/MAI-Voice-2 후보, 선택적 재시안·로컬 편집·2단계 블라인드·remaining-batch, 물리 파일 53종(활성 50·historical 3), 릴리스 `dist/` 기대 payload 활성 음원 50종, 덱 단위 선로딩·단일 재생·BGM 고정 레벨·효과음 sidechain·사용자 고지 | 평이한 SunHi 초기 시안과 거절 후보는 제외하고 사람이 발음·강세·재미를 비교; 칼국수 구 후보는 거절하고 새 문구 retake를 승인했다. G3의 햄버거·떡볶이 보류 뒤 각각 후속 승인했고, G4의 6종 승인과 족발 “더” 복구 retake의 직접 청취 승인까지 완료했다. 런타임 Azure 호출·키·SDK가 없음을 검증했다. |
| 2026-08-10 | 게임 시작·피드백 설정 UX 정리 | 첫 판 자동 연습으로 실전 진입이 지연되지 않게 하고, 조작 연습과 초기 피드백을 명확히 분리 | 일반 솔로·방의 원래 20개 즉시 진입, 홈 `튜토리얼 하기`, 비채점 베기→길게 누르기 포획, 완료·다시 연습·홈 이동, 효과음·BGM 마스터·진동·나레이션 첫 실행 ON과 명시적 OFF 저장 | 튜토리얼은 점수·포획 슬롯·게임 기록을 바꾸지 않고, 방의 `waiting → preparing → started` 준비 핸드셰이크에도 삽입되지 않으며, 저장된 OFF가 재실행 뒤 보존되는지 단위·E2E로 검토 |

상세 프롬프트와 작업별 판단은 `docs/evidence/ai-prompts/`에 보관한다.

## 5. 주요 프롬프트 및 지시 사례

### 사례 1: 게임 규칙을 테스트 가능한 코드로 분리

- 목적: 화면 연출과 무관하게 점수와 포획 규칙을 재현 가능하게 검증
- 사용 도구: Codex
- 주요 지시: “50개 메뉴에서 20개를 비복원 추출하고, 포획은 최대 2회이며 포획하지 않은 메뉴의 베기 점수만 총점 평균에 포함한다.”
- 생성 결과: 메뉴 덱, 라운드 결과, 평균 점수와 순위 계산을 순수 함수로 분리
- 사람의 검토: 포획 0·1·2회, 미스 0점, 공동 점수 사례를 테스트에 추가
- 반영 위치: `src/domain/gameRules.ts`, `tests/gameRules.test.ts`

### 사례 2: 초기 베기와 원형 포획 제스처 구현

- 목적: 초기 프로토타입에서 같은 드래그 입력을 열린 베기와 닫힌 포획으로 구분. 이 방식은 사례 6의 길게 누르기 포획으로 후속 교체했다.
- 사용 도구: Codex
- 주요 지시: “열린 선이 공통 판정 원을 가로지르면 실제 원 면적 분할 비율로 점수화하고, 단순 폐곡선이 판정 원 전체를 감싸면 포획한다. 닫혔지만 잘못 그린 경로를 베기로 오인하지 않는다.”
- 생성 결과: 선분·원 교차, 원호 면적, 판정 원 전체 포함, 순수 제스처 분류기
- 사람의 검토: 실제 드래그 궤적의 밖→안→밖 교차 구간을 사용하고, 퇴화·자기 교차·중심만 감싼 좁은 포획을 거부했다. 입력 도중 캔버스 이탈·창 포커스 상실·모바일 취소는 점수 없이 재시도하도록 수정했다.
- 반영 위치: `src/domain/geometry.ts`, `src/domain/gestureClassifier.ts`, `src/game/scenes/PrototypeScene.ts`

### 사례 3: 서버 연동 전 방 흐름과 경계 검증

- 목적: 실제 기기용 백엔드를 연결하기 전에 방 규칙, QR 초대, 공통 게임 시작을 검증
- 사용 도구: Codex
- 주요 지시: “준비 버튼 없이 2명부터 방장이 시작하고, 3초 뒤 모든 참가자가 같은 덱 시드와 20개 메뉴를 사용하게 한다. 우선 동일 출처 멀티탭으로 검증하되 Firebase 구현으로 오해되지 않게 한다.”
- 생성 결과: `RoomGateway` 추상화, `LocalRoomGateway`, 방 이탈·명단 재정렬·방장 승계·마지막 방 삭제, 8자리 코드·초대 URL·QR, `BarcodeDetector` 서비스, 멀티탭 E2E
- 사람의 검토: 미스 시 입력 상태 초기화와 느린 생성·참가 응답의 action-token 보호를 추가했다. 다른 기기에는 로컬 방이 없으며 Firebase 모듈 SDK·익명 인증·Firestore 구독·트랜잭션·보안 규칙·공동 결과 집계는 다음 단계로 남겼다.
- 반영 위치: `src/app/`, `src/domain/room.ts`, `src/rooms/`, `src/qr/`, `tests/e2e/room-flow.spec.ts`

### 사례 4: Firebase 방과 공동 결과를 같은 계약으로 연결

- 목적: 로컬 프로토타입의 방 규칙을 유지하면서 서로 다른 기기에서 참가·시작·결과 공개가 가능한 백엔드를 추가
- 사용 도구: Codex
- 주요 지시: “Firebase Anonymous Auth의 `uid`를 플레이어 ID로 사용하고, 방 생성·참가·이탈·시작은 Firestore 트랜잭션으로 처리한다. 결과는 참가자별 한 번만 제출하고 전원 도착 후 순위·공동 1등·최다 중복 메뉴·공동 꼴찌를 이미지형 카드로 보여준다. 로컬 게이트웨이는 계속 사용할 수 있게 한다.”
- 생성 결과: Firebase 환경 변수 검증과 동적 런타임 선택, `FirebaseRoomGateway`, 방 문서 코덱, 보안 규칙, 참가자별 결과 문서·실시간 구독, 순수 결과 집계 함수, 대기·요약 화면, 에뮬레이터 통합 테스트
- 사람의 검토: 인증 `uid`와 제출자 일치, 방장만 시작, 시작 후 명단 잠금, 결과 최초 제출 불변, 동점의 공동 순위, 빈 포획 슬롯, 최다 중복 공동 메뉴를 검토했다. 타인의 결과 작성과 기존 결과 변경은 막지만 본인이 보내는 점수·메뉴는 클라이언트를 신뢰하므로 부정행위 방지로 표현하지 않았다. Firebase 설정이 일부만 있으면 오류를 내고, 설정이 없거나 `local`을 선택한 경우에만 로컬 대체를 사용하도록 경계를 정했다.
- 반영 위치: `src/firebase/`, `src/bootstrap/createAppRuntime.ts`, `src/domain/roomResults.ts`, `src/rooms/`, `src/app/`, `firestore.rules`, `firebase.json`, `tests/`


### 사례 5: 이미지 형태와 판정을 분리

- 목적: 최종 음식 이미지가 원형이 아니어도 조작 난이도와 점수가 달라지지 않게 하고, 이미지 일괄 제작 전에 핵심 손맛을 검증
- 사용 도구: Codex
- 주요 지시: “이번에는 이미지를 생성하지 않는다. 음식은 가로형·세로형·불규칙형 실루엣을 허용하고, 나중에 50종을 한 번에 생성·교체할 수 있게 한다.”
- 생성 결과: 이미지 원본 비율 보존, 당시 이미지와 독립된 공통 판정 원, 실제 드래그 각도의 양분 마스크, 도형 폴백, 포획 슬롯과 경로 피드백. 이 원형 베기 판정은 비원형 자산 검증 뒤 사례 8의 실제 알파 실루엣 판정으로 후속 교체했다.
- 사람의 검토: 원형 스티커 배경을 제거하고 임시 5종과 여러 폴백 형태로 표시를 확인했다. 베인 복제 이미지와 절단 마스크를 같은 로컬 원점에서 같은 이동·회전에 동기화하고 효과 종료 후 필터·그래픽 정리를 검증했다.
- 반영 위치: `src/data/menuVisuals.ts`, `src/domain/gestureClassifier.ts`, `src/game/scenes/PrototypeScene.ts`, `tests/`
### 사례 6: 멈춤 없는 베기와 길게 누르기 포획으로 분리

- 목적: 드래그 중 음식이 멈추는 문제를 없애고, 테두리부터 테두리까지 정확히 지나야 하는 베기와 원 그리기 포획의 난도를 낮춤
- 사용 도구: Codex
- 주요 지시: “드래그 도중 음식이 멈추는 현상을 해결하고 베기 판정을 더 유하게 한다. 원을 그리는 포획은 베기와 겹치므로 더블클릭이나 꾹 누르기를 검토한다.”
- 생성 결과: 음식이 계속 낙하하는 포인터 상태 머신, 0.32초 길게 누르기 포획, 14px 이동 시 같은 입력의 베기 전환, 음식 양쪽을 거의 덮은 경로의 양끝 최대 32px 보정, 진행 링·에너지 끈, 이동 대상 상대 경로와 화면 드래그 방향 분리, 포획 확정 직후 슬롯 방향 `Cubic.Out` 이동
- 사람의 검토: 더블클릭은 두 탭 사이에 음식이 이동해 두 번째 명중이 어려워 제외했다. 포획 대기 중 일시정지도 점수·시간 악용과 리듬 중단을 만들 수 있어 제외했다. 실제 접촉은 토큰 로컬 경로로, 절단 방향은 화면 경로로 판정하고 짧은 탭·루프·접선·`touchcancel`을 무효 처리했다. 실제 좌표 계측으로 홀드 중 낙하가 유지됨을 확인하고, 포획 직후 아래로 되감기는 `Back.In`만 정지 착시의 원인으로 분리해 교체했다.
- 반영 위치: `src/domain/geometry.ts`, `src/domain/gestureClassifier.ts`, `src/game/scenes/PrototypeScene.ts`, `tests/geometry.test.ts`, `tests/gestureClassifier.test.ts`, `tests/e2e/smoke.spec.ts`

### 사례 7: 모바일 LAN 비보안 컨텍스트 호환

- 목적: 같은 Wi-Fi의 일반 HTTP 주소로 접속한 휴대전화에서도 솔로 게임과 방 흐름에 필요한 ID를 생성
- 사용 도구: Codex
- 주요 지시: “모바일에서 혼자 하기를 눌러도 게임이 시작되지 않는 원인을 수정한다.”
- 생성 결과: 기본 `crypto.randomUUID()` 우선 사용, 미지원 시 `crypto.getRandomValues()` 기반 UUID v4 폴백, 두 직접 호출 교체, 단위·E2E 회귀 테스트
- 사람의 검토: localhost에서는 오류가 재현되지 않아 실제 LAN IP의 `isSecureContext=false` 조건으로 다시 검증했다. 게임 캔버스 생성과 오류 없음은 확인했지만 카메라 QR 스캔은 HTTPS가 필요하므로 폴백 범위에 포함하지 않았다.
- 반영 위치: `src/domain/randomUuid.ts`, `src/app/AppController.ts`, `tests/randomUuid.test.ts`, `tests/e2e/smoke.spec.ts`

### 사례 8: 실제 음식 알파 실루엣 점수화

- 목적: 비원형 음식에서 보이는 그림과 성공 범위·면적 점수를 일치시키고 투명 여백을 베는 우회를 차단
- 사용 도구: Codex
- 주요 지시: “원형이 아닌 다양한 음식 그림 그대로 판정되고, 그 차이가 점수로 전달되어야 한다. 포획 조작성은 어렵게 만들지 않는다.”
- 생성 결과: 128×128 가중 알파 마스크, 실제 불투명 픽셀 hit, 선 양쪽 가중 면적 점수, actual chord, strict/extended 실루엣 분류, 원 폴백
- 사람의 검토: 음식 한쪽 내부 선을 무한히 늘려 100점으로 만드는 회귀를 테스트에서 발견해, 실제·보정 선분이 실루엣 chord 전체를 덮도록 수정했다. 투명 모서리와 분리형 빈 공간은 실패하고 얇은 음식 부속은 실제 면적으로 득점한다. 포획은 넓은 길게 누르기 범위를 유지했다.
- 반영 위치: `src/domain/alphaSilhouette.ts`, `src/domain/silhouetteGestureClassifier.ts`, `src/data/menuVisuals.ts`, `src/game/scenes/PrototypeScene.ts`, `tests/`

### 사례 9: 음식 이미지 50종 최종 라이브러리와 덱 단위 선로딩

- 목적: 메뉴 풀 50종 모두를 실제 음식 이미지로 제공하면서, 한눈에 알아보기 쉽고 먹음직스러우며 베기 형태가 반복되지 않는 자산 체계를 완성
- 사용 도구: Codex 내장 ImageGen, 로컬 크로마키 제거·WebP 후처리 스크립트
- 주요 지시: “원형 그릇 반복을 피하고 길거나 세로형·가로형·불규칙한 외곽을 허용하되 음식 정체성과 식욕을 우선한다. 젓가락·숟가락·집게로 억지로 들어 올리는 구도, 과도한 양, 넘쳐 흐르는 비위생적 표현은 사용하지 않는다. 이미 승인한 시안은 유지하고 나머지는 소수 묶음으로 생성·검수·교정한다.”
- 생성 결과: 신규 생성·교정 42종과 기존 승인 8종을 합친 투명 WebP 50종, 메뉴 ID·파일명·원본 크기의 단일 매니페스트, 게임과 선로더가 공유하는 결정적 20종 덱
- 사람의 검토: 짜장면의 과도한 면 리프트, 삼계탕의 집게, 비빔밥의 부자연스러운 젓가락 양, 순대국의 숟가락, 삼겹살의 과도한 비계·넘침 등을 제거하거나 다시 생성했다. 반대로 볶음밥은 공중에 흩날리는 기존 역동 시안을 유지했다. 각 결과는 음식 식별성, 먹음직스러움, 비원형 외곽과 다양한 종횡비, 작은 화면 가독성을 기준으로 직접 승인했다.
- 후처리·검증: 녹색·자홍색 크로마키를 로컬에서 감지·제거하고 despill·soft matte를 적용했다. 알파 32 이상 외곽에 여백을 더해 자르고 원본 종횡비를 보존한 채 긴 변 512px로 맞췄으며, 파일당 120KB 이하·전체 3.5MB 이하·가장 큰 20종 합계 1.5MB 이하를 검사했다. 카탈로그와 이미지 50종의 완전 일치, 고유 ID·파일명, 투명 WebP, 비정사각 자산, 덱 20종 부분 선로딩·중복 요청 합치기·실패 재시도를 자동 테스트했다. 실제 Phaser 첫 라운드에 50종을 하나씩 고정하는 전수 QA도 추가해 이미지 텍스처·알파 마스크·표시 크기·베기 중심·포획 중심을 확인했다. 측정상 중심 편차가 큰 파스타·떡볶이·보쌈·감자탕은 표시와 판정 중심을 함께 보정했다. 판정 범위로 오해될 수 있던 원형 글로우는 제거하고 동일 음식 텍스처의 알파 그림자 2겹으로 바꿨으며, 50종 컨테이너에서 타원 0개를 자동 검증했다.
- 반영 위치: `src/assets/food/`, `src/data/menuVisualManifest.ts`, `src/data/menuVisuals.ts`, `src/game/gameDeck.ts`, `scripts/process_food_art_batch.py`, `tests/menuVisuals.test.ts`, `tests/menuVisualPreload.test.ts`, `tests/gameDeck.test.ts`, `tests/e2e/food-library-qa.spec.ts`

## 6. 검증 및 품질 관리

| 검증 | 결과 | 확인 내용 |
|---|---|---|
| `npm run typecheck` | 통과 | TypeScript 정적 타입 오류 없음 |
| `npm test` | 통과 | 전체 단위 테스트 통과: 기하, 게임 규칙, 메뉴, 방 이탈·승계, 초대 URL, QR 스캔, 로컬 게이트웨이, Firebase 설정·코덱·런타임 선택, 결과 집계와 나레이션 |
| 음식 50종 자산·선로딩 검사 | 통과 | 카탈로그·매니페스트 50종 정확 일치, WebP 알파·원본 종횡비·긴 변 512px, 파일·전체·20종 용량 예산, 비정사각 자산, 결정적 20종 덱·부분 선로딩·중복 제거·실패 재시도 |
| 음식 50종 실제 Phaser 전수 QA | 통과 | 50개 메뉴를 각각 첫 라운드로 실행해 실제 이미지·알파 마스크·표시 크기·베기/포획 중심 확인, 파스타·떡볶이·보쌈·감자탕 중심 보정, 원형 글로우 제거 후 컨테이너별 `Ellipse` 0개·`alpha-shadow` 50/50 재통과 |
| `npm run test:firebase-rules` | 통과 | Firestore 에뮬레이터에서 인증·방 상태 전이·정확한 180초 deadline·마감 후 제출 거부·결과 불변성의 허용·거부 경계 |
| 모바일 LAN HTTP 회귀 | 통과 | `crypto.randomUUID`가 없는 Pixel 7 자동화와 실제 비보안 LAN 주소에서 `혼자 하기` 후 게임 캔버스 생성·페이지 오류 없음 |
| `npm run test:e2e` | 통과 | 드래그·포획 낙하, 완화 베기, 데스크톱·모바일 입력, 일반 게임의 자동 연습 없는 20개 진입, 별도 튜토리얼 완료·재시도·홈 이동, 첫 실행 설정 ON·저장된 OFF 유지, 방 시작·승계·재접속·공동 결과, 가상 시계 180초 deadline·DNF·홈 이동 후 타이머 정리 |
| `npm run build` | 통과 | Vite 프로덕션 빌드와 `dist/` 생성 |
| 나레이션 집중 검증 | 통과 | 나레이션 관련 단위·대상 검증 통과; 활성 MP3·WAV 50개 빌드 대상·물리 자산 53개(활성 50+historical 3)·릴리스 `dist/` 기대 payload 50개·승인 provenance·source/target 바이트와 SHA-256·historical Azure stale 차단·게임 방법 합성 음성 고지·프로덕션 런타임의 금지 Azure 엔드포인트/키/Speech SDK 문자열 0건 확인 |
| 브라우저 시각 검사 | 통과 | DOM 홈·방 생성·QR·대기실·카운트다운, 원형 크롭 없는 음식, 실제 베기 각도, 390×844 화면의 포획 진행 링·에너지 끈·베기 전환 문구 확인 |

자동 검증은 로컬 게이트웨이와 에뮬레이터 안의 보안 규칙을 대상으로 한다. 시작한 방의 새로고침 복귀는 로컬 E2E로 검증했지만, 미제출 플레이어는 라운드 진행 지점을 이어받지 않고 같은 덱을 처음부터 다시 플레이한다. 실제 Firebase 프로젝트의 네트워크 지연·오프라인 복귀, 모바일 카메라 권한, 서로 다른 2~8대 기기의 QR 참가와 결과 동기화는 아직 검증하지 않았다. 결과 미제출자는 Firestore 서버가 공통 시작 시각 180초와 5초 동기화 유예의 경과를 확인한 뒤 0점·빈 포획의 미완주로 확정하며, 서버 규칙이 늦은 신규 제출을 차단한다. 화면 카운트다운은 기기 시각 기반 예상치이므로 실기기 시계 차이 QA와 클라이언트 결과 검증은 후속 항목이다. 나레이션은 자동화와 데스크톱 브라우저에서 검증했지만, 실제 iOS·Android 기기에서 활성 50개 음원의 체감 음량, BGM 고정 레벨·효과음 sidechain, 기기별 재생 편차를 듣는 검수는 아직 남아 있다.

## 7. Firebase 구현 범위와 남은 검증

Firebase JavaScript SDK 12.16.0을 추가하고 다음 항목을 코드와 에뮬레이터 수준에서 구현했다.

| 항목 | 구현 내용 | 사람의 검토 기준 |
|---|---|---|
| 런타임 선택 | `local`과 `firebase` 백엔드를 환경 변수로 선택하고 Firebase 모듈은 필요할 때 동적 로드 | 설정 없음은 로컬, 명시적 Firebase의 필수 값 누락은 오류 |
| 인증 | `signInAnonymously`의 `uid`를 참가자·방장·결과 제출자 ID로 사용 | 다른 사용자의 참가·이탈·결과 문서를 조작할 수 없는지 확인 |
| 실시간 동기화 | `onSnapshot`으로 방과 `rooms/{code}/results`를 구독 | 최초 상태와 이후 변경을 같은 `RoomGateway` 계약으로 전달 |
| 시작 후 복귀 | 잠긴 명단의 기존 참가자가 재접속하면 결과를 한 번 조회해 같은 덱의 게임 또는 결과 대기·요약으로 분기 | 비참가자 차단, 미제출·제출 완료 양쪽 경로와 동기·비동기 구독 해제 확인 |
| 원자성 | `runTransaction`으로 방 생성·참가·이탈·시작과 결과 최초 제출을 처리 | 정원 8명, 코드 충돌, 중복 참가, 시작 후 참가, 결과 재작성 방지 |
| 권한 | `firestore.rules`로 허용 필드, 상태 전이, 방장 권한, 결과 범위를 제한 | Firebase Emulator Suite 통합 테스트로 정상·공격 요청을 함께 검사 |
| 공동 결과 | 시작 시 잠긴 명단의 결과가 모두 도착하거나 Firestore 서버 마감 sentinel이 열리면 권위 결과를 순수 함수로 요약 | 부분·캐시 스냅샷 DNF 금지, 표준 공동 순위, DNF 공동 꼴찌, 0점 완주 우선, 빈 포획, 전원 DNF 내기 없음 처리 |
| 신뢰 경계 | 결과 문서의 작성자·불변성과 값의 형식·범위만 서버 규칙으로 검증 | 본인 점수·포획 메뉴는 클라이언트 신뢰이며 서버 판정·리플레이 검증은 미구현 |

실제 Firebase Console 프로젝트 생성, 익명 인증·Firestore 활성화, 운영 규칙 배포, GitHub Actions 변수 등록과 GitHub Pages 배포를 완료했다. 서로 분리된 두 브라우저 컨텍스트에서 익명 사용자 구분, 방 생성·참가·시작·공동 결과 동기화를 확인했다. 다만 3~8대 실기기 네트워크 QA, 모바일 카메라 권한, App Check 적용, 정확한 라운드 진행 지점 복귀, 서버 시간 오프셋 기반 카운트다운 표시와 클라이언트 결과 검증은 후속 항목이다. 미제출 참가자의 180초 마감·5초 유예·서버 권위 DNF 규칙은 구현과 자동 검증을 완료했으며, 운영 전환 중에는 코덱과 규칙이 v1·v2를 모두 읽고 Phase A 클라이언트는 v1을 기록한다. 근거 URL과 상세 판단은 `docs/evidence/ai-prompts/2026-07-31-firebase-shared-results.md`에 기록했다.

## 8. 외부 에셋 및 오픈소스

현재 프로토타입에는 제3자 음식·배경 이미지, 녹음 음성·사운드 샘플, 폰트를 포함하지 않았다. 음식 이미지 50종은 모두 Codex 내장 ImageGen으로 직접 생성했다. 기존 승인 8종과 신규 생성·교정 42종을 투명 WebP로 후처리했으며 실행 시 해당 판의 20종 덱만 선로딩한다. 음식 나레이션은 유료 Azure AI Speech 기반 후보와 로컬 파생본을 사람이 청취해 `src/assets/narration/`에 53개를 보존하며, 현재 문구와 일치하는 AI 합성 MP3·WAV 50개를 모두 연결한다. 활성 구성은 MAI-Voice-2-Flash 계열 45개와 MAI-Voice-2 5개이며, 이전 MP3 3개까지 포함한 물리 파일 53개는 Flash 계열 48개와 Full 5개다. 현재 릴리스 빌드의 `dist/` 기대 payload는 활성 음원 50개다. 효과음과 BGM은 저장 음원 없이 Web Audio로 실행 중 직접 생성하고 진동은 지원 기기의 표준 Vibration API만 사용한다. `public/favicon.svg`도 프로젝트에서 직접 작성했다.

| 구분 | 이름·버전 | 사용 위치 | 출처 | 제작자 | 라이선스 | 수정 여부 |
|---|---|---|---|---|---|---|
| 게임 엔진 | Phaser 4.2.1 | 브라우저 런타임 | https://github.com/phaserjs/phaser | Phaser Studio | MIT | 패키지 원본 미수정 |
| 빌드 도구 | Vite 8.1.5 | 개발·프로덕션 빌드 | https://github.com/vitejs/vite | Vite contributors | MIT | 패키지 원본 미수정 |
| 언어·컴파일러 | TypeScript 7.0.2 | 타입 검사 | https://github.com/microsoft/TypeScript | Microsoft | Apache-2.0 | 패키지 원본 미수정 |
| 테스트 도구 | Vitest 4.1.10 | 단위 테스트 | https://github.com/vitest-dev/vitest | Vitest contributors | MIT | 패키지 원본 미수정 |
| 테스트 도구 | Playwright Test 1.62.0 | 브라우저 E2E | https://github.com/microsoft/playwright | Microsoft | Apache-2.0 | 패키지 원본 미수정 |
| 타입 정의 | `@types/node` 24.13.3 | 개발 타입 검사 | https://github.com/DefinitelyTyped/DefinitelyTyped | DefinitelyTyped contributors | MIT | 패키지 원본 미수정 |
| QR 생성 | qrcode 1.5.4 | 방 초대 QR PNG 생성 | https://github.com/soldair/node-qrcode | node-qrcode contributors | MIT | 패키지 원본 미수정 |
| 타입 정의 | `@types/qrcode` 1.5.6 | QR 코드 타입 검사 | https://github.com/DefinitelyTyped/DefinitelyTyped | DefinitelyTyped contributors | MIT | 패키지 원본 미수정 |
| 백엔드 SDK | Firebase JavaScript SDK 12.16.0 | 익명 인증·Cloud Firestore | https://github.com/firebase/firebase-js-sdk | Google LLC | Apache-2.0 | 패키지 원본 미수정 |
| 규칙 테스트 | `@firebase/rules-unit-testing` 5.0.1 | Firestore Security Rules 통합 테스트 | https://github.com/firebase/firebase-js-sdk | Google LLC | Apache-2.0 | 패키지 원본 미수정 |
| 개발 도구 | Firebase CLI 15.24.0 | 로컬 Firestore 에뮬레이터 실행 | https://github.com/firebase/firebase-tools | Google LLC | MIT | `npx`로 고정 버전 실행, 원본 미수정 |
| 이미지 후처리 도구 | Pillow 12.3.0 | 생성 이미지 크롭·리사이즈·투명 WebP 인코딩·검사 | https://github.com/python-pillow/Pillow | Pillow contributors | MIT-CMU | 후처리 스크립트에서 라이브러리 API 사용, 패키지 원본 미수정 |
| AI 음식 이미지 | 활성 음식 50종 WebP(기존 승인 8종·신규/교정 42종) | 게임 토큰·공동 결과 카드 | `docs/evidence/ai-prompts/2026-08-08-final-food-library-50.md`와 연결된 선행 이미지 로그 | 프로젝트 직접 생성 | [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/) Content 항목 확인(2026-08-01) | 로컬 크로마키 제거·알파 외곽 정규화·긴 변 512px·원본 종횡비 보존 WebP 최적화·50종 매핑·덱 20종 선로딩 검증 |
| AI 합성 음성 | Azure AI Speech Standard S0 MAI-Voice-2-Flash·MAI-Voice-2 기반 MP3·WAV 보존 53종(활성 50종·historical 3종; 로컬 파생본 포함) | 해당 음식 등장 시 선택적 나레이션 | [Microsoft 합성 음성 공개 설계 지침](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/speech-service/text-to-speech/concepts-disclosure-guidelines) | Microsoft 서비스로 생성, 프로젝트에서 사람 선별 | 유료 Azure 서비스·public preview 사용 조건과 계정 계약 기준 | `southeastasia`에서 Haena·Junho 후보를 선정하고 이전 MP3 3개를 historical 보존; 활성 50개 정적 import(Flash 계열 45+Full 5), 릴리스 `dist/` 기대 payload 50개, 덱 단위 선로딩, 음성 복제·성대모사 없음 |

### AI 합성 음성 보존 이력 53종 (현재 활성 50종)

| 메뉴·파일 | 최종 음성·선정 원본 | 크기 | 길이 | SHA-256 |
|---|---|---:|---:|---|
| 김치찌개 `kimchi-jjigae.mp3` | `ko-KR-Haena:MAI-Voice-2-Flash` · pilot | 45,120 B | 2.256초 | `D2BB932B28737EBB648E5C0C885A44B6F37DE2D6756E71A9B460B5B3CB1A86AF` |
| 부대찌개 `budae-jjigae.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · radio-command retake | 35,040 B | 1.752초 | `E05D0502895068CCC6E74DBA4F31B478C65015411EB2261D752AE485A70B887D` |
| 육개장 `yukgaejang.mp3` | `ko-KR-Haena:MAI-Voice-2-Flash` · rally retake | 46,560 B | 2.328초 | `F90C07224D18DB70C6BB9C45784C8DCBEA2B5D0905DA52D440EF058774F9AFCC` |
| 라면 `ramyeon.mp3` | `ko-KR-Haena:MAI-Voice-2-Flash` · soft-excited retake | 44,160 B | 2.208초 | `0CBD4B0926158CE527E479CF04EE630F384E8B4132E4E952B47793DA6EECD28E` |
| 파스타 `pasta.mp3` (retired 이력) | `ko-KR-Junho:MAI-Voice-2-Flash` · pilot | 59,520 B | 2.976초 | `76F9A9FF29E507210B75E189309858C908A0EDBAE044F2DF9AC4D602BFFFC253` |
| 파스타 `pasta-final-tiebreak.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.56 · +22% · 인접 두 블록/no break · `replacement-pilot-02` B · 104 MPEG frame | 49,920 B | 2.496초⁷ | `EDB4D142066DDCC6C75D7B58AD9FBB6D2AB85D7CE562CBBDEB6A824854947431` |
| 샤부샤부 `shabu-shabu.mp3` (retired 이력) | `ko-KR-Haena:MAI-Voice-2-Flash` · pilot | 63,840 B | 3.192초 | `5A270FC0A36C583BF03718C490F0EDE6F2D3224D65FBBC417975F9C0A9385A42` |
| 샤부샤부 `shabu-shabu.wav` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined · slow-retake 양끝 무음 trim | 175,244 B | 1.825초⁵ | `A6C3C08897A015C0CC973EAD300A69F3456DE1A835B4673F594B60E64504A2FA` |
| 된장찌개 `doenjang-jjigae.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful · `full-batch-01-retake-01` | 35,520 B | 1.776초 | `21C6A74CF04A18472110C1E8694D4D80E5D8D7136E442418E4BC202ABF05A63A` |
| 순두부찌개 `sundubu-jjigae.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful→joyful · `full-batch-01` | 39,840 B | 1.992초 | `F7FAC8707F15323C97007012609A513CE8F7E1D5D2FF8A3A89E3C086986E4F8D` |
| 감자탕 `gamjatang.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined→determined · `full-batch-01` | 69,120 B | 3.456초¹ | `5A24FAD64D4B82A6482C3BB7D6BA0B5838FE5805FA4E8E8320E66EBD5CC97A76` |
| 설렁탕 `seolleongtang.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful · copy pilot B | 48,480 B | 2.424초¹ | `DEB1856C1C63AACFC528DAD71A9B80660AF352319218EDD027746E7E118167F6` |
| 곰탕 `gomtang.mp3` (retired 이력) | `ko-KR-Junho:MAI-Voice-2-Flash` · determined→determined · `full-batch-01-retake-01` | 35,520 B | 1.776초 | `63CB397FD55E02EEF0B93E9B43425A7FC1C0E8E991C809E5E16EFE5F1333B5B9` |
| 곰탕 `gomtang.wav` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful · slow-retake 내부 gap trim | 225,876 B | 2.352초⁶ | `1148C05A7A088B5D59255C97DBF6252210E1E0437EA3A531434FAE0FDF2FDDB8` |
| 갈비탕 `galbitang.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined→determined · `full-batch-01` | 35,520 B | 1.776초 | `C52E856E8F68AA6A84F1160F172E6D46E96C11656E896F7A3CEE0BE3CC6ED020` |
| 삼계탕 `samgyetang.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful · `full-batch-01-retake-03` | 35,520 B | 1.776초 | `518D96B965B75225D0BC47B3C678868F5994A5C35EC6A6EF48FD64A98886CC9C` |
| 콩나물국밥 `kongnamul-gukbap.mp3` | `ko-KR-Haena:MAI-Voice-2-Flash` · determined→joyful · `full-batch-01` | 35,520 B | 1.776초 | `67ADB756CCF7017FBD3E3E16903A5BD7FFEE96AB4343D425DA41A0A627A47D92` |
| 돼지국밥 `dwaeji-gukbap.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful · `full-batch-02` | 38,880 B | 1.944초 | `46798287828F7F991835FFF7D532B64A3F46A4DAB0B8207607427A9DDE452B66` |
| 순대국 `sundae-guk.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful · `full-batch-02` | 51,360 B | 2.568초² | `386B15214E6FE6A07530F1D4ED6BE4032EFBAC2CECE522A409730B882B865922` |
| 청국장 `cheonggukjang.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful · `full-batch-02` 원본 말미 감쇠 B(-4.5 dB) | 52,800 B | 2.640초⁴ | `9029284574B771A2042FCFE6804AB1633F1137C91D4F49D635E5871D99902874` |
| 집밥백반 `home-style-baekban.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful · `full-batch-02` | 47,040 B | 2.352초² | `179D4F0056E9B41843AABFA46BCC13C0CA4C1E79D99177AC8F076D1F8BDC36EC` |
| 비빔밥 `bibimbap.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined · `full-batch-02` | 36,000 B | 1.800초 | `ADCA8D1CCAFF1856EF75BB2ED35A4B50EE23129DDD0E73390243A553BE776DA4` |
| 치킨마요덮밥 `chicken-mayo-deopbap.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful · `full-batch-02` | 40,800 B | 2.040초² | `7F98D7CD654836EA3F788F78777551DE3C6F82C3C14B7FD48CBC6B8932467F3C` |
| 제육덮밥 `jeyuk-deopbap.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful · `replacement-batch-01` | 43,680 B | 2.184초³ | `96A12781D4278EB221BDC925D7B9F8AF92AC7F65716A252C1D0759B217E9EC3F` |
| 불고기덮밥 `bulgogi-deopbap-final-tiebreak.mp3` | `ko-KR-Junho:MAI-Voice-2` · joyful 0.60 · +28% · 한 블록 · `replacement-pilot-02-mai-voice-2` A · 77 MPEG frame | 36,960 B | 1.848초⁷ | `B37C038201C660C6FB58CF0345D017526E074EF900914B835441106A9909D1BD` |
| 카레라이스 `curry-rice-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.54 · +24%/+0% · 인접 두 블록 · `remaining-batch-01` | 55,680 B | 2.784초 | `91A7F79ECC3A54D9524DC373C8BA4F6383DC12FB5751E6319A365D3AD2E48116` |
| 오므라이스 `omurice-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.46 · +22%/-1% · 한 블록 · `remaining-batch-01` | 35,520 B | 1.776초 | `A910FEFECA377DE7BA1FE131D79056641FCA5F48BAA79D9C20580B0047220C02` |
| 볶음밥 `fried-rice-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.52 · +18%/+0% · 한 블록 · `remaining-batch-01` | 35,520 B | 1.776초 | `C8616E855A176B6E55E595CAEF0585E86565A16934965B419CF523C1719309D5` |
| 김치볶음밥 `kimchi-fried-rice.wav` | `ko-KR-Haena:MAI-Voice-2-Flash` · joyful 0.48 · +20%/-1% · 한 블록 · leading-only bit-exact PCM trim | 225,828 B | 2.351917초 | `0E322E3B646A67E6552B20CACBC3349F9DB8537F1408B76A9F176102E4C2CC3E` |
| 돈가스 `pork-cutlet-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2` · joyful 0.44 · +20%/-1% · 인접 두 블록 · `remaining-batch-01` | 45,600 B | 2.280초 | `58B19433D5D67C1B42DE99B26E8CFAFCA0B18690FB8AFA7A0608AD3D75D682BA` |
| 초밥 `sushi-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.50 · +22%/-1% · 인접 두 블록 · `remaining-batch-01` | 55,200 B | 2.760초 | `9DBEF6EA2FAE56EE7E0954FFC039CD52F8FB9333707DE3EC9F1A8AC0F342CBD9` |
| 비빔국수 `bibim-guksu-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.50 · +22%/+0% · 인접 두 블록 · `remaining-batch-01` | 56,640 B | 2.832초 | `627E2A07DAC7937F08EC4DE4E81E29B8089960AFB70BD35D9B6D19BEE8C3E7EA` |
| 잔치국수 `janchi-guksu-remaining-batch-01.mp3` | `ko-KR-Haena:MAI-Voice-2-Flash` · joyful 0.46 · +20%/-1% · 한 블록 · `remaining-batch-01` | 38,400 B | 1.920초 | `FD194B316E15022D3CB9942EA8C1EAF0DD97E1AC04174A8751ECB06F88B2E6DC` |
| 냉면 `naengmyeon-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.52 · +22%/-1% · 인접 두 블록 · `remaining-batch-01` | 54,240 B | 2.712초 | `DC9F1CE16DDEEE109F6F18466FBF3C6A99DD448322599DE6B3EDC3343893F7ED` |
| 짜장면 `jjajangmyeon-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.50 · +22%/+0% · 인접 두 블록 · `remaining-batch-01` | 53,280 B | 2.664초 | `D0915E8C2EF31A045AFBA3F9EB33B03C324F85746823EC876225437D663043E1` |
| 짬뽕 `jjamppong-remaining-batch-01.mp3` | `ko-KR-Haena:MAI-Voice-2-Flash` · joyful 0.48 · +22%/-1% · 인접 두 블록 · `remaining-batch-01` raw 청취 예외 | 68,640 B | 3.432초 | `AC9A1604F287BD18AE97B5DF2B28E7BD1923484673D3BB07B9D9A03CCF709E32` |
| 우동 `udon-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.46 · +20%/-1% · 인접 두 블록 · `remaining-batch-01` | 47,040 B | 2.352초 | `02C218A01E8D4130BDA92E82556A64969D3F195D849F89DC263F0A33DBD80FC4` |
| 쌀국수 `pho-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.48 · +20%/-1% · 인접 두 블록 · `remaining-batch-01` | 33,120 B | 1.656초 | `5F0AACBE13CF78CDD84D1A483F4240FB05783800E9E4F8CF7D55B4E1F129A7CA` |
| 칼국수 `kalguksu-copy-retake-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.36 · +12%/-1% · 한 블록 · `kalguksu-copy-retake-01` | 28,320 B | 1.416초 | `B01D2033A30E36F6F30C0D4F73B3FA23673EAEA6B9605512720394898A506F25` |
| 김밥 `gimbap-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.48 · +18%/-1% · 한 블록 · `remaining-batch-01` | 40,320 B | 2.016초 | `3D1948080A77B27876D9DF1BFB7F96A7A3D2746E9117037163B8A7BFCF69497D` |
| 샌드위치 `sandwich-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.48 · +22%/-1% · 인접 두 블록 · `remaining-batch-01` | 54,720 B | 2.736초 | `A2F7BFB4D6EF6AEB4448534E6001D5DE4F432DE2DC1EF4C4BEDEE8DD552D8760` |
| 길거리 토스트 `korean-toast-remaining-batch-01.mp3` | `ko-KR-Haena:MAI-Voice-2-Flash` · joyful 0.46 · +20%/-1% · 한 블록 · `remaining-batch-01` | 56,160 B | 2.808초 | `A019F0DDEB0A7282419F124042514A17599662CFB691E10465B398BC0CA81DE0` |
| 떡볶이 `tteokbokki-onset-retake-b.mp3` | `ko-KR-Haena:MAI-Voice-2-Flash` · joyful 0.50 · +12%/+22% · 인접 두 블록 · 100ms preroll · `tteokbokki-onset-retake-01` B · 135 MPEG frame | 64,800 B | 3.240초⁹ | `6B6B9AE5B73AE5AFE86EBE8DBBCF4A4347674F889597A9FA8B721F6C3391CF87` |
| 햄버거 `hamburger-fast-repeat-trim.wav` | `ko-KR-Haena:MAI-Voice-2-Flash` · joyful 0.42 · +16%/-2% · 한 블록 · 두 내부 저에너지 중심 trim | 224,244 B | 2.3354166666666667초⁸ | `DB5ABA82C39A1C5EBAA5C0F417B6394815ACE3A4710BF527C240B6AF0AA3A35F` |
| 삼겹살 `samgyeopsal-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2` · joyful 0.40 · +22%/-1% · 한 블록 · neutral/no impersonation · `remaining-batch-01` | 39,360 B | 1.968초 | `FAD7E255933AD9BAFA538CD0FB5B35C43C6FAA8288E8E589A2086F090E081E36` |
| 갈비구이 `grilled-galbi-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.48 · +20%/-1% · 인접 두 블록 · `remaining-batch-01` | 35,520 B | 1.776초 | `88125BF703A2A4E6915ABA848227F2912B3B0EDD0880ED3262F70A964D3F7A92` |
| 닭갈비 `dakgalbi-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2` · joyful 0.44 · +20%/-1% · 한 블록 · `remaining-batch-01` | 36,960 B | 1.848초 | `2F196CF507647193E0A71C8E1949249769D87EBD1372D1EEEB4C28024656201F` |
| 보쌈 `bossam-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.46 · +20%/-1% · 한 블록 · `remaining-batch-01` | 48,480 B | 2.424초 | `B081A8348CA13C6A9B36DA3D8A8EF595AF674F37ED835AE58CB99BE2F336A26A` |
| 족발 `jokbal-copy-retake-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.48 · +22%/+0% · 한 블록 · `jokbal-copy-retake-01` · 108 MPEG frame | 51,840 B | 2.592초 | `94D19FF391315524B09503A6962E13418FE5DD97ED098D7D9C9E116756B2B23D` |
| 불고기 `bulgogi-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.48 · +20%/-1% · 인접 두 블록 · `remaining-batch-01` | 42,720 B | 2.136초 | `3E396073B5888176DE9BF942C9093E2C43CB5106F2CA9F78A1DC77AB010B4922` |
| 치킨 `fried-chicken-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2` · joyful 0.48 · +26%/-1% · 한 블록 · `remaining-batch-01` | 52,800 B | 2.640초 | `F7C65BFB9379E60767012B532A4C4FB91BD303F3F4B467CDDD1DEC46BBC1FAC7` |
| 피자 `pizza-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · joyful 0.46 · +18%/+0% · 인접 두 블록 · `remaining-batch-01` | 43,200 B | 2.160초 | `22995289B0EAA4F3902520000CA6E4D8D4A8F42A1E09099B918986A1197EB671` |
| 닭한마리 `dak-hanmari-remaining-batch-01.mp3` | `ko-KR-Junho:MAI-Voice-2-Flash` · determined 0.46 · +18%/-1% · 한 블록 · `remaining-batch-01` | 40,800 B | 2.040초 | `E87B251F72191AD9841E984DA0A2D16E23C5D17AD70E95AF9AF8C13DF7C4C2EC` |

첫 확장 배치의 현재 활성 7종 `sourcePreviewPath`·승인 상태와 곰탕 retired 이력은 `scripts/narration/fullBatch01ApprovedAudioSelections.mjs`에 분리하고, 런타임 URL 매핑은 `src/data/menuNarrationAudioManifest.ts`에 고정했다. 설렁탕은 “설렁탕 국밥계 탱커 등장!”, 삼계탕은 “복날 체력바 전부 회복!”을 자막·카탈로그·정적 음원에 동일하게 반영했다. ¹ 감자탕 3.456초와 설렁탕 B 2.424초는 자동 길이 기준을 넘지만 실제 청취에서 자연스러운 발음·강세를 우선해 사람이 예외 승인했다. 두 번째 배치는 사용자의 “나머지는 괜찮다” 청취 승인에 따라 돼지국밥·순대국·집밥백반·비빔밥·치킨마요덮밥 5종만 통합했으며, 정확한 source·바이트·실제 길이·SHA-256은 `scripts/narration/fullBatch02ApprovedAudioSelections.mjs`에 고정했다. ² 순대국 2.568초·집밥백반 2.352초·치킨마요덮밥 2.040초는 자동 길이 기준을 넘지만 청취 승인으로 채택했다. 불고기덮밥은 이 배치 기준으로 자막 전용이었고 후속 2단계 블라인드 최종 승자를 별도 통합했다. 청국장은 `full-batch-02` 원본 말미 감쇠 B를 사용자가 “청국장은 B가 좋아”라고 승인해 활성화했다. ³ 제육덮밥 교체본 2.184초도 자동 기준을 넘지만 사용자가 “제육덮밥은 새 음원이 나아”라고 비교 청취 승인했으며, source·바이트·frame·길이·SHA-256은 `scripts/narration/replacementBatch01ApprovedAudioSelections.mjs`에 고정했다. 같은 교체 배치의 나머지 5개 후보는 당시 런타임에 연결하지 않았다. ⁴ 청국장 B는 2.640초로 자동 기준을 넘지만 비교 청취 승인됐고, 원본 1.7725–2.4175초에 요청 -5 dB의 무손실 근사치 -4.5 dB를 적용했다. 추가 Azure 요청은 없으며 source·frame·길이·SHA-256은 `scripts/narration/cheonggukjangPunchAdjustedApprovedAudioSelection.mjs`에 고정했다. ⁵ 샤부샤부는 “샤부샤부 좋아 맘에들어” 승인 뒤 slow-retake의 앞 275ms·뒤 132ms만 trim했다. active 발화 1.490초·38,760 Float32 sample은 bit-exact이고 sample mismatch 0이며, source/output/PCM hash는 `scripts/narration/shabuShabuSilenceTrimApprovedAudioSelection.mjs`에 고정했다. ⁶ 곰탕은 “곰탕은 맘에들어.” 승인 뒤 slow-retake의 두 내부 저에너지 core만 줄여 -45/-40dBFS 최장 gap 135/140ms를 달성했다. retained PCM mismatch·fade·resample·normalize·추가 Azure 요청은 0이며 source/output/manifest/PCM hash는 `scripts/narration/gomtangGapTrimApprovedAudioSelection.mjs`에 고정했다. 파스타·불고기덮밥의 초기 raw 최종 재시안과 gap-trim WAV는 사용자 청취에서 거절되어 `scripts/narration/finalRetakeGapTrimRejectedAudioSelections.mjs`에 미배포 provenance로 남아 있다. 후속 별도 pilot의 결선 승자는 활성 자산으로 승인됐다.

⁷ 후속 Flash/Full·한 블록/두 블록 후보를 두 단계 블라인드 비교한 뒤 사용자는 “둘다 R이 더 자연스럽고 어떤 단어에 강세를 줘야 할지, 어떻게 이어나가야 할 지 아는느낌이야. 자연스러워”라고 최종 승인했다. 파스타는 Flash 인접 두 블록, 불고기덮밥은 Full 한 블록 raw MP3이며 정규화·trim·transcode·추가 Azure 요청은 없다. 생성 manifest·두 reveal map·source/target SHA-256·승인 원문은 `scripts/narration/finalTiebreakApprovedAudioSelections.mjs`에 고정했다. 메뉴 2개·조건별 1 take 선택이므로 전체 모델이나 구조의 일반적 우월성을 뜻하지 않는다.

Remaining-batch G3 최초 검수의 승인·보류 원문은 `떡볶이는 앞에 "떡볶"이가 안들리고 앞부분이 짤린거 같아. 떡볶이는 짤린거 말고는 괜찮아. 햄버거는 햄부기 3번 반복하는데 더 빠르게 반복해줘. 이 둘 말고는 괜찮아`다. 이 단계에서는 다섯 raw MP3만 활성화하고 떡볶이·햄버거 raw source를 inactive/pending·raw-withheld 상태로 보존했다. 당시 상태와 source identity는 `scripts/narration/remainingBatch01Group3ApprovedAudioSelections.mjs`에 고정했다.

⁸ 이후 사용자가 `햄버거도 승인할게`라고 승인해 `hamburger-fast-repeat-trim.wav`를 활성화했다. 이 IEEE 32-bit float PCM·24kHz mono·56,050 sample WAV는 224,244 B·2.3354166666666667초·SHA-256 `DB5ABA82C39A1C5EBAA5C0F417B6394815ACE3A4710BF527C240B6AF0AA3A35F`, retained PCM SHA-256 `77B1F1DF1593D62BB14BEA23E8E8407E3D8EC047AAD1FEF458B23025E576F3D0`다. 원본 MP3는 83,520 B·174 frame·4.176초·SHA-256 `CB0977A8A37F398974AC49675E944BA3FF25A44252746014467A814F486E7219`, schema 1 trim manifest는 9,898 B·SHA-256 `434EA7754878CB2AFFE8C7C6C528361A88990B062060EC0DFE4AD508CC0ABD07`이다. sample `[15346,40445)`, `[56938,76013)`만 제거했고 retained PCM bit-exact·무 fade/normalize/resample/gain·Chrome 재디코딩 mismatch 0 조건과 승인 원문은 `scripts/narration/hamburgerFastRepeatApprovedAudioSelection.mjs`에 고정했다.

⁹ 같은 G3 onset 피드백으로 만든 떡볶이 A/B 중 사용자는 `B 승인`이라고 최종 선택했다. A(+22%/+22%)는 57,120 B·119 frame·2.856초·SHA-256 `3363427C60805BFD84E244F33F35772E214FAA53C524F8167B20F6E3F178581D`인 historical rejection으로 미배포 보존한다. B(+12%/+22%)는 `tmp/narration-preview/tteokbokki-onset-retake-01/B.mp3`와 활성 자산이 byte-identical한 raw MP3이며 후처리는 없다. schema 2 생성 manifest는 4,819 B·SHA-256 `3A343828E04C68E5FB5438CE7F372196A6A035B34CD08C3BEC3AC0AF79C093F1`이다. A rejection·B source/target identity·승인 원문은 `scripts/narration/tteokbokkiOnsetRetakeApprovedAudioSelection.mjs`에 고정했다.

Remaining-batch G4 검수 원문은 `족발은 "발을 먹는데? 손이 더 바쁘다" 에서 "더"가 빠졌어 중요한 요소야 수정해줘.  나머지는 다 맘에 들어`다. 이에 따라 닭갈비·보쌈·불고기·치킨·피자·닭한마리 6종만 원본 preview와 byte-identical한 raw MP3로 활성화했다. source manifest는 `tmp/narration-preview/remaining-batch-01/remaining-batch-01-manifest.json` 42,007 B·schema 2·SHA-256 `C2A6A2846C37A76C1FCF4A8E7F1E7F6255248D007D0712288EC934736CBF107E`이며, 6종의 profile·source/target identity·승인 원문은 `scripts/narration/remainingBatch01Group4ApprovedAudioSelections.mjs`에 고정했다. 후처리와 추가 Azure 요청은 없다.

같은 G4의 구 족발 raw source는 문구 `발을 먹는데 손이 바쁘다!`로 생성된 `tmp/narration-preview/remaining-batch-01/jokbal.mp3` 54,720 B·114 MPEG frame·2.736초·SHA-256 `9D4505FE633998516A2AABE750920CE2CD14E98709CE87512D67B674D24966BD`이며, 핵심 단어 “더”가 빠져 당시 withheld 상태였다. 현재 카탈로그 문구 `발을 먹는데? 손이 더 바쁘다!`로 만든 새 preview `tmp/narration-preview/jokbal-copy-retake-01/jokbal.mp3`는 51,840 B·108 frame·2.592초·SHA-256 `94D19FF391315524B09503A6962E13418FE5DD97ED098D7D9C9E116756B2B23D`다. schema 2 manifest는 3,359 B·SHA-256 `E33C781E071BEB700426FC2C03D7079033844EC4DD3991230853BBFA77C22F41`이며 생성 시점에는 `runtimeIntegrationAttempted: false`·`listeningReviewRequired: true`였다.

후속 직접 청취에서 사용자는 정확히 `족발 승인할게`라고 승인했다. 자동 검수의 question→punch 목표는 180–420ms·reject 기준은 500ms 초과였고 실제 측정 범위는 520–535ms였지만, 이 최종 승인을 근거로 사람이 예외 승인했다. 두 번째 구절의 상대 음량은 -1.2~-0.9dB이고 소리치는 후보로 판정하지 않았다. preview와 byte-identical한 `src/assets/narration/jokbal-copy-retake-01.mp3`를 후처리·추가 Azure 요청 없이 활성화했으며, source manifest·구 raw rejection·profile·source/target hash·이전 피드백·최종 승인·gap override는 `scripts/narration/jokbalCopyRetake01ApprovedAudioSelection.mjs`에 고정했다.

특정 청구 금액은 이 문서에서 확정하지 않으며 Azure Cost Management의 확정 사용 내역을 최종 기준으로 확인한다.

직접 JavaScript 의존성의 버전은 `package.json`과 `package-lock.json`, 라이선스명은 설치된 각 패키지의 `package.json` 메타데이터로 2026-07-31에 확인했다. 음식 이미지 후처리에 사용한 Pillow 12.3.0과 MIT-CMU 표시는 로컬 Python 패키지 메타데이터로 2026-08-08에 확인했다. 최종 제출 버전 동결 후 전체 전이 의존성과 포함해야 할 고지문을 다시 확인한다.

## 9. 저작권 및 사용 범위 확인

- 제3자의 음식·배경 이미지나 녹음 음성·사운드 샘플은 사용하지 않았다. AI 생성 음식 이미지 50종은 프롬프트·생성일·후처리·사용 위치와 2026-08-01 확인한 [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/) 근거를 `docs/evidence/ai-prompts/2026-08-08-final-food-library-50.md`에 연결해 기록했다. Azure AI 합성 음성의 보존 이력 53종과 현재 활성 50종은 제공 서비스, 리전, 정확한 voice ID, 파일 해시와 사람의 선정·retired 과정을 본 문서와 `docs/evidence/asset-licenses.md`에 기록했다.
- 오픈소스 의존성은 MIT, Apache-2.0 또는 MIT-CMU 고지 조건을 최종 배포물과 소스 저장소에서 준수한다.
- 보존한 음원 53종과 현재 활성 50종은 음성 복제나 실제 유명인·방송·캐릭터 성대모사 없이 Azure 합성 음성으로 만들었다. 게임 방법에는 “이 게임의 일부 음식 나레이션은 Microsoft Azure AI Speech로 생성한 AI 합성 음성입니다. 실제 인물의 녹음이나 성대모사가 아닙니다.”라는 고지를 표시한다.
- 추가 AI 생성 이미지·음성을 만들면 도구, 주요 입력, 생성일, 사람의 수정, 사용 위치를 작업 즉시 `docs/evidence/`에 기록한다.
- 최종 PDF에는 실제 제출 빌드에 포함된 항목만 남기고 링크와 라이선스를 다시 확인한다.
