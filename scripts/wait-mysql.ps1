param(
    [string]$HostName = '127.0.0.1',
    [int]$Port = 3306,
    [int]$MaxAttempts = 30,
    [int]$DelaySeconds = 2
)

for ($i = 1; $i -le $MaxAttempts; $i++) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect($HostName, $Port)
        exit 0
    } catch {
        if ($i -ge $MaxAttempts) {
            Write-Host "MySQL did not respond on ${HostName}:${Port} after $MaxAttempts attempts."
            exit 1
        }
        Start-Sleep -Seconds $DelaySeconds
    } finally {
        if ($client.Connected) {
            $client.Close()
        }
        $client.Dispose()
    }
}
