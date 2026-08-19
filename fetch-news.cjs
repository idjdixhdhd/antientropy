#!/usr/bin/env node
/* ==========================================================
   逆熵 ANTIENTROPY · 真实资讯数据管线 v3（全品类 40+ 源）
   ----------------------------------------------------------
   只从可验证的官方公开源读取 RSS，做筛选/去重/校验，
   输出 news.json 供站点读取。纯 Node（无需 npm 安装）。

   设计（v3）：
   1. 只抓 RSS 源，不爬网页（结构化、干净）
   2. 白名单 PRIORITY + 黑名单 BLOCK 双列表过滤
   3. 每条保存：原始标题、中文标题、摘要、来源、时间、URL、图、标签、类别
   4. 【合并保护】保留已有"人工中文"条目（translated:true 或已有 titleZh），
      只合并新增条目（新增标 translated:false，待 AI 二次整理补中文）
   5. 全部源失败 → 回退缓存并标 status:'cache'
   6. 容错：单源失败不影响整体；freq=daily 每天抓、freq=weekly 隔天抓（防封）
   7. 源健康：连续 3 次抓不到该源内容 → 自动跳过（不反复拿旧缓存）

   用法：
     node fetch-news.cjs            # 抓取并合并写入 news.json
     node fetch-news.cjs --force    # 强制覆盖（调试用，会丢人工中文）
   ========================================================== */

'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'news.json');
const HEALTH = path.join(__dirname, '.src-health.json');
const TIMEOUT = 9000;
const POOL_CAP = 50;    // 合并后池子上限（保留最新）

/* 官方公开 RSS 源（12 类别 · 40+ 源，带类别与更新频率）
   freq: daily=日更（每次抓） / weekly=周更（隔天抓，防封）
   任一源失效不影响其它源；连续失败自动健康降级 */
