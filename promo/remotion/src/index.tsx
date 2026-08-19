import React from 'react';
import {
  AbsoluteFill, Composition, registerRoot, staticFile, Img,
  interpolate, spring, useCurrentFrame, useVideoConfig, delayRender, continueRender,
} from 'remotion';
import { useEffect, useState } from 'react';
import { TIMELINE, TOTAL, W, H, FPS } from './lib/beat';
import { Caption, breathe } from './lib/Caption';

const FONT_CSS = `
@font-face{font-family:'Noto Sans SC';src:url(${staticFile('fonts/noto-sans-sc-400.woff2')}) format('woff2');font-weight:400;font-display:block;}
@font-face{font-family:'Noto Sans SC';src:url(${staticFile('fonts/noto-sans-sc-600.woff2')}) format('woff2');font-weight:600;font-display:block;}
@font-face{font-family:'Noto Sans SC';src:url(${staticFile('fonts/noto-sans-sc-700.woff2')}) format('woff2');font-weight:700;font-display:block;}
@font-face{font-family:'Noto Serif SC';src:url(${staticFile('fonts/noto-serif-sc-400.woff2')}) format('woff2');font-weight:400;font-display:block;}
@font-face{font-family:'Noto Serif SC';src:url(${staticFile('fonts/noto-serif-sc-600.woff2')}) format('woff2');font-weight:600;font-display:block;}
`;

const BG = '#0a0c0d';

