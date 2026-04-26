import { PATHS } from "./lib/constants.js";
import { readJsonFile } from "./lib/utils.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const notices = await readJsonFile(PATHS.publicNotices);
  const metadata = await readJsonFile(PATHS.publicMetadata);
  const payloads = await readJsonFile(PATHS.fcmPayloadsData);

  assert(notices, "Missing public/notices.json");
  assert(metadata, "Missing public/metadata.json");
  assert(payloads, "Missing data/fcm-payloads.json");

  assert(Array.isArray(notices.items), "public/notices.json must contain items[]");
  assert(typeof metadata.noticeCount === "number", "metadata.noticeCount must be a number");
  assert(metadata.noticeCount > 0, "metadata.noticeCount must be greater than 0");
  assert(
    metadata.noticeCount === notices.items.length,
    "metadata.noticeCount must match notices.items.length"
  );
  assert(
    metadata.newNoticeCount === payloads.newNoticeCount,
    "metadata.newNoticeCount must match fcm-payloads.newNoticeCount"
  );
  assert(Array.isArray(payloads.messages), "fcm-payloads.messages must be an array");

  for (const notice of notices.items) {
    assert(Boolean(notice.id), "Each notice must have id");
    assert(Boolean(notice.sourceNoticeKey), "Each notice must have sourceNoticeKey");
    assert(Boolean(notice.title), "Each notice must have title");
    assert(Boolean(notice.detailUrl), "Each notice must have detailUrl");
  }

  console.log("Data validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
