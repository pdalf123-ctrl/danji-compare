const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = '323236440145e1410e54b159179e1bfbb24b98fafd58a57d0047a9b4c12dadf8';
const KAKAO_REST_KEY = 'e83f712252e8ffb368b9db36be90f89f';
const TRADE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const RENT_URL  = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent';

const cache = {};
const CACHE_TTL = 1000 * 60 * 60 * 24;
function isCacheValid(key) { return cache[key] && (Date.now() - cache[key].timestamp < CACHE_TTL); }

function toAmt(str) {
  if (!str && str !== 0) return 0;
  return parseInt(String(str).replace(/,/g, '').replace(/\s/g, '')) || 0;
}

async function fetchItems(url, LAWD_CD, DEAL_YMD) {
  const fullUrl = `${url}?serviceKey=${API_KEY}&numOfRows=1000&pageNo=1&_type=json&LAWD_CD=${LAWD_CD}&DEAL_YMD=${DEAL_YMD}`;
  const res = await axios.get(fullUrl);
  const body = res.data?.response?.body;
  if (!body) return [];
  const items = body.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

// 서울 25개 구 법정동 코드 + 중심 좌표
const GU_LIST = [
  {name:'강남구', lawdCd:'11680', lat:37.5172, lng:127.0473},
  {name:'강동구', lawdCd:'11740', lat:37.5301, lng:127.1238},
  {name:'강북구', lawdCd:'11305', lat:37.6396, lng:127.0257},
  {name:'강서구', lawdCd:'11500', lat:37.5509, lng:126.8495},
  {name:'관악구', lawdCd:'11620', lat:37.4784, lng:126.9516},
  {name:'광진구', lawdCd:'11215', lat:37.5385, lng:127.0823},
  {name:'구로구', lawdCd:'11530', lat:37.4954, lng:126.8875},
  {name:'금천구', lawdCd:'11545', lat:37.4569, lng:126.8956},
  {name:'노원구', lawdCd:'11350', lat:37.6541, lng:127.0568},
  {name:'도봉구', lawdCd:'11320', lat:37.6688, lng:127.0471},
  {name:'동대문구',lawdCd:'11230', lat:37.5744, lng:127.0397},
  {name:'동작구', lawdCd:'11590', lat:37.5124, lng:126.9393},
  {name:'마포구', lawdCd:'11440', lat:37.5663, lng:126.9014},
  {name:'서대문구',lawdCd:'11410', lat:37.5791, lng:126.9368},
  {name:'서초구', lawdCd:'11650', lat:37.4837, lng:127.0324},
  {name:'성동구', lawdCd:'11200', lat:37.5634, lng:127.0360},
  {name:'성북구', lawdCd:'11290', lat:37.5894, lng:127.0167},
  {name:'송파구', lawdCd:'11710', lat:37.5145, lng:127.1059},
  {name:'양천구', lawdCd:'11470', lat:37.5170, lng:126.8666},
  {name:'영등포구',lawdCd:'11560', lat:37.5264, lng:126.8962},
  {name:'용산구', lawdCd:'11170', lat:37.5384, lng:126.9654},
  {name:'은평구', lawdCd:'11380', lat:37.6027, lng:126.9291},
  {name:'종로구', lawdCd:'11110', lat:37.5726, lng:126.9788},
  {name:'중구',   lawdCd:'11140', lat:37.5636, lng:126.9976},
  {name:'중랑구', lawdCd:'11260', lat:37.5953, lng:127.0939},
];

// 강남 접근성 점수 (강남구청 기준 거리)
const GANGNAM_ACCESS = {
  '강남구':10,'서초구':9,'송파구':8,'강동구':6,'성동구':7,
  '광진구':6,'용산구':7,'동작구':6,'영등포구':5,'마포구':5,
  '양천구':4,'강서구':3,'구로구':4,'금천구':3,'관악구':5,
  '동대문구':5,'중구':6,'종로구':6,'성북구':4,'강북구':3,
  '도봉구':2,'노원구':3,'중랑구':4,'서대문구':4,'은평구':3,
};

// 카카오 장소 검색으로 아파트 단지 수집
async function fetchApartmentsFromKakao(gu) {
  const apts = [];
  const seen = new Set();
  // 페이지별로 검색 (최대 5페이지 = 45개)
  for (let page = 1; page <= 5; page++) {
    try {
      const res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
        headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
        params: {
          query: `${gu.name} 아파트`,
          category_group_code: 'SW8',
          x: gu.lng, y: gu.lat,
          radius: 5000,
          size: 15,
          page,
          sort: 'accuracy'
        }
      });
      const items = res.data.documents || [];
      if (items.length === 0) break;
      items.forEach(item => {
        const name = item.place_name.replace(/\s*아파트\s*$/, '').trim();
        if (seen.has(name)) return;
        seen.add(name);
        // 아파트 키워드 필터
        if (!item.place_name.includes('아파트') && !item.place_name.includes('타워') && 
            !item.place_name.includes('파크') && !item.place_name.includes('힐스테이트') &&
            !item.place_name.includes('래미안') && !item.place_name.includes('자이') &&
            !item.place_name.includes('푸르지오') && !item.place_name.includes('e편한')) return;
        apts.push({
          id: `${gu.lawdCd}_${name}`,
          name,
          gu: gu.name,
          dong: item.address_name.split(' ').slice(2).join(' ') || '',
          lawdCd: gu.lawdCd,
          lat: parseFloat(item.y),
          lng: parseFloat(item.x),
          address: item.address_name,
          gangnamScore: GANGNAM_ACCESS[gu.name] || 5,
          // 기본값 (실거래가 조회 후 업데이트)
          세대수: 0, 준공: 0, 특징: '', 대단지: false,
          역: '', 초: '', 점수: GANGNAM_ACCESS[gu.name] * 5 || 50,
        });
      });
      if (res.data.meta?.is_end) break;
    } catch(e) { break; }
  }
  return apts;
}

