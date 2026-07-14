import { randomBytes, scryptSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { stdin, stdout } from "node:process";

const username = String(process.argv[2] ?? "").trim();

if (!username || username.length > 80) {
  console.error("사용법: npm run admin:configure -- 관리자아이디");
  process.exit(1);
}

if (!stdin.isTTY) {
  console.error("보안을 위해 대화형 터미널에서 실행해 주세요.");
  process.exit(1);
}

function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    let value = "";
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };

    const finish = () => {
      cleanup();
      stdout.write("\n");
      resolve(value);
    };

    const onData = (character) => {
      if (character === "\r" || character === "\n") {
        finish();
        return;
      }
      if (character === "\u0003") {
        cleanup();
        stdout.write("\n");
        reject(new Error("CANCELLED"));
        return;
      }
      if (character === "\u007f" || character === "\b") {
        if (value.length > 0) value = value.slice(0, -1);
        return;
      }
      if (character >= " ") value += character;
    };

    stdin.on("data", onData);
  });
}

function addProductionEnvironmentVariable(name, value) {
  const command = `npx.cmd --yes vercel env add ${name} production --yes --force`;
  const result = spawnSync("cmd.exe", ["/d", "/s", "/c", command], {
    cwd: process.cwd(),
    encoding: "utf8",
    input: `${value}\n`,
    stdio: ["pipe", "inherit", "inherit"],
    windowsHide: false
  });

  if (result.status !== 0) {
    throw new Error(`VERCEL_ENV_FAILED:${name}`);
  }
}

let password;
let confirmation;
try {
  password = await readSecret("관리자 비밀번호(12자 이상, 화면에 표시되지 않음): ");
  confirmation = await readSecret("비밀번호 다시 입력: ");
} catch {
  console.error("관리자 설정을 취소했습니다.");
  process.exit(1);
}

if (password.length < 12) {
  console.error("비밀번호는 12자 이상이어야 합니다.");
  process.exit(1);
}

if (password !== confirmation) {
  console.error("비밀번호가 일치하지 않습니다.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
const sessionSecret = randomBytes(48).toString("base64url");

password = "";
confirmation = "";

try {
  addProductionEnvironmentVariable("ADMIN_USERNAME", username);
  addProductionEnvironmentVariable("ADMIN_PASSWORD_HASH", passwordHash);
  addProductionEnvironmentVariable("ADMIN_SESSION_SECRET", sessionSecret);
  console.log("\n관리자 계정 보안값을 Vercel Production에 등록했습니다.");
  console.log("새 배포가 완료되면 https://snplus.ai.kr/admin 에서 로그인할 수 있습니다.");
} catch (error) {
  console.error("\nVercel 환경변수 등록에 실패했습니다.");
  console.error(String(error.message || error));
  process.exit(1);
}
