/*
=================================================
矿山管理系统
总经理审批端 V2.9.3
=================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const STORAGE_KEY =
            "leaveRequests";

        const $ =
            id =>
                document.getElementById(id);


        initialize();


        function initialize() {

            renderAll();

            setInterval(
                renderAll,
                5000
            );
        }


        function renderAll() {

            renderSummary();

            renderPending();

            renderHistory();
        }


        /*
        =============================================
        数据
        =============================================
        */

        function getRecords() {

            try {

                const raw =
                    localStorage.getItem(
                        STORAGE_KEY
                    );

                const data =
                    raw
                        ? JSON.parse(raw)
                        : [];

                return Array.isArray(data)
                    ? data
                    : [];

            } catch (error) {

                console.error(error);

                return [];
            }
        }


        function saveRecords(
            records
        ) {

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(records)
            );
        }


        function isGeneralManagerRequest(
            item
        ) {

            return (
                item.approverRole ===
                "general_manager" ||
                item.approvalRoute ===
                "general_manager"
            );
        }


        /*
        =============================================
        汇总
        =============================================
        */

        function renderSummary() {

            const records =
                getRecords()
                    .filter(
                        isGeneralManagerRequest
                    );


            const pending =
                records.filter(
                    item =>
                        item.status === "pending"
                ).length;


            const approved =
                records.filter(
                    item =>
                        item.status === "approved"
                ).length;


            const rejected =
                records.filter(
                    item =>
                        item.status === "rejected"
                ).length;


            setText(
                "pendingCount",
                `${pending}条待审批`
            );

            setText(
                "summaryPending",
                pending
            );

            setText(
                "summaryApproved",
                approved
            );

            setText(
                "summaryRejected",
                rejected
            );
        }


        /*
        =============================================
        待审批
        =============================================
        */

        function renderPending() {

            const records =
                getRecords()
                    .filter(
                        item =>
                            isGeneralManagerRequest(
                                item
                            ) &&
                            item.status ===
                            "pending"
                    )
                    .sort(
                        (a, b) =>
                            new Date(
                                b.submittedAt || 0
                            ) -
                            new Date(
                                a.submittedAt || 0
                            )
                    );


            const box =
                $("pendingList");


            if (!records.length) {

                box.innerHTML =
                    '<div class="empty-box">当前没有待审批申请</div>';

                return;
            }


            box.innerHTML =
                records.map(
                    item => `
                        <div class="leave-card">

                            <div class="leave-top">

                                <div>
                                    <strong>
                                        ${escapeHtml(
                                            item.applicantName ||
                                            item.personName ||
                                            "-"
                                        )}
                                    </strong>

                                    <span>
                                        ${escapeHtml(
                                            item.position ||
                                            "-"
                                        )}
                                    </span>
                                </div>

                                <span class="status pending">
                                    待审批
                                </span>

                            </div>


                            <div class="leave-info">

                                <div>
                                    <span>类型</span>
                                    <strong>
                                        ${escapeHtml(
                                            item.leaveType ||
                                            "-"
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>开始</span>
                                    <strong>
                                        ${formatDateTime(
                                            item.startTime ||
                                            item.startAt
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>结束</span>
                                    <strong>
                                        ${formatDateTime(
                                            item.endTime ||
                                            item.endAt
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>申请时间</span>
                                    <strong>
                                        ${formatDateTime(
                                            item.submittedAt ||
                                            item.appliedAt
                                        )}
                                    </strong>
                                </div>

                            </div>


                            <div class="reason-box">

                                <strong>
                                    请假原因：
                                </strong>

                                ${escapeHtml(
                                    item.reason ||
                                    "-"
                                )}

                            </div>


                            <label>
                                总经理审批备注
                            </label>

                            <textarea
                                data-review-note="${escapeHtml(item.leaveId)}"
                                placeholder="批准可不填，驳回建议填写原因"
                            ></textarea>


                            <div class="action-row">

                                <button
                                    type="button"
                                    class="approve-button"
                                    data-approve="${escapeHtml(item.leaveId)}"
                                >
                                    ✅ 批准
                                </button>

                                <button
                                    type="button"
                                    class="reject-button"
                                    data-reject="${escapeHtml(item.leaveId)}"
                                >
                                    ❌ 驳回
                                </button>

                            </div>

                        </div>
                    `
                ).join("");


            box.querySelectorAll(
                "[data-approve]"
            ).forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            processRequest(
                                button.dataset.approve,
                                true
                            );
                        }
                    );
                }
            );


            box.querySelectorAll(
                "[data-reject]"
            ).forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            processRequest(
                                button.dataset.reject,
                                false
                            );
                        }
                    );
                }
            );
        }


        /*
        =============================================
        审批
        =============================================
        */

        function processRequest(
            leaveId,
            approved
        ) {

            const noteElement =
                document.querySelector(
                    `[data-review-note="${CSS.escape(leaveId)}"]`
                );


            const note =
                noteElement
                    ?.value
                    .trim() ||
                "";


            if (
                !approved &&
                !note
            ) {

                alert(
                    "驳回申请时请输入原因。"
                );

                return;
            }


            const actionText =
                approved
                    ? "批准"
                    : "驳回";


            if (
                !confirm(
                    `确认${actionText}这条请假申请吗？`
                )
            ) {
                return;
            }


            const records =
                getRecords();


            const item =
                records.find(
                    record =>
                        record.leaveId ===
                        leaveId
                );


            if (!item) {

                alert(
                    "未找到该请假申请。"
                );

                return;
            }


            if (
                !isGeneralManagerRequest(
                    item
                )
            ) {

                alert(
                    "该申请不属于总经理审批范围。"
                );

                return;
            }


            if (
                item.status !== "pending"
            ) {

                alert(
                    "该申请已经处理。"
                );

                renderAll();

                return;
            }


            item.status =
                approved
                    ? "approved"
                    : "rejected";


            item.reviewedBy =
                "总经理";


            item.approvedBy =
                "总经理";


            item.reviewedAt =
                new Date()
                    .toISOString();


            item.approvedAt =
                item.reviewedAt;


            item.reviewRemark =
                note;


            item.approvalRemark =
                note;


            saveRecords(
                records
            );


            renderAll();


            alert(
                `请假申请已${actionText}。`
            );
        }


        /*
        =============================================
        历史
        =============================================
        */

        function renderHistory() {

            const records =
                getRecords()
                    .filter(
                        item =>
                            isGeneralManagerRequest(
                                item
                            ) &&
                            (
                                item.status ===
                                "approved" ||
                                item.status ===
                                "rejected"
                            )
                    )
                    .sort(
                        (a, b) =>
                            new Date(
                                b.reviewedAt ||
                                b.approvedAt ||
                                0
                            ) -
                            new Date(
                                a.reviewedAt ||
                                a.approvedAt ||
                                0
                            )
                    );


            const box =
                $("historyList");


            if (!records.length) {

                box.innerHTML =
                    '<div class="empty-box">暂无审批历史</div>';

                return;
            }


            box.innerHTML =
                records.map(
                    item => {

                        const approved =
                            item.status ===
                            "approved";


                        return `
                            <div class="leave-card history">

                                <div class="leave-top">

                                    <div>
                                        <strong>
                                            ${escapeHtml(
                                                item.applicantName ||
                                                item.personName ||
                                                "-"
                                            )}
                                        </strong>

                                        <span>
                                            ${escapeHtml(
                                                item.position ||
                                                "-"
                                            )}
                                        </span>
                                    </div>


                                    <span class="status ${
                                        approved
                                            ? "approved"
                                            : "rejected"
                                    }">
                                        ${
                                            approved
                                                ? "已批准"
                                                : "已驳回"
                                        }
                                    </span>

                                </div>


                                <div class="leave-info">

                                    <div>
                                        <span>请假类型</span>
                                        <strong>
                                            ${escapeHtml(
                                                item.leaveType ||
                                                "-"
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>开始</span>
                                        <strong>
                                            ${formatDateTime(
                                                item.startTime ||
                                                item.startAt
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>结束</span>
                                        <strong>
                                            ${formatDateTime(
                                                item.endTime ||
                                                item.endAt
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>审批时间</span>
                                        <strong>
                                            ${formatDateTime(
                                                item.reviewedAt ||
                                                item.approvedAt
                                            )}
                                        </strong>
                                    </div>

                                </div>


                                ${
                                    item.reviewRemark ||
                                    item.approvalRemark
                                        ? `
                                            <div class="reason-box">
                                                <strong>
                                                    审批备注：
                                                </strong>

                                                ${escapeHtml(
                                                    item.reviewRemark ||
                                                    item.approvalRemark
                                                )}
                                            </div>
                                        `
                                        : ""
                                }

                            </div>
                        `;
                    }
                ).join("");
        }


        /*
        =============================================
        工具
        =============================================
        */

        function setText(
            id,
            value
        ) {

            const element =
                $(id);

            if (element) {

                element.textContent =
                    value;
            }
        }


        function formatDateTime(
            value
        ) {

            if (!value) {
                return "-";
            }


            const date =
                new Date(value);


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                return "-";
            }


            return date.toLocaleString(
                "zh-CN",
                {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );
        }


        function escapeHtml(
            value
        ) {

            const div =
                document.createElement(
                    "div"
                );

            div.textContent =
                String(
                    value ?? ""
                );

            return div.innerHTML;
        }

    }
);
