# ORBIT — Un delicato disastro cosmico

Prototipo arcade locale in HTML, JavaScript e Canvas 2D. Nessuna dipendenza, account, asset remoto o installazione npm necessaria. Interfaccia e comunicazioni in italiano.

## Licenza e condivisione

Distribuito con [licenza MIT](LICENSE). Copyright (c) 2026 N4PoLeOnE.

Il gioco può essere pubblicato gratuitamente su GitHub Pages con un repository pubblico:

1. Carica `index.html`, `style.css`, la cartella `src/`, `.nojekyll`, `LICENSE` e questo README in un repository, per esempio `orbit`, mantenendo la struttura delle cartelle.
2. Nelle impostazioni del repository apri **Settings → Pages** e scegli **Deploy from a branch**, ramo `main`, cartella `/ (root)`.
3. Al termine della pubblicazione, condividi l'indirizzo mostrato da GitHub Pages con gli amici. Non servono installazioni per giocare dal browser.

Il server locale e la cartella `_originale_backup/` non sono necessari per la versione online. Non occorre acquistare un dominio.

## Novità del quarto pass

**Grafica.** Nuovo motore di resa su Canvas 2D, sempre senza asset esterni: pianeti con texture procedurali che ruotano e sono illuminati dalla stella più vicina (terminatore, atmosfera, riflesso degli oceani, luci delle città sul lato notturno); i mondi cambiano aspetto quando nascono oceani e vegetazione. Anelli che passano davanti e dietro il pianeta, stelle con corona e raggi di diffrazione, buchi neri con disco di accrescimento e anello di fotoni, comete con coda di polvere e coda ionica rivolta lontano dalla stella. Scie orbitali luminose per ogni corpo, griglia dello spazio-tempo deformata dalle masse, nebulosa procedurale e stelle in parallasse su tre livelli, particelle additive, lampi e onde d'urto. Il menu mostra un sistema solare vivo.

**Gameplay.**
- **Contratti cosmici**: tre obiettivi sempre attivi (prima orbita, rivoluzioni, lune, civiltà, fionde, catene di combo, sistemi da 3–5 pianeti, quiete…). Ogni contratto completato dà punti, toglie il 10% di instabilità e viene sostituito; la difficoltà sale con i progressi (27 contratti in 4 livelli).
- **Rango**: ogni due contratti si sale di rango (8 titoli, da *Polvere stellare* a *Divinità quasi competente*); ogni rango aggiunge +10% a tutti i punti.
- **Polvere di stelle ✦**: compare spesso lungo le orbite dei tuoi pianeti e si raccoglie facendola attraversare da qualsiasi pianeta, luna, cometa o micro-asteroide. Raccolte entro 7 secondi formano catene con bonus crescente. Dà un nuovo uso al micro-asteroide.
- **Juice**: annunci a centro schermo per i momenti importanti, breve rallentatore su supernove, scontri stellari e nascita di civiltà, barra della combo che si svuota, punteggio animato, colori della combo crescenti.

**Audio.** Tappeto ambientale sintetizzato con riverbero, note di punteggio che salgono con la combo, fanfare per contratti e ranghi, esplosioni a rumore filtrato.

La fisica, l'assistenza al lancio, il ritmo degli arrivi e le regole della vita sono invariati: tutti i 50 test originali passano, più 10 nuovi test per contratti, rango, polvere di stelle e rallentatore. La versione precedente è conservata in `_originale_backup/`.

## Avvio

Con Node.js 20.11 o successivo, dalla cartella del progetto:

```sh
npm start
```

Apri **http://127.0.0.1:4173**. In alternativa, fai doppio clic su `Avvia.cmd`, poi apri l’indirizzo indicato. Il server ascolta solo sul computer locale. Chiudi la finestra del server per arrestarlo. `PORT` consente di scegliere un’altra porta. Non aprire direttamente `index.html`: i moduli JavaScript richiedono HTTP.

