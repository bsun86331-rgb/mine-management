/*
========================================================
矿山管理系统
生产调度端
dispatch.js V2.2
辅助车辆看板版
========================================================
*/


document.addEventListener(
    "DOMContentLoaded",
    function () {


        /* ==================================================
           页面状态
        ================================================== */

        let currentTask = null;

        let selectedExcavatorId = null;

        let selectedTruckIds = [];

        let bindings = [];

        let auxiliaryAssignments = [];

        let selectedAuxDeviceId = null;



        /* ==================================================
           模拟设备资料
           后期由管理员端设备基础资料替代
        ================================================== */

        let equipment = [

            /* 挖机 */

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
                status: "assigned",

                assignedTask: {
                    area: "山一采区",
                    shift: "白班",
                    work: "采装作业"
                }
            },

            {
                id: "EX-06",
                type: "excavator",
                status: "available"
            },


            /* 卡车 */

            ...createTruckData(),


            /* 装载机 */

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
                status: "assigned",

                assignedTask: {
                    area: "4H煤场",
                    shift: "白班",
                    work: "装煤",
                    remark: "煤场作业"
                }
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


            /* 水车 */

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


            /* 加油车 */

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


            /* 平路机 */

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


            /* 推土机 */

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


            /* 大巴 */

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



        /* ==================================================
           DOM
        ================================================== */

        const newTaskButton =
            document.getElementById(
                "newTaskButton"
            );


        const cancelCreateButton =
            document.getElementById(
                "cancelCreateButton"
            );


        const generateTaskButton =
            document.getElementById(
                "generateTaskButton"
            );


        const bindTrucksButton =
            document.getElementById(
                "bindTrucksButton"
            );


        const previewTaskButton =
            document.getElementById(
                "previewTaskButton"
            );


        const backEditButton =
            document.getElementById(
                "backEditButton"
            );


        const publishTaskButton =
            document.getElementById(
                "publishTaskButton"
            );


        const closeModalButton =
            document.getElementById(
                "closeModalButton"
            );


        const auxWorkType =
            document.getElementById(
                "auxWorkType"
            );


        const cancelAuxTaskButton =
            document.getElementById(
                "cancelAuxTaskButton"
            );


        const confirmAuxTaskButton =
            document.getElementById(
                "confirmAuxTaskButton"
            );



        /* ==================================================
           默认班次
        ================================================== */

        document
            .getElementById(
                "taskShift"
            )
            .value =
            getDefaultShift();



        /* ==================================================
           新建任务
        ================================================== */

        newTaskButton.addEventListener(
            "click",
            function () {

                document
                    .getElementById(
                        "taskShift"
                    )
                    .value =
                    getDefaultShift();


                showSection(
                    "taskCreateSection"
                );


                scrollToId(
                    "taskCreateSection"
                );

            }
        );



        /* ==================================================
           取消创建
        ================================================== */

        cancelCreateButton.addEventListener(
            "click",
            function () {

                hideSection(
                    "taskCreateSection"
                );

            }
        );



        /* ==================================================
           生成任务
        ================================================== */

        generateTaskButton.addEventListener(
            "click",
            function () {

                const shift =
                    getValue(
                        "taskShift"
                    );


                const area =
                    getValue(
                        "taskArea"
                    );


                const remark =
                    getValue(
                        "taskRemark"
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
                    currentTask.remark ||
                    "无"
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



        /* ==================================================
           挖机 + 卡车绑定
        ================================================== */

        bindTrucksButton.addEventListener(
            "click",
            function () {

                if (!selectedExcavatorId) {

                    alert(
                        "请先选择一台挖机"
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


                const excavatorId =
                    selectedExcavatorId;


                const trucks =
                    [...selectedTruckIds];


                bindings.push({

                    excavatorId:
                        excavatorId,

                    truckIds:
                        trucks

                });


                setDeviceStatus(
                    excavatorId,
                    "assigned"
                );


                const excavator =
                    findDevice(
                        excavatorId
                    );


                if (excavator) {

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
                    function (
                        truckId
                    ) {

                        setDeviceStatus(
                            truckId,
                            "assigned"
                        );


                        const truck =
                            findDevice(
                                truckId
                            );


                        if (truck) {

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


                scrollToId(
                    "bindingSection"
                );

            }
        );



        /* ==================================================
           辅助车辆手动任务
        ================================================== */

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



        /* ==================================================
           取消辅助任务
        ================================================== */

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



        /* ==================================================
           确认辅助车辆任务
        ================================================== */

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



        /* ==================================================
           任务预览
        ================================================== */

        previewTaskButton.addEventListener(
            "click",
            function () {

                if (!currentTask) {

                    return;

                }


                if (
                    bindings.length ===
                    0
                ) {

                    const continuePublish =
                        confirm(
                            "当前没有绑定挖机和卡车，是否仍然查看任务？"
                        );


                    if (!continuePublish) {

                        return;

                    }

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



        /* ==================================================
           返回修改
        ================================================== */

        backEditButton.addEventListener(
            "click",
            function () {

                hideSection(
                    "previewSection"
                );


                scrollToId(
                    "excavatorSection"
                );

            }
        );



        /* ==================================================
           发布任务
        ================================================== */

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
                    "published";


                currentTask.publishedAt =
                    new Date()
                        .toISOString();


                const publishedTask = {

                    ...currentTask,

                    bindings:
                        JSON.parse(
                            JSON.stringify(
                                bindings
                            )
                        ),

                    auxiliaryAssignments:
                        JSON.parse(
                            JSON.stringify(
                                auxiliaryAssignments
                            )
                        )

                };


                localStorage.setItem(

                    "publishedDispatchTask",

                    JSON.stringify(
                        publishedTask
                    )

                );


                savePublishedTaskHistory(
                    publishedTask
                );


                setText(
                    "taskStateBadge",
                    "已发布"
                );


                hideSection(
                    "previewSection"
                );


                alert(
                    "生产任务发布成功"
                );


                scrollToId(
                    "taskSummarySection"
                );

            }
        );



        /* ==================================================
           关闭设备详情
        ================================================== */

        closeModalButton.addEventListener(
            "click",
            function () {

                hideSection(
                    "deviceModal"
                );

            }
        );



        /* ==================================================
           显示全部看板
        ================================================== */

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
                function (
                    id
                ) {

                    showSection(
                        id
                    );

                }
            );

        }



        /* ==================================================
           总渲染
        ================================================== */

        function renderAll() {

            renderExcavators();

            renderTrucks();

            renderBindings();

            renderAuxiliaryBoards();

            renderAuxiliaryAssignments();

        }



        /* ==================================================
           挖机看板
        ================================================== */

        function renderExcavators() {

            const board =
                document.getElementById(
                    "excavatorBoard"
                );


            const devices =
                equipment.filter(
                    function (
                        item
                    ) {

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
                function (
                    device
                ) {

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


                    board.appendChild(
                        card
                    );

                }
            );

        }



        /* ==================================================
           点击挖机
        ================================================== */

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



        /* ==================================================
           卡车看板
        ================================================== */

        function renderTrucks() {

            const board =
                document.getElementById(
                    "truckBoard"
                );


            const trucks =
                equipment.filter(
                    function (
                        item
                    ) {

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
                function (
                    device
                ) {

                    const card =
                        createDeviceCard(
                            device
                        );


                    const selected =
                        selectedTruckIds
                            .includes(
                                device.id
                            );


                    if (selected) {

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


                    board.appendChild(
                        card
                    );

                }
            );


            updateTruckSelectionInfo();

        }



        /* ==================================================
           卡车点击
        ================================================== */

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
                selectedTruckIds
                    .indexOf(
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



        /* ==================================================
           卡车选择提示
        ================================================== */

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



        /* ==================================================
           绑定关系
        ================================================== */

        function renderBindings() {

            const container =
                document.getElementById(
                    "bindingList"
                );


            if (
                bindings.length ===
                0
            ) {

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
                function (
                    binding
                ) {

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
                        function (
                            truckId
                        ) {

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



        /* ==================================================
           辅助车辆看板
        ================================================== */

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
                    function (
                        item
                    ) {

                        return (
                            item.type ===
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
                function (
                    device
                ) {

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



        /* ==================================================
           点击辅助车辆
        ================================================== */

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


            openAuxiliaryTaskModal(
                device
            );

        }



        /* ==================================================
           打开辅助任务窗口
        ================================================== */

        function openAuxiliaryTaskModal(
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
                "下发" +
                getTypeName(
                    device.type
                ) +
                "任务"
            );


            auxWorkType.innerHTML =
                "";


            const works =
                getWorkOptions(
                    device.type
                );


            works.forEach(
                function (
                    item
                ) {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        item.value;


                    option.textContent =
                        item.label;


                    auxWorkType
                        .appendChild(
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



        /* ==================================================
           辅助车辆任务列表
        ================================================== */

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
                function (
                    item
                ) {

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



        /* ==================================================
           设备卡片
        ================================================== */

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



        /* ==================================================
           维修状态
        ================================================== */

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
                            当前状态
                        </span>

                        <strong>
                            维修中
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



        /* ==================================================
           已分配任务
        ================================================== */

        function showAssignedModal(
            device
        ) {

            const task =
                device.assignedTask ||
                {};


            setText(
                "modalTitle",
                device.id +
                " · 已分配任务"
            );


            document
                .getElementById(
                    "modalContent"
                )
                .innerHTML = `

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
                            当前状态
                        </span>

                        <strong>
                            已分配任务
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


                    <div class="modal-detail-row">

                        <span>
                            调度说明
                        </span>

                        <strong>

                            ${escapeHtml(
                                task.remark ||
                                "无"
                            )}

                        </strong>

                    </div>

                `;


            showSection(
                "deviceModal"
            );

        }



        /* ==================================================
           任务预览
        ================================================== */

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


            if (
                bindings.length ===
                0
            ) {

                html += `

                    <p>
                        未配置挖机和卡车
                    </p>

                `;

            }


            bindings.forEach(
                function (
                    binding
                ) {

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
                        function (
                            truckId
                        ) {

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
                function (
                    item
                ) {

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



        /* ==================================================
           通用
        ================================================== */

        function findDevice(
            id
        ) {

            return equipment.find(
                function (
                    item
                ) {

                    return (
                        item.id ===
                        id
                    );

                }
            );

        }



        function setDeviceStatus(
            id,
            status
        ) {

            const device =
                findDevice(
                    id
                );


            if (device) {

                device.status =
                    status;

            }

        }

    }
);



/* ==================================================
   卡车资料
================================================== */

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


        if (
            i === 18
        ) {

            truck.status =
                "assigned";


            truck.assignedTask = {

                area:
                    "山二采区",

                shift:
                    "白班",

                work:
                    "运输作业"

            };

        }


        trucks.push(
            truck
        );

    }


    return trucks;

}



/* ==================================================
   工作内容
================================================== */

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



/* ==================================================
   车型名称
================================================== */

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
        map[type] ||
        "其他车辆"
    );

}



/* ==================================================
   班次
================================================== */

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



/* ==================================================
   状态样式
================================================== */

function getStatusClass(
    status
) {

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



/* ==================================================
   状态文字
================================================== */

function getStatusText(
    status
) {

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



/* ==================================================
   保存历史
================================================== */

function savePublishedTaskHistory(
    task
) {

    let history =
        [];


    try {

        history =
            JSON.parse(

                localStorage.getItem(
                    "dispatchPublishedHistory"
                )
                ||
                "[]"

            );

    }

    catch (
        error
    ) {

        history =
            [];

    }


    if (
        !Array.isArray(
            history
        )
    ) {

        history =
            [];

    }


    history.push(
        task
    );


    localStorage.setItem(

        "dispatchPublishedHistory",

        JSON.stringify(
            history
        )

    );

}



/* ==================================================
   通用函数
================================================== */

function getValue(
    id
) {

    const element =
        document.getElementById(
            id
        );


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

        element
            .classList
            .remove(
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

        element
            .classList
            .add(
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
            value ||
            ""
        );


    return div.innerHTML;

}
