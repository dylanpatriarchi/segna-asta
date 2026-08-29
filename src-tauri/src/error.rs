use serde::{Serialize, Serializer};

/// Gli errori che l'app può restituire al frontend. I messaggi sono in
/// italiano perché finiscono direttamente sotto gli occhi di chi usa l'app.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("errore del database: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("impossibile leggere il file: {0}")]
    Io(#[from] std::io::Error),

    #[error("il file XLSX non è leggibile: {0}")]
    Xlsx(#[from] calamine::XlsxError),

    /// Dati rifiutati prima ancora di toccare il database.
    #[error("{0}")]
    Invalid(String),

    #[error("{0}")]
    NotFound(String),
}

impl AppError {
    pub fn invalid(msg: impl Into<String>) -> Self {
        Self::Invalid(msg.into())
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(msg.into())
    }
}

/// Il frontend riceve la stringa dell'errore, non la sua struttura interna.
impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
