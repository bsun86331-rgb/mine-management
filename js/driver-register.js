/*
========================================================
矿山管理系统
司机工作台 driver-work.js V2.7.0

规则：
1. 司机不能自己选车辆
2. 只能领取调度分配的车辆
3. 未领取车辆不能计趟
4. 故障换车申请提交后立即冻结计趟
5. 调度批准新车后自动切换
6. 新车继续原 taskId，累计趟数不清零
========================================================
*/

document.addEventListener("DOMContentLoaded", function () {

    const TASK_KEY =
        "dispatchPublishedTasks";

    const TRIP_KEY =
        "driverTripRecords";

    const CHANGE_KEY =
        "vehicleChangeRequests";

    let driverProfile = null;
    let currentTask = null;
    let currentAssignment = null;
    let currentChangeRequest = null;

    const $ = id =>
        document.getElementById(id);


    initialize();


    function initialize() {

        driverProfile =
            getDriverProfile();


        if (!driverProfile) {

            location.href =
                "driver-register.html";

            return;
        }


        if (
            driverProfile.status ===
            "pending"
        ) {

            location.href =
                "driver-waiting.html";

            return;
        }


        if (
            driverProfile.status !==
            "approved"
        ) {

            location.href =
                "driver-register.html";

            return;
        }


        ensureDriverId();


        renderDriverProfile();

        refreshCurrentWork();

        bindEvents();


        window.addEventListener(
            "storage",
            function () {

                refreshCurrentWork();

            }
        );

    }


    function bindEvents() {

        $("completeTripButton")
            .addEventListener(
                "click",
                completeTrip
            );


        $("applyVehicleChangeButton")
            .addEventListener(
                "click",
                openVehicleChangeModal
            );


        $("cancelVehicleChangeButton")
            .addEventListener(
                "click",
                function () {

                    $("faultReason").value =
                        "";

                    hide(
                        "vehicleChangeModal"
                    );

                }
            );


        $("submitVehicleChangeButton")
            .addEventListener(
                "click",
                submitVehicleChange
            );

    }


    /*
    ========================================================
    当前任务
    ========================================================
    */

    function refreshCurrentWork() {

        const result =
            findCurrentDriverAssignment();


        currentTask =
            result
                ?
                result.task
                :
                null;


        currentAssignment =
            result
                ?
                result.assignment
                :
                null;


        currentChangeRequest =
            findCurrentChangeRequest();


        renderAssignmentArea();

        renderActiveWork();

        renderStatistics();

        renderVehicleChangeStatus();

        renderTripHistory();

    }


    function findCurrentDriverAssignment() {

        const tasks =
            getTasks()
                .filter(
                    function (task) {

                        return (
                            task.status ===
                            "pending" ||
                            task.status ===
                            "active"
                        );

                    }
                );


        const candidates =
            [];


        tasks.forEach(
            function (task) {

                (
                    task.driverAssignments ||
                    []
                ).forEach(
                    function (assignment) {

                        if (
                            String(
                                assignment.driverId
                            ) ===
                            String(
                                driverProfile.driverId
                            ) &&
                            [
                                "assigned",
                                "claimed",
                                "change_pending"
                            ].includes(
                                assignment.status
                            )
                        ) {

                            candidates.push({

                                task:
                                    task,

                                assignment:
                                    assignment

                            });

                        }

                    }
                );

            }
        );


        if (
            candidates.length ===
            0
        ) {

            return null;

        }


        candidates.sort(
            function (a, b) {

                return (
                    new Date(
                        b.assignment.claimedAt ||
                        b.assignment.assignedAt
                    ) -
                    new Date(
                        a.assignment.claimedAt ||
                        a.assignment.assignedAt
                    )
                );

            }
        );


        return candidates[0];

    }


    /*
    ========================================================
    调度分配 / 领取车辆
    ========================================================
    */

    function renderAssignmentArea() {

        const box =
            $("assignmentArea");


        if (
            !currentTask ||
            !currentAssignment
        ) {

            box.innerHTML =
                '<div class="empty-placeholder">调度暂未给你分配车辆</div>';

            return;

        }


        if (
            currentAssignment.status ===
            "assigned"
        ) {

            box.innerHTML = `

                <div class="assigned-vehicle-card">

                    <div>

                        <span>
                            调度分配车辆
                        </span>

                        <strong>
                            🚚
                            ${escapeHtml(
                                currentAssignment.truckId
                            )}
                        </strong>

                    </div>


                    <div>

                        <span>
                            跟随挖机
                        </span>

                        <strong>
                            🚜
                            ${escapeHtml(
                                currentAssignment.excavatorId
                            )}
                        </strong>

                    </div>


                    <div>

                        <span>
                            作业区域
                        </span>

                        <strong>
                            ${escapeHtml(
                                currentTask.area
                            )}
                        </strong>

                    </div>


                    <button
                        id="claimVehicleButton"
                        type="button"
                        class="claim-button"
                    >
                        领取车辆
                    </button>

                </div>

            `;


            $("claimVehicleButton")
                .addEventListener(
                    "click",
                    claimAssignedVehicle
                );

        }

        else {

            box.innerHTML = `

                <div class="claimed-summary">

                    <span>
                        当前已领取
                    </span>

                    <strong>
                        🚚
                        ${escapeHtml(
                            currentAssignment.truckId
                        )}
                    </strong>

                    <small>
                        ${
                            currentAssignment.status ===
                            "change_pending"
                                ?
                                "等待调度换车审批"
                                :
                                "已领取"
                        }
                    </small>

                </div>

            `;

        }

    }


    function claimAssignedVehicle() {

        if (
            !currentTask ||
            !currentAssignment
        ) {

            return;

        }


        if (
            currentAssignment.status !==
            "assigned"
        ) {

            return;

        }


        if (
            !confirm(
                "确认领取车辆 " +
                currentAssignment.truckId +
                " 吗？"
            )
        ) {

            return;

        }


        const tasks =
            getTasks();


        const task =
            tasks.find(
                function (item) {

                    return (
                        item.taskId ===
                        currentTask.taskId
                    );

                }
            );


        if (!task) {

            return;

        }


        const assignment =
            (
                task.driverAssignments ||
                []
            ).find(
                function (item) {

                    return (
                        item.assignmentId ===
                        currentAssignment.assignmentId
                    );

                }
            );


        if (!assignment) {

            return;

        }


        assignment.status =
            "claimed";


        assignment.claimedAt =
            new Date()
                .toISOString();


        saveTasks(
            tasks
        );


        refreshCurrentWork();


        alert(
            "车辆领取成功。\n现在可以开始记录运输趟数。"
        );

    }


    /*
    ========================================================
    当前作业显示
    ========================================================
    */

    function renderActiveWork() {

        if (
            !currentTask ||
            !currentAssignment ||
            currentAssignment.status ===
            "assigned"
        ) {

            hide(
                "activeWorkSection"
            );

            return;

        }


        show(
            "activeWorkSection"
        );


        text(
            "workArea",
            currentTask.area
        );


        text(
            "workVehicle",
            currentAssignment.truckId
        );


        text(
            "workExcavator",
            currentAssignment.excavatorId
        );


        text(
            "workShift",
            currentTask.shift
        );


        text(
            "activeTaskStatusText",
            currentTask.status ===
            "active"
                ?
                "任务执行中"
                :
                "待执行 · 完成第一趟后自动进入执行中"
        );


        const locked =
            currentAssignment.status ===
            "change_pending" ||
            (
                currentChangeRequest &&
                currentChangeRequest.status ===
                "pending"
            );


        $("completeTripButton").disabled =
            locked;


        $("applyVehicleChangeButton").disabled =
            locked;


        if (locked) {

            show(
                "changePendingWarning"
            );


            text(
                "workStatusBadge",
                "等待审批"
            );


            $("completeTripButton").textContent =
                "🔒 等待调度审批，禁止计趟";

        }

        else {

            hide(
                "changePendingWarning"
            );


            text(
                "workStatusBadge",
                "作业中"
            );


            $("completeTripButton").textContent =
                "✅ 完成一趟";

        }

    }


    /*
    ========================================================
    完成一趟
    ========================================================
    */

    function completeTrip() {

        refreshCurrentWork();


        if (
            !currentTask ||
            !currentAssignment
        ) {

            alert(
                "当前没有调度任务。"
            );

            return;

        }


        if (
            currentAssignment.status !==
            "claimed"
        ) {

            alert(
                "车辆尚未领取，或者正在等待换车审批。"
            );

            return;

        }


        if (
            hasPendingChangeRequest()
        ) {

            alert(
                "换车申请正在等待调度审批，暂时不能记录趟数。"
            );

            return;

        }


        if (
            !taskStillContainsVehicle(
                currentTask,
                currentAssignment.truckId,
                currentAssignment.excavatorId
            )
        ) {

            alert(
                "当前车辆已经不在调度任务中，请刷新后联系调度。"
            );

            return;

        }


        if (
            !confirm(
                "确认完成一趟运输吗？"
            )
        ) {

            return;

        }


        const trips =
            getTrips();


        trips.push({

            tripId:
                "TRIP_" +
                Date.now(),

            taskId:
                currentTask.taskId,

            dispatchTaskId:
                currentTask.taskId,

            driverId:
                driverProfile.driverId,

            driverName:
                driverProfile.name,

            vehicleId:
                currentAssignment.truckId,

            vehicleNumber:
                currentAssignment.truckId,

            truckId:
                currentAssignment.truckId,

            excavatorId:
                currentAssignment.excavatorId,

            area:
                currentTask.area,

            shift:
                currentTask.shift,

            completedAt:
                new Date()
                    .toISOString(),

            createdAt:
                new Date()
                    .toISOString()

        });


        saveTrips(
            trips
        );


        activateTaskIfNeeded(
            currentTask.taskId
        );


        refreshCurrentWork();


        const myTrips =
            getMyCurrentTaskTrips();


        alert(
            "本趟记录成功。\n你在当前任务已完成 " +
            myTrips.length +
            " 趟。"
        );

    }


    function activateTaskIfNeeded(
        taskId
    ) {

        const tasks =
            getTasks();


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


        if (
            task.status ===
            "pending"
        ) {

            task.status =
                "active";

            task.startedAt =
                new Date()
                    .toISOString();

        }


        task.transportTripCount =
            getTaskTrips(
                taskId
            ).length;


        saveTasks(
            tasks
        );

    }


    /*
    ========================================================
    车辆故障 / 换车
    ========================================================
    */

    function openVehicleChangeModal() {

        refreshCurrentWork();


        if (
            !currentTask ||
            !currentAssignment
        ) {

            return;

        }


        if (
            currentAssignment.status !==
            "claimed"
        ) {

            alert(
                "当前状态不能申请换车。"
            );

            return;

        }


        if (
            hasPendingChangeRequest()
        ) {

            alert(
                "已经存在待审批的换车申请。"
            );

            return;

        }


        text(
            "faultCurrentVehicle",
            currentAssignment.truckId
        );


        $("faultReason").value =
            "";


        show(
            "vehicleChangeModal"
        );

    }


    function submitVehicleChange() {

        const reason =
            $("faultReason").value
                .trim();


        if (!reason) {

            alert(
                "请输入车辆故障原因。"
            );

            return;

        }


        if (
            !currentTask ||
            !currentAssignment
        ) {

            return;

        }


        if (
            currentAssignment.status !==
            "claimed"
        ) {

            alert(
                "当前车辆状态不能提交换车申请。"
            );

            return;

        }


        if (
            !confirm(
                "提交后将立即暂停运输计趟，必须等待调度审批。确认提交吗？"
            )
        ) {

            return;

        }


        const requests =
            getChangeRequests();


        const request = {

            requestId:
                "VCR_" +
                Date.now(),

            taskId:
                currentTask.taskId,

            area:
                currentTask.area,

            shift:
                currentTask.shift,

            driverId:
                driverProfile.driverId,

            driverName:
                driverProfile.name,

            assignmentId:
                currentAssignment.assignmentId,

            oldVehicleId:
                currentAssignment.truckId,

            excavatorId:
                currentAssignment.excavatorId,

            reason:
                reason,

            status:
                "pending",

            requestedAt:
                new Date()
                    .toISOString()

        };


        requests.push(
            request
        );


        saveChangeRequests(
            requests
        );


        const tasks =
            getTasks();


        const task =
            tasks.find(
                function (item) {

                    return (
                        item.taskId ===
                        currentTask.taskId
                    );

                }
            );


        if (task) {

            const assignment =
                (
                    task.driverAssignments ||
                    []
                ).find(
                    function (item) {

                        return (
                            item.assignmentId ===
                            currentAssignment.assignmentId
                        );

                    }
                );


            if (assignment) {

                assignment.status =
                    "change_pending";

                assignment.changeRequestedAt =
                    request.requestedAt;

            }


            saveTasks(
                tasks
            );

        }


        hide(
            "vehicleChangeModal"
        );


        refreshCurrentWork();


        alert(
            "换车申请已提交。\n现在运输计趟已经暂停，请等待调度审批。"
        );

    }


    function hasPendingChangeRequest() {

        return getChangeRequests()
            .some(
                function (request) {

                    return (
                        request.driverId ===
                        driverProfile.driverId &&
                        request.status ===
                        "pending"
                    );

                }
            );

    }


    function findCurrentChangeRequest() {

        const requests =
            getChangeRequests()
                .filter(
                    function (request) {

                        return (
                            String(
                                request.driverId
                            ) ===
                            String(
                                driverProfile.driverId
                            )
                        );

                    }
                )
                .sort(
                    function (a, b) {

                        return (
                            new Date(
                                b.requestedAt
                            ) -
                            new Date(
                                a.requestedAt
                            )
                        );

                    }
                );


        return (
            requests[0] ||
            null
        );

    }


    function renderVehicleChangeStatus() {

        const box =
            $("vehicleChangeStatusArea");


        const requests =
            getChangeRequests()
                .filter(
                    function (request) {

                        return (
                            String(
                                request.driverId
                            ) ===
                            String(
                                driverProfile.driverId
                            )
                        );

                    }
                )
                .sort(
                    function (a, b) {

                        return (
                            new Date(
                                b.requestedAt
                            ) -
                            new Date(
                                a.requestedAt
                            )
                        );

                    }
                )
                .slice(
                    0,
                    5
                );


        if (
            requests.length ===
            0
        ) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无换车申请</div>';

            return;

        }


        box.innerHTML =
            requests
                .map(
                    function (request) {

                        let statusText =
                            "等待调度审批";


                        if (
                            request.status ===
                            "approved"
                        ) {

                            statusText =
                                "已批准：" +
                                request.oldVehicleId +
                                " → " +
                                request.newVehicleId;

                        }


                        if (
                            request.status ===
                            "rejected"
                        ) {

                            statusText =
                                "调度已拒绝";

                        }


                        return `

                            <div class="change-status-card ${escapeHtml(
                                request.status
                            )}">

                                <div>

                                    <strong>
                                        ${escapeHtml(
                                            request.oldVehicleId
                                        )}
                                    </strong>

                                    <span>
                                        ${escapeHtml(
                                            request.reason
                                        )}
                                    </span>

                                </div>

                                <div>

                                    <strong>
                                        ${escapeHtml(
                                            statusText
                                        )}
                                    </strong>

                                    <small>
                                        ${format(
                                            request.requestedAt
                                        )}
                                    </small>

                                </div>

                            </div>

                        `;

                    }
                )
                .join("");

    }


    /*
    ========================================================
    统计
    ========================================================
    */

    function renderStatistics() {

        const allTrips =
            getTrips();


        const today =
            localDateKey(
                new Date()
            );


        const todayMine =
            allTrips.filter(
                function (trip) {

                    return (
                        String(
                            trip.driverId
                        ) ===
                        String(
                            driverProfile.driverId
                        ) &&
                        localDateKey(
                            new Date(
                                trip.completedAt ||
                                trip.createdAt
                            )
                        ) ===
                        today
                    );

                }
            );


        text(
            "todayTripCount",
            todayMine.length
        );


        if (!currentTask) {

            text(
                "currentTaskTripCount",
                "0"
            );


            text(
                "myTaskTripCount",
                "0"
            );


            return;

        }


        text(
            "currentTaskTripCount",
            getTaskTrips(
                currentTask.taskId
            ).length
        );


        text(
            "myTaskTripCount",
            getMyCurrentTaskTrips()
                .length
        );

    }


    function renderTripHistory() {

        const box =
            $("tripHistoryList");


        const trips =
            getTrips()
                .filter(
                    function (trip) {

                        return (
                            String(
                                trip.driverId
                            ) ===
                            String(
                                driverProfile.driverId
                            )
                        );

                    }
                )
                .sort(
                    function (a, b) {

                        return (
                            new Date(
                                b.completedAt ||
                                b.createdAt
                            ) -
                            new Date(
                                a.completedAt ||
                                a.createdAt
                            )
                        );

                    }
                )
                .slice(
                    0,
                    10
                );


        if (
            trips.length ===
            0
        ) {

            box.innerHTML =
                '<div class="empty-placeholder">暂无运输记录</div>';

            return;

        }


        box.innerHTML =
            trips
                .map(
                    function (
                        trip,
                        index
                    ) {

                        return `

                            <div class="trip-history-row">

                                <div>

                                    <strong>
                                        🚚
                                        ${escapeHtml(
                                            trip.vehicleId ||
                                            trip.vehicleNumber
                                        )}
                                    </strong>

                                    <span>
                                        🚜
                                        ${escapeHtml(
                                            trip.excavatorId
                                        )}
                                    </span>

                                </div>

                                <div>

                                    <strong>
                                        已完成
                                    </strong>

                                    <span>
                                        ${format(
                                            trip.completedAt
                                        )}
                                    </span>

                                </div>

                            </div>

                        `;

                    }
                )
                .join("");

    }


    /*
    ========================================================
    司机资料
    ========================================================
    */

    function renderDriverProfile() {

        text(
            "driverName",
            driverProfile.name ||
            "司机"
        );


        text(
            "driverTeam",
            driverProfile.team ||
            "未设置车队"
        );


        text(
            "currentShift",
            getDefaultShift()
        );

    }


    function getDriverProfile() {

        try {

            return JSON.parse(
                localStorage.getItem(
                    "driverProfile"
                ) ||
                "null"
            );

        }

        catch (
            error
        ) {

            return null;

        }

    }


    function ensureDriverId() {

        if (
            driverProfile.driverId
        ) {

            return;

        }


        driverProfile.driverId =
            "DRIVER_" +
            Date.now();


        localStorage.setItem(
            "driverProfile",
            JSON.stringify(
                driverProfile
            )
        );

    }


    /*
    ========================================================
    数据
    ========================================================
    */

    function getTasks() {

        try {

            const data =
                JSON.parse(
                    localStorage.getItem(
                        TASK_KEY
                    ) ||
                    "[]"
                );


            return (
                Array.isArray(
                    data
                )
                    ?
                    data
                    :
                    []
            );

        }

        catch (
            error
        ) {

            return [];

        }

    }


    function saveTasks(
        data
    ) {

        localStorage.setItem(
            TASK_KEY,
            JSON.stringify(
                data
            )
        );

    }


    function getTrips() {

        try {

            const data =
                JSON.parse(
                    localStorage.getItem(
                        TRIP_KEY
                    ) ||
                    "[]"
                );


            return (
                Array.isArray(
                    data
                )
                    ?
                    data
                    :
                    []
            );

        }

        catch (
            error
        ) {

            return [];

        }

    }


    function saveTrips(
        trips
    ) {

        localStorage.setItem(
            TRIP_KEY,
            JSON.stringify(
                trips
            )
        );

    }


    function getTaskTrips(
        taskId
    ) {

        return getTrips()
            .filter(
                function (trip) {

                    return (
                        String(
                            trip.taskId ||
                            trip.dispatchTaskId
                        ) ===
                        String(
                            taskId
                        )
                    );

                }
            );

    }


    function getMyCurrentTaskTrips() {

        if (!currentTask) {

            return [];

        }


        return getTaskTrips(
            currentTask.taskId
        )
            .filter(
                function (trip) {

                    return (
                        String(
                            trip.driverId
                        ) ===
                        String(
                            driverProfile.driverId
                        )
                    );

                }
            );

    }


    function getChangeRequests() {

        try {

            const data =
                JSON.parse(
                    localStorage.getItem(
                        CHANGE_KEY
                    ) ||
                    "[]"
                );


            return (
                Array.isArray(
                    data
                )
                    ?
                    data
                    :
                    []
            );

        }

        catch (
            error
        ) {

            return [];

        }

    }


    function saveChangeRequests(
        data
    ) {

        localStorage.setItem(
            CHANGE_KEY,
            JSON.stringify(
                data
            )
        );

    }


    function taskStillContainsVehicle(
        task,
        vehicleId,
        excavatorId
    ) {

        const binding =
            (
                task.bindings ||
                []
            ).find(
                function (item) {

                    return (
                        item.excavatorId ===
                        excavatorId
                    );

                }
            );


        return (
            !!binding &&
            (
                binding.truckIds ||
                []
            ).includes(
                vehicleId
            )
        );

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


    function localDateKey(
        date
    ) {

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";

        }


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


    function format(
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


    function text(
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


    function show(
        id
    ) {

        const element =
            $(id);


        if (element) {

            element.classList.remove(
                "hidden"
            );

        }

    }


    function hide(
        id
    ) {

        const element =
            $(id);


        if (element) {

            element.classList.add(
                "hidden"
            );

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

});
