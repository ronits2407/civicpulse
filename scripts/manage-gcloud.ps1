$ErrorActionPreference = "Stop"

function Show-Menu {
    Clear-Host
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "  CivicPulse Cloud & Tunnel Management  " -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. [Full Suspend] Stop Traffic (Remove Visibility) & Enable CPU Throttling" -ForegroundColor Yellow
    Write-Host "2. [Full Resume] Allow Traffic (Restore Visibility) & Disable CPU Throttling" -ForegroundColor Green
    Write-Host "3. [Throttling] Enable CPU Throttling (Bill Saving Mode)" -ForegroundColor Yellow
    Write-Host "4. [Throttling] Disable CPU Throttling (Always On)" -ForegroundColor Green
    Write-Host "5. [Visibility] Make Private (Remove allUsers)" -ForegroundColor Yellow
    Write-Host "6. [Visibility] Make Public (Add allUsers)" -ForegroundColor Green
    Write-Host "7. Start Local Cloudflare Tunnel" -ForegroundColor Blue
    Write-Host "8. Stop Local Cloudflare Tunnel" -ForegroundColor Red
    Write-Host "9. Start Ollama Server (New Window)" -ForegroundColor Magenta
    Write-Host "10. Change AI Provider (Gemini / Ollama)" -ForegroundColor Magenta
    Write-Host "11. Exit"
    Write-Host ""
}

while ($true) {
    Show-Menu
    $choice = Read-Host "Select an option (1-11)"

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
            Write-Host "`n[*] Enabling CPU Throttling..." -ForegroundColor Cyan
            gcloud run services update civicpulse --region=asia-south1 --cpu-throttling --quiet
            Write-Host "[+] CPU Throttling enabled. (Bill Saving Mode)" -ForegroundColor Green
            Start-Sleep -Seconds 3
        }
        "4" {
            Write-Host "`n[*] Disabling CPU Throttling..." -ForegroundColor Cyan
            gcloud run services update civicpulse --region=asia-south1 --no-cpu-throttling --quiet
            Write-Host "[+] CPU Throttling disabled. (Always On)" -ForegroundColor Green
            Start-Sleep -Seconds 3
        }
        "5" {
            Write-Host "`n[*] Making Service Private (Removing allUsers)..." -ForegroundColor Cyan
            gcloud run services remove-iam-policy-binding civicpulse `
                --region=asia-south1 `
                --member="allUsers" `
                --role="roles/run.invoker" `
                --quiet
            Write-Host "[+] Service is now private." -ForegroundColor Green
            Start-Sleep -Seconds 3
        }
        "6" {
            Write-Host "`n[*] Making Service Public (Adding allUsers)..." -ForegroundColor Cyan
            gcloud run services add-iam-policy-binding civicpulse `
                --region=asia-south1 `
                --member="allUsers" `
                --role="roles/run.invoker" `
                --quiet
            Write-Host "[+] Service is now public." -ForegroundColor Green
            Start-Sleep -Seconds 3
        }
        "7" {
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
        "8" {
            Write-Host "`n[*] Stopping cloudflared processes..." -ForegroundColor Cyan
            Stop-Process -Name "cloudflared" -ErrorAction SilentlyContinue
            Write-Host "[+] Local tunnel stopped." -ForegroundColor Green
            Start-Sleep -Seconds 2
        }
        "9" {
            Write-Host "`n[*] Starting Ollama Server in a new window..." -ForegroundColor Cyan
            # Using cmd /k to keep the window open so you can see logs or errors
            Start-Process -FilePath "cmd.exe" -ArgumentList "/k ollama serve"
            Write-Host "[+] Ollama server started." -ForegroundColor Green
            Start-Sleep -Seconds 2
        }
        "10" {
            Write-Host "`n[*] Changing AI Provider..." -ForegroundColor Cyan
            $envPath = ".env.production"
            $currentProvider = "unknown"
            if (Test-Path $envPath) {
                $envContent = Get-Content $envPath -Raw
                if ($envContent -match "AI_PROVIDER=([a-zA-Z0-9_-]+)") {
                    $currentProvider = $Matches[1]
                }
            }
            Write-Host "Current AI Provider is: $currentProvider" -ForegroundColor Yellow
            Write-Host "Select new AI Provider:"
            Write-Host "1. Gemini" -ForegroundColor Green
            Write-Host "2. Ollama" -ForegroundColor Blue
            $providerChoice = Read-Host "Select (1-2)"
            $provider = $null
            if ($providerChoice -eq "1") {
                $provider = "gemini"
            } elseif ($providerChoice -eq "2") {
                $provider = "ollama"
            } else {
                Write-Host "[x] Invalid selection. Cancelling." -ForegroundColor Red
                Start-Sleep -Seconds 2
                continue
            }

            Write-Host "[*] Updating .env.production..." -ForegroundColor Cyan
            if (Test-Path $envPath) {
                $envContent = Get-Content $envPath -Raw
                if ($envContent -match "AI_PROVIDER=") {
                    $envContent = $envContent -replace "AI_PROVIDER=.*", "AI_PROVIDER=$provider"
                } else {
                    $envContent = $envContent + "`nAI_PROVIDER=$provider"
                }
                Set-Content -Path $envPath -Value $envContent
                Write-Host "[+] .env.production updated successfully to AI_PROVIDER=$provider." -ForegroundColor Green
            } else {
                Write-Host "[-] .env.production not found. Skipping local file update." -ForegroundColor Yellow
            }

            Write-Host "[*] Pushing updated environment to GitHub Secrets..." -ForegroundColor Cyan
            if (Test-Path $envPath) {
                if (Get-Command gh -ErrorAction SilentlyContinue) {
                    Get-Content $envPath -Raw | gh secret set ENV_PRODUCTION
                    Write-Host "[+] GitHub Secrets updated." -ForegroundColor Green
                } else {
                    Write-Host "[-] GitHub CLI (gh) not found. Skipping GitHub Secrets update." -ForegroundColor Yellow
                }
            } else {
                Write-Host "[-] .env.production not found. Skipping GitHub Secrets update." -ForegroundColor Yellow
            }

            Write-Host "[*] Updating Cloud Run service environment variables..." -ForegroundColor Cyan
            gcloud run services update civicpulse --region asia-south1 --update-env-vars="AI_PROVIDER=$provider" --quiet
            Write-Host "[+] Cloud Run environment updated successfully!" -ForegroundColor Green

            Start-Sleep -Seconds 3
        }
        "11" {
            Write-Host "`nExiting..."
            exit 0
        }
        default {
            Write-Host "`n[!] Invalid choice. Please select 1-11." -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
}
