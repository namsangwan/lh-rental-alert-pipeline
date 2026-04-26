export const LH_BASE_URL = "https://apply.lh.or.kr";
export const LH_NOTICE_DETAIL_URL =
  `${LH_BASE_URL}/lhapply/apply/wt/wrtanc/selectWrtancInfo.do`;
export const LH_NOTICE_FILE_LIST_URL =
  `${LH_BASE_URL}/lhapply/wt/wrtanc/wrtFileDownl.do`;
export const LH_FILE_DOWNLOAD_URL = `${LH_BASE_URL}/lhapply/lhFile.do`;
export const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
export const FCM_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const NOTICE_CATEGORIES = [
  {
    key: "rental",
    label: "임대",
    mi: "1026",
    source: "lh-rental",
    listUrl: `${LH_BASE_URL}/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026`
  },
  {
    key: "sale",
    label: "분양",
    mi: "1027",
    source: "lh-sale",
    listUrl: `${LH_BASE_URL}/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1027`
  },
  {
    key: "land",
    label: "토지",
    mi: "1062",
    source: "lh-land",
    listUrl: `${LH_BASE_URL}/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1062`
  }
];

export const PATHS = {
  dataDir: "data",
  snapshotsDir: "data/snapshots",
  latestData: "data/latest.json",
  changesData: "data/changes.json",
  fcmPayloadsData: "data/fcm-payloads.json",
  publicDir: "public",
  publicNotices: "public/notices.json",
  publicMetadata: "public/metadata.json",
  categoriesIndex: "public/categories.json"
};

export function getCategoryPaths(categoryKey) {
  return {
    latestData: `data/${categoryKey}-latest.json`,
    changesData: `data/${categoryKey}-changes.json`,
    publicNotices: `public/${categoryKey}/notices.json`,
    publicMetadata: `public/${categoryKey}/metadata.json`
  };
}
