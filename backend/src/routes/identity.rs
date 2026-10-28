use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Json, Router,
};
use chrono::{NaiveDate, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::FromRow;

use crate::{
    audit::{record, AuditEvent},
    auth::{hash_password, perms::*, validate_password, AuthUser},
    error::{AppError, AppResult, FieldError},
    pagination::{ListQuery, Page},
    state::{AppState, ReqCtx},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/users", get(list_users).post(create_user))
        .route("/users/{id}", put(update_user))
        .route("/users/{id}/unlock", post(unlock_user))
        .route("/users/{id}/password", post(reset_password))
        .route("/roles", get(list_roles).post(create_role))
        .route("/roles/{id}", put(update_role))
        .route("/permissions", get(list_permissions))
        .route("/audit", get(list_audit))
}

#[derive(Debug, Serialize)]
struct RoleRef {
    id: String,
    code: String,
    name: String,
}

#[derive(Debug, Serialize)]
pub struct UserDto {
    id: String,
    email: String,
    full_name: String,
    is_active: bool,
    failed_attempts: i32,
    locked_until: Option<NaiveDateTime>,
    last_login_at: Option<NaiveDateTime>,
    created_at: NaiveDateTime,
    roles: Vec<RoleRef>,
}

#[derive(Debug, FromRow)]
struct UserRow {
    id: String,
    email: String,
    full_name: String,
    is_active: bool,
    failed_attempts: i32,
    locked_until: Option<NaiveDateTime>,
    last_login_at: Option<NaiveDateTime>,
    created_at: NaiveDateTime,
}

async fn roles_for(pool: &sqlx::MySqlPool, user_id: &str) -> Result<Vec<RoleRef>, sqlx::Error> {
    let rows: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT r.id, r.code, r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = ? ORDER BY r.name",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(id, code, name)| RoleRef { id, code, name })
        .collect())
}

fn to_dto(row: UserRow, roles: Vec<RoleRef>) -> UserDto {
    UserDto {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        is_active: row.is_active,
        failed_attempts: row.failed_attempts,
        locked_until: row.locked_until,
        last_login_at: row.last_login_at,
        created_at: row.created_at,
        roles,
    }
}

pub async fn list_users(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ListQuery>,
) -> AppResult<Json<Page<UserDto>>> {
    auth.require(USER_MANAGE)?;
    let pagination = query.pagination()?;
    let search = format!("%{}%", query.search.clone().unwrap_or_default());

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users
         WHERE deleted_at IS NULL AND full_name LIKE ? AND (full_name LIKE ? OR email LIKE ?)",
    )
    .bind(&search)
    .bind(&search)
    .bind(&search)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, full_name, is_active, failed_attempts, locked_until,
                last_login_at, created_at
         FROM users
         WHERE deleted_at IS NULL AND full_name LIKE ? AND (full_name LIKE ? OR email LIKE ?)
         ORDER BY full_name LIMIT ? OFFSET ?",
    )
    .bind(&search)
    .bind(&search)
    .bind(&search)
    .bind(pagination.per_page)
    .bind(pagination.offset)
    .fetch_all(&state.pool)
    .await?;

    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        let roles = roles_for(&state.pool, &row.id).await?;
        items.push(to_dto(row, roles));
    }
    Ok(Json(Page::new(items, pagination, total)))
}

#[derive(Debug, Deserialize)]
pub struct CreateUser {
    pub full_name: String,
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub role_ids: Vec<String>,
}

