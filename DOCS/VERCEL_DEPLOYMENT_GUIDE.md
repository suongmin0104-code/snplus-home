# Vercel 배포 가이드

## 1. GitHub 저장소 생성

1. GitHub에 로그인합니다.
2. 새 저장소를 생성합니다.
3. 저장소 이름 예시: `sn-home`
4. Public 또는 Private 중 원하는 방식을 선택합니다.
5. README, .gitignore는 GitHub에서 새로 생성하지 않습니다. 현재 프로젝트에 이미 파일이 있습니다.

## 2. Git Push

원격 저장소 주소를 받은 뒤 아래 명령을 실행합니다.

```bash
git remote add origin https://github.com/USER_NAME/REPOSITORY_NAME.git
git branch -M main
git push -u origin main
```

이미 origin이 있다면 아래로 확인합니다.

```bash
git remote -v
```

## 3. Vercel 프로젝트 Import

1. Vercel Dashboard에 로그인합니다.
2. `Add New...` 또는 `New Project`를 선택합니다.
3. GitHub 저장소를 연결합니다.
4. SN 홈페이지 저장소를 Import합니다.

## 4. Build 설정

현재 프로젝트는 Next.js가 아니라 정적 HTML/CSS/JS + Vite 구조입니다.

- Framework Preset: `Vite` 또는 `Other`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

## 5. Environment Variables

현재 빌드는 환경변수 없이도 동작합니다. 다만 도메인 연결 후 아래 값들을 관리할 수 있습니다.

```text
NEXT_PUBLIC_SITE_URL=https://snplus.ai.kr
NEXT_PUBLIC_SITE_NAME=주식회사 에스앤
NEXT_PUBLIC_NAVER_BLOG_URL=http://blog.naver.com/sn6221
NEXT_PUBLIC_KAKAO_CHANNEL_URL=실제 카카오톡 채널 주소
```

주의: `.env`, `.env.local`에는 실제 비밀값을 넣을 수 있으므로 Git에 커밋하지 않습니다.

## 6. 배포 후 확인 항목

- Vercel 제공 URL 접속 확인
- 첫 화면 이미지 표시 확인
- 회사소개 메뉴 확인
- 사업분야 메뉴 확인
- 조달·자료 PDF 링크 확인
- 고객지원/문의하기 링크 확인
- 전화번호 `031-852-2918` 확인
- 팩스번호 `031-852-2919` 확인
- 모바일 화면 확인
- `robots.txt` 접속 확인
- `sitemap.xml` 접속 확인

## 7. 도메인 연결 전 체크리스트

- GitHub push 완료
- Vercel 배포 성공
- Vercel URL에서 화면 확인
- 공개 PDF가 첫 페이지만 노출되는지 확인
- 실제 도메인명 확인: `snplus.ai.kr`
- 회사 명의 관리 이메일 확인

## 8. 도메인 연결 후 체크리스트

- 루트 도메인 접속 확인
- `www` 도메인 접속 확인
- HTTPS 인증서 발급 확인
- 카카오톡 링크 미리보기 확인
- 네이버 검색 등록 준비
- Google Search Console 등록 준비
- Naver Search Advisor 등록 준비
