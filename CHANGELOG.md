# Changelog

## 2026-07-15 - 0.5.0

### Added

- 관리자 `문서 작성` 메뉴의 견적서·거래명세서 웹 편집기
- 품목 행 추가·삭제와 수량·단가 기반 공급가액, 부가세, 합계금액 자동 계산
- 합계금액 한글 표기와 A4 한 장 `PDF 저장 / 인쇄` 화면
- 문서 종류별 브라우저 로컬 임시저장과 원본 XLS 보조 다운로드

### Verified

- 견적서와 거래명세서 전환, 자동 임시저장, 품목 행 추가·삭제 확인
- 공급가액 275,000원, 부가세 27,500원, 합계 302,500원 계산 검증
- 데스크톱 가로 넘침 0px, 모바일 본문 가로 넘침 0px 확인
- A4 1페이지 PDF 출력과 브라우저 콘솔 오류 0건 확인

## 2026-07-14 - 0.4.1

### Added

- 관리자 `업무 서식` 메뉴와 견적 관리 화면의 견적서 빠른 다운로드
- 관리자 전용 견적서·거래명세서 원본 엑셀 양식
- 비밀번호 원문을 저장하지 않고 Vercel 환경변수를 등록하는 대화형 설정 명령

### Security

- 로그인 세션 확인 후 고정된 식별자로만 서식을 전송하는 다운로드 API
- 원본 엑셀 파일을 Public GitHub와 공개 정적 자산에서 분리하고 Vercel Private Blob에 보관
- 미인증 요청 거부, 임의 파일 경로 및 알 수 없는 서식 키 차단

## 2026-07-14 - 0.4.0

### Added

- `/admin` 로그인 전용 SN 업무포털
- 통합 현황, 견적 관리, 세무·회계, 거래처, 일정, 사내자료, 연동 설정 화면
- 관리자 로그인, 세션 확인, 로그아웃, 현황 API
- 견적 ERP와 세무 ERP의 HTTPS 바로가기 환경변수
- 관리자 비밀번호 해시 생성 명령과 운영 문서

### Security

- `HttpOnly`, `Secure`, `SameSite=Strict` 관리자 세션 쿠키
- 관리자 페이지 검색엔진 차단과 별도 보안 헤더
- 공개 홈페이지에서 관리자 링크 비노출
- 관리자 환경변수 미설정 시 포털 접근 차단

## 2026-07-10 - 0.3.0

### Added

- 홈 화면에 대표 비주얼, 핵심 역량, 품질 기준, 사업분야, 시공 사례, 진행 절차, 상담 CTA 구성 추가
- 회사소개 카드용 고해상도 생성 이미지 4종을 하나의 최적화 WebP 자산으로 추가
- 고객지원 카드용 고해상도 생성 이미지 4종을 하나의 최적화 WebP 자산으로 추가
- 회사소개, 사업분야, 조달·자료, 고객지원 메인에 빠른 상담·자료 요청 띠 추가
- 메인 메뉴와 인사말 상세에 제목과 설명을 포함한 실사 배너 추가

### Changed

- 회사소개, 사업분야, 조달·자료, 고객지원 화면을 한 화면에서 핵심 내용과 하단 상담 영역까지 확인할 수 있도록 재배치
- 네 개 메인 화면의 카드 이미지 비율, 카드 높이, 그림자, hover, 화살표 체계를 기업 홈페이지 스타일로 통일
- 모바일 상단을 로고·문의 버튼 1행, 네 개 메뉴 2행 구조로 정돈
- 푸터를 본사·공장, 지사, 전화·팩스, 이메일, 저작권 정보가 포함된 진한 네이비 구조로 고도화

### Verified

- 데스크톱 1440x900 홈, 회사소개, 사업분야, 조달·자료, 고객지원, 인사말 시각 검수
- 모바일 390x844 홈과 회사소개 시각 검수
- 내부 화면 20개 hash 이동, 잘못된 hash 홈 보정, 내부 뒤로가기 대상 확인
- 가로 넘침 0px, 브라우저 콘솔 오류 0건 확인
- `npm run lint`, `npm run build` 성공

## 2026-07-10

### Changed

- 상단 내비게이션을 중앙 정렬형 기업 홈페이지 구조로 고도화
- 메인 슬라이드의 대비, 타이포그래피, 전문분야 표지와 하단 연락처 밀도 개선
- 회사소개, 사업분야, 조달·자료, 고객지원 카드의 높이·색상선·그림자·hover·화살표 체계 통일
- 회사소개 및 문의 상세 화면의 본문 패널과 상담 패널을 프리미엄 B2B 스타일로 정리
- 연락처 페이지 전체 폭과 네이버 블로그 주소 줄바꿈 문제 수정
- 드롭다운 항목 높이를 줄여 상단 실사 배너 안에서 자연스럽게 펼쳐지도록 수정
- 푸터를 로고, 주소, 연락처, 저작권 정보가 구분되는 3열 구조로 개선
- 데스크톱 한 화면 높이에 주요 메뉴와 푸터가 맞도록 레이아웃 재조정
- 모바일 메뉴, 카드, 문의 폼, 상세 제목의 줄바꿈과 가로 넘침 재조정

### Verified

- 데스크톱 1440x900 주요 화면 시각 검수
- 모바일 390x844 메인, 회사소개, 견적센터 시각 검수
- 드롭다운이 회사소개 제목을 가리지 않는지 확인
- 가로 넘침 0px 확인

## 2026-07-06

### Added

- Vite 기반 배포 구성 추가
- `.gitignore` 추가
- `.env.example` 추가
- Vercel Serverless Function 기반 견적 문의 접수 API `/api/contact` 추가
- 견적센터 운영 필드, 개인정보 동의, honeypot 스팸 방지 추가
- `DOCS/CONTACT_SYSTEM.md` 작성
- `DOCS/CONTACT_SYSTEM_ROADMAP.md` 작성
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
- 견적센터 폼을 회사명, 담당자명, 연락처, 문의 유형, 제목, 문의내용 기반으로 확장
- 문의폼 제출 중/성공/실패 UX와 5초 재전송 방지 적용
- `.env.example`을 Vercel 문의 시스템 환경변수 기준으로 갱신

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
