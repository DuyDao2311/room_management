module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  testTimeout: 30000, // mongodb-memory-server lần đầu download binary mất 10-20s
  verbose: true,
};
