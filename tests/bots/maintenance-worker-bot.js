"use strict";

const {
    assertTestId
} = require(
    "../test-safety-guard"
);


/*
=========================================================
R0-2 MaintenanceWorkerBot
维修员测试机器人

仅操作 TEST- 维修工单。
流程：
assigned
→ 接车 / 打开维修任务
→ 上传维修前 TEST 照片
→ 开始维修
→ working
=========================================================
*/

class MaintenanceWorkerBot {

    constructor(
        page
    ) {

        this.page =
            page;

        this.name =
            "MaintenanceWorkerBot";
    }


    async installTestWorker() {

        await this.page.addInitScript(
            () => {

                let personnel = [];


                try {

                    const raw =
                        localStorage.getItem(
                            "personnelRecords"
                        );


                    const parsed =
                        raw
                            ? JSON.parse(
                                raw
                            )
                            : [];


                    personnel =
                        Array.isArray(
                            parsed
                        )
                            ? parsed
                            : [];

                } catch (
                    error
                ) {

                    personnel =
                        [];
                }


                const workerId =
                    "TEST-MAINT-WORKER-01";


                const workerName =
                    "维修工01";


                if (
                    !personnel.some(
                        item =>
                            String(
                                item?.personId ||
                                item?.employeeId ||
                                ""
                            ) ===
                                workerId
                    )
                ) {

                    personnel.push({
                        personId:
                            workerId,

                        employeeId:
                            workerId,

                        name:
                            workerName,

                        position:
                            "维修员",

                        department:
                            "TEST-维修",

                        status:
                            "approved",

                        approvalStatus:
                            "approved",

                        personnelStatus:
                            "作业中",

                        testFixture:
                            true
                    });
                }


                localStorage.setItem(
                    "personnelRecords",
                    JSON.stringify(
                        personnel
                    )
                );


                localStorage.setItem(
                    "currentPersonId",
                    workerId
                );


                localStorage.setItem(
                    "selectedPosition",
                    "维修员"
                );
            }
        );
    }


