/*
========================================================
矿山管理系统
生产调度端
dispatch.js V2.3
生产任务看板版
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


    document.getElementById("taskShift").value =
        getDefaultShift();


    restoreEquipmentStatusFromPublishedTasks();

    renderProductionTaskBoard();


    newTaskButton.addEventListener(
        "click",
        function () {

            document.getElementById("taskShift").value =
                getDefaultShift();

            showSection("taskCreateSection");

            scrollToId("taskCreateSection");

        }
    );


    cancelCreateButton.addEventListener(
        "click",
        function () {

            hideSection("taskCreateSection");

        }
    );


    generateTaskButton.addEventListener(
        "click",
        function () {

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

                taskId:
                    "TASK_" +
                    Date.now(),

                date:
                    new Date()
                        .toLocaleDateString("zh-CN"),

                shift:
                    shift,

                area:
                    area,

                remark:
                    remark,

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
                currentTask.remark || "无"
            );

            setText(
                "taskStateBadge",
                "配置中"
            );


            hideSection(
                "taskCreateSection"
            );


            showTaskBoards();

            renderAll();

            scrollToId(
                "excavatorSection"
            );

        }
    );



    bindTrucksButton.addEventListener(
        "click",
        function () {

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


            const oldBinding =
                bindings.find(
                    function (item) {

                        return (
                            item.excavatorId ===
                            excavatorId
                        );

                    }
                );


            if (oldBinding) {

                oldBinding.truckIds =
                    Array.from(
                        new Set([
                            ...oldBinding.truckIds,
                            ...trucks
                        ])
                    );

            }

            else {

                bindings.push({

                    excavatorId:
                        excavatorId,

                    truckIds:
                        trucks

                });

            }


            const excavator =
                findDevice(excavatorId);


            if (excavator) {

                excavator.status =
                    "assigned";

                excavator.assignedTask = {

                    area:
                        currentTask.area,

                    shift:
                        currentTask.shift,

                    work:
                        "采装作业",

                    taskId:
                        currentTask.taskId

                };

            }


            trucks.forEach(
                function (truckId) {

                    const truck =
                        findDevice(truckId);

                    if (truck) {

                        truck.status =
                            "assigned";

                        truck.assignedTask = {

                            area:
                                currentTask.area,

                            shift:
                                currentTask.shift,

                            work:
                                "跟随 " +
                                excavatorId,

                            excavatorId:
                                excavatorId,

                            taskId:
                                currentTask.taskId

                        };

                    }

                }
            );


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

        }
    );



    auxWorkType.addEventListener(
        "change",
        function () {

            if (this.value === "manual") {

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

            if (!selectedAuxDeviceId) {

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


            if (work === "manual") {

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


            const remark =
                getValue(
                    "auxTaskRemark"
                );


            const assignment = {

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
                    remark,

                area:
                    currentTask.area,

                shift:
                    currentTask.shift,

                taskId:
                    currentTask.taskId,

                assignedAt:
                    new Date()
                        .toISOString()

            };


            auxiliaryAssignments.push(
                assignment
            );


            device.status =
                "assigned";


            device.assignedTask = {

                area:
                    currentTask.area,

                shift:
                    currentTask.shift,

                work:
                    work,

                remark:
                    remark,

                taskId:
                    currentTask.taskId

            };


            selectedAuxDeviceId =
                null;


            hideSection(
                "auxTaskModal"
            );


            renderAll();


            alert(
                device.id +
                " 任务下发成功"
            );

        }
    );



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


            const confirmed =
                confirm(
                    "确认发布当前生产任务吗？"
                );


            if (!confirmed) {

                return;

            }


            currentTask.status =
                "active";


            currentTask.publishedAt =
                new Date()
                    .toISOString();


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
                    )

            };


            savePublishedTask(
                publishedTask
            );


            setText(
                "taskStateBadge",
                "执行中"
            );


            hideSection(
                "previewSection"
            );


            hideCurrentConfigurationSections();


            currentTask =
                null;

            bindings =
                [];

            auxiliaryAssignments =
                [];

            selectedExcavatorId =
                null;

            selectedTruckIds =
                [];


            renderProductionTaskBoard();


            alert(
                "生产任务发布成功，已进入生产任务看板"
            );


            scrollToId(
                "productionTaskBoardSection"
            );

        }
    );



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



    completePublishedTaskButton.addEventListener(
        "click",
        function () {

            if (!selectedPublishedTaskId) {

                return;

            }


            const confirmed =
                confirm(
                    "确认将该生产任务设置为已完成吗？"
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
                            selectedPublishedTaskId
                        );

                    }
                );


            if (!task) {

                return;

            }


            task.status =
                "completed";

            task.completedAt =
                new Date()
                    .toISOString();


            localStorage.setItem(
                "dispatchPublishedTasks",
                JSON.stringify(tasks)
            );


            releaseTaskEquipment(
                task
            );


            hideSection(
                "publishedTaskModal"
            );


            selectedPublishedTaskId =
                null;


            renderProductionTaskBoard();


            alert(
                "任务已完成，相关设备已恢复为可调配状态"
            );

        }
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

        ].forEach(
            function (id) {

                showSection(id);

            }
        );

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

        ].forEach(
            function (id) {

                hideSection(id);

            }
        );

    }



    function renderAll() {

        renderExcavators();

        renderTrucks();

        renderBindings();

        renderAuxiliaryBoards();

        renderAuxiliaryAssignments();

    }



    function renderProductionTaskBoard() {

        const board =
            document.getElementById(
                "productionTaskBoard"
            );


        const tasks =
            getPublishedTasks();


        const activeTasks =
            tasks.filter(
                function (task) {

                    return (
                        task.status !==
                        "completed"
                    );

                }
            );


        setText(
            "productionTaskCount",
            activeTasks.length +
            " 个任务"
        );


        if (tasks.length === 0) {

            board.innerHTML = `

                <div class="empty-placeholder">

                    当前没有已发布生产任务

                </div>

            `;

            return;

        }


        board.innerHTML =
            "";


        const sorted =
            [...tasks].sort(
                function (a, b) {

                    return new Date(
                        b.publishedAt ||
                        b.createdAt
                    ) -
                    new Date(
                        a.publishedAt ||
                        a.createdAt
                    );

                }
            );


        sorted.forEach(
            function (task) {

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


                const card =
                    document.createElement(
                        "button"
                    );


                card.type =
                    "button";


                card.className =
                    "production-task-card " +
                    (
                        task.status ===
                        "completed"
                            ?
                            "task-completed-card"
                            :
                            "task-active-card"
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

                            ${
                                task.status ===
                                "completed"
                                    ?
                                    "已完成"
                                    :
                                    "执行中"
                            }

                        </span>

                    </div>


                    <div class="production-task-date">

                        ${escapeHtml(task.date)}

                    </div>


                    <div class="production-task-stat-grid">

                        <div>

                            <span>
                                挖机
                            </span>

                            <strong>
                                ${excavatorCount}
                            </strong>

                        </div>


                        <div>

                            <span>
                                卡车
                            </span>

                            <strong>
                                ${truckCount}
                            </strong>

                        </div>


                        <div>

                            <span>
                                辅助车辆
                            </span>

                            <strong>
                                ${auxiliaryCount}
                            </strong>

                        </div>

                    </div>


                    <div class="production-task-time">

                        发布时间：
                        ${formatDateTime(task.publishedAt)}

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


                board.appendChild(
                    card
                );

            }
        );

    }



    function openPublishedTask(taskId) {

        const tasks =
            getPublishedTasks();


        const task =
            tasks.find(
                function (item) {

                    return (
                        item.taskId ===
                        taskId
                    );

                }
            );


        if (!task) {

            return;

        }


        selectedPublishedTaskId =
            task.taskId;


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

                    ${
                        task.status ===
                        "completed"
                            ?
                            "已完成"
                            :
                            "执行中"
                    }

                </strong>

            </div>


            <div class="modal-detail-row">

                <span>
                    日期
                </span>

                <strong>
                    ${escapeHtml(task.date)}
                </strong>

            </div>


            <div class="modal-detail-row">

                <span>
                    作业区域
                </span>

                <strong>
                    ${escapeHtml(task.area)}
                </strong>

            </div>


            <div class="modal-detail-row">

                <span>
                    班次
                </span>

                <strong>
                    ${escapeHtml(task.shift)}
                </strong>

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


                    binding.truckIds.forEach(
                        function (truckId) {

                            html += `

                                <span>

                                    🚚
                                    ${escapeHtml(truckId)}

                                </span>

                            `;

                        }
                    );


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
            task.auxiliaryAssignments.length ===
            0
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


        if (
            task.status ===
            "completed"
        ) {

            completePublishedTaskButton
                .classList
                .add(
                    "hidden"
                );

        }

        else {

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


                    card.querySelector(
                        ".device-status"
                    ).textContent =
                        "✓ 当前选择";

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



    function handleExcavatorClick(
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


                    card.querySelector(
                        ".device-status"
                    ).textContent =
                        "✓ 已选择";

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



    function handleTruckClick(
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
                                ${escapeHtml(binding.excavatorId)}
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


                board.appendChild(
                    card
                );

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
        )
        .forEach(
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

                `;

            }
        );


        container.innerHTML =
            html;

    }



    function createDeviceCard(
        device
    ) {

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
        ).innerHTML = `

            <div class="modal-detail-row">

                <span>
                    车型
                </span>

                <strong>

                    ${escapeHtml(
                        getTypeName(
                            device.type
                        )
                    )}

                </strong>

            </div>


            <div class="modal-detail-row">

                <span>
                    故障情况
                </span>

                <strong>

                    ${escapeHtml(
                        maintenance.fault ||
                        "未填写"
                    )}

                </strong>

            </div>


            <div class="modal-detail-row">

                <span>
                    开始时间
                </span>

                <strong>

                    ${escapeHtml(
                        maintenance.startedAt ||
                        "-"
                    )}

                </strong>

            </div>


            <div class="modal-detail-row">

                <span>
                    预计完成
                </span>

                <strong>

                    ${escapeHtml(
                        maintenance.expectedEnd ||
                        "-"
                    )}

                </strong>

            </div>


            <div class="modal-detail-row">

                <span>
                    维修负责人
                </span>

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
        ).innerHTML = `

            <div class="modal-detail-row">

                <span>
                    车型
                </span>

                <strong>

                    ${escapeHtml(
                        getTypeName(
                            device.type
                        )
                    )}

                </strong>

            </div>


            <div class="modal-detail-row">

                <span>
                    作业区域
                </span>

                <strong>

                    ${escapeHtml(
                        task.area ||
                        "-"
                    )}

                </strong>

            </div>


            <div class="modal-detail-row">

                <span>
                    班次
                </span>

                <strong>

                    ${escapeHtml(
                        task.shift ||
                        "-"
                    )}

                </strong>

            </div>


            <div class="modal-detail-row">

                <span>
                    工作内容
                </span>

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

                            ${escapeHtml(item.typeName)}
                            ·
                            ${escapeHtml(item.vehicleId)}

                        </strong>

                        <span>

                            ${escapeHtml(item.work)}

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



    function findDevice(id) {

        return equipment.find(
            function (item) {

                return (
                    item.id === id
                );

            }
        );

    }



    function releaseTaskEquipment(
        task
    ) {

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


                    if (excavator) {

                        excavator.status =
                            "available";

                        delete excavator
                            .assignedTask;

                    }


                    binding.truckIds
                        .forEach(
                            function (
                                truckId
                            ) {

                                const truck =
                                    findDevice(
                                        truckId
                                    );


                                if (truck) {

                                    truck.status =
                                        "available";

                                    delete truck
                                        .assignedTask;

                                }

                            }
                        );

                }
            );

        }


        if (
            Array.isArray(
                task.auxiliaryAssignments
            )
        ) {

            task.auxiliaryAssignments
                .forEach(
                    function (item) {

                        const device =
                            findDevice(
                                item.vehicleId
                            );


                        if (device) {

                            device.status =
                                "available";

                            delete device
                                .assignedTask;

                        }

                    }
                );

        }

    }



    function restoreEquipmentStatusFromPublishedTasks() {

        const tasks =
            getPublishedTasks();


        tasks
            .filter(
                function (task) {

                    return (
                        task.status !==
                        "completed"
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


                                if (excavator) {

                                    excavator.status =
                                        "assigned";

                                    excavator.assignedTask = {

                                        area:
                                            task.area,

                                        shift:
                                            task.shift,

                                        work:
                                            "采装作业",

                                        taskId:
                                            task.taskId

                                    };

                                }


                                binding.truckIds
                                    .forEach(
                                        function (
                                            truckId
                                        ) {

                                            const truck =
                                                findDevice(
                                                    truckId
                                                );


                                            if (truck) {

                                                truck.status =
                                                    "assigned";

                                                truck.assignedTask = {

                                                    area:
                                                        task.area,

                                                    shift:
                                                        task.shift,

                                                    work:
                                                        "跟随 " +
                                                        binding.excavatorId,

                                                    taskId:
                                                        task.taskId

                                                };

                                            }

                                        }
                                    );

                            }
                        );

                    }


                    if (
                        Array.isArray(
                            task.auxiliaryAssignments
                        )
                    ) {

                        task.auxiliaryAssignments
                            .forEach(
                                function (item) {

                                    const device =
                                        findDevice(
                                            item.vehicleId
                                        );


                                    if (device) {

                                        device.status =
                                            "assigned";

                                        device.assignedTask = {

                                            area:
                                                task.area,

                                            shift:
                                                task.shift,

                                            work:
                                                item.work,

                                            remark:
                                                item.remark,

                                            taskId:
                                                task.taskId

                                        };

                                    }

                                }
                            );

                    }

                }
            );

    }

});



function createTruckData() {

    const trucks = [];


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

            id:
                "T-" +
                number,

            type:
                "truck",

            status:
                "available"

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


        trucks.push(
            truck
        );

    }


    return trucks;

}



function savePublishedTask(
    task
) {

    const tasks =
        getPublishedTasks();


    tasks.push(
        task
    );


    localStorage.setItem(
        "dispatchPublishedTasks",
        JSON.stringify(tasks)
    );


    localStorage.setItem(
        "publishedDispatchTask",
        JSON.stringify(task)
    );

}



function getPublishedTasks() {

    let tasks = [];


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

        tasks = [];

    }


    if (
        !Array.isArray(tasks)
    ) {

        tasks = [];

    }


    return tasks;

}



function getWorkOptions(
    type
) {

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



function getDefaultShift() {

    const hour =
        new Date()
            .getHours();


    if (
        hour >= 8 &&
        hour < 20
    ) {

        return "白班";

    }


    return "夜班";

}



function getStatusClass(status) {

    if (
        status ===
        "available"
    ) {

        return "device-available";

    }


    if (
        status ===
        "maintenance"
    ) {

        return "device-maintenance";

    }


    if (
        status ===
        "assigned"
    ) {

        return "device-assigned";

    }


    return "";

}



function getStatusText(status) {

    if (
        status ===
        "available"
    ) {

        return "可调配";

    }


    if (
        status ===
        "maintenance"
    ) {

        return "维修中";

    }


    if (
        status ===
        "assigned"
    ) {

        return "已分配";

    }


    return "未知";

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

                behavior:
                    "smooth",

                block:
                    "start"

            });

        },
        50
    );

}



function escapeHtml(value) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value ||
            ""
        );


    return div.innerHTML;

}
