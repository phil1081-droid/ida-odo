# deploy.ps1 — Ida & Odo auf Strato hochladen
# Aufruf: .\deploy.ps1

$server  = "stu264755216@51530272.ssh.w1.strato.hosting"
$remote  = "~/idaodo"
$local   = "c:\_DEV\ida-odo"
$keyFile = "$env:USERPROFILE\.ssh\strato_key"
$sshArgs = @("-o", "UpdateHostKeys=no", "-i", $keyFile)

Write-Host "Uploading to $server ..." -ForegroundColor Cyan

# 1) Dateien im Wurzelverzeichnis
$rootFiles = @(
    "$local\*.html",
    "$local\*.js",
    "$local\*.css",
    "$local\*.png",
    "$local\*.jpg",
    "$local\*.mp3",
    "$local\*.webmanifest",
    "$local\server.py",
    "$local\.htaccess"
)

foreach ($pattern in $rootFiles) {
    $files = Get-Item $pattern -ErrorAction SilentlyContinue
    if ($files) {
        Write-Host "  -> $pattern"
        scp @sshArgs $files "${server}:${remote}/"
    }
}

# 2) locales/-Unterordner (inkl. .htaccess explizit)
Write-Host "  -> locales/"
scp @sshArgs -r "$local\locales" "${server}:${remote}/"
scp @sshArgs "$local\locales\.htaccess" "${server}:${remote}/locales/.htaccess"

Write-Host ""
Write-Host "Fertig!" -ForegroundColor Green
