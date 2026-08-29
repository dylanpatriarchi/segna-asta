-- Le fasce (Top/Buono/Ripiego/Scommessa) si sono rivelate una
-- classificazione di troppo: durante la preparazione il reparto è già il
-- modo naturale di ragionare, e una seconda dimensione costringeva a
-- decidere due volte la stessa cosa.
--
-- SQLite non lascia togliere una colonna citata da un CHECK, quindi la
-- tabella si ricrea e i dati si travasano.

CREATE TABLE wishlist_nuova (
    id           INTEGER PRIMARY KEY,
    auction_id   INTEGER NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    player_id    INTEGER NOT NULL REFERENCES players(id),
    target_price INTEGER CHECK (target_price IS NULL OR target_price >= 0),
    max_bid      INTEGER CHECK (max_bid IS NULL OR max_bid >= 0),
    priority     INTEGER NOT NULL,
    group_label  TEXT,
    notes        TEXT,
    UNIQUE (auction_id, player_id)
);

INSERT INTO wishlist_nuova
    (id, auction_id, player_id, target_price, max_bid, priority, group_label, notes)
SELECT id, auction_id, player_id, target_price, max_bid, priority, group_label, notes
    FROM wishlist;

DROP TABLE wishlist;

ALTER TABLE wishlist_nuova RENAME TO wishlist;

CREATE INDEX wishlist_by_priority ON wishlist (auction_id, priority);
