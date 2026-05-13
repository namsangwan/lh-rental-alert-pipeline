import { NOTICE_CATEGORIES, PATHS, getCategoryPaths } from "./lib/constants.js";
import { readJsonFile, writeJson } from "./lib/utils.js";

function summarizeBody(title) {
  return `${title} 공고를 확인해보세요.`;
}

function buildFcmPayloads(generatedAt, newItems) {
  return {
    generatedAt,
    newNoticeCount: newItems.length,
    messages: newItems.map((notice) => {
      const title = `[LH 신규공고] ${notice.categoryLabel} ${notice.region} 공고가 등록되었어요`;
      const body = summarizeBody(notice.title);

      return {
        topic: "all-notices",
        title,
        body,
        data: {
          eventType: "NEW_NOTICE",
          noticeId: notice.id,
          sourceNoticeKey: notice.sourceNoticeKey,
          category: notice.category,
          categoryLabel: notice.categoryLabel,
          noticeType: notice.noticeType,
          noticeSubtype: notice.noticeSubtype ?? "",
          region: notice.region,
          status: notice.status,
          postedAt: notice.postedAt ?? "",
          deadlineAt: notice.deadlineAt ?? "",
          detailUrl: notice.detailUrl,
          generatedAt,
          notificationTitle: title,
          notificationBody: body
        }
      };
    })
  };
}

async function main() {
  const allNewItems = [];
  const categories = [];
  let generatedAt = new Date().toISOString();

  for (const category of NOTICE_CATEGORIES) {
    const paths = getCategoryPaths(category.key);
    const latest = await readJsonFile(paths.latestData);
    if (!latest) {
      throw new Error(`Missing ${paths.latestData}. Run npm run crawl first.`);
    }

    generatedAt = latest.generatedAt;
    const previousPublic = await readJsonFile(paths.publicNotices);
    const isBootstrapRun = !previousPublic;
    const previousMap = new Map(
      (previousPublic?.items ?? []).map((item) => [item.sourceNoticeKey, item])
    );

    const newItems = [];
    const updatedItems = [];

    const publicItems = latest.items.map((item) => {
      const previous = previousMap.get(item.sourceNoticeKey);
      const isNew = !isBootstrapRun && !previous;
      const isUpdated = Boolean(previous && previous.contentHash !== item.contentHash);

      if (isNew) {
        newItems.push(item);
      } else if (isUpdated) {
        updatedItems.push(item);
      }

      return {
        ...item,
        isNew,
        lastChangedAt:
          isNew || isUpdated ? latest.generatedAt : previous?.lastChangedAt ?? latest.generatedAt
      };
    });

    const noticesOutput = {
      generatedAt: latest.generatedAt,
      category: category.key,
      categoryLabel: category.label,
      count: publicItems.length,
      items: publicItems
    };

    const metadataOutput = {
      generatedAt: latest.generatedAt,
      category: category.key,
      categoryLabel: category.label,
      noticeCount: publicItems.length,
      newNoticeCount: newItems.length,
      updatedNoticeCount: updatedItems.length,
      sourceUrl: latest.sourceUrl,
      version: latest.generatedAt
    };

    const changesOutput = {
      generatedAt: latest.generatedAt,
      category: category.key,
      categoryLabel: category.label,
      newItems,
      updatedItems
    };

    await writeJson(paths.publicNotices, noticesOutput);
    await writeJson(paths.publicMetadata, metadataOutput);
    await writeJson(paths.changesData, changesOutput);

    if (category.key === "rental") {
      await writeJson(PATHS.publicNotices, noticesOutput);
      await writeJson(PATHS.publicMetadata, metadataOutput);
      await writeJson(PATHS.changesData, changesOutput);
    }

    categories.push({
      key: category.key,
      label: category.label,
      noticeCount: publicItems.length,
      newNoticeCount: newItems.length,
      updatedNoticeCount: updatedItems.length,
      noticesUrl: `/${category.key}/notices.json`,
      metadataUrl: `/${category.key}/metadata.json`
    });

    allNewItems.push(...newItems);
    console.log(
      `Built ${category.key} JSON. notices=${publicItems.length} new=${newItems.length} updated=${updatedItems.length}`
    );
  }

  await writeJson(PATHS.categoriesIndex, {
    generatedAt,
    categories
  });
  await writeJson(PATHS.fcmPayloadsData, buildFcmPayloads(generatedAt, allNewItems));

  console.log(`Built combined FCM payloads. new=${allNewItems.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
