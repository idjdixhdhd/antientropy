/* ==========================================================
   逆熵 ANTIENTROPY · app.js
   可拍摄约束：
     1) 视觉不依赖 Math.random —— 伪随机统一走 mulberry32(SEED)
     2) 日期可被 ?today=YYYY-MM-DD 锁定 —— 保证重复渲染画面一致
     3) 主题只改 CSS 变量 —— 整页色板可瞬时切换
   ========================================================== */
'use strict';

const SEED = 20260818;
const LS_KEY = 'antientropy.v1';
const CYCLE_LIMIT_H = 48;          // 超过 48 小时未推进 → 该线周期归零
const BODY_TARGET = 21;            // 身体账户一周目标存入次数
const LOVE_TARGET = 20;            // 在意的人彩蛋阈值

/* ---------------- 基础工具 ---------------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const p2 = n => (n < 10 ? '0' : '') + n;
const dKey = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
function shiftKey(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return dKey(dt);
}
function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = t => 1 - Math.pow(1 - t, 3);

/* 时间锚点：可被 URL 锁定，方便逐帧拍摄时保持一致 */
const FIXED_TODAY = new URLSearchParams(location.search).get('today');
const NOW = FIXED_TODAY ? keyToDate(FIXED_TODAY).getTime() + 21 * 3600e3 : Date.now();
const TODAY = FIXED_TODAY || dKey(new Date(NOW));

/* ---------------- 图标（统一 SVG 线性，禁 emoji） ---------------- */
const ICO = {
  mark: '<rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.2"/><path d="M6.4 16.6 10 12.1l3 2.6 4.6-7.2"/><circle cx="17.6" cy="7.5" r="1.8" fill="currentColor" stroke="none"/>',
  trend: '<path d="M22 7.5 13.6 15.9l-5-5L2 17.4"/><path d="M16.2 7.5H22v5.8"/>',
  checks: '<path d="M9 11.2l2.8 2.8L21.6 4.2"/><path d="M20.8 12.2v6.6a2 2 0 0 1-2 2H5.2a2 2 0 0 1-2-2V5.2a2 2 0 0 1 2-2h10.6"/>',
  person: '<circle cx="12" cy="4.6" r="1.7"/><path d="m8.8 20.6 3.2-6.4 3.2 6.4"/><path d="m6.2 8.4 5.8 2 5.8-2"/><path d="M12 10.4v3.8"/>',
  heart: '<path d="M19 14.2c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3.2c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.7c0 2.3 1.5 4 3 5.5l7 6.9Z"/>',
  radar: '<circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="5.6"/><circle cx="12" cy="12" r="2"/><path d="M12 12 19.4 4.8"/>',
  palette: '<path d="M12 2.6C6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1.1 0-.9.7-1.6 1.6-1.6h1.8c3 0 5.4-2.4 5.4-5.4 0-4.4-4.3-8-9.6-8Z"/><circle cx="8.4" cy="7.6" r=".9" fill="currentColor" stroke="none"/><circle cx="13.4" cy="6.6" r=".9" fill="currentColor" stroke="none"/><circle cx="6.6" cy="12.4" r=".9" fill="currentColor" stroke="none"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  trash: '<path d="M3.4 6.2h17.2"/><path d="M8.4 6.2V4.4a1.4 1.4 0 0 1 1.4-1.4h4.4a1.4 1.4 0 0 1 1.4 1.4v1.8"/><path d="M18.6 6.2 17.7 19a1.6 1.6 0 0 1-1.6 1.5H7.9A1.6 1.6 0 0 1 6.3 19L5.4 6.2"/><path d="M10.2 10.4v6"/><path d="M13.8 10.4v6"/>',
  check: '<path d="M20 6.4 9 17.4l-5-5"/>',
  replay: '<path d="M3 12a9 9 0 1 0 9-9 9.7 9.7 0 0 0-6.7 2.7L3 8"/><path d="M3 3.2v5h5"/>',
  info: '<circle cx="12" cy="12" r="9.2"/><path d="M12 16.4v-4.8"/><path d="M12 8h.02"/>',
  alert: '<path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9.2v4"/><path d="M12 16.8h.02"/>',
  dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
  plug: '<path d="M12 21.4v-4.6"/><path d="M9 8V2.6"/><path d="M15 8V2.6"/><path d="M18 8v3a6 6 0 0 1-12 0V8Z"/>',
  inbox: '<path d="M21.4 12.4h-5.6l-1.8 2.8H10l-1.8-2.8H2.6"/><path d="M5.7 5.3 2.6 12v6a2 2 0 0 0 2 2h14.8a2 2 0 0 0 2-2v-6l-3.1-6.7a2 2 0 0 0-1.8-1.1H7.5a2 2 0 0 0-1.8 1.1Z"/>',
  book: '<path d="M4 19.4A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2.6H20v18.8H6.5A2.5 2.5 0 0 1 4 18.9V5.1a2.5 2.5 0 0 1 2.5-2.5Z"/>',
  code: '<path d="m17.8 15.8 3.8-3.8-3.8-3.8"/><path d="m6.2 8.2-3.8 3.8 3.8 3.8"/><path d="m14.4 4-4.8 16"/>',
  spark: '<path d="M12 2.6 14.4 9l6.4 2.4-6.4 2.4L12 20l-2.4-6.2-6.4-2.4L9.6 9Z"/><path d="M19 4.2 19.9 6.4l2.2.9-2.2.9L19 10.4l-.9-2.2-2.2-.9 2.2-.9Z"/>',
  bookmark: '<path d="M6.2 3.4h11.6a1 1 0 0 1 1 1v16.2l-6.8-4.4-6.8 4.4V4.4a1 1 0 0 1 1-1Z"/>',
  copy: '<rect x="8.4" y="8.4" width="12" height="12" rx="1.8"/><path d="M15.6 5.2H5.2v10.4"/>',
  quote: '<path d="M10 8.2H4.6v5.4H8c0 1.9-1 3.1-2.6 3.6l.8 2.1c2.7-.7 4.6-3 4.6-6V8.2a2 2 0 0 0-.8-1.6Z"/><path d="M21.4 8.2H16v5.4h3.4c0 1.9-1 3.1-2.6 3.6l.8 2.1c2.7-.7 4.6-3 4.6-6V8.2a2 2 0 0 0-.8-1.6Z"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  music: '<path d="M9 18V5l10-2v13"/><circle cx="6.4" cy="18" r="2.6"/><circle cx="16.4" cy="16" r="2.6"/>',
};
function ico(name, size) {
  const s = size || 24;
  return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" '
    + 'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (ICO[name] || '') + '</svg>';
}
function paintIcons(root) {
  $$('[data-icon]', root || document).forEach(el => {
    if (el.dataset.painted) return;
    el.innerHTML = ico(el.dataset.icon);
    el.dataset.painted = '1';
    const svg = el.firstChild;
    if (svg) { svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); }
  });
}

/* ---------------- 视图定义 ---------------- */
const VIEWS = [
  { id: 'mainline', name: '主线复利', short: '主线', icon: 'trend' },
  { id: 'today', name: '今日必须完成', short: '今日', icon: 'checks' },
  { id: 'body', name: '身体账户', short: '身体', icon: 'person' },
  { id: 'love', name: '微光', short: '微光', icon: 'spark' },
  { id: 'radar', name: '灵感雷达', short: '雷达', icon: 'radar' },
  { id: 'inspire', name: '灵感清单', short: '灵感', icon: 'spark' },
  { id: 'music', name: '音乐 BGM', short: '音乐', icon: 'music' },
];
const THEMES = ['mint', 'ember', 'indigo'];

const HABITS = [
  { id: 'move', name: '运动 30 分钟', sub: '跑步、跳绳、打球都算' },
  { id: 'sleep', name: '23 点前躺下', sub: '手机放到伸手不及的地方' },
  { id: 'nodrink', name: '今天没喝饮料', sub: '白水和茶不算' },
  { id: 'water', name: '喝够 1.5 升水', sub: '别等到渴' },
  { id: 'outdoor', name: '出门走 10 分钟', sub: '看一次远处' },
];

/* ---------------- 演示数据（确定性生成） ----------------
   复利曲线形态：刻意设计成"前段平缓起伏、中后段逐步抬升、末段明显变陡"
   —— 不是均匀斜线。形态由复幂曲线决定（确定性），只在幅度上叠加受控抖动。 */
function compoundCurve(totalDays, slope) {
  // 累积增量形态：前段小、后段陡。e^形式天然复制利感
  const base = [];
  for (let i = 1; i <= totalDays; i++) {
    const t = i / totalDays;
    base.push(Math.pow(t, 1.85) * slope);            // 幂函数：前缓后陡
  }
  return base;
}
function seedRecs(seedN, days, minV, maxV, endOffset, slope) {
  const rnd = mulberry32(seedN);
  const curve = compoundCurve(Math.max(days, 2), slope || 1);
  const recs = {};
  const span = Math.max(1, maxV - minV);
  for (let i = days - 1 + endOffset; i >= endOffset; i--) {
    const isLast = i === endOffset;
    if (rnd() < 0.10 && !isLast) continue;            // 偶尔漏一天，更像真实累计
    const b = curve[days - 1 - (i - endOffset)];
    // 受控抖动 ±14%，但保留"末段更陡"的形态
    const jitter = 1 + (rnd() * 2 - 1) * 0.14;
    recs[shiftKey(TODAY, -i)] = Math.max(1, Math.round(b * jitter));
  }
  return recs;
}
function seedBody() {
  const rnd = mulberry32(SEED + 7);
  const recs = {};
  const dow = (keyToDate(TODAY).getDay() + 6) % 7;   // 周一为 0
  for (let i = dow; i >= 0; i--) {
    const k = shiftKey(TODAY, -i);
    const list = [];
    HABITS.forEach(h => { if (rnd() < 0.55) list.push(h.id); });
    if (list.length) recs[k] = list;
  }
  return recs;
}

/* 自定义习惯：localStorage 存储，未设置则用 HABITS 默认 */
const HABITS_KEY = 'ae_habits_v2';
function getHabits() {
  try {
    const list = JSON.parse(localStorage.getItem(HABITS_KEY) || 'null');
    if (Array.isArray(list) && list.length) return list;
  } catch (e) {}
  return HABITS.slice();
}
function setHabits(list) { try { localStorage.setItem(HABITS_KEY, JSON.stringify(list)); } catch (e) {} }
function addHabit() {
  const name = (window.prompt('新习惯名称（如：睡够 8 小时 / 走 5000 步 / 不点外卖）') || '').trim();
  if (!name) return;
  const sub = (window.prompt('简短描述（可选，如：不吃甜食）') || '').trim();
  const list = getHabits();
  list.push({ id: 'h' + Date.now().toString(36), name, sub });
  setHabits(list);
  toast('已添加：' + name);
  renderBody();
}
function delHabit(id) {
  if (!window.confirm('删除这条习惯？今日已存入的也会一起清掉。')) return;
  const list = getHabits().filter(h => h.id !== id);
  setHabits(list);
  const today = S.body[TODAY] || (S.body[TODAY] = []);
  if (today.length) { S.body[TODAY] = today.filter(x => x !== id); save(); }
  toast('已删除');
  renderBody();
}
/* 演示数据：示例动作而非关系（无人称、无身份），避免"妈妈/爸爸/同桌"类明指 */
const LOVE_SEED = [
  ['把手机里三年的照片全部备份了一遍', '怕哪天突然丢了。'],
  ['陪坐看完整场球赛', '不懂规则，但没走。'],
  ['晚饭后把碗洗了', '没让谁开口。'],
  ['远程把一台蓝屏的电脑修好了', '修到很晚，也没问为什么。'],
  ['电话那头讲了二十分钟', '只是听。'],
  ['熬夜把一份混乱的排版改整齐了', '像乱码的稿子能看了。'],
  ['把一直没弄通的路由器接好了', '三根线，重新走了一遍。'],
  ['把整理好的笔记复印了一份', '没说谢谢，但收下了。'],
  ['记得提过腰疼', '第二天桌上多了个靠垫。'],
  ['情绪不好的那天', '陪着打了两个小时游戏，没聊别的。'],
  ['教一个人用剪辑软件', '没有嫌他慢。'],
  ['把几张旧照片修清楚打印出来', '递过去的时候，手有点抖。'],
  ['提前一周准备好了礼物', '没有说为什么。'],
  ['主动说了一句谢谢', '对方愣了一下。'],
  ['把自己的午饭分了一半', '有人没带饭。'],
  ['答应过的事', '真的做到了。'],
  ['把折断的折纸重新折好', '花了十分钟。'],
  ['把一份简历从头改到尾', '改到每一段都能说清。'],
];
function seedLoves() {
  return LOVE_SEED.map((x, i) => ({
    id: 'lv' + i, who: '', what: x[0] + ' ' + x[1],
    at: shiftKey(TODAY, -(LOVE_SEED.length - 1 - i)),
  }));
}
function freshState() {
  return {
    v: 16, theme: 'mint', view: 'mainline', seq: 100,
    tracks: {
      study: {
        id: 'study', name: '学习线', icon: 'book', unit: '分钟',
        goal: '把想学的、想懂的，变成真的会',
        recs: {},                        // 无示例数据：真实记录才长曲线
        cycleStart: TODAY,
        lastTs: null,
        plans: { tomorrow: '', week: '' },
      },
      craft: {
        id: 'craft', name: '创造线', icon: 'code', unit: '分钟',
        goal: '把脑子里的东西，真的做出来',
        recs: {},
        cycleStart: TODAY,
        lastTs: null,
        plans: { tomorrow: '', week: '' },
      },
    },
    tasks: [                          // 产品引导型任务：只教操作，不绑任何身份
      { id: 't1', text: '记下今天最重要的一件事', done: false },
      { id: 't2', text: '试试勾掉一件已完成的事', done: false },
      { id: 't3', text: '点两下文字可以改成你的话', done: false },
      { id: 't4', text: '做完的事勾掉，进度条会往前推', done: true },
    ],
    body: {},                           // 习惯列表走 getHabits()，可自行增删
    loves: seedLoves().slice(0, 5),     // 5 条无人称示例，写自己的版本替代
    eggSeen: false,
  };
}

/* ---------------- 状态 ---------------- */
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return freshState();
    const o = JSON.parse(raw);
    // 版本守卫：v<16 时（早期示例数据）一律作废，回到引导态
    if (!o || (typeof o.v === 'number' ? o.v < 16 : true) || !o.tracks) return freshState();
    // 兜底：tracks 内残留 seedRecs 旧数据也清掉
    if (o.tracks.study && o.tracks.study.recs) {
      const total = Object.values(o.tracks.study.recs).reduce((a, b) => a + b, 0);
      if (total > 0 && !o._userTouched) { delete o.tracks.study.recs; o.tracks.study.cycleStart = TODAY; }
    }
    if (o.tracks.craft && o.tracks.craft.recs) {
      const total = Object.values(o.tracks.craft.recs).reduce((a, b) => a + b, 0);
      if (total > 0 && !o._userTouched) { delete o.tracks.craft.recs; o.tracks.craft.cycleStart = TODAY; }
    }
    return o;
  } catch (e) { return freshState(); }
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(S)); }
    catch (e) { toast('本地保存失败：浏览器存储可能已满'); }
  }, 180);
}
const nextId = () => 'x' + (++S.seq);

/* ---------------- 提示 / 二次确认 ---------------- */
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}
let confirmCb = null;
function askConfirm(title, body, cb) {
  $('#modalT').textContent = title;
  $('#modalP').textContent = body;
  confirmCb = cb;
  $('#modal').classList.add('on');
  $('#modal').setAttribute('aria-hidden', 'false');
}
function closeConfirm() {
  $('#modal').classList.remove('on');
  $('#modal').setAttribute('aria-hidden', 'true');
  confirmCb = null;
}

/* ---------------- 导航 ---------------- */
function buildNav() {
  $('#nav').innerHTML = VIEWS.map(v =>
    '<button class="navi' + (v.soon ? ' is-soon' : '') + '" type="button" data-go="' + v.id + '">'
    + '<span data-icon="' + v.icon + '"></span>' + v.name
    + (v.soon ? '<span class="navi-tag">SOON</span>' : '') + '</button>'
  ).join('');
  $('#mtab').innerHTML = VIEWS.map(v =>
    '<button class="mtabi" type="button" data-go="' + v.id + '">'
    + '<span data-icon="' + v.icon + '"></span>' + v.short + '</button>'
  ).join('');
  paintIcons();
  $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
}
function go(id) {
  S.view = id; save();
  $$('.panel').forEach(p => p.classList.toggle('is-on', p.dataset.view === id));
  $$('[data-go]').forEach(b => b.classList.toggle('is-on', b.dataset.go === id));
  if (id === 'mainline') requestAnimationFrame(drawAllCharts);
  if (id === 'body') { resetWater(); requestAnimationFrame(renderBody); }
  // AI 对话浮窗：只在"灵感雷达"显示，其它界面不出现
  updateChatFab();
  window.scrollTo({ top: 0, behavior: 'instant' in document.body.style ? 'instant' : 'auto' });
}
function updateChatFab() {
  const f = document.getElementById('fabAsk'); if (!f) return;
  f.style.display = (S.view === 'radar') ? '' : 'none';
}