## Come si gioca

- Genesi comincia con **un solo Sole**. La prima coda contiene pianeta roccioso, oceanico e Terra; segue una Luna. Crea tu il primo sistema.
- Premi nello spazio vuoto e trascina **nella direzione del lancio**. Vicino alla tangente, l’assistenza corregge dolcemente velocità e direzione. Le fasce azzurre mostrano entrambi i versi. Un buon primo lancio viene premiato dopo meno di un secondo reale, senza aspettare un giro completo.
- Durante il drag la fisica scende al **12%**, ma il timer degli arrivi continua. Posizione e intensità restano scelte del giocatore; i lanci fermi, radiali o deliberatamente eccessivi non vengono trasformati in orbite.
- Verde: **orbita chiusa plausibile nelle condizioni attuali**, valutata con energia, pericentro, apocentro, perturbazioni e simulazione N-body. Giallo: margine ridotto, forte eccentricità o perturbazioni. Rosso: caduta, collisione o fuga. Le ellissi sicure sono benvenute.
- Per una Luna, avvicina il cursore a un pianeta: appare la **zona satellite**. Premi nella fascia e trascina di lato; il drag è locale, la velocità del pianeta è già inclusa. Il verde richiede almeno **due rivoluzioni simulate**, senza urti né perdita del pianeta. Il premio è **LUNA CATTURATA** dopo un primo periodo reale. Lo scudo delle civiltà avanzate non respinge più lune e comete. Durante la mira il punto di lancio accompagna il pianeta; dopo il rilascio valgono soltanto le forze N-body.
- Clicca un corpo per visualizzare la sua traiettoria, **dominante, stato orbitale e ritorno previsto**. Linea continua: integrazione N-body; tratteggio: ellisse stimata. Marcatori P/A indicano avvicinamento/allontanamento; una freccia mostra dominante o fuga fuori schermo. La fascia verde discreta indica la zona abitabile di una stella vicina.
- La camera segue dolcemente la stella dominante e passa gradualmente al baricentro quando compare una massa paragonabile. Rotella o `−/+`: zoom; destro, centrale o Maiusc + trascinamento: pan. Il pan passa al controllo manuale; lo zoom conserva l’inseguimento. Tieni premute le **quattro frecce della tastiera** per muovere liberamente la camera (anche in diagonale), passando al controllo manuale; **Segui corpo** centra e accompagna il selezionato. `Esc`: annulla il lancio; `Spazio` o `Ⅱ`: pausa.
- Arriva un pezzo ogni **14 secondi**, fino a **5** in coda. Sotto 2 pezzi il timer accelera: attesa massima 4 secondi con un solo pezzo, 2 con coda vuota. A coda piena un nuovo arrivo lancia automaticamente il primo.
- Orbite completate, ellissi, passaggi ravvicinati, accelerazioni, catture, sistemi binari e vita danno punti. La combo arriva a ×8; scade dopo 9 secondi senza eventi. Le orbite larghe rendono meno.
- **UNA CIVILTÀ È NATA** identifica il pianeta, lo evidenzia per 14 secondi e produce un annuncio vocale prioritario. I pianeti hanno nomi persistenti; SOS e nascite fuori camera mostrano indicatori direzionali. Le luci notturne e il satellite avanzato restano visibili. Calore, freddo e fasci pulsar sono pericolosi.
- Le comete premiano **PASSAGGIO SOLARE**, **RASOIO COSMICO**, fionde e **RITORNO DELLA COMETA**, con bonus più alti. Inoltre seminano i pianeti nella fascia abitabile: un passaggio entro 38 unità dalla superficie consegna acqua e semi (+28 vita su mondi sterili, +20 su mondi promettenti), una sola volta per pianeta e cometa. Il **Micro-asteroide** ha massa 0,2, ricarica 2 secondi e non consuma la coda: serve a ritocchi di velocità con gravità o piccoli impatti. Gli urti leggeri non cancellano la civiltà. Asteroidi normali compaiono anche in coda e dal bordo come pericoli annunciati.
- Collisioni e fughe aumentano l’instabilità. Orbite completate e vita la riducono. Il collasso avviene a **100% per 10 secondi consecutivi**: c’è tempo per un salvataggio. La sequenza di collasso finisce in un Big Bang e offre una nuova partita.

