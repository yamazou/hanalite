# Run as Administrator
$ErrorActionPreference = 'Stop'

$iniPath = 'C:\xampp82\xampp-control.ini'
$propsPath = 'C:\xampp82\properties.ini'

$iniContent = @'
[Common]
Edition=
Editor=notepad.exe
Browser=
Debug=0
Debuglevel=0
TomcatVisible=1
Language=en
[EnableModules]
Apache=1
MySQL=1
FileZilla=1
Mercury=1
Tomcat=1

[ServicePorts]
Apache=8080
ApacheSSL=443
MySQL=3306
FileZilla=21
FileZillaAdmin=14147
Mercury1=25
Mercury2=79
Mercury3=105
Mercury4=106
Mercury5=110
Mercury6=143
Mercury7=2224
TomcatHTTP=8080
TomcatAJP=8009
Tomcat=8005
'@

Write-Host 'Updating XAMPP Control Panel settings for phpMyAdmin Admin button...'

Set-Content -Path $iniPath -Value $iniContent -Encoding ASCII

if (Test-Path $propsPath) {
    (Get-Content $propsPath) -replace 'apache_server_port=80', 'apache_server_port=8080' |
        Set-Content $propsPath -Encoding ASCII
}

Write-Host ''
Write-Host 'Done.'
Write-Host 'Restart XAMPP Control Panel, then click MySQL Admin.'
Write-Host 'It should open: http://localhost:8080/phpmyadmin/'
