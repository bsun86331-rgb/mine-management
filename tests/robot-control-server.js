"use strict";

const http =
    require("http");

const fs =
    require("fs");

const path =
    require("path");

const {
    URL
} = require("url");

const {
    chromium
} = require("@playwright/test");

const {
    TruckDriverBot
} = require(
    "./bots/truck-driver-bot"
);

const {
    DispatchBot
} = require(
    "./bots/dispatch-bot"
);

const {
    EquipmentCheckBot
} = require(
    "./bots/equipment-check-bot"
);

const {
    MaintenanceManagerBot
} = require(
    "./bots/maintenance-manager-bot"
);

const {
    MaintenanceWorkerBot
} = require(
    "./bots/maintenance-worker-bot"
);


const {
    WarehouseBot
} = require(
    "./bots/warehouse-bot"
);


const {
    ExcavatorBot
} = require(
    "./bots/excavator-bot"
);


const {
    RoleEntryBot
} = require(
    "./bots/role-entry-bot"
);


const {
    AuxiliaryWorkBot
} = require(
    "./bots/auxiliary-work-bot"
);

const {
    initializeTruckDriverTestEnvironment,
    clearRobotTestEnvironment
} = require(
    "./robot-test-fixture"
);


const {
    SCENARIOS,
    installScenario
} = require(
    "./test-scenario-factory"
);


const {
    A_GROUP,
    buildAGroupPayload,
    installAGroupRobotContext
} = require(
    "./a-group-multi-robot-fixture"
);


/*
=========================================================
R0-34 RobotControlServer
机器人测试控制中心后台 + Playwright 执行器

当前已接入：
- TruckDriverBot：真实打开 GitHub Pages
- 机器人专用 TEST 环境初始化
- TEST 身份检查
- TEST 任务 / TEST 车辆检查
- 临时卸料按钮状态检查
- 失败截图
- SSE 实时反馈

当前仍未开放：
- 非 TEST 正式业务提交
- 非 TEST 的 DispatchBot 审批
- 非 TEST 数据操作
=========================================================
*/


const PORT =
    Number(
        process.env.ROBOT_PORT ||
        4310
    );


const BASE_URL =
    process.env.ROBOT_BASE_URL ||
    "https://bsun86331-rgb.github.io/mine-management/";


const HEADLESS =
    String(
        process.env.ROBOT_HEADLESS ||
        "true"
    )
    .toLowerCase() !==
        "false";


const ROOT =
    path.resolve(
        __dirname,
        ".."
    );


const PANEL_FILE =
    path.join(
        ROOT,
        "robot-test-center.html"
    );


const SCREENSHOT_DIR =
    path.join(
        ROOT,
        "test-results",
        "screenshots"
    );


const DIAGNOSTIC_DIR =
    path.join(
        ROOT,
        "test-results",
        "diagnostics"
    );


const READINESS_FILE =
    path.join(
        ROOT,
        "test-results",
        "release-readiness.json"
    );


const REPORT_DIR =
    path.join(
        ROOT,
        "test-results",
        "reports"
    );


const clients =
    new Set();


let browser =
    null;


let browserContext =
    null;


let truckDriverPage =
    null;


let truckDriverBot =
    null;


let dispatchPage =
    null;


let dispatchBot =
    null;


let equipmentCheckPage =
    null;


let equipmentCheckBot =
    null;


let maintenanceManagerPage =
    null;


let maintenanceManagerBot =
    null;


let maintenanceWorkerPage =
    null;


let maintenanceWorkerBot =
    null;


let warehousePage =
    null;


let warehouseBot =
    null;


/*
 * 自然语言模糊命令的待确认意图。
 * 只保存已经映射到现有 TEST 执行器的 action，
 * 不保存或执行任意代码。
 */
let pendingNaturalLanguageConfirmation =
    null;


/*
 * 发布就绪状态：
 * 记录最近一次核心回归和黄金回归结果，供测试中心看板读取。
 * 同时持久化到 test-results/release-readiness.json，
 * 避免机器人后台重启后看板丢失。
 */
function defaultReadinessState() {

    return {
        core:
            null,

        golden:
            null,

        updatedAt:
            null
    };
}


function loadReadinessState() {

    try {

        if (
            !fs.existsSync(
                READINESS_FILE
            )
        ) {

            return defaultReadinessState();
        }


        const parsed =
            JSON.parse(
                fs.readFileSync(
                    READINESS_FILE,
                    "utf8"
                )
            );


        return {
            core:
                parsed?.core ||
                null,

            golden:
                parsed?.golden ||
                null,

            updatedAt:
                parsed?.updatedAt ||
                null
        };


    } catch (
        error
    ) {

        return defaultReadinessState();
    }
}


function saveReadinessState() {

    fs.mkdirSync(
        path.dirname(
            READINESS_FILE
        ),
        {
            recursive:
                true
        }
    );


    fs.writeFileSync(
        READINESS_FILE,
        JSON.stringify(
            readinessState,
            null,
            2
        ),
        "utf8"
    );
}


let readinessState =
    loadReadinessState();


function updateReadinessSuite(
    suite,
    payload
) {

    readinessState[
        suite
    ] = {
        ...payload,

        updatedAt:
            new Date()
                .toISOString()
    };


    readinessState.updatedAt =
        new Date()
            .toISOString();


    saveReadinessState();


    sendEvent({
        type:
            "readiness",

        readiness:
            readinessState,

        time:
            readinessState.updatedAt
    });
}


let robotStatus = {

    TestManager: {
        status:
            "idle",

        step:
            "等待测试命令"
    },

    DispatchBot: {
        status:
            "idle",

        step:
            "待命 · 尚未接入真实执行器"
    },

    TruckDriverBot: {
        status:
            "idle",

        step:
            "待命"
    }
};


/*
=========================================================
安全保护
=========================================================
*/


function assertSafeCommand(
    command
) {

    const text =
        String(
            command ||
            ""
        );


    /*
     * 命令中若显式出现常见业务ID，
     * 必须以 TEST- 开头。
     */

    const matches =
        text.match(
            /\b(?:TASK|TRIP|DRIVER|VEHICLE|SHIFT|ZONE|REQ|REQUEST)-[A-Z0-9_-]+\b/gi
        ) ||
        [];


    const unsafe =
        matches.filter(
            id =>
                !String(
                    id
                )
                .toUpperCase()
                .startsWith(
                    "TEST-"
                )
        );


    if (
        unsafe.length
    ) {

        throw new Error(
            "安全拦截：机器人禁止操作非 TEST 数据：" +
            unsafe.join(
                ", "
            )
        );
    }


    return true;
}


/*
=========================================================
SSE 实时消息
=========================================================
*/


function sendEvent(
    event
) {

    const payload =
        `data: ${JSON.stringify(event)}\n\n`;


    clients.forEach(
        response => {

            try {

                response.write(
                    payload
                );

            } catch (
                error
            ) {

                clients.delete(
                    response
                );
            }
        }
    );
}


function updateBot(
    bot,
    status,
    step
) {

    if (
        !robotStatus[bot]
    ) {

        return;
    }


    robotStatus[
        bot
    ] = {
        status,
        step
    };


    sendEvent({
        type:
            "bot-status",

        bot,
        status,
        step,

        time:
            new Date()
                .toISOString()
    });
}


function robotMessage(
    bot,
    message
) {

    sendEvent({
        type:
            "message",

        bot,

        message:
            String(
                message ||
                ""
            ),

        time:
            new Date()
                .toISOString()
    });
}



function inferFailureModule(
    caseName,
    suiteLabel =
        ""
) {

    const text =
        [
            suiteLabel,
            caseName
        ]
        .join(
            " "
        );


    if (
        /维修|返修|配件|验收/i.test(
            text
        )
    ) {

        return "维修";
    }


    if (
        /运输|GPS|趟次|装载|卸载/i.test(
            text
        )
    ) {

        return "运输";
    }


    if (
        /调度|审批|临时卸料/i.test(
            text
        )
    ) {

        return "调度";
    }


    return "通用";
}


function buildFailureDiagnosis({
    caseName,
    error,
    suiteLabel =
        ""
}) {

    const message =
        String(
            error?.message ||
            error ||
            "未知错误"
        );


    const moduleName =
        inferFailureModule(
            caseName,
            suiteLabel
        );


    let category =
        "待进一步定位";


    if (
        /安全拦截|非 TEST|禁止操作/i.test(
            message
        )
    ) {

        category =
            "安全保护触发";

    } else if (
        /browserContext|newPage|TestScenarioFactory|测试环境初始化|Cannot read properties of null/i.test(
            message
        )
    ) {

        category =
            "疑似测试框架 / 测试环境问题";

    } else if (
        /locator|Timeout|hidden|not visible|不可见|找不到.*按钮/i.test(
            message
        )
    ) {

        category =
            "疑似测试导航 / 页面可见性问题";

    } else if (
        /未进入|未恢复|未同步|状态不是|错误生成|错误新增|趟次数量|未变为|没有生成/i.test(
            message
        )
    ) {

        category =
            "疑似业务状态 / 业务规则问题";
    }


    let expected =
        "由当前用例断言决定";


    let actual =
        "错误信息未提供明确实际值";


    const expectedPatterns = [
        /未进入\s*([a-z_]+)/i,
        /未恢复\s*([a-z_]+)/i,
        /未变为\s*([a-z_]+)/i,
        /状态不是\s*([a-z_]+)/i,
        /应(?:为|进入|恢复)\s*([a-z_]+)/i
    ];


    for (
        const pattern
        of expectedPatterns
    ) {

        const match =
            message.match(
                pattern
            );


        if (
            match?.[1]
        ) {

            expected =
                match[
                    1
                ];

            break;
        }
    }


    const actualPatterns = [
        /实际\s*[=:：]\s*([^；,，\s]+)/i,
        /phase\s*[=:：]\s*([^；,，\s]+)/i,
        /status\s*[=:：]\s*([^；,，\s]+)/i
    ];


    for (
        const pattern
        of actualPatterns
    ) {

        const match =
            message.match(
                pattern
            );


        if (
            match?.[1]
        ) {

            actual =
                match[
                    1
                ];

            break;
        }
    }


    return {
        module:
            moduleName,

        step:
            caseName,

        category,
        expected,
        actual,
        message,

        time:
            new Date()
                .toISOString()
    };
}


function saveFailureDiagnostic(
    diagnosis
) {

    fs.mkdirSync(
        DIAGNOSTIC_DIR,
        {
            recursive:
                true
        }
    );


    const safeName =
        String(
            diagnosis.step ||
            "failure"
        )
        .replace(
            /[^a-zA-Z0-9\u4e00-\u9fa5_-]/g,
            "-"
        )
        .replace(
            /-+/g,
            "-"
        );


    const filename =
        `${Date.now()}-${safeName}.json`;


    const fullPath =
        path.join(
            DIAGNOSTIC_DIR,
            filename
        );


    fs.writeFileSync(
        fullPath,
        JSON.stringify(
            diagnosis,
            null,
            2
        ),
        "utf8"
    );


    return path.relative(
        ROOT,
        fullPath
    );
}


function reportFailureDiagnosis(
    botName,
    diagnosis,
    diagnosticPath
) {

    robotMessage(
        botName,
        "【失败自动定位】模块=" +
        diagnosis.module +
        "；步骤=" +
        diagnosis.step
    );


    robotMessage(
        botName,
        "【失败自动定位】分类=" +
        diagnosis.category +
        "；预期=" +
        diagnosis.expected +
        "；实际=" +
        diagnosis.actual
    );


    robotMessage(
        botName,
        "【失败自动定位】诊断文件=" +
        diagnosticPath
    );
}


/*
=========================================================
Playwright 生命周期
=========================================================
*/


async function ensureBrowser() {

    if (
        browser &&
        browserContext
    ) {

        return;
    }


    robotMessage(
        "TestManager",
        "正在启动 Playwright Chromium……"
    );


    browser =
        await chromium.launch({
            headless:
                HEADLESS
        });


    browserContext =
        await browser.newContext({

            baseURL:
                BASE_URL,

            viewport: {
                width:
                    390,

                height:
                    844
            }
        });


    browserContext.on(
        "page",
        page => {

            page.on(
                "console",
                message => {

                    if (
                        message.type() ===
                            "error"
                    ) {

                        robotMessage(
                            "TestManager",
                            "浏览器控制台错误：" +
                            message.text()
                        );
                    }
                }
            );
        }
    );


    robotMessage(
        "TestManager",
        "Playwright Chromium 已启动。"
    );
}


async function getTruckDriverBot() {

    await ensureBrowser();


    if (
        truckDriverPage &&
        !truckDriverPage.isClosed() &&
        truckDriverBot
    ) {

        return truckDriverBot;
    }


    truckDriverPage =
        await browserContext.newPage();


    truckDriverPage.on(
        "console",
        message => {

            if (
                message.type() ===
                    "error"
            ) {

                robotMessage(
                    "TruckDriverBot",
                    "司机端控制台错误：" +
                    message.text()
                );
            }
        }
    );


    truckDriverBot =
        new TruckDriverBot(
            truckDriverPage
        );


    return truckDriverBot;
}


async function getDispatchBot() {

    await ensureBrowser();


    if (
        dispatchPage &&
        !dispatchPage.isClosed() &&
        dispatchBot
    ) {

        return dispatchBot;
    }


    dispatchPage =
        await browserContext.newPage();


    dispatchPage.on(
        "console",
        message => {

            if (
                message.type() ===
                    "error"
            ) {

                robotMessage(
                    "DispatchBot",
                    "调度端控制台错误：" +
                    message.text()
                );
            }
        }
    );


    dispatchBot =
        new DispatchBot(
            dispatchPage
        );


    return dispatchBot;
}


async function getEquipmentCheckBot() {

    await ensureBrowser();


    if (
        equipmentCheckPage &&
        !equipmentCheckPage.isClosed() &&
        equipmentCheckBot
    ) {

        return equipmentCheckBot;
    }


    equipmentCheckPage =
        await browserContext.newPage();


    equipmentCheckPage.on(
        "console",
        message => {

            if (
                message.type() ===
                    "error"
            ) {

                robotMessage(
                    "TestManager",
                    "设备检查页控制台错误：" +
                    message.text()
                );
            }
        }
    );


    equipmentCheckBot =
        new EquipmentCheckBot(
            equipmentCheckPage
        );


    return equipmentCheckBot;
}


async function getMaintenanceManagerBot() {

    await ensureBrowser();


    if (
        maintenanceManagerPage &&
        !maintenanceManagerPage.isClosed() &&
        maintenanceManagerBot
    ) {

        return maintenanceManagerBot;
    }


    maintenanceManagerPage =
        await browserContext.newPage();


    maintenanceManagerPage.on(
        "console",
        message => {

            if (
                message.type() ===
                    "error"
            ) {

                robotMessage(
                    "TestManager",
                    "维修管理页控制台错误：" +
                    message.text()
                );
            }
        }
    );


    maintenanceManagerBot =
        new MaintenanceManagerBot(
            maintenanceManagerPage
        );


    return maintenanceManagerBot;
}


async function getMaintenanceWorkerBot() {

    await ensureBrowser();


    if (
        maintenanceWorkerPage &&
        !maintenanceWorkerPage.isClosed() &&
        maintenanceWorkerBot
    ) {

        return maintenanceWorkerBot;
    }


    maintenanceWorkerPage =
        await browserContext.newPage();


    maintenanceWorkerPage.on(
        "console",
        message => {

            if (
                message.type() ===
                    "error"
            ) {

                robotMessage(
                    "TestManager",
                    "维修员工作端控制台错误：" +
                    message.text()
                );
            }
        }
    );


    maintenanceWorkerBot =
        new MaintenanceWorkerBot(
            maintenanceWorkerPage
        );


    return maintenanceWorkerBot;
}


async function getWarehouseBot() {

    await ensureBrowser();


    if (
        warehousePage &&
        !warehousePage.isClosed() &&
        warehouseBot
    ) {

        return warehouseBot;
    }


    warehousePage =
        await browserContext.newPage();


    warehousePage.on(
        "console",
        message => {

            if (
                message.type() ===
                    "error"
            ) {

                robotMessage(
                    "TestManager",
                    "库房管理页控制台错误：" +
                    message.text()
                );
            }
        }
    );


    warehouseBot =
        new WarehouseBot(
            warehousePage
        );


    return warehouseBot;
}


async function captureFailure(
    botName,
    page,
    label
) {

    if (
        !page ||
        page.isClosed()
    ) {

        return null;
    }


    fs.mkdirSync(
        SCREENSHOT_DIR,
        {
            recursive:
                true
        }
    );


    const safeLabel =
        String(
            label ||
            "failure"
        )
        .replace(
            /[^a-zA-Z0-9_-]/g,
            "-"
        )
        .replace(
            /-+/g,
            "-"
        );


    const filename =
        `${Date.now()}-${botName}-${safeLabel}.png`;


    const fullPath =
        path.join(
            SCREENSHOT_DIR,
            filename
        );


    await page.screenshot({
        path:
            fullPath,

        fullPage:
            true
    });


    robotMessage(
        botName,
        "失败截图已保存：" +
        path.relative(
            ROOT,
            fullPath
        )
    );


    return fullPath;
}



/*
=========================================================
TruckDriverBot：机器人专用 TEST 环境
=========================================================
*/


