@echo off
chcp 65001 >nul
cd /d "%~dp0"

title HM Automotivo - Subir para GitHub

color 0A

echo.
echo  ================================================
echo   HM CENTRO AUTOMOTIVO
echo   Subir arquivos para o GitHub (push)
echo  ================================================
echo.
echo  Repo:  https://github.com/netikis/HMAUTOMOTIVO
echo  Site:  https://hmautomotivo.vercel.app
echo.
echo  NAO SOBE: .env, firebase-env.js, pasta FIREBASE\
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo ERRO: Git nao encontrado.
  echo Instale: https://git-scm.com/download/win
  echo Ou use GitHub Desktop.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [1/4] Primeira vez — criando repositorio local...
  git init
  git branch -M main
  git remote add origin https://github.com/netikis/HMAUTOMOTIVO.git
  echo.
  echo Baixando versao do GitHub (logos e arquivos que faltam)...
  git fetch origin main 2>nul
  git pull origin main --allow-unrelated-histories --no-edit 2>nul
  echo.
)

echo [2/4] Arquivos alterados:
git status -sb
echo.

set "MSG="
set /p MSG="Mensagem do commit (Enter = Atualizacao HM): "
if "%MSG%"=="" set "MSG=Atualizacao HM Automotivo"

echo.
echo [2.5/4] Versao do app (PC + celular PWA)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='sw.js'; if (Test-Path $p) { $t=Get-Content -LiteralPath $p -Raw -Encoding UTF8; $n=[int]([DateTime]::UtcNow.ToString('yyMMddHHmm')); $t2=[regex]::Replace($t, \"var CACHE = 'hm-auto-v[^']*'\", \"var CACHE = 'hm-auto-v$n'\"); $t2=[regex]::Replace($t2, '\?v=\d+', \"?v=$n\"); Set-Content -LiteralPath $p -Value $t2 -Encoding UTF8 -NoNewline; Write-Host ('CACHE hm-auto-v'+$n) }"
echo.

echo [3/4] Commit...
git add .
git diff --cached --quiet
if not errorlevel 1 (
  echo Nada novo para enviar. Tudo ja esta commitado.
  goto PUSH
)
git commit -m "%MSG%"
if errorlevel 1 (
  echo ERRO no commit.
  pause
  exit /b 1
)

:PUSH
echo.
echo [4/4] Enviando para GitHub (push)...
git push -u origin main
if errorlevel 1 (
  echo.
  echo PUSH FALHOU. Tentando puxar do GitHub e enviar de novo...
  git pull origin main --rebase
  if errorlevel 1 (
    git pull origin main --allow-unrelated-histories --no-edit
  )
  git push -u origin main
  if errorlevel 1 (
    echo.
    echo Ainda falhou. Faca login no Git:
    echo   - GitHub Desktop: abra esta pasta e clique Push
    echo   - Ou: git config credential.helper manager
    echo   - Ou abra: https://github.com/netikis/HMAUTOMOTIVO
    pause
    exit /b 1
  )
)

echo.
echo ================================================
echo   OK! Codigo enviado para o GitHub.
echo   A Vercel publica sozinha em 1-3 minutos.
echo   PC e aplicativo celular usam o MESMO site:
echo   https://hmautomotivo.vercel.app
echo ================================================
echo.
echo  GitHub: https://github.com/netikis/HMAUTOMOTIVO
echo  Site:   https://hmautomotivo.vercel.app
echo.
echo  Depois do deploy: abra o site no PC e no celular
echo  (ou feche e abra o app instalado) — atualiza sozinho.
echo.
pause
start https://github.com/netikis/HMAUTOMOTIVO
start https://hmautomotivo.vercel.app
