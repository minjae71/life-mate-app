// 서울 열린데이터광장 - 지하철 실시간 도착정보 API 호출 모듈
// 응답 구조: { errorMessage: {...}, realtimeArrivalList: [...] }
//
// 참고: 수인분당선(코레일, subwayId 1075)은 barvlDt(남은 초)가 0으로 오는 경우가 많고,
// 실제 위치는 arvlCd(도착코드)와 arvlMsg2(예: "[3]번째 전역 (왕십리)")로 전달됩니다.
// 그래서 아래에서 여러 신호를 종합해 도착까지 남은 초(etaSeconds)를 추정합니다.
//
// 네트워크 경로:
//  - 웹(개발): vite proxy(/api/subway → swopenapi.seoul.go.kr)로 CORS 우회 (fetch)
//  - 네이티브(APK): 프록시가 없으므로 CapacitorHttp로 실제 서버에 직접 요청(CORS 무관).
//    서울시 API는 http만 지원 → android/app/.../network_security_config.xml에서
//    해당 도메인 cleartext 허용 필요.

import { Capacitor, CapacitorHttp } from '@capacitor/core';

const API_KEY = import.meta.env.VITE_SEOUL_SUBWAY_API_KEY;

const API_PROXY = '/api/subway'; // 개발 서버 프록시 경로 (웹)
const API_HOST = 'http://swopenapi.seoul.go.kr/api/subway'; // 실제 서버 (네이티브)

const SUINBUNDANG_SUBWAY_ID = '1075'; // 수인분당선
const SECONDS_PER_STATION = 120; // "[N]번째 전역"일 때 정거장당 추정 소요(초)

// 플랫폼에 맞게 지하철 API를 호출하고 JSON을 반환합니다.
async function fetchSubwayJson(path) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url: `${API_HOST}${path}` });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`네트워크 오류: ${res.status}`);
    }
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  }
  const res = await fetch(`${API_PROXY}${path}`);
  if (!res.ok) throw new Error(`네트워크 오류: ${res.status}`);
  return res.json();
}

// 도착정보를 "도착까지 남은 초"로 변환합니다. 알 수 없으면 null.
function deriveEta(item) {
  const msg = item.arvlMsg2 || '';

  // 1) "N분 후"가 명시되면 그대로 사용 (가장 정확)
  const mm = msg.match(/(\d+)\s*분\s*후/);
  if (mm) return Number(mm[1]) * 60;

  // 2) 도착 코드 (0 진입, 1 도착) → 곧 도착
  const cd = String(item.arvlCd);
  if (cd === '0' || cd === '1') return 0;
  // 전역 진입/도착/출발 (4/5/3) → 약 1~2분
  if (cd === '3' || cd === '4' || cd === '5') return 90;

  // 3) "[N]번째 전역" → 정거장 수 × 추정 소요
  const nn = msg.match(/\[(\d+)\]\s*번째\s*전역/);
  if (nn) return Number(nn[1]) * SECONDS_PER_STATION;

  // 4) barvlDt가 유효하면 사용
  const bd = Number(item.barvlDt);
  if (bd > 0) return bd;

  return null;
}

/**
 * 특정 역의 "수인분당선 하행(수서/오이도/인천 방면)" 실시간 도착 목록을 가져옵니다.
 * @param {string} stationName - 역 이름 (예: "강남구청", "선릉")
 * @returns {Promise<Array<{etaSeconds:number, statusMsg:string, trainLineNm:string, btrainNo:string}>>}
 *          도착까지 남은 초(etaSeconds) 오름차순 정렬 (etaSeconds를 알 수 없는 항목은 제외)
 */
export async function fetchDownlineArrivals(stationName) {
  if (!API_KEY || API_KEY.includes('여기에')) {
    throw new Error('API 키가 설정되지 않았습니다. .env 파일을 확인하세요.');
  }

  const encoded = encodeURIComponent(stationName.trim());
  const path = `/${API_KEY}/json/realtimeStationArrival/0/20/${encoded}`;

  const data = await fetchSubwayJson(path);
  if (data.errorMessage && data.errorMessage.code !== 'INFO-000') {
    throw new Error(data.errorMessage.message || '알 수 없는 오류가 발생했습니다.');
  }

  const list = data.realtimeArrivalList || [];
  const seen = new Set();

  return list
    .filter(
      (item) =>
        item.subwayId === SUINBUNDANG_SUBWAY_ID &&
        item.updnLine === '하행' &&
        String(item.arvlCd) !== '2' // 2=출발(이미 이 역을 떠남) 제외
    )
    .map((item) => ({
      etaSeconds: deriveEta(item),
      statusMsg: item.arvlMsg2 || '',
      trainLineNm: item.trainLineNm || '', // 예: "인천행 - 선정릉방면"
      btrainNo: item.btrainNo || '',
    }))
    .filter((a) => a.etaSeconds !== null)
    .filter((a) => {
      const id = a.btrainNo || `${a.etaSeconds}-${a.statusMsg}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => a.etaSeconds - b.etaSeconds);
}

/**
 * 남은 초를 "n분 후" 형태로 변환합니다. (실시간/시간표 공용)
 */
export function formatRemaining(seconds) {
  const sec = Math.round(Number(seconds));
  if (Number.isNaN(sec)) return '-';
  if (sec <= 30) return '곧 도착';
  const min = Math.ceil(sec / 60);
  return `${min}분 후`;
}
