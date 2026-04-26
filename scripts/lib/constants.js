export const LH_BASE_URL = "https://apply.lh.or.kr";
export const LH_NOTICE_LIST_URL =
  `${LH_BASE_URL}/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026`;
export const LH_NOTICE_DETAIL_URL =
  `${LH_BASE_URL}/lhapply/apply/wt/wrtanc/selectWrtancInfo.do`;
export const LH_NOTICE_FILE_LIST_URL =
  `${LH_BASE_URL}/lhapply/wt/wrtanc/wrtFileDownl.do`;
export const LH_FILE_DOWNLOAD_URL = `${LH_BASE_URL}/lhapply/lhFile.do`;
export const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
export const FCM_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const PATHS = {
  dataDir: "data",
  snapshotsDir: "data/snapshots",
  latestData: "data/latest.json",
  changesData: "data/changes.json",
  fcmPayloadsData: "data/fcm-payloads.json",
  publicDir: "public",
  publicNotices: "public/notices.json",
  publicMetadata: "public/metadata.json"
};
