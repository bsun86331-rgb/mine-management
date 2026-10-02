"use strict";

const {
    TEST_DATA
} = require(
    "./robot-test-fixture"
);


/*
=========================================================
R0-2 TestScenarioFactory
TEST 场景工厂

目标：
- 直接准备目标 TEST 状态，减少重复跑长链路
- 只写机器人 Playwright 浏览器里的 localStorage
- 只删除 / 替换 TEST- 数据
- 不修改任何正式业务文件
- 不删除任何非 TEST 正式数据
=========================================================
*/

const SCENARIOS = {
    MAINTENANCE_WORKING:
        "maintenance-working",

    MAINTENANCE_WAITING_INSPECTION:
        "maintenance-waiting-inspection",

    TEMPORARY_UNLOAD_PENDING:
        "temporary-unload-pending"
};


function assertScenarioName(
    name
) {

    const allowed =
        Object.values(
            SCENARIOS
        );


    if (
        !allowed.includes(
            name
        )
    ) {

        throw new Error(
            "TestScenarioFactory：未知场景 " +
            String(
                name ||
                "-"
            )
        );
    }


    return name;
}


function buildScenarioPayload(
    scenarioName
) {

    assertScenarioName(
        scenarioName
    );


    const now =
        new Date();


    const nowIso =
        now.toISOString();


    const earlier =
        minutes =>
            new Date(
                now.getTime() -
                minutes *
                60 *
                1000
            )
            .toISOString();


    const basePersonnel = [
        {
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
        },
        {
            personId:
                "TEST-MAINT-WORKER-01",

            employeeId:
                "TEST-MAINT-WORKER-01",

            name:
                "维修工01",

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
        }
    ];


    const baseRequest = {
        requestId:
            "TEST-MR-SCENARIO-001",

        maintenanceRequestId:
            "TEST-MR-SCENARIO-001",

        taskId:
            TEST_DATA.taskId,

        shiftId:
            TEST_DATA.shiftId,

        equipmentId:
            TEST_DATA.vehicleId,

        equipmentNumber:
            TEST_DATA.vehicleId,

        equipmentType:
            "矿卡",

        maintenanceType:
            "故障维修",

        faultType:
            "轮胎/轮毂",

        faultDescription:
            "TEST-场景工厂轮胎异常",

        repairProject:
            "TEST-场景工厂维修项目",

        orderId:
            "TEST-WO-SCENARIO-001",

        dispatchRequired:
            true,

        dispatchStatus:
            "approved",

        dispatchApprovedAt:
            earlier(
                40
            ),

        receivedAt:
            earlier(
                35
            ),

        assignedAt:
            earlier(
                30
            ),

        startedAt:
            earlier(
                20
            ),

        updatedAt:
            nowIso,

        createdAt:
            earlier(
                45
            ),

        testFixture:
            true
    };


    const baseOrder = {
        orderId:
            "TEST-WO-SCENARIO-001",

        requestId:
            "TEST-MR-SCENARIO-001",

        taskId:
            TEST_DATA.taskId,

        equipmentId:
            TEST_DATA.vehicleId,

        equipmentNumber:
            TEST_DATA.vehicleId,

        equipmentType:
            "矿卡",

        applicantName:
            "测试司机",

        faultType:
            "轮胎/轮毂",

        faultDescription:
            "TEST-场景工厂轮胎异常",

        repairProject:
            "TEST-场景工厂维修项目",

        bayId:
            "TEST-BAY-01",

        bayName:
            "TEST-1号工位",

        workerId:
            "TEST-MAINT-WORKER-01",

        workerName:
            "维修工01",

        assignedAt:
            earlier(
                30
            ),

        startedAt:
            earlier(
                20
            ),

        startedBy:
            "维修工01",

        startedById:
            "TEST-MAINT-WORKER-01",

        beforePhotoData:
            "data:image/png;base64,TEST",

        testFixture:
            true
    };


    if (
        scenarioName ===
            SCENARIOS.MAINTENANCE_WORKING
    ) {

        return {
            scenarioName,

            currentPersonId:
                "TEST-MAINT-WORKER-01",

            selectedPosition:
                "维修员",

            personnelRecords:
                basePersonnel,

            maintenanceRequests: [
                {
                    ...baseRequest,

                    status:
                        "working"
                }
            ],

            maintenanceWorkOrders: [
                {
                    ...baseOrder,

                    status:
                        "working"
                }
            ],

            workshopBays: [
                {
                    bayId:
                        "TEST-BAY-01",

                    name:
                        "TEST-1号工位",

                    status:
                        "busy",

                    orderId:
                        "TEST-WO-SCENARIO-001",

                    testFixture:
                        true
                }
            ],

            equipmentOperationalStatus: [
                {
                    equipmentId:
                        TEST_DATA.vehicleId,

                    status:
                        "maintenance",

                    previousStatus:
                        "available",

                    source:
                        "TEST-scenario",

                    updatedAt:
                        nowIso,

                    testFixture:
                        true
                }
            ]
        };
    }


    if (
        scenarioName ===
            SCENARIOS.MAINTENANCE_WAITING_INSPECTION
    ) {

        return {
            scenarioName,

            currentPersonId:
                "TEST-MAINT-MGR-001",

            selectedPosition:
                "维修管理",

            personnelRecords:
                basePersonnel,

            maintenanceRequests: [
                {
                    ...baseRequest,

                    status:
                        "waiting_inspection",

                    faultCause:
                        "TEST-故障原因",

                    repairProcess:
                        "TEST-维修过程",

                    actualRepairContent:
                        "TEST-实际维修内容",

                    repairFinishedAt:
                        earlier(
                            5
                        ),

                    finishedBy:
                        "维修工01",

                    finishedById:
                        "TEST-MAINT-WORKER-01"
                }
            ],

            maintenanceWorkOrders: [
                {
                    ...baseOrder,

                    status:
                        "waiting_inspection",

                    faultCause:
                        "TEST-故障原因",

                    repairProcess:
                        "TEST-维修过程",

                    actualRepairContent:
                        "TEST-实际维修内容",

                    partsUsed: [
                        "TEST-维修材料"
                    ],

                    afterPhotoData:
                        "data:image/png;base64,TEST",

                    repairFinishedAt:
                        earlier(
                            5
                        ),

                    finishedBy:
                        "维修工01",

                    finishedById:
                        "TEST-MAINT-WORKER-01"
                }
            ],

            maintenanceCosts:
                [],


            workshopBays: [
                {
                    bayId:
                        "TEST-BAY-01",

                    name:
                        "TEST-1号工位",

                    status:
                        "busy",

                    orderId:
                        "TEST-WO-SCENARIO-001",

                    testFixture:
                        true
                }
            ],

            equipmentOperationalStatus: [
                {
                    equipmentId:
                        TEST_DATA.vehicleId,

                    status:
                        "maintenance",

                    previousStatus:
                        "available",

                    source:
                        "TEST-scenario",

                    updatedAt:
                        nowIso,

                    testFixture:
                        true
                }
            ]
        };
    }


    return {
        scenarioName,

        currentPersonId:
            TEST_DATA.driverId,

        selectedPosition:
            "汽车司机",

        temporaryUnloadRequests: [
            {
                requestId:
                    "TEST-TEMP-UNLOAD-SCENARIO-001",

                taskId:
                    TEST_DATA.taskId,

                dispatchTaskId:
                    TEST_DATA.taskId,

                shiftId:
                    TEST_DATA.shiftId,

                shift:
                    "白班",

                driverId:
                    TEST_DATA.driverId,

                personId:
                    TEST_DATA.driverId,

                driverName:
                    TEST_DATA.driverName,

                vehicleId:
                    TEST_DATA.vehicleId,

                vehicleNumber:
                    TEST_DATA.vehicleId,

                excavatorId:
                    TEST_DATA.excavatorId,

                excavatorNumber:
                    TEST_DATA.excavatorId,

                loadingZoneId:
                    TEST_DATA.loadingZoneId,

                loadingZoneName:
                    "TEST装载区",

                materialType:
                    "渣",

                material:
                    "渣",

                reason:
                    "修路垫料",

                remark:
                    "TEST-场景工厂临时卸料申请",

                status:
                    "pending_dispatch",

                dispatchConfirmation:
                    "pending",

                officialCountEligible:
                    false,

                createdAt:
                    nowIso,

                updatedAt:
                    nowIso,

                temporaryUnloadGps: {
                    latitude:
                        43.85,

                    longitude:
                        105.75,

                    accuracy:
                        10,

                    timestamp:
                        nowIso
                },

                testFixture:
                    true
            }
        ],

        tripRecords:
            []
    };
}


