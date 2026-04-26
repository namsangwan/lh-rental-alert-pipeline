# LH 공공임대 알림 시스템 설계 초안

## 1. 문서 목적

이 문서는 `LH 공공임대 공고를 수집하고`, `신규 공고를 감지하고`, `모바일 앱에서 쉽게 조회하고`, `새 공고가 나오면 푸시 알림을 보내는 구조`를 설계하기 위한 기준 문서다.

이번 버전의 핵심 방향은 다음과 같다.

- 별도 DB를 두지 않는다.
- 별도 상시 서버를 두지 않는다.
- 정적 JSON 데이터를 생성해 공개 URL로 배포한다.
- 스케줄 실행은 GitHub Actions의 cron을 사용한다.
- 푸시는 Firebase Cloud Messaging(FCM)으로 보낸다.

즉, 전통적인 `API 서버 + DB + 배치 서버` 구조가 아니라, `정적 데이터 파이프라인` 구조로 설계한다.

## 2. 왜 이 구조가 맞는가

이 서비스의 특성은 아래와 같다.

- LH 공고 생성 빈도가 높지 않다.
- 하루에 공고가 0건인 날이 더 많을 수 있다.
- 데이터 양이 작다.
- 앱이 필요한 정보는 대부분 "최신 공고 목록"과 "상세 링크"다.
- 실시간 초저지연이 꼭 필요하지 않다.

따라서 항상 켜져 있는 서버와 DB를 운영하는 것보다 아래 구조가 더 효율적이다.

1. GitHub Actions가 주기적으로 LH 공고를 수집한다.
2. 파싱 결과를 JSON 파일로 만든다.
3. JSON 파일을 GitHub Pages에 공개한다.
4. 앱은 그 JSON URL을 읽어 목록을 보여준다.
5. 신규 공고가 있으면 GitHub Actions가 FCM으로 푸시를 보낸다.

이 방식의 장점:

- 운영 비용이 거의 없다.
- 인프라 관리가 단순하다.
- 장애 지점이 적다.
- 앱 초기 버전을 매우 빠르게 만들 수 있다.

## 3. 수집 대상 페이지에서 확인한 점

대상 페이지: [LH청약플러스 임대주택 공고문](https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026)

확인한 내용:

- 목록 페이지에서 `유형`, `입주자격`, `지역`, `상태`, `기간`, `공고명` 기준 검색이 가능하다.
- 목록 컬럼은 `번호`, `유형`, `공고명`, `지역`, `첨부`, `게시일`, `마감일`, `상태`, `조회수`로 보인다.
- 실제 목록에는 `공공임대`, `행복주택`, `영구임대`, `매입임대`, `전세임대` 등 여러 유형이 함께 노출된다.
- 상태는 `공고중`, `정정공고중`, `접수중`, `접수마감` 등으로 구분된다.
- 현재 페이지는 서버 렌더링된 HTML에서도 목록 텍스트가 확인되어, 1차 구현은 브라우저 자동화 없이 `HTTP 요청 + HTML 파싱`으로 시작할 가능성이 높다.

## 4. 권장 아키텍처

### 4.1 전체 구조

권장 구조는 아래와 같다.

1. GitHub Actions cron이 정해진 시간에 실행된다.
2. 수집 스크립트가 LH 공고 목록을 가져와 파싱한다.
3. 파싱 결과를 `data/*.json` 파일로 생성한다.
4. 이전 실행 결과와 비교해 신규 공고를 판별한다.
5. 신규 공고가 있으면 FCM으로 푸시를 발송한다.
6. 생성된 JSON 파일을 GitHub Pages에 배포한다.
7. 모바일 앱은 GitHub Pages의 공개 JSON URL을 읽어 화면을 구성한다.

### 4.2 구성 요소

#### 수집기(Collector)

역할:

- LH 목록 페이지 요청
- HTML 파싱
- 필요 시 상세 페이지 추가 수집

권장 구현:

- Node.js + TypeScript
- `fetch/axios + cheerio`
- 예비 수단으로 Playwright 준비

#### 정규화기(Normalizer)

역할:

- LH 원본 구조를 앱에서 쓰기 쉬운 JSON 구조로 변환
- 날짜, 상태, 지역명, 유형 문자열을 표준화

#### 변경 감지기(Change Detector)

역할:

- 이번 실행 결과와 이전 JSON 파일을 비교
- 신규 공고와 수정 공고를 판별

#### 정적 데이터 배포기(Publisher)

역할:

- 최종 JSON 파일을 GitHub Pages에 배포
- 앱이 항상 같은 URL 패턴으로 접근 가능하게 유지

