import { randomBytes, scryptSync } from "node:crypto";
import { stdin, stdout } from "node:process";

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

    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      resolve(value);
    };

    const onData = (character) => {
      if (character === "\r" || character === "\n") {
        finish();
        return;
      }
      if (character === "\u0003") {
        stdin.setRawMode(false);
        stdin.pause();
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

let password;
let confirmation;
try {
  password = await readSecret("관리자 비밀번호(10자 이상, 화면에 표시되지 않음): ");
  confirmation = await readSecret("비밀번호 다시 입력: ");
} catch {
  console.error("비밀번호 생성을 취소했습니다.");
  process.exit(1);
}

if (password.length < 10) {
  console.error("비밀번호는 10자 이상이어야 합니다.");
  process.exit(1);
}

if (password !== confirmation) {
  console.error("비밀번호가 일치하지 않습니다.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const digest = scryptSync(password, salt, 64).toString("hex");
console.log(`\nADMIN_PASSWORD_HASH=scrypt$${salt}$${digest}`);
console.log(`ADMIN_SESSION_SECRET=${randomBytes(48).toString("base64url")}`);
console.log("\n위 두 값을 Vercel 환경변수에 등록하고 터미널 화면을 닫으세요.");
