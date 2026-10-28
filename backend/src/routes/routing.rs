use axum::{
    extract::{Path, Query, State},
    routing::{get, put},
    Json, Router,
};
use chrono::{NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{FromRow, MySql, Transaction};

use crate::{
    audit::{record, AuditEvent},
    auth::{
        perms::{ROUTE_MANAGE, ROUTE_READ, STOP_MANAGE, STOP_READ},
        AuthUser,
    },
    domain::{
        contract_valid, inspection_valid, network_type_valid, occupancy_percentage, shift_valid,
        validate_coordinates, DriverEligibility,
    },
    error::{AppError, AppResult, FieldError},
    pagination::{Page, PageQuery, Pagination},
    state::{AppState, ReqCtx},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/stops", get(list_stops).post(create_stop))
        .route(
            "/stops/{id}",
            get(get_stop).put(update_stop).delete(delete_stop),
        )
        .route("/routes", get(list_routes).post(create_route))
        .route(
            "/routes/{id}",
            get(get_route).put(update_route).delete(delete_route),
        )
        .route("/routes/{id}/stops", put(set_itinerary))
        .route("/routes/{id}/occupancy", get(route_occupancy))
}

// ----------------------------- Paradas -----------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct StopDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub postal_code: Option<String>,
    pub street: Option<String>,
    pub number: Option<String>,
    pub complement: Option<String>,
    pub neighborhood: Option<String>,
    pub city: Option<String>,
    pub state_uf: Option<String>,
    pub landmark: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct StopPayload {
    pub name: String,
    pub description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub postal_code: Option<String>,
    pub street: Option<String>,
    pub number: Option<String>,
    pub complement: Option<String>,
    pub neighborhood: Option<String>,
    pub city: Option<String>,
    pub state_uf: Option<String>,
    pub landmark: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Default, Deserialize)]
pub struct StopQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub search: Option<String>,
    pub route_id: Option<String>,
}

pub async fn list_stops(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<StopQuery>,
) -> AppResult<Json<Page<StopDto>>> {
    auth.require(STOP_READ)?;
    let pagination = Pagination::from_query(&PageQuery {
        page: query.page,
        per_page: query.per_page,
    })?;
    let search = format!("%{}%", query.search.unwrap_or_default());

    let (total, items) = if let Some(route_id) = &query.route_id {
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM transport_stops s
             JOIN transport_route_stops rs ON rs.stop_id = s.id
             WHERE rs.route_id = ? AND s.deleted_at IS NULL AND s.name LIKE ?",
        )
        .bind(route_id)
        .bind(&search)
        .fetch_one(&state.pool)
        .await?;
        let items = sqlx::query_as::<_, StopDto>(
            "SELECT s.id, s.name, s.description, s.latitude, s.longitude, s.postal_code,
                    s.street, s.number, s.complement, s.neighborhood, s.city, s.state_uf,
                    s.landmark, s.is_active
             FROM transport_stops s
             JOIN transport_route_stops rs ON rs.stop_id = s.id
             WHERE rs.route_id = ? AND s.deleted_at IS NULL AND s.name LIKE ?
             ORDER BY rs.sequence_order, s.name LIMIT ? OFFSET ?",
        )
        .bind(route_id)
        .bind(&search)
        .bind(pagination.per_page)
        .bind(pagination.offset)
        .fetch_all(&state.pool)
        .await?;
        (total, items)
    } else {
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM transport_stops WHERE deleted_at IS NULL AND name LIKE ?",
        )
        .bind(&search)
        .fetch_one(&state.pool)
        .await?;
        let items = sqlx::query_as::<_, StopDto>(
            "SELECT id, name, description, latitude, longitude, postal_code, street, number,
                    complement, neighborhood, city, state_uf, landmark, is_active
             FROM transport_stops WHERE deleted_at IS NULL AND name LIKE ?
             ORDER BY name LIMIT ? OFFSET ?",
        )
        .bind(&search)
        .bind(pagination.per_page)
        .bind(pagination.offset)
        .fetch_all(&state.pool)
        .await?;
        (total, items)
    };

    Ok(Json(Page::new(items, pagination, total)))
}

