/*
=========================================
矿山管理系统
调度端
dispatch.js V1.0
=========================================
*/


document.addEventListener(
    "DOMContentLoaded",
    function () {

        const driverSelect =
            document.getElementById(
                "dispatchDriver"
            );


        const assignTaskButton =
            document.getElementById(
                "assignTaskButton"
            );


        const editTaskButton =
            document.getElementById(
                "editTaskButton"
            );


        const cancelTaskButton =
            document.getElementById(
                "cancelTaskButton"
            );


        let approvedDrivers =
            getApprovedDrivers();


        /*
        =====================================
        加载司机
        =====================================
        */

        loadDrivers();


        /*
        =====================================
        首次刷新
        =====================================
        */

        refreshDashboard();



        /*
        =====================================
        下发任务
        =====================================
        */

        assignTaskButton.addEventListener(
            "click",
            function () {

                const driverId =
                    driverSelect.value;


                const selectedDriver =
                    approvedDrivers.find(
                        function (
                            driver
                        ) {

                            return (
                                driver.driverId ===
                                driverId
                            );

                        }
                    );


                const vehicleNumber =
                    getValue(
                        "vehicleNumber"
                    );


                const excavatorNumber =
                    getValue(
                        "excavatorNumber"
                    );


                const shift =
                    getValue(
                        "shift"
                    );


                const workArea =
                    getValue(
                        "workArea"
                    );


                const loadingPoint =
                    getValue(
                        "loadingPoint"
                    );


                const unloadingPoint =
                    getValue(
                        "unloadingPoint"
                    );


                const route =
                    getValue(
                        "route"
                    );


                const remark =
                    getValue(
                        "dispatchRemark"
                    );


                if (!selectedDriver) {

                    alert(
                        "请选择司机"
                    );

                    return;

                }


                if (!vehicleNumber) {

                    alert(
                        "请输入车辆编号"
                    );

                    return;

                }


                if (!excavatorNumber) {

                    alert(
                        "请输入跟随挖机编号"
                    );

                    return;

                }


                if (!shift) {

                    alert(
                        "请选择班次"
                    );

                    return;

                }


                if (!workArea) {

                    alert(
                        "请输入作业区域"
                    );

                    return;

                }


                if (!loadingPoint) {

                    alert(
                        "请输入装载点"
                    );

                    return;

                }


                if (!unloadingPoint) {

                    alert(
                        "请输入卸载点"
                    );

                    return;

                }


                const oldTask =
                    getCurrentTask();


                /*
                如果司机正在作业
                防止直接覆盖
                */

                if (
                    oldTask &&
                    oldTask.status ===
                    "working"
                ) {

                    const overwrite =
                        confirm(
                            "当前司机存在正在执行的任务。\n\n确认要重新下发并覆盖当前任务吗？"
                        );


                    if (!overwrite) {

                        return;

                    }

                }


                const task = {

                    taskId:
                        "TASK_"
                        +
                        Date.now(),

                    driverId:
                        selectedDriver.driverId,

                    driverName:
                        selectedDriver.name,

                    driverTeam:
                        selectedDriver.team,

                    vehicleNumber:
                        vehicleNumber,

                    excavatorNumber:
                        excavatorNumber,

                    shift:
                        shift,

                    workArea:
                        workArea,

                    loadingPoint:
                        loadingPoint,

                    unloadingPoint:
                        unloadingPoint,

                    route:
                        route,

                    remark:
                        remark,

                    status:
                        "assigned",

                    assignedAt:
                        new Date()
                            .toISOString()

                };


                localStorage.setItem(
                    "driverCurrentTask",
                    JSON.stringify(
                        task
                    )
                );


                saveTaskHistory(
                    task
                );


                alert(
                    "生产任务已下发给司机："
                    +
                    selectedDriver.name
                );


                clearTaskForm();


                refreshDashboard();

            }
        );



        /*
        =====================================
        修改任务
        =====================================
        */

        editTaskButton.addEventListener(
            "click",
            function () {

                const task =
                    getCurrentTask();


                if (!task) {

                    return;

                }


                driverSelect.value =
                    task.driverId ||
                    "";


                setValue(
                    "vehicleNumber",
                    task.vehicleNumber
                );


                setValue(
                    "excavatorNumber",
                    task.excavatorNumber
                );


                setValue(
                    "shift",
                    task.shift
                );


                setValue(
                    "workArea",
                    task.workArea
                );


                setValue(
                    "loadingPoint",
                    task.loadingPoint
                );


                setValue(
                    "unloadingPoint",
                    task.unloadingPoint
                );


                setValue(
                    "route",
                    task.route
                );


                setValue(
                    "dispatchRemark",
                    task.remark
                );


                document
                    .getElementById(
                        "assignTaskSection"
                    )
                    .scrollIntoView({

                        behavior:
                            "smooth",

                        block:
                            "start"

                    });


                assignTaskButton.textContent =
                    "📤 保存并重新下发任务";

            }
        );



        /*
        =====================================
        取消任务
        =====================================
        */

        cancelTaskButton.addEventListener(
            "click",
            function () {

                const task =
                    getCurrentTask();


                if (!task) {

                    return;

                }


                const confirmed =
                    confirm(
                        "确认取消当前生产任务吗？"
                    );


                if (!confirmed) {

                    return;

                }


                task.status =
                    "cancelled";


                task.cancelledAt =
                    new Date()
                        .toISOString();


                saveTaskHistory(
                    task
                );


                localStorage.removeItem(
                    "driverCurrentTask"
                );


                alert(
                    "当前任务已取消"
                );


                refreshDashboard();

            }
        );



        /*
        =====================================
        加载可调度司机
        =====================================
        */

        function loadDrivers() {

            driverSelect.innerHTML =
                `

                <option value="">
                    请选择司机
                </option>

                `;


            approvedDrivers.forEach(
                function (
                    driver
                ) {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        driver.driverId;


                    option.textContent =
                        driver.name
                        +
                        " · "
                        +
                        (
                            driver.team ||
                            "未分车队"
                        );


                    driverSelect.appendChild(
                        option
                    );

                }
            );

        }



        /*
        =====================================
        刷新调度页面
        =====================================
        */

        function refreshDashboard() {

            approvedDrivers =
                getApprovedDrivers();


            loadDrivers();


            setText(
                "approvedDriverCount",
                approvedDrivers.length
            );


            refreshCurrentTask();

            refreshTripRecords();

            refreshAbnormalRecords();

        }



        /*
        =====================================
        当前任务
        =====================================
        */

        function refreshCurrentTask() {

            const task =
                getCurrentTask();


            const noCurrentTask =
                document.getElementById(
                    "noCurrentTask"
                );


            const currentTaskCard =
                document.getElementById(
                    "currentTaskCard"
                );


            if (!task) {

                noCurrentTask.style.display =
                    "block";


                currentTaskCard.style.display =
                    "none";


                setText(
                    "activeTaskCount",
                    0
                );


                setCurrentStatusBadge(
                    "无任务",
                    "none"
                );


                return;

            }


            noCurrentTask.style.display =
                "none";


            currentTaskCard.style.display =
                "block";


            setText(
                "activeTaskCount",
                1
            );


            setText(
                "currentDriver",
                task.driverName ||
                "-"
            );


            setText(
                "currentVehicle",
                task.vehicleNumber ||
                "-"
            );


            setText(
                "currentExcavator",
                task.excavatorNumber ||
                "-"
            );


            setText(
                "currentShift",
                task.shift ||
                "-"
            );


            setText(
                "currentArea",
                task.workArea ||
                "-"
            );


            setText(
                "currentLoadingPoint",
                task.loadingPoint ||
                "-"
            );


            setText(
                "currentUnloadingPoint",
                task.unloadingPoint ||
                "-"
            );


            setText(
                "currentRoute",
                task.route ||
                "未填写"
            );


            setText(
                "currentRemark",
                task.remark ||
                "无"
            );


            const statusText =
                getTaskStatusText(
                    task.status
                );


            setText(
                "currentStatusText",
                statusText
            );


            setCurrentStatusBadge(
                statusText,
                task.status
            );

        }



        /*
        =====================================
        今日运输记录
        =====================================
        */

        function refreshTripRecords() {

            const records =
                getTodayTripRecords();


            setText(
                "todayTripCount",
                records.length
            );


            setText(
                "tripSummary",
                records.length
                +
                " 趟"
            );


            const list =
                document.getElementById(
                    "dispatchTripList"
                );


            if (
                records.length ===
                0
            ) {

                list.innerHTML =
                    `

                    <div class="dispatch-empty-record">

                        暂无运输记录

                    </div>

                    `;


                return;

            }


            let html =
                "";


            records
                .slice()
                .reverse()
                .forEach(
                    function (
                        record,
                        index
                    ) {

                        const number =
                            records.length
                            -
                            index;


                        html +=
                            `

                            <div class="dispatch-record-item">

                                <div class="dispatch-record-left">

                                    <strong>
                                        第 ${number} 趟
                                    </strong>

                                    <span>
                                        ${escapeHtml(record.driverName || "-")}
                                        ·
                                        ${escapeHtml(record.vehicleNumber || "-")}
                                    </span>

                                </div>


                                <div class="dispatch-record-middle">

                                    <span>
                                        ${escapeHtml(record.loadingPoint || "-")}
                                    </span>

                                    <b>
                                        →
                                    </b>

                                    <span>
                                        ${escapeHtml(record.unloadingPoint || "-")}
                                    </span>

                                </div>


                                <div class="dispatch-record-time">

                                    ${formatTime(record.completedAt)}

                                </div>

                            </div>

                            `;

                    }
                );


            list.innerHTML =
                html;

        }



        /*
        =====================================
        今日异常
        =====================================
        */

        function refreshAbnormalRecords() {

            const records =
                getTodayAbnormalRecords();


            setText(
                "abnormalCount",
                records.length
            );


            setText(
                "abnormalSummary",
                records.length
                +
                " 条"
            );


            const list =
                document.getElementById(
                    "dispatchAbnormalList"
                );


            if (
                records.length ===
                0
            ) {

                list.innerHTML =
                    `

                    <div class="dispatch-empty-record">

                        今日暂无异常

                    </div>

                    `;


                return;

            }


            let html =
                "";


            records
                .slice()
                .reverse()
                .forEach(
                    function (
                        record
                    ) {

                        html +=
                            `

                            <div class="dispatch-abnormal-item">

                                <div class="dispatch-abnormal-title">

                                    <strong>
                                        ⚠️
                                        ${escapeHtml(record.type || "异常")}
                                    </strong>

                                    <span>
                                        ${formatTime(record.createdAt)}
                                    </span>

                                </div>


                                <div class="dispatch-abnormal-meta">

                                    ${escapeHtml(record.driverName || "-")}

                                    ·

                                    ${escapeHtml(record.vehicleNumber || "未分配车辆")}

                                    ·

                                    ${escapeHtml(record.workArea || "未记录区域")}

                                </div>


                                <p>
                                    ${escapeHtml(record.description || "")}
                                </p>

                            </div>

                            `;

                    }
                );


            list.innerHTML =
                html;

        }

    }
);



