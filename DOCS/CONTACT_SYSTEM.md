# 견적센터 문의 접수 시스템

## 현재 구조

주식회사 에스앤 홈페이지의 `견적센터` 폼은 Vercel Serverless Function을 통해 회사 메일로 문의 내용을 발송합니다.

- 프론트엔드: `index.html`, `script.js`, `styles.css`
- API 엔드포인트: `/api/contact`
- 메일 발송: Resend API
- 수신 메일: `sn6221@naver.com`
- 운영 도메인: `https://snplus.ai.kr`

## 문의 흐름

1. 사용자가 `#estimate` 견적센터에서 회사명, 담당자명, 연락처, 문의 내용을 입력합니다.
2. 개인정보 수집 및 이용 동의 체크 후 `문의 접수하기` 버튼을 누릅니다.
3. 브라우저가 `/api/contact`로 JSON POST 요청을 보냅니다.
4. API가 서버에서 필수값, 연락처, 이메일, 개인정보 동의, honeypot 값을 검증합니다.
5. 정상 문의이면 Resend API로 `sn6221@naver.com`에 메일을 발송합니다.
6. 성공 시 화면에 접수 완료 메시지를 보여줍니다.

## 환경변수

Vercel Project Settings의 Environment Variables에 아래 값을 등록합니다.

```text
RESEND_API_KEY=
CONTACT_RECEIVER_EMAIL=sn6221@naver.com
CONTACT_FROM_EMAIL=
VITE_SITE_URL=https://snplus.ai.kr
```

`CONTACT_FROM_EMAIL`은 Resend에서 인증된 발신 주소를 사용합니다. 예시는 아래와 같습니다.

```text
SNPLUS 홈페이지 <noreply@snplus.ai.kr>
```

실제 API Key는 `.env`, `.env.local`, `.env.production.local`에 넣을 수 있지만 이 파일들은 Git에 커밋하지 않습니다.

## 입력 항목

필수:

- 회사명
- 담당자명
- 연락처
- 문의내용
- 개인정보 수집 및 이용 동의

선택:

- 이메일
- 문의 제목
- 문의 유형

자동 포함:

- 접수 시간
- 접수 페이지 URL
- 사이트 도메인
- User Agent

## 스팸 방지

폼에는 일반 사용자에게 보이지 않는 `website` honeypot 필드가 있습니다.

봇이 이 필드에 값을 넣으면 API는 정상 접수처럼 `200`을 반환하지만 실제 메일은 보내지 않습니다.

## 테스트 방법

프론트엔드:

1. 빈 값 제출 시 안내 문구가 뜨는지 확인합니다.
2. 개인정보 동의 없이 제출하면 차단되는지 확인합니다.
3. 잘못된 연락처 또는 이메일 입력 시 안내되는지 확인합니다.
4. 정상 입력 후 제출 중 버튼이 비활성화되는지 확인합니다.
5. 성공 또는 실패 메시지가 모바일에서도 깨지지 않는지 확인합니다.

API:

```bash
npm run lint
npm run build
```

배포 후 운영 도메인에서 실제 메일 발송을 확인합니다.

## 장애 시 대응

문의 접수 실패 메시지가 표시되면 아래를 먼저 확인합니다.

1. Vercel 환경변수 `RESEND_API_KEY` 등록 여부
2. Vercel 환경변수 `CONTACT_FROM_EMAIL` 등록 여부
3. Resend 발신 도메인 또는 발신 주소 인증 여부
4. Resend 전송 제한 또는 오류 로그
5. Vercel Functions 로그의 `/api/contact` 오류

사용자에게는 아래 연락처로 우회 안내합니다.

- 전화: `031-852-2918`
- 이메일: `sn6221@naver.com`

## 운영 주의사항

- Resend API Key를 코드에 직접 넣지 않습니다.
- `.env` 파일은 커밋하지 않습니다.
- 공사 지명원과 신용평가보고서 원본 등 민감자료는 공개 폴더에 올리지 않습니다.
- 카카오톡 채널 URL이 확정되면 관련 버튼 링크를 실제 채널 주소로 교체합니다.
