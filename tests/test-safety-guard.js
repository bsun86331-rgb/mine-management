"use strict";

/*
=========================================================
R0-1 TestSafetyGuard
机器人测试最高安全规则

任何机器人：
1. 只能操作 TEST- 开头的数据
2. 禁止修改、删除、审批正式数据
3. 发现非 TEST 数据立即终止测试
=========================================================
*/

const TEST_PREFIX = "TEST-";


function normalizeId(value) {

    return String(
        value ?? ""
    ).trim();
}


function isTestId(value) {

    const id =
        normalizeId(value);

    return (
        id.length > 0 &&
        id.startsWith(
            TEST_PREFIX
        )
    );
}


function assertTestId(
    value,
    label = "数据"
) {

    const id =
        normalizeId(value);


    if (
        !id
    ) {

        throw new Error(
            `安全拦截：${label} ID为空，机器人停止执行`
        );
    }


    if (
        !isTestId(
            id
        )
    ) {

        throw new Error(
            `安全拦截：机器人禁止操作非 TEST 数据：${label} = ${id}`
        );
    }


    return id;
}


function assertTestIds(
    values,
    label = "数据"
) {

    if (
        !Array.isArray(
            values
        )
    ) {

        throw new Error(
            `安全拦截：${label} 必须是数组`
        );
    }


    return values.map(
        (
            value,
            index
        ) =>
            assertTestId(
                value,
                `${label}[${index}]`
            )
    );
}


function assertTestRecord(
    record,
    fields = [
        "id",
        "taskId",
        "tripId",
        "recordId",
        "driverId",
        "personId",
        "vehicleId",
        "vehicleNumber",
        "equipmentId",
        "shiftId",
        "zoneId"
    ]
) {

    if (
        !record ||
        typeof record !==
            "object"
    ) {

        throw new Error(
            "安全拦截：机器人准备操作的数据不是有效对象"
        );
    }


    const found =
        fields
            .map(
                field => ({
                    field,
                    value:
                        record[field]
                })
            )
            .filter(
                item =>
                    item.value !==
                        undefined &&
                    item.value !==
                        null &&
                    String(
                        item.value
                    ).trim() !==
                        ""
            );


    if (
        !found.length
    ) {

        throw new Error(
            "安全拦截：记录中没有找到可验证的 TEST ID"
        );
    }


    found.forEach(
        item => {

            assertTestId(
                item.value,
                item.field
            );
        }
    );


    return true;
}


function assertSafeWrite(
    action,
    targetId
) {

    const safeId =
        assertTestId(
            targetId,
            "写入目标"
        );


    const allowedActions =
        [
            "create",
            "update",
            "approve",
            "reject",
            "delete",
            "assign",
            "complete"
        ];


    if (
        !allowedActions.includes(
            String(
                action
            )
        )
    ) {

        throw new Error(
            `安全拦截：未知机器人写入动作：${action}`
        );
    }


    return {
        action,
        targetId:
            safeId
    };
}


module.exports = {
    TEST_PREFIX,
    isTestId,
    assertTestId,
    assertTestIds,
    assertTestRecord,
    assertSafeWrite
};
