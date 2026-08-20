export const USER_FEEDBACK_TYPE_VALUES = [
  'contact',
  'bug',
  'feature',
  'spot_problem',
] as const;

export type UserFeedbackType = (typeof USER_FEEDBACK_TYPE_VALUES)[number];

export const CONTACT_CATEGORY_VALUES = [
  'general',
  'feedback',
  'partnership',
  'press',
  'business',
  'other',
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORY_VALUES)[number];

export type ContactCategoryOption = {
  value: ContactCategory;
  label: string;
};

export const SPOT_PROBLEM_CATEGORY_VALUES = [
  'incorrect_location',
  'incorrect_information',
  'incorrect_photo',
  'spot_changed',
  'other',
] as const;

export type SpotProblemCategory = (typeof SPOT_PROBLEM_CATEGORY_VALUES)[number];

export type SpotProblemCategoryOption = {
  value: SpotProblemCategory;
  label: string;
};

export const USER_FEEDBACK_STATUS_VALUES = [
  'new',
  'investigating',
  'fixed',
  'wont_fix',
] as const;

export type UserFeedbackStatus = (typeof USER_FEEDBACK_STATUS_VALUES)[number];

export type ClientDiagnostics = {
  appVersion: string;
  buildNumber: string;
  platform: string;
  osVersion: string;
  deviceModel: string;
  route: string;
};

export type UserFeedbackScreenshot = {
  uri: string;
  fileName?: string;
  mimeType?: string;
};

export type SubmitUserFeedbackInput = {
  type: UserFeedbackType;
  category?: string;
  message: string;
  spotId?: string;
  email?: string;
  metadata?: ClientDiagnostics;
  screenshot?: UserFeedbackScreenshot;
};
