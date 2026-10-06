export class CapabilityRouter {
  constructor(registry) {
    this.registry = registry;
  }

  resolve(requiredCapabilities, { preferredDeviceId = null } = {}) {
    const required = [...new Set((requiredCapabilities || []).map(String))];
    if (!required.length) return null;

    const candidates = this.registry.list().filter(device =>
      device.status === "online" &&
      required.every(capability => device.capabilities.includes(capability))
    );

    if (preferredDeviceId) {
      const preferred = candidates.find(device => device.deviceId === preferredDeviceId);
      if (preferred) return preferred;
    }

    candidates.sort((a, b) => {
      const aExtra = a.capabilities.length - required.length;
      const bExtra = b.capabilities.length - required.length;
      return aExtra - bExtra;
    });

    return candidates[0] || null;
  }
}
