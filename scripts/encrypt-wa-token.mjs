#!/usr/bin/env node
/**
 * Encrypt a WhatsApp Cloud API access token for restaurant_whatsapp_accounts.access_token_encrypted.
 *
 * Usage (PowerShell):
 *   $env:ENCRYPTION_KEY="..."   # or rely on .env.local
 *   npm run wa:encrypt-token -- "EAAxxxx..."
 *
 * Or pipe:
 *   echo EAAxxxx | npm run wa:encrypt-token
 *
 * Optional: npm run wa:encrypt-token -- --verify "EAAxxxx"
 *   prints ciphertext then confirms decrypt round-trip (does not print the token).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function keyFromEnv() {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Add it to .env.local or export it in the shell.",
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (hex64 or base64)");
  }
  return buf;
}

function encryptSecret(plaintext, key) {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptSecret(payload, key) {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

function readStdin() {
  return new Promise((resolvePromise) => {
    if (process.stdin.isTTY) {
      resolvePromise("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolvePromise(data.trim()));
  });
}

async function main() {
  loadEnvLocal();

  const args = process.argv.slice(2).filter((a) => a !== "--");
  const verify = args.includes("--verify");
  const positional = args.filter((a) => a !== "--verify");
  let token = positional[0]?.trim() || "";

  if (!token) {
    token = (await readStdin()).trim();
  }

  if (!token) {
    console.error(`Missing access token.

Usage:
  npm run wa:encrypt-token -- "EAA..."
  npm run wa:encrypt-token -- --verify "EAA..."

ENCRYPTION_KEY is read from the environment or .env.local.`);
    process.exit(1);
  }

  const key = keyFromEnv();
  const cipherText = encryptSecret(token, key);
  console.log(cipherText);

  if (verify) {
    const back = decryptSecret(cipherText, key);
    if (back !== token) {
      console.error("\nVerify FAILED: decrypt did not match input.");
      process.exit(1);
    }
    console.error("\nVerify OK (decrypt matches; token not printed).");
  } else {
    console.error(
      "\nPaste the line above into access_token_encrypted in Supabase SQL.",
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
