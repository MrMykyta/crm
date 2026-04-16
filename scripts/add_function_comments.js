#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const parser = require('../client/node_modules/@babel/parser');
const traverse = require('../client/node_modules/@babel/traverse').default;

const DRY_RUN = process.argv.includes('--dry-run');

const ROOT = process.cwd();
const FILES_CMD = `rg --files client/src server/src -g '*.{js,jsx,mjs,cjs}'`;

function splitWords(name) {
  return String(name || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_$]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildComment(name) {
  const safeName = name || 'anonymous';
  return `${safeName}: ${splitWords(safeName) || safeName}.`;
}

function parseFile(source, filePath) {
  try {
    return parser.parse(source, {
      sourceType: 'unambiguous',
      allowReturnOutsideFunction: true,
      plugins: [
        'jsx',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'objectRestSpread',
        'optionalChaining',
        'nullishCoalescingOperator',
        'dynamicImport',
        'topLevelAwait',
        'numericSeparator',
        'logicalAssignment',
      ],
    });
  } catch (e) {
    console.warn(`[skip:parse] ${filePath}: ${e.message}`);
    return null;
  }
}

function lineIndentAt(source, pos) {
  const lineStart = source.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
  const segment = source.slice(lineStart, pos);
  const m = segment.match(/^\s*/);
  return m ? m[0] : '';
}

function hasNearbyComment(source, pos) {
  const before = source.slice(0, pos);
  const lines = before.split(/\r?\n/);
  let checked = 0;
  for (let i = lines.length - 1; i >= 0 && checked < 4; i -= 1) {
    const t = lines[i].trim();
    if (!t) continue;
    checked += 1;
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return true;
    return false;
  }
  return false;
}

function getFunctionName(pathRef) {
  const n = pathRef.node;
  if (n.type === 'FunctionDeclaration' && n.id?.name) return n.id.name;
  if ((n.type === 'ClassMethod' || n.type === 'ObjectMethod') && n.key) {
    if (n.key.type === 'Identifier') return n.key.name;
    if (n.key.type === 'StringLiteral') return n.key.value;
  }
  if (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') {
    const p = pathRef.parentPath?.node;
    if (!p) return null;
    if (p.type === 'VariableDeclarator' && p.id?.type === 'Identifier') return p.id.name;
    if (p.type === 'AssignmentExpression') {
      if (p.left?.type === 'Identifier') return p.left.name;
      if (p.left?.type === 'MemberExpression' && p.left.property?.type === 'Identifier') {
        return p.left.property.name;
      }
    }
    if (p.type === 'ObjectProperty') {
      if (p.key?.type === 'Identifier') return p.key.name;
      if (p.key?.type === 'StringLiteral') return p.key.value;
    }
  }
  return null;
}

function insertionPoint(pathRef) {
  const n = pathRef.node;
  if (pathRef.isFunctionDeclaration()) {
    const p = pathRef.parentPath?.node;
    if (p && (p.type === 'ExportNamedDeclaration' || p.type === 'ExportDefaultDeclaration')) {
      return p.start;
    }
    return n.start;
  }
  if (pathRef.isClassMethod() || pathRef.isObjectMethod()) return n.start;
  if (pathRef.isFunctionExpression() || pathRef.isArrowFunctionExpression()) {
    const p = pathRef.parentPath;
    if (!p) return n.start;
    if (p.isVariableDeclarator()) {
      return p.parentPath?.node?.start ?? p.node.start;
    }
    if (p.isObjectProperty()) return p.node.start;
    if (p.isAssignmentExpression()) {
      const stmt = p.getStatementParent();
      return stmt?.node?.start ?? p.node.start;
    }
  }
  return n.start;
}

function shouldHandle(pathRef) {
  if (pathRef.isFunctionDeclaration()) return true;
  if (pathRef.isClassMethod() || pathRef.isObjectMethod()) return true;
  if (pathRef.isFunctionExpression() || pathRef.isArrowFunctionExpression()) {
    const p = pathRef.parentPath;
    if (!p) return false;
    return p.isVariableDeclarator() || p.isObjectProperty() || p.isAssignmentExpression();
  }
  return false;
}

function processFile(filePath) {
  const abs = path.join(ROOT, filePath);
  const source = fs.readFileSync(abs, 'utf8');
  const ast = parseFile(source, filePath);
  if (!ast) return { changed: false, inserted: 0 };

  const inserts = [];
  const usedPositions = new Set();

  traverse(ast, {
    enter(p) {
      if (!shouldHandle(p)) return;
      const name = getFunctionName(p);
      if (!name) return;

      const pos = insertionPoint(p);
      if (typeof pos !== 'number') return;
      if (usedPositions.has(pos)) return;
      if (hasNearbyComment(source, pos)) return;

      const indent = lineIndentAt(source, pos);
      const comment = `${indent}// ${buildComment(name)}\n`;
      inserts.push({ pos, text: comment });
      usedPositions.add(pos);
    },
  });

  if (!inserts.length) return { changed: false, inserted: 0 };

  inserts.sort((a, b) => b.pos - a.pos);
  let next = source;
  for (const item of inserts) {
    next = `${next.slice(0, item.pos)}${item.text}${next.slice(item.pos)}`;
  }

  if (!DRY_RUN) fs.writeFileSync(abs, next, 'utf8');
  return { changed: true, inserted: inserts.length };
}

function main() {
  const fileListRaw = cp.execSync(FILES_CMD, { encoding: 'utf8' });
  const files = fileListRaw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((f) => !f.includes('/node_modules/') && !f.includes('/build/'));

  let changedFiles = 0;
  let totalInserted = 0;
  let scanned = 0;

  for (const file of files) {
    scanned += 1;
    const { changed, inserted } = processFile(file);
    if (changed) {
      changedFiles += 1;
      totalInserted += inserted;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: DRY_RUN ? 'dry-run' : 'write',
        scanned,
        changedFiles,
        totalInserted,
      },
      null,
      2
    )
  );
}

main();
