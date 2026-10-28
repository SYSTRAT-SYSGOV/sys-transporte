use serde_json::Value;
use sqlx::{Executor, MySql};

pub struct AuditEvent<'a> {
    pub actor_id: Option<&'a str>,
    pub actor_email: Option<&'a str>,
    pub action: &'a str,
    pub resource: &'a str,
    pub resource_id: Option<&'a str>,
    pub before: Option<&'a Value>,
    pub after: Option<&'a Value>,
    pub ip: Option<&'a str>,
    pub request_id: Option<&'a str>,
    pub result: &'a str,
}

/// Grava o evento na mesma conexão/transação da operação de negócio.
pub async fn record<'e, E>(executor: E, event: AuditEvent<'_>) -> Result<(), sqlx::Error>
where
    E: Executor<'e, Database = MySql>,
{
    let id = uuid::Uuid::now_v7().to_string();
    sqlx::query(
        "INSERT INTO audit_events
         (id, actor_id, actor_email, action, resource, resource_id, before_data, after_data, ip, request_id, result)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(event.actor_id)
    .bind(event.actor_email)
    .bind(event.action)
    .bind(event.resource)
    .bind(event.resource_id)
    .bind(event.before)
    .bind(event.after)
    .bind(event.ip)
    .bind(event.request_id)
    .bind(event.result)
    .execute(executor)
    .await?;
    Ok(())
}
