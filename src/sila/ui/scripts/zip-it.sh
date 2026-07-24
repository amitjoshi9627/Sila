#!/bin/bash
# Generate sila-dashboard.zip for easy copy-paste deployment
# Run: chmod +x scripts/zip-it.sh && ./scripts/zip-it.sh

set -e

OUTPUT="sila-dashboard.zip"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_ROOT"

# Remove old zip if it exists
rm -f "$OUTPUT"

# Create zip excluding node_modules, dist, .git, and this script
zip -r "$OUTPUT" \
  src/ \
  index.html \
  package.json \
  vite.config.ts \
  tsconfig.json \
  README.md \
  -x "node_modules/*" \
  -x "dist/*" \
  -x ".git/*" \
  -x "*.log" \
  -x ".DS_Store" \
  -x "scripts/*"

echo ""
echo "✅ Created: $PROJECT_ROOT/$OUTPUT"
echo ""
echo "Next steps:"
echo "  1. Copy $OUTPUT to your UI folder"
echo "  2. Unzip: unzip $OUTPUT"
echo "  3. Install dependencies: npm install"
echo "  4. Start dev server: npm run dev"
echo ""
