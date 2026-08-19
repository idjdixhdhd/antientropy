/**
 * 逆熵 ANTIENTROPY · Cloudflare Worker 轻后端 v3（Service Worker 格式）
 * -------------------------------------------------------------------
 * 功能：
 *   1. /humanize   人话改写（三段式：标题 + 大白话 + 原文引用 + 术语词典）
 *   2. /inspire    灵感清单（按标签生成朋友圈碎片内容）
 *   3. /filter     语义过滤（保留感悟/干货，丢弃攻略/快讯/融资）
 *   4. /status     状态自检
 *   5. Cron 每天 08:00（北京时间，UTC 0 时）：抓 43 个 RSS 源 → 语义过滤
 *      → DeepSeek 三段式翻译 → 写回 GitHub news.json → Pages 自动重建
 *
 * 环境变量（Dashboard → Settings → Variables）：
 *   DEEPSEEK_KEY  你的 DeepSeek API Key（已设置）
 *   GH_TOKEN      GitHub Personal Access Token（写 news.json 用）
 */

addEventListener('fetch', event => {
  LAST_EVENT = event;
  event.respondWith(handle(event.request));
});

let LAST_EVENT = null;

/* 定时触发：每天 08:00 北京时间（cron 用 UTC：0 0 * * *） */
addEventListener('scheduled', event => {
  event.waitUntil(runDailyNews());
});

const GH_REPO = 'idjdixhdhd/antientropy';

async function handle(request) {
  const key = typeof DEEPSEEK_KEY !== 'undefined' ? DEEPSEEK_KEY : '';
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!key) return json({ ok: false, error: 'Worker 未配置 DEEPSEEK_KEY（Settings → Variables）' }, 500, cors);
  try {
    const url = new URL(request.url);
    if (url.pathname === '/ghcheck' && request.method === 'GET') {
      // 诊断：验证 GH_TOKEN 与 GitHub API 连通
      const hasTok = typeof GH_TOKEN !== 'undefined' && GH_TOKEN ? 'yes' : 'no';
      try {
        const old = await ghGet('news.json');
        return json({ ok: true, hasTok, sha: old && old.sha, size: old && old.size }, 200, cors);
      } catch (e) {
        return json({ ok: false, hasTok, err: String((e && e.message) || e) }, 200, cors);
      }
    }
    if (url.pathname === '/status') return json({ ok: true, version: 'v3', sources: SOURCES.length, repo: GH_REPO }, 200, cors);
    if (url.pathname === '/run' && request.method === 'GET') {
      // 手动触发一次每日更新（同步执行，便于验证；Cron 走 scheduled 同样逻辑）
      const log = await runDailyNews();
      return json({ ok: true, log }, 200, cors);
    }
    if (url.pathname === '/test' && request.method === 'GET') {
      const out = await humanize({ item: { title: 'A brand new AI model was released', summary: 'It can reason much faster than before' } }, key);
      return json({ ok: true, result: out }, 200, cors);
    }
    const body = await request.json();
    if (url.pathname === '/humanize') return json({ ok: true, result: await humanize(body, key) }, 200, cors);
    if (url.pathname === '/inspire') return json({ ok: true, result: await inspire(body, key) }, 200, cors);
    if (url.pathname === '/filter') return json({ ok: true, result: await semanticFilter(body, key) }, 200, cors);
    return json({ ok: false, error: '未知路由，可用 /humanize /inspire /filter /status /test' }, 404, cors);
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) }, 500, cors);
  }
}

/* ================= DeepSeek 调用 ================= */
async function callDS(messages, key, max_tokens, temp) {
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: (typeof temp === 'number' ? temp : 0.5), max_tokens }),
  });
  if (!r.ok) throw new Error('DeepSeek HTTP ' + r.status);
  const d = await r.json();
  return (d.choices && d.choices[0] && d.choices[0].message.content) || '';
}

