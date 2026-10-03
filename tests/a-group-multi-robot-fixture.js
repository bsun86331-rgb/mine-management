"use strict";

/*
=========================================================
A组多机器人联动 TEST Fixture R0-2
- 2 台 TEST 挖机
- 每台挖机 3 台 TEST 汽车
- 2 名 TEST 挖机司机
- 6 名 TEST 汽车司机
- 2 张 TEST 调度任务

最高规则：
1. 所有ID必须 TEST- 开头
2. 仅写 Playwright 隔离浏览器上下文
3. 不修改正式业务文件
4. 不覆盖任何非 TEST 数据
=========================================================
*/

const A_GROUP = {
    team:
        "生产A组",

    excavators: [
        {
            excavatorId:
                "TEST-A-EX-001",

            driverId:
                "TEST-A-EXD-001",

            driverName:
                "TEST-A组挖机司机01",

            taskId:
                "TEST-A-TASK-001",

            trucks: [
                {
                    vehicleId:
                        "TEST-A-T-001",

                    driverId:
                        "TEST-A-D-001",

                    driverName:
                        "TEST-A组汽车司机01"
                },
                {
                    vehicleId:
                        "TEST-A-T-002",

                    driverId:
                        "TEST-A-D-002",

                    driverName:
                        "TEST-A组汽车司机02"
                },
                {
                    vehicleId:
                        "TEST-A-T-003",

                    driverId:
                        "TEST-A-D-003",

                    driverName:
                        "TEST-A组汽车司机03"
                }
            ]
        },
        {
            excavatorId:
                "TEST-A-EX-002",

            driverId:
                "TEST-A-EXD-002",

            driverName:
                "TEST-A组挖机司机02",

            taskId:
                "TEST-A-TASK-002",

            trucks: [
                {
                    vehicleId:
                        "TEST-A-T-004",

                    driverId:
                        "TEST-A-D-004",

                    driverName:
                        "TEST-A组汽车司机04"
                },
                {
                    vehicleId:
                        "TEST-A-T-005",

                    driverId:
                        "TEST-A-D-005",

                    driverName:
                        "TEST-A组汽车司机05"
                },
                {
                    vehicleId:
                        "TEST-A-T-006",

                    driverId:
                        "TEST-A-D-006",

                    driverName:
                        "TEST-A组汽车司机06"
                }
            ]
        }
    ],

    supportRoles: [
        {
            personId:
                "TEST-A-AUX-LOADER-001",

            name:
                "TEST-A组铲车司机01",

            position:
                "铲车司机",

            team:
                "生产A组"
        },
        {
            personId:
                "TEST-A-AUX-FUEL-001",

            name:
                "TEST-A组加油车司机01",

            position:
                "加油车司机",

            team:
                "生产A组"
        },
        {
            personId:
                "TEST-A-AUX-BUS-001",

            name:
                "TEST-A组大巴司机01",

            position:
                "大巴司机",

            team:
                "生产A组"
        },
        {
            personId:
                "TEST-A-AUX-GRADER-001",

            name:
                "TEST-A组平路机司机01",

            position:
                "平路机司机",

            team:
                "生产A组"
        },
        {
            personId:
                "TEST-A-AUX-WATER-001",

            name:
                "TEST-A组洒水车司机01",

            position:
                "洒水车司机",

            team:
                "生产A组"
        },
        {
            personId:
                "TEST-A-AUX-DOZER-001",

            name:
                "TEST-A组推土机司机01",

            position:
                "推土机司机",

            team:
                "生产A组"
        },
        {
            personId:
                "TEST-A-DISPATCH-001",

            name:
                "TEST-A组车队长01",

            position:
                "车队长",

            team:
                ""
        },
        {
            personId:
                "TEST-A-MAINT-MGR-001",

            name:
                "TEST-A组维修管理01",

            position:
                "维修管理",

            team:
                "修理组"
        },
        {
            personId:
                "TEST-A-MAINT-WORKER-001",

            name:
                "TEST-A组维修员01",

            position:
                "维修员",

            team:
                "修理组"
        },
        {
            personId:
                "TEST-A-SURVEY-001",

            name:
                "TEST-A组测量员01",

            position:
                "测量员",

            team:
                "后勤办公组"
        },
        {
            personId:
                "TEST-A-SAFETY-001",

            name:
                "TEST-A组安全员01",

            position:
                "安全员",

            team:
                "后勤办公组"
        },
        {
            personId:
                "TEST-A-STATS-001",

            name:
                "TEST-A组统计01",

            position:
                "统计",

            team:
                "后勤办公组"
        },
        {
            personId:
                "TEST-A-ACCOUNTING-001",

            name:
                "TEST-A组会计01",

            position:
                "会计",

            team:
                "后勤办公组"
        },
        {
            personId:
                "TEST-A-LOGISTICS-001",

            name:
                "TEST-A组后勤01",

            position:
                "后勤",

            team:
                "后勤办公组"
        },
        {
            personId:
                "TEST-A-WAREHOUSE-001",

            name:
                "TEST-A组库房管理01",

            position:
                "库房管理",

            team:
                "后勤办公组"
        },
        {
            personId:
                "TEST-A-GM-001",

            name:
                "TEST-A组总经理01",

            position:
                "总经理",

            team:
                "后勤办公组"
        },
        {
            personId:
                "TEST-A-ADMIN-001",

            name:
                "TEST-A组管理员01",

            position:
                "管理员",

            team:
                "后勤办公组"
        }
    ]
};


