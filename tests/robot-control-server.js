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


/*
=========================================================
R0-22 RobotControlServer
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


async function runFastRegressionTests() {

    const botName =
        "TestManager";


    const results =
        [];


    const runFastCase =
        async (
            name,
            runner
        ) => {

            robotMessage(
                botName,
                "快速回归：" +
                name
            );


            try {

                const result =
                    await runner();


                results.push({
                    name,
                    ok:
                        true,

                    result
                });


                robotMessage(
                    botName,
                    "快速通过：" +
                    name
                );


            } catch (
                error
            ) {

                const message =
                    error?.message ||
                    String(
                        error
                    );


                results.push({
                    name,
                    ok:
                        false,

                    error:
                        message
                });


                robotMessage(
                    botName,
                    "快速失败：" +
                    name +
                    "；" +
                    message
                );
            }
        };


    updateBot(
        botName,
        "running",
        "正在运行快速状态回归"
    );


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
        "快速回归汇总：" +
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


    if (
        failed
    ) {

        updateBot(
            botName,
            "fail",
            "快速回归完成：" +
            passed +
            "/" +
            total +
            " PASS"
        );


        throw new Error(
            "快速回归存在失败用例：" +
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
        "快速回归全部通过：" +
        passed +
        "/" +
        total
    );


    return {
        ok:
            true,

        action:
            "fast-regression-tests",

        passed,
        total,
        results
    };
}


async function runAllCoreRegressionTests() {

    const botName =
        "TestManager";


    const results =
        [];


    const runCase =
        async (
            name,
            runner
        ) => {

            robotMessage(
                botName,
                "开始回归：" +
                name
            );


            try {

                const result =
                    await runner();


                results.push({
                    name,
                    ok:
                        true,

                    result
                });


                robotMessage(
                    botName,
                    "回归通过：" +
                    name
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


                results.push({
                    name,
                    ok:
                        false,

                    error:
                        message
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


    if (
        failed
    ) {

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
                        }
                    }
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
            "🤖 机器人测试控制中心 R0-22 已启动"
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
            ""
        );
    }
);