// 전체 서울 아파트 DB 구축 (서버 시작 시 1회)
let apartmentDB = [];
let dbBuilding = false;

async function buildApartmentDB() {
  if (dbBuilding) return;
  dbBuilding = true;
  console.log('아파트 DB 구축 시작...');
  
  // 기본 DB 먼저 로드
  try {
    const base = require('./apartments');
    apartmentDB = [...base];
    console.log(`기본 DB: ${apartmentDB.length}개`);
  } catch(e) {
    apartmentDB = [];
  }

  // 카카오 API로 추가 수집
  for (const gu of GU_LIST) {
    try {
      const apts = await fetchApartmentsFromKakao(gu);
      // 기존 DB에 없는 것만 추가
      const existingNames = new Set(apartmentDB.map(a => a.name));
      const newApts = apts.filter(a => !existingNames.has(a.name));
      apartmentDB = [...apartmentDB, ...newApts];
      console.log(`${gu.name} +${newApts.length}개 추가 (총 ${apartmentDB.length}개)`);
      await new Promise(r => setTimeout(r, 200)); // API 과부하 방지
    } catch(e) {
      console.log(`${gu.name} 수집 실패:`, e.message);
    }
  }
  
  console.log(`아파트 DB 구축 완료: 총 ${apartmentDB.length}개`);
  dbBuilding = false;
}

