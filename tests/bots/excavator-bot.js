"use strict";

const {
    assertTestId
} = require(
    "../test-safety-guard"
);


/*
=========================================================
ExcavatorBot
挖机司机联动测试机器人

仅验证 TEST- 人员、TEST- 挖机、TEST- 调度任务和跟随汽车绑定。
=========================================================
*/

class ExcavatorBot {

    constructor(
        page,
        name =
            "ExcavatorBot"
    ) {

        this.page =
            page;

        this.name =
            name;
    }


    async open() {

        await this.page.goto(
            "excavator.html",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        await this.page.waitForTimeout(
            700
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


    async assertAssignment({
        driverId,
        excavatorId,
        taskId,
        truckIds
    }) {

        assertTestId(
            driverId,
            "挖机司机"
        );


        assertTestId(
            excavatorId,
            "挖机"
        );


        assertTestId(
            taskId,
            "任务"
        );


        truckIds.forEach(
            truckId =>
                assertTestId(
                    truckId,
                    "跟随汽车"
                )
        );


        const currentPersonId =
            await this.readLocalStorage(
                "currentPersonId"
            );


        if (
            String(
                currentPersonId ||
                ""
            ) !==
                String(
                    driverId
                )
        ) {

            throw new Error(
                this.name +
                "：currentPersonId 不一致，预期=" +
                driverId +
                "；实际=" +
                String(
                    currentPersonId ||
                    "-"
                )
            );
        }


        const personIdText =
            (
                await this.page
                    .locator(
                        "#personId"
                    )
                    .textContent()
            )?.trim() ||
            "";


        if (
            personIdText !==
                driverId
        ) {

            throw new Error(
                this.name +
                "：页面挖机司机ID不一致，预期=" +
                driverId +
                "；实际=" +
                personIdText
            );
        }


        const tasks =
            await this.readLocalStorage(
                "dispatchPublishedTasks"
            );


        const task =
            Array.isArray(
                tasks
            )
                ? tasks.find(
                    item =>
                        String(
                            item.taskId ||
                            item.dispatchTaskId ||
                            item.id ||
                            ""
                        ) ===
                            String(
                                taskId
                            )
                )
                : null;


        if (
            !task
        ) {

            throw new Error(
                this.name +
                "：未找到 TEST 调度任务 " +
                taskId
            );
        }


        const assignment =
            Array.isArray(
                task.excavatorDriverAssignments
            )
                ? task.excavatorDriverAssignments.find(
                    item =>
                        String(
                            item.driverId ||
                            item.personId ||
                            ""
                        ) ===
                            String(
                                driverId
                            )
                )
                : null;


        if (
            !assignment
        ) {

            throw new Error(
                this.name +
                "：任务中没有找到对应挖机司机分配"
            );
        }


        const assignedExcavator =
            String(
                assignment.excavatorId ||
                assignment.excavatorNumber ||
                ""
            );


        if (
            assignedExcavator !==
                excavatorId
        ) {

            throw new Error(
                this.name +
                "：挖机绑定不一致，预期=" +
                excavatorId +
                "；实际=" +
                assignedExcavator
            );
        }


        const binding =
            Array.isArray(
                task.bindings
            )
                ? task.bindings.find(
                    item =>
                        String(
                            item.excavatorId ||
                            ""
                        ) ===
                            String(
                                excavatorId
                            )
                )
                : null;


        if (
            !binding
        ) {

            throw new Error(
                this.name +
                "：没有找到挖机与汽车绑定"
            );
        }


        const boundTruckIds =
            Array.isArray(
                binding.truckIds
            )
                ? binding.truckIds.map(
                    String
                )
                : [];


        if (
            boundTruckIds.length !==
                truckIds.length
        ) {

            throw new Error(
                this.name +
                "：跟随汽车数量不一致，预期=" +
                truckIds.length +
                "；实际=" +
                boundTruckIds.length
            );
        }


        for (
            const truckId
            of truckIds
        ) {

            if (
                !boundTruckIds.includes(
                    truckId
                )
            ) {

                throw new Error(
                    this.name +
                    "：缺少跟随汽车 " +
                    truckId
                );
            }
        }


        const currentTaskText =
            (
                await this.page
                    .locator(
                        "#currentTaskArea"
                    )
                    .textContent()
            ) ||
            "";


        if (
            !currentTaskText.includes(
                excavatorId
            )
        ) {

            throw new Error(
                this.name +
                "：页面没有显示当前挖机 " +
                excavatorId
            );
        }


        for (
            const truckId
            of truckIds
        ) {

            if (
                !currentTaskText.includes(
                    truckId
                )
            ) {

                throw new Error(
                    this.name +
                    "：页面没有显示跟随汽车 " +
                    truckId
                );
            }
        }


        return {
            driverId,
            excavatorId,
            taskId,

            truckIds:
                boundTruckIds,

            truckCount:
                boundTruckIds.length
        };
    }
}


module.exports = {
    ExcavatorBot
};
