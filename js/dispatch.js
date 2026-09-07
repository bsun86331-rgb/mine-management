/*
========================================================
矿山管理系统
生产调度端
dispatch.js V2.4.1
任务撤回 + 运输执行判定 + 旧任务状态兼容修正版
========================================================
*/

document.addEventListener("DOMContentLoaded", function () {

    let currentTask = null;
    let selectedExcavatorId = null;
    let selectedTruckIds = [];
    let bindings = [];
    let auxiliaryAssignments = [];
    let selectedAuxDeviceId = null;
    let selectedPublishedTaskId = null;

    /*
    ========================================================
    模拟设备资料
    后期改由管理员端设备基础资料维护
    ========================================================
    */

    let equipment = [
        {
            id: "EX-01",
            type: "excavator",
            status: "available"
        },
        {
            id: "EX-02",
            type: "excavator",
            status: "available"
        },
        {
            id: "EX-03",
            type: "excavator",
            status: "maintenance",
            maintenance: {
                fault: "液压系统检查",
                startedAt: "08:20",
                expectedEnd: "12:00",
                responsible: "维修组"
            }
        },
        {
            id: "EX-04",
            type: "excavator",
            status: "available"
        },
        {
            id: "EX-05",
            type: "excavator",
            status: "available"
        },
        {
            id: "EX-06",
            type: "excavator",
            status: "available"
        },

        ...createTruckData(),

        {
            id: "L-01",
            type: "loader",
            status: "available"
        },
        {
            id: "L-02",
            type: "loader",
            status: "available"
        },
        {
            id: "L-03",
            type: "loader",
            status: "available"
        },
        {
            id: "L-04",
            type: "loader",
            status: "maintenance",
            maintenance: {
                fault: "轮胎维修",
                startedAt: "07:40",
                expectedEnd: "11:30",
                responsible: "维修组"
            }
        },

        {
            id: "W-01",
            type: "water",
            status: "available"
        },
        {
            id: "W-02",
            type: "water",
            status: "maintenance",
            maintenance: {
                fault: "水泵故障",
                startedAt: "06:50",
                expectedEnd: "13:00",
                responsible: "维修组"
            }
        },
        {
            id: "W-03",
            type: "water",
            status: "available"
        },

        {
            id: "F-01",
            type: "fuel",
            status: "available"
        },
        {
            id: "F-02",
            type: "fuel",
            status: "available"
        },

        {
            id: "G-01",
            type: "grader",
            status: "available"
        },
        {
            id: "G-02",
            type: "grader",
            status: "maintenance",
            maintenance: {
                fault: "刀板维修",
                startedAt: "09:00",
                expectedEnd: "15:00",
                responsible: "维修组"
            }
        },

        {
            id: "D-01",
            type: "dozer",
            status: "available"
        },
        {
            id: "D-02",
            type: "dozer",
            status: "available"
        },

        {
            id: "B-01",
            type: "bus",
            status: "available"
        },
        {
            id: "B-02",
            type: "bus",
            status: "available"
        }
    ];


    /*
    ========================================================
    DOM
    ========================================================
    */

    const newTaskButton =
        document.getElementById("newTaskButton");

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

    const completePublishedTaskButton =
        document.getElementById("completePublishedTaskButton");

    const withdrawPublishedTaskButton =
        document.getElementById("withdrawPublishedTaskButton");


    /*
    ========================================================
    初始化
    ========================================================
    */

    document.getElementById("taskShift").value =
        getDefaultShift();

    migrateOldTaskStatuses();

    syncPublishedTaskExecutionStatus();

    restoreEquipmentStatusFromPublishedTasks();

    renderProductionTaskBoard();


    /*
    ========================================================
    创建任务
    ========================================================
    */

    newTaskButton.addEventListener("click", function () {

        document.getElementById("taskShift").value =
            getDefaultShift();

        showSection("taskCreateSection");

        scrollToId("taskCreateSection");
    });


    cancelCreateButton.addEventListener("click", function () {

        hideSection("taskCreateSection");
    });


    generateTaskButton.addEventListener("click", function () {

        const shift =
            getValue("taskShift");

        const area =
            getValue("taskArea");

        const remark =
            getValue("taskRemark");


        if (!area) {

            alert("请输入作业区域");

            return;
        }


        currentTask = {
            taskId: "TASK_" + Date.now(),
            date: new Date().toLocaleDateString("zh-CN"),
            shift: shift,
            area: area,
            remark: remark,
            status: "configuring",
            createdAt: new Date().toISOString()
        };


        selectedExcavatorId = null;
        selectedTruckIds = [];
        bindings = [];
        auxiliaryAssignments = [];


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
            currentTask.remark || "无"
        );

        setText(
            "taskStateBadge",
            "配置中"
        );


        hideSection("taskCreateSection");

        showTaskBoards();

        renderAll();

        scrollToId("excavatorSection");
    });


    /*
    ========================================================
    挖机 + 卡车绑定
    ========================================================
    */

    bindTrucksButton.addEventListener("click", function () {

        if (!selectedExcavatorId) {

            alert("请先选择一台挖机");

            return;
        }


        if (selectedTruckIds.length === 0) {

            alert("请选择至少一台跟随卡车");

            return;
        }


        const excavatorId =
            selectedExcavatorId;

        const trucks =
            [...selectedTruckIds];


        bindings.push({
            excavatorId: excavatorId,
            truckIds: trucks
        });


        const excavator =
            findDevice(excavatorId);


        if (excavator) {

            excavator.status =
                "assigned";

            excavator.assignedTask = {
                taskId: currentTask.taskId,
                area: currentTask.area,
                shift: currentTask.shift,
                work: "采装作业"
            };
        }


        trucks.forEach(function (truckId) {

            const truck =
                findDevice(truckId);


            if (truck) {

                truck.status =
                    "assigned";

                truck.assignedTask = {
                    taskId: currentTask.taskId,
                    area: currentTask.area,
                    shift: currentTask.shift,
                    work: "跟随 " + excavatorId,
                    excavatorId: excavatorId
                };
            }
        });


        selectedExcavatorId =
            null;

        selectedTruckIds =
            [];


        renderAll();


        alert(
            excavatorId +
            " 已绑定 " +
            trucks.length +
            " 台卡车"
        );
    });


    /*
    ========================================================
    辅助车辆任务
    ========================================================
    */

    auxWorkType.addEventListener("change", function () {

        if (this.value === "manual") {

            showSection("auxManualWorkBox");
        }

        else {

            hideSection("auxManualWorkBox");

            setValue(
                "auxManualWork",
                ""
            );
        }
    });


    cancelAuxTaskButton.addEventListener("click", function () {

        selectedAuxDeviceId =
            null;

        hideSection("auxTaskModal");
    });


    confirmAuxTaskButton.addEventListener("click", function () {

        if (!selectedAuxDeviceId) {

            return;
        }


        const device =
            findDevice(selectedAuxDeviceId);


        if (!device) {

            return;
        }


        let work =
            auxWorkType.value;


        if (work === "manual") {

            work =
                getValue("auxManualWork");


            if (!work) {

                alert("请输入具体工作内容");

                return;
            }
        }


        const remark =
            getValue("auxTaskRemark");


        auxiliaryAssignments.push({
            assignmentId: "AUX_" + Date.now(),
            vehicleId: device.id,
            type: device.type,
            typeName: getTypeName(device.type),
            work: work,
            remark: remark,
            area: currentTask.area,
            shift: currentTask.shift,
            taskId: currentTask.taskId,
            assignedAt: new Date().toISOString()
        });


        device.status =
            "assigned";


        device.assignedTask = {
            taskId: currentTask.taskId,
            area: currentTask.area,
            shift: currentTask.shift,
            work: work,
            remark: remark
        };


        selectedAuxDeviceId =
            null;


        hideSection("auxTaskModal");

        renderAll();


        alert(
            device.id +
            " 任务下发成功"
        );
    });


    /*
    ========================================================
    发布预览
    ========================================================
    */

    previewTaskButton.addEventListener("click", function () {

        if (!currentTask) {

            return;
        }


        renderTaskPreview();

        showSection("previewSection");

        scrollToId("previewSection");
    });


    backEditButton.addEventListener("click", function () {

        hideSection("previewSection");
    });


    /*
    ========================================================
    正式发布
    ========================================================
    */

    publishTaskButton.addEventListener("click", function () {

        if (!currentTask) {

            return;
        }


        const confirmed =
            confirm(
                "确认发布当前生产任务吗？发布后状态为“待执行”，产生运输前可以撤回。"
            );


        if (!confirmed) {

            return;
        }


        currentTask.status =
            "pending";

        currentTask.publishedAt =
            new Date().toISOString();


        const publishedTask = {
            ...currentTask,

            bindings:
                JSON.parse(
                    JSON.stringify(bindings)
                ),

            auxiliaryAssignments:
                JSON.parse(
                    JSON.stringify(
                        auxiliaryAssignments
                    )
                ),

            transportTripCount: 0
        };


        savePublishedTask(
            publishedTask
        );


        hideCurrentConfigurationSections();


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


        renderProductionTaskBoard();


        alert(
            "生产任务发布成功，当前状态为“待执行”。"
        );


        scrollToId(
            "productionTaskBoardSection"
        );
    });


    /*
    ========================================================
    普通设备弹窗
    ========================================================
    */

    closeModalButton.addEventListener("click", function () {

        hideSection("deviceModal");
    });


    /*
    ========================================================
    任务详情弹窗
    ========================================================
    */

    closePublishedTaskButton.addEventListener("click", function () {

        selectedPublishedTaskId =
            null;

        hideSection("publishedTaskModal");
    });


    /*
    ========================================================
    撤回任务
    ========================================================
    */

    withdrawPublishedTaskButton.addEventListener("click", function () {

        if (!selectedPublishedTaskId) {

            return;
        }


        /*
        再次实时检查运输记录。
        只要已经发生 1 趟运输，立即禁止撤回。
        */

        const tripStats =
            getTaskTripStats(
                selectedPublishedTaskId
            );


        if (tripStats.count > 0) {

            syncPublishedTaskExecutionStatus();

            renderProductionTaskBoard();

            hideSection("publishedTaskModal");

            selectedPublishedTaskId =
                null;


            alert(
                "该任务已经产生运输记录，共 " +
                tripStats.count +
                " 趟，不能撤回。"
            );

            return;
        }


        const tasks =
            getPublishedTasks();


        const task =
            tasks.find(function (item) {

                return (
                    item.taskId ===
                    selectedPublishedTaskId
                );
            });


        if (!task) {

            return;
        }


        /*
        兼容旧任务：
        只要没有运输记录，即使旧数据写成 active，
        也按当前业务规则允许恢复为待执行。
        */

        if (
            task.status === "active" &&
            tripStats.count === 0
        ) {

            task.status =
                "pending";
        }


        if (task.status !== "pending") {

            alert(
                "该任务当前状态不允许撤回。"
            );

            return;
        }


        const confirmed =
            confirm(
                "确认撤回该生产任务吗？撤回后相关设备将恢复为可调配状态。"
            );


        if (!confirmed) {

            return;
        }


        task.status =
            "withdrawn";

        task.withdrawnAt =
            new Date().toISOString();


        saveTaskArray(tasks);

        releaseTaskEquipment(task);


        hideSection(
            "publishedTaskModal"
        );


        selectedPublishedTaskId =
            null;


        renderProductionTaskBoard();


        alert(
            "任务已撤回，相关设备已释放。"
        );
    });


    /*
    ========================================================
    完成任务
    ========================================================
    */

    completePublishedTaskButton.addEventListener("click", function () {

        if (!selectedPublishedTaskId) {

            return;
        }


        syncPublishedTaskExecutionStatus();


        const tasks =
            getPublishedTasks();


        const task =
            tasks.find(function (item) {

                return (
                    item.taskId ===
                    selectedPublishedTaskId
                );
            });


        if (!task) {

            return;
        }


        const stats =
            getTaskTripStats(
                task.taskId
            );


        if (stats.count === 0) {

            alert(
                "该任务尚未产生运输记录，不能按执行中任务完成。"
            );

            return;
        }


        if (task.status !== "active") {

            alert(
                "只有执行中的任务才能完成。"
            );

            return;
        }


        const confirmed =
            confirm(
                "确认完成该生产任务吗？"
            );


        if (!confirmed) {

            return;
        }


        task.status =
            "completed";

        task.completedAt =
            new Date().toISOString();


        saveTaskArray(tasks);

        releaseTaskEquipment(task);


        hideSection(
            "publishedTaskModal"
        );


        selectedPublishedTaskId =
            null;


        renderProductionTaskBoard();


        alert(
            "任务已完成，相关设备已释放。"
        );
    });


    /*
    ========================================================
    显示任务配置区
    ========================================================
    */

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
        ].forEach(function (id) {

            showSection(id);
        });
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
        ].forEach(function (id) {

            hideSection(id);
        });
    }


    /*
    ========================================================
    总渲染
    ========================================================
    */

    function renderAll() {

        renderExcavators();

        renderTrucks();

        renderBindings();

        renderAuxiliaryBoards();

        renderAuxiliaryAssignments();
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
            getPublishedTasks();


        const runningCount =
            tasks.filter(function (task) {

                return (
                    task.status === "pending" ||
                    task.status === "active"
                );
            }).length;


        setText(
            "productionTaskCount",
            runningCount +
            " 个进行中任务"
        );


        if (tasks.length === 0) {

            board.innerHTML = `
                <div class="empty-placeholder">
                    当前没有生产任务
                </div>
            `;

            return;
        }


        board.innerHTML =
            "";


        const sorted =
            [...tasks].sort(function (a, b) {

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
            });


        sorted.forEach(function (task) {

            const tripStats =
                getTaskTripStats(
                    task.taskId
                );


            const excavatorCount =
                Array.isArray(task.bindings)
                    ?
                    task.bindings.length
                    :
                    0;


            const truckCount =
                Array.isArray(task.bindings)
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


            const card =
                document.createElement(
                    "button"
                );


            card.type =
                "button";


            card.className =
                "production-task-card " +
                getTaskCardClass(
                    task.status
                );


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
                        ${escapeHtml(
                            getTaskStatusText(
                                task.status
                            )
                        )}
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
                        <strong>${tripStats.count}</strong>
                    </div>

                </div>


                <div class="production-task-time">

                    发布时间：
                    ${formatDateTime(
                        task.publishedAt
                    )}

                </div>
            `;


            card.addEventListener(
                "click",
                function () {

                    openPublishedTask(
                        task.taskId
                    );
                }
            );


            board.appendChild(card);
        });
    }


    /*
    ========================================================
    打开生产任务详情
    ========================================================
    */

    function openPublishedTask(taskId) {

        migrateOldTaskStatuses();

        syncPublishedTaskExecutionStatus();


        const tasks =
            getPublishedTasks();


        const task =
            tasks.find(function (item) {

                return (
                    item.taskId === taskId
                );
            });


        if (!task) {

            return;
        }


        selectedPublishedTaskId =
            task.taskId;


        const tripStats =
            getTaskTripStats(
                task.taskId
            );


        setText(
            "publishedTaskModalTitle",
            task.area +
            " · " +
            task.shift
        );


        let html = `
            <div class="task-detail-status-row">

                <span>
                    当前状态
                </span>

                <strong>
                    ${escapeHtml(
                        getTaskStatusText(
                            task.status
                        )
                    )}
                </strong>

            </div>


            <div class="transport-stat-box">

                <div>
                    <span>运输总趟数</span>
                    <strong>${tripStats.count}</strong>
                </div>

                <div>
                    <span>第一趟</span>

                    <strong>
                        ${
                            tripStats.firstTime
                                ?
                                formatDateTime(
                                    tripStats.firstTime
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
                            tripStats.lastTime
                                ?
                                formatDateTime(
                                    tripStats.lastTime
                                )
                                :
                                "-"
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

                <h4>
                    🚜 挖机及跟随卡车
                </h4>
        `;


        if (
            !Array.isArray(task.bindings) ||
            task.bindings.length === 0
        ) {

            html += `
                <p>
                    未配置主采设备
                </p>
            `;
        }

        else {

            task.bindings.forEach(
                function (binding) {

                    html += `
                        <div class="published-binding">

                            <strong>
                                🚜
                                ${escapeHtml(
                                    binding.excavatorId
                                )}
                            </strong>
                    `;


                    if (
                        Array.isArray(
                            binding.truckIds
                        )
                    ) {

                        binding.truckIds.forEach(
                            function (truckId) {

                                const truckTrips =
                                    getTruckTaskTripCount(
                                        task.taskId,
                                        truckId
                                    );


                                html += `
                                    <span>
                                        🚚
                                        ${escapeHtml(truckId)}
                                        ·
                                        ${truckTrips} 趟
                                    </span>
                                `;
                            }
                        );
                    }


                    html += `
                        </div>
                    `;
                }
            );
        }


        html += `
            </div>


            <div class="published-detail-block">

                <h4>
                    🚧 辅助车辆
                </h4>
        `;


        if (
            !Array.isArray(
                task.auxiliaryAssignments
            ) ||
            task.auxiliaryAssignments.length === 0
        ) {

            html += `
                <p>
                    未配置辅助车辆
                </p>
            `;
        }

        else {

            task.auxiliaryAssignments.forEach(
                function (item) {

                    html += `
                        <div class="published-aux-row">

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
            );
        }


        html += `
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


        document
            .getElementById(
                "publishedTaskModalContent"
            )
            .innerHTML =
            html;


        /*
        默认隐藏两个动作按钮
        */

        withdrawPublishedTaskButton
            .classList
            .add(
                "hidden"
            );


        completePublishedTaskButton
            .classList
            .add(
                "hidden"
            );


        /*
        核心规则：
        0趟 + pending = 显示撤回
        */

        if (
            task.status === "pending" &&
            tripStats.count === 0
        ) {

            withdrawPublishedTaskButton
                .classList
                .remove(
                    "hidden"
                );
        }


        /*
        已有运输 = 执行中 = 只能完成
        */

        if (
            task.status === "active" &&
            tripStats.count > 0
        ) {

            completePublishedTaskButton
                .classList
                .remove(
                    "hidden"
                );
        }


        showSection(
            "publishedTaskModal"
        );
    }


    /*
    ========================================================
    挖机看板
    ========================================================
    */

    function renderExcavators() {

        const board =
            document.getElementById(
                "excavatorBoard"
            );


        const devices =
            equipment.filter(
                function (item) {

                    return (
                        item.type ===
                        "excavator"
                    );
                }
            );


        setText(
            "excavatorCount",
            devices.length +
            " 台"
        );


        board.innerHTML =
            "";


        devices.forEach(
            function (device) {

                const card =
                    createDeviceCard(
                        device
                    );


                if (
                    selectedExcavatorId ===
                    device.id
                ) {

                    card.classList.add(
                        "selected-device"
                    );


                    const status =
                        card.querySelector(
                            ".device-status"
                        );


                    if (status) {

                        status.textContent =
                            "✓ 当前选择";
                    }
                }


                card.addEventListener(
                    "click",
                    function () {

                        handleExcavatorClick(
                            device
                        );
                    }
                );


                board.appendChild(card);
            }
        );
    }


    function handleExcavatorClick(device) {

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


        selectedExcavatorId =
            device.id;


        selectedTruckIds =
            [];


        renderExcavators();

        renderTrucks();


        scrollToId(
            "truckSection"
        );
    }


    /*
    ========================================================
    卡车看板
    ========================================================
    */

    function renderTrucks() {

        const board =
            document.getElementById(
                "truckBoard"
            );


        const trucks =
            equipment.filter(
                function (item) {

                    return (
                        item.type ===
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

                const card =
                    createDeviceCard(
                        device
                    );


                if (
                    selectedTruckIds.includes(
                        device.id
                    )
                ) {

                    card.classList.add(
                        "selected-device"
                    );


                    const status =
                        card.querySelector(
                            ".device-status"
                        );


                    if (status) {

                        status.textContent =
                            "✓ 已选择";
                    }
                }


                card.addEventListener(
                    "click",
                    function () {

                        handleTruckClick(
                            device
                        );
                    }
                );


                board.appendChild(card);
            }
        );


        updateTruckSelectionInfo();
    }


    function handleTruckClick(device) {

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


        if (!selectedExcavatorId) {

            alert(
                "请先点击一台绿色挖机"
            );

            return;
        }


        const index =
            selectedTruckIds.indexOf(
                device.id
            );


        if (index >= 0) {

            selectedTruckIds.splice(
                index,
                1
            );
        }

        else {

            selectedTruckIds.push(
                device.id
            );
        }


        renderTrucks();
    }


    function updateTruckSelectionInfo() {

        if (!selectedExcavatorId) {

            setText(
                "selectedExcavatorInfo",
                "当前未选择挖机"
            );


            bindTrucksButton
                .classList
                .add(
                    "hidden"
                );

            return;
        }


        const count =
            selectedTruckIds.length;


        document
            .getElementById(
                "selectedExcavatorInfo"
            )
            .innerHTML =

            "当前挖机：<strong>" +
            escapeHtml(
                selectedExcavatorId
            ) +
            "</strong> ｜ 已选择 <strong>" +
            count +
            "</strong> 台卡车";


        bindTrucksButton
            .classList
            .remove(
                "hidden"
            );


        bindTrucksButton.textContent =
            "绑定所选卡车（" +
            count +
            "台）";
    }


    /*
    ========================================================
    绑定关系
    ========================================================
    */

    function renderBindings() {

        const container =
            document.getElementById(
                "bindingList"
            );


        if (bindings.length === 0) {

            container.innerHTML = `
                <div class="empty-placeholder">
                    暂无绑定关系
                </div>
            `;

            return;
        }


        let html =
            "";


        bindings.forEach(
            function (binding) {

                html += `
                    <div class="binding-card">

                        <div class="binding-excavator">
                            🚜
                            <strong>
                                ${escapeHtml(
                                    binding.excavatorId
                                )}
                            </strong>
                        </div>

                        <div class="binding-truck-list">
                `;


                binding.truckIds.forEach(
                    function (truckId) {

                        html += `
                            <div class="binding-truck-item">
                                🚚
                                ${escapeHtml(truckId)}
                            </div>
                        `;
                    }
                );


                html += `
                        </div>

                    </div>
                `;
            }
        );


        container.innerHTML =
            html;
    }


    /*
    ========================================================
    辅助车辆看板
    ========================================================
    */

    function renderAuxiliaryBoards() {

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
    }


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
                function (item) {

                    return (
                        item.type === type
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

                const card =
                    createDeviceCard(
                        device
                    );


                card.addEventListener(
                    "click",
                    function () {

                        handleAuxiliaryDeviceClick(
                            device
                        );
                    }
                );


                board.appendChild(card);
            }
        );
    }


    function handleAuxiliaryDeviceClick(
        device
    ) {

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


        if (!currentTask) {

            alert(
                "请先创建生产任务"
            );

            return;
        }


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

            "下发" +
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

        const container =
            document.getElementById(
                "auxiliaryAssignmentList"
            );


        if (
            auxiliaryAssignments.length ===
            0
        ) {

            container.innerHTML = `
                <div class="empty-placeholder">
                    暂未配置辅助车辆
                </div>
            `;

            return;
        }


        let html =
            "";


        auxiliaryAssignments.forEach(
            function (item) {

                html += `
                    <div class="aux-assignment-card">

                        <div>

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

                        <div class="aux-assignment-area">
                            ${escapeHtml(
                                item.area
                            )}
                        </div>

                    </div>
                `;
            }
        );


        container.innerHTML =
            html;
    }


    /*
    ========================================================
    设备卡
    ========================================================
    */

    function createDeviceCard(device) {

        const card =
            document.createElement(
                "button"
            );


        card.type =
            "button";


        card.className =
            "device-card " +
            getStatusClass(
                device.status
            );


        card.innerHTML = `
            <strong class="device-number">
                ${escapeHtml(device.id)}
            </strong>

            <span class="device-status">
                ${escapeHtml(
                    getStatusText(
                        device.status
                    )
                )}
            </span>
        `;


        return card;
    }


    /*
    ========================================================
    设备详情
    ========================================================
    */

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


        document
            .getElementById(
                "modalContent"
            )
            .innerHTML = `

            <div class="modal-detail-row">
                <span>车型</span>
                <strong>
                    ${escapeHtml(
                        getTypeName(
                            device.type
                        )
                    )}
                </strong>
            </div>

            <div class="modal-detail-row">
                <span>故障</span>
                <strong>
                    ${escapeHtml(
                        maintenance.fault ||
                        "未填写"
                    )}
                </strong>
            </div>

            <div class="modal-detail-row">
                <span>开始时间</span>
                <strong>
                    ${escapeHtml(
                        maintenance.startedAt ||
                        "-"
                    )}
                </strong>
            </div>

            <div class="modal-detail-row">
                <span>预计完成</span>
                <strong>
                    ${escapeHtml(
                        maintenance.expectedEnd ||
                        "-"
                    )}
                </strong>
            </div>

            <div class="modal-detail-row">
                <span>维修负责人</span>
                <strong>
                    ${escapeHtml(
                        maintenance.responsible ||
                        "-"
                    )}
                </strong>
            </div>
        `;


        showSection(
            "deviceModal"
        );
    }


    function showAssignedModal(device) {

        const task =
            device.assignedTask ||
            {};


        setText(
            "modalTitle",
            device.id +
            " · 当前任务"
        );


        document
            .getElementById(
                "modalContent"
            )
            .innerHTML = `

            <div class="modal-detail-row">
                <span>车型</span>
                <strong>
                    ${escapeHtml(
                        getTypeName(
                            device.type
                        )
                    )}
                </strong>
            </div>

            <div class="modal-detail-row">
                <span>作业区域</span>
                <strong>
                    ${escapeHtml(
                        task.area ||
                        "-"
                    )}
                </strong>
            </div>

            <div class="modal-detail-row">
                <span>班次</span>
                <strong>
                    ${escapeHtml(
                        task.shift ||
                        "-"
                    )}
                </strong>
            </div>

            <div class="modal-detail-row">
                <span>工作内容</span>
                <strong>
                    ${escapeHtml(
                        task.work ||
                        "-"
                    )}
                </strong>
            </div>
        `;


        showSection(
            "deviceModal"
        );
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


            <div class="preview-block">

                <h3>
                    主采设备
                </h3>
        `;


        if (bindings.length === 0) {

            html += `
                <p>
                    未配置挖机和卡车
                </p>
            `;
        }


        bindings.forEach(
            function (binding) {

                html += `
                    <div class="preview-binding">

                        <strong>
                            🚜
                            ${escapeHtml(
                                binding.excavatorId
                            )}
                        </strong>
                `;


                binding.truckIds.forEach(
                    function (truckId) {

                        html += `
                            <span>
                                └ 🚚
                                ${escapeHtml(
                                    truckId
                                )}
                            </span>
                        `;
                    }
                );


                html += `
                    </div>
                `;
            }
        );


        html += `
            </div>


            <div class="preview-block">

                <h3>
                    辅助车辆
                </h3>
        `;


        if (
            auxiliaryAssignments.length ===
            0
        ) {

            html += `
                <p>
                    未配置辅助车辆
                </p>
            `;
        }


        auxiliaryAssignments.forEach(
            function (item) {

                html += `
                    <div class="preview-auxiliary">

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
        );


        html += `
            </div>


            <div class="preview-block">

                <h3>
                    调度说明
                </h3>

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
    查找设备
    ========================================================
    */

    function findDevice(id) {

        return equipment.find(
            function (item) {

                return (
                    item.id === id
                );
            }
        );
    }


    /*
    ========================================================
    释放设备
    ========================================================
    */

    function releaseTaskEquipment(task) {

        if (
            Array.isArray(
                task.bindings
            )
        ) {

            task.bindings.forEach(
                function (binding) {

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
                            "available";

                        delete excavator
                            .assignedTask;
                    }


                    if (
                        Array.isArray(
                            binding.truckIds
                        )
                    ) {

                        binding.truckIds.forEach(
                            function (truckId) {

                                const truck =
                                    findDevice(
                                        truckId
                                    );


                                if (
                                    truck &&
                                    truck.status !==
                                    "maintenance"
                                ) {

                                    truck.status =
                                        "available";

                                    delete truck
                                        .assignedTask;
                                }
                            }
                        );
                    }
                }
            );
        }


        if (
            Array.isArray(
                task.auxiliaryAssignments
            )
        ) {

            task.auxiliaryAssignments.forEach(
                function (item) {

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
                            "available";

                        delete device
                            .assignedTask;
                    }
                }
            );
        }
    }


    /*
    ========================================================
    恢复进行中任务占用的设备
    ========================================================
    */

    function restoreEquipmentStatusFromPublishedTasks() {

        const tasks =
            getPublishedTasks();


        tasks
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

                    if (
                        Array.isArray(
                            task.bindings
                        )
                    ) {

                        task.bindings.forEach(
                            function (binding) {

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
                                        taskId: task.taskId,
                                        area: task.area,
                                        shift: task.shift,
                                        work: "采装作业"
                                    };
                                }


                                if (
                                    Array.isArray(
                                        binding.truckIds
                                    )
                                ) {

                                    binding.truckIds.forEach(
                                        function (truckId) {

                                            const truck =
                                                findDevice(
                                                    truckId
                                                );


                                            if (
                                                truck &&
                                                truck.status !==
                                                "maintenance"
                                            ) {

                                                truck.status =
                                                    "assigned";

                                                truck.assignedTask = {
                                                    taskId: task.taskId,
                                                    area: task.area,
                                                    shift: task.shift,
                                                    work:
                                                        "跟随 " +
                                                        binding.excavatorId,
                                                    excavatorId:
                                                        binding.excavatorId
                                                };
                                            }
                                        }
                                    );
                                }
                            }
                        );
                    }


                    if (
                        Array.isArray(
                            task.auxiliaryAssignments
                        )
                    ) {

                        task.auxiliaryAssignments.forEach(
                            function (item) {

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
                                        taskId: task.taskId,
                                        area: task.area,
                                        shift: task.shift,
                                        work: item.work,
                                        remark: item.remark
                                    };
                                }
                            }
                        );
                    }
                }
            );
    }

});



