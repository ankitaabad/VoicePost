import type { UserResponse } from "@app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "./axios";

type ApiResponse<T> = {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
};

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } =
        await axiosInstance.get<ApiResponse<UserResponse>>("/auth/me");
      return data.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const { data } = await axiosInstance.post<ApiResponse<UserResponse>>(
        "/auth/login",
        input,
      );
      return data.data;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["session"], user);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const { data } = await axiosInstance.post("/auth/register", input);
      return data;
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await axiosInstance.post("/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["session"], null);
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (input: { email: string }) => {
      const { data } = await axiosInstance.post("/auth/forgot-password", input);
      return data;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: { token: string; password: string }) => {
      const { data } = await axiosInstance.post("/auth/reset-password", input);
      return data;
    },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: async (input: { token: string }) => {
      const { data } = await axiosInstance.post("/auth/verify-email", input);
      return data;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { avatar_url: string | null }) => {
      const { data } = await axiosInstance.put<ApiResponse<UserResponse>>(
        "/profile",
        input,
      );
      return data.data;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["session"], user);
    },
  });
}
