[CmdletBinding()]
param(
    [string]$ReleaseDirectory,
    [string]$OutputDirectory,
    [string]$Architecture = 'x64'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-Md5Hex {
    param([Parameter(Mandatory = $true)][string]$Path)

    $stream = [System.IO.File]::OpenRead($Path)
    $md5 = [System.Security.Cryptography.MD5]::Create()
    try {
        $bytes = $md5.ComputeHash($stream)
        return [System.BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $md5.Dispose()
        $stream.Dispose()
    }
}

if ([string]::IsNullOrWhiteSpace($ReleaseDirectory)) {
    $ReleaseDirectory = Join-Path $PSScriptRoot '..\src-tauri\target\release'
}
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $PSScriptRoot '..\release-artifacts'
}

$appDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$repositoryDirectory = [System.IO.Path]::GetFullPath((Join-Path $appDirectory '..'))
$releaseDirectoryPath = [System.IO.Path]::GetFullPath($ReleaseDirectory)
$outputDirectoryPath = [System.IO.Path]::GetFullPath($OutputDirectory)

$packageJson = Get-Content -LiteralPath (Join-Path $appDirectory 'package.json') -Raw | ConvertFrom-Json
$version = [string]$packageJson.version
if ([string]::IsNullOrWhiteSpace($version)) {
    throw 'Unable to read the application version from package.json.'
}

$binaryPath = Join-Path $releaseDirectoryPath 'Notademics.exe'
$resourcesPath = Join-Path $releaseDirectoryPath 'resources'
$msiDirectory = Join-Path $releaseDirectoryPath 'bundle\msi'
$msiCandidates = @(
    Get-ChildItem -LiteralPath $msiDirectory -Filter '*.msi' -File -Recurse -ErrorAction SilentlyContinue
)

if ($msiCandidates.Count -ne 1) {
    $candidateNames = ($msiCandidates | ForEach-Object FullName) -join ', '
    throw "Expected exactly one MSI under $msiDirectory, found $($msiCandidates.Count): $candidateNames"
}

$installerName = "Notademics_${version}_${Architecture}.msi"
$installerPath = $msiCandidates[0].FullName

foreach ($requiredPath in @($binaryPath, $resourcesPath, $installerPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required release artifact does not exist: $requiredPath"
    }
}

New-Item -ItemType Directory -Path $outputDirectoryPath -Force | Out-Null

$portableName = "Notademics_${version}_${Architecture}-portable"
$portableDirectory = Join-Path $outputDirectoryPath $portableName
$portableZipPath = Join-Path $outputDirectoryPath "$portableName.zip"
$outputInstallerPath = Join-Path $outputDirectoryPath $installerName
$sourceName = "Notademics_${version}_source.zip"
$sourceZipPath = Join-Path $outputDirectoryPath $sourceName

# Only remove the exact staging directory created by this script, after proving
# that it is a child of the requested output directory.
$expectedPrefix = $outputDirectoryPath.TrimEnd('\') + '\'
$portableDirectoryPath = [System.IO.Path]::GetFullPath($portableDirectory)
if (-not $portableDirectoryPath.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe portable staging path: $portableDirectoryPath"
}
if (Test-Path -LiteralPath $portableDirectoryPath) {
    Remove-Item -LiteralPath $portableDirectoryPath -Recurse -Force
}

New-Item -ItemType Directory -Path $portableDirectoryPath | Out-Null
Copy-Item -LiteralPath $binaryPath -Destination (Join-Path $portableDirectoryPath 'Notademics.exe')
Copy-Item -LiteralPath $resourcesPath -Destination (Join-Path $portableDirectoryPath 'resources') -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'portable-README.txt') -Destination (Join-Path $portableDirectoryPath 'README.txt')
Copy-Item -LiteralPath (Join-Path $repositoryDirectory 'LICENSE') -Destination (Join-Path $portableDirectoryPath 'LICENSE.txt')
Copy-Item -LiteralPath $installerPath -Destination $outputInstallerPath -Force

if (Test-Path -LiteralPath $portableZipPath) {
    Remove-Item -LiteralPath $portableZipPath -Force
}
Compress-Archive -LiteralPath $portableDirectoryPath -DestinationPath $portableZipPath -CompressionLevel Optimal
Remove-Item -LiteralPath $portableDirectoryPath -Recurse -Force

# Archive the committed app tree, not the working directory. This guarantees
# that dependencies, build caches and repository-level files cannot leak into
# the source package. The archive root is a versioned directory for safe unzip.
if (Test-Path -LiteralPath $sourceZipPath) {
    Remove-Item -LiteralPath $sourceZipPath -Force
}
$sourceRoot = "Notademics_${version}_source"
Push-Location $repositoryDirectory
try {
    & git archive --format=zip "--prefix=$sourceRoot/" "--output=$sourceZipPath" HEAD:app
    if ($LASTEXITCODE -ne 0) {
        throw 'git archive failed while creating the app-only source package.'
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $sourceZipPath)) {
    throw "Source archive was not created: $sourceZipPath"
}

$releaseArtifacts = @($outputInstallerPath, $portableZipPath)
foreach ($artifactPath in $releaseArtifacts) {
    $artifact = Get-Item -LiteralPath $artifactPath
    if ($artifact.Length -eq 0) {
        throw "Release artifact is empty: $($artifact.Name)"
    }
    $hash = Get-Md5Hex -Path $artifact.FullName
    $checksumPath = "$($artifact.FullName).md5"
    Set-Content -LiteralPath $checksumPath -Value "$hash *$($artifact.Name)" -Encoding ascii

    $verifiedHash = Get-Md5Hex -Path $artifact.FullName
    if ($verifiedHash -ne $hash) {
        throw "MD5 verification failed for $($artifact.Name)."
    }
}

if ((Get-Item -LiteralPath $sourceZipPath).Length -eq 0) {
    throw "Release artifact is empty: $sourceName"
}

Get-ChildItem -LiteralPath $outputDirectoryPath -File |
    Where-Object { $_.Name -in @($installerName, "$installerName.md5", "$portableName.zip", "$portableName.zip.md5", $sourceName) } |
    Sort-Object Name |
    Select-Object Name, Length
