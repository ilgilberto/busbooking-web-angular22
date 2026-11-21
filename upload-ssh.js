'use strict';

/**
 * BusBooking Web — deploy SSH conservativo (Node.js 22/24, node-ssh ^13).
 *
 * Uso: npm run build:ssh     (test -> build -> questo script)
 *      node upload-ssh.js --dry-run       (controllo build locale, nessun SSH)
 *      node upload-ssh.js --skip-cleanup  (pubblica senza eliminare vecchi asset)
 *
 * Politica di sicurezza:
 * - index.html pubblicato per ultimo, tramite rename sul server;
 * - verifica SHA-256 di OGNI file prima dell'attivazione della nuova versione;
 * - pulizia SOLO di JS/CSS con nome hash Angular nella radice della web app;
 * - conserva gli asset dei due deploy tracciati più recenti e quelli < 7 giorni;
 * - NESSUNA rimozione ricorsiva o cancellazione di assets/, immagini, ecc.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const LOCAL_DIR = path.resolve(__dirname, 'dist/bus-booking-web/browser');
const REMOTE_DIR = '/var/www/html/busbooking';
const SSH_HOST = 'conoscenzacreativa.it';
const SSH_USER = 'root'; // Da sostituire in futuro con un utente dedicato al deploy.
const SSH_PORT = 22;
const CONCURRENCY = 4;
const RETAIN_DAYS = 7;
const MAX_PRUNE_FILES = 100;
const MANIFEST_CURRENT = '.busbooking-deploy-current.json';
const MANIFEST_PREVIOUS = '.busbooking-deploy-previous.json';
const INDEX_PREVIOUS = '.busbooking-index.previous.html';

/** Nomi Angular generati nella radice (NO asset generici e NO sottodirectory). */
const HASHED_ASSET = /^(?:main|polyfills|runtime|styles|scripts|chunk|vendor|common)-[A-Za-z0-9_-]{8,64}\.(?:js|css|map)$/;

function quote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function remoteJoin(relative) {
  if (relative.startsWith('/') || relative.split('/').some((p) => p === '..' || p === '.')) {
    throw new Error(`Percorso relativo non consentito: ${relative}`);
  }
  return `${REMOTE_DIR}/${relative}`;
}

function hashFile(filename) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filename));
  return hash.digest('hex');
}

/** Scansione locale: rifiuta link simbolici e nomi difficili da validare. */
function collectBuildFiles(dir = LOCAL_DIR) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Directory build assente: ${dir}. Esegui prima la build di produzione.`);
  }
  const files = [];
  const walk = (directory, prefix) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (/[\r\n\\]/.test(entry.name)) {
        throw new Error(`Nome file non consentito nella build: ${entry.name}`);
      }
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Link simbolico non consentito nella build: ${relative}`);
      }
      if (entry.isDirectory()) walk(absolute, relative);
      else if (entry.isFile()) {
        const bytes = fs.statSync(absolute).size;
        files.push({ relative, absolute, bytes, sha256: hashFile(absolute) });
      } else {
        throw new Error(`Elemento non regolare nella build: ${relative}`);
      }
    }
  };
  walk(dir, '');
  const index = files.find((f) => f.relative === 'index.html');
  if (!index || index.bytes === 0) throw new Error('index.html mancante o vuoto nella build.');
  const html = fs.readFileSync(index.absolute, 'utf8');
  if (!/<base\s+href\s*=\s*["']\/busbooking\/["']/i.test(html)) {
    throw new Error('index.html non contiene <base href="/busbooking/">: build per percorso sbagliato.');
  }
  if (files.length < 2 || !files.some((f) => /\.js$/.test(f.relative))) {
    throw new Error('Build incompleta: manca il bundle JavaScript.');
  }
  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

/** Manifest precedenti: non fidarsi di un file remoto alterato. */
function parseManifest(raw) {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.files) || parsed.files.length > 50000) return null;
    if (!parsed.files.every((f) => typeof f === 'string' && f.length < 512 &&
      !f.startsWith('/') && !/[\r\n\\]/.test(f) &&
      f.split('/').every((p) => p !== '.' && p !== '..' && p !== ''))) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isGeneratedHashedAsset(name) {
  return HASHED_ASSET.test(name);
}

/**
 * Disegna una lista di cancellazioni senza mai toccare assets/, file non hashati
 * o i nomi appartenenti al build nuovo e precedente.
 */
function planPrune(remoteFiles, currentNames, previousNames, nowMs = Date.now()) {
  const protectedNames = new Set([...currentNames, ...previousNames]);
  const cutoff = nowMs - RETAIN_DAYS * 24 * 3600 * 1000;
  return remoteFiles
    .filter(({ name, mtimeMs }) => isGeneratedHashedAsset(name) &&
      !protectedNames.has(name) && Number.isFinite(mtimeMs) && mtimeMs < cutoff)
    .sort((a, b) => a.mtimeMs - b.mtimeMs)
    .slice(0, MAX_PRUNE_FILES)
    .map((f) => f.name);
}

