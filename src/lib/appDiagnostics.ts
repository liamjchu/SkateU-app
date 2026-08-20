import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { METADATA_VALUE_MAX } from './userFeedback';
import type { ClientDiagnostics } from '../types/userFeedback';

function clip(value: string): string {
  return value.trim().slice(0, METADATA_VALUE_MAX);
}

function platformVersion(): string {
  if (typeof Platform.Version === 'string') {
    return Platform.Version;
  }
  if (typeof Platform.Version === 'number' && Number.isFinite(Platform.Version)) {
    return String(Platform.Version);
  }
  return '';
}

export function collectClientDiagnostics(
  route?: string | null
): ClientDiagnostics {
  return {
    appVersion: clip(
      Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? ''
    ),
    buildNumber: clip(Constants.nativeBuildVersion ?? ''),
    platform: clip(Platform.OS),
    osVersion: clip(Device.osVersion ?? platformVersion()),
    deviceModel: clip(Device.modelName ?? ''),
    route: clip(route ?? ''),
  };
}