/*
========================================================
V2.4.1 旧任务状态迁移
========================================================

以前 V2.3 发布任务后直接保存为 active。
现在规则改成：

0趟 = 待执行
有运输 = 执行中

因此旧任务 active + 0趟 自动改回 pending。
========================================================
*/

function migrateOldTaskStatuses() {

    const tasks =
        getPublishedTasks();


    let changed =
        false;


    tasks.forEach(
        function (task) {

            if (
                task.status !==
                "active"
            ) {

                return;
            }


            const stats =
                getTaskTripStats(
                    task.taskId
                );


            if (stats.count === 0) {

                task.status =
                    "pending";

                task.transportTripCount =
                    0;

                delete task.startedAt;

                changed =
                    true;
            }
        }
    );


    if (changed) {

        saveTaskArray(tasks);
    }
}



/*
========================================================
运输记录触发执行状态
========================================================
*/

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
        }
    );


    if (changed) {

        saveTaskArray(tasks);
    }
}



/*
========================================================
读取某任务的运输记录
========================================================
*/

function getTaskTripRecords(taskId) {

    let records =
        [];


    try {

        records =
            JSON.parse(
                localStorage.getItem(
                    "driverTripRecords"
                )
                ||
                "[]"
            );
    }

    catch (error) {

        records =
            [];
    }


    if (!Array.isArray(records)) {

        records =
            [];
    }


    return records.filter(
        function (record) {

            if (!record) {

                return false;
            }


            const recordTaskId =
                record.taskId ||
                record.dispatchTaskId ||
                (
                    record.task &&
                    record.task.taskId
                )
                ||
                "";


            return (
                String(recordTaskId) ===
                String(taskId)
            );
        }
    );
}