function parseRemoteListing(raw) {
  return raw.split('\n').flatMap((line) => {
    const idx = line.lastIndexOf('\t');
    if (idx < 0) return [];
    const name = line.slice(0, idx);
    const seconds = Number(line.slice(idx + 1));
    if (!isGeneratedHashedAsset(name) || !Number.isFinite(seconds) || seconds < 0) return [];
    return [{ name, mtimeMs: seconds * 1000 }];
  });
}

/** execCommand() NON lancia eccezioni per exit code != 0: occorre controllarlo. */
async function runRemote(ssh, command, label) {
  const result = await ssh.execCommand(command);
  if (result.code !== 0) {
    const details = (result.stderr || result.stdout || '').trim().slice(0, 500);
    throw new Error(`${label} fallito (exit ${result.code}): ${details}`);
  }
  return result.stdout || '';
}

async function verifyHashes(ssh, files, label) {
  // sha256sum -c --status fallisce anche se UN SOLO file è mancante o differente.
  // Spezzare in gruppi limita la lunghezza dei comandi SSH.
  for (let start = 0; start < files.length; start += 35) {
    const batch = files.slice(start, start + 35);
    const lines = batch.map((f) => `${f.sha256}  ${f.remoteRelative}`);
    const command = `cd ${quote(REMOTE_DIR)} && printf '%s\\n' ${lines.map(quote).join(' ')} | sha256sum --check --status`;
    await runRemote(ssh, command, `${label} (gruppo ${Math.floor(start / 35) + 1})`);
  }
}

async function getRemoteManifest(ssh) {
  const command = `if [ -f ${quote(remoteJoin(MANIFEST_CURRENT))} ]; then cat ${quote(remoteJoin(MANIFEST_CURRENT))}; fi`;
  const raw = await runRemote(ssh, command, 'Lettura manifest remoto');
  return raw ? parseManifest(raw) : null;
}

/** Password nascosta, senza listener permanenti sullo stdin. */
async function askPassword() {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error('Per la password SSH apri un terminale interattivo (PowerShell o terminale IDE).');
  }
  const input = process.stdin;
  process.stdout.write('🔐 Password SSH: ');
  input.setRawMode(true);
  input.resume();
  return await new Promise((resolve, reject) => {
    let password = '';
    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
    };
    const onData = (chunk) => {
      const key = chunk.toString('utf8');
      for (const char of key) {
        if (char === '\u0003' || char === '\u0004') {
          cleanup();
          reject(new Error('Inserimento password annullato.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          resolve(password);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          password = password.slice(0, -1);
        } else if (!/[\u0000-\u001f]/.test(char)) {
          password += char;
        }
      }
    };
    input.on('data', onData);
  });
}

