const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY || '';
const KAKAO_JS_KEY = process.env.KAKAO_JS_KEY || '';

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const RAW_PATH = path.join(DATA_DIR, 'apartments.json');
const GEO_PATH = path.join(DATA_DIR, 'apartments.geocoded.json');

const AREA_CENTERS = {
  '서울특별시 종로구':[37.5729,126.9794], '서울특별시 중구':[37.5636,126.9976], '서울특별시 용산구':[37.5326,126.9905],
  '서울특별시 성동구':[37.5634,127.0367], '서울특별시 광진구':[37.5385,127.0823], '서울특별시 동대문구':[37.5744,127.0396],
  '서울특별시 중랑구':[37.6063,127.0925], '서울특별시 성북구':[37.5894,127.0167], '서울특별시 강북구':[37.6396,127.0257],
  '서울특별시 도봉구':[37.6688,127.0471], '서울특별시 노원구':[37.6542,127.0568], '서울특별시 은평구':[37.6027,126.9291],
  '서울특별시 서대문구':[37.5791,126.9368], '서울특별시 마포구':[37.5663,126.9014], '서울특별시 양천구':[37.5170,126.8666],
  '서울특별시 강서구':[37.5509,126.8495], '서울특별시 구로구':[37.4954,126.8874], '서울특별시 금천구':[37.4569,126.8955],
  '서울특별시 영등포구':[37.5264,126.8962], '서울특별시 동작구':[37.5124,126.9393], '서울특별시 관악구':[37.4784,126.9516],
  '서울특별시 서초구':[37.4837,127.0324], '서울특별시 강남구':[37.5172,127.0473], '서울특별시 송파구':[37.5145,127.1059],
  '서울특별시 강동구':[37.5301,127.1238],
  '인천광역시 중구':[37.4737,126.6215], '인천광역시 동구':[37.4739,126.6432], '인천광역시 미추홀구':[37.4636,126.6506],
  '인천광역시 연수구':[37.4102,126.6788], '인천광역시 남동구':[37.4473,126.7316], '인천광역시 부평구':[37.5070,126.7219],
  '인천광역시 계양구':[37.5374,126.7378], '인천광역시 서구':[37.5450,126.6759], '인천광역시 강화군':[37.7465,126.4878],
  '인천광역시 옹진군':[37.4466,126.6368],
  '경기도 수원시':[37.2636,127.0286], '경기도 성남시':[37.4200,127.1265], '경기도 고양시':[37.6584,126.8320],
  '경기도 용인시':[37.2411,127.1776], '경기도 부천시':[37.5035,126.7660], '경기도 안산시':[37.3219,126.8309],
  '경기도 안양시':[37.3943,126.9568], '경기도 남양주시':[37.6360,127.2165], '경기도 화성시':[37.1995,126.8312],
  '경기도 평택시':[36.9921,127.1129], '경기도 의정부시':[37.7381,127.0338], '경기도 시흥시':[37.3802,126.8029],
  '경기도 파주시':[37.7599,126.7802], '경기도 김포시':[37.6154,126.7156], '경기도 광명시':[37.4784,126.8644],
  '경기도 광주시':[37.4294,127.2550], '경기도 군포시':[37.3616,126.9352], '경기도 하남시':[37.5393,127.2149],
  '경기도 오산시':[37.1498,127.0772], '경기도 양주시':[37.7853,127.0458], '경기도 이천시':[37.2722,127.4350],
  '경기도 구리시':[37.5943,127.1296], '경기도 안성시':[37.0079,127.2798], '경기도 의왕시':[37.3447,126.9683],
  '경기도 포천시':[37.8949,127.2003], '경기도 양평군':[37.4918,127.4876], '경기도 여주시':[37.2980,127.6370],
  '경기도 동두천시':[37.9036,127.0602], '경기도 과천시':[37.4292,126.9877], '경기도 가평군':[37.8315,127.5096],
  '경기도 연천군':[38.0964,127.0749]
};

let apartments = [];
let geocodeState = { running: false, total: 0, done: 0, success: 0, failed: 0, startedAt: null, finishedAt: null, error: null };

function loadApartments() {
  const target = fs.existsSync(GEO_PATH) ? GEO_PATH : RAW_PATH;
  apartments = JSON.parse(fs.readFileSync(target, 'utf8'));
  apartments = apartments.map((a, i) => withFallbackCoord(a, i));
  console.log(`Loaded ${apartments.length} apartments from ${path.basename(target)}`);
}

function stableHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24); }
  return Math.abs(h >>> 0);
}

function withFallbackCoord(a, idx = 0) {
  if (a.lat && a.lng) return { ...a, estimatedCoord: false };
  const key = `${a.sido} ${a.sigungu}`;
  const center = AREA_CENTERS[key] || AREA_CENTERS[`${a.sido} ${String(a.sigungu || '').split(' ')[0]}`] || [37.5665, 126.9780];
  const h = stableHash(`${a.id}-${a.name}-${idx}`);
  const angle = (h % 360) * Math.PI / 180;
  const radius = ((h % 1000) / 1000) * 0.045;
  return { ...a, lat: center[0] + Math.sin(angle) * radius, lng: center[1] + Math.cos(angle) * radius, estimatedCoord: true };
}

