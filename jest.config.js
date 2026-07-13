/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Pick up TypeScript test files anywhere under the project.
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  // Skill folders contain duplicate package.json files that trigger Haste
  // naming collisions; they are not part of the app and should be ignored.
  modulePathIgnorePatterns: ['<rootDir>/.agents/', '<rootDir>/.claude/'],
  // Expo/React Native ship untranspiled ESM in node_modules; allow the RN/Expo
  // toolchain packages through Babel so tests can import them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-css))',
  ],
};
