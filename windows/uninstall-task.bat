@echo off
REM 移除「每天 08:00 自动刷新资讯」任务（关闭提醒时调用）
set "TASKNAME=AntientropyNews0800"
schtasks /Delete /TN "%TASKNAME%" /F
echo 已移除任务 %TASKNAME%。
pause
