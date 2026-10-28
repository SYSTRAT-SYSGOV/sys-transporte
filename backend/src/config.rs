use std::{env, net::SocketAddr};

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub addr: SocketAddr,
    pub jwt_secret: String,
    pub access_token_minutes: i64,
    pub refresh_token_days: i64,
    pub cors_origins: Vec<String>,
    pub admin_name: String,
    pub admin_email: String,
    pub admin_password: Option<String>,
    pub seed_demo: bool,
    pub run_migrations: bool,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let database_url =
            env::var("DATABASE_URL").map_err(|_| "DATABASE_URL não definida".to_string())?;
        let addr = env::var("API_ADDR")
            .unwrap_or_else(|_| "0.0.0.0:8080".to_string())
            .parse::<SocketAddr>()
            .map_err(|e| format!("API_ADDR inválido: {e}"))?;
        let jwt_secret =
            env::var("JWT_SECRET").map_err(|_| "JWT_SECRET não definida".to_string())?;
        if jwt_secret.len() < 32 {
            return Err("JWT_SECRET deve ter ao menos 32 caracteres".to_string());
        }
        let cors_origins = env::var("CORS_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:8080,http://localhost:5173".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(Self {
            database_url,
            addr,
            jwt_secret,
            access_token_minutes: env_parse("ACCESS_TOKEN_MINUTES", 15),
            refresh_token_days: env_parse("REFRESH_TOKEN_DAYS", 7),
            cors_origins,
            admin_name: env::var("ADMIN_NAME").unwrap_or_else(|_| "Administrador".to_string()),
            admin_email: env::var("ADMIN_EMAIL")
                .unwrap_or_else(|_| "admin@escola.local".to_string()),
            admin_password: env::var("ADMIN_PASSWORD").ok().filter(|s| !s.is_empty()),
            seed_demo: env_bool("SEED_DEMO", false),
            run_migrations: env_bool("RUN_MIGRATIONS", true),
        })
    }
}

fn env_parse(key: &str, default: i64) -> i64 {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_bool(key: &str, default: bool) -> bool {
    env::var(key)
        .map(|v| matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(default)
}
