"use strict";

const fs =
    require(
        "fs"
    );

const path =
    require(
        "path"
    );


/*
=========================================================
R0-1 TestManager
机器人测试总控

职责：
1. 统一记录测试步骤
2. 统一判断 PASS / FAIL
3. 失败时保存截图
4. 输出测试报告
5. 不直接执行正式业务写操作
=========================================================
*/

class TestManager {

    constructor({
        testName,
        page
    }) {

        this.testName =
            testName ||
            "未命名测试";

        this.page =
            page;

        this.steps =
            [];

        this.startedAt =
            new Date();

        this.finishedAt =
            null;

        this.status =
            "RUNNING";

        this.error =
            null;
    }


    logStep(
        name,
        status,
        detail = ""
    ) {

        const row = {
            name,
            status,
            detail,
            time:
                new Date()
                    .toISOString()
        };


        this.steps.push(
            row
        );


        const icon =
            status === "PASS"
                ? "✅"
                : status === "FAIL"
                    ? "❌"
                    : "ℹ️";


        console.log(
            `${icon} ${name}` +
            (
                detail
                    ? `：${detail}`
                    : ""
            )
        );


        return row;
    }


    pass(
        name,
        detail = ""
    ) {

        return this.logStep(
            name,
            "PASS",
            detail
        );
    }


    info(
        name,
        detail = ""
    ) {

        return this.logStep(
            name,
            "INFO",
            detail
        );
    }


    fail(
        name,
        detail = ""
    ) {

        return this.logStep(
            name,
            "FAIL",
            detail
        );
    }


    async runStep(
        name,
        fn
    ) {

        try {

            const result =
                await fn();


            this.pass(
                name
            );


            return result;


        } catch (
            error
        ) {

            const message =
                error?.message ||
                String(
                    error
                );


            this.fail(
                name,
                message
            );


            throw error;
        }
    }


    async captureFailureScreenshot(
        prefix =
            "failure"
    ) {

        if (
            !this.page
        ) {

            return null;
        }


        const folder =
            path.join(
                process.cwd(),
                "test-results",
                "screenshots"
            );


        fs.mkdirSync(
            folder,
            {
                recursive:
                    true
            }
        );


        const safeName =
            this.testName
                .replace(
                    /[^a-zA-Z0-9-_]/g,
                    "-"
                )
                .replace(
                    /-+/g,
                    "-"
                );


        const filename =
            `${prefix}-${safeName}-${Date.now()}.png`;


        const fullPath =
            path.join(
                folder,
                filename
            );


        await this.page.screenshot({
            path:
                fullPath,

            fullPage:
                true
        });


        this.info(
            "失败截图",
            fullPath
        );


        return fullPath;
    }


    async completeSuccess() {

        this.finishedAt =
            new Date();

        this.status =
            "PASS";


        const report =
            this.buildReport();


        this.printSummary(
            report
        );


        return report;
    }


    async completeFailure(
        error
    ) {

        this.finishedAt =
            new Date();

        this.status =
            "FAIL";

        this.error =
            error?.message ||
            String(
                error
            );


        try {

            await this.captureFailureScreenshot(
                "FAIL"
            );

        } catch (
            screenshotError
        ) {

            this.info(
                "失败截图保存失败",
                screenshotError?.message ||
                String(
                    screenshotError
                )
            );
        }


        const report =
            this.buildReport();


        this.printSummary(
            report
        );


        return report;
    }


    buildReport() {

        const durationMs =
            (
                this.finishedAt ||
                new Date()
            )
            -
            this.startedAt;


        const passCount =
            this.steps.filter(
                item =>
                    item.status ===
                        "PASS"
            ).length;


        const failCount =
            this.steps.filter(
                item =>
                    item.status ===
                        "FAIL"
            ).length;


        const infoCount =
            this.steps.filter(
                item =>
                    item.status ===
                        "INFO"
            ).length;


        return {
            testName:
                this.testName,

            status:
                this.status,

            startedAt:
                this.startedAt
                    .toISOString(),

            finishedAt:
                (
                    this.finishedAt ||
                    new Date()
                )
                .toISOString(),

            durationMs,

            passCount,
            failCount,
            infoCount,

            error:
                this.error,

            steps:
                this.steps
        };
    }


    printSummary(
        report
    ) {

        console.log(
            "\n=================================================="
        );

        console.log(
            "🤖 机器人测试报告"
        );

        console.log(
            "测试：",
            report.testName
        );

        console.log(
            "结果：",
            report.status
        );

        console.log(
            "通过步骤：",
            report.passCount
        );

        console.log(
            "失败步骤：",
            report.failCount
        );

        console.log(
            "信息步骤：",
            report.infoCount
        );

        console.log(
            "耗时：",
            (
                report.durationMs /
                1000
            )
            .toFixed(
                2
            ),
            "秒"
        );


        if (
            report.error
        ) {

            console.log(
                "错误：",
                report.error
            );
        }


        console.log(
            "==================================================\n"
        );
    }
}


module.exports = {
    TestManager
};
