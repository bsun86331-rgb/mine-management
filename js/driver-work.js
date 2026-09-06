/*
=========================================
矿山管理系统
司机端工作台
driver-work.js V2.0
=========================================
*/


document.addEventListener(
    "DOMContentLoaded",
    function () {

        /*
        =====================================
        读取司机资料
        =====================================
        */

        const profileData =
            localStorage.getItem(
                "driverProfile"
            );


        if (!profileData) {

            location.href =
                "driver-register.html";

            return;

        }


        let profile;


        try {

            profile =
                JSON.parse(
                    profileData
                );

        }

        catch (error) {

            console.error(
                "司机资料读取失败：",
                error
            );


            location.href =
                "driver-register.html";

            return;

        }


        /*
        必须审核通过
        */

        if (
            profile.status !==
            "approved"
        ) {

            location.href =
                "driver-waiting.html";

            return;

        }



        /*
        =====================================
        显示司机资料
        =====================================
        */

        setText(
            "driverName",
            profile.name ||
            "未填写"
        );


        setText(
            "driverPosition",
            profile.position ||
            "卡车司机"
        );


        setText(
            "driverTeam",
            profile.team ||
            "未分配"
        );


        setText(
            "profileName",
            profile.name ||
            "未填写"
        );


        setText(
            "profilePhone",
            profile.phone ||
            "未填写"
        );


        setText(
            "profilePosition",
            profile.position ||
            "卡车司机"
        );


        setText(
            "profileTeam",
            profile.team ||
            "未分配"
        );


        setText(
            "profileEntryDate",
            profile.entryDate ||
            "未填写"
        );


        setText(
            "profileStatus",
            "已通过"
        );



        /*
        =====================================
        获取当前任务
        =====================================
        */

        let currentTask =
            getCurrentTask();


        /*
        =====================================
        页面按钮
        =====================================
        */

        const startWorkButton =
            document.getElementById(
                "startWorkButton"
            );


        const pauseWorkButton =
            document.getElementById(
                "pauseWorkButton"
            );


        const resumeWorkButton =
            document.getElementById(
                "resumeWorkButton"
            );


        const addTripButton =
            document.getElementById(
                "addTripButton"
            );


        const finishShiftButton =
            document.getElementById(
                "finishShiftButton"
            );


        const submitAbnormalButton =
            document.getElementById(
                "submitAbnormalButton"
            );



        /*
        =====================================
        首次刷新
        =====================================
        */

        refreshTask();

        refreshTrips();

        refreshAbnormalRecords();

        refreshWorkingTime();



        /*
        =====================================
        每30秒刷新一次工作时长
        =====================================
        */

        setInterval(
            refreshWorkingTime,
            30000
        );



        /*
        =====================================
        开始作业
        =====================================
        */

        startWorkButton.addEventListener(
            "click",
            function () {

                if (!currentTask) {

                    alert(
                        "当前没有调度任务"
                    );

                    return;

                }


                if (
                    !confirm(
                        "确认开始本次作业吗？"
                    )
                ) {

                    return;

                }


                currentTask.status =
                    "working";


                currentTask.startedAt =
                    currentTask.startedAt ||
                    new Date()
                        .toISOString();


                currentTask.lastResumedAt =
                    new Date()
                        .toISOString();


                saveCurrentTask(
                    currentTask
                );


                refreshTask();

                refreshWorkingTime();

            }
        );



        /*
        =====================================
        暂停作业
        =====================================
        */

        pauseWorkButton.addEventListener(
            "click",
            function () {

                if (!currentTask) {
                    return;
                }


                currentTask.status =
                    "paused";


                currentTask.pausedAt =
                    new Date()
                        .toISOString();


                saveCurrentTask(
                    currentTask
                );


                refreshTask();

            }
        );



        /*
        =====================================
        恢复作业
        =====================================
        */

        resumeWorkButton.addEventListener(
            "click",
            function () {

                if (!currentTask) {
                    return;
                }


                currentTask.status =
                    "working";


                currentTask.lastResumedAt =
                    new Date()
                        .toISOString();


                saveCurrentTask(
                    currentTask
                );


                refreshTask();

            }
        );



        /*
        =====================================
        完成一趟
        =====================================
        */

        addTripButton.addEventListener(
            "click",
            function () {

                if (
                    !currentTask ||
                    currentTask.status !==
                    "working"
                ) {

                    alert(
                        "请先开始作业"
                    );

                    return;

                }


                const records =
                    getTripRecords();


                records.push({

                    id:
                        "TRIP_"
                        +
                        Date.now(),

                    driverId:
                        profile.driverId,

                    driverName:
                        profile.name,

                    vehicleNumber:
                        currentTask.vehicleNumber ||
                        "",

                    excavatorNumber:
                        currentTask.excavatorNumber ||
                        "",

                    workArea:
                        currentTask.workArea ||
                        "",

                    loadingPoint:
                        currentTask.loadingPoint ||
                        "",

                    unloadingPoint:
                        currentTask.unloadingPoint ||
                        "",

                    completedAt:
                        new Date()
                            .toISOString()

                });


                localStorage.setItem(
                    "driverTripRecords",
                    JSON.stringify(
                        records
                    )
                );


                refreshTrips();

            }
        );



        /*
        =====================================
        完成本班
        =====================================
        */

        finishShiftButton.addEventListener(
            "click",
            function () {

                if (!currentTask) {
                    return;
                }


                if (
                    !confirm(
                        "确认完成本班作业吗？"
                    )
                ) {

                    return;

                }


                currentTask.status =
                    "completed";


                currentTask.finishedAt =
                    new Date()
                        .toISOString();


                saveCurrentTask(
                    currentTask
                );


                refreshTask();

                refreshWorkingTime();

            }
        );



        /*
        =====================================
        异常上报
        =====================================
        */

        submitAbnormalButton.addEventListener(
            "click",
            function () {

                const type =
                    document
                        .getElementById(
                            "abnormalType"
                        )
                        .value;


                const description =
                    document
                        .getElementById(
                            "abnormalDescription"
                        )
                        .value
                        .trim();


                if (!type) {

                    alert(
                        "请选择异常类型"
                    );

                    return;

                }


                if (!description) {

                    alert(
                        "请输入异常情况说明"
                    );

                    return;

                }


                const records =
                    getAbnormalRecords();


                records.push({

                    id:
                        "ABNORMAL_"
                        +
                        Date.now(),

                    driverId:
                        profile.driverId,

                    driverName:
                        profile.name,

                    type:
                        type,

                    description:
                        description,

                    vehicleNumber:
                        currentTask
                            ?
                            currentTask.vehicleNumber ||
                            ""
                            :
                            "",

                    workArea:
                        currentTask
                            ?
                            currentTask.workArea ||
                            ""
                            :
                            "",

                    status:
                        "submitted",

                    createdAt:
                        new Date()
                            .toISOString()

                });


                localStorage.setItem(
                    "driverAbnormalRecords",
                    JSON.stringify(
                        records
                    )
                );


                document
                    .getElementById(
                        "abnormalType"
                    )
                    .value =
                    "";


                document
                    .getElementById(
                        "abnormalDescription"
                    )
                    .value =
                    "";


                alert(
                    "异常已上报"
                );


                refreshAbnormalRecords();

            }
        );



        /*
        =====================================
        快捷菜单
        =====================================
        */

        document
            .getElementById(
                "taskShortcut"
            )
            .addEventListener(
                "click",
                function () {

                    scrollToSection(
                        "taskSection"
                    );

                }
            );


        document
            .getElementById(
                "recordShortcut"
            )
            .addEventListener(
                "click",
                function () {

                    scrollToSection(
                        "recordSection"
                    );

                }
            );


        document
            .getElementById(
                "abnormalShortcut"
            )
            .addEventListener(
                "click",
                function () {

                    scrollToSection(
                        "abnormalSection"
                    );

                }
            );


        document
            .getElementById(
                "profileShortcut"
            )
            .addEventListener(
                "click",
                function () {

                    scrollToSection(
                        "profileSection"
                    );

                }
            );



        /*
        =====================================
        刷新当前任务
        =====================================
        */

        function refreshTask() {

            currentTask =
                getCurrentTask();


            const noTaskMessage =
                document.getElementById(
                    "noTaskMessage"
                );


            const taskContent =
                document.getElementById(
                    "taskContent"
                );


            if (!currentTask) {

                noTaskMessage.style.display =
                    "block";


                taskContent.style.display =
                    "none";


                setText(
                    "taskStatus",
                    "待调度"
                );


                updateDriverStatus(
                    "standby"
                );


                return;

            }


            noTaskMessage.style.display =
                "none";


            taskContent.style.display =
                "block";


            setText(
                "taskVehicle",
                currentTask.vehicleNumber ||
                "待分配"
            );


            setText(
                "taskExcavator",
                currentTask.excavatorNumber ||
                "待分配"
            );


            setText(
                "taskArea",
                currentTask.workArea ||
                "待分配"
            );


            setText(
                "taskShift",
                currentTask.shift ||
                "未设置"
            );


            setText(
                "taskLoadingPoint",
                currentTask.loadingPoint ||
                "待分配"
            );


            setText(
                "taskUnloadingPoint",
                currentTask.unloadingPoint ||
                "待分配"
            );


            setText(
                "taskRoute",
                currentTask.route ||
                "未设置"
            );


            setText(
                "taskRemark",
                currentTask.remark ||
                "无"
            );


            updateTaskButtons();

        }



        /*
        =====================================
        更新按钮
        =====================================
        */

        function updateTaskButtons() {

            if (!currentTask) {
                return;
            }


            const status =
                currentTask.status ||
                "assigned";


            startWorkButton.style.display =
                "none";


            pauseWorkButton.style.display =
                "none";


            resumeWorkButton.style.display =
                "none";


            addTripButton.style.display =
                "none";


            finishShiftButton.style.display =
                "none";


            /*
            已分配
            */

            if (
                status ===
                "assigned"
            ) {

                setText(
                    "taskStatus",
                    "待开始"
                );


                startWorkButton.style.display =
                    "block";


                updateDriverStatus(
                    "assigned"
                );

            }


            /*
            作业中
            */

            else if (
                status ===
                "working"
            ) {

                setText(
                    "taskStatus",
                    "作业中"
                );


                pauseWorkButton.style.display =
                    "block";


                addTripButton.style.display =
                    "block";


                finishShiftButton.style.display =
                    "block";


                updateDriverStatus(
                    "working"
                );

            }


            /*
            暂停
            */

            else if (
                status ===
                "paused"
            ) {

                setText(
                    "taskStatus",
                    "已暂停"
                );


                resumeWorkButton.style.display =
                    "block";


                finishShiftButton.style.display =
                    "block";


                updateDriverStatus(
                    "paused"
                );

            }


            /*
            已完成
            */

            else if (
                status ===
                "completed"
            ) {

                setText(
                    "taskStatus",
                    "本班完成"
                );


                updateDriverStatus(
                    "completed"
                );

            }


            else {

                setText(
                    "taskStatus",
                    "待开始"
                );


                startWorkButton.style.display =
                    "block";


                updateDriverStatus(
                    "assigned"
                );

            }

        }



        /*
        =====================================
        顶部司机状态
        =====================================
        */

        function updateDriverStatus(
            status
        ) {

            const badge =
                document.getElementById(
                    "driverStatusBadge"
                );


            badge.className =
                "status-badge";


            if (
                status ===
                "working"
            ) {

                badge.textContent =
                    "作业中";


                badge.classList.add(
                    "status-working"
                );

            }


            else if (
                status ===
                "paused"
            ) {

                badge.textContent =
                    "暂停";


                badge.classList.add(
                    "status-paused"
                );

            }


            else if (
                status ===
                "assigned"
            ) {

                badge.textContent =
                    "任务已下发";


                badge.classList.add(
                    "status-assigned"
                );

            }


            else if (
                status ===
                "completed"
            ) {

                badge.textContent =
                    "本班完成";


                badge.classList.add(
                    "status-completed"
                );

            }


            else {

                badge.textContent =
                    "待命";


                badge.classList.add(
                    "status-standby"
                );

            }

        }



        /*
        =====================================
        今日运输记录
        =====================================
        */

        function refreshTrips() {

            const records =
                getTodayTripRecords();


            setText(
                "todayTrips",
                records.length
            );


            setText(
                "recordCount",
                records.length
                +
                " 趟"
            );


            const list =
                document.getElementById(
                    "tripRecordList"
                );


            if (
                records.length ===
                0
            ) {

                list.innerHTML =
                    `

                    <div class="empty-record">

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

                        const tripNumber =
                            records.length
                            -
                            index;


                        html +=
                            `

                            <div class="record-item">

                                <div class="record-number">

                                    第
                                    ${tripNumber}
                                    趟

                                </div>


                                <div class="record-detail">

                                    <strong>

                                        ${escapeHtml(
                                            record.vehicleNumber ||
                                            "未记录车辆"
                                        )}

                                    </strong>

                                    <span>

                                        ${escapeHtml(
                                            record.loadingPoint ||
                                            "-"
                                        )}

                                        →

                                        ${escapeHtml(
                                            record.unloadingPoint ||
                                            "-"
                                        )}

                                    </span>

                                </div>


                                <div class="record-time">

                                    ${formatTime(
                                        record.completedAt
                                    )}

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
        今日异常记录
        =====================================
        */

        function refreshAbnormalRecords() {

            const records =
                getTodayAbnormalRecords();


            setText(
                "todayAbnormal",
                records.length
            );


            const list =
                document.getElementById(
                    "abnormalRecordList"
                );


            if (
                records.length ===
                0
            ) {

                list.innerHTML =
                    "";


                return;

            }


            let html =
                "<h3>今日已上报</h3>";


            records
                .slice()
                .reverse()
                .forEach(
                    function (
                        record
                    ) {

                        html +=
                            `

                            <div class="abnormal-record-item">

                                <div>

                                    <strong>
                                        ${escapeHtml(
                                            record.type
                                        )}
                                    </strong>

                                    <span>
                                        ${formatTime(
                                            record.createdAt
                                        )}
                                    </span>

                                </div>


                                <p>
                                    ${escapeHtml(
                                        record.description
                                    )}
                                </p>

                            </div>

                            `;

                    }
                );


            list.innerHTML =
                html;

        }



        /*
        =====================================
        作业时长
        =====================================
        */

        function refreshWorkingTime() {

            if (
                !currentTask ||
                !currentTask.startedAt
            ) {

                setText(
                    "workingTime",
                    "00:00"
                );


                return;

            }


            const start =
                new Date(
                    currentTask.startedAt
                )
                    .getTime();


            let end =
                Date.now();


            if (
                currentTask.status ===
                "completed" &&
                currentTask.finishedAt
            ) {

                end =
                    new Date(
                        currentTask.finishedAt
                    )
                        .getTime();

            }


            const difference =
                Math.max(
                    0,
                    end -
                    start
                );


            const totalMinutes =
                Math.floor(
                    difference /
                    60000
                );


            const hours =
                Math.floor(
                    totalMinutes /
                    60
                );


            const minutes =
                totalMinutes %
                60;


            setText(
                "workingTime",
                String(hours)
                    .padStart(
                        2,
                        "0"
                    )
                +
                ":"
                +
                String(minutes)
                    .padStart(
                        2,
                        "0"
                    )
            );

        }



        /*
        =====================================
        获取当前任务
        =====================================
        */

        function getCurrentTask() {

            const taskData =
                localStorage.getItem(
                    "driverCurrentTask"
                );


            if (!taskData) {

                return null;

            }


            try {

                const task =
                    JSON.parse(
                        taskData
                    );


                /*
                如果任务绑定了司机，
                只显示本司机任务
                */

                if (
                    task.driverId &&
                    profile.driverId &&
                    task.driverId !==
                    profile.driverId
                ) {

                    return null;

                }


                return task;

            }

            catch (error) {

                console.error(
                    "任务读取失败：",
                    error
                );


                return null;

            }

        }



        /*
        =====================================
        保存当前任务
        =====================================
        */

        function saveCurrentTask(
            task
        ) {

            localStorage.setItem(
                "driverCurrentTask",
                JSON.stringify(
                    task
                )
            );

        }



        /*
        =====================================
        运输记录
        =====================================
        */

        function getTripRecords() {

            try {

                return JSON.parse(
                    localStorage.getItem(
                        "driverTripRecords"
                    )
                    ||
                    "[]"
                );

            }

            catch (error) {

                return [];

            }

        }



        function getTodayTripRecords() {

            return getTripRecords()
                .filter(
                    function (
                        record
                    ) {

                        return (
                            record.driverId ===
                            profile.driverId
                            &&
                            isToday(
                                record.completedAt
                            )
                        );

                    }
                );

        }



        /*
        =====================================
        异常记录
        =====================================
        */

        function getAbnormalRecords() {

            try {

                return JSON.parse(
                    localStorage.getItem(
                        "driverAbnormalRecords"
                    )
                    ||
                    "[]"
                );

            }

            catch (error) {

                return [];

            }

        }



        function getTodayAbnormalRecords() {

            return getAbnormalRecords()
                .filter(
                    function (
                        record
                    ) {

                        return (
                            record.driverId ===
                            profile.driverId
                            &&
                            isToday(
                                record.createdAt
                            )
                        );

                    }
                );

        }

    }
);



/*
=========================================
通用工具
=========================================
*/


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



function scrollToSection(
    id
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {
        return;
    }


    element.scrollIntoView({

        behavior:
            "smooth",

        block:
            "start"

    });

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


    const date =
        new Date(
            dateString
        );


    return date
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