#### 알림 발송기(Notification Sender)

역할:

- 신규 공고가 있을 때 FCM 호출
- 공고 링크 또는 앱 딥링크를 payload에 포함

## 5. 저장소 구조 권장안

예시:

```text
/
  scripts/
    crawl-lh.ts
    normalize-notices.ts
    detect-changes.ts
    send-fcm.ts
    build-json.ts
  data/
    latest.json
    notices.json
    metadata.json
    snapshots/
      2026-04-26T060000Z.json
  public/
    notices.json
    metadata.json
  .github/
    workflows/
      crawl-and-publish.yml
  docs/
    lh-rental-server-plan.md
```

설명:

- `data/`: 내부 비교용 산출물
- `public/`: GitHub Pages에 실제 공개할 파일
- `snapshots/`: 디버깅용 과거 결과 저장

## 6. 데이터 흐름

권장 흐름:

1. GitHub Actions cron 실행
2. LH 공고 목록 요청
3. 목록 파싱
4. 정규화된 공고 배열 생성
5. 기존 `data/latest.json`과 비교
6. 신규 공고 목록 추출
7. `public/notices.json`, `public/metadata.json` 생성
8. 신규 공고가 있으면 FCM 발송
9. 결과 파일 commit 또는 Pages 배포 브랜치 반영
10. 앱이 공개 JSON URL을 읽어 최신 목록 노출

## 7. JSON 중심 데이터 모델

DB 대신 JSON 파일을 시스템의 기준 데이터로 본다.

### 7.1 `public/notices.json`

앱이 직접 읽는 메인 목록 파일.

예시 필드:

- `id`
- `source`
- `sourceNoticeKey`
- `title`
- `noticeType`
- `noticeSubtype`
- `region`
- `status`
- `postedAt`
- `deadlineAt`
- `detailUrl`
- `attachments`
- `viewCount`
- `isNew`
- `lastChangedAt`

예시 구조:

```json
{
  "generatedAt": "2026-04-26T06:00:00Z",
  "count": 123,
  "items": [
    {
      "id": "lh-abc123",
      "source": "lh",
      "sourceNoticeKey": "abc123",
      "title": "부천원종 A1블록 행복주택 예비입주자 모집 공고",
      "noticeType": "행복주택",
      "noticeSubtype": null,
      "region": "경기도",
      "status": "공고중",
      "postedAt": "2026-04-25",
      "deadlineAt": "2026-05-03",
      "detailUrl": "https://apply.lh.or.kr/...",
      "attachments": [],
      "viewCount": 1203,
      "isNew": true,
      "lastChangedAt": "2026-04-26T06:00:00Z"
    }
  ]
}
```

### 7.2 `public/metadata.json`

앱의 동기화와 상태 표시용 파일.

예시 필드:

- `generatedAt`
- `noticeCount`
- `newNoticeCount`
- `sourceUrl`
- `version`

### 7.3 `data/latest.json`

비교 기준이 되는 내부 파일.

용도:

- 직전 실행 결과 저장
- 신규/변경 여부 판단

### 7.4 `data/snapshots/*.json`

선택 사항이다.

용도:

- 파싱 결과 이력 보관
- 파서 오류 분석
- LH HTML 구조 변경 대응

## 8. "신규 공고" 판별 기준

이 구조에서도 가장 중요한 것은 식별자다.

### 8.1 최우선 기준

목록/상세 페이지에서 `공고 고유 ID` 또는 `상세 URL의 고유 파라미터`를 얻을 수 있으면 그것을 `sourceNoticeKey`로 사용한다.

### 8.2 고유 ID를 바로 못 얻는 경우

임시로 아래 조합을 해시해서 식별자를 만든다.

- 공고명
- 유형
- 지역
- 게시일
- 마감일

### 8.3 변경 감지 기준

아래 필드를 합쳐 `contentHash`를 만든다.

- 제목
- 상태
- 게시일
- 마감일
- 첨부 목록
- 상세 본문 요약

판정 방식:

- 새 `sourceNoticeKey`면 `NEW`
- 같은 `sourceNoticeKey`인데 `contentHash`가 바뀌면 `UPDATED`

## 9. 앱이 데이터를 사용하는 방식

앱은 별도 API 서버 대신 공개 JSON URL을 읽는다.

예:

- `https://<github-pages-domain>/notices.json`
- `https://<github-pages-domain>/metadata.json`

현재 배포 URL:

