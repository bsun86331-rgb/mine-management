"use strict";

const {
    assertTestId
} = require(
    "../test-safety-guard"
);


/*
=========================================================
R0-3 MaintenanceManagerBot
维修管理测试机器人

仅操作 TEST- 维修申请 / TEST- 工位 / TEST- 工单。
流程：
waiting_entry
→ 确认进厂
→ waiting_assignment
→ 分配 TEST 工位 / 维修工
→ 生成 TEST 维修工单
→ assigned
=========================================================
*/

class MaintenanceManagerBot {

    constructor(
        page
    ) {

        this.page =
            page;

        this.name =
            "MaintenanceManagerBot";
    }


    async installTestEnvironment() {

        await this.page.addInitScript(
            () => {

                /*
                 * TEST 维修管理身份。
                 * 保留原人员数据，只补一条 TEST 管理员。
                 */
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


                if (
                    !personnel.some(
                        item =>
                            String(
                                item?.personId ||
                                item?.employeeId ||
                                ""
                            ) ===
                                "TEST-MAINT-MGR-001"
                    )
                ) {

                    personnel.push({
                        personId:
                            "TEST-MAINT-MGR-001",

                        employeeId:
                            "TEST-MAINT-MGR-001",

                        name:
                            "TEST-维修管理",

                        position:
                            "维修管理",

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
                    "TEST-MAINT-MGR-001"
                );


                localStorage.setItem(
                    "selectedPosition",
                    "维修管理"
                );


                /*
                 * 使用独立 TEST 工位，避免机器人占用正式工位。
                 */
                localStorage.setItem(
                    "workshopBays",
                    JSON.stringify([
                        {
                            bayId:
                                "TEST-BAY-01",

                            name:
                                "TEST-1号工位",

                            status:
                                "free",

                            orderId:
                                "",

                            testFixture:
                                true
                        }
                    ])
                );


                if (
                    !localStorage.getItem(
                        "maintenanceWorkOrders"
                    )
                ) {

                    localStorage.setItem(
                        "maintenanceWorkOrders",
                        "[]"
                    );
                }


                /*
                 * 业务页 createId("WO") 会生成普通 WO-*。
                 * 仅当工单关联 TEST- 维修申请时改成 TEST-WO-*，
                 * 并同步 request / bay 的 orderId。
                 */
                if (
                    window.__robotMaintenanceWriteGuardInstalled
                ) {

                    return;
                }


                window.__robotMaintenanceOrderIdMap =
                    {};


                const originalSetItem =
                    Storage.prototype.setItem;


                Storage.prototype.setItem =
                    function (
                        key,
                        value
                    ) {

                        if (
                            this ===
                                window.localStorage
                        ) {

                            try {

                                const rows =
                                    JSON.parse(
                                        value
                                    );


                                if (
                                    Array.isArray(
                                        rows
                                    )
                                ) {

                                    if (
                                        key ===
                                            "maintenanceWorkOrders"
                                    ) {

                                        rows.forEach(
                                            item => {

                                                const requestId =
                                                    String(
                                                        item?.requestId ||
                                                        ""
                                                    );


                                                const orderId =
                                                    String(
                                                        item?.orderId ||
                                                        ""
                                                    );


                                                if (
                                                    requestId.startsWith(
                                                        "TEST-"
                                                    ) &&
                                                    orderId &&
                                                    !orderId.startsWith(
                                                        "TEST-"
                                                    )
                                                ) {

                                                    const testOrderId =
                                                        "TEST-WO-" +
                                                        orderId.replace(
                                                            /^WO[_-]?/,
                                                            ""
                                                        );


                                                    window.__robotMaintenanceOrderIdMap[
                                                        orderId
                                                    ] =
                                                        testOrderId;


                                                    item.orderId =
                                                        testOrderId;
                                                }
                                            }
                                        );
                                    }


                                    if (
                                        key ===
                                            "workshopBays"
                                    ) {

                                        rows.forEach(
                                            item => {

                                                const orderId =
                                                    String(
                                                        item?.orderId ||
                                                        ""
                                                    );


                                                if (
                                                    window.__robotMaintenanceOrderIdMap[
                                                        orderId
                                                    ]
                                                ) {

                                                    item.orderId =
                                                        window.__robotMaintenanceOrderIdMap[
                                                            orderId
                                                        ];
                                                }
                                            }
                                        );
                                    }


                                    if (
                                        key ===
                                            "maintenanceCosts"
                                    ) {

                                        rows.forEach(
                                            item => {

                                                const orderId =
                                                    String(
                                                        item?.orderId ||
                                                        ""
                                                    );


                                                const costId =
                                                    String(
                                                        item?.costId ||
                                                        ""
                                                    );


                                                if (
                                                    orderId.startsWith(
                                                        "TEST-"
                                                    ) &&
                                                    costId &&
                                                    !costId.startsWith(
                                                        "TEST-"
                                                    )
                                                ) {

                                                    item.costId =
                                                        "TEST-COST-" +
                                                        costId.replace(
                                                            /^COST[_-]?/,
                                                            ""
                                                        );
                                                }
                                            }
                                        );
                                    }


                                    if (
                                        key ===
                                            "maintenanceRequests"
                                    ) {

                                        rows.forEach(
                                            item => {

                                                if (
                                                    !String(
                                                        item?.requestId ||
                                                        item?.maintenanceRequestId ||
                                                        ""
                                                    )
                                                    .startsWith(
                                                        "TEST-"
                                                    )
                                                ) {

                                                    return;
                                                }


                                                const orderId =
                                                    String(
                                                        item?.orderId ||
                                                        ""
                                                    );


                                                if (
                                                    window.__robotMaintenanceOrderIdMap[
                                                        orderId
                                                    ]
                                                ) {

                                                    item.orderId =
                                                        window.__robotMaintenanceOrderIdMap[
                                                            orderId
                                                        ];
                                                }
                                            }
                                        );
                                    }


                                    value =
                                        JSON.stringify(
                                            rows
                                        );
                                }

                            } catch (
                                error
                            ) {

                                console.warn(
                                    "[MaintenanceManagerBot] TEST写入保护解析失败",
                                    error
                                );
                            }
                        }


                        return originalSetItem.call(
                            this,
                            key,
                            value
                        );
                    };


                window.__robotMaintenanceWriteGuardInstalled =
                    true;
            }
        );
    }


    async open() {

        await this.installTestEnvironment();


        await this.page.goto(
            "maintenance.html",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        await this.page.waitForTimeout(
            900
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


    async findLatestWaitingEntryTestRequest() {

        const rows =
            await this.readLocalStorage(
                "maintenanceRequests"
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
                                "waiting_entry"
                            &&
                            String(
                                item.requestId ||
                                item.maintenanceRequestId ||
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
                                b.dispatchApprovedAt ||
                                b.updatedAt ||
                                b.createdAt ||
                                0
                            )
                            -
                            new Date(
                                a.dispatchApprovedAt ||
                                a.updatedAt ||
                                a.createdAt ||
                                0
                            )
                    )
                : [];


        if (
            !candidates.length
        ) {

            throw new Error(
                "MaintenanceManagerBot：没有找到 waiting_entry 的 TEST 维修单"
            );
        }


        const request =
            candidates[0];


        assertTestId(
            request.requestId ||
            request.maintenanceRequestId ||
            "",
            "维修申请"
        );


        assertTestId(
            request.taskId ||
            "",
            "维修申请任务"
        );


        assertTestId(
            request.equipmentId ||
            request.equipmentNumber ||
            "",
            "维修申请设备"
        );


        return request;
    }


    async rejectLatestTestInspectionForRework() {

        const orders =
            await this.readLocalStorage(
                "maintenanceWorkOrders"
            );


        const candidates =
            Array.isArray(
                orders
            )
                ? orders
                    .filter(
                        item =>
                            item &&
                            item.status ===
                                "waiting_inspection"
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
                                b.repairFinishedAt ||
                                0
                            )
                            -
                            new Date(
                                a.repairFinishedAt ||
                                0
                            )
                    )
                : [];


        if (
            !candidates.length
        ) {

            throw new Error(
                "MaintenanceManagerBot：没有找到可退回返修的 waiting_inspection TEST 工单"
            );
        }


        const order =
            candidates[0];


        const orderId =
            String(
                order.orderId
            );


        const requestId =
            String(
                order.requestId
            );


        assertTestId(
            orderId,
            "维修工单"
        );


        assertTestId(
            requestId,
            "维修申请"
        );


        await this.page
            .locator(
                'button[data-page="inspection"]'
            )
            .click();


        await this.page.waitForTimeout(
            150
        );


        const inspectionButton =
            this.page.locator(
                `button[onclick*="openInspection('${orderId}')"]`
            )
            .first();


        await inspectionButton.waitFor({
            state:
                "visible"
        });


        await inspectionButton.click();


        await this.page
            .locator(
                "#inspectionModal"
            )
            .waitFor({
                state:
                    "visible"
            });


        const reason =
            "TEST-验收发现维修结果仍不满足要求，退回重新处理";


        await this.page
            .locator(
                "#inspectionRemark"
            )
            .fill(
                reason
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

            await this.page
                .locator(
                    'button[onclick="rejectInspection()"]'
                )
                .click();


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


        const rejectedOrder =
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
            !rejectedOrder ||
            rejectedOrder.status !==
                "rework"
        ) {

            throw new Error(
                "MaintenanceManagerBot：验收退回后工单未进入 rework" +
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
            String(
                rejectedOrder.reworkReason ||
                ""
            ) !==
                reason
        ) {

            throw new Error(
                "MaintenanceManagerBot：返修原因没有正确写入"
            );
        }


        if (
            !rejectedOrder.reworkAt
        ) {

            throw new Error(
                "MaintenanceManagerBot：返修工单缺少 reworkAt"
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
                            requestId
                )
                : null;


        if (
            !request
        ) {

            throw new Error(
                "MaintenanceManagerBot：返修后找不到关联维修申请"
            );
        }


        /*
         * 当前 maintenance.html 的真实逻辑只把工单改为 rework，
         * 维修申请仍保持 waiting_inspection。
         * 不在测试中擅自改变业务实现，只记录真实状态。
         */
        if (
            request.status !==
                "waiting_inspection"
        ) {

            throw new Error(
                "MaintenanceManagerBot：返修后维修申请状态与当前业务逻辑不一致，实际=" +
                String(
                    request.status ||
                    "-"
                )
            );
        }


        return {
            orderId,
            requestId,

            orderStatus:
                rejectedOrder.status,

            requestStatus:
                request.status,

            reworkReason:
                rejectedOrder.reworkReason,

            reworkAt:
                rejectedOrder.reworkAt
        };
    }


    async inspectAndCompleteLatestTestRepair() {

        const orders =
            await this.readLocalStorage(
                "maintenanceWorkOrders"
            );


        const candidates =
            Array.isArray(
                orders
            )
                ? orders
                    .filter(
                        item =>
                            item &&
                            item.status ===
                                "waiting_inspection"
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
                                b.repairFinishedAt ||
                                0
                            )
                            -
                            new Date(
                                a.repairFinishedAt ||
                                0
                            )
                    )
                : [];


        if (
            !candidates.length
        ) {

            throw new Error(
                "MaintenanceManagerBot：没有找到 waiting_inspection 的 TEST 维修工单"
            );
        }


        const order =
            candidates[0];


        const orderId =
            String(
                order.orderId
            );


        const requestId =
            String(
                order.requestId
            );


        const equipmentId =
            String(
                order.equipmentNumber ||
                order.equipmentId ||
                ""
            );


        const bayId =
            String(
                order.bayId ||
                ""
            );


        assertTestId(
            orderId,
            "维修工单"
        );


        assertTestId(
            requestId,
            "维修申请"
        );


        assertTestId(
            equipmentId,
            "维修设备"
        );


        assertTestId(
            bayId,
            "维修工位"
        );


        const beforeCosts =
            await this.readLocalStorage(
                "maintenanceCosts"
            ) ||
            [];


        const beforeCostCount =
            Array.isArray(
                beforeCosts
            )
                ? beforeCosts.length
                : 0;


        /*
         * maintenance.html 默认停留在维修看板。
         * 待验收按钮位于隐藏的 page-inspection，
         * 必须先切换“待验收”。
         */
        await this.page
            .locator(
                'button[data-page="inspection"]'
            )
            .click();


        await this.page.waitForTimeout(
            150
        );


        const inspectionButton =
            this.page.locator(
                `button[onclick*="openInspection('${orderId}')"]`
            )
            .first();


        await inspectionButton.waitFor({
            state:
                "visible"
        });


        await inspectionButton.click();


        await this.page
            .locator(
                "#inspectionModal"
            )
            .waitFor({
                state:
                    "visible"
            });


        await this.page
            .locator(
                "#inspectionRemark"
            )
            .fill(
                "TEST-维修结果验收合格，允许完成归档并释放设备"
            );


        const approveButton =
            this.page.locator(
                'button[onclick="approveInspection()"]'
            );


        await approveButton.waitFor({
            state:
                "visible"
        });


        await approveButton.click();


        await this.page
            .locator(
                "#costModal"
            )
            .waitFor({
                state:
                    "visible"
            });


        let midOrders =
            await this.readLocalStorage(
                "maintenanceWorkOrders"
            );


        let midOrder =
            Array.isArray(
                midOrders
            )
                ? midOrders.find(
                    item =>
                        String(
                            item.orderId ||
                            ""
                        ) ===
                            orderId
                )
                : null;


        if (
            !midOrder ||
            midOrder.status !==
                "inspection_passed"
        ) {

            throw new Error(
                "MaintenanceManagerBot：验收通过后工单未进入 inspection_passed"
            );
        }


        if (
            !midOrder.inspectedAt
        ) {

            throw new Error(
                "MaintenanceManagerBot：验收通过后缺少 inspectedAt"
            );
        }


        await this.page
            .locator(
                "#laborCost"
            )
            .fill(
                "100"
            );


        await this.page
            .locator(
                "#partsCost"
            )
            .fill(
                "50"
            );


        await this.page
            .locator(
                "#externalCost"
            )
            .fill(
                "0"
            );


        await this.page
            .locator(
                "#otherCost"
            )
            .fill(
                "0"
            );


        await this.page
            .locator(
                "#partsDescription"
            )
            .fill(
                "TEST-轮胎维修材料与人工费用"
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

            await this.page
                .locator(
                    'button[onclick="saveCostSheet()"]'
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


        const afterOrders =
            await this.readLocalStorage(
                "maintenanceWorkOrders"
            );


        const completedOrder =
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
            !completedOrder ||
            completedOrder.status !==
                "completed"
        ) {

            throw new Error(
                "MaintenanceManagerBot：保存费用单后工单未进入 completed"
            );
        }


        if (
            !completedOrder.completedAt
        ) {

            throw new Error(
                "MaintenanceManagerBot：完成维修后缺少 completedAt"
            );
        }


        const requests =
            await this.readLocalStorage(
                "maintenanceRequests"
            );


        const completedRequest =
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
                            requestId
                )
                : null;


        if (
            !completedRequest ||
            completedRequest.status !==
                "completed"
        ) {

            throw new Error(
                "MaintenanceManagerBot：维修申请未同步进入 completed"
            );
        }


        const bays =
            await this.readLocalStorage(
                "workshopBays"
            );


        const bay =
            Array.isArray(
                bays
            )
                ? bays.find(
                    item =>
                        String(
                            item.bayId ||
                            ""
                        ) ===
                            bayId
                )
                : null;


        if (
            !bay ||
            bay.status !==
                "free" ||
            String(
                bay.orderId ||
                ""
            )
        ) {

            throw new Error(
                "MaintenanceManagerBot：验收归档后 TEST 工位没有正确释放"
            );
        }


        const costs =
            await this.readLocalStorage(
                "maintenanceCosts"
            );


        if (
            !Array.isArray(
                costs
            ) ||
            costs.length !==
                beforeCostCount +
                1
        ) {

            throw new Error(
                "MaintenanceManagerBot：完成归档后没有新增1张维修费用单"
            );
        }


        const cost =
            costs[
                costs.length -
                1
            ];


        assertTestId(
            cost.costId ||
            "",
            "维修费用单"
        );


        assertTestId(
            cost.orderId ||
            "",
            "维修费用单关联工单"
        );


        if (
            String(
                cost.orderId ||
                ""
            ) !==
                orderId
        ) {

            throw new Error(
                "MaintenanceManagerBot：维修费用单没有关联正确的 TEST 工单"
            );
        }


        /*
         * saveCostSheet() -> completeOrder() -> renderAll()
         * 会触发 syncEquipmentOperationalStatusFromRepairFlows()。
         * TEST fixture 的 previous/default 状态为 available，
         * 因此完成归档后应恢复 available。
         */
        const operational =
            await this.readLocalStorage(
                "equipmentOperationalStatus"
            );


        const equipmentStatus =
            Array.isArray(
                operational
            )
                ? operational.find(
                    item =>
                        String(
                            item.equipmentId ||
                            ""
                        ) ===
                            equipmentId
                )
                : null;


        if (
            !equipmentStatus ||
            equipmentStatus.status !==
                "available"
        ) {

            throw new Error(
                "MaintenanceManagerBot：维修完成后 TEST 设备没有恢复 available，实际=" +
                String(
                    equipmentStatus?.status ||
                    "-"
                )
            );
        }


        return {
            orderId,
            requestId,
            equipmentId,
            bayId,

            orderStatus:
                completedOrder.status,

            requestStatus:
                completedRequest.status,

            inspectionStatus:
                midOrder.status,

            bayStatus:
                bay.status,

            equipmentStatus:
                equipmentStatus.status,

            costId:
                cost.costId,

            totalCost:
                cost.totalCost,

            inspectedAt:
                midOrder.inspectedAt,

            completedAt:
                completedOrder.completedAt
        };
    }


    async receiveAndAssignLatestTestRequest() {

        const request =
            await this.findLatestWaitingEntryTestRequest();


        const requestId =
            String(
                request.requestId ||
                request.maintenanceRequestId ||
                ""
            );


        const beforeOrders =
            await this.readLocalStorage(
                "maintenanceWorkOrders"
            ) ||
            [];


        const beforeCount =
            Array.isArray(
                beforeOrders
            )
                ? beforeOrders.length
                : 0;


        /*
         * 1. 维修管理接车。
         *
         * maintenance.html 默认打开“维修看板”，
         * 等待进厂按钮虽然已经渲染，但所在 page-waiting 被隐藏。
         * 先切换到“待进厂”页面，再等待按钮可见。
         */
        await this.page
            .locator(
                'button[data-page="waiting"]'
            )
            .click();


        await this.page.waitForTimeout(
            150
        );


        const receiveButton =
            this.page.locator(
                `button[onclick*="receiveVehicle('${requestId}')"]`
            );


        await receiveButton.waitFor({
            state:
                "visible"
        });


        await receiveButton.click();


        await this.page.waitForTimeout(
            300
        );


        let requests =
            await this.readLocalStorage(
                "maintenanceRequests"
            );


        let updatedRequest =
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
                            requestId
                )
                : null;


        if (
            !updatedRequest ||
            updatedRequest.status !==
                "waiting_assignment"
        ) {

            throw new Error(
                "MaintenanceManagerBot：确认进厂后维修单未进入 waiting_assignment"
            );
        }


        if (
            !updatedRequest.receivedAt
        ) {

            throw new Error(
                "MaintenanceManagerBot：确认进厂后缺少 receivedAt"
            );
        }


        /*
         * 2. 打开派工弹窗。
         */
        const assignButton =
            this.page.locator(
                `button[onclick*="openAssignment('${requestId}')"]`
            );


        await assignButton.waitFor({
            state:
                "visible"
        });


        await assignButton.click();


        await this.page
            .locator(
                "#assignmentModal"
            )
            .waitFor({
                state:
                    "visible"
            });


        const baySelect =
            this.page.locator(
                "#assignmentBay"
            );


        const bayOptions =
            await baySelect
                .locator(
                    "option"
                )
                .allTextContents();


        if (
            !bayOptions.some(
                text =>
                    String(
                        text
                    )
                    .includes(
                        "TEST-1号工位"
                    )
            )
        ) {

            throw new Error(
                "MaintenanceManagerBot：派工列表中没有 TEST 工位"
            );
        }


        await baySelect.selectOption(
            "TEST-BAY-01"
        );


        await this.page
            .locator(
                "#assignmentWorker"
            )
            .selectOption(
                "维修工01"
            );


        await this.page
            .locator(
                "#assignmentProject"
            )
            .fill(
                "TEST-检查轮胎异常并完成故障维修"
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

            await this.page
                .locator(
                    'button[onclick="confirmAssignment()"]'
                )
                .click();


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


        if (
            !Array.isArray(
                afterOrders
            ) ||
            afterOrders.length !==
                beforeCount +
                1
        ) {

            throw new Error(
                "MaintenanceManagerBot：派工后没有新增1张维修工单" +
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


        const order =
            afterOrders[
                afterOrders.length -
                1
            ];


        assertTestId(
            order.orderId ||
            "",
            "维修工单"
        );


        assertTestId(
            order.requestId ||
            "",
            "维修工单关联申请"
        );


        assertTestId(
            order.equipmentNumber ||
            order.equipmentId ||
            "",
            "维修工单设备"
        );


        assertTestId(
            order.bayId ||
            "",
            "维修工单工位"
        );


        if (
            order.status !==
                "assigned"
        ) {

            throw new Error(
                "MaintenanceManagerBot：维修工单状态不是 assigned"
            );
        }


        if (
            order.repairProject !==
                "TEST-检查轮胎异常并完成故障维修"
        ) {

            throw new Error(
                "MaintenanceManagerBot：维修项目写入不正确"
            );
        }


        requests =
            await this.readLocalStorage(
                "maintenanceRequests"
            );


        updatedRequest =
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
                            requestId
                )
                : null;


        if (
            !updatedRequest ||
            updatedRequest.status !==
                "assigned"
        ) {

            throw new Error(
                "MaintenanceManagerBot：派工后维修申请未进入 assigned"
            );
        }


        if (
            String(
                updatedRequest.orderId ||
                ""
            ) !==
                String(
                    order.orderId
                )
        ) {

            throw new Error(
                "MaintenanceManagerBot：维修申请没有关联新工单"
            );
        }


        const bays =
            await this.readLocalStorage(
                "workshopBays"
            );


        const bay =
            Array.isArray(
                bays
            )
                ? bays.find(
                    item =>
                        String(
                            item.bayId ||
                            ""
                        ) ===
                            "TEST-BAY-01"
                )
                : null;


        if (
            !bay ||
            bay.status !==
                "busy" ||
            String(
                bay.orderId ||
                ""
            ) !==
                String(
                    order.orderId
                )
        ) {

            throw new Error(
                "MaintenanceManagerBot：TEST 工位没有正确进入 busy 并绑定工单"
            );
        }


        return {
            requestId,

            taskId:
                updatedRequest.taskId,

            equipmentId:
                order.equipmentNumber ||
                order.equipmentId,

            orderId:
                order.orderId,

            requestStatus:
                updatedRequest.status,

            orderStatus:
                order.status,

            bayId:
                order.bayId,

            bayStatus:
                bay.status,

            workerName:
                order.workerName,

            repairProject:
                order.repairProject
        };
    }
}


module.exports = {
    MaintenanceManagerBot
};
