use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use chrono::{Duration, NaiveDate, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::FromRow;

use crate::{
    audit::{record, AuditEvent},
    auth::{
        perms::{
            COMPANY_MANAGE, COMPANY_READ, DRIVER_MANAGE, DRIVER_READ, INSPECTION_MANAGE,
            INSPECTION_READ, VEHICLE_MANAGE, VEHICLE_READ,
        },
        AuthUser,
    },
    domain::{
        document_days_left, driver_issues, network_type_valid, normalize_plate, plate_valid,
        DriverEligibility,
    },
    error::{AppError, AppResult, FieldError},
    pagination::{ListQuery, Page},
    state::{AppState, ReqCtx},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/companies", get(list_companies).post(create_company))
        .route(
            "/companies/{id}",
            get(get_company).put(update_company).delete(delete_company),
        )
        .route("/drivers", get(list_drivers).post(create_driver))
        .route(
            "/drivers/{id}",
            get(get_driver).put(update_driver).delete(delete_driver),
        )
        .route("/drivers/alerts", get(driver_alerts))
        .route("/vehicles", get(list_vehicles).post(create_vehicle))
        .route(
            "/vehicles/{id}",
            get(get_vehicle).put(update_vehicle).delete(delete_vehicle),
        )
        .route(
            "/vehicles/{id}/inspections",
            get(list_inspections).post(create_inspection),
        )
        .route("/alerts", get(all_alerts))
}

// ---------------------------- Empresas ----------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct CompanyDto {
    pub id: String,
    pub legal_name: String,
    pub cnpj: String,
    pub contract_number: Option<String>,
    pub contract_start_date: Option<NaiveDate>,
    pub contract_end_date: Option<NaiveDate>,
    pub responsible_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub is_active: bool,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub contract_expired: bool,
}

#[derive(Debug, Deserialize)]
pub struct CompanyPayload {
    pub legal_name: String,
    pub cnpj: String,
    pub contract_number: Option<String>,
    pub contract_start_date: Option<NaiveDate>,
    pub contract_end_date: Option<NaiveDate>,
    pub responsible_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
    pub notes: Option<String>,
}

fn default_true() -> bool {
    true
}

pub async fn list_companies(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ListQuery>,
) -> AppResult<Json<Page<CompanyDto>>> {
    auth.require(COMPANY_READ)?;
    let pagination = query.pagination()?;
    let search = format!("%{}%", query.search.unwrap_or_default());
    let today = Utc::now().date_naive();
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM transport_companies WHERE deleted_at IS NULL AND legal_name LIKE ?",
    )
    .bind(&search)
    .fetch_one(&state.pool)
    .await?;
    let items = sqlx::query_as::<_, CompanyDto>(
        "SELECT id, legal_name, cnpj, contract_number, contract_start_date, contract_end_date,
                responsible_name, phone, email, is_active, notes, created_at,
                (contract_end_date IS NOT NULL AND contract_end_date < ?) AS contract_expired
         FROM transport_companies WHERE deleted_at IS NULL AND legal_name LIKE ?
         ORDER BY legal_name LIMIT ? OFFSET ?",
    )
    .bind(today)
    .bind(&search)
    .bind(pagination.per_page)
    .bind(pagination.offset)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(Page::new(items, pagination, total)))
}