/* ---------------- 主题 ---------------- */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', S.theme);
  $('#themeDots').innerHTML = THEMES.map(t =>
    '<i class="' + (t === S.theme ? 'on' : '') + '"></i>').join('');
}
function cycleTheme() {
  S.theme = THEMES[(THEMES.indexOf(S.theme) + 1) % THEMES.length];
  applyTheme(); save();
  if (S.view === 'mainline') requestAnimationFrame(drawAllCharts);
}

/* ==========================================================
   A. 主线复利（双线并行 · 各自 48h 归零）
   ========================================================== */
function trackTotal(t, upToKey) {
  let sum = 0;
  Object.keys(t.recs).forEach(k => { if (!upToKey || k <= upToKey) sum += t.recs[k]; });
  return sum;
}
function cycleInfo(t) {
  const h = (NOW - t.lastTs) / 3600e3;
  const dead = h > CYCLE_LIMIT_H;
  const days = Math.max(1, Math.round((keyToDate(TODAY) - keyToDate(t.cycleStart)) / 864e5) + 1);
  return { hours: h, dead: dead, left: Math.max(0, CYCLE_LIMIT_H - h), days: days };
}
function checkCycles() {
  Object.values(S.tracks).forEach(t => {
    const c = cycleInfo(t);
    if (c.dead && t.cycleStart !== TODAY) {
      t.cycleStart = TODAY;
      t.wasReset = true;
    }
  });
  save();
}
function weekSum(t) {
  const dow = (keyToDate(TODAY).getDay() + 6) % 7;
  let s = 0;
  for (let i = 0; i <= dow; i++) { const k = shiftKey(TODAY, -i); if (t.recs[k]) s += t.recs[k]; }
  return s;
}

function buildTracks() {
  $('#tracks').innerHTML = ['study', 'craft'].map(id => {
    const t = S.tracks[id];
    return '<article class="card track" data-track="' + id + '">'
      + '<div class="track-hd">'
      + '<span class="track-ic"><span data-icon="' + t.icon + '"></span></span>'
      + '<div><div class="track-nm">' + t.name + '</div><p class="track-goal">' + t.goal + '</p></div>'
      + '<span class="chip" data-chip></span></div>'
      + '<div class="track-num"><b class="track-val" data-val>0</b>'
      + '<span class="track-unit">' + t.unit + ' · 累计</span>'
      + '<span class="track-delta" data-delta></span></div>'
      + '<div class="chartbox"><svg class="chart" data-chart></svg></div>'
      + '<div class="chxl" data-xl></div>'
      + '<div class="track-sub" data-sub></div>'
      + '<form class="addrow track-rec" data-rec>'
      + '<input class="inp inp-num" type="number" min="1" max="900" placeholder="今日 ' + t.unit + '">'
      + '<button class="btn btn-acc" type="submit"><span data-icon="plus"></span>记录今日</button></form>'
      + '<div class="plans">'
      + '<div class="planrow"><span class="planlab">明日计划</span>'
      + '<input class="inp" data-plan="tomorrow" maxlength="60" placeholder="明天想做的一件事（可选）"></div>'
      + '<div class="planrow"><span class="planlab">本周计划</span>'
      + '<input class="inp" data-plan="week" maxlength="60" placeholder="这一周想推到哪一步"></div></div>'
      + '<div class="track-act"><button class="btn btn-ghost btn-sm" type="button" data-restart>'
      + '<span data-icon="replay"></span>重置这条线</button></div>'
      + '<div class="deadnote" data-dead hidden><span data-icon="alert"></span>'
      + '<span>超过 48 小时没记录，这条线会从头开始——以当前累计值作为新起点。</span></div>'
      + '</article>';
  }).join('');
  paintIcons();

  $$('.track').forEach(card => {
    const t = S.tracks[card.dataset.track];
    $('[data-rec]', card).addEventListener('submit', e => {
      e.preventDefault();
      const inp = $('input', e.currentTarget);
      const v = parseInt(inp.value, 10);
      if (!v || v < 1) { toast('填一个大于 0 的数'); return; }
      if (t.recs[TODAY]) { toast('今天已经记录过了，一天只记一次'); return; }
      t.recs[TODAY] = clamp(v, 1, 900);
      t.lastTs = NOW; t.wasReset = false;
      S._userTouched = true;            // 用户首次真实记录：保留，不再被版本清空
      inp.value = ''; save();
      renderTracks(); requestAnimationFrame(drawAllCharts);
      toast(t.name + ' 今日 +' + v + ' ' + t.unit);
    });
    $$('[data-plan]', card).forEach(inp => {
      inp.value = t.plans[inp.dataset.plan] || '';
      inp.addEventListener('change', () => { t.plans[inp.dataset.plan] = inp.value.trim(); save(); });
    });
    $('[data-restart]', card).addEventListener('click', () => {
      askConfirm('重启「' + t.name + '」周期？',
        '当前累计值会作为新周期起点，另一条线不受影响。历史曲线不会被删除。', () => {
          t.cycleStart = TODAY; t.wasReset = false; save();
          renderTracks(); requestAnimationFrame(drawAllCharts);
          toast(t.name + ' 周期已重启');
        });
    });
  });
}

function renderTracks() {
  $$('.track').forEach(card => {
    const t = S.tracks[card.dataset.track];
    const total = trackTotal(t);
    const c = cycleInfo(t);
    const today = t.recs[TODAY] || 0;

    rollNumber($('[data-val]', card), total);

    const dl = $('[data-delta]', card);
    dl.textContent = today ? '今日 +' + today : '今日 未记录';
    dl.classList.toggle('zero', !today);

    const chip = $('[data-chip]', card);
    if (c.dead) { chip.textContent = '该打卡了'; chip.className = 'chip chip-dead'; }
    else if (c.left < 24) { chip.textContent = '周期第 ' + c.days + ' 天'; chip.className = 'chip chip-warn'; }
    else { chip.textContent = '周期第 ' + c.days + ' 天'; chip.className = 'chip chip-live'; }

    $('[data-sub]', card).innerHTML = '本周 ' + weekSum(t) + ' ' + t.unit
      + '<span class="dot-sep"> · </span>'
      + (c.dead ? '<b class="txd">该打卡了，记一次就重新开始</b>'
        : '距下次重置还有 <b>' + Math.floor(c.left) + '</b> 小时');

    $('[data-dead]', card).hidden = !t.wasReset;
    const btn = $('[data-rec] button', card);
    const inp = $('[data-rec] input', card);
    const had = !!t.recs[TODAY];
    btn.disabled = had; inp.disabled = had;
    inp.placeholder = had ? '今天已记录 ' + today + ' ' + t.unit : '今日 ' + t.unit;
    btn.lastChild.nodeType === 3 ? (btn.lastChild.textContent = had ? '今日已记录' : '记录今日') : null;
  });
  const alive = Object.values(S.tracks).filter(t => !cycleInfo(t).dead).length;
  $('#mainlineMeta').innerHTML = '<div class="bigmeta">' + alive + '<span>/ 2</span></div>'
    + '<span class="metalab">活跃的线</span>';
}

function rollNumber(el, target) {
  const from = parseInt(el.dataset.cur || '0', 10);
  if (from === target) { el.textContent = target.toLocaleString('en-US'); return; }
  const t0 = performance.now(), dur = 900;
  function step(now) {
    const k = clamp((now - t0) / dur, 0, 1);
    const v = Math.round(from + (target - from) * easeOut(k));
    el.textContent = v.toLocaleString('en-US');
    if (k < 1) requestAnimationFrame(step); else el.dataset.cur = target;
  }
  el.dataset.cur = target;
  requestAnimationFrame(step);
}

const DAYS_WIN = 30;
function drawAllCharts() { $$('.track').forEach(card => drawChart(card)); }
function drawChart(card) {
  const t = S.tracks[card.dataset.track];
  const box = $('.chartbox', card);
  const svg = $('[data-chart]', card);
  const W = Math.max(240, box.clientWidth || 460);
  const H = box.clientHeight || 158;
  const PL = 6, PR = 8, PT = 16, PB = 14;
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('width', W); svg.setAttribute('height', H);

  const start = shiftKey(TODAY, -(DAYS_WIN - 1));
  const pts = [];
  let cum = trackTotal(t, shiftKey(start, -1));
  for (let i = 0; i < DAYS_WIN; i++) {
    const k = shiftKey(start, i);
    if (t.recs[k] != null) { cum += t.recs[k]; pts.push({ i: i, v: cum, k: k }); }
  }
  const uid = card.dataset.track;
  if (pts.length < 2) {
    svg.innerHTML = '<text x="' + (W / 2) + '" y="' + (H / 2) + '" class="ch-x" text-anchor="middle">'
      + '记录两天以上才会长出曲线</text>';
    return;
  }
  const vs = pts.map(p => p.v);
  const mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
  const span = Math.max(1, mx - mn);
  const X = i => PL + (i / (DAYS_WIN - 1)) * (W - PL - PR);
  const Y = v => H - PB - ((v - mn) / span) * (H - PT - PB);
  const P = pts.map(p => ({ x: X(p.i), y: Y(p.v), k: p.k }));

  let line = 'M' + P[0].x.toFixed(1) + ',' + P[0].y.toFixed(1);
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i - 1] || P[i], b = P[i], c = P[i + 1], d = P[i + 2] || c;
    const c1x = b.x + (c.x - a.x) / 6, c1y = b.y + (c.y - a.y) / 6;
    const c2x = c.x - (d.x - b.x) / 6, c2y = c.y - (d.y - b.y) / 6;
    line += ' C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1)
      + ' ' + c.x.toFixed(1) + ',' + c.y.toFixed(1);
  }
  const last = P[P.length - 1];
  const area = line + ' L' + last.x.toFixed(1) + ',' + (H - PB) + ' L' + P[0].x.toFixed(1) + ',' + (H - PB) + ' Z';

  const ci = Math.round((keyToDate(t.cycleStart) - keyToDate(start)) / 864e5);
  const cx = X(clamp(ci, 0, DAYS_WIN - 1));

  let g = '<defs>'
    + '<linearGradient id="lg_' + uid + '" x1="0" y1="0" x2="1" y2="0">'
    + '<stop offset="0" stop-color="var(--g1)"/><stop offset="1" stop-color="var(--g2)"/></linearGradient>'
    + '<linearGradient id="ag_' + uid + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="var(--g2)" stop-opacity=".22"/>'
    + '<stop offset="1" stop-color="var(--g1)" stop-opacity="0"/></linearGradient></defs>';
  g += '<g class="ch-grid">';
  for (let r = 0; r <= 3; r++) {
    const y = PT + r * ((H - PT - PB) / 3);
    g += '<line x1="' + PL + '" y1="' + y.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y.toFixed(1) + '"/>';
  }
  g += '</g>';
  // 未记录的未来：只留一条淡虚线，绝不用假数据补满
  if (last.x < W - PR - 2) {
    g += '<line class="ch-future" x1="' + last.x.toFixed(1) + '" y1="' + (H - PB) + '" x2="' + (W - PR)
      + '" y2="' + (H - PB) + '"/>';
  }
  if (ci > 0 && ci < DAYS_WIN) {
    g += '<line class="ch-cyc" x1="' + cx.toFixed(1) + '" y1="' + PT + '" x2="' + cx.toFixed(1)
      + '" y2="' + (H - PB) + '"/>'
      + '<text class="ch-cyclab" x="' + (cx + 4).toFixed(1) + '" y="' + (PT + 9) + '">周期起点</text>';
  }
  g += '<path class="ch-area" d="' + area + '" fill="url(#ag_' + uid + ')"/>';
  g += '<path class="ch-line" d="' + line + '" stroke="url(#lg_' + uid + ')"/>';
  P.forEach((p, i) => {
    if (i === P.length - 1) return;
    g += '<circle class="ch-dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="2.4"/>';
  });
  g += '<circle class="ch-headhalo" cx="' + last.x.toFixed(1) + '" cy="' + last.y.toFixed(1) + '" r="7"/>';
  g += '<circle class="ch-head" cx="' + last.x.toFixed(1) + '" cy="' + last.y.toFixed(1) + '" r="3.2"/>';
  svg.innerHTML = g;

  // 从左往右重新绘制一次
  const path = $('.ch-line', svg);
  const len = path.getTotalLength();
  path.style.transition = 'none';
  path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
  box.classList.remove('drawn');
  requestAnimationFrame(() => {
    path.style.transition = 'stroke-dashoffset 1.35s cubic-bezier(.22,.68,.24,1)';
    path.style.strokeDashoffset = '0';
    box.classList.add('drawn');
  });
  $$('.ch-dot', svg).forEach((d, i) => {
    setTimeout(() => d.classList.add('show'), 260 + i * (1000 / Math.max(1, P.length)));
  });

  const xl = $('[data-xl]', card);
  const marks = [0, 10, 20, 29];
  xl.innerHTML = marks.map(m => {
    const k = shiftKey(start, m);
    const lab = m === 29 ? '今天' : k.slice(5).replace('-', '/');
    return '<span style="left:' + ((X(m) / W) * 100).toFixed(2) + '%">' + lab + '</span>';
  }).join('');
}

/* ==========================================================
   B. 今日必须完成
   ========================================================== */
