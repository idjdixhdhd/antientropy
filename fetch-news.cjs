#!/usr/bin/env node
/* ==========================================================
   逆熵 ANTIENTROPY · 真实 AI 资讯数据管线
   ----------------------------------------------------------
   只从可验证的官方公开源读取 RSS，做筛选/去重/校验，
   输出 news.json 供站点读取。纯 Node（无需 npm 安装，
   Node 18+ 自带 fetch）。

   设计原则（对齐第三轮提示词）：
   1. 只抓官方源：OpenAI News / GitHub Changelog / Google AI Blog / Hugging Face Blog
   2. 优先模型/Agent/MCP/工具调用/API/图像/视频/语音/推理；过滤融资/人事/观点
   3. 每条保存：原始标题、中文标题(留空待 AI 译)、中文摘要(留空待 AI 译)、
      来源、发布时间、原文 URL、图片 URL、标签、抓取时间
   4. 图片优先 RSS media → 其次 og:image → 没有则 null（站点用来源占位，不伪造）
   5. 每天取重要性最高的 10 条；翻译由 AI 在二次整理时完成，失败保留英文不编造
   6. 全部源失败 → 回退上一次成功缓存并标 status:'cache'；仅成功联网才标 'live'
   7. 所有卡片点击打开官方原文（url 字段）
   8. 容错：重复链接/无效日期/空摘要/超时/断网 各自 try-catch 不影响整体

   用法：
     node fetch-news.cjs            # 抓取并写 news.json
     node fetch-news.cjs --force    # 即使全失败也覆盖（调试用）
   ========================================================== */

'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'news.json');
const TIMEOUT = 9000;
const TOP_N = 10;

/* 官方公开 RSS 源（任一失效都不影响其它源） */
const SOURCES = [
  { name: 'OpenAI', home: 'https://openai.com/news', feed: 'https://openai.com/news/rss.xml' },
  { name: 'GitHub', home: 'https://github.blog/changelog/', feed: 'https://github.blog/changelog/feed/' },
  { name: 'Google', home: 'https://blog.google/technology/ai/', feed: 'https://blog.google/technology/ai/rss/' },
  { name: 'Hugging Face', home: 'https://huggingface.co/blog', feed: 'https://huggingface.co/blog/feed.xml' },
];

/* 优先类别（命中加权越高越靠前） */
const PRIORITY = [
  { kw: ['mcp'], w: 12 },
  { kw: ['agent', 'agentic'], w: 11 },
  { kw: ['tool call', 'function call', 'tool use'], w: 10 },
  { kw: ['api'], w: 9 },
  { kw: ['reason', 'o1', 'o3', 'gpt-5', 'gpt5', 'gemini', 'claude', 'model', 'llm', 'frontier'], w: 8 },
  { kw: ['image', 'diffusion', 'vision'], w: 7 },
  { kw: ['video', 'veo', 'sora', 'omni'], w: 7 },
  { kw: ['voice', 'speech', 'audio', 'tts'], w: 7 },
  { kw: ['inference', 'train', 'fine-tun', 'open weight', 'open model'], w: 7 },
];

/* 过滤类别（命中即丢弃） */
const BLOCK = [
  'raise', 'funding', 'series ', 'valuation', 'invest', 'led by',
  'appoint', 'joins as', 'chief executive', 'promot', 'hire', 'depart',
  'opinion', 'perspective', 'why we', 'hot take', 'interview', 'podcast',
  'webinar', 'event', 'conference', 'sponsor', 'partnership with', 'customer story',
];

function catScore(text) {
  const t = ' ' + String(text).toLowerCase() + ' ';
  if (BLOCK.some(b => t.includes(b))) return -1;        // 直接过滤
  let s = 1;
  for (const p of PRIORITY) if (p.kw.some(k => t.includes(k))) s += p.w;
  return s;
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
function parseFeed(xml, source) {
  const out = [];
  // RSS 2.0: <item>   /   Atom: <entry>
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const isAtom = /^<entry/i.test(b);
    const title = decodeEnt(pick(b, 'title'));
    let link = isAtom ? pickAttr(b, 'link', 'href') : decodeEnt(pick(b, 'link'));
    if (!link) link = decodeEnt(pick(b, 'id'));
    const pub = isAtom ? pick(b, 'updated') || pick(b, 'published') : pick(b, 'pubDate');
    let summary = decodeEnt(pick(b, 'description') || pick(b, 'summary') || pick(b, 'content') || pick(b, 'content:encoded'));
    summary = summary.slice(0, 240);
    // 图片：优先 media:content / media:thumbnail，其次 enclosure
    let image = pickAttr(b, 'media:content', 'url') || pickAttr(b, 'media:thumbnail', 'url')
      || pickAttr(b, 'enclosure', 'url');
    if (image && !/image|png|jpg|jpeg|webp/i.test(image)) image = '';
    if (!title || !link) continue;
    out.push({ source, title, url: link, publishedAt: pub ? new Date(pub).toISOString().slice(0, 10) : '', summary, image: image || null });
  }
  return out;
}

/* 补 og:image（仅对最终入选条目，带超时与失败兜底） */
async function fillOgImage(items) {
  await Promise.all(items.map(async (it) => {
    if (it.image) return;
    try {
      const html = await fetchText(it.url, 6000);
      const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (m) it.image = m[1];
    } catch (e) { /* 保持 null，站点用来源占位 */ }
  }));
}

/* ---------------- 主流程 ---------------- */
(async () => {
  const force = process.argv.includes('--force');
  let all = [];
  let okCount = 0;
  for (const s of SOURCES) {
    try {
      const xml = await fetchText(s.feed);
      const items = parseFeed(xml, s.name);
      if (items.length) { all = all.concat(items); okCount++; }
      console.log(`  ✓ ${s.name}: ${items.length} 条`);
    } catch (e) {
      console.log(`  ✗ ${s.name}: ${e.message}`);
    }
  }

  if (!all.length && !force) {
    // 全部失败 → 回退缓存
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

  // 容错：去重条目 / 校验日期 / 丢弃空标题
  // 去重键用 url+title：同一来源页上的不同公告（URL 相同、标题不同）不算重复
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
    const recency = Math.max(0, 30 - (now - new Date(it.publishedAt)) / 864e5); // 越新越高，封顶 30 天
    it._score = catScore(it.title + ' ' + it.summary) + recency * 0.5;
  });
  cleaned = cleaned.filter(it => it._score >= 0).sort((a, b) => b._score - a._score);
  const top = cleaned.slice(0, TOP_N);

  await fillOgImage(top);

  const data = {
    fetchedAt: new Date().toISOString(),
    status: okCount > 0 ? 'live' : 'cache',
    note: okCount > 0
      ? '由真实官方公开源抓取并结构化。中文标题/摘要由 AI 在二次整理时补全，未译时保留英文原文。'
      : '联网未成功，已回退缓存。',
    items: top.map(it => ({
      id: it.url.replace(/[^a-z0-9]/gi, '').slice(-24) || ('n' + Math.random().toString(36).slice(2, 8)),
      title: it.title,
      titleZh: null,            // 由 AI 翻译步骤补全，不在此编造
      summary: it.summary,
      source: it.source,
      sourceUrl: SOURCES.find(s => s.name === it.source).home,
      publishedAt: it.publishedAt,
      url: it.url,
      image: it.image,          // 无则 null → 站点用来源占位
      tags: [],                 // 由 AI 整理时打标
      translated: false,
    })),
  };

  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(`已写入 news.json：状态=${data.status}，入选=${data.items.length} 条（来自 ${okCount}/${SOURCES.length} 个源）。`);
})();
