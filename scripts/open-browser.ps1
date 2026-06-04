param(
    [string]$Url = 'http://localhost:5180/home'
)

$ErrorActionPreference = 'SilentlyContinue'
try {
    Start-Process $Url | Out-Null
    exit 0
} catch {
    cmd /c start "" $Url
    exit $LASTEXITCODE
}
