import { ForgotPassword } from "@app/shared";
import { Anchor, Button, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconMail } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { arkResolver } from "../lib/arkResolver";
import { useForgotPassword } from "../queries/auth";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const forgotPassword = useForgotPassword();
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const form = useForm({
    mode: "controlled",
    initialValues: { email: "" },
    validate: arkResolver(ForgotPassword),
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      const res = await forgotPassword.mutateAsync(values);
      setSent(true);
      setResetToken(res?.meta?.token ?? null);
    } catch {
      notifications.show({
        color: "red",
        message: "Something went wrong. Please try again.",
      });
    }
  });

  if (sent) {
    return (
      <AuthLayout>
        <Stack gap="lg">
          <Title order={2} ta="center">
            Check your inbox
          </Title>
          <Stack gap="md">
            <Text ta="center">
              If an account exists, you'll receive a password reset link.
            </Text>
            {resetToken && (
              <Text size="sm" c="dimmed" ta="center">
                Dev token: {resetToken}
              </Text>
            )}
            <Button
              variant="outline"
              onClick={() => navigate("/login")}
              fullWidth
            >
              Back to Sign In
            </Button>
          </Stack>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2} ta="center">
            Forgot your password?
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            We'll send you a reset link
          </Text>
        </Stack>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Email"
              placeholder="your@email.com"
              required
              leftSection={<IconMail size={16} />}
              {...form.getInputProps("email")}
            />
            <Button type="submit" loading={forgotPassword.isPending} fullWidth>
              Send reset link
            </Button>
          </Stack>
        </form>
        <Anchor component={Link} to="/login" size="sm" ta="center">
          Back to Sign In
        </Anchor>
      </Stack>
    </AuthLayout>
  );
}
