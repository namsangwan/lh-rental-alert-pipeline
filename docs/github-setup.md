# GitHub Setup Guide

## 목적

이 문서는 이 프로젝트를 GitHub Actions + GitHub Pages + Firebase Cloud Messaging 환경에서 실제로 동작시키기 위한 저장소 설정 절차를 정리한다.

대상 기능:

- 정기 크롤링
- JSON 생성 및 커밋
- GitHub Pages 배포
- FCM topic 푸시 발송

## 1. 저장소 기본 설정

필요한 기본 파일:

- [package.json](/Users/user/Documents/Codex/2026-04-26/lh/package.json)
- [crawl-and-publish.yml](/Users/user/Documents/Codex/2026-04-26/lh/.github/workflows/crawl-and-publish.yml)
- [scripts-contract.md](/Users/user/Documents/Codex/2026-04-26/lh/docs/scripts-contract.md)

저장소 기본 조건:

- GitHub repository 생성
- 기본 브랜치 `main`
- Actions 활성화
- Pages 활성화

## 2. GitHub Pages 설정

권장 설정:

1. GitHub 저장소 `Settings`
2. `Pages`
3. `Build and deployment`
4. `Source`를 `GitHub Actions`로 선택

이 프로젝트는 workflow 안에서 `actions/deploy-pages`를 사용하므로, 별도 `gh-pages` 브랜치를 수동으로 관리하지 않아도 된다.

배포 후 앱이 읽게 될 대표 URL 예시:

- `https://<owner>.github.io/<repo>/notices.json`
- `https://<owner>.github.io/<repo>/metadata.json`

## 3. Actions 권한 설정

권장 설정:

1. `Settings`
2. `Actions`
3. `General`
4. `Workflow permissions`
5. `Read and write permissions` 선택
6. `Allow GitHub Actions to create and approve pull requests`는 필요 없으면 비활성 유지

이유:

- workflow가 `data/`와 `public/` 파일을 커밋하고 push해야 한다.

## 4. GitHub Secrets 설정

필수 secret:

- `FIREBASE_SERVICE_ACCOUNT_JSON`

설정 위치:

1. `Settings`
2. `Secrets and variables`
3. `Actions`
4. `New repository secret`

값:

- Firebase 서비스 계정 JSON 전체 문자열

주의:

- JSON 파일 자체를 저장소에 커밋하면 안 된다.
- 줄바꿈 포함 원문 그대로 넣는 것이 가장 안전하다.

## 5. Firebase 설정

필요한 작업:

1. Firebase 프로젝트 생성
2. Android 앱 등록
3. iOS 앱 등록
4. Cloud Messaging 활성화
5. 서비스 계정 생성
6. 서비스 계정 JSON 발급

권장 topic 예시:

- `all-notices`
- `region-seoul`
- `region-gyeonggi`
- `region-busan`
- `type-publicrental`
- `type-happyhouse`
- `type-permanentrental`

앱이 해야 할 일:

- 사용자 설정에 따라 topic 구독/해제

GitHub Actions가 해야 할 일:

- 신규 공고에 맞는 topic으로 메시지 발송

## 6. Branch 보호 관련 주의

이 workflow는 실행 후 자동 commit/push를 수행한다.

그래서 아래 경우에는 추가 조정이 필요하다.

- `main` 브랜치에 강한 보호 규칙이 걸려 있는 경우
- Actions bot의 push가 막혀 있는 경우

이럴 때 선택지는 2가지다.

1. `main`에 대한 GitHub Actions push 허용
2. 산출물 전용 브랜치를 따로 두고 그 브랜치에만 자동 push

초기에는 1번이 가장 단순하다.

## 7. Repository Variables

초기에는 필수는 아니지만, 나중에 아래 값을 Variables로 분리하면 운영이 편해진다.

예시:

- `LH_CRAWL_ENABLED`
- `LH_SNAPSHOT_RETENTION_COUNT`
- `FCM_ENABLED`

초기 MVP는 hardcoded 값으로도 충분하다.

## 8. 수동 테스트 순서

배포 전 권장 순서:

1. 로컬에서 `node scripts/crawl-lh.js`
2. 로컬에서 `node scripts/build-json.js`
3. 생성된 `public/notices.json` 확인
4. `node scripts/validate-data.js`
5. GitHub에 push
6. GitHub Actions에서 `workflow_dispatch`로 수동 실행
7. 첫 실행은 `skip_fcm=true`로 테스트
8. Pages URL에서 JSON 노출 확인
9. 이후 `skip_fcm=false`로 FCM 테스트

## 9. 첫 배포 체크리스트

- GitHub Pages가 `GitHub Actions` 소스로 설정됨
- Actions 권한이 `Read and write permissions`
- `FIREBASE_SERVICE_ACCOUNT_JSON` secret 등록 완료
- workflow 수동 실행 성공
- `public/notices.json` 배포 확인
- 테스트 단말의 FCM topic 구독 확인
- 신규 공고 발생 시 알림 수신 확인

## 10. 운영 팁

- 첫 운영 주에는 workflow 결과를 자주 확인하는 편이 좋다.
- LH 사이트 구조가 바뀌면 가장 먼저 `crawl-lh.ts`가 실패할 가능성이 높다.
- 파서가 이상하게 동작해 0건이 나오는 경우 `validate-data.ts`가 배포를 막아준다.
- 알림 과발송을 막기 위해 첫 며칠은 `skip_fcm` 수동 테스트를 충분히 하는 편이 안전하다.
