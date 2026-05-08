# Quiz Addetti UPP

**Live:** https://arnaldocrescente.github.io/upp-test/

App web statica per la preparazione all'esame degli Addetti UPP. Gira interamente nel browser — nessun server, nessun account. I progressi vengono salvati nel `localStorage` del dispositivo.

## Come funziona

La banca dati delle domande è incorporata direttamente nella pagina. Alla prima apertura trovi due pulsanti principali:

### Genera Esercitazioni

Distribuisce **tutte le domande** in 10 sessioni senza ripetizioni. L'ordine delle domande e delle risposte è casuale ad ogni generazione. Ogni sessione ha un timer da **60 minuti** che però non blocca: allo scadere del tempo puoi continuare, e nel riepilogo finale verrà mostrato l'eventuale sforamento. Puoi rigenerare le 10 sessioni in qualsiasi momento (i risultati precedenti vengono cancellati).

### Genera Esame

Avvia una simulazione d'esame con **30 domande** estratte casualmente dalla banca dati, risposte mescolate. Il timer è di **90 minuti** e alla scadenza la sessione si chiude automaticamente, esattamente come nell'esame reale.

## Riepilogo e revisione

Al termine di ogni sessione (o esame) viene mostrato un riepilogo con:
- numero di risposte corrette, sbagliate e saltate
- percentuale di punteggio
- tempo impiegato e tempo rimanente (o sforamento)
- revisione domanda per domanda con la risposta corretta evidenziata

Gli ultimi 10 esami vengono salvati e sono consultabili dalla home.

## Deployment

L'app viene pubblicata automaticamente su **GitHub Pages** ad ogni push su `main` tramite GitHub Actions (`.github/workflows/pages.yml`).
