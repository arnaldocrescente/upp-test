# Quiz Addetti UPP

App web statica per la preparazione all'esame degli addetti UPP. Nessun build tool, nessun backend.

## Struttura

```
src/
  index.html   — pagina unica; contiene tutto il markup e i dati JSON inline (#quiz-data)
  app.js       — logica completa dell'app (vanilla JS, IIFE)
  app.css      — stili
.github/
  workflows/
    pages.yml  — deploy automatico su GitHub Pages
```

## Come funziona

Le domande sono state estratte da un PDF ufficiale e inserite come array JSON direttamente dentro `index.html` (tag `<script id="quiz-data" type="application/json">`). Non c'è nessuna chiamata di rete per i dati.

Da quella banca dati l'app genera due modalità:

- **Esercitazioni** — 10 sessioni che coprono tutte le domande senza ripetizioni, ordine casuale, timer 60 min non bloccante.
- **Prova d'esame** — 30 domande casuali, timer 90 min che chiude la sessione automaticamente alla scadenza.

Il punteggio segue la logica: risposta corretta = 1 pt, parziale = 0,5 pt, sbagliata/saltata = 0 pt.

## Stato locale

I progressi vengono salvati in `localStorage` (chiave `quiz-state-v1`). Non c'è login né server.

## Deploy

Il sito va in produzione automaticamente su GitHub Pages ad ogni push su `main` tramite `.github/workflows/pages.yml`.
