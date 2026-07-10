import { ResetPassword } from "@app/shared";
import { Button, PasswordInput, Stack, Text, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconLock } from "@tabler/icons-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { arkResolver } from "../lib/arkResolver";
import { useResetPassword } from "../queries/auth";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const resetPassword = useResetPassword();

  const form = useForm({
    mode: "controlled",
    initialValues: { password: "", confirmPassword: "" },
    validate: (values) => {
      const errors = arkResolver(ResetPassword)({
        token,
        password: values.password,
      });
      if (
        values.password &&
        values.confirmPassword &&
        values.password !== values.confirmPassword
      ) {
        errors.confirmPassword = "Passwords do not match";
      }
      return errors;
    },
  });

  if (!token) {
    return (
      <AuthLayout>
        <Stack gap="lg">
          <Title order={2} ta="center">
            Link expired
          </Title>
          <Stack gap="md">
            <Text ta="center">This reset link is no longer valid.</Text>
            <Button
              variant="outline"
              onClick={() => navigate("/forgot-password")}
              fullWidth
            >
              Request a new link
            </Button>
          </Stack>
        </Stack>
      </AuthLayout>
    );
  }

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await resetPassword.mutateAsync({
        token,
        password: values.password,
      });
      notifications.show({
        color: "green",
        message: "Password reset successfully. Please sign in.",
      });
      navigate("/login");
    } catch {
      notifications.show({
        color: "red",
        message: "Invalid or expired reset token.",
      });
    }
  });

  return (
    <AuthLayout>
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2} ta="center">
            Choose a new password
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            Must be at least 8 characters
          </Text>
        </Stack>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <PasswordInput
              label="New Password"
              placeholder="Enter new password"
              required
              leftSection={<IconLock size={16} />}
              {...form.getInputProps("password")}
            />
            <PasswordInput
              label="Confirm Password"
              placeholder="Repeat new password"
              required
              leftSection={<IconLock size={16} />}
              {...form.getInputProps("confirmPassword")}
            />
            <Button type="submit" loading={resetPassword.isPending} fullWidth>
              Reset password
            </Button>
          </Stack>
        </form>
      </Stack>
    </AuthLayout>
  );
}