pub async fn get_company(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<CompanyDto>> {
    auth.require(COMPANY_READ)?;
    let today = Utc::now().date_naive();
    let item = sqlx::query_as::<_, CompanyDto>(
        "SELECT id, legal_name, cnpj, contract_number, contract_start_date, contract_end_date,
                responsible_name, phone, email, is_active, notes, created_at,
                (contract_end_date IS NOT NULL AND contract_end_date < ?) AS contract_expired
         FROM transport_companies WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(today)
    .bind(&id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::not_found("Empresa não encontrada"))?;
    Ok(Json(item))
}

pub async fn create_company(
    State(state): State<AppState>,
    auth: AuthUser,
    ctx: ReqCtx,
    Json(body): Json<CompanyPayload>,
) -> AppResult<Json<CompanyDto>> {
    auth.require(COMPANY_MANAGE)?;
    validate_company(&body)?;
    let id = uuid::Uuid::now_v7().to_string();
    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO transport_companies
         (id, legal_name, cnpj, contract_number, contract_start_date, contract_end_date,
          responsible_name, phone, email, is_active, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(body.legal_name.trim())
    .bind(body.cnpj.trim())
    .bind(body.contract_number.as_deref())
    .bind(body.contract_start_date)
    .bind(body.contract_end_date)
    .bind(body.responsible_name.as_deref())
    .bind(body.phone.as_deref())
    .bind(body.email.as_deref())
    .bind(body.is_active)
    .bind(body.notes.as_deref())
    .execute(&mut *tx)
    .await?;
    audit(
        &mut tx,
        &auth,
        &ctx,
        "create",
        "transport.company",
        &id,
        Some(json!({
            "legal_name": body.legal_name, "cnpj": body.cnpj
        })),
    )
    .await?;
    tx.commit().await?;
    get_company(State(state), auth, Path(id)).await
}

pub async fn update_company(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<CompanyPayload>,
) -> AppResult<Json<CompanyDto>> {
    auth.require(COMPANY_MANAGE)?;
    validate_company(&body)?;
    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE transport_companies SET legal_name = ?, cnpj = ?, contract_number = ?,
                contract_start_date = ?, contract_end_date = ?, responsible_name = ?,
                phone = ?, email = ?, is_active = ?, notes = ?
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(body.legal_name.trim())
    .bind(body.cnpj.trim())
    .bind(body.contract_number.as_deref())
    .bind(body.contract_start_date)
    .bind(body.contract_end_date)
    .bind(body.responsible_name.as_deref())
    .bind(body.phone.as_deref())
    .bind(body.email.as_deref())
    .bind(body.is_active)
    .bind(body.notes.as_deref())
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Empresa não encontrada"));
    }
    audit(
        &mut tx,
        &auth,
        &ctx,
        "update",
        "transport.company",
        &id,
        Some(json!({
            "legal_name": body.legal_name
        })),
    )
    .await?;
    tx.commit().await?;
    get_company(State(state), auth, Path(id)).await
}

pub async fn delete_company(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(COMPANY_MANAGE)?;
    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE transport_companies SET deleted_at = UTC_TIMESTAMP(6), is_active = FALSE
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Empresa não encontrada"));
    }
    audit(
        &mut tx,
        &auth,
        &ctx,
        "delete",
        "transport.company",
        &id,
        None,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "status": "ok" })))
}

fn validate_company(body: &CompanyPayload) -> AppResult<()> {
    let mut errors = Vec::new();
    if body.legal_name.trim().is_empty() {
        errors.push(FieldError::new("legal_name", "obrigatório"));
    }
    let digits = body.cnpj.chars().filter(|c| c.is_ascii_digit()).count();
    if digits != 14 {
        errors.push(FieldError::new("cnpj", "deve conter 14 dígitos"));
    }
    if let (Some(start), Some(end)) = (body.contract_start_date, body.contract_end_date) {
        if end < start {
            errors.push(FieldError::new(
                "contract_end_date",
                "deve ser posterior ao início",
            ));
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::validation(errors))
    }
}

// ---------------------------- Motoristas ----------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct DriverDto {
    pub id: String,
    pub company_id: Option<String>,
    pub company_name: Option<String>,
    pub full_name: String,
    pub cpf: String,
    pub birth_date: NaiveDate,
    pub cnh_number: String,
    pub cnh_category: String,
    pub cnh_first_issue_date: Option<NaiveDate>,
    pub cnh_expiration_date: NaiveDate,
    pub course_certificate: Option<String>,
    pub course_expiration_date: Option<NaiveDate>,
    pub toxicological_exam_date: Option<NaiveDate>,
    pub toxicological_expiration_date: Option<NaiveDate>,
    pub phone: Option<String>,
    pub is_active: bool,
    pub notes: Option<String>,
    #[sqlx(skip)]
    pub issues: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct DriverPayload {
    pub company_id: Option<String>,
    pub full_name: String,
    pub cpf: String,
    pub birth_date: NaiveDate,
    pub cnh_number: String,
    pub cnh_category: String,
    pub cnh_first_issue_date: Option<NaiveDate>,
    pub cnh_expiration_date: NaiveDate,
    pub course_certificate: Option<String>,
    pub course_expiration_date: Option<NaiveDate>,
    pub toxicological_exam_date: Option<NaiveDate>,
    pub toxicological_expiration_date: Option<NaiveDate>,
    pub phone: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
    pub notes: Option<String>,
}

const DRIVER_SELECT: &str = "SELECT d.id, d.company_id, c.legal_name AS company_name, d.full_name,
        d.cpf, d.birth_date, d.cnh_number, d.cnh_category, d.cnh_first_issue_date, d.cnh_expiration_date,
        d.course_certificate, d.course_expiration_date, d.toxicological_exam_date,
        d.toxicological_expiration_date, d.phone, d.is_active, d.notes
     FROM transport_drivers d
     LEFT JOIN transport_companies c ON c.id = d.company_id";

