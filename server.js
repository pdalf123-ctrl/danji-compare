const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = '323236440145e1410e54b159179e1bfbb24b98fafd58a57d0047a9b4c12dadf8';
const TRADE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const RENT_URL  = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent';

const cache = {};
const CACHE_TTL = 1000 * 60 * 60 * 24;

function isCacheValid(key) {
  return cache[key] && (Date.now() - cache[key].timestamp < CACHE_TTL);
}

function toAmt(str) {
  if (!str && str !== 0) return 0;
  return parseInt(String(str).replace(/,/g, '').replace(/\s/g, '')) || 0;
}

async function fetchItems(url, LAWD_CD, DEAL_YMD) {
  // URL에 직접 _type=json 포함해서 호출
  const fullUrl = `${url}?serviceKey=${API_KEY}&numOfRows=1000&pageNo=1&_type=json&LAWD_CD=${LAWD_CD}&DEAL_YMD=${DEAL_YMD}`;
  const res = await axios.get(fullUrl);
  const data = res.data;
  
  // 응답 구조 확인
  if (typeof data === 'string') {
    console.log('문자열 응답:', data.substring(0, 100));
    return [];
  }
  
  const body = data?.response?.body;
  if (!body) {
    console.log('body 없음:', JSON.stringify(data).substring(0, 200));
    return [];
  }
  
  const items = body.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

// 매매 API
app.get('/api/trade', async (req, res) => {
  try {
    const { LAWD_CD, DEAL_YMD } = req.query;
    const key = `trade_${LAWD_CD}_${DEAL_YMD}`;
    if (!isCacheValid(key)) {
      const items = await fetchItems(TRADE_URL, LAWD_CD, DEAL_YMD);
      cache[key] = { data: items, timestamp: Date.now() };
    }
    res.json(cache[key].data);
  } catch (e) {
    console.error('매매 오류:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// 전월세 API
app.get('/api/rent', async (req, res) => {
  try {
    const { LAWD_CD, DEAL_YMD } = req.query;
    const key = `rent_${LAWD_CD}_${DEAL_YMD}`;
    if (!isCacheValid(key)) {
      const items = await fetchItems(RENT_URL, LAWD_CD, DEAL_YMD);
      cache[key] = { data: items, timestamp: Date.now() };
    }
    res.json(cache[key].data);
  } catch (e) {
    console.error('전월세 오류:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// 대시보드 API
app.get('/api/dashboard', async (req, res) => {
  try {
    const key = 'dashboard';
    if (isCacheValid(key)) {
      console.log('캐시에서 대시보드 반환');
      return res.json(cache[key].data);
    }

    console.log('국토부 API 호출 시작...');
    const guList = ['11710', '11680', '11650'];
    const months = [];
    for (let y = 2023; y <= 2026; y++) {
      for (let m = 1; m <= 12; m++) {
        if (y === 2023 && m < 5) continue;
        if (y === 2026 && m > 5) break;
        months.push(`${y}${String(m).padStart(2, '0')}`);
      }
    }

    const tradeByMonth = {}, jeonByMonth = {}, wolByMonth = {};
    let latestTrades = [];

    for (const ym of months) {
      let tAmts = [], jAmts = [], wAmts = [];
      for (const gu of guList) {
        try {
          const tItems = await fetchItems(TRADE_URL, gu, ym);
          console.log(`  ${ym} ${gu} 매매 ${tItems.length}건`);
          tItems.forEach(d => {
            const v = toAmt(d.dealAmount);
            if (v > 1000) {
              tAmts.push(v);
              if (ym >= '202604') latestTrades.push({ ...d, ym });
            }
          });
        } catch(e) { console.log(`매매 오류 ${ym} ${gu}:`, e.message); }

        try {
          const rItems = await fetchItems(RENT_URL, gu, ym);
          rItems.forEach(d => {
            const dep = toAmt(d.deposit);
            const wol = toAmt(d.monthlyRent);
            if (!wol || wol === 0) {
              if (dep > 1000) jAmts.push(dep);
            } else {
              if (wol > 0) wAmts.push(wol);
            }
          });
        } catch(e) { console.log(`전월세 오류 ${ym} ${gu}:`, e.message); }
      }

      if (tAmts.length) tradeByMonth[ym] = Math.round(tAmts.reduce((a,b)=>a+b,0)/tAmts.length);
      if (jAmts.length) jeonByMonth[ym]  = Math.round(jAmts.reduce((a,b)=>a+b,0)/jAmts.length);
      if (wAmts.length) wolByMonth[ym]   = Math.round(wAmts.reduce((a,b)=>a+b,0)/wAmts.length);
      console.log(`${ym} 완료 - 매매:${tradeByMonth[ym]||0}만 전세:${jeonByMonth[ym]||0}만 월세:${wolByMonth[ym]||0}만`);
    }

    latestTrades.sort((a,b) => parseInt(b.dealDay||0) - parseInt(a.dealDay||0));
    const allPrices = latestTrades.map(d=>toAmt(d.dealAmount)).filter(v=>v>0);
    const avgPrice = allPrices.reduce((a,b)=>a+b,0) / (allPrices.length||1);
    const specialCount = allPrices.filter(p=>p<avgPrice*0.8).length;
    const feed = latestTrades.filter(d=>toAmt(d.dealAmount)>=avgPrice*0.8).slice(0,10);

    const latestYm = months[months.length-1];
    const prevYm   = months[months.length-2];
    const jeonAvg  = jeonByMonth[latestYm]||0;
    const wolAvg   = wolByMonth[latestYm]||0;
    const jeonChg  = jeonByMonth[prevYm] ? Math.round((jeonAvg-jeonByMonth[prevYm])/jeonByMonth[prevYm]*1000)/10 : 0;

    const result = {
      metrics: { jeonAvg, wolAvg, tradeCount: latestTrades.length, specialCount, jeonChg },
      charts:  { tradeByMonth, jeonByMonth, wolByMonth, months },
      feed
    };

    cache[key] = { data: result, timestamp: Date.now() };
    console.log('대시보드 캐싱 완료!');
    res.json(result);
  } catch (e) {
    console.error('대시보드 오류:', e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행중: 포트 ${PORT}`);
  setTimeout(() => {
    axios.get(`http://localhost:${PORT}/api/dashboard`)
      .then(() => console.log('사전 로딩 완료!'))
      .catch(e => console.log('사전 로딩 실패:', e.message));
  }, 5000);
});
