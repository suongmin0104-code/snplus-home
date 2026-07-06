import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const indexPath = join(root, "index.html");
const html = readFileSync(indexPath, "utf8");
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

requireFile("assets/docs/sn-catalog.pdf", "제품 카탈로그 PDF가 필요합니다.");
requireFile("assets/docs/sn-company-profile-2026-cover.pdf", "공사 지명원 공개용 첫 페이지 PDF가 필요합니다.");
requireFile("assets/docs/sn-credit-report-cover.pdf", "신용평가보고서 공개용 첫 페이지 PDF가 필요합니다.");
requireFile("assets/company/sn-og-image.jpg", "Open Graph 대표 이미지가 필요합니다.");
requireFile("public/favicon.png", "favicon 파일이 필요합니다.");
requireFile("public/apple-touch-icon.png", "apple-touch-icon 파일이 필요합니다.");
requireFile("public/site.webmanifest", "site.webmanifest 파일이 필요합니다.");
requireFile("public/404.html", "404 페이지가 필요합니다.");
requireFile("public/robots.txt", "public/robots.txt가 필요합니다.");
requireFile("public/sitemap.xml", "public/sitemap.xml이 필요합니다.");

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
