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


/*
=========================================================
R0-2 RobotControlServer
机器人测试控制中心后台桥接器

作用：
1. 为 robot-test-center.html 提供本地控制后台
2. 接收用户命令
3. 向前端实时推送机器人状态
4. 后续接入 TestManager / Playwright 机器人
5. 不允许直接操作正式数据
=========================================================
*/


const PORT =
    Number(
        process.env.ROBOT_PORT ||
        4310
    );


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


const clients =
    new Set();


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
            "待命"
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
     * 如果命令里明确出现业务ID，
     * 非 TEST- 数据直接拒绝。
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


    robotStatus[bot] = {
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
暂时的命令路由
后续这里接 TestManager
=========================================================
*/


async function executeCommand({
    target,
    command
}) {

    assertSafeCommand(
        command
    );


    const bot =
        robotStatus[target]
            ? target
            : "TestManager";


    updateBot(
        bot,
        "running",
        "正在解析命令"
    );


    robotMessage(
        bot,
        `收到命令：${command}`
    );


    /*
     * R0-2 暂时只验证前后端连接。

     * 下一步 R0-3：
     * 这里会真正调用：
     *
     * TestManager
     * TruckDriverBot
     * DispatchBot
     */


    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                500
            )
    );


    updateBot(
        bot,
        "waiting",
        "控制通道已打通，等待接入 Playwright 执行器"
    );


    robotMessage(
        bot,
        "控制中心已经收到命令。目前停在 Playwright 执行器接入点。"
    );


    return {
        ok:
            true,

        target:
            bot,

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


            /*
             * 控制面板
             */

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


            /*
             * 当前机器人状态
             */

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
                            robotStatus
                    }
                );


                return;
            }


            /*
             * SSE 实时消息
             */

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


            /*
             * 下发机器人命令
             */

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


server.listen(
    PORT,
    "127.0.0.1",
    () => {

        console.log(
            ""
        );

        console.log(
            "🤖 机器人测试控制中心已启动"
        );

        console.log(
            `地址：http://127.0.0.1:${PORT}`
        );

        console.log(
            "安全模式：仅允许 TEST- 数据"
        );

        console.log(
            ""
        );
    }
);
