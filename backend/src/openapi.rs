use serde_json::{json, Value};

pub fn document() -> Value {
    json!({
        "openapi": "3.0.3",
        "info": {
            "title": "Transporte Escolar API",
            "version": "1.0.0",
            "description": "API REST do sistema de transporte escolar (PNATE, CTB e Censo Registro 60)."
        },
        "servers": [{ "url": "/api/v1" }],
        "security": [{ "bearerAuth": [] }],
        "paths": paths(),
        "components": {
            "securitySchemes": {
                "bearerAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT" }
            },
            "responses": {
                "Problem": {
                    "description": "Erro no formato RFC 7807",
                    "content": {
                        "application/problem+json": {
                            "schema": { "$ref": "#/components/schemas/Problem" }
                        }
                    }
                }
            },
            "schemas": schemas()
        }
    })
}

fn ok() -> Value {
    json!({ "description": "OK" })
}

fn problem() -> Value {
    json!({ "$ref": "#/components/responses/Problem" })
}

fn op(tag: &str, summary: &str) -> Value {
    json!({
        "tags": [tag],
        "summary": summary,
        "responses": { "200": ok(), "400": problem(), "401": problem(), "403": problem() }
    })
}

fn paths() -> Value {
    json!({
        "/auth/login": {
            "post": {
                "tags": ["auth"], "summary": "Autenticar usuário", "security": [],
                "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/LoginRequest" } } } },
                "responses": { "200": { "description": "OK", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/LoginResponse" } } } }, "401": problem(), "423": problem() }
            }
        },
        "/auth/refresh": {
            "post": {
                "tags": ["auth"], "summary": "Renovar a sessão", "security": [],
                "responses": { "200": ok(), "401": problem() }
            }
        },
        "/auth/logout": { "post": op("auth", "Encerrar sessão") },
        "/auth/me": { "get": op("auth", "Dados da sessão atual") },

        "/identity/users": {
            "get": op("identity", "Listar usuários"),
            "post": op("identity", "Criar usuário")
        },
        "/identity/users/{id}": { "put": op("identity", "Atualizar usuário") },
        "/identity/users/{id}/unlock": { "post": op("identity", "Desbloquear usuário") },
        "/identity/users/{id}/password": { "post": op("identity", "Redefinir senha") },
        "/identity/roles": {
            "get": op("identity", "Listar papéis"),
            "post": op("identity", "Criar papel")
        },
        "/identity/roles/{id}": { "put": op("identity", "Atualizar papel") },
        "/identity/permissions": { "get": op("identity", "Listar permissões") },
        "/identity/audit": { "get": op("identity", "Consultar auditoria") },

        "/registry/schools": {
            "get": op("registry", "Listar escolas"),
            "post": op("registry", "Criar escola")
        },
        "/registry/schools/{id}": {
            "get": op("registry", "Detalhar escola"),
            "put": op("registry", "Atualizar escola"),
            "delete": op("registry", "Inativar escola")
        },
        "/registry/students": {
            "get": op("registry", "Listar alunos"),
            "post": op("registry", "Criar aluno")
        },
        "/registry/students/{id}": {
            "get": op("registry", "Detalhar aluno"),
            "put": op("registry", "Atualizar aluno"),
            "delete": op("registry", "Inativar aluno")
        },
        "/registry/guardians": { "get": op("registry", "Listar responsáveis") },
        "/registry/academic-years": {
            "get": op("registry", "Listar anos letivos"),
            "post": op("registry", "Criar ano letivo")
        },
        "/registry/enrollments": {
            "get": op("registry", "Listar matrículas"),
            "post": op("registry", "Criar matrícula")
        },
        "/registry/enrollments/{id}/close": { "post": op("registry", "Encerrar matrícula") },

        "/transport/companies": {
            "get": op("fleet", "Listar empresas"),
            "post": op("fleet", "Criar empresa")
        },
        "/transport/companies/{id}": {
            "get": op("fleet", "Detalhar empresa"),
            "put": op("fleet", "Atualizar empresa"),
            "delete": op("fleet", "Inativar empresa")
        },
        "/transport/drivers": {
            "get": op("fleet", "Listar motoristas"),
            "post": op("fleet", "Criar motorista")
        },
        "/transport/drivers/{id}": {
            "get": op("fleet", "Detalhar motorista"),
            "put": op("fleet", "Atualizar motorista"),
            "delete": op("fleet", "Inativar motorista")
        },
        "/transport/drivers/alerts": { "get": op("fleet", "Alertas de habilitação") },
        "/transport/vehicles": {
            "get": op("fleet", "Listar veículos"),
            "post": op("fleet", "Criar veículo")
        },
        "/transport/vehicles/{id}": {
            "get": op("fleet", "Detalhar veículo"),
            "put": op("fleet", "Atualizar veículo"),
            "delete": op("fleet", "Inativar veículo")
        },
        "/transport/vehicles/{id}/inspections": {
            "get": op("fleet", "Histórico de vistorias"),
            "post": op("fleet", "Registrar vistoria")
        },
        "/transport/alerts": { "get": op("fleet", "Alertas consolidados") },

        "/transport/stops": {
            "get": {
                "tags": ["routing"],
                "summary": "Listar pontos de parada (filtro opcional por rota)",
                "parameters": [
                    { "name": "route_id", "in": "query", "required": false, "schema": { "type": "string" } },
                    { "name": "search", "in": "query", "required": false, "schema": { "type": "string" } }
                ],
                "responses": { "200": ok(), "400": problem(), "401": problem(), "403": problem() }
            },
            "post": op("routing", "Criar ponto de parada")
        },
        "/transport/stops/{id}": {
            "get": op("routing", "Detalhar ponto de parada"),
            "put": op("routing", "Atualizar ponto de parada"),
            "delete": op("routing", "Inativar ponto de parada")
        },
        "/transport/routes": {
            "get": op("routing", "Listar rotas"),
            "post": op("routing", "Criar rota")
        },
        "/transport/routes/{id}": {
            "get": op("routing", "Detalhar rota e itinerário"),
            "put": op("routing", "Atualizar rota"),
            "delete": op("routing", "Inativar rota")
        },
        "/transport/routes/{id}/stops": { "put": op("routing", "Definir itinerário") },
        "/transport/routes/{id}/occupancy": { "get": op("routing", "Consultar ocupação") },

        "/transport/routes/{id}/students": {
            "get": op("allocation", "Listar alunos alocados"),
            "post": op("allocation", "Alocar estudante")
        },
        "/transport/routes/{id}/students/{allocation_id}": {
            "delete": op("allocation", "Desvincular estudante")
        },
        "/transport/census/validation": { "get": op("allocation", "Validar Registro 60") },
        "/transport/census/export": { "get": op("allocation", "Exportar CSV do Censo") },

        "/dashboard/summary": { "get": op("dashboard", "Resumo operacional") }
    })
}

