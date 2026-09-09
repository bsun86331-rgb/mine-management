/*
========================================================
矿山管理系统
调度端 V2.9.8B-1
生产统计闭环 · 修复整合版

主要功能：
1. 统一人员库 personnelRecords
2. 统一设备库 equipmentRecords
3. 挖机 + 跟随汽车绑定
4. 汽车司机分配
5. 挖机司机分配
6. 挖机车数自动汇总
7. 故障换车
8. GPS异常审核
9. 司机请假审批
10. 调度请假 -> 总经理
11. 罚单
12. 历史任务
13. 撤销任务自动释放设备
========================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    function () {

        "use strict";


        /* =====================================================
           数据键
        ===================================================== */

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


        /* =====================================================
           当前数据
        ===================================================== */

        let equipment =
            emptyEquipmentCatalog();


        let currentDraft =
            null;


        let bindings =
            [];


        let driverAssignments =
            [];


        let excavatorDriverAssignments =
            [];


        let auxiliaryAssignments =
            [];


        let selectedExcavatorId =
            null;


        let selectedTruckIds =
            [];


        let openedTaskId =
            null;



        /* =====================================================
           启动
        ===================================================== */

        init();


        function init() {

            migrateTasks();

            refreshEquipmentCatalog();

            setAutomaticShift();

            ensureExcavatorDriverSection();

            bindEvents();

            refreshAll();


            setInterval(
                refreshAll,
                5000
            );
        }



        /* =====================================================
           事件
        ===================================================== */

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



        /* =====================================================
           总刷新
        ===================================================== */
function refreshAll() {

    reconcileEquipmentWorkingStatus();

    refreshEquipmentCatalog();

    synchronizeTaskStatus();

    renderProductionBoard();

    renderHistory();

    renderPersonnelStatusBoard();

    renderTodoCounts();

    populatePenaltyPersonnel();


    if (currentDraft) {

        renderExcavators();

        renderTrucks();

        renderBindings();

        renderDriverAssignments();

        renderExcavatorDriverAssignments();

        renderAuxiliaryVehicles();

        renderAuxiliaryAssignments();
    }
}
       


        /* =====================================================
           新建任务
        ===================================================== */

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
                    (
                        hour >= 8 &&
                        hour < 20
                    )
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


            excavatorDriverAssignments =
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
            ]
                .forEach(
                    id =>
                        $(id)
                            ?.classList
                            .remove(
                                "hidden"
                            )
                );


            ensureExcavatorDriverSection();


            $("excavatorDriverSection")
                ?.classList
                .remove(
                    "hidden"
                );


            renderExcavators();

            renderTrucks();

            renderBindings();

            renderDriverAssignments();

            renderExcavatorDriverAssignments();

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


            excavatorDriverAssignments =
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
                "excavatorDriverSection",
                "auxiliarySection",
                "publishSection"
            ]
                .forEach(
                    id =>
                        $(id)
                            ?.classList
                            .add(
                                "hidden"
                            )
                );
        }



        /* =====================================================
           统一设备库
        ===================================================== */

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