function renderTasks() {
  const ul = $('#taskList');
  const done = S.tasks.filter(t => t.done).length;
  $('#todayDone').textContent = done;
  $('#todayAll').textContent = '/ ' + S.tasks.length;
  $('#taskProg').style.width = (S.tasks.length ? (done / S.tasks.length * 100) : 0) + '%';

  if (!S.tasks.length) {
    ul.innerHTML = '<li class="empty"><div class="empty-ic" data-icon="inbox"></div>'
      + '今天还没有列必须完成的事。<br>列出来，才有被划掉的可能。</li>';
    paintIcons(ul); return;
  }
  ul.innerHTML = S.tasks.map(t =>
    '<li class="taski' + (t.done ? ' done' : '') + '" data-id="' + t.id + '">'
    + '<button class="tk-box" type="button" data-toggle aria-label="切换完成">' + ico('check', 12) + '</button>'
    + '<span class="tk-tx" data-edit title="双击修改">' + esc(t.text) + '</span>'
    + '<button class="tk-del" type="button" data-del aria-label="删除">' + ico('trash', 14) + '</button></li>'
  ).join('');
  $$('.taski', ul).forEach(li => {
    const t = S.tasks.find(x => x.id === li.dataset.id);
    $('[data-toggle]', li).addEventListener('click', () => { t.done = !t.done; save(); renderTasks(); });
    $('[data-del]', li).addEventListener('click', () => {
      S.tasks = S.tasks.filter(x => x.id !== t.id); save(); renderTasks(); toast('已删除');
    });
    const tx = $('[data-edit]', li);
    if (tx) tx.addEventListener('dblclick', () => {
      const nv = window.prompt('修改这条任务', t.text);
      if (nv && nv.trim()) { t.text = nv.trim(); save(); renderTasks(); }
    });
  });
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ==========================================================
   C. 身体账户
   ========================================================== */
function bodyWeekCount() {
  const dow = (keyToDate(TODAY).getDay() + 6) % 7;
  let n = 0;
  for (let i = 0; i <= dow; i++) { const k = shiftKey(TODAY, -i); n += (S.body[k] || []).length; }
  return n;
}
function resetWater() {
  const w = $('#waterG'); if (!w) return;
  w.setAttribute('y', '380');
  $('#waterGlow').setAttribute('y', '380');
  $('#waterSurf').setAttribute('d', 'M-40,380 L240,380');
  buildWaves(380);
}
function setWaterLevel(lv) {
  const w = $('#waterG'); if (!w) return;
  // 满 100% 时水面在 y=20（头顶之上 12px），空 0% 时在 y=400（脚底之下 20px）
  const surfaceY = 20 + (1 - lv) * 360;
  w.setAttribute('y', surfaceY.toFixed(1));
  $('#waterGlow').setAttribute('y', surfaceY.toFixed(1));
  $('#waterSurf').setAttribute('d', 'M-40,' + surfaceY.toFixed(1) + ' L240,' + surfaceY.toFixed(1));
  buildWaves(surfaceY);
}
function buildWaves(y) {
  const y1 = +y + 4, y2 = +y + 7, yb = +y + 22;
  const w1 = $('#waterWave1'), w2 = $('#waterWave2'); if (!w1 || !w2) return;
  w1.setAttribute('d', 'M-40,' + y1 + ' q30,-8 60,0 t60,0 t60,0 t60,0 t60,0 L320,' + yb + ' L-40,' + yb + ' Z');
  w2.setAttribute('d', 'M-40,' + y2 + ' q40,6 80,0 t80,0 t80,0 t80,0 L320,' + yb + ' L-40,' + yb + ' Z');
}
function renderBody() {
  const n = bodyWeekCount();
  const lv = clamp(n / BODY_TARGET, 0, 1);
  $('#bodyCnt').textContent = n;
  $('#bodyTarget').textContent = '/ ' + BODY_TARGET;
  $('#bodyPct').textContent = Math.round(lv * 100) + '%';
  setWaterLevel(lv);

  const tk = $('#bodyTicks');
  if (!tk.dataset.done) {
    let s = '';
    [0.25, 0.5, 0.75].forEach(r => {
      const y = 20 + (1 - r) * 340;
      s += '<line x1="172" y1="' + y.toFixed(0) + '" x2="184" y2="' + y.toFixed(0) + '"/>'
        + '<text x="186" y="' + (y + 3).toFixed(0) + '">' + (r * 100) + '</text>';
    });
    tk.innerHTML = s; tk.dataset.done = '1';
  }

  const today = S.body[TODAY] || [];
  const HABITS_USER = getHabits();   // 用本地自定义习惯（未设置则用 HABITS 默认）
  $('#habitList').innerHTML = HABITS_USER.map(h => {
    const on = today.indexOf(h.id) >= 0;
    return '<li class="habiti' + (on ? ' on' : '') + '" data-h="' + h.id + '">'
      + '<span class="tk-box' + (on ? ' hb-on' : '') + '" style="'
      + (on ? 'background:var(--acc);border-color:var(--acc);color:#06231f' : '') + '">'
      + ico('check', 12) + '</span>'
      + '<span class="hb-tx">' + h.name + '<span class="hb-sub">' + h.sub + '</span></span>'
      + '<button class="btn btn-sm hb-btn' + (on ? ' btn-ghost' : ' btn-acc') + '" type="button" data-t>'
      + (on ? '撤回' : '存入') + '</button>'
      + '<button class="hb-del" type="button" data-d aria-label="删除">×</button></li>';
  }).join('') + '<li class="habiti habiti-add" data-add>'
    + '<span class="hb-add-tx">+ 添加新习惯</span></li>';

  $$('.habiti').forEach(li => {
    if (!li) return;
    if (li.dataset.add) li.addEventListener('click', addHabit);
    else if (li.dataset.h) {
      const t = $('[data-t]', li);
      if (t) t.addEventListener('click', e => {
        e.stopPropagation();
        const id = li.dataset.h;
        const arr = S.body[TODAY] || (S.body[TODAY] = []);
        const i = arr.indexOf(id);
        if (i >= 0) { arr.splice(i, 1); toast('已撤回'); }
        else { arr.push(id); toast('存入身体账户 +1'); }
        if (!arr.length) delete S.body[TODAY];
        save(); renderBody();
      });
      const dl = $('[data-d]', li);
      if (dl) dl.addEventListener('click', e => { e.stopPropagation(); delHabit(li.dataset.h); });
    }
  });

  const dow = (keyToDate(TODAY).getDay() + 6) % 7;
  const names = ['一', '二', '三', '四', '五', '六', '日'];
  let wd = '';
  for (let i = 0; i < 7; i++) {
    const k = shiftKey(TODAY, -(dow - i));
    const c = i <= dow ? (S.body[k] || []).length : 0;
    wd += '<div class="wd' + (i === dow ? ' today' : '') + '"><div class="wd-bar">'
      + '<i style="height:' + (c / HABITS_USER.length * 100).toFixed(0) + '%"></i></div>'
      + '<span class="wd-lab">' + names[i] + '</span></div>';
  }
  $('#weekDots').innerHTML = wd;
}

/* ==========================================================
   D. 在意的人 + 玫瑰彩蛋
   ========================================================== */
function renderLove() {
  const n = S.loves.length;
  $('#loveCnt').textContent = n;
  $('#loveBar').style.width = clamp(n / LOVE_TARGET * 100, 0, 100) + '%';
  $('#loveLeft').textContent = n >= LOVE_TARGET ? '已解锁 · 可重放' : '还差 ' + (LOVE_TARGET - n) + ' 件';
  $('#replayBtn').disabled = n < LOVE_TARGET;

  const ul = $('#loveList');
  if (!n) {
    ul.innerHTML = '<li class="empty"><div class="empty-ic" data-icon="inbox"></div>'
      + '还没有记录。<br>不用写大事，把"具体做了什么"写清楚就够了。</li>';
    paintIcons(ul); return;
  }
  ul.innerHTML = S.loves.slice().reverse().map(l =>
    '<li class="lovei" data-id="' + l.id + '">'
    + '<span class="lv-who">' + esc(l.who) + '</span>'
    + '<span class="lv-what">' + esc(l.what) + '</span>'
    + '<span class="lv-at">' + l.at.slice(5).replace('-', '/') + '</span>'
    + '<button class="tk-del" type="button" data-del aria-label="删除">' + ico('trash', 14) + '</button></li>'
  ).join('');
  $$('.lovei', ul).forEach(li => {
    $('[data-del]', li).addEventListener('click', () => {
      S.loves = S.loves.filter(x => x.id !== li.dataset.id); save(); renderLove(); toast('已删除');
    });
  });
}

const ROSE_RINGS = [
  { L: 122, n: 8, off: 0, g: 'petalG', dly: 0 },
  { L: 94, n: 7, off: 26, g: 'petalG2', dly: 190 },
  { L: 66, n: 6, off: 13, g: 'petalG', dly: 360 },
  { L: 40, n: 5, off: 40, g: 'petalG2', dly: 520 },
];
function petalPath(L) {
  const a = (-0.34 * L).toFixed(1), b = (-0.30 * L).toFixed(1),
    c = (-0.36 * L).toFixed(1), d = (-0.78 * L).toFixed(1);
  return 'M0,0 C' + a + ',' + b + ' ' + c + ',' + d + ' 0,' + (-L)
    + ' C' + (-c) + ',' + d + ' ' + (-a) + ',' + b + ' 0,0 Z';
}
function buildRose() {
  const g = $('#roseRings');
  if (g.dataset.done) return;
  let s = '';
  ROSE_RINGS.forEach((r, ri) => {
    for (let i = 0; i < r.n; i++) {
      const ang = r.off + (360 / r.n) * i;
      s += '<path class="petal" d="' + petalPath(r.L) + '" fill="url(#' + r.g + ')" '
        + 'stroke="rgba(255,238,220,.26)" stroke-width="1" '
        + 'style="--a:' + ang.toFixed(1) + 'deg;transition-delay:' + (r.dly + i * 34) + 'ms,'
        + (r.dly + i * 34) + 'ms"/>';
    }
    void ri;
  });
  g.innerHTML = s; g.dataset.done = '1';
}
function buildFireflies(count) {
  const box = $('#fireflies');
  const rnd = mulberry32(SEED + 31);
  const k = clamp((box.clientWidth || 720) / 860, 0.5, 1);
  let s = '';
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, dist = (110 + rnd() * 300) * k;
    s += '<i class="ff" style="--sz:' + (2 + rnd() * 3).toFixed(1) + 'px;'
      + '--tx:' + (Math.cos(a) * dist).toFixed(0) + 'px;'
      + '--ty:' + (Math.sin(a) * dist * 0.82).toFixed(0) + 'px;'
      + '--dur:' + (2500 + rnd() * 2300).toFixed(0) + 'ms;'
      + '--dly:' + (rnd() * 1500).toFixed(0) + 'ms"></i>';
  }
  box.innerHTML = s;
}
function buildMemCards() {
  const box = $('#memCards');
  // 关键修复：用视口宽度判断，避免彩蛋 display:none 时 clientWidth=0 被兜底成 880，
  // 导致 isMobile 永远误判为 false、移动端错用桌面布局坐标（卡片溢出屏幕外）。
  const cw = window.innerWidth || document.documentElement.clientWidth || 880;
  const isMobile = cw < 600;
  // 移动端按 390 基准展开，保证卡片充分分散、全在屏内且避开花瓣
  const k = isMobile ? clamp(cw / 390, 0.85, 1.06) : clamp(cw / 880, 0.42, 1);
  const list = S.loves.slice(-6).reverse();
  // 桌面：U 形剧场座位（中央最近、两侧上扬变小变远，不对称随机感）
  const LAYOUT_DESK = [
    { x: -440, y:  -30, z: 0.70, op: 0.78 },
    { x: -240, y:   78, z: 0.86, op: 0.92 },
    { x:  -95, y:  240, z: 0.98, op: 1.00 },
    { x:   95, y:  240, z: 0.98, op: 1.00 },
    { x:  240, y:   78, z: 0.86, op: 0.92 },
    { x:  440, y:  -30, z: 0.70, op: 0.78 },
  ];
  // 移动端：4 张环绕花朵上下两侧，全部在屏内、避开中央花瓣、轻微不对称
  const LAYOUT_MOBILE = [
    { x: -100, y: -205, z: 0.95, op: 1.00 },
    { x:   88, y: -225, z: 0.90, op: 0.95 },
    { x:  -82, y:  215, z: 0.90, op: 0.95 },
    { x:  102, y:  205, z: 0.95, op: 1.00 },
  ];
  const LAYOUT = isMobile ? LAYOUT_MOBILE : LAYOUT_DESK;
  const useList = isMobile ? list.slice(0, 4) : list;
  box.innerHTML = useList.map((l, i) => {
    const p = LAYOUT[i] || LAYOUT[LAYOUT.length - 1];
    return '<div class="mc" style="--mx:' + (p.x * k).toFixed(0) + 'px;--my:' + (p.y * k).toFixed(0)
      + 'px;--mz:' + p.z + ';--mop:' + p.op + ';--mdly:' + (i * 170) + 'ms">'
      + '<div class="mc-who">' + esc(l.who) + '</div>'
      + '<div class="mc-what">' + esc(l.what) + '</div></div>';
  }).join('');
}
let eggTimers = [];
function playEgg() {
  const egg = $('#egg');
  const lowPerf = (navigator.hardwareConcurrency || 4) <= 4
    || window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  buildRose(); buildFireflies(lowPerf ? 16 : 46);
  eggTimers.forEach(clearTimeout); eggTimers = [];
  egg.className = 'egg on';
  egg.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  buildMemCards();  // 必须在 display:grid 之后构建，否则 clientWidth 为空
  // 六阶段：熄灭 → 聚光 → 玫瑰盛开 → 粒子扩散 → 记忆卡片 → 定格（≈9.5s 完成）
  const step = (cls, ms) => eggTimers.push(setTimeout(() => egg.classList.add(cls), ms));
  requestAnimationFrame(() => egg.classList.add('s1'));
  step('s2', 600); step('s3', 1500); step('s4', 3200); step('s5', 4400); step('s6', 6300);
}
function closeEgg() {
  eggTimers.forEach(clearTimeout); eggTimers = [];
  $('#egg').className = 'egg';
  $('#egg').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/* ==========================================================
   环境音 BGM：Web Audio 合成，无需外部音频文件、无版权问题
   默认关闭（浏览器不允许自动播放），用户点击"环境音"开关才开启
   和弦进行 Am - F - C - G，低通滤波 + 慢包络，做冥想氛围垫音
   ========================================================== */
const BGM = {
  ctx: null, timer: null, on: false,
  chords: [[220, 277.18, 329.63], [174.61, 220, 261.63], [130.81, 196, 261.63], [196, 246.94, 293.66]],
  toggle() { return this.on ? this.stop() : this.start(); },
  start() {
    if (this.on) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = this.ctx = new AC();
    const master = ctx.createGain(); master.gain.value = 0.05;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 820;
    master.connect(filt); filt.connect(ctx.destination);
    const self = this;
    let ci = 0;
    const step = () => {
      const t = ctx.currentTime;
      const ch = self.chords[ci % self.chords.length]; ci++;
      ch.forEach((f, k) => {
        const o = ctx.createOscillator();
        o.type = k === 0 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = Math.random() * 6 - 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.5, t + 2.4);
        g.gain.setValueAtTime(0.5, t + 6.2);
        g.gain.linearRampToValueAtTime(0.0001, t + 8.1);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 8.3);
      });
    };
    step();
    self.timer = setInterval(step, 8000);
    self.on = true; return true;
  },
  stop() {
    this.on = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.ctx) { try { this.ctx.close(); } catch (e) {} this.ctx = null; }
    return false;
  },
};

/* ==========================================================
   BGM 模块：AI 生成提示词（纯音乐·无人声）+ 轻量播放器
   ========================================================== */
const BGM_PROMPTS = [
  { name: '深夜流动', tag: 'Lo-fi / 慢', prompt: 'A calm lo-fi instrumental track, no vocals, soft electric piano and warm vinyl crackle, slow tempo 70 BPM, late-night study mood, gentle reverb, mellow and focused.' },
  { name: '薄荷清晨', tag: 'Ambient / 明亮', prompt: 'Bright ambient instrumental, no vocals, shimmering synth pads and light acoustic guitar, airy and clean, 90 BPM, morning focus, uplifting but calm.' },
  { name: '熵寂', tag: 'Cinematic / 空旷', prompt: 'Cinematic ambient drone, no vocals, deep strings and distant piano, vast empty space, slow swelling, philosophical and quiet, minimal rhythm.' },
  { name: '雨夜代码', tag: 'Synthwave / 中速', prompt: 'Mid-tempo synthwave instrumental, no vocals, smooth analog bass and soft arpeggios, rainy night coding vibe, 100 BPM, slightly nostalgic.' },
  { name: '文博慢步', tag: 'Neo-classical / 温柔', prompt: 'Neo-classical instrumental, no vocals, solo piano with soft chamber strings, gentle and reflective, walking through a museum mood, tender.' },
  { name: '归零', tag: 'Deep / 催眠', prompt: 'Deep sleep music, no vocals, very slow drone and soft bell tones, dark yet peaceful, 50 BPM, fading into silence, meditative and grounding.' },
];
const BGM_TRACKS = [
  { title: '示范曲 1 · Flow', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', note: '占位示范，替换成你生成的' },
  { title: '示范曲 2 · Drift', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', note: '占位示范' },
  { title: '示范曲 3 · Ember', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', note: '占位示范' },
  { title: '示范曲 4 · Quiet', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', note: '占位示范' },
];

const MusicPlayer = {
  idx: 0, playing: false, mode: 'all', // all | one | shuffle
  audio: null,
  init() {
    this.audio = $('#bgmAudio');
    if (!this.audio) return;
    this.audio.volume = 0.8;
    this.audio.addEventListener('timeupdate', () => this.sync());
    this.audio.addEventListener('loadedmetadata', () => this.sync());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('play', () => { this.playing = true; this.paintToggle(); });
    this.audio.addEventListener('pause', () => { this.playing = false; this.paintToggle(); });
    this.renderList();
  },
  load(i, autoplay) {
    if (i < 0 || i >= BGM_TRACKS.length) return;
    this.idx = i;
    const t = BGM_TRACKS[i];
    this.audio.src = t.src;
    $('#bgmTitle').textContent = t.title;
    $('#bgmSub').textContent = t.note || '';
    this.renderList();
    if (autoplay) this.play();
  },
  play() { const p = this.audio.play(); if (p && p.catch) p.catch(() => toast('该曲直链可能被拦截，换一首试试')); },
  toggle() { if (this.audio.paused) this.play(); else this.audio.pause(); },
  next() {
    if (this.mode === 'shuffle') { let n; do { n = Math.floor(Math.random() * BGM_TRACKS.length); } while (n === this.idx && BGM_TRACKS.length > 1); this.load(n, true); }
    else this.load((this.idx + 1) % BGM_TRACKS.length, true);
  },
  prev() { this.load((this.idx - 1 + BGM_TRACKS.length) % BGM_TRACKS.length, true); },
  onEnded() { if (this.mode === 'one') { this.audio.currentTime = 0; this.play(); } else this.next(); },
  setMode() {
    this.mode = this.mode === 'all' ? 'one' : this.mode === 'one' ? 'shuffle' : 'all';
    const lab = { all: '列表', one: '单曲', shuffle: '随机' }[this.mode];
    const b = $('#bgmLoop'); if (b) { b.textContent = lab; b.dataset.mode = this.mode; }
  },
  setVol(v) { if (this.audio) this.audio.volume = v; },
  sync() {
    const a = this.audio; if (!a) return;
    const d = a.duration || 0, c = a.currentTime || 0;
    $('#bgmCur').textContent = fmtTime(c * 1000);
    $('#bgmDur').textContent = fmtTime(d * 1000);
    const bar = $('#bgmBar'); if (bar) bar.style.width = (d ? (c / d * 100) : 0) + '%';
  },
  paintToggle() {
    const b = $('#bgmToggle'); if (b) b.classList.toggle('on', this.playing);
  },
  renderList() {
    const box = $('#bgmList'); if (!box) return;
    box.innerHTML = BGM_TRACKS.map((t, i) =>
      '<button class="bgm-li' + (i === this.idx ? ' on' : '') + '" type="button" data-i="' + i + '">'
      + '<span class="bgm-li-n">' + (i + 1) + '</span>'
      + '<span class="bgm-li-t">' + esc(t.title) + '</span>'
      + '<span class="bgm-li-s">' + esc(t.note || '') + '</span>'
      + '</button>').join('');
    $$('#bgmList [data-i]').forEach(b => b.addEventListener('click', () => this.load(+b.dataset.i, true)));
  },
};

function renderMusic() {
  const g = $('#promptGrid'); if (!g) return;
  g.innerHTML = BGM_PROMPTS.map((p, i) =>
    '<div class="prompt-card">'
    + '<div class="prompt-top"><b class="prompt-name">' + esc(p.name) + '</b><span class="prompt-tag">' + esc(p.tag) + '</span></div>'
    + '<p class="prompt-text" id="pt' + i + '">' + esc(p.prompt) + '</p>'
    + '<button class="btn btn-ghost btn-sm prompt-copy" type="button" data-copy="pt' + i + '"><span data-icon="copy"></span>复制提示词</button>'
    + '</div>').join('');
  paintIcons(g);
  $$('#promptGrid [data-copy]').forEach(b => b.addEventListener('click', () => {
    const txt = $('#' + b.dataset.copy).textContent;
    copyToClipboard(txt).then(ok => toast(ok ? '已复制，去 Suno/Udio 粘贴' : '复制失败，长按手动选'));
  }));
}

/* ==========================================================
   熵尘粒子背景：克制的动态氛围（低密度 / 低透明度 / 缓慢漂移）
   薄荷 + 玫瑰微光，服务"熵"主题但不打扰内容；尊重减弱动效
   ========================================================== */
let dustRAF = null;
function initDust() {
  const cv = $('#bgDust'); if (!cv) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const ctx = cv.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, parts = [];
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function spawn() {
    const n = Math.min(34, Math.max(14, Math.round(W * H / 46000)));
    parts = [];
    for (let i = 0; i < n; i++) parts.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.6 + Math.random() * 2.0,
      vx: (Math.random() - 0.5) * 0.16,
      vy: -(0.04 + Math.random() * 0.14),
      ph: Math.random() * Math.PI * 2,
      sp: 0.004 + Math.random() * 0.012,
      rose: Math.random() < 0.35,
    });
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.ph += p.sp;
      p.x += p.vx + Math.sin(p.ph) * 0.12;
      p.y += p.vy;
      if (p.y < -8) { p.y = H + 8; p.x = Math.random() * W; }
      if (p.x < -8) p.x = W + 8; if (p.x > W + 8) p.x = -8;
      const a = 0.09 + 0.20 * (0.5 + 0.5 * Math.sin(p.ph));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.rose ? 'rgba(229,171,142,' + a.toFixed(3) + ')' : 'rgba(139,233,190,' + a.toFixed(3) + ')';
      ctx.fill();
    }
    dustRAF = requestAnimationFrame(frame);
  }
  resize(); spawn(); frame();
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); spawn(); }, 200); });
}

