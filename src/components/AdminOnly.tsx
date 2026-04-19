import { type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuthContext } from '../lib/auth-context';

type Props = {
  children: ReactNode;
  fallback?: ReactNode | 'redirect-to-login';
};

export function AdminOnly({ children, fallback = null }: Props) {
  const { isAdmin, loading } = useAuthContext();
  if (loading) return null;
  if (isAdmin) return <>{children}</>;
  if (fallback === 'redirect-to-login') {
    return <Navigate to="/en/login" replace />;
  }
  return <>{fallback}</>;
}