    async open() {

        await this.installTestWorker();


        await this.page.goto(
            "maintenance-worker.html",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        await this.page.waitForTimeout(
            800
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
                    raw ===
                        null
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


    async findLatestAssignedTestOrder() {

        const rows =
            await this.readLocalStorage(
                "maintenanceWorkOrders"
            );


        const candidates =
            Array.isArray(
                rows
            )
                ? rows
                    .filter(
                        item =>
                            item &&
                            item.status ===
                                "assigned"
                            &&
                            String(
                                item.orderId ||
                                ""
                            )
                            .startsWith(
                                "TEST-"
                            )
                            &&
                            String(
                                item.requestId ||
                                ""
                            )
                            .startsWith(
                                "TEST-"
                            )
                    )
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            new Date(
                                b.assignedAt ||
                                0
                            )
                            -
                            new Date(
                                a.assignedAt ||
                                0
                            )
                    )
                : [];


        if (
            !candidates.length
        ) {

            throw new Error(
                "MaintenanceWorkerBot：没有找到 assigned 的 TEST 维修工单"
            );
        }


        const order =
            candidates[0];


        assertTestId(
            order.orderId ||
            "",
            "维修工单"
        );


        assertTestId(
            order.requestId ||
            "",
            "维修申请"
        );


        assertTestId(
            order.equipmentNumber ||
            order.equipmentId ||
            "",
            "维修设备"
        );


        return order;
    }


    async finishLatestWorkingTestRepair() {

        const rows =
            await this.readLocalStorage(
                "maintenanceWorkOrders"
            );


        const candidates =
            Array.isArray(
                rows
            )
                ? rows
                    .filter(
                        item =>
                            item &&
                            item.status ===
                                "working"
                            &&
                            String(
                                item.orderId ||
                                ""
                            )
                            .startsWith(
                                "TEST-"
                            )
                            &&
                            String(
                                item.requestId ||
                                ""
                            )
                            .startsWith(
                                "TEST-"
                            )
                    )
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            new Date(
                                b.startedAt ||
                                0
                            )
                            -
                            new Date(
                                a.startedAt ||
                                0
                            )
                    )
                : [];


        if (
            !candidates.length
        ) {

            throw new Error(
                "MaintenanceWorkerBot：没有找到 working 的 TEST 维修工单"
            );
        }


        const order =
            candidates[0];


        assertTestId(
            order.orderId ||
            "",
            "维修工单"
        );


        assertTestId(
            order.requestId ||
            "",
            "维修申请"
        );


        assertTestId(
            order.equipmentNumber ||
            order.equipmentId ||
            "",
            "维修设备"
        );


        const orderId =
            String(
                order.orderId
            );


        /*
         * maintenance-worker.html 默认停留在“我的任务”页。
         * working 工单虽然已经渲染，但按钮位于隐藏的 page-working。
         * 先切换到“维修中”，再打开维修记录。
         */
        await this.page
            .locator(
                'button[data-page="working"]'
            )
            .click();


        await this.page.waitForTimeout(
            150
        );


        const openButton =
            this.page.locator(
                `button[onclick*="openRepairOrder('${orderId}')"]`
            )
            .first();


        await openButton.waitFor({
            state:
                "visible"
        });


        await openButton.click();


        await this.page
            .locator(
                "#repairOperationArea"
            )
            .waitFor({
                state:
                    "visible"
            });


        await this.page
            .locator(
                "#faultCause"
            )
            .fill(
                "TEST-轮胎异常由胎面损伤导致"
            );


        await this.page
            .locator(
                "#repairProcess"
            )
            .fill(
                "TEST-检查轮胎、拆检受损部位、完成处理并复检"
            );


        await this.page
            .locator(
                "#actualRepairContent"
            )
            .fill(
                "TEST-已完成轮胎异常处理并确认设备可提交验收"
            );


        await this.page
            .locator(
                "#partsUsed"
            )
            .fill(
                "TEST-轮胎维修材料1套"
            );


        const tinyPng =
            Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
                "base64"
            );


        await this.page
            .locator(
                "#afterPhotoInput"
            )
            .setInputFiles({
                name:
                    "TEST-after-repair.png",

                mimeType:
                    "image/png",

                buffer:
                    tinyPng
            });


        await this.page.waitForTimeout(
            250
        );


        const finishButton =
            this.page.locator(
                'button[onclick="finishRepair()"]'
            );


        await finishButton.waitFor({
            state:
                "visible"
        });


        const dialogs =
            [];


        const dialogHandler =
            async dialog => {

                dialogs.push(
                    dialog.message()
                );


                await dialog.accept();
            };


        this.page.on(
            "dialog",
            dialogHandler
        );


        try {

            await finishButton.click();


            await this.page.waitForTimeout(
                500
            );

        } finally {

            this.page.off(
                "dialog",
                dialogHandler
            );
        }


        const afterOrders =
            await this.readLocalStorage(
                "maintenanceWorkOrders"
            );


        const updatedOrder =
            Array.isArray(
                afterOrders
            )
                ? afterOrders.find(
                    item =>
                        String(
                            item.orderId ||
                            ""
                        ) ===
                            orderId
                )
                : null;


        if (
            !updatedOrder
        ) {

            throw new Error(
                "MaintenanceWorkerBot：提交验收后工单丢失"
            );
        }


        if (
            updatedOrder.status !==
                "waiting_inspection"
        ) {

            throw new Error(
                "MaintenanceWorkerBot：维修工单未进入 waiting_inspection" +
                (
                    dialogs.length
                        ? "；页面提示=" +
                          dialogs.join(
                              " | "
                          )
                        : ""
                )
            );
        }


        if (
            !updatedOrder.repairFinishedAt
        ) {

            throw new Error(
                "MaintenanceWorkerBot：工单缺少 repairFinishedAt"
            );
        }


        if (
            !updatedOrder.afterPhotoData
        ) {

            throw new Error(
                "MaintenanceWorkerBot：维修后照片没有写入工单"
            );
        }


        if (
            String(
                updatedOrder.finishedBy ||
                ""
            ) !==
                "维修工01"
        ) {

            throw new Error(
                "MaintenanceWorkerBot：finishedBy 不是当前 TEST 维修员"
            );
        }


        assertTestId(
            updatedOrder.finishedById ||
            "",
            "完成维修人员"
        );


        if (
            String(
                updatedOrder.faultCause ||
                ""
            ) !==
                "TEST-轮胎异常由胎面损伤导致"
        ) {

            throw new Error(
                "MaintenanceWorkerBot：故障原因没有正确写入"
            );
        }


        if (
            String(
                updatedOrder.actualRepairContent ||
                ""
            ) !==
                "TEST-已完成轮胎异常处理并确认设备可提交验收"
        ) {

            throw new Error(
                "MaintenanceWorkerBot：实际维修内容没有正确写入"
            );
        }


        const requests =
            await this.readLocalStorage(
                "maintenanceRequests"
            );


        const request =
            Array.isArray(
                requests
            )
                ? requests.find(
                    item =>
                        String(
                            item.requestId ||
                            item.maintenanceRequestId ||
                            ""
                        ) ===
                            String(
                                updatedOrder.requestId ||
                                ""
                            )
                )
                : null;


        if (
            !request
        ) {

            throw new Error(
                "MaintenanceWorkerBot：找不到关联维修申请"
            );
        }


        if (
            request.status !==
                "waiting_inspection"
        ) {

            throw new Error(
                "MaintenanceWorkerBot：维修申请没有同步进入 waiting_inspection"
            );
        }


        if (
            String(
                request.orderId ||
                ""
            ) !==
                orderId
        ) {

            throw new Error(
                "MaintenanceWorkerBot：维修申请没有保持工单关联"
            );
        }


        return {
            orderId,

            requestId:
                updatedOrder.requestId,

            equipmentId:
                updatedOrder.equipmentNumber ||
                updatedOrder.equipmentId,

            orderStatus:
                updatedOrder.status,

            requestStatus:
                request.status,

            repairFinishedAt:
                updatedOrder.repairFinishedAt,

            finishedBy:
                updatedOrder.finishedBy,

            finishedById:
                updatedOrder.finishedById,

            faultCause:
                updatedOrder.faultCause,

            repairProcess:
                updatedOrder.repairProcess,

            actualRepairContent:
                updatedOrder.actualRepairContent,

            partsUsed:
                updatedOrder.partsUsed,

            hasAfterPhoto:
                Boolean(
                    updatedOrder.afterPhotoData
                )
        };
    }


