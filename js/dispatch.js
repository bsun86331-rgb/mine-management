/*
===================================================
矿山管理系统
调度端 V2.9.1
===================================================

核心规则：

1. 生产看板只显示 pending / active。
2. completed 进入历史任务。
3. withdrawn 相当于删除。
4. 任务执行中允许增加 / 减少挖机与卡车。
5. GPS异常趟次需要调度审核。
6. 司机故障换车必须调度批准。
7. 一线员工请假由调度审批。
8. 调度 / 中层人员请假提交总经理审批。
9. 调度可以下达罚单。
10. 所有关键操作保留时间和处理记录。

当前版本仍为 localStorage 原型。
===================================================
*/


document.addEventListener("DOMContentLoaded", function () {

    /*
    ===================================================
    Storage
    ===================================================
    */

    const STORAGE = {

        TASKS:
            "dispatchPublishedTasks",

        LEGACY_TASK:
            "publishedDispatchTask",

        TRIPS:
            "driverTripRecords",

        PERSONNEL:
            "personnelRecords",

        DRIVER_PROFILE:
            "driverProfile",

        CHANGE_REQUESTS:
            "driverVehicleChangeRequests",

        LEAVE_REQUESTS:
            "leaveRequests",

        PENALTIES:
            "penaltyRecords",

        DISPATCH_PROFILE:
            "dispatchUserProfile"
    };


    /*
    ===================================================
    设备基础资料
    ===================================================
    */

    const equipment = {

        excavators: [
            { id: "EX-01", status: "available" },
            { id: "EX-02", status: "available" },
            { id: "EX-03", status: "maintenance", reason: "液压系统维修" },
            { id: "EX-04", status: "available" },
            { id: "EX-05", status: "available" },
            { id: "EX-06", status: "available" }
        ],

        trucks: Array.from(
            { length: 20 },
            function (_, index) {

                const number =
                    String(index + 1)
                        .padStart(3, "0");

                const id =
                    "T-" + number;

                if (id === "T-005") {
                    return {
                        id,
                        status: "maintenance",
                        reason: "轮胎维修"
                    };
                }

                if (id === "T-012") {
                    return {
                        id,
                        status: "maintenance",
                        reason: "发动机检查"
                    };
                }

                return {
                    id,
                    status: "available"
                };
            }
        ),

        loader: [
            { id: "L-01", status: "available" },
            { id: "L-02", status: "available" },
            { id: "L-03", status: "available" },
            { id: "L-04", status: "maintenance", reason: "维修中" }
        ],

        water: [
            { id: "W-01", status: "available" },
            { id: "W-02", status: "maintenance", reason: "维修中" },
            { id: "W-03", status: "available" }
        ],

        fuel: [
            { id: "F-01", status: "available" },
            { id: "F-02", status: "available" }
        ],

        grader: [
            { id: "G-01", status: "available" },
            { id: "G-02", status: "maintenance", reason: "维修中" }
        ],

        dozer: [
            { id: "D-01", status: "available" },
            { id: "D-02", status: "available" }
        ],

        bus: [
            { id: "B-01", status: "available" },
            { id: "B-02", status: "available" }
        ]
    };


    /*
    ===================================================
    页面状态
    ===================================================
    */

    let currentDraft = null;

    let selectedExcavatorId = null;

    let selectedTruckIds = [];

    let bindings = [];

    let auxiliaryAssignments = [];

    let openedTaskId = null;

    let adjustmentTaskId = null;

    let adjustmentBindings = [];

    let adjustmentSelectedExcavatorId = null;

    let adjustmentSelectedTruckIds = [];


    /*
    ===================================================
    DOM快捷工具
    ===================================================
    */

    const $ =
        function (id) {
            return document.getElementById(id);
        };


    /*
    ===================================================
    初始化
    ===================================================
    */

    initialize();


    function initialize() {

        migrateData();

        setAutomaticShift();

        bindEvents();

        renderProductionBoard();

        renderHistoryBoard();

        renderTodoCenter();

        populatePenaltyPersonnel();

        setInterval(
            function () {

                synchronizeTaskStatus();

                renderProductionBoard();

                renderHistoryBoard();

                renderTodoCenter();

            },
            5000
        );
    }


    /*
    ===================================================
    数据迁移
    ===================================================
    */

    function migrateData() {

        let tasks =
            getTasks();

        /*
        撤回旧任务直接删除
        */

        tasks =
            tasks.filter(
                function (task) {
                    return task.status !== "withdrawn";
                }
            );


        /*
        旧版本 active 但实际上没有趟次，
        自动恢复待执行。
        */

        tasks.forEach(
            function (task) {

                const tripCount =
                    getTaskTrips(task).length;

                if (
                    task.status === "active" &&
                    tripCount === 0
                ) {
                    task.status = "pending";
                }

                if (
                    task.status === "pending" &&
                    tripCount > 0
                ) {
                    task.status = "active";
                }

                if (!Array.isArray(task.equipmentAdjustments)) {
                    task.equipmentAdjustments = [];
                }

                if (!Array.isArray(task.bindings)) {
                    task.bindings = [];
                }

                if (!Array.isArray(task.auxiliaryAssignments)) {
                    task.auxiliaryAssignments = [];
                }
            }
        );

        saveTasks(tasks);
    }


    /*
    ===================================================
    事件绑定
    ===================================================
    */

    function bindEvents() {

        $("newTaskButton")
            ?.addEventListener(
                "click",
                openCreateTask
            );

        $("cancelCreateButton")
            ?.addEventListener(
                "click",
                cancelCreateTask
            );

        $("generateTaskButton")
            ?.addEventListener(
                "click",
                generateDraftTask
            );

        $("bindTrucksButton")
            ?.addEventListener(
                "click",
                bindSelectedTrucks
            );

        $("publishTaskButton")
            ?.addEventListener(
                "click",
                publishTask
            );

        $("historyTaskButton")
            ?.addEventListener(
                "click",
                toggleHistory
            );

        $("resetHistoryFilterButton")
            ?.addEventListener(
                "click",
                resetHistoryFilter
            );

        $("historyDateFilter")
            ?.addEventListener(
                "change",
                renderHistoryBoard
            );

        $("historyShiftFilter")
            ?.addEventListener(
                "change",
                renderHistoryBoard
            );

        $("historyAreaFilter")
            ?.addEventListener(
                "input",
                renderHistoryBoard
            );

        $("auxiliaryTypeSelect")
            ?.addEventListener(
                "change",
                updateAuxiliaryVehicles
            );

        $("auxiliaryWorkSelect")
            ?.addEventListener(
                "change",
                updateAuxiliaryCustomInput
            );

        $("addAuxiliaryButton")
            ?.addEventListener(
                "click",
                addAuxiliaryAssignment
            );


        /*
        任务弹窗
        */

        $("closePublishedTaskModalButton")
            ?.addEventListener(
                "click",
                closePublishedTaskModal
            );

        $("withdrawPublishedTaskButton")
            ?.addEventListener(
                "click",
                withdrawOpenedTask
            );

        $("completePublishedTaskButton")
            ?.addEventListener(
                "click",
                completeOpenedTask
            );

        $("adjustTaskButton")
            ?.addEventListener(
                "click",
                openAdjustment
            );


        /*
        调整
        */

        $("closeAdjustmentButton")
            ?.addEventListener(
                "click",
                closeAdjustment
            );

        $("saveAdjustmentButton")
            ?.addEventListener(
                "click",
                saveAdjustment
            );


        /*
        换车
        */

        $("openVehicleChangeButton")
            ?.addEventListener(
                "click",
                openVehicleChangeModal
            );

        $("closeVehicleChangeModal")
            ?.addEventListener(
                "click",
                function () {
                    hideModal("vehicleChangeModal");
                }
            );


        /*
        GPS审核
        */

        $("openGpsReviewButton")
            ?.addEventListener(
                "click",
                openGpsReviewModal
            );

        $("closeGpsReviewModal")
            ?.addEventListener(
                "click",
                function () {
                    hideModal("gpsReviewModal");
                }
            );


        /*
        请假
        */

        $("openLeaveReviewButton")
            ?.addEventListener(
                "click",
                openLeaveReviewModal
            );

        $("closeLeaveReviewModal")
            ?.addEventListener(
                "click",
                function () {
                    hideModal("leaveReviewModal");
                }
            );

        $("myLeaveButton")
            ?.addEventListener(
                "click",
                openMyLeaveModal
            );

        $("closeMyLeaveModal")
            ?.addEventListener(
                "click",
                function () {
                    hideModal("myLeaveModal");
                }
            );

        $("submitMyLeaveButton")
            ?.addEventListener(
                "click",
                submitMyLeave
            );


        /*
        罚单
        */

        $("issuePenaltyButton")
            ?.addEventListener(
                "click",
                openPenaltyModal
            );

        $("openPenaltyManagerButton")
            ?.addEventListener(
                "click",
                openPenaltyManagerModal
            );

        $("closePenaltyModal")
            ?.addEventListener(
                "click",
                function () {
                    hideModal("penaltyModal");
                }
            );

        $("closePenaltyManagerModal")
            ?.addEventListener(
                "click",
                function () {
                    hideModal("penaltyManagerModal");
                }
            );

        $("submitPenaltyButton")
            ?.addEventListener(
                "click",
                submitPenalty
            );
    }


    /*
    ===================================================
    自动班次
    ===================================================
    */

    function setAutomaticShift() {

        const hour =
            new Date().getHours();

        $("taskShift").value =
            hour >= 8 && hour < 20
                ? "白班"
                : "夜班";
    }


    /*
    ===================================================
    创建生产任务
    ===================================================
    */

    function openCreateTask() {

        $("taskCreateSection")
            .classList.remove("hidden");

        $("taskCreateSection")
            .scrollIntoView({
                behavior: "smooth"
            });
    }


    function cancelCreateTask() {

        currentDraft = null;

        selectedExcavatorId = null;

        selectedTruckIds = [];

        bindings = [];

        auxiliaryAssignments = [];

        hideDraftSections();

        $("taskCreateSection")
            .classList.add("hidden");
    }


    function generateDraftTask() {

        const area =
            $("taskArea")
                .value
                .trim();

        if (!area) {
            alert("请输入作业区域。");
            return;
        }

        currentDraft = {

            taskId:
                "TASK_" + Date.now(),

            dateKey:
                getLocalDateKey(),

            date:
                new Date()
                    .toLocaleDateString("zh-CN"),

            shift:
                $("taskShift").value,

            area,

            remark:
                $("taskRemark")
                    .value
                    .trim(),

            status:
                "configuring",

            createdAt:
                new Date().toISOString()
        };

        bindings = [];

        auxiliaryAssignments = [];

        selectedExcavatorId = null;

        selectedTruckIds = [];

        renderDraftSummary();

        showDraftSections();

        renderAllEquipment();

        renderBindings();

        renderAuxiliaryAssignments();
    }


    function renderDraftSummary() {

        if (!currentDraft) {
            return;
        }

        setText(
            "summaryDate",
            currentDraft.date
        );

        setText(
            "summaryShift",
            currentDraft.shift
        );

        setText(
            "summaryArea",
            currentDraft.area
        );

        setText(
            "summaryRemark",
            currentDraft.remark || "无"
        );
    }


    function showDraftSections() {

        [
            "taskSummarySection",
            "legendSection",
            "excavatorSection",
            "truckSection",
            "bindingSection",
            "auxiliarySection",
            "publishSection"
        ].forEach(
            function (id) {
                $(id)
                    ?.classList
                    .remove("hidden");
            }
        );
    }


    function hideDraftSections() {

        [
            "taskSummarySection",
            "legendSection",
            "excavatorSection",
            "truckSection",
            "bindingSection",
            "auxiliarySection",
            "publishSection"
        ].forEach(
            function (id) {
                $(id)
                    ?.classList
                    .add("hidden");
            }
        );
    }


    /*
    ===================================================
    设备占用
    ===================================================
    */

    function getOccupiedDeviceIds(
        ignoredTaskId
    ) {

        const ids =
            new Set();

        getTasks()
            .filter(
                function (task) {

                    return (
                        task.taskId !== ignoredTaskId &&
                        (
                            task.status === "pending" ||
                            task.status === "active"
                        )
                    );
                }
            )
            .forEach(
                function (task) {

                    (task.bindings || [])
                        .forEach(
                            function (binding) {

                                ids.add(
                                    binding.excavatorId
                                );

                                (binding.truckIds || [])
                                    .forEach(
                                        function (truckId) {
                                            ids.add(truckId);
                                        }
                                    );
                            }
                        );

                    (task.auxiliaryAssignments || [])
                        .forEach(
                            function (item) {
                                ids.add(item.vehicleId);
                            }
                        );
                }
            );

        return ids;
    }


    function renderAllEquipment() {

        renderExcavators();

        renderTrucks();

        setText(
            "excavatorCount",
            equipment.excavators.length + " 台"
        );

        setText(
            "truckCount",
            equipment.trucks.length + " 台"
        );

        updateAuxiliaryVehicles();
    }


    /*
    ===================================================
    挖机
    ===================================================
    */

    function renderExcavators() {

        const board =
            $("excavatorBoard");

        const occupied =
            getOccupiedDeviceIds();

        board.innerHTML = "";

        equipment.excavators.forEach(
            function (device) {

                const card =
                    document.createElement("button");

                card.type =
                    "button";

                card.className =
                    getDeviceClass(
                        device,
                        occupied,
                        selectedExcavatorId === device.id
                    );

                card.innerHTML =
                    "<strong>" +
                    escapeHtml(device.id) +
                    "</strong>" +
                    "<span>" +
                    getDeviceStatusText(
                        device,
                        occupied,
                        selectedExcavatorId === device.id
                    ) +
                    "</span>";

                card.addEventListener(
                    "click",
                    function () {

                        if (
                            device.status === "maintenance"
                        ) {
                            alert(
                                device.id +
                                " 正在维修。\n\n" +
                                (device.reason || "")
                            );

                            return;
                        }

                        if (
                            occupied.has(device.id)
                        ) {
                            alert(
                                device.id +
                                " 已被其他任务占用。"
                            );

                            return;
                        }

                        selectedExcavatorId =
                            selectedExcavatorId === device.id
                                ? null
                                : device.id;

                        selectedTruckIds = [];

                        renderExcavators();

                        renderTrucks();
                    }
                );

                board.appendChild(card);
            }
        );
    }


    /*
    ===================================================
    卡车
    ===================================================
    */

    function renderTrucks() {

        const board =
            $("truckBoard");

        const occupied =
            getOccupiedDeviceIds();

        board.innerHTML = "";

        equipment.trucks.forEach(
            function (device) {

                const selected =
                    selectedTruckIds.includes(
                        device.id
                    );

                const card =
                    document.createElement("button");

                card.type =
                    "button";

                card.className =
                    getDeviceClass(
                        device,
                        occupied,
                        selected
                    );

                card.innerHTML =
                    "<strong>" +
                    escapeHtml(device.id) +
                    "</strong>" +
                    "<span>" +
                    getDeviceStatusText(
                        device,
                        occupied,
                        selected
                    ) +
                    "</span>";

                card.addEventListener(
                    "click",
                    function () {

                        if (!selectedExcavatorId) {
                            alert("请先选择挖机。");
                            return;
                        }

                        if (
                            device.status === "maintenance"
                        ) {
                            alert(
                                device.id +
                                " 正在维修。"
                            );

                            return;
                        }

                        if (
                            occupied.has(device.id)
                        ) {
                            alert(
                                device.id +
                                " 已分配给其他任务。"
                            );

                            return;
                        }

                        if (
                            selectedTruckIds.includes(device.id)
                        ) {

                            selectedTruckIds =
                                selectedTruckIds.filter(
                                    function (id) {
                                        return id !== device.id;
                                    }
                                );

                        } else {

                            selectedTruckIds.push(
                                device.id
                            );
                        }

                        renderTrucks();
                    }
                );

                board.appendChild(card);
            }
        );


        if (selectedExcavatorId) {

            $("selectedExcavatorInfo")
                .textContent =
                "当前挖机：" +
                selectedExcavatorId +
                " · 已选择 " +
                selectedTruckIds.length +
                " 台卡车";

            $("bindTrucksButton")
                .classList
                .remove("hidden");

            $("bindTrucksButton")
                .textContent =
                "绑定所选卡车（" +
                selectedTruckIds.length +
                "台）";

        } else {

            $("selectedExcavatorInfo")
                .textContent =
                "当前未选择挖机";

            $("bindTrucksButton")
                .classList
                .add("hidden");
        }
    }


    function bindSelectedTrucks() {

        if (!selectedExcavatorId) {
            alert("请选择挖机。");
            return;
        }

        if (!selectedTruckIds.length) {
            alert("请选择至少一台卡车。");
            return;
        }

        const existingIndex =
            bindings.findIndex(
                function (item) {
                    return (
                        item.excavatorId ===
                        selectedExcavatorId
                    );
                }
            );

        const binding = {

            excavatorId:
                selectedExcavatorId,

            truckIds:
                selectedTruckIds.slice()
        };

        if (existingIndex >= 0) {

            bindings[existingIndex] =
                binding;

        } else {

            bindings.push(binding);
        }

        selectedExcavatorId = null;

        selectedTruckIds = [];

        renderExcavators();

        renderTrucks();

        renderBindings();
    }


    function renderBindings() {

        const box =
            $("bindingList");

        if (!bindings.length) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无绑定关系</div>';

            return;
        }

        box.innerHTML =
            bindings.map(
                function (binding, index) {

                    return `
                        <div class="binding-row">
                            <div>
                                <strong>
                                    🚜 ${escapeHtml(binding.excavatorId)}
                                </strong>

                                <span>
                                    🚚 ${(binding.truckIds || [])
                                        .map(escapeHtml)
                                        .join("、")}
                                </span>
                            </div>

                            <button
                                type="button"
                                class="mini-danger-button"
                                data-remove-binding="${index}"
                            >
                                删除
                            </button>
                        </div>
                    `;
                }
            ).join("");

        box.querySelectorAll(
            "[data-remove-binding]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const index =
                            Number(
                                button.dataset.removeBinding
                            );

                        bindings.splice(index, 1);

                        renderBindings();
                    }
                );
            }
        );
    }


    /*
    ===================================================
    辅助车辆
    ===================================================
    */

    function updateAuxiliaryVehicles() {

        const type =
            $("auxiliaryTypeSelect")
                ?.value;

        const vehicleSelect =
            $("auxiliaryVehicleSelect");

        if (!vehicleSelect) {
            return;
        }

        vehicleSelect.innerHTML =
            '<option value="">选择车辆</option>';

        if (!type || !equipment[type]) {
            updateAuxiliaryWorkOptions();
            return;
        }

        const occupied =
            getOccupiedDeviceIds();

        equipment[type]
            .forEach(
                function (vehicle) {

                    const option =
                        document.createElement("option");

                    option.value =
                        vehicle.id;

                    const unavailable =
                        vehicle.status === "maintenance" ||
                        occupied.has(vehicle.id);

                    option.disabled =
                        unavailable;

                    option.textContent =
                        vehicle.id +
                        (
                            vehicle.status === "maintenance"
                                ? "（维修）"
                                : occupied.has(vehicle.id)
                                    ? "（已分配）"
                                    : ""
                        );

                    vehicleSelect.appendChild(option);
                }
            );

        updateAuxiliaryWorkOptions();
    }


    function updateAuxiliaryWorkOptions() {

        const type =
            $("auxiliaryTypeSelect")
                ?.value;

        const select =
            $("auxiliaryWorkSelect");

        if (!select) {
            return;
        }

        const options = {

            loader: [
                "日常作业",
                "清理挖机附近散料",
                "修整运输道路",
                "装煤",
                "排土场作业",
                "手动录入"
            ],

            water: [
                "日常洒水",
                "运输道路洒水",
                "采区洒水",
                "排土场洒水",
                "临时调配",
                "手动录入"
            ],

            fuel: [
                "日常作业",
                "手动录入"
            ],

            grader: [
                "日常作业",
                "修整运输道路",
                "手动录入"
            ],

            dozer: [
                "日常作业",
                "排土场作业",
                "手动录入"
            ],

            bus: [
                "人员运输",
                "日常作业",
                "手动录入"
            ]
        };

        select.innerHTML =
            '<option value="">选择作业内容</option>';

        (options[type] || [])
            .forEach(
                function (text) {

                    const option =
                        document.createElement("option");

                    option.value =
                        text;

                    option.textContent =
                        text;

                    select.appendChild(option);
                }
            );
    }


    function updateAuxiliaryCustomInput() {

        const custom =
            $("auxiliaryCustomWork");

        if (
            $("auxiliaryWorkSelect").value ===
            "手动录入"
        ) {

            custom.classList.remove("hidden");

        } else {

            custom.classList.add("hidden");

            custom.value = "";
        }
    }


    function addAuxiliaryAssignment() {

        const type =
            $("auxiliaryTypeSelect").value;

        const vehicleId =
            $("auxiliaryVehicleSelect").value;

        let work =
            $("auxiliaryWorkSelect").value;

        if (
            work === "手动录入"
        ) {

            work =
                $("auxiliaryCustomWork")
                    .value
                    .trim();
        }

        if (
            !type ||
            !vehicleId ||
            !work
        ) {

            alert(
                "请选择辅助车辆并填写作业内容。"
            );

            return;
        }

        if (
            auxiliaryAssignments.some(
                function (item) {
                    return item.vehicleId === vehicleId;
                }
            )
        ) {

            alert(
                "该车辆已经加入当前任务。"
            );

            return;
        }

        auxiliaryAssignments.push({

            type,

            vehicleId,

            work
        });

        renderAuxiliaryAssignments();

        $("auxiliaryVehicleSelect").value = "";

        $("auxiliaryWorkSelect").value = "";

        $("auxiliaryCustomWork")
            .classList
            .add("hidden");
    }


    function renderAuxiliaryAssignments() {

        const box =
            $("auxiliaryAssignmentList");

        if (!auxiliaryAssignments.length) {

            box.innerHTML =
                '<div class="empty-placeholder">暂未配置辅助车辆</div>';

            return;
        }

        box.innerHTML =
            auxiliaryAssignments.map(
                function (item, index) {

                    return `
                        <div class="binding-row">
                            <div>
                                <strong>
                                    ${escapeHtml(item.vehicleId)}
                                </strong>

                                <span>
                                    ${escapeHtml(item.work)}
                                </span>
                            </div>

                            <button
                                type="button"
                                class="mini-danger-button"
                                data-remove-aux="${index}"
                            >
                                删除
                            </button>
                        </div>
                    `;
                }
            ).join("");

        box.querySelectorAll(
            "[data-remove-aux]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        auxiliaryAssignments.splice(
                            Number(
                                button.dataset.removeAux
                            ),
                            1
                        );

                        renderAuxiliaryAssignments();
                    }
                );
            }
        );
    }


    /*
    ===================================================
    发布任务
    ===================================================
    */

    function publishTask() {

        if (!currentDraft) {
            return;
        }

        if (
            !bindings.length &&
            !auxiliaryAssignments.length
        ) {

            alert(
                "请至少配置一组生产设备或辅助车辆。"
            );

            return;
        }

        const conflict =
            findDraftConflict();

        if (conflict) {

            alert(
                conflict +
                " 已被其他任务占用，请重新选择。"
            );

            return;
        }

        const task = {

            ...currentDraft,

            status:
                "pending",

            bindings:
                deepClone(bindings),

            auxiliaryAssignments:
                deepClone(auxiliaryAssignments),

            equipmentAdjustments:
                [],

            publishedAt:
                new Date().toISOString()
        };

        const tasks =
            getTasks();

        tasks.push(task);

        saveTasks(tasks);

        localStorage.setItem(
            STORAGE.LEGACY_TASK,
            JSON.stringify(task)
        );

        alert(
            "生产任务发布成功。"
        );

        cancelCreateTask();

        $("taskArea").value = "";

        $("taskRemark").value = "";

        renderProductionBoard();

        renderHistoryBoard();

        renderTodoCenter();
    }


    function findDraftConflict() {

        const occupied =
            getOccupiedDeviceIds();

        for (const binding of bindings) {

            if (
                occupied.has(
                    binding.excavatorId
                )
            ) {
                return binding.excavatorId;
            }

            for (
                const truckId of
                binding.truckIds || []
            ) {

                if (
                    occupied.has(truckId)
                ) {
                    return truckId;
                }
            }
        }

        for (
            const item of
            auxiliaryAssignments
        ) {

            if (
                occupied.has(item.vehicleId)
            ) {
                return item.vehicleId;
            }
        }

        return null;
    }


    /*
    ===================================================
    任务状态
    ===================================================
    */

    function synchronizeTaskStatus() {

        const tasks =
            getTasks();

        let changed = false;

        tasks.forEach(
            function (task) {

                if (
                    task.status !== "pending" &&
                    task.status !== "active"
                ) {
                    return;
                }

                const trips =
                    getTaskTrips(task);

                if (
                    task.status === "pending" &&
                    trips.length > 0
                ) {

                    task.status = "active";

                    task.startedAt =
                        task.startedAt ||
                        trips[0].completedAt ||
                        new Date().toISOString();

                    changed = true;
                }

                if (
                    task.status === "active" &&
                    trips.length === 0
                ) {

                    task.status = "pending";

                    changed = true;
                }
            }
        );

        if (changed) {
            saveTasks(tasks);
        }
    }


    /*
    ===================================================
    生产任务看板
    ===================================================
    */

    function renderProductionBoard() {

        synchronizeTaskStatus();

        const tasks =
            getTasks()
                .filter(
                    function (task) {

                        return (
                            task.status === "pending" ||
                            task.status === "active"
                        );
                    }
                )
                .sort(
                    function (a, b) {

                        return new Date(
                            b.publishedAt || 0
                        ) -
                        new Date(
                            a.publishedAt || 0
                        );
                    }
                );

        setText(
            "productionTaskCount",
            tasks.length +
            " 个进行中任务"
        );

        const board =
            $("productionTaskBoard");

        if (!tasks.length) {

            board.innerHTML =
                '<div class="empty-placeholder">当前没有进行中的生产任务</div>';

            return;
        }

        board.innerHTML =
            tasks.map(
                function (task) {

                    const trips =
                        getTaskTrips(task);

                    const excavatorCount =
                        (task.bindings || []).length;

                    const truckCount =
                        (task.bindings || [])
                            .reduce(
                                function (sum, item) {
                                    return (
                                        sum +
                                        (item.truckIds || []).length
                                    );
                                },
                                0
                            );

                    return `
                        <button
                            type="button"
                            class="production-task-card ${task.status}"
                            data-task-id="${escapeHtml(task.taskId)}"
                        >

                            <div class="production-task-card-top">

                                <div>
                                    <strong>
                                        ${escapeHtml(task.area || "-")}
                                    </strong>

                                    <span>
                                        ${escapeHtml(task.shift || "-")}
                                        ·
                                        ${escapeHtml(task.date || task.dateKey || "-")}
                                    </span>
                                </div>

                                <span class="task-status-pill ${task.status}">
                                    ${
                                        task.status === "active"
                                            ? "执行中"
                                            : "待执行"
                                    }
                                </span>

                            </div>


                            <div class="task-card-stat-grid">

                                <div>
                                    <span>挖机</span>
                                    <strong>${excavatorCount}</strong>
                                </div>

                                <div>
                                    <span>卡车</span>
                                    <strong>${truckCount}</strong>
                                </div>

                                <div>
                                    <span>辅助</span>
                                    <strong>
                                        ${(task.auxiliaryAssignments || []).length}
                                    </strong>
                                </div>

                                <div>
                                    <span>趟次</span>
                                    <strong>${trips.length}</strong>
                                </div>

                            </div>

                        </button>
                    `;
                }
            ).join("");

        board.querySelectorAll(
            "[data-task-id]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        openPublishedTask(
                            button.dataset.taskId
                        );
                    }
                );
            }
        );
    }


    /*
    ===================================================
    历史任务
    ===================================================
    */

    function toggleHistory() {

        $("historyTaskSection")
            .classList
            .toggle("hidden");

        if (
            !$("historyTaskSection")
                .classList
                .contains("hidden")
        ) {

            renderHistoryBoard();

            $("historyTaskSection")
                .scrollIntoView({
                    behavior: "smooth"
                });
        }
    }


    function resetHistoryFilter() {

        $("historyDateFilter").value = "";

        $("historyShiftFilter").value = "";

        $("historyAreaFilter").value = "";

        renderHistoryBoard();
    }


    function renderHistoryBoard() {

        let tasks =
            getTasks()
                .filter(
                    function (task) {
                        return task.status === "completed";
                    }
                );

        const date =
            $("historyDateFilter")
                ?.value || "";

        const shift =
            $("historyShiftFilter")
                ?.value || "";

        const area =
            $("historyAreaFilter")
                ?.value
                ?.trim()
                ?.toLowerCase() || "";

        if (date) {

            tasks =
                tasks.filter(
                    function (task) {
                        return getTaskDateKey(task) === date;
                    }
                );
        }

        if (shift) {

            tasks =
                tasks.filter(
                    function (task) {
                        return task.shift === shift;
                    }
                );
        }

        if (area) {

            tasks =
                tasks.filter(
                    function (task) {

                        return String(
                            task.area || ""
                        )
                            .toLowerCase()
                            .includes(area);
                    }
                );
        }

        tasks.sort(
            function (a, b) {

                return new Date(
                    b.completedAt || 0
                ) -
                new Date(
                    a.completedAt || 0
                );
            }
        );

        setText(
            "historyTaskCount",
            tasks.length +
            " 个已完成任务"
        );

        const board =
            $("historyTaskBoard");

        if (!tasks.length) {

            board.innerHTML =
                '<div class="empty-placeholder">暂无符合条件的已完成任务</div>';

            return;
        }

        board.innerHTML =
            tasks.map(
                function (task) {

                    return `
                        <button
                            type="button"
                            class="production-task-card completed"
                            data-history-task="${escapeHtml(task.taskId)}"
                        >

                            <div class="production-task-card-top">

                                <div>
                                    <strong>
                                        ${escapeHtml(task.area || "-")}
                                    </strong>

                                    <span>
                                        ${escapeHtml(task.shift || "-")}
                                        ·
                                        ${escapeHtml(task.date || task.dateKey || "-")}
                                    </span>
                                </div>

                                <span class="task-status-pill completed">
                                    已完成
                                </span>

                            </div>

                            <div class="task-card-stat-grid">

                                <div>
                                    <span>趟次</span>
                                    <strong>
                                        ${getTaskTrips(task).length}
                                    </strong>
                                </div>

                                <div>
                                    <span>设备调整</span>
                                    <strong>
                                        ${(task.equipmentAdjustments || []).length}
                                    </strong>
                                </div>

                                <div>
                                    <span>完成时间</span>
                                    <strong>
                                        ${formatTime(task.completedAt)}
                                    </strong>
                                </div>

                            </div>

                        </button>
                    `;
                }
            ).join("");

        board.querySelectorAll(
            "[data-history-task]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        openPublishedTask(
                            button.dataset.historyTask
                        );
                    }
                );
            }
        );
    }


    /*
    ===================================================
    任务详情
    ===================================================
    */

    function openPublishedTask(
        taskId
    ) {

        const task =
            getTaskById(taskId);

        if (!task) {
            return;
        }

        openedTaskId =
            taskId;

        const trips =
            getTaskTrips(task);

        $("publishedTaskModalTitle")
            .textContent =
            "生产任务 · " +
            (task.area || "-");


        $("publishedTaskModalContent")
            .innerHTML =
            buildTaskDetailHtml(
                task,
                trips
            );


        const withdrawButton =
            $("withdrawPublishedTaskButton");

        const completeButton =
            $("completePublishedTaskButton");

        const adjustButton =
            $("adjustTaskButton");


        withdrawButton
            .classList
            .add("hidden");

        completeButton
            .classList
            .add("hidden");

        adjustButton
            .classList
            .add("hidden");


        if (
            task.status === "pending"
        ) {

            withdrawButton
                .classList
                .remove("hidden");

            adjustButton
                .classList
                .remove("hidden");
        }


        if (
            task.status === "active"
        ) {

            completeButton
                .classList
                .remove("hidden");

            adjustButton
                .classList
                .remove("hidden");
        }

        showModal(
            "publishedTaskModal"
        );
    }


    function buildTaskDetailHtml(
        task,
        trips
    ) {

        const bindingsHtml =
            (task.bindings || []).length
                ?
                (task.bindings || [])
                    .map(
                        function (item) {

                            return `
                                <div class="detail-row">
                                    <span>
                                        ${escapeHtml(item.excavatorId)}
                                    </span>

                                    <strong>
                                        ${(item.truckIds || [])
                                            .map(escapeHtml)
                                            .join("、")}
                                    </strong>
                                </div>
                            `;
                        }
                    )
                    .join("")
                :
                '<div class="empty-placeholder">无主采设备</div>';


        const auxiliaryHtml =
            (task.auxiliaryAssignments || []).length
                ?
                (task.auxiliaryAssignments || [])
                    .map(
                        function (item) {

                            return `
                                <div class="detail-row">
                                    <span>
                                        ${escapeHtml(item.vehicleId)}
                                    </span>

                                    <strong>
                                        ${escapeHtml(item.work)}
                                    </strong>
                                </div>
                            `;
                        }
                    )
                    .join("")
                :
                '<div class="empty-placeholder">无辅助车辆</div>';


        const adjustmentsHtml =
            (task.equipmentAdjustments || []).length
                ?
                task.equipmentAdjustments
                    .map(
                        function (item) {

                            return `
                                <div class="timeline-row">
                                    <strong>
                                        ${formatDateTime(item.time)}
                                    </strong>

                                    <span>
                                        ${escapeHtml(item.summary || "设备调整")}
                                    </span>
                                </div>
                            `;
                        }
                    )
                    .join("")
                :
                '<div class="empty-placeholder">无设备调整记录</div>';


        return `
            <div class="detail-summary-grid">

                <div>
                    <span>任务ID</span>
                    <strong>
                        ${escapeHtml(task.taskId)}
                    </strong>
                </div>

                <div>
                    <span>日期</span>
                    <strong>
                        ${escapeHtml(task.date || task.dateKey || "-")}
                    </strong>
                </div>

                <div>
                    <span>班次</span>
                    <strong>
                        ${escapeHtml(task.shift || "-")}
                    </strong>
                </div>

                <div>
                    <span>区域</span>
                    <strong>
                        ${escapeHtml(task.area || "-")}
                    </strong>
                </div>

                <div>
                    <span>运输趟次</span>
                    <strong>
                        ${trips.length}
                    </strong>
                </div>

            </div>

            <h4>🚜 挖机 / 卡车</h4>
            ${bindingsHtml}

            <h4>🚧 辅助车辆</h4>
            ${auxiliaryHtml}

            <h4>📝 调度说明</h4>

            <div class="detail-note">
                ${escapeHtml(task.remark || "无")}
            </div>

            <h4>🔄 设备调整记录</h4>
            ${adjustmentsHtml}
        `;
    }


    function closePublishedTaskModal() {

        openedTaskId = null;

        hideModal(
            "publishedTaskModal"
        );
    }


    /*
    ===================================================
    撤回
    ===================================================
    */

    function withdrawOpenedTask() {

        if (!openedTaskId) {
            return;
        }

        const task =
            getTaskById(openedTaskId);

        if (!task) {
            return;
        }

        if (
            task.status !== "pending"
        ) {

            alert(
                "已经开始执行的任务不能撤回。"
            );

            return;
        }

        if (
            !confirm(
                "确认撤回并删除本任务吗？"
            )
        ) {
            return;
        }

        const tasks =
            getTasks()
                .filter(
                    function (item) {

                        return (
                            item.taskId !==
                            openedTaskId
                        );
                    }
                );

        saveTasks(tasks);

        const legacy =
            readJson(
                STORAGE.LEGACY_TASK,
                null
            );

        if (
            legacy &&
            legacy.taskId === openedTaskId
        ) {

            localStorage.removeItem(
                STORAGE.LEGACY_TASK
            );
        }

        closePublishedTaskModal();

        renderProductionBoard();
    }


    /*
    ===================================================
    完成任务
    ===================================================
    */

    function completeOpenedTask() {

        if (!openedTaskId) {
            return;
        }

        const tasks =
            getTasks();

        const index =
            tasks.findIndex(
                function (item) {
                    return item.taskId === openedTaskId;
                }
            );

        if (index < 0) {
            return;
        }

        const task =
            tasks[index];

        const trips =
            getTaskTrips(task);

        if (
            task.status !== "active"
        ) {

            alert(
                "任务尚未产生运输记录，不能直接完成。"
            );

            return;
        }

        if (
            !confirm(
                "确认本生产任务已经完成吗？"
            )
        ) {
            return;
        }

        task.status =
            "completed";

        task.completedAt =
            new Date().toISOString();

        task.transportTripCount =
            trips.length;

        tasks[index] =
            task;

        saveTasks(tasks);

        closePublishedTaskModal();

        renderProductionBoard();

        renderHistoryBoard();
    }


    /*
    ===================================================
    中途设备调整
    ===================================================
    */

    function openAdjustment() {

        const task =
            getTaskById(
                openedTaskId
            );

        if (!task) {
            return;
        }

        if (
            task.status !== "pending" &&
            task.status !== "active"
        ) {

            return;
        }

        adjustmentTaskId =
            task.taskId;

        adjustmentBindings =
            deepClone(
                task.bindings || []
            );

        adjustmentSelectedExcavatorId =
            null;

        adjustmentSelectedTruckIds =
            [];

        renderAdjustmentCurrentBindings();

        renderAdjustmentBoards();

        hideModal(
            "publishedTaskModal"
        );

        showModal(
            "adjustTaskModal"
        );
    }


    function renderAdjustmentCurrentBindings() {

        const box =
            $("adjustCurrentBindings");

        if (!adjustmentBindings.length) {

            box.innerHTML =
                '<div class="empty-placeholder">当前无挖机卡车绑定</div>';

            return;
        }

        box.innerHTML =
            adjustmentBindings.map(
                function (binding, index) {

                    return `
                        <div class="binding-row">

                            <div>
                                <strong>
                                    🚜 ${escapeHtml(binding.excavatorId)}
                                </strong>

                                <span>
                                    🚚 ${(binding.truckIds || [])
                                        .map(escapeHtml)
                                        .join("、")}
                                </span>
                            </div>

                            <button
                                type="button"
                                class="mini-danger-button"
                                data-adjust-remove="${index}"
                            >
                                减少挖机
                            </button>

                        </div>
                    `;
                }
            ).join("");


        box.querySelectorAll(
            "[data-adjust-remove]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        adjustmentBindings.splice(
                            Number(
                                button.dataset.adjustRemove
                            ),
                            1
                        );

                        renderAdjustmentCurrentBindings();

                        renderAdjustmentBoards();
                    }
                );
            }
        );
    }


    function renderAdjustmentBoards() {

        renderAdjustmentExcavators();

        renderAdjustmentTrucks();
    }


    function renderAdjustmentExcavators() {

        const board =
            $("adjustExcavatorBoard");

        board.innerHTML =
            "<h4>可增加挖机</h4>";

        const occupied =
            getOccupiedDeviceIds(
                adjustmentTaskId
            );

        equipment.excavators
            .forEach(
                function (device) {

                    const alreadyUsed =
                        adjustmentBindings.some(
                            function (item) {
                                return (
                                    item.excavatorId ===
                                    device.id
                                );
                            }
                        );

                    const selected =
                        adjustmentSelectedExcavatorId ===
                        device.id;

                    const button =
                        document.createElement(
                            "button"
                        );

                    button.type =
                        "button";

                    button.className =
                        getDeviceClass(
                            device,
                            occupied,
                            selected
                        );

                    if (alreadyUsed) {
                        button.classList.add(
                            "device-assigned"
                        );
                    }

                    button.innerHTML =
                        "<strong>" +
                        escapeHtml(device.id) +
                        "</strong>" +
                        "<span>" +
                        (
                            alreadyUsed
                                ? "本任务已使用"
                                : selected
                                    ? "✓ 当前选择"
                                    : "可调配"
                        ) +
                        "</span>";

                    button.disabled =
                        alreadyUsed ||
                        device.status === "maintenance" ||
                        occupied.has(device.id);

                    button.addEventListener(
                        "click",
                        function () {

                            adjustmentSelectedExcavatorId =
                                device.id;

                            adjustmentSelectedTruckIds =
                                [];

                            renderAdjustmentBoards();
                        }
                    );

                    board.appendChild(button);
                }
            );
    }


    function renderAdjustmentTrucks() {

        const board =
            $("adjustTruckBoard");

        board.innerHTML =
            "<h4>选择跟随卡车</h4>";

        if (
            !adjustmentSelectedExcavatorId
        ) {

            board.innerHTML +=
                '<div class="empty-placeholder">请先选择要增加的挖机</div>';

            return;
        }

        const occupied =
            getOccupiedDeviceIds(
                adjustmentTaskId
            );

        const alreadyInTask =
            new Set();

        adjustmentBindings
            .forEach(
                function (binding) {

                    (binding.truckIds || [])
                        .forEach(
                            function (id) {
                                alreadyInTask.add(id);
                            }
                        );
                }
            );


        equipment.trucks
            .forEach(
                function (device) {

                    const selected =
                        adjustmentSelectedTruckIds
                            .includes(device.id);

                    const button =
                        document.createElement(
                            "button"
                        );

                    button.type =
                        "button";

                    button.className =
                        getDeviceClass(
                            device,
                            occupied,
                            selected
                        );

                    const unavailable =
                        device.status === "maintenance" ||
                        occupied.has(device.id) ||
                        alreadyInTask.has(device.id);

                    if (
                        alreadyInTask.has(device.id)
                    ) {
                        button.classList.add(
                            "device-assigned"
                        );
                    }

                    button.disabled =
                        unavailable;

                    button.innerHTML =
                        "<strong>" +
                        escapeHtml(device.id) +
                        "</strong><span>" +
                        (
                            selected
                                ? "✓ 已选择"
                                : alreadyInTask.has(device.id)
                                    ? "本任务已使用"
                                    : "可调配"
                        ) +
                        "</span>";

                    button.addEventListener(
                        "click",
                        function () {

                            if (
                                adjustmentSelectedTruckIds
                                    .includes(device.id)
                            ) {

                                adjustmentSelectedTruckIds =
                                    adjustmentSelectedTruckIds.filter(
                                        function (id) {
                                            return id !== device.id;
                                        }
                                    );

                            } else {

                                adjustmentSelectedTruckIds.push(
                                    device.id
                                );
                            }

                            renderAdjustmentTrucks();
                        }
                    );

                    board.appendChild(button);
                }
            );
    }


    function saveAdjustment() {

        if (!adjustmentTaskId) {
            return;
        }

        /*
        如果选择了新挖机，必须至少选择一辆卡车。
        */

        if (
            adjustmentSelectedExcavatorId
        ) {

            if (
                !adjustmentSelectedTruckIds.length
            ) {

                alert(
                    "增加挖机时必须选择跟随卡车。"
                );

                return;
            }

            adjustmentBindings.push({

                excavatorId:
                    adjustmentSelectedExcavatorId,

                truckIds:
                    adjustmentSelectedTruckIds.slice()
            });
        }


        const tasks =
            getTasks();

        const index =
            tasks.findIndex(
                function (item) {

                    return (
                        item.taskId ===
                        adjustmentTaskId
                    );
                }
            );

        if (index < 0) {
            return;
        }

        const task =
            tasks[index];

        const before =
            deepClone(
                task.bindings || []
            );

        const after =
            deepClone(
                adjustmentBindings
            );


        if (
            JSON.stringify(
                normalizeBindings(before)
            ) ===
            JSON.stringify(
                normalizeBindings(after)
            )
        ) {

            alert(
                "设备没有发生变化。"
            );

            return;
        }


        task.bindings =
            after;


        task.equipmentAdjustments =
            task.equipmentAdjustments ||
            [];


        task.equipmentAdjustments.push({

            adjustmentId:
                "ADJ_" + Date.now(),

            time:
                new Date().toISOString(),

            summary:
                buildAdjustmentSummary(
                    before,
                    after
                ),

            beforeBindings:
                before,

            afterBindings:
                after
        });


        tasks[index] =
            task;

        saveTasks(tasks);


        closeAdjustment();

        renderProductionBoard();

        openPublishedTask(
            adjustmentTaskId
        );
    }


    function closeAdjustment() {

        hideModal(
            "adjustTaskModal"
        );

        adjustmentTaskId = null;

        adjustmentBindings = [];

        adjustmentSelectedExcavatorId = null;

        adjustmentSelectedTruckIds = [];
    }


    function buildAdjustmentSummary(
        before,
        after
    ) {

        const beforeExcavators =
            new Set(
                before.map(
                    function (item) {
                        return item.excavatorId;
                    }
                )
            );

        const afterExcavators =
            new Set(
                after.map(
                    function (item) {
                        return item.excavatorId;
                    }
                )
            );

        const added =
            [...afterExcavators]
                .filter(
                    function (id) {
                        return !beforeExcavators.has(id);
                    }
                );

        const removed =
            [...beforeExcavators]
                .filter(
                    function (id) {
                        return !afterExcavators.has(id);
                    }
                );

        const parts = [];

        if (added.length) {

            parts.push(
                "增加挖机：" +
                added.join("、")
            );
        }

        if (removed.length) {

            parts.push(
                "减少挖机：" +
                removed.join("、")
            );
        }

        if (!parts.length) {

            parts.push(
                "调整卡车绑定关系"
            );
        }

        return parts.join("；");
    }


    /*
    ===================================================
    调度待办中心
    ===================================================
    */

    function renderTodoCenter() {

        const changeRequests =
            getChangeRequests()
                .filter(
                    function (item) {
                        return item.status === "pending";
                    }
                );


        const gpsRecords =
            getTrips()
                .filter(
                    isGpsPendingReview
                );


        const leaveRequests =
            getLeaveRequests()
                .filter(
                    function (item) {

                        return (
                            item.status === "pending" &&
                            item.approverRole === "dispatch"
                        );
                    }
                );


        const penalties =
            getPenalties()
                .filter(
                    function (item) {

                        return (
                            item.status ===
                            "pending_acknowledgement"
                        );
                    }
                );


        setText(
            "vehicleChangeTodoCount",
            changeRequests.length
        );

        setText(
            "gpsTodoCount",
            gpsRecords.length
        );

        setText(
            "leaveTodoCount",
            leaveRequests.length
        );

        setText(
            "penaltyTodoCount",
            penalties.length
        );
    }


    /*
    ===================================================
    换车审批
    ===================================================
    */

    function getChangeRequests() {

        const value =
            readJson(
                STORAGE.CHANGE_REQUESTS,
                []
            );

        return Array.isArray(value)
            ? value
            : [];
    }


    function saveChangeRequests(
        records
    ) {

        localStorage.setItem(
            STORAGE.CHANGE_REQUESTS,
            JSON.stringify(records)
        );
    }


    function openVehicleChangeModal() {

        renderVehicleChangeRequests();

        showModal(
            "vehicleChangeModal"
        );
    }


    function renderVehicleChangeRequests() {

        const requests =
            getChangeRequests()
                .filter(
                    function (item) {
                        return item.status === "pending";
                    }
                )
                .sort(
                    function (a, b) {

                        return new Date(
                            b.requestedAt || 0
                        ) -
                        new Date(
                            a.requestedAt || 0
                        );
                    }
                );


        const box =
            $("vehicleChangeRequestList");


        if (!requests.length) {

            box.innerHTML =
                '<div class="empty-placeholder">当前没有待审批换车申请</div>';

            return;
        }


        const availableTrucks =
            getAvailableReplacementTrucks();


        box.innerHTML =
            requests.map(
                function (request) {

                    return `
                        <div class="approval-card">

                            <div class="approval-card-title">

                                <div>
                                    <strong>
                                        ${escapeHtml(request.driverName || "-")}
                                    </strong>

                                    <span>
                                        ${escapeHtml(request.oldVehicleNumber || "-")}
                                    </span>
                                </div>

                                <span class="pending-pill">
                                    待审批
                                </span>

                            </div>


                            <div class="approval-detail-grid">

                                <div>
                                    <span>任务ID</span>
                                    <strong>
                                        ${escapeHtml(request.taskId || "-")}
                                    </strong>
                                </div>

                                <div>
                                    <span>申请时间</span>
                                    <strong>
                                        ${formatDateTime(request.requestedAt)}
                                    </strong>
                                </div>

                            </div>


                            <div class="approval-reason">
                                <strong>故障原因：</strong>
                                ${escapeHtml(request.reason || "-")}
                            </div>


                            <label>
                                指定替换车辆
                            </label>

                            <select
                                data-change-select="${escapeHtml(request.requestId)}"
                            >

                                <option value="">
                                    选择车辆
                                </option>

                                ${availableTrucks.map(
                                    function (truck) {

                                        return `
                                            <option value="${escapeHtml(truck.id)}">
                                                ${escapeHtml(truck.id)}
                                            </option>
                                        `;
                                    }
                                ).join("")}

                            </select>


                            <div class="approval-buttons">

                                <button
                                    type="button"
                                    class="success-button"
                                    data-approve-change="${escapeHtml(request.requestId)}"
                                >
                                    批准换车
                                </button>

                                <button
                                    type="button"
                                    class="danger-button"
                                    data-reject-change="${escapeHtml(request.requestId)}"
                                >
                                    驳回
                                </button>

                            </div>

                        </div>
                    `;
                }
            ).join("");


        box.querySelectorAll(
            "[data-approve-change]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        approveVehicleChange(
                            button.dataset.approveChange
                        );
                    }
                );
            }
        );


        box.querySelectorAll(
            "[data-reject-change]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        rejectVehicleChange(
                            button.dataset.rejectChange
                        );
                    }
                );
            }
        );
    }


    function approveVehicleChange(
        requestId
    ) {

        const select =
            document.querySelector(
                '[data-change-select="' +
                CSS.escape(requestId) +
                '"]'
            );

        const newVehicle =
            select
                ?.value;

        if (!newVehicle) {

            alert(
                "请选择替换车辆。"
            );

            return;
        }


        const available =
            getAvailableReplacementTrucks()
                .some(
                    function (truck) {
                        return truck.id === newVehicle;
                    }
                );


        if (!available) {

            alert(
                "该车辆当前已不可调配，请重新选择。"
            );

            renderVehicleChangeRequests();

            return;
        }


        if (
            !confirm(
                "确认批准换车？\n\n" +
                "新车辆：" +
                newVehicle
            )
        ) {
            return;
        }


        const requests =
            getChangeRequests();

        const index =
            requests.findIndex(
                function (item) {

                    return (
                        item.requestId ===
                        requestId
                    );
                }
            );


        if (index < 0) {
            return;
        }


        requests[index].status =
            "approved";

        requests[index].approvedVehicleId =
            newVehicle;

        requests[index].approvedVehicleNumber =
            newVehicle;

        requests[index].approvedAt =
            new Date().toISOString();

        requests[index].approvedBy =
            "调度";


        requests[index].timeline =
            requests[index].timeline || [];


        requests[index].timeline.push({

            time:
                new Date().toISOString(),

            action:
                "调度批准换车",

            detail:
                (
                    requests[index].oldVehicleNumber ||
                    "-"
                ) +
                " → " +
                newVehicle
        });


        saveChangeRequests(
            requests
        );


        renderVehicleChangeRequests();

        renderTodoCenter();

        alert(
            "换车申请已批准。\n司机端领取新车辆后可继续原任务。"
        );
    }


    function rejectVehicleChange(
        requestId
    ) {

        const reason =
            prompt(
                "请输入驳回原因："
            );

        if (reason === null) {
            return;
        }

        const requests =
            getChangeRequests();

        const index =
            requests.findIndex(
                function (item) {
                    return item.requestId === requestId;
                }
            );

        if (index < 0) {
            return;
        }


        requests[index].status =
            "rejected";

        requests[index].rejectReason =
            reason.trim() ||
            "调度未批准";

        requests[index].rejectedAt =
            new Date().toISOString();

        requests[index].rejectedBy =
            "调度";


        saveChangeRequests(
            requests
        );

        renderVehicleChangeRequests();

        renderTodoCenter();
    }


    function getAvailableReplacementTrucks() {

        const occupied =
            getOccupiedDeviceIds();

        return equipment.trucks
            .filter(
                function (truck) {

                    return (
                        truck.status !== "maintenance" &&
                        !occupied.has(truck.id)
                    );
                }
            );
    }


    /*
    ===================================================
    GPS异常趟次审核
    ===================================================
    */

    function getTrips() {

        const trips =
            readJson(
                STORAGE.TRIPS,
                []
            );

        return Array.isArray(trips)
            ? trips
            : [];
    }


    function saveTrips(
        trips
    ) {

        localStorage.setItem(
            STORAGE.TRIPS,
            JSON.stringify(trips)
        );
    }


    function isGpsPendingReview(
        record
    ) {

        const abnormal =
            record.gpsStatus !== "正常" &&
            record.gpsStatus !== "normal";

        const notProcessed =
            record.dispatchConfirmation !== "confirmed" &&
            record.dispatchConfirmation !== "rejected" &&
            record.dispatchConfirmation !== "已确认有效" &&
            record.dispatchConfirmation !== "已判定无效";

        return (
            abnormal &&
            notProcessed
        );
    }


    function openGpsReviewModal() {

        renderGpsReviewList();

        showModal(
            "gpsReviewModal"
        );
    }


    function renderGpsReviewList() {

        const records =
            getTrips()
                .filter(
                    isGpsPendingReview
                )
                .sort(
                    function (a, b) {

                        return new Date(
                            b.completedAt || 0
                        ) -
                        new Date(
                            a.completedAt || 0
                        );
                    }
                );


        const box =
            $("gpsReviewList");


        if (!records.length) {

            box.innerHTML =
                '<div class="empty-placeholder">没有待审核GPS异常趟次</div>';

            return;
        }


        box.innerHTML =
            records.map(
                function (record) {

                    return `
                        <div class="approval-card">

                            <div class="approval-card-title">

                                <div>
                                    <strong>
                                        ${escapeHtml(record.driverName || "-")}
                                    </strong>

                                    <span>
                                        ${escapeHtml(record.vehicleNumber || "-")}
                                    </span>
                                </div>

                                <span class="warning-pill">
                                    GPS异常
                                </span>

                            </div>


                            <div class="approval-detail-grid">

                                <div>
                                    <span>作业区域</span>
                                    <strong>
                                        ${escapeHtml(record.workArea || "-")}
                                    </strong>
                                </div>

                                <div>
                                    <span>挖机</span>
                                    <strong>
                                        ${escapeHtml(record.excavatorNumber || record.excavatorId || "-")}
                                    </strong>
                                </div>

                                <div>
                                    <span>GPS状态</span>
                                    <strong>
                                        ${escapeHtml(record.gpsStatus || "异常")}
                                    </strong>
                                </div>

                                <div>
                                    <span>精度</span>
                                    <strong>
                                        ${
                                            record.gpsAccuracy
                                                ? "±" +
                                                  escapeHtml(record.gpsAccuracy) +
                                                  "米"
                                                : "无定位"
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>完成时间</span>
                                    <strong>
                                        ${formatDateTime(record.completedAt)}
                                    </strong>
                                </div>

                            </div>


                            <div class="approval-buttons">

                                <button
                                    type="button"
                                    class="success-button"
                                    data-confirm-trip="${escapeHtml(getTripId(record))}"
                                >
                                    确认有效
                                </button>

                                <button
                                    type="button"
                                    class="danger-button"
                                    data-reject-trip="${escapeHtml(getTripId(record))}"
                                >
                                    判定无效
                                </button>

                            </div>

                        </div>
                    `;
                }
            ).join("");


        box.querySelectorAll(
            "[data-confirm-trip]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        reviewGpsTrip(
                            button.dataset.confirmTrip,
                            true
                        );
                    }
                );
            }
        );


        box.querySelectorAll(
            "[data-reject-trip]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        reviewGpsTrip(
                            button.dataset.rejectTrip,
                            false
                        );
                    }
                );
            }
        );
    }


    function reviewGpsTrip(
        tripId,
        approved
    ) {

        const note =
            prompt(
                approved
                    ? "调度确认备注（可不填）："
                    : "请输入判定无效原因："
            );

        if (note === null) {
            return;
        }


        const trips =
            getTrips();

        const index =
            trips.findIndex(
                function (item) {

                    return (
                        getTripId(item) ===
                        tripId
                    );
                }
            );

        if (index < 0) {
            return;
        }


        trips[index].dispatchConfirmation =
            approved
                ? "confirmed"
                : "rejected";


        trips[index].officialCountEligible =
            approved;


        trips[index].dispatchReviewedAt =
            new Date().toISOString();


        trips[index].dispatchReviewedBy =
            "调度";


        trips[index].dispatchReviewNote =
            note.trim();


        saveTrips(trips);


        renderGpsReviewList();

        renderTodoCenter();

        renderProductionBoard();
    }


    /*
    ===================================================
    请假审批
    ===================================================
    */

    function getLeaveRequests() {

        const data =
            readJson(
                STORAGE.LEAVE_REQUESTS,
                []
            );

        return Array.isArray(data)
            ? data
            : [];
    }


    function saveLeaveRequests(
        records
    ) {

        localStorage.setItem(
            STORAGE.LEAVE_REQUESTS,
            JSON.stringify(records)
        );
    }


    function openLeaveReviewModal() {

        renderLeaveReviewList();

        showModal(
            "leaveReviewModal"
        );
    }


    function renderLeaveReviewList() {

        const requests =
            getLeaveRequests()
                .filter(
                    function (item) {

                        return (
                            item.status === "pending" &&
                            item.approverRole === "dispatch"
                        );
                    }
                )
                .sort(
                    function (a, b) {

                        return new Date(
                            b.submittedAt || 0
                        ) -
                        new Date(
                            a.submittedAt || 0
                        );
                    }
                );


        const box =
            $("leaveReviewList");


        if (!requests.length) {

            box.innerHTML =
                '<div class="empty-placeholder">当前没有一线人员请假待审批</div>';

            return;
        }


        box.innerHTML =
            requests.map(
                function (item) {

                    return `
                        <div class="approval-card">

                            <div class="approval-card-title">

                                <div>
                                    <strong>
                                        ${escapeHtml(item.applicantName || "-")}
                                    </strong>

                                    <span>
                                        ${escapeHtml(item.position || "-")}
                                        ·
                                        ${escapeHtml(item.team || "-")}
                                    </span>
                                </div>

                                <span class="pending-pill">
                                    待审批
                                </span>

                            </div>


                            <div class="approval-detail-grid">

                                <div>
                                    <span>类型</span>
                                    <strong>
                                        ${escapeHtml(item.leaveType || "-")}
                                    </strong>
                                </div>

                                <div>
                                    <span>开始</span>
                                    <strong>
                                        ${formatDateTime(item.startTime)}
                                    </strong>
                                </div>

                                <div>
                                    <span>结束</span>
                                    <strong>
                                        ${formatDateTime(item.endTime)}
                                    </strong>
                                </div>

                            </div>


                            <div class="approval-reason">
                                <strong>原因：</strong>
                                ${escapeHtml(item.reason || "-")}
                            </div>


                            <div class="approval-buttons">

                                <button
                                    type="button"
                                    class="success-button"
                                    data-approve-leave="${escapeHtml(item.leaveId)}"
                                >
                                    批准请假
                                </button>

                                <button
                                    type="button"
                                    class="danger-button"
                                    data-reject-leave="${escapeHtml(item.leaveId)}"
                                >
                                    驳回
                                </button>

                            </div>

                        </div>
                    `;
                }
            ).join("");


        box.querySelectorAll(
            "[data-approve-leave]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        processLeaveRequest(
                            button.dataset.approveLeave,
                            true
                        );
                    }
                );
            }
        );


        box.querySelectorAll(
            "[data-reject-leave]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        processLeaveRequest(
                            button.dataset.rejectLeave,
                            false
                        );
                    }
                );
            }
        );
    }


    function processLeaveRequest(
        leaveId,
        approved
    ) {

        const remark =
            prompt(
                approved
                    ? "审批备注（可不填）："
                    : "请输入驳回原因："
            );

        if (remark === null) {
            return;
        }


        const records =
            getLeaveRequests();

        const index =
            records.findIndex(
                function (item) {
                    return item.leaveId === leaveId;
                }
            );

        if (index < 0) {
            return;
        }


        records[index].status =
            approved
                ? "approved"
                : "rejected";


        records[index].approvedBy =
            "调度";


        records[index].approvedAt =
            new Date().toISOString();


        records[index].approvalRemark =
            remark.trim();


        saveLeaveRequests(
            records
        );


        renderLeaveReviewList();

        renderTodoCenter();
    }


    /*
    ===================================================
    调度 / 管理人员请假
    ===================================================
    */

    function openMyLeaveModal() {

        const profile =
            readJson(
                STORAGE.DISPATCH_PROFILE,
                null
            );


        if (profile) {

            $("leaveApplicantName").value =
                profile.name || "";

            $("leaveApplicantPosition").value =
                profile.position || "调度员";
        }


        showModal(
            "myLeaveModal"
        );
    }


    function submitMyLeave() {

        const name =
            $("leaveApplicantName")
                .value
                .trim();

        const position =
            $("leaveApplicantPosition")
                .value
                .trim();

        const type =
            $("leaveType").value;

        const start =
            $("leaveStart").value;

        const end =
            $("leaveEnd").value;

        const reason =
            $("leaveReason")
                .value
                .trim();


        if (
            !name ||
            !position ||
            !start ||
            !end ||
            !reason
        ) {

            alert(
                "请完整填写请假申请。"
            );

            return;
        }


        if (
            new Date(end) <=
            new Date(start)
        ) {

            alert(
                "结束时间必须晚于开始时间。"
            );

            return;
        }


        localStorage.setItem(
            STORAGE.DISPATCH_PROFILE,
            JSON.stringify({
                name,
                position
            })
        );


        const records =
            getLeaveRequests();


        records.push({

            leaveId:
                "LEAVE_" + Date.now(),

            applicantId:
                "DISPATCH_" + name,

            applicantName:
                name,

            position,

            team:
                "调度 / 管理",

            employeeLevel:
                "management",

            leaveType:
                type,

            startTime:
                new Date(start)
                    .toISOString(),

            endTime:
                new Date(end)
                    .toISOString(),

            reason,

            status:
                "pending",

            approverRole:
                "general_manager",

            approvalLevel:
                "总经理审批",

            submittedAt:
                new Date().toISOString()
        });


        saveLeaveRequests(
            records
        );


        hideModal(
            "myLeaveModal"
        );


        $("leaveStart").value = "";

        $("leaveEnd").value = "";

        $("leaveReason").value = "";


        alert(
            "请假申请已提交。\n审批人：总经理。"
        );
    }


    /*
    ===================================================
    罚单
    ===================================================
    */

    function getPenalties() {

        const value =
            readJson(
                STORAGE.PENALTIES,
                []
            );

        return Array.isArray(value)
            ? value
            : [];
    }


    function savePenalties(
        records
    ) {

        localStorage.setItem(
            STORAGE.PENALTIES,
            JSON.stringify(records)
        );
    }


    function populatePenaltyPersonnel() {

        const select =
            $("penaltyPerson");

        if (!select) {
            return;
        }


        const records =
            getPersonnelRecords();


        select.innerHTML =
            '<option value="">选择人员</option>';


        records.forEach(
            function (person) {

                const option =
                    document.createElement("option");

                option.value =
                    person.driverId ||
                    person.employeeId ||
                    person.name;

                option.dataset.name =
                    person.name || "";

                option.dataset.position =
                    person.position || "";

                option.dataset.team =
                    person.team || "";

                option.textContent =
                    (
                        person.name || "未命名"
                    ) +
                    " · " +
                    (
                        person.position || "-"
                    );

                select.appendChild(option);
            }
        );
    }


    function openPenaltyModal() {

        populatePenaltyPersonnel();

        showModal(
            "penaltyModal"
        );
    }


    function submitPenalty() {

        const select =
            $("penaltyPerson");

        const selected =
            select.options[
                select.selectedIndex
            ];


        if (
            !select.value
        ) {

            alert(
                "请选择被处罚人员。"
            );

            return;
        }


        const description =
            $("penaltyDescription")
                .value
                .trim();


        if (!description) {

            alert(
                "请输入违规说明。"
            );

            return;
        }


        const records =
            getPenalties();


        records.push({

            penaltyId:
                "PENALTY_" + Date.now(),

            personId:
                select.value,

            personName:
                selected.dataset.name || "",

            position:
                selected.dataset.position || "",

            team:
                selected.dataset.team || "",

            vehicleNumber:
                $("penaltyVehicle")
                    .value
                    .trim(),

            violationType:
                $("penaltyType").value,

            amount:
                Number(
                    $("penaltyAmount").value || 0
                ),

            points:
                Number(
                    $("penaltyPoints").value || 0
                ),

            description,

            issuedBy:
                "调度",

            issuedAt:
                new Date().toISOString(),

            status:
                "pending_acknowledgement",

            acknowledgedAt:
                null,

            processedAt:
                null
        });


        savePenalties(records);


        hideModal(
            "penaltyModal"
        );


        $("penaltyVehicle").value = "";

        $("penaltyAmount").value = "";

        $("penaltyPoints").value = "";

        $("penaltyDescription").value = "";


        renderTodoCenter();


        alert(
            "罚单已经下达。\n员工端将显示“待确认”。"
        );
    }


    function openPenaltyManagerModal() {

        renderPenaltyManager();

        showModal(
            "penaltyManagerModal"
        );
    }


    function renderPenaltyManager() {

        const records =
            getPenalties()
                .slice()
                .sort(
                    function (a, b) {

                        return new Date(
                            b.issuedAt || 0
                        ) -
                        new Date(
                            a.issuedAt || 0
                        );
                    }
                );


        const box =
            $("penaltyManagerList");


        if (!records.length) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无罚单记录</div>';

            return;
        }


        box.innerHTML =
            records.map(
                function (item) {

                    const statusText =
                        item.status === "acknowledged"
                            ? "已知晓"
                            : item.status === "processed"
                                ? "已处理"
                                : "待员工确认";


                    return `
                        <div class="approval-card">

                            <div class="approval-card-title">

                                <div>
                                    <strong>
                                        ${escapeHtml(item.personName || "-")}
                                    </strong>

                                    <span>
                                        ${escapeHtml(item.violationType || "-")}
                                    </span>
                                </div>

                                <span class="warning-pill">
                                    ${statusText}
                                </span>

                            </div>


                            <div class="approval-detail-grid">

                                <div>
                                    <span>车辆</span>
                                    <strong>
                                        ${escapeHtml(item.vehicleNumber || "-")}
                                    </strong>
                                </div>

                                <div>
                                    <span>金额</span>
                                    <strong>
                                        ¥ ${Number(item.amount || 0)}
                                    </strong>
                                </div>

                                <div>
                                    <span>扣分</span>
                                    <strong>
                                        ${Number(item.points || 0)}
                                    </strong>
                                </div>

                                <div>
                                    <span>开单时间</span>
                                    <strong>
                                        ${formatDateTime(item.issuedAt)}
                                    </strong>
                                </div>

                            </div>


                            <div class="approval-reason">
                                ${escapeHtml(item.description || "-")}
                            </div>

                        </div>
                    `;
                }
            ).join("");
    }


    /*
    ===================================================
    人员
    ===================================================
    */

    function getPersonnelRecords() {

        let records =
            readJson(
                STORAGE.PERSONNEL,
                []
            );


        if (!Array.isArray(records)) {
            records = [];
        }


        const driver =
            readJson(
                STORAGE.DRIVER_PROFILE,
                null
            );


        if (
            driver &&
            driver.name &&
            !records.some(
                function (item) {
                    return (
                        item.driverId &&
                        item.driverId ===
                        driver.driverId
                    );
                }
            )
        ) {

            records.push(driver);
        }


        return records;
    }


    /*
    ===================================================
    设备显示工具
    ===================================================
    */

    function getDeviceClass(
        device,
        occupied,
        selected
    ) {

        if (selected) {
            return "device-card device-draft";
        }

        if (
            device.status ===
            "maintenance"
        ) {
            return "device-card device-maintenance";
        }

        if (
            occupied.has(device.id)
        ) {
            return "device-card device-assigned";
        }

        return "device-card device-available";
    }


    function getDeviceStatusText(
        device,
        occupied,
        selected
    ) {

        if (selected) {
            return "✓ 已选择";
        }

        if (
            device.status ===
            "maintenance"
        ) {
            return "维修中";
        }

        if (
            occupied.has(device.id)
        ) {
            return "已分配";
        }

        return "可调配";
    }


    /*
    ===================================================
    数据工具
    ===================================================
    */

    function getTasks() {

        const tasks =
            readJson(
                STORAGE.TASKS,
                []
            );

        return Array.isArray(tasks)
            ? tasks
            : [];
    }


    function saveTasks(
        tasks
    ) {

        localStorage.setItem(
            STORAGE.TASKS,
            JSON.stringify(tasks)
        );
    }


    function getTaskById(
        taskId
    ) {

        return getTasks()
            .find(
                function (task) {
                    return task.taskId === taskId;
                }
            ) || null;
    }


    function getTaskTrips(
        task
    ) {

        if (!task) {
            return [];
        }

        const taskId =
            task.taskId ||
            task.id;

        return getTrips()
            .filter(
                function (trip) {

                    return (
                        trip.taskId === taskId ||
                        trip.dispatchTaskId === taskId ||
                        trip.productionTaskId === taskId
                    );
                }
            );
    }


    function getTripId(
        record
    ) {

        return (
            record.tripId ||
            record.id ||
            ""
        );
    }


    function getTaskDateKey(
        task
    ) {

        if (task.dateKey) {
            return task.dateKey;
        }

        if (task.publishedAt) {

            const date =
                new Date(
                    task.publishedAt
                );

            return (
                date.getFullYear() +
                "-" +
                String(
                    date.getMonth() + 1
                ).padStart(2, "0") +
                "-" +
                String(
                    date.getDate()
                ).padStart(2, "0")
            );
        }

        return "";
    }


    function getLocalDateKey() {

        const date =
            new Date();

        return (
            date.getFullYear() +
            "-" +
            String(
                date.getMonth() + 1
            ).padStart(2, "0") +
            "-" +
            String(
                date.getDate()
            ).padStart(2, "0")
        );
    }


    /*
    ===================================================
    UI工具
    ===================================================
    */

    function showModal(
        id
    ) {

        $(id)
            ?.classList
            .remove("hidden");

        document.body
            .classList
            .add("modal-open");
    }


    function hideModal(
        id
    ) {

        $(id)
            ?.classList
            .add("hidden");

        document.body
            .classList
            .remove("modal-open");
    }


    function setText(
        id,
        value
    ) {

        const element =
            $(id);

        if (element) {
            element.textContent = value;
        }
    }


    function readJson(
        key,
        fallback
    ) {

        try {

            const value =
                localStorage.getItem(key);

            if (!value) {
                return fallback;
            }

            return JSON.parse(value);

        } catch (error) {

            console.error(
                "读取数据失败：",
                key,
                error
            );

            return fallback;
        }
    }


    function deepClone(
        value
    ) {

        return JSON.parse(
            JSON.stringify(value)
        );
    }


    function normalizeBindings(
        value
    ) {

        return (value || [])
            .map(
                function (item) {

                    return {
                        excavatorId:
                            item.excavatorId,

                        truckIds:
                            (item.truckIds || [])
                                .slice()
                                .sort()
                    };
                }
            )
            .sort(
                function (a, b) {

                    return String(a.excavatorId)
                        .localeCompare(
                            String(b.excavatorId)
                        );
                }
            );
    }


    function formatTime(
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

        return date.toLocaleTimeString(
            "zh-CN",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
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

});
