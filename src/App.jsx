import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from 'next-themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DailyTaskLog from './pages/DailyTaskLog';
import TaskManagement from './pages/TaskManagement';
import TimesheetManagement from './pages/TimesheetManagement';
import TimesheetReview from './pages/TimesheetReview';
import TeamManagement from './pages/TeamManagement';
import AuditTrail from './pages/AuditTrail';
import Profile from './pages/Profile';
import CalendarView from './pages/CalendarView';
import TagManagement from './pages/TagManagement';
import UserManagement from './pages/UserManagement';
import AdminReports from './pages/AdminReports';
import DeptHeadSummary from './pages/DeptHeadSummary';
import ProjectManagement from './pages/ProjectManagement';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ThemeToggleFAB from './components/ThemeToggleFAB';

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} suppressHydrationWarning>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/daily-log" element={<DailyTaskLog />} />
                  <Route path="/tasks" element={<TaskManagement />} />
                  <Route path="/timesheets" element={<TimesheetManagement />} />
                  <Route path="/timesheets/review" element={<TimesheetReview />} />
                  <Route path="/team" element={<TeamManagement />} />
                  <Route path="/audit-trail" element={<AuditTrail />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/calendar" element={<CalendarView />} />
                  <Route path="/tags" element={<TagManagement />} />
                  <Route path="/projects" element={<ProjectManagement />} />
                  <Route path="/users" element={<UserManagement />} />
                  <Route path="/admin-reports" element={<AdminReports />} />
        <Route path="/dept-summary" element={<DeptHeadSummary />} />
                </Route>
              </Route>
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Router>
          <Toaster />
          <ThemeToggleFAB />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;