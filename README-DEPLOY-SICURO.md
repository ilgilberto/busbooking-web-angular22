# BusBooking Web — upload SSH v2.1.5

Patch incrementale per Angular 22 **v2.1.4**. Nessuna modifica ai componenti Angular, ai servizi REST o agli asset.

## File inclusi

- `upload-ssh.js` — sostituisce quello presente nella directory principale del progetto.
- `upload-ssh.test.js` — nuovi test isolati, da posizionare nella stessa directory.

## Esecuzione

1. Copiare entrambi i file nella directory che contiene `package.json`.
2. Facoltativo: verificare gli script e la logica di pulizia senza SSH:

   ```bash
   node --test upload-ssh.test.js
   ```

3. Per eseguire test Angular, build di produzione e deploy (lo script `build:ssh` è quello della v2.1.4):

   ```bash
   npm run build:ssh
   ```

4. Opzionale, dopo una build di produzione con `--base-href /busbooking/`:

   ```bash
   node upload-ssh.js --dry-run
   node upload-ssh.js --skip-cleanup
   ```

`--dry-run` controlla soltanto la build LOCALE (non si connette e non legge il server). `--skip-cleanup` esegue il deploy completo, ma non elimina i vecchi bundle.

## Cosa cambia rispetto al precedente upload-ssh.js

- Preflight: la build deve esistere e contenere `index.html`, bundle JS e `<base href="/busbooking/">`.
- Percorso remoto bloccato su `/var/www/html/busbooking`; controlli per symlink, directory canonica e permessi.
- Upload di tutti i file, compresi quelli nelle sottodirectory, con `node-ssh.putFiles()` e gestione delle eccezioni: un trasferimento incompleto blocca la pubblicazione.
- Confronto SHA-256 di tutti i file trasferiti, usando `sha256sum` sul server.
- `index.html` è caricato temporaneamente e rinominato per **ultimo**, dopo la verifica degli altri file.
- Copie di sicurezza del precedente `index.html` e del precedente manifest (`.busbooking-index.previous.html`, `.busbooking-deploy-previous.json`).
- Manifest per riconoscere i file appartenenti all'ultima e alla penultima pubblicazione.
- Pulizia conservativa **dopo** la pubblicazione: solo file con nomi hashati Angular di tipo `main-*`, `chunk-*`, `styles-*`, `polyfills-*`, `runtime-*`, `scripts-*`, `vendor-*`, `common-*` e suffissi `.js`, `.css`, `.map`, **nella sola directory radice**.
- Non rimuove mai `assets/`, immagini, HTML, documenti, cartelle, file non riconosciuti, asset dei due deploy tracciati più recenti, né file modificati negli ultimi **7 giorni**. Massimo **100 rimozioni per esecuzione**.
- **Al primo deploy con questo script** non esiste ancora un manifest precedente: la pulizia viene saltata per prudenza.
- La password SSH non viene ripetuta a video; ripristino dello stato del terminale al termine dell'inserimento.
- Se un comando remoto restituisce exit code diverso da zero, il programma fallisce con codice d'uscita 1 e lo segnala a npm.

## Comandi eseguiti sul server

A differenza dello script precedente, il nuovo script usa `execCommand` per controlli preliminari e checksum, per salvare la versione precedente, per attivare `index.html` tramite `mv`, e per cancellare **soltanto i vecchi bundle hashati ritenuti idonei**. Non usa `rm -rf` e non esegue riavvii, installazioni o comandi sul database.

Richiede un server Linux con `find`, `sha256sum`, `mv`, `cp`, `rm`, e accesso SSH/SFTP come nella configurazione precedente. Non è stato effettuato alcun deploy reale durante la preparazione di questa patch.

## Nota di sicurezza

La configurazione originale usa l'utente `root` con password. Sarebbe opportuno adottare in futuro un utente SSH dedicato con autorizzazioni circoscritte alla directory di pubblicazione, preferibilmente con autenticazione a chiave e verifica dell'impronta del server. Non è stata cambiata questa configurazione per non interrompere il deploy esistente.

Inoltre, i bundle più vecchi di 7 giorni potrebbero servire a utenti con una scheda dell'app rimasta aperta molto a lungo. Se vuoi preservare tali sessioni più a lungo, aumenta `RETAIN_DAYS` nello script (ad esempio 14 o 30).