- `https://namsangwan.github.io/lh-rental-alert-pipeline/notices.json`
- `https://namsangwan.github.io/lh-rental-alert-pipeline/metadata.json`
- `https://namsangwan.github.io/lh-rental-alert-pipeline/categories.json`
- `https://namsangwan.github.io/lh-rental-alert-pipeline/rental/notices.json`
- `https://namsangwan.github.io/lh-rental-alert-pipeline/sale/notices.json`
- `https://namsangwan.github.io/lh-rental-alert-pipeline/land/notices.json`

앱 동작 방식:

1. 앱 시작 시 `metadata.json` 조회
2. 갱신 시간이 달라졌으면 `notices.json` 새로 다운로드
3. 앱 내부에서 지역/유형/상태 필터 수행
4. 상세는 `detailUrl`을 웹뷰 또는 외부 브라우저로 연다

이 구조의 핵심은 "검색과 필터 대부분을 앱에서 처리"하는 것이다.

## 10. 알림 설계

### 10.1 사용자 푸시 방식

푸시는 FCM을 사용한다.

- Android: FCM 직접 수신
- iOS: FCM SDK 사용, 실제 iOS 전달은 APNs 연동

### 10.2 이 구조에서 중요한 제약

상시 서버와 DB가 없으면, 서버가 각 사용자별 토큰과 개인별 관심 조건을 보관하기 어렵다.

그래서 초기 버전에서는 아래 둘 중 하나를 선택하는 것이 현실적이다.

1. 모든 사용자에게 동일한 "새 공고 있음" 푸시 발송
2. 앱에서 FCM topic을 직접 구독하고, GitHub Actions가 topic으로 발송

추천은 2번이다.

예:

- `all-notices`
- `region-seoul`
- `region-gyeonggi`
- `type-happyhouse`
- `type-publicrental`

즉, 사용자가 앱 안에서 관심 지역/유형을 고르면 앱이 해당 topic을 구독하고, GitHub Actions는 신규 공고 유형에 맞는 topic으로 메시지를 보내는 방식이다.

### 10.3 푸시 메시지 예시

제목:

`[LH 신규공고] 경기도 행복주택 공고가 등록되었어요`

본문:

`부천원종 A1블록 행복주택 예비입주자 모집 공고를 확인해보세요.`

데이터 payload 예시:

- `noticeId`
- `noticeType`
- `region`
- `detailUrl`
- `generatedAt`

### 10.4 FCM 인증 정보 보관

GitHub Actions에서 FCM을 호출하려면 인증 정보가 필요하다.

권장 방식:

- Firebase 서비스 계정 JSON을 GitHub Actions Secrets에 저장
- 워크플로에서 런타임 파일로 복원하여 사용

주의:

- 서비스 계정 JSON을 저장소에 커밋하면 안 된다.
- 민감 정보는 모두 GitHub Secrets로 관리한다.

## 11. GitHub Actions 설계

### 11.1 실행 주기

초기 권장:

- 하루 2회
- 예: 오전 6시, 오후 6시 UTC 기준 또는 한국 시간 기준에 맞춘 cron

공고 빈도를 생각하면 이 정도면 충분할 가능성이 높다.

### 11.2 워크플로 단계

권장 순서:

1. 저장소 checkout
2. Node.js 설치
3. 의존성 설치
4. LH 수집 스크립트 실행
5. JSON 생성
6. 직전 결과와 비교
7. 신규 공고가 있으면 FCM 발송
8. `public/` 산출물 배포

### 11.3 실패 처리

최소한 아래는 넣는 것이 좋다.

- 수집 실패 시 workflow 실패
- 파싱 결과가 비정상적으로 0건이면 실패 처리 또는 경고
- FCM 실패와 JSON 배포 실패를 구분해서 로그 남기기

## 12. GitHub Pages 설계

GitHub Pages는 앱이 읽는 공개 데이터 호스팅 용도로 사용한다.

권장 공개 파일:

- `notices.json`
- `metadata.json`

선택 공개 파일:

- `latest-top10.json`
- `regions.json`
- `types.json`

장점:

- URL이 단순하다.
- 앱에서 캐싱 제어가 쉽다.
- 별도 서버 운영이 필요 없다.

## 13. 이 구조의 장점과 한계

### 13.1 장점

- 서버 운영이 필요 없다.
- DB가 없어 구조가 단순하다.
- 비용이 거의 없다.
- 앱은 정적 JSON만 읽으면 된다.
- 공고량이 적은 서비스에 잘 맞는다.

### 13.2 한계

- 사용자별 맞춤 알림을 정교하게 관리하기 어렵다.
- 사용자 읽음 상태, 저장, 개인화 이력은 서버 없이 관리하기 어렵다.
- FCM topic 기반으로만 가면 알림 조건이 다소 거칠어진다.
- GitHub Actions와 GitHub Pages에 배포가 의존된다.