pub async fn list_drivers(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ListQuery>,
) -> AppResult<Json<Page<DriverDto>>> {
    auth.require(DRIVER_READ)?;
    let pagination = query.pagination()?;
    let search = format!("%{}%", query.search.unwrap_or_default());
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM transport_drivers WHERE deleted_at IS NULL AND full_name LIKE ?",
    )
    .bind(&search)
    .fetch_one(&state.pool)
    .await?;
    let sql = format!(
        "{DRIVER_SELECT} WHERE d.deleted_at IS NULL AND d.full_name LIKE ?
         ORDER BY d.full_name LIMIT ? OFFSET ?"
    );
    let rows = sqlx::query_as::<_, DriverView>(&sql)
        .bind(&search)
        .bind(pagination.per_page)
        .bind(pagination.offset)
        .fetch_all(&state.pool)
        .await?;
    let items = rows.into_iter().map(DriverView::into_dto).collect();
    Ok(Json(Page::new(items, pagination, total)))
}

pub async fn get_driver(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<DriverDto>> {
    auth.require(DRIVER_READ)?;
    let sql = format!("{DRIVER_SELECT} WHERE d.id = ? AND d.deleted_at IS NULL");
    let row = sqlx::query_as::<_, DriverView>(&sql)
        .bind(&id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Motorista não encontrado"))?;
    Ok(Json(row.into_dto()))
}

pub async fn create_driver(
    State(state): State<AppState>,
    auth: AuthUser,
    ctx: ReqCtx,
    Json(body): Json<DriverPayload>,
) -> AppResult<Json<DriverDto>> {
    auth.require(DRIVER_MANAGE)?;
    validate_driver(&body, true)?;
    let id = uuid::Uuid::now_v7().to_string();
    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO transport_drivers
         (id, company_id, full_name, cpf, birth_date, cnh_number, cnh_category,
          cnh_first_issue_date, cnh_expiration_date, course_certificate, course_expiration_date,
          toxicological_exam_date, toxicological_expiration_date, phone, is_active, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(body.company_id.as_deref())
    .bind(body.full_name.trim())
    .bind(body.cpf.trim())
    .bind(body.birth_date)
    .bind(body.cnh_number.trim())
    .bind(&body.cnh_category)
    .bind(body.cnh_first_issue_date)
    .bind(body.cnh_expiration_date)
    .bind(body.course_certificate.as_deref())
    .bind(body.course_expiration_date)
    .bind(body.toxicological_exam_date)
    .bind(body.toxicological_expiration_date)
    .bind(body.phone.as_deref())
    .bind(body.is_active)
    .bind(body.notes.as_deref())
    .execute(&mut *tx)
    .await?;
    audit(
        &mut tx,
        &auth,
        &ctx,
        "create",
        "transport.driver",
        &id,
        Some(json!({
            "full_name": body.full_name, "cnh_number": body.cnh_number
        })),
    )
    .await?;
    tx.commit().await?;
    get_driver(State(state), auth, Path(id)).await
}

pub async fn update_driver(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<DriverPayload>,
) -> AppResult<Json<DriverDto>> {
    auth.require(DRIVER_MANAGE)?;
    validate_driver(&body, false)?;
    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE transport_drivers SET company_id = ?, full_name = ?, cpf = ?, birth_date = ?,
                cnh_number = ?, cnh_category = ?, cnh_first_issue_date = ?, cnh_expiration_date = ?,
                course_certificate = ?, course_expiration_date = ?, toxicological_exam_date = ?,
                toxicological_expiration_date = ?, phone = ?, is_active = ?, notes = ?
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(body.company_id.as_deref())
    .bind(body.full_name.trim())
    .bind(body.cpf.trim())
    .bind(body.birth_date)
    .bind(body.cnh_number.trim())
    .bind(&body.cnh_category)
    .bind(body.cnh_first_issue_date)
    .bind(body.cnh_expiration_date)
    .bind(body.course_certificate.as_deref())
    .bind(body.course_expiration_date)
    .bind(body.toxicological_exam_date)
    .bind(body.toxicological_expiration_date)
    .bind(body.phone.as_deref())
    .bind(body.is_active)
    .bind(body.notes.as_deref())
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Motorista não encontrado"));
    }
    audit(
        &mut tx,
        &auth,
        &ctx,
        "update",
        "transport.driver",
        &id,
        Some(json!({
            "full_name": body.full_name, "is_active": body.is_active
        })),
    )
    .await?;
    tx.commit().await?;
    get_driver(State(state), auth, Path(id)).await
}

pub async fn delete_driver(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(DRIVER_MANAGE)?;
    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE transport_drivers SET deleted_at = UTC_TIMESTAMP(6), is_active = FALSE
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Motorista não encontrado"));
    }
    audit(
        &mut tx,
        &auth,
        &ctx,
        "delete",
        "transport.driver",
        &id,
        None,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "status": "ok" })))
}

