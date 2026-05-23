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
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true, ...opts });
}

function runSilent(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe', shell: true }).trim();
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

function selectVersion(current, choices) {
  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    let selected = 0;

    function render() {
      // Clear previous render (move cursor up 4 lines)
      if (selected > 0 || process.stdout.cursorTo) {
        readline.cursorTo(process.stdout, 0);
        readline.moveCursor(process.stdout, 0, -4);
        readline.clearScreenDown(process.stdout);
      }

      console.log(`  Current: ${current}\n`);
      choices.forEach((c, i) => {
        const arrow = i === selected ? '❯' : ' ';
        const highlight = i === selected ? '\x1b[36m' : '\x1b[2m';
        const reset = '\x1b[0m';
        console.log(`  ${arrow} ${highlight}${c.label.padEnd(7)} → ${c.preview}${reset}`);
      });
      console.log('\n  ↑↓ move  ↵ confirm');
    }

    render();

    process.stdin.on('keypress', (_str, key) => {
      if (key.name === 'up') {
        selected = (selected - 1 + choices.length) % choices.length;
        render();
      } else if (key.name === 'down') {
        selected = (selected + 1) % choices.length;
        render();
      } else if (key.name === 'return') {
        process.stdin.setRawMode(false);
        process.stdin.removeAllListeners('keypress');
        console.log(`\n  Selected: ${choices[selected].label} → ${choices[selected].preview}`);
        resolve(choices[selected].label);
      } else if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.exit(0);
      }
    });
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   enhance-axios Release Script          ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // ─── Step 1: typecheck + tests ───
  console.log('[1/5] Running typecheck and tests...\n');
  try {
    run('npx tsc --noEmit');
  } catch {
    console.error('\n✗ Typecheck failed. Fix errors before releasing.');
    process.exit(1);
  }

  try {
    run('npx vitest run');
  } catch {
    console.error('\n✗ Tests failed. Fix errors before releasing.');
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
  const choices = [
    { label: 'patch', preview: bumpVersion(current, 'patch') },
    { label: 'minor', preview: bumpVersion(current, 'minor') },
    { label: 'major', preview: bumpVersion(current, 'major') },
  ];

  const releaseType = await selectVersion(current, choices);
  const newVersion = bumpVersion(current, releaseType);

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
