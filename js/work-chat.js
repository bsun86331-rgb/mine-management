/*
====================================================
mine-management 全端工作聊天 V1.3.1
----------------------------------------------------
当前阶段：
1. 所有正式端口加载同一个聊天组件；
2. 自动识别已审核人员身份；
3. 同一浏览器 / 同一 GitHub Pages 来源可跨页面、跨标签实时同步；
4. 消息结构预留未来 Supabase Realtime；
5. 支持文字、照片、文字+照片消息；
6. 照片发送前自动压缩，避免 LOCAL 阶段存储过大；
7. 当前未切正式数据库，因此不同设备之间暂不能真正互通。
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

    const MAX_IMAGE_SIDE =
        900;

    const IMAGE_QUALITY =
        0.62;

    let pendingImageData =
        "";

    let pendingImageName =
        "";

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


    function compressChatImage(
        file
    ) {
        return new Promise(
            (
                resolve,
                reject
            ) => {
                if (
                    !file ||
                    !file.type?.startsWith(
                        "image/"
                    )
                ) {
                    reject(
                        new Error(
                            "请选择图片文件。"
                        )
                    );

                    return;
                }

                const reader =
                    new FileReader();

                reader.onload =
                    event => {
                        const image =
                            new Image();

                        image.onload =
                            () => {
                                let width =
                                    image.width;

                                let height =
                                    image.height;

                                if (
                                    width >
                                        MAX_IMAGE_SIDE ||
                                    height >
                                        MAX_IMAGE_SIDE
                                ) {
                                    const ratio =
                                        Math.min(
                                            MAX_IMAGE_SIDE /
                                                width,
                                            MAX_IMAGE_SIDE /
                                                height
                                        );

                                    width =
                                        Math.max(
                                            1,
                                            Math.round(
                                                width *
                                                    ratio
                                            )
                                        );

                                    height =
                                        Math.max(
                                            1,
                                            Math.round(
                                                height *
                                                    ratio
                                            )
                                        );
                                }

                                const canvas =
                                    document.createElement(
                                        "canvas"
                                    );

                                canvas.width =
                                    width;

                                canvas.height =
                                    height;

                                const context =
                                    canvas.getContext(
                                        "2d"
                                    );

                                context.drawImage(
                                    image,
                                    0,
                                    0,
                                    width,
                                    height
                                );

                                resolve(
                                    canvas.toDataURL(
                                        "image/jpeg",
                                        IMAGE_QUALITY
                                    )
                                );
                            };

                        image.onerror =
                            () =>
                                reject(
                                    new Error(
                                        "图片读取失败。"
                                    )
                                );

                        image.src =
                            event.target.result;
                    };

                reader.onerror =
                    () =>
                        reject(
                            new Error(
                                "图片文件读取失败。"
                            )
                        );

                reader.readAsDataURL(
                    file
                );
            }
        );
    }


    function renderPendingImage() {
        const wrap =
            document.getElementById(
                "mineChatImagePreviewWrap"
            );

        const image =
            document.getElementById(
                "mineChatImagePreview"
            );

        const name =
            document.getElementById(
                "mineChatImageName"
            );

        if (
            !wrap ||
            !image ||
            !name
        ) {
            return;
        }

        if (
            pendingImageData
        ) {
            image.src =
                pendingImageData;

            name.textContent =
                pendingImageName ||
                "现场照片";

            wrap.classList.remove(
                "hidden"
            );

        } else {
            image.removeAttribute(
                "src"
            );

            name.textContent =
                "";

            wrap.classList.add(
                "hidden"
            );
        }
    }


    function clearPendingImage() {
        pendingImageData =
            "";

        pendingImageName =
            "";

        const input =
            document.getElementById(
                "mineChatPhotoInput"
            );

        if (
            input
        ) {
            input.value =
                "";
        }

        renderPendingImage();
    }


    async function handlePhotoSelection(
        event
    ) {
        const file =
            event.target?.files?.[0];

        if (
            !file
        ) {
            return;
        }

        const sendButton =
            document.getElementById(
                "mineChatSend"
            );

        try {
            if (
                sendButton
            ) {
                sendButton.disabled =
                    true;

                sendButton.textContent =
                    "处理中...";
            }

            pendingImageData =
                await compressChatImage(
                    file
                );

            pendingImageName =
                file.name ||
                "现场照片";

            renderPendingImage();

        } catch (
            error
        ) {
            clearPendingImage();

            alert(
                error?.message ||
                "照片处理失败。"
            );

        } finally {
            if (
                sendButton
            ) {
                sendButton.disabled =
                    false;

                sendButton.textContent =
                    "发送";
            }
        }
    }


    function openChatImage(
        dataUrl
    ) {
        if (
            !dataUrl
        ) {
            return;
        }

        const overlay =
            document.createElement(
                "div"
            );

        overlay.className =
            "mine-chat-image-lightbox";

        const img =
            document.createElement(
                "img"
            );

        img.src =
            dataUrl;

        img.alt =
            "聊天照片大图";

        overlay.appendChild(
            img
        );

        overlay.addEventListener(
            "click",
            () =>
                overlay.remove()
        );

        document.body.appendChild(
            overlay
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

                if (
                    message.text
                ) {
                    const textNode =
                        document.createElement(
                            "div"
                        );

                    textNode.className =
                        "mine-chat-text";

                    textNode.textContent =
                        String(
                            message.text
                        );

                    bubble.appendChild(
                        textNode
                    );
                }

                if (
                    message.imageData
                ) {
                    const photo =
                        document.createElement(
                            "img"
                        );

                    photo.className =
                        "mine-chat-photo";

                    photo.src =
                        message.imageData;

                    photo.alt =
                        message.imageName ||
                        "工作照片";

                    photo.loading =
                        "lazy";

                    photo.addEventListener(
                        "click",
                        () =>
                            openChatImage(
                                message.imageData
                            )
                    );

                    bubble.appendChild(
                        photo
                    );
                }

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

        const launcher =
            document.getElementById(
                "mineChatLauncher"
            );

        if (
            badge
        ) {
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

        if (
            launcher
        ) {
            launcher.classList.toggle(
                "has-unread",
                unread > 0
            );

            launcher.setAttribute(
                "aria-label",
                unread > 0
                    ? "打开工作聊天，" +
                      unread +
                      " 条未读消息"
                    : "打开工作聊天"
            );
        }
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
            !text &&
            !pendingImageData
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

            imageData:
                pendingImageData ||
                "",

            imageName:
                pendingImageName ||
                "",

            messageType:
                pendingImageData
                    ? (
                        text
                            ? "text_image"
                            : "image"
                    )
                    : "text",

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

        try {
            saveMessages(
                messages
            );

        } catch (
            error
        ) {
            alert(
                "聊天本地存储空间不足。请减少连续发送照片，或等待后续接入服务器存储。"
            );

            return;
        }

        input.value =
            "";

        clearPendingImage();

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


    const UNIFIED_APPLICATION_PAGES = [
        "driver-work.html",
        "excavator.html",
        "auxiliary.html",
        "fuel.html",
        "dispatch.html",
        "maintenance.html",
        "maintenance-worker.html",
        "management.html",
        "warehouse.html",
        "general-manager.html"
    ];


    const QUICK_GRID_SELECTORS = {
        "driver-work.html":
            ".todo-grid",

        "excavator.html":
            ".action-grid",

        "auxiliary.html":
            ".quick-grid",

        "fuel.html":
            ".nav-grid",

        "dispatch.html":
            ".todo-grid",

        "maintenance.html":
            ".nav-grid",

        "maintenance-worker.html":
            ".nav-grid",

        "management.html":
            ".quick-grid",

        "general-manager.html":
            ".quick-grid",

        "warehouse.html":
            ".warehouse-tabs, .tab-row, .nav-grid"
    };


    function getCurrentPageName() {
        const path =
            location.pathname
                .split("/")
                .pop();

        return path || "index.html";
    }


    function persistCurrentIdentity() {
        const personId =
            getPersonId(
                identity
            );

        if (
            personId
        ) {
            localStorage.setItem(
                "currentPersonId",
                personId
            );
        }

        if (
            identity?.position
        ) {
            localStorage.setItem(
                "selectedPosition",
                String(
                    identity.position
                )
            );
        }
    }


    function openUnifiedApplication(
        target
    ) {
        persistCurrentIdentity();

        location.href =
            target;
    }


    function hasQuickAction(
        container,
        label
    ) {
        return Array.from(
            container.querySelectorAll(
                "button, a"
            )
        )
        .some(
            element =>
                String(
                    element.textContent ||
                    ""
                )
                .replace(
                    /\s+/g,
                    ""
                )
                .includes(
                    label
                )
        );
    }


    function createQuickActionButton(
        icon,
        title,
        subTitle,
        target,
        kind
    ) {
        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            "mine-common-quick-action " +
            kind;

        button.innerHTML = `
            <span class="mine-common-quick-icon">
                ${icon}
            </span>

            <span class="mine-common-quick-title">
                ${title}
            </span>

            <span class="mine-common-quick-sub">
                ${subTitle}
            </span>
        `;

        button.addEventListener(
            "click",
            () =>
                openUnifiedApplication(
                    target
                )
        );

        return button;
    }


    function mountUnifiedQuickActions() {
        const page =
            getCurrentPageName();

        if (
            !UNIFIED_APPLICATION_PAGES.includes(
                page
            )
        ) {
            return;
        }


        if (
            !document.getElementById(
                "mineCommonQuickActionStyle"
            )
        ) {
            const style =
                document.createElement(
                    "style"
                );

            style.id =
                "mineCommonQuickActionStyle";

            style.textContent = `
                .mine-common-quick-action{
                    min-height:92px;
                    padding:14px 12px;
                    border:1px solid #dbe3ef;
                    border-radius:14px;
                    background:#ffffff;
                    color:#0f172a;
                    display:flex;
                    flex-direction:column;
                    align-items:center;
                    justify-content:center;
                    gap:5px;
                    text-align:center;
                    cursor:pointer;
                    font:inherit;
                }

                .mine-common-quick-action:hover{
                    border-color:#93c5fd;
                    box-shadow:0 8px 20px rgba(37,99,235,.08);
                }

                .mine-common-quick-icon{
                    display:block;
                    font-size:22px;
                    line-height:1;
                }

                .mine-common-quick-title{
                    display:block;
                    font-size:14px;
                    font-weight:800;
                }

                .mine-common-quick-sub{
                    display:block;
                    color:#64748b;
                    font-size:11px;
                    line-height:1.4;
                }
            `;

            document.head.appendChild(
                style
            );
        }


        const selector =
            QUICK_GRID_SELECTORS[
                page
            ];

        let container =
            selector
                ? document.querySelector(
                    selector
                )
                : null;


        if (
            !container
        ) {
            const main =
                document.querySelector(
                    "main"
                );

            if (
                !main
            ) {
                return;
            }

            const section =
                document.createElement(
                    "section"
                );

            section.className =
                "card mine-fallback-quick-section";

            section.innerHTML = `
                <div style="margin-bottom:12px;font-weight:800;">
                    ⚡ 快捷功能
                </div>

                <div
                    class="mine-fallback-quick-grid"
                    style="
                        display:grid;
                        grid-template-columns:repeat(3,minmax(0,1fr));
                        gap:10px;
                    "
                ></div>
            `;

            main.insertBefore(
                section,
                main.firstChild
            );

            container =
                section.querySelector(
                    ".mine-fallback-quick-grid"
                );
        }


        if (
            !hasQuickAction(
                container,
                "物资申请"
            ) &&
            !hasQuickAction(
                container,
                "物资领用"
            )
        ) {
            container.appendChild(
                createQuickActionButton(
                    "📦",
                    "物资申请",
                    "劳保及工作物资",
                    "material-request.html",
                    "material"
                )
            );
        }


        if (
            !hasQuickAction(
                container,
                "请假申请"
            )
        ) {
            container.appendChild(
                createQuickActionButton(
                    "📝",
                    "请假申请",
                    "提交请假记录",
                    "leave-request.html",
                    "leave"
                )
            );
        }


        if (
            !hasQuickAction(
                container,
                "加油申请"
            )
        ) {
            container.appendChild(
                createQuickActionButton(
                    "⛽",
                    "加油申请",
                    "进入统一加油中心",
                    "fuel-request.html",
                    "fuel"
                )
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


        mountUnifiedQuickActions();


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

                    <div
                        class="mine-chat-image-preview hidden"
                        id="mineChatImagePreviewWrap"
                    >
                        <img
                            id="mineChatImagePreview"
                            alt="待发送照片"
                        >
                        <div class="mine-chat-image-preview-info">
                            <strong id="mineChatImageName">现场照片</strong>
                            <button
                                type="button"
                                id="mineChatImageRemove"
                            >
                                取消照片
                            </button>
                        </div>
                    </div>

                    <input
                        id="mineChatPhotoInput"
                        class="mine-chat-photo-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                    >

                    <div class="mine-chat-actions">
                        <button
                            type="button"
                            class="mine-chat-photo-button"
                            id="mineChatPhotoButton"
                        >
                            📷 照片
                        </button>

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
            "mineChatPhotoButton"
        )
            ?.addEventListener(
                "click",
                () =>
                    document.getElementById(
                        "mineChatPhotoInput"
                    )
                    ?.click()
            );

        document.getElementById(
            "mineChatPhotoInput"
        )
            ?.addEventListener(
                "change",
                handlePhotoSelection
            );

        document.getElementById(
            "mineChatImageRemove"
        )
            ?.addEventListener(
                "click",
                clearPendingImage
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
                    event.key !==
                        STORAGE_KEY
                ) {
                    return;
                }

                const incoming =
                    safeParse(
                        event.newValue,
                        []
                    );

                const messages =
                    Array.isArray(
                        incoming
                    )
                        ? incoming
                        : [];

                const lastMessage =
                    messages[
                        messages.length -
                        1
                    ];

                renderMessages();

                if (
                    lastMessage &&
                    !panelOpen &&
                    lastMessage.senderPersonId !==
                        getPersonId(
                            identity
                        )
                ) {
                    unread +=
                        1;

                    updateUnread();
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
