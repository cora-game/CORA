type RuntimeConfig = {
  allowDevRoomPreview: boolean;
};

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  if (process.env.NODE_ENV !== "production" && value) {
    console.warn(
      `[runtimeModes] Invalid boolean "${value}" detected. Falling back to "${String(fallback)}".`,
    );
  }
  return fallback;
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    allowDevRoomPreview: readBoolean(
      process.env.NEXT_PUBLIC_ALLOW_DEV_ROOM_PREVIEW,
      false,
    ),
  };
}