fn validate_driver(body: &DriverPayload, strict_documents: bool) -> AppResult<()> {
    let mut errors = Vec::new();
    if body.full_name.trim().is_empty() {
        errors.push(FieldError::new("full_name", "obrigatório"));
    }
    if body.cpf.chars().filter(|c| c.is_ascii_digit()).count() != 11 {
        errors.push(FieldError::new("cpf", "deve conter 11 dígitos"));
    }
    if body.cnh_number.trim().is_empty() {
        errors.push(FieldError::new("cnh_number", "obrigatório"));
    }
    if let Some(issue) = body.cnh_first_issue_date {
        if issue > body.cnh_expiration_date {
            errors.push(FieldError::new(
                "cnh_first_issue_date",
                "não pode ser posterior ao vencimento da CNH",
            ));
        }
        if issue < body.birth_date {
            errors.push(FieldError::new(
                "cnh_first_issue_date",
                "não pode ser anterior à data de nascimento",
            ));
        }
    }
    if body.is_active {
        let issues = driver_issues(&DriverEligibility {
            cnh_category: &body.cnh_category,
            cnh_expiration: body.cnh_expiration_date,
            birth_date: body.birth_date,
            course_expiration: body.course_expiration_date,
            toxicological_expiration: body.toxicological_expiration_date,
            today: Utc::now().date_naive(),
        });
        for issue in issues {
            errors.push(FieldError::new("driver", issue));
        }
    } else if strict_documents && !matches!(body.cnh_category.as_str(), "D" | "E") {
        errors.push(FieldError::new(
            "cnh_category",
            "CNH deve ser das categorias D ou E",
        ));
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::validation(errors))
    }
}

#[derive(Debug, FromRow)]
struct DriverView {
    id: String,
    company_id: Option<String>,
    company_name: Option<String>,
    full_name: String,
    cpf: String,
    birth_date: NaiveDate,
    cnh_number: String,
    cnh_category: String,
    cnh_first_issue_date: Option<NaiveDate>,
    cnh_expiration_date: NaiveDate,
    course_certificate: Option<String>,
    course_expiration_date: Option<NaiveDate>,
    toxicological_exam_date: Option<NaiveDate>,
    toxicological_expiration_date: Option<NaiveDate>,
    phone: Option<String>,
    is_active: bool,
    notes: Option<String>,
}

