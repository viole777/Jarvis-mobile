import { DEVICE_STATUS, createDevice } from "./device.js";

export class DeviceRegistry {
  #devices = new Map();
  #offlineAfterMs;

  constructor({ offlineAfterMs = 90_000 } = {}) {
    this.#offlineAfterMs = offlineAfterMs;
  }

  register(input) {
    const existing = this.#devices.get(input.deviceId);
    const device = createDevice({
      ...(existing || {}),
      ...input,
      capabilities: input.capabilities ?? existing?.capabilities ?? [],
      permissions: input.permissions ?? existing?.permissions ?? [],
      metadata: { ...(existing?.metadata || {}), ...(input.metadata || {}) }
    });
    device.status = DEVICE_STATUS.ONLINE;
    device.lastSeen = new Date().toISOString();
    this.#devices.set(device.deviceId, device);
    return this.get(device.deviceId);
  }

  heartbeat(deviceId) {
    const device = this.#devices.get(deviceId);
    if (!device) throw new Error("Unknown device.");
    device.status = DEVICE_STATUS.ONLINE;
    device.lastSeen = new Date().toISOString();
    return this.get(deviceId);
  }

  unregister(deviceId) {
    return this.#devices.delete(deviceId);
  }

  get(deviceId) {
    const device = this.#devices.get(deviceId);
    return device ? structuredClone(device) : null;
  }

  list() {
    this.#refreshStatuses();
    return [...this.#devices.values()].map(device => structuredClone(device));
  }

  findByCapability(capability, { onlineOnly = true } = {}) {
    this.#refreshStatuses();
    return this.list().filter(device =>
      (!onlineOnly || device.status === DEVICE_STATUS.ONLINE) &&
      device.capabilities.includes(capability)
    );
  }

  #refreshStatuses() {
    const cutoff = Date.now() - this.#offlineAfterMs;
    for (const device of this.#devices.values()) {
      if (!device.lastSeen || Date.parse(device.lastSeen) < cutoff) {
        device.status = DEVICE_STATUS.OFFLINE;
      }
    }
  }
}
