# 灵感雷达 · 真实数据管线 与 每日 08:00 自动刷新

## 这条管线做什么

站点本身（`index.html` + `app.js`）是**纯静态**的，浏览器里无法直接抓 OpenAI / GitHub 的 RSS（CORS 限制）。
所以"真·实时"必须靠一条独立的**数据管线**：

```
官方 RSS（OpenAI / GitHub / Google / Hugging Face）
        │  fetch-news.cjs（抓取·筛选·去重·校验·容错）
        ▼
   news.json（站点读取，标 live / cache）
        │
        ▼
   灵感雷达板块渲染真实卡片（点击开官方原文）
```

- `fetch-news.cjs`：纯 Node（Node 18+ 自带 fetch，无需 `npm install`）。
- `news.json`：站点加载的数据文件。`status:"live"` 表示本次联网成功抓取；`"cache"` 表示联网失败、回退了上一次成功缓存。
- 界面右上角显示**「上次刷新时间」**和**「实时 / 缓存」**标记；「立即刷新」按钮重新拉取 `news.json`。

## 每天 10 条怎么来

1. 只抓可验证官方公开源（OpenAI News / GitHub Changelog / Google AI Blog / Hugging Face Blog）。
2. 按类别加权排序：模型 / Agent / MCP / 工具调用 / API / 图像 / 视频 / 语音 / 推理 优先；融资、人事、观点、活动类直接过滤。
3. 取分数最高的 **10 条**；重复链接、无效日期、空摘要、超时、断网各自容错，互不影响。
4. 图片：优先 RSS `media:` 字段 → 其次原文 `og:image` → 都没有则 `null`，站点用**来源占位卡**（不伪造配图）。
5. 中文标题 / 摘要由 AI 在二次整理时补全（见下）；翻译失败保留英文原文并标注，绝不编造。

## 每日 08:00 自动刷新（Windows）

> 纯静态网页**做不到"应用关闭也推送"**——网页定时器在你关掉页面就停了。
> 真正"关着也能跑"必须靠操作系统级任务。这里用 **Windows 任务计划程序 + SYSTEM 账户**。

### 首次开启提醒时（创建任务）
右键 `windows/install-task.bat` → **以管理员身份运行**。
会创建任务 `AntientropyNews0800`，每天 08:00 由 SYSTEM 账户运行 `refresh-news.bat`：
重新抓取 → 覆盖 `news.json` → 弹系统 Toast 通知。

- ✅ 用 SYSTEM 账户：**你没登录 / 主站关闭也会刷新**。
- ✅ 任务与主站**完全独立**，任务失败不会影响逆熵主站启动。
- ✅ 失败重试由任务计划程序自身的重试策略兜底。

### 关闭提醒时（移除任务）
运行 `windows/uninstall-task.bat` 即可移除，站点不再自动刷新（手动点「立即刷新」仍可）。

### 文件
| 文件 | 作用 |
|---|---|
| `fetch-news.cjs` | 真实数据管线（抓取→筛选→写 news.json） |
| `windows/refresh-news.bat` | 轻量后台更新脚本（被任务调用） |
| `windows/notify.ps1` | 系统 Toast 通知 |
| `windows/install-task.bat` | 创建每日 08:00 任务（管理员运行） |
| `windows/uninstall-task.bat` | 移除任务 |

## 手动刷新 / 二次整理（翻译中文）

```bash
cd antientropy
node fetch-news.cjs          # 抓真实英文条目写入 news.json（status: live）
```

脚本产出的是**英文原文 + 空的中文标题/摘要**（`translated:false`），严格遵循"不编造中文"。
要上中文：把 `fetch-news.cjs` 的输出交给 AI（或接一个翻译 API），补全每条的
`titleZh` / `summary` / `tags` 并置 `translated:true`，再写回 `news.json` 即可。
当前仓库里的 `news.json` 就是已经过这一整理的真实快照。

## 部署在 GitHub Pages 时的另一种"服务端刷新"

如果你把站点部署到 GitHub Pages，**不打包成桌面端**也能做到"关着也刷新"：
用一个 GitHub Actions 定时工作流（cron 每天 08:00 UTC）运行 `fetch-news.cjs`，
提交新的 `news.json`，站点下次加载即拿到"实时"数据。这样无需 Windows 任务计划程序。
（该方案的 workflow 文件可按需追加。）

## 关于"立即刷新"按钮（静态站语义）

静态站上的「立即刷新」= 重新向服务器请求 `news.json`（即拉取**已部署的最新缓存**）。
它**不会**在浏览器里现场抓 RSS（CORS 不允许）。要真正重新生成数据，需运行上面的脚本
（本地手动 / GitHub Actions / Windows 任务计划程序），生成后站点即显示"实时"。
