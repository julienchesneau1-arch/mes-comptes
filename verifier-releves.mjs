// node verifier-releves.mjs — passe chaque fichier de releves/ dans le même lecteur que l'app
// et affiche ce qui a été compris. Tout reste sur la machine ; releves/ n'est jamais publié (.gitignore).
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('./core.js');
const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const dir = new URL('./releves/', import.meta.url);
const files = (await readdir(dir).catch(() => [])).filter(f => !f.startsWith('.'));
if (!files.length) { console.log('Dépose tes relevés (PDF, CSV, OFX) dans le dossier releves/ puis relance.'); process.exit(0); }

const S = { accounts: {}, tx: [], rules: {} };
const eur = n => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
for (const f of files) {
  const buf = await readFile(new URL(f, dir));
  try {
    let parsed;
    if (buf.subarray(0, 5).toString() === '%PDF-') {
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
      const pages = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const { items } = await (await doc.getPage(p)).getTextContent();
        pages.push(items.filter(i => i.str && i.str.trim()).map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width })));
      }
      if (process.argv.includes('--brut')) for (const l of pages[0].slice(0, 80)) console.log(`   ${l.x.toFixed(0).padStart(4)} ${l.y.toFixed(0).padStart(4)}  ${l.str}`);
      parsed = C.parsePDF(pages, f);
    } else {
      let txt; try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { txt = new TextDecoder('windows-1252').decode(buf); }
      parsed = C.isTreso(txt) ? C.parseTreso(txt, [{ id: 'p1', name: process.env.PRENOM1 || 'Moi' }, { id: 'p2', name: process.env.PRENOM2 || 'Conjoint' }]).parsed
        : /OFXHEADER|<OFX>/i.test(txt) ? C.parseOFX(txt) : C.parseCSV(txt, f);
    }
    const r = C.importParsed(S, parsed);
    console.log(`\n✔ ${f} : ${r.added} opérations (${r.dup} doublons)`);
    for (const p of parsed) {
      const d = p.rows.map(x => x.date).sort();
      const deb = p.rows.filter(x => x.amount < 0).reduce((a, x) => a + x.amount, 0), cre = p.rows.filter(x => x.amount > 0).reduce((a, x) => a + x.amount, 0);
      console.log(`  compte ${p.account} · ${d[0]} → ${d[d.length - 1]} · débits ${eur(deb)} · crédits ${eur(cre)}${p.balance ? ` · solde ${eur(p.balance.amount)} au ${p.balance.date}` : ''}`
        + (p.check === 0 ? ' · contrôle ✔' : p.check ? ` · ⚠ contrôle : écart ${eur(p.check)}` : ''));
    }
  } catch (e) { console.log(`\n✘ ${f} : ${e.message}  (relance avec --brut pour voir le texte lu)`); }
}
const guess = S.tx.filter(t => t.conf === 'guess');
const byCat = {};
for (const t of S.tx) byCat[t.cat] = (byCat[t.cat] || 0) + 1;
console.log(`\nRangement : ${S.tx.length} opérations · ${S.tx.length - guess.length} rangées seules (${Math.round((1 - guess.length / (S.tx.length || 1)) * 100)} %) · ${guess.length} à ranger`);
console.log('  ' + Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${C.cat(c).emoji} ${c} ${n}`).join(' · '));
const unk = {};
for (const t of guess) { const k = C.merchantKey(t.label); unk[k] = (unk[k] || 0) + 1; }
console.log('\nMarchands non reconnus (les plus fréquents) :');
for (const [k, n] of Object.entries(unk).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(n).padStart(3)}× ${k}`);
