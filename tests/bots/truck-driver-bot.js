"use strict";

const {
    assertTestId,
    assertSafeWrite
} = require(
    "../test-safety-guard"
);


/*
=========================================================
R0-1 TruckDriverBot
汽车司机测试机器人

最高规则：
机器人只能操作 TEST- 数据。
发现非 TEST 数据立即终止。
=========================================================
*/

class TruckDriverBot {

    constructor(
        page
    ) {

        this.page =
            page;

        this.name =
            "TruckDriverBot";
    }


    async open() {

        await this.page.goto(
            "driver-work.html",
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


    async getProfile() {

        return await this.readLocalStorage(
            "driverProfile"
        );
    }


    async getCurrentTask() {

        return await this.readLocalStorage(
            "driverCurrentTask"
        );
    }


    async getTransportCycle() {

        return await this.readLocalStorage(
            "driverTransportCycleState"
        );
    }


    async assertTestIdentity() {

        const profile =
            await this.getProfile();


        if (
            !profile
        ) {

            throw new Error(
                "TruckDriverBot：没有找到 driverProfile"
            );
        }


        const driverId =
            profile.driverId ||
            profile.personId ||
            profile.employeeId ||
            profile.id ||
            "";


        assertTestId(
            driverId,
            "司机"
        );


        return profile;
    }


    async assertTestTask() {

        const task =
            await this.getCurrentTask();


        if (
            !task
        ) {

            throw new Error(
                "TruckDriverBot：当前没有生产任务"
            );
        }


        const taskId =
            task.taskId ||
            task.dispatchTaskId ||
            task.id ||
            "";


        const vehicleId =
            task.vehicleNumber ||
            task.vehicleId ||
            task.truckNumber ||
            task.truckId ||
            "";


        assertTestId(
            taskId,
            "生产任务"
        );


        assertTestId(
            vehicleId,
            "汽车"
        );


        if (
            task.excavatorNumber ||
            task.excavatorId
        ) {

            assertTestId(
                task.excavatorNumber ||
                task.excavatorId,
                "挖机"
            );
        }


        return task;
    }


    async assertSafeContext() {

        const profile =
            await this.assertTestIdentity();


        const task =
            await this.assertTestTask();


        return {
            profile,
            task
        };
    }


    async getTemporaryUnloadButtonState() {

        const button =
            this.page.locator(
                "#temporaryUnloadButton"
            );


        await button.waitFor({
            state:
                "attached"
        });


        return {
            visible:
                await button.isVisible(),

            enabled:
                await button.isEnabled(),

            text:
                (
                    await button.textContent()
                )?.trim() ||
                ""
        };
    }


    async assertTemporaryUnloadReady() {

        await this.assertSafeContext();


        const cycle =
            await this.getTransportCycle();


        if (
            !cycle
        ) {

            throw new Error(
                "TruckDriverBot：没有找到运输闭环状态"
            );
        }


        if (
            cycle.taskId
        ) {

            assertTestId(
                cycle.taskId,
                "运输闭环任务"
            );
        }


        if (
            cycle.vehicleNumber
        ) {

            assertTestId(
                cycle.vehicleNumber,
                "运输闭环车辆"
            );
        }


        if (
            cycle.phase !==
                "enroute_unload"
        ) {

            throw new Error(
                "TruckDriverBot：当前不是前往卸载区状态，phase = " +
                String(
                    cycle.phase ||
                    "-"
                )
            );
        }


        if (
            !cycle.loadedAt ||
            !cycle.departedLoadingAt
        ) {

            throw new Error(
                "TruckDriverBot：运输闭环缺少装车或驶离装载区记录"
            );
        }


        const state =
            await this.getTemporaryUnloadButtonState();


        if (
            !state.visible
        ) {

            throw new Error(
                "TruckDriverBot：临时卸料按钮不可见"
            );
        }


        if (
            !state.enabled
        ) {

            throw new Error(
                "TruckDriverBot：临时卸料按钮未启用：" +
                state.text
            );
        }


        return {
            cycle,
            button:
                state
        };
    }


    async openTemporaryUnloadModal() {

        await this.assertTemporaryUnloadReady();


        assertSafeWrite(
            "create",
            (
                await this.getCurrentTask()
            ).taskId
        );


        await this.page
            .locator(
                "#temporaryUnloadButton"
            )
            .click();


        await this.page
            .locator(
                "#temporaryUnloadModal"
            )
            .waitFor({
                state:
                    "visible"
            });


        return true;
    }


    async selectTemporaryUnloadOptions({
        material =
            "渣",

        reason =
            "修路垫料",

        remark =
            "TEST-机器人临时卸料测试"
    } = {}) {

        await this.assertSafeContext();


        await this.page
            .locator(
                "#temporaryUnloadMaterial"
            )
            .selectOption(
                material
            );


        await this.page
            .locator(
                "#temporaryUnloadReason"
            )
            .selectOption(
                reason
            );


        await this.page
            .locator(
                "#temporaryUnloadRemark"
            )
            .fill(
                remark
            );


        return {
            material,
            reason,
            remark
        };
    }


    async readCurrentTripCount() {

        const value =
            await this.page
                .locator(
                    "#todayTripCount"
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
    TruckDriverBot
};
