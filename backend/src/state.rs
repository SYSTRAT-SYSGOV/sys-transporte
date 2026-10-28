use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};

use axum::http::HeaderMap;
use sqlx::MySqlPool;
use tokio::sync::Mutex;

use crate::config::Config;

pub type PermissionCache = Arc<Mutex<HashMap<String, CacheEntry>>>;

#[derive(Clone)]
pub struct CacheEntry {
    pub loaded_at: Instant,
    pub permissions: Vec<String>,
}

const TTL: Duration = Duration::from_secs(60);

#[derive(Clone)]
pub struct AppState {
    pub pool: MySqlPool,
    pub config: Arc<Config>,
    pub permissions: PermissionCache,
}

impl AppState {
    pub fn new(pool: MySqlPool, config: Config) -> Self {
        Self {
            pool,
            config: Arc::new(config),
            permissions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn permissions_for(&self, user_id: &str) -> Result<Vec<String>, sqlx::Error> {
        {
            let cache = self.permissions.lock().await;
            if let Some(entry) = cache.get(user_id) {
                if entry.loaded_at.elapsed() < TTL {
                    return Ok(entry.permissions.clone());
                }
            }
        }

        let permissions: Vec<String> = sqlx::query_scalar(
            "SELECT DISTINCT rp.permission_code
             FROM user_roles ur
             JOIN role_permissions rp ON rp.role_id = ur.role_id
             WHERE ur.user_id = ?",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        let mut cache = self.permissions.lock().await;
        cache.insert(
            user_id.to_string(),
            CacheEntry {
                loaded_at: Instant::now(),
                permissions: permissions.clone(),
            },
        );
        Ok(permissions)
    }

    pub async fn invalidate_permissions(&self, user_id: &str) {
        self.permissions.lock().await.remove(user_id);
    }

    pub async fn invalidate_all_permissions(&self) {
        self.permissions.lock().await.clear();
    }
}

/// Identificador da requisição e origem, usados na auditoria.
#[derive(Debug, Clone, Default)]
pub struct ReqCtx {
    pub request_id: Option<String>,
    pub ip: Option<String>,
}

impl ReqCtx {
    pub fn from_headers(headers: &HeaderMap) -> Self {
        let request_id = headers
            .get("x-request-id")
            .and_then(|v| v.to_str().ok())
            .map(|v| v.to_string());
        let ip = headers
            .get("x-real-ip")
            .or_else(|| headers.get("x-forwarded-for"))
            .and_then(|v| v.to_str().ok())
            .map(|v| v.split(',').next().unwrap_or(v).trim().to_string());
        Self { request_id, ip }
    }
}