/* ================= 三段式人话改写 ================= */
async function humanize(body, key) {
  const it = body.item || {};
  const src = (it.title || '') + '\n' + (it.summary || '');
  const prompt = [
    '你是给17岁高中新手写中文资讯的学术编辑。',
    '只改写下面这条真实抓取到的内容，禁止编造事实、禁止只给结论不给依据。',
    '输出四段，每段一行，用中文标签开头：',
    '标题：通俗中文标题（不超过20字，让人一眼看懂）',
    '大白话：2-4句解释，讲清"这是什么 / 为什么重要 / 跟你有什么关系"，学术信息不删，只换说法',
    '原文：保留英文关键句（1-2句）+ 中文对照',
    '术语：3-5个专有名词的通俗解释，每行一个，用"词=解释"格式',
    '',
    '资讯：' + src,
  ].join('\n');
  return callDS([{ role: 'user', content: prompt }], key, 800);
}

/* ================= 灵感清单（去 AI 味 · 6 声音 · 用户可选） ================= */
const INSPIRE_VOICES = [
  { name: '夜行者',  desc: '深夜放空的时候写的短句，带一点私人情绪。' },
  { name: '文博旁白', desc: '用展品 / 古建的意象写感悟，克制、有画面。' },
  { name: '歌词体',   desc: '两三句像歌词的片段，留一个记忆点，押不押韵都行。' },
  { name: '冷梗吐槽', desc: '对刚看到的事来一句俏皮点评，允许不完整句，允许网络感。' },
  { name: '现代小诗', desc: '三四行，留白，别抒情过度。' },
  { name: '歌单随笔', desc: '像在给一张私藏歌单写简介，带个人口味。' },
];
async function inspire(body, key) {
  const tags = (body.tags && body.tags.length ? body.tags : ['文博', '华语流行音乐', '游戏人文', '现代诗歌']).join('、');
  const news = Array.isArray(body.news) ? body.news.slice(0, 6) : [];
  const voices = Array.isArray(body.voices) ? body.voices : [];
  const voiceBlock = voices.length
    ? '声音候选（必须从下面挑或混合，别自己造新名字）：\n' + voices.map((v, i) => '  (' + (i + 1) + ') 「' + v.name + '」——' + v.desc).join('\n')
    : '声音自由选择：可以是夜行者、文博旁白、歌词体、冷梗吐槽、现代小诗、歌单随笔。';
  const voiceNames = voices.length ? voices.map(v => v.name).join(' / ') : '';
  const styleHint = ({ boxed: '逐条输出，每条「声音名：内容」一行；', passage: '段落输出，保留声音识别点；', mixed: '怎么舒服怎么写；' })[body.style || 'mixed'] || '';
  const newsText = news.length
    ? '\n\n可参考的今日真实资讯（挑你最有感觉的用，不要逐条复述，不要编造）：\n' +
      news.map((n, i) => '(' + (i + 1) + ') ' + (n.titleZh || n.title || '').slice(0, 40) + ' — ' + (n.summary || '').slice(0, 60)).join('\n')
    : '';
  const prompt = [
    '你是「逆熵」个人工作台的一个真实用户，不是写作 AI，别端着。',
    voiceBlock,
    voiceNames ? '这一条主要用这几个声音：' + voiceNames : '',
    '题材围绕这些标签：【' + tags + '】。',
    '输出格式：' + styleHint,
    '硬性要求：',
    '1. 不用排比，不用口号；',
    '2. 用具体意象 / 生活化口语；',
    '3. 不写正能量总结句；',
    '4. 每条"说完一句完整的话"；',
    '5. 输出必须以「[声音名]：内容」的形式给每条，冒号用中文全角"："。',
    newsText,
  ].filter(Boolean).join('\n');
  const raw = await callDS([{ role: 'user', content: prompt }], key, 800, 0.95);
  const items = parseInspire(raw);
  return JSON.stringify({ items, voices: voices.map(v => v.name), style: body.style || 'mixed' });
}
function parseInspire(raw) {
  const lines = String(raw || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const items = [];
  for (const ln of lines) {
    let m = ln.match(/^[「\[]([^」\]]+)[」\]]\s*[：:]\s*(.+)$/);
    if (m) { items.push({ voice: m[1].trim(), text: m[2].trim() }); continue; }
    m = ln.match(/^[「\[]([^」\]]+)[」\]]\s+(.+)$/);
    if (m) { items.push({ voice: m[1].trim(), text: m[2].trim() }); continue; }
    items.push({ voice: '', text: ln.replace(/^[「\[][^」\]]+[」\]]\s*/, '').trim() });
  }
  return items.filter(i => i.text);
}

