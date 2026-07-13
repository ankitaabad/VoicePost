import { Group, Slider, Text } from "@mantine/core";
import { IconGauge } from "@tabler/icons-react";
import { useStudioStore } from "../../stores/studioStore";

const MARKS = [
  { value: 0.8, label: "0.8" },
  { value: 0.9 },
  { value: 1.0 },
  { value: 1.1 },
  { value: 1.2 },
  { value: 1.3 },
  { value: 1.4 },
  { value: 1.5, label: "1.5" },
];

export function SpeedControl() {
  const speed = useStudioStore((s) => s.speed);
  const setSpeed = useStudioStore((s) => s.setSpeed);
  return (
    <Group gap="md" mb="lg">
      <Group gap={6}>
        <IconGauge size={16} />
        <Text size="sm" fw={500}>
          Speed
        </Text>
        <Text size="sm" c="brand" fw={600}>
          {speed.toFixed(1)}×
        </Text>
      </Group>
      <Slider
        w={200}
        min={0.8}
        max={1.5}
        step={0.1}
        marks={MARKS}
        value={speed}
        onChange={setSpeed}
        label={(v) => `${v}×`}
      />
    </Group>
  );
}