결론적으로 초기 MVP에는 매우 적합하지만, 나중에 아래 기능이 필요해지면 서버 재도입을 검토해야 한다.

- 사용자별 정교한 관심 조건 저장
- 읽음 처리 동기화
- 즐겨찾기 동기화
- 고급 검색
- 관리자 화면

## 14. 운영상 주의점

### 14.1 LH 사이트 정책 확인

실서비스 전에는 반드시 아래를 확인해야 한다.

- LH 사이트 이용약관
- 크롤링 허용 범위
- 과도한 트래픽 여부

### 14.2 데이터 품질

현실적으로 자주 발생하는 문제:

- 같은 공고의 정정본이 신규처럼 보이는 문제
- 지역명 표기가 달라지는 문제
- 첨부파일만 바뀌는 문제
- 목록에는 있지만 상세 본문 확보가 늦는 문제

그래서 `latest.json`과 `snapshots/` 보관은 꽤 중요하다.

### 14.3 정적 구조에서의 안전장치

권장 사항:

- 결과가 0건이면 바로 배포하지 말고 실패 처리
- 기존 JSON을 덮어쓰기 전에 임시 파일 검증
- 스냅샷 최근 N개만 유지
- 파서가 깨졌을 때 알림 받을 수 있게 workflow 실패 알림 설정

## 15. 권장 개발 순서

### Phase 1. 수집기 MVP

목표:

- LH 목록 페이지 수집
- 공고 목록 파싱
- `notices.json` 생성

완료 기준:

- 로컬 실행 시 JSON 파일이 생성된다.
- 같은 데이터를 두 번 실행해도 신규 판정이 안정적이다.

### Phase 2. GitHub Actions 자동화

목표:

- cron 실행
- 결과 파일 자동 생성
- GitHub Pages 자동 배포

완료 기준:

- 정해진 시간마다 JSON이 갱신된다.
- 앱에서 공개 URL로 최신 공고를 읽을 수 있다.

### Phase 3. 푸시 알림

목표:

- FCM 연동
- 신규 공고 감지 시 topic 푸시 발송

완료 기준:

- 테스트 디바이스에서 실제 알림을 수신한다.

### Phase 4. 앱 연동 최적화

목표:

- 앱 캐싱 전략 정리
- topic 구독 규칙 정리
- JSON 경량화

완료 기준:

- 앱에서 빠르게 목록을 표시하고, 불필요한 다운로드가 줄어든다.

## 16. 내가 추천하는 초기 구현 범위

처음에는 아래만 있으면 충분하다.

1. LH 목록 수집
2. `public/notices.json` 생성
3. `public/metadata.json` 생성
4. GitHub Actions cron 자동화
5. GitHub Pages 배포
6. 신규 공고 발생 시 `all-notices` topic 푸시 발송

처음부터 사용자별 개인화 푸시까지 가려고 하지 않는 것이 좋다.

## 17. 추천 결론

현재 조건에서는 아래 구조가 가장 현실적이다.

1. `Node.js + TypeScript` 수집 스크립트로 시작한다.
2. DB 없이 `JSON 파일`을 기준 데이터로 사용한다.
3. `GitHub Actions cron`으로 수집과 신규 감지를 실행한다.
4. `GitHub Pages`로 JSON을 공개 배포한다.
5. 앱은 공개 JSON URL을 직접 읽는다.
6. 알림은 `FCM topic` 기반으로 단순하게 시작한다.

이 프로젝트의 첫 성공 기준은 아래처럼 잡는 것이 좋다.

- GitHub Actions가 LH 공고를 수집한다.
- `notices.json`이 GitHub Pages에 배포된다.
- 신규 공고가 생기면 테스트 폰에 FCM 알림이 온다.

## 18. 다음 문서/작업으로 바로 이어질 항목

다음으로 만들면 좋은 산출물:

1. JSON 스키마 명세서
2. GitHub Actions workflow 설계 문서
3. FCM topic 설계 문서
4. 앱 데이터 동기화 규칙 문서
5. LH 수집용 파서 명세 문서

---

## 참고 링크

- LH 공고문 페이지: [https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026](https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026)
- Firebase Cloud Messaging 개요: [https://firebase.google.com/docs/cloud-messaging](https://firebase.google.com/docs/cloud-messaging)
- FCM HTTP v1 서버 발송: [https://firebase.google.com/docs/cloud-messaging/auth-server](https://firebase.google.com/docs/cloud-messaging/auth-server)
- GitHub Actions: [https://docs.github.com/actions](https://docs.github.com/actions)
- GitHub Pages: [https://docs.github.com/pages](https://docs.github.com/pages)