async function deploy({ dryRun = false, skipCleanup = false, buildDir = LOCAL_DIR,
  sshFactory, passwordProvider = askPassword } = {}) {
  const files = collectBuildFiles(buildDir);
  const index = files.find((f) => f.relative === 'index.html');
  const nonIndex = files.filter((f) => f.relative !== 'index.html');
  const sizeMB = (files.reduce((sum, f) => sum + f.bytes, 0) / 1024 / 1024).toFixed(2);
  console.log(`Build valida: ${files.length} file (${sizeMB} MiB); destinazione ${REMOTE_DIR}`);
  if (dryRun) {
    console.log('DRY-RUN: nessuna connessione SSH, upload o cancellazione.');
    return;
  }

  // Richiede node-ssh solo al momento del deploy; i test offline non lo richiedono.
  const ssh = sshFactory ? sshFactory() : new (require('node-ssh').NodeSSH)();
  const uploadId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const temporaryIndex = `.busbooking-index-${uploadId}.tmp`;
  const temporaryManifest = `.busbooking-manifest-${uploadId}.tmp`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'busbooking-deploy-'));
  const localManifestFile = path.join(tempDir, 'manifest.json');
  let published = false;
  try {
    const password = await passwordProvider();
    await ssh.connect({
      host: SSH_HOST, port: SSH_PORT, username: SSH_USER, password,
      readyTimeout: 15000
    });
    // Non creare/cancellare directory in posizioni inattese né seguire symlink.
    await runRemote(ssh,
      `test -d ${quote(REMOTE_DIR)} && test ! -L ${quote(REMOTE_DIR)} && ` +
      `test -w ${quote(REMOTE_DIR)} && ` +
      `[ "$(cd ${quote(REMOTE_DIR)} && pwd -P)" = ${quote(REMOTE_DIR)} ] && ` +
      `command -v sha256sum >/dev/null && command -v find >/dev/null && ` +
      `[ -z "$(find ${quote(REMOTE_DIR)} -type l -print -quit)" ]`,
      'Verifiche di sicurezza directory remota');

    const oldManifest = await getRemoteManifest(ssh);
    console.log(`Connessione stabilita. Trasferimento di ${nonIndex.length} file (index pubblicato per ultimo).`);

    // NodeSSH putFiles fallisce con eccezione se uno dei file non viene trasferito.
    await ssh.putFiles(nonIndex.map((f) => ({ local: f.absolute, remote: remoteJoin(f.relative) })), {
      concurrency: CONCURRENCY
    });
    await verifyHashes(ssh,
      nonIndex.map((f) => ({ remoteRelative: f.relative, sha256: f.sha256 })),
      'Verifica integrità dei file caricati');

    await ssh.putFile(index.absolute, remoteJoin(temporaryIndex));
    await verifyHashes(ssh, [{ remoteRelative: temporaryIndex, sha256: index.sha256 }], 'Verifica index.html');

    const manifest = {
      version: 1,
      deployedAt: new Date().toISOString(),
      files: files.map((f) => f.relative)
    };
    fs.writeFileSync(localManifestFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    await ssh.putFile(localManifestFile, remoteJoin(temporaryManifest));
    await verifyHashes(ssh,
      [{ remoteRelative: temporaryManifest, sha256: hashFile(localManifestFile) }],
      'Verifica manifest');

    // Prima salva UNA copia precedente per un eventuale ripristino manuale.
    // Infine mv sullo stesso filesystem = sostituzione atomica di index.html.
    const switchCommand = [
      'set -e',
      `cd ${quote(REMOTE_DIR)}`,
      `if [ -f index.html ]; then cp -p -- index.html ${quote(INDEX_PREVIOUS)}; fi`,
      `if [ -f ${quote(MANIFEST_CURRENT)} ]; then cp -p -- ${quote(MANIFEST_CURRENT)} ${quote(MANIFEST_PREVIOUS)}; fi`,
      `mv -f -- ${quote(temporaryManifest)} ${quote(MANIFEST_CURRENT)}`,
      `mv -f -- ${quote(temporaryIndex)} index.html`
    ].join(' && ');
    await runRemote(ssh, switchCommand, 'Attivazione della nuova versione');
    published = true;
    console.log('✅ Pubblicazione completata: verificati checksum e nuovo index.html attivato.');

    if (skipCleanup) {
      console.log('Pulizia saltata (--skip-cleanup).');
      return;
    }
    if (!oldManifest) {
      // La prima esecuzione non dispone di dati affidabili sul deploy precedente.
      console.log('Pulizia rinviata: manca un manifest precedente valido. Nessun file eliminato.');
      return;
    }

    // Solo file nella RADICE della web app, non ricorsivo.
    const listing = await runRemote(ssh,
      `find ${quote(REMOTE_DIR)} -maxdepth 1 -type f -printf '%f\\t%T@\\n'`,
      'Elenco asset remoti');
    const names = planPrune(parseRemoteListing(listing), manifest.files, oldManifest.files);
    if (names.length === 0) {
      console.log('Pulizia: nessun vecchio bundle Angular da eliminare.');
      return;
    }
    console.log(`Pulizia conservativa: ${names.length} vecchi bundle hashati (più vecchi di ${RETAIN_DAYS} giorni).`);
    for (const name of names) console.log(`  - ${name}`);
    // Accetta SOLO basename hashati validati; niente glob, niente rm -r o assets/.
    await runRemote(ssh,
      `cd ${quote(REMOTE_DIR)} && rm -f -- ${names.map(quote).join(' ')}`,
      'Eliminazione dei vecchi bundle Angular');
    console.log('✅ Pulizia completata.');
  } catch (error) {
    console.error(published
      ? '⚠️ Nuova versione pubblicata, ma pulizia/verifica finale non completata.'
      : '❌ Deploy interrotto: la nuova index.html non è stata attivata.');
    throw error;
  } finally {
    if (ssh.isConnected()) {
      // Rimuove esclusivamente i file temporanei creati da QUESTA esecuzione.
      try {
        await runRemote(ssh,
          `cd ${quote(REMOTE_DIR)} && rm -f -- ${quote(temporaryIndex)} ${quote(temporaryManifest)}`,
          'Pulizia temporanei');
      } catch (error) {
        console.warn(`Impossibile rimuovere i file temporanei: ${error.message}`);
      }
    }
    ssh.dispose();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some((x) => !['--dry-run', '--skip-cleanup'].includes(x))) {
    console.error('Opzioni supportate: --dry-run, --skip-cleanup');
    process.exitCode = 1;
  } else {
    deploy({ dryRun: args.includes('--dry-run'), skipCleanup: args.includes('--skip-cleanup') })
      .catch((error) => { console.error('❌', error.message); process.exitCode = 1; });
  }
}

// Esporta solo funzioni pure per i test Node senza connessione SSH.
module.exports = {
  collectBuildFiles, isGeneratedHashedAsset, parseManifest, parseRemoteListing,
  planPrune, quote, remoteJoin, verifyHashes, runRemote, deploy
};