impl DriverView {
    fn into_dto(self) -> DriverDto {
        let issues = if self.is_active {
            driver_issues(&DriverEligibility {
                cnh_category: &self.cnh_category,
                cnh_expiration: self.cnh_expiration_date,
                birth_date: self.birth_date,
                course_expiration: self.course_expiration_date,
                toxicological_expiration: self.toxicological_expiration_date,
                today: Utc::now().date_naive(),
            })
        } else {
            Vec::new()
        };
        DriverDto {
            id: self.id,
            company_id: self.company_id,
            company_name: self.company_name,
            full_name: self.full_name,
            cpf: self.cpf,
            birth_date: self.birth_date,
            cnh_number: self.cnh_number,
            cnh_category: self.cnh_category,
            cnh_first_issue_date: self.cnh_first_issue_date,
            cnh_expiration_date: self.cnh_expiration_date,
            course_certificate: self.course_certificate,
            course_expiration_date: self.course_expiration_date,
            toxicological_exam_date: self.toxicological_exam_date,
            toxicological_expiration_date: self.toxicological_expiration_date,
            phone: self.phone,
            is_active: self.is_active,
            notes: self.notes,
            issues,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct AlertDto {
    pub kind: String,
    pub severity: String,
    pub resource: String,
    pub resource_id: String,
    pub title: String,
    pub detail: String,
    pub due_date: NaiveDate,
    pub days_left: i64,
}

pub async fn driver_alerts(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<AlertDto>>> {
    auth.require(DRIVER_READ)?;
    Ok(Json(collect_driver_alerts(&state.pool).await?))
}

pub async fn collect_driver_alerts(pool: &sqlx::MySqlPool) -> Result<Vec<AlertDto>, sqlx::Error> {
    let today = Utc::now().date_naive();
    let limit = today + Duration::days(30);
    let rows: Vec<(
        String,
        String,
        NaiveDate,
        NaiveDate,
        Option<NaiveDate>,
        Option<NaiveDate>,
    )> = sqlx::query_as(
        "SELECT id, full_name, cnh_expiration_date, cnh_expiration_date,
                    course_expiration_date, toxicological_expiration_date
             FROM transport_drivers WHERE deleted_at IS NULL AND is_active = TRUE",
    )
    .fetch_all(pool)
    .await?;

    let mut alerts = Vec::new();
    for (id, name, cnh_exp, _, course_exp, tox_exp) in rows {
        for (kind, label, date) in [
            ("cnh", "CNH", Some(cnh_exp)),
            ("course", "Curso especializado", course_exp),
            ("toxicological", "Exame toxicológico", tox_exp),
        ] {
            let Some(date) = date else { continue };
            if date <= limit {
                let days_left = document_days_left(date, today);
                alerts.push(AlertDto {
                    kind: kind.to_string(),
                    severity: if days_left < 0 {
                        "critical".to_string()
                    } else {
                        "warning".to_string()
                    },
                    resource: "transport.driver".to_string(),
                    resource_id: id.clone(),
                    title: format!("{label} de {name}"),
                    detail: if days_left < 0 {
                        format!("{label} vencido em {date}")
                    } else {
                        format!("{label} vence em {date} ({days_left} dias)")
                    },
                    due_date: date,
                    days_left,
                });
            }
        }
    }
    Ok(alerts)
}

// ---------------------------- Veículos ----------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct VehicleDto {
    pub id: String,
    pub company_id: Option<String>,
    pub company_name: Option<String>,
    pub default_driver_id: Option<String>,
    pub default_driver_name: Option<String>,
    pub description: String,
    pub plate: String,
    pub renavam: Option<String>,
    pub data_licenca: Option<NaiveDate>,
    pub chassis: Option<String>,
    pub brand_model: Option<String>,
    pub manufacture_year: Option<i32>,
    pub model_year: Option<i32>,
    pub passenger_capacity: i32,
    pub network_type: String,
    pub vehicle_type_inep: i32,
    pub is_exclusive_school_use: bool,
    pub is_accessible_disability: bool,
    pub last_inspection_date: Option<NaiveDate>,
    pub inspection_certificate_number: Option<String>,
    pub inspection_valid_until: Option<NaiveDate>,
    pub is_active: bool,
    pub deactivation_reason: Option<String>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub inspection_valid: bool,
}

#[derive(Debug, Deserialize)]
pub struct VehiclePayload {
    pub company_id: Option<String>,
    pub default_driver_id: Option<String>,
    pub description: String,
    pub plate: String,
    pub renavam: Option<String>,
    pub data_licenca: Option<NaiveDate>,
    pub chassis: Option<String>,
    pub brand_model: Option<String>,
    pub manufacture_year: Option<i32>,
    pub model_year: Option<i32>,
    pub passenger_capacity: i32,
    pub network_type: Option<String>,
    pub vehicle_type_inep: i32,
    #[serde(default = "default_true")]
    pub is_exclusive_school_use: bool,
    #[serde(default)]
    pub is_accessible_disability: bool,
    pub last_inspection_date: Option<NaiveDate>,
    pub inspection_certificate_number: Option<String>,
    pub inspection_valid_until: Option<NaiveDate>,
    #[serde(default = "default_true")]
    pub is_active: bool,
    pub deactivation_reason: Option<String>,
    pub notes: Option<String>,
}

const VEHICLE_SELECT: &str =
    "SELECT v.id, v.company_id, c.legal_name AS company_name, v.default_driver_id,
        dd.full_name AS default_driver_name, v.description,
        v.plate, v.renavam, v.data_licenca, v.chassis, v.brand_model, v.manufacture_year, v.model_year,
        v.passenger_capacity, v.network_type, v.vehicle_type_inep, v.is_exclusive_school_use,
        v.is_accessible_disability, v.last_inspection_date, v.inspection_certificate_number,
        v.inspection_valid_until, v.is_active, v.deactivation_reason, v.notes, v.created_at,
        (v.inspection_valid_until IS NOT NULL AND v.inspection_valid_until >= ?) AS inspection_valid
     FROM transport_vehicles v
     LEFT JOIN transport_companies c ON c.id = v.company_id
     LEFT JOIN transport_drivers dd ON dd.id = v.default_driver_id";

pub async fn list_vehicles(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ListQuery>,
) -> AppResult<Json<Page<VehicleDto>>> {
    auth.require(VEHICLE_READ)?;
    let pagination = query.pagination()?;
    let search = format!("%{}%", query.search.unwrap_or_default());
    let today = Utc::now().date_naive();
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM transport_vehicles
         WHERE deleted_at IS NULL AND (description LIKE ? OR plate LIKE ?)",
    )
    .bind(&search)
    .bind(&search)
    .fetch_one(&state.pool)
    .await?;
    let sql = format!(
        "{VEHICLE_SELECT} WHERE v.deleted_at IS NULL AND (v.description LIKE ? OR v.plate LIKE ?)
         ORDER BY v.description LIMIT ? OFFSET ?"
    );
    let items = sqlx::query_as::<_, VehicleDto>(&sql)
        .bind(today)
        .bind(&search)
        .bind(&search)
        .bind(pagination.per_page)
        .bind(pagination.offset)
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(Page::new(items, pagination, total)))
}

pub async fn get_vehicle(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<VehicleDto>> {
    auth.require(VEHICLE_READ)?;
    let today = Utc::now().date_naive();
    let sql = format!("{VEHICLE_SELECT} WHERE v.id = ? AND v.deleted_at IS NULL");
    let item = sqlx::query_as::<_, VehicleDto>(&sql)
        .bind(today)
        .bind(&id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Veículo não encontrado"))?;
    Ok(Json(item))
}

pub async fn create_vehicle(
    State(state): State<AppState>,
    auth: AuthUser,
    ctx: ReqCtx,
    Json(body): Json<VehiclePayload>,
) -> AppResult<Json<VehicleDto>> {
    auth.require(VEHICLE_MANAGE)?;
    validate_vehicle(&body)?;
    ensure_default_driver(&state, body.default_driver_id.as_deref()).await?;
    let id = uuid::Uuid::now_v7().to_string();
    let plate = normalize_plate(&body.plate);
    let network = body
        .network_type
        .clone()
        .unwrap_or_else(|| "rural".to_string());

    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO transport_vehicles
         (id, company_id, default_driver_id, description, plate, renavam, data_licenca, chassis,
          brand_model, manufacture_year, model_year, passenger_capacity, network_type,
          vehicle_type_inep, is_exclusive_school_use, is_accessible_disability,
          last_inspection_date, inspection_certificate_number, inspection_valid_until,
          is_active, deactivation_reason, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(body.company_id.as_deref())
    .bind(body.default_driver_id.as_deref())
    .bind(body.description.trim())
    .bind(&plate)
    .bind(body.renavam.as_deref())
    .bind(body.data_licenca)
    .bind(body.chassis.as_deref())
    .bind(body.brand_model.as_deref())
    .bind(body.manufacture_year)
    .bind(body.model_year)
    .bind(body.passenger_capacity)
    .bind(&network)
    .bind(body.vehicle_type_inep)
    .bind(body.is_exclusive_school_use)
    .bind(body.is_accessible_disability)
    .bind(body.last_inspection_date)
    .bind(body.inspection_certificate_number.as_deref())
    .bind(body.inspection_valid_until)
    .bind(body.is_active)
    .bind(body.deactivation_reason.as_deref())
    .bind(body.notes.as_deref())
    .execute(&mut *tx)
    .await?;
    audit(
        &mut tx,
        &auth,
        &ctx,
        "create",
        "transport.vehicle",
        &id,
        Some(json!({
            "plate": plate, "description": body.description
        })),
    )
    .await?;
    tx.commit().await?;
    get_vehicle(State(state), auth, Path(id)).await
}

pub async fn update_vehicle(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<VehiclePayload>,
) -> AppResult<Json<VehicleDto>> {
    auth.require(VEHICLE_MANAGE)?;
    validate_vehicle(&body)?;
    ensure_default_driver(&state, body.default_driver_id.as_deref()).await?;
    let plate = normalize_plate(&body.plate);
    let network = body
        .network_type
        .clone()
        .unwrap_or_else(|| "rural".to_string());

    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE transport_vehicles SET company_id = ?, default_driver_id = ?, description = ?,
                plate = ?, renavam = ?, data_licenca = ?, chassis = ?, brand_model = ?,
                manufacture_year = ?, model_year = ?, passenger_capacity = ?, network_type = ?,
                vehicle_type_inep = ?, is_exclusive_school_use = ?, is_accessible_disability = ?,
                last_inspection_date = ?, inspection_certificate_number = ?,
                inspection_valid_until = ?, is_active = ?, deactivation_reason = ?, notes = ?
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(body.company_id.as_deref())
    .bind(body.default_driver_id.as_deref())
    .bind(body.description.trim())
    .bind(&plate)
    .bind(body.renavam.as_deref())
    .bind(body.data_licenca)
    .bind(body.chassis.as_deref())
    .bind(body.brand_model.as_deref())
    .bind(body.manufacture_year)
    .bind(body.model_year)
    .bind(body.passenger_capacity)
    .bind(&network)
    .bind(body.vehicle_type_inep)
    .bind(body.is_exclusive_school_use)
    .bind(body.is_accessible_disability)
    .bind(body.last_inspection_date)
    .bind(body.inspection_certificate_number.as_deref())
    .bind(body.inspection_valid_until)
    .bind(body.is_active)
    .bind(body.deactivation_reason.as_deref())
    .bind(body.notes.as_deref())
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Veículo não encontrado"));
    }
    audit(
        &mut tx,
        &auth,
        &ctx,
        "update",
        "transport.vehicle",
        &id,
        Some(json!({
            "plate": plate, "description": body.description
        })),
    )
    .await?;
    tx.commit().await?;
    get_vehicle(State(state), auth, Path(id)).await
}

pub async fn delete_vehicle(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(VEHICLE_MANAGE)?;
    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE transport_vehicles SET deleted_at = UTC_TIMESTAMP(6), is_active = FALSE
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Veículo não encontrado"));
    }
    audit(
        &mut tx,
        &auth,
        &ctx,
        "delete",
        "transport.vehicle",
        &id,
        None,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "status": "ok" })))
}

