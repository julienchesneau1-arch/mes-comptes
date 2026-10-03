// Safari (iPhone, Mac) ne sait pas parcourir un ReadableStream avec « for await ». pdf.js le fait pour lire le texte
// d'un PDF → « undefined is not a function (near '…t of e…') ». On ajoute la pièce manquante, avant pdf.js.
if (typeof ReadableStream !== 'undefined' && !ReadableStream.prototype[Symbol.asyncIterator]) {
  ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
    const reader = this.getReader();
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) return; yield value; }
    } finally { reader.releaseLock(); }
  };
}
