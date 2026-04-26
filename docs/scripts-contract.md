# Scripts Contract

## 목적

이 문서는 GitHub Actions workflow가 호출하는 스크립트들의 역할과 입출력 계약을 정의한다.  
구현 전에 계약을 먼저 고정해두면, 크롤링/JSON 생성/알림 발송을 독립적으로 개발하기 쉽다.

대상 스크립트:

- `scripts/crawl-lh.js`
- `scripts/build-json.js`
- `scripts/send-fcm.js`
- `scripts/validate-data.js`

## 1. 전체 실행 흐름

워크플로 기준 실행 순서:

1. `npm run crawl`
2. `npm run build:json`
3. `npm run push:fcm`

`npm run crawl:publish`는 1번과 2번을 묶는 명령이다.

## 2. 디렉터리 계약

기본 디렉터리:

- `data/`
- `data/snapshots/`
- `public/`
- `tmp/`

각 디렉터리 용도:

- `data/`: 내부 비교용 파일
- `data/snapshots/`: 디버깅용 스냅샷
- `public/`: GitHub Pages 공개 파일
- `tmp/`: 런타임 임시 파일

## 3. `npm run crawl`

실행 명령:

```bash
npm run crawl
```

실제 스크립트:

```bash
node scripts/crawl-lh.js
```

역할:

- LH 공고 목록 페이지를 가져온다.
- HTML을 파싱한다.
- 공고 배열을 정규화한다.
- 비교 가능한 내부 원본 파일을 `data/latest.json`에 기록한다.
- 선택적으로 스냅샷 파일을 `data/snapshots/`에 남긴다.

필수 출력 파일:

- `data/latest.json`

선택 출력 파일:

- `data/snapshots/<timestamp>.json`

성공 조건:

- `data/latest.json`이 생성된다.
- JSON 형식이 유효하다.
- `items` 배열이 존재한다.

실패 조건:

- LH 페이지 요청 실패
- HTML 파싱 실패
- 결과 구조가 비정상
- 공고 수가 0이고, 스크립트 내부 검증 기준상 비정상으로 판단

`data/latest.json` 권장 구조:

```json
{
  "generatedAt": "2026-04-26T03:00:00Z",
  "sourceUrl": "https://apply.lh.or.kr/...",
  "count": 123,
  "items": [
    {
      "id": "lh-abc123",
      "sourceNoticeKey": "abc123",
      "contentHash": "sha256-...",
      "title": "부천원종 A1블록 행복주택 예비입주자 모집 공고",
      "noticeType": "행복주택",
      "noticeSubtype": null,
      "region": "경기도",
      "status": "공고중",
      "postedAt": "2026-04-25",
      "deadlineAt": "2026-05-03",
      "detailUrl": "https://apply.lh.or.kr/...",
      "attachments": [],
      "viewCount": 1203
    }
  ]
}
```

## 4. `npm run build:json`

실행 명령:

```bash
npm run build:json
```

실제 스크립트:

```bash
node scripts/build-json.js
```

역할:

- 직전 공개 데이터와 `data/latest.json`을 비교한다.
- 신규 공고 수를 계산한다.
- 앱 공개용 JSON 파일을 생성한다.
- FCM 발송 대상 정보를 내부 파일로 생성한다.

입력 파일:

- `data/latest.json`
- `public/notices.json` 또는 이전 비교용 기준 파일

필수 출력 파일:

- `public/notices.json`
- `public/metadata.json`
- `data/fcm-payloads.json`

권장 출력 파일:

- `data/changes.json`

`public/metadata.json` 권장 구조:

```json
{
  "generatedAt": "2026-04-26T03:00:00Z",
  "noticeCount": 123,
  "newNoticeCount": 2,
  "updatedNoticeCount": 1,
  "sourceUrl": "https://apply.lh.or.kr/...",
  "version": "2026-04-26T03:00:00Z"
}
```

`data/fcm-payloads.json` 권장 구조:

```json
{
  "generatedAt": "2026-04-26T03:00:00Z",
  "newNoticeCount": 2,
  "messages": [
    {
      "topic": "all-notices",
      "title": "[LH 신규공고] 경기도 행복주택 공고가 등록되었어요",
      "body": "부천원종 A1블록 행복주택 예비입주자 모집 공고를 확인해보세요.",
      "data": {
        "noticeId": "lh-abc123",
        "noticeType": "행복주택",
        "region": "경기도",
        "detailUrl": "https://apply.lh.or.kr/..."
      }
    }
  ]
}
```

핵심 규칙:

- `newNoticeCount`는 `metadata.json`과 `fcm-payloads.json`에서 일치해야 한다.
- 신규 공고가 없으면 `messages`는 빈 배열이어야 한다.

## 5. `npm run push:fcm`

실행 명령:

```bash
npm run push:fcm
```

실제 스크립트:

```bash
node scripts/send-fcm.js
```

역할:

- `data/fcm-payloads.json`을 읽는다.
- Firebase Admin SDK로 topic 푸시를 보낸다.

입력 파일:

- `data/fcm-payloads.json`
- `tmp/firebase-service-account.json`

필수 환경 변수:

- `FIREBASE_CREDENTIALS_PATH`

동작 규칙:

- `messages.length === 0`이면 성공 종료한다.
- 각 메시지는 topic 단위로 발송한다.
- 하나의 메시지 실패가 전체 실패가 되도록 시작하는 편이 초기 운영에 안전하다.

로그 권장 내용:

- 발송 시각
- 메시지 수
- topic 이름
- Firebase 응답 ID

## 6. `npm run validate:data`

실행 명령:

```bash
npm run validate:data
```

실제 스크립트:

```bash
node scripts/validate-data.js
```

역할:

- `public/notices.json`
- `public/metadata.json`
- `data/fcm-payloads.json`

위 파일들의 구조를 검증한다.

초기에는 GitHub Actions의 inline 검증으로도 충분하지만, 나중에는 별도 스크립트로 분리하는 것이 좋다.

## 7. 워크플로와의 연결 규칙

현재 workflow 파일은 아래를 전제로 한다.

- `npm run crawl:publish` 실행 후 `public/notices.json`, `public/metadata.json`이 생성되어야 한다.
- `public/metadata.json`에는 `generatedAt`, `noticeCount`, `newNoticeCount`가 있어야 한다.
- `npm run push:fcm`는 `data/fcm-payloads.json`을 읽어야 한다.

즉 구현 시 가장 먼저 맞춰야 할 계약은 아래다.

1. `crawl-lh.js`는 `data/latest.json` 생성
2. `build-json.js`는 `public/notices.json`, `public/metadata.json`, `data/fcm-payloads.json` 생성
3. `send-fcm.js`는 `data/fcm-payloads.json` 소비

## 8. 추천 구현 순서

가장 안정적인 순서는 아래다.

1. `crawl-lh.js`
2. `build-json.js`
3. `validate-data.js`
4. `send-fcm.js`

이 순서가 좋은 이유는, 푸시 발송 전에 데이터 생성과 비교 판정이 먼저 안정화되어야 하기 때문이다.
