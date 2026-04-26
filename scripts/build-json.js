import { NOTICE_CATEGORIES, PATHS, getCategoryPaths } from "./lib/constants.js";
import { asciiTopicSegment, readJsonFile, writeJson } from "./lib/utils.js";

const REGION_TOPIC_MAP = {
  "서울특별시": "seoul",
  "부산광역시": "busan",
  "대구광역시": "daegu",
  "인천광역시": "incheon",
  "광주광역시": "gwangju",
  "대전광역시": "daejeon",
  "울산광역시": "ulsan",
  "세종특별자치시": "sejong",
  "경기도": "gyeonggi",
  "강원특별자치도": "gangwon",
  "충청북도": "chungbuk",
  "충청남도": "chungnam",
  "전북특별자치도": "jeonbuk",
  "전라북도": "jeonbuk",
  "전라남도": "jeonnam",
  "경상북도": "gyeongbuk",
  "경상남도": "gyeongnam",
  "제주특별자치도": "jeju",
  "전국": "nationwide"
};

const NOTICE_TYPE_TOPIC_MAP = {
  "공공임대": "public-rental",
  "행복주택": "happy-house",
  "영구임대": "permanent-rental",
  "매입임대": "purchase-rental",
  "전세임대": "jeonse-rental",
  "국민임대": "national-rental",
  "분양전환임대": "conversion-rental",
  "통합공공임대": "integrated-public-rental"
};

function summarizeBody(title) {
  return `${title} 공고를 확인해보세요.`;
}

function buildTopics(notice) {
  const topics = ["all-notices", `category-${notice.category}`];

  if (notice.region && notice.region !== "미상") {
    topics.push(
      `region-${REGION_TOPIC_MAP[notice.region] ?? asciiTopicSegment(notice.region, "region")}`
    );
  }

  if (notice.noticeType && notice.noticeType !== "기타") {
    topics.push(
      `type-${
        NOTICE_TYPE_TOPIC_MAP[notice.noticeType] ??
        asciiTopicSegment(notice.noticeType, "type")
      }`
    );
  }

  return Array.from(new Set(topics));
}

function buildFcmPayloads(generatedAt, newItems) {
  return {
    generatedAt,
    newNoticeCount: newItems.length,
    messages: newItems.flatMap((notice) =>
      buildTopics(notice).map((topic) => ({
        topic,
        title: `[LH 신규공고] ${notice.region} ${notice.noticeType} 공고가 등록되었어요`,
        body: summarizeBody(notice.title),
        data: {
          noticeId: notice.id,
          category: notice.category,
          noticeType: notice.noticeType,
          region: notice.region,
          detailUrl: notice.detailUrl,
          generatedAt
        }
      }))
    )
  };
}

async function main() {
  const allNewItems = [];
  const categories = [];
  let lastGeneratedAt = new Date().toISOString();

  for (const category of NOTICE_CATEGORIES) {
    const paths = getCategoryPaths(category.key);
    const latest = await readJsonFile(paths.latestData);
    if (!latest) {
      throw new Error(`Missing ${paths.latestData}. Run npm run crawl first.`);
    }

    lastGeneratedAt = latest.generatedAt;

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
    generatedAt: lastGeneratedAt,
    categories
  });
  await writeJson(PATHS.fcmPayloadsData, buildFcmPayloads(lastGeneratedAt, allNewItems));

  console.log(`Built combined FCM payloads. new=${allNewItems.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
