# TDrive Windows Deployment Script (Laragon/Production)
# Run in PowerShell as Administrator

param(
    [string]$InstallDir = "C:\TDrive",
    [int]$ApiPort = 3001,
    [int]$WebPort = 3000
)

$ErrorActionPreference = "Stop"

Write-Host "`n🔥 TDrive Windows Deployment" -ForegroundColor Cyan
Write-Host "============================`n"

# 1. Check prerequisites
Write-Host "[1/7] Checking prerequisites..."

# Check Chocolatey
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "  Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# 2. Install dependencies
Write-Host "`n[2/7] Installing dependencies..."

# Bun
if (!(Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "  Installing Bun..."
    choco install bun -y
}

# PostgreSQL
if (!(Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "  Installing PostgreSQL..."
    choco install postgresql16 -y --params "/Password:postgres"
}

# Redis (via Memurai or Redis for Windows)
$redisInstalled = Get-Command redis-cli -ErrorAction SilentlyContinue
if (!$redisInstalled) {
    Write-Host "  Installing Redis..."
    # Try Windows Subsystem for Linux approach or download directly
    $redisUrl = "https://github.com/microsoftarchive/redis/releases/download/win-3.0.503/Redis-x64-3.0.503.zip"
    $redisZip = "$env:TEMP\redis.zip"
    $redisDir = "C:\Redis"
    
    if (!(Test-Path $redisDir)) {
        Invoke-WebRequest -Uri $redisUrl -OutFile $redisZip -UseBasicParsing
        Expand-Archive -Path $redisZip -DestinationPath $redisDir -Force
        Start-Process "$redisDir\redis-server.exe" -ArgumentList "$redisDir\redis.windows-service.conf" -WindowStyle Hidden
        Write-Host "  Redis installed to $redisDir"
    }
}

# PM2
if (!(Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "  Installing PM2..."
    bun install -g pm2
}

# 3. Deploy application
Write-Host "`n[3/7] Deploying application..."
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir

# Copy files
Write-Host "  Copying files to $InstallDir..."
robocopy $projectDir $InstallDir /E /XD node_modules .git apps\api\node_modules apps\web\node_modules /NFL /NDL /NJH /NJS

# 4. Setup environment
Write-Host "`n[4/7] Configuring environment..."
if (!(Test-Path "$InstallDir\.env")) {
    Copy-Item "$InstallDir\.env.production.example" "$InstallDir\.env"
    
    # Generate random secrets
    $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
    $encKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
    
    (Get-Content "$InstallDir\.env") -replace 'JWT_SECRET=.*', "JWT_SECRET=$jwtSecret" | Set-Content "$InstallDir\.env"
    (Get-Content "$InstallDir\.env") -replace 'ENCRYPTION_KEY=.*', "ENCRYPTION_KEY=$encKey" | Set-Content "$InstallDir\.env"
    (Get-Content "$InstallDir\.env") -replace 'DATABASE_URL=.*', "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tdrive" | Set-Content "$InstallDir\.env"
    (Get-Content "$InstallDir\.env") -replace 'API_PORT=.*', "API_PORT=$ApiPort" | Set-Content "$InstallDir\.env"
    (Get-Content "$InstallDir\.env") -replace 'CORS_ORIGIN=.*', "CORS_ORIGIN=http://localhost:$WebPort" | Set-Content "$InstallDir\.env"
    
    Write-Host "  .env created with random secrets."
} else {
    Write-Host "  .env already exists, skipping."
}

# 5. Install dependencies and build
Write-Host "`n[5/7] Installing dependencies and building..."
Set-Location $InstallDir
bun install

# Run database migrations
Set-Location "$InstallDir\apps\api"
bun run db:push 2>$null

# Build web
Set-Location "$InstallDir\apps\web"
bun run build 2>$null

# 6. Create PM2 startup script
Write-Host "`n[6/7] Starting services with PM2..."
Set-Location $InstallDir
pm2 start ecosystem.config.cjs
pm2 save

# Register PM2 on startup (using pm2-windows-startup or startup hook)
$pm2Startup = pm2 startup 2>&1
Write-Host "  PM2 startup: $pm2Startup"

# 7. Create shortcut
Write-Host "`n[7/7] Creating desktop shortcut..."
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\TDrive.lnk")
$Shortcut.TargetPath = "http://localhost:$WebPort"
$Shortcut.Description = "TDrive Cloud Storage"
$Shortcut.Save()

Write-Host "`n✅ TDrive deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Services:"
Write-Host "  API:  http://localhost:$ApiPort" -ForegroundColor Yellow
Write-Host "  Web:  http://localhost:$WebPort" -ForegroundColor Yellow
Write-Host ""
Write-Host "Manage:"
Write-Host "  pm2 list              # View processes"
Write-Host "  pm2 logs tdrive-api   # API logs"
Write-Host "  pm2 restart all       # Restart all"
Write-Host "  pm2 stop all          # Stop all"
Write-Host ""
Write-Host "Laragon Users:"
Write-Host "  Add vhost: tdrive.localhost → $InstallDir\apps\web\out"
Write-Host "  Or use: http://localhost:$WebPort"