pub async fn get_stop(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<StopDto>> {
    auth.require(STOP_READ)?;
    let item = sqlx::query_as::<_, StopDto>(
        "SELECT id, name, description, latitude, longitude, postal_code, street, number,
                complement, neighborhood, city, state_uf, landmark, is_active
         FROM transport_stops WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::not_found("Ponto de parada não encontrado"))?;
    Ok(Json(item))
}

pub async fn create_stop(
    State(state): State<AppState>,
    auth: AuthUser,
    ctx: ReqCtx,
    Json(body): Json<StopPayload>,
) -> AppResult<Json<StopDto>> {
    auth.require(STOP_MANAGE)?;
    validate_stop(&body)?;
    let id = uuid::Uuid::now_v7().to_string();
    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO transport_stops
         (id, name, description, latitude, longitude, postal_code, street, number, complement,
          neighborhood, city, state_uf, landmark, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(body.name.trim())
    .bind(body.description.as_deref())
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(body.postal_code.as_deref())
    .bind(body.street.as_deref())
    .bind(body.number.as_deref())
    .bind(body.complement.as_deref())
    .bind(body.neighborhood.as_deref())
    .bind(body.city.as_deref())
    .bind(body.state_uf.as_deref())
    .bind(body.landmark.as_deref())
    .bind(body.is_active)
    .execute(&mut *tx)
    .await?;
    audit(
        &mut tx,
        &auth,
        &ctx,
        "create",
        "transport.stop",
        &id,
        Some(json!({
            "name": body.name
        })),
    )
    .await?;
    tx.commit().await?;
    get_stop(State(state), auth, Path(id)).await
}

pub async fn update_stop(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<StopPayload>,
) -> AppResult<Json<StopDto>> {
    auth.require(STOP_MANAGE)?;
    validate_stop(&body)?;
    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE transport_stops SET name = ?, description = ?, latitude = ?, longitude = ?,
                postal_code = ?, street = ?, number = ?, complement = ?, neighborhood = ?,
                city = ?, state_uf = ?, landmark = ?, is_active = ?
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(body.name.trim())
    .bind(body.description.as_deref())
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(body.postal_code.as_deref())
    .bind(body.street.as_deref())
    .bind(body.number.as_deref())
    .bind(body.complement.as_deref())
    .bind(body.neighborhood.as_deref())
    .bind(body.city.as_deref())
    .bind(body.state_uf.as_deref())
    .bind(body.landmark.as_deref())
    .bind(body.is_active)
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Ponto de parada não encontrado"));
    }
    audit(
        &mut tx,
        &auth,
        &ctx,
        "update",
        "transport.stop",
        &id,
        Some(json!({
            "name": body.name
        })),
    )
    .await?;
    tx.commit().await?;
    get_stop(State(state), auth, Path(id)).await
}

pub async fn delete_stop(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(STOP_MANAGE)?;
    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE transport_stops SET deleted_at = UTC_TIMESTAMP(6), is_active = FALSE
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Ponto de parada não encontrado"));
    }
    audit(&mut tx, &auth, &ctx, "delete", "transport.stop", &id, None).await?;
    tx.commit().await?;
    Ok(Json(json!({ "status": "ok" })))
}

fn validate_stop(body: &StopPayload) -> AppResult<()> {
    let mut errors = Vec::new();
    if body.name.trim().is_empty() {
        errors.push(FieldError::new("name", "obrigatório"));
    }
    errors.extend(validate_coordinates(body.latitude, body.longitude));
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::validation(errors))
    }
}

// ------------------------------ Rotas ------------------------------

#[derive(Debug, Serialize, FromRow)]
pub struct RouteDto {
    pub id: String,
    pub name: String,
    pub school_id: String,
    pub school_name: String,
    pub academic_year_id: String,
    pub academic_year: i32,
    pub company_id: Option<String>,
    pub vehicle_id: Option<String>,
    pub vehicle_description: Option<String>,
    pub vehicle_plate: Option<String>,
    pub driver_id: Option<String>,
    pub driver_name: Option<String>,
    pub shift: String,
    pub route_type: String,
    pub km_paved: f64,
    pub km_unpaved: f64,
    pub total_km: f64,
    pub departure_time: Option<NaiveTime>,
    pub arrival_time: Option<NaiveTime>,
    pub return_departure_time: Option<NaiveTime>,
    pub is_outsourced: bool,
    pub is_active: bool,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    #[sqlx(default)]
    pub capacity: Option<i32>,
    #[sqlx(default)]
    pub allocated_students: i64,
    #[sqlx(default)]
    pub stops_count: i64,
}

