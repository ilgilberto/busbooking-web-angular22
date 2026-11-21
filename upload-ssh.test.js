'use strict';

// Eseguire da root progetto: node --test upload-ssh.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  collectBuildFiles, isGeneratedHashedAsset, parseManifest,
  parseRemoteListing, planPrune, remoteJoin, runRemote, verifyHashes
} = require('./upload-ssh.js');

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 21);
const stale = NOW - 15 * DAY;
const recent = NOW - 2 * DAY;

// Solo file Angular hashati nella radice possono essere rimossi.
test('identifica soltanto i bundle Angular hashati con prefissi autorizzati', () => {
  assert.equal(isGeneratedHashedAsset('main-ABCDE12345.js'), true);
  assert.equal(isGeneratedHashedAsset('styles-ABCDE12345.css'), true);
  assert.equal(isGeneratedHashedAsset('chunk-ABCDE12345.js'), true);
  for (const name of ['main.js', 'index.html', '.htaccess', 'favicon.ico',
    'imm0.jpg', 'custom-ABCDE12345.js', 'assets/main-ABCDE12345.js',
    '../main-ABCDE12345.js', 'main-X.js', 'main-ABCDE12345.js.bak']) {
    assert.equal(isGeneratedHashedAsset(name), false, name);
  }
});

test('non cancella asset della build attuale o precedente, né i recenti', () => {
  const remote = [
    { name: 'main-AAAAAAAA.js', mtimeMs: stale },
    { name: 'chunk-BBBBBBBB.js', mtimeMs: stale },
    { name: 'styles-CCCCCCCC.css', mtimeMs: recent },
    { name: 'main-DDDDDDDD.js', mtimeMs: stale },
    { name: 'README.txt', mtimeMs: stale },
    { name: 'imm0.jpg', mtimeMs: stale }
  ];
  const found = planPrune(remote, ['main-AAAAAAAA.js'], ['chunk-BBBBBBBB.js'], NOW);
  assert.deepEqual(found, ['main-DDDDDDDD.js']);
});

test('un numero eccessivo di candidati viene limitato per sicurezza', () => {
  const remote = Array.from({ length: 160 }, (_, n) => ({
    name: `chunk-${String(n).padStart(8, '0')}.js`, mtimeMs: stale - n
  }));
  assert.equal(planPrune(remote, [], [], NOW).length, 100);
});

test('manifest non valido o manipolato viene rifiutato', () => {
  assert.equal(parseManifest(''), null);
  assert.equal(parseManifest('not-json'), null);
  assert.equal(parseManifest(JSON.stringify({ version: 2, files: [] })), null);
  assert.equal(parseManifest(JSON.stringify({ version: 1, files: ['../index.html'] })), null);
  assert.equal(parseManifest(JSON.stringify({ version: 1, files: ['assets/../index.html'] })), null);
  assert.equal(parseManifest(JSON.stringify({ version: 1, files: ['/etc/passwd'] })), null);
  assert.deepEqual(parseManifest(JSON.stringify({ version: 1, files: ['index.html', 'assets/logo.png'] })).files,
    ['index.html', 'assets/logo.png']);
});

test('nessuna directory remota al di fuori della destinazione e nessun path traversal', () => {
  assert.equal(remoteJoin('assets/logo.png'), '/var/www/html/busbooking/assets/logo.png');
  assert.throws(() => remoteJoin('../etc/passwd'));
  assert.throws(() => remoteJoin('assets/../../etc/passwd'));
  assert.throws(() => remoteJoin('/etc/passwd'));
});

test('parsing della lista remota ignora voci non valide', () => {
  const list = parseRemoteListing('main-ABCDEFGH.js\t1790000000.123\nREADME.md\t1790000000.123\nfile-extras\tnonnumero\n');
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'main-ABCDEFGH.js');
  assert.equal(list[0].mtimeMs, 1790000000123);
});

test('la build deve avere base href corretto, index e almeno un bundle', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-upload-test-'));
  try {
    const put = (name, text) => {
      const absolute = path.join(root, name);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, text);
    };
    put('index.html', '<html><head><base href="/busbooking/"></head></html>');
    put('main-01234567.js', 'console.log("ok")');
    put('assets/logo.svg', '<svg></svg>');
    assert.deepEqual(collectBuildFiles(root).map((f) => f.relative).sort(),
      ['assets/logo.svg', 'index.html', 'main-01234567.js'].sort());
    put('index.html', '<html><base href="/"></html>');
    assert.throws(() => collectBuildFiles(root), /base href/);
    put('index.html', '<html><base href="/busbooking/"></html>');
    fs.symlinkSync(path.join(root, 'main-01234567.js'), path.join(root, 'alias.js'));
    assert.throws(() => collectBuildFiles(root), /Link simbolico/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('execCommand con exit code non zero fa fallire il deploy', async () => {
  const ssh = { execCommand: async () => ({ code: 1, stderr: 'permission denied', stdout: '' }) };
  await assert.rejects(runRemote(ssh, 'command', 'Test'), /permission denied/);
});

test('verifica checksum remote: fallisce anche quando sha256sum segnala errore', async () => {
  let called = '';
  const ssh = {
    execCommand: async (cmd) => {
      called = cmd;
      return { code: 2, stderr: 'file mismatch', stdout: '' };
    }
  };
  await assert.rejects(verifyHashes(ssh, [{ remoteRelative: 'main-01234567.js', sha256: 'a'.repeat(64) }], 'Test'), /file mismatch/);
  assert.match(called, /sha256sum --check --status/);
  assert.match(called, /main-01234567\.js/);
});

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'busbooking-deploy-integration-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<html><head><base href="/busbooking/"></head></html>');
  fs.writeFileSync(path.join(dir, 'main-01234567.js'), 'console.log("app")');
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets', 'banner.png'), 'image-bytes');
  return dir;
}

