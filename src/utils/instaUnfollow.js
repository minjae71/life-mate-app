// 인스타그램 "내 정보 다운로드(JSON)"의 팔로워/팔로잉 파일을 파싱해
// 맞팔 여부를 계산합니다. 모든 처리는 기기 안에서만 이뤄집니다.
//
// 파일 형식(버전마다 파일명이 조금씩 달라서, 이름이 아니라 "내용"으로 판별합니다):
//  - 팔로워: 최상위가 배열 [{ string_list_data:[{ href, value, timestamp }] }, ...]
//            (또는 { relationships_followers: [...] })
//  - 팔로잉: { relationships_following: [...] }
// (팔로워가 많으면 followers_1, followers_2 ... 로 나뉠 수 있음)

// href에서 사용자명 추출 (예: https://www.instagram.com/_u/name → name)
function usernameFromHref(href) {
  if (!href) return '';
  const path = String(href).split('?')[0].replace(/\/+$/, '');
  return path.split('/').pop() || '';
}

// 엔트리 배열 → [{ username, href, timestamp }]
// 팔로워 파일은 string_list_data[0].value 에, 팔로잉 파일은 title(또는 href)에
// 사용자명이 들어있어 세 곳을 순서대로 확인합니다.
export function entriesToUsers(entries) {
  const users = [];
  if (!Array.isArray(entries)) return users;
  for (const e of entries) {
    const sld = e?.string_list_data?.[0];
    const username = sld?.value || e?.title || usernameFromHref(sld?.href);
    if (!username) continue;
    users.push({
      username,
      href: `https://www.instagram.com/${username}`,
      timestamp: sld?.timestamp || 0,
    });
  }
  return users;
}

// 파일명(경로 마지막 조각)으로 팔로워/팔로잉 힌트 (배열-루트 파일 구분용 보조 신호)
export function classifyByName(path) {
  const base = (path.split('/').pop() || '').toLowerCase();
  if (base.startsWith('following')) return 'following';
  if (base.startsWith('followers')) return 'followers';
  return null;
}

// 파싱된 JSON 한 개 → { followers:[], following:[] } 기여분.
// 내용의 키로 판별하고, 최상위 배열은 파일명 힌트로 팔로워/팔로잉을 정합니다.
// (pending_follow_requests / following_hashtags 등은 해당 키가 없어 자동으로 무시됨)
export function readRelations(json, nameHint) {
  const out = { followers: [], following: [] };
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    if (Array.isArray(json.relationships_following)) {
      out.following = entriesToUsers(json.relationships_following);
    }
    if (Array.isArray(json.relationships_followers)) {
      out.followers = entriesToUsers(json.relationships_followers);
    }
  } else if (Array.isArray(json)) {
    if (nameHint === 'following') out.following = entriesToUsers(json);
    else if (nameHint === 'followers') out.followers = entriesToUsers(json);
  }
  return out;
}

// username 기준 중복 제거(대소문자 무시)
export function uniqueUsers(users) {
  const seen = new Set();
  const out = [];
  for (const u of users) {
    const key = u.username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

// 팔로워/팔로잉 목록으로 관계 분석
export function computeResult(followersRaw, followingRaw) {
  const followers = uniqueUsers(followersRaw);
  const following = uniqueUsers(followingRaw);
  const followerSet = new Set(followers.map((u) => u.username.toLowerCase()));
  const followingSet = new Set(following.map((u) => u.username.toLowerCase()));

  // 내가 팔로우하지만 상대는 나를 팔로우하지 않음 (= 언팔/안 맞팔 대상)
  const notFollowingBack = following.filter(
    (u) => !followerSet.has(u.username.toLowerCase())
  );
  // 상대는 나를 팔로우하지만 나는 안 함 (= 나만 안 맞팔한 팬)
  const fans = followers.filter((u) => !followingSet.has(u.username.toLowerCase()));

  return {
    followersCount: followers.length,
    followingCount: following.length,
    mutualCount: following.length - notFollowingBack.length,
    notFollowingBack: sortByTimeDesc(notFollowingBack),
    fans: sortByTimeDesc(fans),
  };
}

function sortByTimeDesc(list) {
  return [...list].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

// 저장된 스냅샷(아이디 목록만 보관)으로부터 관계 분석 결과를 재계산합니다.
// 스냅샷엔 timestamp/href가 없으므로 저장된 순서를 그대로 유지합니다.
export function resultFromSnapshot(snapshot) {
  const toUsers = (names) => (names || []).map((username) => ({ username, timestamp: 0 }));
  return computeResult(toUsers(snapshot.followers), toUsers(snapshot.following));
}

// ---- 히스토리(스냅샷) 저장 + 비교 -------------------------------------------
// 업로드할 때마다 팔로워/팔로잉 아이디 목록을 기기에 저장하고, 다음 업로드 때
// 직전 스냅샷과 비교해 나를 언팔한 계정/새 팔로워를 계산합니다.
export const SNAPSHOTS_KEY = 'insta:snapshots';
const MAX_SNAPSHOTS = 20;

export function loadSnapshots() {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveSnapshots(list) {
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list));
}

// 사용자 배열 → 스냅샷 { at, followers:[아이디], following:[아이디] } (중복 제거)
export function makeSnapshot(followers, following) {
  const names = (arr) => [...new Set(arr.map((u) => u.username))];
  return { at: new Date().toISOString(), followers: names(followers), following: names(following) };
}

// 두 스냅샷 비교 (팔로워 기준). prev → curr 사이 변화.
export function diffSnapshots(prev, curr) {
  const lc = (s) => s.toLowerCase();
  const prevFollowers = prev.followers || [];
  const currFollowers = curr.followers || [];
  const prevSet = new Set(prevFollowers.map(lc));
  const currSet = new Set(currFollowers.map(lc));
  return {
    at: prev.at,
    lostFollowers: prevFollowers.filter((u) => !currSet.has(lc(u))), // 나를 언팔
    gainedFollowers: currFollowers.filter((u) => !prevSet.has(lc(u))), // 새 팔로워
  };
}

// 스냅샷 두 개가 동일한지(팔로워+팔로잉 구성 기준)
export function sameSnapshot(a, b) {
  if (!a || !b) return false;
  const sig = (s) =>
    JSON.stringify([[...s.followers].sort(), [...s.following].sort()]);
  return sig(a) === sig(b);
}

// 새 스냅샷을 히스토리에 추가(직전과 동일하면 추가 안 함). 갱신된 목록 반환.
export function appendSnapshot(snapshot) {
  const list = loadSnapshots();
  const last = list[list.length - 1];
  if (sameSnapshot(last, snapshot)) return list;
  const next = [...list, snapshot].slice(-MAX_SNAPSHOTS);
  saveSnapshots(next);
  return next;
}
