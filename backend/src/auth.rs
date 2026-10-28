use std::collections::HashSet;

use axum::{
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts, HeaderMap},
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{
    error::AppError,
    state::{AppState, ReqCtx},
};

pub mod perms {
    pub const USER_MANAGE: &str = "identity.user.manage";
    pub const ROLE_MANAGE: &str = "identity.role.manage";
    pub const AUDIT_READ: &str = "identity.audit.read";

    pub const SCHOOL_READ: &str = "registry.school.read";
    pub const SCHOOL_MANAGE: &str = "registry.school.manage";
    pub const STUDENT_READ: &str = "registry.student.read";
    pub const STUDENT_MANAGE: &str = "registry.student.manage";
    pub const ENROLLMENT_READ: &str = "registry.enrollment.read";
    pub const ENROLLMENT_MANAGE: &str = "registry.enrollment.manage";

    pub const COMPANY_READ: &str = "transport.company.read";
    pub const COMPANY_MANAGE: &str = "transport.company.manage";
    pub const DRIVER_READ: &str = "transport.driver.read";
    pub const DRIVER_MANAGE: &str = "transport.driver.manage";
    pub const VEHICLE_READ: &str = "transport.vehicle.read";
    pub const VEHICLE_MANAGE: &str = "transport.vehicle.manage";
    pub const INSPECTION_READ: &str = "transport.inspection.read";
    pub const INSPECTION_MANAGE: &str = "transport.inspection.manage";
    pub const STOP_READ: &str = "transport.stop.read";
    pub const STOP_MANAGE: &str = "transport.stop.manage";
    pub const ROUTE_READ: &str = "transport.route.read";
    pub const ROUTE_MANAGE: &str = "transport.route.manage";
    pub const ALLOCATION_READ: &str = "transport.allocation.read";
    pub const ALLOCATION_MANAGE: &str = "transport.allocation.manage";
    pub const OVERRIDE_CAPACITY: &str = "transport.allocation.override_capacity";
    pub const CENSUS_READ: &str = "transport.census.read";
    pub const CENSUS_EXPORT: &str = "transport.census.export";
    pub const DASHBOARD_READ: &str = "transport.dashboard.read";
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub token_version: i32,
    pub iat: i64,
    pub exp: i64,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: String,
    pub email: String,
    pub full_name: String,
    pub permissions: HashSet<String>,
}

impl AuthUser {
    pub fn can(&self, permission: &str) -> bool {
        self.permissions.contains(permission)
    }

    pub fn require(&self, permission: &str) -> Result<(), AppError> {
        if self.can(permission) {
            Ok(())
        } else {
            Err(AppError::forbidden(format!(
                "Permissão necessária: {permission}"
            )))
        }
    }
}

pub fn validate_password(password: &str) -> Result<(), String> {
    if password.chars().count() < 8 {
        return Err("deve ter ao menos 8 caracteres".to_string());
    }
    if !password.chars().any(|c| c.is_alphabetic()) {
        return Err("deve conter ao menos uma letra".to_string());
    }
    if !password.chars().any(|c| c.is_numeric()) {
        return Err("deve conter ao menos um número".to_string());
    }
    Ok(())
}

pub fn hash_password(password: &str) -> Result<String, String> {
    use argon2::{
        password_hash::{PasswordHasher, SaltString},
        Argon2,
    };
    use rand::rngs::OsRng;

    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|err| err.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    use argon2::{
        password_hash::{PasswordHash, PasswordVerifier},
        Argon2,
    };

    match PasswordHash::new(hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    }
}

pub fn create_access_token(
    state: &AppState,
    user_id: &str,
    email: &str,
    token_version: i32,
) -> Result<(String, i64), AppError> {
    let now = Utc::now();
    let expires_in = state.config.access_token_minutes * 60;
    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        token_version,
        iat: now.timestamp(),
        exp: (now + Duration::seconds(expires_in)).timestamp(),
    };
    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|err| AppError::internal(err.to_string()))?;
    Ok((token, expires_in))
}

pub fn new_refresh_token() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn hash_refresh_token(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

pub async fn authenticate(state: &AppState, headers: &HeaderMap) -> Result<AuthUser, AppError> {
    let raw = headers
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::unauthorized("Token de acesso ausente"))?;

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    let decoded = decode::<Claims>(
        raw,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &validation,
    )
    .map_err(|_| AppError::unauthorized("Token de acesso inválido ou expirado"))?;

    let row: Option<(String, String, String, bool, i32)> = sqlx::query_as(
        "SELECT id, email, full_name, is_active, token_version
         FROM users WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&decoded.claims.sub)
    .fetch_optional(&state.pool)
    .await?;

    let (id, email, full_name, is_active, token_version) =
        row.ok_or_else(|| AppError::unauthorized("Usuário não encontrado"))?;

    if !is_active || token_version != decoded.claims.token_version {
        return Err(AppError::unauthorized("Sessão inválida"));
    }

    let permissions = state
        .permissions_for(&id)
        .await?
        .into_iter()
        .collect::<HashSet<_>>();

    Ok(AuthUser {
        id,
        email,
        full_name,
        permissions,
    })
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        authenticate(state, &parts.headers).await
    }
}

impl FromRequestParts<AppState> for ReqCtx {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        Ok(ReqCtx::from_headers(&parts.headers))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_policy_rejects_weak_values() {
        assert!(validate_password("curta1").is_err());
        assert!(validate_password("somenteletras").is_err());
        assert!(validate_password("12345678").is_err());
        assert!(validate_password("senha1234").is_ok());
    }

    #[test]
    fn hashes_and_verifies_password() {
        let hash = hash_password("senha1234").unwrap();
        assert!(verify_password("senha1234", &hash));
        assert!(!verify_password("outrasenha1", &hash));
        assert!(hash.starts_with("$argon2id$"));
    }

    #[test]
    fn refresh_tokens_are_hashed() {
        let token = new_refresh_token();
        assert_eq!(token.len(), 64);
        assert_eq!(hash_refresh_token(&token).len(), 64);
        assert_ne!(token, hash_refresh_token(&token));
    }
}
