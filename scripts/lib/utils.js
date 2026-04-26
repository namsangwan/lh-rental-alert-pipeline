import { createHash, createPrivateKey, sign as cryptoSign } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function stripHtml(value) {
  return normalizeWhitespace(
    String(value ?? "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );
}

export function normalizeKoreanDate(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseNullableNumber(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }
  return Number.parseInt(digits, 10);
}

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJsonFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:]/g, "-");
}

export function topicSlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function asciiTopicSegment(value, fallbackPrefix = "topic") {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-_.~%]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (normalized) {
    return normalized;
  }

  return `${fallbackPrefix}-${sha256(String(value ?? "")).slice(0, 12)}`;
}

export function base64UrlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function signJwt(payload, privateKeyPem) {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const privateKey = createPrivateKey(privateKeyPem);
  const signature = cryptoSign("RSA-SHA256", Buffer.from(signingInput), privateKey);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}
