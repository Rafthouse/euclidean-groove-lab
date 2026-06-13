@echo off
cd /d "C:\Users\User\euclidean-groove-lab"

echo === Step 1: Check current branch ===
for /f %%i in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%i
echo Current branch: %BRANCH%

echo === Step 2: Save changes ===
git add -A
git commit -m "fix: anti-aliasing + gain smoothing for snare aliasing"

echo === Step 3: Switch to master and merge ===
git checkout master
git merge feature/elements-theme

echo === Step 4: Build ===
call npm run build

if "%ERRORLEVEL%" NEQ "0" (
    echo BUILD FAILED!
    pause
    exit /b 1
)

echo === Step 5: Push master ===
git push origin master

echo === Step 6: Switch back ===
git checkout feature/elements-theme

echo === Done! ===
echo Visit: https://rafthouse.github.io/euclidean-groove-lab/
pause
