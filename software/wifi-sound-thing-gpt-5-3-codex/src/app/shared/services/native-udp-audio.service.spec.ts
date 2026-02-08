import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';

import { NativeUdpAudioService } from './native-udp-audio.service';

describe('NativeUdpAudioService', () => {
  let service: NativeUdpAudioService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NativeUdpAudioService);
  });

  it('should report unavailable on non-android platforms', () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('web');
    expect(service.isAvailable()).toBeFalse();
  });

  it('should return safe default status on non-android platforms', async () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('web');
    const status = await service.getStatus();
    expect(status.hostRunning).toBeFalse();
    expect(status.clientRunning).toBeFalse();
    expect(status.hostMode).toBe('idle');
    expect(status.capturePermission).toBeFalse();
  });

  it('should no-op stop calls on non-android platforms', async () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('web');
    await expectAsync(service.stopHost()).toBeResolved();
    await expectAsync(service.stopClient()).toBeResolved();
  });

  it('should reject host and client start calls on non-android platforms', async () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('web');
    await expectAsync(
      service.startHost({
        peers: ['192.168.1.21'],
        port: 5052,
        sampleRate: 48_000,
        channels: 2,
        frameSize: 960,
        captureMode: 'auto',
      })
    ).toBeRejectedWithError(/only available on Android/i);

    await expectAsync(
      service.startClient({
        hostAddress: '192.168.1.20',
        port: 5052,
        jitterFrames: 3,
        sampleRate: 48_000,
        channels: 2,
        frameSize: 960,
      })
    ).toBeRejectedWithError(/only available on Android/i);
  });

  it('should return false for capture permission on non-android platforms', async () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('web');
    const granted = await service.requestCapturePermission();
    expect(granted).toBeFalse();
  });
});
