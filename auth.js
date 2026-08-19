/* 逆熵 ANTIENTROPY · 前端身份/反馈/站长视图（无依赖，纯原生）
 * 设备去重：每台浏览器一个稳定 device_id（localStorage）
 * 账号：可选同步层，D1 存哈希；登录后所有浏览器=1 人
 * 弹窗均以 JS 生成，保持 index.html 整洁 */
(function () {
  const API = '/api';
  const DEV_KEY = 'ae_device_id';
  const AUTH_KEY = 'ae_auth_v1';
  const TS_SITEKEY = window.AE_TURNSTILE_SITEKEY || '';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  function esc(s) { return (s == null ? '' : '' + s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function getDev() { let id = localStorage.getItem(DEV_KEY); if (!id) { id = uid(); localStorage.setItem(DEV_KEY, id); } return id; }
  function getAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; } }
  function setAuth(a) { if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a)); else localStorage.removeItem(AUTH_KEY); }
  async function api(path, body, token) {
    const headers = { 'content-type': 'application/json', 'x-device-id': getDev() };
    if (token) headers['x-owner-token'] = token;
    const r = await fetch(API + path, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined });
    return r.json().catch(() => ({ ok: false, error: '网络错误' }));
  }
  function toast(msg) {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  const state = { account: null };
  let tsLoaded = false;
  function loadTS(cb) {
    if (!TS_SITEKEY || tsLoaded) { cb && cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true; s.onload = () => { tsLoaded = true; cb && cb(); };
    document.head.appendChild(s);
  }

  /* ---------- 通用弹窗 ---------- */
  let modalEl = null;
  function openModal(html, cls) {
    closeModal();
    modalEl = document.createElement('div');
    modalEl.className = 'modal auth-modal on ' + (cls || '');
    modalEl.setAttribute('aria-hidden', 'false');
    modalEl.innerHTML = html;
    document.body.appendChild(modalEl);
    modalEl.addEventListener('click', e => { if (e.target === modalEl) closeModal(); });
    return modalEl;
  }
  function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; } }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* ---------- 登录按钮态 ---------- */
  function renderAuthBtn() {
    [$('#authBtn'), $('#authBtnM')].forEach(b => {
      if (!b) return;
      const tx = b.querySelector('#authTx');
      if (state.account) {
        const u = state.account;
        if (tx) tx.textContent = u.length > 5 ? u.slice(0, 4) + '…' : u;
        b.classList.add('is-on');
        // 已登录显示首字母小头像（用 ::before 不可行，所以改 title）
        b.title = '已登录：' + u + ' · 点击查看个人中心';
      } else {
        if (tx) tx.textContent = '登录';
        b.classList.remove('is-on');
        b.title = '登录账号';
      }
    });
  }
  function openAuth() { if (state.account) openProfile(); else openLogin(); }

  /* ---------- 账号弹窗 ---------- */
  function openAuth() {
    const logged = !!state.account;
    const tsHtml = TS_SITEKEY
      ? '<div class="ts-box"><div class="cf-turnstile" data-sitekey="' + esc(TS_SITEKEY) + '" data-theme="dark"></div></div>'
      : '';
    const html = `
      <div class="modal-box auth-box">
        ${logged ? `
          <h3 class="modal-t">已登录</h3>
          <p class="modal-p">当前账号：<b>${esc(state.account)}</b><br>这台设备已绑定到该账号。</p>
          <div class="modal-act">
            <button class="btn btn-ghost" id="authClose" type="button">关闭</button>
            <button class="btn btn-danger" id="authLogout" type="button">退出登录</button>
          </div>
        ` : `
          <div class="auth-tabs">
            <button class="auth-tab is-on" data-tab="login" type="button">登录</button>
            <button class="auth-tab" data-tab="reg" type="button">注册</button>
          </div>
          <form class="auth-form" id="authForm">
            <input class="auth-input" id="authUser" type="text" maxlength="20" placeholder="账号名（2-20 位，中英文/数字）" autocomplete="username">
            <input class="auth-input" id="authPass" type="password" maxlength="64" placeholder="口令（至少 6 位）" autocomplete="current-password">
            ${tsHtml}
            <button class="btn btn-acc btn-w" id="authSubmit" type="submit">登录</button>
            <p class="auth-note" id="authNote">无邮箱验证，账号存在你本地浏览器标识 + 服务端哈希。一个账号可绑多台设备。</p>
            <button class="btn btn-tiny btn-ghost" id="authDevEntry" type="button" style="margin-top:8px">站长入口（输入 OWNER_TOKEN 看数据）</button>
          </form>
        `}
      </div>`;
    const el = openModal(html);
    if (logged) {
      $('#authLogout', el).onclick = async () => {
        await api('/auth', { action: 'logout' });
        state.account = null; setAuth(null); renderAuthBtn(); closeModal(); toast('已退出');
      };
      $('#authClose', el).onclick = closeModal;
    } else {
      const devBtn = $('#authDevEntry', el);
      if (devBtn) devBtn.onclick = () => { closeModal(); openAdminPrompt(); };
      $$('.auth-tab', el).forEach(t => t.onclick = () => {
        $$('.auth-tab', el).forEach(x => x.classList.remove('is-on'));
        t.classList.add('is-on');
        const login = t.dataset.tab === 'login';
        $('#authSubmit', el).textContent = login ? '登录' : '注册';
        $('#authNote', el).textContent = login ? '用已有账号登录，绑定这台设备。' : '注册后自动登录并绑定这台设备。';
        el._tab = t.dataset.tab;
      });
      el._tab = 'login';
      if (TS_SITEKEY) loadTS(() => { if (window.turnstile && $('.cf-turnstile', el)) window.turnstile.render($('.cf-turnstile', el), { sitekey: TS_SITEKEY }); });
      $('#authForm', el).onsubmit = async e => {
        e.preventDefault();
        const username = $('#authUser', el).value.trim();
        const pass = $('#authPass', el).value;
        const tab = el._tab || 'login';
        const submitBtn = $('#authSubmit', el); submitBtn.disabled = true;
        let token = '';
        if (TS_SITEKEY && window.turnstile) token = window.turnstile.getResponse() || '';
        const res = await api('/auth', { action: tab, username, pass, token });
        submitBtn.disabled = false;
        if (!res.ok) { toast(res.error || '失败'); return; }
        state.account = res.username; setAuth({ username: res.username }); renderAuthBtn(); closeModal();
        toast(tab === 'reg' ? '注册成功，已登录' : '欢迎回来');
        if (window.AEAuth && AEAuth.onLogin) AEAuth.onLogin(res.username);
      };
    }
  }

  /* ---------- 个人中心（登录后按钮点击进入） ---------- */
  async function openProfile() {
    // 拉取：me / 本地状态 / 我最近反馈（用 username 过滤；如果没登录就空）
    const me = await api('/me', {}).catch(() => ({}));
    // 本地保存的：灵感收藏数 + 今日 hash + 是否登录 + 已绑设备
    const saved = (function(){ try { return JSON.parse(localStorage.getItem('ae_favs') || '[]'); } catch (e) { return []; } })();
    const todayHash = (function(){
      try { const s = JSON.parse(localStorage.getItem('antientropy.v1') || '{}'); return (s.state && s.state.today && s.state.today.hash) || '—'; } catch (e) { return '—'; }
    })();
    const myFbs = (me.myFeedback || []).slice(0, 8);
    const accts = me.accountList || [];
    const myDevices = (accts.filter(a => a.username === state.account)[0] || {}).devices || 1;
    const fbsHtml = myFbs.length ? myFbs.map(f => '<li><span class="pc-t">' + esc(fbType(f.type)) + '</span>' + esc(f.text).slice(0, 50) + '<span class="pc-t"> · ' + fmtTime(f.created) + '</span></li>').join('') : '<li class="muted">还没有提交过反馈</li>';
    const lastAi = (function(){ try { const v = JSON.parse(localStorage.getItem('ae_last_ai') || 'null'); return v ? fmtTime(v.ts) + ' · ' + v.count + ' 条' : '尚未使用'; } catch(e){ return '尚未使用'; } })();
    const html = `
      <div class="modal-box profile-box">
        <div class="profile-head">
          <div class="profile-avatar">${esc((state.account || '?')[0].toUpperCase())}</div>
          <div>
            <div class="profile-name">${esc(state.account)}</div>
            <div class="profile-meta">已绑定 ${myDevices} 台设备 · 国家 ${esc(me.country || '??')} · 入会 ${fmtTime(me.account && me.account.created)}</div>
          </div>
          <div class="profile-actions">
            <button class="btn btn-ghost" id="profLogout" type="button">退出登录</button>
          </div>
        </div>
        <div class="profile-grid">
          <div class="profile-card"><div class="pc-l">灵感收藏</div><div class="pc-v">${saved.length}</div><div class="pc-hint">句句都存在你浏览器本地</div></div>
          <div class="profile-card"><div class="pc-l">今日逆熵</div><div class="pc-v" style="font-size:18px;font-family:var(--f-mono)">${esc(todayHash.slice(0, 10))}</div><div class="pc-hint">每日唯一身份条</div></div>
          <div class="profile-card"><div class="pc-l">上次 AI 调用</div><div class="pc-v" style="font-size:13px;font-family:var(--f-mono)">${esc(lastAi)}</div><div class="pc-hint">本地记录，不上传</div></div>
          <div class="profile-card"><div class="pc-l">我的反馈</div><ul class="pc-list">${fbsHtml}</ul></div>
        </div>
        <div class="modal-act profile-acts">
          <button class="btn btn-ghost" id="profFb" type="button"><span data-icon="inbox"></span>提交反馈</button>
          <button class="btn btn-tiny btn-ghost" id="profDevEntry" type="button">你是站长？进入站点数据 →</button>
          <button class="btn btn-ghost" id="profClose" type="button">关闭</button>
        </div>
      </div>`;
    const el = openModal(html, 'profile-modal');
    $('#profClose', el).onclick = closeModal;
    const pfb = $('#profFb', el); if (pfb) pfb.onclick = () => { closeModal(); openFeedback(); };
    const pdev = $('#profDevEntry', el); if (pdev) pdev.onclick = () => { closeModal(); openAdminPrompt(); };
    const pl = $('#profLogout', el); if (pl) pl.onclick = async () => { await api('/auth', { action: 'logout' }); state.account = null; setAuth(null); renderAuthBtn(); closeModal(); toast('已退出'); };
  }

  /* ---------- 站长视图（隐藏入口：键盘 owner/admin、Logo 五连击/长按、个人中心底部） ---------- */
  async function openAdminPrompt() {
    const html = `
      <div class="modal-box owner-login">
        <h3 class="modal-t">站长验证</h3>
        <p class="modal-p">输入部署时配置的 <code>OWNER_TOKEN</code> 环境变量值，进入站点数据视图。</p>
        <input class="auth-input" id="ownerTok" type="password" placeholder="站长令牌（32 位十六进制）" autocomplete="off">
        <p class="auth-note" id="ownerErr"></p>
        <div class="modal-act">
          <button class="btn btn-ghost" id="ownerCancel" type="button">取消</button>
          <button class="btn btn-acc" id="ownerOk" type="button">查看</button>
        </div>
      </div>`;
    const el = openModal(html, 'owner-modal');
    const input = $('#ownerTok', el);
    // 记忆：用户第一次输入过的令牌暂存到 sessionStorage，本次会话免输
    try { const old = sessionStorage.getItem('ae_owner_try') || ''; if (old) input.value = old; } catch (e) {}
    $('#ownerCancel', el).onclick = closeModal;
    const submit = async () => {
      const tok = input.value.trim();
      if (!tok) { $('#ownerErr', el).textContent = '请输入令牌'; return; }
      const data = await api('/admin', null, tok);
      if (!data.ok) {
        try { sessionStorage.setItem('ae_owner_try', tok); } catch (e) {}
        $('#ownerErr', el).textContent = (data.error || '令牌不对，看看是不是拼错或部署时没配置 OWNER_TOKEN');
        return;
      }
      try { sessionStorage.setItem('ae_owner_try', tok); } catch (e) {}
      renderAdmin(data, tok);
    };
    $('#ownerOk', el).onclick = submit;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 30);
  }
  function renderAdmin(data, tok) {
    // 7 天趋势小条形（CSS-only，最宽 100%）
    const trend = (data.trend7 || []);
    const maxTr = Math.max(1, ...trend.map(x => (x.inspire || 0) + (x.chat || 0)));
    const trendHtml = trend.map(t => {
      const total = (t.inspire || 0) + (t.chat || 0);
      const wi = Math.round(((t.inspire || 0) / maxTr) * 100);
      const wc = Math.round(((t.chat || 0) / maxTr) * 100);
      return '<div class="ad-tr-row">'
        + '<span class="ad-tr-day">' + (t.day || '').slice(5) + '</span>'
        + '<span class="ad-tr-bar"><i class="ad-bar-inspire" style="width:' + wi + '%"></i><i class="ad-bar-chat" style="width:' + wc + '%"></i></span>'
        + '<span class="ad-tr-num">' + (t.inspire || 0) + '/' + (t.chat || 0) + '</span>'
        + '</div>';
    }).join('');

    // 灵感风格分布（style 字段是 "voiceKey|style"，把 voice 拿出来当标签）
    const styleRows = (data.styleRows || []).filter(s => s.style).map(s => {
      const voice = String(s.style).split('|')[0] || '未知';
      return '<div class="ad-st-row"><span class="ad-st-name">' + esc(voice) + '</span><span class="ad-st-bar"><i style="width:100%"></i></span><span class="ad-st-num">' + (s.total || 0) + '</span></div>';
    }).join('') || '<div class="muted">还没有 AI 灵感调用</div>';

    // 活跃设备（按 who，who 通常是 device_id）
    const devs = (data.activeDevices || []).map(d => {
      const who = (d.who || '').slice(0, 14);
      return '<tr>'
        + '<td title="' + esc(d.who || '') + '">' + esc(who) + '…</td>'
        + '<td>' + (d.c || 0) + '</td>'
        + '<td>' + (d.ok || 0) + ' / ' + (d.bad || 0) + '</td>'
        + '<td>' + (d.news || 0) + ' 条资讯</td>'
        + '<td>' + fmtTime(d.last) + '</td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="5" class="muted">今天还没有 AI 灵感调用</td></tr>';

    // 失败日志
    const fails = (data.fails || []).map(f => '<li class="fb-row"><span class="fb-tag fb-bug">失败</span><span class="fb-who">' + esc((f.who || '').slice(0, 8)) + '…</span><span class="fb-tx">' + esc(f.style || '') + ' · ' + (f.ms || 0) + 'ms · ' + fmtTime(f.created) + '</span></li>').join('') || '<li class="muted">无失败</li>';

    // 所有设备
    const allDev = (data.allDevices || []).map(d => '<li class="fb-row"><span class="fb-tag fb-idea">' + esc(d.country || '??') + '</span><span class="fb-tx">' + esc(d.id.slice(0, 16)) + '… · UA ' + (d.isMobile ? 'M' : 'D') + ' · ' + fmtTime(d.last_seen) + '</span></li>').join('') || '<li class="muted">无设备</li>';

    const accts = (data.accountList || []).map(a => `
      <tr>
        <td>${esc(a.username)}</td>
        <td>${a.devices || 0} 台</td>
        <td>${esc(a.country || '??')}</td>
        <td>${fmtTime(a.last_seen)}</td>
        <td><button class="mini-btn danger" data-delacct="${esc(a.username)}" type="button">删</button></td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted">暂无账号</td></tr>';
    const fbs = (data.feedback || []).map(f => `
      <li class="fb-row">
        <span class="fb-tag fb-${esc(f.type)}">${fbType(f.type)}</span>
        <span class="fb-who">${esc(f.who || '').slice(0, 8)}…</span>
        <span class="fb-tx">${esc(f.text)}</span>
        <button class="mini-btn" data-delfb="${f.id}" type="button">处理</button>
      </li>`).join('') || '<li class="muted">暂无反馈</li>';
    const html = `
      <div class="modal-box admin-box">
        <h3 class="modal-t">站长视图 · 实时数据</h3>
        <div class="admin-stats">
          <div class="astat"><b>${data.visitors || 0}</b><span>访客（设备去重）</span></div>
          <div class="astat"><b>${data.accounts || 0}</b><span>账号</span></div>
          <div class="astat"><b>${data.inspireToday || 0}</b><span>今日 AI 灵感</span></div>
          <div class="astat"><b>${data.chatToday || 0}</b><span>今日 AI 对话</span></div>
        </div>
        <h4 class="admin-h">7 天趋势 · <span class="muted">灵感 / 对话（横条表示每天调用）</span></h4>
        <div class="ad-trend">${trendHtml}</div>
        <h4 class="admin-h">灵感风格分布（按用户选的"声音组合"）</h4>
        <div class="ad-styles">${styleRows}</div>
        <h4 class="admin-h">账号列表（${ (data.accountList||[]).length }）</h4>
        <table class="admin-tbl"><thead><tr><th>账号</th><th>设备</th><th>国家</th><th>最近</th><th></th></tr></thead><tbody>${accts}</tbody></table>
        <h4 class="admin-h">今日活跃设备（按 AI 灵感调用聚合 · 24h）</h4>
        <table class="admin-tbl"><thead><tr><th>who</th><th>调用</th><th>成/败</th><th>摘要</th><th>最近</th></tr></thead><tbody>${devs}</tbody></table>
        <h4 class="admin-h">失败日志 · <span class="muted">给 LLM 报错或网络中断</span></h4>
        <ul class="fb-list">${fails}</ul>
        <h4 class="admin-h">所有设备（最近 30）</h4>
        <ul class="fb-list">${allDev}</ul>
        <h4 class="admin-h">反馈（${ (data.feedback||[]).length }）</h4>
        <ul class="fb-list">${fbs}</ul>
        <div class="modal-act"><button class="btn btn-ghost" id="adminClose" type="button">关闭</button></div>
      </div>`;
    const el = openModal(html, 'admin-modal');
    $('#adminClose', el).onclick = closeModal;
    $$('[data-delacct]', el).forEach(b => b.onclick = async () => {
      if (!window.confirm('删除账号 ' + b.dataset.delacct + '？')) return;
      await api('/admin', { action: 'delAccount', username: b.dataset.delacct }, tok);
      openAdminPrompt();
    });
    $$('[data-delfb]', el).forEach(b => b.onclick = async () => {
      await api('/admin', { action: 'delFeedback', id: Number(b.dataset.delfb) }, tok);
      openAdminPrompt();
    });
  }
  function fbType(t) { return ({ bug: 'BUG', idea: '建议', sensitive: '敏感' })[t] || '建议'; }
  function fmtTime(ts) { if (!ts) return '—'; const d = new Date(ts); const p = n => (n < 10 ? '0' : '') + n; return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  /* ---------- 反馈浮窗 ---------- */
  function openFeedback() {
    const html = `
      <div class="modal-box fb-box">
        <h3 class="modal-t">反馈 / 建议</h3>
        <p class="modal-p">BUG、想加的功能、或任何敏感/不适内容，都可以在这里说。</p>
        <div class="fb-types">
          <button class="fb-type is-on" data-type="idea" type="button">功能建议</button>
          <button class="fb-type" data-type="bug" type="button">BUG 上报</button>
          <button class="fb-type" data-type="sensitive" type="button">敏感/不适</button>
        </div>
        <textarea class="fb-area" id="fbText" maxlength="1000" placeholder="说点什么…（≤1000字）"></textarea>
        <div class="modal-act">
          <button class="btn btn-ghost" id="fbCancel" type="button">取消</button>
          <button class="btn btn-acc" id="fbSend" type="button">提交</button>
        </div>
      </div>`;
    const el = openModal(html, 'fb-modal');
    let type = 'idea';
    $$('.fb-type', el).forEach(t => t.onclick = () => { $$('.fb-type', el).forEach(x => x.classList.remove('is-on')); t.classList.add('is-on'); type = t.dataset.type; });
    $('#fbCancel', el).onclick = closeModal;
    $('#fbSend', el).onclick = async () => {
      const text = $('#fbText', el).value.trim();
      if (!text) { toast('写点内容再提交'); return; }
      const res = await api('/feedback', { type, text, username: state.account || undefined, deviceId: getDev() });
      if (!res.ok) { toast(res.error || '提交失败'); return; }
      closeModal(); toast('已收到，谢谢！');
    };
  }

  /* ---------- 上下文 AI 对话（供卡片/栏目按钮调用） ---------- */
  async function openChat(context) {
    // 见下一阶段：抽屉式对话 UI。先占位，确保调用不报错。
    toast('AI 对话即将上线，稍候');
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    const me = await api('/me', {}).catch(() => ({}));
    state.account = (me && me.account) || (getAuth() && getAuth().username) || null;
    if (state.account) setAuth({ username: state.account });
    renderAuthBtn();
    [['#authBtn', openAuth], ['#authBtnM', openAuth]].forEach(([sel, fn]) => { const b = $(sel); if (b) b.onclick = fn; });
    // 已登录用户：把 AI 灵感剩余额度同步到 UI（显眼可见）
    if (state.account && typeof me.inspireLeft === 'number') {
      try { window.AEInspireLeft = me.inspireLeft; const tip = document.getElementById('inspireAiTip'); if (tip) tip.innerHTML = 'AI 灵感 · 今日还剩 <b>' + me.inspireLeft + '</b>/' + (me.limit || 20) + ' 次'; } catch (e) {}
    }
    // 反馈入口已移入「个人中心」，不再全局浮窗

    // 隐藏站长入口：多种方式任意一种都触发，移动端无键盘也能用
    // ① 页面空白处依次敲 owner / admin 五个字母（键盘）
    const OWNER_SEQ = ['owner', 'admin']; let seqBuf = '';
    document.addEventListener('keydown', e => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const k = (e.key || '').toLowerCase();
      if (k.length !== 1) return;
      seqBuf = (seqBuf + k).slice(-5);
      if (OWNER_SEQ.includes(seqBuf)) { seqBuf = ''; openAdminPrompt(); }
    });
    // ② Logo 点击 / 连点 / 长按（桌面 + 移动都可用）
    const onLogo = (e) => {
      // 移动端用 click + 计时器合并双击 / 三击 / 五击，长按单独算
      brandClicks++;
      clearTimeout(brandTimer);
      brandTimer = setTimeout(() => { brandClicks = 0; }, 1100);
      if (brandClicks >= 5) { brandClicks = 0; openAdminPrompt(); }
    };
    let brandClicks = 0, brandTimer = null;
    let longPressTimer = null, longPressed = false;
    $$('.brand').forEach(b => {
      b.style.cursor = 'pointer';
      b.setAttribute('title', '');
      b.addEventListener('click', onLogo);
      b.addEventListener('pointerdown', e => {
        longPressed = false;
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          longPressed = true;
          openAdminPrompt();
        }, 1500);
      });
      const cancel = () => { clearTimeout(longPressTimer); };
      b.addEventListener('pointerup', cancel);
      b.addEventListener('pointerleave', cancel);
      b.addEventListener('pointercancel', cancel);
      // 防止长按触发系统菜单
      b.addEventListener('contextmenu', e => e.preventDefault());
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.AEAuth = { init, getState: () => state, getDev, logout: async () => { await api('/auth', { action: 'logout' }); state.account = null; setAuth(null); renderAuthBtn(); }, openChat };
})();
