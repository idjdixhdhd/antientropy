// beat 网格常量：BGM 定稿后只改这两个值，全片自动重排
// 初始占位 120BPM @30fps → 拍间隔 = 60/120 = 0.5s = 15f
export const BEAT0 = 0;        // 首拍时间（帧）
export const BEAT_INT = 15;    // 每拍帧数

export const beatF = (n: number): number => Math.round(BEAT0 + n * BEAT_INT);

export const FPS = 30;
export const W = 1920;
export const H = 1080;

// 场景时间轴（帧）：换 BGM 改 beatF 参数即可
export const TIMELINE = {
  s1: { from: beatF(0), dur: 150 },   // 打字机 5s
  s2: { from: beatF(10), dur: 150 },  // logo 5s
  s3: { from: beatF(20), dur: 300 },  // 主线 10s
  s4: { from: beatF(40), dur: 300 },  // 今日 10s
  s5: { from: beatF(60), dur: 240 },  // 身体 8s
  s6: { from: beatF(76), dur: 300 },  // 微光 10s
  s7: { from: beatF(96), dur: 210 },  // 雷达 7s
  s8: { from: beatF(110), dur: 150 }, // 收尾 5s
};

export const TOTAL = TIMELINE.s8.from + TIMELINE.s8.dur; // 1800 = 60s

// 字幕（每镜一句，≥56px 有效字高）
export const SUBS: { from: number; text: string; size?: number }[] = [
  { from: TIMELINE.s1.from, text: '你还记得，昨天做了什么吗？', size: 62 },
  { from: TIMELINE.s2.from, text: '逆熵 · 把熵倒着走', size: 66 },
  { from: TIMELINE.s3.from, text: '记下一点，曲线就长一格', size: 62 },
  { from: TIMELINE.s4.from, text: '做完就勾掉，明天再写新的', size: 62 },
  { from: TIMELINE.s5.from, text: '每天存几个好习惯，水位就涨', size: 62 },
  { from: TIMELINE.s6.from, text: '记下你做过的小事，攒满 20 件有彩蛋', size: 62 },
  { from: TIMELINE.s7.from, text: '每天看点世界在发生什么，看不懂一键译', size: 60 },
  { from: TIMELINE.s8.from, text: '你的每一天，都值得被记下来', size: 64 },
  { from: TIMELINE.s8.from + 45, text: 'antientropy.pages.dev', size: 58 },
];
