/*
====================================================
矿山管理系统
司机端 V2.10.4R3
====================================================
功能：
1. 审核通过司机才可进入
2. GPS实时定位
3. 每趟重新获取GPS
4. 调度车辆领取
5. 故障换车申请
6. 换车审批后继续原任务
7. 司机请假 -> 调度审批
8. 我的罚单 -> 已知晓
9. GPS异常审核结果
10. 保留旧 driverCurrentTask 兼容
====================================================
*/

document.addEventListener("DOMContentLoaded", function () {

    const STORAGE = {
        PROFILE: "driverProfile",
        PERSONNEL: "personnelRecords",
        ROLE_PERSON_IDS: "rolePersonIds",
        CURRENT_TASK: "driverCurrentTask",
        DISPATCH_TASKS: "dispatchPublishedTasks",
        TRIPS: "driverTripRecords",
        CHANGE_REQUESTS: "driverVehicleChangeRequests",
        LEAVE_REQUESTS: "leaveRequests",
        PENALTIES: "penaltyRecords",
        GPS: "driverLastGpsPosition",

        /*
         * 正式月度综合绩效排名
         * 来源：综合报表中心
         */
        PERFORMANCE_RANKING:
            "performanceRankingRecords",

        /*
         * V2.10.3J
         * 设备使用检查
         */
        EQUIPMENT_CHECKS:
            "equipmentUsageChecks",

        /*
         * V2.10.3J
         * 设备运行状态
         */
        OPERATIONAL_STATUS:
            "equipmentOperationalStatus",

        /*
         * V2.10.3J
         * GPS运输闭环
         */
        TRANSPORT_ZONES:
            "transportZones",

        TRANSPORT_CYCLE:
            "driverTransportCycleState"
    };

    const $ = id => document.getElementById(id);

    let profile = null;
    let currentTask = null;
    let latestGps = null;
    let gpsWatchId = null;

    initialize();


    function initialize() {

        /*
         * V2.10.2K
         *
         * 人员身份以 personnelRecords 为正式来源。
         * driverProfile 仅作为旧司机端兼容缓存。
         *
         * 旧版本只读取 driverProfile：
         * - 没有 -> driver-register.html
         * - status != approved -> driver-waiting.html
         *
         * 这会导致人员已经在管理员端审核通过，
         * 但旧 driverProfile 仍是 pending 时不断被送回审核页。
         */
        const identity =
            resolveDriverIdentity();


        if (
            !identity.profile
        ) {

            if (
                identity.existingPerson
            ) {

                goToUnifiedWaiting(
                    identity.existingPerson
                );

            } else {

                location.replace(
                    "person-register.html?position=" +
                    encodeURIComponent(
                        "汽车司机"
                    )
                );
            }

            return;
        }


        profile =
            identity.profile;


        /*
         * 已审核人员恢复成功后，
         * 始终生成一份兼容 driverProfile。
         */
        localStorage.setItem(
            STORAGE.PROFILE,
            JSON.stringify(
                profile
            )
        );


        renderProfile();

        currentTask = getCurrentTask();

        applyApprovedVehicleChange();

        currentTask = getCurrentTask();

        bindEvents();

        refreshAll();

        startGpsWatch();

        setInterval(
            function () {

                /*
                 * 每5秒重新确认人员仍然可用。
                 * 被停用/离职后不能继续生产作业。
                 */
                const latestIdentity =
                    resolveDriverIdentity();


                if (
                    !latestIdentity.profile
                ) {

                    if (
                        latestIdentity.existingPerson
                    ) {

                        goToUnifiedWaiting(
                            latestIdentity.existingPerson
                        );

                    } else {

                        location.replace(
                            "index.html"
                        );
                    }

                    return;
                }


                profile =
                    latestIdentity.profile;


                currentTask = getCurrentTask();

                applyApprovedVehicleChange();

                refreshAll();

            },
            5000
        );
    }


    /*
    ===============================================
    V2.10.2K
    统一司机身份恢复
    ===============================================
    */

    function normalizeDriverPosition(
        position
    ) {

        const map = {

            "卡车司机":
                "汽车司机",

            "汽车驾驶员":
                "汽车司机"

        };


        return (
            map[position] ||
            position ||
            ""
        );
    }


    function getPersonnelPersonId(
        person
    ) {

        return String(

            person?.personId ||

            person?.employeeId ||

            person?.driverId ||

            person?.id ||

            ""

        );
    }


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


    function isApprovedPersonnel(
        person
    ) {

        if (
            !person
        ) {

            return false;
        }


        if (

            person.enabled ===
                false

            ||

            person.status ===
                "rejected"

            ||

            person.approvalStatus ===
                "rejected"

            ||

            person.status ===
                "disabled"

            ||

            person.status ===
                "resigned"

            ||

            person.personnelStatus ===
                "停用"

            ||

            person.personnelStatus ===
                "离职"

        ) {

            return false;
        }


        return (

            person.status ===
                "approved"

            ||

            person.status ===
                "active"

            ||

            person.status ===
                "working"

            ||

            person.status ===
                "leave"

            ||

            person.approvalStatus ===
                "approved"

            ||

            person.personnelStatus ===
                "在职可用"

            ||

            person.personnelStatus ===
                "作业中"

            ||

            person.personnelStatus ===
                "请假"

        );
    }


    function getRolePersonMap() {

        const data =
            readJson(
                STORAGE.ROLE_PERSON_IDS,
                {}
            );


        return (
            data &&
            typeof data ===
                "object" &&
            !Array.isArray(data)
        )
            ? data
            : {};
    }


    function rememberApprovedDriver(
        person
    ) {

        const personId =
            getPersonnelPersonId(
                person
            );


        if (
            !personId
        ) {

            return;
        }


        localStorage.setItem(
            "currentPersonId",
            personId
        );


        localStorage.setItem(
            "selectedPosition",
            "汽车司机"
        );


        localStorage.setItem(
            "workerPersonId",
            personId
        );


        localStorage.setItem(
            "workerPosition",
            "汽车司机"
        );


        const roleMap =
            getRolePersonMap();


        roleMap[
            "汽车司机"
        ] =
            personId;


        localStorage.setItem(
            STORAGE.ROLE_PERSON_IDS,
            JSON.stringify(
                roleMap
            )
        );


        /*
         * 清除旧高权限待验证残留，
         * 不影响 adminPersonId / managerPersonId。
         */
        localStorage.removeItem(
            "pendingProtectedPersonId"
        );


        localStorage.removeItem(
            "pendingProtectedPosition"
        );
    }


    function convertPersonnelToDriverProfile(
        person
    ) {

        const personId =
            getPersonnelPersonId(
                person
            );


        return {

            /*
             * 旧司机端大量逻辑使用 driverId，
             * 因此与 personId 使用同一个ID。
             */
            driverId:
                personId,

            personId:
                personId,

            employeeId:
                person.employeeId ||
                personId,

            employeeNo:
                person.employeeNo ||
                "",

            name:
                person.name ||
                "",

            phone:
                person.phone ||
                "",

            position:
                "汽车司机",

            team:
                person.team ||
                person.department ||
                "",

            department:
                person.department ||
                person.team ||
                "",

            entryDate:
                person.entryDate ||
                "",

            idCardNumber:
                person.idCardNumber ||
                "",

            passportNumber:
                person.passportNumber ||
                "",

            driverLicensePhoto:
                person.driverLicensePhoto ||
                "",

            bankCardNumber:
                person.bankCardNumber ||
                "",

            emergencyContact:
                person.emergencyContact ||
                "",

            emergencyPhone:
                person.emergencyPhone ||
                "",

            /*
             * 对旧 driver-work.js 保持兼容。
             */
            status:
                "approved",

            approvalStatus:
                "approved",

            personnelStatus:
                person.personnelStatus ||
                "在职可用",

            approvedAt:
                person.approvedAt ||
                person.reviewedAt ||
                "",

            updatedAt:
                person.updatedAt ||
                new Date()
                    .toISOString(),

            source:
                "personnelRecords",

            compatibilityProfile:
                true

        };
    }


    function resolveDriverIdentity() {

        const records =
            getPersonnelRecords();


        const drivers =
            records.filter(
                person =>
                    normalizeDriverPosition(
                        person.position
                    ) ===
                        "汽车司机"
            );


        const approvedDrivers =
            drivers.filter(
                isApprovedPersonnel
            );


        /*
         * 优先级：
         * 1. currentPersonId
         * 2. rolePersonIds["汽车司机"]
         * 3. workerPersonId
         * 4. 唯一已审核汽车司机
         */
        const roleMap =
            getRolePersonMap();


        const candidateIds = [

            localStorage.getItem(
                "currentPersonId"
            ),

            roleMap[
                "汽车司机"
            ],

            (
                normalizeDriverPosition(
                    localStorage.getItem(
                        "workerPosition"
                    ) ||
                    ""
                ) ===
                    "汽车司机"
            )
                ? localStorage.getItem(
                    "workerPersonId"
                )
                : "",

        ]
            .filter(Boolean)
            .map(String);


        let approvedPerson =
            null;


        for (
            const candidateId
            of candidateIds
        ) {

            approvedPerson =
                approvedDrivers.find(
                    person =>
                        getPersonnelPersonId(
                            person
                        ) ===
                            candidateId
                );


            if (
                approvedPerson
            ) {

                break;
            }
        }


        if (
            !approvedPerson &&
            approvedDrivers.length ===
                1
        ) {

            approvedPerson =
                approvedDrivers[
                    0
                ];
        }


        /*
         * 多名已审核司机且没有身份映射时，
         * 尝试使用旧 driverProfile 的ID匹配，
         * 但旧 profile 的 pending 状态不再拥有否决权。
         */
        if (
            !approvedPerson &&
            approvedDrivers.length >
                1
        ) {

            const legacyProfile =
                readJson(
                    STORAGE.PROFILE,
                    null
                );


            const legacyId =
                String(
                    legacyProfile?.driverId ||
                    legacyProfile?.personId ||
                    ""
                );


            if (
                legacyId
            ) {

                approvedPerson =
                    approvedDrivers.find(
                        person =>
                            getPersonnelPersonId(
                                person
                            ) ===
                                legacyId
                    ) ||
                    null;
            }
        }


        if (
            approvedPerson
        ) {

            rememberApprovedDriver(
                approvedPerson
            );


            const compatibleProfile =
                convertPersonnelToDriverProfile(
                    approvedPerson
                );


            localStorage.setItem(
                STORAGE.PROFILE,
                JSON.stringify(
                    compatibleProfile
                )
            );


            return {

                profile:
                    compatibleProfile,

                existingPerson:
                    approvedPerson

            };
        }


        /*
         * personnelRecords 中没有已审核司机：
         * 如果已有当前申请记录，则交给统一 person-waiting.html。
         */
        let existingPerson =
            null;


        for (
            const candidateId
            of candidateIds
        ) {

            existingPerson =
                drivers.find(
                    person =>
                        getPersonnelPersonId(
                            person
                        ) ===
                            candidateId
                );


            if (
                existingPerson
            ) {

                break;
            }
        }


        if (
            !existingPerson &&
            drivers.length ===
                1
        ) {

            existingPerson =
                drivers[0];
        }


        /*
         * 最后才兼容旧版独立 driverProfile。
         * 仅当 personnelRecords 中没有任何汽车司机资料时启用。
         */
        if (
            !drivers.length
        ) {

            const legacyProfile =
                readJson(
                    STORAGE.PROFILE,
                    null
                );


            if (
                legacyProfile &&
                legacyProfile.status ===
                    "approved"
            ) {

                return {

                    profile:
                        legacyProfile,

                    existingPerson:
                        null

                };
            }
        }


        return {

            profile:
                null,

            existingPerson

        };
    }


    function goToUnifiedWaiting(
        person
    ) {

        const personId =
            getPersonnelPersonId(
                person
            );


        if (
            personId
        ) {

            localStorage.setItem(
                "currentPersonId",
                personId
            );


            localStorage.setItem(
                "selectedPosition",
                "汽车司机"
            );


            localStorage.setItem(
                "waitingApplicantPersonId",
                personId
            );


            localStorage.setItem(
                "waitingApplicantPosition",
                "汽车司机"
            );
        }


        location.replace(

            "person-waiting.html?position=" +
            encodeURIComponent(
                "汽车司机"
            ) +
            (
                personId
                    ? "&personId=" +
                      encodeURIComponent(
                          personId
                      )
                    : ""
            )

        );
    }


    /*
    ===============================================
    事件
    ===============================================
    */

    function bindEvents() {

        /*
         * 设备检查统一带入本班 shiftId / taskId / vehicle，
         * 避免设备检查页无法识别班次。
         */
        const equipmentCheckButton =
            $("equipmentCheckButton");

        if (equipmentCheckButton) {

            equipmentCheckButton.onclick =
                openEquipmentCheck;
        }


        $("startGpsButton")
            ?.addEventListener(
                "click",
                startGpsWatch
            );

        $("claimVehicleButton")
            ?.addEventListener(
                "click",
                claimVehicle
            );

        $("startWorkButton")
            ?.addEventListener(
                "click",
                startWork
            );

        $("pauseWorkButton")
            ?.addEventListener(
                "click",
                pauseWork
            );

        $("resumeWorkButton")
            ?.addEventListener(
                "click",
                resumeWork
            );

        $("addTripButton")
            ?.addEventListener(
                "click",
                completeTrip
            );

        $("vehicleFaultButton")
            ?.addEventListener(
                "click",
                openVehicleChangeModal
            );

        $("submitVehicleChangeButton")
            ?.addEventListener(
                "click",
                submitVehicleChange
            );

        $("closeVehicleChangeButton")
            ?.addEventListener(
                "click",
                function () {
                    hideModal("vehicleChangeModal");
                }
            );

        $("openLeaveButton")
            ?.addEventListener(
                "click",
                openLeaveModal
            );

        $("submitLeaveButton")
            ?.addEventListener(
                "click",
                submitLeave
            );

        $("closeLeaveButton")
            ?.addEventListener(
                "click",
                function () {
                    hideModal("leaveModal");
                }
            );

        $("leaveShortcut")
            ?.addEventListener(
                "click",
                function () {
                    scrollToSection("leaveSection");
                }
            );

        $("penaltyShortcut")
            ?.addEventListener(
                "click",
                function () {
                    scrollToSection("penaltySection");
                }
            );

        $("changeShortcut")
            ?.addEventListener(
                "click",
                function () {
                    scrollToSection("changeSection");
                }
            );

        $("gpsReviewShortcut")
            ?.addEventListener(
                "click",
                function () {
                    scrollToSection("tripSection");
                }
            );
    }


    /*
    ===============================================
    打开设备使用检查
    ===============================================
    */

    function openEquipmentCheck() {

        if (!currentTask) {

            alert(
                "当前没有生产任务，暂不能进行班次设备检查。"
            );

            return;
        }


        const params =
            new URLSearchParams();


        params.set(
            "mode",
            "shift"
        );


        if (currentTask.shiftId) {

            params.set(
                "shiftId",
                currentTask.shiftId
            );
        }


        if (
            currentTask.taskId ||
            currentTask.dispatchTaskId
        ) {

            params.set(
                "taskId",
                currentTask.taskId ||
                currentTask.dispatchTaskId
            );
        }


        const vehicle =
            getVehicleNumber(
                currentTask
            );


        if (vehicle) {

            params.set(
                "equipmentId",
                vehicle
            );

            params.set(
                "vehicle",
                vehicle
            );
        }


        if (currentTask.shift) {

            params.set(
                "shift",
                currentTask.shift
            );
        }


        if (currentTask.shiftDate) {

            params.set(
                "shiftDate",
                currentTask.shiftDate
            );
        }


        location.href =
            "equipment-check.html?" +
            params.toString();
    }


    /*
    ===============================================
    人员信息
    ===============================================
    */

    function renderProfile() {

        setText(
            "driverName",
            profile.name || "-"
        );

        setText(
            "driverPosition",
            normalizeDriverPosition(
                profile.position
            ) ||
            "汽车司机"
        );

        setText(
            "driverEmployeeNo",
            profile.employeeNo ||
            "-"
        );

        setText(
            "driverTeam",
            profile.team ||
            profile.department ||
            "-"
        );

        setText(
            "profileName",
            profile.name || "-"
        );

        setText(
            "profileEmployeeNo",
            profile.employeeNo ||
            "-"
        );

        setText(
            "profilePhone",
            profile.phone || "-"
        );

        setText(
            "profilePosition",
            normalizeDriverPosition(
                profile.position
            ) ||
            "汽车司机"
        );

        setText(
            "profileTeam",
            profile.team ||
            profile.department ||
            "-"
        );

        setText(
            "profileEntryDate",
            profile.entryDate || "-"
        );

        if ($("leaveContactPhone")) {
            $("leaveContactPhone").value =
                profile.phone || "";
        }
    }


    /*
    ===============================================
    全部刷新
    ===============================================
    */

    function refreshAll() {

        refreshTask();

        refreshTrips();

        refreshShiftRankings();

        refreshLeaveRecords();

        refreshPenaltyRecords();

        refreshVehicleChangeRecords();

        refreshTodoCounts();

        refreshDriverStatus();

        refreshTransportCycle();
    }


    /*
    ===============================================
    当前任务
    ===============================================
    */

    function getCurrentTask() {

        const tasks =
            readJson(
                STORAGE.DISPATCH_TASKS,
                []
            );


        if (
            !Array.isArray(
                tasks
            )
        ) {

            return null;
        }


        const oldTask =
            readJson(
                STORAGE.CURRENT_TASK,
                null
            );


        /*
         * V2.10.2Q
         *
         * 车队长在同一班次内修改“本班绑定”后，
         * 司机端不能继续一直使用旧 driverCurrentTask。
         *
         * 每次刷新都重新核对：
         * 1. currentShiftId 是否变化
         * 2. 当前司机是否仍在这个主任务
         * 3. 本班车辆是否变化
         * 4. 本班挖机是否变化
         * 5. 装载区 / 卸载区是否调整
         */
        if (
            oldTask &&
            oldTask.status !==
                "completed"
        ) {

            const oldTaskId =
                String(
                    oldTask.taskId ||
                    oldTask.dispatchTaskId ||
                    ""
                );


            const masterTask =
                tasks.find(
                    item =>
                        String(
                            item.taskId ||
                            item.dispatchTaskId ||
                            item.id ||
                            ""
                        ) ===
                            oldTaskId
                );


            if (
                masterTask
            ) {

                const latestShiftId =
                    String(
                        masterTask.currentShiftId ||
                        masterTask.shiftId ||
                        ""
                    );


                const oldShiftId =
                    String(
                        oldTask.shiftId ||
                        ""
                    );


                const assignments =
                    Array.isArray(
                        masterTask.driverAssignments
                    )
                        ? masterTask.driverAssignments
                        : [];


                const latestAssignment =
                    assignments.find(
                        item =>
                            samePerson(
                                item.driverId ||
                                item.personId,
                                item.driverName ||
                                item.personName
                            )
                    );


                /*
                 * 当前主任务仍存在，并且还是同一个班次。
                 * 继续检查本班绑定有没有变化。
                 */
                if (
                    (
                        !latestShiftId ||
                        latestShiftId ===
                            oldShiftId
                    ) &&
                    latestAssignment
                ) {

                    const latestVehicle =
                        String(
                            latestAssignment.vehicleNumber ||
                            latestAssignment.vehicleId ||
                            latestAssignment.truckNumber ||
                            latestAssignment.truckId ||
                            ""
                        );


                    const oldVehicle =
                        String(
                            oldTask.vehicleNumber ||
                            oldTask.vehicleId ||
                            ""
                        );


                    const latestExcavator =
                        String(
                            latestAssignment.excavatorNumber ||
                            latestAssignment.excavatorId ||
                            ""
                        );


                    const oldExcavator =
                        String(
                            oldTask.excavatorNumber ||
                            oldTask.excavatorId ||
                            ""
                        );


                    const latestLoadingPoint =
                        String(
                            latestAssignment.loadingPoint ||
                            masterTask.loadingPoint ||
                            masterTask.taskLoadingPoint ||
                            ""
                        );


                    const latestUnloadingPoint =
                        String(
                            latestAssignment.unloadingPoint ||
                            masterTask.unloadingPoint ||
                            masterTask.taskUnloadingPoint ||
                            ""
                        );


                    const vehicleChanged =
                        latestVehicle !==
                            oldVehicle;


                    const bindingChanged =

                        vehicleChanged

                        ||

                        latestExcavator !==
                            oldExcavator

                        ||

                        latestLoadingPoint !==
                            String(
                                oldTask.loadingPoint ||
                                ""
                            )

                        ||

                        latestUnloadingPoint !==
                            String(
                                oldTask.unloadingPoint ||
                                ""
                            )

                        ||

                        String(
                            latestAssignment.shiftId ||
                            latestShiftId ||
                            ""
                        ) !==
                            oldShiftId;


                    if (
                        bindingChanged
                    ) {

                        const updatedTask = {
                            ...oldTask,

                            taskId:
                                masterTask.taskId ||
                                oldTask.taskId,

                            dispatchTaskId:
                                masterTask.taskId ||
                                oldTask.dispatchTaskId ||
                                oldTask.taskId,

                            shiftId:
                                latestAssignment.shiftId ||
                                latestShiftId ||
                                oldShiftId,

                            shift:
                                latestAssignment.shift ||
                                masterTask.shift ||
                                oldTask.shift ||
                                "",

                            shiftDate:
                                latestAssignment.shiftDate ||
                                masterTask.shiftDate ||
                                oldTask.shiftDate ||
                                "",

                            workArea:
                                masterTask.area ||
                                masterTask.workArea ||
                                oldTask.workArea ||
                                "",

                            remark:
                                masterTask.remark ||
                                oldTask.remark ||
                                "",

                            vehicleNumber:
                                latestVehicle,

                            vehicleId:
                                latestVehicle,

                            excavatorNumber:
                                latestExcavator,

                            excavatorId:
                                latestExcavator,

                            loadingPoint:
                                latestLoadingPoint,

                            unloadingPoint:
                                latestUnloadingPoint,

                            bindingUpdatedAt:
                                masterTask.updatedAt ||
                                new Date()
                                    .toISOString()
                        };


                        /*
                         * 如果车号发生变化，
                         * 必须重新领取车辆，防止司机继续用旧车计数。
                         */
                        if (
                            vehicleChanged
                        ) {

                            updatedTask.vehicleClaimed =
                                false;

                            updatedTask.status =
                                "assigned";

                            updatedTask.claimedAt =
                                null;
                        }


                        saveCurrentTask(
                            updatedTask
                        );


                        return updatedTask;
                    }


                    return oldTask;
                }


                /*
                 * 发生以下任一种情况：
                 * - 调度已经切换到新班次
                 * - 当前司机从本班绑定中移除
                 *
                 * 清除旧任务，继续向下寻找司机的新绑定。
                 */
                localStorage.removeItem(
                    STORAGE.CURRENT_TASK
                );

            } else {

                /*
                 * 主任务已不存在，也不能继续沿用旧本地任务。
                 */
                localStorage.removeItem(
                    STORAGE.CURRENT_TASK
                );
            }
        }


        /*
         * 从当前调度任务中重新寻找本司机绑定。
         */
        for (
            const task
            of tasks
        ) {

            if (
                task.status !==
                    "pending" &&
                task.status !==
                    "active"
            ) {

                continue;
            }


            const assignments =
                Array.isArray(
                    task.driverAssignments
                )
                    ? task.driverAssignments
                    : [];


            const assignment =
                assignments.find(
                    item =>
                        samePerson(
                            item.driverId ||
                            item.personId,
                            item.driverName ||
                            item.personName
                        )
                );


            if (
                assignment
            ) {

                const vehicle =
                    assignment.vehicleNumber ||
                    assignment.vehicleId ||
                    assignment.truckNumber ||
                    assignment.truckId ||
                    "";


                const excavator =
                    assignment.excavatorNumber ||
                    assignment.excavatorId ||
                    "";


                const converted = {

                    taskId:
                        task.taskId,

                    dispatchTaskId:
                        task.taskId,

                    shiftId:
                        assignment.shiftId ||
                        task.currentShiftId ||
                        task.shiftId ||
                        "",

                    shift:
                        assignment.shift ||
                        task.shift ||
                        "",

                    shiftDate:
                        assignment.shiftDate ||
                        task.shiftDate ||
                        "",

                    workArea:
                        task.area ||
                        task.workArea ||
                        "",

                    remark:
                        task.remark ||
                        "",

                    vehicleNumber:
                        vehicle,

                    vehicleId:
                        vehicle,

                    excavatorNumber:
                        excavator,

                    excavatorId:
                        excavator,

                    loadingPoint:
                        assignment.loadingPoint ||
                        task.loadingPoint ||
                        task.taskLoadingPoint ||
                        "",

                    unloadingPoint:
                        assignment.unloadingPoint ||
                        task.unloadingPoint ||
                        task.taskUnloadingPoint ||
                        "",

                    status:
                        "assigned",

                    vehicleClaimed:
                        false,

                    createdAt:
                        task.publishedAt ||
                        task.createdAt ||
                        new Date()
                            .toISOString(),

                    bindingUpdatedAt:
                        task.updatedAt ||
                        ""
                };


                saveCurrentTask(
                    converted
                );


                return converted;
            }
        }


        return null;
    }

    function saveCurrentTask(task) {

        currentTask = task;

        localStorage.setItem(
            STORAGE.CURRENT_TASK,
            JSON.stringify(task)
        );
    }


    function refreshTask() {

        currentTask = getCurrentTask();

        if (!currentTask) {

            $("noTaskMessage")
                ?.classList
                .remove("hidden");

            $("taskContent")
                ?.classList
                .add("hidden");

            setText(
                "taskStatus",
                "待调度"
            );

            return;
        }

        $("noTaskMessage")
            ?.classList
            .add("hidden");

        $("taskContent")
            ?.classList
            .remove("hidden");

        setText(
            "taskId",
            currentTask.taskId || "-"
        );

        setText(
            "taskVehicle",
            getVehicleNumber(currentTask) || "-"
        );

        setText(
            "taskExcavator",
            currentTask.excavatorNumber ||
            currentTask.excavatorId ||
            "-"
        );

        setText(
            "taskArea",
            currentTask.workArea ||
            currentTask.area ||
            "-"
        );

        setText(
            "taskShift",
            currentTask.shift || "-"
        );

        setText(
            "taskLoadingPoint",
            currentTask.loadingPoint || "-"
        );

        setText(
            "taskUnloadingPoint",
            currentTask.unloadingPoint || "-"
        );

        setText(
            "taskRemark",
            currentTask.remark || "无"
        );

        updateVehicleClaimDisplay();

        updateWorkButtons();

        updateTaskStatusBadge();
    }


    function updateTaskStatusBadge() {

        if (!currentTask) {
            setText("taskStatus", "待调度");
            return;
        }

        const textMap = {
            assigned: "待领取",
            ready: "待作业",
            working: "作业中",
            paused: "已暂停",
            change_pending: "换车审批中"
        };

        setText(
            "taskStatus",
            textMap[currentTask.status] ||
            "待执行"
        );
    }


    /*
    ===============================================
    V2.10.3J
    设备运行状态联动
    ===============================================
    */

    function getEquipmentOperationalRecords() {

        const data =
            readJson(
                STORAGE.OPERATIONAL_STATUS,
                []
            );


        return Array.isArray(data)
            ? data
            : [];
    }


    function getEquipmentOperationalStatusText(
        status
    ) {

        const map = {

            available:
                "可用",

            working:
                "作业中",

            maintenance:
                "维修中",

            service:
                "保养中",

            standby:
                "备用",

            disabled:
                "停用"
        };


        return (
            map[status] ||
            status ||
            "可用"
        );
    }


    function isEquipmentOperationallyBlockedStatus(
        status
    ) {

        return [
            "maintenance",
            "service",
            "disabled"
        ]
        .includes(
            String(
                status ||
                ""
            )
        );
    }


    function hasActiveRepairFlow(
        vehicleNumber
    ) {

        const vehicle =
            String(
                vehicleNumber ||
                ""
            );


        if (
            !vehicle
        ) {

            return false;
        }


        const requests =
            readJson(
                "maintenanceRequests",
                []
            );


        const orders =
            readJson(
                "maintenanceWorkOrders",
                []
            );


        const requestStatuses =
            new Set([
                "pending_dispatch",
                "waiting_entry",
                "waiting_assignment",
                "assigned",
                "working",
                "waiting_parts",
                "waiting_inspection",
                "inspection_passed",
                "rework"
            ]);


        const requestActive =
            Array.isArray(requests)
            &&
            requests.some(
                item =>
                    String(
                        item.equipmentId ||
                        item.equipmentNumber ||
                        item.vehicleId ||
                        item.vehicleNumber ||
                        ""
                    ) ===
                        vehicle
                    &&
                    requestStatuses.has(
                        item.status
                    )
            );


        const orderActive =
            Array.isArray(orders)
            &&
            orders.some(
                item =>
                    String(
                        item.equipmentId ||
                        item.equipmentNumber ||
                        item.vehicleId ||
                        item.vehicleNumber ||
                        ""
                    ) ===
                        vehicle
                    &&
                    item.status !==
                        "completed"
            );


        return (
            requestActive ||
            orderActive
        );
    }


    function getCurrentVehicleOperationalStatus() {

        const vehicle =
            String(
                getVehicleNumber(
                    currentTask
                ) ||
                ""
            );


        if (
            !vehicle
        ) {

            return {
                vehicle:
                    "",

                status:
                    "available",

                source:
                    "none"
            };
        }


        /*
         * 维修流程优先。
         * 即使维修管理页尚未打开同步状态，
         * 司机端也不能继续使用已进入维修流程的车辆。
         */
        if (
            hasActiveRepairFlow(
                vehicle
            )
        ) {

            return {
                vehicle,

                status:
                    "maintenance",

                source:
                    "repair_flow"
            };
        }


        const record =
            getEquipmentOperationalRecords()
                .find(
                    item =>
                        String(
                            item.equipmentId ||
                            ""
                        ) ===
                            vehicle
                );


        if (
            record?.status
        ) {

            return {
                vehicle,

                status:
                    record.status,

                source:
                    record.source ||
                    "operational_status"
            };
        }


        return {
            vehicle,

            status:
                "available",

            source:
                "default"
        };
    }


    function isCurrentVehicleOperationallyBlocked() {

        return isEquipmentOperationallyBlockedStatus(
            getCurrentVehicleOperationalStatus()
                .status
        );
    }


    function requireCurrentVehicleOperational(
        actionText
    ) {

        const state =
            getCurrentVehicleOperationalStatus();


        if (
            !isEquipmentOperationallyBlockedStatus(
                state.status
            )
        ) {

            return true;
        }


        alert(
            "当前车辆不能继续作业。\\n\\n" +
            "车辆：" +
            (
                state.vehicle ||
                "-"
            ) +
            "\\n" +
            "状态：" +
            getEquipmentOperationalStatusText(
                state.status
            ) +
            "\\n\\n" +
            "请等待维修 / 保养完成，或联系调度更换车辆后再" +
            (
                actionText ||
                "继续作业"
            ) +
            "。"
        );


        return false;
    }


    /*
    ===============================================
    V2.10.3J
    本班设备使用检查
    ===============================================
    */

    function getCompletedEquipmentCheck() {

        if (
            !currentTask ||
            !profile
        ) {

            return null;
        }


        const shiftId =
            String(
                currentTask.shiftId ||
                ""
            );


        const vehicle =
            String(
                getVehicleNumber(
                    currentTask
                ) ||
                ""
            );


        const personId =
            String(
                profile.driverId ||
                profile.personId ||
                profile.employeeId ||
                profile.id ||
                ""
            );


        const personName =
            String(
                profile.name ||
                ""
            )
            .trim();


        /*
         * 新版生产任务必须具有 shiftId。
         * 没有班次信息时，不允许绕过检查直接作业。
         */
        if (
            !shiftId ||
            !vehicle
        ) {

            return null;
        }


        const records =
            readJson(
                STORAGE.EQUIPMENT_CHECKS,
                []
            );


        if (
            !Array.isArray(
                records
            )
        ) {

            return null;
        }


        return (
            records
                .filter(
                    item =>
                        item &&
                        item.locked ===
                            true
                )
                .filter(
                    item =>
                        String(
                            item.mode ||
                            item.inspectionMode ||
                            "shift"
                        ) ===
                            "shift"
                )
                .filter(
                    item =>
                        String(
                            item.shiftId ||
                            ""
                        ) ===
                            shiftId
                )
                .filter(
                    item =>
                        String(
                            item.equipmentId ||
                            item.equipmentNumber ||
                            ""
                        ) ===
                            vehicle
                )
                .find(
                    item => {

                        const recordPersonId =
                            String(
                                item.personId ||
                                item.incomingPersonId ||
                                ""
                            );


                        const recordPersonName =
                            String(
                                item.personName ||
                                item.incomingPersonName ||
                                ""
                            )
                            .trim();


                        if (
                            personId &&
                            recordPersonId
                        ) {

                            return (
                                personId ===
                                recordPersonId
                            );
                        }


                        return (
                            personName &&
                            recordPersonName &&
                            personName ===
                                recordPersonName
                        );
                    }
                )
            ||
            null
        );
    }


    function hasCompletedEquipmentCheck() {

        return Boolean(
            getCompletedEquipmentCheck()
        );
    }


    function requireEquipmentCheck(
        actionText
    ) {

        if (
            hasCompletedEquipmentCheck()
        ) {

            return true;
        }


        const vehicle =
            getVehicleNumber(
                currentTask
            ) ||
            "当前车辆";


        if (
            !currentTask?.shiftId
        ) {

            alert(
                "当前任务缺少班次 shiftId，不能开始正式作业。\\n\\n" +
                "请让车队长重新生成 / 发布本班任务。"
            );

            return false;
        }


        alert(
            "请先完成本班设备使用检查。\\n\\n" +
            "车辆：" +
            vehicle +
            "\\n" +
            "班次：" +
            (
                currentTask.shift ||
                currentTask.shiftId ||
                "-"
            ) +
            "\\n\\n" +
            "完成公里数录入和仪表照片后，才能" +
            (
                actionText ||
                "继续作业"
            ) +
            "。"
        );


        return false;
    }


    /*
    ===============================================
    领取车辆
    ===============================================
    */

    function claimVehicle() {

        if (!currentTask) {
            alert("当前没有调度任务。");
            return;
        }

        const vehicle =
            getVehicleNumber(currentTask);

        if (!vehicle) {
            alert("调度尚未给当前任务分配车辆。");
            return;
        }

        if (
            !requireCurrentVehicleOperational(
                "领取车辆"
            )
        ) {
            return;
        }

        if (
            !requireEquipmentCheck(
                "领取车辆"
            )
        ) {
            return;
        }

        if (hasPendingVehicleChange()) {
            alert("换车申请正在审批，请等待调度处理。");
            return;
        }

        if (isOnApprovedLeaveNow()) {
            alert("当前处于已批准请假时间，不能领取生产车辆。");
            return;
        }

        if (
            !confirm(
                "确认领取调度分配车辆：\n" +
                vehicle +
                "？"
            )
        ) {
            return;
        }

        currentTask.vehicleClaimed = true;
        currentTask.claimedAt =
            new Date().toISOString();

        currentTask.status = "ready";

        saveCurrentTask(currentTask);

        refreshAll();
    }


    function updateVehicleClaimDisplay() {

        if (!currentTask) {
            return;
        }

        const vehicle =
            getVehicleNumber(currentTask);

        const checkCompleted =
            hasCompletedEquipmentCheck();


        const operationalState =
            getCurrentVehicleOperationalStatus();


        const claimButton =
            $("claimVehicleButton");


        if (
            isEquipmentOperationallyBlockedStatus(
                operationalState.status
            )
        ) {

            setText(
                "vehicleClaimText",
                vehicle
                    ? vehicle +
                      " · " +
                      getEquipmentOperationalStatusText(
                          operationalState.status
                      ) +
                      " · 不可领取"
                    : "当前车辆不可使用"
            );


            if (
                claimButton
            ) {

                claimButton.disabled =
                    true;

                claimButton.classList
                    .remove("hidden");
            }


            return;
        }


        if (
            !checkCompleted
        ) {

            setText(
                "vehicleClaimText",
                vehicle
                    ? "请先完成设备使用检查 · " +
                      vehicle
                    : "调度尚未分配车辆"
            );


            if (
                claimButton
            ) {

                claimButton.disabled =
                    true;

                claimButton.classList
                    .remove("hidden");
            }


            return;
        }


        if (
            claimButton
        ) {

            claimButton.disabled =
                false;
        }


        if (currentTask.vehicleClaimed) {

            setText(
                "vehicleClaimText",
                "已领取 " + vehicle
            );

            claimButton
                ?.classList
                .add("hidden");

        } else {

            setText(
                "vehicleClaimText",
                vehicle
                    ? "等待领取 " + vehicle
                    : "调度尚未分配车辆"
            );

            claimButton
                ?.classList
                .remove("hidden");
        }
    }


    /*
    ===============================================
    作业状态
    ===============================================
    */

    function startWork() {

        if (!currentTask) {
            alert("当前没有任务。");
            return;
        }

        if (
            !requireCurrentVehicleOperational(
                "开始作业"
            )
        ) {
            return;
        }

        if (
            !requireEquipmentCheck(
                "开始作业"
            )
        ) {
            return;
        }

        if (!currentTask.vehicleClaimed) {
            alert("请先领取调度分配的车辆。");
            return;
        }

        if (hasPendingVehicleChange()) {
            alert("换车申请正在审批，暂时不能开始作业。");
            return;
        }

        if (isOnApprovedLeaveNow()) {
            alert("当前处于已批准请假时间，不能开始作业。");
            return;
        }

        currentTask.status = "working";

        currentTask.startedAt =
            currentTask.startedAt ||
            new Date().toISOString();

        currentTask.lastResumedAt =
            new Date().toISOString();

        saveCurrentTask(currentTask);

        /*
         * 正式开始作业后初始化本班、本司机、本车辆的GPS运输闭环。
         */
        getTransportCycle();

        refreshAll();
    }


    function pauseWork() {

        if (!currentTask) {
            return;
        }

        currentTask.status = "paused";
        currentTask.pausedAt =
            new Date().toISOString();

        saveCurrentTask(currentTask);

        refreshAll();
    }


    function resumeWork() {

        if (!currentTask) {
            return;
        }

        if (
            !requireCurrentVehicleOperational(
                "恢复作业"
            )
        ) {
            return;
        }

        if (
            !requireEquipmentCheck(
                "恢复作业"
            )
        ) {
            return;
        }

        if (hasPendingVehicleChange()) {
            alert("换车申请正在审批。");
            return;
        }

        if (isOnApprovedLeaveNow()) {
            alert("当前处于请假时间，不能恢复作业。");
            return;
        }

        currentTask.status = "working";
        currentTask.lastResumedAt =
            new Date().toISOString();

        saveCurrentTask(currentTask);

        refreshAll();
    }


    function updateWorkButtons() {

        const start =
            $("startWorkButton");

        const pause =
            $("pauseWorkButton");

        const resume =
            $("resumeWorkButton");

        const trip =
            $("addTripButton");

        [
            start,
            pause,
            resume,
            trip
        ].forEach(
            button =>
                button?.classList.add("hidden")
        );

        if (!currentTask) {
            return;
        }

        if (
            isCurrentVehicleOperationallyBlocked()
        ) {
            return;
        }

        if (
            !hasCompletedEquipmentCheck()
        ) {
            return;
        }

        if (
            !currentTask.vehicleClaimed ||
            hasPendingVehicleChange()
        ) {
            return;
        }

        if (
            currentTask.status === "ready" ||
            currentTask.status === "assigned"
        ) {
            start?.classList.remove("hidden");
        }

        if (currentTask.status === "working") {
            pause?.classList.remove("hidden");
            trip?.classList.remove("hidden");

            /*
             * 是否可以完成一趟，
             * 由GPS运输闭环状态决定。
             */
            renderTransportCycleStatus();
        }

        if (currentTask.status === "paused") {
            resume?.classList.remove("hidden");
        }
    }


    /*
    ===============================================
    V2.10.3J
    GPS运输闭环

    一趟正式成立必须依次完成：

    1. 进入本任务装载区
    2. 在装载区连续稳定定位，自动确认“已装车”
    3. 驶离装载区
    4. 进入本任务允许卸载区
    5. 在卸载区点击“完成一趟”
    6. 再获取一次实时GPS复核后 +1 趟

    GPS精度 > 100m 时不允许推进闭环。
    不再允许仅凭“点击完成一趟 + 任意GPS位置”直接计数。
    ===============================================
    */

    function getTransportZones() {

        const zones =
            readJson(
                STORAGE.TRANSPORT_ZONES,
                []
            );


        return Array.isArray(zones)
            ? zones
            : [];
    }


    function splitTransportZoneNames(
        value
    ) {

        if (
            Array.isArray(value)
        ) {

            return value
                .map(
                    item =>
                        String(
                            item ||
                            ""
                        )
                        .trim()
                )
                .filter(Boolean);
        }


        return String(
            value ||
            ""
        )
        .split(
            /[、,，;；|]/
        )
        .map(
            item =>
                item.trim()
        )
        .filter(Boolean);
    }


    function getTransportTaskZoneConfig() {

        if (
            !currentTask
        ) {

            return {
                loadingZone:
                    null,

                unloadingZones:
                    [],

                valid:
                    false,

                reason:
                    "当前没有生产任务"
            };
        }


        const zones =
            getTransportZones()
                .filter(
                    item =>
                        item &&
                        item.enabled !==
                            false
                );


        const loadingId =
            String(
                currentTask.loadingZoneId ||
                currentTask.taskLoadingZoneId ||
                ""
            )
            .trim();


        const loadingName =
            String(
                currentTask.loadingZoneName ||
                currentTask.loadingPoint ||
                currentTask.taskLoadingPoint ||
                ""
            )
            .trim();


        let loadingZone =
            null;


        if (
            loadingId
        ) {

            loadingZone =
                zones.find(
                    item =>
                        item.zoneType ===
                            "loading"
                        &&
                        String(
                            item.zoneId ||
                            ""
                        ) ===
                            loadingId
                )
                ||
                null;
        }


        if (
            !loadingZone &&
            loadingName
        ) {

            loadingZone =
                zones.find(
                    item =>
                        item.zoneType ===
                            "loading"
                        &&
                        String(
                            item.name ||
                            ""
                        )
                        .trim() ===
                            loadingName
                )
                ||
                null;
        }


        const unloadIds =
            Array.isArray(
                currentTask.unloadingZoneIds
            )
                ? currentTask.unloadingZoneIds
                    .map(String)
                : splitTransportZoneNames(
                    currentTask.unloadingZoneIds ||
                    ""
                );


        const unloadNames =
            splitTransportZoneNames(
                currentTask.unloadingZoneNames ||
                currentTask.unloadingPoint ||
                currentTask.taskUnloadingPoint ||
                ""
            );


        let unloadingZones =
            zones.filter(
                item => {

                    if (
                        item.zoneType !==
                            "unloading"
                    ) {

                        return false;
                    }


                    if (
                        unloadIds.length &&
                        unloadIds.includes(
                            String(
                                item.zoneId ||
                                ""
                            )
                        )
                    ) {

                        return true;
                    }


                    return (
                        unloadNames.length &&
                        unloadNames.includes(
                            String(
                                item.name ||
                                ""
                            )
                            .trim()
                        )
                    );
                }
            );


        /*
         * 兼容旧任务：
         * 如果任务里只有一个卸载区名称，
         * 按名称精确匹配 transportZones。
         */
        if (
            !unloadingZones.length &&
            unloadNames.length
        ) {

            unloadingZones =
                zones.filter(
                    item =>
                        item.zoneType ===
                            "unloading"
                        &&
                        unloadNames.includes(
                            String(
                                item.name ||
                                ""
                            )
                            .trim()
                        )
                );
        }


        if (
            !loadingZone
        ) {

            return {
                loadingZone:
                    null,

                unloadingZones,

                valid:
                    false,

                reason:
                    loadingName
                        ? "任务装载区在运输区域库中未找到"
                        : "当前任务没有配置装载区"
            };
        }


        if (
            !unloadingZones.length
        ) {

            return {
                loadingZone,

                unloadingZones:
                    [],

                valid:
                    false,

                reason:
                    "当前任务没有可识别的允许卸载区"
            };
        }


        const invalidMaterial =
            unloadingZones.find(
                zone =>
                    ![
                        "煤",
                        "渣",
                        "只记车数"
                    ]
                    .includes(
                        String(
                            zone.materialType ||
                            ""
                        )
                        .trim()
                    )
            );


        if (
            invalidMaterial
        ) {

            return {
                loadingZone,

                unloadingZones,

                valid:
                    false,

                reason:
                    "卸载区“" +
                    (
                        invalidMaterial.name ||
                        "-"
                    ) +
                    "”物料类型不是统一参数：煤 / 渣 / 只记车数"
            };
        }


        return {
            loadingZone,

            unloadingZones,

            valid:
                true,

            reason:
                ""
        };
    }


    function degreesToRadians(
        value
    ) {

        return Number(value) *
            Math.PI /
            180;
    }


    function distanceMeters(
        latitude1,
        longitude1,
        latitude2,
        longitude2
    ) {

        const earthRadius =
            6371000;


        const lat1 =
            degreesToRadians(
                latitude1
            );


        const lat2 =
            degreesToRadians(
                latitude2
            );


        const deltaLat =
            degreesToRadians(
                Number(latitude2) -
                Number(latitude1)
            );


        const deltaLon =
            degreesToRadians(
                Number(longitude2) -
                Number(longitude1)
            );


        const a =
            Math.sin(
                deltaLat / 2
            ) ** 2
            +
            Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(
                deltaLon / 2
            ) ** 2;


        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(
                    1 - a
                )
            );


        return earthRadius *
            c;
    }


    function getZoneDistance(
        gps,
        zone
    ) {

        if (
            !gps ||
            !zone
        ) {

            return Infinity;
        }


        const latitude =
            Number(
                zone.latitude
            );


        const longitude =
            Number(
                zone.longitude
            );


        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {

            return Infinity;
        }


        return distanceMeters(
            gps.latitude,
            gps.longitude,
            latitude,
            longitude
        );
    }


    function isGpsGoodForTransport(
        gps
    ) {

        if (
            !gps
        ) {

            return false;
        }


        const latitude =
            Number(
                gps.latitude
            );


        const longitude =
            Number(
                gps.longitude
            );


        const accuracy =
            Number(
                gps.accuracy
            );


        return (
            Number.isFinite(latitude)
            &&
            Number.isFinite(longitude)
            &&
            Number.isFinite(accuracy)
            &&
            accuracy > 0
            &&
            accuracy <= 100
        );
    }


    function isInsideTransportZone(
        gps,
        zone
    ) {

        if (
            !isGpsGoodForTransport(
                gps
            ) ||
            !zone
        ) {

            return false;
        }


        const radius =
            Math.max(
                10,
                Number(
                    zone.radius ||
                    0
                )
            );


        /*
         * 最多给GPS误差30米缓冲，
         * 防止车辆在边界处反复跳动。
         * 但GPS精度本身仍必须 <= 100m。
         */
        const accuracyBuffer =
            Math.min(
                30,
                Math.max(
                    0,
                    Number(
                        gps.accuracy ||
                        0
                    )
                )
            );


        return (
            getZoneDistance(
                gps,
                zone
            )
            <=
            radius +
            accuracyBuffer
        );
    }


    function isClearlyOutsideTransportZone(
        gps,
        zone
    ) {

        if (
            !isGpsGoodForTransport(
                gps
            ) ||
            !zone
        ) {

            return false;
        }


        const radius =
            Math.max(
                10,
                Number(
                    zone.radius ||
                    0
                )
            );


        /*
         * 离开装载区采用额外30米滞回，
         * 避免边界GPS漂移造成“刚进区就判定驶离”。
         */
        return (
            getZoneDistance(
                gps,
                zone
            )
            >
            radius +
            30
        );
    }


    function getTransportCycleKey() {

        if (
            !currentTask ||
            !profile
        ) {

            return "";
        }


        return [
            String(
                currentTask.taskId ||
                currentTask.dispatchTaskId ||
                ""
            ),

            String(
                currentTask.shiftId ||
                ""
            ),

            String(
                getVehicleNumber(
                    currentTask
                ) ||
                ""
            ),

            String(
                profile.driverId ||
                profile.personId ||
                profile.employeeId ||
                profile.id ||
                profile.name ||
                ""
            )
        ]
        .join("|");
    }


    function createEmptyTransportCycle() {

        return {
            cycleKey:
                getTransportCycleKey(),

            phase:
                "waiting_loading",

            taskId:
                currentTask?.taskId ||
                currentTask?.dispatchTaskId ||
                "",

            shiftId:
                currentTask?.shiftId ||
                "",

            vehicleNumber:
                currentTask
                    ? getVehicleNumber(
                        currentTask
                    )
                    : "",

            loadingCandidateAt:
                null,

            departureCandidateAt:
                null,

            loadedAt:
                null,

            loadingGps:
                null,

            departedLoadingAt:
                null,

            arrivedUnloadAt:
                null,

            unloadingZoneId:
                "",

            unloadingZoneName:
                "",

            materialType:
                "",

            unloadingGps:
                null,

            updatedAt:
                new Date()
                    .toISOString()
        };
    }


    function getTransportCycle() {

        const key =
            getTransportCycleKey();


        if (
            !key
        ) {

            return null;
        }


        const saved =
            readJson(
                STORAGE.TRANSPORT_CYCLE,
                null
            );


        if (
            !saved ||
            saved.cycleKey !==
                key
        ) {

            const fresh =
                createEmptyTransportCycle();


            saveTransportCycle(
                fresh
            );


            return fresh;
        }


        return saved;
    }


    function saveTransportCycle(
        cycle
    ) {

        if (
            !cycle
        ) {

            return;
        }


        cycle.updatedAt =
            new Date()
                .toISOString();


        localStorage.setItem(
            STORAGE.TRANSPORT_CYCLE,
            JSON.stringify(
                cycle
            )
        );
    }


    function resetTransportCycleForNextTrip() {

        const cycle =
            createEmptyTransportCycle();


        saveTransportCycle(
            cycle
        );


        return cycle;
    }


    function findCurrentUnloadZone(
        gps,
        unloadingZones
    ) {

        if (
            !isGpsGoodForTransport(
                gps
            )
        ) {

            return null;
        }


        return (
            unloadingZones
                .map(
                    zone => ({
                        zone,

                        distance:
                            getZoneDistance(
                                gps,
                                zone
                            )
                    })
                )
                .filter(
                    item =>
                        isInsideTransportZone(
                            gps,
                            item.zone
                        )
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        a.distance -
                        b.distance
                )[0]
                ?.zone
            ||
            null
        );
    }


    function updateTransportCycleState(
        gps
    ) {

        if (
            !currentTask ||
            currentTask.status !==
                "working"
        ) {

            return;
        }


        const config =
            getTransportTaskZoneConfig();


        if (
            !config.valid
        ) {

            return;
        }


        if (
            !isGpsGoodForTransport(
                gps
            )
        ) {

            return;
        }


        const cycle =
            getTransportCycle();


        if (
            !cycle
        ) {

            return;
        }


        const now =
            new Date()
                .toISOString();


        /*
         * 阶段1：
         * 等待进入装载区。
         *
         * 连续在装载区稳定停留至少4秒，
         * 才自动确认“已装车”。
         */
        if (
            cycle.phase ===
                "waiting_loading"
        ) {

            if (
                isInsideTransportZone(
                    gps,
                    config.loadingZone
                )
            ) {

                if (
                    !cycle.loadingCandidateAt
                ) {

                    cycle.loadingCandidateAt =
                        now;


                    saveTransportCycle(
                        cycle
                    );


                    return;
                }


                const elapsed =
                    Date.now() -
                    new Date(
                        cycle.loadingCandidateAt
                    )
                    .getTime();


                if (
                    elapsed >=
                        4000
                ) {

                    cycle.phase =
                        "loaded_wait_departure";


                    cycle.loadedAt =
                        now;


                    cycle.loadingGps = {
                        latitude:
                            gps.latitude,

                        longitude:
                            gps.longitude,

                        accuracy:
                            gps.accuracy,

                        timestamp:
                            gps.timestamp,

                        distanceToCenter:
                            Number(
                                getZoneDistance(
                                    gps,
                                    config.loadingZone
                                )
                                .toFixed(1)
                            )
                    };


                    cycle.loadingZoneId =
                        config.loadingZone.zoneId ||
                        "";


                    cycle.loadingZoneName =
                        config.loadingZone.name ||
                        "";


                    cycle.loadingCandidateAt =
                        null;


                    saveTransportCycle(
                        cycle
                    );
                }


            } else if (
                cycle.loadingCandidateAt
            ) {

                cycle.loadingCandidateAt =
                    null;


                saveTransportCycle(
                    cycle
                );
            }


            return;
        }


        /*
         * 阶段2：
         * 已装车，等待明确驶离装载区。
         *
         * 连续在装载区外稳定至少4秒，
         * 才确认车辆真正离开装载区。
         */
        if (
            cycle.phase ===
                "loaded_wait_departure"
        ) {

            if (
                isClearlyOutsideTransportZone(
                    gps,
                    config.loadingZone
                )
            ) {

                if (
                    !cycle.departureCandidateAt
                ) {

                    cycle.departureCandidateAt =
                        now;


                    saveTransportCycle(
                        cycle
                    );


                    return;
                }


                const elapsed =
                    Date.now() -
                    new Date(
                        cycle.departureCandidateAt
                    )
                    .getTime();


                if (
                    elapsed >=
                        4000
                ) {

                    cycle.phase =
                        "enroute_unload";


                    cycle.departedLoadingAt =
                        now;


                    cycle.departureCandidateAt =
                        null;


                    saveTransportCycle(
                        cycle
                    );
                }


            } else if (
                cycle.departureCandidateAt
            ) {

                cycle.departureCandidateAt =
                    null;


                saveTransportCycle(
                    cycle
                );
            }


            return;
        }


        /*
         * 阶段3：
         * 已驶离装载区，前往任一“本任务允许卸载区”。
         */
        if (
            cycle.phase ===
                "enroute_unload"
        ) {

            const unloadZone =
                findCurrentUnloadZone(
                    gps,
                    config.unloadingZones
                );


            if (
                unloadZone
            ) {

                cycle.phase =
                    "at_unloading";


                cycle.arrivedUnloadAt =
                    now;


                cycle.unloadingZoneId =
                    unloadZone.zoneId ||
                    "";


                cycle.unloadingZoneName =
                    unloadZone.name ||
                    "";


                cycle.materialType =
                    unloadZone.materialType ||
                    "";


                cycle.unloadingGps = {
                    latitude:
                        gps.latitude,

                    longitude:
                        gps.longitude,

                    accuracy:
                        gps.accuracy,

                    timestamp:
                        gps.timestamp,

                    distanceToCenter:
                        Number(
                            getZoneDistance(
                                gps,
                                unloadZone
                            )
                            .toFixed(1)
                        )
                };


                saveTransportCycle(
                    cycle
                );
            }


            return;
        }


        /*
         * 阶段4：
         * 已进入卸载区。
         *
         * 如果司机还没点击“完成一趟”就驶离，
         * 自动退回运输中，防止在卸载区外补点完成。
         */
        if (
            cycle.phase ===
                "at_unloading"
        ) {

            const unloadZone =
                config.unloadingZones
                    .find(
                        zone =>
                            String(
                                zone.zoneId ||
                                ""
                            ) ===
                                String(
                                    cycle.unloadingZoneId ||
                                    ""
                                )
                    );


            if (
                !unloadZone ||
                !isInsideTransportZone(
                    gps,
                    unloadZone
                )
            ) {

                cycle.phase =
                    "enroute_unload";


                cycle.arrivedUnloadAt =
                    null;


                cycle.unloadingZoneId =
                    "";


                cycle.unloadingZoneName =
                    "";


                cycle.materialType =
                    "";


                cycle.unloadingGps =
                    null;


                saveTransportCycle(
                    cycle
                );
            }
        }
    }


    function ensureTransportCycleBox() {

        if (
            $("transportCycleBox")
        ) {

            return;
        }


        const equipmentCheckBox =
            $("equipmentCheckBox");


        if (
            !equipmentCheckBox ||
            !equipmentCheckBox.parentNode
        ) {

            return;
        }


        const box =
            document.createElement(
                "div"
            );


        box.id =
            "transportCycleBox";


        box.className =
            "claim-box";


        box.innerHTML = `
            <div style="width:100%;">
                <strong>
                    📍 GPS运输闭环
                </strong>

                <p
                    id="transportCycleText"
                    style="margin-bottom:6px;"
                >
                    等待任务和GPS
                </p>

                <small
                    id="transportCycleDetail"
                    style="display:block;color:#64748b;line-height:1.55;"
                >
                </small>
            </div>
        `;


        equipmentCheckBox.parentNode
            .insertBefore(
                box,
                equipmentCheckBox
            );
    }


    function renderTransportCycleStatus() {

        ensureTransportCycleBox();


        const box =
            $("transportCycleBox");


        const textBox =
            $("transportCycleText");


        const detail =
            $("transportCycleDetail");


        const button =
            $("addTripButton");


        if (
            !box ||
            !textBox ||
            !detail
        ) {

            return;
        }


        if (
            !currentTask
        ) {

            textBox.textContent =
                "当前没有生产任务";


            detail.textContent =
                "";


            if (
                button
            ) {

                button.disabled =
                    true;
            }


            return;
        }


        const config =
            getTransportTaskZoneConfig();


        if (
            !config.valid
        ) {

            textBox.textContent =
                "⚠️ GPS区域配置不完整";


            detail.textContent =
                config.reason +
                "。请联系调度重新配置运输区域。";


            if (
                button
            ) {

                button.disabled =
                    true;

                button.textContent =
                    "⚠️ 当前任务未配置GPS闭环区域";
            }


            return;
        }


        if (
            currentTask.status !==
                "working"
        ) {

            textBox.textContent =
                "作业开始后自动识别装载区和卸载区";


            detail.textContent =
                "装载区：" +
                (
                    config.loadingZone.name ||
                    "-"
                ) +
                "；允许卸载区：" +
                config.unloadingZones
                    .map(
                        item =>
                            (
                                item.name ||
                                "-"
                            ) +
                            "（" +
                            (
                                item.materialType ||
                                "-"
                            ) +
                            "）"
                    )
                    .join("、");


            return;
        }


        if (
            !isGpsGoodForTransport(
                latestGps
            )
        ) {

            textBox.textContent =
                "📡 等待有效GPS定位";


            detail.textContent =
                "GPS精度必须 ≤ 100 米，才能自动推进运输闭环。";


            if (
                button
            ) {

                button.disabled =
                    true;

                button.textContent =
                    "📡 GPS精度不足";
            }


            return;
        }


        const cycle =
            getTransportCycle();


        if (
            !cycle
        ) {

            return;
        }


        const loadingDistance =
            getZoneDistance(
                latestGps,
                config.loadingZone
            );


        let unloadNearest =
            null;


        if (
            config.unloadingZones.length
        ) {

            unloadNearest =
                config.unloadingZones
                    .map(
                        zone => ({
                            zone,

                            distance:
                                getZoneDistance(
                                    latestGps,
                                    zone
                                )
                        })
                    )
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            a.distance -
                            b.distance
                    )[0]
                    ||
                    null;
        }


        if (
            cycle.phase ===
                "waiting_loading"
        ) {

            const inside =
                isInsideTransportZone(
                    latestGps,
                    config.loadingZone
                );


            textBox.textContent =
                inside
                    ? "⏳ 已进入装载区，正在稳定确认装车"
                    : "① 请进入指定装载区";


            detail.textContent =
                "装载区：" +
                (
                    config.loadingZone.name ||
                    "-"
                ) +
                "；距中心约 " +
                (
                    Number.isFinite(
                        loadingDistance
                    )
                        ? Math.round(
                            loadingDistance
                          )
                        : "-"
                ) +
                " 米";


            if (
                button
            ) {

                button.disabled =
                    true;

                button.textContent =
                    inside
                        ? "⏳ 正在确认装车..."
                        : "📍 等待进入装载区";
            }


            return;
        }


        if (
            cycle.phase ===
                "loaded_wait_departure"
        ) {

            textBox.textContent =
                "② ✅ 已自动确认装车，请驶离装载区";


            detail.textContent =
                "装车确认时间：" +
                formatDateTime(
                    cycle.loadedAt
                );


            if (
                button
            ) {

                button.disabled =
                    true;

                button.textContent =
                    "✅ 已装车 · 请驶离装载区";
            }


            return;
        }


        if (
            cycle.phase ===
                "enroute_unload"
        ) {

            textBox.textContent =
                "③ 🚚 运输中，请前往允许卸载区";


            detail.textContent =
                unloadNearest
                    ? "最近允许卸载区：" +
                      (
                          unloadNearest.zone.name ||
                          "-"
                      ) +
                      "（" +
                      (
                          unloadNearest.zone.materialType ||
                          "-"
                      ) +
                      "），距中心约 " +
                      Math.round(
                          unloadNearest.distance
                      ) +
                      " 米"
                    : "等待进入允许卸载区";


            if (
                button
            ) {

                button.disabled =
                    true;

                button.textContent =
                    "🚚 运输中 · 前往卸载区";
            }


            return;
        }


        if (
            cycle.phase ===
                "at_unloading"
        ) {

            textBox.textContent =
                "④ ✅ 已到达允许卸载区，可以完成本趟";


            detail.textContent =
                "卸载区：" +
                (
                    cycle.unloadingZoneName ||
                    "-"
                ) +
                "；类型：" +
                (
                    cycle.materialType ||
                    "-"
                ) +
                "；点击下方按钮后会再次获取实时GPS复核。";


            if (
                button
            ) {

                button.disabled =
                    false;

                button.textContent =
                    "✅ 到达" +
                    (
                        cycle.unloadingZoneName ||
                        "卸载区"
                    ) +
                    " · 完成一趟";
            }
        }
    }


    function refreshTransportCycle() {

        ensureTransportCycleBox();


        if (
            currentTask &&
            currentTask.status ===
                "working" &&
            latestGps
        ) {

            updateTransportCycleState(
                latestGps
            );
        }


        renderTransportCycleStatus();
    }


    /*
    ===============================================
    GPS
    ===============================================
    */

    function startGpsWatch() {

        if (!navigator.geolocation) {

            updateGpsFailed(
                "当前浏览器不支持GPS定位"
            );

            return;
        }

        setText(
            "gpsStatus",
            "正在定位..."
        );

        navigator.geolocation.getCurrentPosition(
            handleGpsPosition,
            handleGpsError,
            {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 0
            }
        );

        if (gpsWatchId !== null) {
            navigator.geolocation.clearWatch(
                gpsWatchId
            );
        }

        gpsWatchId =
            navigator.geolocation.watchPosition(
                handleGpsPosition,
                handleGpsError,
                {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 5000
                }
            );
    }


    function handleGpsPosition(position) {

        latestGps = {
            latitude:
                position.coords.latitude,
            longitude:
                position.coords.longitude,
            accuracy:
                position.coords.accuracy,
            timestamp:
                new Date(
                    position.timestamp
                ).toISOString()
        };

        localStorage.setItem(
            STORAGE.GPS,
            JSON.stringify(latestGps)
        );

        renderGps();

        updateTransportCycleState(
            latestGps
        );

        renderTransportCycleStatus();
    }


    function handleGpsError(error) {

        let text =
            "定位失败";

        if (error.code === 1) {
            text = "未授权位置权限";
        }

        if (error.code === 2) {
            text = "无法获取位置";
        }

        if (error.code === 3) {
            text = "定位超时";
        }

        updateGpsFailed(text);
    }


    function updateGpsFailed(text) {

        setText(
            "gpsStatus",
            text
        );

        setText(
            "gpsAccuracy",
            "-"
        );

        $("gpsStatusBadge").textContent =
            "定位异常";

        $("gpsStatusBadge").className =
            "mini-badge red";
    }


    function renderGps() {

        if (!latestGps) {

            latestGps =
                readJson(
                    STORAGE.GPS,
                    null
                );
        }

        if (!latestGps) {
            return;
        }

        const accuracy =
            Number(
                latestGps.accuracy || 0
            );

        const good =
            accuracy > 0 &&
            accuracy <= 100;

        setText(
            "gpsStatus",
            good
                ? "定位正常"
                : "定位精度较低"
        );

        setText(
            "gpsAccuracy",
            accuracy
                ? "±" +
                  Math.round(accuracy) +
                  "米"
                : "-"
        );

        setText(
            "gpsUpdateTime",
            formatDateTime(
                latestGps.timestamp
            )
        );

        setText(
            "gpsCoordinates",
            Number(latestGps.latitude)
                .toFixed(6) +
            ", " +
            Number(latestGps.longitude)
                .toFixed(6)
        );

        $("gpsStatusBadge").textContent =
            good
                ? "定位正常"
                : "精度较低";

        $("gpsStatusBadge").className =
            good
                ? "mini-badge green"
                : "mini-badge orange";
    }


    function getFreshPosition() {

        return new Promise(
            function (resolve) {

                if (!navigator.geolocation) {
                    resolve(null);
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    function (position) {

                        resolve({
                            latitude:
                                position.coords.latitude,
                            longitude:
                                position.coords.longitude,
                            accuracy:
                                position.coords.accuracy,
                            timestamp:
                                new Date(
                                    position.timestamp
                                ).toISOString()
                        });
                    },

                    function () {
                        resolve(null);
                    },

                    {
                        enableHighAccuracy: true,
                        timeout: 12000,
                        maximumAge: 0
                    }
                );
            }
        );
    }


    /*
    ===============================================
    完成一趟
    ===============================================
    */

    async function completeTrip() {

        if (
            !currentTask ||
            currentTask.status !==
                "working"
        ) {

            alert(
                "请先开始作业。"
            );

            return;
        }


        if (
            !requireCurrentVehicleOperational(
                "记录运输趟次"
            )
        ) {

            return;
        }


        if (
            !requireEquipmentCheck(
                "记录运输趟次"
            )
        ) {

            return;
        }


        if (
            !currentTask.vehicleClaimed
        ) {

            alert(
                "当前车辆尚未领取。"
            );

            return;
        }


        if (
            hasPendingVehicleChange()
        ) {

            alert(
                "换车申请正在审批，暂时不能记录趟数。"
            );

            return;
        }


        if (
            isOnApprovedLeaveNow()
        ) {

            alert(
                "当前处于已批准请假时间，不能记录生产趟数。"
            );

            return;
        }


        const vehicle =
            getVehicleNumber(
                currentTask
            );


        if (
            !vehicle
        ) {

            alert(
                "当前没有有效车辆。"
            );

            return;
        }


        const config =
            getTransportTaskZoneConfig();


        if (
            !config.valid
        ) {

            alert(
                "当前任务不能完成GPS运输闭环。\n\n" +
                config.reason +
                "\n\n请联系调度重新配置装载区和允许卸载区。"
            );

            return;
        }


        const cycle =
            getTransportCycle();


        if (
            !cycle ||
            cycle.phase !==
                "at_unloading"
        ) {

            alert(
                "当前还没有完成运输闭环。\n\n" +
                "必须按顺序完成：\n" +
                "进入装载区 → 自动确认装车 → 驶离装载区 → 进入允许卸载区。"
            );

            renderTransportCycleStatus();

            return;
        }


        const expectedUnloadZone =
            config.unloadingZones
                .find(
                    zone =>
                        String(
                            zone.zoneId ||
                            ""
                        ) ===
                            String(
                                cycle.unloadingZoneId ||
                                ""
                            )
                );


        if (
            !expectedUnloadZone
        ) {

            alert(
                "当前卸载区域已经不在本任务允许范围内，请重新进入允许卸载区。"
            );


            cycle.phase =
                "enroute_unload";


            cycle.unloadingZoneId =
                "";


            cycle.unloadingZoneName =
                "";


            cycle.materialType =
                "";


            cycle.unloadingGps =
                null;


            saveTransportCycle(
                cycle
            );


            renderTransportCycleStatus();

            return;
        }


        $("addTripButton").disabled =
            true;


        $("addTripButton").textContent =
            "📍 正在复核卸载区GPS...";


        /*
         * 最终点击时必须重新读取实时GPS。
         * 不使用旧缓存位置完成一趟。
         */
        const gps =
            await getFreshPosition();


        if (
            !isGpsGoodForTransport(
                gps
            )
        ) {

            alert(
                "本次实时GPS无法确认卸载区域。\n\n" +
                "要求：GPS精度 ≤ 100 米。\n" +
                "请等待定位稳定后重新点击。"
            );


            resetTripButton();

            return;
        }


        if (
            !isInsideTransportZone(
                gps,
                expectedUnloadZone
            )
        ) {

            cycle.phase =
                "enroute_unload";


            cycle.arrivedUnloadAt =
                null;


            cycle.unloadingZoneId =
                "";


            cycle.unloadingZoneName =
                "";


            cycle.materialType =
                "";


            cycle.unloadingGps =
                null;


            saveTransportCycle(
                cycle
            );


            latestGps =
                gps;


            localStorage.setItem(
                STORAGE.GPS,
                JSON.stringify(
                    gps
                )
            );


            renderGps();

            alert(
                "实时GPS显示车辆已经不在允许卸载区内。\n\n" +
                "本趟尚未计数，请重新进入允许卸载区。"
            );


            resetTripButton();

            return;
        }


        /*
         * 第二次防重：
         * 同一运输闭环只允许保存一次。
         */
        if (
            cycle.completedAt
        ) {

            alert(
                "本次运输闭环已经完成，不能重复计数。"
            );


            resetTransportCycleForNextTrip();

            resetTripButton();

            return;
        }


        const now =
            new Date()
                .toISOString();


        cycle.completedAt =
            now;


        cycle.unloadingGps = {
            latitude:
                gps.latitude,

            longitude:
                gps.longitude,

            accuracy:
                gps.accuracy,

            timestamp:
                gps.timestamp,

            distanceToCenter:
                Number(
                    getZoneDistance(
                        gps,
                        expectedUnloadZone
                    )
                    .toFixed(1)
                )
        };


        saveTransportCycle(
            cycle
        );


        const tripId =
            "TRIP_" +
            Date.now();


        const record = {

            id:
                tripId,

            tripId,

            taskId:
                currentTask.taskId ||
                "",

            dispatchTaskId:
                currentTask.dispatchTaskId ||
                currentTask.taskId ||
                "",

            shiftId:
                currentTask.shiftId ||
                "",

            shiftDate:
                currentTask.shiftDate ||
                "",

            productionDate:
                currentTask.shiftDate ||
                "",

            driverId:
                profile.driverId ||
                profile.personId ||
                "",

            personId:
                profile.personId ||
                profile.driverId ||
                "",

            employeeNo:
                profile.employeeNo ||
                "",

            driverName:
                profile.name ||
                "",

            vehicleId:
                currentTask.vehicleId ||
                vehicle,

            vehicleNumber:
                vehicle,

            excavatorId:
                currentTask.excavatorId ||
                currentTask.excavatorNumber ||
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

            /*
             * GPS区域闭环真实位置，
             * 不再只保存任务文字。
             */
            loadingZoneId:
                cycle.loadingZoneId ||
                config.loadingZone.zoneId ||
                "",

            loadingZoneName:
                cycle.loadingZoneName ||
                config.loadingZone.name ||
                "",

            loadingPoint:
                cycle.loadingZoneName ||
                config.loadingZone.name ||
                currentTask.loadingPoint ||
                "",

            unloadingZoneId:
                expectedUnloadZone.zoneId ||
                "",

            unloadingZoneName:
                expectedUnloadZone.name ||
                "",

            unloadingPoint:
                expectedUnloadZone.name ||
                "",

            materialType:
                expectedUnloadZone.materialType ||
                "",

            material:
                expectedUnloadZone.materialType ||
                "",

            loadedAt:
                cycle.loadedAt ||
                "",

            departedLoadingAt:
                cycle.departedLoadingAt ||
                "",

            arrivedUnloadAt:
                cycle.arrivedUnloadAt ||
                "",

            completedAt:
                now,

            unloadedAt:
                now,

            tripCount:
                1,

            /*
             * 装载区GPS证据
             */
            loadingLatitude:
                cycle.loadingGps?.latitude ??
                null,

            loadingLongitude:
                cycle.loadingGps?.longitude ??
                null,

            loadingGpsAccuracy:
                cycle.loadingGps?.accuracy ??
                null,

            loadingGpsTime:
                cycle.loadingGps?.timestamp ??
                null,

            loadingDistanceToCenter:
                cycle.loadingGps
                    ?.distanceToCenter ??
                null,

            /*
             * 卸载区GPS证据
             */
            latitude:
                gps.latitude,

            longitude:
                gps.longitude,

            gpsAccuracy:
                gps.accuracy,

            gpsTime:
                gps.timestamp,

            unloadingLatitude:
                gps.latitude,

            unloadingLongitude:
                gps.longitude,

            unloadingGpsAccuracy:
                gps.accuracy,

            unloadingGpsTime:
                gps.timestamp,

            unloadingDistanceToCenter:
                cycle.unloadingGps
                    ?.distanceToCenter ??
                null,

            gpsStatus:
                "正常",

            dataSource:
                "司机端GPS区域闭环",

            transportValidation:
                "gps_geofence_closed_loop",

            loadingValidated:
                true,

            unloadingValidated:
                true,

            manualOverride:
                false,

            dispatchConfirmation:
                "not_required",

            officialCountEligible:
                true,

            abnormalType:
                "",

            vehicleAuthorized:
                true
        };


        const records =
            getTripRecords();


        records.push(
            record
        );


        saveTripRecords(
            records
        );


        latestGps =
            gps;


        localStorage.setItem(
            STORAGE.GPS,
            JSON.stringify(
                gps
            )
        );


        renderGps();


        /*
         * 本趟成功后立即开始下一趟闭环：
         * 必须重新进入装载区，不能在卸载区连续点击计数。
         */
        resetTransportCycleForNextTrip();


        resetTripButton();


        refreshAll();


        alert(
            "本趟已完成并正式计数。\n\n" +
            "装载区：" +
            (
                record.loadingPoint ||
                "-"
            ) +
            "\n" +
            "卸载区：" +
            (
                record.unloadingPoint ||
                "-"
            ) +
            "\n" +
            "运输类型：" +
            (
                record.materialType ||
                "-"
            )
        );
    }

    function resetTripButton() {

        const button =
            $("addTripButton");


        if (
            button
        ) {

            button.disabled =
                true;
        }


        renderTransportCycleStatus();
    }


    /*
    ===============================================
    趟次记录
    ===============================================
    */

    function getTripRecords() {

        const records =
            readJson(
                STORAGE.TRIPS,
                []
            );

        return Array.isArray(records)
            ? records
            : [];
    }


    function saveTripRecords(records) {

        localStorage.setItem(
            STORAGE.TRIPS,
            JSON.stringify(records)
        );
    }


    function getMyTrips() {

        return getTripRecords()
            .filter(
                record =>
                    samePerson(
                        record.driverId,
                        record.driverName
                    )
            );
    }


    /*
    ===============================================
    本班趟数
    ===============================================

    规则：
    1. 优先按 shiftId 统计，夜班跨零点也不会被拆分。
    2. 旧数据没有 shiftId 时，才使用 shiftDate + shift 兼容。
    3. 调度判定无效 / officialCountEligible=false 的趟次不计入正式趟数。
    */

    function isOfficialTrip(
        record
    ) {

        if (!record) {

            return false;
        }


        if (
            record.officialCountEligible ===
                false
        ) {

            return false;
        }


        if (
            record.dispatchConfirmation ===
                "rejected" ||
            record.dispatchConfirmation ===
                "已判定无效"
        ) {

            return false;
        }


        return true;
    }


    function isTripInCurrentShift(
        record
    ) {

        if (
            !record ||
            !currentTask
        ) {

            return false;
        }


        const currentShiftId =
            String(
                currentTask.shiftId ||
                ""
            )
            .trim();


        const recordShiftId =
            String(
                record.shiftId ||
                ""
            )
            .trim();


        if (
            currentShiftId
        ) {

            return (
                recordShiftId ===
                currentShiftId
            );
        }


        const currentShiftDate =
            String(
                currentTask.shiftDate ||
                ""
            )
            .trim();


        const currentShift =
            String(
                currentTask.shift ||
                ""
            )
            .trim();


        return Boolean(
            currentShiftDate &&
            currentShift &&
            String(
                record.shiftDate ||
                record.productionDate ||
                ""
            )
            .trim() ===
                currentShiftDate &&
            String(
                record.shift ||
                ""
            )
            .trim() ===
                currentShift
        );
    }


    function getCurrentShiftTrips() {

        return getTripRecords()
            .filter(
                isTripInCurrentShift
            );
    }


    function getMyCurrentShiftTrips() {

        return getCurrentShiftTrips()
            .filter(
                record =>
                    samePerson(
                        record.driverId ||
                        record.personId,
                        record.driverName
                    )
            );
    }


    function getCurrentShiftAssignments() {

        if (!currentTask) {

            return [];
        }


        const tasks =
            readJson(
                STORAGE.DISPATCH_TASKS,
                []
            );


        if (
            !Array.isArray(
                tasks
            )
        ) {

            return [];
        }


        const currentShiftId =
            String(
                currentTask.shiftId ||
                ""
            )
            .trim();


        const result = [];


        tasks.forEach(
            function (task) {

                const taskShiftId =
                    String(
                        task.currentShiftId ||
                        task.shiftId ||
                        ""
                    )
                    .trim();


                const assignments =
                    Array.isArray(
                        task.driverAssignments
                    )
                        ? task.driverAssignments
                        : [];


                assignments.forEach(
                    function (assignment) {

                        const assignmentShiftId =
                            String(
                                assignment.shiftId ||
                                taskShiftId ||
                                ""
                            )
                            .trim();


                        if (
                            currentShiftId &&
                            assignmentShiftId !==
                                currentShiftId
                        ) {

                            return;
                        }


                        result.push({

                            personId:
                                String(
                                    assignment.driverId ||
                                    assignment.personId ||
                                    ""
                                ),

                            personName:
                                String(
                                    assignment.driverName ||
                                    assignment.personName ||
                                    ""
                                ),

                            employeeNo:
                                String(
                                    assignment.employeeNo ||
                                    ""
                                ),

                            vehicleNumber:
                                String(
                                    assignment.vehicleNumber ||
                                    assignment.vehicleId ||
                                    assignment.truckNumber ||
                                    assignment.truckId ||
                                    ""
                                ),

                            shiftId:
                                assignmentShiftId
                        });

                    }
                );

            }
        );


        return result;
    }


    function getPersonKeyFromTrip(
        record
    ) {

        const id =
            String(
                record?.driverId ||
                record?.personId ||
                ""
            )
            .trim();


        if (id) {

            return "ID:" + id;
        }


        return "NAME:" +
            String(
                record?.driverName ||
                ""
            )
            .trim();
    }


    function getCurrentPersonKey() {

        const id =
            String(
                profile?.driverId ||
                profile?.personId ||
                ""
            )
            .trim();


        if (id) {

            return "ID:" + id;
        }


        return "NAME:" +
            String(
                profile?.name ||
                ""
            )
            .trim();
    }


    function refreshShiftRankings() {

        if (!currentTask) {

            setText(
                "tripRankValue",
                "--"
            );

            setText(
                "performanceRankValue",
                "--"
            );

            setText(
                "tripRankScope",
                "等待班次任务"
            );

            setText(
                "performanceRankScope",
                "等待班次任务"
            );

            return;
        }


        const shiftTrips =
            getCurrentShiftTrips();


        const validTrips =
            shiftTrips.filter(
                isOfficialTrip
            );


        const assignments =
            getCurrentShiftAssignments();


        /*
        -----------------------------------------------
        1. 车辆趟数排名
        -----------------------------------------------
        */

        const vehicleStats =
            new Map();


        assignments.forEach(
            function (item) {

                if (
                    item.vehicleNumber
                ) {

                    vehicleStats.set(
                        item.vehicleNumber,
                        vehicleStats.get(
                            item.vehicleNumber
                        ) || 0
                    );
                }

            }
        );


        validTrips.forEach(
            function (record) {

                const vehicle =
                    String(
                        record.vehicleNumber ||
                        record.vehicleId ||
                        ""
                    )
                    .trim();


                if (!vehicle) {

                    return;
                }


                vehicleStats.set(
                    vehicle,
                    (
                        vehicleStats.get(
                            vehicle
                        ) || 0
                    ) + 1
                );

            }
        );


        const currentVehicle =
            String(
                getVehicleNumber(
                    currentTask
                ) ||
                ""
            )
            .trim();


        if (
            currentVehicle &&
            !vehicleStats.has(
                currentVehicle
            )
        ) {

            vehicleStats.set(
                currentVehicle,
                0
            );
        }


        const vehicleRanking =
            Array.from(
                vehicleStats.entries()
            )
            .map(
                ([vehicle, count]) => ({
                    vehicle,
                    count
                })
            )
            .sort(
                (a, b) =>
                    b.count -
                        a.count ||
                    a.vehicle.localeCompare(
                        b.vehicle,
                        "zh-CN"
                    )
            );


        const vehicleRankIndex =
            vehicleRanking.findIndex(
                item =>
                    item.vehicle ===
                    currentVehicle
            );


        setText(
            "tripRankValue",
            vehicleRankIndex >= 0
                ? "第" +
                  (
                      vehicleRankIndex + 1
                  ) +
                  " / " +
                  vehicleRanking.length +
                  "名"
                : "--"
        );


        setText(
            "tripRankScope",
            (
                currentTask.shift ||
                "本班"
            ) +
            (
                currentVehicle
                    ? " · " +
                      currentVehicle
                    : ""
            )
        );


        /*
        -----------------------------------------------
        2. 正式综合绩效排名
        -----------------------------------------------

        不在司机端重复计算绩效公式。
        直接读取综合报表中心已经生成的月度排名：

        综合得分 =
        运输排名得分 × 运输权重
        + 节油排名得分 × 节油权重
        + 维修排名得分 × 维修权重

        这样司机端与综合报表中心始终使用同一套结果。
        */

        const performanceMonth =
            getPerformanceMonth();


        const performanceRecords =
            readJson(
                STORAGE.PERFORMANCE_RANKING,
                []
            );


        const monthRecords =
            Array.isArray(
                performanceRecords
            )
                ? performanceRecords
                    .filter(
                        item =>
                            String(
                                item.month ||
                                ""
                            ) ===
                                performanceMonth
                    )
                : [];


        const myPersonId =
            String(
                profile.personId ||
                profile.driverId ||
                profile.employeeId ||
                ""
            )
            .trim();


        const myName =
            String(
                profile.name ||
                ""
            )
            .trim();


        const myPerformance =
            monthRecords.find(
                item => {

                    const itemPersonId =
                        String(
                            item.personId ||
                            item.driverId ||
                            item.employeeId ||
                            ""
                        )
                        .trim();


                    const itemName =
                        String(
                            item.personName ||
                            item.driverName ||
                            item.name ||
                            ""
                        )
                        .trim();


                    if (
                        myPersonId &&
                        itemPersonId
                    ) {

                        return (
                            myPersonId ===
                            itemPersonId
                        );
                    }


                    return Boolean(
                        myName &&
                        itemName &&
                        myName ===
                            itemName
                    );
                }
            ) ||
            null;


        if (
            !myPerformance
        ) {

            setText(
                "performanceRankValue",
                "--"
            );


            setText(
                "performanceRankScope",
                performanceMonth +
                " · 本月绩效排名待生成"
            );


            return;
        }


        const performanceRank =
            Number(
                myPerformance.rank ||
                0
            );


        const totalPeople =
            Number(
                myPerformance.totalPeople ||
                monthRecords.length ||
                0
            );


        const comprehensiveScore =
            Number(
                myPerformance.comprehensiveScore ||
                0
            );


        setText(
            "performanceRankValue",
            performanceRank > 0
                ? "第" +
                  performanceRank +
                  " / " +
                  totalPeople +
                  "名"
                : "--"
        );


        setText(
            "performanceRankScope",
            performanceMonth +
            " · 综合分 " +
            comprehensiveScore
                .toFixed(1)
        );
    }


    /*
    ===============================================
    正式绩效排名月份
    ===============================================

    优先使用当前生产班次日期所属月份；
    没有班次日期时使用当前自然月。
    */

    function getPerformanceMonth() {

        const shiftDate =
            String(
                currentTask?.shiftDate ||
                ""
            )
            .trim();


        if (
            /^\d{4}-\d{2}/
                .test(
                    shiftDate
                )
        ) {

            return shiftDate
                .slice(
                    0,
                    7
                );
        }


        const now =
            new Date();


        return (
            now.getFullYear() +
            "-" +
            String(
                now.getMonth() + 1
            )
            .padStart(
                2,
                "0"
            )
        );
    }


    function refreshTrips() {

        const trips =
            getMyCurrentShiftTrips()
                .filter(
                    isOfficialTrip
                )
                .sort(
                    (a, b) =>
                        new Date(b.completedAt) -
                        new Date(a.completedAt)
                );

        setText(
            "todayTripCount",
            trips.length
        );

        setText(
            "tripCountBadge",
            trips.length + "趟"
        );

        const box =
            $("tripRecordList");

        if (!trips.length) {

            box.innerHTML =
                '<div class="empty-box">暂无运输记录</div>';

            return;
        }

        box.innerHTML =
            trips.map(
                function (record, index) {

                    const review =
                        getGpsReviewText(record);

                    return `
                        <div class="record-card">

                            <div class="record-top">

                                <strong>
                                    第 ${trips.length - index} 趟
                                </strong>

                                <span class="${review.className}">
                                    ${escapeHtml(review.text)}
                                </span>

                            </div>

                            <div class="record-grid">

                                <div>
                                    <span>车辆</span>
                                    <strong>
                                        ${escapeHtml(record.vehicleNumber || "-")}
                                    </strong>
                                </div>

                                <div>
                                    <span>挖机</span>
                                    <strong>
                                        ${escapeHtml(record.excavatorNumber || "-")}
                                    </strong>
                                </div>

                                <div>
                                    <span>时间</span>
                                    <strong>
                                        ${formatDateTime(record.completedAt)}
                                    </strong>
                                </div>

                                <div>
                                    <span>GPS精度</span>
                                    <strong>
                                        ${
                                            record.gpsAccuracy
                                                ? "±" +
                                                  Math.round(record.gpsAccuracy) +
                                                  "米"
                                                : "无GPS"
                                        }
                                    </strong>
                                </div>

                            </div>

                            ${
                                record.dispatchReviewNote
                                    ? `
                                        <div class="record-note">
                                            调度备注：
                                            ${escapeHtml(record.dispatchReviewNote)}
                                        </div>
                                    `
                                    : ""
                            }

                        </div>
                    `;
                }
            )
            .join("");
    }


    function getGpsReviewText(record) {

        if (
            record.dispatchConfirmation === "confirmed" ||
            record.dispatchConfirmation === "已确认有效"
        ) {
            return {
                text: "调度确认有效",
                className: "record-status green-text"
            };
        }

        if (
            record.dispatchConfirmation === "rejected" ||
            record.dispatchConfirmation === "已判定无效"
        ) {
            return {
                text: "调度判定无效",
                className: "record-status red-text"
            };
        }

        if (
            record.gpsStatus === "正常" ||
            record.gpsStatus === "normal"
        ) {
            return {
                text: "GPS正常",
                className: "record-status green-text"
            };
        }

        return {
            text: "等待调度审核",
            className: "record-status orange-text"
        };
    }


    /*
    ===============================================
    换车
    ===============================================
    */

    function openVehicleChangeModal() {

        if (!currentTask) {
            alert("当前没有生产任务。");
            return;
        }

        if (!currentTask.vehicleClaimed) {
            alert("当前还没有领取车辆。");
            return;
        }

        if (hasPendingVehicleChange()) {
            alert("已有换车申请正在等待调度审批。");
            return;
        }

        $("vehicleFaultReason").value = "";

        showModal("vehicleChangeModal");
    }


    function submitVehicleChange() {

        if (!currentTask) {
            return;
        }

        const reason =
            $("vehicleFaultReason")
                .value
                .trim();

        if (!reason) {
            alert("请输入车辆故障或换车原因。");
            return;
        }

        const requests =
            getVehicleChangeRequests();

        requests.push({

            requestId:
                "CHANGE_" + Date.now(),

            driverId:
                profile.driverId || profile.personId || "",

            personId:
                profile.personId || profile.driverId || "",

            employeeNo:
                profile.employeeNo || "",

            driverName:
                profile.name || "",

            shiftId:
                currentTask.shiftId || "",

            taskId:
                currentTask.taskId || "",

            oldVehicleId:
                currentTask.vehicleId ||
                getVehicleNumber(currentTask),

            oldVehicleNumber:
                getVehicleNumber(currentTask),

            reason,

            status:
                "pending",

            requestedAt:
                new Date().toISOString(),

            approvedVehicleId: "",

            approvedVehicleNumber: "",

            appliedToDriverTask:
                false
        });

        saveVehicleChangeRequests(
            requests
        );

        currentTask.status =
            "change_pending";

        saveCurrentTask(currentTask);

        hideModal("vehicleChangeModal");

        refreshAll();

        alert(
            "换车申请已提交。\n" +
            "请等待调度审批。"
        );
    }


    function getVehicleChangeRequests() {

        const data =
            readJson(
                STORAGE.CHANGE_REQUESTS,
                []
            );

        return Array.isArray(data)
            ? data
            : [];
    }


    function saveVehicleChangeRequests(records) {

        localStorage.setItem(
            STORAGE.CHANGE_REQUESTS,
            JSON.stringify(records)
        );
    }


    function getMyVehicleChangeRequests() {

        return getVehicleChangeRequests()
            .filter(
                item =>
                    samePerson(
                        item.driverId,
                        item.driverName
                    )
            );
    }


    function hasPendingVehicleChange() {

        return getMyVehicleChangeRequests()
            .some(
                item =>
                    item.status === "pending" &&
                    (
                        !currentTask ||
                        !item.taskId ||
                        item.taskId ===
                        currentTask.taskId
                    )
            );
    }


    function applyApprovedVehicleChange() {

        if (!currentTask) {
            return;
        }

        const records =
            getVehicleChangeRequests();

        const index =
            records.findIndex(
                item =>
                    samePerson(
                        item.driverId,
                        item.driverName
                    ) &&
                    item.status === "approved" &&
                    !item.appliedToDriverTask &&
                    (
                        !item.taskId ||
                        item.taskId ===
                        currentTask.taskId
                    )
            );

        if (index < 0) {
            return;
        }

        const request =
            records[index];

        const newVehicle =
            request.approvedVehicleNumber ||
            request.approvedVehicleId;

        if (!newVehicle) {
            return;
        }

        const oldVehicle =
            request.oldVehicleNumber ||
            request.oldVehicleId ||
            getVehicleNumber(currentTask);

        currentTask.vehicleNumber =
            newVehicle;

        currentTask.vehicleId =
            newVehicle;

        currentTask.vehicleClaimed =
            false;

        currentTask.status =
            "assigned";

        currentTask.vehicleChangedAt =
            new Date().toISOString();

        saveCurrentTask(currentTask);

        /*
        同步修改调度任务设备绑定。
        */

        replaceTruckInDispatchTask(
            currentTask.taskId,
            oldVehicle,
            newVehicle
        );

        records[index]
            .appliedToDriverTask = true;

        records[index]
            .appliedAt =
            new Date().toISOString();

        saveVehicleChangeRequests(records);

        alert(
            "调度已批准换车。\n\n" +
            oldVehicle +
            " → " +
            newVehicle +
            "\n\n请重新领取新车辆后继续原任务。"
        );
    }


    function replaceTruckInDispatchTask(
        taskId,
        oldVehicle,
        newVehicle
    ) {

        if (!taskId) {
            return;
        }

        const tasks =
            readJson(
                STORAGE.DISPATCH_TASKS,
                []
            );

        if (!Array.isArray(tasks)) {
            return;
        }

        const index =
            tasks.findIndex(
                task =>
                    task.taskId === taskId
            );

        if (index < 0) {
            return;
        }

        let replaced = false;

        (tasks[index].bindings || [])
            .forEach(
                binding => {

                    binding.truckIds =
                        (binding.truckIds || [])
                            .map(
                                truckId => {

                                    if (
                                        truckId === oldVehicle
                                    ) {
                                        replaced = true;
                                        return newVehicle;
                                    }

                                    return truckId;
                                }
                            );
                }
            );

        if (replaced) {

            tasks[index]
                .equipmentAdjustments =
                tasks[index]
                    .equipmentAdjustments ||
                [];

            tasks[index]
                .equipmentAdjustments
                .push({

                    adjustmentId:
                        "ADJ_CHANGE_" +
                        Date.now(),

                    time:
                        new Date()
                            .toISOString(),

                    summary:
                        "司机故障换车：" +
                        oldVehicle +
                        " → " +
                        newVehicle,

                    reason:
                        "调度批准司机换车申请"
                });

            localStorage.setItem(
                STORAGE.DISPATCH_TASKS,
                JSON.stringify(tasks)
            );
        }
    }


    function refreshVehicleChangeRecords() {

        const records =
            getMyVehicleChangeRequests()
                .sort(
                    (a, b) =>
                        new Date(b.requestedAt) -
                        new Date(a.requestedAt)
                );

        const box =
            $("vehicleChangeRecordList");

        if (!records.length) {

            box.innerHTML =
                '<div class="empty-box">暂无换车申请</div>';

            return;
        }

        box.innerHTML =
            records.map(
                item => {

                    const status =
                        getChangeStatus(item);

                    return `
                        <div class="record-card">

                            <div class="record-top">

                                <strong>
                                    ${escapeHtml(item.oldVehicleNumber || "-")}
                                    ${
                                        item.approvedVehicleNumber
                                            ? " → " +
                                              escapeHtml(item.approvedVehicleNumber)
                                            : ""
                                    }
                                </strong>

                                <span class="${status.className}">
                                    ${status.text}
                                </span>

                            </div>

                            <div class="record-note">
                                ${escapeHtml(item.reason || "-")}
                            </div>

                            <div class="record-time">
                                ${formatDateTime(item.requestedAt)}
                            </div>

                        </div>
                    `;
                }
            )
            .join("");
    }


    function getChangeStatus(item) {

        if (item.status === "approved") {
            return {
                text: "已批准",
                className:
                    "record-status green-text"
            };
        }

        if (item.status === "rejected") {
            return {
                text: "已驳回",
                className:
                    "record-status red-text"
            };
        }

        return {
            text: "待调度审批",
            className:
                "record-status orange-text"
        };
    }


    /*
    ===============================================
    请假
    ===============================================
    */

    function openLeaveModal() {

        $("leaveReason").value = "";

        showModal("leaveModal");
    }


    function submitLeave() {

        const type =
            $("leaveType").value;

        const start =
            $("leaveStart").value;

        const end =
            $("leaveEnd").value;

        const phone =
            $("leaveContactPhone")
                .value
                .trim();

        const reason =
            $("leaveReason")
                .value
                .trim();

        if (
            !start ||
            !end ||
            !reason
        ) {
            alert("请完整填写请假时间和原因。");
            return;
        }

        if (
            new Date(end) <=
            new Date(start)
        ) {
            alert("请假结束时间必须晚于开始时间。");
            return;
        }

        if (
            hasOverlappingPendingOrApprovedLeave(
                start,
                end
            )
        ) {
            alert(
                "当前时间段已有待审批或已批准请假申请。"
            );
            return;
        }

        const records =
            getLeaveRequests();

        records.push({

            leaveId:
                "LEAVE_" + Date.now(),

            applicantId:
                profile.driverId || profile.personId || "",

            personId:
                profile.driverId || profile.personId || "",

            applicantName:
                profile.name || "",

            personName:
                profile.name || "",

            employeeNo:
                profile.employeeNo || "",

            role:
                "driver",

            position:
                profile.position ||
                "卡车司机",

            team:
                profile.team ||
                profile.department ||
                "",

            department:
                profile.department ||
                profile.team ||
                "",

            employeeLevel:
                "frontline",

            leaveType:
                type,

            startTime:
                new Date(start)
                    .toISOString(),

            endTime:
                new Date(end)
                    .toISOString(),

            contactPhone:
                phone,

            reason,

            status:
                "pending",

            approverRole:
                "dispatch",

            approvalLevel:
                "调度审批",

            submittedAt:
                new Date()
                    .toISOString(),

            approvedAt: null,

            approvedBy: "",

            approvalRemark: ""
        });

        saveLeaveRequests(records);

        hideModal("leaveModal");

        $("leaveStart").value = "";
        $("leaveEnd").value = "";
        $("leaveReason").value = "";

        refreshAll();

        alert(
            "请假申请已提交。\n审批人：调度。"
        );
    }


    function getLeaveRequests() {

        const data =
            readJson(
                STORAGE.LEAVE_REQUESTS,
                []
            );

        return Array.isArray(data)
            ? data
            : [];
    }


    function saveLeaveRequests(records) {

        localStorage.setItem(
            STORAGE.LEAVE_REQUESTS,
            JSON.stringify(records)
        );
    }


    function getMyLeaveRequests() {

        return getLeaveRequests()
            .filter(
                item =>
                    samePerson(
                        item.applicantId ||
                        item.personId,
                        item.applicantName ||
                        item.personName
                    )
            );
    }


    function hasOverlappingPendingOrApprovedLeave(
        start,
        end
    ) {

        const newStart =
            new Date(start);

        const newEnd =
            new Date(end);

        return getMyLeaveRequests()
            .some(
                item => {

                    if (
                        item.status !== "pending" &&
                        item.status !== "approved"
                    ) {
                        return false;
                    }

                    const oldStart =
                        new Date(item.startTime);

                    const oldEnd =
                        new Date(item.endTime);

                    return (
                        oldStart < newEnd &&
                        oldEnd > newStart
                    );
                }
            );
    }


    function isOnApprovedLeaveNow() {

        const now =
            new Date();

        return getMyLeaveRequests()
            .some(
                item => {

                    if (
                        item.status !== "approved"
                    ) {
                        return false;
                    }

                    return (
                        new Date(item.startTime) <= now &&
                        new Date(item.endTime) >= now
                    );
                }
            );
    }


    function refreshLeaveRecords() {

        const records =
            getMyLeaveRequests()
                .sort(
                    (a, b) =>
                        new Date(b.submittedAt) -
                        new Date(a.submittedAt)
                );

        const box =
            $("leaveRecordList");

        if (!records.length) {

            box.innerHTML =
                '<div class="empty-box">暂无请假记录</div>';

            return;
        }

        box.innerHTML =
            records.map(
                item => {

                    const status =
                        getLeaveStatus(item);

                    return `
                        <div class="record-card">

                            <div class="record-top">

                                <strong>
                                    ${escapeHtml(item.leaveType || "请假")}
                                </strong>

                                <span class="${status.className}">
                                    ${status.text}
                                </span>

                            </div>

                            <div class="record-grid">

                                <div>
                                    <span>开始</span>
                                    <strong>
                                        ${formatDateTime(item.startTime)}
                                    </strong>
                                </div>

                                <div>
                                    <span>结束</span>
                                    <strong>
                                        ${formatDateTime(item.endTime)}
                                    </strong>
                                </div>

                            </div>

                            <div class="record-note">
                                ${escapeHtml(item.reason || "-")}
                            </div>

                            ${
                                item.approvalRemark
                                    ? `
                                        <div class="record-note">
                                            审批备注：
                                            ${escapeHtml(item.approvalRemark)}
                                        </div>
                                    `
                                    : ""
                            }

                            ${
                                item.status === "pending"
                                    ? `
                                        <button
                                            type="button"
                                            class="mini-danger-button"
                                            data-cancel-leave="${escapeHtml(item.leaveId)}"
                                        >
                                            撤回申请
                                        </button>
                                    `
                                    : ""
                            }

                        </div>
                    `;
                }
            )
            .join("");

        box.querySelectorAll(
            "[data-cancel-leave]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {
                        cancelLeaveRequest(
                            button.dataset.cancelLeave
                        );
                    }
                );
            }
        );
    }


    function cancelLeaveRequest(leaveId) {

        if (
            !confirm(
                "确认撤回这条请假申请吗？"
            )
        ) {
            return;
        }

        const records =
            getLeaveRequests();

        const index =
            records.findIndex(
                item =>
                    item.leaveId === leaveId &&
                    samePerson(
                        item.applicantId ||
                        item.personId,
                        item.applicantName ||
                        item.personName
                    )
            );

        if (index < 0) {
            return;
        }

        if (
            records[index].status !==
            "pending"
        ) {
            alert("只有待审批申请可以撤回。");
            return;
        }

        records[index].status =
            "cancelled";

        records[index].withdrawnAt =
            new Date().toISOString();

        saveLeaveRequests(records);

        refreshAll();
    }


    function getLeaveStatus(item) {

        if (item.status === "approved") {
            return {
                text: "已批准",
                className:
                    "record-status green-text"
            };
        }

        if (item.status === "rejected") {
            return {
                text: "已驳回",
                className:
                    "record-status red-text"
            };
        }

        if (
            item.status === "cancelled" ||
            item.status === "withdrawn"
        ) {
            return {
                text: "已撤回",
                className:
                    "record-status gray-text"
            };
        }

        return {
            text: "待调度审批",
            className:
                "record-status orange-text"
        };
    }


    /*
    ===============================================
    罚单
    ===============================================
    */

    function getPenalties() {

        const data =
            readJson(
                STORAGE.PENALTIES,
                []
            );

        return Array.isArray(data)
            ? data
            : [];
    }


    function savePenalties(records) {

        localStorage.setItem(
            STORAGE.PENALTIES,
            JSON.stringify(records)
        );
    }


    function getMyPenalties() {

        return getPenalties()
            .filter(
                item =>
                    samePerson(
                        item.personId,
                        item.personName
                    )
            );
    }


    function refreshPenaltyRecords() {

        const records =
            getMyPenalties()
                .sort(
                    (a, b) =>
                        new Date(b.issuedAt) -
                        new Date(a.issuedAt)
                );

        const box =
            $("penaltyRecordList");

        if (!records.length) {

            box.innerHTML =
                '<div class="empty-box">暂无罚单</div>';

            return;
        }

        box.innerHTML =
            records.map(
                item => {

                    const pending =
                        item.status ===
                        "pending_acknowledgement";

                    return `
                        <div class="record-card penalty-card">

                            <div class="record-top">

                                <strong>
                                    ⚠️
                                    ${escapeHtml(item.violationType || "违规处理")}
                                </strong>

                                <span class="${
                                    pending
                                        ? "record-status orange-text"
                                        : "record-status green-text"
                                }">
                                    ${
                                        pending
                                            ? "待确认"
                                            : item.status === "processed"
                                                ? "已处理"
                                                : "已知晓"
                                    }
                                </span>

                            </div>

                            <div class="record-grid">

                                <div>
                                    <span>车辆</span>
                                    <strong>
                                        ${escapeHtml(item.vehicleNumber || "-")}
                                    </strong>
                                </div>

                                <div>
                                    <span>处罚金额</span>
                                    <strong>
                                        ¥ ${Number(item.amount || 0)}
                                    </strong>
                                </div>

                                <div>
                                    <span>扣分</span>
                                    <strong>
                                        ${Number(item.points || 0)}
                                    </strong>
                                </div>

                                <div>
                                    <span>时间</span>
                                    <strong>
                                        ${formatDateTime(item.issuedAt)}
                                    </strong>
                                </div>

                            </div>

                            <div class="record-note">
                                ${escapeHtml(item.description || "-")}
                            </div>

                            ${
                                pending
                                    ? `
                                        <button
                                            type="button"
                                            class="ack-button"
                                            data-ack-penalty="${escapeHtml(item.penaltyId)}"
                                        >
                                            我已知晓
                                        </button>
                                    `
                                    : ""
                            }

                        </div>
                    `;
                }
            )
            .join("");

        box.querySelectorAll(
            "[data-ack-penalty]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        acknowledgePenalty(
                            button.dataset.ackPenalty
                        );
                    }
                );
            }
        );
    }


    function acknowledgePenalty(
        penaltyId
    ) {

        if (
            !confirm(
                "确认已经阅读并知晓本罚单吗？"
            )
        ) {
            return;
        }

        const records =
            getPenalties();

        const index =
            records.findIndex(
                item =>
                    item.penaltyId === penaltyId &&
                    samePerson(
                        item.personId,
                        item.personName
                    )
            );

        if (index < 0) {
            return;
        }

        records[index].status =
            "acknowledged";

        records[index].acknowledgedAt =
            new Date().toISOString();

        savePenalties(records);

        refreshAll();
    }


    /*
    ===============================================
    待办数量
    ===============================================
    */

    function refreshTodoCounts() {

        const myLeaves =
            getMyLeaveRequests();

        const leaveCount =
            myLeaves.filter(
                item =>
                    item.status === "pending"
            ).length;

        const penaltyCount =
            getMyPenalties()
                .filter(
                    item =>
                        item.status ===
                        "pending_acknowledgement"
                )
                .length;

        const changeCount =
            getMyVehicleChangeRequests()
                .filter(
                    item =>
                        item.status === "pending"
                )
                .length;

        const gpsReviewCount =
            getMyTrips()
                .filter(
                    item => {

                        return (
                            item.gpsStatus !== "正常" &&
                            item.gpsStatus !== "normal" &&
                            (
                                !item.dispatchConfirmation ||
                                item.dispatchConfirmation ===
                                "pending"
                            )
                        );
                    }
                )
                .length;

        setText(
            "leaveTodoCount",
            leaveCount
        );

        setText(
            "penaltyTodoCount",
            penaltyCount
        );

        setText(
            "changeTodoCount",
            changeCount
        );

        setText(
            "gpsReviewTodoCount",
            gpsReviewCount
        );
    }


    /*
    ===============================================
    司机总状态
    ===============================================
    */

    function refreshDriverStatus() {

        const badge =
            $("driverStatusBadge");

        if (isOnApprovedLeaveNow()) {

            badge.textContent =
                "请假";

            badge.className =
                "status-badge status-leave";

            return;
        }

        if (hasPendingVehicleChange()) {

            badge.textContent =
                "换车审批中";

            badge.className =
                "status-badge status-warning";

            return;
        }

        if (
            currentTask &&
            currentTask.status === "working"
        ) {

            badge.textContent =
                "作业中";

            badge.className =
                "status-badge status-working";

            return;
        }

        if (currentTask) {

            badge.textContent =
                "有任务";

            badge.className =
                "status-badge status-ready";

            return;
        }

        badge.textContent =
            "待命";

        badge.className =
            "status-badge";
    }


    /*
    ===============================================
    通用
    ===============================================
    */

    function samePerson(
        id,
        name
    ) {

        if (
            id &&
            (
                profile.driverId ||
                profile.personId
            )
        ) {
            return String(id) ===
                String(
                    profile.driverId ||
                    profile.personId
                );
        }

        return (
            String(name || "").trim() !== "" &&
            String(name || "").trim() ===
            String(profile.name || "").trim()
        );
    }


    function getVehicleNumber(task) {

        return (
            task?.vehicleNumber ||
            task?.vehicleId ||
            ""
        );
    }


    function readJson(
        key,
        fallback
    ) {

        try {

            const raw =
                localStorage.getItem(key);

            return raw
                ? JSON.parse(raw)
                : fallback;

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

        const element = $(id);

        if (element) {
            element.textContent = value;
        }
    }


    function showModal(id) {

        $(id)
            ?.classList
            .remove("hidden");

        document.body
            .classList
            .add("modal-open");
    }


    function hideModal(id) {

        $(id)
            ?.classList
            .add("hidden");

        document.body
            .classList
            .remove("modal-open");
    }


    function scrollToSection(id) {

        $(id)
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
    }


    function getDateKey(date) {

        if (
            !date ||
            Number.isNaN(date.getTime())
        ) {
            return "";
        }

        return (
            date.getFullYear() +
            "-" +
            String(
                date.getMonth() + 1
            ).padStart(2, "0") +
            "-" +
            String(
                date.getDate()
            ).padStart(2, "0")
        );
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


    function escapeHtml(value) {

        const div =
            document.createElement("div");

        div.textContent =
            String(value ?? "");

        return div.innerHTML;
    }

});
