use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{FromRow, MySql, Transaction};

use crate::{
    audit::{record, AuditEvent},
    auth::{
        perms::{
            ENROLLMENT_MANAGE, ENROLLMENT_READ, SCHOOL_MANAGE, SCHOOL_READ, STUDENT_MANAGE,
            STUDENT_READ,
        },
        AuthUser,
    },
    domain::shift_valid,
    error::{AppError, AppResult, FieldError},
    pagination::{ListQuery, Page, PageQuery, Pagination},
    state::{AppState, ReqCtx},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/schools", get(list_schools).post(create_school))
        .route(
            "/schools/{id}",
            get(get_school).put(update_school).delete(delete_school),
        )
        .route("/students", get(list_students).post(create_student))
        .route(
            "/students/{id}",
            get(get_student).put(update_student).delete(delete_student),
        )
        .route("/guardians", get(list_guardians))
        .route("/academic-years", get(list_years).post(create_year))
        .route(
            "/enrollments",
            get(list_enrollments).post(create_enrollment),
        )
        .route("/enrollments/{id}/close", post(close_enrollment))
}

// ----------------------------- Escolas -----------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct SchoolDto {
    pub id: String,
    pub name: String,
    pub inep_code: Option<String>,
    pub education_network: String,
    pub city: Option<String>,
    pub state_uf: Option<String>,
    pub address: Option<String>,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct SchoolPayload {
    pub name: String,
    pub inep_code: Option<String>,
    pub education_network: Option<String>,
    pub city: Option<String>,
    pub state_uf: Option<String>,
    pub address: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_true() -> bool {
    true
}

fn default_presencial() -> String {
    "presencial".to_string()
}

fn default_country() -> String {
    "BR".to_string()
}

pub async fn list_schools(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ListQuery>,
) -> AppResult<Json<Page<SchoolDto>>> {
    auth.require(SCHOOL_READ)?;
    let pagination = query.pagination()?;
    let search = format!("%{}%", query.search.unwrap_or_default());
    let total: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM schools WHERE deleted_at IS NULL AND name LIKE ?")
            .bind(&search)
            .fetch_one(&state.pool)
            .await?;
    let items = sqlx::query_as::<_, SchoolDto>(
        "SELECT id, name, inep_code, education_network, city, state_uf, address, is_active, created_at
         FROM schools WHERE deleted_at IS NULL AND name LIKE ?
         ORDER BY name LIMIT ? OFFSET ?",
    )
    .bind(&search)
    .bind(pagination.per_page)
    .bind(pagination.offset)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(Page::new(items, pagination, total)))
}

