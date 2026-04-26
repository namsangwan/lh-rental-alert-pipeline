# LH Rental Alert Pipeline

LH 공공임대 공고를 주기적으로 수집해 정적 JSON으로 배포하고, 신규 공고가 나오면 FCM topic 푸시를 보내는 경량 파이프라인이다.

## 핵심 구조

- 수집: `scripts/crawl-lh.js`
- 공개 JSON 생성: `scripts/build-json.js`
- 데이터 검증: `scripts/validate-data.js`
- FCM 발송: `scripts/send-fcm.js`
- 배포 자동화: `.github/workflows/crawl-and-publish.yml`

## 로컬 실행

```bash
node scripts/crawl-lh.js
node scripts/build-json.js
node scripts/validate-data.js
```

## 배포 구성

- GitHub Actions cron
- GitHub Pages
- Firebase Cloud Messaging topic push

## 공개 JSON URL

- `https://namsangwan.github.io/lh-rental-alert-pipeline/notices.json`
- `https://namsangwan.github.io/lh-rental-alert-pipeline/metadata.json`
- `https://namsangwan.github.io/lh-rental-alert-pipeline/categories.json`
- `https://namsangwan.github.io/lh-rental-alert-pipeline/rental/notices.json`
- `https://namsangwan.github.io/lh-rental-alert-pipeline/sale/notices.json`
- `https://namsangwan.github.io/lh-rental-alert-pipeline/land/notices.json`

## 참고 문서

- `docs/lh-rental-server-plan.md`
- `docs/scripts-contract.md`
- `docs/github-setup.md`
