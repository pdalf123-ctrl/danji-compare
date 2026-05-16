const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY || '';
const KAKAO_JS_KEY = process.env.KAKAO_JS_KEY || '';
const CACHE_FILE = path.join(__dirname, 'data', 'apartments-cache.json');
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const CACHE_VERSION = 3;

// 수도권: 서울 25개구 + 경기 주요 시/군 + 인천 군/구
const AREA_LIST = [
  // 서울
  { region:'서울', name:'강남구', lawdCd:'11680', lat:37.5172, lng:127.0473 },
  { region:'서울', name:'강동구', lawdCd:'11740', lat:37.5301, lng:127.1238 },
  { region:'서울', name:'강북구', lawdCd:'11305', lat:37.6396, lng:127.0257 },
  { region:'서울', name:'강서구', lawdCd:'11500', lat:37.5509, lng:126.8495 },
  { region:'서울', name:'관악구', lawdCd:'11620', lat:37.4784, lng:126.9516 },
  { region:'서울', name:'광진구', lawdCd:'11215', lat:37.5385, lng:127.0823 },
  { region:'서울', name:'구로구', lawdCd:'11530', lat:37.4954, lng:126.8875 },
  { region:'서울', name:'금천구', lawdCd:'11545', lat:37.4569, lng:126.8956 },
  { region:'서울', name:'노원구', lawdCd:'11350', lat:37.6541, lng:127.0568 },
  { region:'서울', name:'도봉구', lawdCd:'11320', lat:37.6688, lng:127.0471 },
  { region:'서울', name:'동대문구', lawdCd:'11230', lat:37.5744, lng:127.0397 },
  { region:'서울', name:'동작구', lawdCd:'11590', lat:37.5124, lng:126.9393 },
  { region:'서울', name:'마포구', lawdCd:'11440', lat:37.5663, lng:126.9014 },
  { region:'서울', name:'서대문구', lawdCd:'11410', lat:37.5791, lng:126.9368 },
  { region:'서울', name:'서초구', lawdCd:'11650', lat:37.4837, lng:127.0324 },
  { region:'서울', name:'성동구', lawdCd:'11200', lat:37.5634, lng:127.0360 },
  { region:'서울', name:'성북구', lawdCd:'11290', lat:37.5894, lng:127.0167 },
  { region:'서울', name:'송파구', lawdCd:'11710', lat:37.5145, lng:127.1059 },
  { region:'서울', name:'양천구', lawdCd:'11470', lat:37.5170, lng:126.8666 },
  { region:'서울', name:'영등포구', lawdCd:'11560', lat:37.5264, lng:126.8962 },
  { region:'서울', name:'용산구', lawdCd:'11170', lat:37.5384, lng:126.9654 },
  { region:'서울', name:'은평구', lawdCd:'11380', lat:37.6027, lng:126.9291 },
  { region:'서울', name:'종로구', lawdCd:'11110', lat:37.5726, lng:126.9788 },
  { region:'서울', name:'중구', lawdCd:'11140', lat:37.5636, lng:126.9976 },
  { region:'서울', name:'중랑구', lawdCd:'11260', lat:37.5953, lng:127.0939 },

  // 경기
  { region:'경기', name:'수원시', lawdCd:'41110', lat:37.2636, lng:127.0286 },
  { region:'경기', name:'성남시', lawdCd:'41130', lat:37.4200, lng:127.1265 },
  { region:'경기', name:'고양시', lawdCd:'41280', lat:37.6584, lng:126.8320 },
  { region:'경기', name:'용인시', lawdCd:'41460', lat:37.2411, lng:127.1776 },
  { region:'경기', name:'부천시', lawdCd:'41190', lat:37.5035, lng:126.7660 },
  { region:'경기', name:'안산시', lawdCd:'41270', lat:37.3219, lng:126.8309 },
  { region:'경기', name:'안양시', lawdCd:'41170', lat:37.3943, lng:126.9568 },
  { region:'경기', name:'남양주시', lawdCd:'41360', lat:37.6360, lng:127.2165 },
  { region:'경기', name:'화성시', lawdCd:'41590', lat:37.1996, lng:126.8310 },
  { region:'경기', name:'평택시', lawdCd:'41220', lat:36.9921, lng:127.1128 },
  { region:'경기', name:'의정부시', lawdCd:'41150', lat:37.7381, lng:127.0338 },
  { region:'경기', name:'시흥시', lawdCd:'41390', lat:37.3802, lng:126.8029 },
  { region:'경기', name:'파주시', lawdCd:'41480', lat:37.7602, lng:126.7799 },
  { region:'경기', name:'김포시', lawdCd:'41570', lat:37.6153, lng:126.7156 },
  { region:'경기', name:'광명시', lawdCd:'41210', lat:37.4786, lng:126.8646 },
  { region:'경기', name:'광주시', lawdCd:'41610', lat:37.4294, lng:127.2550 },
  { region:'경기', name:'군포시', lawdCd:'41410', lat:37.3616, lng:126.9352 },
  { region:'경기', name:'하남시', lawdCd:'41450', lat:37.5393, lng:127.2148 },
  { region:'경기', name:'오산시', lawdCd:'41370', lat:37.1498, lng:127.0772 },
  { region:'경기', name:'이천시', lawdCd:'41500', lat:37.2722, lng:127.4350 },
  { region:'경기', name:'안성시', lawdCd:'41550', lat:37.0080, lng:127.2797 },
  { region:'경기', name:'의왕시', lawdCd:'41430', lat:37.3447, lng:126.9683 },
  { region:'경기', name:'양주시', lawdCd:'41630', lat:37.7853, lng:127.0458 },
  { region:'경기', name:'구리시', lawdCd:'41310', lat:37.5943, lng:127.1296 },
  { region:'경기', name:'포천시', lawdCd:'41650', lat:37.8949, lng:127.2003 },
  { region:'경기', name:'여주시', lawdCd:'41670', lat:37.2980, lng:127.6370 },
  { region:'경기', name:'동두천시', lawdCd:'41250', lat:37.9036, lng:127.0606 },
  { region:'경기', name:'과천시', lawdCd:'41290', lat:37.4292, lng:126.9876 },
  { region:'경기', name:'가평군', lawdCd:'41820', lat:37.8315, lng:127.5096 },
  { region:'경기', name:'양평군', lawdCd:'41830', lat:37.4917, lng:127.4876 },
  { region:'경기', name:'연천군', lawdCd:'41800', lat:38.0964, lng:127.0750 },

  // 인천
  { region:'인천', name:'중구', lawdCd:'28110', lat:37.4738, lng:126.6216 },
  { region:'인천', name:'동구', lawdCd:'28140', lat:37.4739, lng:126.6432 },
  { region:'인천', name:'미추홀구', lawdCd:'28177', lat:37.4637, lng:126.6505 },
  { region:'인천', name:'연수구', lawdCd:'28185', lat:37.4100, lng:126.6783 },
  { region:'인천', name:'남동구', lawdCd:'28200', lat:37.4473, lng:126.7315 },
  { region:'인천', name:'부평구', lawdCd:'28237', lat:37.5070, lng:126.7218 },
  { region:'인천', name:'계양구', lawdCd:'28245', lat:37.5374, lng:126.7377 },
  { region:'인천', name:'서구', lawdCd:'28260', lat:37.5455, lng:126.6759 },
  { region:'인천', name:'강화군', lawdCd:'28710', lat:37.7465, lng:126.4880 },
  { region:'인천', name:'옹진군', lawdCd:'28720', lat:37.4466, lng:126.6368 }
];
const GU_LIST = AREA_LIST;