function normalizeText(v) { return String(v || '').toLowerCase().replace(/\s+/g, ''); }
function yearsOld(approvedDate) { return approvedDate ? new Date().getFullYear() - parseInt(approvedDate.slice(0,4),10) : null; }
function gangnamScore(a) {
  const score = { '강남구':100,'서초구':94,'송파구':88,'성동구':76,'용산구':74,'광진구':70,'동작구':66,'강동구':62,'중구':60,'종로구':58,'영등포구':54,'마포구':52 };
  if (a.sido === '서울특별시') return score[a.sigungu] || 42;
  if (a.sido === '경기도') {
    if (/성남|과천|하남|용인|의왕|안양/.test(a.sigungu)) return 58;
    if (/수원|광명|구리|군포/.test(a.sigungu)) return 48;
    return 35;
  }
  return 28;
}
function aptSummary(a) {
  return {
    ...a,
    age: yearsOld(a.approvedDate),
    gangnamScore: gangnamScore(a),
    isLarge: (a.households || 0) >= 1000,
    displayAddress: a.roadAddress || a.jibunAddress || `${a.sido} ${a.sigungu} ${a.dong || ''}`.trim()
  };
}

function hasRealCoord(a) {
  return !a.estimatedCoord && Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lng));
}

function incrementCounter(obj, key, hasCoord) {
  if (!key) return;
  if (!obj[key]) obj[key] = { total: 0, withCoordinates: 0, withoutCoordinates: 0 };
  obj[key].total++;
  if (hasCoord) obj[key].withCoordinates++;
  else obj[key].withoutCoordinates++;
}

function diagnosticsSummary() {
  const bySido = {};
  const bySigungu = {};
  const missingCoordinateSamples = [];

  for (const a of apartments) {
    const hasCoord = hasRealCoord(a);
    incrementCounter(bySido, a.sido || 'unknown', hasCoord);
    incrementCounter(bySigungu, `${a.sido || 'unknown'} ${a.sigungu || 'unknown'}`.trim(), hasCoord);
    if (!hasCoord && missingCoordinateSamples.length < 100) {
      missingCoordinateSamples.push({
        id: a.id,
        complexCode: a.complexCode,
        name: a.name,
        sido: a.sido,
        sigungu: a.sigungu,
        dong: a.dong,
        roadAddress: a.roadAddress,
        jibunAddress: a.jibunAddress,
        geocodeStatus: a.geocodeStatus || null
      });
    }
  }

  const withCoordinates = apartments.filter(hasRealCoord).length;
  return {
    total: apartments.length,
    withCoordinates,
    withoutCoordinates: apartments.length - withCoordinates,
    bySido,
    bySigungu,
    missingCoordinateSamples
  };
}

function similarityScore(target, cand) {
  let s = 0;
  if (target.sido === cand.sido) s += 12;
  if (target.sigungu === cand.sigungu) s += 22;
  const th = target.households || 0, ch = cand.households || 0;
  if (th && ch) s += Math.max(0, 25 - Math.abs(Math.log((ch+1)/(th+1))) * 18);
  const ta = yearsOld(target.approvedDate), ca = yearsOld(cand.approvedDate);
  if (ta != null && ca != null) s += Math.max(0, 18 - Math.abs(ta - ca) * 0.8);
  s += Math.max(0, 15 - Math.abs(gangnamScore(target) - gangnamScore(cand)) * 0.35);
  if ((target.heating || '') === (cand.heating || '')) s += 4;
  if ((target.saleType || '') === (cand.saleType || '')) s += 3;
  return Math.round(s * 10) / 10;
}

async function geocodeOne(a) {
  const query = a.roadAddress || a.jibunAddress;
  if (!query) return null;
  const res = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
    params: { query, size: 1 },
    timeout: 7000
  });
  const d = res.data?.documents?.[0];
  if (!d) return null;
  return { lat: Number(d.y), lng: Number(d.x) };
}

