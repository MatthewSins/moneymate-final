/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Profile from '@/pages/Profile';

import Dashboard from '@/pages/Dashboard';
import DashboardLayout from '@/pages/DashboardLayout';
import AIHome from '@/pages/AIHome';
import ExpenseTracker from '@/pages/ExpenseTracker';
import InvoiceGenerator from '@/pages/InvoiceGenerator';
import InvoiceScanner from '@/pages/InvoiceScanner';
import FinancialCoach from '@/pages/FinancialCoach';

import AIInsights from '@/pages/AIInsights';
import Reports from '@/pages/Reports';
import AIBudgetCalculator from '@/pages/AIBudgetCalculator';

import GSTFiling from '@/pages/GSTFiling';
import Feedback from '@/pages/Feedback';

function HomeRedirect() {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  
  if (user) {
    return <Navigate to="/home" replace />;
  }
  
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background font-sans antialiased text-foreground">
            <main>
              <Routes>
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                <Route element={<ProtectedRoute />}>
                  <Route path="/home" element={<AIHome />} />
                  <Route path="/dashboard" element={<DashboardLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="tracker" element={<ExpenseTracker />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="coach" element={<FinancialCoach />} />
                  </Route>
                  <Route path="/tracker" element={<ExpenseTracker />} />
                  <Route path="/invoice" element={<InvoiceGenerator />} />
                  <Route path="/scanner" element={<InvoiceScanner />} />
                  <Route path="/coach" element={<FinancialCoach />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/budget-calculator" element={<AIBudgetCalculator />} />
                  <Route path="/gst-filing" element={<GSTFiling />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/feedback" element={<Feedback />} />
                </Route>
              </Routes>
            </main>
          </div>
          <Toaster position="top-center" richColors />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
