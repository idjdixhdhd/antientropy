@echo off
REM ==========================================================
REM  创建「每天 08:00 自动刷新资讯」的 Windows 任务计划
REM  用 SYSTEM 账户运行：即使你没登录 / 主站关闭，也会准时刷新。
REM  需要以管理员身份运行本文件。
REM ==========================================================
set "TASKNAME=AntientropyNews0800"

schtasks /Create ^
  /TN "%TASKNAME%" ^
  /TR "\"%~dp0refresh-news.bat\"" ^
  /SC DAILY /ST 08:00 ^
  /RU "SYSTEM" /RL HIGHEST ^
  /F

IF %ERRORLEVEL%==0 (
  echo.
  echo 已创建任务 %TASKNAME%：每天 08:00 刷新（SYSTEM 账户，应用关闭也运行）。
  echo 任务失败不会影响逆熵主站启动（二者完全独立）。
  echo 移除任务请运行 uninstall-task.bat。
) ELSE (
  echo 创建失败。请右键本文件 →「以管理员身份运行」。
)
pause