async function geocodeMissing(limit = 999999) {
  if (geocodeState.running) return geocodeState;
  if (!KAKAO_REST_KEY) { geocodeState.error = 'KAKAO_REST_KEY missing'; return geocodeState; }
  geocodeState = { running: true, total: apartments.filter(a => a.estimatedCoord).length, done: 0, success: 0, failed: 0, startedAt: new Date().toISOString(), finishedAt: null, error: null };
  console.log(`[geocode] start: ${geocodeState.total} missing`);
  try {
    for (let i = 0; i < apartments.length && geocodeState.done < limit; i++) {
      if (!apartments[i].estimatedCoord) continue;
      try {
        const coord = await geocodeOne(apartments[i]);
        if (coord) {
          apartments[i] = { ...apartments[i], ...coord, estimatedCoord: false, geocodeStatus: 'ok' };
          geocodeState.success++;
        } else {
          apartments[i] = { ...apartments[i], geocodeStatus: 'not_found' };
          geocodeState.failed++;
        }
      } catch (e) {
        apartments[i] = { ...apartments[i], geocodeStatus: 'error' };
        geocodeState.failed++;
      }
      geocodeState.done++;
      if (geocodeState.done % 100 === 0) {
        fs.writeFileSync(GEO_PATH, JSON.stringify(apartments.map(({estimatedCoord,displayAddress,age,gangnamScore,isLarge,...rest}) => rest), null, 0));
        console.log(`[geocode] ${geocodeState.done}/${geocodeState.total} success=${geocodeState.success} failed=${geocodeState.failed}`);
      }
      await new Promise(r => setTimeout(r, 80));
    }
    fs.writeFileSync(GEO_PATH, JSON.stringify(apartments.map(({estimatedCoord,displayAddress,age,gangnamScore,isLarge,...rest}) => rest), null, 0));
  } catch (e) {
    geocodeState.error = e.message;
  } finally {
    geocodeState.running = false;
    geocodeState.finishedAt = new Date().toISOString();
    console.log(`[geocode] finished success=${geocodeState.success}, failed=${geocodeState.failed}`);
  }
  return geocodeState;
}

loadApartments();

app.get('/api/config', (req, res) => res.json({ kakaoJsKey: KAKAO_JS_KEY }));
app.get('/api/status', (req, res) => {
  const real = apartments.filter(hasRealCoord).length;
  res.json({ count: apartments.length, realCoords: real, estimatedCoords: apartments.length - real, hasKakaoRestKey: !!KAKAO_REST_KEY, hasKakaoJsKey: !!KAKAO_JS_KEY, geocode: geocodeState });
});
app.get('/api/diagnostics', (req, res) => {
  res.json(diagnosticsSummary());
});
app.post('/api/geocode/start', (req, res) => {
  geocodeMissing(Number(req.body?.limit || 999999));
  res.json({ ok: true, message: '좌표 생성 작업을 시작했습니다.', geocode: geocodeState });
});
app.get('/api/apartments', (req, res) => {
  const q = normalizeText(req.query.q || '');
  const sido = req.query.sido || '';
  const sigungu = req.query.sigungu || '';
  const minHouseholds = Number(req.query.minHouseholds || 0);
  const maxAge = Number(req.query.maxAge || 0);
  const limit = Math.min(Number(req.query.limit || 9000), 9000);
  let data = apartments;
  if (sido) data = data.filter(a => a.sido === sido);
  if (sigungu) data = data.filter(a => a.sigungu === sigungu);
  if (minHouseholds) data = data.filter(a => (a.households || 0) >= minHouseholds);
  if (maxAge) data = data.filter(a => { const age = yearsOld(a.approvedDate); return age != null && age <= maxAge; });
  if (q) data = data.filter(a => normalizeText(`${a.name} ${a.sido} ${a.sigungu} ${a.dong} ${a.roadAddress} ${a.jibunAddress}`).includes(q));
  const result = data.slice(0, limit).map(aptSummary);
  res.json({ count: data.length, returned: result.length, apartments: result });
});
app.get('/api/areas', (req, res) => {
  const areas = {};
  for (const a of apartments) {
    if (!areas[a.sido]) areas[a.sido] = new Set();
    if (a.sigungu) areas[a.sido].add(a.sigungu);
  }
  res.json(Object.fromEntries(Object.entries(areas).map(([k,v]) => [k, [...v].sort()])));
});
app.get('/api/apartments/:id', (req, res) => {
  const a = apartments.find(x => x.id === req.params.id || x.complexCode === req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(aptSummary(a));
});
app.get('/api/similar/:id', (req, res) => {
  const target = apartments.find(x => x.id === req.params.id || x.complexCode === req.params.id);
  if (!target) return res.status(404).json({ error: 'not found' });
  const result = apartments.filter(a => a.id !== target.id).map(a => ({ ...aptSummary(a), similarScore: similarityScore(target, a) })).sort((a,b) => b.similarScore - a.similarScore).slice(0, Number(req.query.limit || 12));
  res.json({ target: aptSummary(target), similar: result });
});
app.get('/api/compare', (req, res) => {
  const a = apartments.find(x => x.id === req.query.a);
  const b = apartments.find(x => x.id === req.query.b);
  if (!a || !b) return res.status(400).json({ error: '비교할 단지 2개를 선택해주세요.' });
  res.json({ a: aptSummary(a), b: aptSummary(b), score: { a: Math.round(gangnamScore(a) + Math.min((a.households||0)/100, 25) - Math.max((yearsOld(a.approvedDate)||20)*0.3,0)), b: Math.round(gangnamScore(b) + Math.min((b.households||0)/100, 25) - Math.max((yearsOld(b.approvedDate)||20)*0.3,0)) } });
});

app.listen(PORT, () => console.log(`DanjiLab DB platform running on :${PORT}`));
