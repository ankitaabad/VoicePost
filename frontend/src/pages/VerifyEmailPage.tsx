import { Button, Loader, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { useVerifyEmail } from "../queries/auth";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const verifyEmail = useVerifyEmail();
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    verifyEmail.mutate(
      { token },
      {
        onSuccess: () => setStatus("success"),
        onError: () => setStatus("error"),
      },
    );
  }, [token, verifyEmail.mutate]);

  if (status === "verifying") {
    return (
      <AuthLayout>
        <Stack align="center" gap="md">
          <Loader />
          <Text>Verifying your email...</Text>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Stack gap="lg" align="center">
        <ThemeIcon
          size={64}
          radius={100}
          color={status === "success" ? "green" : "red"}
          variant="light"
        >
          {status === "success" ? (
            <IconCircleCheck size={32} />
          ) : (
            <IconCircleX size={32} />
          )}
        </ThemeIcon>
        <Title order={2} ta="center">
          {status === "success" ? "Email Verified" : "Verification Failed"}
        </Title>
        <Stack gap="md" ta="center">
          <Text>
            {status === "success"
              ? "Your email has been verified successfully."
              : !token
                ? "No verification token provided."
                : "This verification link is invalid or has expired."}
          </Text>
          <Button onClick={() => navigate("/login")} fullWidth>
            Go to sign in
          </Button>
        </Stack>
      </Stack>
    </AuthLayout>
  );
}
