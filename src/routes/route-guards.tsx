import { Navigate, Outlet } from "react-router";
import { useIdentity } from "../core/hooks/useIdentity";

export const ProtectedGuard = () => {
  const { data, isLoading } = useIdentity();

  if (isLoading) {
    return <></>;
  }
  return data ? <Outlet /> : <Navigate to="/identify" replace />;
};

export const PublicGuard = () => {
  const { data, isLoading } = useIdentity();

  if (isLoading) {
    return <></>;
  }

  return data ? <Navigate to="/" replace /> : <Outlet />;
};
