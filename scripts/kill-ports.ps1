param([int[]]$Ports = @(8000, 5180, 5181, 5182))

function Stop-HanaLitePythonWorkers {
    Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $cmd = $_.CommandLine
            $cmd -and (
                $cmd -match 'spawn_main' -or
                $cmd -match 'uvicorn' -or
                $cmd -match 'app\.main:app' -or
                $cmd -match 'vite(\.cmd)?"' -or
                $cmd -match 'hanalite'
            )
        } |
        ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
}

foreach ($port in $Ports) {
    $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

Stop-HanaLitePythonWorkers
