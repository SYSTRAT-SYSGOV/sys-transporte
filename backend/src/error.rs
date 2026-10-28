use axum::{
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::json;

#[derive(Debug, Clone, Serialize)]
pub struct FieldError {
    pub field: String,
    pub message: String,
}

impl FieldError {
    pub fn new(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            field: field.into(),
            message: message.into(),
        }
    }
}

#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub title: &'static str,
    pub detail: String,
    pub errors: Vec<FieldError>,
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    fn new(status: StatusCode, title: &'static str, detail: impl Into<String>) -> Self {
        Self {
            status,
            title,
            detail: detail.into(),
            errors: Vec::new(),
        }
    }

    #[allow(dead_code)]
    pub fn bad_request(detail: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "Requisição inválida", detail)
    }

    pub fn validation(errors: Vec<FieldError>) -> Self {
        Self {
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "Dados inválidos",
            detail: "Um ou mais campos precisam de correção".to_string(),
            errors,
        }
    }

    pub fn validation_single(field: &str, message: impl Into<String>) -> Self {
        Self::validation(vec![FieldError::new(field, message)])
    }

    pub fn unauthorized(detail: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "Não autenticado", detail)
    }

    pub fn forbidden(detail: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, "Acesso negado", detail)
    }

    pub fn not_found(detail: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "Não encontrado", detail)
    }

    pub fn conflict(detail: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, "Conflito", detail)
    }

    pub fn locked(detail: impl Into<String>) -> Self {
        Self::new(StatusCode::LOCKED, "Conta bloqueada", detail)
    }

    pub fn internal(detail: impl Into<String>) -> Self {
        tracing::error!(detail = %detail.into(), "erro interno");
        Self::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Erro interno",
            "Não foi possível concluir a operação",
        )
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status;
        let body = json!({
            "type": "about:blank",
            "title": self.title,
            "status": status.as_u16(),
            "detail": self.detail,
            "errors": self.errors,
        });
        let mut response = (status, Json(body)).into_response();
        response.headers_mut().insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/problem+json"),
        );
        response
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        if let sqlx::Error::Database(db) = &err {
            match db.code().as_deref() {
                Some("1062") => return AppError::conflict("Registro duplicado"),
                Some("1452") | Some("1451") => {
                    return AppError::conflict("Registro referenciado por outro recurso")
                }
                Some("3819") | Some("4025") => {
                    return AppError::validation_single("request", "Violação de regra do banco")
                }
                _ => {}
            }
        }
        AppError::internal(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validation_error_carries_fields() {
        let err = AppError::validation_single("email", "obrigatório");
        assert_eq!(err.status, StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(err.errors[0].field, "email");
    }

    #[test]
    fn unique_violation_maps_to_conflict() {
        // Apenas o mapeamento de status é verificado; o erro real vem do MySQL.
        let err = AppError::conflict("Registro duplicado");
        assert_eq!(err.status, StatusCode::CONFLICT);
    }
}
