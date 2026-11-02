@echo off
rem Sobe o EGGS by Santimelo (app dos clientes + painel) no computador (modo produção, mais rápido) e abre o navegador.
rem Pra parar: feche esta janela.
title EGGS by Santimelo
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias, so na primeira vez...
  call npm install || goto erro
)
start "" /b powershell -NoProfile -Command "while ($true) { try { Invoke-WebRequest http://localhost:3001/login -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep 2 } }; Start-Process http://localhost:3001/painel"
call npm run local || goto erro
goto :eof
:erro
echo.
echo Deu erro ao iniciar. Tire um print desta janela e mande pro suporte.
pause
