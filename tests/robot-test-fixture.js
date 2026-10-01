"use strict";

/*
=========================================================
R0-4C RobotTestFixture
机器人专用 TEST 测试环境

本版修复：
- 保留 page.addInitScript() 导航前注入
- 新增 dispatchPublishedTasks TEST 主任务
- driver-work.js 重新核验任务时可以找到 TEST-TASK-001
- 清理时只删除 TEST-TASK-001，不碰其他任务

最高规则：
1. 只生成 TEST- 数据
2. 不读取正式司机身份
3. 不覆盖正式数据
4. 只写入机器人自己的 Playwright 浏览器 localStorage
=========================================================
*/

const TEST_DATA = {
    driverId:
        "TEST-D-001",

    driverName:
        "测试司机",

    employeeNo:
        "TEST-0001",

    vehicleId:
        "TEST-T-001",

    excavatorId:
        "TEST-W-001",

    taskId:
        "TEST-TASK-001",

    shiftId:
        "TEST-SHIFT-001",

    loadingZoneId:
        "TEST-LOAD-001",

    coalZoneId:
        "TEST-UNLOAD-COAL",

    wasteZoneId:
        "TEST-UNLOAD-WASTE",

    countZoneId:
        "TEST-UNLOAD-COUNT"
};


function assertTestValue(
    value,
    label
) {

    const text =
        String(
            value ||
            ""
        );


    if (
        !text.startsWith(
            "TEST-"
        )
    ) {

        throw new Error(
            `安全拦截：${label} 不是 TEST 数据：${text}`
        );
    }


    return text;
}


function validateTestData() {

    Object.entries(
        TEST_DATA
    )
    .forEach(
        (
            [
                key,
                value
            ]
        ) => {

            if (
                key ===
                    "driverName"
            ) {

                return;
            }


            assertTestValue(
                value,
                key
            );
        }
    );


    return true;
}


function buildFixturePayload() {

    const now =
        new Date();


    const loadedAt =
        new Date(
            now.getTime() -
            12 *
            60 *
            1000
        )
        .toISOString();


    const departedAt =
        new Date(
            now.getTime() -
            8 *
            60 *
            1000
        )
        .toISOString();


    return {
        TEST_DATA,
        nowIso:
            now.toISOString(),

        loadedAt,
        departedAt
    };
}