const SEARCH_KEYWORDS = [
  '아파트', '아파트단지', '래미안 아파트', '자이 아파트', '푸르지오 아파트',
  '힐스테이트 아파트', '아이파크 아파트', '롯데캐슬 아파트', '더샵 아파트', 'e편한세상 아파트',
  '이편한세상 아파트', '두산위브 아파트', '센트레빌 아파트', '주공아파트', '현대아파트',
  '한양아파트', '삼성아파트', '벽산아파트', '우성아파트'
];

const BRAND_WORDS = ['래미안','자이','푸르지오','힐스테이트','아이파크','롯데캐슬','더샵','e편한세상','이편한세상','두산위브','센트레빌','주공','현대','한양','삼성','벽산','우성','아파트'];
const EXCLUDE_WORDS = ['관리사무소','상가','입주자대표','노인정','경로당','어린이집','유치원','주차장','공인중개사','모델하우스','분양사무소','홍보관','오피스텔','빌라','원룸','하우스','빌딩','타워','타운','센터','프라자','몰','호텔','병원','학교','대학교','교회','성당','사무소','오피스','상업시설'];
const GANGNAM_POINT = { lat: 37.4979, lng: 127.0276 }; // 강남역 기준
function gangnamAccessScore(lat, lng) {
  const km = haversineKm({ lat, lng }, GANGNAM_POINT);
  if (km <= 3) return 10;
  if (km <= 7) return 9;
  if (km <= 12) return 8;
  if (km <= 18) return 7;
  if (km <= 25) return 6;
  if (km <= 35) return 5;
  if (km <= 50) return 4;
  if (km <= 70) return 3;
  return 2;
}