pub async fn get_school(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<SchoolDto>> {
    auth.require(SCHOOL_READ)?;
    let item = sqlx::query_as::<_, SchoolDto>(
        "SELECT id, name, inep_code, education_network, city, state_uf, address, is_active, created_at
         FROM schools WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::not_found("Escola não encontrada"))?;
    Ok(Json(item))
}

pub async fn create_school(
    State(state): State<AppState>,
    auth: AuthUser,
    ctx: ReqCtx,
    Json(body): Json<SchoolPayload>,
) -> AppResult<Json<SchoolDto>> {
    auth.require(SCHOOL_MANAGE)?;
    validate_school(&body)?;
    let id = uuid::Uuid::now_v7().to_string();
    let network = body
        .education_network
        .clone()
        .unwrap_or_else(|| "municipal".to_string());
    if !["municipal", "estadual", "federal", "privada"].contains(&network.as_str()) {
        return Err(AppError::validation_single(
            "education_network",
            "valor inválido",
        ));
    }

    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO schools (id, name, inep_code, education_network, city, state_uf, address, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(body.name.trim())
    .bind(body.inep_code.as_deref().filter(|v| !v.is_empty()))
    .bind(&network)
    .bind(body.city.as_deref())
    .bind(body.state_uf.as_deref())
    .bind(body.address.as_deref())
    .bind(body.is_active)
    .execute(&mut *tx)
    .await?;
    audit(
        &mut tx,
        &auth,
        &ctx,
        "create",
        "registry.school",
        &id,
        Some(json!({
            "name": body.name, "inep_code": body.inep_code
        })),
    )
    .await?;
    tx.commit().await?;

    let item = sqlx::query_as::<_, SchoolDto>(
        "SELECT id, name, inep_code, education_network, city, state_uf, address, is_active, created_at
         FROM schools WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(item))
}

pub async fn update_school(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<SchoolPayload>,
) -> AppResult<Json<SchoolDto>> {
    auth.require(SCHOOL_MANAGE)?;
    validate_school(&body)?;
    let network = body
        .education_network
        .clone()
        .unwrap_or_else(|| "municipal".to_string());

    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE schools SET name = ?, inep_code = ?, education_network = ?, city = ?,
                state_uf = ?, address = ?, is_active = ? WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(body.name.trim())
    .bind(body.inep_code.as_deref().filter(|v| !v.is_empty()))
    .bind(&network)
    .bind(body.city.as_deref())
    .bind(body.state_uf.as_deref())
    .bind(body.address.as_deref())
    .bind(body.is_active)
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Escola não encontrada"));
    }
    audit(
        &mut tx,
        &auth,
        &ctx,
        "update",
        "registry.school",
        &id,
        Some(json!({
            "name": body.name, "inep_code": body.inep_code, "is_active": body.is_active
        })),
    )
    .await?;
    tx.commit().await?;

    get_school(State(state), auth, Path(id)).await
}

pub async fn delete_school(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(SCHOOL_MANAGE)?;
    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE schools SET deleted_at = UTC_TIMESTAMP(6), is_active = FALSE
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Escola não encontrada"));
    }
    audit(&mut tx, &auth, &ctx, "delete", "registry.school", &id, None).await?;
    tx.commit().await?;
    Ok(Json(json!({ "status": "ok" })))
}

fn validate_school(body: &SchoolPayload) -> AppResult<()> {
    let mut errors = Vec::new();
    if body.name.trim().is_empty() {
        errors.push(FieldError::new("name", "obrigatório"));
    }
    if let Some(uf) = &body.state_uf {
        if !uf.is_empty() && uf.len() != 2 {
            errors.push(FieldError::new("state_uf", "deve ter 2 caracteres"));
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::validation(errors))
    }
}

// ----------------------------- Alunos -----------------------------

#[derive(Debug, Serialize)]
pub struct GuardianDto {
    pub id: String,
    pub full_name: String,
    pub document: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub relationship: String,
    pub is_primary: bool,
}

#[derive(Debug, Serialize, FromRow)]
pub struct StudentDto {
    pub id: String,
    pub full_name: String,
    pub birth_date: NaiveDate,
    pub document: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct GuardianInput {
    pub id: Option<String>,
    pub full_name: Option<String>,
    pub document: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub relationship: String,
    #[serde(default)]
    pub is_primary: bool,
}

#[derive(Debug, Deserialize)]
pub struct StudentPayload {
    pub full_name: String,
    pub birth_date: NaiveDate,
    pub document: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub guardians: Vec<GuardianInput>,
}

pub async fn list_students(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ListQuery>,
) -> AppResult<Json<Page<StudentDto>>> {
    auth.require(STUDENT_READ)?;
    let pagination = query.pagination()?;
    let search = format!("%{}%", query.search.unwrap_or_default());
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM students WHERE deleted_at IS NULL AND full_name LIKE ?",
    )
    .bind(&search)
    .fetch_one(&state.pool)
    .await?;
    let items = sqlx::query_as::<_, StudentDto>(
        "SELECT id, full_name, birth_date, document, notes, is_active, created_at
         FROM students WHERE deleted_at IS NULL AND full_name LIKE ?
         ORDER BY full_name LIMIT ? OFFSET ?",
    )
    .bind(&search)
    .bind(pagination.per_page)
    .bind(pagination.offset)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(Page::new(items, pagination, total)))
}

pub async fn get_student(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(STUDENT_READ)?;
    let student = sqlx::query_as::<_, StudentDto>(
        "SELECT id, full_name, birth_date, document, notes, is_active, created_at
         FROM students WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::not_found("Aluno não encontrado"))?;
    let guardians = guardians_for(&state.pool, &id).await?;
    Ok(Json(json!({ "student": student, "guardians": guardians })))
}

