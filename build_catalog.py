import re, json, html, urllib.request, urllib.parse, time
from pathlib import Path
from collections import defaultdict

BASE = "https://www.abebooks.fr/servlet/SearchResults"
SELLER_URL = "https://www.abebooks.fr/e-j.l-grison-toulon/5492142/sf"
UA = "Mozilla/5.0 (compatible; OpenClawCatalogBuilder/5.0)"


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        ctype = r.headers.get('Content-Type', '')

    m = re.search(r'charset=([\w\-]+)', ctype, re.I)
    if m:
        cs = m.group(1).lower()
        try:
            return raw.decode(cs, 'replace')
        except Exception:
            pass

    # try utf-8 first, fallback latin-1 (AbeBooks pages are often latin-1-ish)
    try:
        return raw.decode('utf-8', 'strict')
    except Exception:
        return raw.decode('latin-1', 'replace')


def clean_text(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s).replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def iter_result_blocks(page_html):
    starts = [m.start() for m in re.finditer(r'<li[^>]*class="[^"]*cf result-item[^"]*"', page_html)]
    for i, st in enumerate(starts):
        en = starts[i + 1] if i + 1 < len(starts) else len(page_html)
        yield page_html[st:en]


def parse_items_from_search(page_html):
    items = []
    for block in iter_result_blocks(page_html):
        title_m = re.search(r'<h2[^>]*class="[^"]*title[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>', block)
        if not title_m:
            continue
        href, title_raw = title_m.groups()
        txt = clean_text(block)

        ref_m = re.search(r'N\s*de\s*r\w*\.?\s*du\s*vendeur\s*([0-9A-Za-z\-_/]+)', txt, re.I)
        price_m = re.search(r'(?:EUR|€)\s*([0-9][0-9\.,]*)', txt)
        cond_m = re.search(r'(Ancien ou d\S*occasion[^\.]*)', txt, re.I)
        desc_m = re.search(r'<p[^>]*class="[^"]*item-description[^"]*"[^>]*>([\s\S]*?)</p>', block)
        img_m = re.search(r'<img[^>]+src="([^"]+)"', block, re.I)

        url = href if href.startswith('http') else urllib.parse.urljoin('https://www.abebooks.fr', href)
        reference = ref_m.group(1) if ref_m else ''

        image = img_m.group(1) if img_m else ''
        if image.startswith('//'):
            image = 'https:' + image

        items.append({
            'title': clean_text(title_raw),
            'price_eur': price_m.group(1).replace(',', '.') if price_m else '',
            'reference': reference,
            'condition': cond_m.group(1) if cond_m else '',
            'description': clean_text(desc_m.group(1)) if desc_m else '',
            'image': image,
            'images': [image] if image else [],
            'url': url,
            'theme': 'Divers',
            'themes': [],
        })
    return items


def collect_main_catalog():
    params = {'sortby':'0','vci':'5492142','ds':'30','dym':'on','rollup':'on'}
    all_items = []
    for bsi in range(0, 1800, 30):
        q = dict(params)
        if bsi:
            q['bsi'] = str(bsi)
        page = fetch(BASE + '?' + urllib.parse.urlencode(q))
        items = parse_items_from_search(page)
        if not items:
            break
        all_items.extend(items)
        if bsi % 300 == 0:
            print('items progress', bsi, len(all_items))
    return all_items


def collect_theme_links():
    s = fetch(SELLER_URL)
    links = re.findall(r'href="([^\"]*/servlet/SearchResults\?vcat=[^\"]*vci=5492142[^\"]*)"', s)
    out = {}
    for l in links:
        full = html.unescape(urllib.parse.urljoin('https://www.abebooks.fr', l))
        q = urllib.parse.urlparse(full).query
        vcat = urllib.parse.parse_qs(q).get('vcat', [''])[0]
        if not vcat:
            continue
        theme = urllib.parse.unquote(vcat)
        out[theme] = full
    return out


def collect_theme_by_reference(theme_links):
    by_ref = defaultdict(set)
    for idx, (theme, base_link) in enumerate(sorted(theme_links.items()), start=1):
        parsed = urllib.parse.urlparse(base_link)
        base_q = urllib.parse.parse_qs(parsed.query)
        params = {
            'sortby': base_q.get('sortby', ['0'])[0],
            'vci': '5492142',
            'vcat': base_q.get('vcat', [''])[0],
            'ds': '30',
            'dym': 'on',
            'rollup': 'on',
        }

        for bsi in range(0, 1800, 30):
            q = dict(params)
            if bsi:
                q['bsi'] = str(bsi)
            page = fetch(BASE + '?' + urllib.parse.urlencode(q))
            items = parse_items_from_search(page)
            if not items:
                break
            for it in items:
                if it['reference']:
                    by_ref[it['reference']].add(theme)
            if len(items) < 30:
                break

        if idx % 10 == 0:
            print('theme progress', idx, '/', len(theme_links))

    return by_ref


def normalize_images(imgs):
    norm = []
    seen = set()
    for u in imgs:
        if u.startswith('//'):
            u = 'https:' + u
        if not u.startswith('http'):
            continue
        # ignore abeBooks md thumbnails if full image exists
        if '/inventory/md/md' in u:
            continue
        if u not in seen:
            seen.add(u)
            norm.append(u)
    return norm


def collect_images_for_urls(unique_urls):
    by_url = {}
    pat = re.compile(r'https://pictures\.abebooks\.com/inventory/[^"\']+?\.(?:jpg|jpeg|png|webp)', re.I)
    for i, url in enumerate(unique_urls, start=1):
        imgs = []
        try:
            page = fetch(url, timeout=25)
            imgs = normalize_images(pat.findall(page))
        except Exception:
            imgs = []
        by_url[url] = imgs
        if i % 100 == 0:
            print('image progress', i, '/', len(unique_urls))
            time.sleep(0.2)
    return by_url


def main():
    items = collect_main_catalog()
    theme_links = collect_theme_links()
    print('themes found', len(theme_links))
    ref_themes = collect_theme_by_reference(theme_links)

    for it in items:
        themes = sorted(ref_themes.get(it['reference'], []))
        it['themes'] = themes
        it['theme'] = themes[0] if themes else 'Divers'

    unique_urls = sorted(set(it['url'] for it in items if it.get('url')))
    by_url_imgs = collect_images_for_urls(unique_urls)

    for it in items:
        imgs = by_url_imgs.get(it['url'], [])
        if imgs:
            it['images'] = imgs
            it['image'] = imgs[0]

    data = {
        'seller': {'name':'E. & J.L GRISON', 'location':'Toulon, France', 'source': SELLER_URL},
        'count': len(items),
        'themes': sorted(theme_links.keys()),
        'items': items,
    }

    root = Path(__file__).resolve().parent
    (root/'data').mkdir(exist_ok=True)
    (root/'data'/'catalog.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    (root/'data'/'catalog.js').write_text('window.CATALOG_DATA = ' + json.dumps(data, ensure_ascii=False) + ';\n', encoding='utf-8')

    print('Saved', len(items), 'items')


if __name__ == '__main__':
    main()
