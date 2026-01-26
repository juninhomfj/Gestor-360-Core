#!/bin/bash

# Performance Testing Script
# Testa performance do build com múltiplas métricas

echo "=== GESTOR-360 PERFORMANCE TEST REPORT ==="
echo ""
echo "Timestamp: $(date)"
echo "Branch: $(git branch --show-current)"
echo "Commit: $(git rev-parse --short HEAD)"
echo ""

echo "=== BUILD METRICS ==="
echo ""

# Build 1 - Timing
echo "Build Time:"
time npm run build > /dev/null 2>&1

echo ""
echo "=== BUNDLE ANALYSIS ==="
echo ""

# Bundle sizes
echo "Main Bundle:"
ls -lh dist/assets/index-*.js | awk '{printf "  %s: %s\n", $NF, $5}'

echo ""
echo "Chunk Sizes:"
du -sh dist/assets/*.js | sort -rn | head -10

echo ""
echo "=== GZIP COMPRESSION ==="
echo ""

# Gzip sizes
npm run build 2>&1 | grep "│ gzip:" | head -10

echo ""
echo "=== MODULE COUNT ==="

# Count modules
echo "Total modules transformed:"
npm run build 2>&1 | grep "modules transformed"

echo ""
echo "=== WARNINGS ==="

# Check warnings
WARNINGS=$(npm run build 2>&1 | grep -c "^(.!)")
echo "Build warnings: $WARNINGS"

echo ""
echo "=== TEST COMPLETE ==="