pub async fn create_student(
    State(state): State<AppState>,
    auth: AuthUser,
    ctx: ReqCtx,
    Json(body): Json<StudentPayload>,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(STUDENT_MANAGE)?;
    validate_student(&body)?;
    let id = uuid::Uuid::now_v7().to_string();

    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO students (id, full_name, birth_date, document, notes) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(body.full_name.trim())
    .bind(body.birth_date)
    .bind(body.document.as_deref().filter(|v| !v.is_empty()))
    .bind(body.notes.as_deref())
    .execute(&mut *tx)
    .await?;
    link_guardians(&mut tx, &id, &body.guardians).await?;
    audit(
        &mut tx,
        &auth,
        &ctx,
        "create",
        "registry.student",
        &id,
        Some(json!({
            "full_name": body.full_name, "birth_date": body.birth_date
        })),
    )
    .await?;
    tx.commit().await?;

    let guardians = guardians_for(&state.pool, &id).await?;
    Ok(Json(json!({ "id": id, "guardians": guardians })))
}

pub async fn update_student(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<StudentPayload>,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(STUDENT_MANAGE)?;
    validate_student(&body)?;

    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE students SET full_name = ?, birth_date = ?, document = ?, notes = ?
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(body.full_name.trim())
    .bind(body.birth_date)
    .bind(body.document.as_deref().filter(|v| !v.is_empty()))
    .bind(body.notes.as_deref())
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Aluno não encontrado"));
    }
    sqlx::query("DELETE FROM student_guardians WHERE student_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await?;
    link_guardians(&mut tx, &id, &body.guardians).await?;
    audit(
        &mut tx,
        &auth,
        &ctx,
        "update",
        "registry.student",
        &id,
        Some(json!({
            "full_name": body.full_name
        })),
    )
    .await?;
    tx.commit().await?;

    get_student(State(state), auth, Path(id)).await
}

pub async fn delete_student(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(STUDENT_MANAGE)?;
    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE students SET deleted_at = UTC_TIMESTAMP(6), is_active = FALSE
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Aluno não encontrado"));
    }
    audit(
        &mut tx,
        &auth,
        &ctx,
        "delete",
        "registry.student",
        &id,
        None,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "status": "ok" })))
}

pub async fn list_guardians(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ListQuery>,
) -> AppResult<Json<Page<GuardianDto>>> {
    auth.require(STUDENT_READ)?;
    let pagination = query.pagination()?;
    let search = format!("%{}%", query.search.unwrap_or_default());
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM guardians WHERE deleted_at IS NULL AND full_name LIKE ?",
    )
    .bind(&search)
    .fetch_one(&state.pool)
    .await?;
    let rows: Vec<(
        String,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT id, full_name, document, phone, email FROM guardians
             WHERE deleted_at IS NULL AND full_name LIKE ?
             ORDER BY full_name LIMIT ? OFFSET ?",
    )
    .bind(&search)
    .bind(pagination.per_page)
    .bind(pagination.offset)
    .fetch_all(&state.pool)
    .await?;
    let items = rows
        .into_iter()
        .map(|(id, full_name, document, phone, email)| GuardianDto {
            id,
            full_name,
            document,
            phone,
            email,
            relationship: String::new(),
            is_primary: false,
        })
        .collect::<Vec<_>>();
    Ok(Json(Page::new(items, pagination, total)))
}

async fn guardians_for(
    pool: &sqlx::MySqlPool,
    student_id: &str,
) -> Result<Vec<GuardianDto>, sqlx::Error> {
    let rows: Vec<(
        String,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        String,
        bool,
    )> = sqlx::query_as(
        "SELECT g.id, g.full_name, g.document, g.phone, g.email, sg.relationship, sg.is_primary
             FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id
             WHERE sg.student_id = ? ORDER BY sg.is_primary DESC, g.full_name",
    )
    .bind(student_id)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(
            |(id, full_name, document, phone, email, relationship, is_primary)| GuardianDto {
                id,
                full_name,
                document,
                phone,
                email,
                relationship,
                is_primary,
            },
        )
        .collect())
}

