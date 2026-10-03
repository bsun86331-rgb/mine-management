"use strict";

const {
    assertTestId
} = require(
    "../test-safety-guard"
);


/*
=========================================================
AuxiliaryWorkBot
辅助车辆多机器人业务测试

覆盖：
- 铲车 / 大巴 / 平路机 / 洒水车 / 推土机：auxiliary.html
- 加油车：fuel.html 专用加油流程

仅操作 TEST- 数据。
=========================================================
*/

class AuxiliaryWorkBot {

    constructor(
        page,
        identity,
        name =
            "AuxiliaryWorkBot"
    ) {

        this.page =
            page;

        this.identity =
            identity;

        this.name =
            name;
    }


    async installTestIdFactory() {

        await this.page.evaluate(
            () => {

                let sequence =
                    0;


                window.createId =
                    function (
                        prefix
                    ) {

                        sequence +=
                            1;


                        return (
                            "TEST-" +
                            String(
                                prefix ||
                                "ID"
                            )
                            .replace(
                                /[^A-Za-z0-9_-]/g,
                                "-"
                            ) +
                            "-" +
                            Date.now() +
                            "-" +
                            sequence
                        );
                    };
            }
        );
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


    async runAuxiliaryTask() {

        const {
            personId,
            position,
            vehicleId,
            taskId,
            work
        } =
            this.identity;


        assertTestId(
            personId,
            position
        );


        assertTestId(
            vehicleId,
            "辅助车辆"
        );


        assertTestId(
            taskId,
            "辅助车辆任务"
        );


        await this.page.goto(
            "auxiliary.html",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        await this.page.waitForTimeout(
            500
        );


        await this.installTestIdFactory();


        const actualPersonId =
            (
                await this.page
                    .locator(
                        "#personId"
                    )
                    .textContent()
            )?.trim() ||
            "";


        if (
            actualPersonId !==
                personId
        ) {

            throw new Error(
                this.name +
                "：personId不一致，预期=" +
                personId +
                "；实际=" +
                actualPersonId
            );
        }


        const vehicleNumber =
            await this.page
                .locator(
                    "#vehicleNumber"
                )
                .inputValue();


        if (
            vehicleNumber !==
                vehicleId
        ) {

            throw new Error(
                this.name +
                "：vehicleId不一致，预期=" +
                vehicleId +
                "；实际=" +
                vehicleNumber
            );
        }


        const taskText =
            (
                await this.page
                    .locator(
                        "#currentTaskArea"
                    )
                    .textContent()
            ) ||
            "";


        if (
            !taskText.includes(
                work
            )
        ) {

            throw new Error(
                this.name +
                "：没有读取到正确作业内容，预期=" +
                work
            );
        }


        const startButton =
            this.page
                .locator(
                    "#currentTaskArea button"
                )
                .filter({
                    hasText:
                        "开始作业"
                });


        await startButton.waitFor({
            state:
                "visible"
        });


        await startButton.click();


        await this.page.waitForTimeout(
            150
        );


        let records =
            await this.readLocalStorage(
                "auxiliaryWorkRecords"
            );


        let record =
            Array.isArray(
                records
            )
                ? records.find(
                    item =>
                        String(
                            item.personId ||
                            ""
                        ) ===
                            personId &&
                        String(
                            item.vehicleNumber ||
                            ""
                        ) ===
                            vehicleId &&
                        String(
                            item.taskId ||
                            ""
                        ) ===
                            taskId
                )
                : null;


        if (
            !record ||
            record.status !==
                "working"
        ) {

            throw new Error(
                this.name +
                "：开始作业后没有进入working状态"
            );
        }


        this.page.once(
            "dialog",
            async dialog => {

                await dialog.accept();
            }
        );


        const finishButton =
            this.page
                .locator(
                    "#currentTaskArea button"
                )
                .filter({
                    hasText:
                        "结束作业"
                });


        await finishButton.click();


        await this.page.waitForTimeout(
            200
        );


        records =
            await this.readLocalStorage(
                "auxiliaryWorkRecords"
            );


        record =
            Array.isArray(
                records
            )
                ? records.find(
                    item =>
                        String(
                            item.personId ||
                            ""
                        ) ===
                            personId &&
                        String(
                            item.vehicleNumber ||
                            ""
                        ) ===
                            vehicleId &&
                        String(
                            item.taskId ||
                            ""
                        ) ===
                            taskId
                )
                : null;


        if (
            !record ||
            record.status !==
                "completed"
        ) {

            throw new Error(
                this.name +
                "：结束作业后没有进入completed状态"
            );
        }


        assertTestId(
            record.workRecordId,
            "辅助车辆作业记录"
        );


        return {
            personId,
            position,
            vehicleId,
            taskId,
            work,

            status:
                record.status,

            workRecordId:
                record.workRecordId,

            completedAt:
                record.completedAt
        };
    }


    async runFuelTask() {

        const {
            personId,
            position,
            vehicleId,
            taskId
        } =
            this.identity;


        assertTestId(
            personId,
            position
        );


        assertTestId(
            vehicleId,
            "加油车辆"
        );


        assertTestId(
            taskId,
            "加油任务"
        );


        await this.page.goto(
            "fuel.html",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        await this.page.waitForTimeout(
            400
        );


        await this.installTestIdFactory();


        /*
         * fuel.html 默认停留在“今日库存”页，
         * 待加油按钮位于隐藏的 page-fueling。
         * 先切换到“加油任务”，再等待“开始加油”按钮可见。
         */
        await this.page
            .locator(
                'button[data-page="fueling"]'
            )
            .click();


        await this.page.waitForTimeout(
            120
        );


        const startButton =
            this.page
                .locator(
                    "#fuelQueueList button"
                )
                .filter({
                    hasText:
                        "开始加油"
                });


        await startButton.waitFor({
            state:
                "visible"
        });


        await startButton.click();


        await this.page.waitForTimeout(
            120
        );


        await this.page
            .locator(
                "#fuelCompleteAmount"
            )
            .fill(
                "120"
            );


        await this.page.evaluate(
            () => {

                pendingFuelAmount =
                    "120";

                pendingFuelPhotoData =
                    "data:image/jpeg;base64,VEVTVC1GVUVM";
            }
        );


        const submitButton =
            this.page
                .locator(
                    "#activeFuelArea button"
                )
                .filter({
                    hasText:
                        "提交加油完成"
                });


        this.page.once(
            "dialog",
            async dialog => {

                await dialog.accept();
            }
        );


        await submitButton.click();


        await this.page.waitForTimeout(
            200
        );


        const requests =
            await this.readLocalStorage(
                "fuelRequests"
            );


        const request =
            Array.isArray(
                requests
            )
                ? requests.find(
                    item =>
                        String(
                            item.requestId ||
                            ""
                        ) ===
                            taskId
                )
                : null;


        if (
            !request ||
            request.status !==
                "completed"
        ) {

            throw new Error(
                this.name +
                "：加油任务没有进入completed状态"
            );
        }


        const records =
            await this.readLocalStorage(
                "fuelRecords"
            );


        const record =
            Array.isArray(
                records
            )
                ? records.find(
                    item =>
                        String(
                            item.requestId ||
                            ""
                        ) ===
                            taskId
                )
                : null;


        if (
            !record
        ) {

            throw new Error(
                this.name +
                "：没有生成加油完成记录"
            );
        }


        assertTestId(
            record.fuelId,
            "加油完成记录"
        );


        return {
            personId,
            position,

            vehicleId:
                record.vehicleNumber,

            taskId,

            status:
                request.status,

            amount:
                record.amount,

            confirmationStatus:
                record.confirmationStatus,

            fuelId:
                record.fuelId
        };
    }


    async run() {

        if (
            this.identity.position ===
                "加油车司机"
        ) {

            return await this.runFuelTask();
        }


        return await this.runAuxiliaryTask();
    }
}


module.exports = {
    AuxiliaryWorkBot
};
