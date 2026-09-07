/*
========================================================
矿山管理系统 - 生产调度端
dispatch.js V2.5.0
任务中途设备调整版
========================================================
规则：
1. 生产任务看板只显示 pending / active。
2. completed 保留为历史任务；withdrawn 旧数据自动删除。
3. 撤回 = 删除任务并释放设备。
4. pending / active 任务可中途增加、减少挖机及调整跟随卡车。
5. 设备调整不改变任务编号、不清零运输趟数，并记录调整历史。
========================================================
*/

document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_TASKS = "dispatchPublishedTasks";
    const STORAGE_LATEST = "publishedDispatchTask";
    const STORAGE_TRIPS = "driverTripRecords";

    let currentTask = null;
    let selectedExcavatorId = null;
    let selectedTruckIds = [];
    let bindings = [];
    let auxiliaryAssignments = [];
    let selectedAuxDeviceId = null;
    let selectedPublishedTaskId = null;

    let adjustmentTaskId = null;
    let adjustmentOriginalBindings = [];
    let adjustmentDraftBindings = [];
    let adjustmentSelectedExcavatorId = null;
    let adjustmentSelectedTruckIds = [];
    let adjustmentEditingExcavatorId = null;

    const equipment = [
        { id: "EX-01", type: "excavator", status: "available" },
        { id: "EX-02", type: "excavator", status: "available" },
        { id: "EX-03", type: "excavator", status: "maintenance", maintenance: { fault: "液压系统检查", startedAt: "08:20", expectedEnd: "12:00", responsible: "维修组" } },
        { id: "EX-04", type: "excavator", status: "available" },
        { id: "EX-05", type: "excavator", status: "available" },
        { id: "EX-06", type: "excavator", status: "available" },
        ...createTruckData(),
        { id: "L-01", type: "loader", status: "available" },
        { id: "L-02", type: "loader", status: "available" },
        { id: "L-03", type: "loader", status: "available" },
        { id: "L-04", type: "loader", status: "maintenance", maintenance: { fault: "轮胎维修", startedAt: "07:40", expectedEnd: "11:30", responsible: "维修组" } },
        { id: "W-01", type: "water", status: "available" },
        { id: "W-02", type: "water", status: "maintenance", maintenance: { fault: "水泵故障", startedAt: "06:50", expectedEnd: "13:00", responsible: "维修组" } },
        { id: "W-03", type: "water", status: "available" },
        { id: "F-01", type: "fuel", status: "available" },
        { id: "F-02", type: "fuel", status: "available" },
        { id: "G-01", type: "grader", status: "available" },
        { id: "G-02", type: "grader", status: "maintenance", maintenance: { fault: "刀板维修", startedAt: "09:00", expectedEnd: "15:00", responsible: "维修组" } },
        { id: "D-01", type: "dozer", status: "available" },
        { id: "D-02", type: "dozer", status: "available" },
        { id: "B-01", type: "bus", status: "available" },
        { id: "B-02", type: "bus", status: "available" }
    ];

    const $ = id => document.getElementById(id);

    const el = {
        newTaskButton: $("newTaskButton"),
        cancelCreateButton: $("cancelCreateButton"),
        generateTaskButton: $("generateTaskButton"),
        bindTrucksButton: $("bindTrucksButton"),
        previewTaskButton: $("previewTaskButton"),
        backEditButton: $("backEditButton"),
        publishTaskButton: $("publishTaskButton"),
        closeModalButton: $("closeModalButton"),
        auxWorkType: $("auxWorkType"),
        cancelAuxTaskButton: $("cancelAuxTaskButton"),
        confirmAuxTaskButton: $("confirmAuxTaskButton"),
        closePublishedTaskButton: $("closePublishedTaskButton"),
        completePublishedTaskButton: $("completePublishedTaskButton"),
        withdrawPublishedTaskButton: $("withdrawPublishedTaskButton")
    };

    injectV250Ui();

    const adjustTaskButton = $("adjustTaskButton");
    const closeAdjustTaskButton = $("closeAdjustTaskButton");
    const saveAdjustTaskButton = $("saveAdjustTaskButton");
    const addAdjustmentBindingButton = $("addAdjustmentBindingButton");

    if ($("taskShift")) {
        $("taskShift").value = getDefaultShift();
    }

    hideOldStatusLegends();
    migrateLegacyWithdrawnTasks();
    migrateOldTaskStatuses();
    syncPublishedTaskExecutionStatus();
    rebuildEquipmentStatusFromTasks();
    renderProductionTaskBoard();

    el.newTaskButton?.addEventListener("click", () => {
        $("taskShift").value = getDefaultShift();
        showSection("taskCreateSection");
        scrollToId("taskCreateSection");
    });

    el.cancelCreateButton?.addEventListener("click", () => {
        hideSection("taskCreateSection");
    });

    el.generateTaskButton?.addEventListener("click", () => {
        const shift = getValue("taskShift");
        const area = getValue("taskArea");
        const remark = getValue("taskRemark");

        if (!area) {
            alert("请输入作业区域");
            return;
        }

        currentTask = {
            taskId: "TASK_" + Date.now(),
            date: new Date().toLocaleDateString("zh-CN"),
            shift,
            area,
            remark,
            status: "configuring",
            createdAt: new Date().toISOString()
        };

        selectedExcavatorId = null;
        selectedTruckIds = [];
        bindings = [];
        auxiliaryAssignments = [];

        setText("summaryDate", currentTask.date);
        setText("summaryShift", currentTask.shift);
        setText("summaryArea", currentTask.area);
        setText("summaryRemark", currentTask.remark || "无");
        setText("taskStateBadge", "配置中");

        hideSection("taskCreateSection");
        showTaskBoards();
        renderAll();
        scrollToId("excavatorSection");
    });

    el.bindTrucksButton?.addEventListener("click", () => {
        if (!selectedExcavatorId) {
            alert("请先选择一台挖机");
            return;
        }

        if (!selectedTruckIds.length) {
            alert("请选择至少一台跟随卡车");
            return;
        }

        const excavatorId = selectedExcavatorId;
        const trucks = [...selectedTruckIds];

        bindings.push({
            excavatorId,
            truckIds: trucks
        });

        markDraftBindingAssigned(excavatorId, trucks);

        selectedExcavatorId = null;
        selectedTruckIds = [];

        renderAll();

        alert(`${excavatorId} 已绑定 ${trucks.length} 台卡车`);
    });

    el.auxWorkType?.addEventListener("change", function () {
        if (this.value === "manual") {
            showSection("auxManualWorkBox");
        } else {
            hideSection("auxManualWorkBox");
            setValue("auxManualWork", "");
        }
    });

    el.cancelAuxTaskButton?.addEventListener("click", () => {
        selectedAuxDeviceId = null;
        hideSection("auxTaskModal");
    });

    el.confirmAuxTaskButton?.addEventListener("click", () => {
        if (!selectedAuxDeviceId || !currentTask) return;

        const device = findDevice(selectedAuxDeviceId);
        if (!device) return;

        let work = el.auxWorkType.value;

        if (work === "manual") {
            work = getValue("auxManualWork");

            if (!work) {
                alert("请输入具体工作内容");
                return;
            }
        }

        const remark = getValue("auxTaskRemark");

        auxiliaryAssignments.push({
            assignmentId: "AUX_" + Date.now(),
            vehicleId: device.id,
            type: device.type,
            typeName: getTypeName(device.type),
            work,
            remark,
            area: currentTask.area,
            shift: currentTask.shift,
            taskId: currentTask.taskId,
            assignedAt: new Date().toISOString()
        });

        device.status = "assigned";

        device.assignedTask = {
            taskId: currentTask.taskId,
            area: currentTask.area,
            shift: currentTask.shift,
            work,
            remark
        };

        selectedAuxDeviceId = null;

        hideSection("auxTaskModal");
        renderAll();

        alert(device.id + " 任务下发成功");
    });

    el.previewTaskButton?.addEventListener("click", () => {
        if (!currentTask) return;

        renderTaskPreview();
        showSection("previewSection");
        scrollToId("previewSection");
    });

    el.backEditButton?.addEventListener("click", () => {
        hideSection("previewSection");
    });

    el.publishTaskButton?.addEventListener("click", () => {
        if (!currentTask) return;

        if (!confirm("确认发布当前生产任务吗？发布后为“待执行”，未产生运输前可以撤回。")) {
            return;
        }

        currentTask.status = "pending";
        currentTask.publishedAt = new Date().toISOString();

        const publishedTask = {
            ...currentTask,
            bindings: deepClone(bindings),
            auxiliaryAssignments: deepClone(auxiliaryAssignments),
            transportTripCount: 0,
            equipmentAdjustments: []
        };

        savePublishedTask(publishedTask);

        hideCurrentConfigurationSections();

        currentTask = null;
        selectedExcavatorId = null;
        selectedTruckIds = [];
        bindings = [];
        auxiliaryAssignments = [];

        rebuildEquipmentStatusFromTasks();
        renderProductionTaskBoard();

        alert("任务发布成功，当前状态为“待执行”。");

        scrollToId("productionTaskBoardSection");
    });

    el.closeModalButton?.addEventListener("click", () => {
        hideSection("deviceModal");
    });

    el.closePublishedTaskButton?.addEventListener("click", () => {
        selectedPublishedTaskId = null;
        hideSection("publishedTaskModal");
    });

    el.withdrawPublishedTaskButton?.addEventListener("click", () => {
        if (!selectedPublishedTaskId) return;

        const stats = getTaskTripStats(selectedPublishedTaskId);

        if (stats.count > 0) {
            syncPublishedTaskExecutionStatus();
            renderProductionTaskBoard();
            hideSection("publishedTaskModal");

            selectedPublishedTaskId = null;

            alert(`该任务已经产生运输记录，共 ${stats.count} 趟，不能撤回。`);
            return;
        }

        const tasks = getPublishedTasks();

        const task = tasks.find(
            item => item.taskId === selectedPublishedTaskId
        );

        if (!task) return;

        if (
            task.status === "active" &&
            stats.count === 0
        ) {
            task.status = "pending";
        }

        if (task.status !== "pending") {
            alert("该任务当前状态不允许撤回。");
            return;
        }

        if (!confirm("确认撤回该生产任务吗？撤回相当于删除，该任务将不再保留。")) {
            return;
        }

        const removedId = task.taskId;

        saveTaskArray(
            tasks.filter(
                item => item.taskId !== removedId
            )
        );

        clearLegacyLatestTaskIfMatch(removedId);

        hideSection("publishedTaskModal");
        selectedPublishedTaskId = null;

        rebuildEquipmentStatusFromTasks();
        renderProductionTaskBoard();

        alert("任务已撤回并删除，相关设备已恢复为可调配状态。");
    });

    el.completePublishedTaskButton?.addEventListener("click", () => {
        if (!selectedPublishedTaskId) return;

        syncPublishedTaskExecutionStatus();

        const tasks = getPublishedTasks();

        const task = tasks.find(
            item => item.taskId === selectedPublishedTaskId
        );

        if (!task) return;

        const stats = getTaskTripStats(task.taskId);

        if (!stats.count) {
            alert("该任务尚未产生运输记录，不能完成。");
            return;
        }

        if (task.status !== "active") {
            alert("只有执行中的任务才能完成。");
            return;
        }

        if (!confirm("确认完成该生产任务吗？完成后将从生产任务看板移除，并进入历史任务。")) {
            return;
        }

        task.status = "completed";
        task.completedAt = new Date().toISOString();
        task.transportTripCount = stats.count;

        saveTaskArray(tasks);

        hideSection("publishedTaskModal");
        selectedPublishedTaskId = null;

        rebuildEquipmentStatusFromTasks();
        renderProductionTaskBoard();

        alert("任务已完成，已从生产任务看板移除，并保留在历史任务中。");
    });

    adjustTaskButton?.addEventListener("click", () => {
        if (!selectedPublishedTaskId) return;

        hideSection("publishedTaskModal");

        openAdjustmentModal(
            selectedPublishedTaskId
        );
    });

    closeAdjustTaskButton?.addEventListener(
        "click",
        closeAdjustmentModal
    );

    saveAdjustTaskButton?.addEventListener(
        "click",
        saveAdjustmentChanges
    );

    addAdjustmentBindingButton?.addEventListener(
        "click",
        addOrUpdateAdjustmentBinding
    );

    function showTaskBoards() {
        [
            "taskSummarySection",
            "legendSection",
            "excavatorSection",
            "truckSection",
            "bindingSection",
            "loaderSection",
            "waterSection",
            "fuelSection",
            "graderSection",
            "dozerSection",
            "busSection",
            "auxiliarySummarySection",
            "publishSection"
        ].forEach(showSection);
    }

    function hideCurrentConfigurationSections() {
        [
            "taskSummarySection",
            "legendSection",
            "excavatorSection",
            "truckSection",
            "bindingSection",
            "loaderSection",
            "waterSection",
            "fuelSection",
            "graderSection",
            "dozerSection",
            "busSection",
            "auxiliarySummarySection",
            "publishSection",
            "previewSection"
        ].forEach(hideSection);
    }

    function renderAll() {
        renderExcavators();
        renderTrucks();
        renderBindings();
        renderAuxiliaryBoards();
        renderAuxiliaryAssignments();
    }

    function renderProductionTaskBoard() {
        migrateLegacyWithdrawnTasks();
        migrateOldTaskStatuses();
        syncPublishedTaskExecutionStatus();

        const board = $("productionTaskBoard");

        if (!board) return;

        const tasks = getPublishedTasks()
            .filter(
                task =>
                    task.status === "pending" ||
                    task.status === "active"
            )
            .sort(
                (a, b) =>
                    new Date(b.publishedAt || b.createdAt) -
                    new Date(a.publishedAt || a.createdAt)
            );

        setText(
            "productionTaskCount",
            tasks.length + " 个进行中任务"
        );

        if (!tasks.length) {
            board.innerHTML =
                '<div class="empty-placeholder">当前没有进行中的生产任务</div>';

            return;
        }

        board.innerHTML = "";

        tasks.forEach(task => {
            const stats =
                getTaskTripStats(task.taskId);

            const excavatorCount =
                Array.isArray(task.bindings)
                    ? task.bindings.length
                    : 0;

            const truckCount =
                Array.isArray(task.bindings)
                    ? task.bindings.reduce(
                        (total, binding) =>
                            total +
                            (
                                Array.isArray(binding.truckIds)
                                    ? binding.truckIds.length
                                    : 0
                            ),
                        0
                    )
                    : 0;

            const auxiliaryCount =
                Array.isArray(task.auxiliaryAssignments)
                    ? task.auxiliaryAssignments.length
                    : 0;

            const adjustmentCount =
                Array.isArray(task.equipmentAdjustments)
                    ? task.equipmentAdjustments.length
                    : 0;

            const card =
                document.createElement("button");

            card.type = "button";

            card.className =
                "production-task-card " +
                getTaskCardClass(task.status);

            card.innerHTML = `
                <div class="production-task-card-header">

                    <div>
                        <strong class="production-task-area">
                            ${escapeHtml(task.area)}
                        </strong>

                        <span class="production-task-shift">
                            ${escapeHtml(task.shift)}
                        </span>
                    </div>

                    <span class="production-task-status">
                        ${getTaskStatusText(task.status)}
                    </span>

                </div>

                <div class="production-task-date">
                    ${escapeHtml(task.date)}
                </div>

                <div class="production-task-stat-grid">

                    <div>
                        <span>挖机</span>
                        <strong>${excavatorCount}</strong>
                    </div>

                    <div>
                        <span>卡车</span>
                        <strong>${truckCount}</strong>
                    </div>

                    <div>
                        <span>辅助车辆</span>
                        <strong>${auxiliaryCount}</strong>
                    </div>

                    <div class="trip-stat">
                        <span>运输趟数</span>
                        <strong>${stats.count}</strong>
                    </div>

                </div>

                ${
                    adjustmentCount
                        ? `<div class="production-task-time">
                            设备调整：${adjustmentCount} 次
                           </div>`
                        : ""
                }

                <div class="production-task-time">
                    发布时间：
                    ${formatDateTime(task.publishedAt)}
                </div>
            `;

            card.addEventListener(
                "click",
                () => openPublishedTask(task.taskId)
            );

            board.appendChild(card);
        });
    }

    function openPublishedTask(taskId) {
        migrateOldTaskStatuses();
        syncPublishedTaskExecutionStatus();

        const task =
            getPublishedTasks().find(
                item => item.taskId === taskId
            );

        if (
            !task ||
            !["pending", "active"].includes(task.status)
        ) {
            return;
        }

        selectedPublishedTaskId =
            task.taskId;

        const stats =
            getTaskTripStats(task.taskId);

        setText(
            "publishedTaskModalTitle",
            `${task.area} · ${task.shift}`
        );

        let html = `
            <div class="task-detail-status-row">
                <span>当前状态</span>
                <strong>
                    ${getTaskStatusText(task.status)}
                </strong>
            </div>

            <div class="transport-stat-box">

                <div>
                    <span>运输总趟数</span>
                    <strong>${stats.count}</strong>
                </div>

                <div>
                    <span>第一趟</span>
                    <strong>
                        ${
                            stats.firstTime
                                ? formatDateTime(stats.firstTime)
                                : "-"
                        }
                    </strong>
                </div>

                <div>
                    <span>最后一趟</span>
                    <strong>
                        ${
                            stats.lastTime
                                ? formatDateTime(stats.lastTime)
                                : "-"
                        }
                    </strong>
                </div>

            </div>

            <div class="modal-detail-row">
                <span>日期</span>
                <strong>${escapeHtml(task.date)}</strong>
            </div>

            <div class="modal-detail-row">
                <span>作业区域</span>
                <strong>${escapeHtml(task.area)}</strong>
            </div>

            <div class="modal-detail-row">
                <span>班次</span>
                <strong>${escapeHtml(task.shift)}</strong>
            </div>

            <div class="published-detail-block">
                <h4>🚜 挖机及跟随卡车</h4>
        `;

        if (
            !Array.isArray(task.bindings) ||
            !task.bindings.length
        ) {
            html += "<p>未配置主采设备</p>";
        } else {
            task.bindings.forEach(binding => {
                html += `
                    <div class="published-binding">

                        <strong>
                            🚜
                            ${escapeHtml(binding.excavatorId)}
                        </strong>
                `;

                (binding.truckIds || [])
                    .forEach(truckId => {
                        html += `
                            <span>
                                🚚
                                ${escapeHtml(truckId)}
                                ·
                                ${getTruckTaskTripCount(
                                    task.taskId,
                                    truckId
                                )} 趟
                            </span>
                        `;
                    });

                html += "</div>";
            });
        }

        html += `
            </div>

            <div class="published-detail-block">
                <h4>🚧 辅助车辆</h4>
        `;

        if (
            !Array.isArray(task.auxiliaryAssignments) ||
            !task.auxiliaryAssignments.length
        ) {
            html += "<p>未配置辅助车辆</p>";
        } else {
            task.auxiliaryAssignments.forEach(item => {
                html += `
                    <div class="published-aux-row">

                        <strong>
                            ${escapeHtml(item.typeName)}
                            ·
                            ${escapeHtml(item.vehicleId)}
                        </strong>

                        <span>
                            ${escapeHtml(item.work)}
                        </span>

                    </div>
                `;
            });
        }

        html += `
            </div>

            <div class="published-detail-block">
                <h4>调度说明</h4>
                <p>
                    ${escapeHtml(task.remark || "无")}
                </p>
            </div>
        `;

        if (
            Array.isArray(task.equipmentAdjustments) &&
            task.equipmentAdjustments.length
        ) {
            html += `
                <div class="published-detail-block">
                    <h4>🔄 设备调整记录</h4>
            `;

            [...task.equipmentAdjustments]
                .reverse()
                .slice(0, 10)
                .forEach(record => {
                    html += `
                        <div class="v250-history-row">

                            <strong>
                                ${formatDateTime(record.time)}
                            </strong>

                            <span>
                                ${escapeHtml(record.summary)}
                            </span>

                        </div>
                    `;
                });

            html += "</div>";
        }

        $("publishedTaskModalContent").innerHTML =
            html;

        el.withdrawPublishedTaskButton
            .classList
            .add("hidden");

        el.completePublishedTaskButton
            .classList
            .add("hidden");

        adjustTaskButton
            .classList
            .remove("hidden");

        if (
            task.status === "pending" &&
            stats.count === 0
        ) {
            el.withdrawPublishedTaskButton
                .classList
                .remove("hidden");
        }

        if (
            task.status === "active" &&
            stats.count > 0
        ) {
            el.completePublishedTaskButton
                .classList
                .remove("hidden");
        }

        showSection("publishedTaskModal");
    }

    function openAdjustmentModal(taskId) {
        const task =
            getPublishedTasks().find(
                item => item.taskId === taskId
            );

        if (
            !task ||
            !["pending", "active"].includes(task.status)
        ) {
            alert("当前任务状态不能调整设备。");
            return;
        }

        adjustmentTaskId =
            taskId;

        adjustmentOriginalBindings =
            deepClone(task.bindings || []);

        adjustmentDraftBindings =
            deepClone(task.bindings || []);

        adjustmentSelectedExcavatorId =
            null;

        adjustmentSelectedTruckIds =
            [];

        adjustmentEditingExcavatorId =
            null;

        setText(
            "adjustTaskModalTitle",
            `调整设备 · ${task.area} · ${task.shift}`
        );

        renderAdjustmentUi();

        showSection("adjustTaskModal");
    }

    function closeAdjustmentModal() {
        adjustmentTaskId = null;
        adjustmentOriginalBindings = [];
        adjustmentDraftBindings = [];
        adjustmentSelectedExcavatorId = null;
        adjustmentSelectedTruckIds = [];
        adjustmentEditingExcavatorId = null;

        hideSection("adjustTaskModal");
    }

    function renderAdjustmentUi() {
        renderAdjustmentCurrentBindings();
        renderAdjustmentExcavators();
        renderAdjustmentTrucks();

        const hasChange =
            JSON.stringify(
                normalizeBindings(
                    adjustmentOriginalBindings
                )
            ) !==
            JSON.stringify(
                normalizeBindings(
                    adjustmentDraftBindings
                )
            );

        $("saveAdjustTaskButton").disabled =
            !hasChange;

        $("saveAdjustTaskButton").textContent =
            hasChange
                ? "保存本次设备调整"
                : "暂无修改";
    }

    function renderAdjustmentCurrentBindings() {
        const box =
            $("adjustCurrentBindings");

        if (!adjustmentDraftBindings.length) {
            box.innerHTML =
                '<div class="empty-placeholder">当前任务没有挖机绑定</div>';

            return;
        }

        box.innerHTML = "";

        adjustmentDraftBindings.forEach(
            binding => {
                const row =
                    document.createElement("div");

                row.className =
                    "v250-binding-edit-card";

                row.innerHTML = `
                    <div>

                        <strong>
                            🚜
                            ${escapeHtml(binding.excavatorId)}
                        </strong>

                        <div class="v250-mini-list">

                            ${
                                (binding.truckIds || [])
                                    .map(
                                        id =>
                                            `<span>
                                                🚚
                                                ${escapeHtml(id)}
                                             </span>`
                                    )
                                    .join("")
                                ||
                                "<span>暂无卡车</span>"
                            }

                        </div>

                    </div>

                    <div class="v250-row-actions">

                        <button
                            type="button"
                            class="v250-edit-btn"
                        >
                            调整卡车
                        </button>

                        <button
                            type="button"
                            class="v250-remove-btn"
                        >
                            减少挖机
                        </button>

                    </div>
                `;

                row.querySelector(".v250-edit-btn")
                    .addEventListener(
                        "click",
                        () =>
                            startEditBinding(
                                binding.excavatorId
                            )
                    );

                row.querySelector(".v250-remove-btn")
                    .addEventListener(
                        "click",
                        () =>
                            removeAdjustmentBinding(
                                binding.excavatorId
                            )
                    );

                box.appendChild(row);
            }
        );
    }

    function startEditBinding(excavatorId) {
        const binding =
            adjustmentDraftBindings.find(
                item =>
                    item.excavatorId ===
                    excavatorId
            );

        if (!binding) return;

        adjustmentEditingExcavatorId =
            excavatorId;

        adjustmentSelectedExcavatorId =
            excavatorId;

        adjustmentSelectedTruckIds =
            [...(binding.truckIds || [])];

        setText(
            "adjustSelectionInfo",
            `正在调整 ${excavatorId} 的跟随卡车`
        );

        renderAdjustmentExcavators();
        renderAdjustmentTrucks();

        addAdjustmentBindingButton.textContent =
            "保存该挖机卡车调整";

        scrollToId("adjustTruckBoard");
    }

    function removeAdjustmentBinding(excavatorId) {
        if (
            !confirm(
                `确认从本任务减少挖机 ${excavatorId} 吗？其跟随卡车也会从该挖机解除。`
            )
        ) {
            return;
        }

        adjustmentDraftBindings =
            adjustmentDraftBindings.filter(
                item =>
                    item.excavatorId !==
                    excavatorId
            );

        if (
            adjustmentSelectedExcavatorId ===
            excavatorId
        ) {
            adjustmentSelectedExcavatorId = null;
            adjustmentSelectedTruckIds = [];
            adjustmentEditingExcavatorId = null;
        }

        setText(
            "adjustSelectionInfo",
            "请选择新增挖机，再选择跟随卡车"
        );

        addAdjustmentBindingButton.textContent =
            "加入本任务";

        renderAdjustmentUi();
    }

    function renderAdjustmentExcavators() {
        const board =
            $("adjustExcavatorBoard");

        board.innerHTML = "";

        const usedOther =
            getEquipmentUsedByOtherTasks(
                adjustmentTaskId
            );

        equipment
            .filter(
                device =>
                    device.type === "excavator"
            )
            .forEach(device => {
                const inDraft =
                    adjustmentDraftBindings.some(
                        binding =>
                            binding.excavatorId ===
                            device.id
                    );

                const blockedOther =
                    usedOther.has(device.id);

                const maintenance =
                    device.status ===
                    "maintenance";

                const button =
                    document.createElement("button");

                button.type = "button";
                button.className =
                    "v250-adjust-device";

                if (
                    adjustmentSelectedExcavatorId ===
                    device.id
                ) {
                    button.classList.add(
                        "selected"
                    );
                }

                if (
                    maintenance ||
                    blockedOther ||
                    (
                        inDraft &&
                        adjustmentEditingExcavatorId !==
                        device.id
                    )
                ) {
                    button.classList.add(
                        "blocked"
                    );
                }

                let state =
                    "可增加";

                if (maintenance) {
                    state = "维修中";
                } else if (blockedOther) {
                    state = "其他任务占用";
                } else if (
                    inDraft &&
                    adjustmentEditingExcavatorId !==
                    device.id
                ) {
                    state = "已在本任务";
                } else if (
                    adjustmentEditingExcavatorId ===
                    device.id
                ) {
                    state = "正在调整";
                }

                button.innerHTML = `
                    <strong>
                        ${device.id}
                    </strong>

                    <span>
                        ${state}
                    </span>
                `;

                button.addEventListener(
                    "click",
                    () => {
                        if (maintenance) {
                            showMaintenanceModal(device);
                            return;
                        }

                        if (blockedOther) {
                            alert(
                                device.id +
                                " 已被其他生产任务占用。"
                            );
                            return;
                        }

                        if (
                            inDraft &&
                            adjustmentEditingExcavatorId !==
                            device.id
                        ) {
                            alert(
                                device.id +
                                " 已经在当前任务中，可在上方点击“调整卡车”。"
                            );
                            return;
                        }

                        if (
                            adjustmentEditingExcavatorId &&
                            adjustmentEditingExcavatorId !==
                            device.id
                        ) {
                            alert(
                                "请先完成或取消当前挖机的卡车调整。"
                            );
                            return;
                        }

                        adjustmentSelectedExcavatorId =
                            device.id;

                        adjustmentSelectedTruckIds =
                            [];

                        setText(
                            "adjustSelectionInfo",
                            `已选择新增挖机 ${device.id}，请继续选择卡车`
                        );

                        renderAdjustmentExcavators();
                        renderAdjustmentTrucks();

                        addAdjustmentBindingButton.textContent =
                            "加入本任务";
                    }
                );

                board.appendChild(button);
            });
    }

    function renderAdjustmentTrucks() {
        const board =
            $("adjustTruckBoard");

        board.innerHTML = "";

        const usedOther =
            getEquipmentUsedByOtherTasks(
                adjustmentTaskId
            );

        const usedInOtherDraftBindings =
            new Set();

        adjustmentDraftBindings.forEach(
            binding => {
                if (
                    binding.excavatorId !==
                    adjustmentEditingExcavatorId
                ) {
                    (binding.truckIds || [])
                        .forEach(
                            id =>
                                usedInOtherDraftBindings
                                    .add(id)
                        );
                }
            }
        );

        equipment
            .filter(
                device =>
                    device.type === "truck"
            )
            .forEach(device => {
                const selected =
                    adjustmentSelectedTruckIds
                        .includes(device.id);

                const maintenance =
                    device.status ===
                    "maintenance";

                const blockedOther =
                    usedOther.has(device.id);

                const blockedDraft =
                    usedInOtherDraftBindings
                        .has(device.id);

                const button =
                    document.createElement("button");

                button.type = "button";
                button.className =
                    "v250-adjust-device";

                if (selected) {
                    button.classList.add(
                        "selected"
                    );
                }

                if (
                    maintenance ||
                    blockedOther ||
                    blockedDraft ||
                    !adjustmentSelectedExcavatorId
                ) {
                    button.classList.add(
                        "blocked"
                    );
                }

                let state =
                    selected
                        ? "✓ 已选择"
                        : "可选择";

                if (
                    !adjustmentSelectedExcavatorId
                ) {
                    state = "先选挖机";
                } else if (maintenance) {
                    state = "维修中";
                } else if (blockedOther) {
                    state = "其他任务占用";
                } else if (blockedDraft) {
                    state = "已跟随其他挖机";
                }

                button.innerHTML = `
                    <strong>
                        ${device.id}
                    </strong>

                    <span>
                        ${state}
                    </span>
                `;

                button.addEventListener(
                    "click",
                    () => {
                        if (
                            !adjustmentSelectedExcavatorId
                        ) {
                            alert("请先选择挖机。");
                            return;
                        }

                        if (maintenance) {
                            showMaintenanceModal(device);
                            return;
                        }

                        if (
                            blockedOther ||
                            blockedDraft
                        ) {
                            alert(
                                device.id +
                                " 当前不可分配。"
                            );
                            return;
                        }

                        const index =
                            adjustmentSelectedTruckIds
                                .indexOf(device.id);

                        if (index >= 0) {
                            adjustmentSelectedTruckIds
                                .splice(index, 1);
                        } else {
                            adjustmentSelectedTruckIds
                                .push(device.id);
                        }

                        renderAdjustmentTrucks();
                    }
                );

                board.appendChild(button);
            });

        setText(
            "adjustTruckSelectionCount",
            `已选择 ${adjustmentSelectedTruckIds.length} 台卡车`
        );
    }

    function addOrUpdateAdjustmentBinding() {
        if (!adjustmentSelectedExcavatorId) {
            alert("请先选择挖机。");
            return;
        }

        if (!adjustmentSelectedTruckIds.length) {
            alert("请至少选择一台跟随卡车。");
            return;
        }

        if (adjustmentEditingExcavatorId) {
            const binding =
                adjustmentDraftBindings.find(
                    item =>
                        item.excavatorId ===
                        adjustmentEditingExcavatorId
                );

            if (binding) {
                binding.truckIds =
                    [...adjustmentSelectedTruckIds];
            }
        } else {
            if (
                adjustmentDraftBindings.some(
                    item =>
                        item.excavatorId ===
                        adjustmentSelectedExcavatorId
                )
            ) {
                alert("该挖机已经在任务中。");
                return;
            }

            adjustmentDraftBindings.push({
                excavatorId:
                    adjustmentSelectedExcavatorId,

                truckIds:
                    [...adjustmentSelectedTruckIds]
            });
        }

        adjustmentSelectedExcavatorId = null;
        adjustmentSelectedTruckIds = [];
        adjustmentEditingExcavatorId = null;

        setText(
            "adjustSelectionInfo",
            "请选择新增挖机，再选择跟随卡车"
        );

        addAdjustmentBindingButton.textContent =
            "加入本任务";

        renderAdjustmentUi();
    }

    function saveAdjustmentChanges() {
        if (!adjustmentTaskId) return;

        const before =
            normalizeBindings(
                adjustmentOriginalBindings
            );

        const after =
            normalizeBindings(
                adjustmentDraftBindings
            );

        if (
            JSON.stringify(before) ===
            JSON.stringify(after)
        ) {
            alert("设备没有发生变化。");
            return;
        }

        if (
            !confirm(
                "确认保存本次设备调整吗？任务编号和原运输趟数不会变化。"
            )
        ) {
            return;
        }

        const tasks =
            getPublishedTasks();

        const task =
            tasks.find(
                item =>
                    item.taskId ===
                    adjustmentTaskId
            );

        if (
            !task ||
            !["pending", "active"]
                .includes(task.status)
        ) {
            alert(
                "任务状态已变化，无法保存调整。"
            );
            return;
        }

        const conflict =
            validateAdjustmentConflicts(
                after,
                task.taskId
            );

        if (conflict) {
            alert(conflict);
            return;
        }

        const summary =
            buildAdjustmentSummary(
                before,
                after
            );

        task.bindings =
            deepClone(after);

        if (
            !Array.isArray(
                task.equipmentAdjustments
            )
        ) {
            task.equipmentAdjustments = [];
        }

        task.equipmentAdjustments.push({
            adjustmentId:
                "ADJ_" + Date.now(),

            time:
                new Date().toISOString(),

            summary,

            beforeBindings:
                deepClone(before),

            afterBindings:
                deepClone(after)
        });

        task.lastEquipmentAdjustedAt =
            new Date().toISOString();

        saveTaskArray(tasks);

        rebuildEquipmentStatusFromTasks();

        closeAdjustmentModal();

        renderProductionTaskBoard();

        selectedPublishedTaskId =
            task.taskId;

        openPublishedTask(
            task.taskId
        );

        alert(
            "设备调整已保存：" +
            summary
        );
    }

    function validateAdjustmentConflicts(
        afterBindings,
        taskId
    ) {
        const usedOther =
            getEquipmentUsedByOtherTasks(
                taskId
            );

        const seen =
            new Set();

        for (
            const binding
            of afterBindings
        ) {
            if (
                usedOther.has(
                    binding.excavatorId
                )
            ) {
                return (
                    binding.excavatorId +
                    " 已被其他生产任务占用。"
                );
            }

            if (
                seen.has(
                    binding.excavatorId
                )
            ) {
                return (
                    binding.excavatorId +
                    " 重复绑定。"
                );
            }

            seen.add(
                binding.excavatorId
            );

            const excavator =
                findDevice(
                    binding.excavatorId
                );

            if (
                excavator?.status ===
                "maintenance"
            ) {
                return (
                    binding.excavatorId +
                    " 正在维修，不能加入任务。"
                );
            }

            for (
                const truckId
                of (binding.truckIds || [])
            ) {
                if (
                    usedOther.has(truckId)
                ) {
                    return (
                        truckId +
                        " 已被其他生产任务占用。"
                    );
                }

                if (
                    seen.has(truckId)
                ) {
                    return (
                        truckId +
                        " 被重复分配。"
                    );
                }

                seen.add(truckId);

                const truck =
                    findDevice(truckId);

                if (
                    truck?.status ===
                    "maintenance"
                ) {
                    return (
                        truckId +
                        " 正在维修，不能加入任务。"
                    );
                }
            }
        }

        return "";
    }

    function buildAdjustmentSummary(
        before,
        after
    ) {
        const beforeMap =
            new Map(
                before.map(
                    item => [
                        item.excavatorId,
                        item.truckIds || []
                    ]
                )
            );

        const afterMap =
            new Map(
                after.map(
                    item => [
                        item.excavatorId,
                        item.truckIds || []
                    ]
                )
            );

        const parts = [];

        const addedExcavators =
            [...afterMap.keys()]
                .filter(
                    id =>
                        !beforeMap.has(id)
                );

        const removedExcavators =
            [...beforeMap.keys()]
                .filter(
                    id =>
                        !afterMap.has(id)
                );

        if (addedExcavators.length) {
            parts.push(
                "增加挖机 " +
                addedExcavators.join("、")
            );
        }

        if (removedExcavators.length) {
            parts.push(
                "减少挖机 " +
                removedExcavators.join("、")
            );
        }

        [...afterMap.keys()]
            .filter(
                id =>
                    beforeMap.has(id)
            )
            .forEach(id => {
                const oldSet =
                    new Set(
                        beforeMap.get(id)
                    );

                const newSet =
                    new Set(
                        afterMap.get(id)
                    );

                const added =
                    [...newSet]
                        .filter(
                            truck =>
                                !oldSet.has(truck)
                        );

                const removed =
                    [...oldSet]
                        .filter(
                            truck =>
                                !newSet.has(truck)
                        );

                if (added.length) {
                    parts.push(
                        `${id} 增加卡车 ${added.join("、")}`
                    );
                }

                if (removed.length) {
                    parts.push(
                        `${id} 减少卡车 ${removed.join("、")}`
                    );
                }
            });

        return (
            parts.join("；") ||
            "设备配置发生调整"
        );
    }

    function getEquipmentUsedByOtherTasks(
        taskId
    ) {
        const used =
            new Set();

        getPublishedTasks()
            .filter(
                task =>
                    [
                        "pending",
                        "active"
                    ].includes(task.status) &&
                    task.taskId !== taskId
            )
            .forEach(task => {
                (task.bindings || [])
                    .forEach(binding => {
                        used.add(
                            binding.excavatorId
                        );

                        (binding.truckIds || [])
                            .forEach(
                                id =>
                                    used.add(id)
                            );
                    });

                (task.auxiliaryAssignments || [])
                    .forEach(
                        item =>
                            used.add(
                                item.vehicleId
                            )
                    );
            });

        return used;
    }

    function normalizeBindings(list) {
        return deepClone(list || [])
            .map(item => ({
                excavatorId:
                    item.excavatorId,

                truckIds:
                    [
                        ...new Set(
                            item.truckIds || []
                        )
                    ].sort()
            }))
            .sort(
                (a, b) =>
                    a.excavatorId
                        .localeCompare(
                            b.excavatorId
                        )
            );
    }

    function renderExcavators() {
        const board =
            $("excavatorBoard");

        if (!board) return;

        const devices =
            equipment.filter(
                item =>
                    item.type ===
                    "excavator"
            );

        setText(
            "excavatorCount",
            devices.length + " 台"
        );

        board.innerHTML = "";

        devices.forEach(device => {
            const card =
                createDeviceCard(device);

            if (
                selectedExcavatorId ===
                device.id
            ) {
                card.classList.add(
                    "selected-device"
                );

                card
                    .querySelector(
                        ".device-status"
                    )
                    .textContent =
                    "✓ 当前选择";
            }

            card.addEventListener(
                "click",
                () =>
                    handleExcavatorClick(
                        device
                    )
            );

            board.appendChild(card);
        });
    }

    function handleExcavatorClick(device) {
        if (
            device.status ===
            "maintenance"
        ) {
            showMaintenanceModal(device);
            return;
        }

        if (
            device.status ===
            "assigned"
        ) {
            showAssignedModal(device);
            return;
        }

        selectedExcavatorId =
            device.id;

        selectedTruckIds =
            [];

        renderExcavators();
        renderTrucks();

        scrollToId("truckSection");
    }

    function renderTrucks() {
        const board =
            $("truckBoard");

        if (!board) return;

        const trucks =
            equipment.filter(
                item =>
                    item.type === "truck"
            );

        setText(
            "truckCount",
            trucks.length + " 台"
        );

        board.innerHTML = "";

        trucks.forEach(device => {
            const card =
                createDeviceCard(device);

            if (
                selectedTruckIds
                    .includes(device.id)
            ) {
                card.classList.add(
                    "selected-device"
                );

                card
                    .querySelector(
                        ".device-status"
                    )
                    .textContent =
                    "✓ 已选择";
            }

            card.addEventListener(
                "click",
                () =>
                    handleTruckClick(device)
            );

            board.appendChild(card);
        });

        updateTruckSelectionInfo();
    }

    function handleTruckClick(device) {
        if (
            device.status ===
            "maintenance"
        ) {
            showMaintenanceModal(device);
            return;
        }

        if (
            device.status ===
            "assigned"
        ) {
            showAssignedModal(device);
            return;
        }

        if (!selectedExcavatorId) {
            alert(
                "请先点击一台绿色挖机"
            );
            return;
        }

        const index =
            selectedTruckIds
                .indexOf(device.id);

        if (index >= 0) {
            selectedTruckIds
                .splice(index, 1);
        } else {
            selectedTruckIds
                .push(device.id);
        }

        renderTrucks();
    }

    function updateTruckSelectionInfo() {
        if (!selectedExcavatorId) {
            setText(
                "selectedExcavatorInfo",
                "当前未选择挖机"
            );

            el.bindTrucksButton
                ?.classList
                .add("hidden");

            return;
        }

        $("selectedExcavatorInfo").innerHTML =
            `当前挖机：<strong>${escapeHtml(selectedExcavatorId)}</strong> ｜ 已选择 <strong>${selectedTruckIds.length}</strong> 台卡车`;

        el.bindTrucksButton
            ?.classList
            .remove("hidden");

        el.bindTrucksButton.textContent =
            `绑定所选卡车（${selectedTruckIds.length}台）`;
    }

    function renderBindings() {
        const box =
            $("bindingList");

        if (!box) return;

        if (!bindings.length) {
            box.innerHTML =
                '<div class="empty-placeholder">暂无绑定关系</div>';

            return;
        }

        box.innerHTML =
            bindings
                .map(
                    binding =>
                        `
                        <div class="binding-card">

                            <div class="binding-excavator">
                                🚜
                                <strong>
                                    ${escapeHtml(binding.excavatorId)}
                                </strong>
                            </div>

                            <div class="binding-truck-list">

                                ${
                                    (binding.truckIds || [])
                                        .map(
                                            id =>
                                                `<div class="binding-truck-item">
                                                    🚚
                                                    ${escapeHtml(id)}
                                                 </div>`
                                        )
                                        .join("")
                                }

                            </div>

                        </div>
                        `
                )
                .join("");
    }

    function renderAuxiliaryBoards() {
        [
            [
                "loader",
                "loaderBoard",
                "loaderCount"
            ],
            [
                "water",
                "waterBoard",
                "waterCount"
            ],
            [
                "fuel",
                "fuelBoard",
                "fuelCount"
            ],
            [
                "grader",
                "graderBoard",
                "graderCount"
            ],
            [
                "dozer",
                "dozerBoard",
                "dozerCount"
            ],
            [
                "bus",
                "busBoard",
                "busCount"
            ]
        ].forEach(
            args =>
                renderAuxiliaryBoard(
                    ...args
                )
        );
    }

    function renderAuxiliaryBoard(
        type,
        boardId,
        countId
    ) {
        const board =
            $(boardId);

        if (!board) return;

        const devices =
            equipment.filter(
                item =>
                    item.type === type
            );

        setText(
            countId,
            devices.length + " 台"
        );

        board.innerHTML = "";

        devices.forEach(device => {
            const card =
                createDeviceCard(device);

            card.addEventListener(
                "click",
                () =>
                    handleAuxiliaryDeviceClick(
                        device
                    )
            );

            board.appendChild(card);
        });
    }

    function handleAuxiliaryDeviceClick(device) {
        if (
            device.status ===
            "maintenance"
        ) {
            showMaintenanceModal(device);
            return;
        }

        if (
            device.status ===
            "assigned"
        ) {
            showAssignedModal(device);
            return;
        }

        if (!currentTask) {
            alert("请先创建生产任务");
            return;
        }

        selectedAuxDeviceId =
            device.id;

        setText(
            "auxSelectedVehicle",
            `${getTypeName(device.type)} · ${device.id}`
        );

        setText(
            "auxTaskModalTitle",
            "下发" +
            getTypeName(device.type) +
            "任务"
        );

        el.auxWorkType.innerHTML = "";

        getWorkOptions(device.type)
            .forEach(item => {
                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    item.value;

                option.textContent =
                    item.label;

                el.auxWorkType
                    .appendChild(option);
            });

        setValue(
            "auxManualWork",
            ""
        );

        setValue(
            "auxTaskRemark",
            ""
        );

        hideSection(
            "auxManualWorkBox"
        );

        showSection(
            "auxTaskModal"
        );
    }

    function renderAuxiliaryAssignments() {
        const box =
            $("auxiliaryAssignmentList");

        if (!box) return;

        if (!auxiliaryAssignments.length) {
            box.innerHTML =
                '<div class="empty-placeholder">暂未配置辅助车辆</div>';

            return;
        }

        box.innerHTML =
            auxiliaryAssignments
                .map(
                    item =>
                        `
                        <div class="aux-assignment-card">

                            <div>
                                <strong>
                                    ${escapeHtml(item.typeName)}
                                    ·
                                    ${escapeHtml(item.vehicleId)}
                                </strong>

                                <span>
                                    ${escapeHtml(item.work)}
                                </span>
                            </div>

                            <div class="aux-assignment-area">
                                ${escapeHtml(item.area)}
                            </div>

                        </div>
                        `
                )
                .join("");
    }

    function createDeviceCard(device) {
        const card =
            document.createElement("button");

        card.type = "button";

        card.className =
            "device-card " +
            getStatusClass(device.status);

        card.innerHTML = `
            <strong class="device-number">
                ${escapeHtml(device.id)}
            </strong>

            <span class="device-status">
                ${getStatusText(device.status)}
            </span>
        `;

        return card;
    }

    function showMaintenanceModal(device) {
        const maintenance =
            device.maintenance || {};

        setText(
            "modalTitle",
            `${device.id} · 维修状态`
        );

        $("modalContent").innerHTML =
            detailRow(
                "车型",
                getTypeName(device.type)
            )
            +
            detailRow(
                "故障",
                maintenance.fault ||
                "未填写"
            )
            +
            detailRow(
                "开始时间",
                maintenance.startedAt ||
                "-"
            )
            +
            detailRow(
                "预计完成",
                maintenance.expectedEnd ||
                "-"
            )
            +
            detailRow(
                "维修负责人",
                maintenance.responsible ||
                "-"
            );

        showSection("deviceModal");
    }

    function showAssignedModal(device) {
        const task =
            device.assignedTask || {};

        setText(
            "modalTitle",
            `${device.id} · 当前任务`
        );

        $("modalContent").innerHTML =
            detailRow(
                "车型",
                getTypeName(device.type)
            )
            +
            detailRow(
                "作业区域",
                task.area || "-"
            )
            +
            detailRow(
                "班次",
                task.shift || "-"
            )
            +
            detailRow(
                "工作内容",
                task.work || "-"
            );

        showSection("deviceModal");
    }

    function detailRow(label, value) {
        return `
            <div class="modal-detail-row">

                <span>
                    ${escapeHtml(label)}
                </span>

                <strong>
                    ${escapeHtml(value)}
                </strong>

            </div>
        `;
    }

    function renderTaskPreview() {
        const box =
            $("taskPreviewContent");

        let html = `
            <div class="preview-header">

                <strong>
                    ${escapeHtml(currentTask.area)}
                </strong>

                <span>
                    ${escapeHtml(currentTask.date)}
                    ·
                    ${escapeHtml(currentTask.shift)}
                </span>

            </div>

            <div class="preview-block">
                <h3>主采设备</h3>
        `;

        if (!bindings.length) {
            html +=
                "<p>未配置挖机和卡车</p>";
        }

        bindings.forEach(binding => {
            html += `
                <div class="preview-binding">

                    <strong>
                        🚜
                        ${escapeHtml(binding.excavatorId)}
                    </strong>

                    ${
                        (binding.truckIds || [])
                            .map(
                                id =>
                                    `<span>
                                        └ 🚚
                                        ${escapeHtml(id)}
                                     </span>`
                            )
                            .join("")
                    }

                </div>
            `;
        });

        html += `
            </div>

            <div class="preview-block">
                <h3>辅助车辆</h3>
        `;

        if (!auxiliaryAssignments.length) {
            html +=
                "<p>未配置辅助车辆</p>";
        }

        auxiliaryAssignments.forEach(item => {
            html += `
                <div class="preview-auxiliary">

                    <strong>
                        ${escapeHtml(item.typeName)}
                        ·
                        ${escapeHtml(item.vehicleId)}
                    </strong>

                    <span>
                        ${escapeHtml(item.work)}
                    </span>

                </div>
            `;
        });

        html += `
            </div>

            <div class="preview-block">

                <h3>调度说明</h3>

                <p>
                    ${escapeHtml(currentTask.remark || "无")}
                </p>

            </div>
        `;

        box.innerHTML =
            html;
    }

    function markDraftBindingAssigned(
        excavatorId,
        truckIds
    ) {
        const excavator =
            findDevice(excavatorId);

        if (excavator) {
            excavator.status =
                "assigned";

            excavator.assignedTask = {
                taskId:
                    currentTask.taskId,

                area:
                    currentTask.area,

                shift:
                    currentTask.shift,

                work:
                    "采装作业"
            };
        }

        truckIds.forEach(id => {
            const truck =
                findDevice(id);

            if (truck) {
                truck.status =
                    "assigned";

                truck.assignedTask = {
                    taskId:
                        currentTask.taskId,

                    area:
                        currentTask.area,

                    shift:
                        currentTask.shift,

                    work:
                        "跟随 " +
                        excavatorId,

                    excavatorId
                };
            }
        });
    }

    function rebuildEquipmentStatusFromTasks() {
        equipment.forEach(device => {
            if (
                device.status !==
                "maintenance"
            ) {
                device.status =
                    "available";

                delete device.assignedTask;
            }
        });

        getPublishedTasks()
            .filter(
                task =>
                    [
                        "pending",
                        "active"
                    ].includes(task.status)
            )
            .forEach(task => {
                (task.bindings || [])
                    .forEach(binding => {
                        const excavator =
                            findDevice(
                                binding.excavatorId
                            );

                        if (
                            excavator &&
                            excavator.status !==
                            "maintenance"
                        ) {
                            excavator.status =
                                "assigned";

                            excavator.assignedTask = {
                                taskId:
                                    task.taskId,

                                area:
                                    task.area,

                                shift:
                                    task.shift,

                                work:
                                    "采装作业"
                            };
                        }

                        (binding.truckIds || [])
                            .forEach(id => {
                                const truck =
                                    findDevice(id);

                                if (
                                    truck &&
                                    truck.status !==
                                    "maintenance"
                                ) {
                                    truck.status =
                                        "assigned";

                                    truck.assignedTask = {
                                        taskId:
                                            task.taskId,

                                        area:
                                            task.area,

                                        shift:
                                            task.shift,

                                        work:
                                            "跟随 " +
                                            binding.excavatorId,

                                        excavatorId:
                                            binding.excavatorId
                                    };
                                }
                            });
                    });

                (task.auxiliaryAssignments || [])
                    .forEach(item => {
                        const device =
                            findDevice(
                                item.vehicleId
                            );

                        if (
                            device &&
                            device.status !==
                            "maintenance"
                        ) {
                            device.status =
                                "assigned";

                            device.assignedTask = {
                                taskId:
                                    task.taskId,

                                area:
                                    task.area,

                                shift:
                                    task.shift,

                                work:
                                    item.work,

                                remark:
                                    item.remark
                            };
                        }
                    });
            });
    }

    function findDevice(id) {
        return equipment.find(
            item => item.id === id
        );
    }

    function injectV250Ui() {
        const actionArea =
            $("publishedTaskActionArea");

        if (
            actionArea &&
            !$("adjustTaskButton")
        ) {
            const button =
                document.createElement(
                    "button"
                );

            button.id =
                "adjustTaskButton";

            button.type =
                "button";

            button.className =
                "v250-adjust-main-button hidden";

            button.textContent =
                "调整设备";

            actionArea.insertBefore(
                button,
                el.withdrawPublishedTaskButton ||
                actionArea.firstChild
            );
        }

        if (!$("adjustTaskModal")) {
            const modal =
                document.createElement(
                    "div"
                );

            modal.id =
                "adjustTaskModal";

            modal.className =
                "device-modal hidden";

            modal.innerHTML = `
                <div class="device-modal-card v250-adjust-modal-card">

                    <h3 id="adjustTaskModalTitle">
                        调整设备
                    </h3>

                    <p class="v250-help">
                        可中途增加/减少挖机，也可调整每台挖机的跟随卡车。
                        保存后任务编号和运输趟数不变。
                    </p>

                    <div class="v250-adjust-section">

                        <h4>
                            当前挖机配置
                        </h4>

                        <div id="adjustCurrentBindings"></div>

                    </div>

                    <div class="v250-adjust-section">

                        <h4>
                            增加挖机
                        </h4>

                        <div
                            id="adjustSelectionInfo"
                            class="selected-equipment-info"
                        >
                            请选择新增挖机，再选择跟随卡车
                        </div>

                        <div
                            id="adjustExcavatorBoard"
                            class="v250-adjust-board"
                        ></div>

                    </div>

                    <div class="v250-adjust-section">

                        <h4>
                            选择跟随卡车
                        </h4>

                        <div
                            id="adjustTruckSelectionCount"
                            class="v250-count-line"
                        >
                            已选择 0 台卡车
                        </div>

                        <div
                            id="adjustTruckBoard"
                            class="v250-adjust-board"
                        ></div>

                        <button
                            id="addAdjustmentBindingButton"
                            type="button"
                            class="success-button"
                        >
                            加入本任务
                        </button>

                    </div>

                    <div class="double-button-row">

                        <button
                            id="closeAdjustTaskButton"
                            type="button"
                            class="secondary-button"
                        >
                            取消
                        </button>

                        <button
                            id="saveAdjustTaskButton"
                            type="button"
                            class="publish-button"
                            disabled
                        >
                            暂无修改
                        </button>

                    </div>

                </div>
            `;

            document.body
                .appendChild(modal);
        }

        if (!$("v250Style")) {
            const style =
                document.createElement(
                    "style"
                );

            style.id =
                "v250Style";

            style.textContent = `
                .v250-adjust-main-button{
                    background:#2563eb!important;
                    color:#fff!important;
                    border:none!important;
                }

                .v250-adjust-modal-card{
                    width:min(920px,94vw);
                    max-height:90vh;
                    overflow:auto;
                }

                .v250-help{
                    margin:0 0 14px;
                    color:#64748b;
                    line-height:1.6;
                }

                .v250-adjust-section{
                    margin:14px 0;
                    padding:14px;
                    border:1px solid #e2e8f0;
                    border-radius:12px;
                }

                .v250-adjust-section h4{
                    margin:0 0 12px;
                }

                .v250-adjust-board{
                    display:grid;
                    grid-template-columns:
                        repeat(
                            auto-fill,
                            minmax(105px,1fr)
                        );
                    gap:10px;
                    margin:10px 0 14px;
                }

                .v250-adjust-device{
                    min-height:72px;
                    border:2px solid #bbf7d0;
                    background:#f0fdf4;
                    border-radius:10px;
                    padding:9px;
                    display:flex;
                    flex-direction:column;
                    gap:5px;
                    align-items:center;
                    justify-content:center;
                }

                .v250-adjust-device strong{
                    font-size:15px;
                }

                .v250-adjust-device span{
                    font-size:12px;
                }

                .v250-adjust-device.selected{
                    border-color:#2563eb;
                    background:#eff6ff;
                }

                .v250-adjust-device.blocked{
                    border-color:#e5e7eb;
                    background:#f3f4f6;
                    color:#9ca3af;
                }

                .v250-binding-edit-card{
                    display:flex;
                    justify-content:space-between;
                    gap:12px;
                    align-items:center;
                    padding:12px;
                    border:1px solid #e5e7eb;
                    border-radius:10px;
                    margin:8px 0;
                }

                .v250-mini-list{
                    display:flex;
                    flex-wrap:wrap;
                    gap:6px;
                    margin-top:7px;
                }

                .v250-mini-list span{
                    font-size:12px;
                    padding:4px 7px;
                    border-radius:999px;
                    background:#f1f5f9;
                }

                .v250-row-actions{
                    display:flex;
                    gap:7px;
                    flex-wrap:wrap;
                    justify-content:flex-end;
                }

                .v250-row-actions button{
                    width:auto!important;
                    margin:0!important;
                    padding:8px 10px!important;
                    font-size:12px;
                }

                .v250-edit-btn{
                    background:#2563eb!important;
                    color:white!important;
                }

                .v250-remove-btn{
                    background:#dc2626!important;
                    color:white!important;
                }

                .v250-count-line{
                    font-size:13px;
                    color:#475569;
                    margin-bottom:6px;
                }

                .v250-history-row{
                    display:flex;
                    gap:10px;
                    align-items:flex-start;
                    padding:8px 0;
                    border-bottom:1px solid #eef2f7;
                }

                .v250-history-row strong{
                    font-size:12px;
                    white-space:nowrap;
                }

                .v250-history-row span{
                    font-size:13px;
                    line-height:1.5;
                }

                @media(max-width:600px){
                    .v250-binding-edit-card{
                        align-items:flex-start;
                        flex-direction:column;
                    }

                    .v250-row-actions{
                        width:100%;
                        justify-content:flex-start;
                    }

                    .v250-adjust-board{
                        grid-template-columns:
                            repeat(3,1fr);
                    }
                }
            `;

            document.head
                .appendChild(style);
        }
    }

    function hideOldStatusLegends() {
        document.querySelectorAll(
            ".task-status-legend .completed,.task-status-legend .withdrawn"
        ).forEach(
            element =>
                element.style.display =
                    "none"
        );
    }

    function migrateLegacyWithdrawnTasks() {
        const tasks =
            getPublishedTasks();

        const keep =
            tasks.filter(
                task =>
                    task.status !==
                    "withdrawn"
            );

        if (
            keep.length !==
            tasks.length
        ) {
            saveTaskArray(keep);
        }
    }

    function migrateOldTaskStatuses() {
        const tasks =
            getPublishedTasks();

        let changed =
            false;

        tasks.forEach(task => {
            if (
                task.status === "active" &&
                getTaskTripStats(task.taskId)
                    .count === 0
            ) {
                task.status =
                    "pending";

                task.transportTripCount =
                    0;

                delete task.startedAt;

                changed =
                    true;
            }
        });

        if (changed) {
            saveTaskArray(tasks);
        }
    }

    function syncPublishedTaskExecutionStatus() {
        const tasks =
            getPublishedTasks();

        let changed =
            false;

        tasks.forEach(task => {
            if (
                task.status !==
                "pending"
            ) {
                return;
            }

            const stats =
                getTaskTripStats(
                    task.taskId
                );

            if (stats.count > 0) {
                task.status =
                    "active";

                task.startedAt =
                    stats.firstTime ||
                    new Date()
                        .toISOString();

                task.transportTripCount =
                    stats.count;

                changed =
                    true;
            }
        });

        if (changed) {
            saveTaskArray(tasks);
        }
    }

    function getTaskTripRecords(taskId) {
        let records = [];

        try {
            records =
                JSON.parse(
                    localStorage.getItem(
                        STORAGE_TRIPS
                    ) ||
                    "[]"
                );
        } catch {
            records = [];
        }

        if (!Array.isArray(records)) {
            records = [];
        }

        return records.filter(record => {
            if (!record) {
                return false;
            }

            const id =
                record.taskId ||
                record.dispatchTaskId ||
                (
                    record.task &&
                    record.task.taskId
                )
                ||
                "";

            return (
                String(id) ===
                String(taskId)
            );
        });
    }

    function getTaskTripStats(taskId) {
        const records =
            getTaskTripRecords(taskId);

        const times =
            records
                .map(
                    record =>
                        record.completedAt ||
                        record.endTime ||
                        record.finishedAt ||
                        record.createdAt ||
                        record.time ||
                        null
                )
                .filter(Boolean)
                .map(
                    value =>
                        new Date(value)
                )
                .filter(
                    date =>
                        !Number.isNaN(
                            date.getTime()
                        )
                )
                .sort(
                    (a, b) =>
                        a - b
                );

        return {
            count:
                records.length,

            firstTime:
                times.length
                    ? times[0]
                        .toISOString()
                    : null,

            lastTime:
                times.length
                    ? times[
                        times.length - 1
                    ].toISOString()
                    : null
        };
    }

    function getTruckTaskTripCount(
        taskId,
        truckId
    ) {
        return getTaskTripRecords(taskId)
            .filter(record => {
                const id =
                    record.vehicleNumber ||
                    record.vehicleId ||
                    record.truckId ||
                    record.vehicle ||
                    "";

                return (
                    String(id) ===
                    String(truckId)
                );
            })
            .length;
    }

    function createTruckData() {
        const result = [];

        for (
            let index = 1;
            index <= 20;
            index++
        ) {
            const id =
                "T-" +
                String(index)
                    .padStart(
                        3,
                        "0"
                    );

            const truck = {
                id,
                type:
                    "truck",
                status:
                    "available"
            };

            if (
                index === 5 ||
                index === 12
            ) {
                truck.status =
                    "maintenance";

                truck.maintenance = {
                    fault:
                        index === 5
                            ? "轮胎维修"
                            : "发动机故障检查",

                    startedAt:
                        "08:00",

                    expectedEnd:
                        "14:00",

                    responsible:
                        "维修组"
                };
            }

            result.push(truck);
        }

        return result;
    }

    function savePublishedTask(task) {
        const tasks =
            getPublishedTasks();

        tasks.push(task);

        saveTaskArray(tasks);

        localStorage.setItem(
            STORAGE_LATEST,
            JSON.stringify(task)
        );
    }

    function saveTaskArray(tasks) {
        localStorage.setItem(
            STORAGE_TASKS,
            JSON.stringify(tasks)
        );
    }

    function getPublishedTasks() {
        let tasks = [];

        try {
            tasks =
                JSON.parse(
                    localStorage.getItem(
                        STORAGE_TASKS
                    ) ||
                    "[]"
                );
        } catch {
            tasks = [];
        }

        return Array.isArray(tasks)
            ? tasks
            : [];
    }

    function clearLegacyLatestTaskIfMatch(taskId) {
        try {
            const latest =
                JSON.parse(
                    localStorage.getItem(
                        STORAGE_LATEST
                    ) ||
                    "null"
                );

            if (
                latest &&
                String(latest.taskId) ===
                String(taskId)
            ) {
                localStorage.removeItem(
                    STORAGE_LATEST
                );
            }
        } catch {}
    }

    function getWorkOptions(type) {
        if (type === "loader") {
            return [
                "日常作业",
                "清理挖机附近散料",
                "修整运输道路",
                "装煤",
                "排土场作业"
            ]
                .map(
                    value => ({
                        value,
                        label:
                            value
                    })
                )
                .concat({
                    value:
                        "manual",
                    label:
                        "手动录入"
                });
        }

        if (type === "water") {
            return [
                "日常洒水",
                "运输道路洒水",
                "采区洒水",
                "排土场洒水",
                "临时调配"
            ]
                .map(
                    value => ({
                        value,
                        label:
                            value
                    })
                )
                .concat({
                    value:
                        "manual",
                    label:
                        "手动录入"
                });
        }

        return [
            {
                value:
                    "日常作业",
                label:
                    "日常作业"
            },
            {
                value:
                    "manual",
                label:
                    "手动录入"
            }
        ];
    }

    function getTypeName(type) {
        return ({
            excavator:
                "挖机",

            truck:
                "卡车",

            loader:
                "装载机",

            water:
                "水车",

            fuel:
                "加油车",

            grader:
                "平路机",

            dozer:
                "推土机",

            bus:
                "大巴"
        }[type] || "其他车辆");
    }

    function getTaskStatusText(status) {
        return ({
            pending:
                "待执行",

            active:
                "执行中",

            completed:
                "已完成",

            configuring:
                "配置中"
        }[status] || "未知");
    }

    function getTaskCardClass(status) {
        if (status === "pending") {
            return "task-pending-card";
        }

        if (status === "active") {
            return "task-active-card";
        }

        return "";
    }

    function getStatusClass(status) {
        if (status === "available") {
            return "device-available";
        }

        if (status === "maintenance") {
            return "device-maintenance";
        }

        if (status === "assigned") {
            return "device-assigned";
        }

        return "";
    }

    function getStatusText(status) {
        if (status === "available") {
            return "可调配";
        }

        if (status === "maintenance") {
            return "维修中";
        }

        if (status === "assigned") {
            return "已分配";
        }

        return "未知";
    }

    function getDefaultShift() {
        const hour =
            new Date()
                .getHours();

        return (
            hour >= 8 &&
            hour < 20
        )
            ? "白班"
            : "夜班";
    }

    function formatDateTime(value) {
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

    function getValue(id) {
        const element =
            $(id);

        return element
            ? String(
                element.value ||
                ""
            ).trim()
            : "";
    }

    function setValue(id, value) {
        const element =
            $(id);

        if (element) {
            element.value =
                value || "";
        }
    }

    function setText(id, value) {
        const element =
            $(id);

        if (element) {
            element.textContent =
                value;
        }
    }

    function showSection(id) {
        const element =
            $(id);

        if (element) {
            element
                .classList
                .remove("hidden");
        }
    }

    function hideSection(id) {
        const element =
            $(id);

        if (element) {
            element
                .classList
                .add("hidden");
        }
    }

    function scrollToId(id) {
        const element =
            $(id);

        if (element) {
            setTimeout(
                () =>
                    element.scrollIntoView({
                        behavior:
                            "smooth",

                        block:
                            "start"
                    }),
                50
            );
        }
    }

    function escapeHtml(value) {
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

    function deepClone(value) {
        return JSON.parse(
            JSON.stringify(value)
        );
    }
});