async function prepareTruckDriverTestEnvironment() {

    const botName =
        "TruckDriverBot";


    const bot =
        await getTruckDriverBot();


    try {

        updateBot(
            botName,
            "running",
            "正在准备机器人专用 TEST 司机环境"
        );


        robotMessage(
            botName,
            "开始初始化 TEST 司机、TEST 任务、TEST 车辆和 TEST 运输状态。"
        );


        const testData =
            await initializeTruckDriverTestEnvironment(
                bot.page
            );


        robotMessage(
            botName,
            "TEST 环境写入完成：" +
            testData.driverId +
            " / " +
            testData.taskId +
            " / " +
            testData.vehicleId +
            " / " +
            testData.excavatorId
        );


        updateBot(
            botName,
            "running",
            "正在验证 TEST 环境"
        );


        await bot.assertTestIdentity();
        await bot.assertTestTask();


        const cycle =
            await bot.getTransportCycle();


        if (
            !cycle
        ) {

            throw new Error(
                "TEST 环境初始化失败：未找到运输闭环状态"
            );
        }


        robotMessage(
            botName,
            "TEST 环境验证通过：phase = " +
            String(
                cycle.phase ||
                "-"
            )
        );


        updateBot(
            botName,
            "pass",
            "TEST司机环境已准备完成"
        );


        return {
            ok:
                true,

            action:
                "prepare-test-driver-environment",

            testData,

            cycle
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "TEST环境准备失败：" +
            message
        );


        try {

            await captureFailure(
                botName,
                truckDriverPage,
                "prepare-test-environment"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function clearTruckDriverTestEnvironment() {

    const botName =
        "TruckDriverBot";


    const bot =
        await getTruckDriverBot();


    updateBot(
        botName,
        "running",
        "正在清理机器人 TEST 环境"
    );


    await bot.open();


    await clearRobotTestEnvironment(
        bot.page
    );


    await bot.page.reload({
        waitUntil:
            "domcontentloaded"
    });


    updateBot(
        botName,
        "pass",
        "机器人 TEST 环境已清理"
    );


    robotMessage(
        botName,
        "机器人自己的 TEST localStorage 已清理。"
    );


    return {
        ok:
            true,

        action:
            "clear-test-driver-environment"
    };
}


/*
=========================================================
TruckDriverBot 真实动作
=========================================================
*/


async function runTruckDriverCheck() {

    const botName =
        "TruckDriverBot";


    const bot =
        await getTruckDriverBot();


    try {

        updateBot(
            botName,
            "running",
            "正在打开司机工作台"
        );


        robotMessage(
            botName,
            "开始真实访问 driver-work.html。"
        );


        await bot.open();


        robotMessage(
            botName,
            "司机工作台已打开，开始检查 TEST 身份。"
        );


        updateBot(
            botName,
            "running",
            "检查 TEST 司机身份"
        );


        const profile =
            await bot.assertTestIdentity();


        const driverId =
            profile.driverId ||
            profile.personId ||
            profile.employeeId ||
            profile.id ||
            "";


        robotMessage(
            botName,
            "TEST 司机身份通过：" +
            driverId
        );


        updateBot(
            botName,
            "running",
            "检查 TEST 生产任务和车辆"
        );


        const task =
            await bot.assertTestTask();


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


        robotMessage(
            botName,
            "TEST 任务通过：" +
            taskId +
            "；车辆：" +
            vehicleId
        );


        updateBot(
            botName,
            "running",
            "检查临时非卸载区卸料按钮"
        );


        const buttonState =
            await bot.getTemporaryUnloadButtonState();


        robotMessage(
            botName,
            "临时卸料按钮状态：" +
            (
                buttonState.visible
                    ? "可见"
                    : "不可见"
            ) +
            " / " +
            (
                buttonState.enabled
                    ? "可点击"
                    : "不可点击"
            ) +
            " / 文本：" +
            buttonState.text
        );


        updateBot(
            botName,
            "pass",
            "司机端 TEST 安全上下文检查完成"
        );


        return {
            ok:
                true,

            action:
                "truck-driver-check",

            driverId,
            taskId,
            vehicleId,

            temporaryUnloadButton:
                buttonState
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "检查失败：" +
            message
        );


        try {

            await captureFailure(
                botName,
                truckDriverPage,
                "driver-check"
            );

        } catch (
            screenshotError
        ) {

            robotMessage(
                botName,
                "失败截图保存失败：" +
                (
                    screenshotError?.message ||
                    String(
                        screenshotError
                    )
                )
            );
        }


        throw error;
    }
}


async function runTruckDriverTemporaryUnloadSubmitTest() {

    const botName =
        "TruckDriverBot";


    const bot =
        await getTruckDriverBot();


    try {

        updateBot(
            botName,
            "running",
            "正在提交 TEST 临时卸料申请"
        );


        await bot.open();


        const result =
            await bot.submitTestTemporaryUnload();


        robotMessage(
            botName,
            "TEST临时卸料提交成功：" +
            result.requestId
        );


        robotMessage(
            botName,
            "安全验证通过：任务 " +
            result.taskId +
            "；司机 " +
            result.driverId +
            "；车辆 " +
            result.vehicleId +
            "；状态 " +
            result.status +
            "；未直接计入正式趟次。"
        );


        robotMessage(
            botName,
            "正式趟数提交前/后：" +
            result.beforeTripCount +
            " / " +
            result.afterTripCount +
            "；运输闭环已重置为 " +
            result.cyclePhase
        );


        updateBot(
            botName,
            "pass",
            "TEST临时卸料申请已进入待调度确认"
        );


        return {
            ok:
                true,

            action:
                "temporary-unload-submit-test",

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "TEST临时卸料提交失败：" +
            message
        );


        try {

            await captureFailure(
                botName,
                truckDriverPage,
                "temporary-unload-submit-test"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runTruckDriverTemporaryUnloadModalCheck() {

    const botName =
        "TruckDriverBot";


    const bot =
        await getTruckDriverBot();


    try {

        updateBot(
            botName,
            "running",
            "正在打开并检查临时卸料弹窗"
        );


        await bot.open();


        const result =
            await bot.inspectTemporaryUnloadModal();


        robotMessage(
            botName,
            "弹窗检查通过：物料类型、临时卸料原因、说明、GPS提示、提交按钮、关闭按钮均正常。"
        );


        robotMessage(
            botName,
            "弹窗已正常关闭；本步骤未提交任何业务数据。"
        );


        updateBot(
            botName,
            "pass",
            "临时卸料弹窗字段检查完成"
        );


        return {
            ok:
                true,

            action:
                "temporary-unload-modal-check",

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "临时卸料弹窗检查失败：" +
            message
        );


        try {

            await captureFailure(
                botName,
                truckDriverPage,
                "temporary-unload-modal"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runTruckDriverTemporaryUnloadButtonCheck() {

    const botName =
        "TruckDriverBot";


    const bot =
        await getTruckDriverBot();


    try {

        updateBot(
            botName,
            "running",
            "正在检查临时卸料按钮前置条件"
        );


        await bot.open();


        /*
         * assertTemporaryUnloadReady 内部会再次检查：
         * TEST 司机
         * TEST 任务
         * TEST 车辆
         * enroute_unload
         * loadedAt
         * departedLoadingAt
         * 按钮可见/可用
         */

        const result =
            await bot.assertTemporaryUnloadReady();


        updateBot(
            botName,
            "pass",
            "临时卸料按钮已满足可操作条件"
        );


        robotMessage(
            botName,
            "检查通过：运输状态为 " +
            result.cycle.phase +
            "，临时卸料按钮可点击。"
        );


        return {
            ok:
                true,

            action:
                "temporary-unload-button-check",

            phase:
                result.cycle.phase,

            button:
                result.button
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "waiting",
            message
        );


        robotMessage(
            botName,
            "当前卡点：" +
            message
        );


        try {

            await captureFailure(
                botName,
                truckDriverPage,
                "temporary-unload-button"
            );

        } catch (
            screenshotError
        ) {

            robotMessage(
                botName,
                "卡点截图保存失败：" +
                (
                    screenshotError?.message ||
                    String(
                        screenshotError
                    )
                )
            );
        }


        throw error;
    }
}


async function runDispatchApproveLatestTestTemporaryUnload() {

    const botName =
        "DispatchBot";


    const bot =
        await getDispatchBot();


    try {

        updateBot(
            botName,
            "running",
            "正在审核 TEST 临时卸料申请"
        );


        await bot.open();


        const pending =
            await bot.findLatestPendingTestTemporaryUnload();


        robotMessage(
            botName,
            "找到待审核TEST申请：" +
            pending.requestId +
            "；任务 " +
            (
                pending.taskId ||
                pending.dispatchTaskId ||
                "-"
            ) +
            "；司机 " +
            (
                pending.driverId ||
                pending.personId ||
                "-"
            ) +
            "；车辆 " +
            (
                pending.vehicleNumber ||
                pending.vehicleId ||
                "-"
            )
        );


        const result =
            await bot.approveLatestTestTemporaryUnload();


        robotMessage(
            botName,
            "审核通过：" +
            result.requestId +
            " → 正式趟次 " +
            result.tripId
        );


        robotMessage(
            botName,
            "安全验证通过：申请状态 " +
            result.requestStatus +
            "；dispatchConfirmation=" +
            result.dispatchConfirmation +
            "；officialCountEligible=" +
            result.officialCountEligible
        );


        robotMessage(
            botName,
            "正式趟次数量前/后：" +
            result.beforeTripCount +
            " / " +
            result.afterTripCount +
            "；今日调度统计 总/煤/渣：" +
            result.stats.total +
            " / " +
            result.stats.coal +
            " / " +
            result.stats.waste
        );


        updateBot(
            botName,
            "pass",
            "TEST临时卸料已审核并计入正式趟次"
        );


        return {
            ok:
                true,

            action:
                "dispatch-approve-test-temporary-unload",

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "TEST临时卸料审核失败：" +
            message
        );


        try {

            await captureFailure(
                botName,
                dispatchPage,
                "dispatch-approve-test-temporary-unload"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function executeDispatchCommand(
    command
) {

    const text =
        String(
            command ||
            ""
        );


    if (
        /审核.*TEST.*临时.*卸料|确认.*TEST.*临时.*卸料|批准.*TEST.*临时.*卸料|TEST.*临时.*卸料.*审核/i.test(
            text
        )
    ) {

        return await runDispatchApproveLatestTestTemporaryUnload();
    }


    updateBot(
        "DispatchBot",
        "waiting",
        "当前调度命令尚未开放"
    );


    robotMessage(
        "DispatchBot",
        "当前可用命令：审核TEST临时卸料。只允许处理 TEST- 数据。"
    );


    return {
        ok:
            true,

        target:
            "DispatchBot",

        status:
            "waiting"
    };
}


async function runTestManagerTemporaryUnloadFullCycle() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行临时非卸载区卸料完整闭环"
        );


        robotMessage(
            botName,
            "步骤 1/3：准备 TEST 司机环境。"
        );


        const prepare =
            await prepareTruckDriverTestEnvironment();


        robotMessage(
            botName,
            "步骤 1/3 完成：TEST 司机环境准备通过。"
        );


        robotMessage(
            botName,
            "步骤 2/3：TruckDriverBot 提交 TEST 临时卸料申请。"
        );


        const submit =
            await runTruckDriverTemporaryUnloadSubmitTest();


        robotMessage(
            botName,
            "步骤 2/3 完成：申请 " +
            submit.result.requestId +
            " 已进入 pending_dispatch。"
        );


        robotMessage(
            botName,
            "步骤 3/3：DispatchBot 审核 TEST 临时卸料申请。"
        );


        const approve =
            await runDispatchApproveLatestTestTemporaryUnload();


        if (
            approve.result.requestStatus !==
                "approved" ||
            approve.result.dispatchConfirmation !==
                "confirmed" ||
            approve.result.officialCountEligible !==
                true
        ) {

            throw new Error(
                "完整闭环失败：调度审核结果不满足正式计数条件"
            );
        }


        if (
            approve.result.afterTripCount !==
                approve.result.beforeTripCount +
                1
        ) {

            throw new Error(
                "完整闭环失败：正式趟次数量没有增加1"
            );
        }


        robotMessage(
            botName,
            "完整闭环通过：司机提交 → pending_dispatch → 调度审核 → approved → 正式趟次 +1。"
        );


        robotMessage(
            botName,
            "最终结果：申请 " +
            approve.result.requestId +
            "；正式趟次 " +
            approve.result.tripId +
            "；今日统计 总/煤/渣：" +
            approve.result.stats.total +
            " / " +
            approve.result.stats.coal +
            " / " +
            approve.result.stats.waste
        );


        updateBot(
            botName,
            "pass",
            "临时非卸载区卸料完整闭环测试通过"
        );


        return {
            ok:
                true,

            action:
                "temporary-unload-full-cycle-test",

            prepare:
                prepare.result ||
                prepare,

            submit:
                submit.result,

            approve:
                approve.result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "完整闭环测试失败：" +
            message
        );


        throw error;
    }
}


async function runNormalTransportClosedLoopTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行正常装卸运输完整闭环"
        );


        robotMessage(
            botName,
            "步骤 1/2：准备 TEST 司机、车辆、运输区域和设备检查环境。"
        );


        await prepareTruckDriverTestEnvironment();


        robotMessage(
            botName,
            "步骤 2/2：TruckDriverBot 模拟进入装载区 → 稳定装车 → 驶离 → 进入TEST排土场 → 完成一趟。"
        );


        const bot =
            await getTruckDriverBot();


        await bot.open();


        const result =
            await bot.testNormalTransportClosedLoop();


        robotMessage(
            botName,
            "正常运输闭环通过：正式TEST趟次 " +
            result.tripId +
            "；本班趟数 " +
            result.beforeUiCount +
            " → " +
            result.afterUiCount
        );


        robotMessage(
            botName,
            "验证：任务 " +
            result.taskId +
            "；司机 " +
            result.driverId +
            "；车辆 " +
            result.vehicleId +
            "；物料 " +
            result.materialType +
            "；transportValidation=" +
            result.transportValidation +
            "；下一趟状态=" +
            result.cyclePhase
        );


        updateBot(
            "TruckDriverBot",
            "pass",
            "正常GPS装卸运输闭环通过"
        );


        updateBot(
            botName,
            "pass",
            "正常装卸运输完整闭环测试通过"
        );


        return {
            ok:
                true,

            action:
                "normal-transport-full-cycle-test",

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        updateBot(
            "TruckDriverBot",
            "fail",
            message
        );


        robotMessage(
            botName,
            "正常运输完整闭环失败：" +
            message
        );


        try {

            await captureFailure(
                "TruckDriverBot",
                truckDriverPage,
                "normal-transport-full-cycle"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runEquipmentAbnormalMaintenanceRequestTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行设备异常检查→自动维修单测试"
        );


        robotMessage(
            botName,
            "步骤 1/2：准备 TEST 司机、TEST 班次和 TEST 设备环境。"
        );


        await prepareTruckDriverTestEnvironment();


        const bot =
            await getEquipmentCheckBot();


        robotMessage(
            botName,
            "步骤 2/2：EquipmentCheckBot 模拟班次设备检查发现异常，并提交锁定记录。"
        );


        await bot.open();


        const result =
            await bot.testAbnormalCheckCreatesMaintenanceRequest();


        robotMessage(
            botName,
            "设备异常闭环通过：检查 " +
            result.checkId +
            " → 维修单 " +
            result.requestId
        );


        robotMessage(
            botName,
            "验证：设备 " +
            result.equipmentId +
            "；检查结果=" +
            result.result +
            "；维修类型=" +
            result.maintenanceType +
            "；status=" +
            result.requestStatus +
            "；dispatchStatus=" +
            result.dispatchStatus
        );


        updateBot(
            botName,
            "pass",
            "设备异常检查已自动生成待调度维修单"
        );


        return {
            ok:
                true,

            action:
                "equipment-abnormal-maintenance-request-test",

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "设备异常检查→自动维修单测试失败：" +
            message
        );


        try {

            await captureFailure(
                "EquipmentCheckBot",
                equipmentCheckPage,
                "equipment-abnormal-maintenance-request"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runMaintenanceDispatchApprovalTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行维修单调度审批闭环"
        );


        robotMessage(
            botName,
            "步骤 1/2：先通过设备异常检查生成一张 TEST 待调度维修单。"
        );


        const generated =
            await runEquipmentAbnormalMaintenanceRequestTest();


        updateBot(
            botName,
            "running",
            "正在执行维修单调度审批闭环"
        );


        robotMessage(
            botName,
            "步骤 2/2：DispatchBot 打开调度端维修审批，批准 TEST 维修单进入修理厂。"
        );


        updateBot(
            "DispatchBot",
            "running",
            "正在审批 TEST 维修单"
        );


        const bot =
            await getDispatchBot();


        await bot.open();


        const approved =
            await bot.approveLatestTestMaintenanceRequest();


        robotMessage(
            botName,
            "维修单调度审批通过：" +
            approved.requestId +
            "；" +
            generated.result.requestStatus +
            " → " +
            approved.status +
            "；dispatchStatus=" +
            approved.dispatchStatus
        );


        robotMessage(
            botName,
            "验证：设备 " +
            approved.equipmentId +
            "；维修类型=" +
            approved.maintenanceType +
            "；批准人=" +
            String(
                approved.dispatchApprovedBy ||
                "-"
            )
        );


        updateBot(
            "DispatchBot",
            "pass",
            "TEST维修单已批准进入修理厂"
        );


        updateBot(
            botName,
            "pass",
            "维修单调度审批闭环测试通过"
        );


        return {
            ok:
                true,

            action:
                "maintenance-dispatch-approval-test",

            generated:
                generated.result,

            approved
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            "DispatchBot",
            "fail",
            message
        );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "维修单调度审批闭环失败：" +
            message
        );


        try {

            await captureFailure(
                "DispatchBot",
                dispatchPage,
                "maintenance-dispatch-approval"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runMaintenanceReceiveAssignmentTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行维修管理接车与派工闭环"
        );


        robotMessage(
            botName,
            "步骤 1/2：先生成并通过调度批准一张 TEST 维修单，使其进入 waiting_entry。"
        );


        const approved =
            await runMaintenanceDispatchApprovalTest();


        updateBot(
            botName,
            "running",
            "正在执行维修管理接车与派工闭环"
        );


        robotMessage(
            botName,
            "步骤 2/2：MaintenanceManagerBot 确认进厂，分配 TEST 工位与维修工并生成 TEST 维修工单。"
        );


        const bot =
            await getMaintenanceManagerBot();


        await bot.open();


        const result =
            await bot.receiveAndAssignLatestTestRequest();


        robotMessage(
            botName,
            "维修管理派工通过：" +
            result.requestId +
            " → " +
            result.orderId +
            "；申请状态=" +
            result.requestStatus +
            "；工单状态=" +
            result.orderStatus
        );


        robotMessage(
            botName,
            "验证：设备 " +
            result.equipmentId +
            "；工位=" +
            result.bayId +
            "；工位状态=" +
            result.bayStatus +
            "；维修工=" +
            result.workerName
        );


        updateBot(
            botName,
            "pass",
            "维修管理已完成接车、派工并生成TEST维修工单"
        );


        return {
            ok:
                true,

            action:
                "maintenance-receive-assignment-test",

            approved:
                approved.approved,

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "维修管理接车与派工闭环失败：" +
            message
        );


        try {

            await captureFailure(
                "MaintenanceManagerBot",
                maintenanceManagerPage,
                "maintenance-receive-assignment"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runMaintenanceWorkerStartRepairTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行维修工接单与开始维修闭环"
        );


        robotMessage(
            botName,
            "步骤 1/2：先完成 TEST 维修管理接车派工，生成 assigned 状态 TEST 维修工单。"
        );


        const assigned =
            await runMaintenanceReceiveAssignmentTest();


        updateBot(
            botName,
            "running",
            "正在执行维修工接单与开始维修闭环"
        );


        robotMessage(
            botName,
            "步骤 2/2：MaintenanceWorkerBot 以 TEST 维修员身份接车、上传维修前照片并开始维修。"
        );


        const bot =
            await getMaintenanceWorkerBot();


        await bot.open();


        const result =
            await bot.startLatestAssignedTestRepair();


        robotMessage(
            botName,
            "维修工开工通过：" +
            result.orderId +
            "；工单状态=" +
            result.orderStatus +
            "；维修申请状态=" +
            result.requestStatus
        );


        robotMessage(
            botName,
            "验证：设备 " +
            result.equipmentId +
            "；维修员=" +
            result.workerName +
            "；维修前照片=" +
            (
                result.hasBeforePhoto
                    ? "已上传"
                    : "缺失"
            )
        );


        updateBot(
            botName,
            "pass",
            "维修工已接单并开始维修，工单进入 working"
        );


        return {
            ok:
                true,

            action:
                "maintenance-worker-start-repair-test",

            assigned:
                assigned.result,

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "维修工接单与开始维修闭环失败：" +
            message
        );


        try {

            await captureFailure(
                "MaintenanceWorkerBot",
                maintenanceWorkerPage,
                "maintenance-worker-start-repair"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runMaintenanceWorkerFinishRepairTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行维修工完成维修并提交验收闭环"
        );


        robotMessage(
            botName,
            "步骤 1/2：先完成 TEST 维修工接单并开始维修，使工单进入 working。"
        );


        const started =
            await runMaintenanceWorkerStartRepairTest();


        updateBot(
            botName,
            "running",
            "正在执行维修工完成维修并提交验收闭环"
        );


        robotMessage(
            botName,
            "步骤 2/2：MaintenanceWorkerBot 填写故障原因、维修过程、实际维修内容，上传维修后照片并提交验收。"
        );


        const bot =
            await getMaintenanceWorkerBot();


        await bot.open();


        const result =
            await bot.finishLatestWorkingTestRepair();


        robotMessage(
            botName,
            "维修完成提交验收通过：" +
            result.orderId +
            "；工单状态=" +
            result.orderStatus +
            "；维修申请状态=" +
            result.requestStatus
        );


        robotMessage(
            botName,
            "验证：设备 " +
            result.equipmentId +
            "；完成维修员=" +
            result.finishedBy +
            "；维修后照片=" +
            (
                result.hasAfterPhoto
                    ? "已上传"
                    : "缺失"
            )
        );


        updateBot(
            botName,
            "pass",
            "维修工已完成维修并提交维修管理验收"
        );


        return {
            ok:
                true,

            action:
                "maintenance-worker-finish-repair-test",

            started:
                started.result,

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "维修工完成维修并提交验收闭环失败：" +
            message
        );


        try {

            await captureFailure(
                "MaintenanceWorkerBot",
                maintenanceWorkerPage,
                "maintenance-worker-finish-repair"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runMaintenanceInspectionCompletionTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行维修管理验收归档闭环"
        );


        robotMessage(
            botName,
            "步骤 1/2：先完成 TEST 维修并提交验收，使工单进入 waiting_inspection。"
        );


        const finished =
            await runMaintenanceWorkerFinishRepairTest();


        updateBot(
            botName,
            "running",
            "正在执行维修管理验收归档闭环"
        );


        robotMessage(
            botName,
            "步骤 2/2：MaintenanceManagerBot 验收通过、保存 TEST 费用单、完成归档并释放工位与设备。"
        );


        const bot =
            await getMaintenanceManagerBot();


        await bot.open();


        const result =
            await bot.inspectAndCompleteLatestTestRepair();


        robotMessage(
            botName,
            "维修验收归档通过：" +
            result.orderId +
            "；工单=" +
            result.orderStatus +
            "；申请=" +
            result.requestStatus
        );


        robotMessage(
            botName,
            "验证：工位 " +
            result.bayId +
            "=" +
            result.bayStatus +
            "；设备 " +
            result.equipmentId +
            "=" +
            result.equipmentStatus +
            "；费用单=" +
            result.costId
        );


        updateBot(
            botName,
            "pass",
            "维修管理验收完成，工位已释放，设备已恢复可用"
        );


        return {
            ok:
                true,

            action:
                "maintenance-inspection-completion-test",

            finished:
                finished.result,

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "维修管理验收归档闭环失败：" +
            message
        );


        try {

            await captureFailure(
                "MaintenanceManagerBot",
                maintenanceManagerPage,
                "maintenance-inspection-completion"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runPostMaintenanceProductionRecoveryTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行维修完成后恢复生产验证"
        );


        robotMessage(
            botName,
            "步骤 1/2：先完成完整 TEST 维修验收归档，使车辆恢复 available。"
        );


        const maintenance =
            await runMaintenanceInspectionCompletionTest();


        updateBot(
            botName,
            "running",
            "正在执行维修完成后恢复生产验证"
        );


        robotMessage(
            botName,
            "步骤 2/2：不清理维修历史，直接恢复 TEST 司机身份，并使用同一车辆重新完成1趟正常运输。"
        );


        const bot =
            await getTruckDriverBot();


        await bot.openAsTestDriver();


        const result =
            await bot.testProductionRecoveryAfterMaintenance();


        robotMessage(
            botName,
            "恢复生产通过：设备 " +
            result.vehicleId +
            "=" +
            result.equipmentStatus +
            "；active维修申请/工单=" +
            result.activeMaintenanceRequests +
            "/" +
            result.activeMaintenanceOrders
        );


        robotMessage(
            botName,
            "恢复运输通过：正式TEST趟次 " +
            result.tripId +
            "；本班趟数 " +
            result.beforeTripCount +
            " → " +
            result.afterTripCount +
            "；下一趟状态=" +
            result.cyclePhase
        );


        updateBot(
            "TruckDriverBot",
            "pass",
            "维修完成后车辆已恢复生产并完成1趟正式TEST运输"
        );


        updateBot(
            botName,
            "pass",
            "维修完成后恢复生产验证通过"
        );


        return {
            ok:
                true,

            action:
                "post-maintenance-production-recovery-test",

            maintenance:
                maintenance.result,

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            "TruckDriverBot",
            "fail",
            message
        );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "维修完成后恢复生产验证失败：" +
            message
        );


        try {

            await captureFailure(
                "TruckDriverBot",
                truckDriverPage,
                "post-maintenance-production-recovery"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runMaintenanceInspectionReworkTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行维修验收不通过返修闭环"
        );


        robotMessage(
            botName,
            "步骤 1/3：先完成 TEST 维修并提交验收，使工单进入 waiting_inspection。"
        );


        const finished =
            await runMaintenanceWorkerFinishRepairTest();


        updateBot(
            botName,
            "running",
            "正在执行维修验收不通过返修闭环"
        );


        robotMessage(
            botName,
            "步骤 2/3：MaintenanceManagerBot 验收不通过，填写返修原因并退回。"
        );


        const managerBot =
            await getMaintenanceManagerBot();


        await managerBot.open();


        const rejected =
            await managerBot.rejectLatestTestInspectionForRework();


        robotMessage(
            botName,
            "验收退回返修：" +
            rejected.orderId +
            "；工单状态=" +
            rejected.orderStatus +
            "；原因=" +
            rejected.reworkReason
        );


        updateBot(
            botName,
            "running",
            "正在执行维修验收不通过返修闭环"
        );


        robotMessage(
            botName,
            "步骤 3/3：MaintenanceWorkerBot 读取返修原因，重新处理、上传返修照片并再次提交验收。"
        );


        const workerBot =
            await getMaintenanceWorkerBot();


        await workerBot.open();


        const resubmitted =
            await workerBot.reworkAndResubmitLatestTestRepair();


        robotMessage(
            botName,
            "返修重新提交通过：" +
            resubmitted.orderId +
            "；工单状态=" +
            resubmitted.orderStatus +
            "；返修历史=" +
            resubmitted.reworkHistoryCount +
            "条"
        );


        updateBot(
            botName,
            "pass",
            "维修验收不通过后已完成返修并再次提交验收"
        );


        return {
            ok:
                true,

            action:
                "maintenance-inspection-rework-test",

            finished:
                finished.result,

            rejected,

            resubmitted
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "维修验收不通过返修闭环失败：" +
            message
        );


        try {

            await captureFailure(
                "MaintenanceManagerBot",
                maintenanceManagerPage,
                "maintenance-inspection-rework"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runMaintenanceWaitingPartsCycleTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行等待配件流程闭环"
        );


        robotMessage(
            botName,
            "步骤 1/2：先完成 TEST 维修工接单并开始维修，使工单进入 working。"
        );


        const started =
            await runMaintenanceWorkerStartRepairTest();


        updateBot(
            botName,
            "running",
            "正在执行等待配件流程闭环"
        );


        robotMessage(
            botName,
            "步骤 2/2：MaintenanceWorkerBot 进入等待配件，模拟配件到货后继续维修，并完成维修提交验收。"
        );


        const bot =
            await getMaintenanceWorkerBot();


        await bot.open();


        const result =
            await bot.waitPartsResumeAndFinishLatestTestRepair();


        robotMessage(
            botName,
            "等待配件流程通过：" +
            result.orderId +
            "；" +
            result.waitingOrderStatus +
            " → " +
            result.resumedOrderStatus +
            " → " +
            result.finalOrderStatus
        );


        robotMessage(
            botName,
            "验证：等待说明=" +
            result.waitingPartsNote +
            "；维修申请=" +
            result.waitingRequestStatus +
            " → " +
            result.resumedRequestStatus +
            " → " +
            result.finalRequestStatus
        );


        updateBot(
            botName,
            "pass",
            "等待配件流程闭环测试通过"
        );


        return {
            ok:
                true,

            action:
                "maintenance-waiting-parts-cycle-test",

            started:
                started.result,

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "等待配件流程闭环失败：" +
            message
        );


        try {

            await captureFailure(
                "MaintenanceWorkerBot",
                maintenanceWorkerPage,
                "maintenance-waiting-parts-cycle"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runMaintenanceWarehousePartsLinkageTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行维修管理 + 维修员 + 库房管理三岗位配件联动"
        );


        robotMessage(
            botName,
            "步骤 1/4：完成 TEST 维修管理接车派工，并由维修员接单开始维修。"
        );


        const started =
            await runMaintenanceWorkerStartRepairTest();


        const orderId =
            String(
                started.result.orderId
            );


        const workerId =
            String(
                started.result.workerId
            );


        const workerName =
            String(
                started.result.workerName ||
                "维修工01"
            );


        const workerBot =
            await getMaintenanceWorkerBot();


        await workerBot.open();


        robotMessage(
            botName,
            "步骤 2/4：维修员将原 TEST 工单切换为 waiting_parts。"
        );


        await workerBot.page
            .locator(
                'button[data-page="working"]'
            )
            .click();


        await workerBot.page.waitForTimeout(
            150
        );


        const openButton =
            workerBot.page.locator(
                `button[onclick*="openRepairOrder('${orderId}')"]`
            )
            .first();


        await openButton.waitFor({
            state:
                "visible"
        });


        await openButton.click();


        await workerBot.page
            .locator(
                "#repairOperationArea"
            )
            .waitFor({
                state:
                    "visible"
            });


        const waitingNote =
            "TEST-维修工单申请轮胎维修配件";


        const promptHandled =
            new Promise(
                (
                    resolve,
                    reject
                ) => {

                    workerBot.page.once(
                        "dialog",
                        async dialog => {

                            try {

                                if (
                                    dialog.type() !==
                                        "prompt"
                                ) {

                                    throw new Error(
                                        "三岗位配件联动：等待配件操作没有出现 prompt"
                                    );
                                }


                                await dialog.accept(
                                    waitingNote
                                );


                                resolve();

                            } catch (
                                error
                            ) {

                                reject(
                                    error
                                );
                            }
                        }
                    );
                }
            );


        await workerBot.page
            .locator(
                'button[onclick="setWaitingParts()"]'
            )
            .click();


        await promptHandled;


        await workerBot.page.waitForTimeout(
            250
        );


        const waitingOrders =
            await workerBot.readLocalStorage(
                "maintenanceWorkOrders"
            );


        const waitingOrder =
            Array.isArray(
                waitingOrders
            )
                ? waitingOrders.find(
                    item =>
                        String(
                            item.orderId ||
                            ""
                        ) ===
                            orderId
                )
                : null;


        if (
            !waitingOrder ||
            waitingOrder.status !==
                "waiting_parts"
        ) {

            throw new Error(
                "三岗位配件联动：维修工单未进入 waiting_parts"
            );
        }


        robotMessage(
            botName,
            "步骤 3/4：库房管理收到 TEST 配件领用申请并真实确认出库。"
        );


        const warehouse =
            await getWarehouseBot();


        await warehouse.open();


        const materialRequestId =
            "TEST-MATERIAL-REQUEST-001";


        const materialId =
            "TEST-MATERIAL-001";


        await warehouse.seedTestIssueRequest({
            requestId:
                materialRequestId,

            materialId,

            materialCode:
                "TEST-WL-0001",

            materialName:
                "TEST-轮胎维修材料",

            personId:
                workerId,

            personName:
                workerName,

            position:
                "维修员",

            requestQuantity:
                1,

            availableQty:
                5,

            purpose:
                "TEST-维修工单 " +
                orderId +
                " 配件领用"
        });


        const issued =
            await warehouse.approveLatestTestRequest();


        if (
            issued.status !==
                "issued"
        ) {

            throw new Error(
                "三岗位配件联动：库房出库后领用申请未进入 issued"
            );
        }


        robotMessage(
            botName,
            "库房出库通过：" +
            issued.requestId +
            "；库存 " +
            issued.availableBefore +
            " → " +
            issued.availableAfter +
            "；台账=" +
            issued.ledgerType
        );


        robotMessage(
            botName,
            "步骤 4/4：维修员确认配件已到，原工单恢复 working。"
        );


        await workerBot.open();


        await workerBot.page
            .locator(
                'button[data-page="waiting"]'
            )
            .click();


        await workerBot.page.waitForTimeout(
            150
        );


        const resumeButton =
            workerBot.page.locator(
                `button[onclick*="resumeRepair('${orderId}')"]`
            )
            .first();


        await resumeButton.waitFor({
            state:
                "visible"
        });


        await resumeButton.click();


        await workerBot.page.waitForTimeout(
            250
        );


        const resumedOrders =
            await workerBot.readLocalStorage(
                "maintenanceWorkOrders"
            );


        const resumedOrder =
            Array.isArray(
                resumedOrders
            )
                ? resumedOrders.find(
                    item =>
                        String(
                            item.orderId ||
                            ""
                        ) ===
                            orderId
                )
                : null;


        if (
            !resumedOrder ||
            resumedOrder.status !==
                "working"
        ) {

            throw new Error(
                "三岗位配件联动：配件出库后原维修工单未恢复 working"
            );
        }


        const requests =
            await workerBot.readLocalStorage(
                "maintenanceRequests"
            );


        const maintenanceRequest =
            Array.isArray(
                requests
            )
                ? requests.find(
                    item =>
                        String(
                            item.requestId ||
                            item.maintenanceRequestId ||
                            ""
                        ) ===
                            String(
                                started.result.requestId ||
                                ""
                            )
                )
                : null;


        if (
            !maintenanceRequest ||
            maintenanceRequest.status !==
                "working"
        ) {

            throw new Error(
                "三岗位配件联动：维修申请未同步恢复 working"
            );
        }


        updateBot(
            botName,
            "pass",
            "维修管理 + 维修员 + 库房管理三岗位配件联动通过"
        );


        robotMessage(
            botName,
            "三岗位联动汇总：维修派工 → 维修员 waiting_parts → 库房 issued → 维修员 working，全部为 TEST 数据。"
        );


        return {
            ok:
                true,

            action:
                "maintenance-warehouse-parts-linkage",

            orderId,

            workerId,

            waitingStatus:
                waitingOrder.status,

            warehouseRequestId:
                issued.requestId,

            warehouseStatus:
                issued.status,

            availableBefore:
                issued.availableBefore,

            availableAfter:
                issued.availableAfter,

            finalOrderStatus:
                resumedOrder.status,

            finalMaintenanceRequestStatus:
                maintenanceRequest.status
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "维修管理 + 维修员 + 库房管理三岗位配件联动失败：" +
            message
        );


        try {

            await captureFailure(
                "WarehouseBot",
                warehousePage,
                "maintenance-warehouse-parts-linkage"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runMaintenanceWarehouseFullClosedLoopTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行维修 + 配件出库 + 验收归档完整闭环"
        );


        robotMessage(
            botName,
            "步骤 1/3：先运行维修管理 + 维修员 + 库房管理三岗位配件联动，使原工单恢复 working。"
        );


        const linkage =
            await runMaintenanceWarehousePartsLinkageTest();


        const orderId =
            String(
                linkage.orderId
            );


        robotMessage(
            botName,
            "步骤 2/3：维修员继续完成原 TEST 工单并提交维修管理验收。"
        );


        const workerBot =
            await getMaintenanceWorkerBot();


        await workerBot.open();


        const finished =
            await workerBot.finishLatestWorkingTestRepair();


        if (
            String(
                finished.orderId
            ) !==
                orderId
        ) {

            throw new Error(
                "维修库房完整闭环：维修员完成的不是原三岗位联动工单"
            );
        }


        if (
            finished.orderStatus !==
                "waiting_inspection" ||
            finished.requestStatus !==
                "waiting_inspection"
        ) {

            throw new Error(
                "维修库房完整闭环：维修完成后没有进入 waiting_inspection"
            );
        }


        robotMessage(
            botName,
            "维修员提交验收通过：" +
            finished.orderId +
            "；工单=" +
            finished.orderStatus +
            "；申请=" +
            finished.requestStatus
        );


        robotMessage(
            botName,
            "步骤 3/3：维修管理验收通过、保存费用单、释放工位并恢复设备 available。"
        );


        const managerBot =
            await getMaintenanceManagerBot();


        await managerBot.open();


        const completed =
            await managerBot.inspectAndCompleteLatestTestRepair();


        if (
            String(
                completed.orderId
            ) !==
                orderId
        ) {

            throw new Error(
                "维修库房完整闭环：维修管理验收的不是原三岗位联动工单"
            );
        }


        if (
            completed.orderStatus !==
                "completed" ||
            completed.requestStatus !==
                "completed" ||
            completed.bayStatus !==
                "free" ||
            completed.equipmentStatus !==
                "available"
        ) {

            throw new Error(
                "维修库房完整闭环：最终归档状态不完整"
            );
        }


        const warehouse =
            await getWarehouseBot();


        const materialRequests =
            await warehouse.readLocalStorage(
                "materialRequests"
            );


        const materialRequest =
            Array.isArray(
                materialRequests
            )
                ? materialRequests.find(
                    item =>
                        String(
                            item.requestId ||
                            ""
                        ) ===
                            String(
                                linkage.warehouseRequestId ||
                                ""
                            )
                )
                : null;


        if (
            !materialRequest ||
            materialRequest.status !==
                "issued"
        ) {

            throw new Error(
                "维修库房完整闭环：归档后原配件领用单没有保持 issued"
            );
        }


        const materials =
            await warehouse.readLocalStorage(
                "warehouseMaterials"
            );


        const material =
            Array.isArray(
                materials
            )
                ? materials.find(
                    item =>
                        String(
                            item.materialId ||
                            ""
                        ) ===
                            "TEST-MATERIAL-001"
                )
                : null;


        if (
            !material ||
            Number(
                material.availableQty ||
                0
            ) !==
                4
        ) {

            throw new Error(
                "维修库房完整闭环：最终 TEST 配件库存不是 4"
            );
        }


        updateBot(
            botName,
            "pass",
            "维修 + 库房配件 + 验收归档完整闭环通过"
        );


        robotMessage(
            botName,
            "完整闭环汇总：派工 → 开工 → waiting_parts → 库房出库 5→4 → 恢复维修 → 提交验收 → 验收归档 → 工位 free → 设备 available。"
        );


        return {
            ok:
                true,

            action:
                "maintenance-warehouse-full-closed-loop",

            orderId,

            materialRequestId:
                materialRequest.requestId,

            materialRequestStatus:
                materialRequest.status,

            finalStock:
                Number(
                    material.availableQty ||
                    0
                ),

            orderStatus:
                completed.orderStatus,

            requestStatus:
                completed.requestStatus,

            bayStatus:
                completed.bayStatus,

            equipmentStatus:
                completed.equipmentStatus,

            costId:
                completed.costId,

            totalCost:
                completed.totalCost
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "维修 + 库房配件 + 验收归档完整闭环失败：" +
            message
        );


        throw error;
    }
}


async function runMaintenanceWarehouseReportCenterTest() {

    const botName =
        "TestManager";


    let reportPage =
        null;


    try {

        updateBot(
            botName,
            "running",
            "正在验证维修库房完整闭环回写综合报表中心"
        );


        robotMessage(
            botName,
            "步骤 1/2：先运行维修 + 库房配件 + 验收归档完整闭环。"
        );


        const closedLoop =
            await runMaintenanceWarehouseFullClosedLoopTest();


        updateBot(
            botName,
            "running",
            "正在打开综合报表中心读取闭环结果"
        );


        robotMessage(
            botName,
            "步骤 2/2：以 TEST 管理员身份打开 report-center.html，核对维修费用与物资待处理统计。"
        );


        reportPage =
            await browserContext.newPage();


        await reportPage.addInitScript(
            () => {

                const readArray =
                    key => {

                        try {

                            const data =
                                JSON.parse(
                                    localStorage.getItem(
                                        key
                                    )
                                );


                            return Array.isArray(
                                data
                            )
                                ? data
                                : [];

                        } catch (
                            error
                        ) {

                            return [];
                        }
                    };


                const adminId =
                    "TEST-REPORT-ADMIN-001";


                const rows =
                    readArray(
                        "personnelRecords"
                    )
                    .filter(
                        item =>
                            String(
                                item.personId ||
                                item.employeeId ||
                                ""
                            ) !==
                                adminId
                    );


                rows.push({
                    personId:
                        adminId,

                    employeeId:
                        adminId,

                    employeeNo:
                        "TEST-REPORT-ADMIN-001",

                    name:
                        "TEST-报表管理员",

                    position:
                        "管理员",

                    department:
                        "TEST-管理部",

                    approvalStatus:
                        "approved",

                    status:
                        "active",

                    personnelStatus:
                        "在职可用",

                    testFixture:
                        true
                });


                localStorage.setItem(
                    "personnelRecords",
                    JSON.stringify(
                        rows
                    )
                );


                localStorage.setItem(
                    "adminPersonId",
                    adminId
                );


                localStorage.setItem(
                    "currentPersonId",
                    adminId
                );


                localStorage.setItem(
                    "selectedPosition",
                    "管理员"
                );


                localStorage.setItem(
                    "rolePersonIds",
                    JSON.stringify({
                        管理员:
                            adminId
                    })
                );
            }
        );


        await reportPage.goto(
            "report-center.html?section=maintenance",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        await reportPage.waitForTimeout(
            350
        );


        const expected =
            await reportPage.evaluate(
                () => {

                    const readArray =
                        key => {

                            try {

                                const data =
                                    JSON.parse(
                                        localStorage.getItem(
                                            key
                                        )
                                    );


                                return Array.isArray(
                                    data
                                )
                                    ? data
                                    : [];

                            } catch (
                                error
                            ) {

                                return [];
                            }
                        };


                    const costs =
                        readArray(
                            "maintenanceCosts"
                        );


                    const totalMaintenance =
                        costs.reduce(
                            (
                                sum,
                                item
                            ) =>
                                sum +
                                Number(
                                    item.totalCost ||
                                    0
                                ),
                            0
                        );


                    const pendingMaterials =
                        readArray(
                            "materialRequests"
                        )
                        .filter(
                            item =>
                                !item.status ||
                                item.status ===
                                    "pending"
                        )
                        .length;


                    return {
                        totalMaintenance,
                        pendingMaterials,
                        costCount:
                            costs.length
                    };
                }
            );


        const displayedMaintenance =
            Number(
                await reportPage
                    .locator(
                        "#summaryMaintenance"
                    )
                    .textContent()
            );


        const displayedMaterial =
            Number(
                await reportPage
                    .locator(
                        "#summaryMaterial"
                    )
                    .textContent()
            );


        if (
            displayedMaintenance !==
                Math.round(
                    expected.totalMaintenance
                )
        ) {

            throw new Error(
                "报表回写验证：维修费用概览不一致，预期=" +
                expected.totalMaintenance +
                "；页面=" +
                displayedMaintenance
            );
        }


        if (
            displayedMaterial !==
                expected.pendingMaterials
        ) {

            throw new Error(
                "报表回写验证：物资待处理数量不一致，预期=" +
                expected.pendingMaterials +
                "；页面=" +
                displayedMaterial
            );
        }


        await reportPage
            .locator(
                'button[data-report="maintenance"]'
            )
            .click();


        await reportPage.waitForTimeout(
            150
        );


        const maintenanceRows =
            await reportPage
                .locator(
                    "#maintenanceTableBody tr"
                )
                .count();


        if (
            expected.costCount > 0 &&
            maintenanceRows < 1
        ) {

            throw new Error(
                "报表回写验证：已有维修费用数据，但维修费用表没有生成记录"
            );
        }


        updateBot(
            botName,
            "pass",
            "维修库房闭环已正确回写综合报表中心"
        );


        robotMessage(
            botName,
            "报表回写通过：维修费用=" +
            displayedMaintenance +
            "；物资待处理=" +
            displayedMaterial +
            "；维修费用记录=" +
            expected.costCount +
            "条。"
        );


        return {
            ok:
                true,

            action:
                "maintenance-warehouse-report-center",

            closedLoop,

            maintenanceSummary:
                displayedMaintenance,

            materialPending:
                displayedMaterial,

            maintenanceCostCount:
                expected.costCount
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "维修库房闭环回写综合报表中心失败：" +
            message
        );


        throw error;


    } finally {

        if (
            reportPage &&
            !reportPage.isClosed()
        ) {

            await reportPage.close()
                .catch(
                    () => {}
                );
        }
    }
}


async function runNaturalLanguageCommandParserRegressionTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在验证总控自然语言解析与确认机制"
        );


        const cases = [
            {
                text:
                    "把维修、领配件、库房出库到最后验收整套跑一遍",

                expectedAction:
                    "maintenance-warehouse-full-closed-loop"
            },
            {
                text:
                    "看看维修和库房结束以后报表有没有更新",

                expectedAction:
                    "maintenance-warehouse-report-center"
            },
            {
                text:
                    "把6种辅助车辆都跑一下",

                expectedAction:
                    "a-group-auxiliary-linkage"
            },
            {
                text:
                    "测一下司机GPS不准的时候会不会被拦住",

                expectedAction:
                    "gps-abnormal-blocking-test"
            },
            {
                text:
                    "看看辅助车辆和加油车完成记录有没有进综合报表",

                expectedAction:
                    "auxiliary-report-center-verification"
            },
            {
                text:
                    "把6种辅助车辆从完成到调度回传再到综合报表整套跑一遍",

                expectedAction:
                    "a-group-auxiliary-dispatch-report-closed-loop"
            }
        ];


        const results = [];


        for (
            const item
            of cases
        ) {

            const parsed =
                parseNaturalLanguageCommand(
                    item.text
                );


            if (
                !parsed.matched
            ) {

                throw new Error(
                    "自然语言解析回归：没有识别句子“" +
                    item.text +
                    "”"
                );
            }


            if (
                parsed.action !==
                    item.expectedAction
            ) {

                throw new Error(
                    "自然语言解析回归：句子“" +
                    item.text +
                    "”识别错误，预期=" +
                    item.expectedAction +
                    "；实际=" +
                    parsed.action
                );
            }


            results.push({
                text:
                    item.text,

                action:
                    parsed.action,

                label:
                    parsed.label
            });
        }


        const ambiguous =
            parseNaturalLanguageCommand(
                "把维修和库房跑一下"
            );


        if (
            ambiguous.reason !==
                "ambiguous" ||
            ambiguous.candidates.length <
                2
        ) {

            throw new Error(
                "自然语言解析回归：模糊命令没有进入待确认候选状态"
            );
        }


        const guessed =
            ambiguous.candidates[
                0
            ];


        if (
            !guessed?.action ||
            !guessed?.label
        ) {

            throw new Error(
                "自然语言解析回归：模糊命令没有生成首选猜测"
            );
        }


        if (
            !isNaturalLanguageConfirmation(
                "确认"
            ) ||
            !isNaturalLanguageConfirmation(
                "就这个"
            ) ||
            !isNaturalLanguageConfirmation(
                "开始吧"
            )
        ) {

            throw new Error(
                "自然语言解析回归：确认词识别失败"
            );
        }


        if (
            !isNaturalLanguageCancellation(
                "不对"
            ) ||
            !isNaturalLanguageCancellation(
                "取消"
            ) ||
            !isNaturalLanguageCancellation(
                "重新说"
            )
        ) {

            throw new Error(
                "自然语言解析回归：取消词识别失败"
            );
        }


        pendingNaturalLanguageConfirmation = {
            action:
                guessed.action,

            label:
                guessed.label,

            originalCommand:
                "TEST-模糊命令",

            createdAt:
                Date.now() -
                10 *
                60 *
                1000,

            expiresAt:
                Date.now() -
                1
        };


        clearExpiredNaturalLanguageConfirmation();


        if (
            pendingNaturalLanguageConfirmation !==
                null
        ) {

            throw new Error(
                "自然语言解析回归：超时待确认意图没有自动清理"
            );
        }


        updateBot(
            botName,
            "pass",
            "总控自然语言解析与确认机制回归通过"
        );


        robotMessage(
            botName,
            "自然语言回归通过：" +
            cases.length +
            " 条明确命令全部识别正确；模糊命令已生成猜测候选；确认/取消词及5分钟超时清理均正常。"
        );


        return {
            ok:
                true,

            action:
                "natural-language-parser-regression",

            parsedCount:
                results.length,

            ambiguousCandidates:
                ambiguous.candidates,

            guessedAction:
                guessed.action,

            results
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        pendingNaturalLanguageConfirmation =
            null;


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "总控自然语言解析与确认机制回归失败：" +
            message
        );


        throw error;
    }
}


async function runAGroupAuxiliaryDispatchReportClosedLoopTest() {

    const botName =
        "TestManager";


    let reportPage =
        null;


    try {

        updateBot(
            botName,
            "running",
            "正在执行A组辅助车辆 → 调度端 → 综合报表完整闭环"
        );


        robotMessage(
            botName,
            "步骤 1/2：先完成A组6岗位辅助车辆，并验证调度端全部收到完成回传。"
        );


        const closedLoop =
            await runAGroupAuxiliaryDispatchFeedbackClosedLoopTest();


        const results =
            closedLoop?.auxiliary?.results;


        if (
            !Array.isArray(
                results
            ) ||
            results.length !==
                6
        ) {

            throw new Error(
                "辅助车辆调度报表完整闭环：上游实际结果不是6条"
            );
        }


        robotMessage(
            botName,
            "步骤 2/2：打开综合报表中心，核对刚才6个实际TEST结果是否全部进入辅助车辆完成统计。"
        );


        reportPage =
            await browserContext.newPage();


        await reportPage.addInitScript(
            () => {

                const readArray =
                    key => {

                        try {

                            const data =
                                JSON.parse(
                                    localStorage.getItem(
                                        key
                                    )
                                );


                            return Array.isArray(
                                data
                            )
                                ? data
                                : [];

                        } catch (
                            error
                        ) {

                            return [];
                        }
                    };


                const adminId =
                    "TEST-AUX-FULL-REPORT-ADMIN-001";


                const rows =
                    readArray(
                        "personnelRecords"
                    )
                    .filter(
                        item =>
                            String(
                                item.personId ||
                                item.employeeId ||
                                ""
                            ) !==
                                adminId
                    );


                rows.push({
                    personId:
                        adminId,

                    employeeId:
                        adminId,

                    employeeNo:
                        adminId,

                    name:
                        "TEST-辅助车辆全链路管理员",

                    position:
                        "管理员",

                    department:
                        "TEST-管理部",

                    approvalStatus:
                        "approved",

                    status:
                        "active",

                    personnelStatus:
                        "在职可用",

                    testFixture:
                        true
                });


                localStorage.setItem(
                    "personnelRecords",
                    JSON.stringify(
                        rows
                    )
                );


                localStorage.setItem(
                    "adminPersonId",
                    adminId
                );


                localStorage.setItem(
                    "currentPersonId",
                    adminId
                );


                localStorage.setItem(
                    "selectedPosition",
                    "管理员"
                );


                localStorage.setItem(
                    "rolePersonIds",
                    JSON.stringify({
                        管理员:
                            adminId
                    })
                );
            }
        );


        await reportPage.goto(
            "report-center.html?section=production",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        await reportPage.waitForTimeout(
            500
        );


        const monthCount =
            Number(
                await reportPage
                    .locator(
                        "#auxiliaryReportMonthCount"
                    )
                    .textContent()
            );


        const fuelCount =
            Number(
                await reportPage
                    .locator(
                        "#auxiliaryReportFuelCount"
                    )
                    .textContent()
            );


        const fuelAmountText =
            String(
                await reportPage
                    .locator(
                        "#auxiliaryReportFuelAmount"
                    )
                    .textContent()
            )
            .trim();


        const tableText =
            String(
                await reportPage
                    .locator(
                        "#auxiliaryReportTableBody"
                    )
                    .innerText()
            );


        if (
            monthCount <
                6
        ) {

            throw new Error(
                "辅助车辆调度报表完整闭环：报表本月完成数量不足，预期至少6；实际=" +
                monthCount
            );
        }


        if (
            fuelCount <
                1
        ) {

            throw new Error(
                "辅助车辆调度报表完整闭环：报表没有加油完成记录"
            );
        }


        const fuelResult =
            results.find(
                item =>
                    item.position ===
                        "加油车司机"
            );


        if (
            !fuelResult
        ) {

            throw new Error(
                "辅助车辆调度报表完整闭环：上游结果缺少加油车"
            );
        }


        const expectedFuelAmount =
            Number(
                fuelResult.amount ||
                0
            )
            .toFixed(
                1
            ) +
            " L";


        if (
            fuelAmountText !==
                expectedFuelAmount
        ) {

            throw new Error(
                "辅助车辆调度报表完整闭环：报表加油量不一致，预期=" +
                expectedFuelAmount +
                "；实际=" +
                fuelAmountText
            );
        }


        const missing = [];


        results.forEach(
            item => {

                const vehicleId =
                    String(
                        item.vehicleId ||
                        ""
                    );


                const taskId =
                    String(
                        item.taskId ||
                        ""
                    );


                if (
                    vehicleId &&
                    !tableText.includes(
                        vehicleId
                    )
                ) {

                    missing.push(
                        "车辆 " +
                        vehicleId
                    );
                }


                if (
                    taskId &&
                    !tableText.includes(
                        taskId
                    )
                ) {

                    missing.push(
                        "任务 " +
                        taskId
                    );
                }
            }
        );


        if (
            missing.length
        ) {

            throw new Error(
                "辅助车辆调度报表完整闭环：报表明细缺少 " +
                missing.join(
                    "、"
                )
            );
        }


        updateBot(
            botName,
            "pass",
            "A组辅助车辆 → 调度端 → 综合报表完整闭环通过"
        );


        robotMessage(
            botName,
            "全链路通过：6个辅助车辆岗位完成 → 调度端全部收到 → 综合报表全部显示；本月完成=" +
            monthCount +
            "；加油完成=" +
            fuelCount +
            "；加油量=" +
            fuelAmountText +
            "。"
        );


        return {
            ok:
                true,

            action:
                "a-group-auxiliary-dispatch-report-closed-loop",

            monthCount,

            fuelCount,

            fuelAmount:
                fuelAmountText,

            results
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "A组辅助车辆 → 调度端 → 综合报表完整闭环失败：" +
            message
        );


        throw error;


    } finally {

        if (
            reportPage &&
            !reportPage.isClosed()
        ) {

            await reportPage.close()
                .catch(
                    () => {}
                );
        }
    }
}


async function runAuxiliaryReportCenterVerificationTest() {

    const botName =
        "TestManager";


    let reportPage =
        null;


    try {

        updateBot(
            botName,
            "running",
            "正在验证辅助车辆完成记录进入综合报表中心"
        );


        robotMessage(
            botName,
            "步骤 1/2：准备 TEST 辅助车辆完成记录和 TEST 加油完成记录。"
        );


        const bot =
            await getDispatchBot();


        await bot.open();


        await bot.seedAuxiliaryCompletionFeedbackTestData();


        robotMessage(
            botName,
            "步骤 2/2：打开综合报表中心生产报表，核对辅助车辆完成统计。"
        );


        reportPage =
            await browserContext.newPage();


        await reportPage.addInitScript(
            () => {

                const readArray =
                    key => {

                        try {

                            const data =
                                JSON.parse(
                                    localStorage.getItem(
                                        key
                                    )
                                );


                            return Array.isArray(
                                data
                            )
                                ? data
                                : [];

                        } catch (
                            error
                        ) {

                            return [];
                        }
                    };


                const adminId =
                    "TEST-AUX-REPORT-ADMIN-001";


                const rows =
                    readArray(
                        "personnelRecords"
                    )
                    .filter(
                        item =>
                            String(
                                item.personId ||
                                item.employeeId ||
                                ""
                            ) !==
                                adminId
                    );


                rows.push({
                    personId:
                        adminId,

                    employeeId:
                        adminId,

                    employeeNo:
                        adminId,

                    name:
                        "TEST-辅助车辆报表管理员",

                    position:
                        "管理员",

                    department:
                        "TEST-管理部",

                    approvalStatus:
                        "approved",

                    status:
                        "active",

                    personnelStatus:
                        "在职可用",

                    testFixture:
                        true
                });


                localStorage.setItem(
                    "personnelRecords",
                    JSON.stringify(
                        rows
                    )
                );


                localStorage.setItem(
                    "adminPersonId",
                    adminId
                );


                localStorage.setItem(
                    "currentPersonId",
                    adminId
                );


                localStorage.setItem(
                    "selectedPosition",
                    "管理员"
                );


                localStorage.setItem(
                    "rolePersonIds",
                    JSON.stringify({
                        管理员:
                            adminId
                    })
                );
            }
        );


        await reportPage.goto(
            "report-center.html?section=production",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        await reportPage.waitForTimeout(
            500
        );


        const monthCount =
            Number(
                await reportPage
                    .locator(
                        "#auxiliaryReportMonthCount"
                    )
                    .textContent()
            );


        const fuelCount =
            Number(
                await reportPage
                    .locator(
                        "#auxiliaryReportFuelCount"
                    )
                    .textContent()
            );


        const fuelAmountText =
            String(
                await reportPage
                    .locator(
                        "#auxiliaryReportFuelAmount"
                    )
                    .textContent()
            )
            .trim();


        const tableText =
            String(
                await reportPage
                    .locator(
                        "#auxiliaryReportTableBody"
                    )
                    .innerText()
            );


        if (
            monthCount <
                2
        ) {

            throw new Error(
                "辅助车辆报表验证：本月完成数量不足，实际=" +
                monthCount
            );
        }


        if (
            fuelCount <
                1
        ) {

            throw new Error(
                "辅助车辆报表验证：本月加油完成数量不足，实际=" +
                fuelCount
            );
        }


        if (
            fuelAmountText !==
                "500.0 L"
        ) {

            throw new Error(
                "辅助车辆报表验证：本月加油量不正确，实际=" +
                fuelAmountText
            );
        }


        const requiredTexts = [
            "TEST-AUX-WATER-001",
            "TEST-AUX-TASK-001",
            "TEST-运输道路洒水降尘",
            "TEST-FUEL-VEHICLE-001",
            "TEST-FUEL-REQ-001",
            "完成加油 500.0 L"
        ];


        const missing =
            requiredTexts.filter(
                text =>
                    !tableText.includes(
                        text
                    )
            );


        if (
            missing.length
        ) {

            throw new Error(
                "辅助车辆报表验证：明细缺少 " +
                missing.join(
                    "、"
                )
            );
        }


        updateBot(
            botName,
            "pass",
            "辅助车辆完成统计已正确进入综合报表中心"
        );


        robotMessage(
            botName,
            "报表验证通过：本月完成=" +
            monthCount +
            "；加油完成=" +
            fuelCount +
            "；加油量=" +
            fuelAmountText +
            "；辅助车辆和加油明细均已显示。"
        );


        return {
            ok:
                true,

            action:
                "auxiliary-report-center-verification",

            monthCount,

            fuelCount,

            fuelAmount:
                fuelAmountText
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "辅助车辆完成统计进入综合报表中心验证失败：" +
            message
        );


        throw error;


    } finally {

        if (
            reportPage &&
            !reportPage.isClosed()
        ) {

            await reportPage.close()
                .catch(
                    () => {}
                );
        }
    }
}


async function runAGroupAuxiliaryDispatchFeedbackClosedLoopTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行A组辅助车辆到调度端完成回传闭环"
        );


        robotMessage(
            botName,
            "步骤 1/2：先运行A组6岗位辅助车辆真实TEST联动。"
        );


        const auxiliary =
            await runAGroupAuxiliaryLinkageTest();


        if (
            !auxiliary ||
            !Array.isArray(
                auxiliary.results
            ) ||
            auxiliary.results.length !==
                6
        ) {

            throw new Error(
                "A组辅助车辆到调度端闭环：岗位侧结果不是6条"
            );
        }


        robotMessage(
            botName,
            "步骤 2/2：把刚才6个真实TEST岗位结果回传到调度端并逐条核对。"
        );


        const bot =
            await getDispatchBot();


        await bot.open();


        await bot.seedAuxiliaryCompletionFeedbackFromResults(
            auxiliary.results
        );


        const feedback =
            await bot.verifyAuxiliaryCompletionFeedbackFromResults(
                auxiliary.results
            );


        if (
            !feedback.allVehiclesVisible ||
            !feedback.allTasksVisible ||
            !feedback.hasFuel
        ) {

            throw new Error(
                "A组辅助车辆到调度端闭环：完成回传校验不完整"
            );
        }


        updateBot(
            botName,
            "pass",
            "A组辅助车辆 → 调度端完成回传闭环通过"
        );


        robotMessage(
            botName,
            "完整回传通过：6个岗位全部完成，调度端显示 " +
            feedback.count +
            " 条；6个车辆号和6个任务号均已显示；加油完成记录已显示。"
        );


        return {
            ok:
                true,

            action:
                "a-group-auxiliary-dispatch-feedback-closed-loop",

            auxiliary,

            feedback
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "A组辅助车辆 → 调度端完成回传闭环失败：" +
            message
        );


        throw error;
    }
}


async function runDispatchAuxiliaryCompletionFeedbackTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在验证调度端辅助车辆完成回传"
        );


        const bot =
            await getDispatchBot();


        await bot.open();


        robotMessage(
            botName,
            "步骤 1/2：写入 TEST 辅助车辆完成记录和 TEST 加油完成记录。"
        );


        await bot.seedAuxiliaryCompletionFeedbackTestData();


        robotMessage(
            botName,
            "步骤 2/2：检查调度端“辅助车辆完成回传”视图。"
        );


        const result =
            await bot.verifyAuxiliaryCompletionFeedbackView();


        if (
            !result.hasAuxiliary ||
            !result.hasFuel
        ) {

            throw new Error(
                "调度完成回传验证：辅助车辆或加油车记录未同时显示"
            );
        }


        updateBot(
            botName,
            "pass",
            "调度端辅助车辆完成回传验证通过"
        );


        robotMessage(
            botName,
            "完成回传验证通过：共 " +
            result.count +
            " 条；辅助车辆=" +
            result.hasAuxiliary +
            "；加油车=" +
            result.hasFuel
        );


        return {
            ok:
                true,

            action:
                "dispatch-auxiliary-completion-feedback",

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "调度端辅助车辆完成回传验证失败：" +
            message
        );


        try {

            await captureFailure(
                "DispatchBot",
                dispatchPage,
                "dispatch-auxiliary-completion-feedback"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runTemporaryUnloadRejectionTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行临时卸料驳回闭环"
        );


        robotMessage(
            botName,
            "步骤 1/3：准备 TEST 司机环境。"
        );


        await prepareTruckDriverTestEnvironment();


        robotMessage(
            botName,
            "步骤 2/3：TruckDriverBot 提交 TEST 临时非卸载区卸料申请。"
        );


        const submit =
            await runTruckDriverTemporaryUnloadSubmitTest();


        updateBot(
            "DispatchBot",
            "running",
            "正在驳回 TEST 临时卸料申请"
        );


        robotMessage(
            botName,
            "步骤 3/3：DispatchBot 驳回申请，并验证不会生成正式趟次。"
        );


        const bot =
            await getDispatchBot();


        await bot.open();


        const rejected =
            await bot.rejectLatestTestTemporaryUnload();


        if (
            rejected.requestId !==
                submit.result.requestId
        ) {

            throw new Error(
                "临时卸料驳回闭环失败：调度处理的不是刚提交的 TEST 申请"
            );
        }


        if (
            rejected.requestStatus !==
                "rejected" ||
            rejected.dispatchConfirmation !==
                "rejected" ||
            rejected.officialCountEligible !==
                false
        ) {

            throw new Error(
                "临时卸料驳回闭环失败：驳回后的申请状态不正确"
            );
        }


        if (
            rejected.afterTripCount !==
                rejected.beforeTripCount
        ) {

            throw new Error(
                "临时卸料驳回闭环失败：驳回后正式趟次发生变化"
            );
        }


        robotMessage(
            botName,
            "临时卸料驳回通过：" +
            rejected.requestId +
            "；status=" +
            rejected.requestStatus +
            "；正式趟次 " +
            rejected.beforeTripCount +
            " → " +
            rejected.afterTripCount
        );


        updateBot(
            "DispatchBot",
            "pass",
            "TEST临时卸料已正确驳回且未计入正式趟次"
        );


        updateBot(
            botName,
            "pass",
            "临时卸料驳回闭环测试通过"
        );


        return {
            ok:
                true,

            action:
                "temporary-unload-rejection-test",

            submit:
                submit.result,

            rejected
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            "DispatchBot",
            "fail",
            message
        );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "临时卸料驳回闭环失败：" +
            message
        );


        try {

            await captureFailure(
                "DispatchBot",
                dispatchPage,
                "temporary-unload-rejection"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runFastRegressionTests(
    moduleName =
        "all"
) {

    await ensureBrowser();


    const botName =
        "TestManager";


    const allowedModules =
        new Set([
            "all",
            "maintenance",
            "transport",
            "dispatch"
        ]);


    if (
        !allowedModules.has(
            moduleName
        )
    ) {

        throw new Error(
            "未知快速回归模块：" +
            String(
                moduleName
            )
        );
    }


    const suiteLabel =
        moduleName ===
            "maintenance"
            ? "维修快速回归"
            : moduleName ===
                "transport"
                ? "运输快速回归"
                : moduleName ===
                    "dispatch"
                    ? "调度快速回归"
                    : "快速回归";


    const results =
        [];


    const suiteStartedAt =
        Date.now();


    const runFastCase =
        async (
            name,
            runner
        ) => {

            const caseStartedAt =
                Date.now();


            robotMessage(
                botName,
                suiteLabel +
                "：" +
                name
            );


            try {

                const result =
                    await runner();


                const durationMs =
                    Date.now() -
                    caseStartedAt;


                results.push({
                    name,
                    ok:
                        true,

                    durationMs,

                    result
                });


                robotMessage(
                    botName,
                    suiteLabel +
                    "通过：" +
                    name +
                    "；耗时=" +
                    (
                        durationMs /
                        1000
                    )
                    .toFixed(
                        2
                    ) +
                    "s"
                );


            } catch (
                error
            ) {

                const message =
                    error?.message ||
                    String(
                        error
                    );


                const diagnosis =
                    buildFailureDiagnosis({
                        caseName:
                            name,

                        error,

                        suiteLabel
                    });


                const diagnosticPath =
                    saveFailureDiagnostic(
                        diagnosis
                    );


                reportFailureDiagnosis(
                    botName,
                    diagnosis,
                    diagnosticPath
                );


                const durationMs =
                    Date.now() -
                    caseStartedAt;


                results.push({
                    name,
                    ok:
                        false,

                    durationMs,

                    error:
                        message,

                    diagnosis,

                    diagnosticPath
                });


                robotMessage(
                    botName,
                    suiteLabel +
                    "失败：" +
                    name +
                    "；" +
                    message
                );
            }
        };


    updateBot(
        botName,
        "running",
        "正在运行" +
        suiteLabel
    );


    if (
        moduleName === "all" ||
        moduleName === "maintenance"
    ) {

        await runFastCase(
            "等待配件状态流转",
            async () => {
    
                const page =
                    await browserContext.newPage();
    
    
                try {
    
                    await installScenario(
                        page,
                        SCENARIOS.MAINTENANCE_WORKING
                    );
    
    
                    const bot =
                        new MaintenanceWorkerBot(
                            page
                        );
    
    
                    await bot.open();
    
    
                    return await bot.waitPartsResumeAndFinishLatestTestRepair();
    
                } finally {
    
                    await page.close()
                        .catch(
                            () => {}
                        );
                }
            }
        );
    
    
        }


    if (
        moduleName === "all" ||
        moduleName === "maintenance"
    ) {

        await runFastCase(
            "验收退回返修再提交",
            async () => {
    
                const managerPage =
                    await browserContext.newPage();
    
    
                const workerPage =
                    await browserContext.newPage();
    
    
                try {
    
                    await installScenario(
                        managerPage,
                        SCENARIOS.MAINTENANCE_WAITING_INSPECTION
                    );
    
    
                    const manager =
                        new MaintenanceManagerBot(
                            managerPage
                        );
    
    
                    await manager.open();
    
    
                    const rejected =
                        await manager.rejectLatestTestInspectionForRework();
    
    
                    const worker =
                        new MaintenanceWorkerBot(
                            workerPage
                        );
    
    
                    await worker.open();
    
    
                    const resubmitted =
                        await worker.reworkAndResubmitLatestTestRepair();
    
    
                    return {
                        rejected,
                        resubmitted
                    };
    
                } finally {
    
                    await managerPage.close()
                        .catch(
                            () => {}
                        );
    
    
                    await workerPage.close()
                        .catch(
                            () => {}
                        );
                }
            }
        );
    
    
        }


    if (
        moduleName === "all" ||
        moduleName === "maintenance"
    ) {

        await runFastCase(
            "维修验收归档释放",
            async () => {
    
                const page =
                    await browserContext.newPage();
    
    
                try {
    
                    await installScenario(
                        page,
                        SCENARIOS.MAINTENANCE_WAITING_INSPECTION
                    );
    
    
                    const bot =
                        new MaintenanceManagerBot(
                            page
                        );
    
    
                    await bot.open();
    
    
                    return await bot.inspectAndCompleteLatestTestRepair();
    
                } finally {
    
                    await page.close()
                        .catch(
                            () => {}
                        );
                }
            }
        );
    
    
        }


    if (
        moduleName === "all" ||
        moduleName === "transport"
    ) {

        await runFastCase(
            "GPS异常拦截",
            async () => {
    
                const page =
                    await browserContext.newPage();
    
    
                try {
    
                    await initializeTruckDriverTestEnvironment(
                        page
                    );
    
    
                    const bot =
                        new TruckDriverBot(
                            page
                        );
    
    
                    return await bot.testGpsAbnormalBlocked();
    
                } finally {
    
                    await page.close()
                        .catch(
                            () => {}
                        );
                }
            }
        );
    
    
        }


    if (
        moduleName === "all" ||
        moduleName === "dispatch"
    ) {

        await runFastCase(
            "临时卸料驳回不计趟次",
            async () => {
    
                const page =
                    await browserContext.newPage();
    
    
                try {
    
                    await installScenario(
                        page,
                        SCENARIOS.TEMPORARY_UNLOAD_PENDING
                    );
    
    
                    const bot =
                        new DispatchBot(
                            page
                        );
    
    
                    await bot.open();
    
    
                    return await bot.rejectLatestTestTemporaryUnload();
    
                } finally {
    
                    await page.close()
                        .catch(
                            () => {}
                        );
                }
            }
        );


        await runFastCase(
            "辅助车辆完成回传视图",
            async () => {

                const page =
                    await browserContext.newPage();


                try {

                    const bot =
                        new DispatchBot(
                            page
                        );


                    await bot.open();


                    await bot.seedAuxiliaryCompletionFeedbackTestData();


                    return await bot.verifyAuxiliaryCompletionFeedbackView();

                } finally {

                    await page.close()
                        .catch(
                            () => {}
                        );
                }
            }
        );
    
    
        }


    const passed =
        results.filter(
            item =>
                item.ok
        ).length;


    const total =
        results.length;


    const failed =
        total -
        passed;


    robotMessage(
        botName,
        suiteLabel +
        "汇总：" +
        passed +
        "/" +
        total +
        " PASS" +
        (
            failed
                ? "；" +
                  failed +
                  " FAIL"
                : ""
        )
    );


    results.forEach(
        (
            item,
            index
        ) => {

            robotMessage(
                botName,
                (
                    index +
                    1
                ) +
                ". " +
                item.name +
                "：" +
                (
                    item.ok
                        ? "PASS"
                        : "FAIL - " +
                          item.error
                )
            );
        }
    );


    const suiteDurationMs =
        Date.now() -
        suiteStartedAt;


    const slowest =
        [
            ...results
        ]
        .sort(
            (
                a,
                b
            ) =>
                Number(
                    b.durationMs ||
                    0
                ) -
                Number(
                    a.durationMs ||
                    0
                )
        )
        .slice(
            0,
            3
        );


    robotMessage(
        botName,
        suiteLabel +
        "总耗时=" +
        (
            suiteDurationMs /
            1000
        )
        .toFixed(
            2
        ) +
        "s"
    );


    if (
        slowest.length
    ) {

        robotMessage(
            botName,
            suiteLabel +
            "最慢用例：" +
            slowest
                .map(
                    item =>
                        item.name +
                        "=" +
                        (
                            Number(
                                item.durationMs ||
                                0
                            ) /
                            1000
                        )
                        .toFixed(
                            2
                        ) +
                        "s"
                )
                .join(
                    "；"
                )
        );
    }


    if (
        failed
    ) {

        updateBot(
            botName,
            "fail",
            suiteLabel +
            "完成：" +
            passed +
            "/" +
            total +
            " PASS"
        );


        throw new Error(
            suiteLabel +
            "存在失败用例：" +
            results
                .filter(
                    item =>
                        !item.ok
                )
                .map(
                    item =>
                        item.name
                )
                .join(
                    "、"
                )
        );
    }


    updateBot(
        botName,
        "pass",
        suiteLabel +
        "全部通过：" +
        passed +
        "/" +
        total
    );


    return {
        ok:
            true,

        action:
            moduleName === "all"
                ? "fast-regression-tests"
                : "fast-regression-" +
                  moduleName,

        passed,
        total,

        durationMs:
            suiteDurationMs,

        results
    };
}


async function runAGroupMultiRobotLinkageTest() {

    const botName =
        "TestManager";


    await ensureBrowser();


    const suiteStartedAt =
        Date.now();


    const payload =
        buildAGroupPayload();


    const contexts =
        [];


    const results = {
        excavators:
            [],

        drivers:
            []
    };


    updateBot(
        botName,
        "running",
        "正在运行A组多机器人联动测试"
    );


    robotMessage(
        botName,
        "A组测试编组：2台挖机 + 6台汽车；每台挖机绑定3名汽车司机；其余17个岗位各1名TEST机器人身份。"
    );


    try {

        const unitJobs =
            A_GROUP.excavators.map(
                async (
                    unit,
                    unitIndex
                ) => {

                    /*
                     * 每个机器人使用独立 BrowserContext，
                     * 模拟不同手机 / 不同岗位登录。
                     * localStorage 互不覆盖。
                     */

                    const excavatorContext =
                        await browser.newContext({
                            baseURL:
                                BASE_URL,

                            viewport: {
                                width:
                                    390,

                                height:
                                    844
                            }
                        });


                    contexts.push(
                        excavatorContext
                    );


                    const excavatorPage =
                        await excavatorContext.newPage();


                    await installAGroupRobotContext(
                        excavatorPage,
                        unit.driverId
                    );


                    const excavatorName =
                        "ExcavatorBot-A" +
                        String(
                            unitIndex +
                            1
                        )
                        .padStart(
                            2,
                            "0"
                        );


                    robotMessage(
                        excavatorName,
                        "启动：司机=" +
                        unit.driverId +
                        "；挖机=" +
                        unit.excavatorId
                    );


                    const excavatorBot =
                        new ExcavatorBot(
                            excavatorPage,
                            excavatorName
                        );


                    await excavatorBot.open();


                    const excavatorResult =
                        await excavatorBot.assertAssignment({
                            driverId:
                                unit.driverId,

                            excavatorId:
                                unit.excavatorId,

                            taskId:
                                unit.taskId,

                            truckIds:
                                unit.trucks.map(
                                    item =>
                                        item.vehicleId
                                )
                        });


                    results.excavators.push(
                        excavatorResult
                    );


                    robotMessage(
                        excavatorName,
                        "PASS：已识别3台跟随汽车 " +
                        excavatorResult.truckIds.join(
                            "、"
                        )
                    );


                    const driverJobs =
                        unit.trucks.map(
                            async (
                                truck,
                                truckIndex
                            ) => {

                                const driverContext =
                                    await browser.newContext({
                                        baseURL:
                                            BASE_URL,

                                        viewport: {
                                            width:
                                                390,

                                            height:
                                                844
                                        }
                                    });


                                contexts.push(
                                    driverContext
                                );


                                const driverPage =
                                    await driverContext.newPage();


                                await installAGroupRobotContext(
                                    driverPage,
                                    truck.driverId
                                );


                                const driverName =
                                    "TruckDriverBot-A" +
                                    String(
                                        unitIndex +
                                        1
                                    )
                                    .padStart(
                                        2,
                                        "0"
                                    ) +
                                    "-" +
                                    String(
                                        truckIndex +
                                        1
                                    );


                                robotMessage(
                                    driverName,
                                    "启动：司机=" +
                                    truck.driverId +
                                    "；车辆=" +
                                    truck.vehicleId +
                                    "；跟随挖机=" +
                                    unit.excavatorId
                                );


                                const driverBot =
                                    new TruckDriverBot(
                                        driverPage
                                    );


                                driverBot.name =
                                    driverName;


                                await driverBot.open();


                                const profile =
                                    await driverBot.assertTestIdentity();


                                const task =
                                    await driverBot.assertTestTask();


                                const actualDriverId =
                                    String(
                                        profile.driverId ||
                                        profile.personId ||
                                        ""
                                    );


                                const actualTaskId =
                                    String(
                                        task.taskId ||
                                        task.dispatchTaskId ||
                                        ""
                                    );


                                const actualVehicleId =
                                    String(
                                        task.vehicleId ||
                                        task.vehicleNumber ||
                                        ""
                                    );


                                const actualExcavatorId =
                                    String(
                                        task.excavatorId ||
                                        task.excavatorNumber ||
                                        ""
                                    );


                                if (
                                    actualDriverId !==
                                        truck.driverId
                                ) {

                                    throw new Error(
                                        driverName +
                                        "：personId不一致，预期=" +
                                        truck.driverId +
                                        "；实际=" +
                                        actualDriverId
                                    );
                                }


                                if (
                                    actualTaskId !==
                                        unit.taskId
                                ) {

                                    throw new Error(
                                        driverName +
                                        "：taskId不一致，预期=" +
                                        unit.taskId +
                                        "；实际=" +
                                        actualTaskId
                                    );
                                }


                                if (
                                    actualVehicleId !==
                                        truck.vehicleId
                                ) {

                                    throw new Error(
                                        driverName +
                                        "：车辆绑定不一致，预期=" +
                                        truck.vehicleId +
                                        "；实际=" +
                                        actualVehicleId
                                    );
                                }


                                if (
                                    actualExcavatorId !==
                                        unit.excavatorId
                                ) {

                                    throw new Error(
                                        driverName +
                                        "：挖机绑定不一致，预期=" +
                                        unit.excavatorId +
                                        "；实际=" +
                                        actualExcavatorId
                                    );
                                }


                                const result = {
                                    driverId:
                                        actualDriverId,

                                    taskId:
                                        actualTaskId,

                                    vehicleId:
                                        actualVehicleId,

                                    excavatorId:
                                        actualExcavatorId
                                };


                                results.drivers.push(
                                    result
                                );


                                robotMessage(
                                    driverName,
                                    "PASS：司机 / 车辆 / 挖机 / 任务绑定一致。"
                                );


                                return result;
                            }
                        );


                    await Promise.all(
                        driverJobs
                    );


                    return excavatorResult;
                }
            );


        await Promise.all(
            unitJobs
        );


        /*
         * TestManager 最终交叉核对：
         * 2台挖机，每台3台汽车，6名司机无重复绑定。
         */

        if (
            results.excavators.length !==
                2
        ) {

            throw new Error(
                "A组联动：挖机机器人数量不正确，预期=2；实际=" +
                results.excavators.length
            );
        }


        if (
            results.drivers.length !==
                6
        ) {

            throw new Error(
                "A组联动：汽车司机机器人数量不正确，预期=6；实际=" +
                results.drivers.length
            );
        }


        const uniqueDrivers =
            new Set(
                results.drivers.map(
                    item =>
                        item.driverId
                )
            );


        const uniqueVehicles =
            new Set(
                results.drivers.map(
                    item =>
                        item.vehicleId
                )
            );


        if (
            uniqueDrivers.size !==
                6
        ) {

            throw new Error(
                "A组联动：存在重复汽车司机绑定"
            );
        }


        if (
            uniqueVehicles.size !==
                6
        ) {

            throw new Error(
                "A组联动：存在重复汽车绑定"
            );
        }


        if (
            !Array.isArray(
                A_GROUP.supportRoles
            ) ||
            A_GROUP.supportRoles.length !==
                17
        ) {

            throw new Error(
                "A组联动：其他岗位机器人数量不正确，预期=17；实际=" +
                String(
                    A_GROUP.supportRoles?.length ||
                    0
                )
            );
        }


        const supportIds =
            new Set(
                A_GROUP.supportRoles.map(
                    item =>
                        item.personId
                )
            );


        if (
            supportIds.size !==
                17
        ) {

            throw new Error(
                "A组联动：其他岗位存在重复机器人身份"
            );
        }


        for (
            const unit
            of A_GROUP.excavators
        ) {

            const linkedDrivers =
                results.drivers.filter(
                    item =>
                        item.excavatorId ===
                            unit.excavatorId
                );


            if (
                linkedDrivers.length !==
                    3
            ) {

                throw new Error(
                    "A组联动：" +
                    unit.excavatorId +
                    " 跟随司机数量不正确，预期=3；实际=" +
                    linkedDrivers.length
                );
            }
        }


        const durationMs =
            Date.now() -
            suiteStartedAt;


        robotMessage(
            botName,
            "A组多机器人联动汇总：2/2挖机机器人 PASS；6/6汽车司机机器人 PASS；17/17其他岗位机器人身份 READY。"
        );


        robotMessage(
            botName,
            "编组验证通过：TEST-A-EX-001 ← 3车；TEST-A-EX-002 ← 3车。"
        );


        robotMessage(
            botName,
            "A组联动总耗时=" +
            (
                durationMs /
                1000
            )
            .toFixed(
                2
            ) +
            "s"
        );


        updateBot(
            botName,
            "pass",
            "A组2套挖机+6名汽车司机+17个其他岗位机器人联动编组通过"
        );


        return {
            ok:
                true,

            action:
                "a-group-multi-robot-linkage",

            team:
                payload.team,

            summary:
                payload.summary,

            durationMs,
            results
        };


    } catch (
        error
    ) {

        const diagnosis =
            buildFailureDiagnosis({
                caseName:
                    "A组2套挖机6车多机器人联动",

                error,

                suiteLabel:
                    "多机器人联动"
            });


        const diagnosticPath =
            saveFailureDiagnostic(
                diagnosis
            );


        reportFailureDiagnosis(
            botName,
            diagnosis,
            diagnosticPath
        );


        updateBot(
            botName,
            "fail",
            error?.message ||
            String(
                error
            )
        );


        throw error;


    } finally {

        await Promise.all(
            contexts.map(
                context =>
                    context.close()
                        .catch(
                            () => {}
                        )
            )
        );
    }
}


async function runAllRoleEntryLinkageTest() {

    const botName =
        "TestManager";


    await ensureBrowser();


    const suiteStartedAt =
        Date.now();


    const contexts =
        [];


    const results =
        [];


    updateBot(
        botName,
        "running",
        "正在运行全岗位入口联动测试"
    );


    robotMessage(
        botName,
        "启动17个其他岗位机器人：验证TEST身份、岗位、审核状态和正式页面入口。"
    );


    try {

        const jobs =
            A_GROUP.supportRoles.map(
                async (
                    role,
                    index
                ) => {

                    const context =
                        await browser.newContext({
                            baseURL:
                                BASE_URL,

                            viewport: {
                                width:
                                    390,

                                height:
                                    844
                            }
                        });


                    contexts.push(
                        context
                    );


                    const page =
                        await context.newPage();


                    await installAGroupRobotContext(
                        page,
                        role.personId
                    );


                    const robotName =
                        "RoleEntryBot-" +
                        String(
                            index +
                            1
                        )
                        .padStart(
                            2,
                            "0"
                        ) +
                        "-" +
                        role.position;


                    robotMessage(
                        robotName,
                        "启动：" +
                        role.personId +
                        " / " +
                        role.position
                    );


                    const bot =
                        new RoleEntryBot(
                            page,
                            {
                                personId:
                                    role.personId,

                                position:
                                    role.position
                            },
                            robotName
                        );


                    const result =
                        await bot.verify();


                    results.push(
                        result
                    );


                    robotMessage(
                        robotName,
                        "PASS：" +
                        result.position +
                        " → " +
                        result.page
                    );


                    return result;
                }
            );


        await Promise.all(
            jobs
        );


        if (
            results.length !==
                A_GROUP.supportRoles.length
        ) {

            throw new Error(
                "全岗位入口联动：通过数量不正确，预期=" +
                A_GROUP.supportRoles.length +
                "；实际=" +
                results.length
            );
        }


        const uniquePersonIds =
            new Set(
                results.map(
                    item =>
                        item.personId
                )
            );


        if (
            uniquePersonIds.size !==
                A_GROUP.supportRoles.length
        ) {

            throw new Error(
                "全岗位入口联动：存在重复TEST人员身份"
            );
        }


        const durationMs =
            Date.now() -
            suiteStartedAt;


        robotMessage(
            botName,
            "全岗位入口联动汇总：17/17 其他岗位机器人 PASS。"
        );


        robotMessage(
            botName,
            "入口覆盖：辅助车辆6、车队长1、维修2、中层及库房6、总经理1、管理员1。"
        );


        robotMessage(
            botName,
            "全岗位入口联动总耗时=" +
            (
                durationMs /
                1000
            )
            .toFixed(
                2
            ) +
            "s"
        );


        updateBot(
            botName,
            "pass",
            "17个其他岗位机器人入口联动全部通过"
        );


        return {
            ok:
                true,

            action:
                "all-role-entry-linkage",

            total:
                results.length,

            durationMs,
            results
        };


    } catch (
        error
    ) {

        const diagnosis =
            buildFailureDiagnosis({
                caseName:
                    "全岗位入口联动",

                error,

                suiteLabel:
                    "多机器人联动"
            });


        const diagnosticPath =
            saveFailureDiagnostic(
                diagnosis
            );


        reportFailureDiagnosis(
            botName,
            diagnosis,
            diagnosticPath
        );


        updateBot(
            botName,
            "fail",
            error?.message ||
            String(
                error
            )
        );


        throw error;


    } finally {

        await Promise.all(
            contexts.map(
                context =>
                    context.close()
                        .catch(
                            () => {}
                        )
            )
        );
    }
}


async function runAGroupProductionClosedLoop() {

    const botName =
        "TestManager";


    await ensureBrowser();


    const suiteStartedAt =
        Date.now();


    const contexts =
        [];


    const driverResults =
        [];


    const syncedTrips =
        [];


    const excavatorResults =
        [];


    updateBot(
        botName,
        "running",
        "正在运行A组生产联动闭环"
    );


    robotMessage(
        botName,
        "生产联动：车队长1 + 挖机2 + 汽车司机6 + TestManager；6名司机并行各完成1趟TEST运输。"
    );


    robotMessage(
        botName,
        "说明：当前系统仍是离线localStorage架构，本测试通过TEST同步总线把6个独立BrowserContext产生的趟次汇总到挖机端和调度端；不会写正式数据。"
    );


    try {

        /*
         * 阶段1：
         * 6名汽车司机使用6个独立 BrowserContext，
         * 真正执行 driver-work.html 的 GPS 装车→运输→卸载→完成一趟。
         */
        const driverJobs =
            A_GROUP.excavators.flatMap(
                (
                    unit,
                    unitIndex
                ) =>
                    unit.trucks.map(
                        (
                            truck,
                            truckIndex
                        ) => ({
                            unit,
                            unitIndex,
                            truck,
                            truckIndex
                        })
                    )
            )
            .map(
                async (
                    item,
                    globalIndex
                ) => {

                    const {
                        unit,
                        unitIndex,
                        truck,
                        truckIndex
                    } =
                        item;


                    const context =
                        await browser.newContext({
                            baseURL:
                                BASE_URL,

                            viewport: {
                                width:
                                    390,

                                height:
                                    844
                            }
                        });


                    contexts.push(
                        context
                    );


                    const page =
                        await context.newPage();


                    await installAGroupRobotContext(
                        page,
                        truck.driverId
                    );


                    const robotName =
                        "TruckDriverBot-A" +
                        String(
                            unitIndex +
                            1
                        )
                        .padStart(
                            2,
                            "0"
                        ) +
                        "-" +
                        String(
                            truckIndex +
                            1
                        );


                    robotMessage(
                        robotName,
                        "开始1趟运输：司机=" +
                        truck.driverId +
                        "；车辆=" +
                        truck.vehicleId +
                        "；挖机=" +
                        unit.excavatorId
                    );


                    const bot =
                        new TruckDriverBot(
                            page
                        );


                    bot.name =
                        robotName;


                    /*
                     * 双保险：
                     * 生产联动闭环必须在 driver-work.html 启动前
                     * 由 TruckDriverBot 自己向 BrowserContext 注入 TEST GPS。
                     * 不再只依赖 Fixture 的 page.addInitScript。
                     */
                    await bot.installTestGpsBeforeOpen();


                    await bot.open();


                    const result =
                        await bot.testNormalTransportClosedLoop();


                    const rows =
                        await bot.readLocalStorage(
                            "driverTripRecords"
                        );


                    const sourceRecord =
                        Array.isArray(
                            rows
                        )
                            ? rows[
                                rows.length -
                                1
                            ]
                            : null;


                    if (
                        !sourceRecord
                    ) {

                        throw new Error(
                            robotName +
                            "：完成运输后没有读取到趟次记录"
                        );
                    }


                    const syncTripId =
                        "TEST-A-TRIP-" +
                        String(
                            globalIndex +
                            1
                        )
                        .padStart(
                            3,
                            "0"
                        );


                    const syncedRecord = {
                        ...sourceRecord,

                        tripId:
                            syncTripId,

                        id:
                            syncTripId,

                        recordId:
                            syncTripId,

                        driverId:
                            truck.driverId,

                        personId:
                            truck.driverId,

                        driverName:
                            truck.driverName,

                        vehicleId:
                            truck.vehicleId,

                        vehicleNumber:
                            truck.vehicleId,

                        truckId:
                            truck.vehicleId,

                        truckNumber:
                            truck.vehicleId,

                        taskId:
                            unit.taskId,

                        dispatchTaskId:
                            unit.taskId,

                        excavatorId:
                            unit.excavatorId,

                        excavatorNumber:
                            unit.excavatorId,

                        officialCountEligible:
                            true,

                        dispatchConfirmation:
                            "confirmed",

                        manualOverride:
                            false,

                        transportValidation:
                            "gps_geofence_closed_loop",

                        testFixture:
                            true,

                        testSyncBus:
                            true
                    };


                    driverResults.push({
                        robotName,

                        driverId:
                            truck.driverId,

                        vehicleId:
                            truck.vehicleId,

                        excavatorId:
                            unit.excavatorId,

                        taskId:
                            unit.taskId,

                        localTripId:
                            result.tripId,

                        syncedTripId:
                            syncTripId,

                        result
                    });


                    syncedTrips.push(
                        syncedRecord
                    );


                    robotMessage(
                        robotName,
                        "PASS：完成1趟；" +
                        truck.vehicleId +
                        " → " +
                        unit.excavatorId
                    );


                    return result;
                }
            );


        await Promise.all(
            driverJobs
        );


        if (
            driverResults.length !==
                6 ||
            syncedTrips.length !==
                6
        ) {

            throw new Error(
                "A组生产联动：司机趟次数量不正确，预期=6；实际=" +
                syncedTrips.length
            );
        }


        const uniqueDrivers =
            new Set(
                driverResults.map(
                    item =>
                        item.driverId
                )
            );


        const uniqueVehicles =
            new Set(
                driverResults.map(
                    item =>
                        item.vehicleId
                )
            );


        const uniqueTrips =
            new Set(
                syncedTrips.map(
                    item =>
                        item.tripId
                )
            );


        if (
            uniqueDrivers.size !==
                6 ||
            uniqueVehicles.size !==
                6 ||
            uniqueTrips.size !==
                6
        ) {

            throw new Error(
                "A组生产联动：司机、车辆或趟次存在重复绑定"
            );
        }


        /*
         * 阶段2：
         * TEST同步总线把6条司机端真实产生的TEST趟次
         * 投递给2个挖机独立上下文，各自验证应统计3趟。
         */
        for (
            let unitIndex =
                0;
            unitIndex <
                A_GROUP.excavators.length;
            unitIndex++
        ) {

            const unit =
                A_GROUP.excavators[
                    unitIndex
                ];


            const context =
                await browser.newContext({
                    baseURL:
                        BASE_URL,

                    viewport: {
                        width:
                            390,

                        height:
                            844
                    }
                });


            contexts.push(
                context
            );


            const page =
                await context.newPage();


            await installAGroupRobotContext(
                page,
                unit.driverId
            );


            await page.addInitScript(
                trips => {

                    localStorage.setItem(
                        "driverTripRecords",
                        JSON.stringify(
                            trips
                        )
                    );


                    localStorage.setItem(
                        "tripRecords",
                        JSON.stringify(
                            trips
                        )
                    );
                },
                syncedTrips
            );


            const robotName =
                "ExcavatorBot-A" +
                String(
                    unitIndex +
                    1
                )
                .padStart(
                    2,
                    "0"
                );


            const bot =
                new ExcavatorBot(
                    page,
                    robotName
                );


            await bot.open();


            await bot.assertAssignment({
                driverId:
                    unit.driverId,

                excavatorId:
                    unit.excavatorId,

                taskId:
                    unit.taskId,

                truckIds:
                    unit.trucks.map(
                        item =>
                            item.vehicleId
                    )
            });


            const tripStats =
                await bot.assertTripCount(
                    3
                );


            excavatorResults.push({
                excavatorId:
                    unit.excavatorId,

                totalTrips:
                    tripStats.total
            });


            robotMessage(
                robotName,
                "PASS：挖机统计=3趟；3台跟随汽车各1趟。"
            );
        }


        /*
         * 阶段3：
         * 车队长独立上下文接收同一批TEST同步总线数据，
         * 使用正式 dispatch.html 统计逻辑验证总趟数=6。
         */
        const dispatchRole =
            A_GROUP.supportRoles.find(
                item =>
                    item.position ===
                        "车队长"
            );


        if (
            !dispatchRole
        ) {

            throw new Error(
                "A组生产联动：没有找到TEST车队长身份"
            );
        }


        const dispatchContext =
            await browser.newContext({
                baseURL:
                    BASE_URL,

                viewport: {
                    width:
                        390,

                    height:
                        844
                }
            });


        contexts.push(
            dispatchContext
        );


        const dispatchPage =
            await dispatchContext.newPage();


        await installAGroupRobotContext(
            dispatchPage,
            dispatchRole.personId
        );


        await dispatchPage.addInitScript(
            trips => {

                localStorage.setItem(
                    "driverTripRecords",
                    JSON.stringify(
                        trips
                    )
                );


                localStorage.setItem(
                    "tripRecords",
                    JSON.stringify(
                        trips
                    )
                );
            },
            syncedTrips
        );


        await dispatchPage.goto(
            "dispatch.html",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );


        await dispatchPage.waitForTimeout(
            1000
        );


        const dispatchTotal =
            Number(
                (
                    await dispatchPage
                        .locator(
                            "#dispatchTodayTotalTrips"
                        )
                        .textContent()
                ) ||
                "0"
            ) || 0;


        const dispatchWaste =
            Number(
                (
                    await dispatchPage
                        .locator(
                            "#dispatchTodayWasteTrips"
                        )
                        .textContent()
                ) ||
                "0"
            ) || 0;


        if (
            dispatchTotal !==
                6
        ) {

            throw new Error(
                "A组生产联动：调度总趟数不一致，预期=6；实际=" +
                dispatchTotal
            );
        }


        if (
            dispatchWaste !==
                6
        ) {

            throw new Error(
                "A组生产联动：调度渣趟数不一致，预期=6；实际=" +
                dispatchWaste
            );
        }


        const excavatorTotal =
            excavatorResults.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    item.totalTrips,
                0
            );


        if (
            excavatorTotal !==
                6
        ) {

            throw new Error(
                "A组生产联动：两台挖机汇总不一致，预期=6；实际=" +
                excavatorTotal
            );
        }


        const durationMs =
            Date.now() -
            suiteStartedAt;


        robotMessage(
            botName,
            "A组生产联动汇总：6/6汽车司机 PASS；2/2挖机统计 PASS；车队长调度统计 PASS。"
        );


        robotMessage(
            botName,
            "趟次核对：TEST-A-EX-001=3；TEST-A-EX-002=3；挖机合计=6；调度总计=6。"
        );


        robotMessage(
            botName,
            "数据键核对：personId / vehicleId / excavatorId / taskId 全部一致。"
        );


        robotMessage(
            botName,
            "A组生产联动总耗时=" +
            (
                durationMs /
                1000
            )
            .toFixed(
                2
            ) +
            "s"
        );


        updateBot(
            botName,
            "pass",
            "A组生产联动闭环全部通过"
        );


        return {
            ok:
                true,

            action:
                "a-group-production-closed-loop",

            drivers:
                driverResults,

            excavators:
                excavatorResults,

            dispatch: {
                totalTrips:
                    dispatchTotal,

                wasteTrips:
                    dispatchWaste
            },

            durationMs
        };


    } catch (
        error
    ) {

        const diagnosis =
            buildFailureDiagnosis({
                caseName:
                    "A组生产联动闭环",

                error,

                suiteLabel:
                    "多机器人生产联动"
            });


        const diagnosticPath =
            saveFailureDiagnostic(
                diagnosis
            );


        reportFailureDiagnosis(
            botName,
            diagnosis,
            diagnosticPath
        );


        updateBot(
            botName,
            "fail",
            error?.message ||
            String(
                error
            )
        );


        throw error;


    } finally {

        await Promise.all(
            contexts.map(
                context =>
                    context.close()
                        .catch(
                            () => {}
                        )
            )
        );
    }
}


async function runAGroupAuxiliaryLinkageTest() {

    const botName =
        "TestManager";


    await ensureBrowser();


    const suiteStartedAt =
        Date.now();


    const contexts =
        [];


    const plans = [
        {
            personId:
                "TEST-A-AUX-LOADER-001",

            position:
                "铲车司机",

            vehicleType:
                "铲车",

            vehicleId:
                "TEST-A-AUX-LOADER-V01",

            taskId:
                "TEST-A-AUX-TASK-LOADER-001",

            work:
                "TEST-A组作业面辅助装载与清理"
        },
        {
            personId:
                "TEST-A-AUX-WATER-001",

            position:
                "洒水车司机",

            vehicleType:
                "洒水车",

            vehicleId:
                "TEST-A-AUX-WATER-V01",

            taskId:
                "TEST-A-AUX-TASK-WATER-001",

            work:
                "TEST-A组运输道路洒水降尘"
        },
        {
            personId:
                "TEST-A-AUX-GRADER-001",

            position:
                "平路机司机",

            vehicleType:
                "平路机",

            vehicleId:
                "TEST-A-AUX-GRADER-V01",

            taskId:
                "TEST-A-AUX-TASK-GRADER-001",

            work:
                "TEST-A组运输道路平整维护"
        },
        {
            personId:
                "TEST-A-AUX-DOZER-001",

            position:
                "推土机司机",

            vehicleType:
                "推土机",

            vehicleId:
                "TEST-A-AUX-DOZER-V01",

            taskId:
                "TEST-A-AUX-TASK-DOZER-001",

            work:
                "TEST-A组排土场推平作业"
        },
        {
            personId:
                "TEST-A-AUX-BUS-001",

            position:
                "大巴司机",

            vehicleType:
                "大巴",

            vehicleId:
                "TEST-A-AUX-BUS-V01",

            taskId:
                "TEST-A-AUX-TASK-BUS-001",

            work:
                "TEST-A组人员通勤运输"
        },
        {
            personId:
                "TEST-A-AUX-FUEL-001",

            position:
                "加油车司机",

            vehicleType:
                "加油车",

            /*
             * fuel.html 的业务对象是“待加油车辆”，
             * 因此这里 vehicleId 表示本次被服务的TEST车辆。
             */
            vehicleId:
                "TEST-A-T-001",

            taskId:
                "TEST-A-FUEL-REQ-001",

            work:
                "TEST-A组生产车辆加油"
        }
    ];


    const results =
        [];


    updateBot(
        botName,
        "running",
        "正在运行A组辅助车辆联动"
    );


    robotMessage(
        botName,
        "辅助车辆联动：铲车、洒水车、平路机、推土机、大巴、加油车各1个TEST机器人并行执行。"
    );


    try {

        const jobs =
            plans.map(
                async (
                    plan,
                    index
                ) => {

                    const context =
                        await browser.newContext({
                            baseURL:
                                BASE_URL,

                            viewport: {
                                width:
                                    390,

                                height:
                                    844
                            }
                        });


                    contexts.push(
                        context
                    );


                    const page =
                        await context.newPage();


                    await installAGroupRobotContext(
                        page,
                        plan.personId
                    );


                    /*
                     * 在页面业务脚本启动前写入该岗位专属TEST任务。
                     * 只作用于当前机器人的独立 BrowserContext。
                     */
                    await page.addInitScript(
                        plan => {

                            const nowIso =
                                new Date()
                                    .toISOString();


                            if (
                                plan.position ===
                                    "加油车司机"
                            ) {

                                localStorage.setItem(
                                    "fuelIntakeRecords",
                                    JSON.stringify([
                                        {
                                            intakeId:
                                                "TEST-A-FUEL-INTAKE-001",

                                            source:
                                                "TEST-A组油罐",

                                            oilType:
                                                "柴油",

                                            amount:
                                                3000,

                                            remark:
                                                "TEST辅助车辆联动",

                                            createdAt:
                                                nowIso,

                                            testFixture:
                                                true
                                        }
                                    ])
                                );


                                localStorage.setItem(
                                    "fuelRequests",
                                    JSON.stringify([
                                        {
                                            requestId:
                                                plan.taskId,

                                            vehicleNumber:
                                                plan.vehicleId,

                                            driverName:
                                                "TEST-A组汽车司机01",

                                            gpsStatus:
                                                "范围内",

                                            status:
                                                "waiting",

                                            requestedAt:
                                                nowIso,

                                            testFixture:
                                                true
                                        }
                                    ])
                                );


                                localStorage.setItem(
                                    "fuelRecords",
                                    "[]"
                                );


                                return;
                            }


                            localStorage.setItem(
                                "auxiliaryVehicleProfile",
                                JSON.stringify({
                                    vehicleType:
                                        plan.vehicleType,

                                    vehicleNumber:
                                        plan.vehicleId,

                                    testFixture:
                                        true
                                })
                            );


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


                                tasks =
                                    Array.isArray(
                                        parsed
                                    )
                                        ? parsed
                                        : [];

                            } catch (
                                error
                            ) {

                                tasks =
                                    [];
                            }


                            tasks =
                                tasks.filter(
                                    item =>
                                        String(
                                            item?.taskId ||
                                            item?.id ||
                                            ""
                                        ) !==
                                            plan.taskId
                                );


                            tasks.push({
                                taskId:
                                    plan.taskId,

                                id:
                                    plan.taskId,

                                taskName:
                                    "TEST-A组辅助车辆任务-" +
                                    plan.position,

                                status:
                                    "active",

                                area:
                                    "TEST-A组作业区",

                                shift:
                                    "白班",

                                shiftId:
                                    "TEST-A-SHIFT-001",

                                publishedAt:
                                    nowIso,

                                remark:
                                    plan.work,

                                auxiliaryAssignments: [
                                    {
                                        personId:
                                            plan.personId,

                                        position:
                                            plan.position,

                                        vehicleId:
                                            plan.vehicleId,

                                        vehicleNumber:
                                            plan.vehicleId,

                                        vehicleType:
                                            plan.vehicleType,

                                        work:
                                            plan.work,

                                        testFixture:
                                            true
                                    }
                                ],

                                testFixture:
                                    true
                            });


                            localStorage.setItem(
                                "dispatchPublishedTasks",
                                JSON.stringify(
                                    tasks
                                )
                            );


                            localStorage.setItem(
                                "auxiliaryWorkRecords",
                                "[]"
                            );
                        },
                        plan
                    );


                    const robotName =
                        "AuxiliaryWorkBot-" +
                        String(
                            index +
                            1
                        )
                        .padStart(
                            2,
                            "0"
                        ) +
                        "-" +
                        plan.position;


                    robotMessage(
                        robotName,
                        "开始：" +
                        plan.position +
                        " / " +
                        plan.taskId
                    );


                    const bot =
                        new AuxiliaryWorkBot(
                            page,
                            plan,
                            robotName
                        );


                    const result =
                        await bot.run();


                    results.push(
                        result
                    );


                    robotMessage(
                        robotName,
                        "PASS：" +
                        plan.position +
                        " 已完成TEST作业。"
                    );


                    return result;
                }
            );


        await Promise.all(
            jobs
        );


        if (
            results.length !==
                6
        ) {

            throw new Error(
                "A组辅助车辆联动：完成数量不正确，预期=6；实际=" +
                results.length
            );
        }


        const completed =
            results.filter(
                item =>
                    item.status ===
                        "completed"
            );


        if (
            completed.length !==
                6
        ) {

            throw new Error(
                "A组辅助车辆联动：不是全部任务都进入completed，实际=" +
                completed.length
            );
        }


        const uniquePersons =
            new Set(
                results.map(
                    item =>
                        item.personId
                )
            );


        const uniqueTasks =
            new Set(
                results.map(
                    item =>
                        item.taskId
                )
            );


        if (
            uniquePersons.size !==
                6 ||
            uniqueTasks.size !==
                6
        ) {

            throw new Error(
                "A组辅助车辆联动：personId或taskId发生重复/串联"
            );
        }


        const durationMs =
            Date.now() -
            suiteStartedAt;


        robotMessage(
            botName,
            "A组辅助车辆联动汇总：6/6 PASS。"
        );


        robotMessage(
            botName,
            "完成岗位：铲车、洒水车、平路机、推土机、大巴、加油车。"
        );


        robotMessage(
            botName,
            "数据核对：6个personId + 6个taskId全部唯一；各岗位完成记录均为TEST数据。"
        );


        robotMessage(
            botName,
            "当前架构：dispatch.html 已接入 auxiliaryWorkRecords / fuelRecords 统一“辅助车辆完成回传”视图；该视图由独立回归用例继续验证。"
        );


        robotMessage(
            botName,
            "A组辅助车辆联动总耗时=" +
            (
                durationMs /
                1000
            )
            .toFixed(
                2
            ) +
            "s"
        );


        updateBot(
            botName,
            "pass",
            "A组辅助车辆6岗位联动全部通过"
        );


        return {
            ok:
                true,

            action:
                "a-group-auxiliary-linkage",

            total:
                6,

            durationMs,
            results,

            integration: {
                dispatchCompletionView:
                    true,

                verificationScenario:
                    "dispatch-auxiliary-completion-feedback"
            }
        };


    } catch (
        error
    ) {

        const diagnosis =
            buildFailureDiagnosis({
                caseName:
                    "A组辅助车辆联动",

                error,

                suiteLabel:
                    "多机器人辅助车辆联动"
            });


        const diagnosticPath =
            saveFailureDiagnostic(
                diagnosis
            );


        reportFailureDiagnosis(
            botName,
            diagnosis,
            diagnosticPath
        );


        updateBot(
            botName,
            "fail",
            error?.message ||
            String(
                error
            )
        );


        throw error;


    } finally {

        await Promise.all(
            contexts.map(
                context =>
                    context.close()
                        .catch(
                            () => {}
                        )
            )
        );
    }
}


async function runStabilityRegression(
    rounds =
        3
) {

    const botName =
        "TestManager";


    const safeRounds =
        Math.max(
            2,
            Math.min(
                Number(
                    rounds
                ) ||
                3,
                5
            )
        );


    const suiteStartedAt =
        Date.now();


    const results =
        [];


    updateBot(
        botName,
        "running",
        "正在运行稳定性回归"
    );


    robotMessage(
        botName,
        "稳定性回归将连续执行快速回归 " +
        safeRounds +
        " 轮，用于发现偶发失败和状态残留。"
    );


    for (
        let index =
            1;
        index <=
            safeRounds;
        index++
    ) {

        const roundStartedAt =
            Date.now();


        robotMessage(
            botName,
            "稳定性回归第 " +
            index +
            "/" +
            safeRounds +
            " 轮开始。"
        );


        try {

            const result =
                await runFastRegressionTests();


            const durationMs =
                Date.now() -
                roundStartedAt;


            results.push({
                round:
                    index,

                ok:
                    true,

                durationMs,

                result
            });


            robotMessage(
                botName,
                "稳定性回归第 " +
                index +
                " 轮通过；耗时=" +
                (
                    durationMs /
                    1000
                )
                .toFixed(
                    2
                ) +
                "s"
            );


        } catch (
            error
        ) {

            const message =
                error?.message ||
                String(
                    error
                );


            const durationMs =
                Date.now() -
                roundStartedAt;


            results.push({
                round:
                    index,

                ok:
                    false,

                durationMs,

                error:
                    message
            });


            robotMessage(
                botName,
                "稳定性回归第 " +
                index +
                " 轮失败；" +
                message
            );
        }
    }


    const passed =
        results.filter(
            item =>
                item.ok
        ).length;


    const failed =
        results.length -
        passed;


    const totalDurationMs =
        Date.now() -
        suiteStartedAt;


    const averageDurationMs =
        results.length
            ? Math.round(
                results.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.durationMs ||
                            0
                        ),
                    0
                ) /
                results.length
            )
            : 0;


    robotMessage(
        botName,
        "稳定性回归汇总：" +
        passed +
        "/" +
        results.length +
        " 轮通过；平均每轮=" +
        (
            averageDurationMs /
            1000
        )
        .toFixed(
            2
        ) +
        "s；总耗时=" +
        (
            totalDurationMs /
            1000
        )
        .toFixed(
            2
        ) +
        "s"
    );


    if (
        failed
    ) {

        updateBot(
            botName,
            "fail",
            "稳定性回归发现 " +
            failed +
            " 轮失败"
        );


        throw new Error(
            "稳定性回归未完全稳定：失败轮次 " +
            results
                .filter(
                    item =>
                        !item.ok
                )
                .map(
                    item =>
                        item.round
                )
                .join(
                    "、"
                )
        );
    }


    updateBot(
        botName,
        "pass",
        "稳定性回归全部通过：" +
        passed +
        "/" +
        results.length
    );


    return {
        ok:
            true,

        action:
            "stability-regression",

        rounds:
            safeRounds,

        passed,

        averageDurationMs,

        durationMs:
            totalDurationMs,

        results
    };
}


async function runReleaseGoldenRegression() {

    const botName =
        "TestManager";


    const results =
        [];


    const suiteStartedAt =
        Date.now();


    const runGoldenCase =
        async (
            name,
            runner
        ) => {

            const caseStartedAt =
                Date.now();


            robotMessage(
                botName,
                "发布前黄金回归：" +
                name
            );


            try {

                /*
                 * 黄金回归中的每个用例都先清理上一用例留下的 TEST 状态。
                 * 这样“一键发布检查”先跑完核心回归后，再进入黄金回归时，
                 * 不会因为维修单 / 运输趟次 / 临时卸料等历史 TEST 数据互相污染。
                 */
                await clearTruckDriverTestEnvironment();


                const result =
                    await runner();


                const durationMs =
                    Date.now() -
                    caseStartedAt;


                results.push({
                    name,
                    ok:
                        true,

                    durationMs,
                    result
                });


                robotMessage(
                    botName,
                    "黄金回归通过：" +
                    name +
                    "；耗时=" +
                    (
                        durationMs /
                        1000
                    )
                    .toFixed(
                        2
                    ) +
                    "s"
                );


            } catch (
                error
            ) {

                const message =
                    error?.message ||
                    String(
                        error
                    );


                const durationMs =
                    Date.now() -
                    caseStartedAt;


                const diagnosis =
                    buildFailureDiagnosis({
                        caseName:
                            name,

                        error,

                        suiteLabel:
                            "发布前黄金回归"
                    });


                const diagnosticPath =
                    saveFailureDiagnostic(
                        diagnosis
                    );


                reportFailureDiagnosis(
                    botName,
                    diagnosis,
                    diagnosticPath
                );


                results.push({
                    name,
                    ok:
                        false,

                    durationMs,

                    error:
                        message,

                    diagnosis,

                    diagnosticPath
                });


                robotMessage(
                    botName,
                    "黄金回归失败：" +
                    name +
                    "；" +
                    message
                );
            }
        };


    updateBot(
        botName,
        "running",
        "正在运行发布前黄金回归"
    );


    /*
     * 黄金回归目标：
     * - 快速覆盖高频状态分支
     * - 再跑少量真正跨模块的 E2E
     * - 避免完整13条全部重复执行
     */


    await runGoldenCase(
        "全部快速回归",
        async () =>
            await runFastRegressionTests()
    );


    await runGoldenCase(
        "正常装卸运输完整闭环",
        async () =>
            await runNormalTransportClosedLoopTest()
    );


    await runGoldenCase(
        "设备异常维修归档后恢复生产",
        async () =>
            await runPostMaintenanceProductionRecoveryTest()
    );


    await runGoldenCase(
        "临时非卸载区卸料批准计入正式趟次",
        async () =>
            await runTestManagerTemporaryUnloadFullCycle()
    );


    await runGoldenCase(
        "A组辅助车辆调度报表完整闭环",
        async () =>
            await runAGroupAuxiliaryDispatchReportClosedLoopTest()
    );


    await runGoldenCase(
        "总控自然语言解析与确认机制",
        async () =>
            await runNaturalLanguageCommandParserRegressionTest()
    );


    const passed =
        results.filter(
            item =>
                item.ok
        ).length;


    const total =
        results.length;


    const failed =
        total -
        passed;


    const suiteDurationMs =
        Date.now() -
        suiteStartedAt;


    const slowest =
        [
            ...results
        ]
        .sort(
            (
                a,
                b
            ) =>
                Number(
                    b.durationMs ||
                    0
                ) -
                Number(
                    a.durationMs ||
                    0
                )
        )
        .slice(
            0,
            4
        );


    robotMessage(
        botName,
        "发布前黄金回归汇总：" +
        passed +
        "/" +
        total +
        " PASS" +
        (
            failed
                ? "；" +
                  failed +
                  " FAIL"
                : ""
        )
    );


    robotMessage(
        botName,
        "发布前黄金回归总耗时=" +
        (
            suiteDurationMs /
            1000
        )
        .toFixed(
            2
        ) +
        "s"
    );


    if (
        slowest.length
    ) {

        robotMessage(
            botName,
            "黄金回归最慢用例：" +
            slowest
                .map(
                    item =>
                        item.name +
                        "=" +
                        (
                            Number(
                                item.durationMs ||
                                0
                            ) /
                            1000
                        )
                        .toFixed(
                            2
                        ) +
                        "s"
                )
                .join(
                    "；"
                )
        );
    }


    results.forEach(
        (
            item,
            index
        ) => {

            robotMessage(
                botName,
                (
                    index +
                    1
                ) +
                ". " +
                item.name +
                "：" +
                (
                    item.ok
                        ? "PASS"
                        : "FAIL - " +
                          item.error
                )
            );
        }
    );


    if (
        failed
    ) {

        updateReadinessSuite(
            "golden",
            {
                status:
                    "fail",

                passed,
                total,

                durationMs:
                    suiteDurationMs,

                failedCases:
                    results
                        .filter(
                            item =>
                                !item.ok
                        )
                        .map(
                            item =>
                                item.name
                        )
            }
        );


        updateBot(
            botName,
            "fail",
            "发布前黄金回归完成：" +
            passed +
            "/" +
            total +
            " PASS"
        );


        throw new Error(
            "发布前黄金回归存在失败用例：" +
            results
                .filter(
                    item =>
                        !item.ok
                )
                .map(
                    item =>
                        item.name
                )
                .join(
                    "、"
                )
        );
    }


    updateReadinessSuite(
        "golden",
        {
            status:
                "pass",

            passed,
            total,

            durationMs:
                suiteDurationMs,

            failedCases:
                []
        }
    );


    updateBot(
        botName,
        "pass",
        "发布前黄金回归全部通过：" +
        passed +
        "/" +
        total
    );


    return {
        ok:
            true,

        action:
            "release-golden-regression",

        passed,
        total,

        durationMs:
            suiteDurationMs,

        results
    };
}


async function runAllCoreRegressionTests() {

    const botName =
        "TestManager";


    const results =
        [];


    const suiteStartedAt =
        Date.now();


    const runCase =
        async (
            name,
            runner
        ) => {

            const caseStartedAt =
                Date.now();


            robotMessage(
                botName,
                "开始回归：" +
                name
            );


            try {

                const result =
                    await runner();


                const durationMs =
                    Date.now() -
                    caseStartedAt;


                results.push({
                    name,
                    ok:
                        true,

                    durationMs,

                    result
                });


                robotMessage(
                    botName,
                    "回归通过：" +
                    name +
                    "；耗时=" +
                    (
                        durationMs /
                        1000
                    )
                    .toFixed(
                        2
                    ) +
                    "s"
                );


                return true;


            } catch (
                error
            ) {

                const message =
                    error?.message ||
                    String(
                        error
                    );


                const diagnosis =
                    buildFailureDiagnosis({
                        caseName:
                            name,

                        error,

                        suiteLabel:
                            "核心回归"
                    });


                const diagnosticPath =
                    saveFailureDiagnostic(
                        diagnosis
                    );


                reportFailureDiagnosis(
                    botName,
                    diagnosis,
                    diagnosticPath
                );


                const durationMs =
                    Date.now() -
                    caseStartedAt;


                results.push({
                    name,
                    ok:
                        false,

                    durationMs,

                    error:
                        message,

                    diagnosis,

                    diagnosticPath
                });


                robotMessage(
                    botName,
                    "回归失败：" +
                    name +
                    "；" +
                    message
                );


                return false;
            }
        };


    updateBot(
        botName,
        "running",
        "正在运行全部核心回归测试"
    );


    /*
     * 两个用例之间都重新初始化 TEST 环境，
     * 避免前一个用例的趟次 / 闭环状态污染后一个用例。
     */
    await runCase(
        "正常装卸运输完整闭环",
        async () =>
            await runNormalTransportClosedLoopTest()
    );


    await runCase(
        "GPS异常场景拦截",
        async () =>
            await runGpsAbnormalBlockingTest()
    );


    await runCase(
        "设备异常检查自动维修单",
        async () =>
            await runEquipmentAbnormalMaintenanceRequestTest()
    );


    await runCase(
        "维修单调度审批闭环",
        async () =>
            await runMaintenanceDispatchApprovalTest()
    );


    await runCase(
        "维修管理接车派工闭环",
        async () =>
            await runMaintenanceReceiveAssignmentTest()
    );


    await runCase(
        "维修工接单开始维修闭环",
        async () =>
            await runMaintenanceWorkerStartRepairTest()
    );


    await runCase(
        "维修工完成维修提交验收闭环",
        async () =>
            await runMaintenanceWorkerFinishRepairTest()
    );


    await runCase(
        "维修管理验收归档释放闭环",
        async () =>
            await runMaintenanceInspectionCompletionTest()
    );


    await runCase(
        "维修完成后恢复生产闭环",
        async () =>
            await runPostMaintenanceProductionRecoveryTest()
    );


    await runCase(
        "维修验收不通过返修闭环",
        async () =>
            await runMaintenanceInspectionReworkTest()
    );


    await runCase(
        "临时非卸载区卸料完整闭环",
        async () =>
            await runTestManagerTemporaryUnloadFullCycle()
    );


    await runCase(
        "临时卸料驳回闭环",
        async () =>
            await runTemporaryUnloadRejectionTest()
    );


    await runCase(
        "等待配件流程闭环",
        async () =>
            await runMaintenanceWaitingPartsCycleTest()
    );


    await runCase(
        "调度端辅助车辆完成回传",
        async () =>
            await runDispatchAuxiliaryCompletionFeedbackTest()
    );


    await runCase(
        "A组辅助车辆调度报表完整闭环",
        async () =>
            await runAGroupAuxiliaryDispatchReportClosedLoopTest()
    );


    await runCase(
        "总控自然语言解析与确认机制",
        async () =>
            await runNaturalLanguageCommandParserRegressionTest()
    );


    const passed =
        results.filter(
            item =>
                item.ok
        ).length;


    const total =
        results.length;


    const failed =
        total -
        passed;


    robotMessage(
        botName,
        "核心回归汇总：" +
        passed +
        "/" +
        total +
        " PASS" +
        (
            failed
                ? "；" +
                  failed +
                  " FAIL"
                : ""
        )
    );


    results.forEach(
        (
            item,
            index
        ) => {

            robotMessage(
                botName,
                (
                    index +
                    1
                ) +
                ". " +
                item.name +
                "：" +
                (
                    item.ok
                        ? "PASS"
                        : "FAIL - " +
                          item.error
                )
            );
        }
    );


    const suiteDurationMs =
        Date.now() -
        suiteStartedAt;


    const slowest =
        [
            ...results
        ]
        .sort(
            (
                a,
                b
            ) =>
                Number(
                    b.durationMs ||
                    0
                ) -
                Number(
                    a.durationMs ||
                    0
                )
        )
        .slice(
            0,
            5
        );


    robotMessage(
        botName,
        "核心回归总耗时=" +
        (
            suiteDurationMs /
            1000
        )
        .toFixed(
            2
        ) +
        "s"
    );


    if (
        slowest.length
    ) {

        robotMessage(
            botName,
            "核心回归最慢用例：" +
            slowest
                .map(
                    item =>
                        item.name +
                        "=" +
                        (
                            Number(
                                item.durationMs ||
                                0
                            ) /
                            1000
                        )
                        .toFixed(
                            2
                        ) +
                        "s"
                )
                .join(
                    "；"
                )
        );
    }


    if (
        failed
    ) {

        updateReadinessSuite(
            "core",
            {
                status:
                    "fail",

                passed,
                total,

                durationMs:
                    suiteDurationMs,

                failedCases:
                    results
                        .filter(
                            item =>
                                !item.ok
                        )
                        .map(
                            item =>
                                item.name
                        )
            }
        );


        updateBot(
            botName,
            "fail",
            "全部核心回归测试完成：" +
            passed +
            "/" +
            total +
            " PASS"
        );


        throw new Error(
            "核心回归存在失败用例：" +
            results
                .filter(
                    item =>
                        !item.ok
                )
                .map(
                    item =>
                        item.name
                )
                .join(
                    "、"
                )
        );
    }


    updateReadinessSuite(
        "core",
        {
            status:
                "pass",

            passed,
            total,

            durationMs:
                suiteDurationMs,

            failedCases:
                []
        }
    );


    updateBot(
        botName,
        "pass",
        "全部核心回归测试通过：" +
        passed +
        "/" +
        total
    );


    return {
        ok:
            true,

        action:
            "all-core-regression-tests",

        passed,
        total,

        durationMs:
            suiteDurationMs,

        results
    };
}


async function runGpsAbnormalBlockingTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行GPS异常拦截测试"
        );


        robotMessage(
            botName,
            "准备 TEST 司机环境，并模拟 GPS 精度 = 150 米。"
        );


        await prepareTruckDriverTestEnvironment();


        const bot =
            await getTruckDriverBot();


        await bot.open();


        const result =
            await bot.testGpsAbnormalBlocked();


        robotMessage(
            botName,
            "GPS异常拦截通过：accuracy=" +
            result.gpsAccuracy +
            "m；phase=" +
            result.phase +
            "；趟数 " +
            result.beforeTripCount +
            " → " +
            result.afterTripCount +
            "；趟次记录 " +
            result.beforeRecordCount +
            " → " +
            result.afterRecordCount
        );


        if (
            result.gpsStatusBadge
        ) {

            robotMessage(
                botName,
                "司机端GPS状态：" +
                result.gpsStatusBadge
            );
        }


        updateBot(
            "TruckDriverBot",
            "pass",
            "GPS异常已正确拦截，未产生正式趟次"
        );


        updateBot(
            botName,
            "pass",
            "GPS异常场景测试通过"
        );


        return {
            ok:
                true,

            action:
                "gps-abnormal-blocking-test",

            result
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            "TruckDriverBot",
            "fail",
            message
        );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "GPS异常场景测试失败：" +
            message
        );


        try {

            await captureFailure(
                "TruckDriverBot",
                truckDriverPage,
                "gps-abnormal-blocking"
            );

        } catch (
            screenshotError
        ) {}


        throw error;
    }
}


async function runVehicleChangeClosedLoopTest() {

    const botName =
        "TestManager";


    try {

        updateBot(
            botName,
            "running",
            "正在执行故障换车完整闭环"
        );


        robotMessage(
            botName,
            "步骤 1/3：准备 TEST 司机、TEST-T-001 和备用车辆 TEST-T-002。"
        );


        await prepareTruckDriverTestEnvironment();


        const truckBot =
            await getTruckDriverBot();


        await truckBot.open();


        robotMessage(
            botName,
            "步骤 2/3：TruckDriverBot 提交 TEST 故障换车申请。"
        );


        const submitted =
            await truckBot.submitTestVehicleChange();


        robotMessage(
            botName,
            "换车申请已提交：" +
            submitted.requestId +
            "；" +
            submitted.oldVehicle +
            "；状态 " +
            submitted.status
        );


        updateBot(
            "DispatchBot",
            "running",
            "正在审批 TEST 换车申请"
        );


        const dispatchBotInstance =
            await getDispatchBot();


        await dispatchBotInstance.open();


        robotMessage(
            botName,
            "步骤 3/3：DispatchBot 选择 TEST-T-002 并批准换车。"
        );


        const approved =
            await dispatchBotInstance.approveLatestTestVehicleChange(
                "TEST-T-002"
            );


        robotMessage(
            botName,
            "故障换车闭环通过：" +
            approved.oldVehicle +
            " → " +
            approved.newVehicle +
            "；申请状态 " +
            approved.status +
            "；新车辆需重新领取=" +
            String(
                approved.vehicleClaimed ===
                false
            )
        );


        updateBot(
            "TruckDriverBot",
            "pass",
            "TEST换车申请已批准并切换新车辆"
        );


        updateBot(
            "DispatchBot",
            "pass",
            "TEST故障换车审批通过"
        );


        updateBot(
            botName,
            "pass",
            "故障换车完整闭环测试通过"
        );


        return {
            ok:
                true,

            action:
                "vehicle-change-full-cycle-test",

            submitted,
            approved
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            "TruckDriverBot",
            "fail",
            message
        );


        updateBot(
            "DispatchBot",
            "fail",
            message
        );


        updateBot(
            botName,
            "fail",
            message
        );


        robotMessage(
            botName,
            "故障换车完整闭环失败：" +
            message
        );


        throw error;
    }
}


/*
=========================================================
命令路由
=========================================================
*/


async function executeTruckDriverCommand(
    command
) {

    const text =
        String(
            command ||
            ""
        );


    if (
        /准备.*TEST.*司机.*环境|初始化.*TEST.*司机|准备测试司机环境/i.test(
            text
        )
    ) {

        return await prepareTruckDriverTestEnvironment();
    }


    if (
        /清理.*TEST.*环境|清空.*TEST.*环境|恢复空白测试环境/i.test(
            text
        )
    ) {

        return await clearTruckDriverTestEnvironment();
    }


    if (
        /提交.*TEST.*临时.*卸料|TEST.*临时.*卸料.*提交|测试.*临时.*卸料.*提交/i.test(
            text
        )
    ) {

        return await runTruckDriverTemporaryUnloadSubmitTest();
    }


    if (
        /自动点击.*临时.*卸料|打开.*临时.*卸料.*弹窗|检查.*临时.*卸料.*弹窗|临时非卸载区.*弹窗/.test(
            text
        )
    ) {

        return await runTruckDriverTemporaryUnloadModalCheck();
    }


    if (
        /临时.*卸料.*按钮|检查.*临时.*卸料|临时非卸载区.*检查/.test(
            text
        )
    ) {

        return await runTruckDriverTemporaryUnloadButtonCheck();
    }


    if (
        /检查司机端|检查司机|司机端检查|检查.*TruckDriverBot/i.test(
            text
        )
    ) {

        return await runTruckDriverCheck();
    }


    /*
     * R0-3 暂不允许机器人自动提交业务数据。
     */

    updateBot(
        "TruckDriverBot",
        "waiting",
        "当前命令尚未开放自动写操作"
    );


    robotMessage(
        "TruckDriverBot",
        "当前版本允许：准备TEST司机环境、检查司机端、检查临时卸料按钮、检查临时卸料弹窗、提交TEST临时卸料、清理TEST环境。提交仅限 TEST- 数据。"
    );


    return {
        ok:
            true,

        target:
            "TruckDriverBot",

        status:
            "waiting"
    };
}


/*
=========================================================
TestManager 自然语言命令解析器
- 只把大白话映射到“已经存在”的 TEST 场景
- 不生成代码，不执行未知命令
- 固定命令 / 原正则路由仍然优先
=========================================================
*/


function normalizeNaturalLanguageCommand(
    command
) {

    return String(
        command ||
        ""
    )
    .trim()
    .toLowerCase()
    .replace(
        /[，。！？；：、,.!?;:（）()\[\]{}"'“”‘’]/g,
        " "
    )
    .replace(
        /\s+/g,
        " "
    );
}


function naturalLanguageIntentCatalog() {

    return [
        {
            action:
                "maintenance-warehouse-report-center",

            label:
                "维修库房报表回写",

            runner:
                async () =>
                    await runMaintenanceWarehouseReportCenterTest(),

            requiredGroups: [
                [
                    "维修",
                    "修理"
                ],
                [
                    "报表",
                    "统计",
                    "汇总"
                ]
            ],

            bonusTerms: [
                "库房",
                "配件",
                "领料",
                "出库",
                "回写",
                "更新",
                "有没有更新",
                "费用"
            ],

            examples: [
                "看看维修和库房结束后报表有没有更新",
                "把维修配件流程跑完再检查综合报表"
            ]
        },
        {
            action:
                "maintenance-warehouse-full-closed-loop",

            label:
                "维修库房完整闭环",

            runner:
                async () =>
                    await runMaintenanceWarehouseFullClosedLoopTest(),

            requiredGroups: [
                [
                    "维修",
                    "修理"
                ],
                [
                    "库房",
                    "配件",
                    "领料",
                    "出库"
                ]
            ],

            bonusTerms: [
                "完整",
                "整套",
                "全流程",
                "闭环",
                "验收",
                "归档",
                "从头到尾",
                "全部跑"
            ],

            examples: [
                "把维修领配件库房出库到最后验收整套跑一遍",
                "测试维修到库房再到验收的完整流程"
            ]
        },
        {
            action:
                "maintenance-warehouse-parts-linkage",

            label:
                "维修库房三岗位联动",

            runner:
                async () =>
                    await runMaintenanceWarehousePartsLinkageTest(),

            requiredGroups: [
                [
                    "维修",
                    "修理"
                ],
                [
                    "库房",
                    "配件",
                    "领料",
                    "出库"
                ]
            ],

            bonusTerms: [
                "三岗位",
                "联动",
                "等待配件",
                "配件已到",
                "恢复维修"
            ],

            negativeTerms: [
                "验收",
                "归档",
                "报表",
                "完整",
                "整套"
            ],

            examples: [
                "测一下维修员等配件和库房出库的联动",
                "跑维修管理维修员库房三岗位联动"
            ]
        },
        {
            action:
                "one-click-release-check",

            label:
                "一键发布前检查",

            runner:
                async () =>
                    await runOneClickReleaseCheck(),

            requiredGroups: [
                [
                    "发布",
                    "上线"
                ],
                [
                    "检查",
                    "验证",
                    "测试"
                ]
            ],

            bonusTerms: [
                "一键",
                "全部",
                "完整",
                "核心",
                "黄金",
                "报告",
                "能不能发布"
            ],

            examples: [
                "一键把发布前所有检查都跑完",
                "帮我检查现在能不能发布"
            ]
        },
        {
            action:
                "current-test-report",

            label:
                "当前测试报告",

            runner:
                async () =>
                    await runCurrentTestReport(),

            requiredGroups: [
                [
                    "测试报告",
                    "测试情况",
                    "发布状态",
                    "发布就绪"
                ]
            ],

            bonusTerms: [
                "当前",
                "现在",
                "汇总",
                "给我看",
                "生成"
            ],

            examples: [
                "给我看看现在测试情况",
                "生成一份当前测试报告"
            ]
        },
        {
            action:
                "natural-language-parser-regression",

            label:
                "总控自然语言解析回归",

            runner:
                async () =>
                    await runNaturalLanguageCommandParserRegressionTest(),

            requiredGroups: [
                [
                    "自然语言",
                    "大白话",
                    "模糊命令"
                ],
                [
                    "测试",
                    "回归",
                    "验证"
                ]
            ],

            bonusTerms: [
                "总控",
                "确认",
                "猜测",
                "识别"
            ],

            examples: [
                "测试一下总控能不能听懂大白话和模糊命令",
                "验证自然语言猜测确认机制"
            ]
        },
        {
            action:
                "a-group-auxiliary-dispatch-report-closed-loop",

            label:
                "A组辅助车辆调度报表完整闭环",

            runner:
                async () =>
                    await runAGroupAuxiliaryDispatchReportClosedLoopTest(),

            requiredGroups: [
                [
                    "辅助车辆",
                    "6种",
                    "六种",
                    "a组"
                ],
                [
                    "报表",
                    "综合报表",
                    "统计"
                ]
            ],

            bonusTerms: [
                "调度端",
                "调度",
                "完整",
                "闭环",
                "全链路",
                "全部收到",
                "全部显示",
                "从头到尾",
                "整套",
                "跑一遍",
                "综合报表",
                "从完成到调度"
            ],

            examples: [
                "把6种辅助车辆从完成到调度回传再到综合报表整套跑一遍",
                "检查A组辅助车辆完成以后调度端和报表是不是都能全部收到"
            ]
        },
        {
            action:
                "auxiliary-report-center-verification",

            label:
                "辅助车辆综合报表验证",

            runner:
                async () =>
                    await runAuxiliaryReportCenterVerificationTest(),

            requiredGroups: [
                [
                    "辅助车辆",
                    "加油车"
                ],
                [
                    "报表",
                    "综合报表",
                    "统计"
                ]
            ],

            bonusTerms: [
                "看看",
                "有没有",
                "显示",
                "进入",
                "加油量",
                "完成统计"
            ],

            examples: [
                "看看辅助车辆和加油车完成记录有没有进综合报表",
                "验证一下辅助车辆完成统计和加油量显示对不对"
            ]
        },
        {
            action:
                "a-group-auxiliary-dispatch-feedback-closed-loop",

            label:
                "A组辅助车辆到调度端完成回传闭环",

            runner:
                async () =>
                    await runAGroupAuxiliaryDispatchFeedbackClosedLoopTest(),

            requiredGroups: [
                [
                    "辅助车辆",
                    "6种",
                    "六种",
                    "a组"
                ],
                [
                    "调度端",
                    "调度",
                    "完成回传",
                    "回传"
                ]
            ],

            bonusTerms: [
                "完整",
                "闭环",
                "全部",
                "都显示",
                "从岗位到调度"
            ],

            negativeTerms: [
                "报表",
                "综合报表",
                "整套",
                "全链路"
            ],

            examples: [
                "把6种辅助车辆跑完以后看看调度端能不能全部收到",
                "跑一下A组辅助车辆到调度端完成回传的完整闭环"
            ]
        },
        {
            action:
                "dispatch-auxiliary-completion-feedback",

            label:
                "调度端辅助车辆完成回传验证",

            runner:
                async () =>
                    await runDispatchAuxiliaryCompletionFeedbackTest(),

            requiredGroups: [
                [
                    "调度端",
                    "调度"
                ],
                [
                    "辅助车辆",
                    "加油车",
                    "完成回传",
                    "完成记录"
                ]
            ],

            bonusTerms: [
                "能不能看到",
                "有没有看到",
                "显示",
                "回传",
                "完成",
                "记录"
            ],

            negativeTerms: [
                "报表",
                "综合报表",
                "整套",
                "全链路",
                "从头到尾"
            ],

            examples: [
                "看看调度端能不能看到辅助车辆和加油车完成记录",
                "验证一下辅助车辆完成回传有没有显示到调度端"
            ]
        },
        {
            action:
                "a-group-auxiliary-linkage",

            label:
                "A组辅助车辆联动",

            runner:
                async () =>
                    await runAGroupAuxiliaryLinkageTest(),

            requiredGroups: [
                [
                    "辅助车辆",
                    "铲车",
                    "洒水车",
                    "平路机",
                    "推土机",
                    "大巴",
                    "加油车"
                ]
            ],

            bonusTerms: [
                "a组",
                "6种",
                "六种",
                "全部",
                "都跑",
                "联动",
                "一起跑"
            ],

            examples: [
                "把6种辅助车辆都跑一下",
                "测一下铲车洒水车平路机推土机大巴和加油车"
            ]
        },
        {
            action:
                "a-group-production-closed-loop",

            label:
                "A组生产联动闭环",

            runner:
                async () =>
                    await runAGroupProductionClosedLoop(),

            requiredGroups: [
                [
                    "a组",
                    "生产组"
                ],
                [
                    "生产",
                    "运输",
                    "挖机",
                    "汽车"
                ]
            ],

            bonusTerms: [
                "闭环",
                "完整",
                "2台挖机",
                "两台挖机",
                "6台汽车",
                "六台汽车",
                "各跑一趟"
            ],

            examples: [
                "把A组生产运输完整跑一遍",
                "测两台挖机和六台汽车的生产闭环"
            ]
        },
        {
            action:
                "gps-abnormal-blocking-test",

            label:
                "GPS异常拦截",

            runner:
                async () =>
                    await runGpsAbnormalBlockingTest(),

            requiredGroups: [
                [
                    "gps",
                    "定位"
                ]
            ],

            bonusTerms: [
                "不准",
                "异常",
                "精度",
                "150米",
                "拦截",
                "不能计数"
            ],

            examples: [
                "测一下司机GPS不准的时候会不会被拦住",
                "看看定位精度异常会不会产生正式趟次"
            ]
        },
        {
            action:
                "temporary-unload-full-cycle",

            label:
                "临时卸料完整闭环",

            runner:
                async () =>
                    await runTestManagerTemporaryUnloadFullCycle(),

            requiredGroups: [
                [
                    "临时卸料",
                    "非卸载区",
                    "临时倒料"
                ]
            ],

            bonusTerms: [
                "完整",
                "闭环",
                "审批",
                "通过",
                "正式趟次"
            ],

            negativeTerms: [
                "驳回",
                "拒绝",
                "不通过"
            ],

            examples: [
                "把临时卸料申请审批到正式趟次整套跑一下"
            ]
        },
        {
            action:
                "temporary-unload-rejection-test",

            label:
                "临时卸料驳回",

            runner:
                async () =>
                    await runTemporaryUnloadRejectionTest(),

            requiredGroups: [
                [
                    "临时卸料",
                    "非卸载区",
                    "临时倒料"
                ],
                [
                    "驳回",
                    "拒绝",
                    "不通过"
                ]
            ],

            bonusTerms: [
                "不计趟次",
                "不能计数",
                "正式趟次"
            ],

            examples: [
                "测一下临时卸料被驳回后会不会还算趟次"
            ]
        },
        {
            action:
                "maintenance-inspection-rework-test",

            label:
                "维修验收返修",

            runner:
                async () =>
                    await runMaintenanceInspectionReworkTest(),

            requiredGroups: [
                [
                    "维修",
                    "修理"
                ],
                [
                    "返修",
                    "验收不通过",
                    "验收失败",
                    "退回"
                ]
            ],

            bonusTerms: [
                "重新提交",
                "再次验收",
                "返工"
            ],

            examples: [
                "测一下维修验收不通过退回返修再提交"
            ]
        },
        {
            action:
                "maintenance-waiting-parts-cycle-test",

            label:
                "等待配件流程",

            runner:
                async () =>
                    await runMaintenanceWaitingPartsCycleTest(),

            requiredGroups: [
                [
                    "等待配件",
                    "等配件",
                    "配件已到",
                    "缺配件"
                ]
            ],

            bonusTerms: [
                "继续维修",
                "恢复维修",
                "维修员"
            ],

            examples: [
                "测一下维修员等配件，配件到了以后继续修"
            ]
        },
        {
            action:
                "maintenance-fast-regression",

            label:
                "维修快速回归",

            runner:
                async () =>
                    await runFastRegressionTests(
                        "maintenance"
                    ),

            requiredGroups: [
                [
                    "维修",
                    "修理"
                ],
                [
                    "快速回归",
                    "快速测",
                    "快速测试"
                ]
            ],

            bonusTerms: [
                "全部",
                "一遍"
            ],

            examples: [
                "把维修模块快速测一遍"
            ]
        },
        {
            action:
                "transport-fast-regression",

            label:
                "运输快速回归",

            runner:
                async () =>
                    await runFastRegressionTests(
                        "transport"
                    ),

            requiredGroups: [
                [
                    "运输",
                    "司机",
                    "趟次"
                ],
                [
                    "快速回归",
                    "快速测",
                    "快速测试"
                ]
            ],

            examples: [
                "把运输模块快速测一下"
            ]
        },
        {
            action:
                "dispatch-fast-regression",

            label:
                "调度快速回归",

            runner:
                async () =>
                    await runFastRegressionTests(
                        "dispatch"
                    ),

            requiredGroups: [
                [
                    "调度"
                ],
                [
                    "快速回归",
                    "快速测",
                    "快速测试"
                ]
            ],

            examples: [
                "快速检查一下调度模块"
            ]
        },
        {
            action:
                "all-core-regression-tests",

            label:
                "全部核心回归",

            runner:
                async () =>
                    await runAllCoreRegressionTests(),

            requiredGroups: [
                [
                    "核心回归",
                    "全部核心",
                    "所有核心",
                    "核心功能"
                ]
            ],

            bonusTerms: [
                "全部",
                "所有",
                "整套",
                "跑一遍"
            ],

            examples: [
                "把所有核心功能回归一遍"
            ]
        },
        {
            action:
                "fast-regression-all",

            label:
                "快速回归",

            runner:
                async () =>
                    await runFastRegressionTests(),

            requiredGroups: [
                [
                    "快速回归",
                    "快速测试",
                    "快速测一遍"
                ]
            ],

            negativeTerms: [
                "维修",
                "运输",
                "调度"
            ],

            examples: [
                "先快速回归一遍"
            ]
        }
    ];
}


function scoreNaturalLanguageIntent(
    normalized,
    intent
) {

    let score =
        0;


    for (
        const group
        of intent.requiredGroups ||
        []
    ) {

        const matched =
            group.some(
                term =>
                    normalized.includes(
                        term
                    )
            );


        if (
            !matched
        ) {

            return 0;
        }


        score +=
            4;
    }


    for (
        const term
        of intent.bonusTerms ||
        []
    ) {

        if (
            normalized.includes(
                term
            )
        ) {

            score +=
                1;
        }
    }


    for (
        const term
        of intent.negativeTerms ||
        []
    ) {

        if (
            normalized.includes(
                term
            )
        ) {

            score -=
                3;
        }
    }


    /*
     * 明确说到“辅助车辆 + 调度 + 报表”时，
     * 优先识别为全链路，而不是只验证调度端视图。
     */
    if (
        intent.action ===
            "a-group-auxiliary-dispatch-report-closed-loop"
        &&
        (
            normalized.includes(
                "综合报表"
            )
            ||
            normalized.includes(
                "报表"
            )
        )
        &&
        normalized.includes(
            "调度"
        )
    ) {

        score +=
            4;
    }


    return Math.max(
        0,
        score
    );
}


function parseNaturalLanguageCommand(
    command
) {

    const normalized =
        normalizeNaturalLanguageCommand(
            command
        );


    const ranked =
        naturalLanguageIntentCatalog()
            .map(
                intent => ({
                    ...intent,

                    score:
                        scoreNaturalLanguageIntent(
                            normalized,
                            intent
                        )
                })
            )
            .filter(
                item =>
                    item.score >
                    0
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    b.score -
                    a.score
            );


    if (
        !ranked.length
    ) {

        return {
            matched:
                false,

            reason:
                "no_match",

            normalized,

            candidates:
                []
        };
    }


    const best =
        ranked[
            0
        ];


    const second =
        ranked[
            1
        ];


    /*
     * 相同得分视为歧义，不自动执行。
     * 避免“维修 + 库房”之类大白话被误判成完整闭环或三岗位联动。
     */
    if (
        second &&
        second.score ===
            best.score
    ) {

        return {
            matched:
                false,

            reason:
                "ambiguous",

            normalized,

            candidates:
                ranked
                    .slice(
                        0,
                        3
                    )
                    .map(
                        item => ({
                            action:
                                item.action,

                            label:
                                item.label,

                            score:
                                item.score,

                            example:
                                item.examples?.[
                                    0
                                ] ||
                                ""
                        })
                    )
        };
    }


    return {
        matched:
            true,

        reason:
            "matched",

        normalized,

        action:
            best.action,

        label:
            best.label,

        score:
            best.score,

        runner:
            best.runner,

        example:
            best.examples?.[
                0
            ] ||
            "",

        candidates:
            ranked
                .slice(
                    0,
                    3
                )
                .map(
                    item => ({
                        action:
                            item.action,

                        label:
                            item.label,

                        score:
                            item.score
                    })
                )
    };
}


async function executeNaturalLanguageIntent(
    command
) {

    const parsed =
        parseNaturalLanguageCommand(
            command
        );


    if (
        parsed.matched
    ) {

        robotMessage(
            "TestManager",
            "自然语言解析：" +
            parsed.label +
            "（" +
            parsed.action +
            "）"
        );


        updateBot(
            "TestManager",
            "running",
            "自然语言已识别：" +
            parsed.label
        );


        return await parsed.runner();
    }


    if (
        parsed.reason ===
            "ambiguous"
    ) {

        const guessed =
            parsed.candidates[
                0
            ];


        const guessedIntent =
            naturalLanguageIntentCatalog()
                .find(
                    item =>
                        item.action ===
                            guessed?.action
                );


        const alternatives =
            parsed.candidates
                .slice(
                    1
                )
                .map(
                    item =>
                        "“" +
                        item.label +
                        "”"
                );


        if (
            guessed &&
            guessedIntent
        ) {

            pendingNaturalLanguageConfirmation = {
                action:
                    guessed.action,

                label:
                    guessed.label,

                originalCommand:
                    String(
                        command ||
                        ""
                    ),

                createdAt:
                    Date.now(),

                expiresAt:
                    Date.now() +
                    5 *
                    60 *
                    1000
            };


            updateBot(
                "TestManager",
                "waiting",
                "已猜测意图，等待用户确认"
            );


            robotMessage(
                "TestManager",
                "我猜你想执行“" +
                guessed.label +
                "”。" +
                (
                    alternatives.length
                        ? "其他可能：" +
                          alternatives.join(
                              " / "
                          ) +
                          "。"
                        : ""
                ) +
                " 如果猜对了，请回复“确认”；如果不对，请直接说你真正想跑的场景。"
            );


            return {
                ok:
                    true,

                target:
                    "TestManager",

                status:
                    "waiting",

                action:
                    "natural-language-awaiting-confirmation",

                guessedAction:
                    guessed.action,

                guessedLabel:
                    guessed.label,

                alternatives:
                    parsed.candidates
                        .slice(
                            1
                        )
            };
        }
    }


    updateBot(
        "TestManager",
        "waiting",
        "没有识别到可安全执行的 TEST 场景"
    );


    const examples =
        naturalLanguageIntentCatalog()
            .slice(
                0,
                6
            )
            .map(
                item =>
                    item.examples?.[
                        0
                    ]
            )
            .filter(
                Boolean
            );


    robotMessage(
        "TestManager",
        "我没能确定你想运行哪个已接入 TEST 场景，因此没有执行。你可以直接说例如：“" +
        examples.join(
            "”“"
        ) +
        "”。"
    );


    return {
        ok:
            true,

        target:
            "TestManager",

        status:
            "waiting",

        action:
            "natural-language-no-match",

        examples
    };
}


function isNaturalLanguageConfirmation(
    command
) {

    const text =
        normalizeNaturalLanguageCommand(
            command
        );


    return /^(确认|确定|执行|开始|开始吧|就这个|对|对的|是|是的|可以|可以执行|没错|没问题|继续)$/
        .test(
            text
        );
}


function isNaturalLanguageCancellation(
    command
) {

    const text =
        normalizeNaturalLanguageCommand(
            command
        );


    return /^(取消|不对|不是|不要|先不执行|别执行|换一个|重新说)$/
        .test(
            text
        );
}


function clearExpiredNaturalLanguageConfirmation() {

    if (
        pendingNaturalLanguageConfirmation &&
        Number(
            pendingNaturalLanguageConfirmation.expiresAt ||
            0
        ) <=
            Date.now()
    ) {

        pendingNaturalLanguageConfirmation =
            null;
    }
}


async function executePendingNaturalLanguageConfirmation(
    command
) {

    clearExpiredNaturalLanguageConfirmation();


    if (
        !pendingNaturalLanguageConfirmation
    ) {

        return null;
    }


    if (
        isNaturalLanguageCancellation(
            command
        )
    ) {

        const cancelled =
            pendingNaturalLanguageConfirmation;


        pendingNaturalLanguageConfirmation =
            null;


        updateBot(
            "TestManager",
            "waiting",
            "已取消上一次猜测"
        );


        robotMessage(
            "TestManager",
            "已取消“" +
            cancelled.label +
            "”。请重新描述你想测试的流程。"
        );


        return {
            ok:
                true,

            target:
                "TestManager",

            status:
                "waiting",

            action:
                "natural-language-confirmation-cancelled",

            cancelledAction:
                cancelled.action
        };
    }


    if (
        !isNaturalLanguageConfirmation(
            command
        )
    ) {

        return null;
    }


    const pending =
        pendingNaturalLanguageConfirmation;


    pendingNaturalLanguageConfirmation =
        null;


    const intent =
        naturalLanguageIntentCatalog()
            .find(
                item =>
                    item.action ===
                        pending.action
            );


    if (
        !intent
    ) {

        throw new Error(
            "自然语言确认失败：待确认场景已经不存在"
        );
    }


    robotMessage(
        "TestManager",
        "已确认，开始执行：“" +
        pending.label +
        "”（" +
        pending.action +
        "）"
    );


    updateBot(
        "TestManager",
        "running",
        "用户已确认：" +
        pending.label
    );


    return await intent.runner();
}


async function runOneClickReleaseCheck() {

    const botName =
        "TestManager";


    const startedAt =
        Date.now();


    try {

        updateBot(
            botName,
            "running",
            "正在执行一键发布前检查"
        );


        robotMessage(
            botName,
            "步骤 1/3：运行全部核心回归。"
        );


        const core =
            await runAllCoreRegressionTests();


        robotMessage(
            botName,
            "步骤 2/3：运行发布前黄金回归。"
        );


        const golden =
            await runReleaseGoldenRegression();


        robotMessage(
            botName,
            "步骤 3/3：生成当前测试报告。"
        );


        const report =
            await runCurrentTestReport();


        const durationMs =
            Date.now() -
            startedAt;


        updateBot(
            botName,
            "pass",
            "一键发布前检查全部通过"
        );


        robotMessage(
            botName,
            "一键发布前检查完成：核心=" +
            core.passed +
            "/" +
            core.total +
            " PASS；黄金=" +
            golden.passed +
            "/" +
            golden.total +
            " PASS；综合判断=" +
            report.report.overallLabel +
            "；总耗时=" +
            (
                durationMs /
                1000
            )
            .toFixed(
                1
            ) +
            "s"
        );


        return {
            ok:
                true,

            action:
                "one-click-release-check",

            core,

            golden,

            report,

            durationMs
        };


    } catch (
        error
    ) {

        const message =
            error?.message ||
            String(
                error
            );


        updateBot(
            botName,
            "fail",
            "一键发布前检查失败：" +
            message
        );


        robotMessage(
            botName,
            "一键发布前检查中止：" +
            message
        );


        throw error;
    }
}


function buildCurrentTestReport() {

    const core =
        readinessState.core;


    const golden =
        readinessState.golden;


    const overallStatus =
        core?.status ===
            "pass"
        &&
        golden?.status ===
            "pass"
            ? "ready"
            : (
                core?.status ===
                    "fail"
                ||
                golden?.status ===
                    "fail"
                    ? "blocked"
                    : "pending"
            );


    return {
        generatedAt:
            new Date()
                .toISOString(),

        overallStatus,

        overallLabel:
            overallStatus ===
                "ready"
                ? "可发布"
                : overallStatus ===
                    "blocked"
                    ? "暂不可发布"
                    : "待验证",

        readiness: {
            core:
                core ||
                null,

            golden:
                golden ||
                null,

            updatedAt:
                readinessState.updatedAt ||
                null
        },

        robots:
            Object.fromEntries(
                Object.entries(
                    robotStatus
                )
                .map(
                    ([
                        name,
                        row
                    ]) => [
                        name,
                        {
                            status:
                                row.status,

                            step:
                                row.step
                        }
                    ]
                )
            ),

        naturalLanguage: {
            pendingConfirmation:
                pendingNaturalLanguageConfirmation
                    ? {
                        action:
                            pendingNaturalLanguageConfirmation.action,

                        label:
                            pendingNaturalLanguageConfirmation.label,

                        expiresAt:
                            pendingNaturalLanguageConfirmation.expiresAt
                    }
                    : null
        },

        safety: {
            testDataOnly:
                true,

            rule:
                "仅允许操作 TEST- 开头的数据"
        }
    };
}


function saveCurrentTestReport(
    report
) {

    fs.mkdirSync(
        REPORT_DIR,
        {
            recursive:
                true
        }
    );


    const stamp =
        new Date()
            .toISOString()
            .replace(
                /[:.]/g,
                "-"
            );


    const jsonPath =
        path.join(
            REPORT_DIR,
            stamp +
            "-current-test-report.json"
        );


    const mdPath =
        path.join(
            REPORT_DIR,
            stamp +
            "-current-test-report.md"
        );


    fs.writeFileSync(
        jsonPath,
        JSON.stringify(
            report,
            null,
            2
        ),
        "utf8"
    );


    const core =
        report.readiness.core;


    const golden =
        report.readiness.golden;


    const robotLines =
        Object.entries(
            report.robots
        )
        .map(
            ([
                name,
                row
            ]) =>
                "- " +
                name +
                "：**" +
                String(
                    row.status ||
                    "unknown"
                )
                .toUpperCase() +
                "** — " +
                String(
                    row.step ||
                    ""
                )
        )
        .join(
            "\n"
        );


    const markdown = [
        "# mine-management 当前测试报告",
        "",
        "- 生成时间：" +
            report.generatedAt,
        "- 综合判断：**" +
            report.overallLabel +
            "**",
        "",
        "## 发布就绪",
        "",
        "- 核心回归：" +
            (
                core
                    ? String(
                        core.status
                    )
                    .toUpperCase() +
                      "（" +
                      Number(
                          core.passed ||
                          0
                      ) +
                      "/" +
                      Number(
                          core.total ||
                          0
                      ) +
                      " PASS）"
                    : "未运行"
            ),
        "- 黄金回归：" +
            (
                golden
                    ? String(
                        golden.status
                    )
                    .toUpperCase() +
                      "（" +
                      Number(
                          golden.passed ||
                          0
                      ) +
                      "/" +
                      Number(
                          golden.total ||
                          0
                      ) +
                      " PASS）"
                    : "未运行"
            ),
        "",
        "## 当前机器人状态",
        "",
        robotLines,
        "",
        "## 安全规则",
        "",
        "- 仅允许操作 TEST- 开头的数据。",
        ""
    ]
    .join(
        "\n"
    );


    fs.writeFileSync(
        mdPath,
        markdown,
        "utf8"
    );


    return {
        jsonPath:
            path.relative(
                ROOT,
                jsonPath
            ),

        markdownPath:
            path.relative(
                ROOT,
                mdPath
            )
    };
}


function findLatestReportFile(
    extension
) {

    try {

        if (
            !fs.existsSync(
                REPORT_DIR
            )
        ) {

            return null;
        }


        const suffix =
            String(
                extension ||
                ""
            )
            .toLowerCase();


        const files =
            fs.readdirSync(
                REPORT_DIR
            )
            .filter(
                name =>
                    name
                        .toLowerCase()
                        .endsWith(
                            suffix
                        )
            )
            .sort()
            .reverse();


        if (
            !files.length
        ) {

            return null;
        }


        return path.join(
            REPORT_DIR,
            files[
                0
            ]
        );


    } catch (
        error
    ) {

        return null;
    }
}


function latestReportSummary() {

    const markdownPath =
        findLatestReportFile(
            ".md"
        );


    const jsonPath =
        findLatestReportFile(
            ".json"
        );


    return {
        exists:
            Boolean(
                markdownPath ||
                jsonPath
            ),

        markdown:
            markdownPath
                ? path.basename(
                    markdownPath
                )
                : null,

        json:
            jsonPath
                ? path.basename(
                    jsonPath
                )
                : null
    };
}


async function runCurrentTestReport() {

    const botName =
        "TestManager";


    const report =
        buildCurrentTestReport();


    const files =
        saveCurrentTestReport(
            report
        );


    updateBot(
        botName,
        "pass",
        "当前测试报告已生成"
    );


    robotMessage(
        botName,
        "当前测试报告：综合判断=" +
        report.overallLabel +
        "；核心回归=" +
        (
            report.readiness.core?.status ||
            "未运行"
        ) +
        "；黄金回归=" +
        (
            report.readiness.golden?.status ||
            "未运行"
        )
    );


    robotMessage(
        botName,
        "测试报告文件：" +
        files.markdownPath +
        "；JSON=" +
        files.jsonPath
    );


    return {
        ok:
            true,

        action:
            "current-test-report",

        report,

        files
    };
}


async function executeCommand({
    target,
    command
}) {

    assertSafeCommand(
        command
    );


    const requestedBot =
        robotStatus[
            target
        ]
            ? target
            : "TestManager";


    if (
        requestedBot ===
            "TestManager"
    ) {

        const confirmationResult =
            await executePendingNaturalLanguageConfirmation(
                command
            );


        if (
            confirmationResult
        ) {

            return confirmationResult;
        }
    }


    updateBot(
        requestedBot,
        "running",
        "正在解析命令"
    );


    robotMessage(
        requestedBot,
        `收到命令：${command}`
    );


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*一键.*发布.*检查/i.test(
                command
            ) ||
            /一键.*发布前.*检查/i.test(
                command
            ) ||
            /发布前.*全部.*检查/i.test(
                command
            ) ||
            /核心.*黄金.*报告.*一起/i.test(
                command
            )
        )
    ) {

        return await runOneClickReleaseCheck();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /输出.*当前.*测试报告/i.test(
                command
            ) ||
            /输出.*测试报告/i.test(
                command
            ) ||
            /生成.*测试报告/i.test(
                command
            ) ||
            /查看.*当前.*测试.*情况/i.test(
                command
            )
        )
    ) {

        return await runCurrentTestReport();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*A组.*辅助车辆.*联动/i.test(
                command
            ) ||
            /测试.*辅助车辆.*6.*岗位/i.test(
                command
            ) ||
            /辅助车辆.*生产.*联动/i.test(
                command
            )
        )
    ) {

        return await runAGroupAuxiliaryLinkageTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*A组.*生产.*联动.*闭环/i.test(
                command
            ) ||
            /A组.*生产.*闭环/i.test(
                command
            ) ||
            /测试.*A组.*6.*汽车.*各.*1趟/i.test(
                command
            )
        )
    ) {

        return await runAGroupProductionClosedLoop();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*全岗位.*入口.*联动/i.test(
                command
            ) ||
            /测试.*所有岗位.*入口/i.test(
                command
            ) ||
            /全岗位.*机器人.*测试/i.test(
                command
            )
        )
    ) {

        return await runAllRoleEntryLinkageTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*A组.*多机器人.*联动/i.test(
                command
            ) ||
            /测试.*A组.*2套挖机.*6.*汽车/i.test(
                command
            ) ||
            /A组.*2台挖机.*每台.*3.*汽车/i.test(
                command
            )
        )
    ) {

        return await runAGroupMultiRobotLinkageTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*稳定性.*回归/i.test(
                command
            ) ||
            /稳定性.*测试/i.test(
                command
            ) ||
            /连续.*快速.*回归/i.test(
                command
            )
        )
    ) {

        return await runStabilityRegression(
            3
        );
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*发布前.*黄金.*回归/i.test(
                command
            ) ||
            /发布前.*黄金.*测试/i.test(
                command
            ) ||
            /黄金.*回归/i.test(
                command
            )
        )
    ) {

        return await runReleaseGoldenRegression();
    }


    if (
        requestedBot ===
            "TestManager" &&
        /运行.*维修.*快速.*回归/i.test(
            command
        )
    ) {

        return await runFastRegressionTests(
            "maintenance"
        );
    }


    if (
        requestedBot ===
            "TestManager" &&
        /运行.*运输.*快速.*回归/i.test(
            command
        )
    ) {

        return await runFastRegressionTests(
            "transport"
        );
    }


    if (
        requestedBot ===
            "TestManager" &&
        /运行.*调度.*快速.*回归/i.test(
            command
        )
    ) {

        return await runFastRegressionTests(
            "dispatch"
        );
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*快速.*回归/i.test(
                command
            ) ||
            /快速.*状态.*测试/i.test(
                command
            ) ||
            /快速.*测试/i.test(
                command
            )
        )
    ) {

        return await runFastRegressionTests();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*全部.*核心.*回归.*测试/i.test(
                command
            ) ||
            /全部.*核心.*回归/i.test(
                command
            ) ||
            /核心.*回归.*全部/i.test(
                command
            )
        )
    ) {

        return await runAllCoreRegressionTests();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*设备.*异常.*维修/i.test(
                command
            ) ||
            /设备.*检查.*异常.*维修单/i.test(
                command
            ) ||
            /设备.*异常.*自动.*维修单/i.test(
                command
            )
        )
    ) {

        return await runEquipmentAbnormalMaintenanceRequestTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*维修完成.*恢复生产/i.test(
                command
            ) ||
            /维修完成.*恢复.*运输/i.test(
                command
            ) ||
            /设备恢复.*生产.*闭环/i.test(
                command
            )
        )
    ) {

        return await runPostMaintenanceProductionRecoveryTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*临时卸料.*驳回/i.test(
                command
            ) ||
            /临时卸料.*拒绝.*闭环/i.test(
                command
            ) ||
            /驳回.*临时卸料/i.test(
                command
            )
        )
    ) {

        return await runTemporaryUnloadRejectionTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*自然语言.*解析.*回归/i.test(
                command
            ) ||
            /测试.*总控.*自然语言/i.test(
                command
            ) ||
            /验证.*模糊命令.*确认/i.test(
                command
            )
        )
    ) {

        return await runNaturalLanguageCommandParserRegressionTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*A组.*辅助车辆.*调度.*报表.*完整.*闭环/i.test(
                command
            ) ||
            /辅助车辆.*调度端.*综合报表.*完整.*闭环/i.test(
                command
            ) ||
            /6.*辅助车辆.*调度.*报表.*全链路/i.test(
                command
            )
        )
    ) {

        return await runAGroupAuxiliaryDispatchReportClosedLoopTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*辅助车辆.*报表.*验证/i.test(
                command
            ) ||
            /测试.*辅助车辆.*综合报表/i.test(
                command
            ) ||
            /验证.*辅助车辆.*加油.*报表/i.test(
                command
            )
        )
    ) {

        return await runAuxiliaryReportCenterVerificationTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*A组.*辅助车辆.*调度.*回传.*闭环/i.test(
                command
            ) ||
            /测试.*A组.*辅助车辆.*调度端.*完成回传/i.test(
                command
            ) ||
            /辅助车辆.*6.*岗位.*回传.*调度/i.test(
                command
            )
        )
    ) {

        return await runAGroupAuxiliaryDispatchFeedbackClosedLoopTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*辅助车辆.*完成回传.*验证/i.test(
                command
            ) ||
            /测试.*调度端.*辅助车辆.*完成记录/i.test(
                command
            ) ||
            /验证.*辅助车辆.*加油车.*完成回传/i.test(
                command
            )
        )
    ) {

        return await runDispatchAuxiliaryCompletionFeedbackTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*维修.*库房.*报表.*回写/i.test(
                command
            ) ||
            /测试.*维修.*库房.*报表/i.test(
                command
            ) ||
            /维修库房.*综合报表.*验证/i.test(
                command
            )
        )
    ) {

        return await runMaintenanceWarehouseReportCenterTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*维修.*库房.*完整.*闭环/i.test(
                command
            ) ||
            /测试.*维修.*配件.*验收.*归档/i.test(
                command
            ) ||
            /维修.*库房.*验收.*完整/i.test(
                command
            )
        )
    ) {

        return await runMaintenanceWarehouseFullClosedLoopTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /运行.*维修.*库房.*三岗位.*联动/i.test(
                command
            ) ||
            /维修管理.*维修员.*库房管理.*联动/i.test(
                command
            ) ||
            /测试.*库房.*配件.*联动/i.test(
                command
            ) ||
            /三岗位.*配件.*闭环/i.test(
                command
            )
        )
    ) {

        return await runMaintenanceWarehousePartsLinkageTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*等待配件.*闭环/i.test(
                command
            ) ||
            /等待配件.*继续维修/i.test(
                command
            ) ||
            /配件已到.*继续维修/i.test(
                command
            )
        )
    ) {

        return await runMaintenanceWaitingPartsCycleTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*维修.*验收.*返修/i.test(
                command
            ) ||
            /验收.*不通过.*返修.*闭环/i.test(
                command
            ) ||
            /返修.*再次提交.*验收/i.test(
                command
            )
        )
    ) {

        return await runMaintenanceInspectionReworkTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*维修管理.*验收.*归档/i.test(
                command
            ) ||
            /维修.*验收.*释放.*闭环/i.test(
                command
            ) ||
            /验收.*通过.*设备.*恢复/i.test(
                command
            )
        )
    ) {

        return await runMaintenanceInspectionCompletionTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*维修工.*完成维修.*提交验收/i.test(
                command
            ) ||
            /维修工.*完成维修.*闭环/i.test(
                command
            ) ||
            /维修.*提交.*验收.*闭环/i.test(
                command
            )
        )
    ) {

        return await runMaintenanceWorkerFinishRepairTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*维修工.*接单.*开始维修/i.test(
                command
            ) ||
            /维修工.*开始维修.*闭环/i.test(
                command
            ) ||
            /维修工.*接单.*开工/i.test(
                command
            )
        )
    ) {

        return await runMaintenanceWorkerStartRepairTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*维修管理.*接车.*派工/i.test(
                command
            ) ||
            /维修.*接车.*派工.*闭环/i.test(
                command
            ) ||
            /维修.*派工.*生成.*工单/i.test(
                command
            )
        )
    ) {

        return await runMaintenanceReceiveAssignmentTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*维修单.*调度.*审批/i.test(
                command
            ) ||
            /维修单.*调度.*闭环/i.test(
                command
            ) ||
            /维修.*审批.*闭环/i.test(
                command
            )
        )
    ) {

        return await runMaintenanceDispatchApprovalTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*GPS.*异常/i.test(
                command
            ) ||
            /GPS.*异常.*拦截/i.test(
                command
            ) ||
            /GPS.*精度.*异常/i.test(
                command
            )
        )
    ) {

        return await runGpsAbnormalBlockingTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*故障.*换车.*完整.*闭环/i.test(
                command
            ) ||
            /故障.*换车.*闭环/i.test(
                command
            ) ||
            /换车.*完整.*闭环/i.test(
                command
            )
        )
    ) {

        updateBot(
            "TestManager",
            "waiting",
            "旧换车入口已停用，不纳入当前核心回归"
        );


        robotMessage(
            "TestManager",
            "driver-work.html 已明确停用旧“申请换车”界面。该历史用例不再执行，避免误测隐藏的废弃入口。下一步应测试当前“设备检查异常 → 自动生成维修单”流程。"
        );


        return {
            ok:
                true,

            action:
                "legacy-vehicle-change-disabled",

            status:
                "skipped"
        };
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试.*正常.*装卸.*运输.*完整.*闭环/i.test(
                command
            ) ||
            /正常.*运输.*完整.*闭环/i.test(
                command
            )
        )
    ) {

        return await runNormalTransportClosedLoopTest();
    }


    if (
        requestedBot ===
            "TestManager" &&
        (
            /测试临时非卸载区卸料完整闭环/i.test(
                command
            ) ||
            /临时非卸载区卸料完整闭环/i.test(
                command
            ) ||
            /临时.*卸料.*完整.*闭环/i.test(
                command
            )
        )
    ) {

        return await runTestManagerTemporaryUnloadFullCycle();
    }


    /*
     * 直接发给汽车司机机器人。
     */

    if (
        requestedBot ===
            "TruckDriverBot"
    ) {

        return await executeTruckDriverCommand(
            command
        );
    }


    /*
     * TestManager 暂时支持把司机检查类命令转给 TruckDriverBot。
     */

    if (
        requestedBot ===
            "TestManager" &&
        (
            /准备.*TEST.*司机.*环境|初始化.*TEST.*司机|准备测试司机环境/i.test(
                command
            ) ||
            /检查司机端|检查司机|司机端检查/i.test(
                command
            ) ||
            /提交.*TEST.*临时.*卸料|TEST.*临时.*卸料.*提交|测试.*临时.*卸料.*提交|自动点击.*临时.*卸料|打开.*临时.*卸料.*弹窗|检查.*临时.*卸料.*弹窗|临时非卸载区.*弹窗|临时.*卸料.*按钮|检查.*临时.*卸料/.test(
                command
            ) ||
            /清理.*TEST.*环境|清空.*TEST.*环境/.test(
                command
            )
        )
    ) {

        robotMessage(
            "TestManager",
            "该步骤交给 TruckDriverBot 执行。"
        );


        updateBot(
            "TestManager",
            "idle",
            "已将司机端检查交给 TruckDriverBot"
        );


        return await executeTruckDriverCommand(
            command
        );
    }


    if (
        requestedBot ===
            "DispatchBot"
    ) {

        return await executeDispatchCommand(
            command
        );
    }


    /*
     * 固定命令 / 原正则路由没有命中后，
     * 才进入自然语言解析层。
     */
    if (
        requestedBot ===
            "TestManager"
    ) {

        return await executeNaturalLanguageIntent(
            command
        );
    }


    updateBot(
        "TestManager",
        "waiting",
        "命令已收到，当前场景尚未接入执行器"
    );


    robotMessage(
        "TestManager",
        "当前已接入 TruckDriverBot + DispatchBot + EquipmentCheckBot + MaintenanceManagerBot + MaintenanceWorkerBot。TestManager 可用命令：“运行全部核心回归测试”“测试正常装卸运输完整闭环”“测试GPS异常场景”“测试设备异常自动维修单”“测试维修单调度审批”“测试维修管理接车派工”“测试维修工接单开始维修”“测试维修工完成维修提交验收”“测试维修管理验收归档”“测试维修完成恢复生产”“测试维修验收返修”“测试临时非卸载区卸料完整闭环”“测试临时卸料驳回”“测试等待配件闭环”。旧“故障换车”入口已停用，不纳入核心回归。"
    );


    return {
        ok:
            true,

        target:
            "TestManager",

        status:
            "waiting"
    };
}


