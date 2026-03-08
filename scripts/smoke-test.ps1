param(
  [int]$Port = 4100,
  [string]$CronSecret = "abcdefghijklmnopqrstuvwxyz123456",
  [switch]$CheckRateLimit,
  [switch]$ResetRateLimit
)

$ErrorActionPreference = "Stop"

$env:Path = "C:\Program Files\nodejs;$env:Path"
$env:CRON_SECRET = $CronSecret

$projectRoot = (Resolve-Path "$PSScriptRoot\..").Path
$npmBin = "C:\Program Files\nodejs\npm.cmd"
$baseUrl = "http://127.0.0.1:$Port"
$stdoutPath = Join-Path $projectRoot ".smoke-next-stdout.log"
$stderrPath = Join-Path $projectRoot ".smoke-next-stderr.log"
$reportPath = Join-Path $projectRoot ".smoke-report.json"
$rateLimitPath = Join-Path $projectRoot ".clubhouse-cache\\rate-limit-buckets.json"

if ($ResetRateLimit -and (Test-Path $rateLimitPath)) {
  Remove-Item -Path $rateLimitPath -Force
}

function Invoke-Probe {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers
  )

  try {
    $response = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -MaximumRedirection 0 -ErrorAction Stop
    $body = ($response.Content | Out-String).Trim()
    $bodyPreview = if ($body.Length -gt 220) { $body.Substring(0, 220) } else { $body }
    return [pscustomobject]@{
      Url = $Url
      Status = $response.StatusCode
      CacheControl = $response.Headers["Cache-Control"]
      HasCsp = [bool]$response.Headers["Content-Security-Policy"]
      XFrame = $response.Headers["X-Frame-Options"]
      Hsts = $response.Headers["Strict-Transport-Security"]
      BodyPreview = $bodyPreview
    }
  } catch {
    $errorResponse = $_.Exception.Response
    if ($null -eq $errorResponse) {
      throw
    }

    $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
    $body = $reader.ReadToEnd()
    $reader.Close()
    $bodyPreview = if ($body.Length -gt 220) { $body.Substring(0, 220) } else { $body }

    return [pscustomobject]@{
      Url = $Url
      Status = [int]$errorResponse.StatusCode
      CacheControl = $errorResponse.Headers["Cache-Control"]
      HasCsp = [bool]$errorResponse.Headers["Content-Security-Policy"]
      XFrame = $errorResponse.Headers["X-Frame-Options"]
      Hsts = $errorResponse.Headers["Strict-Transport-Security"]
      BodyPreview = $bodyPreview.Trim()
    }
  }
}

$process = Start-Process `
  -FilePath $npmBin `
  -ArgumentList "run", "start", "--", "-p", "$Port" `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -PassThru

function Wait-ForServer {
  param([int]$TimeoutSeconds = 45)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if ($process.HasExited) {
      $stderr = ""
      if (Test-Path $stderrPath) {
        $stderr = Get-Content -Path $stderrPath -Raw
      }

      throw "Next.js server exited before becoming ready. stderr: $stderr"
    }

    try {
      $probe = Invoke-WebRequest -Method GET -Uri "$baseUrl/" -MaximumRedirection 0 -ErrorAction Stop
      if ($probe.StatusCode -ge 200) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "Timed out waiting for Next.js server on $baseUrl."
}

try {
  Wait-ForServer

  $probes = @(
    (Invoke-Probe -Method "GET" -Url "$baseUrl/" -Headers @{}),
    (Invoke-Probe -Method "GET" -Url "$baseUrl/sign-in" -Headers @{}),
    (Invoke-Probe -Method "GET" -Url "$baseUrl/today" -Headers @{}),
    (Invoke-Probe -Method "GET" -Url "$baseUrl/leaderboards" -Headers @{}),
    (Invoke-Probe -Method "GET" -Url "$baseUrl/admin" -Headers @{}),
    (Invoke-Probe -Method "GET" -Url "$baseUrl/api/cron/odds-sync" -Headers @{}),
    (Invoke-Probe -Method "GET" -Url "$baseUrl/api/cron/odds-sync" -Headers @{ Authorization = "Bearer wrongtokenwrongtokenwrongtoken12" }),
    (Invoke-Probe -Method "GET" -Url "$baseUrl/api/cron/odds-sync" -Headers @{ Authorization = "Bearer $CronSecret" }),
    (Invoke-Probe -Method "GET" -Url "$baseUrl/api/cron/settle" -Headers @{ Authorization = "Bearer $CronSecret" }),
    (Invoke-Probe -Method "GET" -Url "$baseUrl/api/cron/ai-hourly" -Headers @{}),
    (Invoke-Probe -Method "GET" -Url "$baseUrl/api/cron/ai-hourly" -Headers @{ Authorization = "Bearer $CronSecret" }),
    (Invoke-Probe -Method "GET" -Url "$baseUrl/api/cron/ai-nightly" -Headers @{ Authorization = "Bearer $CronSecret" })
  )

  if ($CheckRateLimit) {
    $statuses = @()
    for ($i = 0; $i -lt 26; $i++) {
      $probe = Invoke-Probe -Method "GET" -Url "$baseUrl/api/cron/odds-sync" -Headers @{ Authorization = "Bearer $CronSecret" }
      $statuses += $probe.Status
    }

    $statusCounts = $statuses | Group-Object | Sort-Object Name | ForEach-Object {
      [pscustomobject]@{
        Status = [int]$_.Name
        Count = $_.Count
      }
    }

    $probes += [pscustomobject]@{
      Url = "$baseUrl/api/cron/odds-sync (burst x26)"
      Status = 0
      CacheControl = $null
      HasCsp = $true
      XFrame = "DENY"
      Hsts = "max-age=63072000; includeSubDomains; preload"
      BodyPreview = ($statusCounts | ConvertTo-Json -Depth 3)
    }
  }

  $reportJson = $probes | ConvertTo-Json -Depth 4
  Set-Content -Path $reportPath -Value $reportJson -Encoding UTF8
  Write-Output $reportJson
} finally {
  if ($process -and !$process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