/* ================= 语义过滤 ================= */
async function semanticFilter(body, key) {
  const it = body.item || {};
  const prompt = [
    '输入单篇文章标题+摘要，只输出 true 或 false（一个词）。',
    '保留：游戏叙事赏析、玩家游玩感悟、游戏历史文化、开发者手记、怀旧随笔、人物访谈、',
    '文博展览资讯、看展游记、古迹人文随笔、科学发现科普、哲学思辨、新模型/Agent/工具发布。',
    '丢弃：出装、操作教程、竞技攻略、版本公告快讯、硬件评测、售卖周边资讯、融资人事、纯观点。',
    '标题：' + (it.title || ''),
    '摘要：' + (it.summary || ''),
  ].join('\n');
  const out = await callDS([{ role: 'user', content: prompt }], key, 10);
  return out.trim().toLowerCase().indexOf('true') === 0;
}

/* ================= RSS 抓取（移植自 fetch-news.cjs） ================= */
const SOURCES = [
  { name: 'OpenAI', home: 'https://openai.com/news', feed: 'https://openai.com/news/rss.xml', cat: 'ai', freq: 'daily' },
  { name: 'GitHub', home: 'https://github.blog/changelog/', feed: 'https://github.blog/changelog/feed/', cat: 'ai', freq: 'daily' },
  { name: 'Google', home: 'https://blog.google/technology/ai/', feed: 'https://blog.google/technology/ai/rss/', cat: 'ai', freq: 'daily' },
  { name: 'Hugging Face', home: 'https://huggingface.co/blog', feed: 'https://huggingface.co/blog/feed.xml', cat: 'opensource', freq: 'daily' },
  { name: 'Anthropic', home: 'https://www.anthropic.com/news', feed: 'https://www.anthropic.com/rss.xml', cat: 'ai', freq: 'weekly' },
  { name: 'DeepMind', home: 'https://deepmind.google/discover/blog/', feed: 'https://deepmind.google/blog/rss.xml', cat: 'ai', freq: 'weekly' },
  { name: 'MIT Tech Review AI', home: 'https://www.technologyreview.com/topic/artificial-intelligence/', feed: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', cat: 'ai', freq: 'weekly' },
  { name: 'Simon Willison', home: 'https://simonwillison.net/', feed: 'https://simonwillison.net/atom/everything/', cat: 'ai101', freq: 'daily' },
  { name: '量子位', home: 'https://www.qbitai.com/', feed: 'https://www.qbitai.com/feed', cat: 'ai101', freq: 'daily' },
  { name: 'Quanta Magazine', home: 'https://www.quantamagazine.org', feed: 'https://www.quantamagazine.org/feed/', cat: 'science', freq: 'daily' },
  { name: 'Scientific American', home: 'https://www.scientificamerican.com/', feed: 'https://www.scientificamerican.com/feed/', cat: 'science', freq: 'daily' },
  { name: 'New Scientist', home: 'https://www.newscientist.com/', feed: 'https://www.newscientist.com/feed/', cat: 'science', freq: 'weekly' },
  { name: '果壳', home: 'https://www.guokr.com/', feed: 'https://www.guokr.com/rss/', cat: 'science', freq: 'weekly' },
  { name: 'Aeon', home: 'https://aeon.co', feed: 'https://aeon.co/feed', cat: 'philosophy', freq: 'daily' },
  { name: 'Daily Nous', home: 'https://dailynous.com/', feed: 'https://dailynous.com/feed/', cat: 'philosophy', freq: 'daily' },
  { name: 'Philosophy Now', home: 'https://philosophynow.org/', feed: 'https://philosophynow.org/feed', cat: 'philosophy', freq: 'weekly' },
  { name: '故宫博物院', home: 'https://www.dpm.org.cn/', feed: 'https://www.dpm.org.cn/rss/news.xml', cat: 'museum', freq: 'daily' },
  { name: '中国国家博物馆', home: 'https://www.chnmuseum.cn/', feed: 'https://www.chnmuseum.cn/rss/news.xml', cat: 'museum', freq: 'weekly' },
  { name: '中华遗产', home: 'https://www.zhonghuayichan.cn/', feed: 'https://www.zhonghuayichan.cn/rss', cat: 'museum', freq: 'weekly' },
  { name: '看展日记', home: 'https://zhaiyiming.com/', feed: 'https://zhaiyiming.com/feed.xml', cat: 'museum', freq: 'weekly' },
  { name: '澎湃·文化', home: 'https://www.thepaper.cn/', feed: 'https://www.thepaper.cn/rss_138436', cat: 'museum', freq: 'weekly' },
  { name: '游研社', home: 'https://www.yystv.cn/', feed: 'https://www.yystv.cn/rss/feed', cat: 'game', freq: 'daily' },
  { name: 'IndieNova', home: 'https://indienova.com/', feed: 'https://indienova.com/feed', cat: 'game', freq: 'daily' },
  { name: '机核网', home: 'https://www.gcores.com/', feed: 'https://www.gcores.com/rss', cat: 'game', freq: 'daily' },
  { name: '游资网', home: 'https://www.gameres.com/', feed: 'https://www.gameres.com/feed', cat: 'game', freq: 'weekly' },
  { name: 'Destructoid Features', home: 'https://www.destructoid.com/', feed: 'https://www.destructoid.com/feed/category/features/', cat: 'game', freq: 'weekly' },
  { name: 'Hacker News', home: 'https://news.ycombinator.com/', feed: 'https://news.ycombinator.com/rss', cat: 'hardware', freq: 'daily' },
  { name: 'Ars Technica', home: 'https://arstechnica.com/', feed: 'https://feeds.arstechnica.com/arstechnica/index', cat: 'hardware', freq: 'daily' },
  { name: 'The Verge', home: 'https://www.theverge.com/', feed: 'https://www.theverge.com/rss/index.xml', cat: 'hardware', freq: 'daily' },
  { name: 'Engadget', home: 'https://www.engadget.com/', feed: 'https://www.engadget.com/rss.xml', cat: 'hardware', freq: 'daily' },
  { name: 'IT之家', home: 'https://www.ithome.com/', feed: 'https://www.ithome.com/rss/', cat: 'hardware', freq: 'daily' },
  { name: 'DEV Community', home: 'https://dev.to/', feed: 'https://dev.to/feed', cat: 'code', freq: 'daily' },
  { name: 'freeCodeCamp', home: 'https://www.freecodecamp.org/news/', feed: 'https://www.freecodecamp.org/news/feed/', cat: 'code', freq: 'weekly' },
  { name: 'Programming Digest', home: 'https://programmingdigest.net/', feed: 'https://programmingdigest.net/feed', cat: 'code', freq: 'weekly' },
  { name: 'Smashing Magazine', home: 'https://www.smashingmagazine.com/', feed: 'https://www.smashingmagazine.com/feed/', cat: 'frontend', freq: 'daily' },
  { name: 'CSS-Tricks', home: 'https://css-tricks.com/', feed: 'https://css-tricks.com/feed/', cat: 'frontend', freq: 'daily' },
  { name: 'A List Apart', home: 'https://alistapart.com/', feed: 'https://alistapart.com/main/feed/', cat: 'frontend', freq: 'weekly' },
  { name: 'Sidebar', home: 'https://sidebar.io/', feed: 'https://sidebar.io/feed', cat: 'frontend', freq: 'weekly' },
  { name: 'Cal Newport', home: 'https://www.calnewport.com/', feed: 'https://www.calnewport.com/feed/', cat: 'study', freq: 'weekly' },
  { name: '少数派', home: 'https://sspai.com/', feed: 'https://sspai.com/feed', cat: 'study', freq: 'daily' },
  { name: 'Farnam Street', home: 'https://fs.blog/', feed: 'https://fs.blog/feed/', cat: 'study', freq: 'weekly' },
  { name: 'Greater Good', home: 'https://greatergood.berkeley.edu/', feed: 'https://greatergood.berkeley.edu/rss/all/', cat: 'growth', freq: 'weekly' },
  { name: 'Psychology Today', home: 'https://www.psychologytoday.com/', feed: 'https://www.psychologytoday.com/us/front/feed', cat: 'growth', freq: 'weekly' },
  { name: 'Stereogum', home: 'https://www.stereogum.com/', feed: 'https://www.stereogum.com/feed/', cat: 'music', freq: 'weekly' },
  { name: 'Pitchfork', home: 'https://pitchfork.com/', feed: 'https://pitchfork.com/feed/feed-news/rss', cat: 'music', freq: 'weekly' },
];

const BLOCK = ['raise', 'funding', 'series ', 'valuation', 'invest', 'led by', 'appoint', 'joins as', 'chief executive', 'promot', 'hire', 'depart', 'opinion', 'perspective', 'hot take', 'webinar', 'sponsor', 'customer story'];

function catScore(text) {
  const t = ' ' + String(text).toLowerCase() + ' ';
  if (BLOCK.some(b => t.includes(b))) return -1;
  return 1;
}

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
    let image = pickAttr(b, 'media:content', 'url') || pickAttr(b, 'media:thumbnail', 'url') || pickAttr(b, 'enclosure', 'url');
    if (image && !/image|png|jpg|jpeg|webp/i.test(image)) image = '';
    if (!title || !link) continue;
    out.push({ source, cat, title, url: link, publishedAt: pub ? new Date(pub).toISOString().slice(0, 10) : '', summary, image: image || null });
  }
  return out;
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; AntientropyBot/1.0)' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
/* 并发抓取一批源（每批 10 个），大幅压缩墙钟时间 */
async function fetchBatch(batch) {
  const rs = await Promise.all(batch.map(async s => {
    try {
      const xml = await fetchText(s.feed);
      const items = parseFeed(xml, s.name, s.cat);
      if (items.length) { await healthReset(s.feed); return items; }
      await healthInc(s.feed); return [];
    } catch (e) { await healthInc(s.feed); return []; }
  }));
  return rs.flat();
}

