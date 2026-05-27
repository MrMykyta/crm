const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./smoke",
  timeout: 45000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "smoke/report" }]],
  use: {
    baseURL: "http://localhost",
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
