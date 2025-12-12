#!/bin/bash

# Install text similarity dependencies
echo "Installing text similarity dependencies..."

cd "$(dirname "$0")"

npm install --save string-similarity@^4.0.4 fastest-levenshtein@^1.0.16 natural@^6.12.0
npm install --save-dev @types/string-similarity@^4.0.2

echo "Dependencies installed successfully!"
echo ""
echo "You can now run tests with:"
echo "  npm test -- text-similarity.util.spec.ts"
echo ""
echo "Or run with coverage:"
echo "  npm run test:cov -- text-similarity.util.spec.ts"
