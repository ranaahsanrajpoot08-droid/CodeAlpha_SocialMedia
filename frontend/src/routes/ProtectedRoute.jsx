import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Loading from '../components/Loading.jsx';

// Wraps pages that need a logged-in user. Others are sent to /login.
const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <Loading text="Checking your session..." />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
