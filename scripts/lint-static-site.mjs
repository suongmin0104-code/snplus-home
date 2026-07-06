import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

requireMatch(/<html\s+lang="ko"/, "index.html lang 속성이 ko인지 확인 필요");
requireMatch(/<title>주식회사 에스앤 \|/, "title 기본값 확인 필요");
requireMatch(/name="description"/, "description 메타 태그 확인 필요");
requireMatch(/property="og:title"/, "Open Graph title 확인 필요");
requireMatch(/property="og:description"/, "Open Graph description 확인 필요");
requireMatch(/name="robots"/, "robots 메타 태그 확인 필요");
requireMatch(/031-852-2918/, "대표 전화번호 확인 필요");
requireMatch(/031-852-2919/, "팩스번호 확인 필요");
requireMatch(/blog\.naver\.com\/sn6221/, "네이버 블로그 주소 확인 필요");

requireFile("assets/docs/sn-catalog.pdf", "카탈로그 PDF가 필요합니다.");
requireFile("assets/docs/sn-company-profile-2026-cover.pdf", "공사 지명원 공개용 첫 페이지 PDF가 필요합니다.");
requireFile("assets/docs/sn-credit-report-cover.pdf", "신용평가보고서 공개용 첫 페이지 PDF가 필요합니다.");
requireFile("public/robots.txt", "public/robots.txt가 필요합니다.");
requireFile("public/sitemap.xml", "public/sitemap.xml이 필요합니다.");

const forbiddenDocs = [
  "assets/docs/sn-company-profile-2026.pdf",
  "assets/docs/sn-credit-report.pdf"
];

for (const doc of forbiddenDocs) {
  if (existsSync(join(root, doc))) {
    failures.push(`민감정보 포함 가능성이 있는 전체 PDF를 공개 assets/docs에 두지 마세요: ${doc}`);
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