/* ==========================================================
   E. 灵感雷达（真实资讯流 · 数据管线前端）
   原则：只显示可验证官方源的真实条目；离线时回退上次成功缓存并明确标"缓存"。
   ========================================================== */
// 类别定义：成长学习向全品类池子。locked=true = 数据源还在接入中（UI 显示灰态"待解锁"）。
// 原则：能配到真实官方源就解锁，配不到就诚实标灰，绝不造假数据。
const NEWS_CATS = [
  { v: 'ai', label: 'AI 前沿' },
  { v: 'opensource', label: '开源工具' },
  { v: 'frontend', label: '前端设计' },
  { v: 'science', label: '科学科普' },
  { v: 'philosophy', label: '哲学哲思' },
  { v: 'museum', label: '文博人文' },
  { v: 'game', label: '游戏人文' },
  { v: 'hardware', label: '科技数码' },
  { v: 'code', label: '编程开发' },
  { v: 'study', label: '学习效率', locked: true },
  { v: 'ai101', label: 'AI 科普', locked: true },
  { v: 'growth', label: '个人成长', locked: true },
];
let NEWS_ITEMS = [];
let NEWS_STATUS = 'live';          // 'live' | 'cache'
let NEWS_FETCHED = '';
let NEWS_SELECTED = [];            // 多选：空数组 = 看全部；否则只看这些类别
let newsTimer = null;
const NEWS_PREFS_KEY = 'ae_news_cats';
const NEWS_KEYS_KEY = 'ae_news_keys';
const WORKER = 'https://antientropy-api.3353367139.workers.dev';   // Cloudflare Worker（备用通道）
const PAGES_API = 'https://antientropy.pages.dev/api';             // Cloudflare Pages Functions（主通道，国内可访问）
let NEWS_KEYS = [];                // 个人关注词：自己输入，按词过滤
function catLabel(v) { const c = NEWS_CATS.find(x => x.v === v); return c ? c.label : v; }

/* ============ 灵感清单 · 本地模板引擎（零网络零 key，手机也能用） ============
   原则：每条模板用不同句式结构（碎片/独白/疑问/对比/对话/留白），
   避免连发"折进 X 里叠好不寄"这种套路。生成时 3-5 条不重复模板。 */
const INSPIRE_LIB = {
  museum: {
    label: '文博',
    patterns: [
      '站在{her}前，{time}被压成了展柜里的一厘米。',
      '博物馆是诚实的沉默者——把{era}的喧哗，收进{art}的裂纹里。',
      '隔着玻璃看{art}，忽然明白：我们不是在看文物，是在看时间怎么把呐喊熬成安静。',
      '{place}。{era}。玻璃。冷光。一千年的沉默。',
      '文物修复师说，他们修的不是{art}，是{era}的尊严。',
      '有人把{era}写进史书，有人把{era}烧进{art}。后者比前者活得更久。',
      '走出{place}那刻想：{num}年后，也会有人隔着玻璃看我生活的这个时代吧。',
      '{place}的屋顶有鸽子，馆里有{era}。抬头是现在，低头是过去，中间是喘不过气的一秒。',
      '——展柜灯暗了。我没出声。',
      '逛完{place}，出来时天已经暗了。把{era}留在馆里，把自己带回今天。',
      '{art}躺在{era}的枕边，像一封没拆的信。',
      '{num}件展品，{num}年。{place}的空气里有种慢。',
      '一件{art}没写说明牌。它站在角落，像一句没人接的话。',
      '我们去看{era}，{era}也在看我们。',
      '……留白。',
    ],
    pool: {
      art: ['青铜饕餮纹', '唐三彩马', '汝窑天青盏', '敦煌残经', '错金银虎符', '越王勾践剑', '长信宫灯', '青花缠枝莲', '彩绘陶俑', '战国编钟'],
      era: ['商周', '大唐', '两宋', '大明', '晚清', '汉'],
      her: ['那件青铜器', '那尊陶俑', '那卷残经', '那只青瓷盏', '那枚虎符', '那盏宫灯'],
      time: ['三千年', '一千年', '八百年的风', '六百年的砖', '两千年的锈'],
      num: ['三', '两千', '八', '五百', '一千零一'],
      place: ['故宫', '国博', '省博', '莫高窟', '旧城墙', '博物馆'],
    },
  },
  music: {
    label: '华语音乐',
    patterns: [
      '凌晨。{song}。{singer}。{year} 年。',
      '深夜耳机里单曲循环{song}，{singer}把没说出口的那句，替我唱完了。',
      '现在的歌好听，但心里那首{song}，还是{year}年那版。',
      '{singer}的歌还能听几年？',
      '{year} 年。{song}。{place}。{num}颗星。',
      '有人说{singer}过气了。可我的歌单里，{song}还是单曲循环。',
      '{singer}唱的是别人的词，我听到的是自己的命。',
      '音乐是唯一不会说谎的时光机：{singer}的声音一出来，{year}年就站在门口。',
      '副歌。副歌。副歌。{num}次。{singer}。{year}。',
      '我把{song}设成单曲循环，不是因为好听，是那句词太像我了。',
      '那年{year}，谁在{place}听{singer}的{song}？',
      '——耳机摘了。',
      '歌单翻到{singer}，{year}年的旧歌，现在听全是新心事。',
      '{song}。{singer}。{num}分钟。{era}。',
      '有些歌不敢在白天听——{song}的前奏一响，{year}年的事就全回来了。',
    ],
    pool: {
      song: ['《烟火里的尘埃》', '《小半》', '《理想三旬》', '《大眠》', '《年少有为》', '《暗涌》', '《给自己的歌》', '《平凡之路》'],
      singer: ['陈粒', '毛不易', '薛之谦', '朴树', '李宗盛', '林宥嘉', '陈奕迅'],
      year: ['2016', '2018', '2019', '2021', '2013'],
      place: ['地铁', '出租屋', '自习室', '老巷口', '天台'],
      num: ['三', '七', '十', '无数'],
      era: ['去年', '那年', '初秋'],
    },
  },
  game: {
    label: '游戏人文',
    patterns: [
      '游戏打多了会明白：真正的攻略不是背出装，是学会在{game}里跟自己和解。',
      '从{game}退坑那天，我删的不是账号，是{num}个睡不着的夜晚。',
      '{game}。{num}点。{place}。',
      '成年人的逃避方式很统一：打开{game}，假装今天还没结束。',
      '后来不打{game}了，不是不喜欢，是没人再在频道里喊我上线。',
      '我在{game}里认识的人，比现实里更懂"队友"两个字。',
      '{game}里到底通关过几个世界？',
      '{num}个夜晚。{game}。{era}。{place}。',
      '每次打完{game}抬头，窗外天都亮了。时间在游戏里过得快，在现实里也快。',
      '游戏是假的，但{game}里掉的眼泪是真的。',
      '{game}教会我的第一课：逆风局别急着投降。',
      '——退出频道。{num}个好友在线。',
      '{game}的 BGM 比现实的歌更懂我。',
      '{era} 的{game}玩家，{era}还在，{game}没了。',
      '{game}。{place}。{era}。',
    ],
    pool: {
      game: ['王者峡谷', '我的世界', '塞尔达', '星露谷', '英雄联盟', '原神'],
      num: ['一', '两', '三', '无数'],
      place: ['出租屋', '天台', '地铁', '老巷口', '网吧'],
      era: ['去年', '那年', '初秋', '小时候'],
    },
  },
  poetry: {
    label: '现代诗歌',
    patterns: [
      '{era}的风经过{place}时，已经不像{era}的风了。',
      '"最近过得怎样？" "正在过。"',
      '写信给明天的自己。地址栏不知道该填哪儿。',
      '凌晨三点。{place}。一颗星。空白页。',
      '旧的烦恼撑不过一个{era}，新的却等不及。',
      '"再见。" "再见。" ——{era}的{place}，留下一个句号。',
      '——这段话留给你。见谅。',
      '一枚硬币的影子比一枚硬币更长。',
      '你不在的城市，{place}正在下小雨。',
      '雨下了一夜。{place}的灯，比雨更像是我。',
      '写到这里还要继续吗？',
      '我打开{place}的窗，{era}就落进来了。',
      '三点三十分。空瓶，空灯，{era}的风。',
      '……这页留给时间。',
      '不是不想说，是说了又怎样。',
    ],
    pool: {
      obj: ['一张旧车票', '半页没写完的信', '一枚硬币', '路边的落叶', '一把钥匙', '一杯凉茶'],
      place: ['老巷口', '天台', '学校后门', '江边', '空教室', '出租屋'],
      era: ['去年', '那年', '初秋', '小时候'],
      num: ['七千', '一万', '三', '四十'],
    },
  },
  /* 以下主题用于「按资讯类别生成」：本地零网络也能出连贯、跟类别的句子 */
  tech: {
    label: '科技数码',
    patterns: [
      '今天刷到{thing}的新进展，突然觉得手里的活儿又该重写了。',
      '{thing}又更新了。我看了半小时文档，决定先不动，下周再说。',
      '搞{thing}的人真幸福，踩的坑都有人写博客。',
      '半夜调试{thing}，报错信息比代码还长。',
      '有人用{thing}一天搭出原型，我还在配环境。这就是差距。',
      '{thing}这东西，懂的人觉得理所当然，不懂的觉得像魔法。',
      '收藏了一堆{thing}的教程，一行都没看。',
      '今天终于把{thing}跑通了，比中奖还高兴。',
      '看{thing}的发布会，钱包先紧张了。',
      '写{thing}写到凌晨，抬头发现天亮了。',
      '关掉编辑器，{thing}的坑明天再填。',
      '{thing}的坑我替你踩过了：先看官方文档，别信二手教程。',
    ],
    pool: {
      thing: ['模型', '开源项目', '前端框架', '新显卡', '代码', 'Agent', '终端', '机械键盘', '算法', '云服务器', '开发工具'],
    },
  },
  science: {
    label: '科学科普',
    patterns: [
      '科普里说{subj}的运行规律，比人类写的任何规则都优雅。',
      '看完{subj}的纪录片，觉得自己懂的还不如一只蚂蚁。',
      '{subj}不关心人类忙什么，它按自己的节奏走。',
      '今天知道{subj}的一个冷知识，够吹一星期。',
      '科学家研究{subj}几十年，结论还在改，挺好。',
      '仰望{subj}的时候，手机里的焦虑突然变小了。',
      '{subj}的尺度大到让我安心——我的烦恼太渺小了。',
      '原来{subj}是这么运作的，小时候课本没讲清楚。',
      '合上科普书，世界没变，我看它的方式变了。',
      '研究{subj}的人，是把好奇心当饭吃的人。',
    ],
    pool: {
      subj: ['恒星', '深海', '量子', '大脑', '河流', '细菌', '星系', '时间', '细胞', '引力', '气候'],
    },
  },
  life: {
    label: '成长生活',
    patterns: [
      '今天{act}了十分钟，比昨天多，比明天少。',
      '{act}这件事，难的不是做，是每天都做。',
      '把{act}排进日程，生活突然有了重心。',
      '拖延的时候，{act}在脑子里越滚越大。',
      '今天先{act}，剩下的明天再说。',
      '别人问我怎么坚持{act}，我说我没坚持，只是没停。',
      '{act}一个月，变化小到看不见，但确实不一样了。',
      '周末{act}了一整天，周一反而更有劲儿。',
      '睡前{act}五分钟，比刷手机睡得踏实。',
    ],
    pool: {
      act: ['背单词', '复盘', '跑步', '读书', '学点新东西', '早睡', '写日记', '整理桌面', '冥想'],
    },
  },
};
/* 资讯类别 → 灵感主题（NEWS 类别与灵感库 key 不同，必须映射，否则永远落到诗歌） */
const CAT_TO_THEME = {
  museum: 'museum', game: 'game',
  ai: 'tech', opensource: 'tech', frontend: 'tech', hardware: 'tech', code: 'tech', ai101: 'tech',
  science: 'science',
  philosophy: 'poetry',
  study: 'life', growth: 'life',
};
function pickOne(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }
function fmtTime(ts) { try { const d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } catch (e) { return ''; } }
function fillTpl(tpl, pool, rnd) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => {
    const p = pool[k];
    return p && p.length ? pickOne(p, rnd) : m;
  });
}
/* 灵感的"风格"清单（与后端 inspire.js / worker INSPIRE_VOICES 对齐），
   用户可多选 1-3 种作为当前想用的"语调"，让生成有真实风格差异。
   为了贴近用户认知，前端 UI 称之"风格"，后端仍用 "voice" 字段名做兼容 */
