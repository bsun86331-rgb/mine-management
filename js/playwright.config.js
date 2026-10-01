const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "./tests",

    timeout: 60 * 1000,

    expect: {
        timeout: 10 * 1000
    },

    fullyParallel: false,

    workers: 1,

    retries: 0,

    reporter: [
        ["list"],
        [
            "html",
            {
                outputFolder: "playwright-report",
                open: "never"
            }
        ]
    ],

    use: {
        baseURL:
            "https://bsun86331-rgb.github.io/mine-management/",

        headless: true,

        viewport: {
            width: 390,
            height: 844
        },

        screenshot:
            "only-on-failure",

        trace:
            "retain-on-failure",

        video:
            "retain-on-failure"
    }
});
