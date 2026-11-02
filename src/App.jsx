import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import LoginScreen from "./LoginScreen/LoginScreen";
import Dashboard from "./pages/Dashboard";
import Documents from "./Documents/Documents";
import AllLeads from "./Leads/AllLeads";
import PipelinePage from "./pages/PipelinePage";
import CalendarPage from "./pages/CalendarPage";
import Analytics from "./pages/Analytics/BiReports";
import Leaderboard from "./pages/Leaderboard/Leaderboard";
import BranchReports from "./pages/BranchReports/BranchReports";
import PaymentTracker from "./pages/PaymentTracker/PaymentTracker";
import Settings from "./pages/Setting/Settings";
import TodaysPlanPage from "./pages/MasterAdmin/TodaysPlanPage";
import UserManagement from "./pages/UserManagement/UserManagement";
import ExpenseTracker from "./pages/ExpenseTracker/ExpenseTracker";
import PnLPage        from "./pages/PnL/PnLPage";
import GstReport      from "./pages/GstReport/GstReport";
import AccountingPage from "./pages/Accounting/AccountingPage";
import EnquiriesPage  from "./pages/Enquiries/EnquiriesPage";
import QuotationPage  from "./pages/Quotation/QuotationPage";
import AttendancePage from "./pages/Attendance/AttendancePage";
import FundsPage      from "./pages/Funds/FundsPage";
import OwnerDesk        from "./pages/OwnerDesk/OwnerDesk";
import CredentialVault  from "./pages/CredentialVault/CredentialVault";
import IntegrationsPage  from "./pages/Integrations/IntegrationsPage";
import MonthlyBillingPage from "./pages/ProjectBilling/MonthlyBillingPage";

function isAuthed() {
  try {
    const v = localStorage.getItem("nnc_auth");
    return v === "true" || v === "1" || v === "yes";
  } catch (error) {
    console.error("isAuthed error:", error);
    return false;
  }
}

function ProtectedRoute({ children }) {
  try {
    return isAuthed() ? children : <Navigate to="/" replace />;
  } catch (error) {
    console.error("ProtectedRoute error:", error);
    return <Navigate to="/" replace />;
  }
}

function PublicRoute({ children }) {
  try {
    return isAuthed() ? <Navigate to="/owner-desk" replace /> : children;
  } catch (error) {
    console.error("PublicRoute error:", error);
    return children;
  }
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <LoginScreen />
          </PublicRoute>
        }
      />

      <Route
        path="/owner-desk"
        element={
          <ProtectedRoute>
            <OwnerDesk />
          </ProtectedRoute>
        }
      />

      <Route
        path="/credentials"
        element={
          <ProtectedRoute>
            <CredentialVault />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <Documents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/monthly-billing"
        element={
          <ProtectedRoute>
            <MonthlyBillingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <ProtectedRoute>
            <IntegrationsPage />
          </ProtectedRoute>
        }
      />


      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <AllLeads />
          </ProtectedRoute>
        }
      />

        <Route
        path="/todays-plan"
        element={
          <ProtectedRoute>
            <TodaysPlanPage/>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pipeline"
        element={
          <ProtectedRoute>
            <PipelinePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />

      <Route
        path="/leaderboard"
        element={
          <ProtectedRoute>
            <Leaderboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/branch-reports"
        element={
          <ProtectedRoute>
            <BranchReports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/payment-tracker"
        element={
          <ProtectedRoute>
            <PaymentTracker />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/user-management"
        element={
          <ProtectedRoute>
            <UserManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/expense-tracker"
        element={
          <ProtectedRoute>
            <ExpenseTracker />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pnl"
        element={
          <ProtectedRoute>
            <PnLPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/gst-report"
        element={
          <ProtectedRoute>
            <GstReport />
          </ProtectedRoute>
        }
      />

      <Route
        path="/accounting"
        element={
          <ProtectedRoute>
            <AccountingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/enquiries"
        element={
          <ProtectedRoute>
            <EnquiriesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/quotations"
        element={
          <ProtectedRoute>
            <QuotationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <AttendancePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/funds"
        element={
          <ProtectedRoute>
            <FundsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={<Navigate to={isAuthed() ? "/todays-plan" : "/"} replace />}
      />
    </Routes>
  );
}