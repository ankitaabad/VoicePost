import { Button, Group, Modal, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";

type NewProjectModalProps = {
  opened: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  isLoading: boolean;
};

export function NewProjectModal({
  opened,
  onClose,
  onSubmit,
  isLoading,
}: NewProjectModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!opened) setName("");
  }, [opened]);

  const handleClose = () => {
    setName("");
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="New Project" centered>
      <TextInput
        label="Project name"
        placeholder="e.g. Summer Sale Ad"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onSubmit(name.trim());
        }}
        autoFocus
        data-autofocus
      />
      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (name.trim()) onSubmit(name.trim());
          }}
          loading={isLoading}
        >
          Create
        </Button>
      </Group>
    </Modal>
  );
}
