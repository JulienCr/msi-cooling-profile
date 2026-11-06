<#
.SYNOPSIS
Switches the MSI Center "Cooling Wizard" fan profile by replaying the UI's command to MSI.CentralServer.
.PARAMETER Profile
Profile number as shown in the MSI Center UI (1..5).
.NOTES
Reverse-engineered on MSI Center 2.0.75 (MAG Z790 TOMAHAWK WIFI); an MSI Center update may change the frame.
Exit codes: 0 = switched, 1 = unexpected reply, 2 = MSI Center UI (DCv2) not running.
#>
param([Parameter(Mandatory)][ValidateRange(1, 5)][int]$Profile)
$ErrorActionPreference = 'Stop'

# CentralServer only relays the switch; DCv2 is the process that loads and applies the fan curves.
if (-not (Get-Process DCv2 -ErrorAction SilentlyContinue)) {
    Write-Error 'MSI Center UI (DCv2.exe) is not running; the profile would be recorded but not applied.'
    exit 2
}

$port = [int](Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\MSI\MSI Center\Component\SDK').'Server Port'
# int32 LE destination 9999 (CentralServer) + CMD_CoolingWizard_ChangeProfile + 0-based index
[byte[]]$frame = @(0x0F, 0x27, 0, 0, 0x05, 0x03, 0x01, 0x08, 0, 0, 0x0A, 0x01, [byte]($Profile - 1))

$client = [System.Net.Sockets.TcpClient]::new()
try {
    $client.Connect('127.0.0.1', $port)
    $stream = $client.GetStream()
    $stream.ReadTimeout = 3000
    $stream.Write($frame, 0, $frame.Length)
    $buf = New-Object byte[] 256
    $n = $stream.Read($buf, 0, $buf.Length)
} finally {
    $client.Close()
}

$reply = if ($n -gt 0) { $buf[0..($n - 1)] } else { @() }
Write-Host ("port={0} profile={1} reply=[{2}]" -f $port, $Profile, (($reply | ForEach-Object { $_.ToString('X2') }) -join ' '))
if ($reply.Count -ge 1 -and $reply[-1] -eq 1) { exit 0 } else { exit 1 }