/* ---------------- 健康监控（Cache API，尽力而为） ---------------- */
async function healthGet(feed) {
  try {
    const cache = await caches.open('ae-health');
    const r = await cache.match('https://ae.local/' + encodeURIComponent(feed));
    if (!r) return 0;
    return parseInt((await r.text()) || '0', 10) || 0;
  } catch (e) { return 0; }
}
async function healthInc(feed) {
  try {
    const cache = await caches.open('ae-health');
    const cur = await healthGet(feed);
    await cache.put('https://ae.local/' + encodeURIComponent(feed), new Response(String(cur + 1)));
  } catch (e) {}
}
async function healthReset(feed) {
  try {
    const cache = await caches.open('ae-health');
    await cache.put('https://ae.local/' + encodeURIComponent(feed), new Response('0'));
  } catch (e) {}
}

/* ---------------- GitHub 读写 ---------------- */
function b64utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
async function ghGet(path) {
  const r = await fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + path, {
    headers: { 'Authorization': 'Bearer ' + GH_TOKEN, 'Accept': 'application/vnd.github+json', 'User-Agent': 'antientropy-worker' },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GH GET ' + r.status);
  return await r.json();
}
async function ghPut(path, content, message) {
  const old = await ghGet(path);
  const body = { message, content: b64utf8(content) };
  if (old && old.sha) body.sha = old.sha;
  const r = await fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + path, {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + GH_TOKEN, 'Accept': 'application/vnd.github+json', 'User-Agent': 'antientropy-worker', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('GH PUT ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return await r.json();
}

/* 核心源（平日抓 12 个覆盖 9 类；周日全量 43 源）
   免费版 Worker 单次请求有执行时长限制，必须控制在 ~20s 内 */
const CORE_NAMES = [
  'OpenAI', 'GitHub', 'Google', 'Hugging Face',
  'Quanta Magazine', 'Aeon',
  '游研社', 'IndieNova', '故宫博物院',
  'Hacker News', 'Smashing Magazine', 'DEV Community',
];

/* ---------------- 每日自动更新主流程 ---------------- */
async function runDailyNews() {
  const log = [];
  const key = typeof DEEPSEEK_KEY !== 'undefined' ? DEEPSEEK_KEY : '';
  const gh = typeof GH_TOKEN !== 'undefined' ? GH_TOKEN : '';
  if (!gh) return 'no GH_TOKEN';
  try {
    // 1) 并发抓取源（周日全量 43，平日核心 20；每批 10 个并发，30s 内跑完）
    const utcDay = new Date().getUTCDay();
    const isFull = utcDay === 0;
    const dayParity = new Date().getUTCDate() % 2;
    const active = (isFull ? SOURCES : SOURCES.filter(s => CORE_NAMES.includes(s.name)))
      .filter(s => !(s.freq === 'weekly' && dayParity === 1 && !isFull));
    let all = [];
    let okCount = 0;
    for (let i = 0; i < active.length; i += 10) {
      const batch = active.slice(i, i + 10);
      const items = await fetchBatch(batch);
      if (items.length) okCount += batch.length;
      all = all.concat(items);
    }
    log.push('抓取源 ' + okCount + '/' + active.length);
    if (!all.length) return '抓取全部失败';

    // 2) 清洗去重 + 打分
    const seen = {};
    let cleaned = [];
    for (const it of all) {
      if (!it.url || !it.title) continue;
      if (!it.publishedAt || isNaN(new Date(it.publishedAt).getTime())) continue;
      const k = it.url + '|' + it.title;
      if (seen[k]) continue;
      seen[k] = 1; cleaned.push(it);
    }
    const now = Date.now();
    cleaned.forEach(it => {
      const recency = Math.max(0, 30 - (now - new Date(it.publishedAt)) / 864e5);
      it._score = catScore(it.title + ' ' + it.summary) + recency * 0.5;
    });
    cleaned = cleaned.filter(it => it._score >= 0).sort((a, b) => b._score - a._score);
    // 类别均衡取样：每类最多 5 条，防止英文开发源把中文/兴趣类冲掉
    const catCount = {};
    const freshRaw = [];
    for (const it of cleaned) {
      const c = it.cat || 'other';
      if ((catCount[c] || 0) >= 5) continue;
      catCount[c] = (catCount[c] || 0) + 1;
      freshRaw.push(it);
      if (freshRaw.length >= 25) break;
    }

    // 3) 读取线上最新 news.json，合并保护（保留已翻译条目）
    const cur = await ghGet('news.json');
    let prevItems = [];
    if (cur && cur.content) {
      try {
        const decoded = decodeURIComponent(escape(atob(cur.content.replace(/\n/g, ''))));
        const d = JSON.parse(decoded);
        prevItems = (d.items || []).filter(it => it.translated === true || (it.titleZh && it.titleZh !== it.title));
      } catch (e) {}
    }
    const keptUrls = new Set(prevItems.map(it => it.url));
    const fresh = freshRaw.filter(it => !keptUrls.has(it.url));
    log.push('新增候选 ' + fresh.length + ' 条');

    // 4) 对新条目用 DeepSeek 三段式翻译（并发前 6 条，控成本与执行时长）
    const MAX_TRANSLATE = 6;
    const toTranslate = fresh.slice(0, MAX_TRANSLATE);
    const untranslated = fresh.slice(MAX_TRANSLATE);
    let translatedCount = 0;
    if (key && toTranslate.length) {
      const results = await Promise.all(toTranslate.map(async it => {
        try {
          const out = await humanize({ item: { title: it.title, summary: it.summary } }, key);
          const lines = out.split('\n').map(x => x.trim()).filter(Boolean);
          let titleZh = '', plain = '', quote = '', terms = [];
          for (const ln of lines) {
            if (/^标题[:：]/.test(ln)) titleZh = ln.replace(/^标题[:：]/, '').trim();
            else if (/^大白话[:：]/.test(ln)) plain = ln.replace(/^大白话[:：]/, '').trim();
            else if (/^原文[:：]/.test(ln)) quote = ln.replace(/^原文[:：]/, '').trim();
            else if (/[=＝]/.test(ln) && /^[^：]{1,12}[=＝]/.test(ln)) terms.push(ln.trim());
          }
          if (!titleZh && !plain) { titleZh = ''; plain = out.slice(0, 140); }
          return { it, titleZh, plain, quote, terms, ok: true };
        } catch (e) { return { it, ok: false }; }
      }));
      for (const r of results) {
        if (r.ok) {
          r.it.titleZh = r.titleZh || null;
          r.it.summary = r.plain || r.it.summary;
          r.it.quote = r.quote || null;
          r.it.terms = r.terms.length ? r.terms : null;
          r.it.translated = true;
          translatedCount++;
        } else { r.it.translated = false; }
      }
    }
    untranslated.forEach(it => { it.translated = false; });
    log.push('翻译 ' + translatedCount + ' 条');

    // 5) 合并写回
    const freshMapped = fresh.map(it => ({
      id: it.url.replace(/[^a-z0-9]/gi, '').slice(-24) || ('n' + Math.random().toString(36).slice(2, 8)),
      title: it.title,
      titleZh: it.titleZh || null,
      summary: it.summary || '',
      quote: it.quote || null,
      terms: it.terms || null,
      source: it.source,
      sourceUrl: (SOURCES.find(s => s.name === it.source) || {}).home || '',
      publishedAt: it.publishedAt,
      url: it.url,
      image: it.image,
      tags: [],
      category: it.cat || '',
      translated: !!it.translated,
    }));
    let items = prevItems.concat(freshMapped);
    items.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
    items = items.slice(0, 50);
    const data = {
      fetchedAt: new Date().toISOString(),
      status: okCount > 0 ? 'live' : 'cache',
      note: '全品类自动抓取（v3 Cron）。新增条目已由 DeepSeek 三段式翻译；未译保留英文。',
      items,
    };
    await ghPut('news.json', JSON.stringify(data, null, 2), '每日资讯自动更新 v3 ' + new Date().toISOString().slice(0, 10));
    log.push('已写入 news.json：' + items.length + ' 条');
    try { await ghPut('worker-debug.json', JSON.stringify({ ts: new Date().toISOString(), ok: true, log }, null, 2), 'debug ok'); } catch (e) {}
    return log.join(' | ');
  } catch (e) {
    const err = 'runDailyNews 失败: ' + (e && e.message) + ' [' + log.join(';') + ']';
    try { await ghPut('worker-debug.json', JSON.stringify({ ts: new Date().toISOString(), ok: false, err, log }, null, 2), 'debug err'); } catch (e2) {}
    return err;
  }
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
