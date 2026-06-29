$ErrorActionPreference = "Stop"

function Show-Menu {
    Clear-Host
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "  CivicPulse Cloud & Tunnel Management  " -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. [Suspend] Stop Cloud Run Traffic & Scale to 0 (Saves Credits)" -ForegroundColor Yellow
    Write-Host "2. [Resume] Allow Cloud Run Traffic & Disable CPU Throttling" -ForegroundColor Green
    Write-Host "3. Start Local Cloudflare Tunnel" -ForegroundColor Blue
    Write-Host "4. Stop Local Cloudflare Tunnel" -ForegroundColor Red
    Write-Host "5. Exit"
    Write-Host ""
}

while ($true) {
    Show-Menu
    $choice = Read-Host "Select an option (1-5)"

    switch ($choice) {
        "1" {
            Write-Host "`n[*] Suspending Cloud Run service..." -ForegroundColor Cyan
            # Remove allUsers invoker role to block external traffic
            gcloud run services remove-iam-policy-binding civicpulse `
                --region=asia-south1 `
                --member="allUsers" `
                --role="roles/run.invoker" `
                --quiet
            # Enable CPU throttling so it immediately sleeps when not actively serving
            gcloud run services update civicpulse --region=asia-south1 --cpu-throttling --quiet
            Write-Host "[+] Cloud Run suspended. Traffic blocked and instances will scale to 0." -ForegroundColor Green
            Start-Sleep -Seconds 3
        }
        "2" {
            Write-Host "`n[*] Resuming Cloud Run service..." -ForegroundColor Cyan
            # Allow allUsers invoker role to serve web traffic
            gcloud run services add-iam-policy-binding civicpulse `
                --region=asia-south1 `
                --member="allUsers" `
                --role="roles/run.invoker" `
                --quiet
            # Disable CPU throttling so background LangGraph pipelines work properly
            gcloud run services update civicpulse --region=asia-south1 --no-cpu-throttling --quiet
            Write-Host "[+] Cloud Run resumed. Traffic allowed and CPU allocated." -ForegroundColor Green
            Start-Sleep -Seconds 3
        }
        "3" {
            Write-Host "`n[*] Killing any existing cloudflared processes..." -ForegroundColor Yellow
            Stop-Process -Name "cloudflared" -ErrorAction SilentlyContinue
            
            Write-Host "[*] Starting Cloudflare Quick Tunnel in the background..." -ForegroundColor Cyan
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
                Start-Sleep -Seconds 3
                continue
            }
            
            $newApiUrl = "$tunnelUrl/v1"
            Write-Host "[+] Tunnel established! URL: $newApiUrl" -ForegroundColor Green
            
            Write-Host "[*] Updating .env.production..." -ForegroundColor Cyan
            $envPath = ".env.production"
            if (Test-Path $envPath) {
                $envContent = Get-Content $envPath -Raw
                $envContent = $envContent -replace "OLLAMA_BASE_URL=.*", "OLLAMA_BASE_URL=$newApiUrl"
                $envContent = $envContent -replace "OLLAMA_LOCAL_BASE_URL=.*", "OLLAMA_LOCAL_BASE_URL=$newApiUrl"
                Set-Content -Path $envPath -Value $envContent
                Write-Host "[+] .env.production updated successfully." -ForegroundColor Green
            } else {
                Write-Host "[-] .env.production not found. Skipping." -ForegroundColor Yellow
            }
            
            Write-Host "[*] Pushing new URL to GitHub Secrets..." -ForegroundColor Cyan
            if (Get-Command gh -ErrorAction SilentlyContinue) {
                Get-Content .env.production -Raw | gh secret set ENV_PRODUCTION
                Write-Host "[+] GitHub Secrets updated." -ForegroundColor Green
            } else {
                Write-Host "[-] GitHub CLI (gh) not found. Skipping." -ForegroundColor Yellow
            }
            
            Write-Host "[*] Updating Cloud Run service environment variables..." -ForegroundColor Cyan
            gcloud run services update civicpulse --region asia-south1 --update-env-vars="OLLAMA_BASE_URL=$newApiUrl,OLLAMA_LOCAL_BASE_URL=$newApiUrl" --quiet
            Write-Host "[+] Cloud Run environment updated successfully!" -ForegroundColor Green
            
            Write-Host "[*] IMPORTANT: You MUST keep this terminal open or the background process running to maintain the tunnel!" -ForegroundColor Yellow
            Start-Sleep -Seconds 4
        }
        "4" {
            Write-Host "`n[*] Stopping cloudflared processes..." -ForegroundColor Cyan
            Stop-Process -Name "cloudflared" -ErrorAction SilentlyContinue
            Write-Host "[+] Local tunnel stopped." -ForegroundColor Green
            Start-Sleep -Seconds 2
        }
        "5" {
            Write-Host "`nExiting..."
            exit 0
        }
        default {
            Write-Host "`n[!] Invalid choice. Please select 1-5." -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
}