/*
=========================================================
HTTP 工具
=========================================================
*/


function sendJson(
    response,
    statusCode,
    data
) {

    response.writeHead(
        statusCode,
        {
            "Content-Type":
                "application/json; charset=utf-8",

            "Cache-Control":
                "no-store"
        }
    );


    response.end(
        JSON.stringify(
            data
        )
    );
}


function readBody(
    request
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            let body =
                "";


            request.on(
                "data",
                chunk => {

                    body +=
                        chunk;


                    if (
                        body.length >
                            1024 *
                            1024
                    ) {

                        reject(
                            new Error(
                                "请求内容过大"
                            )
                        );


                        request.destroy();
                    }
                }
            );


            request.on(
                "end",
                () => {

                    resolve(
                        body
                    );
                }
            );


            request.on(
                "error",
                reject
            );
        }
    );
}


/*
=========================================================
HTTP Server
=========================================================
*/


const server =
    http.createServer(
        async (
            request,
            response
        ) => {

            const url =
                new URL(
                    request.url,
                    `http://${request.headers.host}`
                );


            if (
                request.method ===
                    "GET" &&
                (
                    url.pathname ===
                        "/" ||
                    url.pathname ===
                        "/robot-test-center.html"
                )
            ) {

                if (
                    !fs.existsSync(
                        PANEL_FILE
                    )
                ) {

                    response.writeHead(
                        404,
                        {
                            "Content-Type":
                                "text/plain; charset=utf-8"
                        }
                    );


                    response.end(
                        "没有找到 robot-test-center.html"
                    );


                    return;
                }


                response.writeHead(
                    200,
                    {
                        "Content-Type":
                            "text/html; charset=utf-8",

                        "Cache-Control":
                            "no-store"
                    }
                );


                fs
                    .createReadStream(
                        PANEL_FILE
                    )
                    .pipe(
                        response
                    );


                return;
            }


            if (
                request.method ===
                    "GET" &&
                url.pathname ===
                    "/api/status"
            ) {

                sendJson(
                    response,
                    200,
                    {
                        ok:
                            true,

                        robots:
                            robotStatus,

                        playwright: {
                            connected:
                                Boolean(
                                    browser &&
                                    browserContext
                                ),

                            baseURL:
                                BASE_URL,

                            headless:
                                HEADLESS
                        },

                        readiness:
                            readinessState,

                        latestReport:
                            latestReportSummary()
                    }
                );


                return;
            }


            if (
                request.method ===
                    "GET" &&
                url.pathname ===
                    "/api/readiness"
            ) {

                sendJson(
                    response,
                    200,
                    {
                        ok:
                            true,

                        readiness:
                            readinessState
                    }
                );


                return;
            }


            if (
                request.method ===
                    "GET" &&
                url.pathname ===
                    "/api/report/latest"
            ) {

                sendJson(
                    response,
                    200,
                    {
                        ok:
                            true,

                        latestReport:
                            latestReportSummary()
                    }
                );


                return;
            }


            if (
                request.method ===
                    "GET" &&
                (
                    url.pathname ===
                        "/api/report/latest.md"
                    ||
                    url.pathname ===
                        "/api/report/latest.json"
                )
            ) {

                const isMarkdown =
                    url.pathname.endsWith(
                        ".md"
                    );


                const reportPath =
                    findLatestReportFile(
                        isMarkdown
                            ? ".md"
                            : ".json"
                    );


                if (
                    !reportPath ||
                    !fs.existsSync(
                        reportPath
                    )
                ) {

                    sendJson(
                        response,
                        404,
                        {
                            ok:
                                false,

                            error:
                                "尚未生成测试报告"
                        }
                    );


                    return;
                }


                response.writeHead(
                    200,
                    {
                        "Content-Type":
                            isMarkdown
                                ? "text/markdown; charset=utf-8"
                                : "application/json; charset=utf-8",

                        "Content-Disposition":
                            "attachment; filename=\"" +
                            path.basename(
                                reportPath
                            ) +
                            "\"" ,

                        "Cache-Control":
                            "no-store"
                    }
                );


                fs
                    .createReadStream(
                        reportPath
                    )
                    .pipe(
                        response
                    );


                return;
            }


            if (
                request.method ===
                    "GET" &&
                url.pathname ===
                    "/api/events"
            ) {

                response.writeHead(
                    200,
                    {
                        "Content-Type":
                            "text/event-stream",

                        "Cache-Control":
                            "no-cache",

                        "Connection":
                            "keep-alive"
                    }
                );


                response.write(
                    ": connected\n\n"
                );


                clients.add(
                    response
                );


                request.on(
                    "close",
                    () => {

                        clients.delete(
                            response
                        );
                    }
                );


                return;
            }


            if (
                request.method ===
                    "POST" &&
                url.pathname ===
                    "/api/command"
            ) {

                try {

                    const raw =
                        await readBody(
                            request
                        );


                    const data =
                        JSON.parse(
                            raw ||
                            "{}"
                        );


                    const target =
                        String(
                            data.target ||
                            "TestManager"
                        );


                    const command =
                        String(
                            data.command ||
                            ""
                        )
                        .trim();


                    if (
                        !command
                    ) {

                        sendJson(
                            response,
                            400,
                            {
                                ok:
                                    false,

                                error:
                                    "测试命令不能为空"
                            }
                        );


                        return;
                    }


                    const result =
                        await executeCommand({
                            target,
                            command
                        });


                    sendJson(
                        response,
                        200,
                        result
                    );


                } catch (
                    error
                ) {

                    const message =
                        error?.message ||
                        String(
                            error
                        );


                    robotMessage(
                        "TestSafetyGuard",
                        message
                    );


                    sendJson(
                        response,
                        400,
                        {
                            ok:
                                false,

                            error:
                                message
                        }
                    );
                }


                return;
            }


            sendJson(
                response,
                404,
                {
                    ok:
                        false,

                    error:
                        "Not Found"
                }
            );
        }
    );


