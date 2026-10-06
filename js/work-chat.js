/*
====================================================
mine-management 全端工作聊天 V1.0
----------------------------------------------------
当前阶段：
1. 所有正式端口加载同一个聊天组件；
2. 自动识别已审核人员身份；
3. 同一浏览器 / 同一 GitHub Pages 来源可跨页面、跨标签实时同步；
4. 消息结构预留未来 Supabase Realtime；
5. 当前未切正式数据库，因此不同设备之间暂不能真正互通。
====================================================
*/

(function () {
    "use strict";

    const STORAGE_KEY =
        "mineWorkChatMessagesV1";

    const ROOM_ID =
        "all-workers";

    const CHANNEL_NAME =
        "mine-work-chat-v1";

    const MAX_MESSAGES =
        200;

    const MAX_TEXT_LENGTH =
        500;

    let identity =
        null;

    let unread =
        0;

    let panelOpen =
        false;

    let channel =
        null;


    function safeParse(
        value,
        fallback
    ) {
        try {
            const parsed =
                JSON.parse(
                    value
                );

            return parsed ?? fallback;

        } catch (
            error
        ) {
            return fallback;
        }
    }


    function readArray(
        key
    ) {
        const value =
            safeParse(
                localStorage.getItem(
                    key
                ),
                []
            );

        return Array.isArray(
            value
        )
            ? value
            : [];
    }


    function getPersonId(
        person
    ) {
        return String(
            person?.personId ||
            person?.driverId ||
            person?.employeeId ||
            person?.id ||
            ""
        ).trim();
    }


    function isApproved(
        person
    ) {
        if (
            !person
        ) {
            return false;
        }

        const state =
            String(
                person.approvalStatus ||
                person.status ||
                ""
            )
            .toLowerCase();

        if (
            [
                "rejected",
                "pending",
                "disabled",
                "离职",
                "停用"
            ].includes(
                state
            )
        ) {
            return false;
        }

        if (
            person.enabled ===
                false
        ) {
            return false;
        }

        return (
            state ===
                "approved" ||
            state ===
                "active" ||
            state ===
                "working" ||
            state ===
                "作业中" ||
            state ===
                "已通过" ||
            state ===
                "审核通过"
        );
    }


    function getProfiles() {
        const keys = [
            "driverProfile",
            "currentPersonnelProfile",
            "currentPerson",
            "userProfile"
        ];

        const result =
            [];

        keys.forEach(
            key => {
                const value =
                    safeParse(
                        localStorage.getItem(
                            key
                        ),
                        null
                    );

                if (
                    value &&
                    typeof value ===
                        "object"
                ) {
                    result.push(
                        value
                    );
                }
            }
        );

        return result;
    }


    function resolveIdentity() {
        const personnel =
            readArray(
                "personnelRecords"
            );

        const currentPersonId =
            String(
                localStorage.getItem(
                    "currentPersonId"
                ) ||
                ""
            ).trim();

        if (
            currentPersonId
        ) {
            const matched =
                personnel.find(
                    person =>
                        getPersonId(
                            person
                        ) ===
                        currentPersonId &&
                        isApproved(
                            person
                        )
                );

            if (
                matched
            ) {
                return matched;
            }
        }

        const profiles =
            getProfiles();

        for (
            const profile
            of profiles
        ) {
            const id =
                getPersonId(
                    profile
                );

            const matched =
                personnel.find(
                    person =>
                        id &&
                        getPersonId(
                            person
                        ) ===
                            id &&
                        isApproved(
                            person
                        )
                );

            if (
                matched
            ) {
                return matched;
            }

            if (
                isApproved(
                    profile
                )
            ) {
                return profile;
            }
        }

        return null;
    }


    function createId() {
        return (
            "CHAT-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    }


    function getMessages() {
        return readArray(
            STORAGE_KEY
        )
            .filter(
                item =>
                    item &&
                    item.roomId ===
                        ROOM_ID
            )
            .slice(
                -MAX_MESSAGES
            );
    }


    function saveMessages(
        messages
    ) {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(
                messages.slice(
                    -MAX_MESSAGES
                )
            )
        );
    }


    function formatTime(
        value
    ) {
        const date =
            new Date(
                value
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleString(
            "zh-CN",
            {
                month:
                    "2-digit",
                day:
                    "2-digit",
                hour:
                    "2-digit",
                minute:
                    "2-digit"
            }
        );
    }


    function renderMessages() {
        const box =
            document.getElementById(
                "mineChatMessages"
            );

        if (
            !box
        ) {
            return;
        }

        const messages =
            getMessages();

        box.innerHTML =
            "";

        if (
            !messages.length
        ) {
            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "mine-chat-empty";

            empty.textContent =
                "暂无工作消息";

            box.appendChild(
                empty
            );

            return;
        }

        messages.forEach(
            message => {
                const row =
                    document.createElement(
                        "div"
                    );

                row.className =
                    "mine-chat-message" +
                    (
                        message.senderPersonId ===
                            getPersonId(
                                identity
                            )
                            ? " self"
                            : ""
                    );

                const meta =
                    document.createElement(
                        "div"
                    );

                meta.className =
                    "mine-chat-meta";

                meta.textContent =
                    [
                        message.senderName ||
                            "未知人员",
                        message.senderPosition ||
                            "",
                        formatTime(
                            message.createdAt
                        )
                    ]
                        .filter(
                            Boolean
                        )
                        .join(
                            " · "
                        );

                const bubble =
                    document.createElement(
                        "div"
                    );

                bubble.className =
                    "mine-chat-bubble";

                bubble.textContent =
                    String(
                        message.text ||
                        ""
                    );

                row.appendChild(
                    meta
                );

                row.appendChild(
                    bubble
                );

                box.appendChild(
                    row
                );
            }
        );

        box.scrollTop =
            box.scrollHeight;
    }


    function updateUnread() {
        const badge =
            document.getElementById(
                "mineChatUnread"
            );

        if (
            !badge
        ) {
            return;
        }

        badge.textContent =
            unread > 99
                ? "99+"
                : String(
                    unread
                );

        badge.style.display =
            unread > 0
                ? "block"
                : "none";
    }


    function receiveMessage(
        message
    ) {
        if (
            !message ||
            message.roomId !==
                ROOM_ID
        ) {
            return;
        }

        renderMessages();

        if (
            !panelOpen &&
            message.senderPersonId !==
                getPersonId(
                    identity
                )
        ) {
            unread +=
                1;

            updateUnread();
        }
    }


    function sendMessage() {
        const input =
            document.getElementById(
                "mineChatInput"
            );

        if (
            !input ||
            !identity
        ) {
            return;
        }

        const text =
            String(
                input.value ||
                ""
            )
                .trim()
                .slice(
                    0,
                    MAX_TEXT_LENGTH
                );

        if (
            !text
        ) {
            return;
        }

        const message = {
            messageId:
                createId(),

            roomId:
                ROOM_ID,

            roomName:
                "全员工作群",

            senderPersonId:
                getPersonId(
                    identity
                ),

            senderEmployeeNo:
                String(
                    identity.employeeNo ||
                    ""
                ),

            senderName:
                String(
                    identity.name ||
                    "未知人员"
                ),

            senderPosition:
                String(
                    identity.position ||
                    ""
                ),

            text,

            createdAt:
                new Date()
                    .toISOString(),

            source:
                "work-chat-local-v1"
        };

        const messages =
            getMessages();

        messages.push(
            message
        );

        saveMessages(
            messages
        );

        input.value =
            "";

        renderMessages();

        if (
            channel
        ) {
            try {
                channel.postMessage(
                    message
                );
            } catch (
                error
            ) {}
        }
    }


    function togglePanel(
        forceOpen
    ) {
        const panel =
            document.getElementById(
                "mineChatPanel"
            );

        if (
            !panel
        ) {
            return;
        }

        panelOpen =
            typeof forceOpen ===
                "boolean"
                ? forceOpen
                : panel.classList.contains(
                    "hidden"
                );

        panel.classList.toggle(
            "hidden",
            !panelOpen
        );

        if (
            panelOpen
        ) {
            unread =
                0;

            updateUnread();

            renderMessages();

            setTimeout(
                () =>
                    document.getElementById(
                        "mineChatInput"
                    )
                    ?.focus(),
                60
            );
        }
    }


    function mount() {
        identity =
            resolveIdentity();

        /*
         * 未识别到已审核人员时不显示聊天入口，
         * 避免注册 / 待审核人员冒用正式工作身份发消息。
         */
        if (
            !identity
        ) {
            return;
        }

        if (
            document.getElementById(
                "mineWorkChatRoot"
            )
        ) {
            return;
        }

        const root =
            document.createElement(
                "div"
            );

        root.id =
            "mineWorkChatRoot";

        root.innerHTML = `
            <button
                type="button"
                class="mine-chat-launcher"
                id="mineChatLauncher"
                aria-label="打开工作聊天"
            >
                💬 工作聊天
                <span
                    class="mine-chat-unread"
                    id="mineChatUnread"
                >0</span>
            </button>

            <section
                class="mine-chat-panel hidden"
                id="mineChatPanel"
                aria-label="全员工作聊天"
            >
                <div class="mine-chat-head">
                    <div class="mine-chat-head-top">
                        <h3 class="mine-chat-title">💬 工作聊天</h3>
                        <button
                            type="button"
                            class="mine-chat-close"
                            id="mineChatClose"
                            aria-label="关闭聊天"
                        >×</button>
                    </div>
                    <div class="mine-chat-subtitle">
                        ${String(identity.name || "未知人员")}
                        · ${String(identity.position || "-")}
                        ${identity.employeeNo ? " · " + String(identity.employeeNo) : ""}
                    </div>
                </div>

                <div class="mine-chat-room">
                    <strong>全员工作群</strong>
                    <span class="mine-chat-mode">LOCAL 联调</span>
                </div>

                <div
                    class="mine-chat-messages"
                    id="mineChatMessages"
                ></div>

                <div class="mine-chat-input-wrap">
                    <textarea
                        class="mine-chat-input"
                        id="mineChatInput"
                        maxlength="${MAX_TEXT_LENGTH}"
                        placeholder="输入工作消息……"
                    ></textarea>

                    <div class="mine-chat-actions">
                        <span class="mine-chat-hint">
                            Enter 发送 · Shift+Enter 换行
                        </span>

                        <button
                            type="button"
                            class="mine-chat-send"
                            id="mineChatSend"
                        >
                            发送
                        </button>
                    </div>
                </div>
            </section>
        `;

        document.body.appendChild(
            root
        );

        document.getElementById(
            "mineChatLauncher"
        )
            ?.addEventListener(
                "click",
                () =>
                    togglePanel()
            );

        document.getElementById(
            "mineChatClose"
        )
            ?.addEventListener(
                "click",
                () =>
                    togglePanel(
                        false
                    )
            );

        document.getElementById(
            "mineChatSend"
        )
            ?.addEventListener(
                "click",
                sendMessage
            );

        document.getElementById(
            "mineChatInput"
        )
            ?.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key ===
                            "Enter" &&
                        !event.shiftKey
                    ) {
                        event.preventDefault();

                        sendMessage();
                    }
                }
            );

        renderMessages();
        updateUnread();

        if (
            "BroadcastChannel" in window
        ) {
            try {
                channel =
                    new BroadcastChannel(
                        CHANNEL_NAME
                    );

                channel.addEventListener(
                    "message",
                    event =>
                        receiveMessage(
                            event.data
                        )
                );
            } catch (
                error
            ) {
                channel =
                    null;
            }
        }

        window.addEventListener(
            "storage",
            event => {
                if (
                    event.key ===
                        STORAGE_KEY
                ) {
                    renderMessages();
                }
            }
        );
    }


    if (
        document.readyState ===
            "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            mount
        );
    } else {
        mount();
    }

})();
