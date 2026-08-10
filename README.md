# 오늘 뭐 썰?

마음에 드는 메뉴는 원으로 포획하고, 나머지는 정확히 반으로 써는 모바일 우선 브라우저 파티게임입니다. NHN 게임 제작 해커톤 사전 과제 제출을 목표로 개발하고 있습니다.

현재 저장소에는 코어 플레이, 2~8인 방, Firebase 실제 기기용 백엔드, 참가자 공동 결과 화면까지 연결한 3차 프로토타입이 구현되어 있습니다.

## 현재 구현 범위

- DOM 홈에서 점심·저녁을 선택하고 혼자하기, 방 만들기, 방 참가로 진입합니다.
- 혼자하기는 50개 메뉴 풀에서 공통 시드로 20개를 뽑아 베기·최대 2회 포획·평균 점수를 진행합니다.
- 일반 혼자하기와 방 플레이는 자동 연습 없이 원래의 20개 라운드를 바로 시작합니다. 조작을 익히고 싶을 때는 홈의 `튜토리얼 하기`를 따로 선택해 점수·포획 슬롯·게임 기록에 포함되지 않는 베기 1회와 길게 누르기 포획 1회를 차례로 연습할 수 있고, 완료 화면에서 `다시 연습` 또는 `홈으로`를 선택합니다.
- 저장된 설정이 없는 첫 실행에는 효과음·BGM 마스터, 지원 기기의 진동, 나레이션이 모두 켜집니다. 사용자가 하나를 명시적으로 끄면 같은 브라우저에 저장되어 다음 실행에도 유지됩니다.
- 방을 만들면 혼동 문자를 제외한 8자리 코드, 초대 링크, 실제 PNG QR 이미지가 생성됩니다. 앱 내 스캔은 지원 브라우저의 `BarcodeDetector`를 사용하고, 미지원 환경에서는 링크나 코드를 직접 입력합니다.
- `localStorage`와 `BroadcastChannel`로 같은 출처의 멀티탭에서 2~8인 대기실을 동기화합니다. 준비 버튼 없이 2명부터 방장이 시작하면 방은 `waiting`에서 `preparing`으로 전환되고 참가 명단·`deckSeed`·콘텐츠 버전을 잠급니다. 각 기기가 같은 20개 덱을 제한 시간 안에 준비해 자동으로 준비 완료를 알린 뒤, 전원이 준비되면 `started`와 공통 `startAt`을 확정하고 4초 카운트다운으로 진입합니다. 참가자가 나가면 명단 순서를 다시 매기고, 방장이 나가면 가장 먼저 참가한 남은 인원이 승계하며, 마지막 참가자가 나가면 로컬 방을 삭제합니다.
- 대기실에서는 URL의 `room` 코드를 유지합니다. 새로고침 후 같은 세션의 `playerId`로 다시 참가하면 인원을 늘리지 않고 기존 자리로 멱등 복귀하며, 방 생성·참가 요청 중에는 혼자하기·방 만들기·방 참가 버튼을 모두 잠급니다.
- 시작 후 새로고침해도 잠긴 명단의 같은 플레이어라면 복귀할 수 있습니다. 결과를 아직 내지 않았다면 같은 식사 시간·덱으로 게임을 처음부터 다시 시작하고, 이미 제출했다면 게임을 재실행하지 않고 `N/M` 결과 대기 또는 최종 결과로 바로 돌아갑니다.
- Firebase 모드에서는 익명 인증의 `uid`를 참가자 ID로 사용하고 Cloud Firestore 트랜잭션으로 방 생성·참가·이탈·시작을 처리합니다. `onSnapshot` 구독으로 서로 다른 기기의 방 상태와 결과를 실시간 동기화합니다.
- 게임이 끝나면 각 참가자의 점수와 최대 2개 포획 메뉴를 한 번만 제출합니다. 잠긴 시작 명단의 결과가 모두 도착할 때까지 `도착 수/전체 수`를 표시한 뒤 1~8등 순위, 공동 1등·공동 꼴찌, 각자의 포획 메뉴 이미지형 카드, 가장 많이 겹친 메뉴를 함께 보여줍니다. 정확히 겹친 메뉴가 없으면 `둘 다 면 요리파`처럼 포획 메뉴의 카테고리로 가까운 취향을 대신 보여주며, 미포획 슬롯은 빈칸으로 유지합니다.
- 솔로 결과에서는 `같은 메뉴로 한 판 더`, `새 메뉴 고르기`, `홈으로`를 제공하고, 방 결과에서는 현재 방을 안전하게 나간 뒤 `새 메뉴 고르기` 또는 `홈으로` 이동합니다. 같은 방 재대결은 시작 회차별 결과 저장과 참가자 재동의가 필요한 후속 기능으로 두며 현재 버전에서는 제공하지 않습니다.
- 보안 규칙은 타인의 결과 문서 작성과 기존 결과 수정·삭제를 막지만, 본인이 제출하는 점수와 포획 메뉴는 현재 클라이언트 값을 신뢰합니다. 서버 판정이나 리플레이 검증을 갖춘 부정행위 방지 시스템은 아닙니다.
- `VITE_MULTIPLAYER_BACKEND=local`은 서버 없이 동일 출처 멀티탭을 검증하는 기본 개발 모드입니다. Firebase 설정이 완전하고 백엔드를 `firebase`로 선택했을 때만 실제 기기용 게이트웨이를 불러옵니다.

