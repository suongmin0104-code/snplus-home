# Changelog

## 2026-07-06

### Added

- Vite 기반 배포 구성 추가
- `.gitignore` 추가
- `.env.example` 추가
- 정적 사이트 lint 스크립트 추가
- `public/robots.txt` 추가
- `public/sitemap.xml` 추가
- `DOCS/DEPLOYMENT_CHECK.md` 작성
- `DOCS/VERCEL_DEPLOYMENT_GUIDE.md` 작성
- `DOCS/DOMAIN_CONNECTION_GUIDE.md` 작성
- `DOCS/PRODUCTION_CHECKLIST.md` 작성

### Changed

- `index.html` SEO 기본 메타 태그 보강
- `script.js`를 Vite 빌드에 포함하기 위해 `type="module"`로 로드
- README를 배포 준비 기준으로 갱신
- SEO, robots, sitemap 기본 도메인을 `https://snplus.ai.kr`로 변경

### Verified

- `npm install` 성공
- `npm run lint` 성공
- `npm run build` 성공

### Notes

- 현재 프로젝트는 Next.js/TypeScript/Tailwind가 아닌 정적 HTML/CSS/JS 구조입니다.
- 기존 디자인과 구조를 크게 바꾸지 않기 위해 Next.js 전환은 진행하지 않았습니다.
- Vercel과 DNS에서 `snplus.ai.kr` 연결 후 실제 접속 확인이 필요합니다.
