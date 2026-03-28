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
  if(theme) out = out.filter(it => (it.theme||'') === theme);

  if(q){
    out = out.filter(it => normalize([
      it.reference,
      it.old_reference,
      it.author,
      it.title,
      it.description,
      it.editor,
      it.year,
      it.price_eur,
      it.place,
      it.theme,
      ...(Array.isArray(it.themes) ? it.themes : [])
    ].join(' ')).includes(q));
  }
  return sortItems(out);
}

function render(){
  const data = filterItems();
  countEl.textContent = `${data.length} résultat(s)`;
  listEl.innerHTML = data.map((it, idx) => {
    const allThemes = Array.isArray(it.themes) ? it.themes.filter(Boolean) : [];
    const otherThemes = allThemes.filter(t => t !== it.theme);

    const rawImgs = Array.isArray(it.images) && it.images.length ? it.images : (it.image ? [it.image] : []);
    const imgs = rawImgs.map(u => String(u || '').trim()).filter(Boolean);
    const visibleImgs = imgs.filter(u => !u.includes('/search/no-image.gif'));
    const gallery = visibleImgs.length ? visibleImgs : [];
    const mainImg = gallery[0] || '';
    const mini = gallery.map((u) => `<img class="thumb-mini" data-target="main-${idx}" src="${escapeAttr(u)}" alt="mini" onerror="this.style.display='none'" onclick="var m=document.getElementById('main-${idx}'); if(m){m.src=this.src;}" />`).join('');
    const visual = gallery.length
      ? `<img id="main-${idx}" class="thumb" loading="lazy" src="${escapeAttr(mainImg)}" alt="${escapeAttr(it.title||'Livre')}" onerror="this.style.display='none'; var n=this.nextElementSibling; if(n&&n.classList.contains('no-thumb')) n.style.display='flex';" /><div class="no-thumb" style="display:none">Image sur demande</div>`
      : `<div class="no-thumb">Image sur demande</div>`;

    const mainThemeChip = it.theme
      ? `<button class="theme-chip" data-theme="${escapeAttr(it.theme)}" type="button">${escapeHtml(it.theme)}</button>`
      : '—';
    const otherThemeChips = otherThemes.length
      ? otherThemes.map(t => `<button class="theme-chip" data-theme="${escapeAttr(t)}" type="button">${escapeHtml(t)}</button>`).join(' ')
      : '—';

    return `
    <article class="card">
      ${visual}
      ${gallery.length ? `<div class="more-photos">${gallery.length} photo${gallery.length > 1 ? 's' : ''}</div><div class="thumbs">${mini}</div>` : ''}
      <h3>${escapeHtml(it.title||'Sans titre')}</h3>
      <div class="meta">
        <div><strong>Réf:</strong> ${escapeHtml(it.reference||'—')}</div>
        <div><strong>Auteur:</strong> ${escapeHtml(it.author||'—')}</div>
        <div><strong>Éditeur:</strong> ${escapeHtml(it.editor||'—')}</div>
        <div><strong>Année:</strong> ${escapeHtml(it.year||'—')}</div>
        <div><strong>Prix:</strong> ${escapeHtml(it.price_eur||'—')} €</div>
        <div><strong>Lieu:</strong> ${escapeHtml(it.place||'—')}</div>
        <div><strong>Thème principal:</strong> ${mainThemeChip}</div>
        <div><strong>Autres thèmes:</strong> ${otherThemeChips}</div>
      </div>
      <div class="desc">${escapeHtml(it.description||'—')}</div>
    </article>
  `;
  }).join('');
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }

function initThemes(sourceThemes = null){
  const themes = (Array.isArray(sourceThemes) && sourceThemes.length)
    ? [...sourceThemes]
    : [...new Set(items.map(i => i.theme).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));

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
    metaEl.textContent = `${j.seller?.name||''} — ${j.seller?.location||''} — ${j.count||items.length} entrées`;
    initThemes(j.themes);
    render();
    return;
  }

  try {
    const r = await fetch('data/catalog.json');
    const j = await r.json();
    items = j.items || [];
    metaEl.textContent = `${j.seller?.name||''} — ${j.seller?.location||''} — ${j.count||items.length} entrées`;
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
  const chip = e.target.closest('.theme-chip');
  if (chip) {
    const selected = chip.getAttribute('data-theme') || '';
    themeEl.value = selected;
    render();
    return;
  }

  const mini = e.target.closest('.thumb-mini');
  if (!mini) return;
  const targetId = mini.getAttribute('data-target');
  const main = document.getElementById(targetId);
  if (main) main.src = mini.src;
});

boot();