pub async fn create_user(
    State(state): State<AppState>,
    auth: AuthUser,
    ctx: ReqCtx,
    Json(body): Json<CreateUser>,
) -> AppResult<Json<UserDto>> {
    auth.require(USER_MANAGE)?;
    validate_user_payload(&body.full_name, &body.email, &body.password)?;

    let email = body.email.trim().to_ascii_lowercase();
    let hash = hash_password(&body.password)
        .map_err(|err| AppError::internal(format!("hash de senha: {err}")))?;
    let id = uuid::Uuid::now_v7().to_string();

    let mut tx = state.pool.begin().await?;
    sqlx::query("INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&email)
        .bind(hash)
        .bind(body.full_name.trim())
        .execute(&mut *tx)
        .await?;

    assign_roles(&mut tx, &id, &body.role_ids).await?;

    record(
        &mut *tx,
        AuditEvent {
            actor_id: Some(&auth.id),
            actor_email: Some(&auth.email),
            action: "create",
            resource: "identity.user",
            resource_id: Some(&id),
            before: None,
            after: Some(&json!({ "email": email, "full_name": body.full_name })),
            ip: ctx.ip.as_deref(),
            request_id: ctx.request_id.as_deref(),
            result: "success",
        },
    )
    .await?;
    tx.commit().await?;

    let row = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, full_name, is_active, failed_attempts, locked_until,
                last_login_at, created_at FROM users WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await?;
    let roles = roles_for(&state.pool, &id).await?;
    Ok(Json(to_dto(row, roles)))
}

#[derive(Debug, Deserialize)]
pub struct UpdateUser {
    pub full_name: String,
    pub email: String,
    pub is_active: bool,
    #[serde(default)]
    pub role_ids: Vec<String>,
}

pub async fn update_user(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<UpdateUser>,
) -> AppResult<Json<UserDto>> {
    auth.require(USER_MANAGE)?;

    let current: Option<(String, String, bool)> = sqlx::query_as(
        "SELECT full_name, email, is_active FROM users WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await?;
    let Some((old_name, old_email, was_active)) = current else {
        return Err(AppError::not_found("Usuário não encontrado"));
    };

    if id == auth.id && !body.is_active {
        return Err(AppError::conflict(
            "Não é possível desativar a própria conta",
        ));
    }

    if id == auth.id {
        let admin_role_id: Option<String> =
            sqlx::query_scalar("SELECT id FROM roles WHERE code = 'admin'")
                .fetch_optional(&state.pool)
                .await?;
        if let Some(admin_id) = admin_role_id {
            if !body.role_ids.contains(&admin_id) {
                return Err(AppError::conflict(
                    "Não é possível remover o próprio papel de administrador",
                ));
            }
        }
    }

    if body.full_name.trim().is_empty() || !body.email.contains('@') {
        return Err(AppError::validation(vec![
            FieldError::new("full_name", "obrigatório"),
            FieldError::new("email", "inválido"),
        ]));
    }

    let email = body.email.trim().to_ascii_lowercase();
    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "UPDATE users SET full_name = ?, email = ?, is_active = ?,
                token_version = token_version + ? WHERE id = ?",
    )
    .bind(body.full_name.trim())
    .bind(&email)
    .bind(body.is_active)
    .bind(if was_active && !body.is_active { 1 } else { 0 })
    .bind(&id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("DELETE FROM user_roles WHERE user_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await?;
    assign_roles(&mut tx, &id, &body.role_ids).await?;

    record(
        &mut *tx,
        AuditEvent {
            actor_id: Some(&auth.id),
            actor_email: Some(&auth.email),
            action: "update",
            resource: "identity.user",
            resource_id: Some(&id),
            before: Some(&json!({ "full_name": old_name, "email": old_email, "is_active": was_active })),
            after: Some(&json!({ "full_name": body.full_name, "email": email, "is_active": body.is_active })),
            ip: ctx.ip.as_deref(),
            request_id: ctx.request_id.as_deref(),
            result: "success",
        },
    )
    .await?;
    tx.commit().await?;

    state.invalidate_permissions(&id).await;

    let row = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, full_name, is_active, failed_attempts, locked_until,
                last_login_at, created_at FROM users WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await?;
    let roles = roles_for(&state.pool, &id).await?;
    Ok(Json(to_dto(row, roles)))
}

pub async fn unlock_user(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(USER_MANAGE)?;
    let affected =
        sqlx::query("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?")
            .bind(&id)
            .execute(&state.pool)
            .await?
            .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Usuário não encontrado"));
    }
    record(
        &state.pool,
        AuditEvent {
            actor_id: Some(&auth.id),
            actor_email: Some(&auth.email),
            action: "unlock",
            resource: "identity.user",
            resource_id: Some(&id),
            before: None,
            after: None,
            ip: ctx.ip.as_deref(),
            request_id: ctx.request_id.as_deref(),
            result: "success",
        },
    )
    .await?;
    Ok(Json(json!({ "status": "ok" })))
}

#[derive(Debug, Deserialize)]
pub struct ResetPassword {
    pub password: String,
}

pub async fn reset_password(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<ResetPassword>,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(USER_MANAGE)?;
    validate_password(&body.password)
        .map_err(|message| AppError::validation_single("password", message))?;
    let hash = hash_password(&body.password)
        .map_err(|err| AppError::internal(format!("hash de senha: {err}")))?;

    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?",
    )
    .bind(hash)
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Usuário não encontrado"));
    }
    sqlx::query(
        "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
    )
    .bind(Utc::now().naive_utc())
    .bind(&id)
    .execute(&mut *tx)
    .await?;
    record(
        &mut *tx,
        AuditEvent {
            actor_id: Some(&auth.id),
            actor_email: Some(&auth.email),
            action: "reset_password",
            resource: "identity.user",
            resource_id: Some(&id),
            before: None,
            after: None,
            ip: ctx.ip.as_deref(),
            request_id: ctx.request_id.as_deref(),
            result: "success",
        },
    )
    .await?;
    tx.commit().await?;
    state.invalidate_permissions(&id).await;
    Ok(Json(json!({ "status": "ok" })))
}