const INSPIRE_VOICES = [
  { id: 'night',    name: '夜行者',   desc: '深夜放空写的短句，带一点私人情绪。' },
  { id: 'museum',   name: '文博旁白', desc: '用展品/古建的意象写感悟，克制、有画面。' },
  { id: 'lyric',    name: '歌词体',   desc: '两三句像歌词的片段，留一个记忆点。' },
  { id: 'roast',    name: '冷梗吐槽', desc: '对刚看到的事俏皮点评，允许不完整句。' },
  { id: 'poem',     name: '现代小诗', desc: '三四行，留白，别抒情过度。' },
  { id: 'playlist', name: '歌单随笔', desc: '给一张私藏歌单写简介，带个人口味。' },
];
/* 资讯类别 → 中文标签（与上方 NEWS_CATS label 保持一致；用于灵感卡片"来源类别"标签） */
const CAT_LABEL = {
  ai: 'AI 前沿', opensource: '开源工具', frontend: '前端设计',
  science: '科学科普', philosophy: '哲学哲思', museum: '文博人文',
  game: '游戏人文', hardware: '科技数码', code: '编程开发',
  study: '学习效率', ai101: 'AI 科普', growth: '个人成长',
};
let INSPIRE_STATE = { voices: ['night'], style: 'boxed' }; // 默认：夜行者 + 一条一框
function genLocalInspire(cats) {
  const rnd = Math.random;
  // 把勾选的资讯类别映射成灵感主题；去重
  let themes = (cats && cats.length ? cats : []).map(c => CAT_TO_THEME[c]).filter(Boolean);
  themes = [...new Set(themes)];
  // 没勾任何类别：均衡覆盖全部主题，保证多样性（不再退化成只有诗歌）
  if (!themes.length) themes = ['museum', 'music', 'game', 'tech', 'science', 'life', 'poetry'];
  const count = 4 + Math.floor(rnd() * 2);   // 4-5 条
  const items = [];

  // 准备 sources：每个主题 → 反向映射出一个资讯类别；从 NEWS_ITEMS 里按 category 抓真实标题
  const themeToCats = {}; Object.keys(CAT_TO_THEME).forEach(k => { const t = CAT_TO_THEME[k]; (themeToCats[t] = themeToCats[t] || []).push(k); });
  // 按 category 分组的资讯池
  const catPools = {};
  (NEWS_ITEMS || []).forEach(n => { if (n.category) (catPools[n.category] = catPools[n.category] || []).push(n); });

  const used = {};
  let tries = 0;
  while (items.length < count && tries < 80) {
    tries++;
    const themeKey = pickOne(themes, rnd);
    const lib = INSPIRE_LIB[themeKey];
    if (!lib) continue;
    const tpl = pickOne(lib.patterns, rnd);
    const key = themeKey + ':' + tpl;
    if (used[key]) continue;
    used[key] = 1;
    // 真实类别：theme 反向 → NEWS_CATS（取一个）
    const possibleCats = themeToCats[themeKey] || [];
    const cat = possibleCats.length ? pickOne(possibleCats, rnd) : (cats[0] || '');
    // 在该 category 下随机抽一条 + 一条
    const pool = cat ? (catPools[cat] || []) : [];
    let sources = [];
    if (pool.length >= 2) {
      const a = pool[Math.floor(rnd() * pool.length)];
      const b = pool[Math.floor(rnd() * pool.length)];
      sources = [{ cat: a.category, titleZh: a.titleZh, title: a.title, source: a.source }];
      if (b !== a) sources.push({ cat: b.category, titleZh: b.titleZh, title: b.title, source: b.source });
    } else if (pool.length === 1) {
      const a = pool[0];
      sources = [{ cat: a.category, titleZh: a.titleZh, title: a.title, source: a.source }];
    } else if (cat) {
      sources = [{ cat, titleZh: '', title: '', source: '' }];
    }
    // voice：本地模板就用用户当前选的一个 voice 名，更贴近"风格"
    const voiceId = (INSPIRE_STATE.voices && INSPIRE_STATE.voices[0]) || 'night';
    const voiceObj = INSPIRE_VOICES.find(v => v.id === voiceId) || INSPIRE_VOICES[0];
    items.push({ voice: voiceObj.name, text: fillTpl(tpl, lib.pool, rnd), sources });
  }
  return items;
}

// 离线回退缓存：与 news.json 同步，仅在联网失败时启用，界面明确标"缓存"
const LAST_CACHE = {
  fetchedAt: '2026-08-19T00:53:00+08:00', status: 'cache',
  items: [
    { id: 'openai-ultrafast', title: 'Previewing Ultrafast mode: GPT-5.6 Sol at up to 14X the speed', titleZh: '预览 Ultrafast 模式：GPT-5.6 Sol 速度最高提升 14 倍', summary: 'OpenAI 预览 GPT-5.6 的 Ultrafast（极速）模式 Sol，在尽量保持质量的同时把推理速度提升到最高 14 倍，面向对延迟敏感的生产场景。', source: 'OpenAI', sourceUrl: 'https://openai.com/news', publishedAt: '2026-08-13', url: 'https://openai.com/index/previewing-ultrafast/', image: null, tags: ['模型', '推理', '速度'], category: 'ai', translated: true },
    { id: 'openai-gpt56-guide', title: "The builder's guide to GPT-5.6", titleZh: 'GPT-5.6 构建者指南', summary: 'OpenAI 发布面向开发者的 GPT-5.6 使用指南，系统讲解新模型的推理、工具调用与 Agent 编排能力，以及落地到生产环境的最佳实践。', source: 'OpenAI', sourceUrl: 'https://openai.com/news', publishedAt: '2026-08-13', url: 'https://openai.com/index/builders-guide-to-gpt-5-6/', image: null, tags: ['模型', '推理', '工具调用'], category: 'ai', translated: true },
    { id: 'openai-chatgpt-teens', title: 'Introducing ChatGPT for Teens', titleZh: '推出面向青少年的 ChatGPT', summary: 'OpenAI 推出面向青少年的 ChatGPT 版本，配套家长管控与适龄安全设置，扩展产品在年轻用户群体的可用边界。', source: 'OpenAI', sourceUrl: 'https://openai.com/news', publishedAt: '2026-08-18', url: 'https://openai.com/index/chatgpt-for-teens/', image: null, tags: ['产品'], category: 'ai', translated: true },
    { id: 'hf-state-open-models', title: 'State of Open Models: Summer 2026 Observations', titleZh: '开源模型现状：2026 夏季观察', summary: 'Hugging Face 发布 2026 夏季开源模型观察：中国实验室在开放大模型参数规模上持续领先，Qwen 成长为社区基石模型（衍生超 15 万仓库）；Agent 首次成为 Hub 第一大用户；本地推理（llama.cpp 等）仍是部署主力。', source: 'Hugging Face', sourceUrl: 'https://huggingface.co/blog', publishedAt: '2026-08-14', url: 'https://huggingface.co/blog/state-of-open-models-summer-2026', image: 'https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/state-of-open-models-summer-2026/dataset-growth.png', tags: ['开源模型', 'Agent', '推理'], category: 'opensource', translated: true },
    { id: 'github-copilot-review-mcp', title: 'Copilot code review: Agent skills and MCP now generally available', titleZh: 'Copilot 代码审查：Agent Skills 与 MCP 正式可用', summary: 'GitHub 宣布 Copilot 代码审查对 Agent skills 与 MCP 服务器的支持已对所有 Copilot Pro、Pro+ 等用户正式可用（GA），让代码审查能调用自定义技能与外部工具服务器。', source: 'GitHub', sourceUrl: 'https://github.blog/changelog/', publishedAt: '2026-07-29', url: 'https://github.blog/changelog/2026-07-29-copilot-code-review-agent-skills-and-mcp-now-generally-available/', image: null, tags: ['Agent', 'MCP', '工具调用'], category: 'ai', translated: true },
    { id: 'google-gemini-35-flash', title: 'Gemini 3.5 Flash', titleZh: 'Gemini 3.5 Flash', summary: 'Google 在 I/O 2026 发布 Gemini 3.5 Flash，首个将前沿智能与行动力结合的系列模型，在编码与 Agent 基准上超越 Gemini 3.1 Pro，适合长周期任务且成本更低。', source: 'Google', sourceUrl: 'https://blog.google/technology/ai/', publishedAt: '2026-05-20', url: 'https://blog.google/innovation-and-ai/technology/ai/google-io-2026-all-our-announcements/', image: null, tags: ['模型', 'Agent'], category: 'ai', translated: true },
    { id: 'google-gemini-omni', title: 'Gemini Omni: any input, any output', titleZh: 'Gemini Omni：从任意输入生成任意输出的多模态模型', summary: 'Google 发布 Gemini Omni，可从任意输入生成任意输出（先从视频起步），融合物理理解与 Gemini 知识，生成视频带 SynthID 水印；轻量版 Omni Flash 已向订阅用户与 YouTube 创作者开放。', source: 'Google', sourceUrl: 'https://blog.google/technology/ai/', publishedAt: '2026-05-20', url: 'https://blog.google/innovation-and-ai/technology/ai/google-io-2026-all-our-announcements/', image: null, tags: ['模型', '视频', '图像'], category: 'ai', translated: true },
    { id: 'google-gemini-spark', title: 'Gemini Spark: your 24/7 personal AI agent', titleZh: 'Gemini Spark：全天候个人 AI 代理', summary: 'Google 推出 Gemini Spark，基于 Antigravity 与 Gemini 3.5 的 24/7 个人代理，可在后台执行任务，先向 Ultra 订阅者推送 Beta。', source: 'Google', sourceUrl: 'https://blog.google/technology/ai/', publishedAt: '2026-05-20', url: 'https://blog.google/innovation-and-ai/technology/ai/google-io-2026-all-our-announcements/', image: null, tags: ['Agent'], category: 'ai', translated: true },
    { id: 'google-managed-agents', title: 'Managed Agents in the Gemini API', titleZh: 'Gemini API 托管代理（Managed Agents）', summary: 'Google 在 Gemini API 中推出 Managed Agents：一次 API 调用即可配置远程 Linux 沙箱，代理可推理、跑代码、浏览网页，由 Gemini 3.5 Flash 驱动。', source: 'Google', sourceUrl: 'https://blog.google/technology/ai/', publishedAt: '2026-05-20', url: 'https://blog.google/innovation-and-ai/technology/ai/google-io-2026-all-our-announcements/', image: null, tags: ['Agent', 'API', '工具调用'], category: 'ai', translated: true },
    { id: 'google-webmcp', title: 'WebMCP: an open web standard for browser agents', titleZh: 'WebMCP：面向浏览器代理的开放网络标准', summary: 'Google 提出 WebMCP 开放网络标准提案，向浏览器中的 AI 代理暴露结构化工具（如 JS 函数），让网页可原生被代理调用。', source: 'Google', sourceUrl: 'https://blog.google/technology/ai/', publishedAt: '2026-05-20', url: 'https://blog.google/innovation-and-ai/technology/ai/google-io-2026-all-our-announcements/', image: null, tags: ['MCP', 'Agent', '工具调用'], category: 'ai', translated: true },
    { id: 'smashing-baseline', title: 'How Baseline Can Help Ship Less JavaScript', titleZh: '用 Baseline 少写 JavaScript：浏览器原生能力就够了', summary: 'Smashing Magazine 实战：用 Baseline、Intl、Fetch、<dialog>、CSS 锚点定位这些浏览器原生能力，少依赖第三方包，包体积更小、加载更快。对你做网站很实用。', source: 'Smashing Magazine', sourceUrl: 'https://www.smashingmagazine.com/', publishedAt: '2026-08-07', url: 'https://smashingmagazine.com/2026/08/how-baseline-can-help-ship-less-javascript/', image: null, tags: ['前端', '性能', '实战'], category: 'frontend', translated: true },
    { id: 'smashing-lottie', title: 'Building Tactile UX: Honoring Intentional Design With Lottie', titleZh: '用 Lottie 做"有质感"的交互：不用物理引擎也好看', summary: 'Smashing Magazine：用 Lottie 做出"触觉感"的前端动效——靠 DOM、CSS 变量和移动端性能优化，不引入重型物理引擎，也能让界面有质感。适合你追求视觉的站点。', source: 'Smashing Magazine', sourceUrl: 'https://www.smashingmagazine.com/', publishedAt: '2026-08-11', url: 'https://smashingmagazine.com/2026/08/building-tactile-ux-honoring-intentional-design-lottie/', image: null, tags: ['前端', '动效', '设计'], category: 'frontend', translated: true },
    { id: 'csstricks-darkmode', title: 'Dark mode toggles: two states are enough', titleZh: '深色模式开关：两种状态就够，别过度设计', summary: 'CSS-Tricks：深色模式切换只要"亮/暗"两种状态就够了，别搞一堆中间档把用户绕晕。前端 UI 的实用小贴士，你站点也能用。', source: 'CSS-Tricks', sourceUrl: 'https://css-tricks.com/', publishedAt: '2026-08-17', url: 'https://css-tricks.com/dark-mode-toggles-two-states-are-enough/', image: null, tags: ['前端', 'UI', '深色模式'], category: 'frontend', translated: true },
    { id: 'quanta-fluids', title: 'Theory of Fluids Enters the 21st Century', titleZh: '流体理论迈入 21 世纪', summary: '从 19 世纪到 21 世纪初，物理学家一直用同一套理论理解流体。现在借助一个现代洞见，他们从底层重新定义了流体的理论——物理前沿的科普。', source: 'Quanta Magazine', sourceUrl: 'https://www.quantamagazine.org', publishedAt: '2026-08-17', url: 'https://www.quantamagazine.org/theory-of-fluids-enters-the-21st-century-20260817/', image: 'https://www.quantamagazine.org/wp-content/uploads/2026/08/Slow-mo-paint-cr-DepositPhotos_Alamy-Default.webp', tags: ['物理', '流体', '前沿'], category: 'science', translated: true },
    { id: 'quanta-aging', title: 'Why Aging May Be a Program, Not a Breakdown', titleZh: '衰老可能是程序设定，而不是自然损耗', summary: '科学家通过解密数百万小鼠细胞的分子特征，发现衰老更像一场"细胞社会的重组"，而不是随机磨损——这个视角正在改变衰老研究。', source: 'Quanta Magazine', sourceUrl: 'https://www.quantamagazine.org', publishedAt: '2026-08-14', url: 'https://www.quantamagazine.org/why-aging-may-be-a-program-not-a-breakdown-20260814/', image: 'https://www.quantamagazine.org/wp-content/uploads/2026/08/Junyue-Cao-cr-Karan-Dias-Default.webp', tags: ['生物', '衰老', '研究'], category: 'science', translated: true },
    { id: 'quanta-fractal', title: 'Graduate Student Proves a Quantum Uncertainty Principle for Fractals', titleZh: '研究生证明分形的量子不确定性原理', summary: '一位研究生把混沌、量子理论和无限复杂的分形结构结合，证明了一个被称为"基础性成果"的新不确定性原理——数学物理的突破。', source: 'Quanta Magazine', sourceUrl: 'https://www.quantamagazine.org', publishedAt: '2026-08-12', url: 'https://www.quantamagazine.org/graduate-student-proves-the-fractal-uncertainty-principle-20260812/', image: 'https://www.quantamagazine.org/wp-content/uploads/2026/08/Fractal-Uncertainty-cr-Ada-Zejun-Shen-Default.webp', tags: ['数学', '量子', '突破'], category: 'science', translated: true },
    { id: 'quanta-rivers', title: 'Why Are Rivers So Mathematical?', titleZh: '为什么河流如此数学？', summary: '一条简单的尺度定律让混乱的水流、岩石和泥沙有了秩序。新发现把这条定律推得更远——自然界里的数学之美。', source: 'Quanta Magazine', sourceUrl: 'https://www.quantamagazine.org', publishedAt: '2026-08-10', url: 'https://www.quantamagazine.org/why-are-rivers-so-mathematical-20260810/', image: 'https://www.quantamagazine.org/wp-content/uploads/2026/08/Qualia-River-Fractals-cr-Ada-Zejun-Shen-Default.webp', tags: ['数学', '自然', '规律'], category: 'science', translated: true },
    { id: 'aeon-zealotry', title: 'In praise of zealotry', titleZh: '赞颂狂热：为什么被边缘化的人需要"不礼貌"的辩论', summary: '思想史散文：早期女权主义者（如 Mary Astell）拒绝在辩论里保持"礼貌"，因为礼貌的框架本身就带着特权。关于辩论伦理、思想自由与发声方式的哲学反思。', source: 'Aeon', sourceUrl: 'https://aeon.co', publishedAt: '2026-08-18', url: 'https://aeon.co/essays/polite-debate-has-privilege-the-marginalised-need-zealotry', image: null, tags: ['哲学', '伦理', '思辨'], category: 'philosophy', translated: true },
    { id: 'aeon-stereotyping', title: 'How we meet the future', titleZh: '我们如何遇见未来：刻板印象何时是工具、何时是罪', summary: '哲学散文：刻板印象不全是坏事——有时候它是快速理解世界的"工具"，有时候却变成偏见与伤害的"罪"。探讨它到底该何时用、何时该停下。', source: 'Aeon', sourceUrl: 'https://aeon.co', publishedAt: '2026-08-10', url: 'https://aeon.co/essays/when-is-stereotyping-a-handy-tool-and-when-is-it-a-sin', image: null, tags: ['哲学', '认知', '思辨'], category: 'philosophy', translated: true },
    { id: 'devto-framework-recover', title: 'Recover a Bricked Framework 13 with a DIY USB Flash', titleZh: '用自制 U 盘救活一台砖掉的 Framework 13 笔记本', summary: '开发者实战：笔记本刷 BIOS 失败变砖，靠自己做的 U 盘引导工具 + Bash/Python 脚本救回来。动手党可以学思路。', source: 'DEV Community', sourceUrl: 'https://dev.to/', publishedAt: '2026-08-19', url: 'https://dev.to/robust_true_try/recover-a-bricked-framework-13-with-a-diy-usb-flash-9li', image: null, tags: ['编程', '硬件', '实战'], category: 'code', translated: true },
    { id: 'devto-airreview', title: 'The AI Review Trap: Why 9 Out of 10 Models Just Parrot Your Docs', titleZh: 'AI 代码评审陷阱：90% 模型只是在复读你的代码库', summary: '工程师评测发现：90% 的 AI 代码评审模型只是把测试文档复读一遍——并没有真正"理解"代码。', source: 'DEV Community', sourceUrl: 'https://dev.to/', publishedAt: '2026-08-19', url: 'https://dev.to/insight105/the-ai-review-trap-why-9-out-of-10-models-just-parrot-your-docs-d67', image: null, tags: ['AI', '测试', '评测'], category: 'code', translated: true },
    { id: 'hn-cursor-origin', title: 'Cursor launches Origin, GitHub alternative', titleZh: 'Cursor 推出 Origin：要做 GitHub 的替代品', summary: 'AI 代码编辑器 Cursor 推出代码托管服务 Origin，直接对标 GitHub。', source: 'Hacker News', sourceUrl: 'https://news.ycombinator.com/', publishedAt: '2026-08-17', url: 'https://cursor.com/changelog/origin-code-hosting', image: null, tags: ['AI', '代码托管', 'Cursor'], category: 'code', translated: true },
    { id: 'hn-memory-prices', title: 'Memory prices climb 500% in 12 months', titleZh: '内存价格一年暴涨 500%：128GB DDR5 卖到 3399 美元', summary: 'Tom\'s Hardware：DDR5 内存过去一年涨价 500%，高端型号涨幅 10 倍。', source: 'Hacker News', sourceUrl: 'https://news.ycombinator.com/', publishedAt: '2026-08-17', url: 'https://www.tomshardware.com/pc-components/ram/memory-prices-climb-500-percent-in-12-months-up-to-10x-the-lowest-ever-tracked-prices-128gb-of-ddr5-now-usd3-399', image: null, tags: ['硬件', '内存', '价格'], category: 'hardware', translated: true },
    { id: 'hn-moon-satellite', title: 'Tiny satellite will use the dark side of the Moon as a shield', titleZh: '用月球背面当"屏蔽罩"的小卫星：去偷听早期宇宙的低语', summary: '剑桥大学新发射一颗小卫星，靠月球背面挡住地球无线电干扰，监听早期宇宙的低频信号。', source: 'Hacker News', sourceUrl: 'https://news.ycombinator.com/', publishedAt: '2026-08-19', url: 'https://www.cam.ac.uk/research/news/tiny-satellite-will-use-the-dark-side-of-the-moon-to-eavesdrop-on-whispers-from-the-early-universe', image: null, tags: ['天文', '卫星', '前沿'], category: 'science', translated: true },
    { id: 'yys-oddgame', title: '一款“刮鱼鳞”的游戏上线前，数百万人已经玩过它的山寨版', titleZh: '一款“刮鱼鳞”的游戏上线前，数百万人已玩过它的山寨版', summary: '游研社人文故事：创意可以被抄走，但精神不会。一款小众独立游戏的山寨版先火了——讲的是原创与模仿背后的游戏文化。', source: '游研社', sourceUrl: 'https://www.yystv.cn/', publishedAt: '2026-08-19', url: 'https://www.yystv.cn/p/14282', image: null, tags: ['游戏', '人文', '独立游戏'], category: 'game', translated: true },
    { id: 'yys-sega', title: '世嘉在中国：30年、7家公司，与一次新的归来', titleZh: '世嘉在中国：30 年、7 家公司，与一次新的归来', summary: '从街机、主机到 VCD，再到 PC、网游与旗舰店——世嘉在中国的 30 年，就是一部中国游戏玩家记忆的编年史。', source: '游研社', sourceUrl: 'https://www.yystv.cn/', publishedAt: '2026-08-18', url: 'https://www.yystv.cn/p/14276', image: null, tags: ['游戏', '历史', '人文'], category: 'game', translated: true },
    { id: 'dpm-forum', title: '故宫博物院举办第五届故宫学与古代建筑营造讲习班', titleZh: '故宫举办第五届故宫学与古代建筑营造讲习班', summary: '故宫官方资讯：第五届故宫学与古代建筑营造讲习班开讲，古代建筑怎么造、怎么修复——文博爱好者的干货。', source: '故宫博物院', sourceUrl: 'https://www.dpm.org.cn/', publishedAt: '2026-08-13', url: 'https://www.dpm.org.cn/classify_detail/379498.html', image: null, tags: ['文博', '古建', '故宫'], category: 'museum', translated: true },
    { id: 'dpm-bag', title: '2026年“故宫小书包”暑期公益活动在故宫博物院举办', titleZh: '2026 年“故宫小书包”暑期公益活动在故宫举办', summary: '故宫官方资讯：面向孩子的“故宫小书包”暑期公益活动，把传统文化装进书包——文博教育的日常模样。', source: '故宫博物院', sourceUrl: 'https://www.dpm.org.cn/', publishedAt: '2026-08-11', url: 'https://www.dpm.org.cn/activity/education/379429.html', image: null, tags: ['文博', '教育', '故宫'], category: 'museum', translated: true },
  ],
};

