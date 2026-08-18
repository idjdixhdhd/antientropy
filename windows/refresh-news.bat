@echo off
REM ==========================================================
REM  逆熵 · 灵感雷达  —— 轻量后台更新脚本
REM  由 Windows 任务计划程序在 08:00 调用（即使主站关闭也运行）
REM  职责：重新抓取官方 RSS → 覆盖 news.json → 弹系统通知
REM  注意：本脚本完全独立，失败不会影响逆熵主站启动。
REM ==========================================================
cd /d "%~dp0.."
node fetch-news.cjs >> news-refresh.log 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0notify.ps1" -Title "逆熵 · 灵感雷达" -Msg "已刷新今日 AI 资讯，见「上次刷新时间」"
exit /b 0
