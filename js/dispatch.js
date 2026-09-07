/*
========================================================
矿山管理系统
生产调度端 dispatch.js V2.7.0

新增：
1. 调度给每台卡车分配司机
2. 司机只能领取被分配车辆
3. 司机故障换车申请
4. 调度批准/拒绝
5. 未批准期间禁止继续计趟
6. 批准后新车辆自动接替，任务和累计趟数不变
========================================================
*/

document.addEventListener("DOMContentLoaded", function () {

    const TASK_KEY = "dispatchPublishedTasks";
    const TRIP_KEY = "driverTripRecords";
    const CHANGE_KEY = "vehicleChangeRequests";
    const FAULT_KEY = "dispatchVehicleFaults";
    const LATEST_KEY = "publishedDispatchTask";

    let currentTask = null;
    let bindings = [];
    let auxiliaryAssignments = [];

    let selectedExcavatorId = null;
    let selectedTruckIds = [];
    let selectedAuxDeviceId = null;

    let selectedPublishedTaskId = null;
    let selectedChangeRequestId = null;

    let adjustmentTaskId = null;
    let adjustmentOriginalBindings = [];
    let adjustmentDraftBindings = [];
    let adjustmentSelectedExcavatorId = null;
    let adjustmentSelectedTruckIds = [];
    let adjustmentEditingExcavatorId = null;

    const equipment = createEquipmentData();

    const $ = id => document.getElementById(id);

    initialize();

    function initialize() {
        $("taskShift").value = getDefaultShift();

        removeLegacyWithdrawnTasks();
        migrateOldActiveTasks();
        syncTaskStatusFromTrips();
        rebuildEquipmentStatus();

        renderProductionTaskBoard();
        renderHistoryTaskBoard();
        renderChangeRequestBoard();

        bindEvents();
    }

    function bindEvents() {

        $("newTaskButton").addEventListener("click", function () {
            $("taskShift").value = getDefaultShift();
            show("taskCreateSection");
            scrollTo("taskCreateSection");
        });

        $("historyTaskButton").addEventListener("click", toggleHistory);

        $("cancelCreateButton").addEventListener("click", function () {
            hide("taskCreateSection");
        });

        $("generateTaskButton").addEventListener("click", generateTask);

        $("bindTrucksButton").addEventListener("click", bindSelectedTrucks);

        $("auxWorkType").addEventListener("change", function () {
            if (this.value === "manual") {
                show("auxManualWorkBox");
            } else {
                hide("auxManualWorkBox");
                $("auxManualWork").value = "";
            }
        });

        $("cancelAuxTaskButton").addEventListener("click", function () {
            selectedAuxDeviceId = null;
            hide("auxTaskModal");
        });

        $("confirmAuxTaskButton").addEventListener("click", saveAuxiliaryAssignment);

        $("previewTaskButton").addEventListener("click", function () {
            if (!currentTask) return;
            renderTaskPreview();
            show("previewSection");
            scrollTo("previewSection");
        });

        $("backEditButton").addEventListener("click", function () {
            hide("previewSection");
        });

        $("publishTaskButton").addEventListener("click", publishTask);

        $("closeModalButton").addEventListener("click", function () {
            hide("deviceModal");
        });

        $("closePublishedTaskButton").addEventListener("click", closePublishedTask);

        $("withdrawPublishedTaskButton").addEventListener("click", withdrawTask);

        $("completePublishedTaskButton").addEventListener("click", completeTask);

        $("assignDriversButton").addEventListener("click", openDriverAssignModal);

        $("cancelDriverAssignButton").addEventListener("click", function () {
            hide("driverAssignModal");
        });

        $("saveDriverAssignButton").addEventListener("click", saveDriverAssignments);

        $("adjustTaskButton").addEventListener("click", function () {
            const id = selectedPublishedTaskId;
            hide("publishedTaskModal");
            openAdjustmentModal(id);
        });

        $("closeAdjustTaskButton").addEventListener("click", closeAdjustmentModal);

        $("addAdjustmentBindingButton").addEventListener(
            "click",
            addOrUpdateAdjustmentBinding
        );

        $("saveAdjustTaskButton").addEventListener(
            "click",
            saveAdjustmentChanges
        );

        $("historyDateFilter").addEventListener("change", renderHistoryTaskBoard);
        $("historyShiftFilter").addEventListener("change", renderHistoryTaskBoard);
        $("historyAreaFilter").addEventListener("input", renderHistoryTaskBoard);

        $("resetHistoryFilterButton").addEventListener("click", function () {
            $("historyDateFilter").value = "";
            $("historyShiftFilter").value = "";
            $("historyAreaFilter").value = "";
            renderHistoryTaskBoard();
        });

        $("closeHistoryTaskButton").addEventListener("click", function () {
            hide("historyTaskModal");
        });

        $("approveChangeButton").addEventListener("click", approveVehicleChange);
        $("rejectChangeButton").addEventListener("click", rejectVehicleChange);

        $("closeChangeApprovalButton").addEventListener("click", function () {
            selectedChangeRequestId = null;
            hide("changeApprovalModal");
        });

    }

    /* =====================================================
       创建生产任务
    ===================================================== */

    function generateTask() {

        const area = $("taskArea").value.trim();

        if (!area) {
            alert("请输入作业区域");
            return;
        }

        currentTask = {
            taskId: "TASK_" + Date.now(),
            date: new Date().toLocaleDateString("zh-CN"),
            shift: $("taskShift").value,
            area,
            remark: $("taskRemark").value.trim(),
            status: "configuring",
            createdAt: new Date().toISOString()
        };

        bindings = [];
        auxiliaryAssignments = [];
        selectedExcavatorId = null;
        selectedTruckIds = [];

        text("summaryDate", currentTask.date);
        text("summaryShift", currentTask.shift);
        text("summaryArea", currentTask.area);
        text("summaryRemark", currentTask.remark || "无");

        hide("taskCreateSection");

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
        ].forEach(show);

        renderConfiguration();
        scrollTo("excavatorSection");
    }

    function renderConfiguration() {
        renderExcavatorBoard();
        renderTruckBoard();
        renderBindings();

        renderAuxBoard("loader", "loaderBoard", "loaderCount");
        renderAuxBoard("water", "waterBoard", "waterCount");
        renderAuxBoard("fuel", "fuelBoard", "fuelCount");
        renderAuxBoard("grader", "graderBoard", "graderCount");
        renderAuxBoard("dozer", "dozerBoard", "dozerCount");
        renderAuxBoard("bus", "busBoard", "busCount");

        renderAuxAssignments();
    }

    function renderExcavatorBoard() {

        const board = $("excavatorBoard");
        const devices = equipment.filter(d => d.type === "excavator");

        text("excavatorCount", devices.length + " 台");
        board.innerHTML = "";

        devices.forEach(device => {

            const state = getDraftState(device);
            const card = createDeviceCard(device, state);

            if (selectedExcavatorId === device.id) {
                card.classList.add("selected-device");
            }

            card.addEventListener("click", function () {

                if (device.status === "maintenance") {
                    showMaintenance(device);
                    return;
                }

                if (device.status === "assigned") {
                    showAssigned(device);
                    return;
                }

                if (isInDraft(device.id)) {
                    alert(device.id + " 已经加入当前任务");
                    return;
                }

                selectedExcavatorId = device.id;
                selectedTruckIds = [];

                renderExcavatorBoard();
                renderTruckBoard();
            });

            board.appendChild(card);
        });
    }

    function renderTruckBoard() {

        const board = $("truckBoard");
        const devices = equipment.filter(d => d.type === "truck");

        text("truckCount", devices.length + " 台");
        board.innerHTML = "";

        devices.forEach(device => {

            const state = getDraftState(device);
            const card = createDeviceCard(device, state);

            if (selectedTruckIds.includes(device.id)) {
                card.classList.add("selected-device");
            }

            card.addEventListener("click", function () {

                if (!selectedExcavatorId) {
                    alert("请先选择挖机");
                    return;
                }

                if (device.status === "maintenance") {
                    showMaintenance(device);
                    return;
                }

                if (device.status === "assigned") {
                    showAssigned(device);
                    return;
                }

                if (isInDraft(device.id)) {
                    alert(device.id + " 已经加入当前任务");
                    return;
                }

                toggle(selectedTruckIds, device.id);
                renderTruckBoard();
            });

            board.appendChild(card);
        });

        if (!selectedExcavatorId) {
            text("selectedExcavatorInfo", "当前未选择挖机");
            hide("bindTrucksButton");
        } else {
            $("selectedExcavatorInfo").innerHTML =
                "当前挖机：<strong>" +
                escapeHtml(selectedExcavatorId) +
                "</strong> ｜ 已选择 <strong>" +
                selectedTruckIds.length +
                "</strong> 台卡车";

            show("bindTrucksButton");

            $("bindTrucksButton").textContent =
                "绑定所选卡车（" + selectedTruckIds.length + "台）";
        }
    }

    function bindSelectedTrucks() {

        if (!selectedExcavatorId) {
            alert("请先选择挖机");
            return;
        }

        if (!selectedTruckIds.length) {
            alert("请选择至少一台卡车");
            return;
        }

        bindings.push({
            excavatorId: selectedExcavatorId,
            truckIds: [...selectedTruckIds]
        });

        selectedExcavatorId = null;
        selectedTruckIds = [];

        renderConfiguration();
    }

    function renderBindings() {

        const box = $("bindingList");

        if (!bindings.length) {
            box.innerHTML = '<div class="empty-placeholder">暂无绑定关系</div>';
            return;
        }

        box.innerHTML = bindings.map(binding => `
            <div class="binding-card">
                <strong>🚜 ${escapeHtml(binding.excavatorId)}</strong>

                <div class="mini-device-list">
                    ${(binding.truckIds || [])
                        .map(id => `<span>🚚 ${escapeHtml(id)}</span>`)
                        .join("")}
                </div>
            </div>
        `).join("");
    }

    /* =====================================================
       辅助车辆
    ===================================================== */

    function renderAuxBoard(type, boardId, countId) {

        const board = $(boardId);
        const devices = equipment.filter(d => d.type === type);

        text(countId, devices.length + " 台");
        board.innerHTML = "";

        devices.forEach(device => {

            const state = getDraftState(device);
            const card = createDeviceCard(device, state);

            card.addEventListener("click", function () {

                if (device.status === "maintenance") {
                    showMaintenance(device);
                    return;
                }

                if (device.status === "assigned") {
                    showAssigned(device);
                    return;
                }

                if (isInDraft(device.id)) {
                    alert(device.id + " 已经加入当前任务");
                    return;
                }

                selectedAuxDeviceId = device.id;

                text(
                    "auxSelectedVehicle",
                    getTypeName(device.type) + " · " + device.id
                );

                text(
                    "auxTaskModalTitle",
                    "配置" + getTypeName(device.type) + "任务"
                );

                const select = $("auxWorkType");
                select.innerHTML = "";

                getWorkOptions(device.type).forEach(optionData => {
                    const option = document.createElement("option");
                    option.value = optionData.value;
                    option.textContent = optionData.label;
                    select.appendChild(option);
                });

                hide("auxManualWorkBox");
                $("auxManualWork").value = "";
                $("auxTaskRemark").value = "";

                show("auxTaskModal");
            });

            board.appendChild(card);
        });
    }

    function saveAuxiliaryAssignment() {

        if (!selectedAuxDeviceId || !currentTask) return;

        const device = findDevice(selectedAuxDeviceId);
        if (!device) return;

        let work = $("auxWorkType").value;

        if (work === "manual") {
            work = $("auxManualWork").value.trim();

            if (!work) {
                alert("请输入工作内容");
                return;
            }
        }

        auxiliaryAssignments.push({
            assignmentId: "AUX_" + Date.now(),
            vehicleId: device.id,
            type: device.type,
            typeName: getTypeName(device.type),
            work,
            remark: $("auxTaskRemark").value.trim(),
            assignedAt: new Date().toISOString()
        });

        selectedAuxDeviceId = null;
        hide("auxTaskModal");
        renderConfiguration();
    }

    function renderAuxAssignments() {

        const box = $("auxiliaryAssignmentList");

        if (!auxiliaryAssignments.length) {
            box.innerHTML =
                '<div class="empty-placeholder">暂未配置辅助车辆</div>';
            return;
        }

        box.innerHTML = auxiliaryAssignments.map(item => `
            <div class="aux-assignment-card">
                <strong>
                    ${escapeHtml(item.typeName)} ·
                    ${escapeHtml(item.vehicleId)}
                </strong>
                <span>${escapeHtml(item.work)}</span>
            </div>
        `).join("");
    }

    /* =====================================================
       发布
    ===================================================== */

    function renderTaskPreview() {

        let html = `
            <div class="preview-header">
                <strong>${escapeHtml(currentTask.area)}</strong>
                <span>
                    ${escapeHtml(currentTask.date)} ·
                    ${escapeHtml(currentTask.shift)}
                </span>
            </div>

            <div class="published-detail-block">
                <h4>🚜 主采设备</h4>
                ${renderBindingsHtml(bindings)}
            </div>

            <div class="published-detail-block">
                <h4>🚧 辅助车辆</h4>
                ${renderAuxHtml(auxiliaryAssignments)}
            </div>
        `;

        $("taskPreviewContent").innerHTML = html;
    }

    function publishTask() {

        if (!currentTask) return;

        if (!bindings.length && !auxiliaryAssignments.length) {
            alert("请至少配置一组主采设备或一台辅助设备");
            return;
        }

        const conflict = validateDraftConflict();

        if (conflict) {
            alert(conflict);
            return;
        }

        if (!confirm("确认发布生产任务吗？")) return;

        const task = {
            ...currentTask,
            status: "pending",
            publishedAt: new Date().toISOString(),
            bindings: clone(bindings),
            auxiliaryAssignments: clone(auxiliaryAssignments),

            driverAssignments: [],

            equipmentAdjustments: [],
            vehicleChangeHistory: [],

            transportTripCount: 0
        };

        const tasks = getTasks();
        tasks.push(task);

        saveTasks(tasks);

        localStorage.setItem(
            LATEST_KEY,
            JSON.stringify(task)
        );

        currentTask = null;
        bindings = [];
        auxiliaryAssignments = [];
        selectedExcavatorId = null;
        selectedTruckIds = [];

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
        ].forEach(hide);

        rebuildEquipmentStatus();
        renderProductionTaskBoard();

        alert("任务发布成功。下一步请点击任务，为每台卡车分配司机。");

        scrollTo("productionTaskBoardSection");
    }

    /* =====================================================
       生产任务看板
    ===================================================== */

    function renderProductionTaskBoard() {

        syncTaskStatusFromTrips();

        const tasks = getTasks()
            .filter(task =>
                task.status === "pending" ||
                task.status === "active"
            )
            .sort(sortNewest);

        text(
            "productionTaskCount",
            tasks.length + " 个进行中任务"
        );

        const board = $("productionTaskBoard");

        if (!tasks.length) {
            board.innerHTML =
                '<div class="empty-placeholder">当前没有进行中的生产任务</div>';
            return;
        }

        board.innerHTML = "";

        tasks.forEach(task => {

            const trips = getTaskTripRecords(task.taskId);
            const trucks = getTaskTruckIds(task);
            const assignedDrivers =
                getActiveDriverAssignments(task).length;

            const card = document.createElement("button");

            card.type = "button";

            card.className =
                "production-task-card " +
                (task.status === "pending"
                    ? "task-pending-card"
                    : "task-active-card");

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
                        ${task.status === "pending" ? "待执行" : "执行中"}
                    </span>
                </div>

                <div class="production-task-date">
                    ${escapeHtml(task.date)}
                </div>

                <div class="production-task-stat-grid">
                    <div><span>挖机</span><strong>${(task.bindings || []).length}</strong></div>
                    <div><span>卡车</span><strong>${trucks.length}</strong></div>
                    <div><span>已分司机</span><strong>${assignedDrivers}</strong></div>
                    <div><span>运输趟数</span><strong>${trips.length}</strong></div>
                </div>

                <div class="production-task-time">
                    发布时间：${format(task.publishedAt)}
                </div>
            `;

            card.addEventListener("click", function () {
                openPublishedTask(task.taskId);
            });

            board.appendChild(card);
        });
    }

    function openPublishedTask(taskId) {

        syncTaskStatusFromTrips();

        const task = getTask(taskId);

        if (!task) return;

        selectedPublishedTaskId = taskId;

        text(
            "publishedTaskModalTitle",
            task.area + " · " + task.shift
        );

        $("publishedTaskModalContent").innerHTML =
            renderTaskDetail(task, false);

        hide("withdrawPublishedTaskButton");
        hide("completePublishedTaskButton");

        show("assignDriversButton");
        show("adjustTaskButton");

        if (
            task.status === "pending" &&
            getTaskTripRecords(task.taskId).length === 0
        ) {
            show("withdrawPublishedTaskButton");
        }

        if (
            task.status === "active" &&
            getTaskTripRecords(task.taskId).length > 0
        ) {
            show("completePublishedTaskButton");
        }

        show("publishedTaskModal");
    }

    function closePublishedTask() {
        selectedPublishedTaskId = null;
        hide("publishedTaskModal");
    }

    /* =====================================================
       调度分司机
    ===================================================== */

    function openDriverAssignModal() {

        if (!selectedPublishedTaskId) return;

        const task = getTask(selectedPublishedTaskId);

        if (!task) return;

        const drivers = getApprovedDrivers();
        const truckRows = getTaskTruckRows(task);

        text(
            "driverAssignModalTitle",
            "分配司机 · " + task.area
        );

        if (!truckRows.length) {
            $("driverAssignContent").innerHTML =
                '<div class="empty-placeholder">该任务没有卡车</div>';

            show("driverAssignModal");
            return;
        }

        let html = "";

        if (!drivers.length) {
            html += `
                <div class="warning-box">
                    当前浏览器没有可用的“已审核司机”资料。
                    请先在管理员端审核司机。
                </div>
            `;
        }

        truckRows.forEach(row => {

            const current =
                findCurrentDriverAssignment(task, row.truckId);

            html += `
                <div class="driver-assign-row">
                    <div>
                        <strong>🚚 ${escapeHtml(row.truckId)}</strong>
                        <span>跟随：${escapeHtml(row.excavatorId)}</span>
                    </div>

                    <select
                        class="driver-select"
                        data-truck="${escapeHtml(row.truckId)}"
                        data-excavator="${escapeHtml(row.excavatorId)}"
                    >
                        <option value="">未分配司机</option>

                        ${drivers.map(driver => `
                            <option
                                value="${escapeHtml(driver.driverId)}"
                                ${current && current.driverId === driver.driverId ? "selected" : ""}
                            >
                                ${escapeHtml(driver.name)}
                                ${driver.team ? " · " + escapeHtml(driver.team) : ""}
                            </option>
                        `).join("")}
                    </select>

                    ${current ? `
                        <small>
                            当前：${escapeHtml(current.driverName)}
                            · ${assignmentStatusText(current.status)}
                        </small>
                    ` : ""}
                </div>
            `;
        });

        $("driverAssignContent").innerHTML = html;

        show("driverAssignModal");
    }

    function saveDriverAssignments() {

        if (!selectedPublishedTaskId) return;

        const tasks = getTasks();
        const task = tasks.find(
            t => t.taskId === selectedPublishedTaskId
        );

        if (!task) return;

        if (!Array.isArray(task.driverAssignments)) {
            task.driverAssignments = [];
        }

        const selects = [
            ...document.querySelectorAll(".driver-select")
        ];

        const selectedDriverIds = [];

        for (const select of selects) {
            if (!select.value) continue;

            if (selectedDriverIds.includes(select.value)) {
                alert("同一个司机不能同时分配两台卡车。");
                return;
            }

            selectedDriverIds.push(select.value);
        }

        const approvedDrivers = getApprovedDrivers();

        selects.forEach(select => {

            const truckId = select.dataset.truck;
            const excavatorId = select.dataset.excavator;
            const driverId = select.value;

            const old =
                findCurrentDriverAssignment(task, truckId);

            if (!driverId) {

                if (old) {
                    old.status = "ended";
                    old.endedAt = new Date().toISOString();
                }

                return;
            }

            if (old && old.driverId === driverId) {
                return;
            }

            if (old) {
                old.status = "ended";
                old.endedAt = new Date().toISOString();
            }

            const driver = approvedDrivers.find(
                item => item.driverId === driverId
            );

            if (!driver) return;

            task.driverAssignments.push({
                assignmentId: "DA_" + Date.now() + "_" + truckId,
                driverId: driver.driverId,
                driverName: driver.name,
                truckId,
                excavatorId,
                status: "assigned",
                assignedAt: new Date().toISOString()
            });
        });

        saveTasks(tasks);

        hide("driverAssignModal");

        renderProductionTaskBoard();
        openPublishedTask(task.taskId);

        alert("司机分车结果已保存。司机端现在可以领取被分配车辆。");
    }

    /* =====================================================
       换车申请审批
    ===================================================== */

    function renderChangeRequestBoard() {

        const requests = getChangeRequests()
            .filter(r => r.status === "pending")
            .sort((a, b) =>
                new Date(b.requestedAt) -
                new Date(a.requestedAt)
            );

        text(
            "changeRequestCount",
            requests.length + " 个待审批"
        );

        const board = $("changeRequestBoard");

        if (!requests.length) {
            board.innerHTML =
                '<div class="empty-placeholder">当前没有待审批的换车申请</div>';
            return;
        }

        board.innerHTML = "";

        requests.forEach(request => {

            const card = document.createElement("button");

            card.type = "button";
            card.className = "change-request-card";

            card.innerHTML = `
                <div>
                    <strong>🚨 ${escapeHtml(request.driverName)}</strong>
                    <span>${escapeHtml(request.oldVehicleId)} 车辆故障</span>
                </div>

                <div>
                    <span>${escapeHtml(request.area || "-")}</span>
                    <strong>${format(request.requestedAt)}</strong>
                </div>
            `;

            card.addEventListener("click", function () {
                openChangeApproval(request.requestId);
            });

            board.appendChild(card);
        });
    }

    function openChangeApproval(requestId) {

        const request = getChangeRequests().find(
            r => r.requestId === requestId
        );

        if (!request) return;

        selectedChangeRequestId = requestId;

        $("changeApprovalContent").innerHTML = `
            ${detailRow("司机", request.driverName)}
            ${detailRow("当前车辆", request.oldVehicleId)}
            ${detailRow("跟随挖机", request.excavatorId)}
            ${detailRow("作业区域", request.area)}
            ${detailRow("故障原因", request.reason)}
            ${detailRow("申请时间", format(request.requestedAt))}
        `;

        const select = $("newVehicleSelect");
        select.innerHTML =
            '<option value="">请选择新车辆</option>';

        getAvailableReplacementTrucks(request).forEach(device => {
            const option = document.createElement("option");
            option.value = device.id;
            option.textContent = device.id;
            select.appendChild(option);
        });

        show("changeApprovalModal");
    }

    function approveVehicleChange() {

        if (!selectedChangeRequestId) return;

        const newVehicleId =
            $("newVehicleSelect").value;

        if (!newVehicleId) {
            alert("请选择批准的新车辆");
            return;
        }

        const requests = getChangeRequests();
        const request = requests.find(
            r => r.requestId === selectedChangeRequestId
        );

        if (!request || request.status !== "pending") {
            alert("该申请已经处理。");
            return;
        }

        if (
            !getAvailableReplacementTrucks(request)
                .some(d => d.id === newVehicleId)
        ) {
            alert("该车辆当前不可使用，请重新选择。");
            return;
        }

        const tasks = getTasks();

        const task = tasks.find(
            t => t.taskId === request.taskId
        );

        if (!task) {
            alert("找不到对应生产任务。");
            return;
        }

        const binding = (task.bindings || []).find(
            b => b.excavatorId === request.excavatorId
        );

        if (!binding) {
            alert("找不到原挖机绑定关系。");
            return;
        }

        const oldIndex =
            (binding.truckIds || []).indexOf(
                request.oldVehicleId
            );

        if (oldIndex >= 0) {
            binding.truckIds.splice(oldIndex, 1);
        }

        if (!binding.truckIds.includes(newVehicleId)) {
            binding.truckIds.push(newVehicleId);
        }

        if (!Array.isArray(task.driverAssignments)) {
            task.driverAssignments = [];
        }

        const oldAssignment =
            task.driverAssignments.find(a =>
                a.driverId === request.driverId &&
                a.truckId === request.oldVehicleId &&
                ["assigned", "claimed", "change_pending"].includes(a.status)
            );

        if (oldAssignment) {
            oldAssignment.status = "replaced";
            oldAssignment.endedAt = new Date().toISOString();
            oldAssignment.replacedBy = newVehicleId;
        }

        task.driverAssignments.push({
            assignmentId:
                "DA_CHANGE_" + Date.now(),

            driverId: request.driverId,
            driverName: request.driverName,

            truckId: newVehicleId,
            excavatorId: request.excavatorId,

            status: "claimed",

            assignedAt: new Date().toISOString(),
            claimedAt: new Date().toISOString(),

            source: "vehicle_change",
            replacedVehicleId: request.oldVehicleId
        });

        if (!Array.isArray(task.vehicleChangeHistory)) {
            task.vehicleChangeHistory = [];
        }

        const changeRecord = {
            changeId: "VCH_" + Date.now(),
            driverId: request.driverId,
            driverName: request.driverName,
            excavatorId: request.excavatorId,
            oldVehicleId: request.oldVehicleId,
            newVehicleId,
            reason: request.reason,
            requestedAt: request.requestedAt,
            approvedAt: new Date().toISOString()
        };

        task.vehicleChangeHistory.push(changeRecord);

        if (!Array.isArray(task.equipmentAdjustments)) {
            task.equipmentAdjustments = [];
        }

        task.equipmentAdjustments.push({
            adjustmentId: "ADJ_" + Date.now(),
            time: new Date().toISOString(),
            summary:
                request.driverName +
                " 因车辆故障由 " +
                request.oldVehicleId +
                " 更换为 " +
                newVehicleId
        });

        request.status = "approved";
        request.newVehicleId = newVehicleId;
        request.approvedAt = new Date().toISOString();

        addFaultVehicle({
            vehicleId: request.oldVehicleId,
            driverId: request.driverId,
            reason: request.reason,
            taskId: request.taskId
        });

        saveTasks(tasks);
        saveChangeRequests(requests);

        selectedChangeRequestId = null;

        hide("changeApprovalModal");

        rebuildEquipmentStatus();

        renderChangeRequestBoard();
        renderProductionTaskBoard();

        alert(
            "换车已批准。\n" +
            request.oldVehicleId +
            " → " +
            newVehicleId +
            "\n司机可继续原任务计趟。"
        );
    }

    function rejectVehicleChange() {

        if (!selectedChangeRequestId) return;

        if (!confirm("确认拒绝本次换车申请吗？")) return;

        const requests = getChangeRequests();
        const request = requests.find(
            r => r.requestId === selectedChangeRequestId
        );

        if (!request || request.status !== "pending") return;

        request.status = "rejected";
        request.rejectedAt = new Date().toISOString();

        const tasks = getTasks();
        const task = tasks.find(
            t => t.taskId === request.taskId
        );

        if (task && Array.isArray(task.driverAssignments)) {

            const assignment =
                task.driverAssignments.find(a =>
                    a.driverId === request.driverId &&
                    a.truckId === request.oldVehicleId &&
                    a.status === "change_pending"
                );

            if (assignment) {
                assignment.status = "claimed";
            }
        }

        saveTasks(tasks);
        saveChangeRequests(requests);

        selectedChangeRequestId = null;

        hide("changeApprovalModal");

        renderChangeRequestBoard();

        alert("换车申请已拒绝。司机只能继续使用原调度车辆。");
    }

    function getAvailableReplacementTrucks(request) {

        const used = new Set();

        getTasks()
            .filter(task =>
                task.status === "pending" ||
                task.status === "active"
            )
            .forEach(task => {

                (task.bindings || []).forEach(binding => {
                    (binding.truckIds || []).forEach(id => used.add(id));
                });
            });

        const faults = new Set(
            getFaultVehicles()
                .filter(item => item.active !== false)
                .map(item => item.vehicleId)
        );

        return equipment.filter(device =>
            device.type === "truck" &&
            device.baseStatus !== "maintenance" &&
            !used.has(device.id) &&
            !faults.has(device.id)
        );
    }

    /* =====================================================
       撤回/完成
    ===================================================== */

    function withdrawTask() {

        if (!selectedPublishedTaskId) return;

        const trips =
            getTaskTripRecords(selectedPublishedTaskId);

        if (trips.length) {
            alert("已经产生运输记录，不能撤回。");
            return;
        }

        if (!confirm("确认撤回并删除任务吗？")) return;

        let tasks = getTasks();

        tasks = tasks.filter(
            task => task.taskId !== selectedPublishedTaskId
        );

        saveTasks(tasks);

        try {
            const latest =
                JSON.parse(localStorage.getItem(LATEST_KEY) || "null");

            if (
                latest &&
                latest.taskId === selectedPublishedTaskId
            ) {
                localStorage.removeItem(LATEST_KEY);
            }
        } catch (error) {}

        selectedPublishedTaskId = null;

        hide("publishedTaskModal");

        rebuildEquipmentStatus();
        renderProductionTaskBoard();

        alert("任务已删除。");
    }

    function completeTask() {

        if (!selectedPublishedTaskId) return;

        const tasks = getTasks();
        const task = tasks.find(
            t => t.taskId === selectedPublishedTaskId
        );

        if (!task) return;

        const trips =
            getTaskTripRecords(task.taskId);

        if (!trips.length) {
            alert("任务还没有运输记录。");
            return;
        }

        if (task.status !== "active") {
            alert("只有执行中任务才能完成。");
            return;
        }

        if (!confirm("确认完成任务并进入历史任务吗？")) {
            return;
        }

        task.status = "completed";
        task.completedAt = new Date().toISOString();
        task.transportTripCount = trips.length;

        if (Array.isArray(task.driverAssignments)) {
            task.driverAssignments.forEach(a => {
                if (
                    ["assigned", "claimed", "change_pending"].includes(a.status)
                ) {
                    a.status = "ended";
                    a.endedAt = new Date().toISOString();
                }
            });
        }

        saveTasks(tasks);

        selectedPublishedTaskId = null;

        hide("publishedTaskModal");

        rebuildEquipmentStatus();
        renderProductionTaskBoard();
        renderHistoryTaskBoard();

        alert("任务已完成。");
    }

    /* =====================================================
       设备调整
    ===================================================== */

    function openAdjustmentModal(taskId) {

        const task = getTask(taskId);

        if (!task) return;

        adjustmentTaskId = taskId;
        adjustmentOriginalBindings =
            normalizeBindings(task.bindings || []);

        adjustmentDraftBindings =
            clone(adjustmentOriginalBindings);

        adjustmentSelectedExcavatorId = null;
        adjustmentSelectedTruckIds = [];
        adjustmentEditingExcavatorId = null;

        text(
            "adjustTaskModalTitle",
            "调整设备 · " + task.area
        );

        renderAdjustmentUI();

        show("adjustTaskModal");
    }

    function closeAdjustmentModal() {
        adjustmentTaskId = null;
        adjustmentOriginalBindings = [];
        adjustmentDraftBindings = [];
        adjustmentSelectedExcavatorId = null;
        adjustmentSelectedTruckIds = [];
        adjustmentEditingExcavatorId = null;

        hide("adjustTaskModal");
    }

    function renderAdjustmentUI() {
        renderAdjustmentCurrent();
        renderAdjustmentExcavators();
        renderAdjustmentTrucks();

        const changed =
            JSON.stringify(normalizeBindings(adjustmentOriginalBindings)) !==
            JSON.stringify(normalizeBindings(adjustmentDraftBindings));

        $("saveAdjustTaskButton").disabled = !changed;
        $("saveAdjustTaskButton").textContent =
            changed ? "保存本次设备调整" : "暂无修改";
    }

    function renderAdjustmentCurrent() {

        const box = $("adjustCurrentBindings");

        if (!adjustmentDraftBindings.length) {
            box.innerHTML =
                '<div class="empty-placeholder">当前没有挖机配置</div>';
            return;
        }

        box.innerHTML = "";

        adjustmentDraftBindings.forEach(binding => {

            const card = document.createElement("div");

            card.className = "adjust-binding-card";

            card.innerHTML = `
                <div>
                    <strong>🚜 ${escapeHtml(binding.excavatorId)}</strong>

                    <div class="mini-device-list">
                        ${(binding.truckIds || [])
                            .map(id => `<span>🚚 ${escapeHtml(id)}</span>`)
                            .join("") || "<span>暂无卡车</span>"}
                    </div>
                </div>

                <div class="adjust-row-buttons">
                    <button type="button" class="adjust-edit-button">
                        调整卡车
                    </button>

                    <button type="button" class="adjust-remove-button">
                        减少挖机
                    </button>
                </div>
            `;

            card.querySelector(".adjust-edit-button")
                .addEventListener("click", function () {

                    adjustmentEditingExcavatorId =
                        binding.excavatorId;

                    adjustmentSelectedExcavatorId =
                        binding.excavatorId;

                    adjustmentSelectedTruckIds =
                        [...(binding.truckIds || [])];

                    text(
                        "adjustSelectionInfo",
                        "正在调整 " +
                        binding.excavatorId +
                        " 的卡车"
                    );

                    $("addAdjustmentBindingButton").textContent =
                        "保存该挖机卡车调整";

                    renderAdjustmentUI();
                });

            card.querySelector(".adjust-remove-button")
                .addEventListener("click", function () {

                    if (
                        !confirm(
                            "确认减少挖机 " +
                            binding.excavatorId +
                            " 吗？"
                        )
                    ) return;

                    adjustmentDraftBindings =
                        adjustmentDraftBindings.filter(
                            item =>
                                item.excavatorId !==
                                binding.excavatorId
                        );

                    adjustmentEditingExcavatorId = null;
                    adjustmentSelectedExcavatorId = null;
                    adjustmentSelectedTruckIds = [];

                    renderAdjustmentUI();
                });

            box.appendChild(card);
        });
    }

    function renderAdjustmentExcavators() {

        const board = $("adjustExcavatorBoard");
        board.innerHTML = "";

        const usedElsewhere =
            getUsedEquipmentExceptTask(adjustmentTaskId);

        equipment
            .filter(d => d.type === "excavator")
            .forEach(device => {

                const already =
                    adjustmentDraftBindings.some(
                        b => b.excavatorId === device.id
                    );

                const blocked =
                    device.baseStatus === "maintenance" ||
                    usedElsewhere.has(device.id) ||
                    (
                        already &&
                        adjustmentEditingExcavatorId !== device.id
                    );

                const button = document.createElement("button");

                button.type = "button";
                button.className = "adjust-device-button";

                if (blocked) button.classList.add("blocked");

                if (
                    adjustmentSelectedExcavatorId === device.id
                ) {
                    button.classList.add("selected");
                }

                let status = "可增加";

                if (device.baseStatus === "maintenance") {
                    status = "维修中";
                } else if (usedElsewhere.has(device.id)) {
                    status = "其他任务占用";
                } else if (already) {
                    status = "已在本任务";
                }

                button.innerHTML = `
                    <strong>${device.id}</strong>
                    <span>${status}</span>
                `;

                button.addEventListener("click", function () {

                    if (blocked) return;

                    adjustmentSelectedExcavatorId = device.id;
                    adjustmentSelectedTruckIds = [];

                    text(
                        "adjustSelectionInfo",
                        "已选择 " + device.id
                    );

                    renderAdjustmentUI();
                });

                board.appendChild(button);
            });
    }

    function renderAdjustmentTrucks() {

        const board = $("adjustTruckBoard");
        board.innerHTML = "";

        const usedElsewhere =
            getUsedEquipmentExceptTask(adjustmentTaskId);

        const usedInOtherBindings = new Set();

        adjustmentDraftBindings.forEach(binding => {

            if (
                binding.excavatorId !==
                adjustmentEditingExcavatorId
            ) {
                (binding.truckIds || [])
                    .forEach(id =>
                        usedInOtherBindings.add(id)
                    );
            }
        });

        equipment
            .filter(d => d.type === "truck")
            .forEach(device => {

                const selected =
                    adjustmentSelectedTruckIds.includes(device.id);

                const blocked =
                    !adjustmentSelectedExcavatorId ||
                    device.baseStatus === "maintenance" ||
                    usedElsewhere.has(device.id) ||
                    usedInOtherBindings.has(device.id) ||
                    isFaultVehicle(device.id);

                const button = document.createElement("button");

                button.type = "button";
                button.className = "adjust-device-button";

                if (blocked) button.classList.add("blocked");
                if (selected) button.classList.add("selected");

                button.innerHTML = `
                    <strong>${device.id}</strong>
                    <span>
                        ${selected ? "✓ 已选择" : blocked ? "不可用" : "可选择"}
                    </span>
                `;

                button.addEventListener("click", function () {

                    if (blocked) return;

                    toggle(
                        adjustmentSelectedTruckIds,
                        device.id
                    );

                    renderAdjustmentTrucks();
                });

                board.appendChild(button);
            });

        text(
            "adjustTruckSelectionCount",
            "已选择 " +
            adjustmentSelectedTruckIds.length +
            " 台卡车"
        );
    }

    function addOrUpdateAdjustmentBinding() {

        if (!adjustmentSelectedExcavatorId) {
            alert("请先选择挖机");
            return;
        }

        if (!adjustmentSelectedTruckIds.length) {
            alert("至少选择一台卡车");
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

            adjustmentDraftBindings.push({
                excavatorId: adjustmentSelectedExcavatorId,
                truckIds: [...adjustmentSelectedTruckIds]
            });
        }

        adjustmentEditingExcavatorId = null;
        adjustmentSelectedExcavatorId = null;
        adjustmentSelectedTruckIds = [];

        $("addAdjustmentBindingButton").textContent =
            "加入本任务";

        renderAdjustmentUI();
    }

    function saveAdjustmentChanges() {

        const tasks = getTasks();
        const task = tasks.find(
            t => t.taskId === adjustmentTaskId
        );

        if (!task) return;

        const before =
            normalizeBindings(adjustmentOriginalBindings);

        const after =
            normalizeBindings(adjustmentDraftBindings);

        if (
            JSON.stringify(before) ===
            JSON.stringify(after)
        ) {
            alert("设备没有变化");
            return;
        }

        const used =
            getUsedEquipmentExceptTask(task.taskId);

        for (const binding of after) {

            if (used.has(binding.excavatorId)) {
                alert(binding.excavatorId + " 已被其他任务占用");
                return;
            }

            for (const truckId of binding.truckIds) {

                if (used.has(truckId)) {
                    alert(truckId + " 已被其他任务占用");
                    return;
                }

                if (isFaultVehicle(truckId)) {
                    alert(truckId + " 当前为故障车辆");
                    return;
                }
            }
        }

        if (!confirm("确认保存设备调整吗？")) return;

        const oldTruckIds =
            new Set(getTaskTruckIds(task));

        const newTruckIds =
            new Set(
                after.flatMap(
                    binding => binding.truckIds || []
                )
            );

        if (!Array.isArray(task.driverAssignments)) {
            task.driverAssignments = [];
        }

        task.driverAssignments.forEach(assignment => {

            if (
                ["assigned", "claimed", "change_pending"].includes(
                    assignment.status
                ) &&
                !newTruckIds.has(assignment.truckId)
            ) {
                assignment.status = "ended";
                assignment.endedAt = new Date().toISOString();
            }
        });

        task.bindings = clone(after);

        if (!Array.isArray(task.equipmentAdjustments)) {
            task.equipmentAdjustments = [];
        }

        task.equipmentAdjustments.push({
            adjustmentId: "ADJ_" + Date.now(),
            time: new Date().toISOString(),
            summary: buildAdjustmentSummary(before, after)
        });

        saveTasks(tasks);

        closeAdjustmentModal();

        rebuildEquipmentStatus();

        renderProductionTaskBoard();

        selectedPublishedTaskId = task.taskId;

        openPublishedTask(task.taskId);

        alert("设备调整已保存。新增卡车需要重新分配司机。");
    }

    /* =====================================================
       历史
    ===================================================== */

    function toggleHistory() {

        const section = $("historyTaskSection");

        if (section.classList.contains("hidden")) {
            renderHistoryTaskBoard();
            show("historyTaskSection");

            $("historyTaskButton").textContent =
                "📚 收起历史任务";

            scrollTo("historyTaskSection");
        } else {
            hide("historyTaskSection");

            $("historyTaskButton").textContent =
                "📚 历史任务";
        }
    }

    function renderHistoryTaskBoard() {

        const date = $("historyDateFilter").value;
        const shift = $("historyShiftFilter").value;
        const area = $("historyAreaFilter").value
            .trim()
            .toLowerCase();

        let tasks = getTasks()
            .filter(task => task.status === "completed");

        tasks = tasks.filter(task => {

            if (
                date &&
                taskDateValue(task) !== date
            ) return false;

            if (
                shift &&
                task.shift !== shift
            ) return false;

            if (
                area &&
                !String(task.area || "")
                    .toLowerCase()
                    .includes(area)
            ) return false;

            return true;
        });

        tasks.sort((a, b) =>
            new Date(b.completedAt) -
            new Date(a.completedAt)
        );

        text(
            "historyTaskCount",
            tasks.length + " 个已完成任务"
        );

        const board = $("historyTaskBoard");

        if (!tasks.length) {
            board.innerHTML =
                '<div class="empty-placeholder">没有符合条件的已完成任务</div>';
            return;
        }

        board.innerHTML = "";

        tasks.forEach(task => {

            const card = document.createElement("button");
            card.type = "button";
            card.className =
                "production-task-card history-task-card";

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
                        已完成
                    </span>
                </div>

                <div class="production-task-stat-grid">
                    <div>
                        <span>挖机</span>
                        <strong>${(task.bindings || []).length}</strong>
                    </div>

                    <div>
                        <span>卡车</span>
                        <strong>${getTaskTruckIds(task).length}</strong>
                    </div>

                    <div>
                        <span>换车</span>
                        <strong>${(task.vehicleChangeHistory || []).length}</strong>
                    </div>

                    <div>
                        <span>运输趟数</span>
                        <strong>${task.transportTripCount || 0}</strong>
                    </div>
                </div>

                <div class="production-task-time">
                    完成时间：${format(task.completedAt)}
                </div>
            `;

            card.addEventListener("click", function () {

                text(
                    "historyTaskModalTitle",
                    "历史任务 · " +
                    task.area +
                    " · " +
                    task.shift
                );

                $("historyTaskModalContent").innerHTML =
                    renderTaskDetail(task, true);

                show("historyTaskModal");
            });

            board.appendChild(card);
        });
    }

    /* =====================================================
       任务详情
    ===================================================== */

    function renderTaskDetail(task, history) {

        const trips =
            getTaskTripRecords(task.taskId);

        const assignments =
            task.driverAssignments || [];

        let html = `
            ${detailRow("任务编号", task.taskId)}
            ${detailRow("日期", task.date)}
            ${detailRow("班次", task.shift)}
            ${detailRow("作业区域", task.area)}
            ${detailRow("运输总趟数", String(Math.max(
                trips.length,
                Number(task.transportTripCount || 0)
            )))}

            <div class="published-detail-block">
                <h4>🚜 挖机及卡车</h4>
                ${renderBindingsHtml(task.bindings || [], task.taskId)}
            </div>

            <div class="published-detail-block">
                <h4>👤 司机分车</h4>
        `;

        const activeAssignments =
            assignments.filter(a =>
                a.status !== "ended" &&
                a.status !== "replaced"
            );

        if (!activeAssignments.length) {
            html += "<p>暂未分配司机</p>";
        } else {
            activeAssignments.forEach(a => {
                html += `
                    <div class="driver-history-row">
                        <strong>${escapeHtml(a.driverName)}</strong>
                        <span>
                            🚚 ${escapeHtml(a.truckId)}
                            · 🚜 ${escapeHtml(a.excavatorId)}
                            · ${assignmentStatusText(a.status)}
                        </span>
                    </div>
                `;
            });
        }

        html += `
            </div>

            <div class="published-detail-block">
                <h4>🚧 辅助车辆</h4>
                ${renderAuxHtml(task.auxiliaryAssignments || [])}
            </div>
        `;

        if (
            Array.isArray(task.vehicleChangeHistory) &&
            task.vehicleChangeHistory.length
        ) {
            html += `
                <div class="published-detail-block">
                    <h4>🔧 司机换车记录</h4>
            `;

            task.vehicleChangeHistory.forEach(item => {
                html += `
                    <div class="change-history-row">
                        <strong>${escapeHtml(item.driverName)}</strong>
                        <span>
                            ${escapeHtml(item.oldVehicleId)}
                            →
                            ${escapeHtml(item.newVehicleId)}
                        </span>

                        <small>
                            ${escapeHtml(item.reason)}
                            · ${format(item.approvedAt)}
                        </small>
                    </div>
                `;
            });

            html += "</div>";
        }

        if (
            Array.isArray(task.equipmentAdjustments) &&
            task.equipmentAdjustments.length
        ) {
            html += `
                <div class="published-detail-block">
                    <h4>🔄 设备调整记录</h4>
            `;

            task.equipmentAdjustments.forEach(item => {
                html += `
                    <div class="adjustment-history-row">
                        <strong>${format(item.time)}</strong>
                        <span>${escapeHtml(item.summary)}</span>
                    </div>
                `;
            });

            html += "</div>";
        }

        if (history) {
            html += detailRow(
                "完成时间",
                format(task.completedAt)
            );
        }

        return html;
    }

    /* =====================================================
       状态和数据
    ===================================================== */

    function syncTaskStatusFromTrips() {

        const tasks = getTasks();
        let changed = false;

        tasks.forEach(task => {

            if (task.status !== "pending") return;

            const trips =
                getTaskTripRecords(task.taskId);

            if (trips.length) {
                task.status = "active";
                task.startedAt =
                    trips[0].completedAt ||
                    trips[0].createdAt ||
                    new Date().toISOString();

                task.transportTripCount =
                    trips.length;

                changed = true;
            }
        });

        if (changed) saveTasks(tasks);
    }

    function migrateOldActiveTasks() {

        const tasks = getTasks();
        let changed = false;

        tasks.forEach(task => {

            if (
                task.status === "active" &&
                !getTaskTripRecords(task.taskId).length
            ) {
                task.status = "pending";
                changed = true;
            }
        });

        if (changed) saveTasks(tasks);
    }

    function removeLegacyWithdrawnTasks() {

        const tasks = getTasks();

        const filtered =
            tasks.filter(
                task => task.status !== "withdrawn"
            );

        if (filtered.length !== tasks.length) {
            saveTasks(filtered);
        }
    }

    function rebuildEquipmentStatus() {

        const faultSet = new Set(
            getFaultVehicles()
                .filter(item => item.active !== false)
                .map(item => item.vehicleId)
        );

        equipment.forEach(device => {

            if (
                device.baseStatus === "maintenance" ||
                faultSet.has(device.id)
            ) {
                device.status = "maintenance";
            } else {
                device.status = "available";
                delete device.assignedTask;
            }
        });

        getTasks()
            .filter(task =>
                task.status === "pending" ||
                task.status === "active"
            )
            .forEach(task => {

                (task.bindings || []).forEach(binding => {

                    markAssigned(
                        binding.excavatorId,
                        task,
                        "采装作业"
                    );

                    (binding.truckIds || []).forEach(truckId => {
                        markAssigned(
                            truckId,
                            task,
                            "跟随 " + binding.excavatorId
                        );
                    });
                });

                (task.auxiliaryAssignments || []).forEach(item => {
                    markAssigned(
                        item.vehicleId,
                        task,
                        item.work
                    );
                });
            });
    }

    function markAssigned(deviceId, task, work) {

        const device = findDevice(deviceId);

        if (
            !device ||
            device.status === "maintenance"
        ) return;

        device.status = "assigned";

        device.assignedTask = {
            taskId: task.taskId,
            area: task.area,
            shift: task.shift,
            work
        };
    }

    /* =====================================================
       人员
    ===================================================== */

    function getApprovedDrivers() {

        const result = [];
        const map = new Map();

        try {

            const records =
                JSON.parse(
                    localStorage.getItem("personnelRecords") || "[]"
                );

            if (Array.isArray(records)) {

                records.forEach(record => {

                    if (
                        record &&
                        record.status === "approved" &&
                        (record.position === "卡车司机" || !record.position)
                    ) {
                        const id =
                            record.driverId ||
                            record.personnelId ||
                            record.id;

                        if (id) {
                            map.set(String(id), {
                                driverId: String(id),
                                name: record.name || "未命名司机",
                                team: record.team || ""
                            });
                        }
                    }
                });
            }

        } catch (error) {}

        try {

            const profile =
                JSON.parse(
                    localStorage.getItem("driverProfile") || "null"
                );

            if (
                profile &&
                profile.status === "approved"
            ) {
                const id =
                    profile.driverId ||
                    profile.personnelId ||
                    "DRIVER_PROFILE";

                map.set(String(id), {
                    driverId: String(id),
                    name: profile.name || "司机",
                    team: profile.team || ""
                });
            }

        } catch (error) {}

        map.forEach(item => result.push(item));

        return result.sort(
            (a, b) =>
                a.name.localeCompare(
                    b.name,
                    "zh-CN"
                )
        );
    }

    /* =====================================================
       工具
    ===================================================== */

    function getTasks() {
        try {
            const data =
                JSON.parse(
                    localStorage.getItem(TASK_KEY) || "[]"
                );
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function saveTasks(tasks) {
        localStorage.setItem(
            TASK_KEY,
            JSON.stringify(tasks)
        );
    }

    function getTask(taskId) {
        return getTasks().find(
            task => task.taskId === taskId
        );
    }

    function getChangeRequests() {
        try {
            const data =
                JSON.parse(
                    localStorage.getItem(CHANGE_KEY) || "[]"
                );
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function saveChangeRequests(data) {
        localStorage.setItem(
            CHANGE_KEY,
            JSON.stringify(data)
        );
    }

    function getFaultVehicles() {
        try {
            const data =
                JSON.parse(
                    localStorage.getItem(FAULT_KEY) || "[]"
                );
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function addFaultVehicle(data) {

        const list = getFaultVehicles();

        list.push({
            faultId: "FAULT_" + Date.now(),
            vehicleId: data.vehicleId,
            driverId: data.driverId,
            taskId: data.taskId,
            reason: data.reason,
            active: true,
            createdAt: new Date().toISOString()
        });

        localStorage.setItem(
            FAULT_KEY,
            JSON.stringify(list)
        );
    }

    function isFaultVehicle(vehicleId) {
        return getFaultVehicles().some(
            item =>
                item.vehicleId === vehicleId &&
                item.active !== false
        );
    }

    function getTaskTripRecords(taskId) {

        try {

            const data =
                JSON.parse(
                    localStorage.getItem(TRIP_KEY) || "[]"
                );

            if (!Array.isArray(data)) return [];

            return data.filter(record => {

                const id =
                    record.taskId ||
                    record.dispatchTaskId ||
                    (
                        record.task &&
                        record.task.taskId
                    );

                return String(id) === String(taskId);
            });

        } catch (error) {
            return [];
        }
    }

    function getTaskTruckRows(task) {

        const rows = [];

        (task.bindings || []).forEach(binding => {

            (binding.truckIds || []).forEach(truckId => {
                rows.push({
                    truckId,
                    excavatorId: binding.excavatorId
                });
            });
        });

        return rows;
    }

    function getTaskTruckIds(task) {
        return getTaskTruckRows(task).map(
            row => row.truckId
        );
    }

    function getActiveDriverAssignments(task) {

        return (task.driverAssignments || [])
            .filter(a =>
                ["assigned", "claimed", "change_pending"]
                    .includes(a.status)
            );
    }

    function findCurrentDriverAssignment(task, truckId) {

        return [...(task.driverAssignments || [])]
            .reverse()
            .find(a =>
                a.truckId === truckId &&
                ["assigned", "claimed", "change_pending"]
                    .includes(a.status)
            );
    }

    function getUsedEquipmentExceptTask(excludedTaskId) {

        const used = new Set();

        getTasks()
            .filter(task =>
                (
                    task.status === "pending" ||
                    task.status === "active"
                ) &&
                task.taskId !== excludedTaskId
            )
            .forEach(task => {

                (task.bindings || []).forEach(binding => {

                    used.add(binding.excavatorId);

                    (binding.truckIds || [])
                        .forEach(id => used.add(id));
                });

                (task.auxiliaryAssignments || [])
                    .forEach(item =>
                        used.add(item.vehicleId)
                    );
            });

        return used;
    }

    function validateDraftConflict() {

        const occupied =
            getUsedEquipmentExceptTask(null);

        const used = new Set();

        for (const binding of bindings) {

            const ids = [
                binding.excavatorId,
                ...(binding.truckIds || [])
            ];

            for (const id of ids) {

                if (occupied.has(id)) {
                    return id + " 已被其他任务占用";
                }

                if (used.has(id)) {
                    return id + " 重复分配";
                }

                if (isFaultVehicle(id)) {
                    return id + " 当前为故障车辆";
                }

                used.add(id);
            }
        }

        return "";
    }

    function isInDraft(id) {

        return bindings.some(
            b =>
                b.excavatorId === id ||
                (b.truckIds || []).includes(id)
        ) ||
        auxiliaryAssignments.some(
            a => a.vehicleId === id
        );
    }

    function getDraftState(device) {

        if (
            device.baseStatus === "maintenance" ||
            isFaultVehicle(device.id)
        ) {
            return {
                className: "device-maintenance",
                text: "维修中"
            };
        }

        if (device.status === "assigned") {
            return {
                className: "device-assigned",
                text: "已分配"
            };
        }

        if (isInDraft(device.id)) {
            return {
                className: "device-draft",
                text: "本任务已选"
            };
        }

        return {
            className: "device-available",
            text: "可调配"
        };
    }

    function createDeviceCard(device, state) {

        const card = document.createElement("button");
        card.type = "button";
        card.className =
            "device-card " + state.className;

        card.innerHTML = `
            <strong class="device-number">
                ${escapeHtml(device.id)}
            </strong>

            <span class="device-status">
                ${escapeHtml(state.text)}
            </span>
        `;

        return card;
    }

    function showMaintenance(device) {

        text(
            "modalTitle",
            device.id + " · 维修状态"
        );

        const maintenance =
            device.maintenance || {};

        $("modalContent").innerHTML =
            detailRow("设备", device.id) +
            detailRow(
                "故障",
                isFaultVehicle(device.id)
                    ? "司机故障上报，等待维修"
                    : maintenance.fault || "维修中"
            ) +
            detailRow(
                "预计结束",
                maintenance.expectedEnd || "-"
            );

        show("deviceModal");
    }

    function showAssigned(device) {

        const data = device.assignedTask || {};

        text(
            "modalTitle",
            device.id + " · 当前任务"
        );

        $("modalContent").innerHTML =
            detailRow("作业区域", data.area || "-") +
            detailRow("班次", data.shift || "-") +
            detailRow("工作内容", data.work || "-");

        show("deviceModal");
    }

    function renderBindingsHtml(list, taskId) {

        if (!list || !list.length) {
            return "<p>未配置主采设备</p>";
        }

        return list.map(binding => `
            <div class="published-binding">
                <strong>🚜 ${escapeHtml(binding.excavatorId)}</strong>

                <div class="published-truck-list">
                    ${(binding.truckIds || [])
                        .map(id => `
                            <span>
                                🚚 ${escapeHtml(id)}
                                ${taskId
                                    ? " · " +
                                      getTruckTripCount(taskId, id) +
                                      " 趟"
                                    : ""}
                            </span>
                        `)
                        .join("")}
                </div>
            </div>
        `).join("");
    }

    function renderAuxHtml(list) {

        if (!list || !list.length) {
            return "<p>未配置辅助车辆</p>";
        }

        return list.map(item => `
            <div class="published-aux-row">
                <strong>
                    ${escapeHtml(
                        item.typeName ||
                        getTypeName(item.type)
                    )}
                    ·
                    ${escapeHtml(item.vehicleId)}
                </strong>

                <span>${escapeHtml(item.work)}</span>
            </div>
        `).join("");
    }

    function getTruckTripCount(taskId, truckId) {

        return getTaskTripRecords(taskId)
            .filter(record => {
                const id =
                    record.vehicleId ||
                    record.vehicleNumber ||
                    record.truckId ||
                    record.vehicle;

                return String(id) === String(truckId);
            })
            .length;
    }

    function assignmentStatusText(status) {

        const map = {
            assigned: "待司机领取",
            claimed: "司机已领取",
            change_pending: "等待换车审批",
            replaced: "已换车",
            ended: "已结束"
        };

        return map[status] || status;
    }

    function normalizeBindings(list) {

        return clone(list || [])
            .map(item => ({
                excavatorId: item.excavatorId,
                truckIds: [
                    ...new Set(item.truckIds || [])
                ].sort()
            }))
            .sort(
                (a, b) =>
                    a.excavatorId.localeCompare(
                        b.excavatorId
                    )
            );
    }

    function buildAdjustmentSummary(before, after) {

        const beforeMap =
            new Map(
                before.map(b => [
                    b.excavatorId,
                    b.truckIds
                ])
            );

        const afterMap =
            new Map(
                after.map(b => [
                    b.excavatorId,
                    b.truckIds
                ])
            );

        const result = [];

        [...afterMap.keys()]
            .filter(id => !beforeMap.has(id))
            .forEach(id =>
                result.push("增加挖机 " + id)
            );

        [...beforeMap.keys()]
            .filter(id => !afterMap.has(id))
            .forEach(id =>
                result.push("减少挖机 " + id)
            );

        [...afterMap.keys()]
            .filter(id => beforeMap.has(id))
            .forEach(id => {

                const oldSet =
                    new Set(beforeMap.get(id));

                const newSet =
                    new Set(afterMap.get(id));

                const added =
                    [...newSet]
                        .filter(t => !oldSet.has(t));

                const removed =
                    [...oldSet]
                        .filter(t => !newSet.has(t));

                if (added.length) {
                    result.push(
                        id +
                        " 增加卡车 " +
                        added.join("、")
                    );
                }

                if (removed.length) {
                    result.push(
                        id +
                        " 减少卡车 " +
                        removed.join("、")
                    );
                }
            });

        return result.join("；") || "设备调整";
    }

    function createEquipmentData() {

        const result = [];

        ["EX-01","EX-02","EX-04","EX-05","EX-06"]
            .forEach(id =>
                result.push(device(id, "excavator"))
            );

        result.push(
            maintenance(
                "EX-03",
                "excavator",
                "液压系统检查",
                "12:00"
            )
        );

        for (let i = 1; i <= 20; i++) {

            const id =
                "T-" +
                String(i).padStart(3, "0");

            if (i === 5) {
                result.push(
                    maintenance(
                        id,
                        "truck",
                        "轮胎维修",
                        "14:00"
                    )
                );
            } else if (i === 12) {
                result.push(
                    maintenance(
                        id,
                        "truck",
                        "发动机检查",
                        "14:00"
                    )
                );
            } else {
                result.push(device(id, "truck"));
            }
        }

        [
            ["L-01","loader"],
            ["L-02","loader"],
            ["L-03","loader"],
            ["W-01","water"],
            ["W-03","water"],
            ["F-01","fuel"],
            ["F-02","fuel"],
            ["G-01","grader"],
            ["D-01","dozer"],
            ["D-02","dozer"],
            ["B-01","bus"],
            ["B-02","bus"]
        ].forEach(item =>
            result.push(
                device(item[0], item[1])
            )
        );

        result.push(
            maintenance(
                "L-04",
                "loader",
                "轮胎维修",
                "11:30"
            )
        );

        result.push(
            maintenance(
                "W-02",
                "water",
                "水泵故障",
                "13:00"
            )
        );

        result.push(
            maintenance(
                "G-02",
                "grader",
                "刀板维修",
                "15:00"
            )
        );

        return result;
    }

    function device(id, type) {
        return {
            id,
            type,
            baseStatus: "available",
            status: "available"
        };
    }

    function maintenance(id, type, fault, expectedEnd) {
        return {
            id,
            type,
            baseStatus: "maintenance",
            status: "maintenance",
            maintenance: {
                fault,
                expectedEnd
            }
        };
    }

    function findDevice(id) {
        return equipment.find(d => d.id === id);
    }

    function getTypeName(type) {

        return ({
            excavator: "挖机",
            truck: "卡车",
            loader: "装载机",
            water: "水车",
            fuel: "加油车",
            grader: "平路机",
            dozer: "推土机",
            bus: "大巴"
        })[type] || "其他车辆";
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
                .map(value => ({
                    value,
                    label: value
                }))
                .concat({
                    value: "manual",
                    label: "手动录入"
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
                .map(value => ({
                    value,
                    label: value
                }))
                .concat({
                    value: "manual",
                    label: "手动录入"
                });
        }

        return [
            {
                value: "日常作业",
                label: "日常作业"
            },
            {
                value: "manual",
                label: "手动录入"
            }
        ];
    }

    function getDefaultShift() {
        const hour = new Date().getHours();
        return hour >= 8 && hour < 20
            ? "白班"
            : "夜班";
    }

    function taskDateValue(task) {

        const date =
            new Date(
                task.publishedAt ||
                task.createdAt
            );

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return (
            date.getFullYear() +
            "-" +
            String(date.getMonth() + 1)
                .padStart(2, "0") +
            "-" +
            String(date.getDate())
                .padStart(2, "0")
        );
    }

    function sortNewest(a, b) {
        return (
            new Date(
                b.publishedAt ||
                b.createdAt
            ) -
            new Date(
                a.publishedAt ||
                a.createdAt
            )
        );
    }

    function detailRow(label, value) {
        return `
            <div class="modal-detail-row">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value || "-")}</strong>
            </div>
        `;
    }

    function toggle(array, value) {
        const index = array.indexOf(value);

        if (index >= 0) {
            array.splice(index, 1);
        } else {
            array.push(value);
        }
    }

    function text(id, value) {
        const el = $(id);
        if (el) el.textContent = value;
    }

    function show(id) {
        const el = $(id);
        if (el) el.classList.remove("hidden");
    }

    function hide(id) {
        const el = $(id);
        if (el) el.classList.add("hidden");
    }

    function scrollTo(id) {
        const el = $(id);

        if (!el) return;

        setTimeout(function () {
            el.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }, 50);
    }

    function format(value) {

        if (!value) return "-";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "-";
        }

        return date.toLocaleString(
            "zh-CN",
            {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

});