Tre partenze: **Genesi**, **Due soli**, **L’abisso**. L’atlante comprende 23 corpi, con nove varianti planetarie: piccolo pianeta (2), roccioso (3), oceanico (4), Terra (5), Super-Terra (7), Mini-Nettuno (8), Nettuno (10), Saturno (12), Giove (16). Luna massa 1; Sole 90; buco nero stellare 220. Le stelle giganti esplodono dopo circa 120 secondi reali, più il rallentamento durante la mira.

## Ritmo del terzo pass

Distribuzione misurata su 20.480 arrivi deterministici (160 partite di 30 minuti, seme 2026): **58,52% pianeti/lune, 15,33% giganti, 13,37% comete/asteroidi, 8,29% stelle/nane bianche, 3,31% pulsar/neutroni/binarie, 1,19% buchi neri**. Le percentuali della singola partita oscillano, soprattutto all'inizio.

Stelle eleggibili da 2 minuti, compatti da 4, buchi neri da 7; massicci da 15 e supermassicci da 25. Intervalli minimi fra eventi della stessa categoria: 45, 100 e 240 secondi. Dopo una stella ci sono 20 secondi di quiete, dopo un compatto 35, dopo un buco nero 70. Gli eventi bloccati diventano pianeti/lune; gli hazard rispettano la quiete. Le partenze alternative mantengono il loro scenario iniziale.

## Modello e scelte arcade

Gravità reciproca N-body, identica per tutte le tipologie. Un buco nero e una stella di pari massa esercitano la stessa forza a pari distanza. Integratore leapfrog a passi fissi con due sottopassi fisici; tempo cosmico 3× (0,36× durante la mira). Le masse stellari crescono e G scende a 720, mantenendo leggibile la velocità delle prime orbite. Nessun corpo è ancorato o guidato dopo il lancio. Addolcimento gravitazionale per evitare singolarità numeriche. Settore di raggio 3.800 unità **centrato sul sistema principale in movimento**, zoom 12–280%. Il confine non espelle più sistemi soltanto perché traslano lontano dall’origine.

Fusioni e frammentazioni planetarie conservano massa e quantità di moto. Gli urti veloci producono 3 frammenti fisici; molte altre particelle sono solo decorative. Stelle, giganti e oggetti compatti possono inglobare corpi. Una supernova perde massa, espelle quattro frammenti e imprime una spinta arcade ai vicini. Il limite di 80 corpi fisici evita una crescita incontrollata; se il settore è saturo gli arrivi forzati portano al collasso, senza cancellazioni silenziose.

La previsione copia e integra l’intero sistema per circa 2,25 periodi stimati. Con due corpi isolati arriva fino a 14.000 secondi cosmici, con passo adattato alla scala dell’orbita; nei sistemi complessi si limita a 360. La validazione lunare usa lo stesso sottopasso della fisica dal vivo (1/120), mira a 3,25 periodi, fino a 180 secondi, e richiede almeno due giri verificati per il verde. Mostra circa il primo giro per evitare sovrapposizioni. Le orbite ampie conservano inoltre una guida ellittica completa tratteggiata: è una stima istantanea, distinta dalla traiettoria numerica. Nei sistemi complessi un ritorno oltre l’orizzonte viene indicato come probabile, non verificato.

