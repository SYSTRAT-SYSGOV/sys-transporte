import type {
  Alert,
  Allocation,
  AuditEvent,
  Company,
  Driver,
  Guardian,
  Inspection,
  Route,
  RouteStop,
  School,
  Stop,
  Student,
  User,
  Vehicle,
} from "./generated";

export type {
  Alert,
  Allocation,
  AuditEvent,
  Company,
  Driver,
  Guardian,
  Inspection,
  Route,
  RouteStop,
  School,
  Stop,
  Student,
  User,
  Vehicle,
};

export type {
  DashboardSummary,
  FieldError,
  LoginRequest,
  LoginResponse,
  OccupancyItem,
  Problem,
  Role,
  RoleRef,
  SessionUser,
} from "./generated";

export interface Page<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
}

export interface SchoolPayload {
  name: string;
  inep_code: string | null;
  education_network: string;
  city: string | null;
  state_uf: string | null;
  address: string | null;
  is_active: boolean;
}

export interface GuardianInput {
  id?: string | null;
  full_name?: string | null;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  relationship: string;
  is_primary: boolean;
}

export interface StudentPayload {
  full_name: string;
  birth_date: string;
  document: string | null;
  notes: string | null;
  guardians: GuardianInput[];
}

export interface StudentDetail {
  student: Student;
  guardians: Guardian[];
}

export interface AcademicYear {
  id: string;
  year: number;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
}

export interface Enrollment {
  id: string;
  student_id: string;
  student_name: string;
  school_id: string;
  school_name: string;
  academic_year_id: string;
  academic_year: number;
  grade: string;
  shift: string;
  has_curricular_attendance: boolean;
  didactic_mediation: string;
  country: string;
  status: string;
  start_date: string;
  end_date: string | null;
  close_reason: string | null;
}

export interface EnrollmentPayload {
  student_id: string;
  school_id: string;
  academic_year_id: string;
  grade: string;
  shift: string;
  has_curricular_attendance: boolean;
  didactic_mediation: string;
  country: string;
  start_date: string;
}

export interface CompanyPayload {
  legal_name: string;
  cnpj: string;
  contract_number: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  responsible_name: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface DriverPayload {
  company_id: string | null;
  full_name: string;
  cpf: string;
  birth_date: string;
  cnh_number: string;
  cnh_category: string;
  cnh_first_issue_date: string | null;
  cnh_expiration_date: string;
  course_certificate: string | null;
  course_expiration_date: string | null;
  toxicological_exam_date: string | null;
  toxicological_expiration_date: string | null;
  phone: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface VehiclePayload {
  company_id: string | null;
  default_driver_id: string | null;
  description: string;
  plate: string;
  renavam: string | null;
  data_licenca: string | null;
  chassis: string | null;
  brand_model: string | null;
  manufacture_year: number | null;
  model_year: number | null;
  passenger_capacity: number;
  network_type: string;
  vehicle_type_inep: number;
  is_exclusive_school_use: boolean;
  is_accessible_disability: boolean;
  last_inspection_date: string | null;
  inspection_certificate_number: string | null;
  inspection_valid_until: string | null;
  is_active: boolean;
  deactivation_reason: string | null;
  notes: string | null;
}

export interface InspectionPayload {
  inspection_date: string;
  certificate_number: string;
  valid_until: string;
  notes: string | null;
}

export interface StopPayload {
  name: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  postal_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state_uf: string | null;
  landmark: string | null;
  is_active: boolean;
}

export interface RoutePayload {
  name: string;
  school_id: string;
  academic_year_id: string;
  company_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  shift: string;
  route_type: string;
  km_paved: number;
  km_unpaved: number;
  departure_time: string | null;
  arrival_time: string | null;
  return_departure_time: string | null;
  is_outsourced: boolean;
  is_active: boolean;
  notes: string | null;
}

export interface RouteDetail extends Route {
  stops: RouteStop[];
}

export interface AllocationPayload {
  student_id: string;
  stop_id: string | null;
  shift: string | null;
  uses_rural_transport: boolean;
  public_transport_jurisdiction: number | null;
  special_needs_transport: boolean;
  special_needs_notes: string | null;
  start_date: string | null;
  override_justification: string | null;
}

export interface RolePayload {
  code: string;
  name: string;
  description: string | null;
  permission_codes: string[];
}

export interface Permission {
  code: string;
  description: string;
}

export interface UserPayload {
  full_name: string;
  email: string;
  is_active: boolean;
  role_ids: string[];
}

export interface CreateUserPayload extends UserPayload {
  password: string;
}

export interface CensusPendency {
  enrollment_id: string;
  student_id: string;
  student_name: string;
  school_name: string;
  kind: string;
  detail: string;
}

export interface CensusValidation {
  academic_year_id: string;
  year: number;
  total_students: number;
  approved: boolean;
  pendencies: CensusPendency[];
}

export const SHIFT_LABELS: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  night: "Noite",
  full_day: "Integral",
};

export const ROUTE_TYPE_LABELS: Record<string, string> = {
  rural: "Rural",
  urban: "Urbana",
  mixed: "Mista",
};

export const NETWORK_LABELS: Record<string, string> = {
  municipal: "Municipal",
  estadual: "Estadual",
  federal: "Federal",
  privada: "Privada",
};

export const VEHICLE_TYPE_LABELS: Record<number, string> = {
  1: "1 - Micro-ônibus",
  2: "2 - Ônibus",
  3: "3 - Ônibus urbano",
  4: "4 - Van",
  5: "5 - Kombi",
  6: "6 - Camioneta",
  7: "7 - Caminhonete",
  8: "8 - Automóvel",
  9: "9 - Barco",
  10: "10 - Bicicleta",
  11: "11 - Outro",
};

export const JURISDICTION_LABELS: Record<number, string> = {
  1: "Estadual",
  2: "Municipal",
  3: "Compartilhado",
};

export const PENDENCY_LABELS: Record<string, string> = {
  sem_alocacao_ativa: "Sem alocação ativa",
  rota_sem_veiculo: "Rota sem veículo",
  rural_sem_declaracao: "Rural sem declaração",
  veiculo_nao_adaptado: "Veículo não adaptado",
};
