# STELLAR — Start All Services
# This script sets up the environment and launches both Firebase Emulators and Vite Dev Server.

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
$env:NODE_PATH = "$PSScriptRoot/functions/node_modules;$PSScriptRoot/web/node_modules"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting STELLAR Services             " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Start Firebase Emulators in a new window/job
Write-Host "`n[1/3] Launching Firebase Emulator Suite..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; `$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); firebase emulators:start --project stellar-ef848"

# Give emulators 8 seconds to initialize
Start-Sleep -Seconds 8

# 2. Seed Initial Database Data
Write-Host "[2/3] Seeding initial emulator database..." -ForegroundColor Yellow
try {
    & npx tsx "$PSScriptRoot/scripts/seed.ts"
} catch {
    Write-Warning "Seed script ran with warning/notice."
}

# 3. Start Web Dev Server
Write-Host "[3/3] Starting React Vite dev server on http://localhost:5173..." -ForegroundColor Green
cd "$PSScriptRoot/web"
npm run dev
