/*
========================================================
矿山管理系统
调度端 V2.9.4B

统一人员库 + 统一设备库
personnelRecords + equipmentRecords

保留：
生产任务
司机调度
设备绑定
辅助车辆
GPS审核
故障换车
司机请假
调度请假
罚单
历史任务
========================================================
*/

document.addEventListener("DOMContentLoaded", function () {

    "use strict";


    const STORAGE = {

        TASKS:
            "dispatchPublishedTasks",

        LEGACY_TASK:
            "publishedDispatchTask",

        TRIPS:
            "driverTripRecords",

        PERSONNEL:
            "personnelRecords",

        EQUIPMENT:
            "equipmentRecords",

        DRIVER_PROFILE:
            "driverProfile",

        DRIVER_CURRENT_TASK:
            "driverCurrentTask",

        CHANGE_REQUESTS:
            "driverVehicleChangeRequests",

        LEAVES:
            "leaveRequests",

        PENALTIES:
            "penaltyRecords",

        DISPATCH_PROFILE:
            "dispatchUserProfile"
    };


    const $ =
        id =>
            document.getElementById(id);


    let equipment =
        emptyEquipmentCatalog();


    let currentDraft =
        null;

    let bindings =
        [];

    let driverAssignments =
        [];

    let auxiliaryAssignments =
        [];

    let selectedExcavatorId =
        null;

    let selectedTruckIds =
        [];

    let openedTaskId =
        null;


    init();



    /*
    ========================================================
    初始化
    ========================================================
    */

    function init() {

        migrateTasks();

        refreshEquipmentCatalog();

        setAutomaticShift();

        bindEvents();

        refreshAll();


        setInterval(
            refreshAll,
            5000
        );
    }



    function bindEvents() {

        $("newTaskButton")
            ?.addEventListener(
                "click",
                openTaskCreate
            );


        $("cancelCreateButton")
            ?.addEventListener(
                "click",
                cancelDraft
            );


        $("generateTaskButton")
            ?.addEventListener(
                "click",
                generateDraft
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


        $("historyDateFilter")
            ?.addEventListener(
                "change",
                renderHistory
            );


        $("historyShiftFilter")
            ?.addEventListener(
                "change",
                renderHistory
            );


        $("historyAreaFilter")
            ?.addEventListener(
                "input",
                renderHistory
            );


        $("resetHistoryFilterButton")
            ?.addEventListener(
                "click",
                function () {

                    if ($("historyDateFilter")) {
                        $("historyDateFilter").value = "";
                    }

                    if ($("historyShiftFilter")) {
                        $("historyShiftFilter").value = "";
                    }

                    if ($("historyAreaFilter")) {
                        $("historyAreaFilter").value = "";
                    }

                    renderHistory();
                }
            );


        $("auxiliaryTypeSelect")
            ?.addEventListener(
                "change",
                renderAuxiliaryVehicles
            );


        $("addAuxiliaryButton")
            ?.addEventListener(
                "click",
                addAuxiliary
            );


        $("closePublishedTaskModalButton")
            ?.addEventListener(
                "click",
                () =>
                    hideModal(
                        "publishedTaskModal"
                    )
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


        $("openVehicleChangeButton")
            ?.addEventListener(
                "click",
                openVehicleChanges
            );


        $("closeVehicleChangeModal")
            ?.addEventListener(
                "click",
                () =>
                    hideModal(
                        "vehicleChangeModal"
                    )
            );


        $("openGpsReviewButton")
            ?.addEventListener(
                "click",
                openGpsReview
            );


        $("closeGpsReviewModal")
            ?.addEventListener(
                "click",
                () =>
                    hideModal(
                        "gpsReviewModal"
                    )
            );


        $("openLeaveReviewButton")
            ?.addEventListener(
                "click",
                openLeaveReview
            );


        $("closeLeaveReviewModal")
            ?.addEventListener(
                "click",
                () =>
                    hideModal(
                        "leaveReviewModal"
                    )
            );


        $("myLeaveButton")
            ?.addEventListener(
                "click",
                openMyLeave
            );


        $("closeMyLeaveModal")
            ?.addEventListener(
                "click",
                () =>
                    hideModal(
                        "myLeaveModal"
                    )
            );


        $("submitMyLeaveButton")
            ?.addEventListener(
                "click",
                submitMyLeave
            );


        $("issuePenaltyButton")
            ?.addEventListener(
                "click",
                openPenalty
            );


        $("closePenaltyModal")
            ?.addEventListener(
                "click",
                () =>
                    hideModal(
                        "penaltyModal"
                    )
            );


        $("submitPenaltyButton")
            ?.addEventListener(
                "click",
                submitPenalty
            );


        $("openPenaltyManagerButton")
            ?.addEventListener(
                "click",
                openPenaltyManager
            );


        $("closePenaltyManagerModal")
            ?.addEventListener(
                "click",
                () =>
                    hideModal(
                        "penaltyManagerModal"
                    )
            );
    }



    /*
    ========================================================
    总刷新
    ========================================================
    */

    function refreshAll() {

        refreshEquipmentCatalog();

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
    统一设备库
    equipmentRecords
    ========================================================
    */

    function emptyEquipmentCatalog() {

        return {

            excavators: [],

            trucks: [],

            loader: [],

            water: [],

            fuel: [],

            grader: [],

            dozer: [],

            bus: []
        };
    }



    function refreshEquipmentCatalog() {

        equipment =
            getEquipmentCatalog();
    }



    function getEquipmentRecords() {

        const records =
            readJson(
                STORAGE.EQUIPMENT,
                []
            );


        return Array.isArray(records)
            ? records
            : [];
    }



    function getEquipmentCatalog() {

        const catalog =
            emptyEquipmentCatalog();


        getEquipmentRecords()
            .forEach(
                record => {

                    const device =
                        normalizeEquipmentRecord(
                            record
                        );


                    if (
                        !device.id ||
                        !device.group
                    ) {

                        return;
                    }


                    catalog[
                        device.group
                    ].push(
                        device
                    );
                }
            );


        Object.keys(catalog)
            .forEach(
                key => {

                    catalog[key]
                        .sort(
                            (a, b) =>
                                String(a.id)
                                    .localeCompare(
                                        String(b.id),
                                        "zh-CN",
                                        {
                                            numeric: true
                                        }
                                    )
                        );
                }
            );


        return catalog;
    }



    function normalizeEquipmentRecord(
        record
    ) {

        const id =
            String(
                record.equipmentNumber ||
                record.equipmentNo ||
                record.vehicleNumber ||
                record.number ||
                record.code ||
                record.equipmentId ||
                record.id ||
                ""
            ).trim();


        const rawType =
            String(
                record.equipmentType ||
                record.category ||
                record.equipmentCategory ||
                record.type ||
                record.vehicleType ||
                ""
            ).trim();


        const rawStatus =
            String(
                record.currentStatus ||
                record.equipmentStatus ||
                record.status ||
                "可用"
            ).trim();


        const group =
            getEquipmentGroup(
                rawType
            );


        const status =
            normalizeEquipmentStatus(
                rawStatus
            );


        return {

            ...record,

            id,

            group,

            type:
                rawType,

            rawStatus,

            status,

            reason:
                record.repairReason ||
                record.maintenanceReason ||
                record.statusReason ||
                record.remark ||
                ""
        };
    }



    function getEquipmentGroup(
        type
    ) {

        const value =
            String(type || "")
                .trim();


        if (
            value.includes("挖掘机") ||
            value.includes("挖机")
        ) {

            return "excavators";
        }


        if (
            value.includes("卡车") ||
            value.includes("矿卡") ||
            value.includes("自卸车") ||
            value.includes("运输车")
        ) {

            return "trucks";
        }


        if (
            value.includes("装载机") ||
            value.includes("铲车")
        ) {

            return "loader";
        }


        if (
            value.includes("洒水车")
        ) {

            return "water";
        }


        if (
            value.includes("加油车") ||
            value.includes("油罐车")
        ) {

            return "fuel";
        }


        if (
            value.includes("平路机") ||
            value.includes("平地机")
        ) {

            return "grader";
        }


        if (
            value.includes("推土机")
        ) {

            return "dozer";
        }


        if (
            value.includes("大巴") ||
            value.includes("客车") ||
            value.includes("通勤车")
        ) {

            return "bus";
        }


        return "";
    }



    function normalizeEquipmentStatus(
        status
    ) {

        const value =
            String(status || "")
                .trim()
                .toLowerCase();


        if (
            value === "available" ||
            value === "可用" ||
            value === "在用可调度" ||
            value === "正常" ||
            value === "备用" ||
            value === "standby"
        ) {

            return "available";
        }


        if (
            value === "working" ||
            value === "active" ||
            value === "作业中" ||
            value === "使用中" ||
            value === "运行中"
        ) {

            return "working";
        }


        if (
            value === "maintenance" ||
            value === "维修" ||
            value === "维修中"
        ) {

            return "maintenance";
        }


        if (
            value === "保养" ||
            value === "保养中" ||
            value === "service"
        ) {

            return "service";
        }


        if (
            value === "disabled" ||
            value === "停用" ||
            value === "报废"
        ) {

            return "disabled";
        }


        return "available";
    }



    function equipmentStateLabel(
        device
    ) {

        switch (device.status) {

            case "maintenance":
                return "维修中";

            case "service":
                return "保养中";

            case "disabled":
                return "停用";

            case "working":
                return "作业中";

            default:
                return "可调配";
        }
    }



    function isEquipmentDispatchable(
        device
    ) {

        return (
            device &&
            device.status ===
                "available"
        );
    }



    function getEquipmentById(
        equipmentId
    ) {

        const groups =
            Object.values(
                equipment
            );


        for (
            const group of groups
        ) {

            const device =
                group.find(
                    item =>
                        item.id ===
                        equipmentId
                );


            if (device) {
                return device;
            }
        }


        return null;
    }



    /*
    ========================================================
    草稿任务
    ========================================================
    */

    function openTaskCreate() {

        $("taskCreateSection")
            ?.classList
            .remove(
                "hidden"
            );


        $("taskCreateSection")
            ?.scrollIntoView({
                behavior:
                    "smooth"
            });
    }



    function setAutomaticShift() {

        const hour =
            new Date()
                .getHours();


        if (
            $("taskShift")
        ) {

            $("taskShift").value =
                hour >= 8 &&
                hour < 20
                    ? "白班"
                    : "夜班";
        }
    }



    function generateDraft() {

        const area =
            $("taskArea")
                ?.value
                .trim() ||
            "";


        if (!area) {

            alert(
                "请输入作业区域。"
            );

            return;
        }


        currentDraft = {

            taskId:
                "TASK_" +
                Date.now(),

            dateKey:
                getLocalDateKey(),

            date:
                new Date()
                    .toLocaleDateString(
                        "zh-CN"
                    ),

            shift:
                $("taskShift")
                    ?.value ||
                "",

            area,

            loadingPoint:
                $("taskLoadingPoint")
                    ?.value
                    .trim() ||
                "",

            unloadingPoint:
                $("taskUnloadingPoint")
                    ?.value
                    .trim() ||
                "",

            remark:
                $("taskRemark")
                    ?.value
                    .trim() ||
                "",

            createdAt:
                new Date()
                    .toISOString()
        };


        bindings =
            [];

        driverAssignments =
            [];

        auxiliaryAssignments =
            [];

        selectedExcavatorId =
            null;

        selectedTruckIds =
            [];


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
            id =>
                $(id)
                    ?.classList
                    .remove(
                        "hidden"
                    )
        );


        renderExcavators();

        renderTrucks();

        renderBindings();

        renderDriverAssignments();

        renderAuxiliaryVehicles();

        renderAuxiliaryAssignments();
    }



    function cancelDraft() {

        currentDraft =
            null;

        bindings =
            [];

        driverAssignments =
            [];

        auxiliaryAssignments =
            [];

        selectedExcavatorId =
            null;

        selectedTruckIds =
            [];


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
            id =>
                $(id)
                    ?.classList
                    .add(
                        "hidden"
                    )
        );
    }



    /*
    ========================================================
    已占用设备
    ========================================================
    */

    function getOccupiedEquipmentIds(
        ignoreTaskId = ""
    ) {

        const set =
            new Set();


        getTasks()
            .filter(
                task =>
                    task.taskId !==
                        ignoreTaskId &&
                    (
                        task.status ===
                            "pending" ||
                        task.status ===
                            "active"
                    )
            )
            .forEach(
                task => {

                    (
                        task.bindings ||
                        []
                    ).forEach(
                        binding => {

                            if (
                                binding.excavatorId
                            ) {

                                set.add(
                                    binding.excavatorId
                                );
                            }


                            (
                                binding.truckIds ||
                                []
                            ).forEach(
                                id =>
                                    set.add(
                                        id
                                    )
                            );
                        }
                    );


                    (
                        task.auxiliaryAssignments ||
                        []
                    ).forEach(
                        item => {

                            if (
                                item.vehicleId
                            ) {

                                set.add(
                                    item.vehicleId
                                );
                            }
                        }
                    );
                }
            );


        return set;
    }



    /*
    ========================================================
    挖机
    ========================================================
    */

    function renderExcavators() {

        if (!currentDraft) {
            return;
        }


        const board =
            $("excavatorBoard");


        if (!board) {
            return;
        }


        const occupied =
            getOccupiedEquipmentIds();


        board.innerHTML =
            "";


        if (
            !equipment.excavators.length
        ) {

            board.innerHTML =
                '<div class="empty-placeholder">设备库暂无挖掘机，请管理员先在基础资料中心添加挖掘机。</div>';

            return;
        }


        equipment.excavators
            .forEach(
                device => {

                    const selected =
                        selectedExcavatorId ===
                        device.id;


                    const usedInDraft =
                        bindings.some(
                            item =>
                                item.excavatorId ===
                                device.id
                        );


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
                            selected,
                            usedInDraft
                        );


                    let label =
                        equipmentStateLabel(
                            device
                        );


                    if (usedInDraft) {

                        label =
                            "本任务已用";

                    } else if (selected) {

                        label =
                            "已选择";

                    } else if (
                        occupied.has(
                            device.id
                        )
                    ) {

                        label =
                            "已分配";
                    }


                    button.innerHTML =
                        `
                        <strong>
                            ${escapeHtml(device.id)}
                        </strong>

                        <span>
                            ${escapeHtml(label)}
                        </span>
                        `;


                    button.disabled =
                        usedInDraft;


                    button.addEventListener(
                        "click",
                        function () {

                            if (
                                !isEquipmentDispatchable(
                                    device
                                )
                            ) {

                                alert(
                                    device.id +
                                    " 当前状态：" +
                                    equipmentStateLabel(
                                        device
                                    ) +
                                    "，不能调度。"
                                );

                                return;
                            }


                            if (
                                occupied.has(
                                    device.id
                                )
                            ) {

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


                            selectedTruckIds =
                                [];


                            renderExcavators();

                            renderTrucks();
                        }
                    );


                    board.appendChild(
                        button
                    );
                }
            );
    }



    /*
    ========================================================
    卡车
    ========================================================
    */

    function renderTrucks() {

        if (!currentDraft) {
            return;
        }


        const board =
            $("truckBoard");


        if (!board) {
            return;
        }


        const occupied =
            getOccupiedEquipmentIds();


        const usedInDraft =
            new Set(
                bindings.flatMap(
                    item =>
                        item.truckIds ||
                        []
                )
            );


        board.innerHTML =
            "";


        if (
            !equipment.trucks.length
        ) {

            board.innerHTML =
                '<div class="empty-placeholder">设备库暂无运输卡车，请管理员先在基础资料中心添加卡车。</div>';

            return;
        }


        equipment.trucks
            .forEach(
                device => {

                    const selected =
                        selectedTruckIds
                            .includes(
                                device.id
                            );


                    const draftUsed =
                        usedInDraft
                            .has(
                                device.id
                            );


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
                            selected,
                            draftUsed
                        );


                    button.disabled =
                        draftUsed;


                    let label =
                        equipmentStateLabel(
                            device
                        );


                    if (draftUsed) {

                        label =
                            "本任务已用";

                    } else if (selected) {

                        label =
                            "已选择";

                    } else if (
                        occupied.has(
                            device.id
                        )
                    ) {

                        label =
                            "已分配";
                    }


                    button.innerHTML =
                        `
                        <strong>
                            ${escapeHtml(device.id)}
                        </strong>

                        <span>
                            ${escapeHtml(label)}
                        </span>
                        `;


                    button.addEventListener(
                        "click",
                        function () {

                            if (
                                !selectedExcavatorId
                            ) {

                                alert(
                                    "请先选择挖机。"
                                );

                                return;
                            }


                            if (
                                !isEquipmentDispatchable(
                                    device
                                )
                            ) {

                                alert(
                                    device.id +
                                    " 当前状态：" +
                                    equipmentStateLabel(
                                        device
                                    ) +
                                    "，不能调度。"
                                );

                                return;
                            }


                            if (
                                occupied.has(
                                    device.id
                                )
                            ) {

                                alert(
                                    device.id +
                                    " 已被其他生产任务使用。"
                                );

                                return;
                            }


                            if (
                                selectedTruckIds
                                    .includes(
                                        device.id
                                    )
                            ) {

                                selectedTruckIds =
                                    selectedTruckIds
                                        .filter(
                                            id =>
                                                id !==
                                                device.id
                                        );

                            } else {

                                selectedTruckIds
                                    .push(
                                        device.id
                                    );
                            }


                            renderTrucks();
                        }
                    );


                    board.appendChild(
                        button
                    );
                }
            );


        if (
            selectedExcavatorId
        ) {

            setText(
                "selectedExcavatorInfo",
                `当前挖机：${selectedExcavatorId} · 已选${selectedTruckIds.length}台卡车`
            );


            $("bindTrucksButton")
                ?.classList
                .remove(
                    "hidden"
                );

        } else {

            setText(
                "selectedExcavatorInfo",
                "请先选择挖机"
            );


            $("bindTrucksButton")
                ?.classList
                .add(
                    "hidden"
                );
        }
    }



    function bindSelectedTrucks() {

        if (
            !selectedExcavatorId
        ) {

            alert(
                "请选择挖机。"
            );

            return;
        }


        if (
            !selectedTruckIds.length
        ) {

            alert(
                "至少选择一台卡车。"
            );

            return;
        }


        bindings.push({

            excavatorId:
                selectedExcavatorId,

            truckIds:
                [
                    ...selectedTruckIds
                ]
        });


        selectedExcavatorId =
            null;

        selectedTruckIds =
            [];


        synchronizeDraftDriverAssignments();

        renderExcavators();

        renderTrucks();

        renderBindings();

        renderDriverAssignments();
    }



    function renderBindings() {

        const box =
            $("bindingList");


        if (!box) {
            return;
        }


        if (!bindings.length) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无设备绑定</div>';

            return;
        }


        box.innerHTML =
            bindings.map(
                (
                    binding,
                    index
                ) => `

                <div class="binding-row">

                    <div>

                        <strong>
                            🚜
                            ${escapeHtml(
                                binding.excavatorId
                            )}
                        </strong>

                        <span>
                            🚚
                            ${
                                (
                                    binding.truckIds ||
                                    []
                                )
                                    .map(
                                        escapeHtml
                                    )
                                    .join(
                                        "、"
                                    )
                            }
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
            ).join(
                ""
            );


        box.querySelectorAll(
            "[data-remove-binding]"
        )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            bindings.splice(
                                Number(
                                    button.dataset
                                        .removeBinding
                                ),
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
    统一人员库
    只读取汽车司机
    ========================================================
    */

    function getPersonnelRecords() {

        const records =
            readJson(
                STORAGE.PERSONNEL,
                []
            );


        return Array.isArray(records)
            ? records
            : [];
    }



    function normalizePosition(
        position
    ) {

        const map = {

            "卡车司机":
                "汽车司机",

            "运输司机":
                "汽车司机",

            "矿卡司机":
                "汽车司机",

            "调度员":
                "车队长"
        };


        return (
            map[position] ||
            position ||
            ""
        );
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
        );
    }



    function isApprovedPerson(
        person
    ) {

        if (!person) {
            return false;
        }


        if (
            person.enabled ===
                false
        ) {

            return false;
        }


        if (
            person.status ===
                "rejected" ||
            person.status ===
                "disabled" ||
            person.status ===
                "resigned" ||
            person.approvalStatus ===
                "rejected" ||
            person.personnelStatus ===
                "停用" ||
            person.personnelStatus ===
                "离职"
        ) {

            return false;
        }


        return (

            person.status ===
                "approved" ||

            person.status ===
                "active" ||

            person.status ===
                "working" ||

            person.status ===
                "leave" ||

            person.approvalStatus ===
                "approved" ||

            person.personnelStatus ===
                "在职可用" ||

            person.personnelStatus ===
                "作业中" ||

            person.personnelStatus ===
                "请假"
        );
    }



    function getApprovedDrivers() {

        const map =
            new Map();


        getPersonnelRecords()
            .forEach(
                person => {

                    if (
                        normalizePosition(
                            person.position
                        ) !==
                        "汽车司机"
                    ) {

                        return;
                    }


                    if (
                        !isApprovedPerson(
                            person
                        )
                    ) {

                        return;
                    }


                    const id =
                        getPersonId(
                            person
                        );


                    if (!id) {
                        return;
                    }


                    map.set(
                        id,
                        {

                            ...person,

                            personId:
                                id,

                            driverId:
                                id,

                            name:
                                person.name ||
                                "",

                            team:
                                person.team ||
                                person.department ||
                                "",

                            department:
                                person.department ||
                                person.team ||
                                "",

                            position:
                                "汽车司机"
                        }
                    );
                }
            );


        return [
            ...map.values()
        ];
    }



    /*
    ========================================================
    司机分配
    ========================================================
    */

    function synchronizeDraftDriverAssignments() {

        const trucks =
            [];


        bindings.forEach(
            binding => {

                (
                    binding.truckIds ||
                    []
                ).forEach(
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
                        driverAssignments
                            .find(
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

                        driverId:
                            "",

                        driverName:
                            "",

                        team:
                            ""
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


        if (!box) {
            return;
        }


        const total =
            driverAssignments.length;


        const completed =
            driverAssignments
                .filter(
                    item =>
                        item.driverId
                )
                .length;


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
            driverAssignments
                .map(
                    assignment => {

                        const options =
                            people.map(
                                person => {

                                    const state =
                                        getPersonStatusForDraft(
                                            person
                                        );


                                    const alreadyUsed =
                                        driverAssignments
                                            .some(
                                                item =>
                                                    item.driverId ===
                                                        person.driverId &&
                                                    item.vehicleNumber !==
                                                        assignment.vehicleNumber
                                            );


                                    const disabled =
                                        state.code ===
                                            "leave" ||
                                        state.code ===
                                            "working" ||
                                        state.code ===
                                            "disabled" ||
                                        alreadyUsed;


                                    let suffix =
                                        state.label;


                                    if (
                                        alreadyUsed
                                    ) {

                                        suffix =
                                            "本任务已分配";
                                    }


                                    return `
                                    <option
                                        value="${escapeHtml(person.driverId)}"
                                        ${
                                            assignment.driverId ===
                                            person.driverId
                                                ? "selected"
                                                : ""
                                        }
                                        ${
                                            disabled
                                                ? "disabled"
                                                : ""
                                        }
                                    >
                                        ${escapeHtml(person.name || "-")}
                                        ·
                                        ${escapeHtml(person.team || "-")}
                                        ·
                                        ${escapeHtml(suffix)}
                                    </option>
                                    `;
                                }
                            ).join(
                                ""
                            );


                        return `
                        <div class="driver-assignment-row">

                            <div class="assignment-equipment">

                                <strong>
                                    🚚
                                    ${escapeHtml(
                                        assignment.vehicleNumber
                                    )}
                                </strong>

                                <span>
                                    跟随 🚜
                                    ${escapeHtml(
                                        assignment.excavatorNumber
                                    )}
                                </span>

                            </div>


                            <select
                                data-driver-truck="${escapeHtml(
                                    assignment.vehicleNumber
                                )}"
                            >

                                <option value="">
                                    请选择司机
                                </option>

                                ${options}

                            </select>

                        </div>
                        `;
                    }
                )
                .join(
                    ""
                );


        box.querySelectorAll(
            "[data-driver-truck]"
        )
            .forEach(
                select => {

                    select.addEventListener(
                        "change",
                        function () {

                            assignDriverToTruck(
                                select.dataset
                                    .driverTruck,
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
            driverAssignments
                .find(
                    item =>
                        item.vehicleNumber ===
                        truckId
                );


        if (!assignment) {
            return;
        }


        if (!driverId) {

            assignment.driverId =
                "";

            assignment.driverName =
                "";

            assignment.team =
                "";


            renderDriverAssignments();

            return;
        }


        const person =
            getApprovedDrivers()
                .find(
                    item =>
                        item.driverId ===
                        driverId
                );


        if (!person) {

            alert(
                "该司机已经不在可调度人员中。"
            );

            renderDriverAssignments();

            return;
        }


        const state =
            getPersonStatusForDraft(
                person
            );


        if (
            state.code ===
            "leave"
        ) {

            alert(
                `${person.name} 在本班次处于已批准请假时间，不能分配任务。`
            );

            renderDriverAssignments();

            return;
        }


        if (
            state.code ===
            "working"
        ) {

            alert(
                `${person.name} 已在其他生产任务中。`
            );

            renderDriverAssignments();

            return;
        }


        if (
            state.code ===
            "disabled"
        ) {

            alert(
                `${person.name} 当前不可调度。`
            );

            renderDriverAssignments();

            return;
        }


        if (
            state.code ===
            "pending"
        ) {

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
            person.name ||
            "";


        assignment.team =
            person.team ||
            "";


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
            people.length +
            " 人"
        );


        const box =
            $("personnelStatusBoard");


        if (!box) {
            return;
        }


        if (!people.length) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无已审核汽车司机</div>';

            return;
        }


        box.innerHTML =
            people.map(
                person => {

                    const state =
                        getCurrentPersonStatus(
                            person
                        );


                    return `
                    <div class="person-card ${escapeHtml(state.code)}">

                        <div>

                            <strong>
                                ${escapeHtml(person.name || "-")}
                            </strong>

                            <span>
                                ${escapeHtml(person.team || "-")}
                                ·
                                汽车司机
                            </span>

                        </div>


                        <span class="person-state">
                            ${escapeHtml(state.label)}
                        </span>

                    </div>
                    `;
                }
            ).join(
                ""
            );
    }



    function isPersonnelDisabled(
        person
    ) {

        return (
            !person ||
            person.enabled ===
                false ||
            person.status ===
                "disabled" ||
            person.status ===
                "resigned" ||
            person.personnelStatus ===
                "停用" ||
            person.personnelStatus ===
                "离职"
        );
    }



    function getCurrentPersonStatus(
        person
    ) {

        if (
            isPersonnelDisabled(
                person
            )
        ) {

            return {

                code:
                    "disabled",

                label:
                    "⚫ 停用"
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

                code:
                    "leave",

                label:
                    "🟣 请假"
            };
        }


        if (
            getPersonActiveTask(
                person
            )
        ) {

            return {

                code:
                    "working",

                label:
                    "🔴 作业中"
            };
        }


        if (
            hasPendingLeaveAtTime(
                person,
                now
            )
        ) {

            return {

                code:
                    "pending",

                label:
                    "🟡 请假待审批"
            };
        }


        return {

            code:
                "available",

            label:
                "🟢 可调度"
        };
    }



    function getPersonStatusForDraft(
        person
    ) {

        if (!currentDraft) {

            return getCurrentPersonStatus(
                person
            );
        }


        if (
            isPersonnelDisabled(
                person
            )
        ) {

            return {

                code:
                    "disabled",

                label:
                    "⚫ 停用"
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

                code:
                    "leave",

                label:
                    "🟣 本班请假"
            };
        }


        if (
            getPersonActiveTask(
                person
            )
        ) {

            return {

                code:
                    "working",

                label:
                    "🔴 作业中"
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

                code:
                    "pending",

                label:
                    "🟡 请假待审批"
            };
        }


        return {

            code:
                "available",

            label:
                "🟢 可调度"
        };
    }



    function getPersonActiveTask(
        person
    ) {

        return (
            getTasks()
                .find(
                    task =>
                        (
                            task.status ===
                                "pending" ||
                            task.status ===
                                "active"
                        ) &&
                        (
                            task.driverAssignments ||
                            []
                        )
                            .some(
                                item =>
                                    samePerson(
                                        item.driverId,
                                        item.driverName,
                                        person
                                    )
                            )
                ) ||
            null
        );
    }



    /*
    ========================================================
    辅助车辆
    ========================================================
    */

    function renderAuxiliaryVehicles() {

        const type =
            $("auxiliaryTypeSelect")
                ?.value ||
            "";


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


        equipment[type]
            .forEach(
                vehicle => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        vehicle.id;


                    const inDraft =
                        auxiliaryAssignments
                            .some(
                                item =>
                                    item.vehicleId ===
                                    vehicle.id
                            );


                    const unavailable =
                        !isEquipmentDispatchable(
                            vehicle
                        ) ||
                        occupied.has(
                            vehicle.id
                        ) ||
                        inDraft;


                    option.disabled =
                        unavailable;


                    let suffix =
                        "";


                    if (
                        inDraft
                    ) {

                        suffix =
                            "（本任务已用）";

                    } else if (
                        occupied.has(
                            vehicle.id
                        )
                    ) {

                        suffix =
                            "（已分配）";

                    } else if (
                        !isEquipmentDispatchable(
                            vehicle
                        )
                    ) {

                        suffix =
                            "（" +
                            equipmentStateLabel(
                                vehicle
                            ) +
                            "）";
                    }


                    option.textContent =
                        vehicle.id +
                        suffix;


                    select.appendChild(
                        option
                    );
                }
            );
    }



    function addAuxiliary() {

        const type =
            $("auxiliaryTypeSelect")
                ?.value ||
            "";


        const vehicleId =
            $("auxiliaryVehicleSelect")
                ?.value ||
            "";


        const work =
            $("auxiliaryWorkInput")
                ?.value
                .trim() ||
            "";


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


        const vehicle =
            equipment[type]
                ?.find(
                    item =>
                        item.id ===
                        vehicleId
                );


        if (
            !vehicle ||
            !isEquipmentDispatchable(
                vehicle
            )
        ) {

            alert(
                "该设备当前不可调度。"
            );

            renderAuxiliaryVehicles();

            return;
        }


        auxiliaryAssignments
            .push({

                type,

                vehicleId,

                work
            });


        if (
            $("auxiliaryWorkInput")
        ) {

            $("auxiliaryWorkInput")
                .value =
                "";
        }


        renderAuxiliaryAssignments();

        renderAuxiliaryVehicles();
    }



    function renderAuxiliaryAssignments() {

        const box =
            $("auxiliaryAssignmentList");


        if (!box) {
            return;
        }


        if (
            !auxiliaryAssignments.length
        ) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无辅助车辆</div>';

            return;
        }


        box.innerHTML =
            auxiliaryAssignments
                .map(
                    (
                        item,
                        index
                    ) => `

                    <div class="binding-row">

                        <div>

                            <strong>
                                ${escapeHtml(
                                    item.vehicleId
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    item.work
                                )}
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
                )
                .join(
                    ""
                );


        box.querySelectorAll(
            "[data-remove-aux]"
        )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            auxiliaryAssignments
                                .splice(
                                    Number(
                                        button.dataset
                                            .removeAux
                                    ),
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
    发布生产任务
    ========================================================
    */

    function publishTask() {

        if (!currentDraft) {
            return;
        }


        refreshEquipmentCatalog();


        if (!bindings.length) {

            alert(
                "请至少配置一组挖机和卡车。"
            );

            return;
        }


        /*
        发布前再次验证设备状态
        */

        const occupied =
            getOccupiedEquipmentIds();


        for (
            const binding of
            bindings
        ) {

            const excavator =
                getEquipmentById(
                    binding.excavatorId
                );


            if (
                !excavator ||
                !isEquipmentDispatchable(
                    excavator
                )
            ) {

                alert(
                    `挖机 ${binding.excavatorId} 当前已经不可调度，请重新选择。`
                );

                return;
            }


            if (
                occupied.has(
                    binding.excavatorId
                )
            ) {

                alert(
                    `挖机 ${binding.excavatorId} 已被其他任务占用。`
                );

                return;
            }


            for (
                const truckId of
                binding.truckIds ||
                []
            ) {

                const truck =
                    getEquipmentById(
                        truckId
                    );


                if (
                    !truck ||
                    !isEquipmentDispatchable(
                        truck
                    )
                ) {

                    alert(
                        `车辆 ${truckId} 当前已经不可调度，请重新选择。`
                    );

                    return;
                }


                if (
                    occupied.has(
                        truckId
                    )
                ) {

                    alert(
                        `车辆 ${truckId} 已被其他任务占用。`
                    );

                    return;
                }
            }
        }


        synchronizeDraftDriverAssignments();


        const incomplete =
            driverAssignments
                .filter(
                    item =>
                        !item.driverId
                );


        if (
            incomplete.length
        ) {

            alert(
                "以下卡车尚未分配司机：\n\n" +
                incomplete
                    .map(
                        item =>
                            item.vehicleNumber
                    )
                    .join(
                        "、"
                    )
            );

            return;
        }


        const duplicateDrivers =
            findDuplicateDriverIds(
                driverAssignments
            );


        if (
            duplicateDrivers.length
        ) {

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
                getApprovedDrivers()
                    .find(
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
                state.code ===
                    "leave" ||
                state.code ===
                    "working" ||
                state.code ===
                    "disabled"
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


        for (
            const item of
            auxiliaryAssignments
        ) {

            const vehicle =
                getEquipmentById(
                    item.vehicleId
                );


            if (
                !vehicle ||
                !isEquipmentDispatchable(
                    vehicle
                )
            ) {

                alert(
                    `辅助设备 ${item.vehicleId} 当前已经不可调度。`
                );

                return;
            }


            if (
                occupied.has(
                    item.vehicleId
                )
            ) {

                alert(
                    `辅助设备 ${item.vehicleId} 已被其他任务占用。`
                );

                return;
            }
        }


        const task = {

            ...currentDraft,

            status:
                "pending",

            bindings:
                clone(
                    bindings
                ),

            driverAssignments:
                clone(
                    driverAssignments
                )
                    .map(
                        item => ({

                            ...item,

                            loadingPoint:
                                currentDraft
                                    .loadingPoint,

                            unloadingPoint:
                                currentDraft
                                    .unloadingPoint
                        })
                    ),

            auxiliaryAssignments:
                clone(
                    auxiliaryAssignments
                ),

            equipmentAdjustments:
                [],

            publishedAt:
                new Date()
                    .toISOString()
        };


        const tasks =
            getTasks();


        tasks.push(
            task
        );


        saveTasks(
            tasks
        );


        localStorage.setItem(
            STORAGE.LEGACY_TASK,
            JSON.stringify(
                task
            )
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



    /*
    ========================================================
    本机司机兼容
    ========================================================
    */

    function syncTaskToLocalDriver(
        task
    ) {

        let localDriver =
            null;


        const currentPersonId =
            localStorage.getItem(
                "currentPersonId"
            );


        if (
            currentPersonId
        ) {

            localDriver =
                getPersonnelRecords()
                    .find(
                        person =>
                            getPersonId(
                                person
                            ) ===
                            currentPersonId
                    ) ||
                null;
        }


        if (
            !localDriver
        ) {

            localDriver =
                readJson(
                    STORAGE.DRIVER_PROFILE,
                    null
                );
        }


        if (
            !localDriver
        ) {

            return;
        }


        const assignment =
            (
                task.driverAssignments ||
                []
            )
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

            driverId:
                assignment.driverId,

            driverName:
                assignment.driverName,

            workArea:
                task.area ||
                "",

            shift:
                task.shift ||
                "",

            remark:
                task.remark ||
                "",

            vehicleNumber:
                assignment.vehicleNumber,

            vehicleId:
                assignment.vehicleId,

            excavatorNumber:
                assignment.excavatorNumber,

            excavatorId:
                assignment.excavatorId,

            loadingPoint:
                task.loadingPoint ||
                "",

            unloadingPoint:
                task.unloadingPoint ||
                "",

            status:
                "assigned",

            vehicleClaimed:
                false,

            createdAt:
                task.publishedAt
        };


        localStorage.setItem(
            STORAGE.DRIVER_CURRENT_TASK,
            JSON.stringify(
                driverTask
            )
        );
    }



    /*
    ========================================================
    任务状态
    ========================================================
    */

    function synchronizeTaskStatus() {

        const tasks =
            getTasks();


        let changed =
            false;


        tasks.forEach(
            task => {

                if (
                    task.status !==
                        "pending" &&
                    task.status !==
                        "active"
                ) {

                    return;
                }


                const tripCount =
                    getTaskTrips(
                        task
                    )
                        .filter(
                            trip =>
                                trip.dispatchConfirmation !==
                                "rejected"
                        )
                        .length;


                if (
                    task.status ===
                        "pending" &&
                    tripCount > 0
                ) {

                    task.status =
                        "active";


                    task.startedAt =
                        task.startedAt ||
                        new Date()
                            .toISOString();


                    changed =
                        true;
                }
            }
        );


        if (changed) {

            saveTasks(
                tasks
            );
        }
    }



    /*
    ========================================================
    生产看板
    ========================================================
    */

    function renderProductionBoard() {

        const tasks =
            getTasks()
                .filter(
                    task =>
                        task.status ===
                            "pending" ||
                        task.status ===
                            "active"
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        new Date(
                            b.publishedAt ||
                            0
                        ) -
                        new Date(
                            a.publishedAt ||
                            0
                        )
                );


        setText(
            "productionTaskCount",
            `${tasks.length} 个进行中任务`
        );


        const board =
            $("productionTaskBoard");


        if (!board) {
            return;
        }


        if (!tasks.length) {

            board.innerHTML =
                '<div class="empty-placeholder">当前没有进行中的生产任务</div>';

            return;
        }


        board.innerHTML =
            tasks.map(
                task => {

                    const trips =
                        getTaskTrips(
                            task
                        );


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
                                    ${escapeHtml(
                                        task.date ||
                                        task.dateKey ||
                                        "-"
                                    )}
                                </span>

                            </div>


                            <span
                                class="task-status-pill ${escapeHtml(task.status)}"
                            >
                                ${
                                    task.status ===
                                    "active"
                                        ? "执行中"
                                        : "待执行"
                                }
                            </span>

                        </div>


                        <div class="task-stat-grid">

                            <div>
                                <span>挖机</span>
                                <strong>
                                    ${
                                        (
                                            task.bindings ||
                                            []
                                        ).length
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>卡车</span>
                                <strong>
                                    ${
                                        (
                                            task.driverAssignments ||
                                            []
                                        ).length
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>司机</span>
                                <strong>
                                    ${
                                        (
                                            task.driverAssignments ||
                                            []
                                        ).length
                                    }
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
            ).join(
                ""
            );


        board.querySelectorAll(
            "[data-task]"
        )
            .forEach(
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



    /*
    ========================================================
    任务详情
    ========================================================
    */

    function openTaskDetail(
        taskId
    ) {

        const task =
            getTaskById(
                taskId
            );


        if (!task) {
            return;
        }


        openedTaskId =
            taskId;


        if (
            $("publishedTaskModalTitle")
        ) {

            $("publishedTaskModalTitle")
                .textContent =
                "生产任务 · " +
                (
                    task.area ||
                    "-"
                );
        }


        const driverHtml =
            (
                task.driverAssignments ||
                []
            ).length
                ?
                task.driverAssignments
                    .map(
                        item => `

                        <div class="detail-driver-row">

                            <span>
                                🚜
                                ${escapeHtml(
                                    item.excavatorNumber ||
                                    "-"
                                )}
                            </span>

                            <strong>
                                🚚
                                ${escapeHtml(
                                    item.vehicleNumber ||
                                    "-"
                                )}
                            </strong>

                            <b>
                                👷
                                ${escapeHtml(
                                    item.driverName ||
                                    "-"
                                )}
                            </b>

                        </div>
                        `
                    ).join(
                        ""
                    )
                :
                '<div class="empty-placeholder">无司机分配资料</div>';


        const tripCount =
            getTaskTrips(
                task
            ).length;


        if (
            $("publishedTaskModalContent")
        ) {

            $("publishedTaskModalContent")
                .innerHTML = `

                <div class="detail-summary-grid">

                    <div>
                        <span>任务编号</span>
                        <strong>
                            ${escapeHtml(task.taskId)}
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
                        <span>当前趟数</span>
                        <strong>
                            ${tripCount}
                        </strong>
                    </div>

                </div>


                <h4>
                    👷 人员 / 车辆 / 挖机
                </h4>

                ${driverHtml}


                <h4>
                    运输路线
                </h4>

                <div class="detail-note">
                    ${escapeHtml(task.loadingPoint || "-")}
                    →
                    ${escapeHtml(task.unloadingPoint || "-")}
                </div>


                <h4>
                    调度说明
                </h4>

                <div class="detail-note">
                    ${escapeHtml(task.remark || "无")}
                </div>
                `;
        }


        $("withdrawPublishedTaskButton")
            ?.classList
            .toggle(
                "hidden",
                task.status !==
                "pending"
            );


        $("completePublishedTaskButton")
            ?.classList
            .toggle(
                "hidden",
                task.status !==
                "active"
            );


        showModal(
            "publishedTaskModal"
        );
    }



    function withdrawOpenedTask() {

        const task =
            getTaskById(
                openedTaskId
            );


        if (
            !task ||
            task.status !==
            "pending"
        ) {

            return;
        }


        if (
            getTaskTrips(
                task
            ).length
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
            getTasks()
                .filter(
                    item =>
                        item.taskId !==
                        openedTaskId
                );


        saveTasks(
            tasks
        );


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
                    item.taskId ===
                    openedTaskId
            );


        if (!task) {
            return;
        }


        if (
            task.status !==
            "active"
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
            new Date()
                .toISOString();


        saveTasks(
            tasks
        );


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
            current.taskId ===
            taskId
        ) {

            current.status =
                "completed";


            current.completedAt =
                new Date()
                    .toISOString();


            localStorage.setItem(
                STORAGE.DRIVER_CURRENT_TASK,
                JSON.stringify(
                    current
                )
            );
        }
    }



    /*
    ========================================================
    历史任务
    ========================================================
    */

    function toggleHistory() {

        $("historyTaskSection")
            ?.classList
            .toggle(
                "hidden"
            );


        renderHistory();
    }



    function renderHistory() {

        const board =
            $("historyTaskBoard");


        if (!board) {
            return;
        }


        let tasks =
            getTasks()
                .filter(
                    item =>
                        item.status ===
                        "completed"
                );


        const date =
            $("historyDateFilter")
                ?.value ||
            "";


        const shift =
            $("historyShiftFilter")
                ?.value ||
            "";


        const area =
            $("historyAreaFilter")
                ?.value
                .trim()
                .toLowerCase() ||
            "";


        if (date) {

            tasks =
                tasks.filter(
                    task =>
                        task.dateKey ===
                        date
                );
        }


        if (shift) {

            tasks =
                tasks.filter(
                    task =>
                        task.shift ===
                        shift
                );
        }


        if (area) {

            tasks =
                tasks.filter(
                    task =>
                        String(
                            task.area ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                area
                            )
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


        tasks.sort(
            (
                a,
                b
            ) =>
                new Date(
                    b.completedAt ||
                    b.publishedAt ||
                    0
                ) -
                new Date(
                    a.completedAt ||
                    a.publishedAt ||
                    0
                )
        );


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
                                ${
                                    (
                                        task.driverAssignments ||
                                        []
                                    ).length
                                }
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
            ).join(
                ""
            );


        board.querySelectorAll(
            "[data-history]"
        )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            openTaskDetail(
                                button.dataset
                                    .history
                            )
                    );
                }
            );
    }



    /*
    ========================================================
    换车审批
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
                        item.status ===
                        "pending"
                );


        const box =
            $("vehicleChangeRequestList");


        if (!box) {
            return;
        }


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


                        <select
                            data-change-vehicle="${escapeHtml(item.requestId)}"
                        >

                            <option value="">
                                选择新车辆
                            </option>

                            ${
                                trucks
                                    .map(
                                        truck => `
                                        <option value="${escapeHtml(truck.id)}">
                                            ${escapeHtml(truck.id)}
                                        </option>
                                        `
                                    )
                                    .join(
                                        ""
                                    )
                            }

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
            ).join(
                ""
            );


        box.querySelectorAll(
            "[data-change-approve]"
        )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            approveVehicleChange(
                                button.dataset
                                    .changeApprove
                            )
                    );
                }
            );


        box.querySelectorAll(
            "[data-change-reject]"
        )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            rejectVehicleChange(
                                button.dataset
                                    .changeReject
                            )
                    );
                }
            );
    }



    function approveVehicleChange(
        requestId
    ) {

        refreshEquipmentCatalog();


        const selector =
            `[data-change-vehicle="${cssEscape(requestId)}"]`;


        const select =
            document.querySelector(
                selector
            );


        const newVehicle =
            select?.value ||
            "";


        if (!newVehicle) {

            alert(
                "请选择替换车辆。"
            );

            return;
        }


        const available =
            getAvailableReplacementTrucks(
                getChangeRequests()
                    .find(
                        item =>
                            item.requestId ===
                            requestId
                    )
                    ?.taskId ||
                ""
            );


        if (
            !available.some(
                item =>
                    item.id ===
                    newVehicle
            )
        ) {

            alert(
                "该车辆当前已经不可用，请重新选择。"
            );

            renderVehicleChanges();

            return;
        }


        const requests =
            getChangeRequests();


        const request =
            requests.find(
                item =>
                    item.requestId ===
                    requestId
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
            new Date()
                .toISOString();


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
                    item.taskId ===
                    taskId
            );


        if (!task) {
            return;
        }


        (
            task.bindings ||
            []
        ).forEach(
            binding => {

                binding.truckIds =
                    (
                        binding.truckIds ||
                        []
                    )
                        .map(
                            truckId =>
                                truckId ===
                                oldVehicle
                                    ? newVehicle
                                    : truckId
                        );
            }
        );


        const assignment =
            (
                task.driverAssignments ||
                []
            )
                .find(
                    item =>
                        (
                            driverId &&
                            item.driverId ===
                            driverId
                        ) ||
                        (
                            !driverId &&
                            item.driverName ===
                            driverName
                        )
                );


        if (assignment) {

            assignment.vehicleId =
                newVehicle;


            assignment.vehicleNumber =
                newVehicle;
        }


        task.equipmentAdjustments =
            task.equipmentAdjustments ||
            [];


        task.equipmentAdjustments
            .push({

                adjustmentId:
                    "CHANGE_" +
                    Date.now(),

                time:
                    new Date()
                        .toISOString(),

                summary:
                    `故障换车：${oldVehicle} → ${newVehicle}`,

                driverName:
                    driverName ||
                    ""
            });


        saveTasks(
            tasks
        );


        updateLocalDriverVehicleAfterChange(
            taskId,
            driverId,
            driverName,
            newVehicle
        );
    }



    function updateLocalDriverVehicleAfterChange(
        taskId,
        driverId,
        driverName,
        newVehicle
    ) {

        const current =
            readJson(
                STORAGE.DRIVER_CURRENT_TASK,
                null
            );


        if (
            !current ||
            current.taskId !==
                taskId
        ) {

            return;
        }


        const same =
            (
                driverId &&
                String(
                    current.driverId ||
                    ""
                ) ===
                String(
                    driverId
                )
            ) ||
            (
                !driverId &&
                String(
                    current.driverName ||
                    ""
                ).trim() ===
                String(
                    driverName ||
                    ""
                ).trim()
            );


        if (!same) {
            return;
        }


        current.vehicleId =
            newVehicle;


        current.vehicleNumber =
            newVehicle;


        current.vehicleClaimed =
            false;


        current.updatedAt =
            new Date()
                .toISOString();


        localStorage.setItem(
            STORAGE.DRIVER_CURRENT_TASK,
            JSON.stringify(
                current
            )
        );
    }



    function rejectVehicleChange(
        requestId
    ) {

        const reason =
            prompt(
                "请输入驳回原因："
            );


        if (
            reason ===
            null
        ) {

            return;
        }


        const records =
            getChangeRequests();


        const record =
            records.find(
                item =>
                    item.requestId ===
                    requestId
            );


        if (!record) {
            return;
        }


        record.status =
            "rejected";


        record.rejectReason =
            reason.trim();


        record.rejectedAt =
            new Date()
                .toISOString();


        record.rejectedBy =
            "调度端";


        saveChangeRequests(
            records
        );


        renderVehicleChanges();

        refreshAll();
    }



    function getAvailableReplacementTrucks(
        taskId
    ) {

        refreshEquipmentCatalog();


        const occupied =
            getOccupiedEquipmentIds(
                taskId
            );


        return equipment.trucks
            .filter(
                truck =>
                    isEquipmentDispatchable(
                        truck
                    ) &&
                    !occupied.has(
                        truck.id
                    )
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
            getTrips()
                .filter(
                    trip =>
                        trip.gpsStatus !==
                            "正常" &&
                        trip.gpsStatus !==
                            "normal" &&
                        trip.dispatchConfirmation !==
                            "confirmed" &&
                        trip.dispatchConfirmation !==
                            "rejected"
                );


        const box =
            $("gpsReviewList");


        if (!box) {
            return;
        }


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
                                        ?
                                        "±" +
                                        Math.round(
                                            record.gpsAccuracy
                                        ) +
                                        "米"
                                        :
                                        "无定位"
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
            ).join(
                ""
            );


        box.querySelectorAll(
            "[data-gps-confirm]"
        )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            reviewGpsTrip(
                                button.dataset
                                    .gpsConfirm,
                                true
                            )
                    );
                }
            );


        box.querySelectorAll(
            "[data-gps-reject]"
        )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            reviewGpsTrip(
                                button.dataset
                                    .gpsReject,
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


        if (
            remark ===
            null
        ) {

            return;
        }


        const trips =
            getTrips();


        const record =
            trips.find(
                item =>
                    getTripId(
                        item
                    ) ===
                    tripId
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
            new Date()
                .toISOString();


        record.dispatchReviewedBy =
            "调度端";


        record.dispatchReviewNote =
            remark.trim();


        saveTrips(
            trips
        );


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
                        item.status ===
                            "pending" &&
                        item.approverRole ===
                            "dispatch"
                );


        const box =
            $("leaveReviewList");


        if (!box) {
            return;
        }


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
                            ${escapeHtml(
                                item.leaveType ||
                                "请假"
                            )}
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
            ).join(
                ""
            );


        box.querySelectorAll(
            "[data-leave-approve]"
        )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            reviewDriverLeave(
                                button.dataset
                                    .leaveApprove,
                                true
                            )
                    );
                }
            );


        box.querySelectorAll(
            "[data-leave-reject]"
        )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            reviewDriverLeave(
                                button.dataset
                                    .leaveReject,
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


        if (
            note ===
            null
        ) {

            return;
        }


        const records =
            getLeaves();


        const item =
            records.find(
                record =>
                    record.leaveId ===
                    leaveId
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
            new Date()
                .toISOString();


        item.reviewedBy =
            "调度端";


        item.reviewedAt =
            item.approvedAt;


        item.approvalRemark =
            note.trim();


        item.reviewRemark =
            note.trim();


        saveLeaves(
            records
        );


        renderLeaveReview();

        refreshAll();
    }



    /*
    ========================================================
    调度本人资料
    ========================================================
    */

    function getCurrentDispatchPerson() {

        const currentPersonId =
            localStorage.getItem(
                "currentPersonId"
            );


        if (!currentPersonId) {
            return null;
        }


        return (
            getPersonnelRecords()
                .find(
                    person =>
                        getPersonId(
                            person
                        ) ===
                            currentPersonId &&
                        normalizePosition(
                            person.position
                        ) ===
                            "车队长"
                ) ||
            null
        );
    }



    /*
    ========================================================
    调度自己的请假
    -> 总经理
    ========================================================
    */

    function openMyLeave() {

        const person =
            getCurrentDispatchPerson();


        const legacyProfile =
            readJson(
                STORAGE.DISPATCH_PROFILE,
                null
            );


        const profile =
            person ||
            legacyProfile;


        if (profile) {

            if (
                $("leaveApplicantName")
            ) {

                $("leaveApplicantName")
                    .value =
                    profile.name ||
                    "";
            }


            if (
                $("leaveApplicantPosition")
            ) {

                $("leaveApplicantPosition")
                    .value =
                    normalizePosition(
                        profile.position ||
                        "车队长"
                    );
            }
        }


        showModal(
            "myLeaveModal"
        );
    }



    function submitMyLeave() {

        const name =
            $("leaveApplicantName")
                ?.value
                .trim() ||
            "";


        const position =
            normalizePosition(
                $("leaveApplicantPosition")
                    ?.value
                    .trim() ||
                "车队长"
            );


        const start =
            $("leaveStart")
                ?.value ||
            "";


        const end =
            $("leaveEnd")
                ?.value ||
            "";


        const reason =
            $("leaveReason")
                ?.value
                .trim() ||
            "";


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
            new Date(
                end
            ) <=
            new Date(
                start
            )
        ) {

            alert(
                "结束时间必须晚于开始时间。"
            );

            return;
        }


        const person =
            getCurrentDispatchPerson();


        const applicantId =
            person
                ? getPersonId(
                    person
                )
                :
                "MANAGEMENT_" +
                Date.now();


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
                "LEAVE_" +
                Date.now(),

            applicantId,

            personId:
                applicantId,

            applicantName:
                name,

            personName:
                name,

            role:
                "management",

            position,

            team:
                person?.department ||
                person?.team ||
                "管理人员",

            leaveType:
                $("leaveType")
                    ?.value ||
                "事假",

            startTime:
                new Date(
                    start
                )
                    .toISOString(),

            endTime:
                new Date(
                    end
                )
                    .toISOString(),

            reason,

            status:
                "pending",

            approvalRoute:
                "general_manager",

            approverRole:
                "general_manager",

            submittedAt:
                new Date()
                    .toISOString()
        });


        saveLeaves(
            records
        );


        hideModal(
            "myLeaveModal"
        );


        if (
            $("leaveStart")
        ) {

            $("leaveStart").value =
                "";
        }


        if (
            $("leaveEnd")
        ) {

            $("leaveEnd").value =
                "";
        }


        if (
            $("leaveReason")
        ) {

            $("leaveReason").value =
                "";
        }


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


        const currentValue =
            select.value;


        select.innerHTML =
            '<option value="">选择人员</option>';


        people.forEach(
            person => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    person.driverId;


                option.dataset.name =
                    person.name ||
                    "";


                option.dataset.team =
                    person.team ||
                    "";


                option.textContent =
                    `${person.name || "-"} · ${person.team || "-"}`;


                select.appendChild(
                    option
                );
            }
        );


        if (
            people.some(
                person =>
                    person.driverId ===
                    currentValue
            )
        ) {

            select.value =
                currentValue;
        }
    }



    function submitPenalty() {

        const select =
            $("penaltyPerson");


        if (
            !select ||
            !select.value
        ) {

            alert(
                "请选择人员。"
            );

            return;
        }


        const option =
            select.options[
                select.selectedIndex
            ];


        const description =
            $("penaltyDescription")
                ?.value
                .trim() ||
            "";


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
                "PENALTY_" +
                Date.now(),

            personId:
                select.value,

            driverId:
                select.value,

            personName:
                option.dataset
                    .name ||
                "",

            team:
                option.dataset
                    .team ||
                "",

            position:
                "汽车司机",

            vehicleNumber:
                $("penaltyVehicle")
                    ?.value
                    .trim() ||
                "",

            violationType:
                $("penaltyType")
                    ?.value ||
                "其他",

            amount:
                Number(
                    $("penaltyAmount")
                        ?.value ||
                    0
                ),

            points:
                Number(
                    $("penaltyPoints")
                        ?.value ||
                    0
                ),

            description,

            status:
                "pending_acknowledgement",

            issuedBy:
                "调度端",

            issuedAt:
                new Date()
                    .toISOString()
        });


        savePenalties(
            penalties
        );


        hideModal(
            "penaltyModal"
        );


        if (
            $("penaltyVehicle")
        ) {

            $("penaltyVehicle")
                .value =
                "";
        }


        if (
            $("penaltyAmount")
        ) {

            $("penaltyAmount")
                .value =
                "";
        }


        if (
            $("penaltyPoints")
        ) {

            $("penaltyPoints")
                .value =
                "";
        }


        if (
            $("penaltyDescription")
        ) {

            $("penaltyDescription")
                .value =
                "";
        }


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


        if (!box) {
            return;
        }


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
                                item.status ===
                                "acknowledged"
                                    ? "已知晓"
                                    :
                                item.status ===
                                "processed"
                                    ? "已处理"
                                    :
                                    "待确认"
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
            ).join(
                ""
            );
    }



    /*
    ========================================================
    待办
    ========================================================
    */

    function renderTodoCounts() {

        setText(
            "vehicleChangeTodoCount",
            getChangeRequests()
                .filter(
                    item =>
                        item.status ===
                        "pending"
                )
                .length
        );


        setText(
            "gpsTodoCount",
            getTrips()
                .filter(
                    item =>
                        item.gpsStatus !==
                            "正常" &&
                        item.gpsStatus !==
                            "normal" &&
                        item.dispatchConfirmation !==
                            "confirmed" &&
                        item.dispatchConfirmation !==
                            "rejected"
                )
                .length
        );


        setText(
            "leaveTodoCount",
            getLeaves()
                .filter(
                    item =>
                        item.status ===
                            "pending" &&
                        item.approverRole ===
                            "dispatch"
                )
                .length
        );


        setText(
            "penaltyTodoCount",
            getPenalties()
                .filter(
                    item =>
                        item.status ===
                        "pending_acknowledgement"
                )
                .length
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

        return getLeaves()
            .some(
                leave => {

                    if (
                        leave.status !==
                        "approved"
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


                    if (
                        Number.isNaN(
                            leaveStart.getTime()
                        ) ||
                        Number.isNaN(
                            leaveEnd.getTime()
                        )
                    ) {

                        return false;
                    }


                    return (
                        leaveStart <=
                            end &&
                        leaveEnd >=
                            start
                    );
                }
            );
    }



    function hasPendingLeaveOverlap(
        person,
        start,
        end
    ) {

        return getLeaves()
            .some(
                leave => {

                    if (
                        leave.status !==
                        "pending"
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


                    if (
                        Number.isNaN(
                            leaveStart.getTime()
                        ) ||
                        Number.isNaN(
                            leaveEnd.getTime()
                        )
                    ) {

                        return false;
                    }


                    return (
                        leaveStart <
                            end &&
                        leaveEnd >
                            start
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
                time.getTime() +
                1000
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


        const personId =
            getPersonId(
                person
            );


        if (
            leaveId &&
            personId
        ) {

            return (
                String(
                    leaveId
                ) ===
                String(
                    personId
                )
            );
        }


        const leaveName =
            leave.applicantName ||
            leave.personName ||
            "";


        return (
            String(
                leaveName
            ).trim() &&
            String(
                leaveName
            ).trim() ===
            String(
                person.name ||
                ""
            ).trim()
        );
    }



    function getTaskDateRange(
        task
    ) {

        const dateKey =
            task.dateKey ||
            getLocalDateKey();


        const start =
            new Date(
                `${dateKey}T${
                    task.shift ===
                    "夜班"
                        ? "20:00:00"
                        : "08:00:00"
                }`
            );


        const end =
            new Date(
                start
            );


        if (
            task.shift ===
            "夜班"
        ) {

            end.setDate(
                end.getDate() +
                1
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
    数据迁移
    ========================================================
    */

    function migrateTasks() {

        let tasks =
            getTasks();


        tasks =
            tasks.filter(
                task =>
                    task.status !==
                    "withdrawn"
            );


        tasks.forEach(
            task => {

                if (
                    !Array.isArray(
                        task.driverAssignments
                    )
                ) {

                    task.driverAssignments =
                        [];
                }


                if (
                    !Array.isArray(
                        task.bindings
                    )
                ) {

                    task.bindings =
                        [];
                }


                if (
                    !Array.isArray(
                        task.auxiliaryAssignments
                    )
                ) {

                    task.auxiliaryAssignments =
                        [];
                }


                if (
                    !Array.isArray(
                        task.equipmentAdjustments
                    )
                ) {

                    task.equipmentAdjustments =
                        [];
                }
            }
        );


        saveTasks(
            tasks
        );
    }



    /*
    ========================================================
    数据读写
    ========================================================
    */

    function getTasks() {

        const data =
            readJson(
                STORAGE.TASKS,
                []
            );


        return Array.isArray(
            data
        )
            ? data
            : [];
    }



    function saveTasks(
        tasks
    ) {

        localStorage.setItem(
            STORAGE.TASKS,
            JSON.stringify(
                tasks
            )
        );
    }



    function getTaskById(
        taskId
    ) {

        return (
            getTasks()
                .find(
                    task =>
                        task.taskId ===
                        taskId
                ) ||
            null
        );
    }



    function getTrips() {

        const data =
            readJson(
                STORAGE.TRIPS,
                []
            );


        return Array.isArray(
            data
        )
            ? data
            : [];
    }



    function saveTrips(
        records
    ) {

        localStorage.setItem(
            STORAGE.TRIPS,
            JSON.stringify(
                records
            )
        );
    }



    function getTaskTrips(
        task
    ) {

        return getTrips()
            .filter(
                trip =>
                    trip.taskId ===
                        task.taskId ||
                    trip.dispatchTaskId ===
                        task.taskId
            );
    }



    function getChangeRequests() {

        const data =
            readJson(
                STORAGE.CHANGE_REQUESTS,
                []
            );


        return Array.isArray(
            data
        )
            ? data
            : [];
    }



    function saveChangeRequests(
        records
    ) {

        localStorage.setItem(
            STORAGE.CHANGE_REQUESTS,
            JSON.stringify(
                records
            )
        );
    }



    function getLeaves() {

        const data =
            readJson(
                STORAGE.LEAVES,
                []
            );


        return Array.isArray(
            data
        )
            ? data
            : [];
    }



    function saveLeaves(
        records
    ) {

        localStorage.setItem(
            STORAGE.LEAVES,
            JSON.stringify(
                records
            )
        );
    }



    function getPenalties() {

        const data =
            readJson(
                STORAGE.PENALTIES,
                []
            );


        return Array.isArray(
            data
        )
            ? data
            : [];
    }



    function savePenalties(
        records
    ) {

        localStorage.setItem(
            STORAGE.PENALTIES,
            JSON.stringify(
                records
            )
        );
    }



    /*
    ========================================================
    设备样式
    ========================================================
    */

    function getDeviceClass(
        device,
        occupied,
        selected,
        draftUsed
    ) {

        if (draftUsed) {

            return (
                "device-card draft-used"
            );
        }


        if (selected) {

            return (
                "device-card selected"
            );
        }


        if (
            device.status ===
                "maintenance" ||
            device.status ===
                "service" ||
            device.status ===
                "disabled" ||
            device.status ===
                "working"
        ) {

            return (
                "device-card maintenance"
            );
        }


        if (
            occupied.has(
                device.id
            )
        ) {

            return (
                "device-card occupied"
            );
        }


        return (
            "device-card available"
        );
    }



    /*
    ========================================================
    人员比较
    ========================================================
    */

    function samePerson(
        id,
        name,
        person
    ) {

        const personId =
            getPersonId(
                person
            );


        if (
            id &&
            personId
        ) {

            return (
                String(
                    id
                ) ===
                String(
                    personId
                )
            );
        }


        return (
            String(
                name ||
                ""
            ).trim() &&
            String(
                name ||
                ""
            ).trim() ===
            String(
                person.name ||
                ""
            ).trim()
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

                if (
                    !item.driverId
                ) {

                    return;
                }


                if (
                    seen.has(
                        item.driverId
                    )
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


        return [
            ...duplicates
        ];
    }



    /*
    ========================================================
    工具
    ========================================================
    */

    function getTripId(
        item
    ) {

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
                date.getMonth() +
                1
            ).padStart(
                2,
                "0"
            ),

            String(
                date.getDate()
            ).padStart(
                2,
                "0"
            )

        ].join(
            "-"
        );
    }



    function clearTaskInputs() {

        if (
            $("taskArea")
        ) {

            $("taskArea").value =
                "";
        }


        if (
            $("taskLoadingPoint")
        ) {

            $("taskLoadingPoint").value =
                "";
        }


        if (
            $("taskUnloadingPoint")
        ) {

            $("taskUnloadingPoint").value =
                "";
        }


        if (
            $("taskRemark")
        ) {

            $("taskRemark").value =
                "";
        }
    }



    function showModal(
        id
    ) {

        $(id)
            ?.classList
            .remove(
                "hidden"
            );


        document.body
            .classList
            .add(
                "modal-open"
            );
    }



    function hideModal(
        id
    ) {

        $(id)
            ?.classList
            .add(
                "hidden"
            );


        document.body
            .classList
            .remove(
                "modal-open"
            );
    }



    function setText(
        id,
        text
    ) {

        const el =
            $(id);


        if (el) {

            el.textContent =
                text;
        }
    }



    function formatDateTime(
        value
    ) {

        if (!value) {

            return "-";
        }


        const date =
            new Date(
                value
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "-";
        }


        return date
            .toLocaleString(
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



    function clone(
        value
    ) {

        return JSON.parse(
            JSON.stringify(
                value
            )
        );
    }



    function readJson(
        key,
        fallback
    ) {

        try {

            const raw =
                localStorage.getItem(
                    key
                );


            return raw
                ? JSON.parse(
                    raw
                )
                : fallback;


        } catch (
            error
        ) {

            console.error(
                "读取数据失败：",
                key,
                error
            );


            return fallback;
        }
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
                value ??
                ""
            );


        return div.innerHTML;
    }
/* =========================================================
   V2.9.8B-1
   挖机司机 + 跟随车辆 + 挖机车数统计
========================================================= */


/* =========================================================
   当前草稿挖机司机分配
========================================================= */

let excavatorDriverAssignments =
    [];


/* =========================================================
   挖机司机人员库
========================================================= */

function getApprovedExcavatorDrivers() {

    let records =
        readJson(
            STORAGE.PERSONNEL,
            []
        );


    if (
        !Array.isArray(
            records
        )
    ) {

        records =
            [];

    }


    const map =
        new Map();


    records.forEach(
        person => {

            const position =
                normalizeDispatchPosition(
                    person.position
                );


            if (
                position !==
                "挖机司机"
            ) {

                return;

            }


            if (
                !isDispatchApprovedPerson(
                    person
                )
            ) {

                return;

            }


            const personId =
                getDispatchPersonId(
                    person
                );


            if (!personId) {

                return;

            }


            map.set(
                personId,
                {

                    ...person,

                    personId,

                    driverId:
                        personId,

                    name:
                        person.name ||
                        "",

                    team:
                        person.team ||
                        person.department ||
                        "",

                    position:
                        "挖机司机"
                }
            );

        }
    );


    return [
        ...map.values()
    ];

}


/* =========================================================
   岗位兼容
========================================================= */

function normalizeDispatchPosition(
    position
) {

    const map = {

        "卡车司机":
            "汽车司机",

        "运输司机":
            "汽车司机",

        "矿卡司机":
            "汽车司机",

        "挖掘机司机":
            "挖机司机",

        "挖机操作手":
            "挖机司机",

        "挖掘机操作手":
            "挖机司机",

        "调度员":
            "车队长"

    };


    return (
        map[position] ||
        position ||
        ""
    );

}


/* =========================================================
   人员ID
========================================================= */

function getDispatchPersonId(
    person
) {

    return String(

        person?.personId ||

        person?.driverId ||

        person?.employeeId ||

        person?.id ||

        ""

    );

}


/* =========================================================
   人员审核状态
========================================================= */

function isDispatchApprovedPerson(
    person
) {

    if (!person) {

        return false;

    }


    if (
        person.enabled === false ||

        person.status ===
            "rejected" ||

        person.status ===
            "disabled" ||

        person.status ===
            "resigned" ||

        person.approvalStatus ===
            "rejected" ||

        person.personnelStatus ===
            "停用" ||

        person.personnelStatus ===
            "离职"
    ) {

        return false;

    }


    return (

        person.status ===
            "approved" ||

        person.status ===
            "active" ||

        person.status ===
            "working" ||

        person.status ===
            "leave" ||

        person.approvalStatus ===
            "approved" ||

        person.personnelStatus ===
            "在职可用" ||

        person.personnelStatus ===
            "作业中" ||

        person.personnelStatus ===
            "请假"

    );

}


/* =========================================================
   根据当前挖机绑定生成挖机司机分配
========================================================= */

function synchronizeExcavatorDriverAssignments() {

    const excavatorIds =
        bindings
            .map(
                item =>
                    item.excavatorId
            )
            .filter(
                Boolean
            );


    excavatorDriverAssignments =
        excavatorIds.map(
            excavatorId => {

                const old =
                    excavatorDriverAssignments
                        .find(
                            item =>
                                item.excavatorId ===
                                excavatorId
                        );


                if (old) {

                    return old;

                }


                return {

                    excavatorId,

                    driverId:
                        "",

                    driverName:
                        "",

                    team:
                        ""
                };

            }
        );

}


/* =========================================================
   自动创建挖机司机分配区域

   不需要修改 dispatch.html
========================================================= */

function ensureExcavatorDriverSection() {

    if (
        document.getElementById(
            "excavatorDriverSection"
        )
    ) {

        return;

    }


    const driverSection =
        document.getElementById(
            "driverAssignmentSection"
        );


    if (!driverSection) {

        return;

    }


    const section =
        document.createElement(
            "section"
        );


    section.id =
        "excavatorDriverSection";


    section.className =
        "dispatch-card hidden";


    section.innerHTML = `

        <div class="section-title">

            <div>

                <h2>
                    🚜 挖机司机分配
                </h2>

                <p>
                    为每台挖机指定一名挖机司机
                </p>

            </div>


            <span
                id="excavatorDriverStatus"
                class="count-badge"
            >
                0 / 0
            </span>

        </div>


        <div
            id="excavatorDriverAssignmentList"
        >

            <div class="empty-placeholder">
                请先绑定挖机和卡车
            </div>

        </div>

    `;


    driverSection.parentNode
        .insertBefore(
            section,
            driverSection
        );

}


/* =========================================================
   显示挖机司机分配
========================================================= */

function renderExcavatorDriverAssignments() {

    ensureExcavatorDriverSection();


    if (!currentDraft) {

        return;

    }


    synchronizeExcavatorDriverAssignments();


    const section =
        document.getElementById(
            "excavatorDriverSection"
        );


    const box =
        document.getElementById(
            "excavatorDriverAssignmentList"
        );


    if (
        !section ||
        !box
    ) {

        return;

    }


    section.classList.remove(
        "hidden"
    );


    const total =
        excavatorDriverAssignments
            .length;


    const completed =
        excavatorDriverAssignments
            .filter(
                item =>
                    item.driverId
            )
            .length;


    setText(
        "excavatorDriverStatus",
        `${completed} / ${total}`
    );


    if (!total) {

        box.innerHTML =
            '<div class="empty-placeholder">请先绑定挖机和卡车</div>';

        return;

    }


    const people =
        getApprovedExcavatorDrivers();


    box.innerHTML =
        excavatorDriverAssignments
            .map(
                assignment => {

                    const options =
                        people.map(
                            person => {

                                const state =
                                    getExcavatorDriverDraftStatus(
                                        person
                                    );


                                const alreadyUsed =
                                    excavatorDriverAssignments
                                        .some(
                                            item =>

                                                item.driverId ===
                                                    person.driverId &&

                                                item.excavatorId !==
                                                    assignment.excavatorId
                                        );


                                const disabled =
                                    state.code ===
                                        "leave" ||

                                    state.code ===
                                        "working" ||

                                    state.code ===
                                        "disabled" ||

                                    alreadyUsed;


                                let suffix =
                                    state.label;


                                if (
                                    alreadyUsed
                                ) {

                                    suffix =
                                        "本任务已分配";

                                }


                                return `

                                    <option
                                        value="${escapeHtml(person.driverId)}"

                                        ${
                                            assignment.driverId ===
                                            person.driverId
                                                ?
                                                "selected"
                                                :
                                                ""
                                        }

                                        ${
                                            disabled
                                                ?
                                                "disabled"
                                                :
                                                ""
                                        }
                                    >

                                        ${escapeHtml(person.name || "-")}

                                        ·

                                        ${escapeHtml(person.team || "-")}

                                        ·

                                        ${escapeHtml(suffix)}

                                    </option>

                                `;

                            }
                        )
                        .join(
                            ""
                        );


                    return `

                        <div class="driver-assignment-row">

                            <div class="assignment-equipment">

                                <strong>
                                    🚜
                                    ${escapeHtml(
                                        assignment.excavatorId
                                    )}
                                </strong>

                                <span>
                                    指定挖机司机
                                </span>

                            </div>


                            <select
                                data-excavator-driver="${escapeHtml(
                                    assignment.excavatorId
                                )}"
                            >

                                <option value="">
                                    请选择挖机司机
                                </option>

                                ${options}

                            </select>

                        </div>

                    `;

                }
            )
            .join(
                ""
            );


    box.querySelectorAll(
        "[data-excavator-driver]"
    )
        .forEach(
            select => {

                select.addEventListener(
                    "change",
                    function () {

                        assignExcavatorDriver(
                            select.dataset
                                .excavatorDriver,
                            select.value
                        );

                    }
                );

            }
        );

}


/* =========================================================
   分配挖机司机
========================================================= */

function assignExcavatorDriver(
    excavatorId,
    driverId
) {

    const assignment =
        excavatorDriverAssignments
            .find(
                item =>
                    item.excavatorId ===
                    excavatorId
            );


    if (!assignment) {

        return;

    }


    if (!driverId) {

        assignment.driverId =
            "";

        assignment.driverName =
            "";

        assignment.team =
            "";


        renderExcavatorDriverAssignments();

        return;

    }


    const person =
        getApprovedExcavatorDrivers()
            .find(
                item =>
                    item.driverId ===
                    driverId
            );


    if (!person) {

        renderExcavatorDriverAssignments();

        return;

    }


    const state =
        getExcavatorDriverDraftStatus(
            person
        );


    if (
        state.code ===
            "leave"
    ) {

        alert(
            `${person.name} 本班处于请假状态，不能安排挖机任务。`
        );


        renderExcavatorDriverAssignments();

        return;

    }


    if (
        state.code ===
            "working"
    ) {

        alert(
            `${person.name} 已在其他生产任务中。`
        );


        renderExcavatorDriverAssignments();

        return;

    }


    const duplicate =
        excavatorDriverAssignments
            .some(
                item =>

                    item.driverId ===
                        driverId &&

                    item.excavatorId !==
                        excavatorId
            );


    if (duplicate) {

        alert(
            "同一名挖机司机不能同时驾驶两台挖机。"
        );


        renderExcavatorDriverAssignments();

        return;

    }


    assignment.driverId =
        person.driverId;


    assignment.driverName =
        person.name ||
        "";


    assignment.team =
        person.team ||
        "";


    renderExcavatorDriverAssignments();

}


/* =========================================================
   挖机司机任务状态
========================================================= */

function getExcavatorDriverDraftStatus(
    person
) {

    if (
        !isDispatchApprovedPerson(
            person
        )
    ) {

        return {

            code:
                "disabled",

            label:
                "⚫ 不可用"
        };

    }


    const now =
        new Date();


    if (
        typeof hasApprovedLeaveOverlap ===
            "function" &&

        hasApprovedLeaveOverlap(
            person,
            now,
            now
        )
    ) {

        return {

            code:
                "leave",

            label:
                "🟣 请假"
        };

    }


    const personId =
        getDispatchPersonId(
            person
        );


    const task =
        getTasks()
            .find(
                item =>

                    (
                        item.status ===
                            "pending" ||

                        item.status ===
                            "active"
                    ) &&

                    (
                        item.excavatorDriverAssignments ||
                        []
                    )
                        .some(
                            driver =>
                                String(
                                    driver.driverId ||
                                    ""
                                ) ===
                                personId
                        )
            );


    if (task) {

        return {

            code:
                "working",

            label:
                "🔴 作业中"
        };

    }


    return {

        code:
            "available",

        label:
            "🟢 可调度"
    };

}


/* =========================================================
   建立车辆跟随历史

   每台汽车什么时候开始跟随哪台挖机，
   都记录下来。

   后续中途增减车就靠这个统计。
========================================================= */

function createTruckBindingHistory(
    task
) {

    const now =
        task.publishedAt ||
        new Date()
            .toISOString();


    const history =
        [];


    (
        task.bindings ||
        []
    )
        .forEach(
            binding => {

                (
                    binding.truckIds ||
                    []
                )
                    .forEach(
                        truckId => {

                            history.push({

                                bindingId:
                                    "BIND_" +
                                    Date.now() +
                                    "_" +
                                    Math.random()
                                        .toString(36)
                                        .slice(2, 8),

                                excavatorId:
                                    binding.excavatorId,

                                truckId,

                                startAt:
                                    now,

                                endAt:
                                    null,

                                reason:
                                    "任务发布"

                            });

                        }
                    );

            }
        );


    return history;

}


/* =========================================================
   获取有效运输记录

   GPS被调度判定无效的趟数不统计
========================================================= */

function getValidTaskTrips(
    task
) {

    return getTaskTrips(
        task
    )
        .filter(
            trip =>

                trip.dispatchConfirmation !==
                    "rejected" &&

                trip.officialCountEligible !==
                    false
        );

}


/* =========================================================
   获取运输记录时间
========================================================= */

function getTripRecordTime(
    trip
) {

    const value =

        trip.completedAt ||

        trip.unloadedAt ||

        trip.unloadTime ||

        trip.endTime ||

        trip.recordedAt ||

        trip.createdAt ||

        trip.time ||

        trip.timestamp;


    const date =
        new Date(
            value ||
            0
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return null;

    }


    return date;

}


/* =========================================================
   获取运输车辆编号
========================================================= */

function getTripVehicleNumber(
    trip
) {

    return String(

        trip.vehicleNumber ||

        trip.vehicleId ||

        trip.truckNumber ||

        trip.truckId ||

        ""

    );

}


/* =========================================================
   挖机车数自动统计
========================================================= */

function getExcavatorTripStats(
    task,
    excavatorId
) {

    const validTrips =
        getValidTaskTrips(
            task
        );


    const history =
        Array.isArray(
            task.truckBindingHistory
        )
            ?
            task.truckBindingHistory
            :
            [];


    const truckMap =
        new Map();


    let total =
        0;


    validTrips.forEach(
        trip => {

            /*
            如果汽车端本身已经记录了挖机编号，
            优先直接使用。
            */

            const tripExcavatorId =
                String(

                    trip.excavatorId ||

                    trip.excavatorNumber ||

                    ""

                );


            if (
                tripExcavatorId
            ) {

                if (
                    tripExcavatorId !==
                    String(
                        excavatorId
                    )
                ) {

                    return;

                }


                const truckId =
                    getTripVehicleNumber(
                        trip
                    ) ||
                    "未知车辆";


                total +=
                    1;


                truckMap.set(
                    truckId,
                    (
                        truckMap.get(
                            truckId
                        ) ||
                        0
                    ) +
                    1
                );


                return;

            }


            /*
            老运输记录没有挖机编号时，
            根据车辆跟随时间段判断。
            */

            const truckId =
                getTripVehicleNumber(
                    trip
                );


            if (!truckId) {

                return;

            }


            const tripTime =
                getTripRecordTime(
                    trip
                );


            if (!tripTime) {

                return;

            }


            const matched =
                history.some(
                    record => {

                        if (
                            String(
                                record.excavatorId
                            ) !==
                            String(
                                excavatorId
                            )
                        ) {

                            return false;

                        }


                        if (
                            String(
                                record.truckId
                            ) !==
                            String(
                                truckId
                            )
                        ) {

                            return false;

                        }


                        const start =
                            new Date(
                                record.startAt ||
                                0
                            );


                        const end =
                            record.endAt
                                ?
                                new Date(
                                    record.endAt
                                )
                                :
                                null;


                        if (
                            Number.isNaN(
                                start.getTime()
                            )
                        ) {

                            return false;

                        }


                        return (

                            tripTime >=
                                start &&

                            (
                                !end ||

                                tripTime <=
                                    end
                            )

                        );

                    }
                );


            if (!matched) {

                return;

            }


            total +=
                1;


            truckMap.set(
                truckId,
                (
                    truckMap.get(
                        truckId
                    ) ||
                    0
                ) +
                1
            );

        }
    );


    return {

        total,

        trucks:
            [
                ...truckMap.entries()
            ]
                .map(
                    (
                        [
                            truckId,
                            count
                        ]
                    ) => ({

                        truckId,

                        count
                    })
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        String(
                            a.truckId
                        )
                            .localeCompare(
                                String(
                                    b.truckId
                                ),
                                "zh-CN",
                                {
                                    numeric:
                                        true
                                }
                            )
                )

    };

}


/* =========================================================
   任务全部挖机车数
========================================================= */

function getTaskExcavatorStatistics(
    task
) {

    return (
        task.bindings ||
        []
    )
        .map(
            binding => {

                const stats =
                    getExcavatorTripStats(
                        task,
                        binding.excavatorId
                    );


                const driver =
                    (
                        task.excavatorDriverAssignments ||
                        []
                    )
                        .find(
                            item =>
                                item.excavatorId ===
                                binding.excavatorId
                        );


                return {

                    excavatorId:
                        binding.excavatorId,

                    driverId:
                        driver?.driverId ||
                        "",

                    driverName:
                        driver?.driverName ||
                        "",

                    total:
                        stats.total,

                    trucks:
                        stats.trucks
                };

            }
        );

}


/* =========================================================
   生产任务详情增加挖机统计
========================================================= */

function buildExcavatorStatisticsHtml(
    task
) {

    const records =
        getTaskExcavatorStatistics(
            task
        );


    if (!records.length) {

        return `
            <div class="empty-placeholder">
                暂无挖机统计
            </div>
        `;

    }


    return records
        .map(
            item => `

                <div class="approval-card">

                    <div class="approval-title">

                        <strong>
                            🚜
                            ${escapeHtml(
                                item.excavatorId
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                item.driverName ||
                                "未分配司机"
                            )}
                        </span>

                    </div>


                    <div class="approval-detail-grid">

                        <div>

                            <span>
                                挖机总车数
                            </span>

                            <strong>
                                ${item.total}
                            </strong>

                        </div>

                    </div>


                    <div class="approval-note">

                        ${
                            item.trucks.length
                                ?
                                item.trucks
                                    .map(
                                        truck =>

                                            `🚚 ${escapeHtml(
                                                truck.truckId
                                            )}：${truck.count}车`

                                    )
                                    .join(
                                        "　"
                                    )
                                :
                                "当前暂无有效运输车数"
                        }

                    </div>

                </div>

            `
        )
        .join(
            ""
        );

}


/* =========================================================
   修改任务详情弹窗

   在原详情下面追加“挖机车数统计”
========================================================= */

function appendExcavatorStatisticsToTaskDetail(
    task
) {

    const content =
        document.getElementById(
            "publishedTaskModalContent"
        );


    if (!content) {

        return;

    }


    const old =
        content.querySelector(
            "#excavatorStatisticsArea"
        );


    if (old) {

        old.remove();

    }


    const section =
        document.createElement(
            "div"
        );


    section.id =
        "excavatorStatisticsArea";


    section.innerHTML = `

        <h4>
            🚜 挖机车数统计
        </h4>

        ${buildExcavatorStatisticsHtml(task)}

    `;


    content.appendChild(
        section
    );

}


/* =========================================================
   发布前检查挖机司机
========================================================= */

function validateExcavatorDriversBeforePublish() {

    synchronizeExcavatorDriverAssignments();


    const incomplete =
        excavatorDriverAssignments
            .filter(
                item =>
                    !item.driverId
            );


    if (
        incomplete.length
    ) {

        alert(
            "以下挖机尚未分配挖机司机：\n\n" +

            incomplete
                .map(
                    item =>
                        item.excavatorId
                )
                .join(
                    "、"
                )
        );


        return false;

    }


    return true;

}


/* =========================================================
   给任务补充 V2.9.8B 字段
========================================================= */

function applyProductionStatisticsToTask(
    task
) {

    task.excavatorDriverAssignments =
        clone(
            excavatorDriverAssignments
        );


    task.truckBindingHistory =
        createTruckBindingHistory(
            task
        );


    task.productionStatisticsVersion =
        "V2.9.8B";


    return task;

}


/* =========================================================
   中途减少汽车

   后续调度中途调整车辆时调用：
   closeTruckBinding(task, truckId)
========================================================= */

function closeTruckBinding(
    task,
    truckId,
    reason = "调度减少车辆"
) {

    if (
        !Array.isArray(
            task.truckBindingHistory
        )
    ) {

        task.truckBindingHistory =
            [];

    }


    const now =
        new Date()
            .toISOString();


    task.truckBindingHistory
        .filter(
            item =>

                String(
                    item.truckId
                ) ===
                    String(
                        truckId
                    ) &&

                !item.endAt
        )
        .forEach(
            item => {

                item.endAt =
                    now;


                item.endReason =
                    reason;

            }
        );

}


/* =========================================================
   中途增加汽车

   后续调度增加车辆时调用：
   openTruckBinding(task, excavatorId, truckId)
========================================================= */

function openTruckBinding(
    task,
    excavatorId,
    truckId,
    reason = "调度增加车辆"
) {

    if (
        !Array.isArray(
            task.truckBindingHistory
        )
    ) {

        task.truckBindingHistory =
            [];

    }


    task.truckBindingHistory
        .push({

            bindingId:
                "BIND_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 8),

            excavatorId,

            truckId,

            startAt:
                new Date()
                    .toISOString(),

            endAt:
                null,

            reason

        });

}


/* =========================================================
   故障换车时同步跟随历史
========================================================= */

function recordTruckReplacementBinding(
    task,
    oldVehicle,
    newVehicle
) {

    const activeOld =
        (
            task.truckBindingHistory ||
            []
        )
            .find(
                item =>

                    String(
                        item.truckId
                    ) ===
                        String(
                            oldVehicle
                        ) &&

                    !item.endAt
            );


    if (!activeOld) {

        return;

    }


    const excavatorId =
        activeOld.excavatorId;


    closeTruckBinding(
        task,
        oldVehicle,
        "车辆故障换车"
    );


    openTruckBinding(
        task,
        excavatorId,
        newVehicle,
        "故障替换车辆"
    );

}


/* =========================================================
   对原函数进行安全增强
========================================================= */


/*
   1.
   generateDraft()执行以后，
   自动显示挖机司机分配。
*/

const originalGenerateDraft =
    generateDraft;


generateDraft =
    function () {

        originalGenerateDraft();


        if (!currentDraft) {

            return;

        }


        excavatorDriverAssignments =
            [];


        renderExcavatorDriverAssignments();

    };


/*
   2.
   每次绑定/删除挖机卡车后，
   同步挖机司机。
*/

const originalBindSelectedTrucks =
    bindSelectedTrucks;


bindSelectedTrucks =
    function () {

        originalBindSelectedTrucks();


        synchronizeExcavatorDriverAssignments();

        renderExcavatorDriverAssignments();

    };


/*
   3.
   每次刷新时刷新挖机司机区域。
*/

const originalRefreshAll =
    refreshAll;


refreshAll =
    function () {

        originalRefreshAll();


        if (currentDraft) {

            renderExcavatorDriverAssignments();

        }

    };


/*
   4.
   发布任务之前必须完成挖机司机分配。

   同时给即将发布的task增加统计字段。
*/

const originalPublishTask =
    publishTask;


publishTask =
    function () {

        if (
            !validateExcavatorDriversBeforePublish()
        ) {

            return;

        }


        /*
        临时拦截saveTasks，
        给刚发布的task增加新字段。
        */

        const oldSaveTasks =
            saveTasks;


        let intercepted =
            false;


        saveTasks =
            function (
                tasks
            ) {

                if (
                    !intercepted &&
                    Array.isArray(
                        tasks
                    ) &&
                    currentDraft
                ) {

                    const task =
                        tasks.find(
                            item =>
                                item.taskId ===
                                currentDraft.taskId
                        );


                    if (task) {

                        applyProductionStatisticsToTask(
                            task
                        );


                        intercepted =
                            true;

                    }

                }


                oldSaveTasks(
                    tasks
                );

            };


        try {

            originalPublishTask();

        } finally {

            saveTasks =
                oldSaveTasks;

        }

    };


/*
   5.
   打开任务详情后，
   自动追加挖机车数统计。
*/

const originalOpenTaskDetail =
    openTaskDetail;


openTaskDetail =
    function (
        taskId
    ) {

        originalOpenTaskDetail(
            taskId
        );


        const task =
            getTaskById(
                taskId
            );


        if (task) {

            appendExcavatorStatisticsToTaskDetail(
                task
            );

        }

    };


/*
   6.
   故障换车后，
   自动关闭旧车跟随时间，
   打开新车跟随时间。
*/

const originalUpdateTaskVehicleAfterChange =
    updateTaskVehicleAfterChange;


updateTaskVehicleAfterChange =
    function (
        taskId,
        driverId,
        driverName,
        oldVehicle,
        newVehicle
    ) {

        originalUpdateTaskVehicleAfterChange(
            taskId,
            driverId,
            driverName,
            oldVehicle,
            newVehicle
        );


        const tasks =
            getTasks();


        const task =
            tasks.find(
                item =>
                    item.taskId ===
                    taskId
            );


        if (!task) {

            return;

        }


        recordTruckReplacementBinding(
            task,
            oldVehicle,
            newVehicle
        );


        saveTasks(
            tasks
        );

    };


/* =========================================================
   初始化升级模块
========================================================= */

ensureExcavatorDriverSection();


if (
    currentDraft
) {

    renderExcavatorDriverAssignments();

}

/* =========================================================
   V2.9.8B-1
   按钮重新绑定修复
========================================================= */

/*
   页面启动时 bindEvents() 已经把旧函数绑定到按钮。
   升级模块是在后面重新包装函数，
   所以必须把旧监听取消，再绑定升级后的函数。
*/


$("generateTaskButton")
    ?.removeEventListener(
        "click",
        originalGenerateDraft
    );

$("generateTaskButton")
    ?.addEventListener(
        "click",
        generateDraft
    );


$("bindTrucksButton")
    ?.removeEventListener(
        "click",
        originalBindSelectedTrucks
    );

$("bindTrucksButton")
    ?.addEventListener(
        "click",
        bindSelectedTrucks
    );


$("publishTaskButton")
    ?.removeEventListener(
        "click",
        originalPublishTask
    );

$("publishTaskButton")
    ?.addEventListener(
        "click",
        publishTask
    );


/*
   任务详情按钮同样重新绑定升级后的函数。
*/

document.querySelectorAll(
    "[data-task]"
).forEach(
    button => {

        button.onclick =
            function () {

                openTaskDetail(
                    button.dataset.task
                );

            };

    }
);


/*
   草稿存在时持续刷新挖机司机分配区域。
*/

setInterval(
    function () {

        if (currentDraft) {

            renderExcavatorDriverAssignments();

        }

    },
    5000
);
    function cssEscape(
        value
    ) {

        if (
            window.CSS &&
            typeof CSS.escape ===
                "function"
        ) {

            return CSS.escape(
                String(
                    value
                )
            );
        }


        return String(
            value
        )
            .replace(
                /["\\]/g,
                "\\$&"
            );
    }
/* =========================================================
   V2.9.8B-1 按钮重新绑定修复
========================================================= */

/*
   页面初始化时，按钮已经绑定了旧函数。
   这里取消旧绑定，再绑定升级后的新函数。
*/

$("generateTaskButton")
    ?.removeEventListener(
        "click",
        originalGenerateDraft
    );

$("generateTaskButton")
    ?.addEventListener(
        "click",
        generateDraft
    );


$("bindTrucksButton")
    ?.removeEventListener(
        "click",
        originalBindSelectedTrucks
    );

$("bindTrucksButton")
    ?.addEventListener(
        "click",
        bindSelectedTrucks
    );


$("publishTaskButton")
    ?.removeEventListener(
        "click",
        originalPublishTask
    );

$("publishTaskButton")
    ?.addEventListener(
        "click",
        publishTask
    );


/*
   原来的5秒刷新也绑定的是旧 refreshAll。
   再增加一个升级版刷新。
*/

setInterval(
    function () {

        if (currentDraft) {

            renderExcavatorDriverAssignments();

        }

    },
    5000
);
});