function reconcileEquipmentWorkingStatus() {

    const records =
        getEquipmentRecords();


    if (!records.length) {

        return;
    }


    const occupiedIds =
        new Set();


    getTasks()
        .filter(
            task =>
                task.status === "pending" ||
                task.status === "active"
        )
        .forEach(
            task => {

                (task.bindings || [])
                    .forEach(
                        binding => {

                            if (binding.excavatorId) {

                                occupiedIds.add(
                                    String(binding.excavatorId)
                                );
                            }


                            (binding.truckIds || [])
                                .forEach(
                                    truckId => {

                                        if (truckId) {

                                            occupiedIds.add(
                                                String(truckId)
                                            );
                                        }
                                    }
                                );
                        }
                    );


                (task.auxiliaryAssignments || [])
                    .forEach(
                        item => {

                            if (item.vehicleId) {

                                occupiedIds.add(
                                    String(item.vehicleId)
                                );
                            }
                        }
                    );
            }
        );


    let changed =
        false;


    records.forEach(
        device => {

            const normalized =
                normalizeEquipmentRecord(device);


            if (!normalized.id) {

                return;
            }


            if (
                normalized.status === "maintenance" ||
                normalized.status === "service" ||
                normalized.status === "disabled"
            ) {

                return;
            }


            if (
                occupiedIds.has(
                    String(normalized.id)
                )
            ) {

                return;
            }


            if (
                normalized.status === "working"
            ) {

                device.status =
                    "available";

                device.currentStatus =
                    "可用";

                device.equipmentStatus =
                    "可用";

                device.updatedAt =
                    new Date().toISOString();

                changed =
                    true;
            }
        }
    );


    if (changed) {

        saveEquipmentRecords(records);
    }
}
        function getEquipmentRecords() {

            const records =
                readJson(
                    STORAGE.EQUIPMENT,
                    []
                );


            return Array.isArray(
                records
            )
                ? records
                : [];
        }


        function saveEquipmentRecords(
            records
        ) {

            localStorage.setItem(
                STORAGE.EQUIPMENT,
                JSON.stringify(
                    records
                )
            );
        }


        function refreshEquipmentCatalog() {

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


            Object.keys(
                catalog
            )
                .forEach(
                    key => {

                        catalog[key]
                            .sort(
                                (
                                    a,
                                    b
                                ) =>
                                    String(
                                        a.id
                                    )
                                        .localeCompare(
                                            String(
                                                b.id
                                            ),
                                            "zh-CN",
                                            {
                                                numeric:
                                                    true
                                            }
                                        )
                            );
                    }
                );


            equipment =
                catalog;
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


            const type =
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


            return {

                ...record,

                id,

                type,

                group:
                    getEquipmentGroup(
                        type
                    ),

                rawStatus,

                status:
                    normalizeEquipmentStatus(
                        rawStatus
                    ),

                reason:

                    record.maintenanceReason ||

                    record.repairReason ||

                    record.statusReason ||

                    record.remark ||

                    ""
            };
        }



        function getEquipmentGroup(
            type
        ) {

            const value =
                String(
                    type ||
                    ""
                );


            if (
                value.includes(
                    "挖掘机"
                ) ||
                value.includes(
                    "挖机"
                )
            ) {

                return "excavators";
            }


            if (
                value.includes(
                    "卡车"
                ) ||
                value.includes(
                    "矿卡"
                ) ||
                value.includes(
                    "自卸车"
                ) ||
                value.includes(
                    "运输车"
                )
            ) {

                return "trucks";
            }


            if (
                value.includes(
                    "装载机"
                ) ||
                value.includes(
                    "铲车"
                )
            ) {

                return "loader";
            }


            if (
                value.includes(
                    "洒水车"
                )
            ) {

                return "water";
            }


            if (
                value.includes(
                    "加油车"
                ) ||
                value.includes(
                    "油罐车"
                )
            ) {

                return "fuel";
            }


            if (
                value.includes(
                    "平路机"
                ) ||
                value.includes(
                    "平地机"
                )
            ) {

                return "grader";
            }


            if (
                value.includes(
                    "推土机"
                )
            ) {

                return "dozer";
            }


            if (
                value.includes(
                    "大巴"
                ) ||
                value.includes(
                    "客车"
                )
            ) {

                return "bus";
            }


            return "";
        }



        function normalizeEquipmentStatus(
            status
        ) {

            const value =
                String(
                    status ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            if (
                value === "maintenance" ||
                value === "维修" ||
                value === "维修中"
            ) {

                return "maintenance";
            }


            if (
                value === "service" ||
                value === "保养" ||
                value === "保养中"
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


            if (
                value === "working" ||
                value === "active" ||
                value === "作业中" ||
                value === "运行中" ||
                value === "使用中"
            ) {

                return "working";
            }


            return "available";
        }



        function equipmentStateLabel(
            device
        ) {

            switch (
                device.status
            ) {

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
            id
        ) {

            for (
                const list of
                Object.values(
                    equipment
                )
            ) {

                const result =
                    list.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                id
                            )
                    );


                if (result) {

                    return result;
                }
            }


            return null;
        }



        /* =====================================================
           已占用设备
        ===================================================== */

        function getOccupiedEquipmentIds(
            ignoreTaskId = ""
        ) {

            const result =
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
                        )
                            .forEach(
                                binding => {

                                    if (
                                        binding.excavatorId
                                    ) {

                                        result.add(
                                            binding.excavatorId
                                        );
                                    }


                                    (
                                        binding.truckIds ||
                                        []
                                    )
                                        .forEach(
                                            id =>
                                                result.add(
                                                    id
                                                )
                                        );
                                }
                            );


                        (
                            task.auxiliaryAssignments ||
                            []
                        )
                            .forEach(
                                item => {

                                    if (
                                        item.vehicleId
                                    ) {

                                        result.add(
                                            item.vehicleId
                                        );
                                    }
                                }
                            );
                    }
                );


            return result;
        }



        /* =====================================================
           挖机选择
        ===================================================== */

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
                    '<div class="empty-placeholder">设备库暂无挖机</div>';

                return;
            }


            equipment.excavators
                .forEach(
                    device => {

                        const selected =
                            selectedExcavatorId ===
                            device.id;


                        const draftUsed =
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
                                draftUsed
                            );


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


                        button.disabled =
                            draftUsed;


                        button.addEventListener(
                            "click",
                            function () {

                                if (
                                    !isEquipmentDispatchable(
                                        device
                                    )
                                ) {

                                    alert(
                                        `${device.id} 当前状态：${equipmentStateLabel(device)}`
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
                                        " 已被其他任务占用。"
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



        /* =====================================================
           汽车选择
        ===================================================== */

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


            const draftUsed =
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
                    '<div class="empty-placeholder">设备库暂无运输汽车</div>';

                return;
            }


            equipment.trucks
                .forEach(
                    device => {

                        const selected =
                            selectedTruckIds.includes(
                                device.id
                            );


                        const used =
                            draftUsed.has(
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
                                used
                            );


                        let label =
                            equipmentStateLabel(
                                device
                            );


                        if (used) {

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
                            used;


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
                                        `${device.id} 当前状态：${equipmentStateLabel(device)}`
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
                                        " 已被其他任务使用。"
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
                    "至少选择一台汽车。"
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

            synchronizeExcavatorDriverAssignments();


            renderExcavators();

            renderTrucks();

            renderBindings();

            renderDriverAssignments();

            renderExcavatorDriverAssignments();
        }



        function renderBindings() {

            const box =
                $("bindingList");


            if (!box) {
                return;
            }


            if (
                !bindings.length
            ) {

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
                                🚜 ${escapeHtml(binding.excavatorId)}
                            </strong>

                            <span>
                                🚚 ${
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
                )
                    .join(
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

                                synchronizeExcavatorDriverAssignments();


                                renderBindings();

                                renderDriverAssignments();

                                renderExcavatorDriverAssignments();

                                renderExcavators();

                                renderTrucks();
                            }
                        );
                    }
                );
        }



        /* =====================================================
           统一人员库
        ===================================================== */

        function getPersonnelRecords() {

            const data =
                readJson(
                    STORAGE.PERSONNEL,
                    []
                );


            return Array.isArray(
                data
            )
                ? data
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
                    false ||

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

            return getPersonnelRecords()
                .filter(
                    person =>

                        normalizePosition(
                            person.position
                        ) ===
                            "汽车司机" &&

                        isApprovedPerson(
                            person
                        )
                )
                .map(
                    person => ({

                        ...person,

                        personId:
                            getPersonId(
                                person
                            ),

                        driverId:
                            getPersonId(
                                person
                            ),

                        team:
                            person.team ||
                            person.department ||
                            ""
                    })
                );
        }



        function getApprovedExcavatorDrivers() {

            return getPersonnelRecords()
                .filter(
                    person =>

                        normalizePosition(
                            person.position
                        ) ===
                            "挖机司机" &&

                        isApprovedPerson(
                            person
                        )
                )
                .map(
                    person => ({

                        ...person,

                        personId:
                            getPersonId(
                                person
                            ),

                        driverId:
                            getPersonId(
                                person
                            ),

                        team:
                            person.team ||
                            person.department ||
                            ""
                    })
                );
        }



        /* =====================================================
           汽车司机分配
        ===================================================== */

        function synchronizeDraftDriverAssignments() {

            const trucks =
                [];


            bindings.forEach(
                binding => {

                    (
                        binding.truckIds ||
                        []
                    )
                        .forEach(
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


            const complete =
                driverAssignments
                    .filter(
                        item =>
                            item.driverId
                    )
                    .length;


            setText(
                "driverAssignmentStatus",
                `${complete} / ${total}`
            );


            if (!total) {

                box.innerHTML =
                    '<div class="empty-placeholder">请先绑定挖机和汽车</div>';

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
                                        ${
                                            alreadyUsed
                                                ? "本任务已分配"
                                                : escapeHtml(state.label)
                                        }

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
                                    请选择汽车司机
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
                driverAssignments.find(
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
                    person.name +
                    " 本班请假，不能安排任务。"
                );

                renderDriverAssignments();

                return;
            }


            if (
                state.code ===
                "working"
            ) {

                alert(
                    person.name +
                    " 已在其他任务中。"
                );

                renderDriverAssignments();

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


            renderDriverAssignments();
        }



        /* =====================================================
           挖机司机分配
        ===================================================== */

        function ensureExcavatorDriverSection() {

            if (
                $("excavatorDriverSection")
            ) {

                return;
            }


            const driverSection =
                $("driverAssignmentSection");


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
                            为每台挖机指定挖机司机
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
                        请先绑定挖机和汽车
                    </div>

                </div>
            `;


            driverSection.parentNode
                .insertBefore(
                    section,
                    driverSection
                );
        }



        function synchronizeExcavatorDriverAssignments() {

            const ids =
                bindings
                    .map(
                        item =>
                            item.excavatorId
                    )
                    .filter(
                        Boolean
                    );


            excavatorDriverAssignments =
                ids.map(
                    id => {

                        const old =
                            excavatorDriverAssignments
                                .find(
                                    item =>
                                        item.excavatorId ===
                                        id
                                );


                        return old || {

                            excavatorId:
                                id,

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



        function renderExcavatorDriverAssignments() {

            if (!currentDraft) {
                return;
            }


            ensureExcavatorDriverSection();

            synchronizeExcavatorDriverAssignments();


            const box =
                $("excavatorDriverAssignmentList");


            if (!box) {
                return;
            }


            $("excavatorDriverSection")
                ?.classList
                .remove(
                    "hidden"
                );


            const total =
                excavatorDriverAssignments.length;


            const complete =
                excavatorDriverAssignments
                    .filter(
                        item =>
                            item.driverId
                    )
                    .length;


            setText(
                "excavatorDriverStatus",
                `${complete} / ${total}`
            );


            if (!total) {

                box.innerHTML =
                    '<div class="empty-placeholder">请先绑定挖机和汽车</div>';

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
                                            ${
                                                alreadyUsed
                                                    ? "本任务已分配"
                                                    : escapeHtml(state.label)
                                            }

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
                                        🚜 ${escapeHtml(assignment.excavatorId)}
                                    </strong>

                                    <span>
                                        指定挖机司机
                                    </span>

                                </div>


                                <select
                                    data-excavator-driver="${escapeHtml(assignment.excavatorId)}"
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
                return;
            }


            const duplicate =
                excavatorDriverAssignments.some(
                    item =>

                        item.driverId ===
                            driverId &&

                        item.excavatorId !==
                            excavatorId
                );


            if (duplicate) {

                alert(
                    "同一名挖机司机不能同时操作两台挖机。"
                );

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
                    person.name +
                    " 本班请假。"
                );

                renderExcavatorDriverAssignments();

                return;
            }


            if (
                state.code ===
                "working"
            ) {

                alert(
                    person.name +
                    " 已在其他生产任务中。"
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



        /* =====================================================
           人员状态
        ===================================================== */

        function getPersonActiveTask(
            person
        ) {

            const id =
                getPersonId(
                    person
                );


            return getTasks()
                .find(
                    task =>

                        (
                            task.status ===
                                "pending" ||

                            task.status ===
                                "active"
                        ) &&

                        (
                            (
                                task.driverAssignments ||
                                []
                            )
                                .some(
                                    item =>
                                        String(
                                            item.driverId ||
                                            ""
                                        ) ===
                                        id
                                )
                            ||

                            (
                                task.excavatorDriverAssignments ||
                                []
                            )
                                .some(
                                    item =>
                                        String(
                                            item.driverId ||
                                            ""
                                        ) ===
                                        id
                                )
                        )
                ) ||
                null;
        }



        function getCurrentPersonStatus(
            person
        ) {

            if (
                !isApprovedPerson(
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
                !isApprovedPerson(
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



        function getExcavatorDriverDraftStatus(
            person
        ) {

            return getPersonStatusForDraft(
                person
            );
        }



        function renderPersonnelStatusBoard() {

            const people = [

                ...getApprovedDrivers(),

                ...getApprovedExcavatorDrivers()
            ];


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


            if (
                !people.length
            ) {

                box.innerHTML =
                    '<div class="empty-placeholder">暂无已审核作业人员</div>';

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
                                    ${escapeHtml(normalizePosition(person.position))}
                                </span>

                            </div>


                            <span class="person-state">
                                ${escapeHtml(state.label)}
                            </span>

                        </div>
                        `;
                    }
                )
                    .join(
                        ""
                    );
        }



        /* =====================================================
           辅助车辆
        ===================================================== */

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


                        const draftUsed =
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

                            draftUsed;


                        option.disabled =
                            unavailable;


                        option.textContent =
                            vehicle.id +
                            (
                                unavailable
                                    ? `（${equipmentStateLabel(vehicle)}）`
                                    : ""
                            );


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


            auxiliaryAssignments.push({

                type,

                vehicleId,

                work
            });


            if (
                $("auxiliaryWorkInput")
            ) {

                $("auxiliaryWorkInput").value =
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
                auxiliaryAssignments.map(
                    (
                        item,
                        index
                    ) => `

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

                                auxiliaryAssignments.splice(
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



        /* =====================================================
           车辆绑定历史
        ===================================================== */

        function createTruckBindingHistory(
            task
        ) {

            const start =
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
                                            createId(
                                                "BIND"
                                            ),

                                        excavatorId:
                                            binding.excavatorId,

                                        truckId,

                                        startAt:
                                            start,

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



        function closeTruckBinding(
            task,
            truckId,
            reason
        ) {

            const now =
                new Date()
                    .toISOString();


            (
                task.truckBindingHistory ||
                []
            )
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
                            reason ||
                            "结束跟随";
                    }
                );
        }



        function openTruckBinding(
            task,
            excavatorId,
            truckId,
            reason
        ) {

            task.truckBindingHistory =
                task.truckBindingHistory ||
                [];


            task.truckBindingHistory.push({

                bindingId:
                    createId(
                        "BIND"
                    ),

                excavatorId,

                truckId,

                startAt:
                    new Date()
                        .toISOString(),

                endAt:
                    null,

                reason:
                    reason ||
                    "增加车辆"
            });
        }



        /* =====================================================
           发布任务
        ===================================================== */

        function publishTask() {

            if (!currentDraft) {
                return;
            }


            refreshEquipmentCatalog();


            if (
                !bindings.length
            ) {

                alert(
                    "请至少配置一组挖机和汽车。"
                );

                return;
            }


            synchronizeDraftDriverAssignments();

            synchronizeExcavatorDriverAssignments();


            const missingTruckDrivers =
                driverAssignments
                    .filter(
                        item =>
                            !item.driverId
                    );


            if (
                missingTruckDrivers.length
            ) {

                alert(
                    "以下汽车尚未分配司机：\n\n" +
                    missingTruckDrivers
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


            const missingExcavatorDrivers =
                excavatorDriverAssignments
                    .filter(
                        item =>
                            !item.driverId
                    );


            if (
                missingExcavatorDrivers.length
            ) {

                alert(
                    "以下挖机尚未分配挖机司机：\n\n" +
                    missingExcavatorDrivers
                        .map(
                            item =>
                                item.excavatorId
                        )
                        .join(
                            "、"
                        )
                );

                return;
            }


            if (
                findDuplicateDriverIds(
                    driverAssignments
                ).length
            ) {

                alert(
                    "同一汽车司机不能同时驾驶多台汽车。"
                );

                return;
            }


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
                        `挖机 ${binding.excavatorId} 当前不可调度。`
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
                            `汽车 ${truckId} 当前不可调度。`
                        );

                        return;
                    }


                    if (
                        occupied.has(
                            truckId
                        )
                    ) {

                        alert(
                            `汽车 ${truckId} 已被其他任务占用。`
                        );

                        return;
                    }
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
                                    currentDraft.loadingPoint,

                                unloadingPoint:
                                    currentDraft.unloadingPoint
                            })
                        ),

                excavatorDriverAssignments:
                    clone(
                        excavatorDriverAssignments
                    ),

                auxiliaryAssignments:
                    clone(
                        auxiliaryAssignments
                    ),

                equipmentAdjustments:
                    [],

                productionStatisticsVersion:
                    "V2.9.8B",

                publishedAt:
                    new Date()
                        .toISOString()
            };


            task.truckBindingHistory =
                createTruckBindingHistory(
                    task
                );


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
                `汽车司机：${driverAssignments.length} 人\n` +
                `挖机司机：${excavatorDriverAssignments.length} 人`
            );


            cancelDraft();

            clearTaskInputs();

            refreshAll();
        }



        /* =====================================================
           同浏览器汽车司机任务兼容
        ===================================================== */

        function syncTaskToLocalDriver(
            task
        ) {

            const currentPersonId =
                localStorage.getItem(
                    "currentPersonId"
                );


            let localDriver =
                null;


            if (
                currentPersonId
            ) {

                localDriver =
                    getPersonnelRecords()
                        .find(
                            item =>
                                getPersonId(
                                    item
                                ) ===
                                currentPersonId
                        ) ||
                    null;
            }


            if (!localDriver) {

                localDriver =
                    readJson(
                        STORAGE.DRIVER_PROFILE,
                        null
                    );
            }


            if (!localDriver) {
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


            localStorage.setItem(
                STORAGE.DRIVER_CURRENT_TASK,
                JSON.stringify({

                    taskId:
                        task.taskId,

                    dispatchTaskId:
                        task.taskId,

                    driverId:
                        assignment.driverId,

                    driverName:
                        assignment.driverName,

                    workArea:
                        task.area,

                    shift:
                        task.shift,

                    remark:
                        task.remark,

                    vehicleNumber:
                        assignment.vehicleNumber,

                    vehicleId:
                        assignment.vehicleId,

                    excavatorNumber:
                        assignment.excavatorNumber,

                    excavatorId:
                        assignment.excavatorId,

                    loadingPoint:
                        task.loadingPoint,

                    unloadingPoint:
                        task.unloadingPoint,

                    status:
                        "assigned",

                    vehicleClaimed:
                        false,

                    createdAt:
                        task.publishedAt
                })
            );
        }



        /* =====================================================
           任务状态
        ===================================================== */

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


                    const trips =
                        getValidTaskTrips(
                            task
                        );


                    if (
                        task.status ===
                            "pending" &&
                        trips.length
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



        /* =====================================================
           挖机车数
        ===================================================== */

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



        function getTripTime(
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


            if (!value) {
                return null;
            }


            const date =
                new Date(
                    value
                );


            return Number.isNaN(
                date.getTime()
            )
                ? null
                : date;
        }



        function getExcavatorTripStats(
            task,
            excavatorId
        ) {

            const trips =
                getValidTaskTrips(
                    task
                );


            const history =
                Array.isArray(
                    task.truckBindingHistory
                )
                    ? task.truckBindingHistory
                    : [];


            const binding =
                (
                    task.bindings ||
                    []
                )
                    .find(
                        item =>
                            item.excavatorId ===
                            excavatorId
                    );


            const currentTrucks =
                binding?.truckIds ||
                [];


            const map =
                new Map();


            let total =
                0;


            function add(
                truckId
            ) {

                total += 1;


                map.set(
                    truckId,
                    (
                        map.get(
                            truckId
                        ) ||
                        0
                    ) +
                    1
                );
            }


            trips.forEach(
                trip => {

                    const truckId =
                        getTripVehicleNumber(
                            trip
                        );


                    if (!truckId) {
                        return;
                    }


                    const directExcavator =
                        String(

                            trip.excavatorId ||

                            trip.excavatorNumber ||

                            ""

                        );


                    if (
                        directExcavator
                    ) {

                        if (
                            directExcavator ===
                            String(
                                excavatorId
                            )
                        ) {

                            add(
                                truckId
                            );
                        }


                        return;
                    }


                    const tripTime =
                        getTripTime(
                            trip
                        );


                    if (
                        tripTime &&
                        history.length
                    ) {

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


                                    if (
                                        Number.isNaN(
                                            start.getTime()
                                        )
                                    ) {
                                        return false;
                                    }


                                    let end =
                                        null;


                                    if (
                                        record.endAt
                                    ) {

                                        end =
                                            new Date(
                                                record.endAt
                                            );
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


                        if (matched) {

                            add(
                                truckId
                            );
                        }


                        return;
                    }


                    if (
                        currentTrucks.includes(
                            truckId
                        )
                    ) {

                        add(
                            truckId
                        );
                    }
                }
            );


            return {

                total,

                trucks:
                    [
                        ...map.entries()
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
            };
        }



        /* =====================================================
           生产看板
        ===================================================== */

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


            if (
                !tasks.length
            ) {

                board.innerHTML =
                    '<div class="empty-placeholder">当前没有进行中的生产任务</div>';

                return;
            }


            board.innerHTML =
                tasks.map(
                    task => {

                        const trips =
                            getValidTaskTrips(
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
                                        ${escapeHtml(task.date || task.dateKey || "-")}
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
                                        ${(task.bindings || []).length}
                                    </strong>
                                </div>

                                <div>
                                    <span>汽车</span>
                                    <strong>
                                        ${(task.driverAssignments || []).length}
                                    </strong>
                                </div>

                                <div>
                                    <span>司机</span>
                                    <strong>
                                        ${
                                            (task.driverAssignments || []).length +
                                            (task.excavatorDriverAssignments || []).length
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
                )
                    .join(
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



        /* =====================================================
           任务详情
        ===================================================== */

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
                )
                    .map(
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
                    )
                    .join(
                        ""
                    );


            const excavatorStats =
                (
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


                            return `

                            <div class="approval-card">

                                <div class="approval-title">

                                    <strong>
                                        🚜 ${escapeHtml(binding.excavatorId)}
                                    </strong>

                                    <span>
                                        ${escapeHtml(driver?.driverName || "未分配")}
                                    </span>

                                </div>


                                <div class="approval-detail-grid">

                                    <div>

                                        <span>
                                            挖机车数
                                        </span>

                                        <strong>
                                            ${stats.total}
                                        </strong>

                                    </div>

                                </div>


                                <div class="approval-note">

                                    ${
                                        stats.trucks.length
                                            ? stats.trucks
                                                .map(
                                                    truck =>
                                                        `🚚 ${escapeHtml(truck.truckId)}：${truck.count}车`
                                                )
                                                .join(
                                                    "　"
                                                )
                                            : "暂无有效车数"
                                    }

                                </div>

                            </div>
                            `;
                        }
                    )
                    .join(
                        ""
                    );


            if (
                $("publishedTaskModalContent")
            ) {

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
                            <span>有效趟数</span>
                            <strong>${getValidTaskTrips(task).length}</strong>
                        </div>

                    </div>


                    <h4>
                        👷 汽车司机 / 汽车 / 挖机
                    </h4>

                    ${
                        driverHtml ||
                        '<div class="empty-placeholder">暂无司机分配</div>'
                    }


                    <h4>
                        🚜 挖机车数统计
                    </h4>

                    ${
                        excavatorStats ||
                        '<div class="empty-placeholder">暂无统计</div>'
                    }


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



        /* =====================================================
           ★ 撤销任务
           修复：撤销以后释放设备
        ===================================================== */

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
                    "确认撤回并删除该生产任务吗？\n\n撤回后，本任务占用的挖机、汽车和辅助车辆将自动释放。"
                )
            ) {

                return;
            }


            /*
             * 先释放设备。
             */
            releaseTaskEquipment(
                task
            );


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


            openedTaskId =
                null;


            refreshAll();


            alert(
                "生产任务已撤回，相关设备已经释放。"
            );
        }



        /* =====================================================
           ★ 释放任务设备
        ===================================================== */

        function releaseTaskEquipment(
            task
        ) {

            if (!task) {
                return;
            }


            const records =
                getEquipmentRecords();


            if (
                !records.length
            ) {
                return;
            }


            const ids =
                new Set();


            /*
             * 挖机 + 卡车。
             */
            (
                task.bindings ||
                []
            )
                .forEach(
                    binding => {

                        if (
                            binding.excavatorId
                        ) {

                            ids.add(
                                String(
                                    binding.excavatorId
                                )
                            );
                        }


                        (
                            binding.truckIds ||
                            []
                        )
                            .forEach(
                                truckId => {

                                    if (
                                        truckId
                                    ) {

                                        ids.add(
                                            String(
                                                truckId
                                            )
                                        );
                                    }
                                }
                            );
                    }
                );


            /*
             * 辅助设备。
             */
            (
                task.auxiliaryAssignments ||
                []
            )
                .forEach(
                    item => {

                        if (
                            item.vehicleId
                        ) {

                            ids.add(
                                String(
                                    item.vehicleId
                                )
                            );
                        }
                    }
                );


            records.forEach(
                device => {

                    const normalized =
                        normalizeEquipmentRecord(
                            device
                        );


                    if (
                        !ids.has(
                            String(
                                normalized.id
                            )
                        )
                    ) {

                        return;
                    }


                    /*
                     * 维修、保养、停用不能恢复可用。
                     */
                    if (
                        normalized.status ===
                            "maintenance" ||

                        normalized.status ===
                            "service" ||

                        normalized.status ===
                            "disabled"
                    ) {

                        return;
                    }


                    device.status =
                        "available";


                    device.currentStatus =
                        "可用";


                    device.equipmentStatus =
                        "可用";


                    device.updatedAt =
                        new Date()
                            .toISOString();
                }
            );


            saveEquipmentRecords(
                records
            );


            refreshEquipmentCatalog();
        }



        /* =====================================================
           完成任务
        ===================================================== */

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
                    "任务还没有产生运输记录。"
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


            /*
             * 结束全部仍然开启的跟随关系。
             */
            (
                task.truckBindingHistory ||
                []
            )
                .forEach(
                    item => {

                        if (
                            !item.endAt
                        ) {

                            item.endAt =
                                task.completedAt;


                            item.endReason =
                                "生产任务完成";
                        }
                    }
                );


            saveTasks(
                tasks
            );


            /*
             * 完成以后同样释放正常设备。
             */
            releaseTaskEquipment(
                task
            );


            clearLocalDriverTaskIfMatches(
                task.taskId
            );


            hideModal(
                "publishedTaskModal"
            );


            openedTaskId =
                null;


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



        /* =====================================================
           历史任务
        ===================================================== */

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
                        0
                    ) -
                    new Date(
                        a.completedAt ||
                        0
                    )
            );


            board.innerHTML =
                tasks.map(
                    task => `

                    <button
                        type="button"
                        class="production-task-card completed"
                        data-history="${escapeHtml(task.taskId)}"
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
                                        (task.driverAssignments || []).length +
                                        (task.excavatorDriverAssignments || []).length
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>趟数</span>
                                <strong>
                                    ${getValidTaskTrips(task).length}
                                </strong>
                            </div>

                        </div>

                    </button>
                    `
                )
                    .join(
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



        /* =====================================================
           换车申请
        ===================================================== */

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
                                    type="button"
                                    class="success-button"
                                    data-change-approve="${escapeHtml(item.requestId)}"
                                >
                                    批准
                                </button>

                                <button
                                    type="button"
                                    class="danger-button"
                                    data-change-reject="${escapeHtml(item.requestId)}"
                                >
                                    驳回
                                </button>

                            </div>

                        </div>
                        `;
                    }
                )
                    .join(
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



        function approveVehicleChange(
            requestId
        ) {

            const select =
                document.querySelector(
                    `[data-change-vehicle="${cssEscape(requestId)}"]`
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


            let excavatorId =
                "";


            (
                task.bindings ||
                []
            )
                .forEach(
                    binding => {

                        if (
                            (
                                binding.truckIds ||
                                []
                            )
                                .includes(
                                    oldVehicle
                                )
                        ) {

                            excavatorId =
                                binding.excavatorId;
                        }


                        binding.truckIds =
                            (
                                binding.truckIds ||
                                []
                            )
                                .map(
                                    id =>
                                        id ===
                                        oldVehicle
                                            ? newVehicle
                                            : id
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
                            )

                            ||

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


            closeTruckBinding(
                task,
                oldVehicle,
                "故障换车"
            );


            if (
                excavatorId
            ) {

                openTruckBinding(
                    task,
                    excavatorId,
                    newVehicle,
                    "故障替换车辆"
                );
            }


            task.equipmentAdjustments =
                task.equipmentAdjustments ||
                [];


            task.equipmentAdjustments.push({

                adjustmentId:
                    createId(
                        "CHANGE"
                    ),

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


            const localTask =
                readJson(
                    STORAGE.DRIVER_CURRENT_TASK,
                    null
                );


            if (
                localTask &&
                localTask.taskId ===
                    taskId
            ) {

                localTask.vehicleId =
                    newVehicle;


                localTask.vehicleNumber =
                    newVehicle;


                localTask.vehicleClaimed =
                    false;


                localStorage.setItem(
                    STORAGE.DRIVER_CURRENT_TASK,
                    JSON.stringify(
                        localTask
                    )
                );
            }
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



        /* =====================================================
           GPS审核
        ===================================================== */

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


                        <div class="approval-note">

                            GPS：
                            ${escapeHtml(record.gpsStatus || "异常")}

                            ·

                            ${
                                record.gpsAccuracy
                                    ? "±" +
                                        Math.round(record.gpsAccuracy) +
                                        "米"
                                    : "无定位"
                            }

                        </div>


                        <div class="approval-buttons">

                            <button
                                type="button"
                                class="success-button"
                                data-gps-confirm="${escapeHtml(getTripId(record))}"
                            >
                                确认有效
                            </button>

                            <button
                                type="button"
                                class="danger-button"
                                data-gps-reject="${escapeHtml(getTripId(record))}"
                            >
                                判定无效
                            </button>

                        </div>

                    </div>
                    `
                )
                    .join(
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



        /* =====================================================
           请假
        ===================================================== */

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
                                ${escapeHtml(item.applicantName || item.personName || "-")}
                            </strong>

                            <span>
                                ${escapeHtml(item.leaveType || "请假")}
                            </span>

                        </div>


                        <div class="approval-note">

                            ${formatDateTime(item.startTime || item.startAt)}
                            →
                            ${formatDateTime(item.endTime || item.endAt)}

                            <br>

                            ${escapeHtml(item.reason || "-")}

                        </div>


                        <div class="approval-buttons">

                            <button
                                type="button"
                                class="success-button"
                                data-leave-approve="${escapeHtml(item.leaveId)}"
                            >
                                批准
                            </button>

                            <button
                                type="button"
                                class="danger-button"
                                data-leave-reject="${escapeHtml(item.leaveId)}"
                            >
                                驳回
                            </button>

                        </div>

                    </div>
                    `
                )
                    .join(
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



        function openMyLeave() {

            const currentId =
                localStorage.getItem(
                    "currentPersonId"
                );


            const person =
                getPersonnelRecords()
                    .find(
                        item =>

                            getPersonId(
                                item
                            ) ===
                                currentId &&

                            normalizePosition(
                                item.position
                            ) ===
                                "车队长"
                    );


            const profile =
                person ||
                readJson(
                    STORAGE.DISPATCH_PROFILE,
                    null
                );


            if (profile) {

                if (
                    $("leaveApplicantName")
                ) {

                    $("leaveApplicantName").value =
                        profile.name ||
                        "";
                }


                if (
                    $("leaveApplicantPosition")
                ) {

                    $("leaveApplicantPosition").value =
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
                $("leaveApplicantPosition")
                    ?.value
                    .trim() ||
                "车队长";


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


            const currentPersonId =
                localStorage.getItem(
                    "currentPersonId"
                ) ||
                createId(
                    "MANAGEMENT"
                );


            const records =
                getLeaves();


            records.push({

                leaveId:
                    createId(
                        "LEAVE"
                    ),

                applicantId:
                    currentPersonId,

                personId:
                    currentPersonId,

                applicantName:
                    name,

                personName:
                    name,

                role:
                    "management",

                position:

                    normalizePosition(
                        position
                    ),

                team:
                    "管理人员",

                leaveType:
                    $("leaveType")
                        ?.value ||
                    "事假",

                startTime:
                    new Date(start)
                        .toISOString(),

                endTime:
                    new Date(end)
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


            alert(
                "请假申请已提交总经理审批。"
            );
        }



        /* =====================================================
           罚单
        ===================================================== */

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


            const records =
                getPenalties();


            records.push({

                penaltyId:
                    createId(
                        "PENALTY"
                    ),

                personId:
                    select.value,

                personName:
                    option.dataset.name ||
                    "",

                team:
                    option.dataset.team ||
                    "",

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
                records
            );


            hideModal(
                "penaltyModal"
            );


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
                                        : item.status ===
                                            "processed"
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

                    </div>
                    `
                )
                    .join(
                        ""
                    );
        }



        /* =====================================================
           待办
        ===================================================== */

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



        /* =====================================================
           请假时间判断
        ===================================================== */

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


                        const from =
                            new Date(
                                leave.startTime ||
                                leave.startAt
                            );


                        const to =
                            new Date(
                                leave.endTime ||
                                leave.endAt
                            );


                        return (
                            from <= end &&
                            to >= start
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


                        const from =
                            new Date(
                                leave.startTime ||
                                leave.startAt
                            );


                        const to =
                            new Date(
                                leave.endTime ||
                                leave.endAt
                            );


                        return (
                            from < end &&
                            to > start
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


            return (

                String(
                    leave.applicantName ||
                    leave.personName ||
                    ""
                ).trim()

                ===

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



        /* =====================================================
           数据读写
        ===================================================== */

        function migrateTasks() {

            let tasks =
                getTasks()
                    .filter(
                        task =>
                            task.status !==
                            "withdrawn"
                    );


            tasks.forEach(
                task => {

                    task.bindings =
                        Array.isArray(
                            task.bindings
                        )
                            ? task.bindings
                            : [];


                    task.driverAssignments =
                        Array.isArray(
                            task.driverAssignments
                        )
                            ? task.driverAssignments
                            : [];


                    task.excavatorDriverAssignments =
                        Array.isArray(
                            task.excavatorDriverAssignments
                        )
                            ? task.excavatorDriverAssignments
                            : [];


                    task.auxiliaryAssignments =
                        Array.isArray(
                            task.auxiliaryAssignments
                        )
                            ? task.auxiliaryAssignments
                            : [];


                    task.equipmentAdjustments =
                        Array.isArray(
                            task.equipmentAdjustments
                        )
                            ? task.equipmentAdjustments
                            : [];


                    task.truckBindingHistory =
                        Array.isArray(
                            task.truckBindingHistory
                        )
                            ? task.truckBindingHistory
                            : [];
                }
            );


            saveTasks(
                tasks
            );
        }



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
            id
        ) {

            return getTasks()
                .find(
                    task =>
                        task.taskId ===
                        id
                ) ||
                null;
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
            data
        ) {

            localStorage.setItem(
                STORAGE.TRIPS,
                JSON.stringify(
                    data
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



        /* =====================================================
           工具
        ===================================================== */

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
                device.status ===
                    "maintenance" ||

                device.status ===
                    "service" ||

                device.status ===
                    "disabled" ||

                device.status ===
                    "working"
            ) {

                return "device-card maintenance";
            }


            if (
                occupied.has(
                    device.id
                )
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
                ).trim()

                ===

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


            const duplicate =
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

                        duplicate.add(
                            item.driverId
                        );
                    }


                    seen.add(
                        item.driverId
                    );
                }
            );


            return [
                ...duplicate
            ];
        }



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

            if ($("taskArea")) {
                $("taskArea").value = "";
            }

            if ($("taskLoadingPoint")) {
                $("taskLoadingPoint").value = "";
            }

            if ($("taskUnloadingPoint")) {
                $("taskUnloadingPoint").value = "";
            }

            if ($("taskRemark")) {
                $("taskRemark").value = "";
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

                const value =
                    localStorage.getItem(
                        key
                    );


                return value
                    ? JSON.parse(
                        value
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



        function createId(
            prefix
        ) {

            return (

                prefix +
                "_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(
                        2,
                        8
                    )
            );
        }

    }
);
