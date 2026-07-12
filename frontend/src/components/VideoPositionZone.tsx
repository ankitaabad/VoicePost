import { computeLayout } from "@app/shared";
import { Box, Text, Tooltip, useMantineTheme } from "@mantine/core";
import { useMove } from "@mantine/hooks";
import { useState } from "react";

type Props = {
  imageWidth: number;
  imageHeight: number;
  previewHeight: number;
  overlayY: number;
  onChange: (overlayY: number) => void;
};

export function VideoPositionZone({
  imageWidth,
  imageHeight,
  previewHeight,
  overlayY,
  onChange,
}: Props) {
  const theme = useMantineTheme();
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState(overlayY);

  const layout = computeLayout(imageWidth, imageHeight, overlayY);
  const { zoneHeight } = layout;

  const scale = previewHeight / imageHeight;
  const zoneHeightPct = (zoneHeight / imageHeight) * 100;

  const { ref: moveRef } = useMove(
    (pos) => {
      const clamped = Math.max(
        zoneHeightPct / 200,
        Math.min(1 - zoneHeightPct / 200, pos.y),
      );
      onChange(clamped);
      setDragY(clamped);
    },
    {
      onScrubStart: () => {
        setDragging(true);
        setDragY(overlayY);
      },
      onScrubEnd: () => setDragging(false),
    },
  );

  const displayY = dragging ? dragY : overlayY;
  const displayLayout = computeLayout(imageWidth, imageHeight, displayY);

  const waveformHPreview = displayLayout.waveformH * scale;
  const gapPreview =
    (displayLayout.textY - displayLayout.waveformY - displayLayout.waveformH) *
    scale;
  const fontSizePreview = Math.max(8, displayLayout.fontSize * scale);

  return (
    <Box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {/* Invisible drag surface covering the full image */}
      <Box
        ref={moveRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          cursor: "ns-resize",
          zIndex: 10,
        }}
      />

      {/* Visible zone overlay */}
      <Tooltip
        label={`Position: ${Math.round(displayY * imageHeight)}px from top (${Math.round(displayY * 100)}%)`}
        opened={dragging}
        position="left"
        withArrow
        color="dark"
      >
        <Box
          style={{
            position: "absolute",
            left: "5%",
            right: "5%",
            top: `${(displayLayout.zoneTop / imageHeight) * 100}%`,
            height: `${(displayLayout.zoneHeight / imageHeight) * 100}%`,
            border: `2px dashed ${theme.colors.gray[4]}`,
            borderRadius: theme.radius.sm,
            pointerEvents: "none",
            zIndex: 11,
            transition: dragging ? "none" : "top 0.15s ease-out",
          }}
        >
          {/* Waveform region */}
          <Box
            style={{
              height: `${waveformHPreview}px`,
              background: `${theme.colors.blue[6]}20`,
              borderBottom: `1px dashed ${theme.colors.gray[4]}`,
              borderRadius: `${theme.radius.sm}px ${theme.radius.sm}px 0 0`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              size="xs"
              c="dimmed"
              fw={500}
              style={{ userSelect: "none", letterSpacing: "0.05em" }}
            >
              WAVEFORM
            </Text>
          </Box>

          {/* Gap between waveform and captions */}
          <Box style={{ height: `${gapPreview}px` }} />

          {/* Caption region */}
          <Box
            style={{
              flex: 1,
              background: `${theme.colors.gray[6]}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: `0 0 ${theme.radius.sm}px ${theme.radius.sm}px`,
            }}
          >
            <Text
              size="xs"
              c="dimmed"
              fw={500}
              style={{
                userSelect: "none",
                letterSpacing: "0.15em",
                fontSize: `${fontSizePreview}px`,
              }}
            >
              CAPTIONS
            </Text>
          </Box>

          {/* Drag handle at bottom edge */}
          <Box
            style={{
              position: "absolute",
              bottom: -6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 36,
              height: 12,
              background: theme.colors.gray[4],
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <Box
              style={{
                width: 16,
                height: 2,
                background: theme.colors.gray[6],
                borderRadius: 1,
              }}
            />
          </Box>
        </Box>
      </Tooltip>
    </Box>
  );
}