function fmtFetched(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = n => (n < 10 ? '0' : '') + n;
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function srcClass(src) { return 'src-' + String(src).toLowerCase().replace(/[^a-z]/g, ''); }

/* 三段式卡片（v14 清爽版）：来源·日期 · 标题 · 摘要 · 展开原话 · 底部操作 */
function newsCard(it) {
  const hasZh = !!(it.titleZh && it.titleZh !== it.title);
  const title = hasZh ? it.titleZh : it.title;
  const summary = it.summary || (it.translated === false ? '（原文未译，保留英文）' : '');
  const img = it.image
    ? '<div class="nc-img" style="background-image:url(\'' + it.image + '\')"></div>'
    : '<div class="nc-img nc-ph ' + srcClass(it.source) + '"><span data-icon="radar"></span><b>' + esc(it.source) + '</b></div>';
  const dateTxt = (it.publishedAt || '').slice(5).replace('-', '/');
  const hasQuote = !!(it.quote || (it.title && it.title !== it.titleZh));
  const orig = hasQuote
    ? '<div class="nc-orig">'
      + '<button class="nc-orig-btn" type="button" aria-expanded="false"><span data-icon="quote"></span>展开原话<b class="nc-chev">▾</b></button>'
      + '<div class="nc-orig-body" hidden>'
      + (it.quote ? '<p class="nc-quote">' + esc(it.quote) + '</p>' : '')
      + (it.title && it.title !== it.titleZh ? '<p class="nc-quote nc-quote-en">' + esc(it.title) + '</p>' : '')
      + ((it.terms || []).length ? '<ul class="nc-terms">' + it.terms.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '')
      + '</div></div>'
    : '';
  const saved = isSaved(it.id);
  // 未翻译条目才显示"译"按钮（已有人话版的不需要）
  const hzBtn = !hasZh ? '<button class="nc-hz" type="button" data-hz="' + esc(it.id) + '" aria-label="译成人话">译</button>' : '';
  // "问 AI"按钮：把这条资讯作为上下文发给 AI（任何状态下都显示）
  const askBtn = '<button class="nc-ask" type="button" data-ask="' + esc(it.id) + '" aria-label="就这条问 AI"><span data-icon="spark"></span>问 AI</button>';
  return '<div class="ncard">'
    + img
    + '<div class="nc-body">'
    + '<div class="nc-top"><span class="nc-src ' + srcClass(it.source) + '">' + esc(it.source) + '</span>'
    + '<span class="nc-date">' + esc(dateTxt) + '</span>'
    + hzBtn
    + askBtn
    + '</div>'
    + '<h3 class="nc-title">' + esc(title) + (hasZh ? '' : ' <em class="nc-en">原文</em>') + '</h3>'
    + '<p class="nc-sum">' + esc(summary) + '</p>'
    + orig
    + '<div class="nc-foot">'
    + '<button class="nc-copy" type="button" data-copy="' + esc(copyText(it)) + '">复制</button>'
    + '<button class="nc-fav' + (saved ? ' on' : '') + '" type="button" data-fav="' + esc(it.id) + '">' + (saved ? '已收藏' : '收藏') + '</button>'
    + '<a class="nc-open" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">打开原文 <span data-icon="arrow"></span></a>'
    + '</div>'
    + '</div></div>';
}

/* ---------------- 收藏（摘抄本） ---------------- */
const SAVED_KEY = 'ae_saved';
function getSaved() { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch (e) { return []; } }
function setSaved(list) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch (e) {} }
function isSaved(id) { return getSaved().some(x => x.id === id); }
function copyText(it) {
  return '【' + (it.titleZh || it.title) + '】\n' + (it.summary || '')
    + (it.quote ? '\n原话：' + it.quote : '')
    + '\n来源：' + it.source + '\n原文：' + it.url;
}
function copyToClipboard(text) {
  return new Promise(resolve => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => resolve(true)).catch(() => fallback());
        return;
      }
    } catch (e) {}
    fallback();
    function fallback() {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta); resolve(ok);
      } catch (e) { resolve(false); }
    }
  });
}
function copySaved(x) {
  return x.title + (x.summary ? '\n' + x.summary : '') + '\n来源：' + x.source + (x.url ? '\n' + x.url : '');
}
function saveCard(it) {
  const list = getSaved();
  const ex = list.find(x => x.id === it.id);
  if (ex) { setSaved(list.filter(x => x.id !== it.id)); renderSaved(); return '已取消收藏'; }
  list.unshift({ id: it.id, title: it.titleZh || it.title, summary: it.summary || '', source: it.source, url: it.url, savedAt: Date.now() });
  setSaved(list); renderSaved(); return '已收藏 · 灵感清单里有你的摘抄本';
}
function renderSaved() {
  const box = $('#savedList'); if (!box) return;
  const list = getSaved();
  const cnt = $('#savedCount'); if (cnt) cnt.textContent = list.length;
  if (!list.length) {
    box.innerHTML = '<div class="inspire-empty">还没有收藏。看到喜欢的句子，点卡片或灵感上的"收藏"就会收进来。</div>';
    return;
  }
  box.innerHTML = list.map(x =>
    '<div class="saved-item">'
    + '<p class="saved-txt">' + esc(x.title) + '</p>'
    + (x.summary ? '<p class="saved-sum">' + esc(x.summary) + '</p>' : '')
    + '<div class="saved-foot"><span class="saved-src">' + esc(x.source) + '</span>'
    + '<button class="saved-copy" type="button" data-copy="' + esc(copySaved(x)) + '">复制</button>'
    + '<button class="saved-del" type="button" data-del="' + esc(x.id) + '">删除</button></div></div>'
  ).join('');
}

/* 人话服务：经 Cloudflare（Pages Functions 优先，key 在服务端），三段式改写单条资讯 */
async function humanizeCard(it, cardEl) {
  if (!it) return;
  const btn = cardEl.querySelector('.nc-hz');
  if (btn) btn.textContent = '改写中';
  try {
    let data = null;
    for (const ep of [PAGES_API + '/humanize', WORKER + '/humanize']) {
      try {
        const resp = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: { title: it.titleZh || it.title || '', summary: it.summary || '' } })
        });
        const d = await resp.json();
        if (d.ok && d.result) { data = d; break; }
      } catch (e) { /* 换通道 */ }
    }
    if (!data || !data.result) throw new Error((data && data.error) || '改写失败');
    const text = data.result;
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    let titleZh = '', plain = '', quote = '', terms = [];
    for (const ln of lines) {
      if (/^标题[:：]/.test(ln)) titleZh = ln.replace(/^标题[:：]/, '').trim();
      else if (/^大白话[:：]/.test(ln)) plain = ln.replace(/^大白话[:：]/, '').trim();
      else if (/^原文[:：]/.test(ln)) quote = ln.replace(/^原文[:：]/, '').trim();
      else if (/^术语[:：]/.test(ln)) { /* 术语段起始，后面以 = 分隔的行都属于术语 */ }
      else if (/[=＝]/.test(ln) && /^[^：]{1,12}[=＝]/.test(ln)) terms.push(ln.trim());
    }
    if (!titleZh && !plain) { titleZh = ''; plain = text.slice(0, 140); }
    const body = cardEl.querySelector('.nc-body');
    if (body) {
      const tt = body.querySelector('.nc-title'); if (tt && titleZh) tt.textContent = titleZh;
      const ss = body.querySelector('.nc-sum'); if (ss && plain) ss.textContent = plain;
      // 更新原文区：若卡片原本没有，则动态补一个
      let orig = body.querySelector('.nc-orig');
      const foot = body.querySelector('.nc-foot');
      if ((quote || terms.length) && !orig && foot) {
        orig = document.createElement('div'); orig.className = 'nc-orig';
        orig.innerHTML = '<button class="nc-orig-btn" type="button" aria-expanded="false"><span data-icon="quote"></span>展开原话<b class="nc-chev">▾</b></button>'
          + '<div class="nc-orig-body" hidden></div>';
        foot.parentNode.insertBefore(orig, foot);
        orig.querySelector('.nc-orig-btn').addEventListener('click', () => toggleOrig(orig));
      }
      if (orig) {
        const ob = orig.querySelector('.nc-orig-body');
        let html = '';
        if (quote) html += '<p class="nc-quote">' + esc(quote) + '</p>';
        if (it.title && it.title !== it.titleZh) html += '<p class="nc-quote nc-quote-en">' + esc(it.title) + '</p>';
        if (terms.length) html += '<ul class="nc-terms">' + terms.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>';
        if (html) ob.innerHTML = html;
      }
    }
    if (btn) btn.textContent = '已译';
    toast('已改写成大白话，展开原话可看原文与术语');
  } catch (e) {
    console.error(e);
    toast('人话改写失败：' + (e.message || 'Worker 未就绪'));
    if (btn) btn.textContent = '译';
  }
}

function toggleOrig(orig) {
  const btn = orig.querySelector('.nc-orig-btn');
  const body = orig.querySelector('.nc-orig-body');
  const open = body.hidden;
  body.hidden = !open;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  btn.classList.toggle('open', open);
}

/* 渲染灵感列表（本地模板或 AI 结果都走这里）
   items: [{ voice?: string, text: string, tag?: string, sources?: [{cat,titleZh,title,source}], source?: { newsCount, voices, style, usedAt, sources } }] */
function renderInspire(out, items, footerNote) {
  if (!items || !items.length) { out.innerHTML = '<div class="inspire-empty">换个类别试试</div>'; return; }
  const used = items[0] && items[0].source;
  out.innerHTML = items.map((it, idx) => {
    const voiceText = (it.voice || it.tag || '').trim();
    // 1) 来源类别标签（夜行者/歌词体...是风格，区别开！）
    const cats = (it.sources || []).map(s => s.cat).filter(Boolean);
    const uniqueCats = [...new Set(cats)];
    const catLabels = uniqueCats.map(c => CAT_LABEL[c] || c);
    const catHtml = catLabels.length
      ? '<span class="inspire-cat" title="灵感来源的真实资讯类别">' + esc(catLabels.join(' · ')) + '</span>'
      : '';
    // 2) 风格标签（仅当有 voice 时）
    const styleHtml = voiceText
      ? '<span class="inspire-tag" title="你选/AI 选中的写作风格">' + esc(voiceText) + '</span>'
      : '';
    // 3) 来源资讯展开区
    const sources = it.sources || [];
    const srcHtml = sources.length
      ? '<div class="inspire-src" hidden>'
        + sources.map(s => '<div class="inspire-src-row">'
          + '<span class="inspire-src-cat">' + esc(CAT_LABEL[s.cat] || s.cat || '资讯') + '</span>'
          + '<span class="inspire-src-tx">' + esc((s.titleZh || s.title || '').slice(0, 46)) + '</span>'
          + '</div>').join('')
        + '</div>'
      : '';
    const toggleBtn = sources.length
      ? '<button class="inspire-src-toggle" type="button" data-toggle-src="' + idx + '">▾ 来源 ' + sources.length + ' 条</button>'
      : '';
    return (
      '<div class="inspire-item">'
      + '<div class="inspire-tags-row">'
      + catHtml
      + styleHtml
      + '</div>'
      + '<span class="inspire-txt">' + esc(it.text) + '</span>'
      + toggleBtn
      + srcHtml
      + '<div class="inspire-item-act">'
      + '<button class="inspire-fav" type="button" data-favtxt="' + esc(it.text) + '">收藏</button>'
      + '<button class="inspire-copy" type="button" data-copy="' + esc(it.text) + '">复制</button>'
      + '</div></div>'
    );
  }).join('');

  // 展开 / 折叠 来源资讯
  out.querySelectorAll('.inspire-src-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.inspire-item');
      const box = item && item.querySelector('.inspire-src');
      if (!box) return;
      const open = box.hidden;
      box.hidden = !open;
      btn.classList.toggle('on', open);
      btn.textContent = (open ? '▴ ' : '▾ ') + '来源 ' + box.querySelectorAll('.inspire-src-row').length + ' 条';
    });
  });

  // 底部行：AI 来源 / 参考资讯条数 / 风格 / 剩余次数
  const styleLbl = { boxed: '一条一框', passage: '段落', mixed: '自动' };
  const meta = used ? (
    (used.newsCount != null ? '参考 ' + used.newsCount + ' 条真实资讯 · ' : '')
    + (used.voices && used.voices.length ? '风格：' + used.voices.join(' / ') + ' · ' : '')
    + (used.style ? '格式：' + (styleLbl[used.style] || used.style) + ' · ' : '')
    + (used.usedAt ? fmtTime(used.usedAt) : '')
  ).replace(/ · $/, '') : '';
  out.insertAdjacentHTML('beforeend',
    '<div class="inspire-meta">' + esc(meta) + '</div>'
    + (footerNote ? '<div class="inspire-note">' + esc(footerNote) + '</div>' : '')
  );
}

