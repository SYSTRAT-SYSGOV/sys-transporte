// Arquivo gerado por scripts/gen-api-types.mjs a partir de openapi.json.
// Não edite manualmente: rode o gerador novamente.

export interface Alert {
  days_left: number;
  detail: string;
  due_date: string;
  kind: string;
  resource: string;
  resource_id: string;
  severity: string;
  title: string;
}

export interface Allocation {
  created_at: string;
  end_date: string | null;
  end_reason: string | null;
  enrollment_id: string;
  id: string;
  public_transport_jurisdiction: number | null;
  route_id: string;
  route_name: string;
  shift: string;
  special_needs_notes: string | null;
  special_needs_transport: boolean;
  start_date: string;
  stop_id: string | null;
  stop_name: string | null;
  student_id: string;
  student_name: string;
  uses_rural_transport: boolean;
}

export interface AuditEvent {
  action: string;
  actor_email: string | null;
  after_data: Record<string, unknown> | null;
  before_data: Record<string, unknown> | null;
  created_at: string;
  id: string;
  ip: string | null;
  request_id: string | null;
  resource: string;
  resource_id: string | null;
  result: string;
}

export interface Company {
  cnpj: string;
  contract_end_date: string | null;
  contract_expired: boolean;
  contract_number: string | null;
  contract_start_date: string | null;
  created_at: string;
  email: string | null;
  id: string;
  is_active: boolean;
  legal_name: string;
  notes: string | null;
  phone: string | null;
  responsible_name: string | null;
}

export interface DashboardSummary {
  alerts: Alert[];
  counts: {
    allocations?: number;
    drivers?: number;
    routes?: number;
    schools?: number;
    students?: number;
    vehicles?: number;
  };
  occupancy: OccupancyItem[];
}

export interface Driver {
  birth_date: string;
  cnh_category: string;
  cnh_expiration_date: string;
  cnh_first_issue_date: string | null;
  cnh_number: string;
  company_id: string | null;
  company_name: string | null;
  course_certificate: string | null;
  course_expiration_date: string | null;
  cpf: string;
  full_name: string;
  id: string;
  is_active: boolean;
  issues: string[];
  notes: string | null;
  phone: string | null;
  toxicological_exam_date: string | null;
  toxicological_expiration_date: string | null;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface Guardian {
  document: string | null;
  email: string | null;
  full_name: string;
  id: string;
  is_primary: boolean;
  phone: string | null;
  relationship: string;
}

export interface Inspection {
  certificate_number: string;
  created_at: string;
  id: string;
  inspection_date: string;
  notes: string | null;
  valid_until: string;
  vehicle_id: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
  user: SessionUser;
}

export interface OccupancyItem {
  allocated_students: number;
  capacity: number | null;
  name: string;
  occupancy_percentage: number | null;
  route_id: string;
  school_name: string;
  status: "ok" | "warning" | "critical" | "unknown";
}

export interface Problem {
  detail: string;
  errors: FieldError[];
  status: number;
  title: string;
  type: string;
}

export interface Role {
  code: string;
  description: string | null;
  id: string;
  is_system: boolean;
  name: string;
  permissions: string[];
}

export interface RoleRef {
  code: string;
  id: string;
  name: string;
}

export interface Route {
  academic_year: number;
  academic_year_id: string;
  allocated_students: number;
  arrival_time: string | null;
  capacity: number | null;
  company_id: string | null;
  created_at: string;
  departure_time: string | null;
  driver_id: string | null;
  driver_name: string | null;
  id: string;
  is_active: boolean;
  is_outsourced: boolean;
  itinerary_valid: boolean;
  km_paved: number;
  km_unpaved: number;
  name: string;
  notes: string | null;
  occupancy_percentage: number | null;
  return_departure_time: string | null;
  route_type: string;
  school_id: string;
  school_name: string;
  shift: string;
  stops_count: number;
  total_km: number;
  vehicle_description: string | null;
  vehicle_id: string | null;
  vehicle_plate: string | null;
}

export interface RouteStop {
  estimated_dropoff_time: string | null;
  estimated_pickup_time: string | null;
  id: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  sequence_order: number;
  stop_id: string;
}

export interface School {
  address: string | null;
  city: string | null;
  created_at: string;
  education_network: string;
  id: string;
  inep_code: string | null;
  is_active: boolean;
  name: string;
  state_uf: string | null;
}

export interface SessionUser {
  email: string;
  full_name: string;
  id: string;
  permissions: string[];
  roles: string[];
}

export interface Stop {
  city: string | null;
  complement: string | null;
  description: string | null;
  id: string;
  is_active: boolean;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  name: string;
  neighborhood: string | null;
  number: string | null;
  postal_code: string | null;
  state_uf: string | null;
  street: string | null;
}

export interface Student {
  birth_date: string;
  created_at: string;
  document: string | null;
  full_name: string;
  id: string;
  is_active: boolean;
  notes: string | null;
}

export interface User {
  created_at: string;
  email: string;
  failed_attempts: number;
  full_name: string;
  id: string;
  is_active: boolean;
  last_login_at: string | null;
  locked_until: string | null;
  roles: RoleRef[];
}

export interface Vehicle {
  brand_model: string | null;
  chassis: string | null;
  company_id: string | null;
  company_name: string | null;
  created_at: string;
  data_licenca: string | null;
  deactivation_reason: string | null;
  default_driver_id: string | null;
  default_driver_name: string | null;
  description: string;
  id: string;
  inspection_certificate_number: string | null;
  inspection_valid: boolean;
  inspection_valid_until: string | null;
  is_accessible_disability: boolean;
  is_active: boolean;
  is_exclusive_school_use: boolean;
  last_inspection_date: string | null;
  manufacture_year: number | null;
  model_year: number | null;
  network_type: string;
  notes: string | null;
  passenger_capacity: number;
  plate: string;
  renavam: string | null;
  vehicle_type_inep: number;
}

export const API_PATHS = [
  "/auth/login",
  "/auth/logout",
  "/auth/me",
  "/auth/refresh",
  "/dashboard/summary",
  "/identity/audit",
  "/identity/permissions",
  "/identity/roles",
  "/identity/roles/{id}",
  "/identity/users",
  "/identity/users/{id}",
  "/identity/users/{id}/password",
  "/identity/users/{id}/unlock",
  "/registry/academic-years",
  "/registry/enrollments",
  "/registry/enrollments/{id}/close",
  "/registry/guardians",
  "/registry/schools",
  "/registry/schools/{id}",
  "/registry/students",
  "/registry/students/{id}",
  "/transport/alerts",
  "/transport/census/export",
  "/transport/census/validation",
  "/transport/companies",
  "/transport/companies/{id}",
  "/transport/drivers",
  "/transport/drivers/alerts",
  "/transport/drivers/{id}",
  "/transport/routes",
  "/transport/routes/{id}",
  "/transport/routes/{id}/occupancy",
  "/transport/routes/{id}/stops",
  "/transport/routes/{id}/students",
  "/transport/routes/{id}/students/{allocation_id}",
  "/transport/stops",
  "/transport/stops/{id}",
  "/transport/vehicles",
  "/transport/vehicles/{id}",
  "/transport/vehicles/{id}/inspections",
] as const;

export type ApiPath = (typeof API_PATHS)[number];
