/*
=========================================
矿山管理系统
司机端 V2.8.0
GPS定位 + 趟次校验 + 故障换车审批
=========================================
*/

document.addEventListener("DOMContentLoaded", function () {

    const STORAGE = {
        PROFILE: "driverProfile",
        CURRENT_TASK: "driverCurrentTask",
        TRIPS: "driverTripRecords",
        CHANGE_REQUESTS: "driverVehicleChangeRequests",
        GPS_LAST: "driverLastGpsPosition"
    };

    let profile = readJson(STORAGE.PROFILE, null);

    if (!profile) {
        location.href = "driver-register.html";
        return;
    }

    if (profile.status !== "approved") {
        location.href = "driver-waiting.html";
        return;
    }

    let currentTask = null;
    let gpsWatchId = null;
    let lastPosition = null;


    /*
    =====================================
    页面元素
    =====================================
    */

    const startGpsButton =
        document.getElementById("startGpsButton");

    const startWorkButton =
        document.getElementById("startWorkButton");

    const addTripButton =
        document.getElementById("addTripButton");

    const faultButton =
        document.getElementById("faultButton");

    const faultModal =
        document.getElementById("faultModal");

    const submitFaultButton =
        document.getElementById("submitFaultButton");

    const closeFaultModalButton =
        document.getElementById("closeFaultModalButton");


    /*
    =====================================
    初始化
    =====================================
    */

    renderProfile();

    refreshAll();

    restoreLastGps();

    autoStartGps();


    /*
    =====================================
    定时同步本地调度状态
    =====================================
    */

    setInterval(function () {

        refreshAll();

    }, 5000);


    /*
    =====================================
    司机资料
    =====================================
    */

    function renderProfile() {

        setText(
            "driverName",
            profile.name || "未填写"
        );

        setText(
            "driverTeam",
            profile.team || "未分配"
        );

        setText(
            "driverPosition",
            profile.position || "卡车司机"
        );
    }


    /*
    =====================================
    刷新
    =====================================
    */

    function refreshAll() {

        currentTask =
            getCurrentTaskForDriver();

        processApprovedChangeRequest();

        currentTask =
            getCurrentTaskForDriver();

        renderTask();

        renderClaimArea();

        renderWorkArea();

        renderTripHistory();

        renderChangeRequestStatus();
    }


    /*
    =====================================
    获取司机当前任务
    =====================================
    */

    function getCurrentTaskForDriver() {

        const task =
            readJson(
                STORAGE.CURRENT_TASK,
                null
            );

        if (!task) {
            return null;
        }

        /*
        如果任务指定了司机，只允许对应司机看到
        */

        if (
            task.driverId &&
            profile.driverId &&
            task.driverId !== profile.driverId
        ) {
            return null;
        }

        return task;
    }


    /*
    =====================================
    任务显示
    =====================================
    */

    function renderTask() {

        const noTaskArea =
            document.getElementById("noTaskArea");

        const taskArea =
            document.getElementById("taskArea");

        if (!currentTask) {

            noTaskArea.classList.remove("hidden");
            taskArea.classList.add("hidden");

            setText(
                "taskStatusBadge",
                "待调度"
            );

            return;
        }

        noTaskArea.classList.add("hidden");
        taskArea.classList.remove("hidden");

        setText(
            "vehicleNumber",
            getVehicleNumber(currentTask)
        );

        setText(
            "excavatorNumber",
            currentTask.excavatorNumber ||
            currentTask.excavatorId ||
            "-"
        );

        setText(
            "workArea",
            currentTask.workArea ||
            currentTask.area ||
            "-"
        );

        setText(
            "shiftName",
            currentTask.shift ||
            "-"
        );

        setText(
            "loadingPoint",
            currentTask.loadingPoint ||
            "-"
        );

        setText(
            "unloadingPoint",
            currentTask.unloadingPoint ||
            "-"
        );

        const remark =
            currentTask.remark ||
            currentTask.dispatchRemark ||
            "";

        const remarkBox =
            document.getElementById(
                "taskRemark"
            );

        if (remark) {

            remarkBox.textContent =
                "调度说明：" + remark;

            remarkBox.style.display =
                "block";

        } else {

            remarkBox.style.display =
                "none";
        }

        let statusText = "待领取";

        if (currentTask.vehicleClaimed) {
            statusText = "车辆已领取";
        }

        if (currentTask.workStatus === "working") {
            statusText = "作业中";
        }

        if (hasPendingChangeRequest()) {
            statusText = "换车审批中";
        }

        setText(
            "taskStatusBadge",
            statusText
        );
    }


    /*
    =====================================
    车辆领取
    =====================================
    */

    function renderClaimArea() {

        const container =
            document.getElementById(
                "claimContent"
            );

        if (!currentTask) {

            container.innerHTML =
                '<div class="empty-box">暂无调度分配车辆</div>';

            return;
        }

        const vehicle =
            getVehicleNumber(currentTask);

        if (!vehicle || vehicle === "-") {

            container.innerHTML =
                '<div class="empty-box">调度尚未分配车辆</div>';

            return;
        }

        if (currentTask.vehicleClaimed) {

            container.innerHTML = `
                <div class="claimed-summary">
                    <div>
                        <span>已领取车辆</span>
                        <strong>${escapeHtml(vehicle)}</strong>
                    </div>

                    <small>
                        ${formatDateTime(
                            currentTask.vehicleClaimedAt
                        )}
                    </small>
                </div>
            `;

            return;
        }

        container.innerHTML = `
            <div class="assigned-vehicle-card">

                <div>
                    <span>调度车辆</span>
                    <strong>${escapeHtml(vehicle)}</strong>
                </div>

                <div>
                    <span>挖机</span>
                    <strong>
                        ${escapeHtml(
                            currentTask.excavatorNumber ||
                            currentTask.excavatorId ||
                            "-"
                        )}
                    </strong>
                </div>

                <div>
                    <span>区域</span>
                    <strong>
                        ${escapeHtml(
                            currentTask.workArea ||
                            currentTask.area ||
                            "-"
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

        const button =
            document.getElementById(
                "claimVehicleButton"
            );

        button.addEventListener(
            "click",
            claimVehicle
        );
    }


    function claimVehicle() {

        if (!currentTask) {
            return;
        }

        const vehicle =
            getVehicleNumber(currentTask);

        if (
            !confirm(
                "确认领取调度分配车辆 " +
                vehicle +
                " 吗？"
            )
        ) {
            return;
        }

        currentTask.vehicleClaimed =
            true;

        currentTask.vehicleClaimedAt =
            new Date().toISOString();

        currentTask.claimedDriverId =
            profile.driverId || "";

        currentTask.claimedDriverName =
            profile.name || "";

        saveCurrentTask();

        refreshAll();
    }


    /*
    =====================================
    开始作业
    =====================================
    */

    startWorkButton.addEventListener(
        "click",
        function () {

            if (!currentTask) {

                alert("当前没有调度任务。");
                return;
            }

            if (!currentTask.vehicleClaimed) {

                alert(
                    "请先领取调度分配的车辆。"
                );

                return;
            }

            if (hasPendingChangeRequest()) {

                alert(
                    "换车申请正在等待调度审批，暂时不能开始作业。"
                );

                return;
            }

            if (!lastPosition) {

                alert(
                    "请先开启GPS定位，定位成功后再开始作业。"
                );

                startGps();

                return;
            }

            currentTask.workStatus =
                "working";

            currentTask.startedAt =
                currentTask.startedAt ||
                new Date().toISOString();

            saveCurrentTask();

            refreshAll();
        }
    );


    /*
    =====================================
    工作区
    =====================================
    */

    function renderWorkArea() {

        const tripCount =
            getTodayDriverTrips().length;

        setText(
            "todayTripCount",
            tripCount
        );

        if (!currentTask) {

            setText(
                "currentVehicle",
                "-"
            );

            startWorkButton.disabled =
                true;

            addTripButton.disabled =
                true;

            setText(
                "tripMessage",
                "请等待调度下发任务。"
            );

            setDriverStatus(
                "待命"
            );

            return;
        }

        setText(
            "currentVehicle",
            getVehicleNumber(currentTask)
        );

        startWorkButton.disabled =
            !currentTask.vehicleClaimed ||
            hasPendingChangeRequest();

        const canRecordTrip =
            currentTask.vehicleClaimed &&
            currentTask.workStatus === "working" &&
            !hasPendingChangeRequest();

        addTripButton.disabled =
            !canRecordTrip;

        if (hasPendingChangeRequest()) {

            setText(
                "tripMessage",
                "换车申请正在审批，审批完成前禁止记录趟数。"
            );

            setDriverStatus(
                "换车审批中"
            );

            return;
        }

        if (!currentTask.vehicleClaimed) {

            setText(
                "tripMessage",
                "请先领取调度分配车辆。"
            );

            setDriverStatus(
                "待领车"
            );

            return;
        }

        if (
            currentTask.workStatus !==
            "working"
        ) {

            setText(
                "tripMessage",
                "车辆已领取，请开启定位并开始作业。"
            );

            setDriverStatus(
                "已领车"
            );

            return;
        }

        if (!lastPosition) {

            setText(
                "tripMessage",
                "作业已开始，但GPS尚未定位成功。"
            );

        } else {

            setText(
                "tripMessage",
                "作业中。完成一趟时系统将重新获取GPS位置。"
            );
        }

        setDriverStatus(
            "作业中"
        );
    }


    /*
    =====================================
    GPS
    =====================================
    */

    startGpsButton.addEventListener(
        "click",
        startGps
    );


    function autoStartGps() {

        if (!navigator.geolocation) {

            setGpsError(
                "当前设备不支持定位"
            );

            return;
        }

        startGps();
    }


    function startGps() {

        if (!navigator.geolocation) {

            setGpsError(
                "当前浏览器不支持GPS定位"
            );

            return;
        }

        setGpsWaiting();

        navigator.geolocation.getCurrentPosition(
            function (position) {

                updateGpsPosition(
                    position
                );

                startGpsWatch();
            },

            function (error) {

                handleGpsError(
                    error
                );
            },

            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 5000
            }
        );
    }


    function startGpsWatch() {

        if (gpsWatchId !== null) {
            return;
        }

        gpsWatchId =
            navigator.geolocation.watchPosition(

                function (position) {

                    updateGpsPosition(
                        position
                    );
                },

                function (error) {

                    handleGpsError(
                        error
                    );
                },

                {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 10000
                }
            );
    }


    function updateGpsPosition(
        position
    ) {

        const coords =
            position.coords;

        lastPosition = {
            latitude:
                coords.latitude,

            longitude:
                coords.longitude,

            accuracy:
                Math.round(
                    coords.accuracy || 0
                ),

            altitude:
                coords.altitude,

            speed:
                coords.speed,

            heading:
                coords.heading,

            timestamp:
                new Date(
                    position.timestamp ||
                    Date.now()
                ).toISOString()
        };

        localStorage.setItem(
            STORAGE.GPS_LAST,
            JSON.stringify(
                lastPosition
            )
        );

        const accuracy =
            lastPosition.accuracy;

        let status =
            "normal";

        let statusText =
            "定位正常";

        /*
        精度大于100米标记为较差
        */

        if (accuracy > 100) {

            status =
                "weak";

            statusText =
                "定位精度较低";
        }

        const badge =
            document.getElementById(
                "gpsStatusBadge"
            );

        badge.className =
            "gps-badge gps-" +
            status;

        badge.textContent =
            statusText;

        setText(
            "gpsStatusText",
            statusText
        );

        setText(
            "gpsAccuracy",
            accuracy > 0
                ? "±" + accuracy + "米"
                : "-"
        );

        setText(
            "gpsUpdateTime",
            formatTime(
                lastPosition.timestamp
            )
        );

        setText(
            "gpsCoordinate",
            lastPosition.latitude.toFixed(6)
            +
            ", "
            +
            lastPosition.longitude.toFixed(6)
        );

        setText(
            "workGpsStatus",
            accuracy <= 100
                ? "正常"
                : "精度低"
        );

        startGpsButton.textContent =
            "📍 定位运行中";
    }


    function restoreLastGps() {

        const saved =
            readJson(
                STORAGE.GPS_LAST,
                null
            );

        if (!saved) {
            return;
        }

        /*
        只恢复5分钟内的定位
        */

        const age =
            Date.now() -
            new Date(
                saved.timestamp
            ).getTime();

        if (
            Number.isFinite(age) &&
            age <= 5 * 60 * 1000
        ) {

            lastPosition =
                saved;

            setText(
                "gpsCoordinate",
                saved.latitude.toFixed(6)
                +
                ", "
                +
                saved.longitude.toFixed(6)
            );

            setText(
                "gpsAccuracy",
                "±" +
                saved.accuracy +
                "米"
            );

            setText(
                "gpsUpdateTime",
                formatTime(
                    saved.timestamp
                )
            );
        }
    }


    function setGpsWaiting() {

        const badge =
            document.getElementById(
                "gpsStatusBadge"
            );

        badge.className =
            "gps-badge gps-waiting";

        badge.textContent =
            "定位中";

        setText(
            "gpsStatusText",
            "正在获取位置"
        );

        setText(
            "workGpsStatus",
            "定位中"
        );
    }


    function setGpsError(
        message
    ) {

        const badge =
            document.getElementById(
                "gpsStatusBadge"
            );

        badge.className =
            "gps-badge gps-error";

        badge.textContent =
            "定位异常";

        setText(
            "gpsStatusText",
            message
        );

        setText(
            "workGpsStatus",
            "异常"
        );
    }


    function handleGpsError(
        error
    ) {

        let message =
            "定位失败";

        if (error.code === 1) {

            message =
                "未授权定位权限";
        }

        if (error.code === 2) {

            message =
                "暂时无法取得位置";
        }

        if (error.code === 3) {

            message =
                "定位超时";
        }

        setGpsError(
            message
        );
    }


    /*
    =====================================
    完成一趟
    =====================================
    */

    addTripButton.addEventListener(
        "click",
        recordTrip
    );


    function recordTrip() {

        if (!currentTask) {

            alert(
                "当前没有生产任务。"
            );

            return;
        }

        if (!currentTask.vehicleClaimed) {

            alert(
                "当前车辆尚未领取。"
            );

            return;
        }

        if (
            currentTask.workStatus !==
            "working"
        ) {

            alert(
                "请先开始作业。"
            );

            return;
        }

        /*
        最重要规则：
        换车审批中禁止记录
        */

        if (hasPendingChangeRequest()) {

            alert(
                "当前正在申请更换车辆。\n\n调度批准之前不能记录运输趟数。"
            );

            return;
        }

        addTripButton.disabled =
            true;

        addTripButton.textContent =
            "📍 正在取得GPS...";

        /*
        每次记趟重新取得一次GPS
        */

        getFreshPosition()
            .then(function (position) {

                saveTripWithGps(
                    position
                );

            })
            .catch(function () {

                /*
                定位失败仍然可以形成异常记录，
                但标记待调度确认
                */

                const confirmAbnormal =
                    confirm(
                        "本次无法取得GPS定位。\n\n" +
                        "是否仍然提交本趟？\n\n" +
                        "提交后将标记为“GPS异常 / 待调度确认”。"
                    );

                if (!confirmAbnormal) {

                    resetTripButton();
                    return;
                }

                saveTripWithGps(
                    null
                );
            });
    }


    function getFreshPosition() {

        return new Promise(
            function (
                resolve,
                reject
            ) {

                if (!navigator.geolocation) {

                    reject(
                        new Error(
                            "GPS unavailable"
                        )
                    );

                    return;
                }

                navigator.geolocation.getCurrentPosition(

                    function (position) {

                        updateGpsPosition(
                            position
                        );

                        resolve(
                            lastPosition
                        );
                    },

                    function (error) {

                        handleGpsError(
                            error
                        );

                        reject(
                            error
                        );
                    },

                    {
                        enableHighAccuracy: true,
                        timeout: 15000,
                        maximumAge: 3000
                    }
                );
            }
        );
    }


    function saveTripWithGps(
        gps
    ) {

        const records =
            readJson(
                STORAGE.TRIPS,
                []
            );

        const accuracy =
            gps
                ? Number(
                    gps.accuracy || 0
                )
                : null;

        let gpsStatus =
            "异常";

        let dispatchConfirmation =
            "待确认";

        if (gps) {

            if (
                accuracy > 0 &&
                accuracy <= 100
            ) {

                gpsStatus =
                    "正常";

                dispatchConfirmation =
                    "GPS通过";

            } else {

                gpsStatus =
                    "精度较低";
            }
        }

        const now =
            new Date()
                .toISOString();

        const record = {

            id:
                "TRIP_" +
                Date.now(),

            tripId:
                "TRIP_" +
                Date.now(),

            taskId:
                currentTask.taskId ||
                currentTask.id ||
                "",

            driverId:
                profile.driverId ||
                "",

            driverName:
                profile.name ||
                "",

            vehicleId:
                currentTask.vehicleId ||
                "",

            vehicleNumber:
                getVehicleNumber(
                    currentTask
                ),

            excavatorId:
                currentTask.excavatorId ||
                "",

            excavatorNumber:
                currentTask.excavatorNumber ||
                currentTask.excavatorId ||
                "",

            workArea:
                currentTask.workArea ||
                currentTask.area ||
                "",

            shift:
                currentTask.shift ||
                "",

            loadingPoint:
                currentTask.loadingPoint ||
                "",

            unloadingPoint:
                currentTask.unloadingPoint ||
                "",

            completedAt:
                now,

            tripCount:
                1,

            latitude:
                gps
                    ? gps.latitude
                    : null,

            longitude:
                gps
                    ? gps.longitude
                    : null,

            gpsAccuracy:
                gps
                    ? gps.accuracy
                    : null,

            gpsTime:
                gps
                    ? gps.timestamp
                    : null,

            gpsStatus:
                gpsStatus,

            dataSource:
                gps
                    ? "司机端GPS"
                    : "司机手动/GPS异常",

            dispatchConfirmation:
                dispatchConfirmation,

            abnormalType:
                gpsStatus === "正常"
                    ? ""
                    : "GPS异常",

            vehicleAuthorized:
                true
        };

        records.push(
            record
        );

        localStorage.setItem(
            STORAGE.TRIPS,
            JSON.stringify(
                records
            )
        );

        currentTask.lastTripAt =
            now;

        currentTask.tripCount =
            Number(
                currentTask.tripCount || 0
            ) + 1;

        saveCurrentTask();

        resetTripButton();

        refreshAll();

        if (gpsStatus === "正常") {

            showTemporaryMessage(
                "✓ 本趟记录成功，GPS正常"
            );

        } else {

            showTemporaryMessage(
                "⚠ 本趟已保存，GPS异常，等待调度确认"
            );
        }
    }


    function resetTripButton() {

        addTripButton.textContent =
            "🚚 完成一趟";

        addTripButton.disabled =
            !(
                currentTask &&
                currentTask.vehicleClaimed &&
                currentTask.workStatus ===
                "working" &&
                !hasPendingChangeRequest()
            );
    }


    /*
    =====================================
    故障换车
    =====================================
    */

    faultButton.addEventListener(
        "click",
        function () {

            if (
                !currentTask ||
                !currentTask.vehicleClaimed
            ) {

                alert(
                    "当前没有已领取车辆。"
                );

                return;
            }

            if (hasPendingChangeRequest()) {

                alert(
                    "已有换车申请等待调度处理。"
                );

                return;
            }

            setText(
                "faultVehicleNumber",
                getVehicleNumber(
                    currentTask
                )
            );

            document.getElementById(
                "faultDescription"
            ).value = "";

            faultModal.classList.remove(
                "hidden"
            );
        }
    );


    closeFaultModalButton.addEventListener(
        "click",
        function () {

            faultModal.classList.add(
                "hidden"
            );
        }
    );


    submitFaultButton.addEventListener(
        "click",
        submitFaultRequest
    );


    function submitFaultRequest() {

        if (!currentTask) {
            return;
        }

        const description =
            document
                .getElementById(
                    "faultDescription"
                )
                .value
                .trim();

        if (!description) {

            alert(
                "请填写车辆故障情况。"
            );

            return;
        }

        const requests =
            getChangeRequests();

        const request = {

            requestId:
                "CHANGE_" +
                Date.now(),

            driverId:
                profile.driverId ||
                "",

            driverName:
                profile.name ||
                "",

            taskId:
                currentTask.taskId ||
                currentTask.id ||
                "",

            oldVehicleId:
                currentTask.vehicleId ||
                "",

            oldVehicleNumber:
                getVehicleNumber(
                    currentTask
                ),

            reason:
                description,

            status:
                "pending",

            requestedAt:
                new Date()
                    .toISOString(),

            approvedVehicleId:
                "",

            approvedVehicleNumber:
                ""
        };

        requests.push(
            request
        );

        localStorage.setItem(
            STORAGE.CHANGE_REQUESTS,
            JSON.stringify(
                requests
            )
        );

        /*
        申请后立即锁定趟数
        */

        currentTask.workStatus =
            "change_pending";

        currentTask.vehicleChangePending =
            true;

        currentTask.vehicleChangeRequestId =
            request.requestId;

        saveCurrentTask();

        faultModal.classList.add(
            "hidden"
        );

        refreshAll();

        alert(
            "换车申请已提交。\n\n调度批准新车辆之前不能继续记录趟数。"
        );
    }


    /*
    =====================================
    换车审批状态
    =====================================
    */

    function getChangeRequests() {

        return readJson(
            STORAGE.CHANGE_REQUESTS,
            []
        );
    }


    function getLatestDriverChangeRequest() {

        return getChangeRequests()
            .filter(
                function (item) {

                    return (
                        item.driverId ===
                        profile.driverId
                    );
                }
            )
            .sort(
                function (a, b) {

                    return new Date(
                        b.requestedAt || 0
                    ) -
                    new Date(
                        a.requestedAt || 0
                    );
                }
            )[0] || null;
    }


    function hasPendingChangeRequest() {

        const request =
            getLatestDriverChangeRequest();

        return !!(
            request &&
            request.status === "pending"
        );
    }


    function processApprovedChangeRequest() {

        if (!currentTask) {
            return;
        }

        const request =
            getLatestDriverChangeRequest();

        if (!request) {
            return;
        }

        if (
            request.status !==
            "approved"
        ) {
            return;
        }

        if (
            request.appliedToDriverTask
        ) {
            return;
        }

        const newVehicle =
            request.approvedVehicleNumber ||
            request.newVehicleNumber ||
            "";

        if (!newVehicle) {
            return;
        }

        /*
        调度批准后才真正切换车辆
        */

        currentTask.previousVehicleNumber =
            getVehicleNumber(
                currentTask
            );

        currentTask.vehicleNumber =
            newVehicle;

        if (
            request.approvedVehicleId ||
            request.newVehicleId
        ) {

            currentTask.vehicleId =
                request.approvedVehicleId ||
                request.newVehicleId;
        }

        currentTask.vehicleClaimed =
            false;

        currentTask.vehicleClaimedAt =
            null;

        currentTask.workStatus =
            "assigned";

        currentTask.vehicleChangePending =
            false;

        currentTask.vehicleChangeRequestId =
            null;

        saveCurrentTask();

        const requests =
            getChangeRequests();

        const index =
            requests.findIndex(
                function (item) {

                    return (
                        item.requestId ===
                        request.requestId
                    );
                }
            );

        if (index !== -1) {

            requests[index]
                .appliedToDriverTask =
                true;

            requests[index]
                .appliedAt =
                new Date()
                    .toISOString();

            localStorage.setItem(
                STORAGE.CHANGE_REQUESTS,
                JSON.stringify(
                    requests
                )
            );
        }
    }


    function renderChangeRequestStatus() {

        const box =
            document.getElementById(
                "changeRequestStatus"
            );

        const request =
            getLatestDriverChangeRequest();

        if (!request) {

            box.innerHTML = "";
            return;
        }

        if (request.status === "pending") {

            box.innerHTML = `
                <div class="change-status-card pending">
                    <div>
                        <strong>⏳ 等待调度审批</strong>
                        <span>
                            原车辆：
                            ${escapeHtml(
                                request.oldVehicleNumber || "-"
                            )}
                        </span>
                        <small>
                            ${escapeHtml(
                                request.reason || ""
                            )}
                        </small>
                    </div>
                </div>
            `;

            return;
        }

        if (request.status === "approved") {

            box.innerHTML = `
                <div class="change-status-card approved">
                    <div>
                        <strong>✓ 调度已批准换车</strong>
                        <span>
                            新车辆：
                            ${escapeHtml(
                                request.approvedVehicleNumber ||
                                request.newVehicleNumber ||
                                "-"
                            )}
                        </span>
                        <small>
                            请领取新车辆后继续作业。
                        </small>
                    </div>
                </div>
            `;

            return;
        }

        if (request.status === "rejected") {

            box.innerHTML = `
                <div class="change-status-card rejected">
                    <div>
                        <strong>✕ 换车申请未批准</strong>
                        <span>
                            ${escapeHtml(
                                request.rejectReason ||
                                request.dispatchRemark ||
                                "请联系调度"
                            )}
                        </span>
                    </div>
                </div>
            `;

            return;
        }

        box.innerHTML = "";
    }


    /*
    =====================================
    今日趟次
    =====================================
    */

    function getTodayDriverTrips() {

        const records =
            readJson(
                STORAGE.TRIPS,
                []
            );

        return records.filter(
            function (record) {

                return (
                    record.driverId ===
                    profile.driverId &&
                    isToday(
                        record.completedAt
                    )
                );
            }
        );
    }


    function renderTripHistory() {

        const records =
            getTodayDriverTrips();

        const box =
            document.getElementById(
                "tripHistory"
            );

        setText(
            "todayTripCount",
            records.length
        );

        if (!records.length) {

            box.innerHTML =
                '<div class="empty-box">今日暂无运输记录</div>';

            return;
        }

        let html = "";

        records
            .slice()
            .reverse()
            .forEach(
                function (
                    record,
                    index
                ) {

                    const number =
                        records.length -
                        index;

                    let gpsClass =
                        "gps-record-normal";

                    if (
                        record.gpsStatus !==
                        "正常"
                    ) {

                        gpsClass =
                            "gps-record-warning";
                    }

                    html += `
                        <div class="trip-history-row">

                            <div>
                                <strong>
                                    第 ${number} 趟
                                    ·
                                    ${escapeHtml(
                                        record.vehicleNumber || "-"
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        record.loadingPoint || "-"
                                    )}
                                    →
                                    ${escapeHtml(
                                        record.unloadingPoint || "-"
                                    )}
                                </span>

                                <small class="${gpsClass}">
                                    📍
                                    ${escapeHtml(
                                        record.gpsStatus || "未记录"
                                    )}

                                    ${
                                        record.gpsAccuracy
                                        ? " · ±" +
                                          record.gpsAccuracy +
                                          "米"
                                        : ""
                                    }
                                </small>
                            </div>

                            <strong>
                                ${formatTime(
                                    record.completedAt
                                )}
                            </strong>

                        </div>
                    `;
                }
            );

        box.innerHTML =
            html;
    }


    /*
    =====================================
    保存任务
    =====================================
    */

    function saveCurrentTask() {

        if (!currentTask) {
            return;
        }

        localStorage.setItem(
            STORAGE.CURRENT_TASK,
            JSON.stringify(
                currentTask
            )
        );
    }


    /*
    =====================================
    工具
    =====================================
    */

    function getVehicleNumber(
        task
    ) {

        if (!task) {
            return "-";
        }

        return (
            task.vehicleNumber ||
            task.vehicleId ||
            "-"
        );
    }


    function setDriverStatus(
        text
    ) {

        setText(
            "driverStatusBadge",
            text
        );
    }


    function showTemporaryMessage(
        text
    ) {

        setText(
            "tripMessage",
            text
        );

        setTimeout(
            function () {

                renderWorkArea();

            },
            3000
        );
    }

});


/*
=========================================
全局工具
=========================================
*/

function readJson(
    key,
    fallback
) {

    try {

        const value =
            localStorage.getItem(
                key
            );

        if (!value) {
            return fallback;
        }

        return JSON.parse(
            value
        );

    } catch (error) {

        console.error(
            "读取数据失败：",
            key,
            error
        );

        return fallback;
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
    value
) {

    if (!value) {
        return false;
    }

    const date =
        new Date(
            value
        );

    const now =
        new Date();

    return (
        date.getFullYear() ===
        now.getFullYear() &&

        date.getMonth() ===
        now.getMonth() &&

        date.getDate() ===
        now.getDate()
    );
}


function formatTime(
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

    return date.toLocaleTimeString(
        "zh-CN",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
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
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
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
            value ?? ""
        );

    return div.innerHTML;
}
