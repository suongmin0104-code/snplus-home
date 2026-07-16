import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const indexPath = join(root, "index.html");
const html = readFileSync(indexPath, "utf8");
const script = readFileSync(join(root, "script.js"), "utf8");
const adminHtml = readFileSync(join(root, "admin.html"), "utf8");
const adminScript = readFileSync(join(root, "admin.js"), "utf8");
const adminWorklogScript = readFileSync(join(root, "admin-worklog.js"), "utf8");
const adminOperationsScript = readFileSync(join(root, "admin-operations.js"), "utf8");
const serviceWorker = readFileSync(join(root, "public", "sw.js"), "utf8");
const adminAuth = readFileSync(join(root, "lib", "admin-auth.js"), "utf8");
const adminTemplateApi = readFileSync(join(root, "api", "admin", "template.js"), "utf8");
const adminWorklogApi = readFileSync(join(root, "api", "admin", "worklog.js"), "utf8");
const adminWorklogPhotoApi = readFileSync(join(root, "api", "admin", "worklog-photo.js"), "utf8");
const adminOperationsApi = readFileSync(join(root, "api", "admin", "operations.js"), "utf8");
const adminInventoryPhotoApi = readFileSync(join(root, "api", "admin", "inventory-photo.js"), "utf8");
const envExample = readFileSync(join(root, ".env.example"), "utf8");
const robots = readFileSync(join(root, "public", "robots.txt"), "utf8");
const vercelConfig = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
const failures = [];

function requireMatch(pattern, message) {
  if (!pattern.test(html)) {
    failures.push(message);
  }
}

function requireFile(relativePath, message) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(message);
  }
}

function requireAdminMatch(pattern, message) {
  if (!pattern.test(adminHtml)) {
    failures.push(message);
  }
}

