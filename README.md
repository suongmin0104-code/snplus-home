# 주식회사 에스앤 홈페이지

주식회사 에스앤의 정적 홈페이지 프로젝트입니다. 기존 HTML/CSS/JavaScript 구조를 유지하면서 Vite 기반 빌드와 Vercel 정적 배포가 가능하도록 준비했습니다.

## 프로젝트 구조

- `index.html`: 홈페이지 본문
- `styles.css`: 전체 스타일
- `script.js`: 화면 전환, 드롭다운, 슬라이더 동작
- `assets/`: 이미지, 카탈로그 이미지, 공개 PDF
- `public/`: robots, sitemap
- `DOCS/`: 배포 및 운영 문서

## 공개 자료

- `assets/docs/sn-catalog.pdf`: 제품 카탈로그
- `assets/docs/sn-company-profile-2026-cover.pdf`: 공사 지명원 공개용 첫 페이지
- `assets/docs/sn-credit-report-cover.pdf`: 신용평가보고서 공개용 첫 페이지

공사 지명원과 신용평가보고서는 민감정보 보호를 위해 첫 페이지만 공개합니다.

## 개발 실행

```bash
npm install
npm run dev
```

기본 개발 주소:

```text
http://127.0.0.1:5173/
```

기존 임시 확인 서버를 쓰는 경우:

```text
http://127.0.0.1:4173/
```

## 점검

```bash
npm run lint
```

## 빌드

```bash
npm run build
```

빌드 결과는 `dist/` 폴더에 생성됩니다.

## 배포

Vercel 배포 기준:

- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`
- Framework Preset: `Vite` 또는 `Other`

상세 문서:

- `DOCS/DEPLOYMENT_CHECK.md`
- `DOCS/VERCEL_DEPLOYMENT_GUIDE.md`
- `DOCS/DOMAIN_CONNECTION_GUIDE.md`
- `DOCS/PRODUCTION_CHECKLIST.md`

## 도메인 연결

현재 운영 도메인 기준값은 `https://snplus.ai.kr`입니다. 도메인 연결 또는 변경 시 아래 파일의 URL을 함께 확인합니다.

- `index.html`
- `public/robots.txt`
- `public/sitemap.xml`

자세한 절차는 `DOCS/DOMAIN_CONNECTION_GUIDE.md`를 확인합니다.