async fn ensure_default_driver(state: &AppState, driver_id: Option<&str>) -> AppResult<()> {
    let Some(driver_id) = driver_id else {
        return Ok(());
    };
    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM transport_drivers
         WHERE id = ? AND deleted_at IS NULL AND is_active = TRUE",
    )
    .bind(driver_id)
    .fetch_one(&state.pool)
    .await?;
    if exists == 0 {
        return Err(AppError::validation_single(
            "default_driver_id",
            "motorista não encontrado ou inativo",
        ));
    }
    Ok(())
}

fn validate_vehicle(body: &VehiclePayload) -> AppResult<()> {
    let mut errors = Vec::new();
    if body.description.trim().is_empty() {
        errors.push(FieldError::new("description", "obrigatório"));
    }
    if !plate_valid(&body.plate) {
        errors.push(FieldError::new(
            "plate",
            "placa inválida (use ABC1D23 ou ABC1234)",
        ));
    }
    if body.passenger_capacity <= 0 {
        errors.push(FieldError::new(
            "passenger_capacity",
            "deve ser maior que zero",
        ));
    }
    if !(1..=11).contains(&body.vehicle_type_inep) {
        errors.push(FieldError::new(
            "vehicle_type_inep",
            "tipologia Inep deve estar entre 1 e 11",
        ));
    }
    if let Some(network) = &body.network_type {
        if !network_type_valid(network) {
            errors.push(FieldError::new("network_type", "use rural, urban ou mixed"));
        }
    }
    if let (Some(start), Some(end)) = (body.last_inspection_date, body.inspection_valid_until) {
        if end < start {
            errors.push(FieldError::new(
                "inspection_valid_until",
                "deve ser posterior à data da vistoria",
            ));
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::validation(errors))
    }
}

