// src/components/CustomModal.tsx
import {
  ActionIcon,
  Box,
  Modal,
  Text,
  useMantineColorScheme,
  useMantineTheme,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";

interface CustomModalProps {
  opened: boolean;
  title: string;
  autoFocus?: boolean;
  onClose: () => void;
  children: ReactNode;
  padding?: string | number;
}

export function CustomModal({
  opened,
  title,
  autoFocus = true,
  onClose,
  children,
  padding = "md",
}: CustomModalProps) {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const primaryColor = theme.colors[theme.primaryColor][6];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      autoFocus={autoFocus}
      centered
      withCloseButton={false}
      padding={0}
    >
      <Box
        bg={primaryColor}
        px="md"
        py="sm"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${
            colorScheme === "dark" ? theme.colors.dark[7] : theme.colors.gray[3]
          }`,
        }}
      >
        <Text color="white" fw={600} fz="lg">
          {title}
        </Text>
        <ActionIcon color="white" variant="transparent" onClick={onClose}>
          <IconX size={20} />
        </ActionIcon>
      </Box>

      <Box p={padding}>{children}</Box>
    </Modal>
  );
}