Energia e punti estremi riconoscono caduta e fuga anche oltre l’orizzonte numerico. Il riferimento delle orbite circumbinarie usa posizione e velocità del baricentro delle due stelle; il campo sotto il cursore mostra invece la forza effettiva delle singole masse e le zone contese. Un controllo continuo dei segmenti rileva gli attraversamenti rapidi. Impatti fra altri corpi e stelle prossime alla supernova impediscono il verde; le trasformazioni non vengono simulate nella previsione. Futuri lanci e perturbazioni a lunghissimo termine non sono garantiti.

L’assistenza interviene entro circa 35° dalla tangente e tra il 55% e il 148% della velocità circolare, sfumando ai bordi. Nel centro della zona assistita mantiene il 16% dell’errore intenzionale (6% per le lune), senza imporre un’orbita perfetta. Le zone satellite usano una frazione prudente della sfera di Hill calcolata al pericentro del pianeta e la sua dimensione fisica. La scala del drag mantiene almeno 44 pixel per la velocità suggerita anche alle distanze esterne e con zoom basso. Durante mira/selezione i gradienti e le linee di campo coprono anche lo spazio lontano: etichetta del dominante, intensità, zona contesa e freccia risultante aiutano la lettura.

Il vortice dei buchi neri è un effetto grafico crescente, non un raggio di cattura. La resa simula un disco/distorsione con archi, senza ray tracing relativistico. Le voci usano la sintesi vocale del browser se disponibile; i suoni sono sintetizzati con Web Audio, e il gioco funziona anche senza voce. Record salvato solo localmente. Partita e camera non vengono salvate alla chiusura.

## Verifiche

```sh
npm test
```

60 test automatici (50 originali + 10 del quarto pass in `tests/contracts.test.mjs`). Regressioni del terzo pass: Luna su pianeta con scudo avanzato, orbite di Nettuno a 900/1.800/2.800 unità con ritorno numerico, circumbinaria, fuga distinta da impatto, camera su sistema traslato, campo lontano/conteso, micro-asteroidi, semina delle comete e sei famiglie di spawn.

Test fisici: orbita binaria per 100 periodi, conservazione di massa e momento, frammentazione, accrescimento, supernova, previsione non distruttiva, coincidenza delle coordinate e settore misto. Il test di tolleranza copre 90 combinazioni di distanza, direzione e velocità; altri test verificano tre rivoluzioni dopo lanci assistiti e la stabilità di una Luna con riferimento planetario in movimento.

Test del ciclo reale di gioco con adattatore DOM minimo: timer, recupero della coda, mira al 12% con timer attivo, camera, pausa, overflow, primo premio rapido, nomi e segnali delle civiltà, avvisi asteroidi, collasso e fino a 10 minuti senza input (o fino al collasso). L’adattatore non sostituisce la fisica. Nel browser sono stati verificati il lancio impreciso, il premio immediato, il campo e l’interfaccia.

## File

- `src/physics.js`: corpi, gravità e collisioni.
- `src/orbits.js`: riferimenti locali, elementi orbitali e assistenza al lancio.
- `src/prediction.js`: verifica e previsione N-body.
- `src/camera.js`: centro del sistema e inseguimento del corpo selezionato.
- `src/biology.js`: semina delle comete e condizioni abitabili.
- `src/pacing.js`: distribuzione, cooldown e ritmo della coda.
- `src/game.js`: ciclo di gioco, punteggio, vita, input e interfaccia.
- `src/render.js`: Canvas, corpi, scie, griglia spazio-tempo, particelle e traiettorie.
- `src/textures.js`: rumore procedurale, texture di pianeti e stelle, nebulosa.
- `src/contracts.js`: contratti cosmici e ranghi.
- `src/audio.js`: suoni e comunicazioni.
- `index.html` / `style.css`: interfaccia adattiva senza librerie.
- `server.mjs`: server statico locale.

Pensato soprattutto per mouse e schermo desktop. Il layout si adatta alle finestre strette; il controllo touch completo non è incluso. È un prototipo giocabile: il bilanciamento delle partite lunghe può essere ulteriormente affinato con playtest umani.
