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


    async getVehicleChangeRequests() {

        const rows =
            await this.readLocalStorage(
                "driverVehicleChangeRequests"
            );


        return Array.isArray(
            rows
        )
            ? rows
            : [];
    }


    async findLatestPendingTestVehicleChange() {

        const rows =
            await this.getVehicleChangeRequests();


        const pending =
            rows
                .filter(
                    item =>
                        item &&
                        item.status ===
                            "pending"
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
                            b.requestedAt ||
                            0
                        )
                        -
                        new Date(
                            a.requestedAt ||
                            0
                        )
                );


        if (
            !pending.length
        ) {

            throw new Error(
                "DispatchBot：没有找到待审批 TEST 换车申请"
            );
        }


        const request =
            pending[0];


        assertTestId(
            request.requestId ||
            "",
            "换车申请"
        );


        assertTestId(
            request.taskId ||
            "",
            "换车申请任务"
        );


        assertTestId(
            request.driverId ||
            request.personId ||
            "",
            "换车申请司机"
        );


        assertTestId(
            request.oldVehicleNumber ||
            request.oldVehicleId ||
            "",
            "换车申请旧车辆"
        );


        return request;
    }


    async approveLatestTestVehicleChange(
        newVehicle =
            "TEST-T-002"
    ) {

        assertTestId(
            newVehicle,
            "替换车辆"
        );


        const request =
            await this.findLatestPendingTestVehicleChange();


        assertSafeWrite(
            "approve",
            request.requestId
        );


        const openButton =
            this.page.locator(
                "#openVehicleChangeButton"
            );


        await openButton.waitFor({
            state:
                "visible"
        });


        await openButton.click();


        await this.page
            .locator(
                "#vehicleChangeModal"
            )
            .waitFor({
                state:
                    "visible"
            });


        const select =
            this.page.locator(
                `[data-change-vehicle="${request.requestId}"]`
            );


        await select.waitFor({
            state:
                "visible"
        });


        const options =
            await select
                .locator(
                    "option"
                )
                .allTextContents();


        if (
            !options.some(
                text =>
                    String(
                        text
                    )
                    .includes(
                        newVehicle
                    )
            )
        ) {

            throw new Error(
                "DispatchBot：替换车辆列表中没有 " +
                newVehicle
            );
        }


        await select.selectOption(
            newVehicle
        );


        const dialogMessages =
            [];


        const dialogHandler =
            async dialog => {

                dialogMessages.push(
                    dialog.message()
                );


                await dialog.accept();
            };


        this.page.on(
            "dialog",
            dialogHandler
        );


        try {

            await this.page
                .locator(
                    `[data-change-approve="${request.requestId}"]`
                )
                .click();


            await this.page.waitForTimeout(
                700
            );

        } finally {

            this.page.off(
                "dialog",
                dialogHandler
            );
        }


        const rows =
            await this.getVehicleChangeRequests();


        const updated =
            rows.find(
                item =>
                    String(
                        item.requestId ||
                        ""
                    ) ===
                        String(
                            request.requestId
                        )
            );


        if (
            !updated
        ) {

            throw new Error(
                "DispatchBot：审批后换车申请丢失"
            );
        }


        if (
            updated.status !==
                "approved"
        ) {

            throw new Error(
                "DispatchBot：换车申请未变为 approved"
            );
        }


        if (
            String(
                updated.approvedVehicleNumber ||
                updated.approvedVehicleId ||
                ""
            ) !==
                newVehicle
        ) {

            throw new Error(
                "DispatchBot：审批后的替换车辆不正确"
            );
        }


        const currentTask =
            await this.readLocalStorage(
                "driverCurrentTask"
            );


        if (
            String(
                currentTask?.vehicleNumber ||
                currentTask?.vehicleId ||
                ""
            ) !==
                newVehicle
        ) {

            throw new Error(
                "DispatchBot：司机当前任务没有切换到新车辆"
            );
        }


        if (
            currentTask?.vehicleClaimed !==
                false
        ) {

            throw new Error(
                "DispatchBot：换车后新车辆没有要求重新领取"
            );
        }


        const tasks =
            await this.readLocalStorage(
                "dispatchPublishedTasks"
            ) ||
            [];


        const task =
            Array.isArray(
                tasks
            )
                ? tasks.find(
                    item =>
                        String(
                            item?.taskId ||
                            ""
                        ) ===
                            String(
                                request.taskId
                            )
                )
                : null;


        if (
            !task
        ) {

            throw new Error(
                "DispatchBot：换车审批后找不到 TEST 主任务"
            );
        }


        const assignment =
            Array.isArray(
                task.driverAssignments
            )
                ? task.driverAssignments.find(
                    item =>
                        String(
                            item?.driverId ||
                            item?.personId ||
                            ""
                        ) ===
                            String(
                                request.driverId ||
                                request.personId ||
                                ""
                            )
                )
                : null;


        if (
            !assignment ||
            String(
                assignment.vehicleNumber ||
                assignment.vehicleId ||
                ""
            ) !==
                newVehicle
        ) {

            throw new Error(
                "DispatchBot：主任务司机绑定没有更新为新车辆"
            );
        }


        return {
            requestId:
                request.requestId,

            taskId:
                request.taskId,

            driverId:
                request.driverId ||
                request.personId,

            oldVehicle:
                request.oldVehicleNumber ||
                request.oldVehicleId,

            newVehicle,

            status:
                updated.status,

            vehicleClaimed:
                currentTask.vehicleClaimed,

            taskStatus:
                currentTask.status,

            dialogMessages
        };
    }


    async getMaintenanceRequests() {

        const rows =
            await this.readLocalStorage(
                "maintenanceRequests"
            );


        return Array.isArray(
            rows
        )
            ? rows
            : [];
    }


    async findLatestPendingTestMaintenanceRequest() {

        const rows =
            await this.getMaintenanceRequests();


        const pending =
            rows
                .filter(
                    item =>
                        item &&
                        String(
                            item.requestId ||
                            item.maintenanceRequestId ||
                            ""
                        )
                        .startsWith(
                            "TEST-"
                        )
                        &&
                        (
                            item.status ===
                                "pending_dispatch"
                            ||
                            item.dispatchStatus ===
                                "pending"
                        )
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        new Date(
                            b.createdAt ||
                            0
                        )
                        -
                        new Date(
                            a.createdAt ||
                            0
                        )
                );


        if (
            !pending.length
        ) {

            throw new Error(
                "DispatchBot：没有找到待调度审批的 TEST 维修单"
            );
        }


        const request =
            pending[0];


        const requestId =
            String(
                request.requestId ||
                request.maintenanceRequestId ||
                ""
            );


        assertTestId(
            requestId,
            "维修单"
        );


        assertTestId(
            request.taskId ||
            "",
            "维修单任务"
        );


        assertTestId(
            request.equipmentId ||
            request.equipmentNumber ||
            "",
            "维修单设备"
        );


        return request;
    }


    async approveLatestTestMaintenanceRequest() {

        const request =
            await this.findLatestPendingTestMaintenanceRequest();


        const requestId =
            String(
                request.requestId ||
                request.maintenanceRequestId ||
                ""
            );


        assertSafeWrite(
            "approve",
            requestId
        );


        const openButton =
            this.page.locator(
                "#openMaintenanceReviewButton"
            );


        await openButton.waitFor({
            state:
                "visible"
        });


        await openButton.click();


        await this.page
            .locator(
                "#maintenanceReviewModal"
            )
            .waitFor({
                state:
                    "visible"
            });


        const approveButton =
            this.page.locator(
                `#maintenanceReviewModal button.success-button[onclick*="${requestId}"]`
            );


        await approveButton.waitFor({
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

            await approveButton.click();


            await this.page.waitForTimeout(
                600
            );

        } finally {

            this.page.off(
                "dialog",
                dialogHandler
            );
        }


        const rows =
            await this.getMaintenanceRequests();


        const updated =
            rows.find(
                item =>
                    String(
                        item.requestId ||
                        item.maintenanceRequestId ||
                        ""
                    ) ===
                        requestId
            );


        if (
            !updated
        ) {

            throw new Error(
                "DispatchBot：审批后 TEST 维修单丢失"
            );
        }


        if (
            updated.dispatchStatus !==
                "approved"
        ) {

            throw new Error(
                "DispatchBot：维修单 dispatchStatus 未变为 approved"
            );
        }


        if (
            updated.status !==
                "waiting_entry"
        ) {

            throw new Error(
                "DispatchBot：维修单没有进入 waiting_entry"
            );
        }


        if (
            !updated.dispatchApprovedAt
        ) {

            throw new Error(
                "DispatchBot：维修单缺少 dispatchApprovedAt"
            );
        }


        return {
            requestId,

            taskId:
                updated.taskId,

            equipmentId:
                updated.equipmentId ||
                updated.equipmentNumber,

            maintenanceType:
                updated.maintenanceType,

            beforeStatus:
                request.status,

            status:
                updated.status,

            dispatchStatus:
                updated.dispatchStatus,

            dispatchApprovedBy:
                updated.dispatchApprovedBy,

            dispatchApprovedAt:
                updated.dispatchApprovedAt,

            dialogMessages:
                dialogs
        };
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


    async findLatestPendingTestTemporaryUnload() {

        const rows =
            await this.getPendingTemporaryUnloadRequests();


        const testRows =
            rows.filter(
                item =>
                    String(
                        item?.requestId ||
                        ""
                    )
                    .startsWith(
                        "TEST-"
                    )
            );


        if (
            !testRows.length
        ) {

            throw new Error(
                "DispatchBot：没有找到待审核 TEST 临时卸料申请"
            );
        }


        const request =
            testRows
                .slice()
                .sort(
                    (
                        a,
                        b
                    ) =>
                        new Date(
                            b.createdAt ||
                            0
                        )
                        -
                        new Date(
                            a.createdAt ||
                            0
                        )
                )[0];


        await this.assertTestRequest(
            request
        );


        return request;
    }


    async installTestOfficialTripGuard() {

        await this.page.evaluate(
            () => {

                if (
                    window.__dispatchBotTripGuardInstalled
                ) {

                    return;
                }


                const originalSetItem =
                    localStorage.setItem.bind(
                        localStorage
                    );


                localStorage.setItem =
                    function (
                        key,
                        value
                    ) {

                        if (
                            key ===
                                "tripRecords"
                        ) {

                            try {

                                const rows =
                                    JSON.parse(
                                        value ||
                                        "[]"
                                    );


                                if (
                                    Array.isArray(
                                        rows
                                    )
                                ) {

                                    rows.forEach(
                                        item => {

                                            const requestId =
                                                String(
                                                    item?.temporaryUnloadRequestId ||
                                                    ""
                                                );


                                            if (
                                                requestId.startsWith(
                                                    "TEST-"
                                                )
                                            ) {

                                                const testTripId =
                                                    "TEST-TRIP-" +
                                                    requestId
                                                        .replace(
                                                            /^TEST-/,
                                                            ""
                                                        );


                                                item.tripId =
                                                    testTripId;

                                                item.recordId =
                                                    testTripId;

                                                item.id =
                                                    item.id &&
                                                    String(
                                                        item.id
                                                    )
                                                    .startsWith(
                                                        "TEST-"
                                                    )
                                                        ? item.id
                                                        : testTripId;
                                            }
                                        }
                                    );


                                    value =
                                        JSON.stringify(
                                            rows
                                        );
                                }

                            } catch (
                                error
                            ) {

                                console.warn(
                                    "[DispatchBot] TEST正式趟次ID保护失败",
                                    error
                                );
                            }
                        }


                        return originalSetItem(
                            key,
                            value
                        );
                    };


                window.__dispatchBotTripGuardInstalled =
                    true;
            }
        );
    }


    async getTemporaryUnloadRequestById(
        requestId
    ) {

        assertTestId(
            requestId,
            "临时卸料申请"
        );


        const rows =
            await this.getTemporaryUnloadRequests();


        return (
            rows.find(
                item =>
                    String(
                        item?.requestId ||
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


    async approveLatestTestTemporaryUnload() {

        const request =
            await this.findLatestPendingTestTemporaryUnload();


        const requestId =
            String(
                request.requestId ||
                ""
            );


        assertSafeWrite(
            "approve",
            requestId
        );


        const beforeTrips =
            await this.readTripRecords();


        const beforeCount =
            beforeTrips.length;


        await this.installTestOfficialTripGuard();


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


        /*
         * 调度确认过程会出现：
         * 1. confirm()
         * 2. 成功后的 alert()
         *
         * 在点击前注册统一处理，全部接受。
         */

        const dialogHandler =
            async dialog => {

                await dialog.accept();
            };


        this.page.on(
            "dialog",
            dialogHandler
        );


        try {

            await approveButton.click();


            await this.page.waitForTimeout(
                700
            );

        } finally {

            this.page.off(
                "dialog",
                dialogHandler
            );
        }


        const updatedRequest =
            await this.getTemporaryUnloadRequestById(
                requestId
            );


        if (
            !updatedRequest
        ) {

            throw new Error(
                "DispatchBot：审核后临时卸料申请丢失"
            );
        }


        await this.assertTestRequest(
            updatedRequest
        );


        if (
            updatedRequest.status !==
                "approved"
        ) {

            throw new Error(
                "DispatchBot：TEST临时卸料申请未变为 approved"
            );
        }


        if (
            updatedRequest.dispatchConfirmation !==
                "confirmed"
        ) {

            throw new Error(
                "DispatchBot：dispatchConfirmation 未变为 confirmed"
            );
        }


        if (
            updatedRequest.officialCountEligible !==
                true
        ) {

            throw new Error(
                "DispatchBot：审核通过后 officialCountEligible 未变为 true"
            );
        }


        const officialTrip =
            await this.findOfficialTripByRequestId(
                requestId
            );


        if (
            !officialTrip
        ) {

            throw new Error(
                "DispatchBot：审核通过后没有生成正式运输趟次"
            );
        }


        const tripId =
            String(
                officialTrip.tripId ||
                officialTrip.recordId ||
                officialTrip.id ||
                ""
            );


        assertTestId(
            tripId,
            "正式运输趟次"
        );


        assertTestId(
            officialTrip.taskId ||
            officialTrip.dispatchTaskId ||
            "",
            "正式趟次任务"
        );


        assertTestId(
            officialTrip.driverId ||
            officialTrip.personId ||
            "",
            "正式趟次司机"
        );


        assertTestId(
            officialTrip.vehicleNumber ||
            officialTrip.vehicleId ||
            "",
            "正式趟次车辆"
        );


        if (
            String(
                officialTrip.temporaryUnloadRequestId ||
                ""
            ) !==
                requestId
        ) {

            throw new Error(
                "DispatchBot：正式趟次没有正确关联 TEST 临时卸料申请"
            );
        }


        if (
            officialTrip.status !==
                "completed"
        ) {

            throw new Error(
                "DispatchBot：正式趟次状态不是 completed"
            );
        }


        if (
            officialTrip.officialCountEligible !==
                true
        ) {

            throw new Error(
                "DispatchBot：正式趟次未进入正式统计资格"
            );
        }


        const afterTrips =
            await this.readTripRecords();


        if (
            afterTrips.length !==
                beforeCount +
                1
        ) {

            throw new Error(
                "DispatchBot：审核通过后正式趟次数量没有恰好增加1"
            );
        }


        const stats =
            await this.getTodayStats();


        return {
            requestId,
            tripId,

            taskId:
                officialTrip.taskId ||
                officialTrip.dispatchTaskId ||
                "",

            driverId:
                officialTrip.driverId ||
                officialTrip.personId ||
                "",

            vehicleId:
                officialTrip.vehicleNumber ||
                officialTrip.vehicleId ||
                "",

            materialType:
                officialTrip.materialType ||
                officialTrip.material ||
                "",

            requestStatus:
                updatedRequest.status,

            dispatchConfirmation:
                updatedRequest.dispatchConfirmation,

            officialCountEligible:
                updatedRequest.officialCountEligible,

            tripStatus:
                officialTrip.status,

            beforeTripCount:
                beforeCount,

            afterTripCount:
                afterTrips.length,

            stats
        };
    }


    async rejectLatestTestTemporaryUnload() {

        const request =
            await this.findLatestPendingTestTemporaryUnload();


        const requestId =
            String(
                request.requestId ||
                ""
            );


        assertSafeWrite(
            "reject",
            requestId
        );


        const beforeTrips =
            await this.readTripRecords();


        const beforeCount =
            beforeTrips.length;


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


        const rejectButton =
            card.locator(
                ".temp-unload-reject"
            );


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

            await rejectButton.click();


            await this.page.waitForTimeout(
                700
            );

        } finally {

            this.page.off(
                "dialog",
                dialogHandler
            );
        }


        const updatedRequest =
            await this.getTemporaryUnloadRequestById(
                requestId
            );


        if (
            !updatedRequest
        ) {

            throw new Error(
                "DispatchBot：驳回后临时卸料申请丢失"
            );
        }


        await this.assertTestRequest(
            updatedRequest
        );


        if (
            updatedRequest.status !==
                "rejected"
        ) {

            throw new Error(
                "DispatchBot：驳回后申请状态未变为 rejected"
            );
        }


        if (
            updatedRequest.dispatchConfirmation !==
                "rejected"
        ) {

            throw new Error(
                "DispatchBot：驳回后 dispatchConfirmation 未变为 rejected"
            );
        }


        if (
            updatedRequest.officialCountEligible !==
                false
        ) {

            throw new Error(
                "DispatchBot：驳回后 officialCountEligible 不是 false"
            );
        }


        if (
            !updatedRequest.reviewedAt
        ) {

            throw new Error(
                "DispatchBot：驳回后缺少 reviewedAt"
            );
        }


        const officialTrip =
            await this.findOfficialTripByRequestId(
                requestId
            );


        if (
            officialTrip
        ) {

            throw new Error(
                "DispatchBot：驳回临时卸料后错误生成了正式运输趟次"
            );
        }


        const afterTrips =
            await this.readTripRecords();


        if (
            afterTrips.length !==
                beforeCount
        ) {

            throw new Error(
                "DispatchBot：驳回后正式趟次数量发生变化"
            );
        }


        const pendingRows =
            await this.getPendingTemporaryUnloadRequests();


        if (
            pendingRows.some(
                item =>
                    String(
                        item?.requestId ||
                        ""
                    ) ===
                        requestId
            )
        ) {

            throw new Error(
                "DispatchBot：驳回后申请仍残留在待审核列表"
            );
        }


        return {
            requestId,

            taskId:
                updatedRequest.taskId ||
                updatedRequest.dispatchTaskId ||
                "",

            driverId:
                updatedRequest.driverId ||
                updatedRequest.personId ||
                "",

            vehicleId:
                updatedRequest.vehicleNumber ||
                updatedRequest.vehicleId ||
                "",

            requestStatus:
                updatedRequest.status,

            dispatchConfirmation:
                updatedRequest.dispatchConfirmation,

            officialCountEligible:
                updatedRequest.officialCountEligible,

            reviewedAt:
                updatedRequest.reviewedAt,

            beforeTripCount:
                beforeCount,

            afterTripCount:
                afterTrips.length,

            dialogs
        };
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


        const dialogHandler =
            async dialog => {

                await dialog.accept();
            };


        this.page.on(
            "dialog",
            dialogHandler
        );


        try {

            await approveButton.click();


            await this.page.waitForTimeout(
                500
            );

        } finally {

            this.page.off(
                "dialog",
                dialogHandler
            );
        }


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
        });


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


    async seedAuxiliaryCompletionFeedbackTestData() {

        await this.page.evaluate(
            () => {

                const now =
                    new Date()
                        .toISOString();


                localStorage.setItem(
                    "auxiliaryWorkRecords",
                    JSON.stringify([
                        {
                            workRecordId:
                                "TEST-AUX-COMPLETE-001",

                            taskId:
                                "TEST-AUX-TASK-001",

                            personId:
                                "TEST-AUX-PERSON-001",

                            personName:
                                "TEST-洒水车司机",

                            position:
                                "洒水车司机",

                            vehicleId:
                                "TEST-AUX-WATER-001",

                            vehicleNumber:
                                "TEST-AUX-WATER-001",

                            vehicleType:
                                "洒水车",

                            work:
                                "TEST-运输道路洒水降尘",

                            status:
                                "completed",

                            completedAt:
                                now,

                            testFixture:
                                true
                        }
                    ])
                );


                localStorage.setItem(
                    "fuelRecords",
                    JSON.stringify([
                        {
                            fuelId:
                                "TEST-FUEL-COMPLETE-001",

                            requestId:
                                "TEST-FUEL-REQ-001",

                            taskId:
                                "TEST-FUEL-TASK-001",

                            personId:
                                "TEST-FUEL-PERSON-001",

                            personName:
                                "TEST-加油车司机",

                            driverName:
                                "TEST-加油车司机",

                            vehicleId:
                                "TEST-FUEL-VEHICLE-001",

                            vehicleNumber:
                                "TEST-FUEL-VEHICLE-001",

                            amount:
                                500,

                            quantity:
                                500,

                            completedAt:
                                now,

                            createdAt:
                                now,

                            testFixture:
                                true
                        }
                    ])
                );
            }
        );


        await this.page.reload({
            waitUntil:
                "domcontentloaded"
        });


        await this.page.waitForTimeout(
            400
        );


        return true;
    }


    async seedAuxiliaryCompletionFeedbackFromResults(
        results
    ) {

        const safeResults =
            Array.isArray(
                results
            )
                ? results
                : [];


        await this.page.evaluate(
            rows => {

                const now =
                    new Date()
                        .toISOString();


                const auxiliary =
                    rows
                        .filter(
                            item =>
                                item &&
                                item.position !==
                                    "加油车司机"
                        )
                        .map(
                            item => ({
                                workRecordId:
                                    item.workRecordId ||
                                    (
                                        "TEST-AUX-RESULT-" +
                                        String(
                                            item.taskId ||
                                            ""
                                        )
                                    ),

                                taskId:
                                    item.taskId,

                                personId:
                                    item.personId,

                                personName:
                                    item.personName ||
                                    item.position,

                                position:
                                    item.position,

                                vehicleId:
                                    item.vehicleId,

                                vehicleNumber:
                                    item.vehicleId,

                                vehicleType:
                                    String(
                                        item.position ||
                                        ""
                                    )
                                    .replace(
                                        "司机",
                                        ""
                                    ),

                                work:
                                    item.work ||
                                    "TEST-辅助车辆已完成作业",

                                status:
                                    "completed",

                                completedAt:
                                    item.completedAt ||
                                    now,

                                testFixture:
                                    true
                            })
                        );


                const fuel =
                    rows
                        .filter(
                            item =>
                                item &&
                                item.position ===
                                    "加油车司机"
                        )
                        .map(
                            item => ({
                                fuelId:
                                    item.fuelId ||
                                    (
                                        "TEST-FUEL-RESULT-" +
                                        String(
                                            item.taskId ||
                                            ""
                                        )
                                    ),

                                requestId:
                                    item.taskId,

                                taskId:
                                    item.taskId,

                                personId:
                                    item.personId,

                                personName:
                                    item.position,

                                driverName:
                                    item.position,

                                vehicleId:
                                    item.vehicleId,

                                vehicleNumber:
                                    item.vehicleId,

                                amount:
                                    Number(
                                        item.amount ||
                                        0
                                    ),

                                quantity:
                                    Number(
                                        item.amount ||
                                        0
                                    ),

                                completedAt:
                                    now,

                                createdAt:
                                    now,

                                confirmationStatus:
                                    item.confirmationStatus ||
                                    "confirmed",

                                testFixture:
                                    true
                            })
                        );


                localStorage.setItem(
                    "auxiliaryWorkRecords",
                    JSON.stringify(
                        auxiliary
                    )
                );


                localStorage.setItem(
                    "fuelRecords",
                    JSON.stringify(
                        fuel
                    )
                );
            },
            safeResults
        );


        await this.page.reload({
            waitUntil:
                "domcontentloaded"
        });


        await this.page.waitForTimeout(
            400
        );


        return true;
    }


    async verifyAuxiliaryCompletionFeedbackFromResults(
        results
    ) {

        const safeResults =
            Array.isArray(
                results
            )
                ? results
                : [];


        const countText =
            String(
                await this.page
                    .locator(
                        "#auxiliaryCompletionCount"
                    )
                    .textContent()
            )
            .trim();


        const numericCount =
            Number(
                countText.replace(
                    /[^0-9]/g,
                    ""
                )
            );


        const listText =
            String(
                await this.page
                    .locator(
                        "#auxiliaryCompletionList"
                    )
                    .innerText()
            );


        const missing = [];


        safeResults.forEach(
            item => {

                const vehicleId =
                    String(
                        item.vehicleId ||
                        ""
                    );


                const taskId =
                    String(
                        item.taskId ||
                        ""
                    );


                if (
                    vehicleId &&
                    !listText.includes(
                        vehicleId
                    )
                ) {

                    missing.push(
                        "车辆 " +
                        vehicleId
                    );
                }


                if (
                    taskId &&
                    !listText.includes(
                        taskId
                    )
                ) {

                    missing.push(
                        "任务 " +
                        taskId
                    );
                }
            }
        );


        const fuelResult =
            safeResults.find(
                item =>
                    item.position ===
                        "加油车司机"
            );


        if (
            fuelResult
        ) {

            const expectedFuelText =
                "完成加油 " +
                Number(
                    fuelResult.amount ||
                    0
                )
                .toFixed(
                    1
                ) +
                " L";


            if (
                !listText.includes(
                    expectedFuelText
                )
            ) {

                missing.push(
                    expectedFuelText
                );
            }
        }


        if (
            missing.length
        ) {

            throw new Error(
                "DispatchBot：实际辅助车辆结果回传缺少：" +
                missing.join(
                    "、"
                )
            );
        }


        if (
            numericCount <
                safeResults.length
        ) {

            throw new Error(
                "DispatchBot：完成回传数量不足，预期至少=" +
                safeResults.length +
                "；实际=" +
                numericCount
            );
        }


        return {
            count:
                numericCount,

            expectedCount:
                safeResults.length,

            listText,

            allVehiclesVisible:
                true,

            allTasksVisible:
                true,

            hasFuel:
                Boolean(
                    fuelResult
                )
        };
    }


    async verifyAuxiliaryCompletionFeedbackView() {

        const countText =
            String(
                await this.page
                    .locator(
                        "#auxiliaryCompletionCount"
                    )
                    .textContent()
            )
            .trim();


        const listText =
            String(
                await this.page
                    .locator(
                        "#auxiliaryCompletionList"
                    )
                    .innerText()
            );


        const requiredTexts = [
            "洒水车司机",
            "TEST-AUX-WATER-001",
            "TEST-AUX-TASK-001",
            "TEST-运输道路洒水降尘",
            "加油车司机",
            "TEST-FUEL-VEHICLE-001",
            "TEST-FUEL-REQ-001",
            "完成加油 500.0 L"
        ];


        const missing =
            requiredTexts.filter(
                text =>
                    !listText.includes(
                        text
                    )
            );


        if (
            missing.length
        ) {

            throw new Error(
                "DispatchBot：辅助车辆完成回传缺少内容：" +
                missing.join(
                    "、"
                )
            );
        }


        const numericCount =
            Number(
                countText.replace(
                    /[^0-9]/g,
                    ""
                )
            );


        if (
            numericCount <
                2
        ) {

            throw new Error(
                "DispatchBot：辅助车辆完成回传数量不足，实际=" +
                countText
            );
        }


        return {
            count:
                numericCount,

            countText,

            hasAuxiliary:
                listText.includes(
                    "TEST-AUX-WATER-001"
                ),

            hasFuel:
                listText.includes(
                    "TEST-FUEL-VEHICLE-001"
                ),

            listText
        };
    }

}


module.exports = {
    DispatchBot
};
