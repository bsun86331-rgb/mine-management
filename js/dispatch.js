/*
=========================================
矿山管理系统
生产调度端
dispatch.js V2.0
=========================================
*/


document.addEventListener(
    "DOMContentLoaded",
    function () {

        /*
        =====================================
        页面状态
        =====================================
        */

        let currentTask = null;

        let selectedExcavatorId = null;

        let selectedTruckIds = [];

        let bindings = [];

        let auxiliaryAssignments = [];



        /*
        =====================================
        模拟设备基础资料
        后续改由管理员端维护
        =====================================
        */

        let equipment = [

            // 挖机

            {
                id: "EX-01",
                type: "excavator",
                name: "EX-01",
                status: "available"
            },

            {
                id: "EX-02",
                type: "excavator",
                name: "EX-02",
                status: "available"
            },

            {
                id: "EX-03",
                type: "excavator",
                name: "EX-03",
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
                name: "EX-04",
                status: "available"
            },

            {
                id: "EX-05",
                type: "excavator",
                name: "EX-05",
                status: "assigned",
                assignedTask: "山一采区夜班任务"
            },

            {
                id: "EX-06",
                type: "excavator",
                name: "EX-06",
                status: "available"
            },


            // 卡车

            ...createTruckData(),


            // 装载机

            {
                id: "L-01",
                type: "loader",
                name: "L-01",
                status: "available"
            },

            {
                id: "L-02",
                type: "loader",
                name: "L-02",
                status: "assigned",
                assignedTask: "煤场装煤"
            },

            {
                id: "L-03",
                type: "loader",
                name: "L-03",
                status: "available"
            },

            {
                id: "L-04",
                type: "loader",
                name: "L-04",
                status: "maintenance",
                maintenance: {
                    fault: "轮胎维修",
                    startedAt: "07:40",
                    expectedEnd: "11:30",
                    responsible: "维修组"
                }
            },


            // 水车

            {
                id: "W-01",
                type: "water",
                name: "W-01",
                status: "available"
            },

            {
                id: "W-02",
                type: "water",
                name: "W-02",
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
                name: "W-03",
                status: "available"
            },


            // 加油车

            {
                id: "F-01",
                type: "fuel",
                name: "F-01",
                status: "available"
            },

            {
                id: "F-02",
                type: "fuel",
                name: "F-02",
                status: "available"
            }

        ];



        /*
        =====================================
        DOM
        =====================================
        */

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



        /*
        =====================================
        初始班次
        =====================================
        */

        document
            .getElementById(
                "taskShift"
            )
            .value =
            getDefaultShift();



        /*
        =====================================
        新任务
        =====================================
        */

        newTaskButton.addEventListener(
            "click",
            function () {

                showSection(
                    "taskCreateSection"
                );


                document
                    .getElementById(
                        "taskShift"
                    )
                    .value =
                    getDefaultShift();


                scrollToId(
                    "taskCreateSection"
                );

            }
        );



        /*
        =====================================
        取消创建
        =====================================
        */

        cancelCreateButton.addEventListener(
            "click",
            function () {

                hideSection(
                    "taskCreateSection"
                );

            }
        );



        /*
        =====================================
        生成任务
        =====================================
        */

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
                        "TASK_"
                        +
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


                bindings =
                    [];


                auxiliaryAssignments =
                    [];


                selectedExcavatorId =
                    null;


                selectedTruckIds =
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


                showSection(
                    "taskSummarySection"
                );


                showSection(
                    "legendSection"
                );


                showSection(
                    "excavatorSection"
                );


                showSection(
                    "truckSection"
                );


                showSection(
                    "bindingSection"
                );


                showSection(
                    "auxiliarySection"
                );


                showSection(
                    "publishSection"
                );


                renderAll();


                scrollToId(
                    "excavatorSection"
                );

            }
        );



        /*
        =====================================
        绑定卡车
        =====================================
        */

        bindTrucksButton.addEventListener(
            "click",
            function () {

                if (!selectedExcavatorId) {

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
                        "请选择至少一台卡车"
                    );

                    return;

                }


                const existingBinding =
                    bindings.find(
                        function (
                            item
                        ) {

                            return (
                                item.excavatorId ===
                                selectedExcavatorId
                            );

                        }
                    );


                if (existingBinding) {

                    existingBinding.truckIds =
                        Array.from(
                            new Set([
                                ...existingBinding.truckIds,
                                ...selectedTruckIds
                            ])
                        );

                }

                else {

                    bindings.push({

                        excavatorId:
                            selectedExcavatorId,

                        truckIds:
                            [...selectedTruckIds]

                    });

                }


                setDeviceStatus(
                    selectedExcavatorId,
                    "assigned"
                );


                selectedTruckIds.forEach(
                    function (
                        truckId
                    ) {

                        setDeviceStatus(
                            truckId,
                            "assigned"
                        );

                    }
                );


                selectedExcavatorId =
                    null;


                selectedTruckIds =
                    [];


                renderAll();


                alert(
                    "挖机与卡车绑定成功"
                );

            }
        );



        /*
        =====================================
        辅助车辆
        =====================================
        */

        setupManualInputToggle(
            "loaderWorkType",
            "loaderManualInput"
        );


        setupManualInputToggle(
            "waterTruckWorkType",
            "waterTruckManualInput"
        );


        setupManualInputToggle(
            "fuelTruckWorkType",
            "fuelTruckManualInput"
        );


        setupManualInputToggle(
            "otherVehicleWorkType",
            "otherVehicleManualInput"
        );



        document
            .getElementById(
                "confirmLoaderButton"
            )
            .addEventListener(
                "click",
                function () {

                    confirmAuxiliaryVehicle({
                        type:
                            "loader",

                        vehicleSelectId:
                            "loaderSelect",

                        workTypeId:
                            "loaderWorkType",

                        manualInputId:
                            "loaderManualInput",

                        typeName:
                            "装载机"
                    });

                }
            );



        document
            .getElementById(
                "confirmWaterTruckButton"
            )
            .addEventListener(
                "click",
                function () {

                    confirmAuxiliaryVehicle({
                        type:
                            "water",

                        vehicleSelectId:
                            "waterTruckSelect",

                        workTypeId:
                            "waterTruckWorkType",

                        manualInputId:
                            "waterTruckManualInput",

                        typeName:
                            "水车"
                    });

                }
            );



        document
            .getElementById(
                "confirmFuelTruckButton"
            )
            .addEventListener(
                "click",
                function () {

                    confirmAuxiliaryVehicle({
                        type:
                            "fuel",

                        vehicleSelectId:
                            "fuelTruckSelect",

                        workTypeId:
                            "fuelTruckWorkType",

                        manualInputId:
                            "fuelTruckManualInput",

                        typeName:
                            "加油车"
                    });

                }
            );



        document
            .getElementById(
                "confirmOtherVehicleButton"
            )
            .addEventListener(
                "click",
                function () {

                    const vehicleType =
                        getValue(
                            "otherVehicleType"
                        );


                    const vehicleNumber =
                        getValue(
                            "otherVehicleNumber"
                        );


                    const workType =
                        getValue(
                            "otherVehicleWorkType"
                        );


                    let finalWork =
                        workType;


                    if (!vehicleType) {

                        alert(
                            "请选择其他辅助车辆车型"
                        );

                        return;

                    }


                    if (!vehicleNumber) {

                        alert(
                            "请输入车辆编号"
                        );

                        return;

                    }


                    if (
                        workType ===
                        "manual"
                    ) {

                        finalWork =
                            getValue(
                                "otherVehicleManualInput"
                            );


                        if (!finalWork) {

                            alert(
                                "请输入具体工作内容"
                            );

                            return;

                        }

                    }


                    auxiliaryAssignments.push({

                        assignmentId:
                            "AUX_"
                            +
                            Date.now(),

                        type:
                            "other",

                        typeName:
                            vehicleType,

                        vehicleId:
                            vehicleNumber,

                        work:
                            finalWork

                    });


                    setValue(
                        "otherVehicleNumber",
                        ""
                    );


                    renderAuxiliaryAssignments();


                    alert(
                        "辅助车辆已加入任务"
                    );

                }
            );



        /*
        =====================================
        任务预览
        =====================================
        */

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

                    alert(
                        "至少需要绑定一台挖机和卡车"
                    );

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



        /*
        =====================================
        返回修改
        =====================================
        */

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



        /*
        =====================================
        正式发布
        =====================================
        */

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
                        bindings,

                    auxiliaryAssignments:
                        auxiliaryAssignments

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


                alert(
                    "生产任务发布成功"
                );


                hideSection(
                    "previewSection"
                );


                scrollToId(
                    "taskSummarySection"
                );

            }
        );



        /*
        =====================================
        关闭弹窗
        =====================================
        */

        closeModalButton.addEventListener(
            "click",
            function () {

                hideModal();

            }
        );



        /*
        =====================================
        页面渲染
        =====================================
        */

        function renderAll() {

            renderExcavators();

            renderTrucks();

            renderBindings();

            renderAuxiliarySelects();

            renderAuxiliaryAssignments();

        }



        /*
        =====================================
        挖机
        =====================================
        */

        function renderExcavators() {

            const board =
                document.getElementById(
                    "excavatorBoard"
                );


            const excavators =
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
                excavators.length
                +
                " 台"
            );


            board.innerHTML =
                "";


            excavators.forEach(
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



        /*
        =====================================
        卡车
        =====================================
        */

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
                trucks.length
                +
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



            if (selectedExcavatorId) {

                setText(
                    "selectedExcavatorInfo",
                    "当前选择挖机："
                    +
                    selectedExcavatorId
                    +
                    " ｜ 请选择跟随车辆"
                );


                bindTrucksButton.classList.remove(
                    "hidden"
                );

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
        =====================================
        挖机点击
        =====================================
        */

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

                const binding =
                    bindings.find(
                        function (
                            item
                        ) {

                            return (
                                item.excavatorId ===
                                device.id
                            );

                        }
                    );


                if (binding) {

                    showAssignedBindingModal(
                        device,
                        binding
                    );

                }

                else {

                    showAssignedModal(
                        device
                    );

                }


                return;

            }


            selectedExcavatorId =
                device.id;


            selectedTruckIds =
                [];


            renderAll();


            scrollToId(
                "truckSection"
            );

        }



        /*
        =====================================
        卡车点击
        =====================================
        */

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


            if (
                selectedTruckIds.includes(
                    device.id
                )
            ) {

                selectedTruckIds =
                    selectedTruckIds.filter(
                        function (
                            id
                        ) {

                            return (
                                id !==
                                device.id
                            );

                        }
                    );

            }

            else {

                selectedTruckIds.push(
                    device.id
                );

            }


            renderTrucks();

        }



        /*
        =====================================
        绑定关系
        =====================================
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
                    `

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

                    html +=
                        `

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

                            html +=
                                `

                                <div class="binding-truck-item">

                                    🚚
                                    ${escapeHtml(truckId)}

                                </div>

                                `;

                        }
                    );


                    html +=
                        `

                            </div>

                        </div>

                        `;

                }
            );


            container.innerHTML =
                html;

        }



        /*
        =====================================
        辅助车辆下拉
        =====================================
        */

        function renderAuxiliarySelects() {

            fillAvailableSelect(
                "loaderSelect",
                "loader",
                "请选择装载机"
            );


            fillAvailableSelect(
                "waterTruckSelect",
                "water",
                "请选择水车"
            );


            fillAvailableSelect(
                "fuelTruckSelect",
                "fuel",
                "请选择加油车"
            );

        }



        function fillAvailableSelect(
            selectId,
            type,
            placeholder
        ) {

            const select =
                document.getElementById(
                    selectId
                );


            select.innerHTML =
                `

                <option value="">
                    ${placeholder}
                </option>

                `;


            equipment
                .filter(
                    function (
                        item
                    ) {

                        return (
                            item.type ===
                            type
                            &&
                            item.status ===
                            "available"
                        );

                    }
                )
                .forEach(
                    function (
                        item
                    ) {

                        const option =
                            document.createElement(
                                "option"
                            );


                        option.value =
                            item.id;


                        option.textContent =
                            item.id;


                        select.appendChild(
                            option
                        );

                    }
                );

        }



        /*
        =====================================
        确认辅助车辆
        =====================================
        */

        function confirmAuxiliaryVehicle(
            config
        ) {

            const vehicleId =
                getValue(
                    config.vehicleSelectId
                );


            const workType =
                getValue(
                    config.workTypeId
                );


            if (!vehicleId) {

                alert(
                    "请选择"
                    +
                    config.typeName
                );

                return;

            }


            let finalWork =
                workType;


            if (
                workType ===
                "manual"
            ) {

                finalWork =
                    getValue(
                        config.manualInputId
                    );


                if (!finalWork) {

                    alert(
                        "请输入具体工作内容"
                    );

                    return;

                }

            }


            auxiliaryAssignments.push({

                assignmentId:
                    "AUX_"
                    +
                    Date.now(),

                type:
                    config.type,

                typeName:
                    config.typeName,

                vehicleId:
                    vehicleId,

                work:
                    finalWork

            });


            setDeviceStatus(
                vehicleId,
                "assigned"
            );


            setValue(
                config.vehicleSelectId,
                ""
            );


            setValue(
                config.manualInputId,
                ""
            );


            document
                .getElementById(
                    config.manualInputId
                )
                .classList
                .add(
                    "hidden"
                );


            renderAll();


            alert(
                config.typeName
                +
                "已加入任务"
            );

        }



        /*
        =====================================
        已选择辅助车辆
        =====================================
        */

        function renderAuxiliaryAssignments() {

            const container =
                document.getElementById(
                    "auxiliarySelectedList"
                );


            if (
                auxiliaryAssignments.length ===
                0
            ) {

                container.innerHTML =
                    `

                    <div class="empty-placeholder">
                        暂未选择辅助车辆
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

                    html +=
                        `

                        <div class="aux-selected-item">

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


            container.innerHTML =
                html;

        }



        /*
        =====================================
        预览
        =====================================
        */

        function renderTaskPreview() {

            const container =
                document.getElementById(
                    "taskPreviewContent"
                );


            let html =
                `

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

                    <h3>
                        主采设备
                    </h3>

                `;


            bindings.forEach(
                function (
                    binding
                ) {

                    html +=
                        `

                        <div class="preview-binding">

                            <strong>
                                🚜
                                ${escapeHtml(binding.excavatorId)}
                            </strong>

                        `;


                    binding.truckIds.forEach(
                        function (
                            truckId
                        ) {

                            html +=
                                `

                                <span>
                                    └ 🚚
                                    ${escapeHtml(truckId)}
                                </span>

                                `;

                        }
                    );


                    html +=
                        `

                        </div>

                        `;

                }
            );


            html +=
                `

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

                html +=
                    `

                    <p>
                        未配置辅助车辆
                    </p>

                    `;

            }

            else {

                auxiliaryAssignments.forEach(
                    function (
                        item
                    ) {

                        html +=
                            `

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

            }


            html +=
                `

                </div>


                <div class="preview-block">

                    <h3>
                        调度说明
                    </h3>

                    <p>
                        ${escapeHtml(currentTask.remark || "无")}
                    </p>

                </div>

                `;


            container.innerHTML =
                html;

        }



        /*
        =====================================
        设备卡片
        =====================================
        */

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
                "device-card "
                +
                getStatusClass(
                    device.status
                );


            card.innerHTML =
                `

                <strong>
                    ${escapeHtml(device.name)}
                </strong>

                <span>
                    ${getStatusText(device.status)}
                </span>

                `;


            return card;

        }



        /*
        =====================================
        维修弹窗
        =====================================
        */

        function showMaintenanceModal(
            device
        ) {

            const maintenance =
                device.maintenance ||
                {};


            setText(
                "modalTitle",
                device.id
                +
                " · 维修状态"
            );


            document
                .getElementById(
                    "modalContent"
                )
                .innerHTML =
                `

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
                        ${escapeHtml(maintenance.fault || "未填写")}
                    </strong>

                </div>


                <div class="modal-detail-row">

                    <span>
                        开始时间
                    </span>

                    <strong>
                        ${escapeHtml(maintenance.startedAt || "-")}
                    </strong>

                </div>


                <div class="modal-detail-row">

                    <span>
                        预计完成
                    </span>

                    <strong>
                        ${escapeHtml(maintenance.expectedEnd || "-")}
                    </strong>

                </div>


                <div class="modal-detail-row">

                    <span>
                        维修负责人
                    </span>

                    <strong>
                        ${escapeHtml(maintenance.responsible || "-")}
                    </strong>

                </div>

                `;


            showModal();

        }



        /*
        =====================================
        已分配弹窗
        =====================================
        */

        function showAssignedModal(
            device
        ) {

            setText(
                "modalTitle",
                device.id
                +
                " · 已分配任务"
            );


            document
                .getElementById(
                    "modalContent"
                )
                .innerHTML =
                `

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
                        任务
                    </span>

                    <strong>
                        ${escapeHtml(device.assignedTask || currentTask?.area || "当前生产任务")}
                    </strong>

                </div>

                `;


            showModal();

        }



        function showAssignedBindingModal(
            device,
            binding
        ) {

            let trucks =
                binding.truckIds
                    .join(
                        "、"
                    );


            setText(
                "modalTitle",
                device.id
                +
                " · 当前任务"
            );


            document
                .getElementById(
                    "modalContent"
                )
                .innerHTML =
                `

                <div class="modal-detail-row">

                    <span>
                        作业区域
                    </span>

                    <strong>
                        ${escapeHtml(currentTask?.area || "-")}
                    </strong>

                </div>


                <div class="modal-detail-row">

                    <span>
                        班次
                    </span>

                    <strong>
                        ${escapeHtml(currentTask?.shift || "-")}
                    </strong>

                </div>


                <div class="modal-detail-row">

                    <span>
                        挖机
                    </span>

                    <strong>
                        ${escapeHtml(device.id)}
                    </strong>

                </div>


                <div class="modal-detail-row">

                    <span>
                        跟随卡车
                    </span>

                    <strong>
                        ${escapeHtml(trucks)}
                    </strong>

                </div>

                `;


            showModal();

        }



        /*
        =====================================
        辅助方法
        =====================================
        */

        function setDeviceStatus(
            id,
            status
        ) {

            const device =
                equipment.find(
                    function (
                        item
                    ) {

                        return (
                            item.id ===
                            id
                        );

                    }
                );


            if (device) {

                device.status =
                    status;

            }

        }



        function setupManualInputToggle(
            selectId,
            inputId
        ) {

            document
                .getElementById(
                    selectId
                )
                .addEventListener(
                    "change",
                    function () {

                        const input =
                            document
                                .getElementById(
                                    inputId
                                );


                        if (
                            this.value ===
                            "manual"
                        ) {

                            input.classList.remove(
                                "hidden"
                            );

                        }

                        else {

                            input.classList.add(
                                "hidden"
                            );

                        }

                    }
                );

        }

    }
);



