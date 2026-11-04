@echo off
echo ========================================================
echo  Pushing motion-tv-game to your GitHub for Render Deploy
echo ========================================================
echo.
set /p REPO="Enter your GitHub repo URL (e.g. https://github.com/javamahendran-mickey/motion-tv-game.git): "
if "%REPO%"=="" (
    echo No repository URL entered. Exiting.
    pause
    exit /b 1
)

git remote remove origin 2>nul
git remote add origin %REPO%
git branch -M main
echo.
echo Pushing code to GitHub...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo  SUCCESS! Code pushed to GitHub.
    echo  Now go to https://dashboard.render.com/
    echo  Click 'New +' -> 'Web Service' -> Select this repo!
    echo ========================================================
) else (
    echo.
    echo [ERROR] Push failed. Please ensure the repository was created on GitHub first.
)
pause
