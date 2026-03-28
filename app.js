let items = [];

const qEl = document.getElementById('q');
const sortEl = document.getElementById('sort');
const themeEl = document.getElementById('theme');
const listEl = document.getElementById('list');
const countEl = document.getElementById('count');
const metaEl = document.getElementById('meta');
const categoriesEl = document.getElementById('categories');
const randomEl = document.getElementById('random-picks');
const homeEl = document.getElementById('home');
const catalogEl = document.getElementById('catalog');
const goHomeBtn = document.getElementById('go-home');
const goCatalogBtn = document.getElementById('go-catalog');

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

function allThemesOf(it){
  const arr = Array.isArray(it.themes) ? it.themes : [it.theme].filter(Boolean);
  return [...new Set(arr.filter(Boolean))];
}

function filterItems(){
  const q = normalize(qEl.value.trim());
  const theme = themeEl.value;

  let out = items;
  if(theme) out = out.filter(it => allThemesOf(it).includes(theme));

  if(q){
    out = out.filter(it => normalize([
      it.reference, it.old_reference, it.author, it.title, it.description,
      it.editor, it.year, it.price_eur, it.place, ...allThemesOf(it)
    ].join(' ')).includes(q));
  }
  return sortItems(out);
}

function getGallery(it){
  const rawImgs = Array.isArray(it.images) && it.images.length ? it.images : (it.image ? [it.image] : []);
  const imgs = rawImgs.map(u => String(u || '').trim()).filter(Boolean);
  return imgs.filter(u => !u.includes('/search/no-image.gif'));
}

function renderCatalog(){
  const data = filterItems();
  countEl.textContent = `${data.length} résultat(s)`;
  listEl.innerHTML = data.map((it, idx) => {
    const allThemes = allThemesOf(it);
    const otherThemes = allThemes.filter(t => t !== it.theme);

    const gallery = getGallery(it);
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

function renderHome(){
  const counts = new Map();
  items.forEach(it => {
    const main = String(it.theme || '').trim();
    if (!main) return;
    counts.set(main, (counts.get(main) || 0) + 1);
  });
  const sortedThemes = [...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0], 'fr'));
  categoriesEl.innerHTML = sortedThemes.map(([theme, count]) =>
    `<button class="home-theme-chip" data-theme="${escapeAttr(theme)}" type="button">${escapeHtml(theme)} <span>(${count})</span></button>`
  ).join('');

  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks = pool.slice(0, 3);

  randomEl.innerHTML = picks.map((it) => {
    const img = getGallery(it)[0] || '';
    const thumb = img
      ? `<img class="pick-thumb" loading="lazy" src="${escapeAttr(img)}" alt="${escapeAttr(it.title||'Livre')}" />`
      : `<div class="pick-no-thumb">Image sur demande</div>`;

    return `
      <article class="pick-card">
        ${thumb}
        <h4>${escapeHtml(it.title || 'Sans titre')}</h4>
        <div class="pick-meta">Réf ${escapeHtml(it.reference||'—')} · ${escapeHtml(it.author||'—')}</div>
        <button class="home-theme-chip" data-theme="${escapeAttr(it.theme||'')}" type="button">${escapeHtml(it.theme||'Sans thème')}</button>
      </article>
    `;
  }).join('');
}

function showHome(){
  homeEl.classList.remove('hidden');
  catalogEl.classList.add('hidden');
}

function showCatalog(){
  homeEl.classList.add('hidden');
  catalogEl.classList.remove('hidden');
  renderCatalog();
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

function selectTheme(theme){
  if (!theme) return;
  themeEl.value = theme;
  showCatalog();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function boot(){
  try {
    const j = (window.CATALOG_DATA && window.CATALOG_DATA.items)
      ? window.CATALOG_DATA
      : await (await fetch('data/catalog.json')).json();

    items = j.items || [];
    metaEl.textContent = `${j.seller?.name||''} — ${j.seller?.location||''} — ${j.count||items.length} entrées`;
    initThemes(j.themes);
    renderHome();
    showHome();
  } catch (e) {
    metaEl.textContent = 'Erreur de chargement des données.';
  }
}

qEl.addEventListener('input', showCatalog);
sortEl.addEventListener('change', showCatalog);
themeEl.addEventListener('change', showCatalog);
goHomeBtn.addEventListener('click', showHome);
goCatalogBtn.addEventListener('click', showCatalog);

listEl.addEventListener('click', (e) => {
  const chip = e.target.closest('.theme-chip');
  if (chip) {
    selectTheme(chip.getAttribute('data-theme') || '');
    return;
  }

  const mini = e.target.closest('.thumb-mini');
  if (!mini) return;
  const targetId = mini.getAttribute('data-target');
  const main = document.getElementById(targetId);
  if (main) main.src = mini.src;
});

document.addEventListener('click', (e) => {
  const chip = e.target.closest('.home-theme-chip');
  if (!chip) return;
  selectTheme(chip.getAttribute('data-theme') || '');
});

boot();
