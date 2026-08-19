# 逆熵 ANTIENTROPY · 宣传片 BGM 方案选择题（v1）

> 60 秒桌面端宣传片。你要做的：选一个方向 → 复制提示词 → 去 AI 音乐平台生成（Suno / Mubert / 网易天音等）→ 把音频文件发我。
> 我拿到音频后：跑 librosa 节拍分析 → 出 `beat_data.json` → 全片 8 段切点吸附拍网格 → 渲后回测帧差 ≤3f。

---

## 一、宣传片节奏骨架（所有 BGM 方案都按这个时间轴卡点）

| 段 | 时间 | 画面 | 情绪档 |
|---|---|---|---|
| S1 | 0:00–0:05 | 黑屏打字机：「你还记得，昨天做了什么吗？」 | 最低（留白） |
| S2 | 0:05–0:10 | 逆熵 logo + 品牌名浮现 | 渐起 |
| S3 | 0:10–0:20 | 主线复利：空曲线 → 长出起伏 | 平缓推进 |
| S4 | 0:20–0:30 | 今日必须完成：勾选任务动画 | 轻快一点 |
| S5 | 0:30–0:38 | 身体账户：水位从空到半满 | 平缓 |
| S6 | 0:38–0:48 | 微光：一条条加入 | 温暖柔光 |
| S7 | 0:48–0:55 | 灵感雷达：卡片滑入 + 「译」按钮 | 轻巧 |
| S8 | 0:55–1:00 | 六面板快闪 → 网址定格 | 收束 |

**卡点要求**：
- 段落切换点（0:05 / 0:10 / 0:20 / 0:30 / 0:38 / 0:48 / 0:55）必须是**重拍或强音头**
- S3→S4 之间允许一个呼吸小停顿（0:20 前 0.3s 留白）
- 结尾 1:00 收在**最后一个长音/和弦延音**上，留 1s 尾音淡出
- 全曲 BPM 建议 **60–80**（慢速才符合"逆熵"气质，太快会像科技公司广告）

---

## 二、三套 BGM 方案（按推荐度）

### 方案 A（推荐）· 极简氛围钢琴
> 最贴产品气质。深色 + 薄荷绿 + 克制，配极简钢琴是标准答案。

| 项 | 值 |
|---|---|
| 类型 | 氛围钢琴 / ambient piano，单钢琴 + 极轻 pad |
| BPM | 66（极慢，每拍都是重拍） |
| 时长 | 60s（结尾留 2s 尾音） |
| 情绪曲线 | 0–5s 单音试探 → 5–10s 主旋律进来 → 10–30s 重复+轻声和弦 → 30–48s 左手加低音 → 48–55s 高音区点亮 → 55–60s 落回主和弦延音 |
| 卡点 | 天然：每 2 拍一个音头，段落切换正好落在强拍 |
| 缺点 | 无鼓点，不能做"闪切"，转场全用淡入淡出 |

**AI 生成提示词（直接复制）**：
```
60-second ambient piano track, minimal, sparse notes, gentle felt piano, 
very slow tempo around 66 BPM, deep dark atmosphere, hopeful undertone, 
intro 5 seconds with single notes, melody enters at 5 seconds, 
soft bass notes from 30 seconds, bright high piano notes at 48 seconds, 
ends on a sustained major chord with 2-second fade out, cinematic, calm, 
no drums, no vocals, mood: quiet strength, 逆熵 anti-entropy concept
```

### 方案 B · 轻电子 chill / lo-fi
> 适合发朋友圈给年轻人看，有轻微鼓点可做卡点闪切。

| 项 | 值 |
|---|---|
| 类型 | lo-fi chillhop / 轻电子，鼓点极轻（不抢戏） |
| BPM | 75 |
| 时长 | 60s |
| 情绪曲线 | 0–5s 只有 pad+噪声垫 → 5s 鼓点轻轻进入 → 10–30s 稳定 loop → 30–48s 加一个旋律动机 → 48–55s 留一个"扫镲+停一拍" → 55–60s 收 |
| 卡点 | 每小节 1、3 拍有 kick（轻），段落切换落在小节首拍 |
| 缺点 | 鼓点需要小心别压过字幕；情绪偏"日常"不偏"哲学" |

**AI 生成提示词**：
```
60-second lofi chillhop track, 75 BPM, soft vinyl crackle, warm Rhodes piano,
subtle kick drum on beats 1 and 3, gentle hi-hats, calm nocturnal mood,
intro 5 seconds ambient pad only, drums enter at 5 seconds, 
simple melodic motif from 30 seconds, one-bar break with cymbal at 48 seconds,
ends with piano note sustain and fade out, no vocals, quiet, minimal,
mood: late night productivity, anti-entropy aesthetic
```

### 方案 C · 电影感合成器铺底
> 最有"大片感"，但容易过重，适合你想突出"产品理念"的版本。

| 项 | 值 |
|---|---|
| 类型 | cinematic ambient / 合成器 pad + 低频脉冲 |
| BPM | 60 |
| 时长 | 60s |
| 情绪曲线 | 0–5s 单 pad 渐入 → 5s 加第二个 pad 叠厚 → 10–20s 低频脉冲（心跳感）→ 20–38s 渐强 → 38–48s 最高点（弦乐质感）→ 48–55s 略回落 → 55–60s 收 |
| 卡点 | 脉冲每拍一个，段落切换在脉冲重音 |
| 缺点 | 情绪重，微光/今日两个"轻"段落可能压不过它 |

**AI 生成提示词**：
```
60-second cinematic ambient track, 60 BPM, layered synth pads, 
deep sub bass pulse on every beat, orchestral string textures, 
starts minimal single pad, second pad layer at 5 seconds, 
heartbeat pulse from 10 seconds, builds to emotional peak at 38-48 seconds, 
gentle release at 48 seconds, ends on sustained chord with long fade, 
no drums no vocals, epic but restrained, mood: quiet revolution, anti-entropy
```

---

## 三、推荐平台（你那边选）

| 平台 | 免费程度 | 说明 |
|---|---|---|
| **Suno**（suno.com） | 每天有免费额度 | 提示词驱动，最能还原上面 prompt；生成后下载 mp3/wav 发我 |
| **Mubert**（mubert.com） | 免费试听 | 风格选 ambient/piano，有实时生成 |
| **网易天音**（tianyin.163.com） | 免费 | 国内直接访问，不用梯子 |
| **AIVA** | 免费额度 | 偏电影配乐，适合方案 C |

> 也可以直接回我「选 A」+ 把音频文件发我（mp3/wav 都行）。我拿到就做节拍分析，出卡点时间轴，开始渲片。

---

## 四、拿到音频后我做什么（保证卡点）

1. `librosa.beat_track` 分析真实 BPM / 首拍 / 网格 → 验收残差 ≤±15ms
2. 全片 8 段切点用 `beatF(n)` 写成常量 → 换曲只改两个常量自动重排
3. Remotion 渲片（带 BGM / 无 BGM 双版）
4. 渲后回测：从成片抽音轨重跑网格，切点 vs 拍帧差 ≤3f 才算过
