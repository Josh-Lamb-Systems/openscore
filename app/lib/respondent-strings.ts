/**
 * Fixed respondent-facing UI strings. English only in v1; kept in one place so
 * translations can be added later (see docs/SPEC.md §13).
 */
export const respondentStrings = {
  next: "Next",
  back: "Back",
  start: "Start",
  submit: "See my results",
  complete: (percent: number) => `${percent}% Complete`,
  required: "This question is required.",
  selectUpTo: (n: number) => `Select up to ${n}`,
  selectAtLeast: (n: number) => `Select at least ${n}`,
  enterNumber: "Enter a number",
  typeAnswer: "Type your answer here",
  yourScore: "Your score",
  categoryBreakdown: "Your results by category",
  notAvailable: "This scorecard isn't available right now.",
  privacyPolicy: "Privacy policy",
  loading: "Calculating your results…",
  // Public flow (start screen, lead form, errors)
  fieldRequired: "This field is required.",
  fieldTooLong: "This is too long.",
  invalidEmail: "Enter a valid email address.",
  invalidPhone: "Enter a valid phone number.",
  invalidOption: "Choose one of the options.",
  consentRequired: "Please tick the box to continue.",
  selectPlaceholder: "Select…",
  leadAfterTitle: "Enter your details to see your results",
  somethingWentWrong: "Something went wrong. Please try again.",
  tryAgain: "Try again",
  previewBanner: "Draft preview — responses are saved as test data",
  backToBuilder: "Back to builder",
  testResult: "Test result from a draft preview",
  notAvailableHint: "Please check the link or try again later.",
};