function normalizeLocalPath(value) {
  const clean = value.split("#")[0].split("?")[0];
  if (!clean || clean.startsWith("http") || clean.startsWith("mailto:") || clean.startsWith("tel:") || clean.startsWith("fax:")) {
    return null;
  }

  if (clean.startsWith("#")) {
    return null;
  }

  return clean.replace(/^\.\//, "").replace(/^\//, "");
}

requireMatch(/<html\s+lang="ko"/, "index.html의 lang 값이 ko인지 확인이 필요합니다.");
requireMatch(/<title>주식회사 에스앤 \| 도로·교통안전시설물 제조·시공<\/title>/, "운영용 title 확인이 필요합니다.");
requireMatch(/name="description"\s+content="[^"]{70,160}"/, "description 메타 설명은 70~160자 권장 범위로 작성되어야 합니다.");
requireMatch(/name="keywords"/, "keywords 메타 태그가 필요합니다.");
requireMatch(/rel="canonical"\s+href="https:\/\/snplus\.ai\.kr\/"/, "canonical URL이 snplus.ai.kr인지 확인이 필요합니다.");
requireMatch(/property="og:title"/, "Open Graph title 확인이 필요합니다.");
requireMatch(/property="og:description"/, "Open Graph description 확인이 필요합니다.");
requireMatch(/property="og:image"\s+content="https:\/\/snplus\.ai\.kr\/assets\/company\/sn-og-image\.jpg"/, "Open Graph 이미지 확인이 필요합니다.");
requireMatch(/name="twitter:card"\s+content="summary_large_image"/, "Twitter card 설정 확인이 필요합니다.");
requireMatch(/rel="manifest"\s+href="\/site\.webmanifest"/, "manifest 링크가 필요합니다.");
requireMatch(/name="robots"\s+content="index, follow"/, "robots 메타 태그 확인이 필요합니다.");
requireMatch(/031-852-2918/, "대표 전화번호 확인이 필요합니다.");
requireMatch(/031-852-2919/, "팩스번호 확인이 필요합니다.");
requireMatch(/https:\/\/blog\.naver\.com\/sn6221/, "네이버 블로그 HTTPS 주소 확인이 필요합니다.");
requireMatch(/data-contact-form/, "견적센터 문의폼이 필요합니다.");
requireMatch(/name="companyName"/, "견적 문의 회사명 필드가 필요합니다.");
requireMatch(/name="contactName"/, "견적 문의 담당자명 필드가 필요합니다.");
requireMatch(/name="privacyConsent"/, "개인정보 수집 및 이용 동의 필드가 필요합니다.");
requireMatch(/name="website"/, "스팸 방지 honeypot 필드가 필요합니다.");

for (const envKey of ["RESEND_API_KEY", "CONTACT_RECEIVER_EMAIL", "CONTACT_FROM_EMAIL", "VITE_SITE_URL"]) {
  if (!envExample.includes(`${envKey}=`)) {
    failures.push(`.env.example에 ${envKey} 항목이 필요합니다.`);
  }
}

for (const envKey of ["ADMIN_USERNAME", "ADMIN_PASSWORD_HASH", "ADMIN_SESSION_SECRET", "BLOB_READ_WRITE_TOKEN", "ESTIMATE_ERP_URL", "TAX_ERP_URL"]) {
  if (!envExample.includes(`${envKey}=`)) {
    failures.push(`.env.example is missing the admin key: ${envKey}`);
  }
}

const forbiddenNavigationApis = [
  "history.back(",
  "history.go(",
  "history.pushState(",
  "history.replaceState("
];

for (const api of forbiddenNavigationApis) {
  if (script.includes(api)) {
    failures.push(`브라우저 이전 기록에 의존하는 API를 사용하지 마세요: ${api}`);
  }
}

requireFile("assets/docs/sn-catalog.pdf", "제품 카탈로그 PDF가 필요합니다.");
requireFile("assets/docs/sn-company-profile-2026-cover.pdf", "공사 지명원 공개용 첫 페이지 PDF가 필요합니다.");
requireFile("assets/docs/sn-credit-report-cover.pdf", "신용평가보고서 공개용 첫 페이지 PDF가 필요합니다.");
requireFile("assets/company/sn-og-image.jpg", "Open Graph 대표 이미지가 필요합니다.");
requireFile("public/favicon.png", "favicon 파일이 필요합니다.");
requireFile("public/apple-touch-icon.png", "apple-touch-icon 파일이 필요합니다.");
requireFile("public/site.webmanifest", "site.webmanifest 파일이 필요합니다.");
requireFile("public/admin.webmanifest", "관리자 모바일앱 manifest가 필요합니다.");
requireFile("public/sw.js", "모바일앱 service worker가 필요합니다.");
requireFile("public/offline.html", "모바일앱 오프라인 안내 화면이 필요합니다.");
requireFile("public/404.html", "404 페이지가 필요합니다.");
requireFile("public/robots.txt", "public/robots.txt가 필요합니다.");
requireFile("public/sitemap.xml", "public/sitemap.xml이 필요합니다.");
requireFile("api/contact.js", "Vercel 문의 접수 API가 필요합니다.");
requireFile("DOCS/CONTACT_SYSTEM.md", "문의 시스템 운영 문서가 필요합니다.");
requireFile("DOCS/CONTACT_SYSTEM_ROADMAP.md", "문의 시스템 확장 로드맵 문서가 필요합니다.");
requireFile("DOCS/MOBILE_APP.md", "관리자 휴대폰 앱 운영 문서가 필요합니다.");

for (const api of forbiddenNavigationApis) {
  if (adminScript.includes(api)) {
    failures.push(`Admin navigation must not depend on browser history: ${api}`);
  }
  if (adminWorklogScript.includes(api)) {
    failures.push(`Admin worklog navigation must not depend on browser history: ${api}`);
  }
  if (adminOperationsScript.includes(api)) {
    failures.push(`Admin operations navigation must not depend on browser history: ${api}`);
  }
}

requireAdminMatch(/<html\s+lang="ko"/, "admin.html must declare Korean language.");
requireAdminMatch(/name="robots"\s+content="noindex, nofollow, noarchive"/, "Admin page must not be indexed.");
requireAdminMatch(/rel="manifest"\s+href="\/admin\.webmanifest(?:\?[^\"]*)?"/, "Admin mobile app manifest link is required.");
requireAdminMatch(/class="mobile-app-nav"/, "Admin mobile bottom navigation is required.");
requireAdminMatch(/data-login-form/, "Admin login form is required.");
requireAdminMatch(/data-module-view="estimate"/, "Estimate management module is required.");
requireAdminMatch(/data-module-view="production"/, "Production management module is required.");
requireAdminMatch(/data-module-view="inventory"/, "Inventory management module is required.");
requireAdminMatch(/data-module-view="tax"/, "Tax ERP module is required.");
requireAdminMatch(/data-module-view="templates"/, "Admin work-template module is required.");
requireAdminMatch(/data-module-view="tasks"/, "Admin field worklog module is required.");
requireAdminMatch(/data-worklog-calendar/, "Admin monthly worklog calendar is required.");
requireAdminMatch(/capture="environment"/, "Admin worklog must support the mobile rear camera.");
requireAdminMatch(/\/api\/admin\/template\?file=estimate/, "Estimate template download link is required.");
requireAdminMatch(/\/api\/admin\/template\?file=transaction/, "Transaction template download link is required.");

if (/href=["']\/admin\/?["']/.test(html)) {
  failures.push("The public homepage must not expose a direct admin link.");
}

for (const securityToken of ["HttpOnly", "Secure", "SameSite=Strict"]) {
  if (!adminAuth.includes(securityToken)) {
    failures.push(`Admin session cookie is missing ${securityToken}.`);
  }
}

if (!robots.includes("Disallow: /admin")) {
  failures.push("robots.txt must disallow the admin workspace.");
}

if (!serviceWorker.includes('url.pathname.startsWith("/api/")')) {
  failures.push("The service worker must bypass all authenticated admin API requests.");
}

const adminRewrite = vercelConfig.rewrites?.some(
  (rewrite) => rewrite.source === "/admin" && rewrite.destination === "/admin.html"
);
if (!adminRewrite) {
  failures.push("vercel.json must rewrite /admin to /admin.html.");
}

const adminCspAllowsLocalPhotoPreview = vercelConfig.headers?.some(
  (entry) => (entry.source === "/admin" || entry.source === "/admin.html") && entry.headers?.some(
    (header) => header.key === "Content-Security-Policy" && header.value.includes("img-src 'self' data: blob:")
  )
);
if (!adminCspAllowsLocalPhotoPreview) {
  failures.push("Admin CSP must allow local blob image previews for mobile camera uploads.");
}

if (!adminTemplateApi.includes("@vercel/blob") || !adminTemplateApi.includes('access: "private"')) {
  failures.push("Admin templates must be served from private Vercel Blob storage.");
}

if (!adminWorklogApi.includes("requireAdmin") || !adminWorklogPhotoApi.includes("requireAdmin")) {
  failures.push("Admin worklog APIs must require an authenticated admin session.");
}

if (!adminWorklogPhotoApi.includes("@vercel/blob") || !adminWorklogPhotoApi.includes('access: "private"')) {
  failures.push("Admin worklog photos must be stored in private Vercel Blob storage.");
}

if (!adminOperationsApi.includes("requireAdmin") || !adminInventoryPhotoApi.includes("requireAdmin")) {
  failures.push("Admin operations APIs must require an authenticated employee session.");
}

if (!adminOperationsScript.includes('type: "inventory-movement"') || !adminOperationsScript.includes("movementType:")) {
  failures.push("Inventory movement requests must keep the operation type separate from the in/out direction.");
}

if (!adminOperationsApi.includes('"inventory-movement": "inventory"')) {
  failures.push("Inventory movement requests must require inventory permission.");
}

if (!adminInventoryPhotoApi.includes("@vercel/blob") || !adminInventoryPhotoApi.includes('access: "private"')) {
  failures.push("Admin inventory photos must be stored in private Vercel Blob storage.");
}

for (const adminFile of [
  "admin.html",
  "admin.css",
  "admin-operations.css",
  "admin.js",
  "admin-operations.js",
  "admin-worklog.js",
  "lib/admin-auth.js",
  "lib/worklog-store.js",
  "lib/operations-store.js",
  "api/admin/login.js",
  "api/admin/session.js",
  "api/admin/logout.js",
  "api/admin/overview.js",
  "api/admin/template.js",
  "api/admin/worklog.js",
  "api/admin/worklog-photo.js",
  "api/admin/operations.js",
  "api/admin/inventory-photo.js",
  "scripts/configure-admin-vercel.mjs",
  "DOCS/ADMIN_WORKSPACE.md"
]) {
  requireFile(adminFile, `Admin workspace file is required: ${adminFile}`);
}

for (const privateTemplate of [
  "private/admin-templates/estimate-template.xls",
  "private/admin-templates/transaction-statement-template.xls"
]) {
  if (existsSync(join(root, privateTemplate)) && !readFileSync(join(root, ".gitignore"), "utf8").includes("private/admin-templates/")) {
    failures.push(`Private template must not be committed to the public repository: ${privateTemplate}`);
  }
}

const forbiddenDocs = [
  "assets/docs/sn-company-profile-2026.pdf",
  "assets/docs/sn-credit-report.pdf"
];

for (const doc of forbiddenDocs) {
  if (existsSync(join(root, doc))) {
    failures.push(`민감정보 포함 가능성이 있는 전체 PDF는 공개 assets/docs에 두지 마세요: ${doc}`);
  }
}

const forbiddenHeavyReferences = [
  "lane-delineator-hero.png",
  "bicycle-shelter-hero-sharp.png",
  "design-railing-hero-sharp.png",
  "bridge-railing-new-sharp.png",
  "traffic-bollard-sharp.png",
  "traffic-safety-rail-sharp.png"
];

for (const fileName of forbiddenHeavyReferences) {
  if (html.includes(fileName)) {
    failures.push(`운영 HTML에서 무거운 원본 이미지 대신 웹 최적화 파일을 사용하세요: ${fileName}`);
  }
}

const localReferencePattern = /\b(?:src|href)=["']([^"']+)["']/g;
for (const match of html.matchAll(localReferencePattern)) {
  const localPath = normalizeLocalPath(match[1]);
  if (!localPath) {
    continue;
  }

  if (localPath === "site.webmanifest" || localPath === "favicon.png" || localPath === "apple-touch-icon.png") {
    if (!existsSync(join(root, "public", localPath))) {
      failures.push(`public 파일을 찾을 수 없습니다: ${localPath}`);
    }
    continue;
  }

  const sourcePath = normalize(join(root, localPath));
  if (!existsSync(sourcePath) && !existsSync(join(root, "public", localPath))) {
    failures.push(`로컬 링크 파일을 찾을 수 없습니다: ${match[1]}`);
  }
}

const imageTags = html.match(/<img\b[^>]*>/g) ?? [];
for (const tag of imageTags) {
  const isBrand = /brand-mark/.test(tag) || /sn-logo-mark-small/.test(tag);
  const isPriority = /fetchpriority="high"/.test(tag);
  if (!isBrand && !isPriority && !/loading="lazy"/.test(tag)) {
    failures.push(`비핵심 이미지에 loading="lazy"가 필요합니다: ${tag.slice(0, 120)}...`);
  }
  if (!/decoding="async"/.test(tag)) {
    failures.push(`이미지에 decoding="async"가 필요합니다: ${tag.slice(0, 120)}...`);
  }
}

if (failures.length > 0) {
  console.error("Static site lint failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Static site lint passed.");
