/*
========================================================
矿山管理系统
生产调度端
dispatch.js V2.6.0

核心规则：
1. 生产任务看板只显示 pending / active。
2. completed 自动进入历史任务。
3. 历史任务只显示 completed。
4. 撤回 = 删除，不进入历史任务。
5. pending / active 可中途增加、减少挖机和调整卡车。
6. 中途调整不改变任务编号，不清零运输趟数。
========================================================
*/

document.addEventListener("DOMContentLoaded", function () {

    const TASK_STORAGE = "dispatchPublishedTasks";
    const LATEST_TASK_STORAGE = "publishedDispatchTask";
    const TRIP_STORAGE = "driverTripRecords";

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


    const equipment = createEquipmentData();


    /*
    ========================================================
    DOM
    ========================================================
    */

    const newTaskButton =
        document.getElementById("newTaskButton");

    const historyTaskButton =
        document.getElementById("historyTaskButton");

    const cancelCreateButton =
        document.getElementById("cancelCreateButton");

    const generateTaskButton =
        document.getElementById("generateTaskButton");

    const bindTrucksButton =
        document.getElementById("bindTrucksButton");

    const previewTaskButton =
        document.getElementById("previewTaskButton");

    const backEditButton =
        document.getElementById("backEditButton");

    const publishTaskButton =
        document.getElementById("publishTaskButton");

    const closeModalButton =
        document.getElementById("closeModalButton");

    const auxWorkType =
        document.getElementById("auxWorkType");

    const cancelAuxTaskButton =
        document.getElementById("cancelAuxTaskButton");

    const confirmAuxTaskButton =
        document.getElementById("confirmAuxTaskButton");

    const closePublishedTaskButton =
        document.getElementById("closePublishedTaskButton");

    const withdrawPublishedTaskButton =
        document.getElementById("withdrawPublishedTaskButton");

    const completePublishedTaskButton =
        document.getElementById("completePublishedTaskButton");

    const adjustTaskButton =
        document.getElementById("adjustTaskButton");

    const closeAdjustTaskButton =
        document.getElementById("closeAdjustTaskButton");

    const saveAdjustTaskButton =
        document.getElementById("saveAdjustTaskButton");

    const addAdjustmentBindingButton =
        document.getElementById("addAdjustmentBindingButton");

    const closeHistoryTaskButton =
        document.getElementById("closeHistoryTaskButton");

    const historyDateFilter =
        document.getElementById("historyDateFilter");

    const historyShiftFilter =
        document.getElementById("historyShiftFilter");

    const historyAreaFilter =
        document.getElementById("historyAreaFilter");

    const resetHistoryFilterButton =
        document.getElementById("resetHistoryFilterButton");


    /*
    ========================================================
    初始化
    ========================================================
    */

    setValue(
        "taskShift",
        getDefaultShift()
    );

    migrateLegacyWithdrawnTasks();

    migrateOldTaskStatuses();

    syncPublishedTaskExecutionStatus();

    rebuildEquipmentStatus();

    renderProductionTaskBoard();

    renderHistoryTaskBoard();


    /*
    ========================================================
    顶部按钮
    ========================================================
    */

    newTaskButton.addEventListener(
        "click",
        function () {

            setValue(
                "taskShift",
                getDefaultShift()
            );

            showSection(
                "taskCreateSection"
            );

            scrollToId(
                "taskCreateSection"
            );

        }
    );


    historyTaskButton.addEventListener(
        "click",
        function () {

            const section =
                document.getElementById(
                    "historyTaskSection"
                );

            const isHidden =
                section.classList.contains(
                    "hidden"
                );

            if (isHidden) {

                renderHistoryTaskBoard();

                showSection(
                    "historyTaskSection"
                );

                scrollToId(
                    "historyTaskSection"
                );

                historyTaskButton.textContent =
                    "📚 收起历史任务";

            }

            else {

                hideSection(
                    "historyTaskSection"
                );

                historyTaskButton.textContent =
                    "📚 历史任务";

            }

        }
    );


    /*
    ========================================================
    创建任务
    ========================================================
    */

    cancelCreateButton.addEventListener(
        "click",
        function () {

            hideSection(
                "taskCreateSection"
            );

        }
    );


    generateTaskButton.addEventListener(
        "click",
        function () {

            const area =
                getValue(
                    "taskArea"
                );

            if (!area) {

                alert(
                    "请输入作业区域"
                );

                return;

            }


            currentTask = {

                taskId:
                    "TASK_" +
                    Date.now(),

                date:
                    new Date()
                        .toLocaleDateString(
                            "zh-CN"
                        ),

                shift:
                    getValue(
                        "taskShift"
                    ),

                area:
                    area,

                remark:
                    getValue(
                        "taskRemark"
                    ),

                status:
                    "configuring",

                createdAt:
                    new Date()
                        .toISOString()

            };


            selectedExcavatorId =
                null;

            selectedTruckIds =
                [];

            bindings =
                [];

            auxiliaryAssignments =
                [];


            setText(
                "summaryDate",
                currentTask.date
            );

            setText(
                "summaryShift",
                currentTask.shift
            );

            setText(
                "summaryArea",
                currentTask.area
            );

            setText(
                "summaryRemark",
                currentTask.remark ||
                "无"
            );


            hideSection(
                "taskCreateSection"
            );

            showConfigurationSections();

            renderConfiguration();

            scrollToId(
                "excavatorSection"
            );

        }
    );


    /*
    ========================================================
    绑定挖机卡车
    ========================================================
    */

    bindTrucksButton.addEventListener(
        "click",
        function () {

            if (
                !selectedExcavatorId
            ) {

                alert(
                    "请先选择挖机"
                );

                return;

            }


            if (
                selectedTruckIds.length ===
                0
            ) {

                alert(
                    "请选择至少一台跟随卡车"
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


            renderConfiguration();

        }
    );


    /*
    ========================================================
    辅助车辆
    ========================================================
    */

    auxWorkType.addEventListener(
        "change",
        function () {

            if (
                this.value ===
                "manual"
            ) {

                showSection(
                    "auxManualWorkBox"
                );

            }

            else {

                hideSection(
                    "auxManualWorkBox"
                );

                setValue(
                    "auxManualWork",
                    ""
                );

            }

        }
    );


    cancelAuxTaskButton.addEventListener(
        "click",
        function () {

            selectedAuxDeviceId =
                null;

            hideSection(
                "auxTaskModal"
            );

        }
    );


    confirmAuxTaskButton.addEventListener(
        "click",
        function () {

            if (
                !selectedAuxDeviceId ||
                !currentTask
            ) {

                return;

            }


            const device =
                findDevice(
                    selectedAuxDeviceId
                );

            if (!device) {

                return;

            }


            let work =
                auxWorkType.value;


            if (
                work ===
                "manual"
            ) {

                work =
                    getValue(
                        "auxManualWork"
                    );

                if (!work) {

                    alert(
                        "请输入具体工作内容"
                    );

                    return;

                }

            }


            auxiliaryAssignments.push({

                assignmentId:
                    "AUX_" +
                    Date.now(),

                vehicleId:
                    device.id,

                type:
                    device.type,

                typeName:
                    getTypeName(
                        device.type
                    ),

                work:
                    work,

                remark:
                    getValue(
                        "auxTaskRemark"
                    ),

                area:
                    currentTask.area,

                shift:
                    currentTask.shift,

                taskId:
                    currentTask.taskId,

                assignedAt:
                    new Date()
                        .toISOString()

            });


            selectedAuxDeviceId =
                null;


            hideSection(
                "auxTaskModal"
            );


            renderConfiguration();

        }
    );


    /*
    ========================================================
    发布任务
    ========================================================
    */

    previewTaskButton.addEventListener(
        "click",
        function () {

            if (!currentTask) {

                return;

            }


            renderTaskPreview();

            showSection(
                "previewSection"
            );

            scrollToId(
                "previewSection"
            );

        }
    );


    backEditButton.addEventListener(
        "click",
        function () {

            hideSection(
                "previewSection"
            );

        }
    );


    publishTaskButton.addEventListener(
        "click",
        function () {

            if (!currentTask) {

                return;

            }


            if (
                !bindings.length &&
                !auxiliaryAssignments.length
            ) {

                alert(
                    "请至少配置一组主采设备或一台辅助车辆"
                );

                return;

            }


            const conflict =
                validatePublishConflict();

            if (conflict) {

                alert(
                    conflict
                );

                return;

            }


            const confirmed =
                confirm(
                    "确认发布当前生产任务吗？"
                );

            if (!confirmed) {

                return;

            }


            const task = {

                ...currentTask,

                status:
                    "pending",

                publishedAt:
                    new Date()
                        .toISOString(),

                bindings:
                    deepClone(
                        bindings
                    ),

                auxiliaryAssignments:
                    deepClone(
                        auxiliaryAssignments
                    ),

                equipmentAdjustments:
                    [],

                transportTripCount:
                    0

            };


            savePublishedTask(
                task
            );


            currentTask =
                null;

            selectedExcavatorId =
                null;

            selectedTruckIds =
                [];

            bindings =
                [];

            auxiliaryAssignments =
                [];


            hideConfigurationSections();

            rebuildEquipmentStatus();

            renderProductionTaskBoard();

            renderHistoryTaskBoard();


            alert(
                "生产任务发布成功"
            );


            scrollToId(
                "productionTaskBoardSection"
            );

        }
    );


    /*
    ========================================================
    普通弹窗
    ========================================================
    */

    closeModalButton.addEventListener(
        "click",
        function () {

            hideSection(
                "deviceModal"
            );

        }
    );


    closePublishedTaskButton.addEventListener(
        "click",
        function () {

            selectedPublishedTaskId =
                null;

            hideSection(
                "publishedTaskModal"
            );

        }
    );


    /*
    ========================================================
    撤回 = 删除
    ========================================================
    */

    withdrawPublishedTaskButton.addEventListener(
        "click",
        function () {

            if (
                !selectedPublishedTaskId
            ) {

                return;

            }


            const stats =
                getTaskTripStats(
                    selectedPublishedTaskId
                );


            if (
                stats.count >
                0
            ) {

                alert(
                    "任务已经产生运输记录，不能撤回"
                );

                syncPublishedTaskExecutionStatus();

                renderProductionTaskBoard();

                return;

            }


            const tasks =
                getPublishedTasks();


            const task =
                tasks.find(
                    function (item) {

                        return (
                            item.taskId ===
                            selectedPublishedTaskId
                        );

                    }
                );


            if (!task) {

                return;

            }


            if (
                task.status !==
                "pending"
            ) {

                alert(
                    "当前任务状态不能撤回"
                );

                return;

            }


            const confirmed =
                confirm(
                    "确认撤回任务吗？撤回后任务将直接删除，不进入历史任务。"
                );

            if (!confirmed) {

                return;

            }


            const taskId =
                task.taskId;


            saveTaskArray(

                tasks.filter(
                    function (item) {

                        return (
                            item.taskId !==
                            taskId
                        );

                    }
                )

            );


            clearLatestTaskIfMatch(
                taskId
            );


            selectedPublishedTaskId =
                null;


            hideSection(
                "publishedTaskModal"
            );


            rebuildEquipmentStatus();

            renderProductionTaskBoard();

            renderHistoryTaskBoard();


            alert(
                "任务已撤回并删除"
            );

        }
    );


    /*
    ========================================================
    完成任务
    ========================================================
    */

    completePublishedTaskButton.addEventListener(
        "click",
        function () {

            if (
                !selectedPublishedTaskId
            ) {

                return;

            }


            syncPublishedTaskExecutionStatus();


            const tasks =
                getPublishedTasks();


            const task =
                tasks.find(
                    function (item) {

                        return (
                            item.taskId ===
                            selectedPublishedTaskId
                        );

                    }
                );


            if (!task) {

                return;

            }


            const stats =
                getTaskTripStats(
                    task.taskId
                );


            if (
                stats.count ===
                0
            ) {

                alert(
                    "任务尚未产生运输记录，不能完成"
                );

                return;

            }


            if (
                task.status !==
                "active"
            ) {

                alert(
                    "只有执行中的任务才能完成"
                );

                return;

            }


            const confirmed =
                confirm(
                    "确认完成本任务吗？完成后任务将进入历史任务。"
                );

            if (!confirmed) {

                return;

            }


            task.status =
                "completed";

            task.completedAt =
                new Date()
                    .toISOString();

            task.transportTripCount =
                stats.count;


            saveTaskArray(
                tasks
            );


            selectedPublishedTaskId =
                null;


            hideSection(
                "publishedTaskModal"
            );


            rebuildEquipmentStatus();

            renderProductionTaskBoard();

            renderHistoryTaskBoard();


            alert(
                "任务已完成并进入历史任务"
            );

        }
    );


    /*
    ========================================================
    调整设备入口
    ========================================================
    */

    adjustTaskButton.addEventListener(
        "click",
        function () {

            if (
                !selectedPublishedTaskId
            ) {

                return;

            }


            const taskId =
                selectedPublishedTaskId;


            hideSection(
                "publishedTaskModal"
            );


            openAdjustmentModal(
                taskId
            );

        }
    );


    closeAdjustTaskButton.addEventListener(
        "click",
        closeAdjustmentModal
    );


    addAdjustmentBindingButton.addEventListener(
        "click",
        addOrUpdateAdjustmentBinding
    );


    saveAdjustTaskButton.addEventListener(
        "click",
        saveAdjustmentChanges
    );


    /*
    ========================================================
    历史任务筛选
    ========================================================
    */

    historyDateFilter.addEventListener(
        "change",
        renderHistoryTaskBoard
    );


    historyShiftFilter.addEventListener(
        "change",
        renderHistoryTaskBoard
    );


    historyAreaFilter.addEventListener(
        "input",
        renderHistoryTaskBoard
    );


    resetHistoryFilterButton.addEventListener(
        "click",
        function () {

            historyDateFilter.value =
                "";

            historyShiftFilter.value =
                "";

            historyAreaFilter.value =
                "";

            renderHistoryTaskBoard();

        }
    );


    closeHistoryTaskButton.addEventListener(
        "click",
        function () {

            hideSection(
                "historyTaskModal"
            );

        }
    );


    /*
    ========================================================
    配置界面
    ========================================================
    */

    function showConfigurationSections() {

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
        ].forEach(
            showSection
        );

    }


    function hideConfigurationSections() {

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
        ].forEach(
            hideSection
        );

    }


    function renderConfiguration() {

        renderExcavators();

        renderTrucks();

        renderBindings();

        renderAuxiliaryBoard(
            "loader",
            "loaderBoard",
            "loaderCount"
        );

        renderAuxiliaryBoard(
            "water",
            "waterBoard",
            "waterCount"
        );

        renderAuxiliaryBoard(
            "fuel",
            "fuelBoard",
            "fuelCount"
        );

        renderAuxiliaryBoard(
            "grader",
            "graderBoard",
            "graderCount"
        );

        renderAuxiliaryBoard(
            "dozer",
            "dozerBoard",
            "dozerCount"
        );

        renderAuxiliaryBoard(
            "bus",
            "busBoard",
            "busCount"
        );

        renderAuxiliaryAssignments();

    }


    /*
    ========================================================
    创建任务：挖机
    ========================================================
    */

    function renderExcavators() {

        const board =
            document.getElementById(
                "excavatorBoard"
            );


        const excavators =
            equipment.filter(
                function (device) {

                    return (
                        device.type ===
                        "excavator"
                    );

                }
            );


        setText(
            "excavatorCount",
            excavators.length +
            " 台"
        );


        board.innerHTML =
            "";


        excavators.forEach(
            function (device) {

                const state =
                    getDraftDeviceState(
                        device
                    );


                const card =
                    createDeviceCard(
                        device,
                        state
                    );


                if (
                    selectedExcavatorId ===
                    device.id
                ) {

                    card.classList.add(
                        "selected-device"
                    );

                }


                card.addEventListener(
                    "click",
                    function () {

                        if (
                            device.status ===
                            "maintenance"
                        ) {

                            showMaintenanceModal(
                                device
                            );

                            return;

                        }


                        if (
                            device.status ===
                            "assigned"
                        ) {

                            showAssignedModal(
                                device
                            );

                            return;

                        }


                        if (
                            isDeviceInDraft(
                                device.id
                            )
                        ) {

                            alert(
                                device.id +
                                " 已经加入当前任务"
                            );

                            return;

                        }


                        selectedExcavatorId =
                            device.id;

                        selectedTruckIds =
                            [];


                        renderExcavators();

                        renderTrucks();

                    }
                );


                board.appendChild(
                    card
                );

            }
        );

    }


    /*
    ========================================================
    创建任务：卡车
    ========================================================
    */

    function renderTrucks() {

        const board =
            document.getElementById(
                "truckBoard"
            );


        const trucks =
            equipment.filter(
                function (device) {

                    return (
                        device.type ===
                        "truck"
                    );

                }
            );


        setText(
            "truckCount",
            trucks.length +
            " 台"
        );


        board.innerHTML =
            "";


        trucks.forEach(
            function (device) {

                const state =
                    getDraftDeviceState(
                        device
                    );


                const card =
                    createDeviceCard(
                        device,
                        state
                    );


                if (
                    selectedTruckIds.includes(
                        device.id
                    )
                ) {

                    card.classList.add(
                        "selected-device"
                    );

                }


                card.addEventListener(
                    "click",
                    function () {

                        if (
                            device.status ===
                            "maintenance"
                        ) {

                            showMaintenanceModal(
                                device
                            );

                            return;

                        }


                        if (
                            device.status ===
                            "assigned"
                        ) {

                            showAssignedModal(
                                device
                            );

                            return;

                        }


                        if (
                            isDeviceInDraft(
                                device.id
                            )
                        ) {

                            alert(
                                device.id +
                                " 已经加入当前任务"
                            );

                            return;

                        }


                        if (
                            !selectedExcavatorId
                        ) {

                            alert(
                                "请先选择挖机"
                            );

                            return;

                        }


                        toggleArrayValue(
                            selectedTruckIds,
                            device.id
                        );


                        renderTrucks();

                    }
                );


                board.appendChild(
                    card
                );

            }
        );


        if (
            selectedExcavatorId
        ) {

            document.getElementById(
                "selectedExcavatorInfo"
            ).innerHTML =

                "当前挖机：<strong>" +
                escapeHtml(
                    selectedExcavatorId
                ) +
                "</strong> ｜ 已选择 <strong>" +
                selectedTruckIds.length +
                "</strong> 台卡车";


            bindTrucksButton.classList.remove(
                "hidden"
            );


            bindTrucksButton.textContent =
                "绑定所选卡车（" +
                selectedTruckIds.length +
                "台）";

        }

        else {

            setText(
                "selectedExcavatorInfo",
                "当前未选择挖机"
            );

            bindTrucksButton.classList.add(
                "hidden"
            );

        }

    }


    /*
    ========================================================
    创建任务：绑定列表
    ========================================================
    */

    function renderBindings() {

        const container =
            document.getElementById(
                "bindingList"
            );


        if (
            bindings.length ===
            0
        ) {

            container.innerHTML =
                '<div class="empty-placeholder">暂无绑定关系</div>';

            return;

        }


        container.innerHTML =
            "";


        bindings.forEach(
            function (binding) {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "binding-card";


                card.innerHTML = `

                    <div>

                        <strong>
                            🚜
                            ${escapeHtml(
                                binding.excavatorId
                            )}
                        </strong>

                        <div class="mini-device-list">

                            ${
                                binding.truckIds
                                    .map(
                                        function (truckId) {

                                            return (
                                                "<span>🚚 " +
                                                escapeHtml(
                                                    truckId
                                                ) +
                                                "</span>"
                                            );

                                        }
                                    )
                                    .join("")
                            }

                        </div>

                    </div>

                `;


                container.appendChild(
                    card
                );

            }
        );

    }


    /*
    ========================================================
    创建任务：辅助车辆
    ========================================================
    */

    function renderAuxiliaryBoard(
        type,
        boardId,
        countId
    ) {

        const board =
            document.getElementById(
                boardId
            );


        const devices =
            equipment.filter(
                function (device) {

                    return (
                        device.type ===
                        type
                    );

                }
            );


        setText(
            countId,
            devices.length +
            " 台"
        );


        board.innerHTML =
            "";


        devices.forEach(
            function (device) {

                const state =
                    getDraftDeviceState(
                        device
                    );


                const card =
                    createDeviceCard(
                        device,
                        state
                    );


                card.addEventListener(
                    "click",
                    function () {

                        if (
                            device.status ===
                            "maintenance"
                        ) {

                            showMaintenanceModal(
                                device
                            );

                            return;

                        }


                        if (
                            device.status ===
                            "assigned"
                        ) {

                            showAssignedModal(
                                device
                            );

                            return;

                        }


                        if (
                            isDeviceInDraft(
                                device.id
                            )
                        ) {

                            alert(
                                device.id +
                                " 已经加入当前任务"
                            );

                            return;

                        }


                        if (!currentTask) {

                            alert(
                                "请先创建生产任务"
                            );

                            return;

                        }


                        openAuxiliaryModal(
                            device
                        );

                    }
                );


                board.appendChild(
                    card
                );

            }
        );

    }


    function openAuxiliaryModal(
        device
    ) {

        selectedAuxDeviceId =
            device.id;


        setText(
            "auxSelectedVehicle",
            getTypeName(
                device.type
            ) +
            " · " +
            device.id
        );


        setText(
            "auxTaskModalTitle",
            "配置" +
            getTypeName(
                device.type
            ) +
            "任务"
        );


        auxWorkType.innerHTML =
            "";


        getWorkOptions(
            device.type
        ).forEach(
            function (item) {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    item.value;

                option.textContent =
                    item.label;


                auxWorkType.appendChild(
                    option
                );

            }
        );


        hideSection(
            "auxManualWorkBox"
        );

        setValue(
            "auxManualWork",
            ""
        );

        setValue(
            "auxTaskRemark",
            ""
        );


        showSection(
            "auxTaskModal"
        );

    }


    function renderAuxiliaryAssignments() {

        const container =
            document.getElementById(
                "auxiliaryAssignmentList"
            );


        if (
            auxiliaryAssignments.length ===
            0
        ) {

            container.innerHTML =
                '<div class="empty-placeholder">暂未配置辅助车辆</div>';

            return;

        }


        container.innerHTML =
            auxiliaryAssignments
                .map(
                    function (item) {

                        return `

                            <div class="aux-assignment-card">

                                <strong>
                                    ${escapeHtml(
                                        item.typeName
                                    )}
                                    ·
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

                        `;

                    }
                )
                .join("");

    }


    /*
    ========================================================
    发布预览
    ========================================================
    */

    function renderTaskPreview() {

        const container =
            document.getElementById(
                "taskPreviewContent"
            );


        let html = `

            <div class="preview-header">

                <strong>
                    ${escapeHtml(
                        currentTask.area
                    )}
                </strong>

                <span>
                    ${escapeHtml(
                        currentTask.date
                    )}
                    ·
                    ${escapeHtml(
                        currentTask.shift
                    )}
                </span>

            </div>


            <div class="published-detail-block">

                <h4>
                    🚜 主采设备
                </h4>

        `;


        if (
            bindings.length ===
            0
        ) {

            html +=
                "<p>未配置挖机和卡车</p>";

        }

        else {

            html +=
                renderBindingsHtml(
                    bindings
                );

        }


        html += `

            </div>


            <div class="published-detail-block">

                <h4>
                    🚧 辅助车辆
                </h4>

                ${
                    renderAuxiliaryHtml(
                        auxiliaryAssignments
                    )
                }

            </div>


            <div class="published-detail-block">

                <h4>
                    调度说明
                </h4>

                <p>
                    ${escapeHtml(
                        currentTask.remark ||
                        "无"
                    )}
                </p>

            </div>

        `;


        container.innerHTML =
            html;

    }


    /*
    ========================================================
    生产任务看板
    ========================================================
    */

    function renderProductionTaskBoard() {

        migrateOldTaskStatuses();

        syncPublishedTaskExecutionStatus();


        const board =
            document.getElementById(
                "productionTaskBoard"
            );


        const tasks =
            getPublishedTasks()
                .filter(
                    function (task) {

                        return (
                            task.status ===
                            "pending" ||
                            task.status ===
                            "active"
                        );

                    }
                )
                .sort(
                    sortTasksNewestFirst
                );


        setText(
            "productionTaskCount",
            tasks.length +
            " 个进行中任务"
        );


        if (
            tasks.length ===
            0
        ) {

            board.innerHTML =
                '<div class="empty-placeholder">当前没有进行中的生产任务</div>';

            return;

        }


        board.innerHTML =
            "";


        tasks.forEach(
            function (task) {

                const card =
                    createTaskCard(
                        task,
                        false
                    );


                card.addEventListener(
                    "click",
                    function () {

                        openPublishedTask(
                            task.taskId
                        );

                    }
                );


                board.appendChild(
                    card
                );

            }
        );

    }


    /*
    ========================================================
    当前任务详情
    ========================================================
    */

    function openPublishedTask(
        taskId
    ) {

        syncPublishedTaskExecutionStatus();


        const task =
            getPublishedTasks()
                .find(
                    function (item) {

                        return (
                            item.taskId ===
                            taskId
                        );

                    }
                );


        if (
            !task ||
            ![
                "pending",
                "active"
            ].includes(
                task.status
            )
        ) {

            return;

        }


        selectedPublishedTaskId =
            task.taskId;


        const stats =
            getTaskTripStats(
                task.taskId
            );


        setText(
            "publishedTaskModalTitle",
            task.area +
            " · " +
            task.shift
        );


        document.getElementById(
            "publishedTaskModalContent"
        ).innerHTML =
            renderTaskDetailHtml(
                task,
                stats,
                false
            );


        adjustTaskButton.classList.remove(
            "hidden"
        );


        withdrawPublishedTaskButton.classList.add(
            "hidden"
        );


        completePublishedTaskButton.classList.add(
            "hidden"
        );


        if (
            task.status ===
            "pending" &&
            stats.count ===
            0
        ) {

            withdrawPublishedTaskButton.classList.remove(
                "hidden"
            );

        }


        if (
            task.status ===
            "active" &&
            stats.count >
            0
        ) {

            completePublishedTaskButton.classList.remove(
                "hidden"
            );

        }


        showSection(
            "publishedTaskModal"
        );

    }


    /*
    ========================================================
    中途调整设备
    ========================================================
    */

    function openAdjustmentModal(
        taskId
    ) {

        const task =
            getPublishedTasks()
                .find(
                    function (item) {

                        return (
                            item.taskId ===
                            taskId
                        );

                    }
                );


        if (
            !task ||
            ![
                "pending",
                "active"
            ].includes(
                task.status
            )
        ) {

            alert(
                "当前任务不能调整设备"
            );

            return;

        }


        adjustmentTaskId =
            task.taskId;


        adjustmentOriginalBindings =
            normalizeBindings(
                task.bindings ||
                []
            );


        adjustmentDraftBindings =
            deepClone(
                adjustmentOriginalBindings
            );


        adjustmentSelectedExcavatorId =
            null;

        adjustmentSelectedTruckIds =
            [];

        adjustmentEditingExcavatorId =
            null;


        setText(
            "adjustTaskModalTitle",
            "调整设备 · " +
            task.area +
            " · " +
            task.shift
        );


        setText(
            "adjustSelectionInfo",
            "请选择一台挖机"
        );


        addAdjustmentBindingButton.textContent =
            "加入本任务";


        renderAdjustmentUi();


        showSection(
            "adjustTaskModal"
        );

    }


    function closeAdjustmentModal() {

        adjustmentTaskId =
            null;

        adjustmentOriginalBindings =
            [];

        adjustmentDraftBindings =
            [];

        adjustmentSelectedExcavatorId =
            null;

        adjustmentSelectedTruckIds =
            [];

        adjustmentEditingExcavatorId =
            null;


        hideSection(
            "adjustTaskModal"
        );

    }


    function renderAdjustmentUi() {

        renderAdjustmentCurrentBindings();

        renderAdjustmentExcavators();

        renderAdjustmentTrucks();


        const changed =
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


        saveAdjustTaskButton.disabled =
            !changed;


        saveAdjustTaskButton.textContent =
            changed
                ?
                "保存本次设备调整"
                :
                "暂无修改";

    }


    function renderAdjustmentCurrentBindings() {

        const container =
            document.getElementById(
                "adjustCurrentBindings"
            );


        if (
            adjustmentDraftBindings.length ===
            0
        ) {

            container.innerHTML =
                '<div class="empty-placeholder">当前没有挖机配置</div>';

            return;

        }


        container.innerHTML =
            "";


        adjustmentDraftBindings.forEach(
            function (binding) {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "adjust-binding-card";


                card.innerHTML = `

                    <div>

                        <strong>
                            🚜
                            ${escapeHtml(
                                binding.excavatorId
                            )}
                        </strong>

                        <div class="mini-device-list">

                            ${
                                (
                                    binding.truckIds ||
                                    []
                                )
                                    .map(
                                        function (truckId) {

                                            return (
                                                "<span>🚚 " +
                                                escapeHtml(
                                                    truckId
                                                ) +
                                                "</span>"
                                            );

                                        }
                                    )
                                    .join("")
                                ||
                                "<span>暂无卡车</span>"
                            }

                        </div>

                    </div>


                    <div class="adjust-row-buttons">

                        <button
                            type="button"
                            class="adjust-edit-button"
                        >
                            调整卡车
                        </button>

                        <button
                            type="button"
                            class="adjust-remove-button"
                        >
                            减少挖机
                        </button>

                    </div>

                `;


                card.querySelector(
                    ".adjust-edit-button"
                ).addEventListener(
                    "click",
                    function () {

                        startEditBinding(
                            binding.excavatorId
                        );

                    }
                );


                card.querySelector(
                    ".adjust-remove-button"
                ).addEventListener(
                    "click",
                    function () {

                        removeAdjustmentExcavator(
                            binding.excavatorId
                        );

                    }
                );


                container.appendChild(
                    card
                );

            }
        );

    }


    function startEditBinding(
        excavatorId
    ) {

        const binding =
            adjustmentDraftBindings
                .find(
                    function (item) {

                        return (
                            item.excavatorId ===
                            excavatorId
                        );

                    }
                );


        if (!binding) {

            return;

        }


        adjustmentEditingExcavatorId =
            excavatorId;

        adjustmentSelectedExcavatorId =
            excavatorId;

        adjustmentSelectedTruckIds =
            [
                ...(
                    binding.truckIds ||
                    []
                )
            ];


        setText(
            "adjustSelectionInfo",
            "正在调整 " +
            excavatorId +
            " 的跟随卡车"
        );


        addAdjustmentBindingButton.textContent =
            "保存该挖机卡车调整";


        renderAdjustmentUi();

    }


    function removeAdjustmentExcavator(
        excavatorId
    ) {

        const confirmed =
            confirm(
                "确认减少挖机 " +
                excavatorId +
                " 吗？该挖机的跟随关系也会解除。"
            );


        if (!confirmed) {

            return;

        }


        adjustmentDraftBindings =
            adjustmentDraftBindings
                .filter(
                    function (item) {

                        return (
                            item.excavatorId !==
                            excavatorId
                        );

                    }
                );


        if (
            adjustmentSelectedExcavatorId ===
            excavatorId
        ) {

            adjustmentSelectedExcavatorId =
                null;

            adjustmentSelectedTruckIds =
                [];

            adjustmentEditingExcavatorId =
                null;

        }


        setText(
            "adjustSelectionInfo",
            "请选择一台挖机"
        );


        addAdjustmentBindingButton.textContent =
            "加入本任务";


        renderAdjustmentUi();

    }


    function renderAdjustmentExcavators() {

        const board =
            document.getElementById(
                "adjustExcavatorBoard"
            );


        const otherTaskUsed =
            getOtherTaskUsedEquipment(
                adjustmentTaskId
            );


        board.innerHTML =
            "";


        equipment
            .filter(
                function (device) {

                    return (
                        device.type ===
                        "excavator"
                    );

                }
            )
            .forEach(
                function (device) {

                    const inDraft =
                        adjustmentDraftBindings
                            .some(
                                function (binding) {

                                    return (
                                        binding.excavatorId ===
                                        device.id
                                    );

                                }
                            );


                    const blocked =
                        device.status ===
                        "maintenance" ||
                        otherTaskUsed.has(
                            device.id
                        ) ||
                        (
                            inDraft &&
                            adjustmentEditingExcavatorId !==
                            device.id
                        );


                    const button =
                        createAdjustDeviceButton(
                            device.id,
                            getAdjustExcavatorText(
                                device,
                                inDraft,
                                otherTaskUsed
                            ),
                            blocked
                        );


                    if (
                        adjustmentSelectedExcavatorId ===
                        device.id
                    ) {

                        button.classList.add(
                            "selected"
                        );

                    }


                    button.addEventListener(
                        "click",
                        function () {

                            if (
                                device.status ===
                                "maintenance"
                            ) {

                                showMaintenanceModal(
                                    device
                                );

                                return;

                            }


                            if (
                                otherTaskUsed.has(
                                    device.id
                                )
                            ) {

                                alert(
                                    device.id +
                                    " 已被其他任务占用"
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
                                    " 已经在当前任务中"
                                );

                                return;

                            }


                            if (
                                adjustmentEditingExcavatorId &&
                                adjustmentEditingExcavatorId !==
                                device.id
                            ) {

                                alert(
                                    "请先完成当前挖机的卡车调整"
                                );

                                return;

                            }


                            adjustmentSelectedExcavatorId =
                                device.id;

                            adjustmentSelectedTruckIds =
                                [];


                            setText(
                                "adjustSelectionInfo",
                                "已选择 " +
                                device.id +
                                "，请选择跟随卡车"
                            );


                            addAdjustmentBindingButton.textContent =
                                "加入本任务";


                            renderAdjustmentUi();

                        }
                    );


                    board.appendChild(
                        button
                    );

                }
            );

    }


    function renderAdjustmentTrucks() {

        const board =
            document.getElementById(
                "adjustTruckBoard"
            );


        const otherTaskUsed =
            getOtherTaskUsedEquipment(
                adjustmentTaskId
            );


        const usedByOtherBinding =
            new Set();


        adjustmentDraftBindings.forEach(
            function (binding) {

                if (
                    binding.excavatorId !==
                    adjustmentEditingExcavatorId
                ) {

                    (
                        binding.truckIds ||
                        []
                    ).forEach(
                        function (truckId) {

                            usedByOtherBinding.add(
                                truckId
                            );

                        }
                    );

                }

            }
        );


        board.innerHTML =
            "";


        equipment
            .filter(
                function (device) {

                    return (
                        device.type ===
                        "truck"
                    );

                }
            )
            .forEach(
                function (device) {

                    const selected =
                        adjustmentSelectedTruckIds
                            .includes(
                                device.id
                            );


                    const blocked =
                        !adjustmentSelectedExcavatorId ||
                        device.status ===
                        "maintenance" ||
                        otherTaskUsed.has(
                            device.id
                        ) ||
                        usedByOtherBinding.has(
                            device.id
                        );


                    let stateText =
                        selected
                            ?
                            "✓ 已选择"
                            :
                            "可选择";


                    if (
                        !adjustmentSelectedExcavatorId
                    ) {

                        stateText =
                            "先选挖机";

                    }

                    else if (
                        device.status ===
                        "maintenance"
                    ) {

                        stateText =
                            "维修中";

                    }

                    else if (
                        otherTaskUsed.has(
                            device.id
                        )
                    ) {

                        stateText =
                            "其他任务占用";

                    }

                    else if (
                        usedByOtherBinding.has(
                            device.id
                        )
                    ) {

                        stateText =
                            "已跟随其他挖机";

                    }


                    const button =
                        createAdjustDeviceButton(
                            device.id,
                            stateText,
                            blocked
                        );


                    if (selected) {

                        button.classList.add(
                            "selected"
                        );

                    }


                    button.addEventListener(
                        "click",
                        function () {

                            if (
                                !adjustmentSelectedExcavatorId
                            ) {

                                alert(
                                    "请先选择挖机"
                                );

                                return;

                            }


                            if (
                                device.status ===
                                "maintenance"
                            ) {

                                showMaintenanceModal(
                                    device
                                );

                                return;

                            }


                            if (
                                otherTaskUsed.has(
                                    device.id
                                ) ||
                                usedByOtherBinding.has(
                                    device.id
                                )
                            ) {

                                alert(
                                    device.id +
                                    " 当前不可分配"
                                );

                                return;

                            }


                            toggleArrayValue(
                                adjustmentSelectedTruckIds,
                                device.id
                            );


                            renderAdjustmentTrucks();

                        }
                    );


                    board.appendChild(
                        button
                    );

                }
            );


        setText(
            "adjustTruckSelectionCount",
            "已选择 " +
            adjustmentSelectedTruckIds.length +
            " 台卡车"
        );

    }


    function addOrUpdateAdjustmentBinding() {

        if (
            !adjustmentSelectedExcavatorId
        ) {

            alert(
                "请先选择挖机"
            );

            return;

        }


        if (
            adjustmentSelectedTruckIds.length ===
            0
        ) {

            alert(
                "请至少选择一台跟随卡车"
            );

            return;

        }


        if (
            adjustmentEditingExcavatorId
        ) {

            const binding =
                adjustmentDraftBindings
                    .find(
                        function (item) {

                            return (
                                item.excavatorId ===
                                adjustmentEditingExcavatorId
                            );

                        }
                    );


            if (binding) {

                binding.truckIds =
                    [
                        ...adjustmentSelectedTruckIds
                    ];

            }

        }

        else {

            adjustmentDraftBindings.push({

                excavatorId:
                    adjustmentSelectedExcavatorId,

                truckIds:
                    [
                        ...adjustmentSelectedTruckIds
                    ]

            });

        }


        adjustmentSelectedExcavatorId =
            null;

        adjustmentSelectedTruckIds =
            [];

        adjustmentEditingExcavatorId =
            null;


        setText(
            "adjustSelectionInfo",
            "请选择一台挖机"
        );


        addAdjustmentBindingButton.textContent =
            "加入本任务";


        renderAdjustmentUi();

    }


    function saveAdjustmentChanges() {

        if (!adjustmentTaskId) {

            return;

        }


        const before =
            normalizeBindings(
                adjustmentOriginalBindings
            );


        const after =
            normalizeBindings(
                adjustmentDraftBindings
            );


        if (
            JSON.stringify(
                before
            ) ===
            JSON.stringify(
                after
            )
        ) {

            alert(
                "设备没有发生变化"
            );

            return;

        }


        const conflict =
            validateAdjustmentConflict(
                after,
                adjustmentTaskId
            );


        if (conflict) {

            alert(
                conflict
            );

            return;

        }


        const confirmed =
            confirm(
                "确认保存本次设备调整吗？任务编号和运输趟数不会变化。"
            );


        if (!confirmed) {

            return;

        }


        const tasks =
            getPublishedTasks();


        const task =
            tasks.find(
                function (item) {

                    return (
                        item.taskId ===
                        adjustmentTaskId
                    );

                }
            );


        if (
            !task ||
            ![
                "pending",
                "active"
            ].includes(
                task.status
            )
        ) {

            alert(
                "任务状态已经变化，不能继续调整"
            );

            return;

        }


        const summary =
            buildAdjustmentSummary(
                before,
                after
            );


        task.bindings =
            deepClone(
                after
            );


        if (
            !Array.isArray(
                task.equipmentAdjustments
            )
        ) {

            task.equipmentAdjustments =
                [];

        }


        task.equipmentAdjustments.push({

            adjustmentId:
                "ADJ_" +
                Date.now(),

            time:
                new Date()
                    .toISOString(),

            summary:
                summary,

            beforeBindings:
                deepClone(
                    before
                ),

            afterBindings:
                deepClone(
                    after
                )

        });


        task.lastEquipmentAdjustedAt =
            new Date()
                .toISOString();


        saveTaskArray(
            tasks
        );


        const taskId =
            task.taskId;


        closeAdjustmentModal();

        rebuildEquipmentStatus();

        renderProductionTaskBoard();


        selectedPublishedTaskId =
            taskId;


        openPublishedTask(
            taskId
        );


        alert(
            "设备调整已保存"
        );

    }


    /*
    ========================================================
    历史任务
    ========================================================
    */

    function renderHistoryTaskBoard() {

        const board =
            document.getElementById(
                "historyTaskBoard"
            );


        const dateFilter =
            historyDateFilter.value;


        const shiftFilter =
            historyShiftFilter.value;


        const areaFilter =
            historyAreaFilter.value
                .trim()
                .toLowerCase();


        let tasks =
            getPublishedTasks()
                .filter(
                    function (task) {

                        return (
                            task.status ===
                            "completed"
                        );

                    }
                );


        tasks =
            tasks.filter(
                function (task) {

                    if (
                        dateFilter &&
                        getTaskDateValue(
                            task
                        ) !==
                        dateFilter
                    ) {

                        return false;

                    }


                    if (
                        shiftFilter &&
                        task.shift !==
                        shiftFilter
                    ) {

                        return false;

                    }


                    if (
                        areaFilter &&
                        !String(
                            task.area ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                areaFilter
                            )
                    ) {

                        return false;

                    }


                    return true;

                }
            );


        tasks.sort(
            function (a, b) {

                return (
                    new Date(
                        b.completedAt ||
                        b.publishedAt
                    ) -
                    new Date(
                        a.completedAt ||
                        a.publishedAt
                    )
                );

            }
        );


        setText(
            "historyTaskCount",
            tasks.length +
            " 个已完成任务"
        );


        if (
            tasks.length ===
            0
        ) {

            board.innerHTML =
                '<div class="empty-placeholder">没有符合条件的已完成任务</div>';

            return;

        }


        board.innerHTML =
            "";


        tasks.forEach(
            function (task) {

                const card =
                    createTaskCard(
                        task,
                        true
                    );


                card.addEventListener(
                    "click",
                    function () {

                        openHistoryTask(
                            task.taskId
                        );

                    }
                );


                board.appendChild(
                    card
                );

            }
        );

    }


    function openHistoryTask(
        taskId
    ) {

        const task =
            getPublishedTasks()
                .find(
                    function (item) {

                        return (
                            item.taskId ===
                            taskId &&
                            item.status ===
                            "completed"
                        );

                    }
                );


        if (!task) {

            return;

        }


        const stats =
            getTaskTripStats(
                task.taskId
            );


        setText(
            "historyTaskModalTitle",
            "历史任务 · " +
            task.area +
            " · " +
            task.shift
        );


        document.getElementById(
            "historyTaskModalContent"
        ).innerHTML =
            renderTaskDetailHtml(
                task,
                stats,
                true
            );


        showSection(
            "historyTaskModal"
        );

    }


    /*
    ========================================================
    任务卡片
    ========================================================
    */

    function createTaskCard(
        task,
        historyMode
    ) {

        const stats =
            getTaskTripStats(
                task.taskId
            );


        const effectiveTripCount =
            Math.max(
                stats.count,
                Number(
                    task.transportTripCount ||
                    0
                )
            );


        const excavatorCount =
            Array.isArray(
                task.bindings
            )
                ?
                task.bindings.length
                :
                0;


        const truckCount =
            Array.isArray(
                task.bindings
            )
                ?
                task.bindings.reduce(
                    function (
                        total,
                        binding
                    ) {

                        return (
                            total +
                            (
                                Array.isArray(
                                    binding.truckIds
                                )
                                    ?
                                    binding.truckIds.length
                                    :
                                    0
                            )
                        );

                    },
                    0
                )
                :
                0;


        const auxiliaryCount =
            Array.isArray(
                task.auxiliaryAssignments
            )
                ?
                task.auxiliaryAssignments.length
                :
                0;


        const adjustmentCount =
            Array.isArray(
                task.equipmentAdjustments
            )
                ?
                task.equipmentAdjustments.length
                :
                0;


        const card =
            document.createElement(
                "button"
            );


        card.type =
            "button";


        card.className =
            "production-task-card " +
            (
                historyMode
                    ?
                    "history-task-card"
                    :
                    getTaskCardClass(
                        task.status
                    )
            );


        card.innerHTML = `

            <div class="production-task-card-header">

                <div>

                    <strong class="production-task-area">
                        ${escapeHtml(
                            task.area
                        )}
                    </strong>

                    <span class="production-task-shift">
                        ${escapeHtml(
                            task.shift
                        )}
                    </span>

                </div>


                <span class="production-task-status">

                    ${
                        historyMode
                            ?
                            "已完成"
                            :
                            getTaskStatusText(
                                task.status
                            )
                    }

                </span>

            </div>


            <div class="production-task-date">
                ${escapeHtml(
                    task.date
                )}
            </div>


            <div class="production-task-stat-grid">

                <div>
                    <span>挖机</span>
                    <strong>
                        ${excavatorCount}
                    </strong>
                </div>

                <div>
                    <span>卡车</span>
                    <strong>
                        ${truckCount}
                    </strong>
                </div>

                <div>
                    <span>辅助车辆</span>
                    <strong>
                        ${auxiliaryCount}
                    </strong>
                </div>

                <div class="trip-stat">
                    <span>运输趟数</span>
                    <strong>
                        ${effectiveTripCount}
                    </strong>
                </div>

            </div>


            ${
                adjustmentCount >
                0
                    ?
                    `
                    <div class="task-adjustment-note">
                        🔄 中途设备调整 ${adjustmentCount} 次
                    </div>
                    `
                    :
                    ""
            }


            <div class="production-task-time">

                ${
                    historyMode
                        ?
                        "完成时间："
                        :
                        "发布时间："
                }

                ${
                    formatDateTime(
                        historyMode
                            ?
                            task.completedAt
                            :
                            task.publishedAt
                    )
                }

            </div>

        `;


        return card;

    }


    /*
    ========================================================
    任务详情共用
    ========================================================
    */

    function renderTaskDetailHtml(
        task,
        stats,
        historyMode
    ) {

        const effectiveTripCount =
            Math.max(
                stats.count,
                Number(
                    task.transportTripCount ||
                    0
                )
            );


        let html = `

            <div class="task-detail-status-row">

                <span>
                    当前状态
                </span>

                <strong>
                    ${
                        historyMode
                            ?
                            "已完成"
                            :
                            getTaskStatusText(
                                task.status
                            )
                    }
                </strong>

            </div>


            <div class="transport-stat-box">

                <div>
                    <span>运输总趟数</span>
                    <strong>
                        ${effectiveTripCount}
                    </strong>
                </div>

                <div>
                    <span>第一趟</span>
                    <strong>
                        ${
                            stats.firstTime
                                ?
                                formatDateTime(
                                    stats.firstTime
                                )
                                :
                                "-"
                        }
                    </strong>
                </div>

                <div>
                    <span>最后一趟</span>
                    <strong>
                        ${
                            stats.lastTime
                                ?
                                formatDateTime(
                                    stats.lastTime
                                )
                                :
                                "-"
                        }
                    </strong>
                </div>

            </div>


            <div class="modal-detail-row">
                <span>任务编号</span>
                <strong>
                    ${escapeHtml(
                        task.taskId
                    )}
                </strong>
            </div>


            <div class="modal-detail-row">
                <span>日期</span>
                <strong>
                    ${escapeHtml(
                        task.date
                    )}
                </strong>
            </div>


            <div class="modal-detail-row">
                <span>班次</span>
                <strong>
                    ${escapeHtml(
                        task.shift
                    )}
                </strong>
            </div>


            <div class="modal-detail-row">
                <span>作业区域</span>
                <strong>
                    ${escapeHtml(
                        task.area
                    )}
                </strong>
            </div>


            <div class="modal-detail-row">
                <span>发布时间</span>
                <strong>
                    ${formatDateTime(
                        task.publishedAt
                    )}
                </strong>
            </div>

        `;


        if (historyMode) {

            html += `

                <div class="modal-detail-row">
                    <span>完成时间</span>
                    <strong>
                        ${formatDateTime(
                            task.completedAt
                        )}
                    </strong>
                </div>

            `;

        }


        html += `

            <div class="published-detail-block">

                <h4>
                    🚜 挖机及跟随卡车
                </h4>

                ${
                    renderBindingsHtml(
                        task.bindings ||
                        [],
                        task.taskId
                    )
                }

            </div>


            <div class="published-detail-block">

                <h4>
                    🚧 辅助车辆
                </h4>

                ${
                    renderAuxiliaryHtml(
                        task.auxiliaryAssignments ||
                        []
                    )
                }

            </div>


            <div class="published-detail-block">

                <h4>
                    调度说明
                </h4>

                <p>
                    ${escapeHtml(
                        task.remark ||
                        "无"
                    )}
                </p>

            </div>

        `;


        if (
            Array.isArray(
                task.equipmentAdjustments
            ) &&
            task.equipmentAdjustments.length >
            0
        ) {

            html += `

                <div class="published-detail-block">

                    <h4>
                        🔄 中途设备调整记录
                    </h4>

                    <div class="adjustment-history-list">

            `;


            [
                ...task.equipmentAdjustments
            ]
                .reverse()
                .forEach(
                    function (record) {

                        html += `

                            <div class="adjustment-history-row">

                                <strong>
                                    ${formatDateTime(
                                        record.time
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        record.summary
                                    )}
                                </span>

                            </div>

                        `;

                    }
                );


            html += `

                    </div>

                </div>

            `;

        }


        return html;

    }


    function renderBindingsHtml(
        taskBindings,
        taskId
    ) {

        if (
            !Array.isArray(
                taskBindings
            ) ||
            taskBindings.length ===
            0
        ) {

            return "<p>未配置主采设备</p>";

        }


        return taskBindings
            .map(
                function (binding) {

                    const trucks =
                        (
                            binding.truckIds ||
                            []
                        )
                            .map(
                                function (truckId) {

                                    let extra =
                                        "";


                                    if (taskId) {

                                        extra =
                                            " · " +
                                            getTruckTaskTripCount(
                                                taskId,
                                                truckId
                                            ) +
                                            " 趟";

                                    }


                                    return `

                                        <span>
                                            🚚
                                            ${escapeHtml(
                                                truckId
                                            )}
                                            ${extra}
                                        </span>

                                    `;

                                }
                            )
                            .join("");


                    return `

                        <div class="published-binding">

                            <strong>
                                🚜
                                ${escapeHtml(
                                    binding.excavatorId
                                )}
                            </strong>

                            <div class="published-truck-list">
                                ${
                                    trucks ||
                                    "<span>暂无卡车</span>"
                                }
                            </div>

                        </div>

                    `;

                }
            )
            .join("");

    }


    function renderAuxiliaryHtml(
        assignments
    ) {

        if (
            !Array.isArray(
                assignments
            ) ||
            assignments.length ===
            0
        ) {

            return "<p>未配置辅助车辆</p>";

        }


        return assignments
            .map(
                function (item) {

                    return `

                        <div class="published-aux-row">

                            <strong>
                                ${escapeHtml(
                                    item.typeName ||
                                    getTypeName(
                                        item.type
                                    )
                                )}
                                ·
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

                    `;

                }
            )
            .join("");

    }


    /*
    ========================================================
    设备状态
    ========================================================
    */

    function rebuildEquipmentStatus() {

        equipment.forEach(
            function (device) {

                if (
                    device.baseStatus ===
                    "maintenance"
                ) {

                    device.status =
                        "maintenance";

                }

                else {

                    device.status =
                        "available";

                    delete device.assignedTask;

                }

            }
        );


        getPublishedTasks()
            .filter(
                function (task) {

                    return (
                        task.status ===
                        "pending" ||
                        task.status ===
                        "active"
                    );

                }
            )
            .forEach(
                function (task) {

                    (
                        task.bindings ||
                        []
                    ).forEach(
                        function (binding) {

                            assignDeviceToTask(
                                binding.excavatorId,
                                task,
                                "采装作业"
                            );


                            (
                                binding.truckIds ||
                                []
                            ).forEach(
                                function (truckId) {

                                    assignDeviceToTask(
                                        truckId,
                                        task,
                                        "跟随 " +
                                        binding.excavatorId
                                    );

                                }
                            );

                        }
                    );


                    (
                        task.auxiliaryAssignments ||
                        []
                    ).forEach(
                        function (item) {

                            assignDeviceToTask(
                                item.vehicleId,
                                task,
                                item.work
                            );

                        }
                    );

                }
            );

    }


    function assignDeviceToTask(
        deviceId,
        task,
        work
    ) {

        const device =
            findDevice(
                deviceId
            );


        if (
            !device ||
            device.baseStatus ===
            "maintenance"
        ) {

            return;

        }


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
                work

        };

    }


    function getDraftDeviceState(
        device
    ) {

        if (
            device.status ===
            "maintenance"
        ) {

            return {
                text:
                    "维修中",
                className:
                    "device-maintenance"
            };

        }


        if (
            device.status ===
            "assigned"
        ) {

            return {
                text:
                    "已分配",
                className:
                    "device-assigned"
            };

        }


        if (
            isDeviceInDraft(
                device.id
            )
        ) {

            return {
                text:
                    "本任务已选",
                className:
                    "device-draft"
            };

        }


        return {
            text:
                "可调配",
            className:
                "device-available"
        };

    }


    function isDeviceInDraft(
        deviceId
    ) {

        const inMain =
            bindings.some(
                function (binding) {

                    return (
                        binding.excavatorId ===
                        deviceId ||
                        (
                            binding.truckIds ||
                            []
                        ).includes(
                            deviceId
                        )
                    );

                }
            );


        const inAux =
            auxiliaryAssignments.some(
                function (item) {

                    return (
                        item.vehicleId ===
                        deviceId
                    );

                }
            );


        return (
            inMain ||
            inAux
        );

    }


    /*
    ========================================================
    设备弹窗
    ========================================================
    */

    function createDeviceCard(
        device,
        state
    ) {

        const card =
            document.createElement(
                "button"
            );


        card.type =
            "button";


        card.className =
            "device-card " +
            state.className;


        card.innerHTML = `

            <strong class="device-number">
                ${escapeHtml(
                    device.id
                )}
            </strong>

            <span class="device-status">
                ${escapeHtml(
                    state.text
                )}
            </span>

        `;


        return card;

    }


    function showMaintenanceModal(
        device
    ) {

        const maintenance =
            device.maintenance ||
            {};


        setText(
            "modalTitle",
            device.id +
            " · 维修状态"
        );


        document.getElementById(
            "modalContent"
        ).innerHTML =

            detailRow(
                "设备类型",
                getTypeName(
                    device.type
                )
            ) +

            detailRow(
                "故障内容",
                maintenance.fault ||
                "未填写"
            ) +

            detailRow(
                "维修开始",
                maintenance.startedAt ||
                "-"
            ) +

            detailRow(
                "预计结束",
                maintenance.expectedEnd ||
                "-"
            ) +

            detailRow(
                "维修负责人",
                maintenance.responsible ||
                "-"
            );


        showSection(
            "deviceModal"
        );

    }


    function showAssignedModal(
        device
    ) {

        const task =
            device.assignedTask ||
            {};


        setText(
            "modalTitle",
            device.id +
            " · 当前任务"
        );


        document.getElementById(
            "modalContent"
        ).innerHTML =

            detailRow(
                "设备类型",
                getTypeName(
                    device.type
                )
            ) +

            detailRow(
                "作业区域",
                task.area ||
                "-"
            ) +

            detailRow(
                "班次",
                task.shift ||
                "-"
            ) +

            detailRow(
                "工作内容",
                task.work ||
                "-"
            );


        showSection(
            "deviceModal"
        );

    }


    function detailRow(
        name,
        value
    ) {

        return `

            <div class="modal-detail-row">

                <span>
                    ${escapeHtml(
                        name
                    )}
                </span>

                <strong>
                    ${escapeHtml(
                        value
                    )}
                </strong>

            </div>

        `;

    }


    /*
    ========================================================
    调整设备帮助函数
    ========================================================
    */

    function createAdjustDeviceButton(
        number,
        status,
        blocked
    ) {

        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";


        button.className =
            "adjust-device-button";


        if (blocked) {

            button.classList.add(
                "blocked"
            );

        }


        button.innerHTML = `

            <strong>
                ${escapeHtml(
                    number
                )}
            </strong>

            <span>
                ${escapeHtml(
                    status
                )}
            </span>

        `;


        return button;

    }


    function getAdjustExcavatorText(
        device,
        inDraft,
        otherTaskUsed
    ) {

        if (
            device.status ===
            "maintenance"
        ) {

            return "维修中";

        }


        if (
            otherTaskUsed.has(
                device.id
            )
        ) {

            return "其他任务占用";

        }


        if (
            adjustmentEditingExcavatorId ===
            device.id
        ) {

            return "正在调整";

        }


        if (inDraft) {

            return "已在本任务";

        }


        return "可增加";

    }


    function getOtherTaskUsedEquipment(
        currentTaskId
    ) {

        const used =
            new Set();


        getPublishedTasks()
            .filter(
                function (task) {

                    return (
                        task.taskId !==
                        currentTaskId &&
                        (
                            task.status ===
                            "pending" ||
                            task.status ===
                            "active"
                        )
                    );

                }
            )
            .forEach(
                function (task) {

                    (
                        task.bindings ||
                        []
                    ).forEach(
                        function (binding) {

                            used.add(
                                binding.excavatorId
                            );


                            (
                                binding.truckIds ||
                                []
                            ).forEach(
                                function (truckId) {

                                    used.add(
                                        truckId
                                    );

                                }
                            );

                        }
                    );


                    (
                        task.auxiliaryAssignments ||
                        []
                    ).forEach(
                        function (item) {

                            used.add(
                                item.vehicleId
                            );

                        }
                    );

                }
            );


        return used;

    }


    function validateAdjustmentConflict(
        newBindings,
        taskId
    ) {

        const otherTaskUsed =
            getOtherTaskUsedEquipment(
                taskId
            );


        const used =
            new Set();


        for (
            const binding
            of newBindings
        ) {

            if (
                otherTaskUsed.has(
                    binding.excavatorId
                )
            ) {

                return (
                    binding.excavatorId +
                    " 已被其他任务占用"
                );

            }


            const excavator =
                findDevice(
                    binding.excavatorId
                );


            if (
                excavator &&
                excavator.baseStatus ===
                "maintenance"
            ) {

                return (
                    binding.excavatorId +
                    " 正在维修"
                );

            }


            if (
                used.has(
                    binding.excavatorId
                )
            ) {

                return (
                    binding.excavatorId +
                    " 重复使用"
                );

            }


            used.add(
                binding.excavatorId
            );


            for (
                const truckId
                of (
                    binding.truckIds ||
                    []
                )
            ) {

                if (
                    otherTaskUsed.has(
                        truckId
                    )
                ) {

                    return (
                        truckId +
                        " 已被其他任务占用"
                    );

                }


                const truck =
                    findDevice(
                        truckId
                    );


                if (
                    truck &&
                    truck.baseStatus ===
                    "maintenance"
                ) {

                    return (
                        truckId +
                        " 正在维修"
                    );

                }


                if (
                    used.has(
                        truckId
                    )
                ) {

                    return (
                        truckId +
                        " 被重复分配"
                    );

                }


                used.add(
                    truckId
                );

            }

        }


        return "";

    }


    function buildAdjustmentSummary(
        before,
        after
    ) {

        const beforeMap =
            new Map();


        const afterMap =
            new Map();


        before.forEach(
            function (binding) {

                beforeMap.set(
                    binding.excavatorId,
                    binding.truckIds ||
                    []
                );

            }
        );


        after.forEach(
            function (binding) {

                afterMap.set(
                    binding.excavatorId,
                    binding.truckIds ||
                    []
                );

            }
        );


        const result =
            [];


        const addedExcavators =
            [
                ...afterMap.keys()
            ].filter(
                function (id) {

                    return (
                        !beforeMap.has(
                            id
                        )
                    );

                }
            );


        const removedExcavators =
            [
                ...beforeMap.keys()
            ].filter(
                function (id) {

                    return (
                        !afterMap.has(
                            id
                        )
                    );

                }
            );


        if (
            addedExcavators.length
        ) {

            result.push(
                "增加挖机 " +
                addedExcavators.join(
                    "、"
                )
            );

        }


        if (
            removedExcavators.length
        ) {

            result.push(
                "减少挖机 " +
                removedExcavators.join(
                    "、"
                )
            );

        }


        [
            ...afterMap.keys()
        ]
            .filter(
                function (id) {

                    return (
                        beforeMap.has(
                            id
                        )
                    );

                }
            )
            .forEach(
                function (id) {

                    const oldTrucks =
                        new Set(
                            beforeMap.get(
                                id
                            )
                        );


                    const newTrucks =
                        new Set(
                            afterMap.get(
                                id
                            )
                        );


                    const added =
                        [
                            ...newTrucks
                        ].filter(
                            function (truckId) {

                                return (
                                    !oldTrucks.has(
                                        truckId
                                    )
                                );

                            }
                        );


                    const removed =
                        [
                            ...oldTrucks
                        ].filter(
                            function (truckId) {

                                return (
                                    !newTrucks.has(
                                        truckId
                                    )
                                );

                            }
                        );


                    if (
                        added.length
                    ) {

                        result.push(
                            id +
                            " 增加卡车 " +
                            added.join(
                                "、"
                            )
                        );

                    }


                    if (
                        removed.length
                    ) {

                        result.push(
                            id +
                            " 减少卡车 " +
                            removed.join(
                                "、"
                            )
                        );

                    }

                }
            );


        return (
            result.join(
                "；"
            ) ||
            "设备配置调整"
        );

    }


    /*
    ========================================================
    发布冲突
    ========================================================
    */

    function validatePublishConflict() {

        const occupied =
            getOtherTaskUsedEquipment(
                null
            );


        const used =
            new Set();


        for (
            const binding
            of bindings
        ) {

            const ids = [
                binding.excavatorId,
                ...(
                    binding.truckIds ||
                    []
                )
            ];


            for (
                const id
                of ids
            ) {

                const device =
                    findDevice(
                        id
                    );


                if (
                    device &&
                    device.baseStatus ===
                    "maintenance"
                ) {

                    return (
                        id +
                        " 正在维修，不能发布任务"
                    );

                }


                if (
                    occupied.has(
                        id
                    )
                ) {

                    return (
                        id +
                        " 已被其他任务占用"
                    );

                }


                if (
                    used.has(
                        id
                    )
                ) {

                    return (
                        id +
                        " 被重复分配"
                    );

                }


                used.add(
                    id
                );

            }

        }


        for (
            const item
            of auxiliaryAssignments
        ) {

            if (
                occupied.has(
                    item.vehicleId
                )
            ) {

                return (
                    item.vehicleId +
                    " 已被其他任务占用"
                );

            }

        }


        return "";

    }


    /*
    ========================================================
    数据迁移和任务状态
    ========================================================
    */

    function migrateLegacyWithdrawnTasks() {

        const tasks =
            getPublishedTasks();


        const remaining =
            tasks.filter(
                function (task) {

                    return (
                        task.status !==
                        "withdrawn"
                    );

                }
            );


        if (
            remaining.length !==
            tasks.length
        ) {

            saveTaskArray(
                remaining
            );

        }

    }


    function migrateOldTaskStatuses() {

        const tasks =
            getPublishedTasks();


        let changed =
            false;


        tasks.forEach(
            function (task) {

                if (
                    task.status ===
                    "active"
                ) {

                    const stats =
                        getTaskTripStats(
                            task.taskId
                        );


                    if (
                        stats.count ===
                        0
                    ) {

                        task.status =
                            "pending";

                        delete task.startedAt;

                        changed =
                            true;

                    }

                }

            }
        );


        if (changed) {

            saveTaskArray(
                tasks
            );

        }

    }


    function syncPublishedTaskExecutionStatus() {

        const tasks =
            getPublishedTasks();


        let changed =
            false;


        tasks.forEach(
            function (task) {

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


                if (
                    stats.count >
                    0
                ) {

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

            }
        );


        if (changed) {

            saveTaskArray(
                tasks
            );

            rebuildEquipmentStatus();

        }

    }


    /*
    ========================================================
    运输记录
    ========================================================
    */

    function getTaskTripRecords(
        taskId
    ) {

        let records =
            [];


        try {

            records =
                JSON.parse(

                    localStorage.getItem(
                        TRIP_STORAGE
                    ) ||
                    "[]"

                );

        }

        catch (error) {

            records =
                [];

        }


        if (
            !Array.isArray(
                records
            )
        ) {

            records =
                [];

        }


        return records.filter(
            function (record) {

                if (!record) {

                    return false;

                }


                const id =
                    record.taskId ||
                    record.dispatchTaskId ||
                    (
                        record.task &&
                        record.task.taskId
                    ) ||
                    "";


                return (
                    String(
                        id
                    ) ===
                    String(
                        taskId
                    )
                );

            }
        );

    }


    function getTaskTripStats(
        taskId
    ) {

        const records =
            getTaskTripRecords(
                taskId
            );


        const times =
            records
                .map(
                    function (record) {

                        return (
                            record.completedAt ||
                            record.endTime ||
                            record.finishedAt ||
                            record.createdAt ||
                            record.time ||
                            null
                        );

                    }
                )
                .filter(
                    Boolean
                )
                .map(
                    function (value) {

                        return new Date(
                            value
                        );

                    }
                )
                .filter(
                    function (date) {

                        return (
                            !Number.isNaN(
                                date.getTime()
                            )
                        );

                    }
                )
                .sort(
                    function (a, b) {

                        return (
                            a.getTime() -
                            b.getTime()
                        );

                    }
                );


        return {

            count:
                records.length,

            firstTime:
                times.length
                    ?
                    times[0]
                        .toISOString()
                    :
                    null,

            lastTime:
                times.length
                    ?
                    times[
                        times.length - 1
                    ]
                        .toISOString()
                    :
                    null

        };

    }


    function getTruckTaskTripCount(
        taskId,
        truckId
    ) {

        return getTaskTripRecords(
            taskId
        )
            .filter(
                function (record) {

                    const vehicle =
                        record.vehicleNumber ||
                        record.vehicleId ||
                        record.truckId ||
                        record.vehicle ||
                        "";


                    return (
                        String(
                            vehicle
                        ) ===
                        String(
                            truckId
                        )
                    );

                }
            )
            .length;

    }


    /*
    ========================================================
    localStorage
    ========================================================
    */

    function getPublishedTasks() {

        let tasks =
            [];


        try {

            tasks =
                JSON.parse(

                    localStorage.getItem(
                        TASK_STORAGE
                    ) ||
                    "[]"

                );

        }

        catch (error) {

            tasks =
                [];

        }


        return (
            Array.isArray(
                tasks
            )
                ?
                tasks
                :
                []
        );

    }


    function saveTaskArray(
        tasks
    ) {

        localStorage.setItem(
            TASK_STORAGE,
            JSON.stringify(
                tasks
            )
        );

    }


    function savePublishedTask(
        task
    ) {

        const tasks =
            getPublishedTasks();


        tasks.push(
            task
        );


        saveTaskArray(
            tasks
        );


        localStorage.setItem(
            LATEST_TASK_STORAGE,
            JSON.stringify(
                task
            )
        );

    }


    function clearLatestTaskIfMatch(
        taskId
    ) {

        try {

            const latest =
                JSON.parse(

                    localStorage.getItem(
                        LATEST_TASK_STORAGE
                    ) ||
                    "null"

                );


            if (
                latest &&
                String(
                    latest.taskId
                ) ===
                String(
                    taskId
                )
            ) {

                localStorage.removeItem(
                    LATEST_TASK_STORAGE
                );

            }

        }

        catch (error) {

            return;

        }

    }


    /*
    ========================================================
    设备数据
    ========================================================
    */

    function createEquipmentData() {

        const list = [

            createDevice(
                "EX-01",
                "excavator"
            ),

            createDevice(
                "EX-02",
                "excavator"
            ),

            createMaintenanceDevice(
                "EX-03",
                "excavator",
                "液压系统检查",
                "08:20",
                "12:00"
            ),

            createDevice(
                "EX-04",
                "excavator"
            ),

            createDevice(
                "EX-05",
                "excavator"
            ),

            createDevice(
                "EX-06",
                "excavator"
            )

        ];


        for (
            let i = 1;
            i <= 20;
            i++
        ) {

            const id =
                "T-" +
                String(
                    i
                ).padStart(
                    3,
                    "0"
                );


            if (
                i === 5
            ) {

                list.push(
                    createMaintenanceDevice(
                        id,
                        "truck",
                        "轮胎维修",
                        "08:00",
                        "14:00"
                    )
                );

            }

            else if (
                i === 12
            ) {

                list.push(
                    createMaintenanceDevice(
                        id,
                        "truck",
                        "发动机检查",
                        "08:00",
                        "14:00"
                    )
                );

            }

            else {

                list.push(
                    createDevice(
                        id,
                        "truck"
                    )
                );

            }

        }


        [
            [
                "L-01",
                "loader"
            ],
            [
                "L-02",
                "loader"
            ],
            [
                "L-03",
                "loader"
            ],
            [
                "W-01",
                "water"
            ],
            [
                "W-03",
                "water"
            ],
            [
                "F-01",
                "fuel"
            ],
            [
                "F-02",
                "fuel"
            ],
            [
                "G-01",
                "grader"
            ],
            [
                "D-01",
                "dozer"
            ],
            [
                "D-02",
                "dozer"
            ],
            [
                "B-01",
                "bus"
            ],
            [
                "B-02",
                "bus"
            ]
        ].forEach(
            function (item) {

                list.push(
                    createDevice(
                        item[0],
                        item[1]
                    )
                );

            }
        );


        list.push(
            createMaintenanceDevice(
                "L-04",
                "loader",
                "轮胎维修",
                "07:40",
                "11:30"
            )
        );


        list.push(
            createMaintenanceDevice(
                "W-02",
                "water",
                "水泵故障",
                "06:50",
                "13:00"
            )
        );


        list.push(
            createMaintenanceDevice(
                "G-02",
                "grader",
                "刀板维修",
                "09:00",
                "15:00"
            )
        );


        return list;

    }


    function createDevice(
        id,
        type
    ) {

        return {

            id:
                id,

            type:
                type,

            baseStatus:
                "available",

            status:
                "available"

        };

    }


    function createMaintenanceDevice(
        id,
        type,
        fault,
        startedAt,
        expectedEnd
    ) {

        return {

            id:
                id,

            type:
                type,

            baseStatus:
                "maintenance",

            status:
                "maintenance",

            maintenance: {

                fault:
                    fault,

                startedAt:
                    startedAt,

                expectedEnd:
                    expectedEnd,

                responsible:
                    "维修组"

            }

        };

    }


    function findDevice(
        id
    ) {

        return equipment.find(
            function (device) {

                return (
                    device.id ===
                    id
                );

            }
        );

    }


    /*
    ========================================================
    任务辅助函数
    ========================================================
    */

    function normalizeBindings(
        source
    ) {

        return deepClone(
            source ||
            []
        )
            .map(
                function (binding) {

                    return {

                        excavatorId:
                            binding.excavatorId,

                        truckIds:
                            [
                                ...new Set(
                                    binding.truckIds ||
                                    []
                                )
                            ].sort()

                    };

                }
            )
            .sort(
                function (a, b) {

                    return a.excavatorId
                        .localeCompare(
                            b.excavatorId
                        );

                }
            );

    }


    function toggleArrayValue(
        array,
        value
    ) {

        const index =
            array.indexOf(
                value
            );


        if (
            index >=
            0
        ) {

            array.splice(
                index,
                1
            );

        }

        else {

            array.push(
                value
            );

        }

    }


    function sortTasksNewestFirst(
        a,
        b
    ) {

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


    function getTaskDateValue(
        task
    ) {

        const values = [

            task.date,

            task.publishedAt,

            task.createdAt

        ];


        for (
            const value
            of values
        ) {

            if (!value) {

                continue;

            }


            const date =
                new Date(
                    value
                );


            if (
                !Number.isNaN(
                    date.getTime()
                )
            ) {

                return (

                    date.getFullYear() +
                    "-" +
                    String(
                        date.getMonth() +
                        1
                    ).padStart(
                        2,
                        "0"
                    ) +
                    "-" +
                    String(
                        date.getDate()
                    ).padStart(
                        2,
                        "0"
                    )

                );

            }

        }


        return "";

    }


    function getTaskStatusText(
        status
    ) {

        const map = {

            pending:
                "待执行",

            active:
                "执行中",

            completed:
                "已完成"

        };


        return (
            map[
                status
            ] ||
            "未知"
        );

    }


    function getTaskCardClass(
        status
    ) {

        if (
            status ===
            "pending"
        ) {

            return "task-pending-card";

        }


        if (
            status ===
            "active"
        ) {

            return "task-active-card";

        }


        return "";

    }


    function getTypeName(
        type
    ) {

        const map = {

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

        };


        return (
            map[
                type
            ] ||
            "其他车辆"
        );

    }


    function getWorkOptions(
        type
    ) {

        if (
            type ===
            "loader"
        ) {

            return [

                {
                    value:
                        "日常作业",
                    label:
                        "日常作业"
                },

                {
                    value:
                        "清理挖机附近散料",
                    label:
                        "清理挖机附近散料"
                },

                {
                    value:
                        "修整运输道路",
                    label:
                        "修整运输道路"
                },

                {
                    value:
                        "装煤",
                    label:
                        "装煤"
                },

                {
                    value:
                        "排土场作业",
                    label:
                        "排土场作业"
                },

                {
                    value:
                        "manual",
                    label:
                        "手动录入"
                }

            ];

        }


        if (
            type ===
            "water"
        ) {

            return [

                {
                    value:
                        "日常洒水",
                    label:
                        "日常洒水"
                },

                {
                    value:
                        "运输道路洒水",
                    label:
                        "运输道路洒水"
                },

                {
                    value:
                        "采区洒水",
                    label:
                        "采区洒水"
                },

                {
                    value:
                        "排土场洒水",
                    label:
                        "排土场洒水"
                },

                {
                    value:
                        "临时调配",
                    label:
                        "临时调配"
                },

                {
                    value:
                        "manual",
                    label:
                        "手动录入"
                }

            ];

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


    /*
    ========================================================
    通用
    ========================================================
    */

    function getDefaultShift() {

        const hour =
            new Date()
                .getHours();


        return (
            hour >=
            8 &&
            hour <
            20
        )
            ?
            "白班"
            :
            "夜班";

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


    function getValue(
        id
    ) {

        const element =
            document.getElementById(
                id
            );


        return element
            ?
            String(
                element.value ||
                ""
            ).trim()
            :
            "";

    }


    function setValue(
        id,
        value
    ) {

        const element =
            document.getElementById(
                id
            );


        if (element) {

            element.value =
                value ||
                "";

        }

    }


    function setText(
        id,
        value
    ) {

        const element =
            document.getElementById(
                id
            );


        if (element) {

            element.textContent =
                value;

        }

    }


    function showSection(
        id
    ) {

        const element =
            document.getElementById(
                id
            );


        if (element) {

            element.classList.remove(
                "hidden"
            );

        }

    }


    function hideSection(
        id
    ) {

        const element =
            document.getElementById(
                id
            );


        if (element) {

            element.classList.add(
                "hidden"
            );

        }

    }


    function scrollToId(
        id
    ) {

        const element =
            document.getElementById(
                id
            );


        if (!element) {

            return;

        }


        setTimeout(
            function () {

                element.scrollIntoView({

                    behavior:
                        "smooth",

                    block:
                        "start"

                });

            },
            50
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
                value ??
                ""
            );


        return div.innerHTML;

    }


    function deepClone(
        value
    ) {

        return JSON.parse(
            JSON.stringify(
                value
            )
        );

    }

});
