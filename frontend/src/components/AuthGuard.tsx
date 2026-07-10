import { Center, Loader } from "@mantine/core";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "../queries/auth";

type Props = {
  children: ReactNode;
};

export function AuthGuard({ children }: Props) {
  const { data: user, isLoading } = useSession();

  if (isLoading) {
    return (
      <Center h="100dvh">
        <Loader />
      </Center>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
