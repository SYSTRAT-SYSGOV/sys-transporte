import { lazy, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { PermissionGate, RequireAuth } from "./components/guards";
import {
  ConfirmProvider,
  EmptyState,
  Toaster,
  TooltipProvider,
} from "@sysgov/ui";
import LoginPage from "./pages/LoginPage";

// App Shell do SYSGOV: módulos de UI carregados sob demanda.
const AuditPage = lazy(() => import("./pages/AuditPage"));
const CensusPage = lazy(() => import("./pages/CensusPage"));
const CompaniesPage = lazy(() => import("./pages/CompaniesPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DesignSystemPage = lazy(() => import("./pages/DesignSystemPage"));
const DriversPage = lazy(() => import("./pages/DriversPage"));
const EnrollmentsPage = lazy(() => import("./pages/EnrollmentsPage"));
const RolesPage = lazy(() => import("./pages/RolesPage"));
const RouteEditorPage = lazy(() => import("./pages/RouteEditorPage"));
const RoutesPage = lazy(() => import("./pages/RoutesPage"));
const SchoolsPage = lazy(() => import("./pages/SchoolsPage"));
const StopsPage = lazy(() => import("./pages/StopsPage"));
const StudentsPage = lazy(() => import("./pages/StudentsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const VehiclesPage = lazy(() => import("./pages/VehiclesPage"));

function guarded(permission: string, element: ReactNode) {
  return <PermissionGate permission={permission}>{element}</PermissionGate>;
}

export default function App() {
  return (
    <ConfirmProvider>
      <TooltipProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route
              index
              element={guarded("transport.dashboard.read", <DashboardPage />)}
            />
            <Route
              path="schools"
              element={guarded("registry.school.read", <SchoolsPage />)}
            />
            <Route
              path="students"
              element={guarded("registry.student.read", <StudentsPage />)}
            />
            <Route
              path="enrollments"
              element={guarded("registry.enrollment.read", <EnrollmentsPage />)}
            />
            <Route
              path="companies"
              element={guarded("transport.company.read", <CompaniesPage />)}
            />
            <Route
              path="drivers"
              element={guarded("transport.driver.read", <DriversPage />)}
            />
            <Route
              path="vehicles"
              element={guarded("transport.vehicle.read", <VehiclesPage />)}
            />
            <Route
              path="stops"
              element={guarded("transport.stop.read", <StopsPage />)}
            />
            <Route
              path="routes"
              element={guarded("transport.route.read", <RoutesPage />)}
            />
            <Route
              path="routes/:id"
              element={guarded("transport.route.read", <RouteEditorPage />)}
            />
            <Route
              path="census"
              element={guarded("transport.census.read", <CensusPage />)}
            />
            <Route
              path="users"
              element={guarded("identity.user.manage", <UsersPage />)}
            />
            <Route
              path="roles"
              element={guarded("identity.role.manage", <RolesPage />)}
            />
            <Route
              path="audit"
              element={guarded("identity.audit.read", <AuditPage />)}
            />
            <Route
              path="design-system"
              element={guarded("identity.user.manage", <DesignSystemPage />)}
            />
            <Route
              path="*"
              element={
                <EmptyState
                  title="Página não encontrada"
                  description="Verifique o endereço ou utilize o menu lateral."
                />
              }
            />
          </Route>
        </Routes>
        <Toaster />
      </TooltipProvider>
    </ConfirmProvider>
  );
}
