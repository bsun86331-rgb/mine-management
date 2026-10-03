"use strict";

const {
    assertTestId
} = require(
    "../test-safety-guard"
);


/*
=========================================================
RoleEntryBot
通用岗位入口测试机器人

用途：
- 验证 TEST 身份
- 验证岗位
- 验证审核状态
- 验证进入正式岗位页面
- 管理员 / 总经理自动注入 TEST 管理会话

不修改任何正式业务数据或正式业务代码。
=========================================================
*/

const ROLE_PAGES = {
    "铲车司机":
        "auxiliary.html",

    "加油车司机":
        "fuel.html",

    "大巴司机":
        "auxiliary.html",

    "平路机司机":
        "auxiliary.html",

    "洒水车司机":
        "auxiliary.html",

    "推土机司机":
        "auxiliary.html",

    "车队长":
        "dispatch.html",

    "维修管理":
        "maintenance.html",

    "维修员":
        "maintenance-worker.html",

    "测量员":
        "management.html",

    "安全员":
        "management.html",

    "统计":
        "management.html",

    "会计":
        "management.html",

    "后勤":
        "management.html",

    "库房管理":
        "warehouse.html",

    "总经理":
        "general-manager.html",

    "管理员":
        "admin-review.html"
};


class RoleEntryBot {

    constructor(
        page,
        identity,
        name =
            "RoleEntryBot"
    ) {

        this.page =
            page;

        this.identity =
            identity;

        this.name =
            name;
    }


    async installProtectedSession() {

        const {
            personId,
            position
        } =
            this.identity;


        if (
            ![
                "管理员",
                "总经理"
            ]
            .includes(
                position
            )
        ) {

            return;
        }


        await this.page.addInitScript(
            ({
                personId,
                position
            }) => {

                const session = {
                    verified:
                        true,

                    personId,

                    position,

                    verifiedAt:
                        Date.now(),

                    expiresAt:
                        Date.now() +
                        60 *
                        60 *
                        1000,

                    testFixture:
                        true
                };


                sessionStorage.setItem(
                    "managementSession",
                    JSON.stringify(
                        session
                    )
                );


                localStorage.setItem(
                    "pendingProtectedPersonId",
                    personId
                );


                localStorage.setItem(
                    "pendingProtectedPosition",
                    position
                );


                if (
                    position ===
                        "管理员"
                ) {

                    localStorage.setItem(
                        "adminPersonId",
                        personId
                    );

                } else {

                    localStorage.setItem(
                        "managerPersonId",
                        personId
                    );
                }
            },
            {
                personId,
                position
            }
        );
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


    async verify() {

        const {
            personId,
            position
        } =
            this.identity;


        assertTestId(
            personId,
            position
        );


        const pageName =
            ROLE_PAGES[
                position
            ];


        if (
            !pageName
        ) {

            throw new Error(
                this.name +
                "：岗位没有配置入口页面：" +
                position
            );
        }


        await this.installProtectedSession();


        await this.page.goto(
            pageName,
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        await this.page.waitForTimeout(
            700
        );


        const actualPath =
            new URL(
                this.page.url()
            )
            .pathname
            .split(
                "/"
            )
            .pop();


        if (
            actualPath !==
                pageName
        ) {

            throw new Error(
                this.name +
                "：岗位入口跳转不正确，岗位=" +
                position +
                "；预期=" +
                pageName +
                "；实际=" +
                actualPath
            );
        }


        const currentPersonId =
            await this.readLocalStorage(
                "currentPersonId"
            );


        if (
            ![
                "管理员",
                "总经理"
            ]
            .includes(
                position
            ) &&
            String(
                currentPersonId ||
                ""
            ) !==
                String(
                    personId
                )
        ) {

            throw new Error(
                this.name +
                "：currentPersonId不一致，预期=" +
                personId +
                "；实际=" +
                String(
                    currentPersonId ||
                    "-"
                )
            );
        }


        const records =
            await this.readLocalStorage(
                "personnelRecords"
            );


        const person =
            Array.isArray(
                records
            )
                ? records.find(
                    item =>
                        String(
                            item?.personId ||
                            item?.driverId ||
                            item?.employeeId ||
                            item?.id ||
                            ""
                        ) ===
                            String(
                                personId
                            )
                )
                : null;


        if (
            !person
        ) {

            throw new Error(
                this.name +
                "：personnelRecords 未找到 " +
                personId
            );
        }


        if (
            String(
                person.position ||
                ""
            ) !==
                String(
                    position
                )
        ) {

            throw new Error(
                this.name +
                "：岗位不一致，预期=" +
                position +
                "；实际=" +
                String(
                    person.position ||
                    "-"
                )
            );
        }


        const approved =
            person.status ===
                "approved" ||
            person.approvalStatus ===
                "approved" ||
            [
                "在职可用",
                "作业中"
            ]
            .includes(
                person.personnelStatus
            );


        if (
            !approved
        ) {

            throw new Error(
                this.name +
                "：人员不是已审核状态 " +
                personId
            );
        }


        return {
            personId,
            position,
            page:
                pageName,

            status:
                "approved"
        };
    }
}


module.exports = {
    ROLE_PAGES,
    RoleEntryBot
};
