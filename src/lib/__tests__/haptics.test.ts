import { Platform } from 'react-native';

const mockSelectionAsync = jest.fn(async () => undefined);
const mockImpactAsync = jest.fn(async (_style?: string) => undefined);
const mockNotificationAsync = jest.fn(async (_type?: string) => undefined);

jest.mock('expo-haptics', () => ({
  selectionAsync: () => mockSelectionAsync(),
  impactAsync: (style: string) => mockImpactAsync(style),
  notificationAsync: (type: string) => mockNotificationAsync(type),
  ImpactFeedbackStyle: { Light: 'Light' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning' },
}));

import { triggerHaptic } from '../haptics';

const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

afterEach(() => {
  mockSelectionAsync.mockClear();
  mockImpactAsync.mockClear();
  mockNotificationAsync.mockClear();
  if (platformDescriptor) {
    Object.defineProperty(Platform, 'OS', platformDescriptor);
  }
});

describe('triggerHaptic', () => {
  it('does nothing on web', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    triggerHaptic('success');
    expect(mockNotificationAsync).not.toHaveBeenCalled();
  });

  it('maps each feedback type on native', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    triggerHaptic('selection');
    triggerHaptic('light');
    triggerHaptic('success');
    triggerHaptic('warning');

    expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith('Light');
    expect(mockNotificationAsync).toHaveBeenCalledWith('Success');
    expect(mockNotificationAsync).toHaveBeenCalledWith('Warning');
  });

  it('swallows haptic failures', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockSelectionAsync.mockRejectedValueOnce(new Error('no vibrator'));
    expect(() => triggerHaptic('selection')).not.toThrow();
  });
});
