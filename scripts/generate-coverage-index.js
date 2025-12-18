#!/usr/bin/env node

/**
 * Generates a root coverage index page that matches vitest coverage report styling
 * and shows package-level coverage summaries with progress bars.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  readdirSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/**
 * Auto-discover packages with coverage reports
 */
function discoverPackages() {
  const packagesDir = resolve(root, 'packages');
  const entries = readdirSync(packagesDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) =>
      existsSync(resolve(packagesDir, entry.name, 'coverage', 'index.html'))
    )
    .map((entry) => {
      const pkgJsonPath = resolve(packagesDir, entry.name, 'package.json');
      let label = entry.name;
      if (existsSync(pkgJsonPath)) {
        try {
          const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
          label = pkgJson.name || entry.name;
        } catch {
          // Use folder name if package.json can't be read
        }
      }
      return { name: entry.name, label };
    })
    .sort((a, b) => {
      // Main package (universal-data-layer without @ prefix) always first, then alphabetically by label
      const aIsMain = a.label === 'universal-data-layer';
      const bIsMain = b.label === 'universal-data-layer';
      if (aIsMain) return -1;
      if (bIsMain) return 1;
      return a.label.localeCompare(b.label);
    });
}

const packages = discoverPackages();

/**
 * Parse coverage stats from the HTML report
 */
function parseCoverageFromHtml(html) {
  const stats = {};

  // Match patterns like: <span class="strong">100% </span>\n<span class="quiet">Statements</span>\n<span class='fraction'>3686/3686</span>
  const patterns = [
    {
      key: 'statements',
      regex:
        /<span class="strong">([0-9.]+)%\s*<\/span>\s*<span class="quiet">Statements<\/span>\s*<span class='fraction'>([0-9]+)\/([0-9]+)<\/span>/s,
    },
    {
      key: 'branches',
      regex:
        /<span class="strong">([0-9.]+)%\s*<\/span>\s*<span class="quiet">Branches<\/span>\s*<span class='fraction'>([0-9]+)\/([0-9]+)<\/span>/s,
    },
    {
      key: 'functions',
      regex:
        /<span class="strong">([0-9.]+)%\s*<\/span>\s*<span class="quiet">Functions<\/span>\s*<span class='fraction'>([0-9]+)\/([0-9]+)<\/span>/s,
    },
    {
      key: 'lines',
      regex:
        /<span class="strong">([0-9.]+)%\s*<\/span>\s*<span class="quiet">Lines<\/span>\s*<span class='fraction'>([0-9]+)\/([0-9]+)<\/span>/s,
    },
  ];

  for (const { key, regex } of patterns) {
    const match = html.match(regex);
    if (match) {
      stats[key] = {
        pct: parseFloat(match[1]),
        covered: parseInt(match[2], 10),
        total: parseInt(match[3], 10),
      };
    }
  }

  return stats;
}

function getCoverageClass(pct) {
  if (pct >= 80) return 'high';
  if (pct >= 50) return 'medium';
  return 'low';
}

