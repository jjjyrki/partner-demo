export function shouldSkipPartnerApiCall() {
  const missingConfig =
    !process.env.U54_BASE_API_URL || !process.env.U54_API_KEY;

  const usesPlaceholderConfig = process.env.U54_API_KEY === "your-u54-api-key";

  return (
    process.env.NODE_ENV === "test" || missingConfig || usesPlaceholderConfig
  );
}
