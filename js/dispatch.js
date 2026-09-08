/*
========================================================
矿山管理系统
调度端 V2.9.3
人员调度 + 总经理审批版
========================================================
*/

document.addEventListener("DOMContentLoaded", function () {

    const STORAGE = {
        TASKS: "dispatchPublishedTasks",
        LEGACY_TASK: "publishedDispatchTask",
        TRIPS: "driverTripRecords",
        PERSONNEL: "personnelRecords",
        DRIVER_PROFILE: "driverProfile",
        DRIVER_CURRENT_TASK: "driverCurrentTask",
        CHANGE_REQUESTS: "driverVehicleChangeRequests",
        LEAVES: "leaveRequests",
        PENALTIES: "penaltyRecords",
        DISPATCH_PROFILE: "dispatchUserProfile"
    };

    const $ = id => document.getElementById(id);

    const equipment = {

        excavators: [
            { id: "EX-01", status: "available" },
            { id: "EX-02", status: "available" },
            { id: "EX-03", status: "maintenance", reason: "液压系统维修" },
            { id: "EX-04", status: "available" },
            { id: "EX-05", status: "available" },
            { id: "EX-06", status: "available" }
        ],

        trucks: Array.from({ length: 20 }, (_, index) => {

            const id =
                "T-" +
                String(index + 1).padStart(3, "0");

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
        }),

        loader: [
            { id: "L-01", status: "available" },
            { id: "L-02", status: "available" },
            { id: "L-03", status: "available" },
            { id: "L-04", status: "maintenance" }
        ],

        water: [
            { id: "W-01", status: "available" },
            { id: "W-02", status: "maintenance" },
            { id: "W-03", status: "available" }
        ],

        fuel: [
            { id: "F-01", status: "available" },
            { id: "F-02", status: "available" }
        ],

        grader: [
            { id: "G-01", status: "available" },
            { id: "G-02", status: "maintenance" }
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


    let currentDraft = null;

    let bindings = [];

    let driverAssignments = [];

    let auxiliaryAssignments = [];

    let selectedExcavatorId = null;

    let selectedTruckIds = [];

    let openedTaskId = null;


    init();


    function init() {

        migrateTasks();

        setAutomaticShift();

        bindEvents();

        refreshAll();

        setInterval(
            refreshAll,
            5000
        );
    }


    function bindEvents() {

        $("newTaskButton")?.addEventListener(
            "click",
            openTaskCreate
        );

        $("cancelCreateButton")?.addEventListener(
            "click",
            cancelDraft
        );

        $("generateTaskButton")?.addEventListener(
            "click",
            generateDraft
        );

        $("bindTrucksButton")?.addEventListener(
            "click",
            bindSelectedTrucks
        );

        $("publishTaskButton")?.addEventListener(
            "click",
            publishTask
        );

        $("historyTaskButton")?.addEventListener(
            "click",
            toggleHistory
        );

        $("historyDateFilter")?.addEventListener(
            "change",
            renderHistory
        );

        $("historyShiftFilter")?.addEventListener(
            "change",
            renderHistory
        );

        $("historyAreaFilter")?.addEventListener(
            "input",
            renderHistory
        );

        $("resetHistoryFilterButton")?.addEventListener(
            "click",
            function () {

                $("historyDateFilter").value = "";

                $("historyShiftFilter").value = "";

                $("historyAreaFilter").value = "";

                renderHistory();
            }
        );


        $("auxiliaryTypeSelect")?.addEventListener(
            "change",
            renderAuxiliaryVehicles
        );

        $("addAuxiliaryButton")?.addEventListener(
            "click",
            addAuxiliary
        );


        $("closePublishedTaskModalButton")?.addEventListener(
            "click",
            () => hideModal("publishedTaskModal")
        );

        $("withdrawPublishedTaskButton")?.addEventListener(
            "click",
            withdrawOpenedTask
        );

        $("completePublishedTaskButton")?.addEventListener(
            "click",
            completeOpenedTask
        );


        $("openVehicleChangeButton")?.addEventListener(
            "click",
            openVehicleChanges
        );

        $("closeVehicleChangeModal")?.addEventListener(
            "click",
            () => hideModal("vehicleChangeModal")
        );


        $("openGpsReviewButton")?.addEventListener(
            "click",
            openGpsReview
        );

        $("closeGpsReviewModal")?.addEventListener(
            "click",
            () => hideModal("gpsReviewModal")
        );


        $("openLeaveReviewButton")?.addEventListener(
            "click",
            openLeaveReview
        );

        $("closeLeaveReviewModal")?.addEventListener(
            "click",
            () => hideModal("leaveReviewModal")
        );


        $("myLeaveButton")?.addEventListener(
            "click",
            openMyLeave
        );

        $("closeMyLeaveModal")?.addEventListener(
            "click",
            () => hideModal("myLeaveModal")
        );

        $("submitMyLeaveButton")?.addEventListener(
            "click",
            submitMyLeave
        );


        $("issuePenaltyButton")?.addEventListener(
            "click",
            openPenalty
        );

        $("closePenaltyModal")?.addEventListener(
            "click",
            () => hideModal("penaltyModal")
        );

        $("submitPenaltyButton")?.addEventListener(
            "click",
            submitPenalty
        );

        $("openPenaltyManagerButton")?.addEventListener(
            "click",
            openPenaltyManager
        );

        $("closePenaltyManagerModal")?.addEventListener(
            "click",
            () => hideModal("penaltyManagerModal")
        );
    }


    /*
    ========================================================
    刷新
    ========================================================
    */

    function refreshAll() {

        synchronizeTaskStatus();

        renderProductionBoard();

        renderHistory();

        renderPersonnelStatusBoard();

        renderTodoCounts();

        populatePenaltyPersonnel();

        if (currentDraft) {

            renderDriverAssignments();

            renderExcavators();

            renderTrucks();

            renderAuxiliaryVehicles();
        }
    }


    /*
    ========================================================
    草稿任务
    ========================================================
    */

    function openTaskCreate() {

        $("taskCreateSection")
            .classList
            .remove("hidden");

        $("taskCreateSection")
            .scrollIntoView({
                behavior: "smooth"
            });
    }


    function setAutomaticShift() {

        const hour =
            new Date().getHours();

        $("taskShift").value =
            hour >= 8 && hour < 20
                ? "白班"
                : "夜班";
    }


    function generateDraft() {

        const area =
            $("taskArea").value.trim();

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
                new Date().toLocaleDateString("zh-CN"),

            shift:
                $("taskShift").value,

            area,

            loadingPoint:
                $("taskLoadingPoint").value.trim(),

            unloadingPoint:
                $("taskUnloadingPoint").value.trim(),

            remark:
                $("taskRemark").value.trim(),

            createdAt:
                new Date().toISOString()
        };

        bindings = [];

        driverAssignments = [];

        auxiliaryAssignments = [];

        selectedExcavatorId = null;

        selectedTruckIds = [];

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

        [
            "taskSummarySection",
            "excavatorSection",
            "truckSection",
            "bindingSection",
            "driverAssignmentSection",
            "auxiliarySection",
            "publishSection"
        ].forEach(
            id => $(id).classList.remove("hidden")
        );

        renderExcavators();

        renderTrucks();

        renderBindings();

        renderDriverAssignments();

        renderAuxiliaryVehicles();

        renderAuxiliaryAssignments();
    }


    function cancelDraft() {

        currentDraft = null;

        bindings = [];

        driverAssignments = [];

        auxiliaryAssignments = [];

        selectedExcavatorId = null;

        selectedTruckIds = [];

        [
            "taskCreateSection",
            "taskSummarySection",
            "excavatorSection",
            "truckSection",
            "bindingSection",
            "driverAssignmentSection",
            "auxiliarySection",
            "publishSection"
        ].forEach(
            id => $(id).classList.add("hidden")
        );
    }


    /*
    ========================================================
    设备
    ========================================================
    */

    function getOccupiedEquipmentIds(ignoreTaskId = "") {

        const set =
            new Set();

        getTasks()
            .filter(
                task =>
                    task.taskId !== ignoreTaskId &&
                    (
                        task.status === "pending" ||
                        task.status === "active"
                    )
            )
            .forEach(
                task => {

                    (task.bindings || []).forEach(
                        binding => {

                            set.add(
                                binding.excavatorId
                            );

                            (binding.truckIds || []).forEach(
                                id => set.add(id)
                            );
                        }
                    );

                    (task.auxiliaryAssignments || []).forEach(
                        item => set.add(item.vehicleId)
                    );
                }
            );

        return set;
    }


    function renderExcavators() {

        if (!currentDraft) {
            return;
        }

        const board =
            $("excavatorBoard");

        const occupied =
            getOccupiedEquipmentIds();

        board.innerHTML = "";

        equipment.excavators.forEach(
            device => {

                const selected =
                    selectedExcavatorId === device.id;

                const usedInDraft =
                    bindings.some(
                        item =>
                            item.excavatorId === device.id
                    );

                const button =
                    document.createElement("button");

                button.type = "button";

                button.className =
                    getDeviceClass(
                        device,
                        occupied,
                        selected,
                        usedInDraft
                    );

                button.innerHTML =
                    `<strong>${escapeHtml(device.id)}</strong>
                     <span>${
                         usedInDraft
                             ? "本任务已用"
                             : selected
                                 ? "已选择"
                                 : device.status === "maintenance"
                                     ? "维修中"
                                     : occupied.has(device.id)
                                         ? "已分配"
                                         : "可调配"
                     }</span>`;

                button.disabled =
                    usedInDraft;

                button.addEventListener(
                    "click",
                    function () {

                        if (device.status === "maintenance") {

                            alert(
                                device.id +
                                " 正在维修。"
                            );

                            return;
                        }

                        if (occupied.has(device.id)) {

                            alert(
                                device.id +
                                " 已被其他生产任务使用。"
                            );

                            return;
                        }

                        selectedExcavatorId =
                            selected
                                ? null
                                : device.id;

                        selectedTruckIds = [];

                        renderExcavators();

                        renderTrucks();
                    }
                );

                board.appendChild(button);
            }
        );
    }


    function renderTrucks() {

        if (!currentDraft) {
            return;
        }

        const board =
            $("truckBoard");

        const occupied =
            getOccupiedEquipmentIds();

        const usedInDraft =
            new Set(
                bindings.flatMap(
                    item =>
                        item.truckIds || []
                )
            );

        board.innerHTML = "";

        equipment.trucks.forEach(
            device => {

                const selected =
                    selectedTruckIds.includes(
                        device.id
                    );

                const button =
                    document.createElement("button");

                button.type = "button";

                button.className =
                    getDeviceClass(
                        device,
                        occupied,
                        selected,
                        usedInDraft.has(device.id)
                    );

                button.disabled =
                    usedInDraft.has(device.id);

                button.innerHTML =
                    `<strong>${escapeHtml(device.id)}</strong>
                     <span>${
                         usedInDraft.has(device.id)
                             ? "本任务已用"
                             : selected
                                 ? "已选择"
                                 : device.status === "maintenance"
                                     ? "维修中"
                                     : occupied.has(device.id)
                                         ? "已分配"
                                         : "可调配"
                     }</span>`;

                button.addEventListener(
                    "click",
                    function () {

                        if (!selectedExcavatorId) {

                            alert("请先选择挖机。");

                            return;
                        }

                        if (device.status === "maintenance") {

                            alert(device.id + " 正在维修。");

                            return;
                        }

                        if (occupied.has(device.id)) {

                            alert(
                                device.id +
                                " 已被其他任务使用。"
                            );

                            return;
                        }

                        if (
                            selectedTruckIds.includes(
                                device.id
                            )
                        ) {

                            selectedTruckIds =
                                selectedTruckIds.filter(
                                    id => id !== device.id
                                );

                        } else {

                            selectedTruckIds.push(
                                device.id
                            );
                        }

                        renderTrucks();
                    }
                );

                board.appendChild(button);
            }
        );


        if (selectedExcavatorId) {

            setText(
                "selectedExcavatorInfo",
                `当前挖机：${selectedExcavatorId} · 已选${selectedTruckIds.length}台卡车`
            );

            $("bindTrucksButton")
                .classList
                .remove("hidden");

        } else {

            setText(
                "selectedExcavatorInfo",
                "请先选择挖机"
            );

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

            alert("至少选择一台卡车。");

            return;
        }

        bindings.push({

            excavatorId:
                selectedExcavatorId,

            truckIds:
                [...selectedTruckIds]
        });

        selectedExcavatorId = null;

        selectedTruckIds = [];

        synchronizeDraftDriverAssignments();

        renderExcavators();

        renderTrucks();

        renderBindings();

        renderDriverAssignments();
    }


    function renderBindings() {

        const box =
            $("bindingList");

        if (!bindings.length) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无设备绑定</div>';

            return;
        }

        box.innerHTML =
            bindings.map(
                (binding, index) => `
                    <div class="binding-row">
                        <div>
                            <strong>🚜 ${escapeHtml(binding.excavatorId)}</strong>
                            <span>
                                🚚 ${(binding.truckIds || []).map(escapeHtml).join("、")}
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
                `
            ).join("");

        box.querySelectorAll(
            "[data-remove-binding]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        bindings.splice(
                            Number(button.dataset.removeBinding),
                            1
                        );

                        synchronizeDraftDriverAssignments();

                        renderBindings();

                        renderDriverAssignments();

                        renderExcavators();

                        renderTrucks();
                    }
                );
            }
        );
    }


    /*
    ========================================================
    司机分配
    ========================================================
    */

    function synchronizeDraftDriverAssignments() {

        const trucks = [];

        bindings.forEach(
            binding => {

                (binding.truckIds || []).forEach(
                    truckId => {

                        trucks.push({
                            truckId,
                            excavatorId:
                                binding.excavatorId
                        });
                    }
                );
            }
        );

        driverAssignments =
            trucks.map(
                item => {

                    const old =
                        driverAssignments.find(
                            record =>
                                record.vehicleNumber ===
                                item.truckId
                        );

                    if (old) {

                        return {
                            ...old,
                            vehicleId:
                                item.truckId,
                            vehicleNumber:
                                item.truckId,
                            excavatorId:
                                item.excavatorId,
                            excavatorNumber:
                                item.excavatorId
                        };
                    }

                    return {
                        vehicleId:
                            item.truckId,
                        vehicleNumber:
                            item.truckId,
                        excavatorId:
                            item.excavatorId,
                        excavatorNumber:
                            item.excavatorId,
                        driverId: "",
                        driverName: "",
                        team: ""
                    };
                }
            );
    }


    function renderDriverAssignments() {

        if (!currentDraft) {
            return;
        }

        synchronizeDraftDriverAssignments();

        const box =
            $("driverAssignmentList");

        const total =
            driverAssignments.length;

        const completed =
            driverAssignments.filter(
                item => item.driverId
            ).length;

        setText(
            "driverAssignmentStatus",
            `${completed} / ${total}`
        );

        if (!total) {

            box.innerHTML =
                '<div class="empty-placeholder">请先绑定挖机和卡车</div>';

            return;
        }

        const people =
            getApprovedDrivers();

        box.innerHTML =
            driverAssignments.map(
                assignment => {

                    const options =
                        people.map(
                            person => {

                                const state =
                                    getPersonStatusForDraft(
                                        person
                                    );

                                const alreadyUsed =
                                    driverAssignments.some(
                                        item =>
                                            item.driverId === person.driverId &&
                                            item.vehicleNumber !==
                                            assignment.vehicleNumber
                                    );

                                const disabled =
                                    state.code === "leave" ||
                                    state.code === "working" ||
                                    state.code === "disabled" ||
                                    alreadyUsed;

                                let suffix =
                                    state.label;

                                if (alreadyUsed) {
                                    suffix = "本任务已分配";
                                }

                                return `
                                    <option
                                        value="${escapeHtml(person.driverId)}"
                                        ${
                                            assignment.driverId === person.driverId
                                                ? "selected"
                                                : ""
                                        }
                                        ${disabled ? "disabled" : ""}
                                    >
                                        ${escapeHtml(person.name || "-")}
                                        ·
                                        ${escapeHtml(person.team || "-")}
                                        ·
                                        ${escapeHtml(suffix)}
                                    </option>
                                `;
                            }
                        ).join("");

                    return `
                        <div class="driver-assignment-row">

                            <div class="assignment-equipment">
                                <strong>
                                    🚚 ${escapeHtml(assignment.vehicleNumber)}
                                </strong>

                                <span>
                                    跟随 🚜 ${escapeHtml(assignment.excavatorNumber)}
                                </span>
                            </div>

                            <select
                                data-driver-truck="${escapeHtml(assignment.vehicleNumber)}"
                            >
                                <option value="">
                                    请选择司机
                                </option>

                                ${options}
                            </select>

                        </div>
                    `;
                }
            ).join("");


        box.querySelectorAll(
            "[data-driver-truck]"
        ).forEach(
            select => {

                select.addEventListener(
                    "change",
                    function () {

                        assignDriverToTruck(
                            select.dataset.driverTruck,
                            select.value
                        );
                    }
                );
            }
        );
    }


    function assignDriverToTruck(
        truckId,
        driverId
    ) {

        const assignment =
            driverAssignments.find(
                item =>
                    item.vehicleNumber ===
                    truckId
            );

        if (!assignment) {
            return;
        }

        if (!driverId) {

            assignment.driverId = "";
            assignment.driverName = "";
            assignment.team = "";

            renderDriverAssignments();

            return;
        }

        const person =
            getApprovedDrivers().find(
                item =>
                    item.driverId === driverId
            );

        if (!person) {
            return;
        }

        const state =
            getPersonStatusForDraft(person);

        if (state.code === "leave") {

            alert(
                `${person.name} 在本班次处于已批准请假时间，不能分配任务。`
            );

            renderDriverAssignments();

            return;
        }

        if (state.code === "working") {

            alert(
                `${person.name} 已在其他生产任务中。`
            );

            renderDriverAssignments();

            return;
        }

        if (state.code === "pending") {

            const goOn =
                confirm(
                    `${person.name} 在本班次有待审批请假申请。\n\n是否仍然安排本生产任务？`
                );

            if (!goOn) {

                renderDriverAssignments();

                return;
            }
        }

        assignment.driverId =
            person.driverId;

        assignment.driverName =
            person.name || "";

        assignment.team =
            person.team || "";

        renderDriverAssignments();
    }


    /*
    ========================================================
    人员状态
    ========================================================
    */

    function renderPersonnelStatusBoard() {

        const people =
            getApprovedDrivers();

        setText(
            "personnelCountBadge",
            people.length + " 人"
        );

        const box =
            $("personnelStatusBoard");

        if (!people.length) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无已审核司机</div>';

            return;
        }

        box.innerHTML =
            people.map(
                person => {

                    const state =
                        getCurrentPersonStatus(person);

                    return `
                        <div class="person-card ${state.code}">
                            <div>
                                <strong>
                                    ${escapeHtml(person.name || "-")}
                                </strong>

                                <span>
                                    ${escapeHtml(person.team || "-")}
                                    ·
                                    ${escapeHtml(person.position || "卡车司机")}
                                </span>
                            </div>

                            <span class="person-state">
                                ${escapeHtml(state.label)}
                            </span>
                        </div>
                    `;
                }
            ).join("");
    }


    function getCurrentPersonStatus(person) {

        if (
            person.enabled === false ||
            person.status === "disabled"
        ) {
            return {
                code: "disabled",
                label: "⚫ 停用"
            };
        }

        const now =
            new Date();

        if (
            hasApprovedLeaveOverlap(
                person,
                now,
                now
            )
        ) {
            return {
                code: "leave",
                label: "🟣 请假"
            };
        }

        if (
            getPersonActiveTask(person)
        ) {
            return {
                code: "working",
                label: "🔴 作业中"
            };
        }

        if (
            hasPendingLeaveAtTime(
                person,
                now
            )
        ) {
            return {
                code: "pending",
                label: "🟡 请假待审批"
            };
        }

        return {
            code: "available",
            label: "🟢 可调度"
        };
    }


    function getPersonStatusForDraft(person) {

        if (!currentDraft) {

            return getCurrentPersonStatus(
                person
            );
        }

        if (
            person.enabled === false ||
            person.status === "disabled"
        ) {
            return {
                code: "disabled",
                label: "⚫ 停用"
            };
        }

        const range =
            getTaskDateRange(
                currentDraft
            );

        if (
            hasApprovedLeaveOverlap(
                person,
                range.start,
                range.end
            )
        ) {
            return {
                code: "leave",
                label: "🟣 本班请假"
            };
        }

        if (
            getPersonActiveTask(person)
        ) {
            return {
                code: "working",
                label: "🔴 作业中"
            };
        }

        if (
            hasPendingLeaveOverlap(
                person,
                range.start,
                range.end
            )
        ) {
            return {
                code: "pending",
                label: "🟡 请假待审批"
            };
        }

        return {
            code: "available",
            label: "🟢 可调度"
        };
    }


    function getPersonActiveTask(person) {

        return getTasks().find(
            task =>
                (
                    task.status === "pending" ||
                    task.status === "active"
                ) &&
                (task.driverAssignments || []).some(
                    item =>
                        samePerson(
                            item.driverId,
                            item.driverName,
                            person
                        )
                )
        ) || null;
    }


    /*
    ========================================================
    辅助车辆
    ========================================================
    */

    function renderAuxiliaryVehicles() {

        const type =
            $("auxiliaryTypeSelect")?.value;

        const select =
            $("auxiliaryVehicleSelect");

        if (!select) {
            return;
        }

        select.innerHTML =
            '<option value="">选择车辆</option>';

        if (
            !type ||
            !equipment[type]
        ) {
            return;
        }

        const occupied =
            getOccupiedEquipmentIds();

        equipment[type].forEach(
            vehicle => {

                const option =
                    document.createElement("option");

                option.value =
                    vehicle.id;

                const unavailable =
                    vehicle.status === "maintenance" ||
                    occupied.has(vehicle.id) ||
                    auxiliaryAssignments.some(
                        item =>
                            item.vehicleId === vehicle.id
                    );

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

                select.appendChild(option);
            }
        );
    }


    function addAuxiliary() {

        const type =
            $("auxiliaryTypeSelect").value;

        const vehicleId =
            $("auxiliaryVehicleSelect").value;

        const work =
            $("auxiliaryWorkInput").value.trim();

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

        auxiliaryAssignments.push({
            type,
            vehicleId,
            work
        });

        $("auxiliaryWorkInput").value = "";

        renderAuxiliaryAssignments();

        renderAuxiliaryVehicles();
    }


    function renderAuxiliaryAssignments() {

        const box =
            $("auxiliaryAssignmentList");

        if (!auxiliaryAssignments.length) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无辅助车辆</div>';

            return;
        }

        box.innerHTML =
            auxiliaryAssignments.map(
                (item, index) => `
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
                            class="mini-danger-button"
                            data-remove-aux="${index}"
                            type="button"
                        >
                            删除
                        </button>
                    </div>
                `
            ).join("");

        box.querySelectorAll(
            "[data-remove-aux]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        auxiliaryAssignments.splice(
                            Number(button.dataset.removeAux),
                            1
                        );

                        renderAuxiliaryAssignments();

                        renderAuxiliaryVehicles();
                    }
                );
            }
        );
    }


    /*
    ========================================================
    发布
    ========================================================
    */

    function publishTask() {

        if (!currentDraft) {
            return;
        }

        if (!bindings.length) {

            alert(
                "请至少配置一组挖机和卡车。"
            );

            return;
        }

        synchronizeDraftDriverAssignments();

        const incomplete =
            driverAssignments.filter(
                item =>
                    !item.driverId
            );

        if (incomplete.length) {

            alert(
                "以下卡车尚未分配司机：\n\n" +
                incomplete
                    .map(item => item.vehicleNumber)
                    .join("、")
            );

            return;
        }


        const duplicateDrivers =
            findDuplicateDriverIds(
                driverAssignments
            );

        if (duplicateDrivers.length) {

            alert(
                "同一司机不能同时驾驶多台卡车，请重新检查人员分配。"
            );

            return;
        }


        for (
            const assignment of
            driverAssignments
        ) {

            const person =
                getApprovedDrivers().find(
                    item =>
                        item.driverId ===
                        assignment.driverId
                );

            if (!person) {

                alert(
                    assignment.driverName +
                    " 已不在可用人员中，请重新选择。"
                );

                return;
            }

            const state =
                getPersonStatusForDraft(
                    person
                );

            if (
                state.code === "leave" ||
                state.code === "working" ||
                state.code === "disabled"
            ) {

                alert(
                    person.name +
                    " 当前状态：" +
                    state.label +
                    "，不能发布本任务。"
                );

                return;
            }
        }


        const task = {

            ...currentDraft,

            status:
                "pending",

            bindings:
                clone(bindings),

            driverAssignments:
                clone(driverAssignments)
                    .map(
                        item => ({
                            ...item,

                            loadingPoint:
                                currentDraft.loadingPoint,

                            unloadingPoint:
                                currentDraft.unloadingPoint
                        })
                    ),

            auxiliaryAssignments:
                clone(auxiliaryAssignments),

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


        syncTaskToLocalDriver(
            task
        );


        alert(
            "生产任务发布成功。\n\n" +
            `已分配 ${driverAssignments.length} 名司机。`
        );


        cancelDraft();

        clearTaskInputs();

        refreshAll();
    }


    function syncTaskToLocalDriver(task) {

        const localDriver =
            readJson(
                STORAGE.DRIVER_PROFILE,
                null
            );

        if (!localDriver) {
            return;
        }

        const assignment =
            (task.driverAssignments || [])
                .find(
                    item =>
                        samePerson(
                            item.driverId,
                            item.driverName,
                            localDriver
                        )
                );

        if (!assignment) {
            return;
        }

        const driverTask = {

            taskId:
                task.taskId,

            dispatchTaskId:
                task.taskId,

            workArea:
                task.area || "",

            shift:
                task.shift || "",

            remark:
                task.remark || "",

            vehicleNumber:
                assignment.vehicleNumber,

            vehicleId:
                assignment.vehicleId,

            excavatorNumber:
                assignment.excavatorNumber,

            excavatorId:
                assignment.excavatorId,

            loadingPoint:
                task.loadingPoint || "",

            unloadingPoint:
                task.unloadingPoint || "",

            status:
                "assigned",

            vehicleClaimed:
                false,

            createdAt:
                task.publishedAt
        };

        localStorage.setItem(
            STORAGE.DRIVER_CURRENT_TASK,
            JSON.stringify(driverTask)
        );
    }


    /*
    ========================================================
    生产任务 / 历史
    ========================================================
    */

    function synchronizeTaskStatus() {

        const tasks =
            getTasks();

        let changed = false;

        tasks.forEach(
            task => {

                if (
                    task.status !== "pending" &&
                    task.status !== "active"
                ) {
                    return;
                }

                const tripCount =
                    getTaskTrips(task)
                        .filter(
                            trip =>
                                trip.dispatchConfirmation !==
                                "rejected"
                        )
                        .length;

                if (
                    task.status === "pending" &&
                    tripCount > 0
                ) {

                    task.status = "active";

                    task.startedAt =
                        task.startedAt ||
                        new Date().toISOString();

                    changed = true;
                }
            }
        );

        if (changed) {
            saveTasks(tasks);
        }
    }


    function renderProductionBoard() {

        const tasks =
            getTasks()
                .filter(
                    task =>
                        task.status === "pending" ||
                        task.status === "active"
                )
                .sort(
                    (a, b) =>
                        new Date(b.publishedAt || 0) -
                        new Date(a.publishedAt || 0)
                );

        setText(
            "productionTaskCount",
            `${tasks.length} 个进行中任务`
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
                task => {

                    const trips =
                        getTaskTrips(task);

                    return `
                        <button
                            type="button"
                            class="production-task-card ${escapeHtml(task.status)}"
                            data-task="${escapeHtml(task.taskId)}"
                        >

                            <div class="task-card-top">
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

                                <span class="task-status-pill ${escapeHtml(task.status)}">
                                    ${
                                        task.status === "active"
                                            ? "执行中"
                                            : "待执行"
                                    }
                                </span>
                            </div>

                            <div class="task-stat-grid">
                                <div>
                                    <span>挖机</span>
                                    <strong>
                                        ${(task.bindings || []).length}
                                    </strong>
                                </div>

                                <div>
                                    <span>卡车</span>
                                    <strong>
                                        ${(task.driverAssignments || []).length}
                                    </strong>
                                </div>

                                <div>
                                    <span>司机</span>
                                    <strong>
                                        ${(task.driverAssignments || []).length}
                                    </strong>
                                </div>

                                <div>
                                    <span>趟数</span>
                                    <strong>
                                        ${trips.length}
                                    </strong>
                                </div>
                            </div>

                        </button>
                    `;
                }
            ).join("");

        board.querySelectorAll(
            "[data-task]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        openTaskDetail(
                            button.dataset.task
                        )
                );
            }
        );
    }


    function openTaskDetail(taskId) {

        const task =
            getTaskById(taskId);

        if (!task) {
            return;
        }

        openedTaskId =
            taskId;

        $("publishedTaskModalTitle")
            .textContent =
            "生产任务 · " +
            (task.area || "-");


        const driverHtml =
            (task.driverAssignments || []).length
                ?
                task.driverAssignments.map(
                    item => `
                        <div class="detail-driver-row">
                            <span>
                                🚜 ${escapeHtml(item.excavatorNumber || "-")}
                            </span>

                            <strong>
                                🚚 ${escapeHtml(item.vehicleNumber || "-")}
                            </strong>

                            <b>
                                👷 ${escapeHtml(item.driverName || "-")}
                            </b>
                        </div>
                    `
                ).join("")
                :
                '<div class="empty-placeholder">无司机分配资料</div>';


        const tripCount =
            getTaskTrips(task).length;


        $("publishedTaskModalContent")
            .innerHTML = `
                <div class="detail-summary-grid">
                    <div>
                        <span>任务编号</span>
                        <strong>${escapeHtml(task.taskId)}</strong>
                    </div>

                    <div>
                        <span>班次</span>
                        <strong>${escapeHtml(task.shift || "-")}</strong>
                    </div>

                    <div>
                        <span>区域</span>
                        <strong>${escapeHtml(task.area || "-")}</strong>
                    </div>

                    <div>
                        <span>当前趟数</span>
                        <strong>${tripCount}</strong>
                    </div>
                </div>

                <h4>👷 人员 / 车辆 / 挖机</h4>

                ${driverHtml}

                <h4>运输路线</h4>

                <div class="detail-note">
                    ${escapeHtml(task.loadingPoint || "-")}
                    →
                    ${escapeHtml(task.unloadingPoint || "-")}
                </div>

                <h4>调度说明</h4>

                <div class="detail-note">
                    ${escapeHtml(task.remark || "无")}
                </div>
            `;


        $("withdrawPublishedTaskButton")
            .classList
            .toggle(
                "hidden",
                task.status !== "pending"
            );


        $("completePublishedTaskButton")
            .classList
            .toggle(
                "hidden",
                task.status !== "active"
            );


        showModal(
            "publishedTaskModal"
        );
    }


    function withdrawOpenedTask() {

        const task =
            getTaskById(openedTaskId);

        if (
            !task ||
            task.status !== "pending"
        ) {
            return;
        }

        if (
            getTaskTrips(task).length
        ) {

            alert(
                "该任务已经产生运输记录，不能撤回。"
            );

            return;
        }

        if (
            !confirm(
                "确认撤回并删除该生产任务吗？"
            )
        ) {
            return;
        }

        const tasks =
            getTasks().filter(
                item =>
                    item.taskId !== openedTaskId
            );

        saveTasks(tasks);

        clearLocalDriverTaskIfMatches(
            openedTaskId
        );

        hideModal(
            "publishedTaskModal"
        );

        refreshAll();
    }


    function completeOpenedTask() {

        const tasks =
            getTasks();

        const task =
            tasks.find(
                item =>
                    item.taskId === openedTaskId
            );

        if (!task) {
            return;
        }

        if (
            task.status !== "active"
        ) {

            alert(
                "任务还没有开始产生运输记录。"
            );

            return;
        }

        if (
            !confirm(
                "确认该生产任务已经完成？"
            )
        ) {
            return;
        }

        task.status =
            "completed";

        task.completedAt =
            new Date().toISOString();

        saveTasks(tasks);

        clearLocalDriverTaskIfMatches(
            task.taskId
        );

        hideModal(
            "publishedTaskModal"
        );

        refreshAll();
    }


    function clearLocalDriverTaskIfMatches(
        taskId
    ) {

        const current =
            readJson(
                STORAGE.DRIVER_CURRENT_TASK,
                null
            );

        if (
            current &&
            current.taskId === taskId
        ) {

            current.status =
                "completed";

            current.completedAt =
                new Date().toISOString();

            localStorage.setItem(
                STORAGE.DRIVER_CURRENT_TASK,
                JSON.stringify(current)
            );
        }
    }


    function toggleHistory() {

        $("historyTaskSection")
            .classList
            .toggle("hidden");

        renderHistory();
    }


    function renderHistory() {

        const board =
            $("historyTaskBoard");

        if (!board) {
            return;
        }

        let tasks =
            getTasks().filter(
                item =>
                    item.status === "completed"
            );

        const date =
            $("historyDateFilter")?.value || "";

        const shift =
            $("historyShiftFilter")?.value || "";

        const area =
            $("historyAreaFilter")
                ?.value
                .trim()
                .toLowerCase() || "";


        if (date) {

            tasks =
                tasks.filter(
                    task =>
                        task.dateKey === date
                );
        }

        if (shift) {

            tasks =
                tasks.filter(
                    task =>
                        task.shift === shift
                );
        }

        if (area) {

            tasks =
                tasks.filter(
                    task =>
                        String(task.area || "")
                            .toLowerCase()
                            .includes(area)
                );
        }

        setText(
            "historyTaskCount",
            `${tasks.length} 个`
        );

        if (!tasks.length) {

            board.innerHTML =
                '<div class="empty-placeholder">暂无历史任务</div>';

            return;
        }

        board.innerHTML =
            tasks.map(
                task => `
                    <button
                        class="production-task-card completed"
                        data-history="${escapeHtml(task.taskId)}"
                        type="button"
                    >
                        <div class="task-card-top">
                            <div>
                                <strong>
                                    ${escapeHtml(task.area || "-")}
                                </strong>

                                <span>
                                    ${escapeHtml(task.shift || "-")}
                                    ·
                                    ${escapeHtml(task.date || "-")}
                                </span>
                            </div>

                            <span class="task-status-pill completed">
                                已完成
                            </span>
                        </div>

                        <div class="task-stat-grid">
                            <div>
                                <span>司机</span>
                                <strong>
                                    ${(task.driverAssignments || []).length}
                                </strong>
                            </div>

                            <div>
                                <span>趟数</span>
                                <strong>
                                    ${getTaskTrips(task).length}
                                </strong>
                            </div>
                        </div>
                    </button>
                `
            ).join("");

        board.querySelectorAll(
            "[data-history]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        openTaskDetail(
                            button.dataset.history
                        )
                );
            }
        );
    }


    /*
    ========================================================
    换车
    ========================================================
    */

    function openVehicleChanges() {

        renderVehicleChanges();

        showModal(
            "vehicleChangeModal"
        );
    }


    function renderVehicleChanges() {

        const records =
            getChangeRequests()
                .filter(
                    item =>
                        item.status === "pending"
                );

        const box =
            $("vehicleChangeRequestList");

        if (!records.length) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无待审批换车申请</div>';

            return;
        }

        box.innerHTML =
            records.map(
                item => {

                    const trucks =
                        getAvailableReplacementTrucks(
                            item.taskId
                        );

                    return `
                        <div class="approval-card">

                            <div class="approval-title">
                                <strong>
                                    ${escapeHtml(item.driverName || "-")}
                                </strong>

                                <span>
                                    ${escapeHtml(item.oldVehicleNumber || "-")}
                                </span>
                            </div>

                            <div class="approval-note">
                                ${escapeHtml(item.reason || "-")}
                            </div>

                            <select data-change-vehicle="${escapeHtml(item.requestId)}">
                                <option value="">选择新车辆</option>

                                ${trucks.map(
                                    truck => `
                                        <option value="${escapeHtml(truck.id)}">
                                            ${escapeHtml(truck.id)}
                                        </option>
                                    `
                                ).join("")}
                            </select>

                            <div class="approval-buttons">
                                <button
                                    class="success-button"
                                    data-change-approve="${escapeHtml(item.requestId)}"
                                    type="button"
                                >
                                    批准
                                </button>

                                <button
                                    class="danger-button"
                                    data-change-reject="${escapeHtml(item.requestId)}"
                                    type="button"
                                >
                                    驳回
                                </button>
                            </div>

                        </div>
                    `;
                }
            ).join("");


        box.querySelectorAll(
            "[data-change-approve]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        approveVehicleChange(
                            button.dataset.changeApprove
                        )
                );
            }
        );


        box.querySelectorAll(
            "[data-change-reject]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        rejectVehicleChange(
                            button.dataset.changeReject
                        )
                );
            }
        );
    }


    function approveVehicleChange(
        requestId
    ) {

        const select =
            document.querySelector(
                `[data-change-vehicle="${CSS.escape(requestId)}"]`
            );

        const newVehicle =
            select?.value || "";

        if (!newVehicle) {

            alert("请选择替换车辆。");

            return;
        }

        const requests =
            getChangeRequests();

        const request =
            requests.find(
                item =>
                    item.requestId === requestId
            );

        if (!request) {
            return;
        }

        const oldVehicle =
            request.oldVehicleNumber ||
            request.oldVehicleId;


        request.status =
            "approved";

        request.approvedVehicleId =
            newVehicle;

        request.approvedVehicleNumber =
            newVehicle;

        request.approvedAt =
            new Date().toISOString();

        request.approvedBy =
            "调度端";


        saveChangeRequests(
            requests
        );


        updateTaskVehicleAfterChange(
            request.taskId,
            request.driverId,
            request.driverName,
            oldVehicle,
            newVehicle
        );


        renderVehicleChanges();

        refreshAll();


        alert(
            `换车已批准：${oldVehicle} → ${newVehicle}`
        );
    }


    function updateTaskVehicleAfterChange(
        taskId,
        driverId,
        driverName,
        oldVehicle,
        newVehicle
    ) {

        const tasks =
            getTasks();

        const task =
            tasks.find(
                item =>
                    item.taskId === taskId
            );

        if (!task) {
            return;
        }


        (task.bindings || []).forEach(
            binding => {

                binding.truckIds =
                    (binding.truckIds || []).map(
                        truckId =>
                            truckId === oldVehicle
                                ? newVehicle
                                : truckId
                    );
            }
        );


        const assignment =
            (task.driverAssignments || []).find(
                item =>
                    (
                        driverId &&
                        item.driverId === driverId
                    ) ||
                    (
                        !driverId &&
                        item.driverName === driverName
                    )
            );


        if (assignment) {

            assignment.vehicleId =
                newVehicle;

            assignment.vehicleNumber =
                newVehicle;
        }


        task.equipmentAdjustments =
            task.equipmentAdjustments || [];


        task.equipmentAdjustments.push({
            adjustmentId:
                "CHANGE_" + Date.now(),

            time:
                new Date().toISOString(),

            summary:
                `故障换车：${oldVehicle} → ${newVehicle}`,

            driverName:
                driverName || ""
        });


        saveTasks(tasks);
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

        const records =
            getChangeRequests();

        const record =
            records.find(
                item =>
                    item.requestId === requestId
            );

        if (!record) {
            return;
        }

        record.status =
            "rejected";

        record.rejectReason =
            reason.trim();

        record.rejectedAt =
            new Date().toISOString();

        record.rejectedBy =
            "调度端";

        saveChangeRequests(records);

        renderVehicleChanges();

        refreshAll();
    }


    function getAvailableReplacementTrucks(
        taskId
    ) {

        const occupied =
            getOccupiedEquipmentIds(
                taskId
            );

        return equipment.trucks.filter(
            truck =>
                truck.status !== "maintenance" &&
                !occupied.has(truck.id)
        );
    }


    /*
    ========================================================
    GPS审核
    ========================================================
    */

    function openGpsReview() {

        renderGpsReview();

        showModal(
            "gpsReviewModal"
        );
    }


    function renderGpsReview() {

        const records =
            getTrips().filter(
                trip =>
                    trip.gpsStatus !== "正常" &&
                    trip.gpsStatus !== "normal" &&
                    trip.dispatchConfirmation !== "confirmed" &&
                    trip.dispatchConfirmation !== "rejected"
            );

        const box =
            $("gpsReviewList");

        if (!records.length) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无GPS异常待审核</div>';

            return;
        }

        box.innerHTML =
            records.map(
                record => `
                    <div class="approval-card">

                        <div class="approval-title">
                            <strong>
                                ${escapeHtml(record.driverName || "-")}
                            </strong>

                            <span>
                                ${escapeHtml(record.vehicleNumber || "-")}
                            </span>
                        </div>

                        <div class="approval-detail-grid">

                            <div>
                                <span>区域</span>
                                <strong>
                                    ${escapeHtml(record.workArea || "-")}
                                </strong>
                            </div>

                            <div>
                                <span>GPS</span>
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
                                              Math.round(record.gpsAccuracy) +
                                              "米"
                                            : "无定位"
                                    }
                                </strong>
                            </div>

                        </div>

                        <div class="approval-buttons">

                            <button
                                data-gps-confirm="${escapeHtml(getTripId(record))}"
                                class="success-button"
                                type="button"
                            >
                                确认有效
                            </button>

                            <button
                                data-gps-reject="${escapeHtml(getTripId(record))}"
                                class="danger-button"
                                type="button"
                            >
                                判定无效
                            </button>

                        </div>
                    </div>
                `
            ).join("");


        box.querySelectorAll(
            "[data-gps-confirm]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        reviewGpsTrip(
                            button.dataset.gpsConfirm,
                            true
                        )
                );
            }
        );


        box.querySelectorAll(
            "[data-gps-reject]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        reviewGpsTrip(
                            button.dataset.gpsReject,
                            false
                        )
                );
            }
        );
    }


    function reviewGpsTrip(
        tripId,
        approved
    ) {

        const remark =
            prompt(
                approved
                    ? "确认备注（可空）："
                    : "请输入无效原因："
            );

        if (remark === null) {
            return;
        }

        const trips =
            getTrips();

        const record =
            trips.find(
                item =>
                    getTripId(item) === tripId
            );

        if (!record) {
            return;
        }

        record.dispatchConfirmation =
            approved
                ? "confirmed"
                : "rejected";

        record.officialCountEligible =
            approved;

        record.dispatchReviewedAt =
            new Date().toISOString();

        record.dispatchReviewedBy =
            "调度端";

        record.dispatchReviewNote =
            remark.trim();

        saveTrips(trips);

        renderGpsReview();

        refreshAll();
    }


    /*
    ========================================================
    司机请假审批
    ========================================================
    */

    function openLeaveReview() {

        renderLeaveReview();

        showModal(
            "leaveReviewModal"
        );
    }


    function renderLeaveReview() {

        const requests =
            getLeaves()
                .filter(
                    item =>
                        item.status === "pending" &&
                        item.approverRole === "dispatch"
                );

        const box =
            $("leaveReviewList");

        if (!requests.length) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无司机请假待审批</div>';

            return;
        }

        box.innerHTML =
            requests.map(
                item => `
                    <div class="approval-card">

                        <div class="approval-title">
                            <strong>
                                ${escapeHtml(
                                    item.applicantName ||
                                    item.personName ||
                                    "-"
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(item.leaveType || "请假")}
                            </span>
                        </div>

                        <div class="approval-detail-grid">

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

                        </div>

                        <div class="approval-note">
                            ${escapeHtml(item.reason || "-")}
                        </div>

                        <div class="approval-buttons">

                            <button
                                data-leave-approve="${escapeHtml(item.leaveId)}"
                                class="success-button"
                                type="button"
                            >
                                批准
                            </button>

                            <button
                                data-leave-reject="${escapeHtml(item.leaveId)}"
                                class="danger-button"
                                type="button"
                            >
                                驳回
                            </button>

                        </div>
                    </div>
                `
            ).join("");


        box.querySelectorAll(
            "[data-leave-approve]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        reviewDriverLeave(
                            button.dataset.leaveApprove,
                            true
                        )
                );
            }
        );


        box.querySelectorAll(
            "[data-leave-reject]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        reviewDriverLeave(
                            button.dataset.leaveReject,
                            false
                        )
                );
            }
        );
    }


    function reviewDriverLeave(
        leaveId,
        approved
    ) {

        const note =
            prompt(
                approved
                    ? "审批备注（可空）："
                    : "请输入驳回原因："
            );

        if (note === null) {
            return;
        }

        const records =
            getLeaves();

        const item =
            records.find(
                record =>
                    record.leaveId === leaveId
            );

        if (!item) {
            return;
        }

        item.status =
            approved
                ? "approved"
                : "rejected";

        item.approvedBy =
            "调度端";

        item.approvedAt =
            new Date().toISOString();

        item.reviewedBy =
            "调度端";

        item.reviewedAt =
            item.approvedAt;

        item.approvalRemark =
            note.trim();

        item.reviewRemark =
            note.trim();

        saveLeaves(records);

        renderLeaveReview();

        refreshAll();
    }


    /*
    ========================================================
    调度自己的请假 -> 总经理
    ========================================================
    */

    function openMyLeave() {

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
            $("leaveApplicantName").value.trim();

        const position =
            $("leaveApplicantPosition").value.trim();

        const start =
            $("leaveStart").value;

        const end =
            $("leaveEnd").value;

        const reason =
            $("leaveReason").value.trim();

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
            getLeaves();

        records.push({

            leaveId:
                "LEAVE_" + Date.now(),

            applicantId:
                "MANAGEMENT_" +
                Date.now(),

            applicantName:
                name,

            personName:
                name,

            role:
                "management",

            position,

            team:
                "管理人员",

            leaveType:
                $("leaveType").value,

            startTime:
                new Date(start).toISOString(),

            endTime:
                new Date(end).toISOString(),

            reason,

            status:
                "pending",

            approvalRoute:
                "general_manager",

            approverRole:
                "general_manager",

            submittedAt:
                new Date().toISOString()
        });

        saveLeaves(records);

        hideModal(
            "myLeaveModal"
        );

        $("leaveStart").value = "";

        $("leaveEnd").value = "";

        $("leaveReason").value = "";

        alert(
            "请假申请已提交总经理审批。"
        );
    }


    /*
    ========================================================
    罚单
    ========================================================
    */

    function openPenalty() {

        populatePenaltyPersonnel();

        showModal(
            "penaltyModal"
        );
    }


    function populatePenaltyPersonnel() {

        const select =
            $("penaltyPerson");

        if (!select) {
            return;
        }

        const people =
            getApprovedDrivers();

        select.innerHTML =
            '<option value="">选择人员</option>';

        people.forEach(
            person => {

                const option =
                    document.createElement("option");

                option.value =
                    person.driverId;

                option.dataset.name =
                    person.name || "";

                option.dataset.team =
                    person.team || "";

                option.textContent =
                    `${person.name || "-"} · ${person.team || "-"}`;

                select.appendChild(option);
            }
        );
    }


    function submitPenalty() {

        const select =
            $("penaltyPerson");

        const option =
            select.options[
                select.selectedIndex
            ];

        if (!select.value) {

            alert(
                "请选择人员。"
            );

            return;
        }

        const description =
            $("penaltyDescription").value.trim();

        if (!description) {

            alert(
                "请输入违规说明。"
            );

            return;
        }

        const penalties =
            getPenalties();

        penalties.push({

            penaltyId:
                "PENALTY_" + Date.now(),

            personId:
                select.value,

            personName:
                option.dataset.name || "",

            team:
                option.dataset.team || "",

            vehicleNumber:
                $("penaltyVehicle").value.trim(),

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

            status:
                "pending_acknowledgement",

            issuedBy:
                "调度端",

            issuedAt:
                new Date().toISOString()
        });

        savePenalties(penalties);

        hideModal(
            "penaltyModal"
        );

        $("penaltyVehicle").value = "";

        $("penaltyAmount").value = "";

        $("penaltyPoints").value = "";

        $("penaltyDescription").value = "";

        refreshAll();

        alert(
            "罚单已下达。"
        );
    }


    function openPenaltyManager() {

        renderPenaltyManager();

        showModal(
            "penaltyManagerModal"
        );
    }


    function renderPenaltyManager() {

        const records =
            getPenalties()
                .slice()
                .reverse();

        const box =
            $("penaltyManagerList");

        if (!records.length) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无罚单记录</div>';

            return;
        }

        box.innerHTML =
            records.map(
                item => `
                    <div class="approval-card">

                        <div class="approval-title">
                            <strong>
                                ${escapeHtml(item.personName || "-")}
                            </strong>

                            <span>
                                ${
                                    item.status === "acknowledged"
                                        ? "已知晓"
                                        : item.status === "processed"
                                            ? "已处理"
                                            : "待确认"
                                }
                            </span>
                        </div>

                        <div class="approval-note">
                            ${escapeHtml(item.violationType || "-")}
                            ·
                            ${escapeHtml(item.description || "-")}
                        </div>

                        <div class="approval-detail-grid">
                            <div>
                                <span>金额</span>
                                <strong>
                                    ¥${Number(item.amount || 0)}
                                </strong>
                            </div>

                            <div>
                                <span>扣分</span>
                                <strong>
                                    ${Number(item.points || 0)}
                                </strong>
                            </div>
                        </div>

                    </div>
                `
            ).join("");
    }


    /*
    ========================================================
    待办
    ========================================================
    */

    function renderTodoCounts() {

        setText(
            "vehicleChangeTodoCount",
            getChangeRequests().filter(
                item =>
                    item.status === "pending"
            ).length
        );

        setText(
            "gpsTodoCount",
            getTrips().filter(
                item =>
                    item.gpsStatus !== "正常" &&
                    item.gpsStatus !== "normal" &&
                    item.dispatchConfirmation !== "confirmed" &&
                    item.dispatchConfirmation !== "rejected"
            ).length
        );

        setText(
            "leaveTodoCount",
            getLeaves().filter(
                item =>
                    item.status === "pending" &&
                    item.approverRole === "dispatch"
            ).length
        );

        setText(
            "penaltyTodoCount",
            getPenalties().filter(
                item =>
                    item.status ===
                    "pending_acknowledgement"
            ).length
        );
    }


    /*
    ========================================================
    请假重叠
    ========================================================
    */

    function hasApprovedLeaveOverlap(
        person,
        start,
        end
    ) {

        return getLeaves().some(
            leave => {

                if (
                    leave.status !== "approved"
                ) {
                    return false;
                }

                if (
                    !leaveMatchesPerson(
                        leave,
                        person
                    )
                ) {
                    return false;
                }

                const leaveStart =
                    new Date(
                        leave.startTime ||
                        leave.startAt
                    );

                const leaveEnd =
                    new Date(
                        leave.endTime ||
                        leave.endAt
                    );

                return (
                    leaveStart <= end &&
                    leaveEnd >= start
                );
            }
        );
    }


    function hasPendingLeaveOverlap(
        person,
        start,
        end
    ) {

        return getLeaves().some(
            leave => {

                if (
                    leave.status !== "pending"
                ) {
                    return false;
                }

                if (
                    !leaveMatchesPerson(
                        leave,
                        person
                    )
                ) {
                    return false;
                }

                const leaveStart =
                    new Date(
                        leave.startTime ||
                        leave.startAt
                    );

                const leaveEnd =
                    new Date(
                        leave.endTime ||
                        leave.endAt
                    );

                return (
                    leaveStart < end &&
                    leaveEnd > start
                );
            }
        );
    }


    function hasPendingLeaveAtTime(
        person,
        time
    ) {

        return hasPendingLeaveOverlap(
            person,
            time,
            new Date(
                time.getTime() + 1000
            )
        );
    }


    function leaveMatchesPerson(
        leave,
        person
    ) {

        const leaveId =
            leave.applicantId ||
            leave.personId ||
            "";

        const leaveName =
            leave.applicantName ||
            leave.personName ||
            "";

        if (
            leaveId &&
            person.driverId
        ) {

            return (
                String(leaveId) ===
                String(person.driverId)
            );
        }

        return (
            String(leaveName).trim() &&
            String(leaveName).trim() ===
            String(person.name || "").trim()
        );
    }


    function getTaskDateRange(task) {

        const dateKey =
            task.dateKey ||
            getLocalDateKey();

        const start =
            new Date(
                `${dateKey}T${
                    task.shift === "夜班"
                        ? "20:00:00"
                        : "08:00:00"
                }`
            );

        const end =
            new Date(start);

        if (
            task.shift === "夜班"
        ) {

            end.setDate(
                end.getDate() + 1
            );

            end.setHours(
                8,
                0,
                0,
                0
            );

        } else {

            end.setHours(
                20,
                0,
                0,
                0
            );
        }

        return {
            start,
            end
        };
    }


    /*
    ========================================================
    数据
    ========================================================
    */

    function migrateTasks() {

        let tasks =
            getTasks();

        tasks =
            tasks.filter(
                task =>
                    task.status !== "withdrawn"
            );

        tasks.forEach(
            task => {

                if (
                    !Array.isArray(
                        task.driverAssignments
                    )
                ) {
                    task.driverAssignments = [];
                }

                if (
                    !Array.isArray(
                        task.bindings
                    )
                ) {
                    task.bindings = [];
                }

                if (
                    !Array.isArray(
                        task.auxiliaryAssignments
                    )
                ) {
                    task.auxiliaryAssignments = [];
                }

                if (
                    !Array.isArray(
                        task.equipmentAdjustments
                    )
                ) {
                    task.equipmentAdjustments = [];
                }
            }
        );

        saveTasks(tasks);
    }


    function getApprovedDrivers() {

        let records =
            readJson(
                STORAGE.PERSONNEL,
                []
            );

        if (!Array.isArray(records)) {
            records = [];
        }

        const single =
            readJson(
                STORAGE.DRIVER_PROFILE,
                null
            );

        if (
            single &&
            single.status === "approved"
        ) {

            const exists =
                records.some(
                    item =>
                        item.driverId &&
                        single.driverId &&
                        item.driverId ===
                        single.driverId
                );

            if (!exists) {
                records.push(single);
            }
        }

        const map =
            new Map();

        records.forEach(
            person => {

                if (
                    person.status &&
                    person.status !== "approved" &&
                    person.status !== "active"
                ) {
                    return;
                }

                const id =
                    person.driverId ||
                    person.employeeId ||
                    person.id ||
                    person.name;

                if (!id) {
                    return;
                }

                map.set(
                    String(id),
                    {
                        ...person,
                        driverId:
                            String(id)
                    }
                );
            }
        );

        return [...map.values()]
            .filter(
                item =>
                    !item.position ||
                    item.position.includes("司机")
            );
    }


    function getTasks() {

        const data =
            readJson(
                STORAGE.TASKS,
                []
            );

        return Array.isArray(data)
            ? data
            : [];
    }


    function saveTasks(tasks) {

        localStorage.setItem(
            STORAGE.TASKS,
            JSON.stringify(tasks)
        );
    }


    function getTaskById(taskId) {

        return getTasks().find(
            task =>
                task.taskId === taskId
        ) || null;
    }


    function getTrips() {

        const data =
            readJson(
                STORAGE.TRIPS,
                []
            );

        return Array.isArray(data)
            ? data
            : [];
    }


    function saveTrips(records) {

        localStorage.setItem(
            STORAGE.TRIPS,
            JSON.stringify(records)
        );
    }


    function getTaskTrips(task) {

        return getTrips().filter(
            trip =>
                trip.taskId === task.taskId ||
                trip.dispatchTaskId === task.taskId
        );
    }


    function getChangeRequests() {

        const data =
            readJson(
                STORAGE.CHANGE_REQUESTS,
                []
            );

        return Array.isArray(data)
            ? data
            : [];
    }


    function saveChangeRequests(records) {

        localStorage.setItem(
            STORAGE.CHANGE_REQUESTS,
            JSON.stringify(records)
        );
    }


    function getLeaves() {

        const data =
            readJson(
                STORAGE.LEAVES,
                []
            );

        return Array.isArray(data)
            ? data
            : [];
    }


    function saveLeaves(records) {

        localStorage.setItem(
            STORAGE.LEAVES,
            JSON.stringify(records)
        );
    }


    function getPenalties() {

        const data =
            readJson(
                STORAGE.PENALTIES,
                []
            );

        return Array.isArray(data)
            ? data
            : [];
    }


    function savePenalties(records) {

        localStorage.setItem(
            STORAGE.PENALTIES,
            JSON.stringify(records)
        );
    }


    /*
    ========================================================
    工具
    ========================================================
    */

    function getDeviceClass(
        device,
        occupied,
        selected,
        draftUsed
    ) {

        if (draftUsed) {
            return "device-card draft-used";
        }

        if (selected) {
            return "device-card selected";
        }

        if (
            device.status === "maintenance"
        ) {
            return "device-card maintenance";
        }

        if (
            occupied.has(device.id)
        ) {
            return "device-card occupied";
        }

        return "device-card available";
    }


    function samePerson(
        id,
        name,
        person
    ) {

        if (
            id &&
            person.driverId
        ) {

            return (
                String(id) ===
                String(person.driverId)
            );
        }

        return (
            String(name || "").trim() &&
            String(name || "").trim() ===
            String(person.name || "").trim()
        );
    }


    function findDuplicateDriverIds(
        records
    ) {

        const seen =
            new Set();

        const duplicates =
            new Set();

        records.forEach(
            item => {

                if (!item.driverId) {
                    return;
                }

                if (
                    seen.has(item.driverId)
                ) {
                    duplicates.add(
                        item.driverId
                    );
                }

                seen.add(
                    item.driverId
                );
            }
        );

        return [...duplicates];
    }


    function getTripId(item) {

        return (
            item.tripId ||
            item.id ||
            ""
        );
    }


    function getLocalDateKey() {

        const date =
            new Date();

        return [
            date.getFullYear(),
            String(
                date.getMonth() + 1
            ).padStart(2, "0"),
            String(
                date.getDate()
            ).padStart(2, "0")
        ].join("-");
    }


    function clearTaskInputs() {

        $("taskArea").value = "";

        $("taskLoadingPoint").value = "";

        $("taskUnloadingPoint").value = "";

        $("taskRemark").value = "";
    }


    function showModal(id) {

        $(id)?.classList.remove(
            "hidden"
        );

        document.body.classList.add(
            "modal-open"
        );
    }


    function hideModal(id) {

        $(id)?.classList.add(
            "hidden"
        );

        document.body.classList.remove(
            "modal-open"
        );
    }


    function setText(id, text) {

        const el = $(id);

        if (el) {
            el.textContent = text;
        }
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
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }


    function clone(value) {

        return JSON.parse(
            JSON.stringify(value)
        );
    }


    function readJson(
        key,
        fallback
    ) {

        try {

            const raw =
                localStorage.getItem(key);

            return raw
                ? JSON.parse(raw)
                : fallback;

        } catch (error) {

            console.error(
                "读取数据失败：",
                key,
                error
            );

            return fallback;
        }
    }


    function escapeHtml(value) {

        const div =
            document.createElement("div");

        div.textContent =
            String(value ?? "");

        return div.innerHTML;
    }

});