function assertTestId(
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
            "A组Fixture安全拦截：" +
            label +
            " 不是 TEST 数据：" +
            text
        );
    }


    return text;
}


function buildAGroupPayload() {

    const nowIso =
        new Date()
            .toISOString();


    const personnel =
        [];


    const equipment =
        [];


    const tasks =
        [];


    A_GROUP.excavators.forEach(
        (
            unit,
            unitIndex
        ) => {

            assertTestId(
                unit.excavatorId,
                "挖机"
            );


            assertTestId(
                unit.driverId,
                "挖机司机"
            );


            assertTestId(
                unit.taskId,
                "任务"
            );


            personnel.push({
                personId:
                    unit.driverId,

                employeeId:
                    unit.driverId,

                employeeNo:
                    "TEST-A-EXD-" +
                    String(
                        unitIndex +
                        1
                    )
                    .padStart(
                        2,
                        "0"
                    ),

                name:
                    unit.driverName,

                position:
                    "挖机司机",

                team:
                    A_GROUP.team,

                status:
                    "approved",

                approvalStatus:
                    "approved",

                personnelStatus:
                    "作业中",

                testFixture:
                    true
            });


            equipment.push({
                equipmentId:
                    unit.excavatorId,

                equipmentNumber:
                    unit.excavatorId,

                equipmentType:
                    "挖掘机",

                status:
                    "working",

                currentStatus:
                    "作业中",

                testFixture:
                    true
            });


            const driverAssignments =
                [];


            unit.trucks.forEach(
                (
                    truck,
                    truckIndex
                ) => {

                    assertTestId(
                        truck.vehicleId,
                        "汽车"
                    );


                    assertTestId(
                        truck.driverId,
                        "汽车司机"
                    );


                    personnel.push({
                        personId:
                            truck.driverId,

                        driverId:
                            truck.driverId,

                        employeeId:
                            truck.driverId,

                        employeeNo:
                            "TEST-A-D-" +
                            String(
                                unitIndex *
                                3 +
                                truckIndex +
                                1
                            )
                            .padStart(
                                2,
                                "0"
                            ),

                        name:
                            truck.driverName,

                        position:
                            "汽车司机",

                        team:
                            A_GROUP.team,

                        status:
                            "approved",

                        approvalStatus:
                            "approved",

                        personnelStatus:
                            "作业中",

                        testFixture:
                            true
                    });


                    equipment.push({
                        equipmentId:
                            truck.vehicleId,

                        equipmentNumber:
                            truck.vehicleId,

                        equipmentType:
                            "矿卡",

                        status:
                            "available",

                        currentStatus:
                            "可用",

                        testFixture:
                            true
                    });


                    driverAssignments.push({
                        driverId:
                            truck.driverId,

                        personId:
                            truck.driverId,

                        driverName:
                            truck.driverName,

                        personName:
                            truck.driverName,

                        vehicleId:
                            truck.vehicleId,

                        vehicleNumber:
                            truck.vehicleId,

                        truckId:
                            truck.vehicleId,

                        truckNumber:
                            truck.vehicleId,

                        excavatorId:
                            unit.excavatorId,

                        excavatorNumber:
                            unit.excavatorId,

                        shiftId:
                            "TEST-A-SHIFT-001",

                        shift:
                            "白班",

                        shiftDate:
                            nowIso.slice(
                                0,
                                10
                            ),

                        testFixture:
                            true
                    });
                }
            );


            tasks.push({
                taskId:
                    unit.taskId,

                dispatchTaskId:
                    unit.taskId,

                id:
                    unit.taskId,

                taskName:
                    "TEST-A组联动任务-" +
                    String(
                        unitIndex +
                        1
                    ),

                status:
                    "active",

                area:
                    "TEST-A组作业区",

                workArea:
                    "TEST-A组作业区",

                shiftId:
                    "TEST-A-SHIFT-001",

                currentShiftId:
                    "TEST-A-SHIFT-001",

                shift:
                    "白班",

                shiftDate:
                    nowIso.slice(
                        0,
                        10
                    ),

                loadingPoint:
                    "TEST-A组装载点-" +
                    String(
                        unitIndex +
                        1
                    ),

                unloadingPoint:
                    "TEST-A组排土场",

                publishedAt:
                    nowIso,

                remark:
                    "TEST-A组2套挖机多机器人联动",

                excavatorDriverAssignments: [
                    {
                        driverId:
                            unit.driverId,

                        personId:
                            unit.driverId,

                        driverName:
                            unit.driverName,

                        personName:
                            unit.driverName,

                        excavatorId:
                            unit.excavatorId,

                        excavatorNumber:
                            unit.excavatorId,

                        testFixture:
                            true
                    }
                ],

                bindings: [
                    {
                        excavatorId:
                            unit.excavatorId,

                        truckIds:
                            unit.trucks.map(
                                item =>
                                    item.vehicleId
                            ),

                        testFixture:
                            true
                    }
                ],

                driverAssignments,

                testFixture:
                    true
            });
        }
    );


    A_GROUP.supportRoles.forEach(
        (
            role,
            index
        ) => {

            assertTestId(
                role.personId,
                role.position
            );


            personnel.push({
                personId:
                    role.personId,

                employeeId:
                    role.personId,

                employeeNo:
                    "TEST-A-ROLE-" +
                    String(
                        index +
                        1
                    )
                    .padStart(
                        2,
                        "0"
                    ),

                name:
                    role.name,

                position:
                    role.position,

                team:
                    role.team,

                status:
                    "approved",

                approvalStatus:
                    "approved",

                personnelStatus:
                    "在职可用",

                testFixture:
                    true
            });
        }
    );


    return {
        team:
            A_GROUP.team,

        nowIso,

        personnel,
        equipment,
        tasks,

        summary: {
            excavators:
                A_GROUP.excavators.length,

            excavatorDrivers:
                A_GROUP.excavators.length,

            trucks:
                A_GROUP.excavators.reduce(
                    (
                        total,
                        unit
                    ) =>
                        total +
                        unit.trucks.length,
                    0
                ),

            truckDrivers:
                A_GROUP.excavators.reduce(
                    (
                        total,
                        unit
                    ) =>
                        total +
                        unit.trucks.length,
                    0
                ),

            otherRoles:
                A_GROUP.supportRoles.length,

            totalRobotIdentities:
                A_GROUP.excavators.length +
                A_GROUP.excavators.reduce(
                    (
                        total,
                        unit
                    ) =>
                        total +
                        unit.trucks.length,
                    0
                ) +
                A_GROUP.supportRoles.length
        }
    };
}


