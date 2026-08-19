/* 用真实 Chromium 截真实网页 —— 不是程序化画假图
   覆盖：桌面三主题主线 / 各板块 / 彩蛋六阶段序列帧 / 移动端双端 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = 'file://' + path.join(__dirname, 'index.html') + '?today=2026-08-18';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });

  /* ---------- 桌面 1920×1080 ---------- */
  const dc = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const d = await dc.newPage();
  await d.goto(URL, { waitUntil: 'load' });
  await d.evaluate(() => localStorage.clear());
  await d.reload({ waitUntil: 'load' });
  await sleep(2400);
  await d.screenshot({ path: path.join(OUT, 'd1_mainline_mint.png') });

  await d.evaluate(() => window.AE.theme('ember'));
  await sleep(2000);
  await d.screenshot({ path: path.join(OUT, 'd2_mainline_ember.png') });

  await d.evaluate(() => window.AE.theme('indigo'));
  await sleep(2000);
  await d.screenshot({ path: path.join(OUT, 'd3_mainline_indigo.png') });

  await d.evaluate(() => { window.AE.theme('mint'); window.AE.go('today'); });
  await sleep(1100);
  await d.screenshot({ path: path.join(OUT, 'd4_today.png') });

  await d.evaluate(() => window.AE.go('body'));
  await sleep(3800);
  await d.screenshot({ path: path.join(OUT, 'd5_body.png') });

  await d.evaluate(() => window.AE.go('love'));
  await sleep(1100);
  await d.screenshot({ path: path.join(OUT, 'd6_love.png') });

  /* 彩蛋六阶段序列帧（先把记录补足 20 件，确保记忆卡满屏） */
  await d.evaluate(() => {
    const S = window.AE.state();
    while (S.loves.length < 20) {
      S.loves.push({ id: 'pad' + S.loves.length, who: '朋友', what: '陪我熬过最难的那个晚上，没让我一个人', at: '2026-08-10' });
    }
  });
  await d.evaluate(() => window.AE.egg());
  await sleep(700);   await d.screenshot({ path: path.join(OUT, 'd7a_egg_dim.png') });      // ① 熄灭
  await sleep(900);   await d.screenshot({ path: path.join(OUT, 'd7b_egg_beam.png') });     // ② 聚光
  await sleep(1700);  await d.screenshot({ path: path.join(OUT, 'd7c_egg_bloom.png') });    // ③ 玫瑰盛开
  await sleep(4500);  await d.screenshot({ path: path.join(OUT, 'd7d_egg_final.png') });    // ⑤⑥ 记忆卡+定格
  await d.evaluate(() => window.AE.closeEgg());

  await d.evaluate(() => window.AE.go('radar'));
  await sleep(1600);
  await d.screenshot({ path: path.join(OUT, 'd8_radar.png') });

  // 来源筛选：只看 GitHub（验证筛选交互 + 真实卡片）
  await d.evaluate(() => { const b = document.querySelector('[data-src="GitHub"]'); if (b) b.click(); });
  await sleep(500);
  await d.screenshot({ path: path.join(OUT, 'd8b_radar_github.png') });
  await dc.close();

  /* ---------- 移动 390×844 ---------- */
  const mc = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const m = await mc.newPage();
  await m.goto(URL, { waitUntil: 'load' });
  await m.evaluate(() => localStorage.clear());
  await m.reload({ waitUntil: 'load' });
  await sleep(2400);
  await m.screenshot({ path: path.join(OUT, 'm1_mainline.png') });

  await m.evaluate(() => window.AE.go('body'));
  await sleep(3800);
  await m.screenshot({ path: path.join(OUT, 'm2_body.png') });

  await m.evaluate(() => window.AE.go('love'));
  await sleep(1100);
  await m.screenshot({ path: path.join(OUT, 'm3_love.png') });

  await m.evaluate(() => {
    const S = window.AE.state();
    while (S.loves.length < 20) {
      S.loves.push({ id: 'mpad' + S.loves.length, who: '朋友', what: '陪我熬过最难的那个晚上', at: '2026-08-10' });
    }
  });
  await m.evaluate(() => window.AE.egg());
  await sleep(9000);
  await m.screenshot({ path: path.join(OUT, 'm4_egg_final.png') });

  await m.evaluate(() => window.AE.go('radar'));
  await sleep(1700);
  await m.screenshot({ path: path.join(OUT, 'm5_radar.png') });
  await mc.close();

  await browser.close();
  console.log('shots ->', fs.readdirSync(OUT).sort().join(' '));
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
