import type { BGMTrack, Voice } from "@app/shared";
import { Flex, Paper, Text } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { BgmTable } from "./studio/BgmTable";
import { SpeedControl } from "./studio/SpeedControl";
import { VoiceTable } from "./studio/VoiceTable";

type FormValues = { script: string; voice_id: string; bgm_track: string };

type Props = {
  form: UseFormReturnType<FormValues>;
  voices: Voice[];
  bgmTracks: BGMTrack[];
};

export function VoiceMusicStep({ form, voices, bgmTracks }: Props) {
  return (
    <Paper p="lg" withBorder>
      <SpeedControl />
      <Flex direction={{ base: "column", sm: "row" }} gap="lg">
        <VoiceTable
          voices={voices}
          selected={form.values.voice_id}
          onSelect={(id) => form.setFieldValue("voice_id", id)}
        />
        <BgmTable
          tracks={bgmTracks}
          selected={form.values.bgm_track}
          onSelect={(file) => form.setFieldValue("bgm_track", file)}
          onClear={() => form.setFieldValue("bgm_track", "")}
        />
      </Flex>
      {form.errors.voice_id && (
        <Text c="red" size="xs" mt="xs">
          {form.errors.voice_id}
        </Text>
      )}
    </Paper>
  );
}