#[derive(Debug, Serialize)]
pub struct RouteDetailDto {
    #[serde(flatten)]
    pub route: RouteDto,
    pub occupancy_percentage: Option<f64>,
    pub itinerary_valid: bool,
    pub stops: Vec<RouteStopDto>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct RouteStopDto {
    pub id: String,
    pub stop_id: String,
    pub name: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub sequence_order: i32,
    pub estimated_pickup_time: Option<NaiveTime>,
    pub estimated_dropoff_time: Option<NaiveTime>,
}

#[derive(Debug, Deserialize)]
pub struct RoutePayload {
    pub name: String,
    pub school_id: String,
    pub academic_year_id: String,
    pub company_id: Option<String>,
    pub vehicle_id: Option<String>,
    pub driver_id: Option<String>,
    pub shift: String,
    pub route_type: Option<String>,
    pub km_paved: Option<f64>,
    pub km_unpaved: Option<f64>,
    pub departure_time: Option<NaiveTime>,
    pub arrival_time: Option<NaiveTime>,
    pub return_departure_time: Option<NaiveTime>,
    #[serde(default)]
    pub is_outsourced: bool,
    #[serde(default = "default_true")]
    pub is_active: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RouteQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub search: Option<String>,
    pub academic_year_id: Option<String>,
    pub school_id: Option<String>,
    pub shift: Option<String>,
    pub route_type: Option<String>,
    pub is_active: Option<bool>,
}

const ROUTE_SELECT: &str = "SELECT r.id, r.name, r.school_id, sc.name AS school_name,
        r.academic_year_id, ay.year AS academic_year, r.company_id, r.vehicle_id,
        v.description AS vehicle_description, v.plate AS vehicle_plate, r.driver_id,
        d.full_name AS driver_name, r.shift, r.route_type, r.km_paved, r.km_unpaved,
        r.total_km, r.departure_time, r.arrival_time, r.return_departure_time,
        r.is_outsourced, r.is_active, r.notes, r.created_at,
        v.passenger_capacity AS capacity,
        (SELECT COUNT(*) FROM transport_allocations a
          WHERE a.route_id = r.id AND a.end_date IS NULL) AS allocated_students,
        (SELECT COUNT(*) FROM transport_route_stops rs WHERE rs.route_id = r.id) AS stops_count
     FROM transport_routes r
     JOIN schools sc ON sc.id = r.school_id
     JOIN academic_years ay ON ay.id = r.academic_year_id
     LEFT JOIN transport_vehicles v ON v.id = r.vehicle_id
     LEFT JOIN transport_drivers d ON d.id = r.driver_id";

pub async fn list_routes(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<RouteQuery>,
) -> AppResult<Json<Page<serde_json::Value>>> {
    auth.require(ROUTE_READ)?;
    let pagination = Pagination::from_query(&PageQuery {
        page: query.page,
        per_page: query.per_page,
    })?;
    let search = format!("%{}%", query.search.clone().unwrap_or_default());
    let year = query.academic_year_id.clone().unwrap_or_default();
    let school = query.school_id.clone().unwrap_or_default();
    let shift = query.shift.clone().unwrap_or_default();
    let route_type = query.route_type.clone().unwrap_or_default();
    let active = query.is_active.unwrap_or(true);

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM transport_routes r
         WHERE r.deleted_at IS NULL AND r.is_active = ? AND r.name LIKE ?
           AND (? = '' OR r.academic_year_id = ?)
           AND (? = '' OR r.school_id = ?)
           AND (? = '' OR r.shift = ?)
           AND (? = '' OR r.route_type = ?)",
    )
    .bind(active)
    .bind(&search)
    .bind(&year)
    .bind(&year)
    .bind(&school)
    .bind(&school)
    .bind(&shift)
    .bind(&shift)
    .bind(&route_type)
    .bind(&route_type)
    .fetch_one(&state.pool)
    .await?;

    let sql = format!(
        "{ROUTE_SELECT} WHERE r.deleted_at IS NULL AND r.is_active = ? AND r.name LIKE ?
         AND (? = '' OR r.academic_year_id = ?)
         AND (? = '' OR r.school_id = ?)
         AND (? = '' OR r.shift = ?)
         AND (? = '' OR r.route_type = ?)
         ORDER BY r.name LIMIT ? OFFSET ?"
    );
    let routes = sqlx::query_as::<_, RouteDto>(&sql)
        .bind(active)
        .bind(&search)
        .bind(&year)
        .bind(&year)
        .bind(&school)
        .bind(&school)
        .bind(&shift)
        .bind(&shift)
        .bind(&route_type)
        .bind(&route_type)
        .bind(pagination.per_page)
        .bind(pagination.offset)
        .fetch_all(&state.pool)
        .await?;

