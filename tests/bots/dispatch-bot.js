"use strict";

const {
    assertTestId,
    assertSafeWrite
} = require(
    "../test-safety-guard"
);


/*
=========================================================
R0-1 DispatchBot
调度测试机器人

最高规则：
机器人只能操作 TEST- 数据。
发现非 TEST 数据立即终止。
=========================================================
*/

class DispatchBot {

    constructor(
        page
    ) {

        this.page =
            page;

        this.name =
            "DispatchBot";
    }


    async open() {

        await this.page.goto(
            "dispatch.html",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        await this.page.waitForTimeout(
            1000
        );


        return this;
    }


    async readLocalStorage(
        key
    ) {

        return await this.page.evaluate(
            storageKey => {

                const raw =
                    localStorage.getItem(
                        storageKey
                    );


                if (
                    raw === null
                ) {

                    return null;
                }


                try {

                    return JSON.parse(
                        raw
                    );

                } catch (
                    error
                ) {

                    return raw;
                }
            },
            key
        );
    }


    async getTemporaryUnloadRequests() {

        const rows =
            await this.readLocalStorage(
                "temporaryUnloadRequests"
            );


        return Array.isArray(
            rows
        )
            ? rows
            : [];
    }


    async getPendingTemporaryUnloadRequests() {

        const rows =
            await this.getTemporaryUnloadRequests();


        return rows.filter(
            item =>
                item &&
                String(
                    item.status ||
                    ""
                ) ===
                    "pending_dispatch"
        );
    }


    async getTemporaryUnloadTodoCount() {

        const value =
            await this.page
                .locator(
                    "#temporaryUnloadTodoCount"
                )
                .textContent();


        return Number(
            String(
                value ||
                "0"
            )
            .replace(
                /[^\d.-]/g,
                ""
            )
        ) || 0;
    }


    async openTemporaryUnloadReview() {

        const button =
            this.page.locator(
                "#openTemporaryUnloadReviewButton"
            );


        await button.waitFor({
            state:
                "visible"
        });


        await button.click();


        await this.page
            .locator(
                "#temporaryUnloadReviewModal"
            )
            .waitFor({
                state:
                    "visible"
            });


        return true;
    }


    async assertTestRequest(
        request
    ) {

        if (
            !request
        ) {

            throw new Error(
                "DispatchBot：临时卸料申请不存在"
            );
        }


        const requestId =
            request.requestId ||
            "";


        const taskId =
            request.taskId ||
            request.dispatchTaskId ||
            "";


        const driverId =
            request.driverId ||
            request.personId ||
            "";


        const vehicleId =
            request.vehicleNumber ||
            request.vehicleId ||
            "";


        assertTestId(
            requestId,
            "临时卸料申请"
        );


        assertTestId(
            taskId,
            "生产任务"
        );


        assertTestId(
            driverId,
            "司机"
        );


        assertTestId(
            vehicleId,
            "汽车"
        );


        if (
            request.excavatorNumber ||
            request.excavatorId
        ) {

            assertTestId(
                request.excavatorNumber ||
                request.excavatorId,
                "挖机"
            );
        }


        return request;
    }


    async findPendingTemporaryUnload(
        requestId
    ) {

        assertTestId(
            requestId,
            "临时卸料申请"
        );


        const rows =
            await this.getPendingTemporaryUnloadRequests();


        const request =
            rows.find(
                item =>
                    String(
                        item.requestId ||
                        ""
                    ) ===
                        String(
                            requestId
                        )
            );


        if (
            !request
        ) {

            throw new Error(
                "DispatchBot：没有找到待审核临时卸料申请：" +
                requestId
            );
        }


        await this.assertTestRequest(
            request
        );


        return request;
    }


    async approveTemporaryUnload(
        requestId
    ) {

        const request =
            await this.findPendingTemporaryUnload(
                requestId
            );


        assertSafeWrite(
            "approve",
            requestId
        );


        await this.openTemporaryUnloadReview();


        const card =
            this.page.locator(
                ".temp-unload-review-card"
            )
            .filter({
                hasText:
                    requestId
            });


        await card.waitFor({
            state:
                "visible"
        });


        const approveButton =
            card.locator(
                ".temp-unload-approve"
            );


        await approveButton.click();


        this.page.once(
            "dialog",
            async dialog => {

                await dialog.accept();
            }
        );


        await this.page.waitForTimeout(
            500
        );


        return request;
    }


    async rejectTemporaryUnload(
        requestId
    ) {

        const request =
            await this.findPendingTemporaryUnload(
                requestId
            );


        assertSafeWrite(
            "reject",
            requestId
        );


        await this.openTemporaryUnloadReview();


        const card =
            this.page.locator(
                ".temp-unload-review-card"
            )
            .filter({
                hasText:
                    requestId
            });


        await card.waitFor({
            state:
                "visible"
        );


        const rejectButton =
            card.locator(
                ".temp-unload-reject"
            );


        await rejectButton.click();


        this.page.once(
            "dialog",
            async dialog => {

                await dialog.accept();
            }
        );


        await this.page.waitForTimeout(
            500
        );


        return request;
    }


    async readTripRecords() {

        const rows =
            await this.readLocalStorage(
                "tripRecords"
            );


        return Array.isArray(
            rows
        )
            ? rows
            : [];
    }


    async findOfficialTripByRequestId(
        requestId
    ) {

        assertTestId(
            requestId,
            "临时卸料申请"
        );


        const rows =
            await this.readTripRecords();


        return (
            rows.find(
                item =>
                    String(
                        item.temporaryUnloadRequestId ||
                        ""
                    ) ===
                        String(
                            requestId
                        )
            )
            ||
            null
        );
    }


    async getTodayStats() {

        const readNumber =
            async selector => {

                const value =
                    await this.page
                        .locator(
                            selector
                        )
                        .textContent();


                return Number(
                    String(
                        value ||
                        "0"
                    )
                    .replace(
                        /[^\d.-]/g,
                        ""
                    )
                ) || 0;
            };


        return {
            total:
                await readNumber(
                    "#dispatchTodayTotalTrips"
                ),

            coal:
                await readNumber(
                    "#dispatchTodayCoalTrips"
                ),

            waste:
                await readNumber(
                    "#dispatchTodayWasteTrips"
                )
        };
    }


    async snapshot(
        filename
    ) {

        await this.page.screenshot({
            path:
                filename,

            fullPage:
                true
        });
    }
}


module.exports = {
    DispatchBot
};
