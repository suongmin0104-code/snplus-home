import assert from "node:assert/strict";
import contactHandler, { setContactStoreForTests } from "../api/contact.js";

function createResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: "",
    headers,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    end(body = "") {
      this.body = String(body);
    }
  };
}

async function invokeContact(body) {
  const req = { method: "POST", body };
  const res = createResponse();
  await contactHandler(req, res);
  return {
    status: res.statusCode,
    headers: res.headers,
    json: JSON.parse(res.body || "{}")
  };
}

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL,
  CONTACT_RECEIVER_EMAIL: process.env.CONTACT_RECEIVER_EMAIL
};
const outboundRequests = [];
const storedEntries = [];
const notificationUpdates = [];
let storeAttempts = 0;
let storeMode = "success";
let resendMode = "success";

globalThis.fetch = async (url, options = {}) => {
  outboundRequests.push({ url: String(url), options });
  if (resendMode === "reject") {
    return {
      ok: false,
      status: 403,
      text: async () => '{"message":"sender domain is not verified"}'
    };
  }
  return {
    ok: true,
    status: 200,
    text: async () => ""
  };
};

setContactStoreForTests({
  async save(inquiry, notification) {
    storeAttempts += 1;
    if (storeMode === "fail") throw new Error("CONTACT_STORAGE_FAILED");
    const stored = {
      ...inquiry,
      status: "new",
      notification,
      storedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    storedEntries.push(stored);
    return stored;
  },
  async updateNotification(entry, notification) {
    if (storeMode === "fail-update") throw new Error("CONTACT_STORAGE_FAILED");
    const updated = { ...entry, notification, updatedAt: new Date().toISOString() };
    notificationUpdates.push({ leadId: entry.leadId, notification });
    return updated;
  }
});

process.env.RESEND_API_KEY = "re_test_snplus";
process.env.CONTACT_FROM_EMAIL = "SNPLUS Test <test@snplus.ai.kr>";
process.env.CONTACT_RECEIVER_EMAIL = "receiver@example.com";

try {
  const validPhotoInquiry = await invokeContact({
    companyName: "에스앤 테스트 현장",
    contactName: "테스트 담당자",
    phone: "010-1234-5678",
    email: "customer@example.com",
    inquiryType: "볼라드 제작·교체·시공",
    subject: "화성시 볼라드 교체 견적 요청",
    message: "요청 구분: 파손·노후 교체\n설치 지역: 경기도 화성시\n예상 수량: 3개",
    requestKind: "파손·노후 교체",
    region: "경기도 화성시",
    quantity: "3개",
    siteType: "공장·물류시설",
    productPreference: "고정형",
    contactPreference: "전화",
    privacyConsent: true,
    website: "",
    photos: [
      {
        name: "site-photo.jpg",
        contentType: "image/jpeg",
        content: "/9j/2Q=="
      }
    ],
    pageUrl: "https://snplus.ai.kr/bollard?utm_source=naver&utm_term=%EB%B3%BC%EB%9D%BC%EB%93%9C%20%EA%B5%90%EC%B2%B4",
    siteUrl: "https://snplus.ai.kr",
    userAgent: "SNPLUS contact test",
    utmSource: "naver",
    utmMedium: "cpc",
    utmCampaign: "bollard-lead-test",
    utmTerm: "볼라드 교체",
    utmContent: "search-a",
    referrer: "https://search.naver.com/",
    landingPage: "https://snplus.ai.kr/bollard",
    firstSeenAt: "2026-08-09T14:00:00.000Z"
  });

  assert.equal(validPhotoInquiry.status, 200);
  assert.equal(validPhotoInquiry.json.ok, true);
  assert.equal(validPhotoInquiry.json.stored, true);
  assert.equal(validPhotoInquiry.json.notified, true);
  assert.match(validPhotoInquiry.json.leadId, /^SN-\d{8}-[A-F0-9]{8}$/);
  assert.equal(outboundRequests.length, 1);
  assert.equal(storedEntries.length, 1);
  assert.equal(notificationUpdates.at(-1).notification.status, "sent");

  const firstRequest = outboundRequests[0];
  assert.equal(firstRequest.url, "https://api.resend.com/emails");
  const firstMail = JSON.parse(firstRequest.options.body);
  assert.equal(firstMail.to[0], "receiver@example.com");
  assert.equal(firstMail.reply_to, "customer@example.com");
  assert.equal(firstMail.attachments.length, 1);
  assert.equal(firstMail.attachments[0].filename, "site-photo.jpg");
  assert.equal(firstMail.attachments[0].content, "/9j/2Q==");
  assert.match(firstMail.text, /볼라드 교체/);
  assert.match(firstMail.text, /source=naver/);
  assert.equal(firstRequest.options.headers["Idempotency-Key"], validPhotoInquiry.json.leadId);

  const legacyHomepageInquiry = await invokeContact({
    companyName: "기존 홈페이지 문의 회사",
    contactName: "기존 담당자",
    phone: "031-852-2918",
    email: "",
    inquiryType: "제품 및 시공 견적",
    subject: "기존 폼 호환 테스트",
    message: "디자인형 울타리 견적을 요청합니다.",
    privacyConsent: true,
    website: "",
    pageUrl: "https://snplus.ai.kr/#estimate",
    siteUrl: "https://snplus.ai.kr",
    userAgent: "SNPLUS legacy form test"
  });

  assert.equal(legacyHomepageInquiry.status, 200);
  assert.equal(legacyHomepageInquiry.json.ok, true);
  assert.equal(legacyHomepageInquiry.json.stored, true);
  assert.equal(legacyHomepageInquiry.json.notified, true);
  assert.equal(outboundRequests.length, 2);
  assert.equal(storedEntries.length, 2);
  const secondMail = JSON.parse(outboundRequests[1].options.body);
  assert.equal(secondMail.attachments, undefined);
  assert.match(secondMail.text, /디자인형 울타리/);

  const invalidPhotoInquiry = await invokeContact({
    companyName: "잘못된 사진 테스트",
    contactName: "테스트 담당자",
    phone: "010-1234-5678",
    message: "잘못된 사진 파일은 거부되어야 합니다.",
    privacyConsent: true,
    photos: [
      {
        name: "fake.jpg",
        contentType: "image/jpeg",
        content: "SGVsbG8="
      }
    ]
  });

  assert.equal(invalidPhotoInquiry.status, 400);
  assert.equal(invalidPhotoInquiry.json.ok, false);
  assert.equal(outboundRequests.length, 2);
  assert.equal(storeAttempts, 2);

  delete process.env.RESEND_API_KEY;
  delete process.env.CONTACT_FROM_EMAIL;
  const storedWithoutMail = await invokeContact({
    companyName: "메일 설정 누락 테스트",
    contactName: "테스트 담당자",
    phone: "010-1234-5678",
    message: "메일 환경변수가 없어도 문의는 저장되어야 합니다.",
    privacyConsent: true
  });

  assert.equal(storedWithoutMail.status, 200);
  assert.equal(storedWithoutMail.json.ok, true);
  assert.equal(storedWithoutMail.json.stored, true);
  assert.equal(storedWithoutMail.json.notified, false);
  assert.equal(outboundRequests.length, 2);
  assert.equal(storedEntries.length, 3);
  assert.equal(notificationUpdates.at(-1).notification.status, "not_configured");
  assert.equal(notificationUpdates.at(-1).notification.errorCode, "MAIL_CONFIGURATION_MISSING");

  process.env.RESEND_API_KEY = "re_test_snplus";
  process.env.CONTACT_FROM_EMAIL = "SNPLUS Test <test@snplus.ai.kr>";
  resendMode = "reject";
  const storedAfterProviderRejection = await invokeContact({
    companyName: "메일 공급자 거부 테스트",
    contactName: "테스트 담당자",
    phone: "010-1234-5678",
    message: "Resend가 거부해도 문의는 저장되어야 합니다.",
    privacyConsent: true
  });

  assert.equal(storedAfterProviderRejection.status, 200);
  assert.equal(storedAfterProviderRejection.json.ok, true);
  assert.equal(storedAfterProviderRejection.json.stored, true);
  assert.equal(storedAfterProviderRejection.json.notified, false);
  assert.equal(outboundRequests.length, 3);
  assert.equal(storedEntries.length, 4);
  assert.equal(notificationUpdates.at(-1).notification.status, "failed");
  assert.equal(notificationUpdates.at(-1).notification.errorCode, "MAIL_PROVIDER_REJECTED");

  storeMode = "fail";
  resendMode = "success";
  const mailOnlySuccess = await invokeContact({
    companyName: "저장소 장애 메일 성공 테스트",
    contactName: "테스트 담당자",
    phone: "010-1234-5678",
    message: "저장소가 실패해도 메일이 성공하면 접수를 성공 처리합니다.",
    privacyConsent: true
  });

  assert.equal(mailOnlySuccess.status, 200);
  assert.equal(mailOnlySuccess.json.ok, true);
  assert.equal(mailOnlySuccess.json.stored, false);
  assert.equal(mailOnlySuccess.json.notified, true);
  assert.equal(outboundRequests.length, 4);

  delete process.env.RESEND_API_KEY;
  delete process.env.CONTACT_FROM_EMAIL;
  const totalDeliveryFailure = await invokeContact({
    companyName: "저장소·메일 동시 장애 테스트",
    contactName: "테스트 담당자",
    phone: "010-1234-5678",
    message: "저장소와 메일이 모두 실패하면 성공으로 표시하면 안 됩니다.",
    privacyConsent: true
  });

  assert.equal(totalDeliveryFailure.status, 503);
  assert.equal(totalDeliveryFailure.json.ok, false);
  assert.equal(totalDeliveryFailure.json.errorCode, "CONTACT_DELIVERY_UNAVAILABLE");
  assert.equal(totalDeliveryFailure.json.message.includes("re_test_snplus"), false);
  assert.equal(outboundRequests.length, 4);

  console.log("contact lead tests passed");
} finally {
  setContactStoreForTests(null);
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
