@echo off
chcp 65001 >nul
title 番茄Todo 云端一键启动
cd /d "%~dp0"

echo ==================================================
echo   番茄Todo 云端一键启动（MongoDB + 后端）
echo ==================================================

REM ---------- 1. MongoDB：27017 端口通则跳过 ----------
powershell -NoProfile -Command "try{ $c=New-Object Net.Sockets.TcpClient('127.0.0.1',27017); $c.Close(); exit 0 }catch{ exit 1 }" >nul 2>nul
if %errorlevel%==0 (
  echo [1/2] MongoDB 已在运行，跳过启动
) else (
  echo [1/2] 启动 MongoDB（首次运行自动下载约 100MB，已走国内镜像加速）...
  start "MongoDB-dev" cmd /k "cd /d %~dp0server && npm run mongo"
  echo       等待 MongoDB 就绪（最多 3 分钟，请看弹出的 MongoDB 窗口的下载进度）...
  powershell -NoProfile -Command "for($i=0;$i -lt 180;$i++){ try{ $c=New-Object Net.Sockets.TcpClient('127.0.0.1',27017); $c.Close(); exit 0 }catch{ Start-Sleep -Seconds 1 } }; exit 1" >nul 2>nul
  if errorlevel 1 (
    echo [!] MongoDB 3 分钟内未就绪——多半是首次下载还没完成。
    echo     请观察 MongoDB-dev 窗口：下载结束后会显示"MongoDB 已就绪"。
    echo     之后**重新双击本脚本**即可。
    pause
    exit /b 1
  )
  echo       MongoDB 就绪
)

REM ---------- 2. 后端：3000 端口通则跳过 ----------
powershell -NoProfile -Command "try{ $c=New-Object Net.Sockets.TcpClient('127.0.0.1',3000); $c.Close(); exit 0 }catch{ exit 1 }" >nul 2>nul
if %errorlevel%==0 (
  echo [2/2] 后端已在运行，跳过启动
) else (
  echo [2/2] 启动后端 npm run dev ...
  start "tomato-server" cmd /k "cd /d %~dp0server && npm run dev"
  echo       等待后端就绪...
  powershell -NoProfile -Command "for($i=0;$i -lt 30;$i++){ try{ $c=New-Object Net.Sockets.TcpClient('127.0.0.1',3000); $c.Close(); exit 0 }catch{ Start-Sleep -Seconds 1 } }; exit 1" >nul 2>nul
  if errorlevel 1 (
    echo [!] 后端 30 秒内未就绪，请看 tomato-server 窗口里的报错信息。
    pause
    exit /b 1
  )
  echo       后端就绪
)

echo ==================================================
echo   全部就绪！现在去 App 里：
echo     我的 -^> 登录 -^> 注册/登录
echo   登录后顶部会显示「云端已连接」
echo.
echo   停止方式：直接关闭 MongoDB-dev 和 tomato-server 两个窗口
echo   数据存放在 server\data\mongo，重启不丢
echo ==================================================
pause