async fn link_guardians(
    tx: &mut Transaction<'_, MySql>,
    student_id: &str,
    guardians: &[GuardianInput],
) -> AppResult<()> {
    for guardian in guardians {
        let guardian_id = if let Some(id) = &guardian.id {
            let exists: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM guardians WHERE id = ? AND deleted_at IS NULL",
            )
            .bind(id)
            .fetch_one(&mut **tx)
            .await?;
            if exists == 0 {
                return Err(AppError::validation_single(
                    "guardians",
                    format!("responsável inexistente: {id}"),
                ));
            }
            id.clone()
        } else {
            let full_name = guardian
                .full_name
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| {
                    AppError::validation_single("guardians", "nome do responsável obrigatório")
                })?;
            let id = uuid::Uuid::now_v7().to_string();
            sqlx::query(
                "INSERT INTO guardians (id, full_name, document, phone, email) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(&id)
            .bind(full_name)
            .bind(guardian.document.as_deref().filter(|v| !v.is_empty()))
            .bind(guardian.phone.as_deref())
            .bind(guardian.email.as_deref())
            .execute(&mut **tx)
            .await?;
            id
        };

        if guardian.relationship.trim().is_empty() {
            return Err(AppError::validation_single(
                "guardians",
                "grau de parentesco obrigatório",
            ));
        }

        sqlx::query(
            "INSERT INTO student_guardians (student_id, guardian_id, relationship, is_primary)
             VALUES (?, ?, ?, ?)",
        )
        .bind(student_id)
        .bind(&guardian_id)
        .bind(guardian.relationship.trim())
        .bind(guardian.is_primary)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

fn validate_student(body: &StudentPayload) -> AppResult<()> {
    let mut errors = Vec::new();
    if body.full_name.trim().is_empty() {
        errors.push(FieldError::new("full_name", "obrigatório"));
    }
    if body.birth_date > chrono::Utc::now().date_naive() {
        errors.push(FieldError::new("birth_date", "não pode estar no futuro"));
    }
    if body.guardians.is_empty() {
        errors.push(FieldError::new(
            "guardians",
            "informe ao menos um responsável",
        ));
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::validation(errors))
    }
}

