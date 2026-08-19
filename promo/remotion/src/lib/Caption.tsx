import React from 'react';
import { interpolate, spring, useCurrentFrame } from 'remotion';

// 字幕组件：有效字高 ≥56px，半透明深底白字，底部 scrim
export const Caption: React.FC<{ text: string; size?: number; start?: number }> = ({
  text, size = 62, start = 0,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [start, start + 12, start + 90, start + 120], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [start, start + 20], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(to top, rgba(6,8,9,.88) 0%, rgba(6,8,9,.45) 55%, transparent 100%)',
      opacity, transform: `translateY(${y}px)`,
      zIndex: 30,
    }}>
      <div style={{
        fontFamily: '"Noto Sans SC", sans-serif', fontWeight: 600,
        fontSize: size, color: '#f2f4f3', letterSpacing: '0.04em',
        textShadow: '0 2px 18px rgba(0,0,0,.5)', lineHeight: 1.35,
        textAlign: 'center', padding: '0 60px', maxWidth: 1700,
      }}>{text}</div>
    </div>
  );
};

// 轻微呼吸缩放（logo / 字标用）
export const breathe = (frame: number, from: number, dur = 60) => {
  const t = spring({
    frame: Math.max(0, frame - from),
    fps: 30, config: { damping: 14, stiffness: 60, mass: 1 },
  });
  return 1 + 0.015 * Math.sin(((frame - from) / dur) * Math.PI * 2) * t;
};