/* ---------- S1 打字机：黑屏 → 逐字浮现 ---------- */
const S1Typewriter: React.FC<{ local: number }> = ({ local }) => {
  const text = '你还记得，昨天做了什么吗？';
  const chars = Math.min(text.length, Math.floor(local / 3.2));
  const sub = text.slice(0, chars);
  const cursor = local % 16 < 9;
  return (
    <AbsoluteFill style={{ background: BG, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 66, color: '#e8ebe9', letterSpacing: '.06em' }}>
        {sub}
        <span style={{ color: '#5dd4b4', opacity: cursor ? 1 : 0 }}>|</span>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- S2 logo 渐显 + 呼吸 ---------- */
const S2Logo: React.FC<{ local: number }> = ({ local }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [TIMELINE.s2.from, TIMELINE.s2.from + 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sc = breathe(frame, TIMELINE.s2.from, 70);
  return (
    <AbsoluteFill style={{ background: BG, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', opacity: op, transform: `scale(${sc})` }}>
        <div style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 96, fontWeight: 600, color: '#f2f4f3', letterSpacing: '.18em' }}>
          逆熵
        </div>
        <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 30, color: '#5dd4b4', letterSpacing: '.42em', marginTop: 18, fontWeight: 500 }}>
          ANTIENTROPY
        </div>
        <div style={{ width: 120, height: 2, background: 'linear-gradient(90deg,transparent,#5dd4b4,transparent)', margin: '28px auto 0' }} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- 页面窗口（2.5D 运镜底座） ---------- */
const PageWindow: React.FC<{
  src: string; local: number; dur: number;
  rotateX?: number; rotateXTo?: number; scale?: number; scaleTo?: number;
  panY?: number;
}> = ({ src, local, dur, rotateX = 5, rotateXTo = 0, scale = 0.96, scaleTo = 1.04, panY = 0 }) => {
  const prog = interpolate(local, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => t });
  const rx = interpolate(prog, [0, 1], [rotateX, rotateXTo]);
  const sc = interpolate(prog, [0, 1], [scale, scaleTo]);
  const py = interpolate(prog, [0, 1], [panY, 0]);
  // 尺寸：全高 1080，宽 = 1080 * 1280/832
  const dispW = (1080 * 1280) / 832;
  return (
    <AbsoluteFill style={{
      justifyContent: 'center', alignItems: 'center',
      perspective: 1400, background: BG,
    }}>
      <div style={{
        width: dispW, height: 1080,
        transform: `rotateX(${rx}deg) translateY(${py}px) scale(${sc})`,
        transformOrigin: 'center center',
        boxShadow: '0 40px 120px rgba(0,0,0,.6)',
      }}>
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- S3 主线复利：2.5D 慢推 ---------- */
const S3Mainline: React.FC<{ local: number }> = ({ local }) => (
  <PageWindow src="frames/02_mainline.png" local={local} dur={TIMELINE.s3.dur} rotateX={5} rotateXTo={0} scale={0.96} scaleTo={1.05} />
);

/* ---------- S4 今日：partial → alldone 勾选动画 ---------- */
const S4Today: React.FC<{ local: number }> = ({ local }) => {
  const frame = useCurrentFrame();
  // 前 3s 显示 partial，然后交叉溶解到 alldone
  const swapAt = 90;
  const aOp = interpolate(frame, [TIMELINE.s4.from + swapAt, TIMELINE.s4.from + swapAt + 24], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bOp = interpolate(frame, [TIMELINE.s4.from + swapAt, TIMELINE.s4.from + swapAt + 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dispW = (1080 * 1280) / 832;
  const pan = interpolate(frame, [TIMELINE.s4.from, TIMELINE.s4.from + TIMELINE.s4.dur], [0, -26], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', perspective: 1400, background: BG }}>
      <div style={{ width: dispW, height: 1080, transform: `rotateX(3deg) translateX(${pan}px) scale(1.0)`, transformOrigin: 'center center', position: 'relative' }}>
        <Img src={staticFile('frames/03_today.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', opacity: aOp }} />
        <Img src={staticFile('frames/09_today_alldone.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', opacity: bOp }} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- S5 身体：水位高亮呼吸 ---------- */
const S5Body: React.FC<{ local: number }> = ({ local }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.018 * Math.sin(((frame - TIMELINE.s5.from) / 30) * Math.PI * 2);
  const dispW = (1080 * 1280) / 832;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', perspective: 1400, background: BG }}>
      <div style={{ width: dispW, height: 1080, transform: `scale(${pulse})`, transformOrigin: 'center center' }}>
        <Img src={staticFile('frames/04_body.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- S6 微光：逐条 reveal ---------- */
const S6Love: React.FC<{ local: number }> = ({ local }) => {
  const frame = useCurrentFrame();
  const dispW = (1080 * 1280) / 832;
  // 顶部滑入 + 柔和光泽
  const slide = interpolate(frame, [TIMELINE.s6.from, TIMELINE.s6.from + 40], [-30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glow = 0.5 + 0.5 * Math.sin(((frame - TIMELINE.s6.from) / 40) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', background: BG }}>
      <div style={{ width: dispW, height: 1080, transform: `translateY(${slide}px)`, transformOrigin: 'center center', position: 'relative' }}>
        <Img src={staticFile('frames/05_love.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {/* 柔光粒子（右上角） */}
        <div style={{
          position: 'absolute', top: 60, right: 90, width: 90, height: 90, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(93,212,180,.28) 0%, transparent 65%)',
          opacity: glow,
        }} />
        <div style={{
          position: 'absolute', top: 180, right: 180, width: 50, height: 50, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(93,212,180,.20) 0%, transparent 60%)',
          opacity: 1 - glow,
        }} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- S7 灵感雷达：卡片平移 + 译按钮高亮 ---------- */
const S7Radar: React.FC<{ local: number }> = ({ local }) => {
  const frame = useCurrentFrame();
  const dispW = (1080 * 1280) / 832;
  const pan = interpolate(frame, [TIMELINE.s7.from, TIMELINE.s7.from + TIMELINE.s7.dur], [26, -10], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pulse = 0.55 + 0.45 * Math.sin(((frame - TIMELINE.s7.from) / 26) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', background: BG }}>
      <div style={{ width: dispW, height: 1080, transform: `translateX(${pan}px)`, position: 'relative' }}>
        <Img src={staticFile('frames/06_radar.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {/* 译 按钮高亮（右下角卡片区域，比例估位） */}
        <div style={{
          position: 'absolute', right: 96, bottom: 300, width: 56, height: 30, borderRadius: 5,
          background: 'rgba(93,212,180,.45)', boxShadow: `0 0 ${34 * pulse}px rgba(93,212,180,.9)`,
          opacity: pulse,
        }} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- S8 收尾：品牌字标 + 网址 ---------- */
const S8Outro: React.FC<{ local: number }> = ({ local }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [TIMELINE.s8.from, TIMELINE.s8.from + 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sc = breathe(frame, TIMELINE.s8.from, 60);
  return (
    <AbsoluteFill style={{ background: BG, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', opacity: op, transform: `scale(${sc})` }}>
        <div style={{ fontFamily: '"Noto Serif SC", serif', fontSize: 84, fontWeight: 600, color: '#f2f4f3', letterSpacing: '.16em' }}>逆熵</div>
        <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 26, color: '#5dd4b4', letterSpacing: '.38em', marginTop: 16 }}>ANTIENTROPY</div>
        <div style={{ marginTop: 44, fontFamily: '"Noto Sans SC", sans-serif', fontSize: 36, color: '#9aa6a0', letterSpacing: '.05em' }}>
          antientropy.pages.dev
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- 主合成 ---------- */
const AntiPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const inS = (k: keyof typeof TIMELINE) => frame >= TIMELINE[k].from && frame < TIMELINE[k].from + TIMELINE[k].dur;
  const local = (k: keyof typeof TIMELINE) => frame - TIMELINE[k].from;

  // 全片黑色淡出（最后 0.5s）
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  let scene: React.ReactNode = null;
  let sub: string | null = null;
  if (inS('s1')) { scene = <S1Typewriter local={local('s1')} />; sub = '你还记得，昨天做了什么吗？'; }
  else if (inS('s2')) { scene = <S2Logo local={local('s2')} />; sub = '逆熵 · 把熵倒着走'; }
  else if (inS('s3')) { scene = <S3Mainline local={local('s3')} />; sub = '记下一点，曲线就长一格'; }
  else if (inS('s4')) { scene = <S4Today local={local('s4')} />; sub = '做完就勾掉，明天再写新的'; }
  else if (inS('s5')) { scene = <S5Body local={local('s5')} />; sub = '每天存几个好习惯，水位就涨'; }
  else if (inS('s6')) { scene = <S6Love local={local('s6')} />; sub = '记下你做过的小事，攒满 20 件有彩蛋'; }
  else if (inS('s7')) { scene = <S7Radar local={local('s7')} />; sub = '每天看点世界在发生什么，看不懂一键译'; }
  else if (inS('s8')) { scene = <S8Outro local={local('s8')} />; sub = '你的每一天，都值得被记下来'; }

  return (
    <AbsoluteFill style={{ background: BG }}>
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />
      {scene}
      {sub && <Caption text={sub} />}
      <AbsoluteFill style={{ background: '#000', opacity: fadeOut, zIndex: 40 }} />
    </AbsoluteFill>
  );
};

const Root: React.FC = () => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all([
      document.fonts.load('400 60px "Noto Sans SC"'),
      document.fonts.load('600 60px "Noto Sans SC"'),
      document.fonts.load('400 66px "Noto Serif SC"'),
      document.fonts.load('600 96px "Noto Serif SC"'),
      document.fonts.load('500 30px "Orbitron"'),
    ]).then(() => continueRender(handle)).catch(() => continueRender(handle));
  }, [handle]);
  return (
    <>
      <Composition id="AntiPromo" component={AntiPromo} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
    </>
  );
};

registerRoot(Root);