function fakeSsh({ failUpload = false, failHashes = false, hasManifest = true } = {}) {
  const history = [];
  let connected = false;
  const ssh = {
    history,
    async connect({ password, host }) {
      assert.equal(host, 'conoscenzacreativa.it');
      assert.equal(password, 'test-password');
      connected = true;
      history.push('connect');
    },
    isConnected() { return connected; },
    dispose() { connected = false; history.push('dispose'); },
    async putFiles(files) {
      history.push({ operation: 'putFiles', remote: files.map((f) => f.remote) });
      if (failUpload) throw new Error('trasferimento non riuscito');
    },
    async putFile(local, remote) {
      history.push({ operation: 'putFile', remote });
    },
    async execCommand(command) {
      history.push(command);
      if (command.includes('sha256sum --check --status') && failHashes) {
        return { code: 1, stderr: 'checksum mismatch', stdout: '' };
      }
      if (command.includes('then cat') && command.includes('.busbooking-deploy-current.json')) {
        return { code: 0, stderr: '', stdout: hasManifest
          ? JSON.stringify({ version: 1, files: ['chunk-OLDASSET.js', 'index.html'] }) : '' };
      }
      if (command.startsWith('find ')) {
        return { code: 0, stderr: '', stdout:
          'chunk-OLDASSET.js\t1700000000\nchunk-STALE123.js\t1700000000\nassets/banner.png\t1700000000\n' };
      }
      return { code: 0, stderr: '', stdout: '' };
    }
  };
  return ssh;
}

test('deploy integrato: checksum, index per ultimo, vecchi asset eliminati selettivamente', async () => {
  const dir = makeFixture();
  const ssh = fakeSsh();
  try {
    await require('./upload-ssh.js').deploy({
      buildDir: dir, sshFactory: () => ssh, passwordProvider: async () => 'test-password'
    });
    const commands = ssh.history.filter((x) => typeof x === 'string');
    const transfer = ssh.history.find((x) => x.operation === 'putFiles');
    assert.equal(transfer.remote.length, 2);
    assert.ok(!transfer.remote.some((x) => x.endsWith('/index.html')));
    assert.ok(commands.filter((x) => x.includes('sha256sum --check --status')).length >= 3);
    const activate = commands.findIndex((x) => x.includes('mv -f --') && x.includes('index.html'));
    const prune = commands.findIndex((x) => x.includes('rm -f --') && x.includes('chunk-STALE123.js'));
    assert.ok(activate > 0);
    assert.ok(prune > activate, 'la pulizia deve avvenire solo DOPO attivazione');
    assert.ok(!commands[prune].includes('chunk-OLDASSET.js'), 'asset del deploy precedente protetto');
    assert.ok(!commands[prune].includes('assets/banner.png'), 'immagini mai rimosse');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('errore upload: nessun index attivato e nessuna pulizia', async () => {
  const dir = makeFixture();
  const ssh = fakeSsh({ failUpload: true });
  try {
    await assert.rejects(require('./upload-ssh.js').deploy({
      buildDir: dir, sshFactory: () => ssh, passwordProvider: async () => 'test-password'
    }), /trasferimento non riuscito/);
    assert.equal(ssh.history.some((x) => typeof x === 'string' && x.includes('mv -f --')), false);
    assert.equal(ssh.history.some((x) => typeof x === 'string' && x.includes('chunk-STALE123.js')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('errore SHA-256: pubblicazione sospesa senza modificare index', async () => {
  const dir = makeFixture();
  const ssh = fakeSsh({ failHashes: true });
  try {
    await assert.rejects(require('./upload-ssh.js').deploy({
      buildDir: dir, sshFactory: () => ssh, passwordProvider: async () => 'test-password'
    }), /checksum mismatch/);
    assert.equal(ssh.history.some((x) => typeof x === 'string' && x.includes('mv -f --')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('primo deploy: salta la pulizia senza manifest precedente', async () => {
  const dir = makeFixture();
  const ssh = fakeSsh({ hasManifest: false });
  try {
    await require('./upload-ssh.js').deploy({
      buildDir: dir, sshFactory: () => ssh, passwordProvider: async () => 'test-password'
    });
    assert.equal(ssh.history.some((x) => typeof x === 'string' && x.startsWith('find ')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
