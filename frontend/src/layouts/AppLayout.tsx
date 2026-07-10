import { ActionIcon, Box, Container } from "@mantine/core";
import { IconHome, IconLogout, IconMenu2, IconUser } from "@tabler/icons-react";
import { useState } from "react";
import { Menu, MenuItem, Sidebar } from "react-pro-sidebar";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppLogo } from "../components/AppLogo";
import { useLogout } from "../queries/auth";
import { useStore } from "../store";

const menuItemStyles = {
  root: ({ active }: { active: boolean }) => ({
    backgroundColor: active ? "var(--mantine-color-brand-0)" : undefined,
    borderLeft: active ? "3px solid var(--mantine-color-brand-6)" : undefined,
  }),
  button: ({ active }: { active: boolean }) => ({
    fontWeight: active ? 600 : undefined,
  }),
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useLogout();
  const sidebarOpened = useStore((s) => s.sidebarOpened);
  const setSidebarOpened = useStore((s) => s.setSidebarOpened);
  const [isBroken, setIsBroken] = useState(false);

  const handleLogout = () => {
    logout.mutate(undefined);
  };

  return (
    <Box style={{ display: "flex", height: "100dvh" }}>
      <Sidebar
        transitionDuration={300}
        breakPoint="md"
        toggled={sidebarOpened}
        onBackdropClick={() => setSidebarOpened(false)}
        onBreakPoint={setIsBroken}
      >
        <Box
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <Box>
            <Box px="lg" py="lg">
              <AppLogo />
            </Box>
            <Menu menuItemStyles={menuItemStyles}>
              <MenuItem
                icon={<IconHome size={18} />}
                active={location.pathname === "/"}
                onClick={() => navigate("/")}
              >
                Home
              </MenuItem>
            </Menu>
          </Box>

          <Box style={{ marginTop: "auto" }} mb="xl">
            <Menu menuItemStyles={menuItemStyles}>
              <MenuItem
                icon={<IconUser size={18} />}
                active={location.pathname === "/profile"}
                onClick={() => navigate("/profile")}
              >
                Profile
              </MenuItem>
              <MenuItem icon={<IconLogout size={18} />} onClick={handleLogout}>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Box>
      </Sidebar>

      <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Box style={{ flex: 1, overflow: "auto" }}>
          <Container size="xl" py="lg">
            <Outlet />
          </Container>
        </Box>
      </Box>

      {isBroken && !sidebarOpened && (
        <ActionIcon
          variant="filled"
          color="brand"
          size={48}
          radius="xl"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            boxShadow: "var(--mantine-shadow-lg)",
          }}
          onClick={() => setSidebarOpened(true)}
        >
          <IconMenu2 size={24} />
        </ActionIcon>
      )}
    </Box>
  );
}