// ------------------------- Anos letivos -------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct AcademicYearDto {
    pub id: String,
    pub year: i32,
    pub starts_on: NaiveDate,
    pub ends_on: NaiveDate,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct AcademicYearPayload {
    pub year: i32,
    pub starts_on: NaiveDate,
    pub ends_on: NaiveDate,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

pub async fn list_years(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<AcademicYearDto>>> {
    auth.require(ENROLLMENT_READ)?;
    let items = sqlx::query_as::<_, AcademicYearDto>(
        "SELECT id, year, starts_on, ends_on, is_active FROM academic_years ORDER BY year DESC",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(items))
}

pub async fn create_year(
    State(state): State<AppState>,
    auth: AuthUser,
    ctx: ReqCtx,
    Json(body): Json<AcademicYearPayload>,
) -> AppResult<Json<AcademicYearDto>> {
    auth.require(ENROLLMENT_MANAGE)?;
    if body.ends_on < body.starts_on {
        return Err(AppError::validation_single(
            "ends_on",
            "deve ser posterior ao início",
        ));
    }
    let id = uuid::Uuid::now_v7().to_string();
    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO academic_years (id, year, starts_on, ends_on, is_active) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(body.year)
    .bind(body.starts_on)
    .bind(body.ends_on)
    .bind(body.is_active)
    .execute(&mut *tx)
    .await?;
    audit(
        &mut tx,
        &auth,
        &ctx,
        "create",
        "registry.academic_year",
        &id,
        Some(json!({
            "year": body.year
        })),
    )
    .await?;
    tx.commit().await?;

    Ok(Json(AcademicYearDto {
        id,
        year: body.year,
        starts_on: body.starts_on,
        ends_on: body.ends_on,
        is_active: body.is_active,
    }))
}

// --------------------------- Matrículas ---------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct EnrollmentDto {
    pub id: String,
    pub student_id: String,
    pub student_name: String,
    pub school_id: String,
    pub school_name: String,
    pub academic_year_id: String,
    pub academic_year: i32,
    pub grade: String,
    pub shift: String,
    pub has_curricular_attendance: bool,
    pub didactic_mediation: String,
    pub country: String,
    pub status: String,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub close_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EnrollmentPayload {
    pub student_id: String,
    pub school_id: String,
    pub academic_year_id: String,
    pub grade: String,
    pub shift: String,
    #[serde(default = "default_true")]
    pub has_curricular_attendance: bool,
    #[serde(default = "default_presencial")]
    pub didactic_mediation: String,
    #[serde(default = "default_country")]
    pub country: String,
    pub start_date: NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct EnrollmentQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub academic_year_id: Option<String>,
    pub school_id: Option<String>,
    pub search: Option<String>,
}

pub async fn list_enrollments(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<EnrollmentQuery>,
) -> AppResult<Json<Page<EnrollmentDto>>> {
    auth.require(ENROLLMENT_READ)?;
    let pagination = Pagination::from_query(&PageQuery {
        page: query.page,
        per_page: query.per_page,
    })?;
    let search = format!("%{}%", query.search.unwrap_or_default());
    let year = query.academic_year_id.unwrap_or_default();
    let school = query.school_id.unwrap_or_default();

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM enrollments e
         JOIN students st ON st.id = e.student_id
         WHERE e.deleted_at IS NULL AND st.full_name LIKE ?
           AND (? = '' OR e.academic_year_id = ?)
           AND (? = '' OR e.school_id = ?)",
    )
    .bind(&search)
    .bind(&year)
    .bind(&year)
    .bind(&school)
    .bind(&school)
    .fetch_one(&state.pool)
    .await?;

    let items = sqlx::query_as::<_, EnrollmentDto>(
        "SELECT e.id, e.student_id, st.full_name AS student_name,
                e.school_id, sc.name AS school_name,
                e.academic_year_id, ay.year AS academic_year,
                e.grade, e.shift, e.has_curricular_attendance, e.didactic_mediation, e.country,
                e.status, e.start_date, e.end_date, e.close_reason
         FROM enrollments e
         JOIN students st ON st.id = e.student_id
         JOIN schools sc ON sc.id = e.school_id
         JOIN academic_years ay ON ay.id = e.academic_year_id
         WHERE e.deleted_at IS NULL AND st.full_name LIKE ?
           AND (? = '' OR e.academic_year_id = ?)
           AND (? = '' OR e.school_id = ?)
         ORDER BY st.full_name LIMIT ? OFFSET ?",
    )
    .bind(&search)
    .bind(&year)
    .bind(&year)
    .bind(&school)
    .bind(&school)
    .bind(pagination.per_page)
    .bind(pagination.offset)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(Page::new(items, pagination, total)))
}

pub async fn create_enrollment(
    State(state): State<AppState>,
    auth: AuthUser,
    ctx: ReqCtx,
    Json(body): Json<EnrollmentPayload>,
) -> AppResult<Json<EnrollmentDto>> {
    auth.require(ENROLLMENT_MANAGE)?;
    let mut errors = Vec::new();
    if body.grade.trim().is_empty() {
        errors.push(FieldError::new("grade", "obrigatório"));
    }
    if !shift_valid(&body.shift) {
        errors.push(FieldError::new(
            "shift",
            "use morning, afternoon, night ou full_day",
        ));
    }
    if !matches!(
        body.didactic_mediation.as_str(),
        "presencial" | "semipresencial" | "distancia"
    ) {
        errors.push(FieldError::new(
            "didactic_mediation",
            "use presencial, semipresencial ou distancia",
        ));
    }
    if body.country.len() != 2 || !body.country.chars().all(|c| c.is_ascii_alphabetic()) {
        errors.push(FieldError::new(
            "country",
            "use a sigla de duas letras do país (ex.: BR)",
        ));
    }
    if !errors.is_empty() {
        return Err(AppError::validation(errors));
    }

    let id = uuid::Uuid::now_v7().to_string();
    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO enrollments
         (id, student_id, school_id, academic_year_id, grade, shift,
          has_curricular_attendance, didactic_mediation, country, status, start_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)",
    )
    .bind(&id)
    .bind(&body.student_id)
    .bind(&body.school_id)
    .bind(&body.academic_year_id)
    .bind(body.grade.trim())
    .bind(&body.shift)
    .bind(body.has_curricular_attendance)
    .bind(body.didactic_mediation.to_lowercase())
    .bind(body.country.to_uppercase())
    .bind(body.start_date)
    .execute(&mut *tx)
    .await?;
    audit(
        &mut tx,
        &auth,
        &ctx,
        "create",
        "registry.enrollment",
        &id,
        Some(json!({
            "student_id": body.student_id, "school_id": body.school_id
        })),
    )
    .await?;
    tx.commit().await?;

    let item = enrollment_by_id(&state, &id).await?;
    Ok(Json(item))
}

