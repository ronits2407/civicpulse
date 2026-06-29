$ErrorActionPreference = "Stop"

function Show-Menu {
    Clear-Host
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "  CivicPulse Cloud & Tunnel Management  " -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. [Suspend] Stop Cloud Run Traffic & Scale to 0 (Saves Credits)" -ForegroundColor Yellow
    Write-Host "2. [Resume] Allow Cloud Run Traffic & Disable CPU Throttling" -ForegroundColor Green
    Write-Host "3. Stop Local Cloudflare Tunnel" -ForegroundColor Red
    Write-Host "4. Exit"
    Write-Host ""
}

while ($true) {
    Show-Menu
    $choice = Read-Host "Select an option (1-4)"

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
            Write-Host "`n[*] Stopping cloudflared processes..." -ForegroundColor Cyan
            Stop-Process -Name "cloudflared" -ErrorAction SilentlyContinue
            Write-Host "[+] Local tunnel stopped." -ForegroundColor Green
            Start-Sleep -Seconds 2
        }
        "4" {
            Write-Host "`nExiting..."
            exit 0
        }
        default {
            Write-Host "`n[!] Invalid choice. Please select 1-4." -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
}
