let items = [];

const qEl = document.getElementById('q');
const sortEl = document.getElementById('sort');
const themeEl = document.getElementById('theme');
const listEl = document.getElementById('list');
const countEl = document.getElementById('count');
const metaEl = document.getElementById('meta');

function numRef(r){ const n = parseInt(String(r||'').replace(/\D+/g,''),10); return Number.isFinite(n)?n:0; }
function numPrice(p){ const n = parseFloat(String(p||'').replace(',','.')); return Number.isFinite(n)?n:Infinity; }

function sortItems(arr){
  const mode = sortEl.value;
  const a = [...arr];
  if(mode==='ref_asc') a.sort((x,y)=>numRef(x.reference)-numRef(y.reference));
  else if(mode==='ref_desc') a.sort((x,y)=>numRef(y.reference)-numRef(x.reference));
  else if(mode==='price_asc') a.sort((x,y)=>numPrice(x.price_eur)-numPrice(y.price_eur));
  else if(mode==='price_desc') a.sort((x,y)=>numPrice(y.price_eur)-numPrice(x.price_eur));
  else if(mode==='title_asc') a.sort((x,y)=>(x.title||'').localeCompare(y.title||'', 'fr'));
  return a;
}

function normalize(s){
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function filterItems(){
  const q = normalize(qEl.value.trim());
  const theme = themeEl.value;

  let out = items;
  if(theme) out = out.filter(it => Array.isArray(it.themes) ? it.themes.includes(theme) : (it.theme||'Divers') === theme);

  if(q){
    out = out.filter(it => normalize([it.title,it.reference,it.description,it.condition,it.theme].join(' ')).includes(q));
  }
  return sortItems(out);
}

function render(){
  const data = filterItems();
  countEl.textContent = `${data.length} résultat(s)`;
  listEl.innerHTML = data.map((it, idx) => {
    const rawImgs = Array.isArray(it.images) && it.images.length ? it.images : (it.image ? [it.image] : []);
    const imgs = rawImgs.map(u => String(u || '').trim()).filter(Boolean);
    const visibleImgs = imgs.filter(u => !u.includes('/search/no-image.gif'));
    const gallery = visibleImgs.length ? visibleImgs : [];
    const mainImg = gallery[0] || '';
    const mini = gallery.map((u) => `<img class="thumb-mini" data-target="main-${idx}" src="${escapeAttr(u)}" alt="mini" onerror="this.style.display='none'" onclick="var m=document.getElementById('main-${idx}'); if(m){m.src=this.src;}" />`).join('');
    const visual = gallery.length
      ? `<img id="main-${idx}" class="thumb" loading="lazy" src="${escapeAttr(mainImg)}" alt="${escapeAttr(it.title||'Livre')}" onerror="this.style.display='none'; var n=this.nextElementSibling; if(n&&n.classList.contains('no-thumb')) n.style.display='flex';" /><div class="no-thumb" style="display:none">Pas d'image</div>`
      : `<div class="no-thumb">Pas d'image</div>`;

    return `
    <article class="card">
      ${visual}
      ${gallery.length ? `<div class="more-photos">${gallery.length} photo${gallery.length > 1 ? 's' : ''}</div><div class="thumbs">${mini}</div>` : ''}
      <h3>${escapeHtml(it.title||'Sans titre')}</h3>
      <div class="theme">${escapeHtml(it.theme||'Divers')}</div>
      <div class="meta">
        <div><strong>Réf:</strong> ${escapeHtml(it.reference||'—')}</div>
        <div><strong>Prix:</strong> ${escapeHtml(it.price_eur||'—')} €</div>
        <div><strong>État:</strong> ${escapeHtml(it.condition||'—')}</div>
      </div>
      <div class="desc">${escapeHtml(stripShippingNoise((it.description||'')).slice(0,420))}</div>
    </article>
  `;
  }).join('');
}

function stripShippingNoise(text){
  let s = String(text || '');
  // Remove whole shipping block variants (accents/encoding glitches included)
  s = s.replace(/Exp[^\n]{0,40}dition[\s\S]*?Ajouter au panier/gi, '');
  s = s.replace(/En savoir plus sur les tarifs d.?exp[^\s]*dition/gi, '');
  s = s.replace(/Exp[^\n]{0,30}dition nationale\s*:\s*France/gi, '');
  s = s.replace(/Exp[^\n]{0,10}\s+\w+/gi, ''); // Expédition à ...
  s = s.replace(/Quantit[^\n]{0,20}disponible\s*:\s*\d+\s*disponible\(s\)/gi, '');
  s = s.replace(/Ajouter au panier/gi, '');
  return s.replace(/\s+/g, ' ').trim();
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }

function initThemes(sourceThemes = null){
  const themes = (Array.isArray(sourceThemes) && sourceThemes.length)
    ? [...sourceThemes]
    : [...new Set(items.flatMap(i => Array.isArray(i.themes) ? i.themes : [i.theme || 'Divers']))].sort((a,b)=>a.localeCompare(b,'fr'));

  themes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    themeEl.appendChild(opt);
  });
}

async function boot(){
  if (window.CATALOG_DATA && window.CATALOG_DATA.items) {
    const j = window.CATALOG_DATA;
    items = j.items || [];
    metaEl.textContent = `${j.seller?.name||''} — ${j.seller?.location||''} — ${j.count||items.length} entrées extraites`;
    initThemes(j.themes);
    render();
    return;
  }

  try {
    const r = await fetch('data/catalog.json');
    const j = await r.json();
    items = j.items || [];
    metaEl.textContent = `${j.seller?.name||''} — ${j.seller?.location||''} — ${j.count||items.length} entrées extraites`;
    initThemes(j.themes);
    render();
  } catch (e) {
    metaEl.textContent = 'Erreur de chargement des données.';
  }
}

qEl.addEventListener('input', render);
sortEl.addEventListener('change', render);
themeEl.addEventListener('change', render);

listEl.addEventListener('click', (e) => {
  const mini = e.target.closest('.thumb-mini');
  if (!mini) return;
  const targetId = mini.getAttribute('data-target');
  const main = document.getElementById(targetId);
  if (main) main.src = mini.src;
});

boot();
