const { NodeSSH } = require('node-ssh');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const ssh = new NodeSSH();

const localDir = path.resolve(__dirname, 'dist/bus-booking-web/browser');
const remoteDir = '/var/www/html/busbooking'; // cambia se serve

// Funzione per leggere la password senza mostrarla
function askPassword(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const stdin = process.openStdin();
    process.stdin.on("data", function (char) {
      char = char + "";
      switch (char) {
        case "\n": case "\r": case "\u0004":
          process.stdout.write("\n");
          break;
        default:
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          process.stdout.write(question + Array(rl.line.length + 1).join("*"));
          break;
      }
    });

    rl.question(question, (value) => {
      rl.history = rl.history.slice(1);
      rl.close();
      resolve(value);
    });
  });
}

(async () => {
  try {
    const password = await askPassword('🔐 Inserisci la password SSH: ');

    await ssh.connect({
      host: 'conoscenzacreativa.it',    // <--- cambia con il tuo host
      username: 'root',            // <--- cambia con il tuo username
      password: password
    });

    console.log(`Connesso. Inizio upload in ${remoteDir}...`);

    await ssh.putDirectory(localDir, remoteDir, {
      recursive: true,
      concurrency: 5,
      validate: (itemPath) => fs.lstatSync(itemPath).isFile()
    });

    console.log('✅ Upload completato.');
    ssh.dispose();
  } catch (err) {
    console.error('❌ Errore durante upload:', err);
    process.exitCode = 1;
  }
})();
