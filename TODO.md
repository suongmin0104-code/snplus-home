# TODO

## 관리자 업무포털

- [x] `/admin` 별도 관리자 진입점
- [x] 관리자 비밀번호 해시 및 서명 세션
- [x] 통합 현황과 견적·세무 ERP 연결 상태 화면
- [x] 공개 홈페이지 관리자 링크 비노출
- [x] 관리자 아이디 `01071006221` Vercel Production 등록
- [x] 견적서·거래명세서 원본 양식 관리자 전용 등록
- [x] 견적서·거래명세서 웹 바로 작성 및 PDF 출력
- [x] 품목별 금액·부가세·합계 자동 계산과 브라우저 임시저장
- [x] 월간 일정·현장 업무일지와 상태별 관리
- [x] 휴대폰 카메라 촬영·사진 자동 압축·비공개 업로드
- [x] PC·휴대폰 공용 일정 저장소와 휴대폰 캘린더 파일 추가
- [ ] Google Calendar 또는 Microsoft 365 양방향 자동 동기화 검토
- [ ] 실제 사용 중인 견적 ERP 서비스 확정
- [ ] 실제 사용 중인 세무·회계 ERP 서비스 확정
- [ ] ERP API 제공 범위와 계정 권한 확인
- [ ] 실제 데이터 연동 전 MFA, 역할별 권한, 감사 로그 설계

## 배포 전 남은 작업

- [x] 기업형 쇼케이스 홈 전면 개편
- [x] 회사소개·고객지원 전용 생성 이미지 적용
- [x] 회사소개·사업분야·조달자료·고객지원 빠른 상담 띠 적용
- [x] 데스크톱 1440x900 및 모바일 390x844 반응형 재검증
- [x] 내부 화면 20개 hash 이동과 잘못된 hash 보정 확인
- [x] 2026-07-10 프리미엄 디자인 고도화
- [x] 상단 드롭다운과 본문 제목 겹침 재점검
- [x] 주요 메뉴 한 화면 밀도와 푸터 배치 재점검

- [x] GitHub 원격 저장소 URL 생성 및 연결
- [x] GitHub push
- [x] Vercel 배포 준비
- [x] Vercel 실제 배포 URL 접속 확인
- [ ] 모바일 실기기 화면 확인
- [x] 모든 이미지 표시 로컬 preview 확인
- [x] 메뉴 링크 로컬 검사
- [ ] 카카오톡 채널 URL 확인
- [x] 대표 OG 이미지 최종 확정
- [x] 견적센터 문의폼 운영 필드 구성
- [x] `/api/contact` 메일 접수 API 추가
- [ ] Resend API Key 발급 및 Vercel 환경변수 등록
- [ ] Resend 발신 주소 또는 발신 도메인 인증
- [ ] 운영 도메인에서 실제 문의 메일 수신 테스트

## 도메인 구매 후 작업

- [x] 실제 도메인 구매: `snplus.ai.kr`
- [x] Vercel Domains에 도메인 추가
- [ ] DNS A Record 설정
- [ ] DNS CNAME 설정
- [x] `index.html`의 사이트 URL을 `https://snplus.ai.kr`로 변경
- [x] `public/robots.txt`의 Sitemap URL을 `https://snplus.ai.kr`로 변경
- [x] `public/sitemap.xml`의 URL을 `https://snplus.ai.kr`로 변경
- [x] 배포용 Build 생성
- [x] Vercel 재배포
- [x] HTTPS 접속 확인
- [ ] www 접속 확인
- [x] 루트 도메인 접속 확인

## 검색 등록

- [ ] Google Search Console 등록
- [ ] Naver Search Advisor 등록
- [ ] 사이트맵 제출
- [ ] 카카오톡 링크 미리보기 확인

## 선택 작업

- [ ] 필요 시 Next.js/TypeScript/Tailwind 구조로 별도 전환 검토
- [x] 404 페이지 추가
- [x] 이미지 용량 최적화
- [ ] 문의 접수 DB 저장과 관리자 페이지 2차 개발
