process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-test-access-secret!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-test-refresh-secret";
process.env.CORS_ORIGIN = "http://localhost:3000";
// Dummy key so the Paystack routes are "configured" — no real call is ever made,
// fetch is mocked in the tests that exercise them.
process.env.PAYSTACK_SECRET_KEY = "sk_test_dummy_key_for_tests";
