import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { HostNetworkService, type HostNetworkInfo } from './host-network.service';

describe('HostNetworkService', () => {
  async function currentInfo(service: HostNetworkService): Promise<HostNetworkInfo> {
    return firstValueFrom(service.info$.pipe(take(1)));
  }

  it('should use fallback when capacitor network plugin is unavailable', async () => {
    spyOn(Capacitor, 'isPluginAvailable').and.returnValue(false);

    const service = new HostNetworkService();
    await service.refresh();

    const info = await currentInfo(service);
    expect(info.source).toBe('fallback');
    expect(info.ipAddress).toBe('192.168.43.1');
    expect(info.fallbackReason).toContain('plugin unavailable');
  });

  it('should expose plugin ip when network plugin returns an address', async () => {
    spyOn(Capacitor, 'isPluginAvailable').and.returnValue(true);

    const service = new HostNetworkService();
    spyOn<any>(service, 'loadNetworkPlugin').and.resolveTo({
      Network: {
        getStatus: async () =>
          ({
            connected: true,
            connectionType: 'wifi',
            ipAddress: '10.0.0.42',
          }) as never,
      },
    });
    await service.refresh();

    const info = await currentInfo(service);
    expect(info.source).toBe('plugin');
    expect(info.ipAddress).toBe('10.0.0.42');
    expect(info.connectionType).toBe('wifi');
    expect(info.fallbackReason).toBeUndefined();
  });

  it('should fallback when plugin returns no ip address', async () => {
    spyOn(Capacitor, 'isPluginAvailable').and.returnValue(true);

    const service = new HostNetworkService();
    spyOn<any>(service, 'loadNetworkPlugin').and.resolveTo({
      Network: {
        getStatus: async () =>
          ({
            connected: true,
            connectionType: 'wifi',
          }) as never,
      },
    });
    await service.refresh();

    const info = await currentInfo(service);
    expect(info.source).toBe('fallback');
    expect(info.ipAddress).toBe('192.168.43.1');
    expect(info.fallbackReason).toContain('did not provide an IP address');
  });

  it('should fallback when plugin throws', async () => {
    spyOn(Capacitor, 'isPluginAvailable').and.returnValue(true);

    const service = new HostNetworkService();
    spyOn<any>(service, 'loadNetworkPlugin').and.rejectWith(new Error('plugin failed'));
    await service.refresh();

    const info = await currentInfo(service);
    expect(info.source).toBe('fallback');
    expect(info.ipAddress).toBe('192.168.43.1');
    expect(info.fallbackReason).toContain('Unable to read');
  });
});