/*
=========================================
读取已审核司机
=========================================
*/

function getApprovedDrivers() {

    const drivers =
        [];


    /*
    目前登记系统是单司机测试版
    */

    const data =
        localStorage.getItem(
            "driverProfile"
        );


    if (data) {

        try {

            const profile =
                JSON.parse(
                    data
                );


            if (
                profile.status ===
                "approved"
            ) {

                drivers.push(
                    profile
                );

            }

        }

        catch (error) {

            console.error(
                "司机资料读取失败：",
                error
            );

        }

    }


    /*
    为以后多人版保留兼容
    */

    const personnelData =
        localStorage.getItem(
            "personnelRecords"
        );


    if (personnelData) {

        try {

            const records =
                JSON.parse(
                    personnelData
                );


            if (
                Array.isArray(
                    records
                )
            ) {

                records.forEach(
                    function (
                        person
                    ) {

                        if (
                            person.status ===
                            "approved"
                            &&
                            !drivers.some(
                                function (
                                    driver
                                ) {

                                    return (
                                        driver.driverId ===
                                        person.driverId
                                    );

                                }
                            )
                        ) {

                            drivers.push(
                                person
                            );

                        }

                    }
                );

            }

        }

        catch (error) {

            console.error(
                "人员汇总资料读取失败：",
                error
            );

        }

    }


    return drivers;

}