async function initializeTruckDriverTestEnvironment(
    page
) {

    validateTestData();


    const payload =
        buildFixturePayload();


    /*
     * 核心修复：
     * 先注册 init script，再导航。
     *
     * 这样 TEST localStorage 会在页面自己的 JS 执行前写入，
     * 避免 driver-work.html 自动跳转 / 刷新时销毁 evaluate 上下文。
     */

    await page.addInitScript(
        ({
            TEST_DATA,
            nowIso,
            loadedAt,
            departedAt
        }) => {

            try {

                /*
                 * TEST 司机身份
                 */

                localStorage.setItem(
                    "driverProfile",
                    JSON.stringify({
                        driverId:
                            TEST_DATA.driverId,

                        personId:
                            TEST_DATA.driverId,

                        employeeId:
                            TEST_DATA.driverId,

                        employeeNo:
                            TEST_DATA.employeeNo,

                        name:
                            TEST_DATA.driverName,

                        position:
                            "汽车司机",

                        team:
                            "TEST-生产A组",

                        department:
                            "TEST-生产A组",

                        status:
                            "approved",

                        approvalStatus:
                            "approved",

                        personnelStatus:
                            "作业中",

                        source:
                            "robot-test-fixture",

                        testFixture:
                            true
                    })
                );


                localStorage.setItem(
                    "currentPersonId",
                    TEST_DATA.driverId
                );


                localStorage.setItem(
                    "workerPersonId",
                    TEST_DATA.driverId
                );


                localStorage.setItem(
                    "selectedPosition",
                    "汽车司机"
                );


                localStorage.setItem(
                    "workerPosition",
                    "汽车司机"
                );


                /*
                 * TEST 调度主任务
                 *
                 * driver-work.js 会读取 dispatchPublishedTasks，
                 * 并用 driverAssignments 再次确认司机、车辆、挖机和班次绑定。
                 */

                const shiftDate =
                    nowIso.slice(
                        0,
                        10
                    );


                const testAssignment = {

                    driverId:
                        TEST_DATA.driverId,

                    personId:
                        TEST_DATA.driverId,

                    driverName:
                        TEST_DATA.driverName,

                    personName:
                        TEST_DATA.driverName,

                    shiftId:
                        TEST_DATA.shiftId,

                    shift:
                        "白班",

                    shiftDate,

                    vehicleNumber:
                        TEST_DATA.vehicleId,

                    vehicleId:
                        TEST_DATA.vehicleId,

                    truckNumber:
                        TEST_DATA.vehicleId,

                    truckId:
                        TEST_DATA.vehicleId,

                    excavatorNumber:
                        TEST_DATA.excavatorId,

                    excavatorId:
                        TEST_DATA.excavatorId,

                    loadingPoint:
                        "TEST-测试装载区",

                    unloadingPoint:
                        "TEST-测试排土场",

                    loadingZoneId:
                        TEST_DATA.loadingZoneId,

                    unloadingZoneIds: [
                        TEST_DATA.wasteZoneId
                    ],

                    testFixture:
                        true
                };


                const testMasterTask = {

                    taskId:
                        TEST_DATA.taskId,

                    dispatchTaskId:
                        TEST_DATA.taskId,

                    id:
                        TEST_DATA.taskId,

                    taskName:
                        "TEST-机器人运输测试任务",

                    status:
                        "active",

                    currentShiftId:
                        TEST_DATA.shiftId,

                    shiftId:
                        TEST_DATA.shiftId,

                    shift:
                        "白班",

                    shiftDate,

                    area:
                        "TEST-测试采区",

                    workArea:
                        "TEST-测试采区",

                    remark:
                        "TEST-机器人自动化测试",

                    loadingPoint:
                        "TEST-测试装载区",

                    taskLoadingPoint:
                        "TEST-测试装载区",

                    unloadingPoint:
                        "TEST-测试排土场",

                    taskUnloadingPoint:
                        "TEST-测试排土场",

                    loadingZoneId:
                        TEST_DATA.loadingZoneId,

                    unloadingZoneIds: [
                        TEST_DATA.wasteZoneId
                    ],

                    driverAssignments: [
                        testAssignment
                    ],

                    publishedAt:
                        nowIso,

                    createdAt:
                        nowIso,

                    updatedAt:
                        nowIso,

                    testFixture:
                        true
                };


                let publishedTasks = [];


                try {

                    const existingTasks =
                        JSON.parse(
                            localStorage.getItem(
                                "dispatchPublishedTasks"
                            ) ||
                            "[]"
                        );


                    if (
                        Array.isArray(
                            existingTasks
                        )
                    ) {

                        publishedTasks =
                            existingTasks.filter(
                                item =>
                                    String(
                                        item?.taskId ||
                                        item?.dispatchTaskId ||
                                        item?.id ||
                                        ""
                                    ) !==
                                        TEST_DATA.taskId
                            );
                    }

                } catch (
                    error
                ) {

                    publishedTasks =
                        [];
                }


                publishedTasks.push(
                    testMasterTask
                );


                localStorage.setItem(
                    "dispatchPublishedTasks",
                    JSON.stringify(
                        publishedTasks
                    )
                );


                /*
                 * TEST 运输区域 + 设备检查 + 车辆运行状态
                 * 供“正常装卸运输完整闭环”机器人测试使用。
                 */

                localStorage.setItem(
                    "transportZones",
                    JSON.stringify([
                        {
                            zoneId:
                                TEST_DATA.loadingZoneId,
                            name:
                                "TEST-测试装载区",
                            zoneType:
                                "loading",
                            latitude:
                                43.850000,
                            longitude:
                                105.750000,
                            radius:
                                80,
                            enabled:
                                true,
                            testFixture:
                                true
                        },
                        {
                            zoneId:
                                TEST_DATA.wasteZoneId,
                            name:
                                "TEST-测试排土场",
                            zoneType:
                                "unloading",
                            materialType:
                                "渣",
                            latitude:
                                43.860000,
                            longitude:
                                105.760000,
                            radius:
                                80,
                            enabled:
                                true,
                            testFixture:
                                true
                        }
                    ])
                );


                localStorage.setItem(
                    "equipmentUsageChecks",
                    JSON.stringify([
                        {
                            checkId:
                                "TEST-CHECK-001",
                            mode:
                                "shift",
                            inspectionMode:
                                "shift",
                            shiftId:
                                TEST_DATA.shiftId,
                            equipmentId:
                                TEST_DATA.vehicleId,
                            equipmentNumber:
                                TEST_DATA.vehicleId,
                            personId:
                                TEST_DATA.driverId,
                            incomingPersonId:
                                TEST_DATA.driverId,
                            personName:
                                TEST_DATA.driverName,
                            incomingPersonName:
                                TEST_DATA.driverName,
                            locked:
                                true,
                            completedAt:
                                nowIso,
                            testFixture:
                                true
                        }
                    ])
                );


                localStorage.setItem(
                    "equipmentOperationalStatus",
                    JSON.stringify([
                        {
                            equipmentId:
                                TEST_DATA.vehicleId,
                            status:
                                "available",
                            source:
                                "robot-test-fixture",
                            updatedAt:
                                nowIso,
                            testFixture:
                                true
                        }
                    ])
                );


                /*
                 * TEST 当前生产任务
                 */

                localStorage.setItem(
                    "driverCurrentTask",
                    JSON.stringify({
                        taskId:
                            TEST_DATA.taskId,

                        dispatchTaskId:
                            TEST_DATA.taskId,

                        taskName:
                            "TEST-机器人运输测试任务",

                        shiftId:
                            TEST_DATA.shiftId,

                        shift:
                            "白班",

                        shiftDate:
                            nowIso.slice(
                                0,
                                10
                            ),

                        vehicleNumber:
                            TEST_DATA.vehicleId,

                        vehicleId:
                            TEST_DATA.vehicleId,

                        excavatorNumber:
                            TEST_DATA.excavatorId,

                        excavatorId:
                            TEST_DATA.excavatorId,

                        workArea:
                            "TEST-测试采区",

                        loadingZoneId:
                            TEST_DATA.loadingZoneId,

                        loadingZoneName:
                            "TEST-测试装载区",

                        unloadingZoneIds: [
                            TEST_DATA.wasteZoneId
                        ],

                        unloadingZoneNames: [
                            "TEST-测试排土场"
                        ],

                        driverId:
                            TEST_DATA.driverId,

                        personId:
                            TEST_DATA.driverId,

                        driverName:
                            TEST_DATA.driverName,

                        vehicleClaimed:
                            true,

                        status:
                            "working",

                        testFixture:
                            true
                    })
                );


                /*
                 * TEST 运输闭环
                 */

                localStorage.setItem(
                    "driverTransportCycleState",
                    JSON.stringify({
                        cycleKey:
                            [
                                TEST_DATA.taskId,
                                TEST_DATA.shiftId,
                                TEST_DATA.vehicleId,
                                TEST_DATA.driverId
                            ]
                            .join(
                                "|"
                            ),

                        phase:
                            "enroute_unload",

                        taskId:
                            TEST_DATA.taskId,

                        shiftId:
                            TEST_DATA.shiftId,

                        vehicleNumber:
                            TEST_DATA.vehicleId,

                        loadedAt,

                        departedLoadingAt:
                            departedAt,

                        loadingZoneId:
                            TEST_DATA.loadingZoneId,

                        loadingZoneName:
                            "TEST-测试装载区",

                        loadingGps: {
                            latitude:
                                43.85,

                            longitude:
                                105.75,

                            accuracy:
                                10,

                            timestamp:
                                loadedAt,

                            testFixture:
                                true
                        },

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

                        robotFixture:
                            true,

                        updatedAt:
                            nowIso
                    })
                );


                /*
                 * TEST 数据标识
                 */

                localStorage.setItem(
                    "__robotTestFixture",
                    JSON.stringify({
                        enabled:
                            true,

                        driverId:
                            TEST_DATA.driverId,

                        taskId:
                            TEST_DATA.taskId,

                        vehicleId:
                            TEST_DATA.vehicleId,

                        createdAt:
                            nowIso
                    })
                );

            } catch (
                error
            ) {

                console.error(
                    "[RobotTestFixture] TEST localStorage 注入失败",
                    error
                );
            }

        },
        payload
    );


    /*
     * 注册完成后再打开司机端。
     * init script 会在页面自己的脚本运行前自动写入 TEST 数据。
     */

    await page.goto(
        "driver-work.html",
        {
            waitUntil:
                "domcontentloaded"
        }
    );


    /*
     * 某些页面启动逻辑可能发生一次重定向。
     * 等页面稳定后再返回。
     */

    await page.waitForLoadState(
        "domcontentloaded"
    )
    .catch(
        () => {}
    );


    await page.waitForTimeout(
        1200
    );


    return {
        ...TEST_DATA
    };
}


