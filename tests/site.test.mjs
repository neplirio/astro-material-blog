import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { load } from 'cheerio';
const origin = 'https://neplirio.github.io';
const base = '/astro-material-blog/';
const root = resolve('dist');
async function walk(dir) { const list = await readdir(dir,{withFileTypes:true}); return (await Promise.all(list.map(entry => entry.isDirectory() ? walk(join(dir,entry.name)) : join(dir,entry.name)))).flat(); }
const htmlFiles = (await walk(root)).filter(file => file.endsWith('.html'));
const pages = new Map(await Promise.all(htmlFiles.map(async file => [file, load(await readFile(file,'utf8'))])));
function target(url) { assert.ok(url.pathname.startsWith(base), `missing base: ${url.href}`); const path = decodeURIComponent(url.pathname.slice(base.length)); return join(root,path.endsWith('/') || !path ? `${path}index.html` : path); }

test('built pages have Chinese metadata, canonical URLs and accessible landmarks', () => {
  assert.ok(pages.size >= 10);
  for (const [file,$] of pages) {
    assert.equal($('html').attr('lang'),'zh-CN',file);
    assert.ok($('title').text().length > 5,file);
    assert.ok($('meta[name="description"]').attr('content')?.length > 15,file);
    const canonical = new URL($('link[rel="canonical"]').attr('href'));
    assert.equal(canonical.origin, origin); assert.ok(canonical.pathname.startsWith(base));
    assert.equal($('main').length,1); assert.equal($('h1').length,1);
    assert.equal($('#search-dialog').attr('data-search-module'),`${base}pagefind/pagefind.js`);
    assert.ok($('head script').first().text().includes('glonee-theme'),'theme must initialize in head');
  }
});
test('all internal links, scripts, styles, metadata assets and anchors resolve under base', async () => {
  for (const [file,$] of pages) {
    const current = new URL(base + file.slice(root.length+1).replace(/index\.html$/,''),origin);
    for (const el of $('[href],[src],[data-search-module]')) {
      const attr = $(el).attr('href') ?? $(el).attr('src') ?? $(el).attr('data-search-module');
      if (!attr || /^(mailto:|tel:|data:|javascript:)/.test(attr)) continue;
      const url = new URL(attr,current); if (url.origin !== origin) continue;
      const path = target(url);
      assert.ok((await stat(path)).isFile(),`${file}: ${attr}`);
      if (url.hash && path.endsWith('.html')) { const dest = pages.get(path); const id = decodeURIComponent(url.hash.slice(1)); assert.ok(dest?.('[id]').toArray().some(node => dest(node).attr('id') === id),`missing anchor: ${file} → ${attr}`); }
    }
    const image = new URL($('meta[property="og:image"]').attr('content')); await stat(target(image));
  }
});
test('six original demo articles contain real prose, headings, metadata and TOC', () => {
  const articles = [...pages].filter(([file]) => file.includes('/posts/'));
  assert.equal(articles.length,6);
  for (const [file,$] of articles) {
    assert.equal($('[data-pagefind-body]').length,1,file);
    assert.ok($('.prose').text().length > 550,file);
    assert.ok($('.prose h2').length >= 3,file);
    assert.match($('.demo-banner').text(),/原创示例文章/);
    assert.ok($('.toc a[href^="#"]').length >= 3,file);
    assert.ok($('.article-meta time').attr('datetime'));
  }
  assert.ok(articles.some(([, $]) => $('.astro-code').length > 0));
});
test('RSS, sitemap and index are generated with deployment URLs', async () => {
  const rss = load(await readFile('dist/rss.xml','utf8'),{xmlMode:true});
  assert.equal(rss('item').length,6);
  for (const link of rss('item link')) { const url = new URL(rss(link).text()); assert.equal(url.origin,origin); await stat(target(url)); }
  const sitemap = load(await readFile('dist/sitemap-0.xml','utf8'),{xmlMode:true});
  assert.ok(sitemap('url').length >= 9);
  for (const loc of sitemap('loc')) { const url = new URL(sitemap(loc).text()); assert.equal(url.origin,origin); await stat(target(url)); }
  const entries = JSON.parse(await readFile('dist/pagefind/pagefind-entry.json','utf8'));
  assert.ok(Object.keys(entries.languages).some(lang => lang.startsWith('zh')));
  const css = await readFile('src/styles/global.css','utf8'); assert.ok(css.includes('prefers-reduced-motion:reduce'));
  const workflow = await readFile('.github/workflows/deploy.yml','utf8');
  for (const required of ['npm ci','npm run build','actions/configure-pages','actions/upload-pages-artifact','actions/deploy-pages','pages: write','id-token: write','concurrency:']) assert.ok(workflow.includes(required));
});

test('bundled CSS font and image URLs retain the base and resolve', async () => {
  const files = (await walk(root)).filter(file => file.endsWith('.css'));
  let count = 0;
  for (const file of files) {
    const css = await readFile(file, 'utf8');
    for (const match of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) {
      if (match[1].startsWith('data:')) continue;
      const url = new URL(match[1], new URL(base + file.slice(root.length + 1), origin));
      assert.equal(url.origin, origin, 'fonts and images must be self hosted');
      await stat(target(url));
      count++;
    }
  }
  assert.ok(count > 0, 'real self hosted font assets must be included');
});
