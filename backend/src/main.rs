#![recursion_limit = "512"]
// As consultas com `query_as` retornam tuplas longas; aliases não agregam clareza aqui.
#![allow(clippy::type_complexity)]

mod audit;
mod auth;
mod config;
mod db;
mod domain;
mod error;
mod openapi;
mod pagination;
mod routes;
mod state;

use std::net::SocketAddr;

use axum::{
    extract::State,
    http::{header, HeaderName, HeaderValue, Method, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde_json::json;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    trace::TraceLayer,
};
use tracing_subscriber::EnvFilter;

use crate::{config::Config, state::AppState};

const REQUEST_ID_HEADER: &str = "x-request-id";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    if std::env::args().any(|arg| arg == "--dump-openapi") {
        println!("{}", serde_json::to_string_pretty(&openapi::document())?);
        return Ok(());
    }

    let config = Config::from_env()?;
    let pool = db::connect(&config.database_url).await?;

    if config.run_migrations {
        let applied = db::run_migrations(&pool).await?;
        tracing::info!(applied, "migrations aplicadas");
    }
    db::seed(&pool, &config).await?;

    let state = AppState::new(pool, config.clone());
    let app = build_router(state);

    let listener = tokio::net::TcpListener::bind(config.addr).await?;
    tracing::info!(addr = %config.addr, "API iniciada");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

fn build_router(state: AppState) -> Router {
    let api = Router::new()
        .nest("/auth", routes::auth::router())
        .nest("/identity", routes::identity::router())
        .nest("/registry", routes::registry::router())
        .nest(
            "/transport",
            routes::fleet::router()
                .merge(routes::routing::router())
                .merge(routes::allocation::router()),
        )
        .nest("/dashboard", routes::dashboard::router());

    let origins = state
        .config
        .cors_origins
        .iter()
        .filter_map(|origin| origin.parse::<HeaderValue>().ok())
        .collect::<Vec<_>>();

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            HeaderName::from_static(REQUEST_ID_HEADER),
        ])
        .expose_headers([HeaderName::from_static(REQUEST_ID_HEADER)]);

    Router::new()
        .route("/health", get(health))
        .route("/api/v1/openapi.json", get(openapi_document))
        .nest("/api/v1", api)
        .with_state(state)
        .layer(PropagateRequestIdLayer::new(HeaderName::from_static(
            REQUEST_ID_HEADER,
        )))
        .layer(SetRequestIdLayer::new(
            HeaderName::from_static(REQUEST_ID_HEADER),
            MakeRequestUuid,
        ))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(json!({ "status": "ok", "database": "up" })),
        ),
        Err(err) => {
            tracing::error!(error = %err, "healthcheck do banco falhou");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({ "status": "degraded", "database": "down" })),
            )
        }
    }
}

async fn openapi_document() -> Json<serde_json::Value> {
    Json(openapi::document())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c().await.ok();
    };
    ctrl_c.await;
    tracing::info!("encerrando API");
}

#[allow(dead_code)]
fn _addr_marker(_: SocketAddr) {}
