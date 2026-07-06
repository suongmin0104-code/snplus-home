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
- 운영용 `public/404.html` 추가
- PWA 기본 정보용 `public/site.webmanifest` 추가
- favicon, apple-touch-icon, manifest icon 추가
- Open Graph 대표 이미지 `assets/company/sn-og-image.jpg` 추가
- Vercel 정적 자산 캐시 헤더 설정 `vercel.json` 추가

### Changed

- `index.html` SEO 기본 메타 태그 보강
- `script.js`를 Vite 빌드에 포함하기 위해 `type="module"`로 로드
- README를 배포 준비 기준으로 갱신
- SEO, robots, sitemap 기본 도메인을 `https://snplus.ai.kr`로 변경
- title, description, keywords, canonical, Open Graph, Twitter Card 최종 보강
- 큰 PNG 사진을 웹용 JPEG로 추가 생성하고 운영 화면 참조를 최적화 이미지로 변경
- 카드 그림자, hover, 높이, 하단 여백, footer 노출 위치를 운영 화면 기준으로 정리
- 첫 화면 연락처 바의 태블릿 가로 넘침 수정
- 이미지 lazy loading 및 async decoding 적용
- 자동 슬라이드가 `prefers-reduced-motion` 설정을 존중하도록 변경
- 정적 사이트 lint 스크립트를 SEO, manifest, 404, 공개 PDF, 로컬 링크, lazy loading까지 검사하도록 강화

### Verified

- `npm install` 성공
- `npm run lint` 성공
- `npm run build` 성공
- 로컬 preview에서 콘솔 오류 0건 확인
- 데스크톱 1920x1080, 태블릿 1024x768, 모바일 390x844 반응형 확인
- 로컬 링크 64개 모두 확인
- 공개 PDF 3종, robots, sitemap, manifest, 404, OG 이미지 HTTP 200 확인

### Notes

- 현재 프로젝트는 Next.js/TypeScript/Tailwind가 아닌 정적 HTML/CSS/JS 구조입니다.
- 기존 디자인과 구조를 크게 바꾸지 않기 위해 Next.js 전환은 진행하지 않았습니다.
- Vercel과 DNS에서 `snplus.ai.kr` 연결 후 실제 접속 확인이 필요합니다.
- 카카오톡 채널은 실제 채널 URL이 확정되면 `https://pf.kakao.com/` placeholder를 교체해야 합니다.
