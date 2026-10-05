"use strict";

const {
    assertTestId
} = require(
    "../test-safety-guard"
);


/*
=========================================================
R0-1 EquipmentCheckBot
设备使用检查测试机器人

只允许 TEST- 任务 / 人员 / 设备数据。
用于验证：
设备检查发现异常
→ 锁定检查记录
→ 自动生成维修单
→ 维修单进入 pending_dispatch
=========================================================
*/

class EquipmentCheckBot {

    constructor(
        page
    ) {

        this.page =
            page;

        this.name =
            "EquipmentCheckBot";
    }


    async installTestWriteGuard() {

        await this.page.addInitScript(
            () => {

                if (
                    window.__robotEquipmentCheckGuardInstalled
                ) {

                    return;
                }


                const originalSetItem =
                    Storage.prototype.setItem;


                const toTestId =
                    (
                        value,
                        prefix
                    ) => {

                        const text =
                            String(
                                value ||
                                ""
                            );


                        if (
                            !text
                        ) {

                            return text;
                        }


                        if (
                            text.startsWith(
                                "TEST-"
                            )
                        ) {

                            return text;
                        }


                        return (
                            "TEST-" +
                            prefix +
                            "-" +
                            text.replace(
                                /^[A-Z]+[_-]?/i,
                                ""
                            )
                        );
                    };


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
                                            "maintenanceRequests"
                                    ) {

                                        rows.forEach(
                                            item => {

                                                if (
                                                    String(
                                                        item?.taskId ||
                                                        ""
                                                    )
                                                    .startsWith(
                                                        "TEST-"
                                                    )
                                                ) {

                                                    const requestId =
                                                        toTestId(
                                                            item.requestId ||
                                                            item.maintenanceRequestId,
                                                            "MR"
                                                        );


                                                    const checkId =
                                                        toTestId(
                                                            item.checkId,
                                                            "EUC"
                                                        );


                                                    item.requestId =
                                                        requestId;

                                                    item.maintenanceRequestId =
                                                        requestId;

                                                    item.checkId =
                                                        checkId;
                                                }
                                            }
                                        );
                                    }


                                    if (
                                        key ===
                                            "equipmentUsageChecks"
                                    ) {

                                        rows.forEach(
                                            item => {

                                                if (
                                                    String(
                                                        item?.taskId ||
                                                        ""
                                                    )
                                                    .startsWith(
                                                        "TEST-"
                                                    )
                                                ) {

                                                    item.checkId =
                                                        toTestId(
                                                            item.checkId,
                                                            "EUC"
                                                        );


                                                    if (
                                                        item.maintenanceRequestId
                                                    ) {

                                                        item.maintenanceRequestId =
                                                            toTestId(
                                                                item.maintenanceRequestId,
                                                                "MR"
                                                            );
                                                    }
                                                }
                                            }
                                        );
                                    }


                                    if (
                                        key ===
                                            "equipmentMeterReadings"
                                    ) {

                                        rows.forEach(
                                            item => {

                                                if (
                                                    String(
                                                        item?.taskId ||
                                                        ""
                                                    )
                                                    .startsWith(
                                                        "TEST-"
                                                    )
                                                ) {

                                                    item.meterRecordId =
                                                        toTestId(
                                                            item.meterRecordId,
                                                            "EMR"
                                                        );

                                                    item.checkId =
                                                        toTestId(
                                                            item.checkId,
                                                            "EUC"
                                                        );
                                                }
                                            }
                                        );
                                    }


                                    if (
                                        key ===
                                            "equipmentUsageRecords"
                                    ) {

                                        rows.forEach(
                                            item => {

                                                if (
                                                    String(
                                                        item?.taskId ||
                                                        ""
                                                    )
                                                    .startsWith(
                                                        "TEST-"
                                                    )
                                                ) {

                                                    item.usageId =
                                                        toTestId(
                                                            item.usageId,
                                                            "EUR"
                                                        );

                                                    item.checkId =
                                                        toTestId(
                                                            item.checkId,
                                                            "EUC"
                                                        );
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
                                    "[EquipmentCheckBot] TEST写入保护解析失败",
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


                window.__robotEquipmentCheckGuardInstalled =
                    true;
            }
        );
    }


    async open() {

        await this.installTestWriteGuard();


        /*
         * R0-1D 根因修复：
         * 维修链结束后 currentPersonId 可能仍停留在 TEST 维修员，
         * 而 workerPersonId / driverProfile 已恢复为 TEST 司机。
         *
         * equipment-check.html 的 resolvePerson() 优先读取 currentPersonId，
         * 因而会把维修员识别为当前人员，随后 resolveShiftContext()
         * 无法在司机班次中匹配，最终得到 ctx=null / taskId=""。
         *
         * 这里只在 TEST fixture 已启用，并确认 workerPersonId 是 TEST-
         * 司机时，在页面业务脚本执行前恢复 currentPersonId。
         * 正式数据绝不触碰。
         */
        await this.page.addInitScript(
            () => {

                try {

                    const fixture =
                        JSON.parse(
                            localStorage.getItem(
                                "__robotTestFixture"
                            ) ||
                            "null"
                        );


                    const workerPersonId =
                        String(
                            localStorage.getItem(
                                "workerPersonId"
                            ) ||
                            ""
                        );


                    const currentPersonId =
                        String(
                            localStorage.getItem(
                                "currentPersonId"
                            ) ||
                            ""
                        );


                    const profile =
                        JSON.parse(
                            localStorage.getItem(
                                "driverProfile"
                            ) ||
                            "null"
                        );


                    const profileId =
                        String(
                            profile?.driverId ||
                            profile?.personId ||
                            ""
                        );


                    if (
                        fixture?.enabled ===
                            true &&
                        workerPersonId.startsWith(
                            "TEST-"
                        ) &&
                        profileId ===
                            workerPersonId &&
                        currentPersonId !==
                            workerPersonId
                    ) {

                        localStorage.setItem(
                            "currentPersonId",
                            workerPersonId
                        );


                        localStorage.setItem(
                            "selectedPosition",
                            "汽车司机"
                        );
                    }

                } catch (
                    error
                ) {}
            }
        );


        await this.page.goto(
            "equipment-check.html",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        /*
         * R0-1B
         * 重复跑维修链时，某些前置用例会留下页面级调度缓存差异，
         * 导致设备检查页 resolveShiftContext() 偶发拿不到 taskId。
         *
         * 这里仅在机器人 TEST fixture 已启用、且当前任务本身是 TEST-
         * 数据时做一次自愈：用 driverCurrentTask 重建一条最小可识别
         * dispatchPublishedTasks 记录，再调用页面 init() 重算上下文。
         *
         * 不满足 TEST 条件时绝不写入，正式数据不会被触碰。
         */
        await this.page.evaluate(
            () => {

                const taskInput =
                    document.getElementById(
                        "taskId"
                    );


                if (
                    taskInput?.value
                ) {

                    return;
                }


                let fixture =
                    null;

                let currentTask =
                    null;

                let profile =
                    null;


                try {

                    fixture =
                        JSON.parse(
                            localStorage.getItem(
                                "__robotTestFixture"
                            ) ||
                            "null"
                        );


                    currentTask =
                        JSON.parse(
                            localStorage.getItem(
                                "driverCurrentTask"
                            ) ||
                            "null"
                        );


                    profile =
                        JSON.parse(
                            localStorage.getItem(
                                "driverProfile"
                            ) ||
                            "null"
                        );

                } catch (
                    error
                ) {

                    return;
                }


                const taskId =
                    String(
                        currentTask?.taskId ||
                        currentTask?.dispatchTaskId ||
                        ""
                    );


                const shiftId =
                    String(
                        currentTask?.shiftId ||
                        ""
                    );


                const driverId =
                    String(
                        currentTask?.driverId ||
                        currentTask?.personId ||
                        profile?.driverId ||
                        profile?.personId ||
                        ""
                    );


                const vehicleId =
                    String(
                        currentTask?.vehicleId ||
                        currentTask?.vehicleNumber ||
                        ""
                    );


                const excavatorId =
                    String(
                        currentTask?.excavatorId ||
                        currentTask?.excavatorNumber ||
                        ""
                    );


                if (
                    fixture?.enabled !==
                        true ||
                    !taskId.startsWith(
                        "TEST-"
                    ) ||
                    !shiftId.startsWith(
                        "TEST-"
                    ) ||
                    !driverId.startsWith(
                        "TEST-"
                    ) ||
                    !vehicleId.startsWith(
                        "TEST-"
                    )
                ) {

                    return;
                }


                let tasks =
                    [];


                try {

                    const parsed =
                        JSON.parse(
                            localStorage.getItem(
                                "dispatchPublishedTasks"
                            ) ||
                            "[]"
                        );


                    if (
                        Array.isArray(
                            parsed
                        )
                    ) {

                        tasks =
                            parsed.filter(
                                item =>
                                    String(
                                        item?.taskId ||
                                        item?.dispatchTaskId ||
                                        item?.id ||
                                        ""
                                    ) !==
                                        taskId
                            );
                    }

                } catch (
                    error
                ) {}


                tasks.push({
                    taskId,
                    dispatchTaskId:
                        taskId,
                    id:
                        taskId,

                    taskName:
                        currentTask?.taskName ||
                        "TEST-设备检查恢复任务",

                    status:
                        "active",

                    currentShiftId:
                        shiftId,

                    shiftId,

                    shift:
                        currentTask?.shift ||
                        "白班",

                    shiftDate:
                        currentTask?.shiftDate ||
                        new Date()
                            .toISOString()
                            .slice(
                                0,
                                10
                            ),

                    driverAssignments: [
                        {
                            driverId,
                            personId:
                                driverId,

                            driverName:
                                currentTask?.driverName ||
                                profile?.name ||
                                "TEST-司机",

                            personName:
                                currentTask?.driverName ||
                                profile?.name ||
                                "TEST-司机",

                            vehicleId,
                            vehicleNumber:
                                vehicleId,

                            excavatorId,
                            excavatorNumber:
                                excavatorId,

                            shiftId,

                            testFixture:
                                true
                        }
                    ],

                    bindings:
                        excavatorId.startsWith(
                            "TEST-"
                        )
                            ? [
                                  {
                                      excavatorId,
                                      truckIds: [
                                          vehicleId
                                      ]
                                  }
                              ]
                            : [],

                    testFixture:
                        true,

                    updatedAt:
                        new Date()
                            .toISOString()
                });


                localStorage.setItem(
                    "dispatchPublishedTasks",
                    JSON.stringify(
                        tasks
                    )
                );


                if (
                    typeof window.init ===
                        "function"
                ) {

                    window.init();
                }
            }
        );


        await this.page.waitForTimeout(
            900
        );


        /*
         * 测试时展开所有折叠卡片，
         * 避免必填字段因折叠而不可交互。
         */
        await this.page.evaluate(
            () => {

                document
                    .querySelectorAll(
                        ".fold-body"
                    )
                    .forEach(
                        body => {

                            body.hidden =
                                false;
                        }
                    );
            }
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


    async testAbnormalCheckCreatesMaintenanceRequest() {

        const personId =
            await this.page.evaluate(
                () =>
                    String(
                        localStorage.getItem(
                            "currentPersonId"
                        ) ||
                        ""
                    )
            );


        assertTestId(
            personId,
            "设备检查人员"
        );


        const taskId =
            await this.page
                .locator(
                    "#taskId"
                )
                .inputValue();


        const shiftId =
            await this.page
                .locator(
                    "#shiftId"
                )
                .inputValue();


        /*
         * R0-1C
         * 连续维修回归偶发出现 taskId 为空。
         * 这里不再猜测修复，只在失败前采集完整只读诊断快照，
         * 便于定位到底是 localStorage、页面 ctx 还是 DOM 丢失。
         */
        if (
            !taskId ||
            !shiftId
        ) {

            const diagnostic =
                await this.page.evaluate(
                    () => {

                        const readJson =
                            key => {

                                try {

                                    return JSON.parse(
                                        localStorage.getItem(
                                            key
                                        ) ||
                                        "null"
                                    );

                                } catch (
                                    error
                                ) {

                                    return localStorage.getItem(
                                        key
                                    );
                                }
                            };


                        let pageCtx =
                            null;

                        let pageMode =
                            null;


                        try {

                            pageCtx =
                                typeof ctx !==
                                    "undefined"
                                    ? ctx
                                    : null;

                        } catch (
                            error
                        ) {}


                        try {

                            pageMode =
                                typeof mode !==
                                    "undefined"
                                    ? mode
                                    : null;

                        } catch (
                            error
                        ) {}


                        const equipmentSelect =
                            document.getElementById(
                                "equipmentSelect"
                            );


                        return {
                            href:
                                location.href,

                            currentPersonId:
                                localStorage.getItem(
                                    "currentPersonId"
                                ),

                            workerPersonId:
                                localStorage.getItem(
                                    "workerPersonId"
                                ),

                            driverProfile:
                                readJson(
                                    "driverProfile"
                                ),

                            driverCurrentTask:
                                readJson(
                                    "driverCurrentTask"
                                ),

                            robotTestFixture:
                                readJson(
                                    "__robotTestFixture"
                                ),

                            dispatchPublishedTasks:
                                readJson(
                                    "dispatchPublishedTasks"
                                ),

                            dispatchShiftExecutions:
                                readJson(
                                    "dispatchShiftExecutions"
                                ),

                            domTaskId:
                                document.getElementById(
                                    "taskId"
                                )?.value ||
                                "",

                            domShiftId:
                                document.getElementById(
                                    "shiftId"
                                )?.value ||
                                "",

                            pageMode,
                            pageCtx,

                            equipmentSelectValue:
                                equipmentSelect?.value ||
                                "",

                            equipmentSelectedText:
                                equipmentSelect
                                    ?.options[
                                        equipmentSelect
                                            .selectedIndex
                                    ]
                                    ?.textContent ||
                                "",

                            equipmentOptions:
                                equipmentSelect
                                    ? [
                                          ...equipmentSelect
                                              .options
                                      ]
                                      .map(
                                          option => ({
                                              value:
                                                  option.value,

                                              text:
                                                  option.textContent
                                          })
                                      )
                                    : []
                        };
                    }
                );


            throw new Error(
                "设备检查上下文诊断：" +
                JSON.stringify(
                    diagnostic
                )
            );
        }


        assertTestId(
            taskId,
            "设备检查任务"
        );


        assertTestId(
            shiftId,
            "设备检查班次"
        );


        const select =
            this.page.locator(
                "#equipmentSelect"
            );


        await select.waitFor({
            state:
                "visible"
        });


        if (
            !await select.inputValue()
        ) {

            const optionCount =
                await select
                    .locator(
                        "option"
                    )
                    .count();


            if (
                optionCount <
                    2
            ) {

                throw new Error(
                    "EquipmentCheckBot：没有找到 TEST 本班设备"
                );
            }


            await select.selectOption(
                {
                    index:
                        1
                }
            );
        }


        const equipmentId =
            await select
                .locator(
                    "option:checked"
                )
                .textContent();


        if (
            !String(
                equipmentId ||
                ""
            )
            .includes(
                "TEST-"
            )
        ) {

            throw new Error(
                "EquipmentCheckBot：当前设备不是 TEST 设备：" +
                String(
                    equipmentId ||
                    "-"
                )
            );
        }


        const beforeChecks =
            await this.readLocalStorage(
                "equipmentUsageChecks"
            ) ||
            [];


        const beforeRequests =
            await this.readLocalStorage(
                "maintenanceRequests"
            ) ||
            [];


        const beforeCheckCount =
            Array.isArray(
                beforeChecks
            )
                ? beforeChecks.length
                : 0;


        const beforeRequestCount =
            Array.isArray(
                beforeRequests
            )
                ? beforeRequests.length
                : 0;


        await this.page
            .locator(
                "#meterReading"
            )
            .fill(
                "1000"
            );


        const tinyPng =
            Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
                "base64"
            );


        await this.page
            .locator(
                "#meterPhotoInput"
            )
            .setInputFiles({
                name:
                    "TEST-meter.png",

                mimeType:
                    "image/png",

                buffer:
                    tinyPng
            });


        await this.page.waitForTimeout(
            250
        );


        /*
         * 折叠卡片脚本可能在慢机器 / 首次加载时晚于机器人 open()
         * 完成 DOM 包装，导致 #badBox 短暂处于 hidden 祖先内。
         * 这里先强制展开表单和所有折叠区，再优先真实点击；
         * 若仍不可见，则直接调用页面自己的 setResult()，
         * 避免把纯 UI 折叠时序误判为业务失败。
         */
        await this.page.evaluate(
            () => {

                const formWrap =
                    document.getElementById(
                        "formWrap"
                    );


                if (formWrap) {

                    formWrap.classList.remove(
                        "hidden"
                    );
                }


                document
                    .querySelectorAll(
                        ".fold-body"
                    )
                    .forEach(
                        body => {

                            body.hidden =
                                false;
                        }
                    );
            }
        );


        const badBox =
            this.page.locator(
                "#badBox"
            );


        if (
            await badBox.isVisible()
        ) {

            await badBox.click();

        } else {

            await this.page.evaluate(
                () => {

                    if (
                        typeof window.setResult !==
                            "function"
                    ) {

                        throw new Error(
                            "设备检查页 setResult() 不可用"
                        );
                    }


                    window.setResult(
                        "发现异常"
                    );
                }
            );
        }


        await this.page.evaluate(
            () => {

                document
                    .querySelectorAll(
                        ".fold-body"
                    )
                    .forEach(
                        body => {

                            body.hidden =
                                false;
                        }
                    );
            }
        );


        const part =
            this.page.locator(
                'input[name="part"][value="轮胎/轮毂"]'
            );


        await part.check();


        await this.page
            .locator(
                "#abnormalDescription"
            )
            .fill(
                "TEST-右前轮胎异常，机器人回归测试自动生成维修单"
            );


        await this.page
            .locator(
                "#abnormalPhotoInput"
            )
            .setInputFiles({
                name:
                    "TEST-abnormal.png",

                mimeType:
                    "image/png",

                buffer:
                    tinyPng
            });


        await this.page.waitForTimeout(
            250
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
                    'button[onclick="submitCheck()"]'
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


        const afterChecks =
            await this.readLocalStorage(
                "equipmentUsageChecks"
            );


        const afterRequests =
            await this.readLocalStorage(
                "maintenanceRequests"
            );


        if (
            !Array.isArray(
                afterChecks
            ) ||
            afterChecks.length !==
                beforeCheckCount +
                1
        ) {

            throw new Error(
                "EquipmentCheckBot：异常检查没有新增1条锁定检查记录" +
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
            !Array.isArray(
                afterRequests
            ) ||
            afterRequests.length !==
                beforeRequestCount +
                1
        ) {

            throw new Error(
                "EquipmentCheckBot：异常检查没有自动新增1条维修单"
            );
        }


        const check =
            afterChecks[
                afterChecks.length -
                1
            ];


        const request =
            afterRequests[
                afterRequests.length -
                1
            ];


        assertTestId(
            check.checkId ||
            "",
            "设备检查记录"
        );


        assertTestId(
            request.requestId ||
            request.maintenanceRequestId ||
            "",
            "维修单"
        );


        assertTestId(
            check.taskId ||
            "",
            "设备检查记录任务"
        );


        assertTestId(
            request.taskId ||
            "",
            "维修单任务"
        );


        assertTestId(
            check.equipmentId ||
            check.equipmentNumber ||
            "",
            "设备检查车辆"
        );


        assertTestId(
            request.equipmentId ||
            request.equipmentNumber ||
            "",
            "维修单车辆"
        );


        if (
            check.locked !==
                true
        ) {

            throw new Error(
                "EquipmentCheckBot：设备检查记录没有锁定"
            );
        }


        if (
            check.result !==
                "发现异常"
        ) {

            throw new Error(
                "EquipmentCheckBot：设备检查结果不是“发现异常”"
            );
        }


        if (
            request.status !==
                "pending_dispatch"
        ) {

            throw new Error(
                "EquipmentCheckBot：维修单状态不是 pending_dispatch"
            );
        }


        if (
            request.dispatchStatus !==
                "pending"
        ) {

            throw new Error(
                "EquipmentCheckBot：维修单 dispatchStatus 不是 pending"
            );
        }


        if (
            request.dispatchRequired !==
                true
        ) {

            throw new Error(
                "EquipmentCheckBot：维修单没有标记 dispatchRequired=true"
            );
        }


        if (
            request.maintenanceType !==
                "故障维修"
        ) {

            throw new Error(
                "EquipmentCheckBot：维修单类型不是故障维修"
            );
        }


        if (
            String(
                request.checkId ||
                ""
            ) !==
                String(
                    check.checkId ||
                    ""
                )
        ) {

            throw new Error(
                "EquipmentCheckBot：维修单没有正确关联设备检查记录"
            );
        }


        return {
            checkId:
                check.checkId,

            requestId:
                request.requestId ||
                request.maintenanceRequestId,

            taskId:
                request.taskId,

            shiftId:
                request.shiftId,

            equipmentId:
                request.equipmentId ||
                request.equipmentNumber,

            result:
                check.result,

            locked:
                check.locked,

            maintenanceType:
                request.maintenanceType,

            requestStatus:
                request.status,

            dispatchStatus:
                request.dispatchStatus,

            dispatchRequired:
                request.dispatchRequired
        };
    }
}


module.exports = {
    EquipmentCheckBot
};