async function installScenario(
    page,
    scenarioName
) {

    const payload =
        buildScenarioPayload(
            scenarioName
        );


    await page.addInitScript(
        payload => {

            const isTestId =
                value =>
                    String(
                        value ||
                        ""
                    )
                    .startsWith(
                        "TEST-"
                    );


            const mergeTestRows =
                (
                    key,
                    testRows
                ) => {

                    let current =
                        [];


                    try {

                        const parsed =
                            JSON.parse(
                                localStorage.getItem(
                                    key
                                ) ||
                                "[]"
                            );


                        current =
                            Array.isArray(
                                parsed
                            )
                                ? parsed
                                : [];

                    } catch (
                        error
                    ) {

                        current =
                            [];
                    }


                    const keep =
                        current.filter(
                            item => {

                                const ids = [
                                    item?.personId,
                                    item?.employeeId,
                                    item?.driverId,
                                    item?.requestId,
                                    item?.maintenanceRequestId,
                                    item?.orderId,
                                    item?.bayId,
                                    item?.equipmentId,
                                    item?.equipmentNumber,
                                    item?.vehicleId,
                                    item?.vehicleNumber,
                                    item?.taskId,
                                    item?.dispatchTaskId,
                                    item?.tripId,
                                    item?.recordId,
                                    item?.id
                                ];


                                return !ids.some(
                                    isTestId
                                );
                            }
                        );


                    localStorage.setItem(
                        key,
                        JSON.stringify([
                            ...keep,
                            ...testRows
                        ])
                    );
                };


            const arrayKeys = [
                "personnelRecords",
                "maintenanceRequests",
                "maintenanceWorkOrders",
                "maintenanceCosts",
                "workshopBays",
                "equipmentOperationalStatus",
                "temporaryUnloadRequests",
                "tripRecords"
            ];


            arrayKeys.forEach(
                key => {

                    if (
                        Array.isArray(
                            payload[
                                key
                            ]
                        )
                    ) {

                        mergeTestRows(
                            key,
                            payload[
                                key
                            ]
                        );
                    }
                }
            );


            if (
                payload.currentPersonId
            ) {

                localStorage.setItem(
                    "currentPersonId",
                    payload.currentPersonId
                );
            }


            if (
                payload.selectedPosition
            ) {

                localStorage.setItem(
                    "selectedPosition",
                    payload.selectedPosition
                );
            }


            localStorage.setItem(
                "robotScenarioName",
                payload.scenarioName
            );


            localStorage.setItem(
                "robotScenarioPreparedAt",
                new Date()
                    .toISOString()
            );
        },
        payload
    );


    return {
        ok:
            true,

        scenarioName
    };
}


module.exports = {
    SCENARIOS,
    assertScenarioName,
    buildScenarioPayload,
    installScenario
};