    let items = routes
        .into_iter()
        .map(|route| {
            let percentage =
                occupancy_percentage(route.allocated_students, route.capacity.unwrap_or(0) as i64);
            let mut value = serde_json::to_value(&route).unwrap_or_else(|_| json!({}));
            if let Some(obj) = value.as_object_mut() {
                obj.insert("occupancy_percentage".to_string(), json!(percentage));
                obj.insert("itinerary_valid".to_string(), json!(route.stops_count > 0));
            }
            value
        })
        .collect::<Vec<_>>();

    Ok(Json(Page::new(items, pagination, total)))
}

pub async fn get_route(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<RouteDetailDto>> {
    auth.require(ROUTE_READ)?;
    let route = load_route(&state, &id).await?;
    let stops = load_route_stops(&state, &id).await?;
    let occupancy =
        occupancy_percentage(route.allocated_students, route.capacity.unwrap_or(0) as i64);
    Ok(Json(RouteDetailDto {
        route,
        occupancy_percentage: occupancy,
        itinerary_valid: !stops.is_empty(),
        stops,
    }))
}

pub async fn create_route(
    State(state): State<AppState>,
    auth: AuthUser,
    ctx: ReqCtx,
    Json(body): Json<RoutePayload>,
) -> AppResult<Json<RouteDetailDto>> {
    auth.require(ROUTE_MANAGE)?;
    validate_route(&body)?;
    check_route_links(&state, &body).await?;

    let id = uuid::Uuid::now_v7().to_string();
    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO transport_routes
         (id, school_id, academic_year_id, company_id, vehicle_id, driver_id, name, shift,
          route_type, km_paved, km_unpaved, departure_time, arrival_time,
          return_departure_time, is_outsourced, is_active, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&body.school_id)
    .bind(&body.academic_year_id)
    .bind(body.company_id.as_deref())
    .bind(body.vehicle_id.as_deref())
    .bind(body.driver_id.as_deref())
    .bind(body.name.trim())
    .bind(&body.shift)
    .bind(
        body.route_type
            .clone()
            .unwrap_or_else(|| "rural".to_string()),
    )
    .bind(body.km_paved.unwrap_or(0.0))
    .bind(body.km_unpaved.unwrap_or(0.0))
    .bind(body.departure_time)
    .bind(body.arrival_time)
    .bind(body.return_departure_time)
    .bind(body.is_outsourced)
    .bind(body.is_active)
    .bind(body.notes.as_deref())
    .execute(&mut *tx)
    .await?;
    audit(
        &mut tx,
        &auth,
        &ctx,
        "create",
        "transport.route",
        &id,
        Some(json!({
            "name": body.name, "school_id": body.school_id
        })),
    )
    .await?;
    tx.commit().await?;
    get_route(State(state), auth, Path(id)).await
}

pub async fn update_route(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<RoutePayload>,
) -> AppResult<Json<RouteDetailDto>> {
    auth.require(ROUTE_MANAGE)?;
    validate_route(&body)?;
    check_route_links(&state, &body).await?;

    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE transport_routes SET school_id = ?, academic_year_id = ?, company_id = ?,
                vehicle_id = ?, driver_id = ?, name = ?, shift = ?, route_type = ?,
                km_paved = ?, km_unpaved = ?, departure_time = ?, arrival_time = ?,
                return_departure_time = ?, is_outsourced = ?, is_active = ?, notes = ?
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&body.school_id)
    .bind(&body.academic_year_id)
    .bind(body.company_id.as_deref())
    .bind(body.vehicle_id.as_deref())
    .bind(body.driver_id.as_deref())
    .bind(body.name.trim())
    .bind(&body.shift)
    .bind(
        body.route_type
            .clone()
            .unwrap_or_else(|| "rural".to_string()),
    )
    .bind(body.km_paved.unwrap_or(0.0))
    .bind(body.km_unpaved.unwrap_or(0.0))
    .bind(body.departure_time)
    .bind(body.arrival_time)
    .bind(body.return_departure_time)
    .bind(body.is_outsourced)
    .bind(body.is_active)
    .bind(body.notes.as_deref())
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Rota não encontrada"));
    }
    audit(
        &mut tx,
        &auth,
        &ctx,
        "update",
        "transport.route",
        &id,
        Some(json!({
            "name": body.name, "is_active": body.is_active
        })),
    )
    .await?;
    tx.commit().await?;
    get_route(State(state), auth, Path(id)).await
}

