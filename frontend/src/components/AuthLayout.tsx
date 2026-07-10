import { Box, Center, Paper } from "@mantine/core";
import type { ReactNode } from "react";
import { AppLogo } from "./AppLogo";

type Props = {
  children: ReactNode;
};

export function AuthLayout({ children }: Props) {
  return (
    <Box
      bg="gray.0"
      mih="100vh"
      display="flex"
      style={{ flexDirection: "column" }}
    >
      <Box p="lg">
        <AppLogo />
      </Box>
      <Box
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Center>
          <Paper
            w={{ base: "100%", sm: 420 }}
            mx={{ base: "xs", sm: 0 }}
            withBorder
            p="xl"
            shadow="md"
            radius="sm"
          >
            {children}
          </Paper>
        </Center>
      </Box>
    </Box>
  );
}
