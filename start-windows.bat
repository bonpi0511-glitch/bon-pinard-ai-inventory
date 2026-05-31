@echo off
cd /d %~dp0
if not exist .env.local (
  copy .env.example .env.local
  echo .env.local を作成しました。OPENAI_API_KEY を入力してください。
  notepad .env.local
  pause
  exit /b
)
npm install
npm run dev
pause
