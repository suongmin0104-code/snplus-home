# 배포 준비 점검 기록

작성일: 2026-07-06

## 프로젝트 위치

- 실제 작업 위치: `C:\Users\에스앤\Documents\ai협력`
- 요청서 기준 위치 `E:\PROJECTS\07_WEB\SN_HOME`는 현재 PC에서 확인되지 않음

## 프로젝트 타입

- 현재 구조: 정적 HTML/CSS/JavaScript 홈페이지
- 배포 빌드 도구: Vite
- Next.js: 미사용
- TypeScript: 미사용
- Tailwind CSS: 미사용

기존 코드 구조를 크게 바꾸지 않는 조건에 따라 Next.js/TypeScript/Tailwind 전환은 진행하지 않았습니다. 현재 디자인과 파일 구조를 유지하면서 Vercel 정적 배포가 가능하도록 최소 배포 구성을 추가했습니다.

## 사용 기술

- HTML: `index.html`
- CSS: `styles.css`
- JavaScript: `script.js`
- Build Tool: Vite
- 배포 대상: Vercel 정적 사이트
- GitHub 저장소 연동 준비: 가능

## 주요 폴더

- `assets/`: 이미지, 카탈로그 미리보기, 공개 PDF 자료
- `assets/docs/`: 공개 가능한 PDF만 유지
- `public/`: `robots.txt`, `sitemap.xml`
- `DOCS/`: 배포 및 운영 문서
- `scripts/`: 정적 사이트 점검 스크립트
- `dist/`: 빌드 결과물, 커밋 제외

## 공개 PDF 점검

현재 공개 폴더에 포함된 문서:

- `assets/docs/sn-catalog.pdf`
- `assets/docs/sn-company-profile-2026-cover.pdf`
- `assets/docs/sn-credit-report-cover.pdf`

공사 지명원과 신용평가보고서는 첫 페이지만 공개하는 파일로 유지했습니다. 전체 원본 PDF는 공개 assets 폴더에 두지 않는 기준입니다.

## 명령어

개발 실행:

```bash
npm run dev
```

정적 점검:

```bash
npm run lint
```

운영 빌드:

```bash
npm run build
```

빌드 결과 미리보기:

```bash
npm run preview
```

Vercel 배포 시 기본값:

- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

## 빌드 결과

- `npm install`: 성공
- `npm run lint`: 성공
- `npm run build`: 성공
- Vite 버전: `7.3.6`

## SEO 점검

추가 또는 확인한 항목:

- `title`
- `description`
- `robots`
- `canonical`
- `og:title`
- `og:description`
- `og:url`
- `og:image`
- `twitter:card`
- favicon
- `public/robots.txt`
- `public/sitemap.xml`

현재 운영 도메인 기준값은 `https://snplus.ai.kr`입니다. 도메인 연결 또는 변경 시 아래 항목을 함께 확인해야 합니다.

- `index.html`의 canonical
- `index.html`의 `og:url`
- `index.html`의 `og:image`
- `public/robots.txt`의 Sitemap URL
- `public/sitemap.xml`의 `loc`
- 필요 시 `.env.example` 기준 환경변수

## 현재 문제점

- 현재 프로젝트는 Next.js 프로젝트가 아니므로 Next.js App Router 방식의 `metadata`, `robots.ts`, `sitemap.ts`는 적용하지 않았습니다.
- Vercel CLI는 설치되어 있지 않습니다.
- 카카오톡 채널 URL은 아직 실제 주소 확인이 필요합니다.
- 실제 운영 도메인이 아직 없습니다.

## 수정한 내용

- Vite 기반 배포 구성 추가
- `.gitignore` 추가
- `.env.example` 추가
- SEO 기본 메타 태그 추가
- `robots.txt`, `sitemap.xml` 추가
- 정적 사이트 점검 스크립트 추가
- 배포/도메인/운영 문서 추가
- README 배포 섹션 정리

## 남은 확인 사항

- GitHub 원격 저장소 URL 등록
- Vercel Dashboard에서 프로젝트 Import
- `snplus.ai.kr` DNS 연결
- 실제 배포 후 SEO URL 최종 확인
- 카카오톡 채널 URL 확정
- 대표 OG 이미지 최종 확정
