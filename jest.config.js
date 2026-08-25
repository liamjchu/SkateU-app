/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Pick up TypeScript test files anywhere under the project.
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  // Skill folders contain duplicate package.json files that trigger Haste
  // naming collisions; they are not part of the app and should be ignored.
  modulePathIgnorePatterns: [
    '<rootDir>/.agents/',
    '<rootDir>/.claude/',
    '<rootDir>/apps/',
  ],
  // Deno Edge Functions are typechecked and tested with Deno, not jest-expo.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/supabase/functions/',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/store/**/*.ts',
    'src/app/api/**/*.ts',
    'src/constants/**/*.ts',
    'src/content/**/*.ts',
    'src/types/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
    '!src/lib/supabase.ts',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/apps/',
    '<rootDir>/supabase/functions/',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
  // Expo/React Native ship untranspiled ESM in node_modules; allow the RN/Expo
  // toolchain packages through Babel so tests can import them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|posthog-react-native|native-base|react-native-svg|nativewind|react-native-css))',
  ],
};