// ---------------------------- Vistorias ----------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct InspectionDto {
    pub id: String,
    pub vehicle_id: String,
    pub inspection_date: NaiveDate,
    pub certificate_number: String,
    pub valid_until: NaiveDate,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct InspectionPayload {
    pub inspection_date: NaiveDate,
    pub certificate_number: String,
    pub valid_until: NaiveDate,
    pub notes: Option<String>,
}

pub async fn list_inspections(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(vehicle_id): Path<String>,
) -> AppResult<Json<Vec<InspectionDto>>> {
    auth.require(INSPECTION_READ)?;
    let items = sqlx::query_as::<_, InspectionDto>(
        "SELECT id, vehicle_id, inspection_date, certificate_number, valid_until, notes, created_at
         FROM vehicle_inspections WHERE vehicle_id = ? ORDER BY inspection_date DESC",
    )
    .bind(&vehicle_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(items))
}

pub async fn create_inspection(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(vehicle_id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<InspectionPayload>,
) -> AppResult<Json<InspectionDto>> {
    auth.require(INSPECTION_MANAGE)?;
    let mut errors = Vec::new();
    if body.certificate_number.trim().is_empty() {
        errors.push(FieldError::new("certificate_number", "obrigatório"));
    }
    if body.valid_until < body.inspection_date {
        errors.push(FieldError::new(
            "valid_until",
            "deve ser posterior à data da vistoria",
        ));
    }
    if !errors.is_empty() {
        return Err(AppError::validation(errors));
    }

    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM transport_vehicles WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&vehicle_id)
    .fetch_one(&state.pool)
    .await?;
    if exists == 0 {
        return Err(AppError::not_found("Veículo não encontrado"));
    }

    let id = uuid::Uuid::now_v7().to_string();
    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO vehicle_inspections
         (id, vehicle_id, inspection_date, certificate_number, valid_until, notes)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&vehicle_id)
    .bind(body.inspection_date)
    .bind(body.certificate_number.trim())
    .bind(body.valid_until)
    .bind(body.notes.as_deref())
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE transport_vehicles
         SET last_inspection_date = ?, inspection_certificate_number = ?, inspection_valid_until = ?
         WHERE id = ? AND (inspection_valid_until IS NULL OR inspection_valid_until <= ?)",
    )
    .bind(body.inspection_date)
    .bind(body.certificate_number.trim())
    .bind(body.valid_until)
    .bind(&vehicle_id)
    .bind(body.valid_until)
    .execute(&mut *tx)
    .await?;

    audit(
        &mut tx,
        &auth,
        &ctx,
        "create",
        "transport.inspection",
        &id,
        Some(json!({
            "vehicle_id": vehicle_id, "valid_until": body.valid_until
        })),
    )
    .await?;
    tx.commit().await?;

    Ok(Json(InspectionDto {
        id,
        vehicle_id,
        inspection_date: body.inspection_date,
        certificate_number: body.certificate_number,
        valid_until: body.valid_until,
        notes: body.notes,
        created_at: Utc::now().naive_utc(),
    }))
}

