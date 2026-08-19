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
  { id: 'love', name: '在意的人', short: '在意', icon: 'heart' },
  { id: 'radar', name: '灵感雷达', short: '雷达', icon: 'radar' },
  { id: 'inspire', name: '灵感清单', short: '灵感', icon: 'spark' },
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
const LOVE_SEED = [
  ['妈妈', '帮她把手机里三年的照片全备份出来了'], ['爸爸', '陪他看完了一整场球，没中途走'],
  ['妈妈', '晚饭后主动把碗洗了，没让她开口'], ['阿哲', '他电脑蓝屏，我远程帮他修到十二点'],
  ['奶奶', '打了二十分钟电话，只是听她讲'], ['小雨', '熬夜帮她把汇报的排版改完了'],
  ['爸爸', '把他一直没装好的路由器弄通了'], ['同桌', '把整理好的公式表复印了一份给他'],
  ['妈妈', '记得她说腰疼，买了个靠垫'], ['阿哲', '他情绪不好，我陪他打了两小时游戏'],
  ['妹妹', '教她怎么用剪辑软件，没有嫌她慢'], ['奶奶', '把她的老照片修清楚打印出来'],
  ['小雨', '她生日，提前一周就准备好了礼物'], ['爸爸', '主动跟他说了句谢谢'],
  ['同桌', '他没带饭，把我的分了一半'], ['妈妈', '答应她十一点睡，真的做到了'],
  ['妹妹', '帮她把折断的折纸重新折好'], ['阿哲', '帮他把简历从头改了一遍'],
];
function seedLoves() {
  return LOVE_SEED.map((x, i) => ({
    id: 'lv' + i, who: x[0], what: x[1],
    at: shiftKey(TODAY, -(LOVE_SEED.length - 1 - i)),
  }));
}
function freshState() {
  return {
    v: 1, theme: 'mint', view: 'mainline', seq: 100,
    tracks: {
      study: {
        id: 'study', name: '学习线', icon: 'book', unit: '分钟',
        goal: '把想学的、想懂的，变成真的会',
        recs: seedRecs(SEED + 1, 26, 55, 168, 0, 1.0),
        cycleStart: shiftKey(TODAY, -21),
        lastTs: NOW - 2 * 3600e3,
        plans: { tomorrow: '把最近卡住的一个问题弄明白', week: '完成一件一直拖着的小事' },
      },
      craft: {
        id: 'craft', name: '创造线', icon: 'code', unit: '分钟',
        goal: '把脑子里的东西，真的做出来',
        recs: seedRecs(SEED + 2, 13, 22, 115, 1, 1.55),
        cycleStart: shiftKey(TODAY, -8),
        lastTs: NOW - 30 * 3600e3,
        plans: { tomorrow: '把今天冒出来的一个想法记下来', week: '把手里的小作品打磨到能拿出手' },
      },
    },
    tasks: [
      { id: 't1', text: '把今天最重要的一件事做完', done: true },
      { id: 't2', text: '整理一下最近学到的东西', done: true },
      { id: 't3', text: '给明天留一件具体的待办', done: false },
      { id: 't4', text: '把身体账户的水位填一填', done: true },
      { id: 't5', text: '给三个朋友发一下站点链接', done: false },
      { id: 't6', text: '23 点前放下手机', done: false },
    ],
    body: seedBody(),
    loves: seedLoves(),
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
    if (!o || o.v !== 1 || !o.tracks) return freshState();
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
  window.scrollTo({ top: 0, behavior: 'instant' in document.body.style ? 'instant' : 'auto' });
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
      + '<input class="inp" data-plan="tomorrow" maxlength="60" placeholder="明天先做哪一件"></div>'
      + '<div class="planrow"><span class="planlab">本周计划</span>'
      + '<input class="inp" data-plan="week" maxlength="60" placeholder="这一周要推到哪"></div></div>'
      + '<div class="track-act"><button class="btn btn-ghost btn-sm" type="button" data-restart>'
      + '<span data-icon="replay"></span>重启周期</button></div>'
      + '<div class="deadnote" data-dead hidden><span data-icon="alert"></span>'
      + '<span>超过 48 小时没有推进，上一个复利周期已归零。以当前累计值为新起点重新开始。</span></div>'
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
    if (c.dead) { chip.textContent = '已归零'; chip.className = 'chip chip-dead'; }
    else if (c.left < 24) { chip.textContent = '周期第 ' + c.days + ' 天'; chip.className = 'chip chip-warn'; }
    else { chip.textContent = '周期第 ' + c.days + ' 天'; chip.className = 'chip chip-live'; }

    $('[data-sub]', card).innerHTML = '本周 ' + weekSum(t) + ' ' + t.unit
      + '<span class="dot-sep"> · </span>'
      + (c.dead ? '<b class="txd">周期已归零，记录一次即可重新开始</b>'
        : '距归零还有 <b>' + Math.floor(c.left) + '</b> 小时');

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
    + '<span class="metalab">在燃的线</span>';
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
    + '<span class="tk-tx">' + esc(t.text) + '</span>'
    + '<button class="tk-del" type="button" data-del aria-label="删除">' + ico('trash', 14) + '</button></li>'
  ).join('');
  $$('.taski', ul).forEach(li => {
    const t = S.tasks.find(x => x.id === li.dataset.id);
    $('[data-toggle]', li).addEventListener('click', () => { t.done = !t.done; save(); renderTasks(); });
    $('[data-del]', li).addEventListener('click', () => {
      S.tasks = S.tasks.filter(x => x.id !== t.id); save(); renderTasks(); toast('已删除');
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
  $('#habitList').innerHTML = HABITS.map(h => {
    const on = today.indexOf(h.id) >= 0;
    return '<li class="habiti' + (on ? ' on' : '') + '" data-h="' + h.id + '">'
      + '<span class="tk-box' + (on ? ' hb-on' : '') + '" style="'
      + (on ? 'background:var(--acc);border-color:var(--acc);color:#06231f' : '') + '">'
      + ico('check', 12) + '</span>'
      + '<span class="hb-tx">' + h.name + '<span class="hb-sub">' + h.sub + '</span></span>'
      + '<button class="btn btn-sm hb-btn' + (on ? ' btn-ghost' : ' btn-acc') + '" type="button" data-t>'
      + (on ? '撤回' : '存入') + '</button></li>';
  }).join('');
  $$('.habiti').forEach(li => {
    $('[data-t]', li).addEventListener('click', () => {
      const id = li.dataset.h;
      const arr = S.body[TODAY] || (S.body[TODAY] = []);
      const i = arr.indexOf(id);
      if (i >= 0) { arr.splice(i, 1); toast('已撤回'); }
      else { arr.push(id); toast('存入身体账户 +1'); }
      if (!arr.length) delete S.body[TODAY];
      save(); renderBody();
    });
  });

  const dow = (keyToDate(TODAY).getDay() + 6) % 7;
  const names = ['一', '二', '三', '四', '五', '六', '日'];
  let wd = '';
  for (let i = 0; i < 7; i++) {
    const k = shiftKey(TODAY, -(dow - i));
    const c = i <= dow ? (S.body[k] || []).length : 0;
    wd += '<div class="wd' + (i === dow ? ' today' : '') + '"><div class="wd-bar">'
      + '<i style="height:' + (c / HABITS.length * 100).toFixed(0) + '%"></i></div>'
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
const WORKER = 'https://antientropy-api.3353367139.workers.dev';   // Cloudflare 轻后端（key 在服务端）
let NEWS_KEYS = [];                // 个人关注词：自己输入，按词过滤
function catLabel(v) { const c = NEWS_CATS.find(x => x.v === v); return c ? c.label : v; }

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

/* 三段式卡片：标题（大白话）+ 摘要（详细解释）+ 折叠的原文引用/术语词典 */
function newsCard(it) {
  const hasZh = !!(it.titleZh && it.titleZh !== it.title);
  const title = hasZh ? it.titleZh : it.title;
  const summary = it.summary || (it.translated === false ? '（原文未译，保留英文）' : '');
  const img = it.image
    ? '<div class="nc-img" style="background-image:url(\'' + it.image + '\')"></div>'
    : '<div class="nc-img nc-ph ' + srcClass(it.source) + '"><span data-icon="radar"></span><b>' + esc(it.source) + '</b></div>';
  const tags = (it.tags || []).map(t => '<i class="nc-tag">' + esc(t) + '</i>').join('');
  const dateTxt = (it.publishedAt || '').slice(0, 10);
  // 原文区（默认折叠）：原文关键句 + 术语词典
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
  // 人话服务：经 Cloudflare Worker（key 在服务端加密），卡片可"译"改写
  const hzBtn = '<button class="nc-hz" type="button" data-hz="' + esc(it.id) + '" aria-label="译成人话">译</button>';
  return '<div class="ncard">'
    + img
    + '<div class="nc-body">'
    + '<div class="nc-top"><span class="nc-src ' + srcClass(it.source) + '">' + esc(it.source) + '</span>'
    + (it.category ? '<span class="nc-cat">' + esc(catLabel(it.category)) + '</span>' : '')
    + '<span class="nc-date">' + esc(dateTxt) + '</span>'
    + hzBtn
    + '</div>'
    + '<h3 class="nc-title">' + esc(title) + (hasZh ? '' : ' <em class="nc-en">原文</em>') + '</h3>'
    + '<p class="nc-sum">' + esc(summary) + '</p>'
    + (tags ? '<div class="nc-tags">' + tags + '</div>' : '')
    + orig
    + '<div class="nc-foot">'
    + '<button class="nc-copy" type="button" data-copy="' + esc(copyText(it)) + '">复制全文</button>'
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

/* 人话服务：经 Cloudflare Worker 调用 DeepSeek（key 在服务端），三段式改写单条资讯 */
async function humanizeCard(it, cardEl) {
  if (!it) return;
  const btn = cardEl.querySelector('.nc-hz');
  if (btn) btn.textContent = '改写中';
  try {
    const resp = await fetch(WORKER + '/humanize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { title: it.titleZh || it.title || '', summary: it.summary || '' } })
    });
    const data = await resp.json();
    if (!data.ok || !data.result) throw new Error((data && data.error) || '改写失败');
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

/* 灵感清单：按关注的类别生成朋友圈碎片文字（经 Cloudflare Worker） */
function genInspire() {
  const btn = $('#inspireBtn'), out = $('#inspireOut');
  if (!btn || !out) return;
  btn.disabled = true; btn.textContent = '生成中…';
  const tags = NEWS_SELECTED.length
    ? NEWS_SELECTED.map(catLabel)
    : ['文博', '华语流行音乐', '游戏人文', '现代诗歌'];
  fetch(WORKER + '/inspire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags })
  })
    .then(r => r.json())
    .then(d => {
      if (d.ok && d.result) {
        const lines = d.result.split('\n').map(s => s.trim()).filter(Boolean);
        out.innerHTML = lines.map(l => {
          const txt = l.replace(/^「|」$/g, '');
          return '<div class="inspire-item"><span class="inspire-txt">' + esc(txt) + '</span>'
            + '<div class="inspire-item-act">'
            + '<button class="inspire-fav" type="button" data-favtxt="' + esc(txt) + '">收藏</button>'
            + '<button class="inspire-copy" type="button" data-copy="' + esc(txt) + '">复制</button>'
            + '</div></div>';
        }).join('') || '<div class="inspire-empty">没有生成内容，换个类别试试</div>';
      } else {
        out.innerHTML = '<div class="inspire-empty">' + esc((d && d.error) || '生成失败') + '</div>';
      }
    })
    .catch(() => { out.innerHTML = '<div class="inspire-empty">网络失败，稍后再试</div>'; })
    .finally(() => { btn.disabled = false; btn.textContent = '生成灵感'; });
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
  }).join('');
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
  if (!list.length) {
    grid.innerHTML = '<div class="news-empty"><div class="empty-ic" data-icon="inbox"></div>'
      + (NEWS_KEYS.length ? '没有匹配关注词的条目。<br>换个词，或删掉关注词再看看。' : '这一类别暂时没有条目。<br>点"全部"或换一个类别，或点"立即刷新"重新拉取。')
      + '</div>';
    paintIcons(grid); return;
  }
  grid.innerHTML = list.map(newsCard).join('');
  paintIcons(grid);
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
  $('#hsState').textContent = '已接入';
  $('#hsState').classList.add('on');
  // 灵感清单：按关注类别生成朋友圈碎片文字
  $('#inspireBtn').addEventListener('click', genInspire);
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
}
document.addEventListener('DOMContentLoaded', boot);
