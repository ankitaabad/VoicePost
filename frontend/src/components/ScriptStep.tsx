import {
  Button,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Text,
  Textarea,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconSparkles } from "@tabler/icons-react";
import { useState } from "react";
import { useGenerateScript } from "../queries/tts";

type FormValues = { script: string; voice_id: string; bgm_track: string };

type Props = {
  form: UseFormReturnType<FormValues>;
};

export function ScriptStep({ form }: Props) {
  const [scriptMode, setScriptMode] = useState<string>("write");
  const [roughIdea, setRoughIdea] = useState("");
  const generateScript = useGenerateScript();

  const handleGenerateScript = async () => {
    if (!roughIdea || roughIdea.length < 1) {
      notifications.show({
        title: "Error",
        message: "Please enter a rough idea for the script",
        color: "red",
      });
      return;
    }
    try {
      const result = await generateScript.mutateAsync({ script: roughIdea });
      form.setFieldValue("script", result.script);
      setScriptMode("write");
      notifications.show({
        title: "Script Ready",
        message:
          "Script has been generated. Review and edit below before proceeding.",
        color: "green",
      });
    } catch (err) {
      notifications.show({
        title: "Failed",
        message:
          err instanceof Error ? err.message : "Failed to generate script",
        color: "red",
      });
    }
  };

  return (
    <Paper p="lg" withBorder>
      <Group gap="xs" mb="md">
        <IconSparkles size={20} />
        <Text fw={600}>Script</Text>
      </Group>
      <SegmentedControl
        fullWidth
        mb="md"
        data={[
          { label: "Write Script", value: "write" },
          { label: "Generate with AI", value: "ai" },
        ]}
        value={scriptMode}
        onChange={setScriptMode}
      />
      {scriptMode === "ai" ? (
        <>
          <Textarea
            placeholder="Describe your ad idea — product, audience, tone, key message..."
            minRows={3}
            maxRows={8}
            autosize
            value={roughIdea}
            onChange={(e) => setRoughIdea(e.currentTarget.value)}
            mb="sm"
          />
          <Group>
            <Button
              variant="light"
              loading={generateScript.isPending}
              disabled={!roughIdea || roughIdea.length < 1}
              leftSection={
                generateScript.isPending ? (
                  <Loader size="sm" />
                ) : (
                  <IconSparkles size={16} />
                )
              }
              onClick={handleGenerateScript}
            >
              Generate Script
            </Button>
          </Group>
        </>
      ) : (
        <Textarea
          placeholder="Write your script here..."
          minRows={4}
          maxRows={12}
          autosize
          required
          {...form.getInputProps("script")}
        />
      )}
    </Paper>
  );
}
