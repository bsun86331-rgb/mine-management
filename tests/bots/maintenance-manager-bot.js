"use strict";

const {
    assertTestId
} = require(
    "../test-safety-guard"
);


/*
=========================================================
R0-1 MaintenanceManagerBot
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
         */
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
        );


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