/* 灵感清单：本地模板引擎即时生成（零网络、任何设备不失败） */
function genInspire() {
  const btn = $('#inspireBtn'), out = $('#inspireOut');
  if (!btn || !out) return;
  try {
    const cats = NEWS_SELECTED.length ? NEWS_SELECTED : [];
    const labels = cats.map(catLabel);
    const items = genLocalInspire(cats);
    if (!items.length) { renderInspire(out, []); return; }
    renderInspire(out, items);
    toast(labels.length ? '本地灵感已生成 · 跟「' + labels.join('、') + '」' : '本地灵感已生成 · 全主题');
  } catch (e) {
    console.error('genInspire 出错', e);
    toast('本地灵感生成遇到问题，稍后重试');
  }
}

/* ================= AI 深度生成 =================
   通过 Pages Functions（主通道）+ Cloudflare Worker（备用）双通道
   限次/埋点都在服务端，前端只负责 UX */
async function aiInspire() {
  const btn = $('#inspireAiBtn'), out = $('#inspireOut');
  if (!btn || !out) return;
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="ai-spin"></span>AI 生成中…';

  // 选择的风格（用 id 取回完整 {name, desc} 发给后端）
  const chosen = (INSPIRE_STATE.voices || []).map(id => INSPIRE_VOICES.find(v => v.id === id)).filter(Boolean);
  if (!chosen.length) chosen.push(INSPIRE_VOICES[0]); // 至少有一个

  const tags = NEWS_SELECTED.length ? NEWS_SELECTED.map(catLabel) : ['文博', '华语流行音乐', '游戏人文', '现代诗歌'];
  // 抓真实资讯喂给 AI：跟随勾选类别；没勾就全量。每次随机抽 6 条，避免永远喂同一批导致雷同
  const pool = (NEWS_SELECTED.length ? NEWS_ITEMS.filter(i => NEWS_SELECTED.includes(i.category)) : NEWS_ITEMS).slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  // 取 6 条喂 AI；来源资讯（前端展示）：用新闻的精简快照 [{cat,titleZh,title,source}]
  const news = pool.slice(0, 6).map(n => ({ titleZh: n.titleZh || '', title: n.title || '', summary: n.summary || '' }));
  const newsSources = pool.slice(0, 6).map(n => ({ cat: n.category, titleZh: n.titleZh || '', title: n.title || '', source: n.source || '' }));

  const devId = (window.AEAuth && window.AEAuth.getDev && window.AEAuth.getDev()) || '';
  let aiSuccess = false;
  const endpoints = [PAGES_API + '/inspire', WORKER + '/inspire'];
  for (const ep of endpoints) {
    if (aiSuccess) break;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-id': devId },
        body: JSON.stringify({ tags, news, voices: chosen, style: INSPIRE_STATE.style }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const d = await r.json();
      // 主通道返回 {ok, items, voices, style, ms, used, left, limit}
      if (d.ok && Array.isArray(d.items) && d.items.length) {
        const source = {
          newsCount: news.length,
          voices: (d.voices && d.voices.length) ? d.voices : chosen.map(c => c.name),
          style: d.style || INSPIRE_STATE.style,
          usedAt: Date.now(),
          sources: newsSources.slice(),
        };
        // 启发式匹配：让每条 item 优先挂载"它文本里出现过的来源"。
        // 没匹配上的兜底挂一条随机来源，保证都能展开。
        const fallback = newsSources[Math.floor(Math.random() * newsSources.length)] || null;
        const list = d.items.map(it => {
          const hit = newsSources.find(s => {
            const k = (s.titleZh || s.title || '').slice(0, 6);
            return k && it.text && it.text.indexOf(k) >= 0;
          }) || fallback;
          return {
            voice: it.voice || source.voices[0] || '',
            text: it.text,
            sources: hit ? [hit, ...newsSources.filter(x => x !== hit)] : newsSources.slice(),
            source,
          };
        });
        renderInspire(out, list, '来自云端 · DeepSeek 深度生成');
        aiSuccess = true;
        if (typeof d.left === 'number') updateInspireQuota(d);
        try { localStorage.setItem('ae_last_ai', JSON.stringify({ ts: Date.now(), count: list.length, src: 'cloud', voices: source.voices, style: source.style })); } catch (e) {}
        showLastAi();
      } else if (d.ok && d.result) {
        // 备用 worker 通道回退（旧 items 字符串）
        const lines = d.result.split('\n').map(s => s.trim()).filter(Boolean);
        const source = { newsCount: news.length, voices: chosen.map(c => c.name), style: INSPIRE_STATE.style, usedAt: Date.now(), sources: newsSources.slice() };
        const list = lines.map(l => ({ voice: chosen[0].name, text: l.replace(/^「|」$/g, ''), sources: newsSources.slice(), source }));
        renderInspire(out, list, '来自云端 · DeepSeek 深度生成');
        aiSuccess = true;
        try { localStorage.setItem('ae_last_ai', JSON.stringify({ ts: Date.now(), count: list.length, src: 'cloud' })); } catch (e) {}
        showLastAi();
      } else if (d && d.limit) {
        toast('今日 AI 灵感额度已用完（' + (d.max || 20) + ' 次/天），明天再来。');
        btn.disabled = false; btn.innerHTML = orig;
        return;
      }
    } catch (e) { /* 换下一个通道 */ }
  }
  if (!aiSuccess) {
    btn.disabled = false; btn.innerHTML = orig;
    toast('AI 深度暂不可用：云端服务在当前网络下连接失败。本地灵感不受影响。');
    return;
  }
  btn.disabled = false; btn.innerHTML = orig;
}
function updateInspireQuota(d) {
  const tip = $('#inspireAiTip');
  if (!tip) return;
  if (typeof d.left === 'number' && d.left >= 0) {
    tip.innerHTML = 'AI 灵感 · 今日还剩 <b>' + d.left + '</b>/' + (d.limit || 20) + ' 次';
    tip.dataset.left = String(d.left);
  }
}
/* 把"声音/格式"配置 chip 渲染并绑定（用户可多选 1-3 个声音） */
function mountInspireCfg() {
  const vBox = $('#voiceChips'); const sBox = $('#styleChips'); if (!vBox || !sBox) return;
  vBox.innerHTML = INSPIRE_VOICES.map(v => '<button class="chip voice" type="button" data-vid="' + v.id + '" title="' + esc(v.desc) + '">' + esc(v.name) + '</button>').join('');
  // 默认选中状态
  const setActives = () => {
    vBox.querySelectorAll('.voice').forEach(b => b.classList.toggle('on', (INSPIRE_STATE.voices || []).includes(b.dataset.vid)));
    sBox.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b.dataset.style === INSPIRE_STATE.style));
  };
  setActives();
  vBox.addEventListener('click', e => {
    const b = e.target.closest('.voice'); if (!b) return;
    const id = b.dataset.vid; const arr = INSPIRE_STATE.voices.slice();
    const idx = arr.indexOf(id);
    if (idx >= 0) { if (arr.length > 1) arr.splice(idx, 1); } else arr.push(id);
    INSPIRE_STATE.voices = arr.slice(-3);
    setActives();
  });
  sBox.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b || !b.dataset.style) return;
    INSPIRE_STATE.style = b.dataset.style; setActives();
  });
}
/* 显示"上次 AI 生成"时间，让用户看到 AI 真在工作 */
function showLastAi() {
  const box = $('#lastAi'); if (!box) return;
  try {
    const v = JSON.parse(localStorage.getItem('ae_last_ai') || 'null');
    if (!v) { box.hidden = true; return; }
    const d = new Date(v.ts);
    const p = n => (n < 10 ? '0' : '') + n;
    box.hidden = false;
    box.textContent = '上次 AI 生成：' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ' · ' + v.count + ' 条（来自 Cloudflare · DeepSeek）';
  } catch (e) { box.hidden = true; }
}

/* ================= AI 对话抽屉（基于单条资讯 / 当前栏目） =================
   设计原则：聊天气泡式、固定右下角、能关掉；移动端可全屏。
   上下文类型：
     - 单条：点资讯卡片"问 AI" → openChatWithItem(it)
     - 整组：栏目"就这些问 AI" → openChatWithCategory()
   限次：服务端限 20 次/天（CHAT_LIMIT），会显示剩余次数。 */
let chatDrawer = null;
let chatState = { messages: [], context: null, sending: false, left: 20, limit: 20 };