let apartmentDB = [];
let dbStatus = { building: false, builtAt: null, error: null, count: 0 };
const analysisCache = new Map();

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function normalizeName(name = '') {
  return String(name)
    .replace(/\([^)]*\)/g, '')
    .replace(/\s*아파트\s*$/g, '')
    .replace(/\s+/g, '')
    .trim();
}
function cleanName(name = '') {
  return String(name)
    .replace(/\([^)]*\)/g, '')
    .replace(/관리사무소|입주자대표회의|상가/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}
function looksLikeApartment(itemOrName = '') {
  const item = typeof itemOrName === 'object' ? itemOrName : { place_name: String(itemOrName), category_name: '' };
  const name = String(item.place_name || '');
  const category = String(item.category_name || '');
  const address = String(item.road_address_name || item.address_name || '');
  if (!name || EXCLUDE_WORDS.some(w => name.includes(w) || category.includes(w))) return false;
  // 카카오 카테고리가 아파트로 잡힌 경우를 최우선 통과
  if (category.includes('아파트')) return true;
  // 카테고리가 부정확해도 이름/주소가 확실히 주거 단지처럼 보이는 경우만 통과
  const strongName = name.includes('아파트') || /래미안|자이|푸르지오|힐스테이트|아이파크|롯데캐슬|더샵|e편한세상|이편한세상|두산위브|센트레빌/.test(name);
  const residentialAddress = /동|로|길/.test(address);
  return strongName && residentialAddress;
}
function parseDong(address = '') {
  const parts = String(address).split(' ');
  return parts.find(p => /동$|가$/.test(p)) || parts.slice(2, 4).join(' ');
}
function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return false;
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const isFresh = raw.builtAt && Date.now() - new Date(raw.builtAt).getTime() < CACHE_TTL_MS;
    if (raw.version !== CACHE_VERSION) return false;
    if (!isFresh || !Array.isArray(raw.apartments)) return false;
    apartmentDB = raw.apartments;
    dbStatus = { building: false, builtAt: raw.builtAt, error: null, count: apartmentDB.length };
    return true;
  } catch (e) { return false; }
}
function saveCache() {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ version: CACHE_VERSION, builtAt: new Date().toISOString(), apartments: apartmentDB }, null, 2));
}
async function kakaoKeywordSearch(query, options = {}) {
  if (!KAKAO_REST_KEY) throw new Error('KAKAO_REST_KEY 환경변수가 필요합니다.');
  const res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
    params: { query, size: 15, ...options },
    timeout: 9000
  });
  return res.data;
}
async function fetchApartmentsForGu(gu, maxPagesPerKeyword = 3) {
  const found = [];
  const seen = new Set();
  for (const keyword of SEARCH_KEYWORDS) {
    for (let page = 1; page <= maxPagesPerKeyword; page++) {
      try {
        const data = await kakaoKeywordSearch(`${gu.name} ${keyword}`, {
          x: gu.lng, y: gu.lat, radius: 20000, page, sort: 'accuracy'
        });
        const docs = data.documents || [];
        if (!docs.length) break;
        for (const item of docs) {
          const place = item.place_name || '';
          const address = item.road_address_name || item.address_name || '';
          const fullAddr = `${item.address_name || ''} ${item.road_address_name || ''}`;
          if (!fullAddr.includes(gu.region) && !(gu.region === '경기' && fullAddr.includes('경기'))) continue;
          if (!fullAddr.includes(gu.name)) continue;
          if (!looksLikeApartment(item)) continue;
          const name = cleanName(place);
          const key = `${gu.name}:${normalizeName(name)}:${Math.round(Number(item.y) * 10000)}:${Math.round(Number(item.x) * 10000)}`;
          const nameKey = `${gu.name}:${normalizeName(name)}`;
          if (seen.has(key) || seen.has(nameKey)) continue;
          seen.add(key); seen.add(nameKey);
          const lat = Number(item.y), lng = Number(item.x);
          if (!lat || !lng) continue;
          found.push({
            id: `${gu.lawdCd}_${normalizeName(name)}_${found.length + 1}`,
            name,
            region: gu.region,
            gu: gu.name,
            lawdCd: gu.lawdCd,
            dong: parseDong(address),
            address,
            lat, lng,
            source: 'kakao',
            gangnamScore: gangnamAccessScore(lat, lng),
            tags: [],
            subway: null,
            school: null,
            households: null,
            builtYear: null
          });
        }
        if (data.meta?.is_end) break;
        await sleep(80);
      } catch (e) {
        break;
      }
    }
    await sleep(120);
  }
  return found;
}
async function buildApartmentDB({ force = false } = {}) {
  if (dbStatus.building) return apartmentDB;
  if (!force && apartmentDB.length) return apartmentDB;
  if (!force && loadCache()) return apartmentDB;
  dbStatus = { building: true, builtAt: null, error: null, count: apartmentDB.length };
  const all = [];
  const globalSeen = new Set();
  try {
    for (const gu of GU_LIST) {
      const apts = await fetchApartmentsForGu(gu, 3);
      for (const apt of apts) {
        const key = `${apt.gu}:${normalizeName(apt.name)}`;
        if (globalSeen.has(key)) continue;
        globalSeen.add(key);
        all.push(apt);
      }
      dbStatus.count = all.length;
    }
    apartmentDB = all.sort((a, b) => a.region.localeCompare(b.region, 'ko') || a.gu.localeCompare(b.gu, 'ko') || a.name.localeCompare(b.name, 'ko'));
    dbStatus = { building: false, builtAt: new Date().toISOString(), error: null, count: apartmentDB.length };
    saveCache();
  } catch (e) {
    dbStatus = { building: false, builtAt: null, error: e.message, count: apartmentDB.length };
    throw e;
  }
  return apartmentDB;
}
async function ensureDB() {
  if (!apartmentDB.length && !dbStatus.building) {
    loadCache() || buildApartmentDB().catch(e => { dbStatus.error = e.message; });
  }
}
async function nearestSubway(apt) {
  try {
    const data = await kakaoKeywordSearch('지하철역', { category_group_code: 'SW8', x: apt.lng, y: apt.lat, radius: 2500, sort: 'distance' });
    const d = data.documents?.[0];
    if (!d) return null;
    return { name: d.place_name, distanceM: Number(d.distance || 0), label: `${d.place_name} ${Math.round(Number(d.distance || 0))}m` };
  } catch { return null; }
}
async function nearestSchool(apt) {
  try {
    const data = await kakaoKeywordSearch('초등학교', { x: apt.lng, y: apt.lat, radius: 1800, sort: 'distance' });
    const docs = (data.documents || []).filter(d => d.place_name.includes('초등학교'));
    const d = docs[0];
    if (!d) return null;
    return { name: d.place_name, distanceM: Number(d.distance || 0), label: `${d.place_name} ${Math.round(Number(d.distance || 0))}m` };
  } catch { return null; }
}
function enrichTags(apt) {
  const tags = new Set(apt.tags || []);
  if (apt.subway?.distanceM <= 600) tags.add('역세권');
  if (apt.school?.distanceM <= 500) tags.add('초품아');
  if ((apt.gangnamScore || 0) >= 8) tags.add('강남접근성');
  if (/주공|현대|한양|우성|재건축/.test(apt.name)) tags.add('재건축관심');
  return [...tags];
}
async function analyzeApartment(apt) {
  const cacheKey = apt.id;
  if (analysisCache.has(cacheKey)) return analysisCache.get(cacheKey);
  const [subway, school] = await Promise.all([nearestSubway(apt), nearestSchool(apt)]);
  const analyzed = { ...apt, subway, school };
  analyzed.tags = enrichTags(analyzed);
  analyzed.score = Math.min(100, Math.round((analyzed.gangnamScore || 5) * 7 + (subway?.distanceM <= 600 ? 15 : 0) + (school?.distanceM <= 500 ? 15 : 0)));
  analysisCache.set(cacheKey, analyzed);
  return analyzed;
}
function similarScore(target, item) {
  let score = 0;
  const gangnamDiff = Math.abs((target.gangnamScore || 5) - (item.gangnamScore || 5));
  score += Math.max(0, 30 - gangnamDiff * 5);
  if (target.gu === item.gu) score += 12;
  const distKm = haversineKm(target, item);
  if (distKm < 1.5) score += 20; else if (distKm < 4) score += 12; else if (distKm < 8) score += 6;
  const tBrand = BRAND_WORDS.find(w => target.name.includes(w));
  if (tBrand && item.name.includes(tBrand)) score += 10;
  const tTags = new Set(target.tags || []);
  for (const tag of item.tags || []) if (tTags.has(tag)) score += 8;
  return Math.round(score);
}

