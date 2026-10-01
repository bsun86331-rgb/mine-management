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


    async inspectTemporaryUnloadModal() {

        await this.openTemporaryUnloadModal();


        const checks = {

            modal:
                "#temporaryUnloadModal",

            material:
                "#temporaryUnloadMaterial",

            reason:
                "#temporaryUnloadReason",

            remark:
                "#temporaryUnloadRemark",

            gpsPreview:
                "#temporaryUnloadGpsPreview",

            submitButton:
                "#submitTemporaryUnloadButton",

            closeButton:
                "#closeTemporaryUnloadButton"
        };


        const result = {};


        for (
            const [
                name,
                selector
            ]
            of Object.entries(
                checks
            )
        ) {

            const locator =
                this.page.locator(
                    selector
                );


            await locator.waitFor({
                state:
                    "attached"
            });


            const visible =
                await locator.isVisible();


            if (
                !visible
            ) {

                throw new Error(
                    "TruckDriverBot：临时卸料弹窗字段不可见：" +
                    name
                );
            }


            result[
                name
            ] = {
                visible:
                    true,

                text:
                    (
                        await locator.textContent()
                    )?.trim() ||
                    ""
            };
        }


        const materialOptions =
            await this.page
                .locator(
                    "#temporaryUnloadMaterial option"
                )
                .count();


        const reasonOptions =
            await this.page
                .locator(
                    "#temporaryUnloadReason option"
                )
                .count();


        if (
            materialOptions <
                1
        ) {

            throw new Error(
                "TruckDriverBot：物料类型没有可选项"
            );
        }


        if (
            reasonOptions <
                1
        ) {

            throw new Error(
                "TruckDriverBot：临时卸料原因没有可选项"
            );
        }


        const gpsText =
            (
                await this.page
                    .locator(
                        "#temporaryUnloadGpsPreview"
                    )
                    .textContent()
            )?.trim() ||
            "";


        if (
            !gpsText
        ) {

            throw new Error(
                "TruckDriverBot：GPS提示为空"
            );
        }


        result.materialOptions =
            materialOptions;

        result.reasonOptions =
            reasonOptions;

        result.gpsText =
            gpsText;

        result.submitButtonText =
            (
                await this.page
                    .locator(
                        "#submitTemporaryUnloadButton"
                    )
                    .textContent()
            )?.trim() ||
            "";

        result.closeButtonText =
            (
                await this.page
                    .locator(
                        "#closeTemporaryUnloadButton"
                    )
                    .textContent()
            )?.trim() ||
            "";


        /*
         * 本步骤只验证弹窗，不提交任何业务数据。
         * 最后点击关闭，确认关闭逻辑正常。
         */

        await this.page
            .locator(
                "#closeTemporaryUnloadButton"
            )
            .click();


        await this.page
            .locator(
                "#temporaryUnloadModal"
            )
            .waitFor({
                state:
                    "hidden"
            });


        result.closeVerified =
            true;


        return result;
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


    async submitTestTemporaryUnload() {

        const {
            profile,
            task
        } =
            await this.assertSafeContext();


        const driverId =
            profile.driverId ||
            profile.personId ||
            profile.employeeId ||
            profile.id ||
            "";


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
            driverId,
            "司机"
        );


        assertTestId(
            taskId,
            "生产任务"
        );


        assertTestId(
            vehicleId,
            "汽车"
        );


        await this.assertTemporaryUnloadReady();


        /*
         * 使用 Playwright 测试GPS。
         * 只作用于机器人自己的浏览器上下文。
         */

        await this.page
            .context()
            .grantPermissions(
                [
                    "geolocation"
                ]
            );


        await this.page
            .context()
            .setGeolocation({
                latitude:
                    43.85,

                longitude:
                    105.75,

                accuracy:
                    10
            });


        /*
         * 业务页面原本会生成 TEMP-UNLOAD-*。
         * 为坚持“机器人只产生 TEST- 数据”，
         * 在机器人浏览器中仅针对 temporaryUnloadRequests
         * 将 TEST 任务产生的新申请ID改为 TEST- 前缀。
         */

        await this.page.evaluate(
            () => {

                if (
                    window.__robotTestTempUnloadGuardInstalled
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
                                "temporaryUnloadRequests"
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

                                            const taskId =
                                                String(
                                                    item?.taskId ||
                                                    item?.dispatchTaskId ||
                                                    ""
                                                );


                                            if (
                                                taskId.startsWith(
                                                    "TEST-"
                                                ) &&
                                                !String(
                                                    item?.requestId ||
                                                    ""
                                                )
                                                .startsWith(
                                                    "TEST-"
                                                )
                                            ) {

                                                item.requestId =
                                                    "TEST-" +
                                                    String(
                                                        item.requestId ||
                                                        (
                                                            "TEMP-UNLOAD-" +
                                                            Date.now()
                                                        )
                                                    );
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
                                    "[TruckDriverBot] TEST临时卸料申请ID保护失败",
                                    error
                                );
                            }
                        }


                        return originalSetItem(
                            key,
                            value
                        );
                    };


                window.__robotTestTempUnloadGuardInstalled =
                    true;
            }
        );


        const beforeRequests =
            await this.readLocalStorage(
                "temporaryUnloadRequests"
            ) ||
            [];


        const beforeCount =
            Array.isArray(
                beforeRequests
            )
                ? beforeRequests.length
                : 0;


        const beforeTripCount =
            await this.readCurrentTripCount();


        await this.openTemporaryUnloadModal();


        await this.selectTemporaryUnloadOptions({
            material:
                "渣",

            reason:
                "修路垫料",

            remark:
                "TEST-机器人临时卸料测试"
        });


        /*
         * 页面提交成功后会 alert。
         */

        this.page.once(
            "dialog",
            async dialog => {

                await dialog.accept();
            }
        );


        await this.page
            .locator(
                "#submitTemporaryUnloadButton"
            )
            .click();


        await this.page.waitForTimeout(
            800
        );


        const afterRequests =
            await this.readLocalStorage(
                "temporaryUnloadRequests"
            );


        if (
            !Array.isArray(
                afterRequests
            ) ||
            afterRequests.length !==
                beforeCount +
                1
        ) {

            throw new Error(
                "TruckDriverBot：临时卸料申请没有新增1条"
            );
        }


        const row =
            afterRequests[
                afterRequests.length -
                1
            ];


        const requestId =
            String(
                row?.requestId ||
                ""
            );


        assertTestId(
            requestId,
            "临时卸料申请"
        );


        assertTestId(
            row?.taskId ||
            row?.dispatchTaskId ||
            "",
            "临时卸料申请任务"
        );


        assertTestId(
            row?.driverId ||
            row?.personId ||
            "",
            "临时卸料申请司机"
        );


        assertTestId(
            row?.vehicleNumber ||
            row?.vehicleId ||
            "",
            "临时卸料申请车辆"
        );


        if (
            String(
                row?.taskId ||
                row?.dispatchTaskId ||
                ""
            ) !==
                taskId
        ) {

            throw new Error(
                "TruckDriverBot：临时卸料申请任务不匹配"
            );
        }


        if (
            String(
                row?.driverId ||
                row?.personId ||
                ""
            ) !==
                driverId
        ) {

            throw new Error(
                "TruckDriverBot：临时卸料申请司机不匹配"
            );
        }


        if (
            String(
                row?.vehicleNumber ||
                row?.vehicleId ||
                ""
            ) !==
                vehicleId
        ) {

            throw new Error(
                "TruckDriverBot：临时卸料申请车辆不匹配"
            );
        }


        if (
            row?.status !==
                "pending_dispatch"
        ) {

            throw new Error(
                "TruckDriverBot：临时卸料申请未进入 pending_dispatch"
            );
        }


        if (
            row?.officialCountEligible !==
                false
        ) {

            throw new Error(
                "TruckDriverBot：临时卸料申请被错误标记为可直接计正式趟次"
            );
        }


        if (
            row?.materialType !==
                "渣"
        ) {

            throw new Error(
                "TruckDriverBot：物料类型不是“渣”"
            );
        }


        if (
            row?.reason !==
                "修路垫料"
        ) {

            throw new Error(
                "TruckDriverBot：临时卸料原因不是“修路垫料”"
            );
        }


        const afterTripCount =
            await this.readCurrentTripCount();


        if (
            afterTripCount !==
                beforeTripCount
        ) {

            throw new Error(
                "TruckDriverBot：临时卸料提交后正式趟数被立即增加"
            );
        }


        const cycle =
            await this.getTransportCycle();


        if (
            !cycle ||
            cycle.phase !==
                "waiting_loading"
        ) {

            throw new Error(
                "TruckDriverBot：提交后运输闭环没有重置为 waiting_loading"
            );
        }


        return {
            requestId,
            taskId,
            driverId,
            vehicleId,

            status:
                row.status,

            officialCountEligible:
                row.officialCountEligible,

            materialType:
                row.materialType,

            reason:
                row.reason,

            beforeTripCount,
            afterTripCount,

            cyclePhase:
                cycle.phase,

            gps:
                row.temporaryUnloadGps ||
                null
        };
    }


    async installDeterministicTestGeolocation() {

        const installed =
            await this.page.evaluate(
                () =>
                    window.__robotDeterministicGpsInstalled ===
                    true
            );


        if (
            !installed
        ) {

            throw new Error(
                "TruckDriverBot：TEST GPS 模拟层未在页面启动前安装"
            );
        }


        return true;
    }


    async setDeterministicTestGeolocation({
        latitude,
        longitude,
        accuracy = 10
    }) {

        await this.page.evaluate(
            ({
                latitude,
                longitude,
                accuracy
            }) => {

                window.__robotTestGpsState = {
                    latitude:
                        Number(
                            latitude
                        ),

                    longitude:
                        Number(
                            longitude
                        ),

                    accuracy:
                        Number(
                            accuracy
                        )
                };
            },
            {
                latitude,
                longitude,
                accuracy
            }
        );
    }


    async testNormalTransportClosedLoop() {

        const {
            profile,
            task
        } =
            await this.assertSafeContext();


        const driverId =
            profile.driverId ||
            profile.personId ||
            "";


        const taskId =
            task.taskId ||
            task.dispatchTaskId ||
            "";


        const vehicleId =
            task.vehicleNumber ||
            task.vehicleId ||
            "";


        assertTestId(
            driverId,
            "司机"
        );


        assertTestId(
            taskId,
            "生产任务"
        );


        assertTestId(
            vehicleId,
            "汽车"
        );


        const context =
            this.page.context();


        await context.grantPermissions(
            [
                "geolocation"
            ]
        );


        /*
         * Playwright setGeolocation() 在部分 Chromium 环境里，
         * 业务页最终 getCurrentPosition() 可能返回 accuracy=0 / null。
         * 测试环境改用确定性的浏览器 GPS 模拟层，
         * 但业务页面仍然走真实 navigator.geolocation API。
         */
        await this.installDeterministicTestGeolocation();


        /*
         * 正常运输测试必须从 waiting_loading 开始，
         * 不复用临时卸料测试的 enroute_unload 状态。
         */
        await this.page.evaluate(
            ({
                taskId,
                shiftId,
                vehicleId,
                driverId
            }) => {

                localStorage.setItem(
                    "driverTransportCycleState",
                    JSON.stringify({
                        cycleKey:
                            [
                                taskId,
                                shiftId,
                                vehicleId,
                                driverId
                            ].join("|"),

                        phase:
                            "waiting_loading",

                        taskId,
                        shiftId,
                        vehicleNumber:
                            vehicleId,

                        loadingCandidateAt:
                            null,

                        departureCandidateAt:
                            null,

                        loadedAt:
                            null,

                        loadingGps:
                            null,

                        departedLoadingAt:
                            null,

                        arrivedUnloadAt:
                            null,

                        unloadingZoneId:
                            "",

                        unloadingZoneName:
                            "",

                        materialType:
                            "",

                        unloadingGps:
                            null,

                        updatedAt:
                            new Date().toISOString(),

                        robotFixture:
                            true
                    })
                );
            },
            {
                taskId,
                shiftId:
                    task.shiftId ||
                    "TEST-SHIFT-001",
                vehicleId,
                driverId
            }
        );


        /*
         * 保护正常趟次ID：
         * 正式页面默认生成 TRIP_*，
         * 机器人测试统一改为 TEST-TRIP-*。
         */
        await this.page.evaluate(
            () => {

                if (
                    window.__robotTestNormalTripGuardInstalled
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
                                "driverTripRecords"
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

                                            const taskId =
                                                String(
                                                    item?.taskId ||
                                                    item?.dispatchTaskId ||
                                                    ""
                                                );


                                            if (
                                                taskId.startsWith(
                                                    "TEST-"
                                                )
                                            ) {

                                                const id =
                                                    String(
                                                        item?.tripId ||
                                                        item?.id ||
                                                        ""
                                                    );


                                                if (
                                                    !id.startsWith(
                                                        "TEST-"
                                                    )
                                                ) {

                                                    const testId =
                                                        "TEST-TRIP-" +
                                                        (
                                                            id ||
                                                            Date.now()
                                                        )
                                                        .replace(
                                                            /^TRIP[_-]?/,
                                                            ""
                                                        );


                                                    item.tripId =
                                                        testId;

                                                    item.id =
                                                        testId;

                                                    item.recordId =
                                                        testId;
                                                }
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
                                    "[TruckDriverBot] TEST正常趟次ID保护失败",
                                    error
                                );
                            }
                        }


                        return originalSetItem(
                            key,
                            value
                        );
                    };


                window.__robotTestNormalTripGuardInstalled =
                    true;
            }
        );


        const beforeRecords =
            await this.readLocalStorage(
                "driverTripRecords"
            ) ||
            [];


        const beforeRecordCount =
            Array.isArray(
                beforeRecords
            )
                ? beforeRecords.length
                : 0;


        const beforeUiCount =
            await this.readCurrentTripCount();


        const refreshGps =
            async () => {

                const button =
                    this.page.locator(
                        "#startGpsButton"
                    );


                await button.click();


                await this.page.waitForTimeout(
                    500
                );
            };


        /*
         * 阶段1：进入装载区并稳定至少4秒。
         */
        await context.setGeolocation({
            latitude:
                43.850000,

            longitude:
                105.750000,

            accuracy:
                10
        });


        await this.setDeterministicTestGeolocation({
            latitude:
                43.850000,

            longitude:
                105.750000,

            accuracy:
                10
        });


        await refreshGps();


        await this.page.waitForTimeout(
            4300
        );


        await refreshGps();


        let cycle =
            await this.getTransportCycle();


        if (
            cycle?.phase !==
                "loaded_wait_departure"
        ) {

            throw new Error(
                "TruckDriverBot：进入装载区后未自动确认装车，phase=" +
                String(
                    cycle?.phase ||
                    "-"
                )
            );
        }


        /*
         * 阶段2：驶离装载区并稳定至少4秒。
         * 使用中间测试坐标，既不在装载区，也不在卸载区。
         */
        await context.setGeolocation({
            latitude:
                43.855000,

            longitude:
                105.755000,

            accuracy:
                10
        });


        await this.setDeterministicTestGeolocation({
            latitude:
                43.855000,

            longitude:
                105.755000,

            accuracy:
                10
        });


        await refreshGps();


        await this.page.waitForTimeout(
            4300
        );


        await refreshGps();


        cycle =
            await this.getTransportCycle();


        if (
            cycle?.phase !==
                "enroute_unload"
        ) {

            throw new Error(
                "TruckDriverBot：驶离装载区后未进入运输中，phase=" +
                String(
                    cycle?.phase ||
                    "-"
                )
            );
        }


        /*
         * 阶段3：进入允许卸载区。
         */
        await context.setGeolocation({
            latitude:
                43.860000,

            longitude:
                105.760000,

            accuracy:
                10
        });


        await this.setDeterministicTestGeolocation({
            latitude:
                43.860000,

            longitude:
                105.760000,

            accuracy:
                10
        });


        await refreshGps();


        await this.page.waitForTimeout(
            700
        );


        cycle =
            await this.getTransportCycle();


        if (
            cycle?.phase !==
                "at_unloading"
        ) {

            throw new Error(
                "TruckDriverBot：进入卸载区后未进入 at_unloading，phase=" +
                String(
                    cycle?.phase ||
                    "-"
                )
            );
        }


        if (
            String(
                cycle?.unloadingZoneId ||
                ""
            ) !==
                "TEST-UNLOAD-WASTE"
        ) {

            throw new Error(
                "TruckDriverBot：识别到的卸载区不是 TEST-UNLOAD-WASTE"
            );
        }


        const tripButton =
            this.page.locator(
                "#addTripButton"
            );


        await tripButton.waitFor({
            state:
                "visible"
        });


        if (
            !await tripButton.isEnabled()
        ) {

            throw new Error(
                "TruckDriverBot：到达TEST卸载区后“完成一趟”按钮仍不可点击"
            );
        }


        const dialogHandler =
            async dialog => {

                await dialog.accept();
            };


        this.page.on(
            "dialog",
            dialogHandler
        );


        const dialogMessages =
            [];


        const captureDialog =
            async dialog => {

                dialogMessages.push(
                    dialog.message()
                );


                await dialog.accept();
            };


        this.page.off(
            "dialog",
            dialogHandler
        );


        this.page.on(
            "dialog",
            captureDialog
        );


        /*
         * 最终点击前先直接探测一次页面 geolocation，
         * 确认坐标与精度确实来自 TEST GPS 模拟层。
         */
        const gpsProbe =
            await this.page.evaluate(
                () =>
                    new Promise(
                        resolve => {

                            navigator.geolocation.getCurrentPosition(
                                position => {

                                    resolve({
                                        latitude:
                                            position?.coords?.latitude,

                                        longitude:
                                            position?.coords?.longitude,

                                        accuracy:
                                            position?.coords?.accuracy,

                                        installed:
                                            window.__robotDeterministicGpsInstalled ===
                                            true
                                    });
                                },

                                error => {

                                    resolve({
                                        error:
                                            error?.message ||
                                            "geolocation error",

                                        installed:
                                            window.__robotDeterministicGpsInstalled ===
                                            true
                                    });
                                },

                                {
                                    enableHighAccuracy:
                                        true,

                                    timeout:
                                        2000,

                                    maximumAge:
                                        0
                                }
                            );
                        }
                    )
            );


        if (
            gpsProbe?.installed !==
                true ||
            !Number.isFinite(
                Number(
                    gpsProbe?.latitude
                )
            ) ||
            !Number.isFinite(
                Number(
                    gpsProbe?.longitude
                )
            ) ||
            !Number.isFinite(
                Number(
                    gpsProbe?.accuracy
                )
            ) ||
            Number(
                gpsProbe?.accuracy
            ) <=
                0 ||
            Number(
                gpsProbe?.accuracy
            ) >
                100
        ) {

            throw new Error(
                "TruckDriverBot：最终点击前TEST GPS探测失败：" +
                JSON.stringify(
                    gpsProbe
                )
            );
        }


        try {

            await tripButton.click();


            /*
             * completeTrip() 内部会重新调用浏览器实时定位。
             * Playwright 的 click() 返回时，异步 getCurrentPosition()
             * 可能仍未完成，所以不能只固定等待 900ms。
             *
             * 改为最多等待 15 秒，直到司机端真正写入新增趟次。
             */
            await this.page.waitForFunction(
                expectedCount => {

                    try {

                        const rows =
                            JSON.parse(
                                localStorage.getItem(
                                    "driverTripRecords"
                                ) ||
                                "[]"
                            );


                        return (
                            Array.isArray(
                                rows
                            ) &&
                            rows.length ===
                                expectedCount
                        );

                    } catch (
                        error
                    ) {

                        return false;
                    }
                },
                beforeRecordCount +
                    1,
                {
                    timeout:
                        15000
                }
            )
            .catch(
                () => {}
            );

        } finally {

            this.page.off(
                "dialog",
                captureDialog
            );
        }


        const afterRecords =
            await this.readLocalStorage(
                "driverTripRecords"
            );


        if (
            !Array.isArray(
                afterRecords
            ) ||
            afterRecords.length !==
                beforeRecordCount +
                1
        ) {

            const cycleAfterFailure =
                await this.getTransportCycle();


            throw new Error(
                "TruckDriverBot：正常运输完成后没有恰好新增1条趟次记录" +
                "；phase=" +
                String(
                    cycleAfterFailure?.phase ||
                    "-"
                ) +
                (
                    dialogMessages.length
                        ? "；页面提示=" +
                          dialogMessages.join(
                              " | "
                          )
                        : ""
                )
            );
        }


        const record =
            afterRecords[
                afterRecords.length -
                1
            ];


        const tripId =
            String(
                record?.tripId ||
                record?.id ||
                ""
            );


        assertTestId(
            tripId,
            "正常运输趟次"
        );


        assertTestId(
            record?.taskId ||
            record?.dispatchTaskId ||
            "",
            "正常运输任务"
        );


        assertTestId(
            record?.driverId ||
            record?.personId ||
            "",
            "正常运输司机"
        );


        assertTestId(
            record?.vehicleNumber ||
            record?.vehicleId ||
            "",
            "正常运输车辆"
        );


        if (
            record?.materialType !==
                "渣"
        ) {

            throw new Error(
                "TruckDriverBot：正常运输物料类型不是“渣”"
            );
        }


        if (
            record?.manualOverride !==
                false
        ) {

            throw new Error(
                "TruckDriverBot：正常运输被错误标记为 manualOverride"
            );
        }


        if (
            record?.officialCountEligible !==
                true
        ) {

            throw new Error(
                "TruckDriverBot：正常运输没有直接进入正式统计"
            );
        }


        if (
            record?.transportValidation !==
                "gps_geofence_closed_loop"
        ) {

            throw new Error(
                "TruckDriverBot：正常运输缺少 gps_geofence_closed_loop 验证标记"
            );
        }


        const afterUiCount =
            await this.readCurrentTripCount();


        if (
            afterUiCount !==
                beforeUiCount +
                1
        ) {

            throw new Error(
                "TruckDriverBot：本班趟数没有增加1"
            );
        }


        cycle =
            await this.getTransportCycle();


        if (
            cycle?.phase !==
                "waiting_loading"
        ) {

            throw new Error(
                "TruckDriverBot：完成一趟后运输闭环没有重置为 waiting_loading"
            );
        }


        return {
            tripId,

            taskId:
                record.taskId ||
                record.dispatchTaskId,

            driverId:
                record.driverId ||
                record.personId,

            vehicleId:
                record.vehicleNumber ||
                record.vehicleId,

            materialType:
                record.materialType,

            beforeUiCount,
            afterUiCount,

            beforeRecordCount,
            afterRecordCount:
                afterRecords.length,

            transportValidation:
                record.transportValidation,

            cyclePhase:
                cycle.phase
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
