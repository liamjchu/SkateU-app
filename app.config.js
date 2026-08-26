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

  // #region agent log
  const sentryGatePayload = {
    sessionId: '01a573',
    runId: process.env.SENTRY_DEBUG_RUN_ID || 'post-fix',
    hypothesisId: 'A',
    location: 'app.config.js:sentry-gate',
    message: 'Sentry Expo plugin inclusion',
    data: {
      hasOrg: Boolean(org),
      hasProject: Boolean(project),
      hasAuthToken,
      disableUpload,
      includeSentryPlugin,
      remainingSentryPlugins: 0,
    },
    timestamp: Date.now(),
  };

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

  sentryGatePayload.data.remainingSentryPlugins = plugins.filter(isSentryExpoPlugin).length;
  fetch('http://127.0.0.1:7351/ingest/84fce2ac-fe06-4f93-b099-74e58132bea2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '01a573' },
    body: JSON.stringify(sentryGatePayload),
  }).catch(() => {});
  try {
    require('fs').appendFileSync(
      '/Users/liamchu/SkateU-app/.cursor/debug-01a573.log',
      `${JSON.stringify(sentryGatePayload)}\n`,
    );
  } catch {
    // EAS builders do not have this local debug path.
  }
  // #endregion

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
