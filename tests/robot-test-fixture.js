"use strict";

/*
=========================================================
R0-4 RobotTestFixture
机器人专用 TEST 测试环境

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


async function initializeTruckDriverTestEnvironment(
    page
) {

    validateTestData();


    /*
     * 必须先进入目标网站，
     * 否则无法写对应域名的 localStorage。
     */

    await page.goto(
        "driver-work.html",
        {
            waitUntil:
                "domcontentloaded"
        }
    );


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


    await page.evaluate(
        ({
            TEST_DATA,
            loadedAt,
            departedAt
        }) => {

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
                        new Date()
                            .toISOString()
                            .slice(
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
                        TEST_DATA.coalZoneId,
                        TEST_DATA.wasteZoneId,
                        TEST_DATA.countZoneId
                    ],

                    unloadingZoneNames: [
                        "TEST-测试煤场",
                        "TEST-测试排土场",
                        "TEST-测试只记车数区"
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
             *
             * 直接放到：
             * 已装车
             * 已驶离装载区
             * 正在前往卸载区
             *
             * 方便机器人检查临时卸料按钮。
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
                        now.toISOString()
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
                        now.toISOString()
                })
            );

        },
        {
            TEST_DATA,
            loadedAt,
            departedAt
        }
    );


    /*
     * 写完以后刷新，
     * 让司机端重新读取 TEST 环境。
     */

    await page.reload({
        waitUntil:
            "domcontentloaded"
    });


    await page.waitForTimeout(
        1000
    );


    return {
        ...TEST_DATA
    };
}


async function clearRobotTestEnvironment(
    page
) {

    await page.evaluate(
        () => {

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
        }
    );


    return true;
}


module.exports = {
    TEST_DATA,
    validateTestData,
    initializeTruckDriverTestEnvironment,
    clearRobotTestEnvironment
};
