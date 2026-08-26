function isSentryExpoPlugin(plugin) {
  if (plugin === '@sentry/react-native' || plugin === '@sentry/react-native/expo') {
    return true;
  }
  if (!Array.isArray(plugin)) {
    return false;
  }
  return plugin[0] === '@sentry/react-native' || plugin[0] === '@sentry/react-native/expo';
}

module.exports = ({ config }) => {
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();
  const hasAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN?.trim());
  const disableUpload = process.env.SENTRY_DISABLE_AUTO_UPLOAD === 'true';
  const plugins = (config.plugins ?? []).filter((plugin) => !isSentryExpoPlugin(plugin));
  const includeSentryPlugin = Boolean(org && project && (hasAuthToken || disableUpload));

  if (includeSentryPlugin) {
    plugins.push([
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        organization: org,
        project,
      },
    ]);
  }

  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      // Baked into the native manifest so standalone builds still have an API
      // origin if Metro did not inline process.env.EXPO_PUBLIC_API_URL.
      ...(apiUrl ? { apiUrl } : {}),
    },
  };
};
