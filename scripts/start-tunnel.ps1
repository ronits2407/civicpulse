$ErrorActionPreference = "Stop"

Write-Host "[*] Killing any existing cloudflared processes..." -ForegroundColor Yellow
Stop-Process -Name "cloudflared" -ErrorAction SilentlyContinue

Write-Host "[*] Starting Cloudflare Quick Tunnel in the background..." -ForegroundColor Cyan
# Start cloudflared in the background and redirect output to a log file
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c cloudflared tunnel --url http://localhost:11434 > cloudflared.log 2>&1"

Write-Host "[*] Waiting for Cloudflare to assign a URL..." -ForegroundColor Yellow

$tunnelUrl = $null
$maxRetries = 15
$retryCount = 0

while ($null -eq $tunnelUrl -and $retryCount -lt $maxRetries) {
    Start-Sleep -Seconds 2
    if (Test-Path "cloudflared.log") {
        $logContent = Get-Content "cloudflared.log" -Raw
        if ($logContent -match "(https://[a-zA-Z0-9-]+\.trycloudflare\.com)") {
            $tunnelUrl = $matches[1]
        }
    }
    $retryCount++
}

if ($null -eq $tunnelUrl) {
    Write-Host "[x] Failed to retrieve Cloudflare URL. Please check cloudflared.log" -ForegroundColor Red
    exit 1
}

$newApiUrl = "$tunnelUrl/v1"
Write-Host "[+] Tunnel established! URL: $newApiUrl" -ForegroundColor Green

Write-Host "[*] Updating .env.production..." -ForegroundColor Cyan
$envPath = ".env.production"
$envContent = Get-Content $envPath -Raw

# Replace the URLs using regex
$envContent = $envContent -replace "OLLAMA_BASE_URL=.*", "OLLAMA_BASE_URL=$newApiUrl"
$envContent = $envContent -replace "OLLAMA_LOCAL_BASE_URL=.*", "OLLAMA_LOCAL_BASE_URL=$newApiUrl"

Set-Content -Path $envPath -Value $envContent
Write-Host "[+] .env.production updated successfully." -ForegroundColor Green

Write-Host "[*] Pushing new URL to GitHub Secrets..." -ForegroundColor Cyan
Get-Content .env.production -Raw | gh secret set ENV_PRODUCTION
Write-Host "[+] GitHub Secrets updated." -ForegroundColor Green

Write-Host "[*] Triggering automatic CI/CD deployment on 'prod' branch..." -ForegroundColor Cyan
git checkout prod
git commit --allow-empty -m "deploy: auto-update cloudflare tunnel URL"
git push origin prod
git checkout dev

Write-Host "[+] All done! The deployment pipeline is running on GitHub." -ForegroundColor Green
Write-Host "Keep this terminal open, or leave the background process running to maintain the tunnel!" -ForegroundColor Yellow
