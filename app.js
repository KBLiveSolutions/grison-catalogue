let items = [];

const qEl = document.getElementById('q');
const sortEl = document.getElementById('sort');
const themeEl = document.getElementById('theme');
const listEl = document.getElementById('list');
const countEl = document.getElementById('count');
const metaEl = document.getElementById('meta');
const categoriesEl = document.getElementById('categories');
const homeEl = document.getElementById('home');
const catalogEl = document.getElementById('catalog');
const goHomeBtn = document.getElementById('go-home');
const goCatalogBtn = document.getElementById('go-catalog');

function numRef(r){ const n = parseInt(String(r||'').replace(/\D+/g,''),10); return Number.isFinite(n)?n:0; }
function numPrice(p){ const n = parseFloat(String(p||'').replace(',','.')); return Number.isFinite(n)?n:Infinity; }

function compareByMode(x, y, mode){
  if(mode==='ref_asc') return numRef(x.reference)-numRef(y.reference);
  if(mode==='ref_desc') return numRef(y.reference)-numRef(x.reference);
  if(mode==='price_asc') return numPrice(x.price_eur)-numPrice(y.price_eur);
  if(mode==='price_desc') return numPrice(y.price_eur)-numPrice(x.price_eur);
  if(mode==='title_asc') return (x.title||'').localeCompare(y.title||'', 'fr');
  return 0;
}

function sortItems(arr){
  const mode = sortEl.value;
  const a = [...arr];
  a.sort((x,y)=>compareByMode(x,y,mode));
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

function themeRank(it, selectedTheme){
  if (!selectedTheme) return 99;
  const themes = allThemesOf(it);
  const idx = themes.indexOf(selectedTheme);
  return idx === -1 ? 99 : idx; // 0=TH1, 1=TH2, 2=TH3...
}

function filterItems(){
  const q = normalize(qEl.value.trim());
  const selectedTheme = themeEl.value;

  let out = items;
  if(selectedTheme) out = out.filter(it => allThemesOf(it).includes(selectedTheme));

  if(q){
    out = out.filter(it => normalize([
      it.reference, it.old_reference, it.author, it.title, it.description,
      it.editor, it.year, it.price_eur, it.place, ...allThemesOf(it)
    ].join(' ')).includes(q));
  }

  const mode = sortEl.value;
  out = [...out].sort((a,b) => {
    if (selectedTheme) {
      const ra = themeRank(a, selectedTheme);
      const rb = themeRank(b, selectedTheme);
      if (ra !== rb) return ra - rb; // TH1 puis TH2 puis TH3
    }
    return compareByMode(a,b,mode);
  });

  return out;
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

  const themes = [...counts.entries()]
    .sort((a,b)=>a[0].localeCompare(b[0], 'fr'))
    .map(([name, count]) => ({ name, count, letter: name.charAt(0).toUpperCase() }));

  // Flux alphabétique continu: A..., B..., C... puis colonne suivante = suite
  const linear = [];
  let currentLetter = '';
  for (const t of themes) {
    if (t.letter !== currentLetter) {
      linear.push({ type: 'letter', letter: t.letter });
      currentLetter = t.letter;
    }
    linear.push({ type: 'theme', ...t });
  }

  const colCount = 5;
  const chunkSize = Math.ceil(linear.length / colCount) || 1;
  const cols = [];
  for (let i = 0; i < colCount; i++) {
    cols.push(linear.slice(i * chunkSize, (i + 1) * chunkSize));
  }

  categoriesEl.innerHTML = cols.map(col => {
    const itemsHtml = col.map(item => {
      if (item.type === 'letter') {
        return `<div class="letter-sep">${escapeHtml(item.letter)}</div>`;
      }
      return `<button class="home-theme-chip" data-theme="${escapeAttr(item.name)}" type="button">${escapeHtml(item.name)} <span>(${item.count})</span></button>`;
    }).join('');
    return `<div class="cat-col">${itemsHtml}</div>`;
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
