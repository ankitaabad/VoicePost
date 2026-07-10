import { Center, Stack, Text } from "@mantine/core";
import classes from "@src/css/loader.module.css";

type LoaderProps = {
  label?: string;
  fullPage?: boolean;
};

export function CustomLoader({ label, fullPage = false }: LoaderProps) {
  return (
    <Center
      style={{
        height: fullPage ? "100vh" : "100%",
        width: "100%",
      }}
    >
      <Stack align="center" gap="sm">
        <div className={classes.loader} />
        {label && (
          <Text size="sm" c="dimmed">
            {label}
          </Text>
        )}
      </Stack>
    </Center>
  );
}