// 동일 컨디션 유사 단지 찾기
function findSimilarApts(targetApt, targetPrice, count = 8) {
  return apartmentDB
    .filter(a => a.id !== targetApt.id)
    .map(a => {
      let score = 0;
      // 강남 접근성 유사도
      const gangnamDiff = Math.abs((a.gangnamScore||5) - (targetApt.gangnamScore||5));
      score += (10 - gangnamDiff) * 3;
      // 초품아 동일
      const aSchool = (a.초||'').includes('초품아') || (a.특징||'').includes('초품아');
      const tSchool = (targetApt.초||'').includes('초품아') || (targetApt.특징||'').includes('초품아');
      if (aSchool === tSchool) score += 20;
      // 역세권 동일
      const aSubway = a.역 && parseInt(a.역) <= 5;
      const tSubway = targetApt.역 && parseInt(targetApt.역) <= 5;
      if (aSubway === tSubway) score += 15;
      // 대단지 동일
      if (a.대단지 === targetApt.대단지) score += 10;
      // 같은 구 가중치
      if (a.gu === targetApt.gu) score += 5;
      // 가격 유사도 (있을 경우)
      if (a.latestPrice && targetPrice) {
        const priceDiff = Math.abs(a.latestPrice - targetPrice) / targetPrice;
        if (priceDiff < 0.2) score += 20;
        else if (priceDiff < 0.4) score += 10;
      }
      return { ...a, similarScore: score };
    })
    .sort((a, b) => b.similarScore - a.similarScore)
    .slice(0, count);
}

// API 라우트들

app.get('/api/apartments', (req, res) => {
  res.json(apartmentDB);
});

