/**
 * enhance-axios release script
 *
 * Flow:
 *   1. typecheck + tests (must pass)
 *   2. Check uncommitted → prompt commit
 *   3. Choose version → preview → confirm
 *   4. standard-version (bump + changelog + tag)
 *   5. Push to origin (gitee) + github
 *
 * Usage: npm run release
 */

const { execSync } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise(resolve => rl.question(q, resolve));

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function runSilent(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  return pkg.version;
}

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);
  if (type === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
  if (type === 'minor') { parts[1]++; parts[2] = 0; }
  if (type === 'patch') { parts[2]++; }
  return parts.join('.');
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   enhance-axios Release Script          ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // ─── Step 1: typecheck + tests ───
  console.log('[1/5] Running typecheck and tests...\n');
  try {
    run('npx tsc --noEmit');
    run('npx vitest run');
  } catch {
    console.error('\n✗ Typecheck or tests failed. Fix errors before releasing.');
    process.exit(1);
  }
  console.log('✓ Typecheck and tests passed.\n');

  // ─── Step 2: Check uncommitted changes ───
  console.log('[2/5] Checking uncommitted changes...\n');
  const status = runSilent('git status --porcelain');
  if (status) {
    console.log('Uncommitted changes:\n');
    console.log(runSilent('git status --short'));
    const msg = await question('\nEnter commit message (or empty to skip): ');
    if (msg.trim()) {
      run('git add -A');
      run(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
    } else {
      console.log('Skipping commit. Continuing with uncommitted changes...\n');
    }
  } else {
    console.log('✓ Working tree clean.\n');
  }

  // ─── Step 3: Choose version ───
  console.log('[3/5] Choose release version:\n');
  const current = getCurrentVersion();
  const types = ['patch', 'minor', 'major'];
  const previews = types.reduce((acc, t) => {
    acc[t] = bumpVersion(current, t);
    return acc;
  }, {});

  console.log(`  Current version: ${current}\n`);
  console.log(`  [1] patch → ${previews.patch}`);
  console.log(`  [2] minor → ${previews.minor}`);
  console.log(`  [3] major → ${previews.major}\n`);

  const choice = await question('Select [1/2/3] (default: 1): ');
  const idx = parseInt(choice) - 1 || 0;
  const releaseType = types[idx];
  const newVersion = previews[releaseType];

  const confirm = await question(`\nRelease as ${current} → ${newVersion} (${releaseType})? [Y/n]: `);
  if (confirm.toLowerCase() === 'n') {
    console.log('Cancelled.');
    process.exit(0);
  }

  // ─── Step 4: standard-version ───
  console.log(`\n[4/5] Running standard-version (${releaseType})...\n`);
  try {
    run(`npx standard-version --release-as ${releaseType} --no-verify`, { stdio: 'inherit' });
  } catch {
    console.error('\n✗ standard-version failed.');
    process.exit(1);
  }

  // ─── Step 5: Push to both remotes ───
  console.log('\n[5/5] Pushing to remotes...\n');

  try {
    run('git push origin master --follow-tags');
  } catch {
    console.error('✗ Push to origin (gitee) failed.');
  }

  try {
    run('git push github master --follow-tags');
  } catch {
    console.error('✗ Push to github failed.');
  }

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   Released v${newVersion}                    ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  rl.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
