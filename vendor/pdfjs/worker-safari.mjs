// Le processus de fond de pdf.js a besoin du même correctif (les imports s'exécutent dans l'ordre).
import './polyfill-safari.mjs';
import './pdf.worker.min.mjs';