function ensureChatDrawer() {
  if (chatDrawer) return chatDrawer;
  const el = document.createElement('div');
  el.className = 'chat-drawer';
  el.id = 'chatDrawer';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="chat-head">
      <div class="chat-tx">
        <b id="chatTitle">AI 对话</b>
        <span class="chat-sub" id="chatSub">就你勾选的资讯聊两句</span>
      </div>
      <div class="chat-meta">
        <span class="chat-quota" id="chatQuota">剩余 20/20 次</span>
        <button class="chat-close" id="chatClose" type="button" aria-label="关闭">✕</button>
      </div>
    </div>
    <div class="chat-body" id="chatBody"></div>
    <form class="chat-form" id="chatForm">
      <input class="chat-inp" id="chatInp" type="text" maxlength="500" placeholder="问点什么…" autocomplete="off">
      <button class="chat-send" id="chatSend" type="submit" disabled>发送</button>
    </form>`;
  document.body.appendChild(el);

  $('#chatClose', el).onclick = () => toggleChatDrawer(false);
  $('#chatForm', el).onsubmit = e => { e.preventDefault(); sendChat(); };
  $('#chatInp', el).oninput = () => { $('#chatSend', el).disabled = !$('#chatInp', el).value.trim(); };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && el.classList.contains('on')) toggleChatDrawer(false);
  });
  chatDrawer = el;
  return el;
}

function toggleChatDrawer(on, ctx) {
  const el = ensureChatDrawer();
  if (ctx) {
    chatState.context = ctx;
    chatState.messages = [];
  }
  if (on) {
    el.classList.add('on');
    el.setAttribute('aria-hidden', 'false');
    if (ctx && ctx.type === 'item' && ctx.item) {
      $('#chatTitle', el).textContent = '问 AI · ' + ((ctx.item.titleZh || ctx.item.title || '').slice(0, 18));
    } else if (ctx && ctx.type === 'category') {
      $('#chatTitle', el).textContent = '就这些问 AI';
    } else {
      $('#chatTitle', el).textContent = 'AI 对话';
    }
    refreshChatQuota();
    if (!chatState.messages.length) {
      const open = ctx && ctx.type === 'item'
        ? '我刚看了这条：\n「' + (ctx.item.titleZh || ctx.item.title || '') + '」\n你想问什么都可以。'
        : '我看了你勾选栏目里最近的资讯，可以帮我总结、对比、挑一条最值得细读的吗？';
      pushChatMsg('user', open);
    }
    renderChatBody();
    setTimeout(() => { try { $('#chatInp', el).focus(); } catch (e) {} }, 80);
  } else {
    el.classList.remove('on');
    el.setAttribute('aria-hidden', 'true');
  }
}

function pushChatMsg(role, content) { chatState.messages.push({ role, content, ts: Date.now() }); }

function renderChatBody() {
  const el = ensureChatDrawer();
  const body = $('#chatBody', el);
  if (!body) return;
  if (!chatState.messages.length) { body.innerHTML = '<div class="chat-empty">问点什么吧 ↑</div>'; return; }
  body.innerHTML = chatState.messages.map(m =>
    '<div class="chat-msg chat-' + m.role + '">'
    + '<div class="chat-bub">' + esc(m.content).replace(/\n/g, '<br>') + '</div>'
    + '<div class="chat-time">' + fmtTime(m.ts) + '</div>'
    + '</div>'
  ).join('');
  body.scrollTop = body.scrollHeight;
}

async function refreshChatQuota() {
  try {
    const devId = (window.AEAuth && window.AEAuth.getDev && window.AEAuth.getDev()) || '';
    const r = await fetch((window.PAGES_API || '/api') + '/me', { method: 'POST', headers: { 'content-type': 'application/json', 'x-device-id': devId }, body: '{}' });
    const d = await r.json();
    if (d && typeof d.chatLeft === 'number') {
      chatState.left = d.chatLeft;
      chatState.limit = d.limit || 20;
      const el = ensureChatDrawer();
      $('#chatQuota', el).textContent = '剩余 ' + chatState.left + '/' + chatState.limit + ' 次';
    }
  } catch (e) {}
}

async function sendChat() {
  const el = ensureChatDrawer();
  const inp = $('#chatInp', el);
  const txt = (inp.value || '').trim();
  if (!txt || chatState.sending) return;
  pushChatMsg('user', txt);
  inp.value = '';
  $('#chatSend', el).disabled = true;
  chatState.sending = true;
  renderChatBody();
  chatState.messages.push({ role: 'assistant', content: '正在翻这条资讯…', ts: Date.now(), _thinking: true });
  renderChatBody();

  try {
    const devId = (window.AEAuth && window.AEAuth.getDev && window.AEAuth.getDev()) || '';
    const body = {
      username: (window.AEAuth && window.AEAuth.getState && window.AEAuth.getState().account) || undefined,
      context: chatState.context,
      messages: chatState.messages.filter(m => !m._thinking).map(m => ({ role: m.role, content: m.content })),
    };
    const r = await fetch((window.PAGES_API || '/api') + '/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-device-id': devId },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    chatState.messages = chatState.messages.filter(m => !m._thinking);
    if (d.ok && d.answer) {
      pushChatMsg('assistant', d.answer);
      if (typeof d.left === 'number') { chatState.left = d.left; chatState.limit = d.limit || chatState.limit; $('#chatQuota', el).textContent = '剩余 ' + chatState.left + '/' + chatState.limit + ' 次'; }
    } else if (d.limit) {
      pushChatMsg('assistant', '今日 AI 对话额度已用完（' + (d.max || 20) + ' 次/天），明天再来。');
    } else {
      pushChatMsg('assistant', '暂不可用：' + (d.error || '网络不稳定，本地灵感不受影响。'));
    }
  } catch (e) {
    chatState.messages = chatState.messages.filter(m => !m._thinking);
    pushChatMsg('assistant', '网络出错了，稍后再试。');
  } finally {
    chatState.sending = false;
    renderChatBody();
  }
}

function openChatWithItem(it) {
  const ctx = { type: 'item', item: { title: it.title, titleZh: it.titleZh, summary: it.summary } };
  toggleChatDrawer(true, ctx);
}
function openChatWithCategory() {
  const news = (NEWS_SELECTED.length
    ? NEWS_ITEMS.filter(i => NEWS_SELECTED.includes(i.category))
    : NEWS_ITEMS
  ).slice(0, 8).map(n => ({ title: n.title, titleZh: n.titleZh, summary: n.summary }));
  const cats = NEWS_SELECTED.length ? NEWS_SELECTED.map(catLabel) : ['全部'];
  const ctx = { type: 'category', categories: cats, news };
  toggleChatDrawer(true, ctx);
}

function renderNews() {
  const grid = $('#newsGrid');
  renderKeyTags();
  // 多选过滤：未选任何类别 = 看全部（你和你朋友各选各的）
  let list = NEWS_SELECTED.length
    ? NEWS_ITEMS.filter(i => NEWS_SELECTED.includes(i.category))
    : NEWS_ITEMS;
  // 个人关注词过滤：标题 / 中文标题 / 摘要 / 标签包含任一关注词
  if (NEWS_KEYS.length) {
    list = list.filter(it => {
      const hay = ((it.titleZh || '') + (it.title || '') + (it.summary || '') + (it.tags || []).join(' ')).toLowerCase();
      return NEWS_KEYS.some(k => k && hay.includes(k.toLowerCase()));
    });
  }
  $('#newsCount').textContent = NEWS_ITEMS.length;
  $('#newsStatus').textContent = NEWS_STATUS === 'live' ? '实时' : '缓存';
  $('#newsStatus').className = 'metalab ' + (NEWS_STATUS === 'live' ? 'is-live' : 'is-cache');
  $('#newsFetched').textContent = '上次刷新：' + fmtFetched(NEWS_FETCHED);
  // 生成类别开关：显示全部类别（含"待解锁"灰态），已解锁的按数据过滤
  const chips = [{ v: 'all', label: '全部' }].concat(NEWS_CATS.map(c => ({ v: c.v, label: c.label, locked: !!c.locked })));
  $('#newsSrc').innerHTML = chips.map(c => {
    const on = (c.v === 'all' && !NEWS_SELECTED.length) || NEWS_SELECTED.includes(c.v);
    return '<button class="srcbtn catbtn' + (on ? ' on' : '') + (c.locked ? ' lock' : '') + '" type="button" data-cat="' + esc(c.v) + '"' + (c.locked ? ' disabled' : '') + '>' + esc(c.label) + (c.locked ? '<em class="cat-lock">待解锁</em>' : '') + '</button>';
  }).join('')
    + '<button class="srcbtn catbtn-ask" id="askTheseBtn" type="button" title="把你勾选的整组资讯喂给 AI，直接问"><span data-icon="spark"></span>就这些问 AI</button>';
  $$('#newsSrc [data-cat]').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.cat;
    if (b.disabled) { toast('这个类别还在接入数据源，先看已解锁的'); return; }
    if (v === 'all') NEWS_SELECTED = [];
    else {
      const i = NEWS_SELECTED.indexOf(v);
      if (i >= 0) NEWS_SELECTED.splice(i, 1); else NEWS_SELECTED.push(v);
    }
    try { localStorage.setItem(NEWS_PREFS_KEY, JSON.stringify(NEWS_SELECTED)); } catch (e) {}
    renderNews();
  }));
  const askBtn = $('#askTheseBtn');
  if (askBtn) askBtn.onclick = () => openChatWithCategory();
  if (!list.length) {
    grid.innerHTML = '<div class="news-empty"><div class="empty-ic" data-icon="inbox"></div>'
      + (NEWS_KEYS.length ? '没有匹配关注词的条目。<br>换个词，或删掉关注词再看看。' : '这一类别暂时没有条目。<br>点"全部"或换一个类别，或点"立即刷新"重新拉取。')
      + '</div>';
    paintIcons(grid); return;
  }
  grid.innerHTML = list.map(newsCard).join('');
  paintIcons(grid);
  // 单条 "问 AI" 按钮：把这条作为上下文
  $$('#newsGrid .nc-ask').forEach(b => b.addEventListener('click', e => {
    e.preventDefault();
    const id = b.dataset.ask;
    const it = (NEWS_ITEMS || []).find(x => x.id === id);
    if (it) openChatWithItem(it);
  }));
  // 三段式卡片交互
  $$('#newsGrid .nc-orig-btn').forEach(b => b.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation(); toggleOrig(b.closest('.nc-orig'));
  }));
  $$('#newsGrid .nc-copy').forEach(b => b.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    try { navigator.clipboard.writeText(b.dataset.copy); toast('已复制全文'); } catch (err) {}
  }));
  $$('#newsGrid .nc-fav').forEach(b => b.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const it = NEWS_ITEMS.find(x => x.id === b.dataset.fav);
    if (it) { const msg = saveCard(it); toast(msg); b.textContent = isSaved(it.id) ? '已收藏' : '收藏'; b.classList.toggle('on', isSaved(it.id)); }
  }));
  // 人话服务：绑定单卡"译"按钮（Key 在服务端 Cloudflare Worker）
  $$('#newsGrid .nc-hz').forEach(b => b.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const it = NEWS_ITEMS.find(x => x.id === b.dataset.hz);
    if (it) humanizeCard(it, b.closest('.ncard'));
  }));
  // 同步灵感面板的类别提示
  const itg = $('#inspireTags');
  if (itg) {
    itg.textContent = NEWS_SELECTED.length
      ? '当前跟随类别：' + NEWS_SELECTED.map(catLabel).join(' / ')
      : '当前未勾选类别，按默认四个方向生成（文博 / 华语音乐 / 游戏人文 / 现代诗歌）。';
  }
}

function renderKeyTags() {
  const box = $('#keyTags'); if (!box) return;
  box.innerHTML = NEWS_KEYS.map(k =>
    '<span class="keytag"><span class="key-t">' + esc(k) + '</span><b class="key-x" data-key="' + esc(k) + '" role="button" aria-label="移除">×</b></span>'
  ).join('');
  $$('#keyTags [data-key]').forEach(el => el.addEventListener('click', () => {
    const k = el.dataset.key;
    NEWS_KEYS = NEWS_KEYS.filter(x => x !== k);
    try { localStorage.setItem(NEWS_KEYS_KEY, JSON.stringify(NEWS_KEYS)); } catch (e) {}
    renderKeyTags(); renderNews();
  }));
}

/* 首页"我的雷达"摘要卡：按已选类别取最新 4 条，点击进雷达页 */
function renderHomeRadar() {
  const box = $('#homeRadar'); if (!box) return;
  if (!NEWS_ITEMS.length) { box.innerHTML = '<div class="homeradar-empty">资讯正在路上，稍后刷新看看。</div>'; return; }
  const list = NEWS_SELECTED.length ? NEWS_ITEMS.filter(i => NEWS_SELECTED.includes(i.category)) : NEWS_ITEMS;
  box.innerHTML = list.slice(0, 4).map(it => {
    const t = (it.titleZh && it.titleZh !== it.title) ? it.titleZh : it.title;
    return '<div class="homeradar-item" data-go-radar role="button">'
      + '<span class="hr-cat">' + esc(catLabel(it.category || '')) + '</span>'
      + '<span class="hr-title">' + esc(t) + '</span>'
      + '<span class="hr-src">' + esc(it.source) + '</span></div>';
  }).join('');
}

function showNewsStat(msg, on) {
  const el = $('#newsStat');
  if (!on || !msg) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false; el.textContent = msg;
}

function applyNews(data, status) {
  if (!data || !Array.isArray(data.items) || !data.items.length) {
    if (NEWS_ITEMS.length) return;            // 已有缓存就不覆盖
    NEWS_STATUS = 'cache'; NEWS_FETCHED = '';
    showNewsStat('没有可用的数据，已显示离线缓存。', true);
    return;
  }
  // 容错：丢弃空摘要、重复条目、无效日期
  // 去重键用 id（优先）；同一来源页上的不同公告（URL 相同、标题不同）不算重复
  const seen = {};
  const clean = [];
  data.items.forEach(it => {
    if (!it || !it.url) return;
    const key = it.id || (it.url + '|' + (it.titleZh || it.title));
    if (seen[key]) return;
    if (!it.title && !it.titleZh) return;
    if (!it.publishedAt || isNaN(new Date(it.publishedAt).getTime())) return;
    seen[key] = 1; clean.push(it);
  });
  if (!clean.length) { if (!NEWS_ITEMS.length) { NEWS_STATUS = 'cache'; showNewsStat('抓取到的内容无效，已显示离线缓存。', true); } return; }
  NEWS_ITEMS = clean.slice(0, 30);   // 全品类池子：多类别混流，每类都要有内容（原 10 条上限会截掉尾部类别）
  NEWS_STATUS = status;
  NEWS_FETCHED = data.fetchedAt || '';
  showNewsStat(status === 'cache' ? '本次联网未成功，正在显示上一次成功抓取的缓存。' : '', status === 'cache');
  renderNews();
  renderHomeRadar();
}

function loadNews() {
  clearTimeout(newsTimer);
  // 读取个人类别偏好（每个人口味不同，自己勾选；存在本地）
  try {
    const saved = JSON.parse(localStorage.getItem(NEWS_PREFS_KEY) || '[]');
    if (Array.isArray(saved)) NEWS_SELECTED = saved.filter(Boolean);
  } catch (e) {}
  // 读取个人关注词
  try {
    const ks = JSON.parse(localStorage.getItem(NEWS_KEYS_KEY) || '[]');
    if (Array.isArray(ks)) NEWS_KEYS = ks.filter(x => typeof x === 'string' && x.trim());
  } catch (e) {}
  applyNews(LAST_CACHE, 'cache');             // 先显示离线缓存，立即可见
  const ctrl = new AbortController();
  newsTimer = setTimeout(() => ctrl.abort(), 8000);
  fetch('news.json', { cache: 'no-store', signal: ctrl.signal })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(d => applyNews(d, d.status === 'cache' ? 'cache' : 'live'))
    .catch(() => { NEWS_STATUS = 'cache'; renderNews(); showNewsStat('本次联网未成功，正在显示上一次成功抓取的缓存。', true); });
}

function refreshNews() {
  const btn = $('#newsRefresh'); btn.disabled = true;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  fetch('news.json?_=' + Date.now(), { cache: 'no-store', signal: ctrl.signal })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(d => { applyNews(d, d.status === 'cache' ? 'cache' : 'live'); toast('已刷新资讯'); })
    .catch(() => { NEWS_STATUS = 'cache'; renderNews(); showNewsStat('刷新失败，仍显示离线缓存。', true); toast('刷新失败：联网未成功'); })
    .finally(() => { clearTimeout(t); btn.disabled = false; });
}

/* ==========================================================
   启动
   ========================================================== */
function boot() {
  try {
  paintIcons();
  initDust();
  buildNav();
  applyTheme();
  checkCycles();
  buildTracks();
  renderTracks();
  renderTasks();
  renderBody();
  renderLove();
  maybeOnboard();

  // 灵感雷达：真实资讯流
  loadNews();
  renderHomeRadar();
  // 事件委托：覆盖动态渲染的"进雷达"入口（首页雷达卡等）
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-go-radar]');
    if (t) go('radar');
  });
  $('#newsRefresh').addEventListener('click', refreshNews);
  $('#keyForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#keyInp').value.trim(); if (!v) return;
    if (!NEWS_KEYS.includes(v)) NEWS_KEYS.push(v);
    $('#keyInp').value = '';
    try { localStorage.setItem(NEWS_KEYS_KEY, JSON.stringify(NEWS_KEYS)); } catch (e) {}
    renderKeyTags(); renderNews();
  });

  // 人话服务：已通过 Cloudflare Worker 接入（key 在服务端加密）
  // （人话服务卡片已移除）
  // $('#hsState').textContent = '已接入';
  // $('#hsState').classList.add('on');
  // 灵感清单：按关注类别生成朋友圈碎片文字
  $('#inspireBtn').addEventListener('click', genInspire);
  const iai = $('#inspireAiBtn'); if (iai) iai.addEventListener('click', aiInspire);
  mountInspireCfg();
  showLastAi();
  renderSaved();
  // 事件委托：灵感输出与摘抄本的动态按钮
  document.addEventListener('click', e => {
    const copy = e.target.closest('.inspire-copy');
    if (copy) { try { navigator.clipboard.writeText(copy.dataset.copy); toast('已复制，可发朋友圈'); } catch (err) {} return; }
    const fav = e.target.closest('.inspire-fav');
    if (fav) {
      const list = getSaved();
      list.unshift({ id: 'insp' + Date.now(), title: fav.dataset.favtxt, summary: '', source: '灵感清单', url: '', savedAt: Date.now() });
      setSaved(list); renderSaved(); toast('已收藏到摘抄本');
      return;
    }
    const sc = e.target.closest('.saved-copy');
    if (sc) { try { navigator.clipboard.writeText(sc.dataset.copy); toast('已复制'); } catch (err) {} return; }
    const sd = e.target.closest('.saved-del');
    if (sd) { setSaved(getSaved().filter(x => x.id !== sd.dataset.del)); renderSaved(); toast('已删除'); }
  });

  // AI 对话 FAB：只在"灵感雷达"页出现（在雷达页直接带入勾选的资讯上下文）
  const fabAsk = document.createElement('button');
  fabAsk.className = 'fab-ask'; fabAsk.id = 'fabAsk'; fabAsk.type = 'button'; fabAsk.setAttribute('aria-label', 'AI 对话');
  fabAsk.innerHTML = '<span data-icon="spark"></span><span>聊两句</span>';
  fabAsk.onclick = () => openChatWithCategory();
  document.body.appendChild(fabAsk);
  ensureChatDrawer();
  paintIcons(fabAsk);
  updateChatFab();

  const d = keyToDate(TODAY);
  $('#sideDate').textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日';
  const alive = Object.values(S.tracks).filter(t => !cycleInfo(t).dead).length;
  $('#sideCycle').textContent = alive + '/2 在燃';

  // 任务
  const tf = $('#taskForm'), ti = $('#taskInp');
  ti.addEventListener('input', () => { $('#taskAdd').disabled = !ti.value.trim(); });
  tf.addEventListener('submit', e => {
    e.preventDefault();
    const v = ti.value.trim(); if (!v) return;
    S.tasks.push({ id: nextId(), text: v, done: false });
    ti.value = ''; $('#taskAdd').disabled = true; save(); renderTasks();
  });

  // 在意的人
  const lf = $('#loveForm'), lw = $('#loveWho'), lt = $('#loveWhat');
  const chk = () => { $('#loveAdd').disabled = !(lw.value.trim() && lt.value.trim()); };
  lw.addEventListener('input', chk); lt.addEventListener('input', chk);
  lf.addEventListener('submit', e => {
    e.preventDefault();
    const who = lw.value.trim(), what = lt.value.trim();
    if (!who || !what) return;
    S.loves.push({ id: nextId(), who: who, what: what, at: TODAY });
    lw.value = ''; lt.value = ''; $('#loveAdd').disabled = true;
    save(); renderLove();
    if (S.loves.length >= LOVE_TARGET && !S.eggSeen) {
      S.eggSeen = true; save();
      setTimeout(playEgg, 420);
    } else if (S.loves.length >= LOVE_TARGET) {
      toast('第 ' + S.loves.length + ' 件。可以随时重放彩蛋。');
    } else {
      toast('记下了，还差 ' + (LOVE_TARGET - S.loves.length) + ' 件');
    }
  });
  $('#replayBtn').addEventListener('click', playEgg);
  $('#eggClose').addEventListener('click', closeEgg);
  $('#bgmBtn').addEventListener('click', () => {
    const on = BGM.toggle();
    $('#bgmBtn').classList.toggle('on', on);
    $('#bgmState').textContent = on ? 'ON' : 'OFF';
    toast(on ? '环境音已开启' : '环境音已关闭');
  });

  // 音乐 BGM 专区（占位阶段：仅当播放器 DOM 存在时才接线）
  if (document.getElementById('bgmPlayer')) {
    renderMusic();
    MusicPlayer.init();
    $('#bgmToggle').addEventListener('click', () => MusicPlayer.toggle());
    $('#bgmPrev').addEventListener('click', () => MusicPlayer.prev());
    $('#bgmNext').addEventListener('click', () => MusicPlayer.next());
    $('#bgmLoop').addEventListener('click', () => MusicPlayer.setMode());
    $('#bgmVol').addEventListener('input', e => MusicPlayer.setVol(+e.target.value));
    $('#bgmBar').parentElement.addEventListener('click', e => {
      const a = MusicPlayer.audio; if (!a || !a.duration) return;
      const r = e.currentTarget.getBoundingClientRect();
      a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration;
    });
  }
  $('#resetLove').addEventListener('click', () => {
    askConfirm('重置全部记录？', '会清空所有"在意的人"记录并回到 0 / 20。这个操作不可撤销。', () => {
      S.loves = []; S.eggSeen = false; save(); renderLove(); toast('已重置为 0 / 20');
    });
  });

  // 弹窗
  $('#modalNo').addEventListener('click', closeConfirm);
  $('#modalYes').addEventListener('click', () => { const cb = confirmCb; closeConfirm(); cb && cb(); });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeConfirm(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if ($('#egg').classList.contains('on')) closeEgg();
    else if ($('#modal').classList.contains('on')) closeConfirm();
  });

  // 主题
  $('#themeBtn').addEventListener('click', cycleTheme);
  $('#themeBtnM').addEventListener('click', cycleTheme);

  go(S.view || 'mainline');

  let rt = null;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (S.view === 'mainline') drawAllCharts(); }, 200);
  });

  // 供拍摄脚本调用
  window.AE = {
    go: go, theme: t => { S.theme = t; applyTheme(); if (S.view === 'mainline') drawAllCharts(); },
    egg: playEgg, closeEgg: closeEgg, redraw: drawAllCharts, state: () => S, news: loadNews,
    bgm: () => BGM.on, bgmToggle: () => BGM.toggle(),
  };
  } catch (e) {
    console.error('[boot ERROR]', e && (e.stack || e.message || e));
  }
}
document.addEventListener('DOMContentLoaded', boot);

/* ---------------- 首次引导（onboarding） ---------------- */
const ONBOARD_KEY = 'ae_onboard_done_v1';
function maybeOnboard() {
  let done = false;
  try { done = localStorage.getItem(ONBOARD_KEY) === '1'; } catch (e) {}
  if (done) return;
  const card = $('#onboard'); if (!card) return;
  card.setAttribute('aria-hidden', 'false');
  card.classList.add('show');
  const close = () => {
    card.classList.remove('show');
    card.setAttribute('aria-hidden', 'true');
    try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {}
  };
  const goBtn = $('#onboardGo');
  if (goBtn) goBtn.addEventListener('click', () => { close(); go('today'); });
  card.addEventListener('click', e => { if (e.target === card) close(); });
}
