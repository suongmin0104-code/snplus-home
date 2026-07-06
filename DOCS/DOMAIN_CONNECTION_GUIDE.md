# 도메인 연결 가이드

도메인을 구매한 뒤 Vercel 프로젝트에 연결하는 절차입니다.

## 1. 도메인 구매처 예시

- 가비아
- 카페24
- 후이즈
- Cloudflare
- Namecheap

회사 명의 도메인은 회사 이메일 또는 회사가 장기적으로 관리할 수 있는 계정으로 구매하는 것을 권장합니다.

## 2. Vercel에서 도메인 추가

1. Vercel Dashboard에 로그인합니다.
2. 홈페이지 프로젝트를 선택합니다.
3. `Settings`로 이동합니다.
4. `Domains` 메뉴를 선택합니다.
5. `Add Domain`을 클릭합니다.
6. 구매한 도메인을 입력합니다.

## 3. 루트 도메인 연결 예시

연결할 도메인:

```text
snplus.ai.kr
```

DNS 설정:

```text
Type: A
Name: @
Value: 76.76.21.21
```

## 4. www 도메인 연결 예시

연결할 www 도메인:

```text
www.snplus.ai.kr
```

DNS 설정:

```text
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

## 5. SSL 자동 발급

Vercel은 DNS가 정상 반영되면 HTTPS SSL 인증서를 자동으로 발급합니다. 보통 몇 분 안에 완료되지만, DNS 반영 상태에 따라 더 오래 걸릴 수 있습니다.

## 6. 연결 후 확인 사항

- `https://도메인` 접속 확인
- `https://www.도메인` 접속 확인
- 루트 도메인과 www 도메인 중 대표 주소가 올바르게 연결되는지 확인
- 모바일 접속 확인
- 카카오톡 링크 미리보기 확인
- 네이버 검색 등록 준비
- Google Search Console 등록 준비
- Naver Search Advisor 등록 준비

## 7. 도메인 연결 후 코드에서 바꿀 값

현재 운영 도메인 기준값은 `https://snplus.ai.kr`입니다. 도메인 변경 또는 재설정 시 아래 파일을 함께 확인합니다.

- `index.html`
- `public/robots.txt`
- `public/sitemap.xml`
- 필요 시 `.env.example` 기준 환경변수

## 8. 주의사항

- DNS 반영은 시간이 걸릴 수 있습니다.
- 기존 홈페이지가 있는 도메인이라면 DNS 변경 전 백업이 필요합니다.
- 회사 명의 도메인은 회사 이메일로 관리하는 것을 권장합니다.
- 도메인을 임의로 구매하거나 연결하지 않습니다. 사용자가 구매한 도메인을 알려준 뒤 연결합니다.