const SOURCES = [
  /* ---- AI 前沿 ---- */
  { name: 'OpenAI', home: 'https://openai.com/news', feed: 'https://openai.com/news/rss.xml', cat: 'ai', freq: 'daily' },
  { name: 'GitHub', home: 'https://github.blog/changelog/', feed: 'https://github.blog/changelog/feed/', cat: 'ai', freq: 'daily' },
  { name: 'Google', home: 'https://blog.google/technology/ai/', feed: 'https://blog.google/technology/ai/rss/', cat: 'ai', freq: 'daily' },
  { name: 'Hugging Face', home: 'https://huggingface.co/blog', feed: 'https://huggingface.co/blog/feed.xml', cat: 'opensource', freq: 'daily' },
  { name: 'Anthropic', home: 'https://www.anthropic.com/news', feed: 'https://www.anthropic.com/rss.xml', cat: 'ai', freq: 'weekly' },
  { name: 'DeepMind', home: 'https://deepmind.google/discover/blog/', feed: 'https://deepmind.google/blog/rss.xml', cat: 'ai', freq: 'weekly' },
  { name: 'MIT Tech Review AI', home: 'https://www.technologyreview.com/topic/artificial-intelligence/', feed: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', cat: 'ai', freq: 'weekly' },

  /* ---- AI 科普 ---- */
  { name: 'Simon Willison', home: 'https://simonwillison.net/', feed: 'https://simonwillison.net/atom/everything/', cat: 'ai101', freq: 'daily' },
  { name: '量子位', home: 'https://www.qbitai.com/', feed: 'https://www.qbitai.com/feed', cat: 'ai101', freq: 'daily' },

  /* ---- 科学科普 ---- */
  { name: 'Quanta Magazine', home: 'https://www.quantamagazine.org', feed: 'https://www.quantamagazine.org/feed/', cat: 'science', freq: 'daily' },
  { name: 'Scientific American', home: 'https://www.scientificamerican.com/', feed: 'https://www.scientificamerican.com/feed/', cat: 'science', freq: 'daily' },
  { name: 'New Scientist', home: 'https://www.newscientist.com/', feed: 'https://www.newscientist.com/feed/', cat: 'science', freq: 'weekly' },
  { name: '果壳', home: 'https://www.guokr.com/', feed: 'https://www.guokr.com/rss/', cat: 'science', freq: 'weekly' },

  /* ---- 哲学哲思 ---- */
  { name: 'Aeon', home: 'https://aeon.co', feed: 'https://aeon.co/feed', cat: 'philosophy', freq: 'daily' },
  { name: 'Daily Nous', home: 'https://dailynous.com/', feed: 'https://dailynous.com/feed/', cat: 'philosophy', freq: 'daily' },
  { name: 'Philosophy Now', home: 'https://philosophynow.org/', feed: 'https://philosophynow.org/feed', cat: 'philosophy', freq: 'weekly' },

  /* ---- 文博人文 ---- */
  { name: '故宫博物院', home: 'https://www.dpm.org.cn/', feed: 'https://www.dpm.org.cn/rss/news.xml', cat: 'museum', freq: 'daily' },
  { name: '中国国家博物馆', home: 'https://www.chnmuseum.cn/', feed: 'https://www.chnmuseum.cn/rss/news.xml', cat: 'museum', freq: 'weekly' },
  { name: '中华遗产', home: 'https://www.zhonghuayichan.cn/', feed: 'https://www.zhonghuayichan.cn/rss', cat: 'museum', freq: 'weekly' },
  { name: '看展日记', home: 'https://zhaiyiming.com/', feed: 'https://zhaiyiming.com/feed.xml', cat: 'museum', freq: 'weekly' },
  { name: '澎湃·文化', home: 'https://www.thepaper.cn/', feed: 'https://www.thepaper.cn/rss_138436', cat: 'museum', freq: 'weekly' },

  /* ---- 游戏人文 ---- */
  { name: '游研社', home: 'https://www.yystv.cn/', feed: 'https://www.yystv.cn/rss/feed', cat: 'game', freq: 'daily' },
  { name: 'IndieNova', home: 'https://indienova.com/', feed: 'https://indienova.com/feed', cat: 'game', freq: 'daily' },
  { name: '机核网', home: 'https://www.gcores.com/', feed: 'https://www.gcores.com/rss', cat: 'game', freq: 'daily' },
  { name: '游资网', home: 'https://www.gameres.com/', feed: 'https://www.gameres.com/feed', cat: 'game', freq: 'weekly' },
  { name: 'Destructoid Features', home: 'https://www.destructoid.com/', feed: 'https://www.destructoid.com/feed/category/features/', cat: 'game', freq: 'weekly' },

  /* ---- 科技数码 ---- */
  { name: 'Hacker News', home: 'https://news.ycombinator.com/', feed: 'https://news.ycombinator.com/rss', cat: 'hardware', freq: 'daily' },
  { name: 'Ars Technica', home: 'https://arstechnica.com/', feed: 'https://feeds.arstechnica.com/arstechnica/index', cat: 'hardware', freq: 'daily' },
  { name: 'The Verge', home: 'https://www.theverge.com/', feed: 'https://www.theverge.com/rss/index.xml', cat: 'hardware', freq: 'daily' },
  { name: 'Engadget', home: 'https://www.engadget.com/', feed: 'https://www.engadget.com/rss.xml', cat: 'hardware', freq: 'daily' },
  { name: 'IT之家', home: 'https://www.ithome.com/', feed: 'https://www.ithome.com/rss/', cat: 'hardware', freq: 'daily' },

  /* ---- 编程开发 ---- */
  { name: 'DEV Community', home: 'https://dev.to/', feed: 'https://dev.to/feed', cat: 'code', freq: 'daily' },
  { name: 'freeCodeCamp', home: 'https://www.freecodecamp.org/news/', feed: 'https://www.freecodecamp.org/news/feed/', cat: 'code', freq: 'weekly' },
  { name: 'Programming Digest', home: 'https://programmingdigest.net/', feed: 'https://programmingdigest.net/feed', cat: 'code', freq: 'weekly' },

  /* ---- 前端设计 ---- */
  { name: 'Smashing Magazine', home: 'https://www.smashingmagazine.com/', feed: 'https://www.smashingmagazine.com/feed/', cat: 'frontend', freq: 'daily' },
  { name: 'CSS-Tricks', home: 'https://css-tricks.com/', feed: 'https://css-tricks.com/feed/', cat: 'frontend', freq: 'daily' },
  { name: 'A List Apart', home: 'https://alistapart.com/', feed: 'https://alistapart.com/main/feed/', cat: 'frontend', freq: 'weekly' },
  { name: 'Sidebar', home: 'https://sidebar.io/', feed: 'https://sidebar.io/feed', cat: 'frontend', freq: 'weekly' },

  /* ---- 学习效率 ---- */
  { name: 'Cal Newport', home: 'https://www.calnewport.com/', feed: 'https://www.calnewport.com/feed/', cat: 'study', freq: 'weekly' },
  { name: '少数派', home: 'https://sspai.com/', feed: 'https://sspai.com/feed', cat: 'study', freq: 'daily' },
  { name: 'Farnam Street', home: 'https://fs.blog/', feed: 'https://fs.blog/feed/', cat: 'study', freq: 'weekly' },

  /* ---- 个人成长 ---- */
  { name: 'Greater Good', home: 'https://greatergood.berkeley.edu/', feed: 'https://greatergood.berkeley.edu/rss/all/', cat: 'growth', freq: 'weekly' },
  { name: 'Psychology Today', home: 'https://www.psychologytoday.com/', feed: 'https://www.psychologytoday.com/us/front/feed', cat: 'growth', freq: 'weekly' },

  /* ---- 音乐文艺 ---- */
  { name: 'Stereogum', home: 'https://www.stereogum.com/', feed: 'https://www.stereogum.com/feed/', cat: 'music', freq: 'weekly' },
  { name: 'Pitchfork', home: 'https://pitchfork.com/', feed: 'https://pitchfork.com/feed/feed-news/rss', cat: 'music', freq: 'weekly' },
  { name: '街声 StreetVoice', home: 'https://streetvoice.com/', feed: 'https://streetvoice.com/rss', cat: 'music', freq: 'weekly' },
];

/* 白名单：命中加权，越高越靠前（粗筛用字面匹配，后续可接语义过滤） */
const PRIORITY = [
  { kw: ['mcp'], w: 12 },
  { kw: ['agent', 'agentic'], w: 11 },
  { kw: ['tool call', 'function call', 'tool use'], w: 10 },
  { kw: ['api'], w: 9 },
  { kw: ['reason', 'gpt-5', 'gpt5', 'gemini', 'claude', 'model', 'llm', 'frontier'], w: 8 },
  { kw: ['image', 'diffusion', 'vision', 'video', 'veo', 'omni'], w: 7 },
  { kw: ['voice', 'speech', 'audio', 'tts', 'inference', 'open model'], w: 7 },
];

/* 黑名单：命中即丢弃 */
const BLOCK = [
  'raise', 'funding', 'series ', 'valuation', 'invest', 'led by',
  'appoint', 'joins as', 'chief executive', 'promot', 'hire', 'depart',
  'opinion', 'perspective', 'hot take', 'webinar', 'sponsor', 'customer story',
];

function catScore(text) {
  const t = ' ' + String(text).toLowerCase() + ' ';
  if (BLOCK.some(b => t.includes(b))) return -1;
  let s = 1;
  for (const p of PRIORITY) if (p.kw.some(k => t.includes(k))) s += p.w;
  return s;
}

/* ---------------- 源健康监控 ---------------- */
function loadHealth() {
  try { return JSON.parse(fs.readFileSync(HEALTH, 'utf8')); } catch (e) { return {}; }
}
function saveHealth(h) {
  try { fs.writeFileSync(HEALTH, JSON.stringify(h, null, 1)); } catch (e) {}
}

/* ---------------- 网络 ---------------- */
async function fetchText(url, timeout = TIMEOUT) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; AntientropyNewsBot/1.0)' },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