fn schemas() -> Value {
    let mut schemas = json!({
        "Problem": {
            "type": "object",
            "properties": {
                "type": { "type": "string" },
                "title": { "type": "string" },
                "status": { "type": "integer" },
                "detail": { "type": "string" },
                "errors": { "type": "array", "items": { "$ref": "#/components/schemas/FieldError" } }
            }
        },
        "FieldError": {
            "type": "object",
            "properties": { "field": { "type": "string" }, "message": { "type": "string" } }
        },
        "LoginRequest": {
            "type": "object",
            "required": ["email", "password"],
            "properties": { "email": { "type": "string" }, "password": { "type": "string" } }
        },
        "SessionUser": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "full_name": { "type": "string" },
                "email": { "type": "string" },
                "roles": { "type": "array", "items": { "type": "string" } },
                "permissions": { "type": "array", "items": { "type": "string" } }
            }
        },
        "LoginResponse": {
            "type": "object",
            "properties": {
                "access_token": { "type": "string" },
                "refresh_token": { "type": "string" },
                "token_type": { "type": "string" },
                "expires_in": { "type": "integer" },
                "user": { "$ref": "#/components/schemas/SessionUser" }
            }
        },
        "School": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "name": { "type": "string" },
                "inep_code": { "type": "string", "nullable": true },
                "education_network": { "type": "string" },
                "city": { "type": "string", "nullable": true },
                "state_uf": { "type": "string", "nullable": true },
                "address": { "type": "string", "nullable": true },
                "is_active": { "type": "boolean" },
                "created_at": { "type": "string", "format": "date-time" }
            }
        },
        "Guardian": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "full_name": { "type": "string" },
                "document": { "type": "string", "nullable": true },
                "phone": { "type": "string", "nullable": true },
                "email": { "type": "string", "nullable": true },
                "relationship": { "type": "string" },
                "is_primary": { "type": "boolean" }
            }
        },
        "Student": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "full_name": { "type": "string" },
                "birth_date": { "type": "string", "format": "date" },
                "document": { "type": "string", "nullable": true },
                "notes": { "type": "string", "nullable": true },
                "is_active": { "type": "boolean" },
                "created_at": { "type": "string", "format": "date-time" }
            }
        },
        "Company": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "legal_name": { "type": "string" },
                "cnpj": { "type": "string" },
                "contract_number": { "type": "string", "nullable": true },
                "contract_start_date": { "type": "string", "format": "date", "nullable": true },
                "contract_end_date": { "type": "string", "format": "date", "nullable": true },
                "responsible_name": { "type": "string", "nullable": true },
                "phone": { "type": "string", "nullable": true },
                "email": { "type": "string", "nullable": true },
                "is_active": { "type": "boolean" },
                "notes": { "type": "string", "nullable": true },
                "created_at": { "type": "string", "format": "date-time" },
                "contract_expired": { "type": "boolean" }
            }
        },
        "Driver": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "company_id": { "type": "string", "nullable": true },
                "company_name": { "type": "string", "nullable": true },
                "full_name": { "type": "string" },
                "cpf": { "type": "string" },
                "birth_date": { "type": "string", "format": "date" },
                "cnh_number": { "type": "string" },
                "cnh_category": { "type": "string" },
                "cnh_first_issue_date": { "type": "string", "format": "date", "nullable": true },
                "cnh_expiration_date": { "type": "string", "format": "date" },
                "course_certificate": { "type": "string", "nullable": true },
                "course_expiration_date": { "type": "string", "format": "date", "nullable": true },
                "toxicological_exam_date": { "type": "string", "format": "date", "nullable": true },
                "toxicological_expiration_date": { "type": "string", "format": "date", "nullable": true },
                "phone": { "type": "string", "nullable": true },
                "is_active": { "type": "boolean" },
                "notes": { "type": "string", "nullable": true },
                "issues": { "type": "array", "items": { "type": "string" } }
            }
        },
        "Vehicle": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "company_id": { "type": "string", "nullable": true },
                "company_name": { "type": "string", "nullable": true },
                "default_driver_id": { "type": "string", "nullable": true },
                "default_driver_name": { "type": "string", "nullable": true },
                "description": { "type": "string" },
                "plate": { "type": "string" },
                "renavam": { "type": "string", "nullable": true },
                "data_licenca": { "type": "string", "format": "date", "nullable": true },
                "chassis": { "type": "string", "nullable": true },
                "brand_model": { "type": "string", "nullable": true },
                "manufacture_year": { "type": "integer", "nullable": true },
                "model_year": { "type": "integer", "nullable": true },
                "passenger_capacity": { "type": "integer" },
                "network_type": { "type": "string" },
                "vehicle_type_inep": { "type": "integer" },
                "is_exclusive_school_use": { "type": "boolean" },
                "is_accessible_disability": { "type": "boolean" },
                "last_inspection_date": { "type": "string", "format": "date", "nullable": true },
                "inspection_certificate_number": { "type": "string", "nullable": true },
                "inspection_valid_until": { "type": "string", "format": "date", "nullable": true },
                "is_active": { "type": "boolean" },
                "deactivation_reason": { "type": "string", "nullable": true },
                "notes": { "type": "string", "nullable": true },
                "created_at": { "type": "string", "format": "date-time" },
                "inspection_valid": { "type": "boolean" }
            }
        },
        "Inspection": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "vehicle_id": { "type": "string" },
                "inspection_date": { "type": "string", "format": "date" },
                "certificate_number": { "type": "string" },
                "valid_until": { "type": "string", "format": "date" },
                "notes": { "type": "string", "nullable": true },
                "created_at": { "type": "string", "format": "date-time" }
            }
        },
        "Stop": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "name": { "type": "string" },
                "description": { "type": "string", "nullable": true },
                "latitude": { "type": "number", "nullable": true },
                "longitude": { "type": "number", "nullable": true },
                "postal_code": { "type": "string", "nullable": true },
                "street": { "type": "string", "nullable": true },
                "number": { "type": "string", "nullable": true },
                "complement": { "type": "string", "nullable": true },
                "neighborhood": { "type": "string", "nullable": true },
                "city": { "type": "string", "nullable": true },
                "state_uf": { "type": "string", "nullable": true },
                "landmark": { "type": "string", "nullable": true },
                "is_active": { "type": "boolean" }
            }
        },
        "RouteStop": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "stop_id": { "type": "string" },
                "name": { "type": "string" },
                "latitude": { "type": "number", "nullable": true },
                "longitude": { "type": "number", "nullable": true },
                "sequence_order": { "type": "integer" },
                "estimated_pickup_time": { "type": "string", "nullable": true },
                "estimated_dropoff_time": { "type": "string", "nullable": true }
            }
        },
        "Route": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "name": { "type": "string" },
                "school_id": { "type": "string" },
                "school_name": { "type": "string" },
                "academic_year_id": { "type": "string" },
                "academic_year": { "type": "integer" },
                "company_id": { "type": "string", "nullable": true },
                "vehicle_id": { "type": "string", "nullable": true },
                "vehicle_description": { "type": "string", "nullable": true },
                "vehicle_plate": { "type": "string", "nullable": true },
                "driver_id": { "type": "string", "nullable": true },
                "driver_name": { "type": "string", "nullable": true },
                "shift": { "type": "string" },
                "route_type": { "type": "string" },
                "km_paved": { "type": "number" },
                "km_unpaved": { "type": "number" },
                "total_km": { "type": "number" },
                "departure_time": { "type": "string", "nullable": true },
                "arrival_time": { "type": "string", "nullable": true },
                "return_departure_time": { "type": "string", "nullable": true },
                "is_outsourced": { "type": "boolean" },
                "is_active": { "type": "boolean" },
                "notes": { "type": "string", "nullable": true },
                "created_at": { "type": "string", "format": "date-time" },
                "capacity": { "type": "integer", "nullable": true },
                "allocated_students": { "type": "integer" },
                "stops_count": { "type": "integer" },
                "occupancy_percentage": { "type": "number", "nullable": true },
                "itinerary_valid": { "type": "boolean" }
            }
        },
        "Allocation": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "student_id": { "type": "string" },
                "student_name": { "type": "string" },
                "enrollment_id": { "type": "string" },
                "route_id": { "type": "string" },
                "route_name": { "type": "string" },
                "stop_id": { "type": "string", "nullable": true },
                "stop_name": { "type": "string", "nullable": true },
                "shift": { "type": "string" },
                "uses_rural_transport": { "type": "boolean" },
                "public_transport_jurisdiction": { "type": "integer", "nullable": true },
                "special_needs_transport": { "type": "boolean" },
                "special_needs_notes": { "type": "string", "nullable": true },
                "start_date": { "type": "string", "format": "date" },
                "end_date": { "type": "string", "format": "date", "nullable": true },
                "end_reason": { "type": "string", "nullable": true },
                "created_at": { "type": "string", "format": "date-time" }
            }
        },
        "User": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "email": { "type": "string" },
                "full_name": { "type": "string" },
                "is_active": { "type": "boolean" },
                "failed_attempts": { "type": "integer" },
                "locked_until": { "type": "string", "format": "date-time", "nullable": true },
                "last_login_at": { "type": "string", "format": "date-time", "nullable": true },
                "created_at": { "type": "string", "format": "date-time" },
                "roles": { "type": "array", "items": { "$ref": "#/components/schemas/RoleRef" } }
            }
        },
        "RoleRef": {
            "type": "object",
            "properties": { "id": { "type": "string" }, "code": { "type": "string" }, "name": { "type": "string" } }
        },
        "Role": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "code": { "type": "string" },
                "name": { "type": "string" },
                "description": { "type": "string", "nullable": true },
                "is_system": { "type": "boolean" },
                "permissions": { "type": "array", "items": { "type": "string" } }
            }
        },
        "AuditEvent": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "actor_email": { "type": "string", "nullable": true },
                "action": { "type": "string" },
                "resource": { "type": "string" },
                "resource_id": { "type": "string", "nullable": true },
                "result": { "type": "string" },
                "ip": { "type": "string", "nullable": true },
                "request_id": { "type": "string", "nullable": true },
                "created_at": { "type": "string", "format": "date-time" },
                "before_data": { "type": "object", "nullable": true },
                "after_data": { "type": "object", "nullable": true }
            }
        },
        "Alert": {
            "type": "object",
            "properties": {
                "kind": { "type": "string" },
                "severity": { "type": "string" },
                "resource": { "type": "string" },
                "resource_id": { "type": "string" },
                "title": { "type": "string" },
                "detail": { "type": "string" },
                "due_date": { "type": "string", "format": "date" },
                "days_left": { "type": "integer" }
            }
        },
        "DashboardSummary": {
            "type": "object",
            "properties": {
                "counts": {
                    "type": "object",
                    "properties": {
                        "schools": { "type": "integer" },
                        "students": { "type": "integer" },
                        "routes": { "type": "integer" },
                        "vehicles": { "type": "integer" },
                        "drivers": { "type": "integer" },
                        "allocations": { "type": "integer" }
                    }
                },
                "occupancy": { "type": "array", "items": { "$ref": "#/components/schemas/OccupancyItem" } },
                "alerts": { "type": "array", "items": { "$ref": "#/components/schemas/Alert" } }
            }
        },
        "OccupancyItem": {
            "type": "object",
            "properties": {
                "route_id": { "type": "string" },
                "name": { "type": "string" },
                "school_name": { "type": "string" },
                "capacity": { "type": "integer", "nullable": true },
                "allocated_students": { "type": "integer" },
                "occupancy_percentage": { "type": "number", "nullable": true },
                "status": { "type": "string", "enum": ["ok", "warning", "critical", "unknown"] }
            }
        }
    });

    // Os DTOs serializam todas as propriedades, inclusive as nulas; marcá-las como
    // obrigatórias mantém o cliente gerado fiel ao contrato de resposta.
    if let Some(map) = schemas.as_object_mut() {
        for schema in map.values_mut() {
            if let Some(properties) = schema.get("properties").and_then(Value::as_object) {
                let mut required: Vec<String> = properties.keys().cloned().collect();
                required.sort();
                schema["required"] =
                    Value::Array(required.into_iter().map(Value::String).collect());
            }
        }
    }

    schemas
}
