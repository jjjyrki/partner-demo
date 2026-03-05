import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import TaskListPage from './pages/TaskListPage';
import CreateTaskPage from './pages/CreateTaskPage';
import TaskDetailPage from './pages/TaskDetailPage';
import EditTaskPage from './pages/EditTaskPage';
import ProfilePage from './pages/ProfilePage';
import TransactionListPage from './pages/TransactionListPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<TaskListPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="create" element={<CreateTaskPage />} />
              <Route path="tasks/:id" element={<TaskDetailPage />} />
              <Route path="tasks/:id/edit" element={<EditTaskPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="transactions" element={<TransactionListPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
