(function(){
  console.log('[map-marker-toolkit] v3.6.3 loaded');

  const KAKAO_JS_API_KEY   = "cdad276f68285333fba23b841fb49970";
  const KAKAO_REST_API_KEY = "50ee8d7c1eae3c3ed3314c4af1b82cb5";

  const ROWS = 500;
  const tbody = document.getElementById('tbody');
  const grid  = document.getElementById('grid');
  let pasteStart = { r:0, c:1 };

  function makeRow(index) {
    const tr = document.createElement('tr');
    const tdNo = document.createElement('td');
    tdNo.textContent = String(index);
    tdNo.dataset.col = 0;
    tr.appendChild(tdNo);
    for (let c=1; c<=4; c++) {
      const td = document.createElement('td');
      td.contentEditable = "true";
      td.dataset.col = c;
      td.addEventListener('focus', () => { pasteStart = { r:index-1, c:c }; });
      tr.appendChild(td);
    }
    return tr;
  }
  (function initGrid(){
    const frag = document.createDocumentFragment();
    for (let i=1; i<=ROWS; i++) frag.appendChild(makeRow(i));
    tbody.appendChild(frag);
    setTimeout(()=>{ if (tbody.rows[0]) tbody.rows[0].cells[1].focus(); }, 0);
  })();

  grid.addEventListener('paste', (e) => {
    const t = e.target;
    if (!(t && t.tagName==='TD' && t.isContentEditable) || t.dataset.col==="0") return;
    e.preventDefault();
    const text = (e.clipboardData && e.clipboardData.getData && e.clipboardData.getData('text/plain')) || '';
    pasteMatrix(parseMatrix(text));
  });

  function parseMatrix(text){
    let lines = (text||'').replace(/\r/g,'').split('\n');
    while (lines.length && lines[lines.length-1].trim()==='') lines.pop();
    return lines.map(line => line.split('\t'));
  }
  function pasteMatrix(matrix){
    const r0 = pasteStart.r, c0 = pasteStart.c;
    for (let i=0; i<matrix.length; i++) {
      const r = r0 + i; if (r >= ROWS) break;
      const row = matrix[i];
      for (let j=0; j<row.length && j<4; j++) {
        const c = c0 - 1 + j; if (c < 0 || c > 3) continue;
        const td = tbody.rows[r].cells[c+1]; if (td) td.textContent = row[j];
      }
    }
  }

  const SAMPLE_ADDR = [
    "서울특별시 중구 세종대로 110","서울특별시 용산구 이태원로 29","부산광역시 해운대구 우동 1418","대구광역시 중구 동성로 25",
    "인천광역시 남동구 정각로 29","광주광역시 서구 내방로 111","대전광역시 서구 둔산중로 100","울산광역시 남구 삼산로 200",
    "경기도 성남시 분당구 분당로 239","경기도 수원시 팔달구 효원로 241","강원특별자치도 춘천시 중앙로 1","충청북도 청주시 상당구 상당로 82",
    "충청남도 천안시 동남구 만남로 32","전라북도 전주시 완산구 노송광장로 10","전라남도 순천시 장명로 30","경상북도 포항시 북구 중앙로 220",
    "경상남도 창원시 의창구 중앙대로 151","제주특별자치도 제주시 문연로 6"
  ];
  const genPhone = (i) => `010-${String(2000 + (i%8000)).padStart(4,'0')}-${String(1000 + (i%9000)).padStart(4,'0')}`;

  function fillRows(data){
    for (let r=0; r<ROWS; r++) for (let c=1; c<=4; c++) tbody.rows[r].cells[c].textContent = '';
    data.forEach((row,i)=>{
      if (i>=ROWS) return;
      const [name, phone, addr, memo] = row;
      tbody.rows[i].cells[1].textContent = name || '';
      tbody.rows[i].cells[2].textContent = phone || '';
      tbody.rows[i].cells[3].textContent = addr || '';
      tbody.rows[i].cells[4].textContent = memo || '';
    });
    if (tbody.rows[0]) tbody.rows[0].cells[1].focus();
  }

  document.getElementById('test1').addEventListener('click', () => {
    fillRows(Array.from({length:5},(_,i)=>[`홍길동${i+1}`, genPhone(i+1), SAMPLE_ADDR[i%SAMPLE_ADDR.length], `비고 ${i+1}`]));
  });
  document.getElementById('test2').addEventListener('click', () => {
    fillRows(Array.from({length:20},(_,i)=>[`김철수${i+1}`, genPhone(i+1), SAMPLE_ADDR[i%SAMPLE_ADDR.length], `메모 ${i+1}`]));
  });
  document.getElementById('test3').addEventListener('click', () => {
    fillRows(Array.from({length:50},(_,i)=>[`테스트${i+1}`, genPhone(i+1), SAMPLE_ADDR[Math.floor(Math.random()*SAMPLE_ADDR.length)], Math.random()>.5?`우선 방문`:`일반`]));
  });
  document.getElementById('clearAll').addEventListener('click', ()=>fillRows([]));

  function yymmddhhmmss(){
    const d=new Date();
    const YY=String(d.getFullYear()).slice(-2);
    const MM=String(d.getMonth()+1).padStart(2,'0');
    const DD=String(d.getDate()).padStart(2,'0');
    const hh=String(d.getHours()).padStart(2,'0');
    const mm=String(d.getMinutes()).padStart(2,'0');
    const ss=String(d.getSeconds()).padStart(2,'0');
    return `${YY}${MM}${DD}_${hh}${mm}${ss}`;
  }

  async function geocodeAddress(addr){
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(addr)}`;
    const res = await fetch(url, { headers: { "Authorization": "KakaoAK " + KAKAO_REST_API_KEY } });
    if (!res.ok) throw new Error("Geocode HTTP " + res.status);
    const data = await res.json();
    const doc = data.documents && data.documents[0];
    if (!doc) return null;
    const lat = parseFloat(doc.y), lng = parseFloat(doc.x);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  }

  function escapeTitle(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function buildMapHTML({ title, jsKey, points }){
    const INLINE = `
(function(){
  const TITLE   = window.TITLE || '지도';
  const POINTS  = window.POINTS || [];
  const Mem = {};
  function safeLS(){ try{ const k='__ls_'+Math.random().toString(36).slice(2); localStorage.setItem(k,'1'); localStorage.removeItem(k); return localStorage; }catch(e){ return null; } }
  const LS = safeLS();
  const STATUS_KEY = id => \`status_\${TITLE}_\${id}\`;
  const MEMO_KEY   = id => \`memo_\${TITLE}_\${id}\`;
  async function saveStatus(id, v){ if (LS){ try{ LS.setItem(STATUS_KEY(id), v); return;}catch(e){} } Mem[STATUS_KEY(id)] = v; }
  async function loadStatus(id){ if (LS){ try{ return LS.getItem(STATUS_KEY(id)) || 'plan'; }catch(e){} } return Mem[STATUS_KEY(id)] || 'plan'; }
  async function saveMemo(id, list){ const v=JSON.stringify(list||[]); if (LS){ try{ LS.setItem(MEMO_KEY(id), v); return;}catch(e){} } Mem[MEMO_KEY(id)] = v; }
  async function loadMemo(id){ if (LS){ try{ const s=LS.getItem(MEMO_KEY(id)); return s?JSON.parse(s):[]; }catch(e){} } const s=Mem[MEMO_KEY(id)]; return s?JSON.parse(s):[]; }
  function escapeHtml(s){ return (s??'').toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function makeId(pt){ return btoa(unescape(encodeURIComponent([pt.addr,pt.name,pt.phone].join('|')))).slice(0,16); }

  const style = document.createElement('style');
  style.textContent = \`.label{position:relative;display:inline-flex;align-items:center;gap:10px;padding:8px 14px 8px 10px;border-radius:999px;cursor:pointer;user-select:none;background:rgba(255,255,255,.3);border:1px solid rgba(255,255,255,.6);box-shadow:0 8px 26px rgba(0,0,0,.18);backdrop-filter:blur(8px)}
  .label .no{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:999px;background:radial-gradient(ellipse at 30% 30%,#a1c4fd,#3b82f6 70%);color:#fff;font-weight:900;font-size:18px}
  .label .nm{font-size:15px;font-weight:700;color:#0f172a;max-width:38vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .label.hide-name .nm{display:none}
  .card{position:absolute;left:50%;transform:translateX(-50%);bottom:10px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;box-shadow:0 10px 28px rgba(0,0,0,.16);min-width:540px;max-width:90vw;z-index:99999}
  .row{display:flex;align-items:center;gap:10px;margin:6px 0;flex-wrap:wrap}
  .chip{padding:6px 10px;border-radius:999px;border:1px solid #cfd6dc;cursor:pointer;background:#f3f4f6}
  .chip.active.plan{background:#3b82f6;color:#fff;border-color:#3b82f6}
  .chip.active.done{background:#111827;color:#fff;border-color:#111827}
  .chip.active.hold{background:#9ca3af;color:#fff;border-color:#9ca3af}
  .btn{padding:8px 12px;border:1px solid #d1d5db;background:#f9fafb;border-radius:8px;cursor:pointer}
  .btn:hover{background:#f3f4f6}
  .list{max-height:120px;overflow:auto;border-top:1px dashed #e5e7eb;padding-top:6px;margin-top:6px}
  .list .item{display:flex;gap:10px;padding:4px 2px;cursor:pointer}
  .list .item:hover{background:#f9fafb}
  .list .item .no{width:40px;color:#6b7280}
  .x{position:absolute;right:8px;top:8px;width:28px;height:28px;border:1px solid #d1d5db;background:#f9fafb;border-radius:8px;cursor:pointer}
  .lt{position:absolute;left:8px;top:8px;display:flex;gap:6px;z-index:9999}
  .rt{position:absolute;right:8px;top:8px;display:flex;gap:6px;z-index:9999}
  .filter{position:absolute;left:8px;top:48px;display:flex;gap:6px;z-index:9999}
  .slide{position:absolute;left:8px;top:84px;width:320px;max-height:60vh;overflow:auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:8px;box-shadow:0 10px 28px rgba(0,0,0,.12);display:none;z-index:9999}
  .slide .row{display:flex;gap:8px;padding:6px;cursor:pointer;border-bottom:1px dashed #eee}
  .slide .row:hover{background:#f9fafb}
  .badge{padding:2px 6px;border-radius:999px;font-size:11px;border:1px solid #d1d5db}
  .badge.plan{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}
  .badge.done{background:#111827;color:#fff;border-color:#111827}
  .badge.hold{background:#f3f4f6;color:#374151;border-color:#e5e7eb}
  .modal{position:fixed;left:0;top:0;width:100vw;height:100vh;background:rgba(0,0,0,.35);display:none;align-items:center;justify-content:center;z-index:100000}
  .modal .box{background:#fff;border:1px solid #e5e7eb;border-radius:12px;min-width:560px;max-width:90vw;padding:12px;box-shadow:0 16px 40px rgba(0,0,0,.24)}\`;
  document.head.appendChild(style);

  const shell = document.createElement('div');
  shell.innerHTML = \`<div class="lt"><button id="btnList" class="btn">목록</button><button id="btnName" class="btn">이름</button><button id="btnMy" class="btn">위치</button></div>
  <div class="filter"><button data-f="all" class="btn">전체</button><button data-f="plan" class="btn">예정</button><button data-f="done" class="btn">완료</button><button data-f="hold" class="btn">보류</button></div>
  <div class="rt"></div>
  <div id="slide" class="slide"></div>
  <div id="card" class="card">
    <button id="closeCard" class="x" aria-label="닫기">×</button>
    <div class="row"><span>상태:</span><button class="chip plan" data-st="plan">예정</button><button class="chip done" data-st="done">완료</button><button class="chip hold" data-st="hold">보류</button></div>
    <div class="row"><span>정보:</span> <span id="i_basic">지점을 클릭하면 상세 정보가 표시됩니다.</span></div>
    <div class="row"><span>주소:</span> <span id="i_addr">-</span></div>
    <div class="row"><button id="btnRoute" class="btn">경로</button><button id="btnEdit" class="btn">자세히</button><button id="btnNavi" class="btn">카카오내비</button></div>
    <div class="row"><button id="btnSample" class="btn">표본</button><button id="btnSampleAll" class="btn">전체표본</button><button id="btnUnsample" class="btn">표본해제</button><button id="btnSampleXLS" class="btn">표본엑셀</button><button id="btnBest" class="btn">최적경로</button><button id="btnBestXLS" class="btn">.XLS</button></div>
    <div id="sameList" class="list"></div>
  </div>
  <div id="memoModal" class="modal" aria-hidden="true">
    <div class="box">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>상세편집</strong><button id="memoClose" class="btn">닫기</button></div>
      <div id="memoList" style="max-height:240px;overflow:auto;border:1px dashed #e5e7eb;border-radius:8px;padding:8px;margin-bottom:8px"></div>
      <div style="display:flex;gap:8px"><input id="memoInput" type="text" placeholder="새 메모를 입력하세요" style="flex:1;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px" /><button id="memoSave" class="btn">저장</button></div>
    </div>
  </div>\`;
  document.body.appendChild(shell);

  const map = new kakao.maps.Map(document.getElementById('map'), { center: new kakao.maps.LatLng(37.5665,126.9780), level:6 });
  const mapTypeControl = new kakao.maps.MapTypeControl(); map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);
  const zoomControl = new kakao.maps.ZoomControl(); map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

  const bounds = new kakao.maps.LatLngBounds();
  const overlays = []; const samples = new Set(); const circles = new Map(); let bestOrder = []; let nameVisible = true; let filterState='all';

  function centerZoom(pt){ const ll=new kakao.maps.LatLng(pt.lat,pt.lng); const target=3; const cur=map.getLevel(); if(cur>target){ map.setLevel(target); setTimeout(()=>map.panTo(ll),120);} else { map.panTo(ll); if(cur>1) map.setLevel(cur-1);}}
  function drawCircle(id,pt){ const c=new kakao.maps.Circle({center:new kakao.maps.LatLng(pt.lat,pt.lng),radius:500,strokeWeight:2,strokeColor:'#3b82f6',strokeOpacity:0.9,fillColor:'#3b82f6',fillOpacity:0.2}); c.setMap(map); circles.set(id,c); }
  function removeCircle(id){ const c=circles.get(id); if(c){ c.setMap(null); circles.delete(id);} }
  function getSameAddr(addr){ const t=(addr||'').trim(); return POINTS.filter(p=>(p.addr||'').trim()===t); }

  const slide = document.getElementById('slide');
  slide.innerHTML = POINTS.map((pt,i)=>\`<div class="row" data-i="\${i}"><span class="badge plan">#\${pt.no}</span><span>\${escapeHtml(pt.name||'(이름없음)')}</span><span style="color:#6b7280"> / \${escapeHtml(pt.addr||'')}</span></div>\`).join('');

  POINTS.forEach((pt,i)=>{ const id=makeId(pt); const ll=new kakao.maps.LatLng(pt.lat,pt.lng); bounds.extend(ll); const el=document.createElement('button'); el.className='label'; el.type='button'; el.dataset.i=i; el.dataset.id=id; el.innerHTML=\`<span class="no">\${pt.no}</span><span class="nm">\${escapeHtml(pt.name||'(이름없음)')}</span>\`; const ov=new kakao.maps.CustomOverlay({position:ll,yAnchor:1.1,content:el,clickable:true}); ov.setMap(map); overlays.push({id,pt,el,ov,visible:true});});
  if(!bounds.isEmpty()) map.setBounds(bounds,60,60,60,60);

  function telLink(phone){ if(!phone) return '-'; const num=String(phone).replace(/[^0-9+]/g,''); return \`<a href="tel:\${num}" style="color:#2563eb">\${escapeHtml(phone)}</a>\`; }

  let current=null;
  async function showCard(pt){
    const id=makeId(pt); const status=await loadStatus(id); const memos=await loadMemo(id); current={pt,id,status,memos};
    const card=document.getElementById('card'); card.querySelectorAll('.chip').forEach(ch=>ch.classList.remove('active')); card.querySelector(\`.chip.\${status}\`).classList.add('active');
    document.getElementById('i_basic').innerHTML=\`NO \${pt.no} · \${escapeHtml(pt.name||'(이름없음)')} · \${telLink(pt.phone)}\`;
    document.getElementById('i_addr').textContent=pt.addr||'-';
    const same=getSameAddr(pt.addr);
    document.getElementById('sameList').innerHTML=same.map(p=>{ const sid=makeId(p); let st='plan'; try{ st=(LS?LS.getItem(STATUS_KEY(sid)):Mem[STATUS_KEY(sid)])||'plan'; }catch(e){ st=Mem[STATUS_KEY(sid)]||'plan'; } return \`<div class="item" data-no="\${p.no}" data-lat="\${p.lat}" data-lng="\${p.lng}"><span class="no">#\${p.no}</span><span>\${escapeHtml(p.name||'(이름없음)')}</span><span class="badge \${st}">\${st==='plan'?'예정':st==='done'?'완료':'보류'}</span></div>\`; }).join('');
  }

  function applyFilter(){ overlays.forEach(async o=>{ const st=await loadStatus(o.id); const show=(filterState==='all')||(filterState===st); o.visible=show; o.ov.setMap(show?map:null); }); }

  function locateMe(){ if(!navigator.geolocation){ alert('이 브라우저는 위치를 지원하지 않습니다.'); return;} navigator.geolocation.getCurrentPosition(pos=>{ const ll=new kakao.maps.LatLng(pos.coords.latitude,pos.coords.longitude); new kakao.maps.Marker({position:ll,map}); map.panTo(ll); }, err=> alert('GPS 사용불가: '+err.message), {enableHighAccuracy:true,timeout:7000}); }
  function openRoute(pt){ if(!navigator.geolocation){ window.open(\`https://map.kakao.com/link/to/\${encodeURIComponent(pt.name||'목적지')},\${pt.lat},\${pt.lng}\`,'_blank'); return;} navigator.geolocation.getCurrentPosition(pos=>{ const sX=pos.coords.longitude,sY=pos.coords.latitude; const eX=pt.lng,eY=pt.lat; const url=\`https://map.kakao.com/?sX=\${sX}&sY=\${sY}&eX=\${eX}&eY=\${eY}\`; window.open(url,'_blank'); }, _=>{ window.open(\`https://map.kakao.com/link/to/\${encodeURIComponent(pt.name||'목적지')},\${pt.lat},\${pt.lng}\`,'_blank'); }); }
  function openKakaoNavi(pt){ const name=encodeURIComponent(pt.name||'목적지'); location.href=\`kakaonavi://navigate?name=\${name}&x=\${pt.lng}&y=\${pt.lat}&coord_type=wgs84&rpoption=1\`; }

  function toggleSample(id,pt){ if(samples.has(id)){ samples.delete(id); removeCircle(id);} else { samples.add(id); drawCircle(id,pt);} }
  function sampleAll(){ overlays.forEach(async o=>{ const st=await loadStatus(o.id); if(st!=='done'){ samples.add(o.id); drawCircle(o.id,o.pt); } }); }
  function clearSamples(){ samples.clear(); for(const [id,c] of circles){ c.setMap(null);} circles.clear(); }

  function downloadXLS(filename, rows, headers){ const html='<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>'+headers.map(h=>'<th>'+escapeHtml(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+escapeHtml(String(c??""))+'</td>').join('')+'</tr>').join('')+'</tbody></table></body></html>'; const blob=new Blob([html],{type:'application/vnd.ms-excel'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),0); }
  function exportSamplesXLS(){ const rows=overlays.filter(o=>samples.has(o.id)).map(o=>[o.pt.no,o.pt.name||'',o.pt.phone||'',o.pt.addr||'']); downloadXLS('samples.xls',rows,['NO','이름','연락처','주소']); }

  // Haversine 거리 계산 (폴백용)
  function haversine(lat1,lon1,lat2,lon2){ const R=6371000; const toRad=x=>x*Math.PI/180; const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1); const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(a)); }

  // OSRM API 거리 행렬 요청
  async function osrmTable(locs){ 
    const base='https://router.project-osrm.org/table/v1/driving/'; 
    const q=locs.map(x=>x[0]+','+x[1]).join(';'); 
    const url=base+q+'?annotations=distance'; 
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      const data = await response.json();
      return data;
    } catch(error) {
      console.error('OSRM Table API 오류:', error);
      throw error;
    }
  }

  // OSRM 기반 최적 순서 계산 (최근접 이웃 알고리즘)
  function solveOrderNN(distMatrix){ 
    const n=distMatrix.length; 
    const used=new Array(n).fill(false); 
    const path=[0]; // 시작점(내 위치)
    used[0]=true; 
    
    for(let k=1; k<n; k++){ 
      const last=path[path.length-1]; 
      let best=-1, bestd=1e18; 
      for(let j=1; j<n; j++){ 
        if(!used[j] && distMatrix[last][j] < bestd){ 
          bestd=distMatrix[last][j]; 
          best=j; 
        } 
      } 
      if(best<0) break; 
      used[best]=true; 
      path.push(best); 
    } 
    return path; 
  }

  // OSRM 실제 경로 요청
  async function osrmRouteForOrder(locs, order){ 
    const base='https://router.project-osrm.org/route/v1/driving/'; 
    const chain=order.map(ix=>locs[ix][0]+','+locs[ix][1]).join(';'); 
    const url=base+chain+'?overview=full&geometries=geojson'; 
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      const data = await response.json();
      return data;
    } catch(error) {
      console.error('OSRM Route API 오류:', error);
      throw error;
    }
  }

  // 토스트 메시지 표시 함수
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
      info: {bg: '#3b82f6', text: '#fff'},
      success: {bg: '#10b981', text: '#fff'},
      warning: {bg: '#f59e0b', text: '#fff'},
      error: {bg: '#ef4444', text: '#fff'}
    };
    const color = colors[type] || colors.info;
    
    toast.style.cssText = \`position:fixed;top:20px;left:50%;transform:translateX(-50%);background:\${color.bg};color:\${color.text};padding:10px 20px;border-radius:8px;z-index:100000;box-shadow:0 4px 12px rgba(0,0,0,0.15)\`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if(document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
  }

  // OSRM 기반 최적 경로 생성 함수
  async function buildBestRoute(){ 
    try {
      const pts=overlays.filter(o=>samples.has(o.id)).map(o=>o.pt); 
      if(pts.length<2){ 
        alert('표본이 2개 이상이어야 합니다.'); 
        return;
      } 
      
      // 로딩 표시
      showToast('최적 경로 계산 중...', 'info');

      let startPos = pts[0]; // 기본값

      // GPS 위치 사용 또는 첫 번째 지점 사용
      if(navigator.geolocation){
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 300000
            });
          });
          startPos = {lat: position.coords.latitude, lng: position.coords.longitude};
        } catch(gpsError) {
          console.log('GPS 사용 불가, 첫 번째 지점을 시작점으로 사용');
        }
      }

      // 좌표 배열 생성 ([경도, 위도] 형식)
      const locs = [[startPos.lng, startPos.lat]];
      pts.forEach(p => locs.push([p.lng, p.lat]));

      // 1. OSRM 거리 행렬 요청
      const tableResult = await osrmTable(locs);
      if(!tableResult || !tableResult.distances){
        throw new Error('거리 행렬 요청 실패');
      }

      // 2. 최적 순서 계산
      const optimalOrder = solveOrderNN(tableResult.distances);

      // 3. 실제 경로 요청
      const routeResult = await osrmRouteForOrder(locs, optimalOrder);
      if(!routeResult || !routeResult.routes || !routeResult.routes.length){
        throw new Error('경로 생성 실패');
      }

      // 4. 기존 경로 제거
      if(window.bestLine) window.bestLine.setMap(null);
      if(window.bestLine2) window.bestLine2.setMap(null);
      if(window.arrowOverlays) {
        window.arrowOverlays.forEach(o => o.setMap(null));
        window.arrowOverlays = [];
      }

      // 5. 새 경로 표시 (OSRM 스타일: 흰색 외곽선 + 보라색 내부선)
      const coords = routeResult.routes[0].geometry.coordinates;
      const path = coords.map(c => new kakao.maps.LatLng(c[1], c[0]));

      // 외곽선 (흰색)
      window.bestLine = new kakao.maps.Polyline({
        path: path,
        strokeWeight: 11,
        strokeColor: '#ffffff',
        strokeOpacity: 1,
        strokeStyle: 'solid',
        zIndex: 5
      });

      // 내부선 (보라색)
      window.bestLine2 = new kakao.maps.Polyline({
        path: path,
        strokeWeight: 7,
        strokeColor: '#7c3aed',
        strokeOpacity: 0.95,
        strokeStyle: 'solid',
        zIndex: 6
      });

      window.bestLine.setMap(map);
      window.bestLine2.setMap(map);

      // 6. 화살표 배치
      placeArrowsAlong(path, 1000);

      // 7. 지도 범위 조정
      const bounds = new kakao.maps.LatLngBounds();
      path.forEach(pt => bounds.extend(pt));
      map.setBounds(bounds, 20, 20, 20, 20);

      // 8. 순서 정보 저장
      bestOrder = optimalOrder.slice(1).map(idx => pts[idx-1]); // 시작점 제외

      // 9. 완료 메시지
      const distance = (routeResult.routes[0].distance/1000).toFixed(1);
      const duration = Math.round(routeResult.routes[0].duration/60);
      showToast(\`최적 경로 완료! (총 \${distance}km, \${duration}분)\`, 'success');

    } catch(error) {
      console.error('OSRM 최적경로 생성 오류:', error);
      showToast('OSRM 기반 경로 실패, 직선거리 기반으로 재시도합니다.', 'warning');
      
      // 실패시 기존 방식으로 폴백
      buildBestRouteFallback();
    }
  }

  // 폴백: 기존 직선거리 방식
  function buildBestRouteFallback(){ 
    const pts=overlays.filter(o=>samples.has(o.id)).map(o=>o.pt); 
    if(pts.length<2) return;
    
    let start=pts[0]; 
    if(navigator.geolocation){ 
      navigator.geolocation.getCurrentPosition(pos=>{ 
        drawFallback({lat:pos.coords.latitude,lng:pos.coords.longitude}, pts); 
      }, _=>drawFallback(start, pts)); 
    } else {
      drawFallback(start, pts); 
    }
    
    function drawFallback(startPos, points){ 
      let cur=startPos, unused=points.slice(), order=[]; 
      while(unused.length){ 
        let bi=0,bd=1e18; 
        for(let i=0;i<unused.length;i++){ 
          const d=haversine(cur.lat,cur.lng,unused[i].lat,unused[i].lng); 
          if(d<bd){bd=d;bi=i;} 
        } 
        cur=unused.splice(bi,1)[0]; 
        order.push(cur);
      } 
      bestOrder=order; 
      if(window.bestLine) window.bestLine.setMap(null); 
      if(window.bestLine2) window.bestLine2.setMap(null); 
      const path=order.map(p=>new kakao.maps.LatLng(p.lat,p.lng)); 
      
      // 폴백시 빨간색으로 표시하여 구분
      window.bestLine=new kakao.maps.Polyline({path,strokeWeight:6,strokeColor:'#dc2626',strokeOpacity:0.9}); 
      window.bestLine.setMap(map); 
      window.bestLine2=new kakao.maps.Polyline({path,strokeWeight:2,strokeColor:'#fca5a5',strokeOpacity:0.9,strokeStyle:'shortdash'}); 
      window.bestLine2.setMap(map); 
      placeArrowsAlong(path,1000);
      
      showToast('직선거리 기반 경로 표시 완료', 'info');
    } 
  }

  function exportBestXLS(){ if(!bestOrder.length){ alert('먼저 최적경로를 생성하세요.'); return;} const rows=bestOrder.map(p=>[p.no,p.name||'',p.phone||'',p.addr||'']); downloadXLS('best_route.xls',rows,['NO','이름','연락처','주소']); }

  function placeArrowsAlong(path,every){ if(window.arrowOverlays){ window.arrowOverlays.forEach(o=>o.setMap(null)); } window.arrowOverlays=[]; let acc=0; for(let i=1;i<path.length;i++){ const a=path[i-1],b=path[i]; const d=haversine(a.getLat(),a.getLng(),b.getLat(),b.getLng()); let segStart=acc%every; for(let m=every-segStart; m<d; m+=every){ const t=m/d; const lat=a.getLat()+(b.getLat()-a.getLat())*t; const lng=a.getLng()+(b.getLng()-a.getLng())*t; const ang=Math.atan2(b.getLat()-a.getLat(), b.getLng()-a.getLng())*180/Math.PI; const el=document.createElement('div'); el.textContent='➤'; el.style.transform=\`rotate(\${-ang}deg)\`; const ov=new kakao.maps.CustomOverlay({position:new kakao.maps.LatLng(lat,lng),content:el,yAnchor:0.5,xAnchor:0.5}); ov.setMap(map); window.arrowOverlays.push(ov);} acc+=d; } }

  function renderMemos(){ const box=document.getElementById('memoList'); const rows=(current?.memos||[]).slice().reverse(); box.innerHTML=rows.map(m=>\`<div style="display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px dashed #eee"><span class="badge">\${new Date(m.ts).toLocaleString()}</span><span style="flex:1">\${escapeHtml(m.text||'')}</span></div>\`).join('') || '<div style="color:#6b7280">메모가 없습니다.</div>'; }
  function openMemoModal(){ if(!current) return; const modal=document.getElementById('memoModal'); modal.style.display='flex'; renderMemos(); document.getElementById('memoInput').value=''; }

  document.addEventListener('click',(ev)=>{ const lab=ev.target.closest('.label'); if(lab){ const i=Number(lab.dataset.i); centerZoom(POINTS[i]); showCard(POINTS[i]); } const row=ev.target.closest('.slide .row'); if(row){ const i=Number(row.dataset.i); centerZoom(POINTS[i]); showCard(POINTS[i]); }});
  document.getElementById('btnList').onclick=()=>{ const s=document.getElementById('slide'); s.style.display = s.style.display==='none'?'block':'none'; };
  document.getElementById('btnName').onclick=()=>{ nameVisible=!nameVisible; overlays.forEach(o=>o.el.classList.toggle('hide-name', !nameVisible)); };
  document.getElementById('btnMy').onclick=locateMe;
  document.getElementById('closeCard').onclick=()=>{ document.getElementById('card').style.display='none'; };
  document.querySelectorAll('.filter .btn').forEach(b=> b.onclick=()=>{ filterState=b.dataset.f; applyFilter(); });
  document.getElementById('btnEdit').onclick=openMemoModal;
  document.getElementById('memoClose').onclick=()=>{ document.getElementById('memoModal').style.display='none'; };
  document.getElementById('memoSave').onclick=async ()=>{ const input=document.getElementById('memoInput'); const text=input.value.trim(); if(!text||!current) return; (current.memos=current.memos||[]).push({text,ts:Date.now()}); await saveMemo(current.id,current.memos); renderMemos(); input.value=''; };

  document.getElementById('btnRoute').onclick=()=>{ if(current) openRoute(current.pt); };
  document.getElementById('btnNavi').onclick =()=>{ if(current) openKakaoNavi(current.pt); };
  document.getElementById('btnSample').onclick   =()=>{ if(current) toggleSample(current.id,current.pt); };
  document.getElementById('btnSampleAll').onclick=()=> sampleAll();
  document.getElementById('btnUnsample').onclick =()=> clearSamples();
  document.getElementById('btnSampleXLS').onclick=()=> exportSamplesXLS();
  document.getElementById('btnBest').onclick     =()=> buildBestRoute();
  document.getElementById('btnBestXLS').onclick  =()=> exportBestXLS();

  document.querySelectorAll('.chip').forEach(ch=> ch.addEventListener('click', async ()=>{ if(!current) return; document.querySelectorAll('.chip').forEach(k=>k.classList.remove('active')); ch.classList.add('active'); const st=ch.dataset.st; current.status=st; await saveStatus(current.id,st); applyFilter(); }));
})();`;
    const head = [
      '<!doctype html>',
      '<html lang="ko">',
      '<head><meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width,initial-scale=1" />',
      '<title>' + escapeTitle(title) + ' - 지도</title>',
      '<style>html,body{width:100%;height:100%;margin:0;padding:0;overflow:hidden;font:13px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}#map{width:100vw;height:100vh}</style>',
      '</head><body><div id="map"></div>',
      '<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(jsKey) + '"></script>',
      '<script>window.TITLE='+JSON.stringify(title)+',window.POINTS='+JSON.stringify(points)+'</script>',
      '<script>',
      INLINE,
      '</script>',
      '</body></html>'
    ].join('');
    return head;
  }

  async function onDone(){
    const baseNameRaw = (document.getElementById('mapName').value || '').trim();
    if (!baseNameRaw) { alert('지도 이름을 입력해주세요.'); return; }
    const baseName = baseNameRaw.replace(/[\\/:*?"<>|]/g,'_');

    const rows = [];
    for (let r=0; r<ROWS; r++) {
      const no    = r + 1;
      const name  = tbody.rows[r].cells[1].textContent.trim();
      const phone = tbody.rows[r].cells[2].textContent.trim();
      const addr  = tbody.rows[r].cells[3].textContent.trim();
      const memo  = tbody.rows[r].cells[4].textContent.trim();
      if (!addr) continue;
      rows.push({ no, name, phone, addr, memo, rIndex:r });
    }
    if (!rows.length) { alert('주소가 입력된 행이 없습니다.'); return; }

    const btn = document.getElementById('btnDone');
    btn.disabled = true; const old = btn.textContent; btn.textContent = '좌표 변환 중...';

    const points = [];
    const failures = [];
    for (const r of rows) {
      try {
        const g = await geocodeAddress(r.addr);
        if (g) points.push({ ...r, lat:g.lat, lng:g.lng });
        else { failures.push(r); markFail(r); }
      } catch(e){ failures.push(r); markFail(r); }
    }

    if (!points.length) { alert('좌표로 변환된 결과가 없습니다.'); btn.disabled=false; btn.textContent=old; return; }
    btn.textContent = '지도 생성 중...';

    const stamp = yymmddhhmmss();
    const fileName = `${baseName}_${stamp}.html`;
    const html = buildMapHTML({ title: baseName, jsKey: KAKAO_JS_API_KEY, points });

    // 1) 새 탭 미리보기: blob을 쓰지 않고 about:blank에 직접 쓰기 → 콘솔 blob 경고 없음
    const w = window.open('about:blank','_blank');
    if (w && w.document) { w.document.open(); w.document.write(html); w.document.close(); }

    // 2) 동시에 파일 다운로드
    const blob = new Blob([html], {type:'text/html;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 0);

    btn.disabled = false; btn.textContent = old;

    if (failures.length){
      const header = 'NO,이름,연락처,주소,메모\\n';
      const lines = failures.map(f => [f.no, f.name, f.phone, f.addr, (f.memo||'')].map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\\n');
      const body = `# 지오코딩 실패 로그\\n# 생성시각: ${stamp}\\n# 전체 ${rows.length}건 중 실패 ${failures.length}건\\n\\n` + header + lines + '\\n';
      const logBlob = new Blob([body], {type:'text/plain;charset=utf-8;'});
      const logUrl  = URL.createObjectURL(logBlob);
      const a2 = document.createElement('a'); a2.href = logUrl; a2.download = `${baseName}_${stamp}_geocode_fail.txt`; a2.click();
      setTimeout(()=>URL.revokeObjectURL(logUrl), 0);
    }

    function markFail(r){
      const memoCell = tbody.rows[r.rIndex].cells[4];
      memoCell.textContent = (memoCell.textContent ? memoCell.textContent + ' ' : '') + '[좌표없음]';
    }
  }

  document.getElementById('btnDone').addEventListener('click', onDone);
})();