async function clearRobotTestEnvironment(
    page
) {

    /*
     * 清理时页面应已经处于目标域名。
     * 若发生轻微导航，最多重试一次。
     */

    const clearKeys =
        async () => {

            await page.evaluate(
                TEST_DATA => {

                    const keys = [
                        "driverProfile",
                        "driverCurrentTask",
                        "driverTransportCycleState",
                        "currentPersonId",
                        "workerPersonId",
                        "selectedPosition",
                        "workerPosition",
                        "__robotTestFixture"
                    ];


                    keys.forEach(
                        key =>
                            localStorage.removeItem(
                                key
                            )
                    );


                    /*
                     * dispatchPublishedTasks 可能还有其他任务。
                     * 只删除 TEST-TASK-001，不删除整个数组。
                     */

                    try {

                        const rows =
                            JSON.parse(
                                localStorage.getItem(
                                    "dispatchPublishedTasks"
                                ) ||
                                "[]"
                            );


                        if (
                            Array.isArray(
                                rows
                            )
                        ) {

                            const keep =
                                rows.filter(
                                    item =>
                                        String(
                                            item?.taskId ||
                                            item?.dispatchTaskId ||
                                            item?.id ||
                                            ""
                                        ) !==
                                            TEST_DATA.taskId
                                );


                            localStorage.setItem(
                                "dispatchPublishedTasks",
                                JSON.stringify(
                                    keep
                                )
                            );
                        }

                    } catch (
                        error
                    ) {

                        console.warn(
                            "[RobotTestFixture R0-4B] 清理 TEST 主任务失败",
                            error
                        );
                    }
                },
                TEST_DATA
            );
        };


    try {

        await clearKeys();

    } catch (
        error
    ) {

        if (
            /Execution context was destroyed|navigation/i.test(
                String(
                    error?.message ||
                    error
                )
            )
        ) {

            await page.waitForLoadState(
                "domcontentloaded"
            )
            .catch(
                () => {}
            );


            await page.waitForTimeout(
                300
            );


            await clearKeys();

        } else {

            throw error;
        }
    }


    return true;
}


module.exports = {
    TEST_DATA,
    validateTestData,
    initializeTruckDriverTestEnvironment,
    clearRobotTestEnvironment
};
