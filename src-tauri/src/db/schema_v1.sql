-- Schema iniziale di Segna-Asta.
--
-- Nessun valore derivato è persistito: crediti residui, slot mancanti e
-- inflazione si calcolano sempre da `picks`, così non esistono stati
-- incoerenti da riparare dopo un annullamento.

-- Ogni import del listone è una lista a sé: aggiornare le quotazioni non
-- tocca le aste già giocate, che continuano a puntare alla loro lista.
CREATE TABLE player_lists (
    id           INTEGER PRIMARY KEY,
    label        TEXT    NOT NULL,
    source_file  TEXT    NOT NULL,
    imported_at  TEXT    NOT NULL,
    player_count INTEGER NOT NULL CHECK (player_count >= 0)
);

CREATE TABLE players (
    id           INTEGER PRIMARY KEY,
    list_id      INTEGER NOT NULL REFERENCES player_lists(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    serie_a_team TEXT    NOT NULL,
    role         TEXT    NOT NULL CHECK (role IN ('P', 'D', 'C', 'A')),
    quotation    INTEGER NOT NULL CHECK (quotation >= 1),
    UNIQUE (list_id, name)
);

CREATE INDEX players_by_role ON players (list_id, role);
CREATE INDEX players_by_team ON players (list_id, serie_a_team);

CREATE TABLE auctions (
    id            INTEGER PRIMARY KEY,
    name          TEXT    NOT NULL,
    list_id       INTEGER NOT NULL REFERENCES player_lists(id),
    budget        INTEGER NOT NULL CHECK (budget > 0),
    slot_p        INTEGER NOT NULL CHECK (slot_p >= 0),
    slot_d        INTEGER NOT NULL CHECK (slot_d >= 0),
    slot_c        INTEGER NOT NULL CHECK (slot_c >= 0),
    slot_a        INTEGER NOT NULL CHECK (slot_a >= 0),
    created_at    TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'live', 'closed')),
    is_simulation INTEGER NOT NULL DEFAULT 0 CHECK (is_simulation IN (0, 1))
);

CREATE TABLE managers (
    id          INTEGER PRIMARY KEY,
    auction_id  INTEGER NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    is_me       INTEGER NOT NULL DEFAULT 0 CHECK (is_me IN (0, 1)),
    order_index INTEGER NOT NULL,
    UNIQUE (auction_id, name)
);

-- In un'asta ci sono molti partecipanti ma uno solo sono io.
CREATE UNIQUE INDEX managers_one_me ON managers (auction_id) WHERE is_me = 1;

CREATE TABLE picks (
    id         INTEGER PRIMARY KEY,
    auction_id INTEGER NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    player_id  INTEGER NOT NULL REFERENCES players(id),
    manager_id INTEGER NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
    price      INTEGER NOT NULL CHECK (price >= 0),
    seq        INTEGER NOT NULL,
    picked_at  TEXT    NOT NULL,
    -- Un giocatore finisce a un solo partecipante.
    UNIQUE (auction_id, player_id)
);

CREATE INDEX picks_by_manager ON picks (manager_id);
CREATE INDEX picks_by_order ON picks (auction_id, seq);

CREATE TABLE wishlist (
    id           INTEGER PRIMARY KEY,
    auction_id   INTEGER NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    player_id    INTEGER NOT NULL REFERENCES players(id),
    -- 1 Top, 2 Buono, 3 Ripiego, 4 Scommessa
    tier         INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 4),
    target_price INTEGER CHECK (target_price IS NULL OR target_price >= 0),
    max_bid      INTEGER CHECK (max_bid IS NULL OR max_bid >= 0),
    priority     INTEGER NOT NULL,
    -- Etichetta libera per marcare alternative intercambiabili.
    group_label  TEXT,
    notes        TEXT,
    UNIQUE (auction_id, player_id)
);

CREATE INDEX wishlist_by_priority ON wishlist (auction_id, priority);

-- Come intendo ripartire il budget fra i reparti, in percentuale.
CREATE TABLE budget_plan (
    auction_id INTEGER NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    role       TEXT    NOT NULL CHECK (role IN ('P', 'D', 'C', 'A')),
    target_pct REAL    NOT NULL CHECK (target_pct >= 0),
    PRIMARY KEY (auction_id, role)
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
