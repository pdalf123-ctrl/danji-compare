const fs = require('fs');
const path = require('path');
const axios = require('axios');
const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY;
if (!KAKAO_REST_KEY) { console.error('KAKAO_REST_KEY 환경변수가 필요합니다.'); process.exit(1); }
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_PATH = path.join(DATA_DIR, 'apartments.json');
const OUT_PATH = path.join(DATA_DIR, 'apartments.geocoded.json');
let apartments = fs.existsSync(OUT_PATH) ? JSON.parse(fs.readFileSync(OUT_PATH,'utf8')) : JSON.parse(fs.readFileSync(RAW_PATH,'utf8'));
async function geocode(query){
  const res = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', { headers:{Authorization:`KakaoAK ${KAKAO_REST_KEY}`}, params:{query,size:1}, timeout:7000 });
  const d = res.data?.documents?.[0];
  return d ? { lat:Number(d.y), lng:Number(d.x) } : null;
}
(async()=>{
  let done=0, ok=0, fail=0;
  for (const a of apartments) {
    if (a.lat && a.lng) continue;
    const q = a.roadAddress || a.jibunAddress;
    if (!q) { fail++; continue; }
    try { const c = await geocode(q); if (c) { a.lat=c.lat; a.lng=c.lng; a.geocodeStatus='ok'; ok++; } else { a.geocodeStatus='not_found'; fail++; } }
    catch(e){ a.geocodeStatus='error'; fail++; }
    done++;
    if (done % 100 === 0) { fs.writeFileSync(OUT_PATH, JSON.stringify(apartments)); console.log(`geocode ${done} ok=${ok} fail=${fail}`); }
    await new Promise(r=>setTimeout(r,80));
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(apartments));
  console.log(`finished ok=${ok} fail=${fail}`);
})();
