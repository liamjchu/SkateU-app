module.exports = ({ config }) => {
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();
  const plugins = (config.plugins ?? []).filter((plugin) => {
    if (plugin === '@sentry/react-native') {
      return false;
    }
    return !(Array.isArray(plugin) && plugin[0] === '@sentry/react-native');
  });

  if (org && project) {
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
