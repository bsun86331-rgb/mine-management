"use strict";

const {
    assertTestId
} = require(
    "../test-safety-guard"
);


/*
=========================================================
WarehouseBot
库房管理 TEST 机器人

本机器人仅操作 TEST- 数据，覆盖：
1. 打开 warehouse.html
2. 写入 TEST 物资主数据 + TEST 待领用申请
3. 通过真实页面点击“确认出库”
4. 验证库存、申请状态和台账

不修改正式业务逻辑。
=========================================================
*/


class WarehouseBot {

    constructor(
        page,
        name =
            "WarehouseBot"
    ) {

        this.page =
            page;

        this.name =
            name;
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


    async open() {

        await this.page.goto(
            "warehouse.html",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        await this.page.waitForTimeout(
            250
        );


        return true;
    }


    async seedTestIssueRequest({
        requestId =
            "TEST-MATERIAL-REQUEST-001",

        materialId =
            "TEST-MATERIAL-001",

        materialCode =
            "TEST-WL-0001",

        materialName =
            "TEST-轮胎维修材料",

        personId =
            "TEST-MAINT-WORKER-001",

        personName =
            "TEST-维修员",

        position =
            "维修员",

        requestQuantity =
            1,

        availableQty =
            5,

        purpose =
            "TEST-维修工单等待配件领用"
    } = {}) {

        assertTestId(
            requestId,
            "库房领用申请"
        );


        assertTestId(
            materialId,
            "库房物资"
        );


        assertTestId(
            personId,
            "领用人员"
        );


        const payload = {
            requestId,
            materialId,
            materialCode,
            materialName,
            personId,
            personName,
            position,
            requestQuantity:
                Number(
                    requestQuantity
                ),
            availableQty:
                Number(
                    availableQty
                ),
            purpose
        };


        await this.page.evaluate(
            data => {

                const readArray =
                    key => {

                        try {

                            const value =
                                JSON.parse(
                                    localStorage.getItem(
                                        key
                                    )
                                );


                            return Array.isArray(
                                value
                            )
                                ? value
                                : [];

                        } catch (
                            error
                        ) {

                            return [];
                        }
                    };


                const saveArray =
                    (
                        key,
                        value
                    ) => {

                        localStorage.setItem(
                            key,
                            JSON.stringify(
                                value
                            )
                        );
                    };


                let materials =
                    readArray(
                        "warehouseMaterials"
                    )
                    .filter(
                        item =>
                            String(
                                item.materialId ||
                                ""
                            ) !==
                                data.materialId
                    );


                materials.push({
                    materialId:
                        data.materialId,

                    code:
                        data.materialCode,

                    name:
                        data.materialName,

                    category:
                        "TEST-维修配件",

                    spec:
                        "TEST-测试规格",

                    unit:
                        "套",

                    type:
                        "consumable",

                    referencePrice:
                        100,

                    minimumStock:
                        1,

                    availableQty:
                        data.availableQty,

                    issuedQty:
                        0,

                    pendingReturnQty:
                        0,

                    pendingInspectQty:
                        0,

                    pendingScrapQty:
                        0,

                    scrappedQty:
                        0,

                    pendingLostQty:
                        0,

                    status:
                        "active",

                    createdAt:
                        new Date()
                            .toISOString()
                });


                saveArray(
                    "warehouseMaterials",
                    materials
                );


                let requests =
                    readArray(
                        "materialRequests"
                    )
                    .filter(
                        item =>
                            String(
                                item.requestId ||
                                ""
                            ) !==
                                data.requestId
                    );


                requests.push({
                    requestId:
                        data.requestId,

                    materialId:
                        data.materialId,

                    materialName:
                        data.materialName,

                    personId:
                        data.personId,

                    personName:
                        data.personName,

                    position:
                        data.position,

                    requestQuantity:
                        data.requestQuantity,

                    purpose:
                        data.purpose,

                    status:
                        "pending",

                    createdAt:
                        new Date()
                            .toISOString()
                });


                saveArray(
                    "materialRequests",
                    requests
                );


                const ledger =
                    readArray(
                        "materialLedger"
                    )
                    .filter(
                        item =>
                            !String(
                                item.ledgerId ||
                                ""
                            )
                            .startsWith(
                                "TEST-WAREHOUSE-"
                            )
                    );


                saveArray(
                    "materialLedger",
                    ledger
                );
            },
            payload
        );


        await this.page.reload({
            waitUntil:
                "domcontentloaded"
        });


        await this.page.waitForTimeout(
            250
        );


        return payload;
    }


    async approveLatestTestRequest() {

        const requests =
            await this.readLocalStorage(
                "materialRequests"
            );


        const candidates =
            Array.isArray(
                requests
            )
                ? requests
                    .filter(
                        item =>
                            item &&
                            (
                                !item.status ||
                                item.status ===
                                    "pending"
                            )
                            &&
                            String(
                                item.requestId ||
                                ""
                            )
                            .startsWith(
                                "TEST-"
                            )
                            &&
                            String(
                                item.materialId ||
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
                                b.createdAt ||
                                0
                            )
                            -
                            new Date(
                                a.createdAt ||
                                0
                            )
                    )
                : [];


        if (
            !candidates.length
        ) {

            throw new Error(
                "WarehouseBot：没有找到 pending 的 TEST 领用申请"
            );
        }


        const request =
            candidates[0];


        const requestId =
            String(
                request.requestId
            );


        const materialId =
            String(
                request.materialId
            );


        assertTestId(
            requestId,
            "库房领用申请"
        );


        assertTestId(
            materialId,
            "库房物资"
        );


        const beforeMaterials =
            await this.readLocalStorage(
                "warehouseMaterials"
            );


        const beforeMaterial =
            Array.isArray(
                beforeMaterials
            )
                ? beforeMaterials.find(
                    item =>
                        String(
                            item.materialId ||
                            ""
                        ) ===
                            materialId
                )
                : null;


        if (
            !beforeMaterial
        ) {

            throw new Error(
                "WarehouseBot：TEST 物资主数据不存在"
            );
        }


        const beforeAvailable =
            Number(
                beforeMaterial.availableQty ||
                0
            );


        const issueQty =
            Number(
                request.requestQuantity ||
                request.quantity ||
                1
            );


        await this.page
            .locator(
                'button[data-page="requests"]'
            )
            .click();


        await this.page.waitForTimeout(
            120
        );


        const approveButton =
            this.page.locator(
                `button[onclick*="approveRequest('${requestId}')"]`
            )
            .first();


        await approveButton.waitFor({
            state:
                "visible"
        });


        const dialogs = [];


        const dialogHandler =
            async dialog => {

                dialogs.push(
                    dialog.type()
                );


                if (
                    dialog.type() ===
                        "prompt"
                ) {

                    await dialog.accept(
                        String(
                            issueQty
                        )
                    );


                    return;
                }


                await dialog.accept();
            };


        this.page.on(
            "dialog",
            dialogHandler
        );


        try {

            await approveButton.click();


            await this.page.waitForTimeout(
                250
            );

        } finally {

            this.page.off(
                "dialog",
                dialogHandler
            );
        }


        if (
            !dialogs.includes(
                "prompt"
            ) ||
            !dialogs.includes(
                "alert"
            )
        ) {

            throw new Error(
                "WarehouseBot：确认出库没有完整经过数量确认和完成提示"
            );
        }


        await this.page.waitForTimeout(
            250
        );


        const afterRequests =
            await this.readLocalStorage(
                "materialRequests"
            );


        const issuedRequest =
            Array.isArray(
                afterRequests
            )
                ? afterRequests.find(
                    item =>
                        String(
                            item.requestId ||
                            ""
                        ) ===
                            requestId
                )
                : null;


        if (
            !issuedRequest ||
            issuedRequest.status !==
                "issued"
        ) {

            throw new Error(
                "WarehouseBot：确认出库后 TEST 领用申请未进入 issued"
            );
        }


        if (
            Number(
                issuedRequest.actualQuantity ||
                0
            ) !==
                issueQty
        ) {

            throw new Error(
                "WarehouseBot：实际发放数量与 TEST 申请数量不一致"
            );
        }


        const afterMaterials =
            await this.readLocalStorage(
                "warehouseMaterials"
            );


        const issuedMaterial =
            Array.isArray(
                afterMaterials
            )
                ? afterMaterials.find(
                    item =>
                        String(
                            item.materialId ||
                            ""
                        ) ===
                            materialId
                )
                : null;


        if (
            !issuedMaterial
        ) {

            throw new Error(
                "WarehouseBot：出库后 TEST 物资不存在"
            );
        }


        if (
            Number(
                issuedMaterial.availableQty ||
                0
            ) !==
                beforeAvailable -
                issueQty
        ) {

            throw new Error(
                "WarehouseBot：出库后可用库存扣减不正确"
            );
        }


        if (
            Number(
                issuedMaterial.issuedQty ||
                0
            ) <
                issueQty
        ) {

            throw new Error(
                "WarehouseBot：出库后已发放数量没有增加"
            );
        }


        const ledger =
            await this.readLocalStorage(
                "materialLedger"
            );


        const issueLedger =
            Array.isArray(
                ledger
            )
                ? ledger
                    .slice()
                    .reverse()
                    .find(
                        item =>
                            item &&
                            item.type ===
                                "出库"
                            &&
                            String(
                                item.materialId ||
                                ""
                            ) ===
                                materialId
                            &&
                            String(
                                item.personName ||
                                ""
                            ) ===
                                String(
                                    issuedRequest.personName ||
                                    issuedRequest.applicantName ||
                                    "-"
                                )
                    )
                : null;


        if (
            !issueLedger
        ) {

            throw new Error(
                "WarehouseBot：确认出库后没有生成物资出库台账"
            );
        }


        return {
            requestId,
            materialId,

            personId:
                String(
                    issuedRequest.personId ||
                    ""
                ),

            personName:
                String(
                    issuedRequest.personName ||
                    issuedRequest.applicantName ||
                    ""
                ),

            status:
                issuedRequest.status,

            actualQuantity:
                Number(
                    issuedRequest.actualQuantity ||
                    0
                ),

            availableBefore:
                beforeAvailable,

            availableAfter:
                Number(
                    issuedMaterial.availableQty ||
                    0
                ),

            issuedQty:
                Number(
                    issuedMaterial.issuedQty ||
                    0
                ),

            ledgerType:
                issueLedger.type,

            issuedAt:
                issuedRequest.issuedAt
        };
    }
}


module.exports = {
    WarehouseBot
};
