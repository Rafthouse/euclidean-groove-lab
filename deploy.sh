#!/bin/bash
cd /d "C:\Users\User\euclidean-groove-lab" || exit 1

echo "=== Step 1: Save changes ==="
git add src/audio.ts
git commit -m "fix: anti-aliasing + gain smoothing for snare aliasing

- Bass filter Q reduced 0.7->0.1 to eliminate resonant ringing
- Per-voice 4th-order 16 kHz anti-aliasing LPF on all drum samples
- Smooth gain ramp (5ms) via dedicated Tone.Gain to kill zipper noise
- Proper chain disposal on kit swap"

echo "=== Step 2: Build ==="
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo "BUILD FAILED!"
    pause
    exit /b 1
)

echo "=== Step 3: Push ==="
git add docs/
git commit -m "build: deploy anti-aliasing fix"
git push origin master

echo "=== Done! ==="
echo "Visit: https://rafthouse.github.io/euclidean-groove-lab/"
pause