app.get('/api/config', (req, res) => res.json({ kakaoJsKey: KAKAO_JS_KEY || process.env.KAKAO_REST_KEY || '' }));
app.get('/api/status', async (req, res) => { await ensureDB(); res.json({ ...dbStatus, hasKakaoKey: Boolean(KAKAO_REST_KEY), areaCount: AREA_LIST.length }); });
app.post('/api/rebuild', async (req, res) => {
  try { buildApartmentDB({ force: true }).catch(e => { dbStatus.error = e.message; }); res.json({ ok: true, message: '아파트 DB 재수집을 시작했습니다.' }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
app.get('/api/apartments', async (req, res) => {
  await ensureDB();
  const { gu = 'all', region = 'all', q = '', limit = '6000' } = req.query;
  let list = apartmentDB;
  if (region !== 'all') list = list.filter(a => a.region === region);
  if (gu !== 'all') list = list.filter(a => `${a.region} ${a.gu}` === gu || a.gu === gu);
  if (q) list = list.filter(a => `${a.name} ${a.address} ${a.dong}`.includes(q));
  res.json({ count: list.length, status: dbStatus, apartments: list.slice(0, Number(limit) || 6000) });
});
app.get('/api/apartments/:id', async (req, res) => {
  await ensureDB();
  const apt = apartmentDB.find(a => a.id === req.params.id);
  if (!apt) return res.status(404).json({ error: '단지를 찾을 수 없습니다.' });
  res.json(await analyzeApartment(apt));
});
app.get('/api/similar/:id', async (req, res) => {
  await ensureDB();
  const targetRaw = apartmentDB.find(a => a.id === req.params.id);
  if (!targetRaw) return res.status(404).json({ error: '단지를 찾을 수 없습니다.' });
  const target = await analyzeApartment(targetRaw);
  const candidates = apartmentDB.filter(a => a.id !== target.id);
  const topRaw = candidates.map(a => ({ ...a, similarScore: similarScore(target, a) }))
    .sort((a, b) => b.similarScore - a.similarScore)
    .slice(0, Number(req.query.limit) || 10);
  const top = await Promise.all(topRaw.map(async a => ({ ...(await analyzeApartment(a)), similarScore: a.similarScore })));
  res.json({ target, similar: top });
});
app.get('/api/compare', async (req, res) => {
  await ensureDB();
  const a = apartmentDB.find(x => x.id === req.query.a);
  const b = apartmentDB.find(x => x.id === req.query.b);
  if (!a || !b) return res.status(404).json({ error: '비교할 단지를 찾을 수 없습니다.' });
  const [aa, bb] = await Promise.all([analyzeApartment(a), analyzeApartment(b)]);
  res.json({ a: aa, b: bb });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  loadCache();
  console.log(`Danji Compare MVP running on :${PORT}`);
  if (!KAKAO_REST_KEY) console.log('주의: KAKAO_REST_KEY 환경변수가 없으면 자동 수집이 작동하지 않습니다.');
  if (!KAKAO_JS_KEY) console.log('주의: KAKAO_JS_KEY 환경변수가 없으면 지도 로딩이 제한될 수 있습니다.');
});