// ----------------------------- Alertas -----------------------------

pub async fn all_alerts(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<AlertDto>>> {
    auth.require(VEHICLE_READ)?;
    let mut alerts = collect_driver_alerts(&state.pool).await?;
    alerts.extend(collect_vehicle_alerts(&state.pool).await?);
    alerts.sort_by_key(|alert| alert.days_left);
    Ok(Json(alerts))
}

pub async fn collect_vehicle_alerts(pool: &sqlx::MySqlPool) -> Result<Vec<AlertDto>, sqlx::Error> {
    let today = Utc::now().date_naive();
    let limit = today + Duration::days(30);
    let rows: Vec<(String, String, Option<String>, Option<NaiveDate>)> = sqlx::query_as(
        "SELECT id, description, plate, inspection_valid_until
         FROM transport_vehicles
         WHERE deleted_at IS NULL AND is_active = TRUE
           AND (inspection_valid_until IS NULL OR inspection_valid_until <= ?)",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let mut alerts = Vec::new();
    for (id, description, plate, valid_until) in rows {
        let Some(date) = valid_until else {
            alerts.push(AlertDto {
                kind: "inspection".to_string(),
                severity: "critical".to_string(),
                resource: "transport.vehicle".to_string(),
                resource_id: id,
                title: format!("Vistoria pendente — {description}"),
                detail: "Veículo sem vistoria registrada".to_string(),
                due_date: today,
                days_left: -1,
            });
            continue;
        };
        let days_left = document_days_left(date, today);
        alerts.push(AlertDto {
            kind: "inspection".to_string(),
            severity: if days_left < 0 {
                "critical".to_string()
            } else {
                "warning".to_string()
            },
            resource: "transport.vehicle".to_string(),
            resource_id: id,
            title: format!(
                "Vistoria DETRAN — {}",
                plate.unwrap_or_else(|| description.clone())
            ),
            detail: if days_left < 0 {
                format!("Vistoria vencida em {date}")
            } else {
                format!("Vistoria vence em {date} ({days_left} dias)")
            },
            due_date: date,
            days_left,
        });
    }
    Ok(alerts)
}

async fn audit(
    tx: &mut sqlx::Transaction<'_, sqlx::MySql>,
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