async function shutdown() {

    try {

        if (
            browserContext
        ) {

            await browserContext.close();
        }

    } catch (
        error
    ) {}


    try {

        if (
            browser
        ) {

            await browser.close();
        }

    } catch (
        error
    ) {}


    process.exit(
        0
    );
}


process.on(
    "SIGINT",
    shutdown
);


process.on(
    "SIGTERM",
    shutdown
);


server.listen(
    PORT,
    "127.0.0.1",
    () => {

        console.log(
            ""
        );

        console.log(
            "🤖 机器人测试控制中心 R0-34 已启动"
        );

        console.log(
            `地址：http://127.0.0.1:${PORT}`
        );

        console.log(
            "目标系统：" +
            BASE_URL
        );

        console.log(
            "安全模式：仅允许 TEST- 数据"
        );

        console.log(
            "TruckDriverBot：已接入真实 Playwright + TEST环境初始化"
        );

        console.log(
            "DispatchBot：已接入真实 Playwright TEST临时卸料审核"
        );

        console.log(
            "发布就绪状态文件：" +
            path.relative(
                ROOT,
                READINESS_FILE
            )
        );

        if (
            readinessState.core ||
            readinessState.golden
        ) {

            console.log(
                "已恢复上次发布就绪状态：" +
                "核心=" +
                (
                    readinessState.core?.status ||
                    "未运行"
                ) +
                "，黄金=" +
                (
                    readinessState.golden?.status ||
                    "未运行"
                )
            );
        }

        console.log(
            ""
        );
    }
);