function generateHtml(packagesData) {
  const rows = packagesData
    .map(({ name, label, stats, exists }) => {
      if (!exists) {
        return `<tr>
  <td class="file empty" data-value="${label}"><a href="../packages/${name}/coverage/index.html">${label}</a></td>
  <td class="pic empty" colspan="9">No coverage report</td>
</tr>`;
      }

      const stmtClass = getCoverageClass(stats.statements?.pct || 0);
      const branchClass = getCoverageClass(stats.branches?.pct || 0);
      const funcClass = getCoverageClass(stats.functions?.pct || 0);
      const lineClass = getCoverageClass(stats.lines?.pct || 0);

      return `<tr>
  <td class="file ${stmtClass}" data-value="${label}"><a href="../packages/${name}/coverage/index.html">${label}</a></td>
  <td data-value="${stats.statements?.pct || 0}" class="pic ${stmtClass}">
    <div class="chart"><div class="cover-fill${stats.statements?.pct === 100 ? ' cover-full' : ''}" style="width: ${stats.statements?.pct || 0}%"></div><div class="cover-empty" style="width: ${100 - (stats.statements?.pct || 0)}%"></div></div>
  </td>
  <td data-value="${stats.statements?.pct || 0}" class="pct ${stmtClass}">${stats.statements?.pct || 0}%</td>
  <td data-value="${stats.statements?.total || 0}" class="abs ${stmtClass}">${stats.statements?.covered || 0}/${stats.statements?.total || 0}</td>
  <td data-value="${stats.branches?.pct || 0}" class="pct ${branchClass}">${stats.branches?.pct || 0}%</td>
  <td data-value="${stats.branches?.total || 0}" class="abs ${branchClass}">${stats.branches?.covered || 0}/${stats.branches?.total || 0}</td>
  <td data-value="${stats.functions?.pct || 0}" class="pct ${funcClass}">${stats.functions?.pct || 0}%</td>
  <td data-value="${stats.functions?.total || 0}" class="abs ${funcClass}">${stats.functions?.covered || 0}/${stats.functions?.total || 0}</td>
  <td data-value="${stats.lines?.pct || 0}" class="pct ${lineClass}">${stats.lines?.pct || 0}%</td>
  <td data-value="${stats.lines?.total || 0}" class="abs ${lineClass}">${stats.lines?.covered || 0}/${stats.lines?.total || 0}</td>
</tr>`;
    })
    .join('\n');

  // Calculate totals
  const totals = {
    statements: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
    lines: { covered: 0, total: 0 },
  };

  for (const pkg of packagesData) {
    if (pkg.exists && pkg.stats) {
      for (const key of ['statements', 'branches', 'functions', 'lines']) {
        if (pkg.stats[key]) {
          totals[key].covered += pkg.stats[key].covered;
          totals[key].total += pkg.stats[key].total;
        }
      }
    }
  }

  for (const key of ['statements', 'branches', 'functions', 'lines']) {
    totals[key].pct =
      totals[key].total > 0
        ? Math.round((totals[key].covered / totals[key].total) * 100 * 100) /
          100
        : 0;
  }

  return `<!doctype html>
<html lang="en">
<head>
    <title>Coverage Report - Universal Data Layer</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="base.css" />
    <link rel="shortcut icon" type="image/x-icon" href="favicon.png" />
</head>
<body>
<div class='wrapper'>
    <div class='pad1'>
        <h1>All packages</h1>
        <div class='clearfix'>
            <div class='fl pad1y space-right2'>
                <span class="strong">${totals.statements.pct}% </span>
                <span class="quiet">Statements</span>
                <span class='fraction'>${totals.statements.covered}/${totals.statements.total}</span>
            </div>
            <div class='fl pad1y space-right2'>
                <span class="strong">${totals.branches.pct}% </span>
                <span class="quiet">Branches</span>
                <span class='fraction'>${totals.branches.covered}/${totals.branches.total}</span>
            </div>
            <div class='fl pad1y space-right2'>
                <span class="strong">${totals.functions.pct}% </span>
                <span class="quiet">Functions</span>
                <span class='fraction'>${totals.functions.covered}/${totals.functions.total}</span>
            </div>
            <div class='fl pad1y space-right2'>
                <span class="strong">${totals.lines.pct}% </span>
                <span class="quiet">Lines</span>
                <span class='fraction'>${totals.lines.covered}/${totals.lines.total}</span>
            </div>
        </div>
    </div>
    <div class='status-line ${getCoverageClass(totals.statements.pct)}'></div>
    <div class="pad1">
        <table class="coverage-summary">
            <thead>
                <tr>
                    <th data-col="file" data-fmt="html" data-html="true" class="file">Package</th>
                    <th data-col="pic" data-type="number" data-fmt="html" data-html="true" class="pic"></th>
                    <th data-col="statements" data-type="number" data-fmt="pct" class="pct">Statements</th>
                    <th data-col="statements_raw" data-type="number" data-fmt="html" class="abs"></th>
                    <th data-col="branches" data-type="number" data-fmt="pct" class="pct">Branches</th>
                    <th data-col="branches_raw" data-type="number" data-fmt="html" class="abs"></th>
                    <th data-col="functions" data-type="number" data-fmt="pct" class="pct">Functions</th>
                    <th data-col="functions_raw" data-type="number" data-fmt="html" class="abs"></th>
                    <th data-col="lines" data-type="number" data-fmt="pct" class="pct">Lines</th>
                    <th data-col="lines_raw" data-type="number" data-fmt="html" class="abs"></th>
                </tr>
            </thead>
            <tbody>
${rows}
            </tbody>
        </table>
    </div>
</div>
<div class='footer quiet pad2 space-top1 center small'>
    Code coverage generated by <a href="https://vitest.dev" target="_blank" rel="noopener noreferrer">vitest</a>
</div>
</body>
</html>`;
}

// Collect coverage data from all packages
const packagesData = [];

for (const pkg of packages) {
  const indexPath = resolve(
    root,
    'packages',
    pkg.name,
    'coverage',
    'index.html'
  );
  const exists = existsSync(indexPath);

  if (exists) {
    const html = readFileSync(indexPath, 'utf-8');
    const stats = parseCoverageFromHtml(html);
    packagesData.push({ ...pkg, exists: true, stats });
    console.log(`✅ Parsed coverage for ${pkg.name}`);
  } else {
    packagesData.push({ ...pkg, exists: false, stats: null });
    console.log(`⏭️  Skipping ${pkg.name} (no coverage report)`);
  }
}

// Copy static assets from first available package
const firstPkgWithCoverage = packages.find((pkg) =>
  existsSync(resolve(root, 'packages', pkg.name, 'coverage', 'base.css'))
);

if (firstPkgWithCoverage) {
  const srcDir = resolve(
    root,
    'packages',
    firstPkgWithCoverage.name,
    'coverage'
  );
  const destDir = resolve(root, 'coverage');

  for (const file of ['base.css', 'favicon.png']) {
    const src = resolve(srcDir, file);
    const dest = resolve(destDir, file);
    if (existsSync(src)) {
      copyFileSync(src, dest);
    }
  }
  console.log('📦 Copied static assets');
}

// Generate and write the index HTML
const html = generateHtml(packagesData);
const outputPath = resolve(root, 'coverage', 'index.html');
writeFileSync(outputPath, html);
console.log(`\n✨ Generated ${outputPath}`);