> **현재 제약:** Firebase 연동 코드와 보안 규칙은 구현했지만, 이 저장소에는 실제 Firebase 프로젝트 값이나 운영 배포가 설정되어 있지 않습니다. 따라서 현재 상태만으로는 QR을 서로 다른 휴대폰에서 스캔하는 실제 기기 간 플레이가 보장되지 않습니다. Firebase Console 프로젝트 생성, 익명 로그인·Firestore 활성화, 규칙 배포, GitHub 저장소 변수 등록, 실제 네트워크의 2~8대 기기 검증이 남아 있습니다. 복귀 시 라운드 진행 지점은 저장하지 않아 미제출 플레이어는 같은 덱을 처음부터 다시 플레이합니다. 결과 미제출자의 제한 시간·기권 처리와 서버 시간 오프셋을 반영한 카운트다운도 아직 구현하지 않았습니다. 현재 시작 시각은 각 기기 시계를 기준으로 계산합니다. 기본 `local` 모드는 여전히 동일 출처 멀티탭 전용입니다.

## 제출 링크

| 항목 | 링크 | 상태 |
|---|---|---|
| 플레이 가능한 웹 빌드 | GitHub Pages URL 등록 예정 | 워크플로 구성 완료 |
| 전체 소스 코드 | 현재 저장소 | 프로토타입 구현 중 |
| 30~60초 플레이 영상 | 준비 중 | 미완료 |
| 게임 소개 및 설명 문서 | 준비 중 | 미완료 |
| AI 활용 기술 문서 | 준비 중 | 미완료 |
| 팀원 롤 기술서 | 개인 참가 시 생략 | 확인 필요 |

제출 직전 점검은 [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md)를 기준으로 진행합니다.

## 문서 관리

- `docs/source/`: PDF의 편집 가능한 원본
- `docs/final/`: 최종 제출용 PDF
- `docs/evidence/`: AI 프롬프트 및 외부 에셋 출처 증빙

## 개발 환경

- Node.js 20.19 이상
- Phaser 4.2.1
- Firebase JavaScript SDK 12.16.0
- Vite 8.1.5 + TypeScript 7.0.2
- Vitest 4.1.10 + Playwright 1.62.0
- QRCode 1.5.4
- Firebase Emulator Suite 사용 시 Java 21 권장

## 로컬 실행 — 서버 없는 멀티탭 모드

```bash
npm ci
npm run dev
```

개발 서버가 표시한 URL을 브라우저에서 엽니다. 혼자하기는 같은 Wi-Fi의 휴대폰에서도 개발 PC의 로컬 IP와 표시된 포트로 확인할 수 있습니다.

별도 `.env.local`이 없으면 Firebase 설정이 없는 것을 감지해 `local` 백엔드를 사용합니다. 명시적으로 고정하려면 `.env.example`을 `.env.local`로 복사하고 다음 값을 유지합니다.

```dotenv
VITE_MULTIPLAYER_BACKEND=local
```

이 모드의 방 흐름은 동일한 URL을 연 같은 출처의 브라우저 탭 두 개 이상에서 검증합니다.

Windows PowerShell 실행 정책 때문에 `npm` 스크립트 실행이 차단되는 환경에서는 동일한 명령의 `npm`을 `npm.cmd`로 바꿔 실행합니다.

## Firebase 실제 기기 모드 설정

1. Firebase Console에서 웹 앱을 등록하고 Authentication의 **Anonymous** 로그인과 Cloud Firestore를 활성화합니다.
2. `.env.example`을 `.env.local`로 복사한 뒤 아래 필수 값을 실제 웹 앱 설정으로 채웁니다.

```dotenv
VITE_MULTIPLAYER_BACKEND=firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_USE_EMULATORS=false
```

`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_MEASUREMENT_ID`는 선택 값입니다. 필수 4개 값 중 일부만 있으면 구성 오류를 표시하며, Firebase를 요청해 놓고 조용히 로컬 모드로 전환하지 않습니다.

3. 대상 프로젝트를 명시해 `firestore.rules`와 `firestore.indexes.json`을 배포합니다.