/*
=========================================
当前任务
=========================================
*/

function getCurrentTask() {

    const data =
        localStorage.getItem(
            "driverCurrentTask"
        );


    if (!data) {

        return null;

    }


    try {

        return JSON.parse(
            data
        );

    }

    catch (error) {

        return null;

    }

}



/*
=========================================
保存任务历史
=========================================
*/

function saveTaskHistory(
    task
) {

    let history =
        [];


    try {

        history =
            JSON.parse(
                localStorage.getItem(
                    "dispatchTaskHistory"
                )
                ||
                "[]"
            );

    }

    catch (error) {

        history =
            [];

    }


    history.push({

        ...task,

        historySavedAt:
            new Date()
                .toISOString()

    });


    localStorage.setItem(
        "dispatchTaskHistory",
        JSON.stringify(
            history
        )
    );

}



/*
=========================================
运输记录
=========================================
*/

function getTodayTripRecords() {

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


    return records.filter(
        function (
            record
        ) {

            return isToday(
                record.completedAt
            );

        }
    );

}



/*
=========================================
异常记录
=========================================
*/

function getTodayAbnormalRecords() {

    let records =
        [];


    try {

        records =
            JSON.parse(
                localStorage.getItem(
                    "driverAbnormalRecords"
                )
                ||
                "[]"
            );

    }

    catch (error) {

        records =
            [];

    }


    return records.filter(
        function (
            record
        ) {

            return isToday(
                record.createdAt
            );

        }
    );

}



