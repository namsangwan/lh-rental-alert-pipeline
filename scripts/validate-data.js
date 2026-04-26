import { NOTICE_CATEGORIES, PATHS, getCategoryPaths } from "./lib/constants.js";
import { readJsonFile } from "./lib/utils.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const payloads = await readJsonFile(PATHS.fcmPayloadsData);
  const categoriesIndex = await readJsonFile(PATHS.categoriesIndex);

  assert(payloads, "Missing data/fcm-payloads.json");
  assert(categoriesIndex, "Missing public/categories.json");
  assert(Array.isArray(categoriesIndex.categories), "categories.json must contain categories[]");
  assert(Array.isArray(payloads.messages), "fcm-payloads.messages must be an array");

  let totalNewNoticeCount = 0;

  for (const category of NOTICE_CATEGORIES) {
    const paths = getCategoryPaths(category.key);
    const notices = await readJsonFile(paths.publicNotices);
    const metadata = await readJsonFile(paths.publicMetadata);

    assert(notices, `Missing ${paths.publicNotices}`);
    assert(metadata, `Missing ${paths.publicMetadata}`);
    assert(Array.isArray(notices.items), `${paths.publicNotices} must contain items[]`);
    assert(typeof metadata.noticeCount === "number", `${paths.publicMetadata} noticeCount must be a number`);
    assert(metadata.noticeCount > 0, `${paths.publicMetadata} noticeCount must be greater than 0`);
    assert(
      metadata.noticeCount === notices.items.length,
      `${paths.publicMetadata} noticeCount must match notices.items.length`
    );

    totalNewNoticeCount += metadata.newNoticeCount ?? 0;

    for (const notice of notices.items) {
      assert(Boolean(notice.id), "Each notice must have id");
      assert(Boolean(notice.sourceNoticeKey), "Each notice must have sourceNoticeKey");
      assert(Boolean(notice.title), "Each notice must have title");
      assert(Boolean(notice.detailUrl), "Each notice must have detailUrl");
      assert(notice.category === category.key, `Each notice must have category=${category.key}`);
    }
  }

  assert(
    totalNewNoticeCount === payloads.newNoticeCount,
    "Sum of category newNoticeCount must match fcm-payloads.newNoticeCount"
  );

  console.log("Data validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