    async startLatestAssignedTestRepair() {

        const order =
            await this.findLatestAssignedTestOrder();


        const orderId =
            String(
                order.orderId
            );


        /*
         * 维修管理派工时 workerName=维修工01。
         * 当前 TEST 维修员也使用同名，确保走真实 isMyOrder() 归属校验。
         */
        if (
            String(
                order.workerName ||
                ""
            ) !==
                "维修工01"
        ) {

            throw new Error(
                "MaintenanceWorkerBot：工单没有分配给 TEST 维修员，workerName=" +
                String(
                    order.workerName ||
                    "-"
                )
            );
        }


        const openButton =
            this.page.locator(
                `button[onclick*="openRepairOrder('${orderId}')"]`
            )
            .first();


        await openButton.waitFor({
            state:
                "visible"
        });


        await openButton.click();


        await this.page
            .locator(
                "#repairOperationArea"
            )
            .waitFor({
                state:
                    "visible"
            });


        const tinyPng =
            Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
                "base64"
            );


        await this.page
            .locator(
                "#beforePhotoInput"
            )
            .setInputFiles({
                name:
                    "TEST-before-repair.png",

                mimeType:
                    "image/png",

                buffer:
                    tinyPng
            });


        await this.page.waitForTimeout(
            250
        );


        const startButton =
            this.page.locator(
                'button[onclick="startRepair()"]'
            );


        await startButton.waitFor({
            state:
                "visible"
        });


        const dialogs =
            [];


        const dialogHandler =
            async dialog => {

                dialogs.push(
                    dialog.message()
                );


                await dialog.accept();
            };


        this.page.on(
            "dialog",
            dialogHandler
        );


        try {

            await startButton.click();


            await this.page.waitForTimeout(
                500
            );

        } finally {

            this.page.off(
                "dialog",
                dialogHandler
            );
        }


        const orders =
            await this.readLocalStorage(
                "maintenanceWorkOrders"
            );


        const updatedOrder =
            Array.isArray(
                orders
            )
                ? orders.find(
                    item =>
                        String(
                            item.orderId ||
                            ""
                        ) ===
                            orderId
                )
                : null;


        if (
            !updatedOrder
        ) {

            throw new Error(
                "MaintenanceWorkerBot：开始维修后工单丢失"
            );
        }


        if (
            updatedOrder.status !==
                "working"
        ) {

            throw new Error(
                "MaintenanceWorkerBot：维修工单未进入 working" +
                (
                    dialogs.length
                        ? "；页面提示=" +
                          dialogs.join(
                              " | "
                          )
                        : ""
                )
            );
        }


        if (
            !updatedOrder.startedAt
        ) {

            throw new Error(
                "MaintenanceWorkerBot：维修工单缺少 startedAt"
            );
        }


        if (
            String(
                updatedOrder.startedBy ||
                ""
            ) !==
                "维修工01"
        ) {

            throw new Error(
                "MaintenanceWorkerBot：startedBy 不是当前 TEST 维修员"
            );
        }


        assertTestId(
            updatedOrder.startedById ||
            "",
            "开始维修人员"
        );


        if (
            !updatedOrder.beforePhotoData
        ) {

            throw new Error(
                "MaintenanceWorkerBot：维修前照片没有写入工单"
            );
        }


        const requests =
            await this.readLocalStorage(
                "maintenanceRequests"
            );


        const request =
            Array.isArray(
                requests
            )
                ? requests.find(
                    item =>
                        String(
                            item.requestId ||
                            item.maintenanceRequestId ||
                            ""
                        ) ===
                            String(
                                updatedOrder.requestId ||
                                ""
                            )
                )
                : null;


        if (
            !request
        ) {

            throw new Error(
                "MaintenanceWorkerBot：找不到关联维修申请"
            );
        }


        if (
            request.status !==
                "working"
        ) {

            throw new Error(
                "MaintenanceWorkerBot：维修申请没有同步进入 working"
            );
        }


        if (
            String(
                request.orderId ||
                ""
            ) !==
                orderId
        ) {

            throw new Error(
                "MaintenanceWorkerBot：维修申请没有保持工单关联"
            );
        }


        return {
            orderId,
            requestId:
                updatedOrder.requestId,

            equipmentId:
                updatedOrder.equipmentNumber ||
                updatedOrder.equipmentId,

            workerName:
                updatedOrder.workerName,

            workerId:
                updatedOrder.startedById,

            orderStatus:
                updatedOrder.status,

            requestStatus:
                request.status,

            startedAt:
                updatedOrder.startedAt,

            hasBeforePhoto:
                Boolean(
                    updatedOrder.beforePhotoData
                )
        };
    }
}


module.exports = {
    MaintenanceWorkerBot
};
