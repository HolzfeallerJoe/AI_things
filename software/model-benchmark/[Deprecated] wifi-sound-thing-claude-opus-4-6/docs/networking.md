# Networking Notes

The UI now surfaces hotspot-friendly host discovery cues and the current broadcast IP address. These notes explain how the mock services behave and what you should keep in mind when swapping in real networking logic.

## Host Network Detection
- `HostNetworkService` (Angular service) attempts to read the device IP via the Capacitor `@capacitor/network` plugin.
- When the plugin succeeds, it publishes the detected IP, network type (Wi-Fi, cellular, etc.), and timestamp.
- If the plugin is unavailable (web build) or fails to provide an address, the service falls back to the common Android hotspot gateway `192.168.43.1` and records a reason string so the UI can explain the fallback.
- The host dashboard displays this information in the **Broadcast IP** card and logs changes to the event feed (`Host network address detected ...`). This keeps the host device and any observers aligned on which address to share with listeners.

## Client Discovery Behaviour
- `HostDiscoveryService` still emits simulated hosts, but the list now includes a `hotspot-hub` entry at `192.168.43.1` to mirror the fallback IP the host shows.
- When auto discovery is active, the UI automatically selects the first discovered host and disables the connect button until at least one host is available. Manual IP entry fields have been removed.
- If the selected host disappears from the discovery stream, the UI clears the selection and posts a warning in the event log so the user knows to wait or refresh.

## Integration Checklist
When implementing real transport logic, plan for:
1. **Multiple IP addresses:** mobile devices can expose IPv6, tethering, and local-only addresses. Extend `HostNetworkService` to prioritise the reachable address for clients.
2. **Error handling:** surface network permission issues, background restrictions, and hotspot state changes through the service so the host sees actionable messages.
3. **Discovery sources:** replace the simulator with mDNS/SSDP or a custom UDP beacon. Keep the selection logic intact so the UI continues to auto-pick the best candidate.
4. **Security:** if you introduce authentication or encryption, display the relevant status alongside the broadcast IP so clients know whether extra pairing steps are required.

Updating this document when the networking layer evolves will help future contributors understand the assumptions baked into the UI.*** End Patch*** End Patch акс
