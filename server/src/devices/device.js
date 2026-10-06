export const DEVICE_STATUS = Object.freeze({ ONLINE: "online", OFFLINE: "offline", UNKNOWN: "unknown" });

export function createDevice(input) {
  if (!input?.deviceId || !input?.platform) throw new Error("deviceId and platform are required.");
  return {
    deviceId: String(input.deviceId),
    name: input.name ? String(input.name) : String(input.deviceId),
    platform: String(input.platform),
    version: input.version ? String(input.version) : null,
    status: DEVICE_STATUS.UNKNOWN,
    capabilities: Array.isArray(input.capabilities) ? [...new Set(input.capabilities.map(String))] : [],
    permissions: Array.isArray(input.permissions) ? [...new Set(input.permissions.map(String))] : [],
    lastSeen: null,
    metadata: input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {}
  };
}
