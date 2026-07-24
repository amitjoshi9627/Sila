# Generate sila-dashboard.zip for easy copy-paste deployment
# Run: powershell -ExecutionPolicy Bypass -File scripts/zip-it.ps1

$ErrorActionPreference = "Stop"

$Output = "sila-dashboard.zip"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Set-Location $ProjectRoot

# Remove old zip if it exists
if (Test-Path $Output) {
    Remove-Item $Output -Force
}

# Define what to include
$Include = @(
    "src",
    "index.html",
    "package.json",
    "vite.config.ts",
    "tsconfig.json",
    "README.md"
)

# Create temporary directory for staging
$TempDir = Join-Path $env:TEMP "sila-dashboard-staging"
if (Test-Path $TempDir) {
    Remove-Item $TempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $TempDir | Out-Null

# Copy files to staging
foreach ($item in $Include) {
    $source = Join-Path $ProjectRoot $item
    if (Test-Path $source) {
        $dest = Join-Path $TempDir $item
        if (Test-Path $source -PathType Container) {
            Copy-Item $source $dest -Recurse -Exclude @("node_modules", ".git", "dist")
        } else {
            Copy-Item $source $dest
        }
    }
}

# Create zip from staging directory
Compress-Archive -Path "$TempDir/*" -DestinationPath $Output -Force

# Cleanup staging
Remove-Item $TempDir -Recurse -Force

Write-Host ""
Write-Host "✅ Created: $ProjectRoot\$Output" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Copy $Output to your UI folder"
Write-Host "  2. Extract: Expand-Archive $Output -DestinationPath ."
Write-Host "  3. Install dependencies: npm install"
Write-Host "  4. Start dev server: npm run dev"
Write-Host ""
