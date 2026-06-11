import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import TaskPage from './pages/TaskPage';
import TasksPage from './pages/TasksPage';
import ProgressPage from './pages/ProgressPage';
import ProfilePage from './pages/ProfilePage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminCoursesPage from './pages/AdminCoursesPage';
import AdminCourseEditorPage from './pages/AdminCourseEditorPage';
import AdminTasksPage from './pages/AdminTasksPage';
import AdminTaskEditPage from './pages/AdminTaskEditPage';
import AdminLinksPage from './pages/AdminLinksPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PersonalTaskPage from './pages/PersonalTaskPage';
import CourseLearnPage from './pages/CourseLearnPage';
import CoursesPage from './pages/CoursesPage';
import SubmissionDetailPage from './pages/SubmissionDetailPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/shared/:token" element={<PersonalTaskPage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<ProgressPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="task/:taskId" element={<TaskPage />} />
        <Route path="course/:courseId" element={<CourseLearnPage />} />
        <Route path="submissions/:submissionId" element={<SubmissionDetailPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="profile/:userId" element={<ProfilePage />} />
        <Route path="admin/users" element={<ProtectedRoute requireAdmin><AdminUsersPage /></ProtectedRoute>} />
        <Route path="admin/courses" element={<ProtectedRoute requireAdmin><AdminCoursesPage /></ProtectedRoute>} />
        <Route path="admin/courses/:courseId" element={<ProtectedRoute requireAdmin><AdminCourseEditorPage /></ProtectedRoute>} />
        <Route path="admin/tasks" element={<ProtectedRoute requireAdmin><AdminTasksPage /></ProtectedRoute>} />
        <Route path="admin/tasks/:taskId" element={<ProtectedRoute requireAdmin><AdminTaskEditPage /></ProtectedRoute>} />
        <Route path="admin/links" element={<ProtectedRoute requireAdmin><AdminLinksPage /></ProtectedRoute>} />
        <Route path="admin/settings" element={<ProtectedRoute requireAdmin><AdminSettingsPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}
