#!/usr/bin/env node

/**
 * Injects a navigation bar into each package's coverage report
 * Run this after `npm run test:coverage`
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/**
 * Capitalize words in a string
 */
function capitalize(str) {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Parse package folder name to extract category and label
 * - core → { category: null, label: 'Core' }
 * - plugin-source-contentful → { category: 'Source Plugins', label: 'Contentful' }
 * - plugin-transform-images → { category: 'Transform Plugins', label: 'Images' }
 * - codegen-typed-queries → { category: 'Codegen', label: 'Typed Queries' }
 */
function parsePackageName(folderName) {
  // Core package - standalone
  if (folderName === 'core') {
    return { category: null, label: 'Core', sortOrder: 0 };
  }

  // Plugin packages: plugin-{type}-{name}
  const pluginMatch = folderName.match(/^plugin-([^-]+)-(.+)$/);
  if (pluginMatch) {
    const [, type, name] = pluginMatch;
    return {
      category: `${capitalize(type)} Plugins`,
      label: capitalize(name),
      sortOrder: 1,
    };
  }

  // Codegen packages: codegen-{name}
  const codegenMatch = folderName.match(/^codegen-(.+)$/);
  if (codegenMatch) {
    const [, name] = codegenMatch;
    return {
      category: 'Codegen',
      label: capitalize(name),
      sortOrder: 2,
    };
  }

  // Unknown format - treat as standalone
  return { category: null, label: capitalize(folderName), sortOrder: 3 };
}

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
    .map((entry) => ({
      name: entry.name,
      ...parsePackageName(entry.name),
    }))
    .sort((a, b) => {
      // Sort by sortOrder first, then alphabetically by category, then by label
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      if (a.category !== b.category) {
        if (!a.category) return -1;
        if (!b.category) return 1;
        return a.category.localeCompare(b.category);
      }
      return a.label.localeCompare(b.label);
    });
}

/**
 * Group packages by category
 */
function groupPackages(packages) {
  const groups = new Map();

  for (const pkg of packages) {
    const key = pkg.category || '__standalone__';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(pkg);
  }

  return groups;
}

const packages = discoverPackages();
const groupedPackages = groupPackages(packages);

function getNavHtml(currentPackage, isRoot = false) {
  const getPath = (pkgName) =>
    isRoot
      ? `../packages/${pkgName}/coverage/index.html`
      : `../../${pkgName}/coverage/index.html`;

  let navItems = '';

  // Process each group
  for (const [category, pkgs] of groupedPackages) {
    if (category === '__standalone__') {
      // Standalone items (like Core)
      for (const pkg of pkgs) {
        const isActive = pkg.name === currentPackage;
        if (isActive) {
          navItems += `<span class="udl-nav-item udl-nav-active">${pkg.label}</span>`;
        } else {
          navItems += `<a href="${getPath(pkg.name)}" class="udl-nav-item">${pkg.label}</a>`;
        }
      }
    } else {
      // Dropdown group
      const hasActiveItem = pkgs.some((pkg) => pkg.name === currentPackage);
      const dropdownItems = pkgs
        .map((pkg) => {
          const isActive = pkg.name === currentPackage;
          if (isActive) {
            return `<span class="udl-dropdown-item udl-nav-active">${pkg.label}</span>`;
          }
          return `<a href="${getPath(pkg.name)}" class="udl-dropdown-item">${pkg.label}</a>`;
        })
        .join('');

      navItems += `
      <div class="udl-dropdown${hasActiveItem ? ' udl-has-active' : ''}">
        <span class="udl-dropdown-trigger">${category}</span>
        <div class="udl-dropdown-menu">${dropdownItems}</div>
      </div>`;
    }
  }

  const rootLink = isRoot
    ? '<span class="udl-nav-home udl-nav-active">All Packages</span>'
    : '<a href="../../../coverage/index.html" class="udl-nav-home">All Packages</a>';

  return `
<style>
  .udl-coverage-nav {
    position: sticky;
    top: 0;
    z-index: 9999;
    background: #f8f8f8;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    border-bottom: 1px solid #ddd;
  }
  .udl-nav-home {
    color: #333;
    text-decoration: none;
    font-weight: 600;
    padding-right: 1rem;
    margin-right: 0.5rem;
    border-right: 1px solid #ddd;
  }
  .udl-nav-home:hover { color: #0074D9; }
  .udl-nav-home.udl-nav-active { color: #0074D9; }
  .udl-nav-item {
    color: #555;
    text-decoration: none;
    padding: 0.4rem 0.75rem;
    border-radius: 4px;
  }
  .udl-nav-item:hover { color: #333; background: #e8e8e8; }
  .udl-nav-item.udl-nav-active { color: #0074D9; font-weight: 600; }
  .udl-dropdown {
    position: relative;
  }
  .udl-dropdown-trigger {
    color: #555;
    padding: 0.4rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .udl-dropdown-trigger::after {
    content: '';
    border: 4px solid transparent;
    border-top-color: currentColor;
    margin-top: 2px;
  }
  .udl-dropdown:hover .udl-dropdown-trigger {
    color: #333;
    background: #e8e8e8;
  }
  .udl-has-active .udl-dropdown-trigger { color: #0074D9; font-weight: 600; }
  .udl-dropdown-menu {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 4px;
    min-width: 160px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    padding: 0.5rem 0;
    padding-top: 0.5rem;
  }
  .udl-dropdown::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: 0.5rem;
  }
  .udl-dropdown:hover .udl-dropdown-menu { display: block; }
  .udl-dropdown-item {
    display: block;
    color: #555;
    text-decoration: none;
    padding: 0.5rem 1rem;
    white-space: nowrap;
  }
  .udl-dropdown-item:hover { color: #333; background: #f0f0f0; }
  .udl-dropdown-item.udl-nav-active { color: #0074D9; font-weight: 600; }
</style>
<nav class="udl-coverage-nav">
  ${rootLink}
  ${navItems}
</nav>`;
}

function injectNav(filePath, navHtml) {
  if (!existsSync(filePath)) {
    return false;
  }

  let html = readFileSync(filePath, 'utf-8');

  // Skip if already injected
  if (html.includes('udl-coverage-nav')) {
    return 'skipped';
  }

  // Inject after <body> tag
  html = html.replace(/<body([^>]*)>/, `<body$1>${navHtml}`);
  writeFileSync(filePath, html);
  return 'injected';
}

let injected = 0;
let skipped = 0;

// Inject nav into root coverage index
const rootIndexPath = resolve(root, 'coverage', 'index.html');
const rootResult = injectNav(rootIndexPath, getNavHtml(null, true));
if (rootResult === 'injected') {
  console.log('✅ Injected nav into root index');
  injected++;
} else if (rootResult === 'skipped') {
  console.log('⏭️  Skipping root index (already has nav)');
  skipped++;
}

// Inject nav into package coverage reports
for (const pkg of packages) {
  const indexPath = resolve(
    root,
    'packages',
    pkg.name,
    'coverage',
    'index.html'
  );
  const result = injectNav(indexPath, getNavHtml(pkg.name, false));

  if (result === 'injected') {
    console.log(`✅ Injected nav into ${pkg.name}`);
    injected++;
  } else if (result === 'skipped') {
    console.log(`⏭️  Skipping ${pkg.name} (already has nav)`);
    skipped++;
  } else {
    console.log(`⏭️  Skipping ${pkg.name} (no coverage report)`);
    skipped++;
  }
}

console.log(`\nDone: ${injected} injected, ${skipped} skipped`);
