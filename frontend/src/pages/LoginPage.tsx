import { LoginUser } from "@app/shared";
import {
  Anchor,
  Button,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconLock, IconMail } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { arkResolver } from "../lib/arkResolver";
import { useLogin } from "../queries/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();

  const form = useForm({
    mode: "controlled",
    initialValues: { email: "", password: "" },
    validate: arkResolver(LoginUser),
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      navigate("/");
    } catch {
      form.setFieldError("email", "Invalid email or password");
    }
  });

  return (
    <AuthLayout>
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2} ta="center">
            Welcome back!
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            Sign in to your account
          </Text>
        </Stack>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Email"
              placeholder="your@email.com"
              required
              autoComplete="username"
              leftSection={<IconMail size={16} />}
              {...form.getInputProps("email")}
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              required
              autoComplete="current-password"
              leftSection={<IconLock size={16} />}
              {...form.getInputProps("password")}
            />
            <Button type="submit" loading={login.isPending} fullWidth>
              Sign in
            </Button>
          </Stack>
        </form>
        <Stack gap="xs" ta="center">
          <Anchor component={Link} to="/register" size="sm">
            Don't have an account? Register
          </Anchor>
          <Anchor component={Link} to="/forgot-password" size="sm">
            Forgot password?
          </Anchor>
        </Stack>
      </Stack>
    </AuthLayout>
  );
}