```bash
npx firebase-tools@15.24.0 deploy --project <firebase-project-id> --only firestore
```

4. `npm run dev` 또는 GitHub Pages 배포 빌드를 열고 서로 다른 기기에서 QR 참가, 방장 시작, 같은 덱, 결과 도착과 공동 결과 화면을 확인합니다.

웹 Firebase API 키는 클라이언트 구성 식별자이므로 저장소 비밀값처럼 취급하지 않지만, 허용되지 않은 데이터 접근은 Authentication, Firestore Security Rules, API 키 제한과 운영 전 App Check 검토로 막아야 합니다. 서비스 계정 키나 관리자 비밀키는 저장소와 Vite 환경 변수에 넣지 않습니다.

현재 실제 프로젝트 ID와 운영 배포는 아직 등록하지 않았습니다. 위 절차는 구현된 백엔드를 연결하기 위한 설정 방법이며, 완료 사실을 의미하지 않습니다.

## Firebase 보안 규칙 에뮬레이터

Java가 설치된 환경에서 다음 명령으로 임시 Firestore 에뮬레이터를 시작하고 보안 규칙 통합 테스트를 실행합니다.

```bash
npm run test:firebase-rules
```

이 테스트는 인증되지 않은 접근, 방 목록 조회, 본인이 아닌 참가자 조작, 비방장의 시작, 시작 후 참가, 타인의 결과 작성과 기존 결과 수정·삭제를 거부하고 정상 생성·참가·시작·결과 조회를 허용하는지 검사합니다. 본인이 제출한 점수와 메뉴의 실제 플레이 일치 여부는 검사하지 않습니다. 명령은 고정된 Firebase CLI 15.24.0과 데모 프로젝트 ID를 사용하며 실제 클라우드 데이터를 변경하지 않습니다.

앱 자체를 Emulator Suite에 연결해 확인할 때는 `.env.local`의 필수 Firebase 값을 데모용으로 채우고 `VITE_FIREBASE_USE_EMULATORS=true`로 바꾼 뒤 Auth(9099)와 Firestore(8080) 에뮬레이터를 함께 실행합니다.

## 검증 및 빌드

```bash
npm run typecheck
npm test
npm run test:firebase-rules
npm run test:e2e
npm run test:e2e:firebase
npm run build
npm run preview
```

- `npm run typecheck`: 통과했습니다.
- `npm test`: 기하·게임 규칙·메뉴·방·초대·QR 스캔·로컬/Firebase 런타임·공동 결과 집계 단위 테스트를 실행합니다.
- `npm run test:firebase-rules`: Firestore 에뮬레이터에서 실제 보안 규칙의 허용·거부 경계를 검증합니다.
- `npm run test:e2e`: 설치된 Google Chrome으로 홈, 핵심 제스처, 동일 출처 멀티탭 방 시작·방장 승계·대기실 및 시작 후 재접속·공동 결과 화면을 검증합니다.
- `npm run test:e2e:firebase`: 서로 격리된 Android형·iPhone형 BrowserContext를 Auth·Firestore 에뮬레이터에 연결해 QR 초대 URL 참가, 즉시 시작, 동일 명단·덱 동기화를 검증합니다.
- `npm run build`: 통과했으며 제출용 정적 파일을 `dist/`에 생성합니다.
- `npm run preview`: 생성된 `dist/` 빌드를 로컬에서 최종 확인합니다.

## GitHub Pages 배포

`.github/workflows/deploy-pages.yml`은 `main` 브랜치에 푸시될 때 단위 테스트, Firestore 규칙 테스트와 프로덕션 빌드를 실행한 뒤 `dist/`를 GitHub Pages에 배포합니다.

1. 공개 GitHub 저장소를 만들고 현재 저장소의 원격 저장소로 연결합니다.
2. 저장소 **Settings → Pages → Build and deployment**에서 Source를 **GitHub Actions**로 설정합니다.
3. `main` 브랜치를 푸시하고 Actions의 `Deploy GitHub Pages` 완료를 확인합니다.
4. 생성된 Pages URL을 위 제출 링크 표, 게임 소개 PDF, 제출 폼에 동일하게 기록합니다.

Firebase 모드로 Pages를 빌드하려면 저장소 **Settings → Secrets and variables → Actions → Variables**에 `.env.example`과 같은 이름의 `VITE_*` 값을 등록하고 `VITE_MULTIPLAYER_BACKEND`를 `firebase`로 설정합니다. 실제 프로젝트와 보안 규칙 배포를 완료하기 전에는 이 값을 바꾸지 않습니다.

Vite의 상대 경로 설정(`base: './'`)을 사용하므로 사용자 페이지와 프로젝트 페이지 경로 모두에서 정적 파일을 불러올 수 있습니다.