app.get('/api/similar', async (req, res) => {
  try {
    const { aptId, price } = req.query;
    const target = apartmentDB.find(a => a.id === aptId);
    if (!target) return res.json([]);
    const similar = findSimilarApts(target, parseInt(price) || 0);
    // 유사 단지들의 최근 실거래가 조회
    const result = await Promise.all(similar.map(async apt => {
      try {
        const now = new Date();
        for (let i = 0; i < 2; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const ym = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`;
          const key = `trade_${apt.lawdCd}_${ym}`;
          let items;
          if (isCacheValid(key)) { items = cache[key].data; }
          else { items = await fetchItems(TRADE_URL, apt.lawdCd, ym); cache[key] = { data: items, timestamp: Date.now() }; }
          const found = items.filter(d => (d.aptNm||'').includes(apt.name.slice(0,4)));
          if (found.length > 0) {
            const prices = found.map(d => toAmt(d.dealAmount)).filter(v => v > 0);
            const avg = prices.length ? Math.round(prices.reduce((a,b)=>a+b,0)/prices.length) : 0;
            return { ...apt, latestPrice: avg, priceCount: found.length };
          }
        }
        return apt;
      } catch(e) { return apt; }
    }));
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/apt-price', async (req, res) => {
  try {
    const { lawdCd, aptNm } = req.query;
    let found = [];
    const now = new Date();
    for (let i = 0; i < 3 && found.length === 0; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`;
      const key = `trade_${lawdCd}_${ym}`;
      let items;
      if (isCacheValid(key)) { items = cache[key].data; }
      else { items = await fetchItems(TRADE_URL, lawdCd, ym); cache[key] = { data: items, timestamp: Date.now() }; }
      found = items.filter(d => (d.aptNm||'').includes(String(aptNm).slice(0,4)));
    }
    found.sort((a,b) => parseInt(b.dealDay||0) - parseInt(a.dealDay||0));
    const prices = found.map(d => toAmt(d.dealAmount)).filter(v => v > 0);
    const avg = prices.length ? Math.round(prices.reduce((a,b)=>a+b,0)/prices.length) : 0;
    const latest = found[0];
    // DB 업데이트
    const dbApt = apartmentDB.find(a => a.lawdCd === lawdCd && a.name.includes(String(aptNm).slice(0,4)));
    if (dbApt && avg) dbApt.latestPrice = avg;
    res.json({
      avg, latest: latest ? toAmt(latest.dealAmount) : 0,
      latestDate: latest ? `${latest.dealYear}.${String(latest.dealMonth).padStart(2,'0')}.${String(latest.dealDay).padStart(2,'0')}` : '',
      count: found.length, trades: found.slice(0, 10)
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/trade', async (req, res) => {
  try {
    const { LAWD_CD, DEAL_YMD } = req.query;
    const key = `trade_${LAWD_CD}_${DEAL_YMD}`;
    if (!isCacheValid(key)) {
      const items = await fetchItems(TRADE_URL, LAWD_CD, DEAL_YMD);
      cache[key] = { data: items, timestamp: Date.now() };
    }
    res.json(cache[key].data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/rent', async (req, res) => {
  try {
    const { LAWD_CD, DEAL_YMD } = req.query;
    const key = `rent_${LAWD_CD}_${DEAL_YMD}`;
    if (!isCacheValid(key)) {
      const items = await fetchItems(RENT_URL, LAWD_CD, DEAL_YMD);
      cache[key] = { data: items, timestamp: Date.now() };
    }
    res.json(cache[key].data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const key = 'dashboard';
    if (isCacheValid(key)) return res.json(cache[key].data);
    console.log('대시보드 API 호출 시작...');
    const guList = ['11710','11680','11650'];
    const months = [];
    for (let y=2023;y<=2026;y++) for (let m=1;m<=12;m++) {
      if(y===2023&&m<5) continue; if(y===2026&&m>5) break;
      months.push(`${y}${String(m).padStart(2,'0')}`);
    }
    const tradeByMonth={},jeonByMonth={},wolByMonth={};
    let latestTrades=[];
    for (const ym of months) {
      let tAmts=[],jAmts=[],wAmts=[];
      for (const gu of guList) {
        try {
          const tItems=await fetchItems(TRADE_URL,gu,ym);
          tItems.forEach(d=>{const v=toAmt(d.dealAmount);if(v>1000){tAmts.push(v);if(ym>='202604')latestTrades.push({...d,ym});}});
        } catch(e){}
        try {
          const rItems=await fetchItems(RENT_URL,gu,ym);
          rItems.forEach(d=>{const dep=toAmt(d.deposit),wol=toAmt(d.monthlyRent);
            if(!wol||wol===0){if(dep>1000)jAmts.push(dep);}else{if(wol>0)wAmts.push(wol);}});
        } catch(e){}
      }
      if(tAmts.length)tradeByMonth[ym]=Math.round(tAmts.reduce((a,b)=>a+b,0)/tAmts.length);
      if(jAmts.length)jeonByMonth[ym]=Math.round(jAmts.reduce((a,b)=>a+b,0)/jAmts.length);
      if(wAmts.length)wolByMonth[ym]=Math.round(wAmts.reduce((a,b)=>a+b,0)/wAmts.length);
      console.log(`${ym} 완료`);
    }
    latestTrades.sort((a,b)=>parseInt(b.dealDay||0)-parseInt(a.dealDay||0));
    const allPrices=latestTrades.map(d=>toAmt(d.dealAmount)).filter(v=>v>0);
    const avgPrice=allPrices.reduce((a,b)=>a+b,0)/(allPrices.length||1);
    const result={
      metrics:{jeonAvg:jeonByMonth[months[months.length-1]]||0,wolAvg:wolByMonth[months[months.length-1]]||0,tradeCount:latestTrades.length,specialCount:allPrices.filter(p=>p<avgPrice*0.8).length,jeonChg:0},
      charts:{tradeByMonth,jeonByMonth,wolByMonth,months},
      feed:latestTrades.filter(d=>toAmt(d.dealAmount)>=avgPrice*0.8).slice(0,10)
    };
    cache[key]={data:result,timestamp:Date.now()};
    console.log('대시보드 캐싱 완료!');
    res.json(result);
  } catch(e) { res.status(500).json({error:e.message}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행중: 포트 ${PORT}`);
  // 아파트 DB 구축 (백그라운드)
  setTimeout(buildApartmentDB, 3000);
  // 대시보드 사전 로딩
  setTimeout(() => {
    axios.get(`http://localhost:${PORT}/api/dashboard`)
      .then(() => console.log('대시보드 사전 로딩 완료!'))
      .catch(e => console.log('사전 로딩 실패:', e.message));
  }, 8000);
});