/* ---------------- 极简 RSS/Atom 解析（无依赖） ---------------- */
function decodeEnt(s) {
  return String(s)
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function pick(block, tag) {
  const m = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'));
  return m ? m[1] : '';
}
function pickAttr(block, tag, attr) {
  const m = block.match(new RegExp('<' + tag + '[^>]*\\b' + attr + '="([^"]*)"', 'i'));
  return m ? m[1] : '';
}
function parseFeed(xml, source, cat) {
  const out = [];
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const isAtom = /^<entry/i.test(b);
    const title = decodeEnt(pick(b, 'title'));
    let link = isAtom ? pickAttr(b, 'link', 'href') : decodeEnt(pick(b, 'link'));
    if (!link) link = decodeEnt(pick(b, 'id'));
    const pub = isAtom ? pick(b, 'updated') || pick(b, 'published') : pick(b, 'pubDate');
    let summary = decodeEnt(pick(b, 'description') || pick(b, 'summary') || pick(b, 'content') || pick(b, 'content:encoded'));
    summary = summary.slice(0, 240);
    let image = pickAttr(b, 'media:content', 'url') || pickAttr(b, 'media:thumbnail', 'url')
      || pickAttr(b, 'enclosure', 'url');
    if (image && !/image|png|jpg|jpeg|webp/i.test(image)) image = '';
    if (!title || !link) continue;
    out.push({ source, cat: cat || '', title, url: link, publishedAt: pub ? new Date(pub).toISOString().slice(0, 10) : '', summary, image: image || null });
  }
  return out;
}

