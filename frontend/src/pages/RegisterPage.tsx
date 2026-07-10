import { RegisterUser } from "@app/shared";
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
import { notifications } from "@mantine/notifications";
import { IconLock, IconMail } from "@tabler/icons-react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { arkResolver } from "../lib/arkResolver";
import { useRegister } from "../queries/auth";

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();

  const form = useForm({
    mode: "controlled",
    initialValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    validate: (values) => {
      const errors = arkResolver(RegisterUser)({
        email: values.email,
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

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await register.mutateAsync({
        email: values.email,
        password: values.password,
      });
      notifications.show({
        color: "green",
        message: "Account created successfully. Please sign in.",
      });
      navigate("/login");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const message =
          err.response?.data?.error?.message || "Registration failed";
        notifications.show({ color: "red", message });
      }
    }
  });

  return (
    <AuthLayout>
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2} ta="center">
            Join us
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            Create your account
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
              placeholder="Create a password"
              required
              autoComplete="new-password"
              leftSection={<IconLock size={16} />}
              {...form.getInputProps("password")}
            />
            <PasswordInput
              label="Confirm Password"
              placeholder="Repeat your password"
              required
              autoComplete="new-password"
              leftSection={<IconLock size={16} />}
              {...form.getInputProps("confirmPassword")}
            />
            <Button type="submit" loading={register.isPending} fullWidth>
              Create account
            </Button>
          </Stack>
        </form>
        <Anchor component={Link} to="/login" size="sm" ta="center">
          Already have an account? Sign in
        </Anchor>
      </Stack>
    </AuthLayout>
  );
}
