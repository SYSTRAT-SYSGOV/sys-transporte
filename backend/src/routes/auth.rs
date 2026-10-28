use axum::{extract::State, routing::post, Json, Router};
use chrono::{Duration, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{
    auth::{create_access_token, hash_refresh_token, new_refresh_token, verify_password, AuthUser},
    error::{AppError, AppResult},
    state::{AppState, ReqCtx},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login))
        .route("/refresh", post(refresh))
        .route("/logout", post(logout))
        .route("/me", axum::routing::get(me))
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct SessionUser {
    pub id: String,
    pub full_name: String,
    pub email: String,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: &'static str,
    pub expires_in: i64,
    pub user: SessionUser,
}

#[derive(Debug, FromRow)]
struct UserRow {
    id: String,
    email: String,
    password_hash: String,
    full_name: String,
    is_active: bool,
    failed_attempts: i32,
    locked_until: Option<NaiveDateTime>,
    token_version: i32,
}

async fn load_roles(state: &AppState, user_id: &str) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = ? ORDER BY r.code",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
}

async fn issue_refresh(state: &AppState, user_id: &str) -> Result<String, AppError> {
    let token = new_refresh_token();
    let expires_at = Utc::now().naive_utc() + Duration::days(state.config.refresh_token_days);
    sqlx::query(
        "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(uuid::Uuid::now_v7().to_string())
    .bind(user_id)
    .bind(hash_refresh_token(&token))
    .bind(expires_at)
    .execute(&state.pool)
    .await?;
    Ok(token)
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> AppResult<Json<LoginResponse>> {
    let email = body.email.trim().to_ascii_lowercase();
    if email.is_empty() || body.password.is_empty() {
        return Err(AppError::validation_single(
            "email",
            "e-mail e senha são obrigatórios",
        ));
    }

    let user = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, password_hash, full_name, is_active, failed_attempts,
                locked_until, token_version
         FROM users WHERE email = ? AND deleted_at IS NULL",
    )
    .bind(&email)
    .fetch_optional(&state.pool)
    .await?;

    let Some(user) = user else {
        return Err(AppError::unauthorized("Credenciais inválidas"));
    };

    let now = Utc::now().naive_utc();
    if let Some(until) = user.locked_until {
        if until > now {
            return Err(AppError::locked(
                "Conta temporariamente bloqueada por tentativas inválidas",
            ));
        }
    }

    if !user.is_active {
        return Err(AppError::unauthorized("Credenciais inválidas"));
    }

    if !verify_password(&body.password, &user.password_hash) {
        let attempts = user.failed_attempts + 1;
        if attempts >= 5 {
            sqlx::query("UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?")
                .bind(now + Duration::minutes(15))
                .bind(&user.id)
                .execute(&state.pool)
                .await?;
        } else {
            sqlx::query("UPDATE users SET failed_attempts = ? WHERE id = ?")
                .bind(attempts)
                .bind(&user.id)
                .execute(&state.pool)
                .await?;
        }
        return Err(AppError::unauthorized("Credenciais inválidas"));
    }

    sqlx::query(
        "UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?",
    )
    .bind(now)
    .bind(&user.id)
    .execute(&state.pool)
    .await?;

    let (access_token, expires_in) =
        create_access_token(&state, &user.id, &user.email, user.token_version)?;
    let refresh_token = issue_refresh(&state, &user.id).await?;
    let permissions = state.permissions_for(&user.id).await?;
    let roles = load_roles(&state, &user.id).await?;

    Ok(Json(LoginResponse {
        access_token,
        refresh_token,
        token_type: "Bearer",
        expires_in,
        user: SessionUser {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            roles,
            permissions,
        },
    }))
}

pub async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> AppResult<Json<LoginResponse>> {
    let hash = hash_refresh_token(&body.refresh_token);
    let row: Option<(String, String, NaiveDateTime, Option<NaiveDateTime>)> = sqlx::query_as(
        "SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?",
    )
    .bind(&hash)
    .fetch_optional(&state.pool)
    .await?;

    let Some((token_id, user_id, expires_at, revoked_at)) = row else {
        return Err(AppError::unauthorized("Token de renovação inválido"));
    };

    if revoked_at.is_some() || expires_at < Utc::now().naive_utc() {
        return Err(AppError::unauthorized("Token de renovação expirado"));
    }

    let user: Option<(String, String, bool, i32)> = sqlx::query_as(
        "SELECT id, email, is_active, token_version FROM users
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&user_id)
    .fetch_optional(&state.pool)
    .await?;

    let Some((id, email, is_active, token_version)) = user else {
        return Err(AppError::unauthorized("Usuário não encontrado"));
    };
    if !is_active {
        return Err(AppError::unauthorized("Usuário inativo"));
    }

    sqlx::query("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?")
        .bind(Utc::now().naive_utc())
        .bind(&token_id)
        .execute(&state.pool)
        .await?;

    let (access_token, expires_in) = create_access_token(&state, &id, &email, token_version)?;
    let refresh_token = issue_refresh(&state, &id).await?;
    let permissions = state.permissions_for(&id).await?;
    let roles = load_roles(&state, &id).await?;
    let full_name: String = sqlx::query_scalar("SELECT full_name FROM users WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.pool)
        .await?;

    Ok(Json(LoginResponse {
        access_token,
        refresh_token,
        token_type: "Bearer",
        expires_in,
        user: SessionUser {
            id,
            full_name,
            email,
            roles,
            permissions,
        },
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<RefreshRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let hash = hash_refresh_token(&body.refresh_token);
    sqlx::query(
        "UPDATE refresh_tokens SET revoked_at = ?
         WHERE token_hash = ? AND user_id = ? AND revoked_at IS NULL",
    )
    .bind(Utc::now().naive_utc())
    .bind(hash)
    .bind(&auth.id)
    .execute(&state.pool)
    .await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

pub async fn me(
    State(state): State<AppState>,
    auth: AuthUser,
    _ctx: ReqCtx,
) -> AppResult<Json<SessionUser>> {
    let roles = load_roles(&state, &auth.id).await?;
    Ok(Json(SessionUser {
        id: auth.id,
        full_name: auth.full_name,
        email: auth.email,
        roles,
        permissions: auth.permissions.into_iter().collect(),
    }))
}