/* ---------------- 主流程 ---------------- */
(async () => {
  const force = process.argv.includes('--force');
  const health = loadHealth();
  // weekly 源隔天抓：按日期奇偶轮换，防高频请求被源站封
  const dayParity = new Date().getUTCDate() % 2;
  let all = [];
  let okCount = 0;
  let skipped = [];
  for (const s of SOURCES) {
    if (s.freq === 'weekly') {
      const hi = health[s.feed] || {};
      if (dayParity === 0 && (hi.fail || 0) < 3) { /* 偶数天抓 weekly */ }
      else if (dayParity === 1 && (hi.fail || 0) < 3) { skipped.push(s.name + '(周更轮空)'); continue; }
    }
    if ((health[s.feed] || {}).fail >= 3) { skipped.push(s.name + '(健康停抓)'); continue; }
    try {
      const xml = await fetchText(s.feed);
      const items = parseFeed(xml, s.name, s.cat);
      if (items.length) {
        all = all.concat(items); okCount++;
        health[s.feed] = { fail: 0 };
        console.log(`  ✓ ${s.name}(${s.cat}): ${items.length} 条`);
      } else {
        health[s.feed] = { fail: (health[s.feed] || {}).fail + 1 || 1 };
        console.log(`  ~ ${s.name}: 空内容(失败${health[s.feed].fail}次)`);
      }
    } catch (e) {
      health[s.feed] = { fail: (health[s.feed] || {}).fail + 1 || 1 };
      console.log(`  ✗ ${s.name}: ${e.message}`);
    }
  }
  saveHealth(health);
  if (skipped.length) console.log(`  轮空：${skipped.join('、')}`);

  if (!all.length && !force) {
    if (fs.existsSync(OUT)) {
      const cached = JSON.parse(fs.readFileSync(OUT, 'utf8'));
      cached.status = 'cache';
      cached.fetchedAt = new Date().toISOString();
      cached.note = '本次联网全部失败，已回退上一次成功抓取的缓存。';
      fs.writeFileSync(OUT, JSON.stringify(cached, null, 2));
      console.log('全部源失败，已回退并标记缓存。');
      return;
    }
    console.log('无数据且无缓存，退出。');
    return;
  }

  // 容错：去重（url+title）/ 校验日期 / 丢弃空标题
  const seen = {};
  let cleaned = [];
  for (const it of all) {
    if (!it.url) continue;
    const key = it.url + '|' + it.title;
    if (seen[key]) continue;
    if (!it.title) continue;
    if (!it.publishedAt || isNaN(new Date(it.publishedAt).getTime())) continue;
    seen[key] = 1; cleaned.push(it);
  }

  // 打分排序：类别权重 + 时间新鲜度
  const now = Date.now();
  cleaned.forEach(it => {
    const recency = Math.max(0, 30 - (now - new Date(it.publishedAt)) / 864e5);
    it._score = catScore(it.title + ' ' + it.summary) + recency * 0.5;
  });
  cleaned = cleaned.filter(it => it._score >= 0).sort((a, b) => b._score - a._score);
  const freshRaw = cleaned.slice(0, 25);   // 每轮最多新增 25 条

  // 【合并保护】保留已有的人工中文条目（translated:true 或已有 titleZh）
  let prev = [];
  if (!force && fs.existsSync(OUT)) {
    try {
      const d = JSON.parse(fs.readFileSync(OUT, 'utf8'));
      prev = (d.items || []).filter(it => it.translated === true || (it.titleZh && it.titleZh !== it.title));
    } catch (e) { prev = []; }
  }
  const kept = force ? [] : prev;
  const keptUrls = new Set(kept.map(it => it.url));
  const fresh = freshRaw
    .filter(it => !keptUrls.has(it.url))
    .map(it => ({
      id: it.url.replace(/[^a-z0-9]/gi, '').slice(-24) || ('n' + Math.random().toString(36).slice(2, 8)),
      title: it.title,
      titleZh: null,            // 由 AI 翻译步骤补全，不在此编造
      summary: it.summary,
      source: it.source,
      sourceUrl: (SOURCES.find(s => s.name === it.source) || {}).home || '',
      publishedAt: it.publishedAt,
      url: it.url,
      image: it.image,
      tags: [],
      category: it.cat || '',
      translated: false,
    }));

  // 合并：人工中文在前，新增在后；按时间倒序；上限 POOL_CAP
  let items = kept.concat(fresh);
  items.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  items = items.slice(0, POOL_CAP);

  const data = {
    fetchedAt: new Date().toISOString(),
    status: okCount > 0 ? 'live' : 'cache',
    note: okCount > 0
      ? '全品类 40+ 源自动抓取（v3）。中文条目为人工/AI整理保留；新增未译条目保留英文原文。'
      : '联网未成功，已回退缓存。',
    items,
  };

  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(`已写入 news.json：状态=${data.status}，池子=${data.items.length}（保留=${kept.length}，新增=${fresh.length}），源=${okCount}/${SOURCES.length}`);
})();
