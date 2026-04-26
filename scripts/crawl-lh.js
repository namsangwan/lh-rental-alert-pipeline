import {
  LH_FILE_DOWNLOAD_URL,
  LH_NOTICE_DETAIL_URL,
  LH_NOTICE_FILE_LIST_URL,
  LH_NOTICE_LIST_URL,
  PATHS
} from "./lib/constants.js";
import {
  ensureDir,
  normalizeKoreanDate,
  normalizeWhitespace,
  parseNullableNumber,
  sha256,
  stripHtml,
  timestampForFile,
  writeJson
} from "./lib/utils.js";

function splitNoticeType(rawType) {
  const normalized = normalizeWhitespace(rawType);
  const match = normalized.match(/^(.+?)\((.+)\)$/);
  if (!match) {
    return {
      noticeType: normalized || "기타",
      noticeSubtype: null
    };
  }

  return {
    noticeType: normalizeWhitespace(match[1]),
    noticeSubtype: normalizeWhitespace(match[2])
  };
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; LHNoticeBot/0.1; +https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch LH notices: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

function buildDetailUrl({ panId, ccrCnntSysDsCd, uppAisTpCd, aisTpCd }) {
  const params = new URLSearchParams({
    mi: "1026",
    panId,
    ccrCnntSysDsCd,
    uppAisTpCd
  });

  if (aisTpCd) {
    params.set("aisTpCd", aisTpCd);
  }

  return `${LH_NOTICE_DETAIL_URL}?${params.toString()}`;
}

function extractAttribute(tag, name) {
  const regex = new RegExp(`${name}="([^"]*)"`, "i");
  const match = tag.match(regex);
  return match ? match[1] : "";
}

function extractCells(rowHtml) {
  const matches = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
  return matches.map((match) => match[1]);
}

function extractRowData(rowHtml) {
  const cells = extractCells(rowHtml);
  const titleAnchorMatch = rowHtml.match(
    /<a\b[^>]*class="[^"]*\bwrtancInfoBtn\b[^"]*"[^>]*>[\s\S]*?<\/a>/i
  );

  if (!titleAnchorMatch || cells.length < 9) {
    return null;
  }

  const titleAnchor = titleAnchorMatch[0];
  const fileAnchorMatch = rowHtml.match(
    /<a\b[^>]*class="[^"]*\blistFileDown\b[^"]*"[^>]*>/i
  );

  const panId = extractAttribute(titleAnchor, "data-id1");
  const ccrCnntSysDsCd = extractAttribute(titleAnchor, "data-id2");
  const uppAisTpCd = extractAttribute(titleAnchor, "data-id3");
  const aisTpCd = extractAttribute(titleAnchor, "data-id4");
  const rawTitle = titleAnchor.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "";
  const title = stripHtml(rawTitle).replace(/\s*\d+일전$/, "").trim();

  if (!panId || !title) {
    return null;
  }

  return {
    panId,
    ccrCnntSysDsCd,
    uppAisTpCd,
    aisTpCd,
    numberText: stripHtml(cells[0]),
    rawNoticeType: stripHtml(cells[1]),
    title,
    region: stripHtml(cells[3]) || "미상",
    postedAt: normalizeKoreanDate(stripHtml(cells[5])),
    deadlineAt: normalizeKoreanDate(stripHtml(cells[6])),
    status: stripHtml(cells[7]) || "미상",
    viewCount: parseNullableNumber(stripHtml(cells[8])),
    hasAttachment: Boolean(fileAnchorMatch),
    detailUrl: buildDetailUrl({ panId, ccrCnntSysDsCd, uppAisTpCd, aisTpCd })
  };
}

function extractRows(html) {
  const tbodyMatch = html.match(
    /<div\b[^>]*class="[^"]*\bbbs_ListA\b[^"]*"[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i
  );
  if (!tbodyMatch) {
    return [];
  }

  const tbodyHtml = tbodyMatch[1];
  const rowMatches = [...tbodyHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  return rowMatches
    .map((match) => extractRowData(match[0]))
    .filter((row) => row !== null);
}

async function fetchAttachments({ panId, ccrCnntSysDsCd, uppAisTpCd, aisTpCd }) {
  const form = new URLSearchParams({
    uppAisTpCd1: uppAisTpCd,
    aisTpCd1: aisTpCd,
    ccrCnntSysDsCd1: ccrCnntSysDsCd,
    lsSst1: "",
    panId1: panId
  });

  const response = await fetch(LH_NOTICE_FILE_LIST_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": "Mozilla/5.0 (compatible; LHNoticeBot/0.1; +https://github.com/)"
    },
    body: form.toString()
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      const name = normalizeWhitespace(item?.cmnAhflNm ?? "");
      const fileId = String(item?.cmnAhflSn ?? "").trim();
      if (!name || !fileId) {
        return null;
      }

      return {
        name,
        url: `${LH_FILE_DOWNLOAD_URL}?fileid=${encodeURIComponent(fileId)}`
      };
    })
    .filter(Boolean);
}

function buildContentHash(item) {
  return sha256(
    JSON.stringify({
      title: item.title,
      noticeType: item.noticeType,
      noticeSubtype: item.noticeSubtype,
      region: item.region,
      status: item.status,
      postedAt: item.postedAt,
      deadlineAt: item.deadlineAt,
      detailUrl: item.detailUrl,
      attachments: item.attachments
    })
  );
}

async function parseNotice(row) {
  const { noticeType, noticeSubtype } = splitNoticeType(row.rawNoticeType);
  const attachments = row.hasAttachment
    ? await fetchAttachments({
        panId: row.panId,
        ccrCnntSysDsCd: row.ccrCnntSysDsCd,
        uppAisTpCd: row.uppAisTpCd,
        aisTpCd: row.aisTpCd
      })
    : [];

  const base = {
    id: `lh-${row.panId}`,
    source: "lh",
    sourceNoticeKey: row.panId,
    title: row.title,
    noticeType,
    noticeSubtype,
    region: row.region,
    status: row.status,
    postedAt: row.postedAt,
    deadlineAt: row.deadlineAt,
    detailUrl: row.detailUrl,
    attachments,
    viewCount: row.viewCount,
    rawPanId: row.panId
  };

  return {
    ...base,
    contentHash: buildContentHash(base)
  };
}

async function main() {
  await ensureDir(PATHS.dataDir);
  await ensureDir(PATHS.snapshotsDir);

  const html = await fetchHtml(LH_NOTICE_LIST_URL);
  const rows = extractRows(html);

  if (rows.length === 0) {
    throw new Error("No notice rows were parsed from the LH page.");
  }

  const deduped = new Map();
  for (const row of rows) {
    const notice = await parseNotice(row);
    deduped.set(notice.sourceNoticeKey, notice);
  }

  const items = Array.from(deduped.values());
  const output = {
    generatedAt: new Date().toISOString(),
    sourceUrl: LH_NOTICE_LIST_URL,
    count: items.length,
    items
  };

  await writeJson(PATHS.latestData, output);
  await writeJson(`${PATHS.snapshotsDir}/${timestampForFile()}.json`, output);

  console.log(`Crawled ${items.length} LH notices.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