/*
=========================================
任务状态
=========================================
*/

function getTaskStatusText(
    status
) {

    if (
        status ===
        "assigned"
    ) {

        return "待司机开始";

    }


    if (
        status ===
        "working"
    ) {

        return "作业中";

    }


    if (
        status ===
        "paused"
    ) {

        return "司机暂停";

    }


    if (
        status ===
        "completed"
    ) {

        return "本班完成";

    }


    if (
        status ===
        "cancelled"
    ) {

        return "已取消";

    }


    return "未知状态";

}



function setCurrentStatusBadge(
    text,
    status
) {

    const badge =
        document.getElementById(
            "currentTaskStatus"
        );


    if (!badge) {
        return;
    }


    badge.textContent =
        text;


    badge.className =
        "dispatch-status";


    if (
        status ===
        "working"
    ) {

        badge.classList.add(
            "status-working"
        );

    }


    else if (
        status ===
        "paused"
    ) {

        badge.classList.add(
            "status-paused"
        );

    }


    else if (
        status ===
        "assigned"
    ) {

        badge.classList.add(
            "status-assigned"
        );

    }


    else if (
        status ===
        "completed"
    ) {

        badge.classList.add(
            "status-completed"
        );

    }


    else {

        badge.classList.add(
            "status-none"
        );

    }

}



/*
=========================================
表单
=========================================
*/

function clearTaskForm() {

    setValue(
        "dispatchDriver",
        ""
    );


    setValue(
        "vehicleNumber",
        ""
    );


    setValue(
        "excavatorNumber",
        ""
    );


    setValue(
        "shift",
        ""
    );


    setValue(
        "workArea",
        ""
    );


    setValue(
        "loadingPoint",
        ""
    );


    setValue(
        "unloadingPoint",
        ""
    );


    setValue(
        "route",
        ""
    );


    setValue(
        "dispatchRemark",
        ""
    );


    const button =
        document.getElementById(
            "assignTaskButton"
        );


    if (button) {

        button.textContent =
            "📤 下发生产任务";

    }

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



function isToday(
    dateString
) {

    if (!dateString) {

        return false;

    }


    const date =
        new Date(
            dateString
        );


    const today =
        new Date();


    return (
        date.getFullYear() ===
        today.getFullYear()
        &&
        date.getMonth() ===
        today.getMonth()
        &&
        date.getDate() ===
        today.getDate()
    );

}



function formatTime(
    dateString
) {

    if (!dateString) {

        return "-";

    }


    return new Date(
        dateString
    )
        .toLocaleTimeString(
            "zh-CN",
            {

                hour:
                    "2-digit",

                minute:
                    "2-digit"

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
            value ||
            ""
        );


    return div.innerHTML;

}
