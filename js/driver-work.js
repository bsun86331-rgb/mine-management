/*
====================================================
矿山管理系统
司机端 V2.10.2V
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
         * V2.10.2V
         * 设备使用检查
         */
        EQUIPMENT_CHECKS:
            "equipmentUsageChecks"
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
            profile.position || "卡车司机"
        );

        setText(
            "driverTeam",
            profile.team || "-"
        );

        setText(
            "profileName",
            profile.name || "-"
        );

        setText(
            "profilePhone",
            profile.phone || "-"
        );

        setText(
            "profilePosition",
            profile.position || "卡车司机"
        );

        setText(
            "profileTeam",
            profile.team || "-"
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

        refreshLeaveRecords();

        refreshPenaltyRecords();

        refreshVehicleChangeRecords();

        refreshTodoCounts();

        refreshDriverStatus();
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
    V2.10.2V
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


        const claimButton =
            $("claimVehicleButton");


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
        }

        if (currentTask.status === "paused") {
            resume?.classList.remove("hidden");
        }
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
            currentTask.status !== "working"
        ) {
            alert("请先开始作业。");
            return;
        }

        if (
            !requireEquipmentCheck(
                "记录运输趟次"
            )
        ) {
            return;
        }

        if (!currentTask.vehicleClaimed) {
            alert("当前车辆尚未领取。");
            return;
        }

        if (hasPendingVehicleChange()) {
            alert("换车申请正在审批，暂时不能记录趟数。");
            return;
        }

        if (isOnApprovedLeaveNow()) {
            alert("当前处于已批准请假时间，不能记录生产趟数。");
            return;
        }

        const vehicle =
            getVehicleNumber(currentTask);

        if (!vehicle) {
            alert("当前没有有效车辆。");
            return;
        }

        $("addTripButton").disabled = true;
        $("addTripButton").textContent =
            "📍 正在获取GPS...";

        const gps =
            await getFreshPosition();

        let gpsStatus =
            "GPS异常";

        let dispatchConfirmation =
            "pending";

        let officialCountEligible =
            false;

        if (
            gps &&
            Number(gps.accuracy) <= 100
        ) {

            gpsStatus =
                "正常";

            dispatchConfirmation =
                "not_required";

            officialCountEligible =
                true;

        } else if (gps) {

            gpsStatus =
                "精度较低";
        }

        if (!gps) {

            const continueRecord =
                confirm(
                    "本次没有取得有效GPS位置。\n\n" +
                    "是否仍然提交本趟？\n" +
                    "提交后将进入调度GPS异常审核。"
                );

            if (!continueRecord) {

                resetTripButton();
                return;
            }
        }

        const record = {

            id:
                "TRIP_" + Date.now(),

            tripId:
                "TRIP_" + Date.now(),

            taskId:
                currentTask.taskId || "",

            dispatchTaskId:
                currentTask.dispatchTaskId ||
                currentTask.taskId ||
                "",

            /*
             * V2.10.2M
             * 每趟运输同时归属主任务 + 当前班次。
             */
            shiftId:
                currentTask.shiftId ||
                "",

            shiftDate:
                currentTask.shiftDate ||
                "",

            driverId:
                profile.driverId || profile.personId || "",

            driverName:
                profile.name || "",

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
                currentTask.shift || "",

            loadingPoint:
                currentTask.loadingPoint || "",

            unloadingPoint:
                currentTask.unloadingPoint || "",

            completedAt:
                new Date().toISOString(),

            tripCount: 1,

            latitude:
                gps?.latitude ?? null,

            longitude:
                gps?.longitude ?? null,

            gpsAccuracy:
                gps?.accuracy ?? null,

            gpsTime:
                gps?.timestamp ?? null,

            gpsStatus,

            dataSource:
                "司机端GPS",

            dispatchConfirmation,

            officialCountEligible,

            abnormalType:
                gpsStatus === "正常"
                    ? ""
                    : "GPS异常",

            vehicleAuthorized:
                true
        };

        const records =
            getTripRecords();

        records.push(record);

        saveTripRecords(records);

        if (gps) {
            latestGps = gps;

            localStorage.setItem(
                STORAGE.GPS,
                JSON.stringify(gps)
            );

            renderGps();
        }

        resetTripButton();

        refreshAll();

        if (gpsStatus === "正常") {

            alert("本趟已记录，GPS正常。");

        } else {

            alert(
                "本趟已保存。\n" +
                "GPS状态：" +
                gpsStatus +
                "\n等待调度审核。"
            );
        }
    }


    function resetTripButton() {

        $("addTripButton").disabled = false;

        $("addTripButton").textContent =
            "🚚 完成一趟";
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


    function getTodayTrips() {

        const today =
            getDateKey(new Date());

        return getMyTrips()
            .filter(
                record =>
                    getDateKey(
                        new Date(
                            record.completedAt
                        )
                    ) === today
            );
    }


    function refreshTrips() {

        const trips =
            getTodayTrips()
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

            driverName:
                profile.name || "",

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

            role:
                "driver",

            position:
                profile.position ||
                "卡车司机",

            team:
                profile.team || "",

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