pub async fn delete_route(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
) -> AppResult<Json<serde_json::Value>> {
    auth.require(ROUTE_MANAGE)?;
    let mut tx = state.pool.begin().await?;
    let affected = sqlx::query(
        "UPDATE transport_routes SET deleted_at = UTC_TIMESTAMP(6), is_active = FALSE
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::not_found("Rota não encontrada"));
    }
    audit(&mut tx, &auth, &ctx, "delete", "transport.route", &id, None).await?;
    tx.commit().await?;
    Ok(Json(json!({ "status": "ok" })))
}

#[derive(Debug, Deserialize)]
pub struct ItineraryStop {
    pub stop_id: String,
    pub estimated_pickup_time: Option<NaiveTime>,
    pub estimated_dropoff_time: Option<NaiveTime>,
}

#[derive(Debug, Deserialize)]
pub struct ItineraryPayload {
    pub stops: Vec<ItineraryStop>,
}

pub async fn set_itinerary(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    ctx: ReqCtx,
    Json(body): Json<ItineraryPayload>,
) -> AppResult<Json<RouteDetailDto>> {
    auth.require(ROUTE_MANAGE)?;

    let route_exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM transport_routes WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await?;
    if route_exists == 0 {
        return Err(AppError::not_found("Rota não encontrada"));
    }

    let mut seen = std::collections::HashSet::new();
    for stop in &body.stops {
        if !seen.insert(stop.stop_id.clone()) {
            return Err(AppError::conflict(
                "O mesmo ponto de parada não pode aparecer duas vezes na rota",
            ));
        }
        let exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM transport_stops WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(&stop.stop_id)
        .fetch_one(&state.pool)
        .await?;
        if exists == 0 {
            return Err(AppError::validation_single(
                "stops",
                format!("parada inexistente: {}", stop.stop_id),
            ));
        }
    }

    let mut tx = state.pool.begin().await?;
    sqlx::query("DELETE FROM transport_route_stops WHERE route_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await?;
    for (index, stop) in body.stops.iter().enumerate() {
        sqlx::query(
            "INSERT INTO transport_route_stops
             (id, route_id, stop_id, sequence_order, estimated_pickup_time, estimated_dropoff_time)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(uuid::Uuid::now_v7().to_string())
        .bind(&id)
        .bind(&stop.stop_id)
        .bind((index + 1) as i32)
        .bind(stop.estimated_pickup_time)
        .bind(stop.estimated_dropoff_time)
        .execute(&mut *tx)
        .await?;
    }
    audit(
        &mut tx,
        &auth,
        &ctx,
        "update_itinerary",
        "transport.route",
        &id,
        Some(json!({
            "stops": body.stops.len()
        })),
    )
    .await?;
    tx.commit().await?;

    get_route(State(state), auth, Path(id)).await
}

#[derive(Debug, Serialize)]
pub struct OccupancyDto {
    pub route_id: String,
    pub capacity: Option<i32>,
    pub allocated_students: i64,
    pub occupancy_percentage: Option<f64>,
    pub overloaded: bool,
}

pub async fn route_occupancy(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<OccupancyDto>> {
    auth.require(ROUTE_READ)?;
    let route = load_route(&state, &id).await?;
    let percentage =
        occupancy_percentage(route.allocated_students, route.capacity.unwrap_or(0) as i64);
    Ok(Json(OccupancyDto {
        route_id: route.id,
        capacity: route.capacity,
        allocated_students: route.allocated_students,
        occupancy_percentage: percentage,
        overloaded: percentage.map(|value| value > 100.0).unwrap_or(false),
    }))
}

async fn load_route(state: &AppState, id: &str) -> AppResult<RouteDto> {
    let sql = format!("{ROUTE_SELECT} WHERE r.id = ? AND r.deleted_at IS NULL");
    sqlx::query_as::<_, RouteDto>(&sql)
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Rota não encontrada"))
}

async fn load_route_stops(state: &AppState, route_id: &str) -> AppResult<Vec<RouteStopDto>> {
    Ok(sqlx::query_as::<_, RouteStopDto>(
        "SELECT rs.id, rs.stop_id, s.name, s.latitude, s.longitude, rs.sequence_order,
                rs.estimated_pickup_time, rs.estimated_dropoff_time
         FROM transport_route_stops rs
         JOIN transport_stops s ON s.id = rs.stop_id
         WHERE rs.route_id = ? ORDER BY rs.sequence_order",
    )
    .bind(route_id)
    .fetch_all(&state.pool)
    .await?)
}

fn validate_route(body: &RoutePayload) -> AppResult<()> {
    let mut errors = Vec::new();
    if body.name.trim().is_empty() {
        errors.push(FieldError::new("name", "obrigatório"));
    }
    if !shift_valid(&body.shift) {
        errors.push(FieldError::new("shift", "turno inválido"));
    }
    if let Some(route_type) = &body.route_type {
        if !network_type_valid(route_type) {
            errors.push(FieldError::new("route_type", "use rural, urban ou mixed"));
        }
    }
    if body.km_paved.unwrap_or(0.0) < 0.0 || body.km_unpaved.unwrap_or(0.0) < 0.0 {
        errors.push(FieldError::new("km_paved", "não pode ser negativo"));
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::validation(errors))
    }
}

async fn check_route_links(state: &AppState, body: &RoutePayload) -> AppResult<()> {
    let school: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM schools WHERE id = ? AND deleted_at IS NULL")
            .bind(&body.school_id)
            .fetch_one(&state.pool)
            .await?;
    if school == 0 {
        return Err(AppError::validation_single(
            "school_id",
            "escola inexistente",
        ));
    }

    let year: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM academic_years WHERE id = ?")
        .bind(&body.academic_year_id)
        .fetch_one(&state.pool)
        .await?;
    if year == 0 {
        return Err(AppError::validation_single(
            "academic_year_id",
            "ano letivo inexistente",
        ));
    }

    if let Some(company_id) = &body.company_id {
        let company: Option<(bool, Option<NaiveDate>)> = sqlx::query_as(
            "SELECT is_active, contract_end_date FROM transport_companies
             WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(company_id)
        .fetch_optional(&state.pool)
        .await?;
        let Some((is_active, contract_end)) = company else {
            return Err(AppError::validation_single(
                "company_id",
                "empresa inexistente",
            ));
        };
        if !is_active {
            return Err(AppError::conflict("Empresa de transporte inativa"));
        }
        if !contract_valid(contract_end, Utc::now().date_naive()) {
            return Err(AppError::conflict(
                "Contrato da empresa de transporte vencido",
            ));
        }
    }

    if let Some(vehicle_id) = &body.vehicle_id {
        let vehicle: Option<(bool, Option<NaiveDate>, i32)> = sqlx::query_as(
            "SELECT is_active, inspection_valid_until, passenger_capacity FROM transport_vehicles
             WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(vehicle_id)
        .fetch_optional(&state.pool)
        .await?;
        let Some((is_active, valid_until, capacity)) = vehicle else {
            return Err(AppError::validation_single(
                "vehicle_id",
                "veículo inexistente",
            ));
        };
        if !is_active {
            return Err(AppError::conflict("Veículo inativo"));
        }
        if !inspection_valid(valid_until, Utc::now().date_naive()) {
            return Err(AppError::conflict(
                "Veículo com vistoria DETRAN vencida ou não registrada",
            ));
        }
        if capacity <= 0 {
            return Err(AppError::conflict("Veículo sem capacidade de passageiros"));
        }
    }

    if let Some(driver_id) = &body.driver_id {
        let driver: Option<(
            bool,
            String,
            NaiveDate,
            NaiveDate,
            Option<NaiveDate>,
            Option<NaiveDate>,
        )> = sqlx::query_as(
            "SELECT is_active, cnh_category, cnh_expiration_date, birth_date,
                        course_expiration_date, toxicological_expiration_date
                 FROM transport_drivers WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(driver_id)
        .fetch_optional(&state.pool)
        .await?;
        let Some((is_active, category, cnh_exp, birth, course_exp, tox_exp)) = driver else {
            return Err(AppError::validation_single(
                "driver_id",
                "motorista inexistente",
            ));
        };
        if !is_active {
            return Err(AppError::conflict("Motorista inativo"));
        }
        let issues = crate::domain::driver_issues(&DriverEligibility {
            cnh_category: &category,
            cnh_expiration: cnh_exp,
            birth_date: birth,
            course_expiration: course_exp,
            toxicological_expiration: tox_exp,
            today: Utc::now().date_naive(),
        });
        if !issues.is_empty() {
            return Err(AppError::conflict(format!(
                "Motorista inelegível: {}",
                issues.join("; ")
            )));
        }
    }

    Ok(())
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