#[derive(Debug, Deserialize)]
pub struct CloseEnrollment {
    pub end_date: NaiveDate,
    pub reason: Option<String>,
}

pub async fn close_enrollment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<CloseEnrollment>,
) -> AppResult<Json<EnrollmentDto>> {
    auth.require(ENROLLMENT_MANAGE)?;
    let mut tx = state.pool.begin().await?;

    let start: Option<NaiveDate> =
        sqlx::query_scalar("SELECT start_date FROM enrollments WHERE id = ? AND status = 'active'")
            .bind(&id)
            .fetch_optional(&mut *tx)
            .await?;
    let Some(start) = start else {
        return Err(AppError::not_found("Matrícula ativa não encontrada"));
    };
    if body.end_date < start {
        return Err(AppError::validation_single(
            "end_date",
            "não pode ser anterior ao início da matrícula",
        ));
    }

    sqlx::query(
        "UPDATE enrollments SET status = 'closed', end_date = ?, close_reason = ? WHERE id = ?",
    )
    .bind(body.end_date)
    .bind(body.reason.as_deref())
    .bind(&id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE transport_allocations SET end_date = ?, end_reason = 'Matrícula encerrada'
         WHERE enrollment_id = ? AND end_date IS NULL",
    )
    .bind(body.end_date)
    .bind(&id)
    .execute(&mut *tx)
    .await?;

    audit(
        &mut tx,
        &auth,
        &ctx,
        "close",
        "registry.enrollment",
        &id,
        Some(json!({
            "end_date": body.end_date, "reason": body.reason
        })),
    )
    .await?;
    tx.commit().await?;

    let item = enrollment_by_id(&state, &id).await?;
    Ok(Json(item))
}

async fn enrollment_by_id(state: &AppState, id: &str) -> AppResult<EnrollmentDto> {
    sqlx::query_as::<_, EnrollmentDto>(
        "SELECT e.id, e.student_id, st.full_name AS student_name,
                e.school_id, sc.name AS school_name,
                e.academic_year_id, ay.year AS academic_year,
                e.grade, e.shift, e.has_curricular_attendance, e.didactic_mediation, e.country,
                e.status, e.start_date, e.end_date, e.close_reason
         FROM enrollments e
         JOIN students st ON st.id = e.student_id
         JOIN schools sc ON sc.id = e.school_id
         JOIN academic_years ay ON ay.id = e.academic_year_id
         WHERE e.id = ?",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::not_found("Matrícula não encontrada"))
}

async fn audit(
    tx: &mut Transaction<'_, MySql>,
    auth: &AuthUser,
    ctx: &ReqCtx,
    action: &str,
    resource: &str,
    resource_id: &str,
    after: Option<serde_json::Value>,
) -> Result<(), sqlx::Error> {
    record(
        &mut **tx,
        AuditEvent {
            actor_id: Some(&auth.id),
            actor_email: Some(&auth.email),
            action,
            resource,
            resource_id: Some(resource_id),
            before: None,
            after: after.as_ref(),
            ip: ctx.ip.as_deref(),
            request_id: ctx.request_id.as_deref(),
            result: "success",
        },
    )
    .await
}
