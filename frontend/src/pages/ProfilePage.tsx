import { UpdateProfile } from "@app/shared";
import {
  Avatar,
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconPhoto } from "@tabler/icons-react";
import { useState } from "react";
import { arkResolver } from "../lib/arkResolver";
import { useSession, useUpdateProfile } from "../queries/auth";

export function ProfilePage() {
  const { data: user } = useSession();
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState(false);

  const form = useForm({
    initialValues: {
      avatar_url: user?.avatar_url ?? "",
    },
    validate: arkResolver(UpdateProfile),
  });

  if (!user) return null;

  const handleSubmit = form.onSubmit((values) => {
    updateProfile.mutate(
      {
        avatar_url: values.avatar_url || null,
      },
      {
        onSuccess: () => setEditing(false),
      },
    );
  });

  const handleCancel = () => {
    form.setValues({
      avatar_url: user.avatar_url ?? "",
    });
    setEditing(false);
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Profile</Title>
        <Text c="dimmed" size="sm">
          Manage your account settings
        </Text>
      </div>

      <Card maw={560} padding="xl" radius="md" shadow="sm">
        <Stack gap="xl">
          <Group gap="lg">
            <Avatar
              src={user.avatar_url}
              alt={user.email}
              size={64}
              radius={100}
            >
              {user.email.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Text fw={600} size="lg">
                {user.email}
              </Text>
              <Text c="dimmed" size="sm">
                {user.email}
              </Text>
            </Box>
          </Group>

          {editing ? (
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <TextInput
                  label="Avatar URL"
                  placeholder="https://example.com/avatar.jpg"
                  leftSection={<IconPhoto size={16} />}
                  {...form.getInputProps("avatar_url")}
                />
                <Group justify="flex-end" gap="sm">
                  <Button variant="default" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={updateProfile.isPending}>
                    Save Changes
                  </Button>
                </Group>
              </Stack>
            </form>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit Profile</Button>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