/*
=========================================
创建卡车数据
=========================================
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


        let status =
            "available";


        let extra =
            {};


        if (
            i === 5 ||
            i === 12
        ) {

            status =
                "maintenance";


            extra.maintenance = {

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

            status =
                "assigned";


            extra.assignedTask =
                "山二采区生产任务";

        }


        trucks.push({

            id:
                "T-"
                +
                number,

            type:
                "truck",

            name:
                "T-"
                +
                number,

            status:
                status,

            ...extra

        });

    }


    return trucks;

}



/*
=========================================
班次自动判断
08:00 - 20:00 白班
其余 夜班
=========================================
*/

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



/*
=========================================
状态
=========================================
*/

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
        "assigned"
    ) {

        return "device-assigned";

    }


    if (
        status ===
        "maintenance"
    ) {

        return "device-maintenance";

    }


    return "";

}



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
        "assigned"
    ) {

        return "已分配";

    }


    if (
        status ===
        "maintenance"
    ) {

        return "维修中";

    }


    return "未知";

}



/*
=========================================
保存发布任务历史
=========================================
*/

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

    catch (error) {

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



/*
=========================================
通用
=========================================
*/

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


    return element.value.trim();

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

    document
        .getElementById(
            id
        )
        ?.classList
        .remove(
            "hidden"
        );

}



function hideSection(
    id
) {

    document
        .getElementById(
            id
        )
        ?.classList
        .add(
            "hidden"
        );

}



function scrollToId(
    id
) {

    document
        .getElementById(
            id
        )
        ?.scrollIntoView({

            behavior:
                "smooth",

            block:
                "start"

        });

}



function showModal() {

    document
        .getElementById(
            "deviceModal"
        )
        .classList
        .remove(
            "hidden"
        );

}



function hideModal() {

    document
        .getElementById(
            "deviceModal"
        )
        .classList
        .add(
            "hidden"
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
