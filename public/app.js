let map, clusterer, allApts = [], selectedA = null, selectedB = null, areas = {};
const markerMap = new Map();
const clusterMarkers = [];
const $ = (id) => document.getElementById(id);
const fmt = (n) => n == null ? '-' : Number(n).toLocaleString('ko-KR');
const currentFilters = { chip: null };

function shortName(name) {
  const cleaned = String(name || '')
    .replace(/아파트|주상복합|공동주택|단지/g, '')
    .replace(/[\s()[\]{}]/g, '')
    .trim();
  return Array.from(cleaned || name || '').slice(0, 10).join('');
}

async function api(url, opt) {
  const r = await fetch(url, opt);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function boot() {
  await loadKakaoMap();
  initMap();
  bindEvents();
  areas = await api('/api/areas');
  fillAreas();
  await refreshStatus();
  await loadApartments();
}

async function loadKakaoMap() {
  const cfg = await api('/api/config');
  if (!cfg.kakaoJsKey) throw new Error('KAKAO_JS_KEY 환경변수가 없습니다.');
  await new Promise((resolve, reject) => {
    if (window.kakao?.maps) return resolve();
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${cfg.kakaoJsKey}&autoload=false&libraries=services,clusterer`;
    s.onload = () => kakao.maps.load(resolve);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function initMap() {
  map = new kakao.maps.Map($('map'), { center: new kakao.maps.LatLng(37.49, 126.99), level: 10 });
  map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
  clusterer = new kakao.maps.MarkerClusterer({
    map,
    averageCenter: true,
    minLevel: 7,
    disableClickZoom: false,
    gridSize: 70,
    calculator: [20, 80, 200],
    styles: [
      clusterStyle('42px', '#e7c463', '#111827'),
      clusterStyle('52px', '#3b82f6', '#fff'),
      clusterStyle('64px', '#111827', '#fff'),
      clusterStyle('78px', '#19b56b', '#fff')
    ]
  });
  kakao.maps.event.addListener(map, 'idle', updateMarkerVisibility);
}

function clusterStyle(size, bg, color) {
  return {
    width: size,
    height: size,
    background: bg,
    border: '3px solid #fff',
    borderRadius: '50%',
    color,
    textAlign: 'center',
    fontWeight: '900',
    lineHeight: `calc(${size} - 6px)`,
    boxShadow: '0 10px 28px rgba(0,0,0,.28)'
  };
}

function bindEvents() {
  $('apply').onclick = () => loadApartments();
  $('q').addEventListener('keydown', e => { if (e.key === 'Enter') loadApartments(); });
  $('sido').onchange = () => fillSigungu();
  document.querySelectorAll('[data-chip]').forEach(btn => btn.onclick = () => {
    document.querySelectorAll('[data-chip]').forEach(b => b.classList.remove('active'));
    if (currentFilters.chip === btn.dataset.chip) currentFilters.chip = null;
    else { currentFilters.chip = btn.dataset.chip; btn.classList.add('active'); }
    loadApartments();
  });
  $('closeDetail').onclick = closeDetail;
  $('compareOpen').onclick = openCompare;
  $('closeCompare').onclick = () => $('compareModal').classList.remove('open');
  $('runCompare').onclick = runCompare;
  $('geocodeBtn').onclick = async () => {
    if (!confirm('카카오 주소검색으로 실제 좌표를 생성합니다. 8,800개라 시간이 걸릴 수 있어요. 시작할까요?')) return;
    await api('/api/geocode/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) });
    alert('좌표 생성이 시작되었습니다. Render Logs 또는 /api/status에서 진행상황을 볼 수 있어요.');
  };
}

function closeDetail() {
  $('detail').className = 'detail empty';
  $('detail').innerHTML = '<button class="close" id="closeDetail">×</button><div class="emptyText">지도나 목록에서 단지를 선택하면<br/>상세정보와 유사 단지를 보여드립니다.</div>';
  $('closeDetail').onclick = closeDetail;
}

function fillAreas() {
  const sido = $('sido');
  sido.innerHTML = '<option value="">수도권 전체</option>' + Object.keys(areas).map(s => `<option>${s}</option>`).join('');
  fillSigungu();
}

function fillSigungu() {
  const s = $('sido').value;
  $('sigungu').innerHTML = '<option value="">전체 시군구</option>' + (areas[s] || []).map(g => `<option>${g}</option>`).join('');
}

async function refreshStatus() {
  const st = await api('/api/status');
  $('statTotal').textContent = fmt(st.count);
  $('statCoord').textContent = st.realCoords > 0 ? `${fmt(st.realCoords)} 실제` : '임시좌표';
  return st;
}

function buildQuery() {
  const p = new URLSearchParams();
  const q = $('q').value.trim(); if (q) p.set('q', q);
  const sido = $('sido').value; if (sido) p.set('sido', sido);
  const sigungu = $('sigungu').value; if (sigungu) p.set('sigungu', sigungu);
  if (currentFilters.chip === 'large') p.set('minHouseholds', 1000);
  if (currentFilters.chip === 'new') p.set('maxAge', 10);
  if (currentFilters.chip === 'seoul') p.set('sido', '서울특별시');
  p.set('limit', 9000);
  return p.toString();
}

async function loadApartments() {
  const data = await api('/api/apartments?' + buildQuery());
  allApts = data.apartments.filter(hasCoord);
  $('resultCount').textContent = `${fmt(data.count)}개`;
  renderList(data.apartments.slice(0, 80));
  renderMarkers(allApts);
  fillCompareSelects();
}

function hasCoord(a) {
  return Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lng));
}

function renderList(list) {
  $('list').innerHTML = list.map(a => `
    <article class="item" onclick="selectApt('${a.id}')">
      <strong>${a.name}</strong>
      <p>${a.displayAddress}</p>
      <div class="badges">
        <span class="badge gold">${fmt(a.households)}세대</span>
        <span class="badge blue">${a.approvedDate ? a.approvedDate.slice(0,4)+'년' : '준공정보 없음'}</span>
        ${a.estimatedCoord ? '<span class="badge red">임시좌표</span>' : ''}
      </div>
    </article>`).join('') || '<div class="emptyText">검색 결과가 없습니다.</div>';
}

function transparentMarkerImage() {
  const src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  return new kakao.maps.MarkerImage(src, new kakao.maps.Size(1, 1), { offset: new kakao.maps.Point(0, 0) });
}

function renderMarkers(apts) {
  markerMap.forEach(({ overlay }) => overlay.setMap(null));
  markerMap.clear();
  clusterer.clear();
  clusterMarkers.length = 0;

  const bounds = new kakao.maps.LatLngBounds();
  const markerImage = transparentMarkerImage();

  apts.forEach(a => {
    const pos = new kakao.maps.LatLng(Number(a.lat), Number(a.lng));
    const clusterMarker = new kakao.maps.Marker({ position: pos, image: markerImage, clickable: true });
    kakao.maps.event.addListener(clusterMarker, 'click', () => selectApt(a.id));
    clusterMarkers.push(clusterMarker);

    const el = document.createElement('div');
    el.className = `marker ${a.isLarge ? 'large' : ''} ${(a.age || 99) <= 10 ? 'new' : ''} ${a.estimatedCoord ? 'est' : ''}`;
    el.textContent = shortName(a.name);
    el.title = a.name;
    el.onclick = (e) => { e.stopPropagation(); selectApt(a.id); };

    const overlay = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1 });
    markerMap.set(a.id, { overlay, pos });
    bounds.extend(pos);
  });

  clusterer.addMarkers(clusterMarkers);
  if (apts.length) map.setBounds(bounds, 40, 40, 40, 380);
  updateMarkerVisibility();
}

function updateMarkerVisibility() {
  if (!map || !markerMap.size) return;
  const showLabels = map.getLevel() <= 6;
  const bounds = map.getBounds();
  markerMap.forEach(({ overlay, pos }) => {
    overlay.setMap(showLabels && bounds.contain(pos) ? map : null);
  });
}

async function selectApt(id) {
  const a = await api('/api/apartments/' + encodeURIComponent(id));
  selectedA = selectedA || a;
  if (hasCoord(a)) map.panTo(new kakao.maps.LatLng(Number(a.lat), Number(a.lng)));
  const sim = await api('/api/similar/' + encodeURIComponent(id) + '?limit=10');
  renderDetail(a, sim.similar);
}

function renderDetail(a, similar) {
  $('detail').className = 'detail';
  $('detail').innerHTML = `
    <button class="close" id="closeDetail">×</button>
    <h2>${a.name}</h2>
    <div class="addr">${a.displayAddress}</div>
    <div class="badges">
      <span class="badge gold">${a.sido} ${a.sigungu}</span>
      ${a.estimatedCoord ? '<span class="badge red">현재 임시좌표</span>' : '<span class="badge blue">실제좌표</span>'}
    </div>
    <div class="grid">
      <div class="metric"><label>세대수</label><strong>${fmt(a.households)}세대</strong></div>
      <div class="metric"><label>준공</label><strong>${a.approvedDate || '-'}</strong></div>
      <div class="metric"><label>동수</label><strong>${fmt(a.dongCount)}동</strong></div>
      <div class="metric"><label>강남접근성</label><strong>${a.gangnamScore}점</strong></div>
      <div class="metric"><label>난방</label><strong>${a.heating || '-'}</strong></div>
      <div class="metric"><label>관리</label><strong>${a.managementType || '-'}</strong></div>
    </div>
    <div class="detailActions">
      <button class="btn ghost" id="setA">A로 선택</button>
      <button class="btn gold" id="setB">B로 선택</button>
    </div>
    <section class="similar"><h3>비슷한 조건 단지</h3>
      ${similar.map(s => `<div class="simItem" onclick="selectApt('${s.id}')"><div><b>${s.name}</b><br/><span>${s.sido} ${s.sigungu} · ${fmt(s.households)}세대 · ${s.approvedDate ? s.approvedDate.slice(0,4)+'년' : '-'}</span></div><strong>${s.similarScore}</strong></div>`).join('')}
    </section>`;
  $('closeDetail').onclick = closeDetail;
  $('setA').onclick = () => setCompareApt('A', a);
  $('setB').onclick = () => setCompareApt('B', a);
}

function setCompareApt(slot, apt) {
  if (slot === 'A') selectedA = apt;
  else selectedB = apt;
  fillCompareSelects();
  if (selectedA && selectedB && selectedA.id !== selectedB.id) {
    openCompare();
    runCompare();
  } else {
    alert(`${apt.name}을 ${slot}로 선택했습니다.`);
  }
}

function fillCompareSelects() {
  const seen = new Map(allApts.map(a => [a.id, a]));
  if (selectedA) seen.set(selectedA.id, selectedA);
  if (selectedB) seen.set(selectedB.id, selectedB);
  const opts = [...seen.values()].map(a => `<option value="${a.id}">${a.name} (${a.sido} ${a.sigungu})</option>`).join('');
  $('cmpA').innerHTML = opts;
  $('cmpB').innerHTML = opts;
  if (selectedA) $('cmpA').value = selectedA.id;
  if (selectedB) $('cmpB').value = selectedB.id;
}

function openCompare() {
  fillCompareSelects();
  $('compareModal').classList.add('open');
}

async function runCompare() {
  const a = $('cmpA').value, b = $('cmpB').value;
  if (!a || !b || a === b) return alert('서로 다른 단지 2개를 선택해주세요.');
  const d = await api(`/api/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
  const rows = [
    ['지역', `${d.a.sido} ${d.a.sigungu}`, `${d.b.sido} ${d.b.sigungu}`],
    ['주소', d.a.displayAddress, d.b.displayAddress],
    ['세대수', `${fmt(d.a.households)}세대`, `${fmt(d.b.households)}세대`],
    ['준공', d.a.approvedDate || '-', d.b.approvedDate || '-'],
    ['동수', `${fmt(d.a.dongCount)}동`, `${fmt(d.b.dongCount)}동`],
    ['난방', d.a.heating || '-', d.b.heating || '-'],
    ['강남접근성', `${d.a.gangnamScore}점`, `${d.b.gangnamScore}점`],
    ['종합점수', `${d.score.a}점`, `${d.score.b}점`]
  ];
  $('compareResult').innerHTML = `<table class="cmpTable"><thead><tr><th>항목</th><th>${d.a.name}</th><th>${d.b.name}</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>`;
}

boot().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:30px;font-family:sans-serif"><h2>오류</h2><pre>${err.message}</pre><p>KAKAO_JS_KEY와 카카오 Web 플랫폼 도메인을 확인해주세요.</p></div>`;
});