function findIdentity(
    identityId
) {

    for (
        const unit
        of A_GROUP.excavators
    ) {

        if (
            unit.driverId ===
                identityId
        ) {

            return {
                type:
                    "excavator",

                unit,
                personId:
                    unit.driverId,

                personName:
                    unit.driverName,

                position:
                    "挖机司机"
            };
        }


        const truck =
            unit.trucks.find(
                item =>
                    item.driverId ===
                    identityId
            );


        if (
            truck
        ) {

            return {
                type:
                    "truck",

                unit,
                truck,

                personId:
                    truck.driverId,

                personName:
                    truck.driverName,

                position:
                    "汽车司机"
            };
        }
    }


    const supportRole =
        A_GROUP.supportRoles.find(
            item =>
                item.personId ===
                    identityId
        );


    if (
        supportRole
    ) {

        return {
            type:
                "support",

            personId:
                supportRole.personId,

            personName:
                supportRole.name,

            position:
                supportRole.position,

            team:
                supportRole.team
        };
    }


    return null;
}


async function installAGroupRobotContext(
    page,
    identityId
) {

    const payload =
        buildAGroupPayload();


    const identity =
        findIdentity(
            identityId
        );


    if (
        !identity
    ) {

        throw new Error(
            "A组Fixture：未知机器人身份 " +
            String(
                identityId
            )
        );
    }


    assertTestId(
        identity.personId,
        "机器人身份"
    );


    await page.addInitScript(
        ({
            payload,
            identity
        }) => {

            const isTestId =
                value =>
                    String(
                        value ||
                        ""
                    )
                    .startsWith(
                        "TEST-"
                    );


            const mergeRows =
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
                            item =>
                                ![
                                    item?.personId,
                                    item?.driverId,
                                    item?.employeeId,
                                    item?.equipmentId,
                                    item?.equipmentNumber,
                                    item?.taskId,
                                    item?.dispatchTaskId,
                                    item?.id
                                ]
                                .some(
                                    isTestId
                                )
                        );


                    localStorage.setItem(
                        key,
                        JSON.stringify([
                            ...keep,
                            ...testRows
                        ])
                    );
                };


            mergeRows(
                "personnelRecords",
                payload.personnel
            );


            mergeRows(
                "equipmentMaster",
                payload.equipment
            );


            mergeRows(
                "dispatchPublishedTasks",
                payload.tasks
            );


            localStorage.setItem(
                "currentPersonId",
                identity.personId
            );


            localStorage.setItem(
                "workerPersonId",
                identity.personId
            );


            localStorage.setItem(
                "selectedPosition",
                identity.position
            );


            localStorage.setItem(
                "workerPosition",
                identity.position
            );


            localStorage.setItem(
                "rolePersonIds",
                JSON.stringify({
                    [
                        identity.position
                    ]:
                        identity.personId
                })
            );


            if (
                identity.type ===
                    "truck"
            ) {

                const task =
                    payload.tasks.find(
                        item =>
                            item.taskId ===
                            identity.unit.taskId
                    );


                const assignment =
                    task.driverAssignments.find(
                        item =>
                            item.driverId ===
                            identity.personId
                    );


                localStorage.setItem(
                    "driverProfile",
                    JSON.stringify({
                        driverId:
                            identity.personId,

                        personId:
                            identity.personId,

                        employeeId:
                            identity.personId,

                        name:
                            identity.personName,

                        position:
                            "汽车司机",

                        team:
                            payload.team,

                        status:
                            "approved",

                        approvalStatus:
                            "approved",

                        personnelStatus:
                            "作业中",

                        testFixture:
                            true
                    })
                );


                localStorage.setItem(
                    "driverCurrentTask",
                    JSON.stringify({
                        ...task,

                        ...assignment,

                        driverId:
                            identity.personId,

                        personId:
                            identity.personId,

                        driverName:
                            identity.personName,

                        vehicleId:
                            identity.truck.vehicleId,

                        vehicleNumber:
                            identity.truck.vehicleId,

                        excavatorId:
                            identity.unit.excavatorId,

                        excavatorNumber:
                            identity.unit.excavatorId,

                        status:
                            "working",

                        testFixture:
                            true
                    })
                );
            }


            localStorage.setItem(
                "__robotAGroupFixture",
                JSON.stringify({
                    enabled:
                        true,

                    identityId:
                        identity.personId,

                    identityType:
                        identity.type,

                    team:
                        payload.team,

                    createdAt:
                        payload.nowIso
                })
            );
        },
        {
            payload,
            identity
        }
    );


    return {
        payload,
        identity
    };
}


module.exports = {
    A_GROUP,
    buildAGroupPayload,
    installAGroupRobotContext
};