/*
========================================================
任务运输统计
========================================================
*/

function getTaskTripStats(taskId) {

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
            .filter(Boolean)
            .map(
                function (value) {

                    return new Date(value);
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
        count: records.length,

        firstTime:
            times.length
                ?
                times[0].toISOString()
                :
                null,

        lastTime:
            times.length
                ?
                times[
                    times.length - 1
                ].toISOString()
                :
                null
    };
}



/*
========================================================
某卡车任务趟数
========================================================
*/

function getTruckTaskTripCount(
    taskId,
    truckId
) {

    const records =
        getTaskTripRecords(
            taskId
        );


    return records.filter(
        function (record) {

            const recordTruck =
                record.vehicleNumber ||
                record.vehicleId ||
                record.truckId ||
                record.vehicle ||
                "";


            return (
                String(recordTruck) ===
                String(truckId)
            );
        }
    ).length;
}



/*
========================================================
生成卡车
========================================================
*/

function createTruckData() {

    const trucks =
        [];


    for (
        let i = 1;
        i <= 20;
        i++
    ) {

        const number =
            String(i)
                .padStart(
                    3,
                    "0"
                );


        const truck = {
            id: "T-" + number,
            type: "truck",
            status: "available"
        };


        if (
            i === 5 ||
            i === 12
        ) {

            truck.status =
                "maintenance";


            truck.maintenance = {
                fault:
                    i === 5
                        ?
                        "轮胎维修"
                        :
                        "发动机故障检查",

                startedAt:
                    "08:00",

                expectedEnd:
                    "14:00",

                responsible:
                    "维修组"
            };
        }


        trucks.push(truck);
    }


    return trucks;
}



/*
========================================================
任务保存
========================================================
*/

function savePublishedTask(task) {

    const tasks =
        getPublishedTasks();


    tasks.push(task);


    saveTaskArray(tasks);


    localStorage.setItem(
        "publishedDispatchTask",
        JSON.stringify(task)
    );
}


function saveTaskArray(tasks) {

    localStorage.setItem(
        "dispatchPublishedTasks",
        JSON.stringify(tasks)
    );
}


function getPublishedTasks() {

    let tasks =
        [];


    try {

        tasks =
            JSON.parse(
                localStorage.getItem(
                    "dispatchPublishedTasks"
                )
                ||
                "[]"
            );
    }

    catch (error) {

        tasks =
            [];
    }


    if (!Array.isArray(tasks)) {

        tasks =
            [];
    }


    return tasks;
}



/*
========================================================
辅助车辆任务选项
========================================================
*/

function getWorkOptions(type) {

    if (type === "loader") {

        return [
            {
                value: "日常作业",
                label: "日常作业"
            },
            {
                value: "清理挖机附近散料",
                label: "清理挖机附近散料"
            },
            {
                value: "修整运输道路",
                label: "修整运输道路"
            },
            {
                value: "装煤",
                label: "装煤"
            },
            {
                value: "排土场作业",
                label: "排土场作业"
            },
            {
                value: "manual",
                label: "手动录入"
            }
        ];
    }


    if (type === "water") {

        return [
            {
                value: "日常洒水",
                label: "日常洒水"
            },
            {
                value: "运输道路洒水",
                label: "运输道路洒水"
            },
            {
                value: "采区洒水",
                label: "采区洒水"
            },
            {
                value: "排土场洒水",
                label: "排土场洒水"
            },
            {
                value: "临时调配",
                label: "临时调配"
            },
            {
                value: "manual",
                label: "手动录入"
            }
        ];
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



/*
========================================================
车型名称
========================================================
*/

function getTypeName(type) {

    const map = {
        excavator: "挖机",
        truck: "卡车",
        loader: "装载机",
        water: "水车",
        fuel: "加油车",
        grader: "平路机",
        dozer: "推土机",
        bus: "大巴"
    };


    return (
        map[type] ||
        "其他车辆"
    );
}



/*
========================================================
任务状态
========================================================
*/

function getTaskStatusText(status) {

    const map = {
        pending: "待执行",
        active: "执行中",
        completed: "已完成",
        withdrawn: "已撤回",
        configuring: "配置中"
    };


    return (
        map[status] ||
        "未知"
    );
}


function getTaskCardClass(status) {

    if (status === "pending") {

        return "task-pending-card";
    }


    if (status === "active") {

        return "task-active-card";
    }


    if (status === "completed") {

        return "task-completed-card";
    }


    if (status === "withdrawn") {

        return "task-withdrawn-card";
    }


    return "";
}



/*
========================================================
设备状态
========================================================
*/

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



/*
========================================================
班次
========================================================
*/

function getDefaultShift() {

    const hour =
        new Date().getHours();


    if (
        hour >= 8 &&
        hour < 20
    ) {

        return "白班";
    }


    return "夜班";
}



/*
========================================================
时间格式
========================================================
*/

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



/*
========================================================
通用函数
========================================================
*/

function getValue(id) {

    const element =
        document.getElementById(id);


    if (!element) {

        return "";
    }


    return String(
        element.value ||
        ""
    ).trim();
}


function setValue(
    id,
    value
) {

    const element =
        document.getElementById(id);


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
        document.getElementById(id);


    if (element) {

        element.textContent =
            value;
    }
}


function showSection(id) {

    const element =
        document.getElementById(id);


    if (element) {

        element
            .classList
            .remove(
                "hidden"
            );
    }
}


function hideSection(id) {

    const element =
        document.getElementById(id);


    if (element) {

        element
            .classList
            .add(
                "hidden"
            );
    }
}


function scrollToId(id) {

    const element =
        document.getElementById(id);


    if (!element) {

        return;
    }


    setTimeout(
        function () {

            element.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        },
        50
    );
}


function escapeHtml(value) {

    const div =
        document.createElement("div");


    div.textContent =
        String(
            value ||
            ""
        );


    return div.innerHTML;
}