#[derive(Debug, Serialize)]
pub struct RoleDto {
    id: String,
    code: String,
    name: String,
    description: Option<String>,
    is_system: bool,
    permissions: Vec<String>,
}

pub async fn list_roles(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<RoleDto>>> {
    auth.require(ROLE_MANAGE)?;
    let rows: Vec<(String, String, String, Option<String>, bool)> =
        sqlx::query_as("SELECT id, code, name, description, is_system FROM roles ORDER BY name")
            .fetch_all(&state.pool)
            .await?;

    let mut roles = Vec::with_capacity(rows.len());
    for (id, code, name, description, is_system) in rows {
        let permissions: Vec<String> = sqlx::query_scalar(
            "SELECT permission_code FROM role_permissions WHERE role_id = ? ORDER BY permission_code",
        )
        .bind(&id)
        .fetch_all(&state.pool)
        .await?;
        roles.push(RoleDto {
            id,
            code,
            name,
            description,
            is_system,
            permissions,
        });
    }
    Ok(Json(roles))
}

#[derive(Debug, Deserialize)]
pub struct RolePayload {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub permission_codes: Vec<String>,
}

pub async fn create_role(
    State(state): State<AppState>,
    auth: AuthUser,
    ctx: ReqCtx,
    Json(body): Json<RolePayload>,
) -> AppResult<Json<RoleDto>> {
    auth.require(ROLE_MANAGE)?;
    validate_role(&body)?;
    let id = uuid::Uuid::now_v7().to_string();

    let mut tx = state.pool.begin().await?;
    sqlx::query("INSERT INTO roles (id, code, name, description) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(body.code.trim())
        .bind(body.name.trim())
        .bind(body.description.as_deref())
        .execute(&mut *tx)
        .await?;
    set_role_permissions(&mut tx, &id, &body.permission_codes).await?;
    record(
        &mut *tx,
        AuditEvent {
            actor_id: Some(&auth.id),
            actor_email: Some(&auth.email),
            action: "create",
            resource: "identity.role",
            resource_id: Some(&id),
            before: None,
            after: Some(&json!({ "code": body.code, "permissions": body.permission_codes })),
            ip: ctx.ip.as_deref(),
            request_id: ctx.request_id.as_deref(),
            result: "success",
        },
    )
    .await?;
    tx.commit().await?;
    state.invalidate_all_permissions().await;

    let permissions = body.permission_codes.clone();
    Ok(Json(RoleDto {
        id,
        code: body.code,
        name: body.name,
        description: body.description,
        is_system: false,
        permissions,
    }))
}

pub async fn update_role(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<RolePayload>,
) -> AppResult<Json<RoleDto>> {
    auth.require(ROLE_MANAGE)?;
    validate_role(&body)?;

    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query("UPDATE roles SET code = ?, name = ?, description = ? WHERE id = ?")
        .bind(body.code.trim())
        .bind(body.name.trim())
        .bind(body.description.as_deref())
        .bind(&id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Papel não encontrado"));
    }
    sqlx::query("DELETE FROM role_permissions WHERE role_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await?;
    set_role_permissions(&mut tx, &id, &body.permission_codes).await?;
    record(
        &mut *tx,
        AuditEvent {
            actor_id: Some(&auth.id),
            actor_email: Some(&auth.email),
            action: "update",
            resource: "identity.role",
            resource_id: Some(&id),
            before: None,
            after: Some(&json!({ "code": body.code, "permissions": body.permission_codes })),
            ip: ctx.ip.as_deref(),
            request_id: ctx.request_id.as_deref(),
            result: "success",
        },
    )
    .await?;
    tx.commit().await?;
    state.invalidate_all_permissions().await;

    Ok(Json(RoleDto {
        id,
        code: body.code,
        name: body.name,
        description: body.description,
        is_system: true,
        permissions: body.permission_codes,
    }))
}

pub async fn list_permissions(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<serde_json::Value>>> {
    auth.require(ROLE_MANAGE)?;
    let rows: Vec<(String, String)> =
        sqlx::query_as("SELECT code, description FROM permissions ORDER BY code")
            .fetch_all(&state.pool)
            .await?;
    Ok(Json(
        rows.into_iter()
            .map(|(code, description)| json!({ "code": code, "description": description }))
            .collect(),
    ))
}

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    pub resource: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AuditDto {
    id: String,
    actor_email: Option<String>,
    action: String,
    resource: String,
    resource_id: Option<String>,
    result: String,
    ip: Option<String>,
    request_id: Option<String>,
    created_at: NaiveDateTime,
    before_data: Option<serde_json::Value>,
    after_data: Option<serde_json::Value>,
}

pub async fn list_audit(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<AuditQuery>,
) -> AppResult<Json<Page<AuditDto>>> {
    auth.require(AUDIT_READ)?;
    let pagination = crate::pagination::Pagination::from_query(&crate::pagination::PageQuery {
        page: query.page,
        per_page: query.per_page,
    })?;
    let resource = query.resource.clone().unwrap_or_default();

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_events
         WHERE (? IS NULL OR DATE(created_at) >= ?)
           AND (? IS NULL OR DATE(created_at) <= ?)
           AND (? = '' OR resource = ?)",
    )
    .bind(query.from)
    .bind(query.from)
    .bind(query.to)
    .bind(query.to)
    .bind(&resource)
    .bind(&resource)
    .fetch_one(&state.pool)
    .await?;

    let items = sqlx::query_as::<_, AuditDto>(
        "SELECT id, actor_email, action, resource, resource_id, result, ip, request_id,
                created_at, before_data, after_data
         FROM audit_events
         WHERE (? IS NULL OR DATE(created_at) >= ?)
           AND (? IS NULL OR DATE(created_at) <= ?)
           AND (? = '' OR resource = ?)
         ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(query.from)
    .bind(query.from)
    .bind(query.to)
    .bind(query.to)
    .bind(&resource)
    .bind(&resource)
    .bind(pagination.per_page)
    .bind(pagination.offset)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(Page::new(items, pagination, total)))
}

fn validate_user_payload(full_name: &str, email: &str, password: &str) -> AppResult<()> {
    let mut errors = Vec::new();
    if full_name.trim().is_empty() {
        errors.push(FieldError::new("full_name", "obrigatório"));
    }
    if !email.contains('@') {
        errors.push(FieldError::new("email", "inválido"));
    }
    if let Err(message) = validate_password(password) {
        errors.push(FieldError::new("password", message));
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::validation(errors))
    }
}

fn validate_role(body: &RolePayload) -> AppResult<()> {
    let mut errors = Vec::new();
    if body.code.trim().is_empty() || body.code.contains(' ') {
        errors.push(FieldError::new("code", "obrigatório, sem espaços"));
    }
    if body.name.trim().is_empty() {
        errors.push(FieldError::new("name", "obrigatório"));
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::validation(errors))
    }
}

async fn assign_roles(
    tx: &mut sqlx::Transaction<'_, sqlx::MySql>,
    user_id: &str,
    role_ids: &[String],
) -> AppResult<()> {
    for role_id in role_ids {
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM roles WHERE id = ?")
            .bind(role_id)
            .fetch_one(&mut **tx)
            .await?;
        if exists == 0 {
            return Err(AppError::validation_single(
                "role_ids",
                format!("papel inexistente: {role_id}"),
            ));
        }
        sqlx::query("INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)")
            .bind(user_id)
            .bind(role_id)
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}

async fn set_role_permissions(
    tx: &mut sqlx::Transaction<'_, sqlx::MySql>,
    role_id: &str,
    permission_codes: &[String],
) -> AppResult<()> {
    for code in permission_codes {
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM permissions WHERE code = ?")
            .bind(code)
            .fetch_one(&mut **tx)
            .await?;
        if exists == 0 {
            return Err(AppError::validation_single(
                "permission_codes",
                format!("permissão inexistente: {code}"),
            ));
        }
        sqlx::query("INSERT IGNORE INTO role_permissions (role_id, permission_code) VALUES (?, ?)")
            .bind(role_id)
            .bind(code)
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}
