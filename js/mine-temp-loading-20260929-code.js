/*
====================================================
汽车司机端 · 临时装车插件 V2.13.6
原则：
1. 不修改原 driver-work.js 的 GPS、运输闭环、趟数、绩效等核心逻辑。
2. 临时装车本质是“临时中央绑定”：
   - 车辆临时退出原挖机关系
   - 临时进入目标任务 / 目标挖机
   - 原 driver-work.js 自然按新 taskId / excavatorNumber 记录趟次
3. 结束临时装车后恢复原绑定。
4. 目标挖机必须属于一个未结束生产任务，否则无法把趟数归入任务。
====================================================
*/

(function () {
    "use strict";

    const STORAGE = {
        PROFILE: "driverProfile",
        PERSONNEL: "personnelRecords",
        CURRENT_TASK: "driverCurrentTask",
        TASKS: "dispatchPublishedTasks",
        SHIFT_EXECUTIONS: "dispatchShiftExecutions",
        TEMP: "driverTemporaryLoadingAssignment",
        OPERATIONAL_STATUS: "equipmentOperationalStatus",
        MAINTENANCE_REQUESTS: "maintenanceRequests"
    };

    const $ = id => document.getElementById(id);

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function readArray(key) {
        const value = readJson(key, []);
        return Array.isArray(value) ? value : [];
    }

    function writeArray(key, value) {
        localStorage.setItem(
            key,
            JSON.stringify(value)
        );
    }

    function clone(value) {
        return JSON.parse(
            JSON.stringify(value ?? null)
        );
    }

    function getDriverProfile() {
        return readJson(
            STORAGE.PROFILE,
            null
        );
    }

    function getDriverId(profile) {
        return String(
            profile?.driverId ||
            profile?.personId ||
            profile?.employeeId ||
            ""
        );
    }

    function sameDriver(row, profile) {
        const rowId =
            String(
                row?.driverId ||
                row?.personId ||
                row?.employeeId ||
                ""
            );

        const profileId =
            getDriverId(profile);

        if (
            rowId &&
            profileId
        ) {
            return rowId ===
                profileId;
        }

        return Boolean(
            String(
                row?.driverName ||
                row?.personName ||
                ""
            ).trim() &&
            String(
                row?.driverName ||
                row?.personName ||
                ""
            ).trim() ===
                String(
                    profile?.name ||
                    ""
                ).trim()
        );
    }

    function taskId(task) {
        return String(
            task?.taskId ||
            task?.dispatchTaskId ||
            task?.id ||
            ""
        );
    }

    function excavatorId(binding) {
        return String(
            binding?.excavatorNumber ||
            binding?.excavatorId ||
            binding?.excavator ||
            ""
        );
    }

    function truckId(value) {
        if (
            value &&
            typeof value ===
                "object"
        ) {
            return String(
                value.vehicleNumber ||
                value.vehicleId ||
                value.truckNumber ||
                value.truckId ||
                ""
            );
        }

        return String(
            value ||
            ""
        );
    }

    function currentVehicle(task) {
        return String(
            task?.vehicleNumber ||
            task?.vehicleId ||
            ""
        );
    }

    function taskActive(task) {
        return ![
            "completed",
            "cancelled",
            "withdrawn",
            "handed_over"
        ].includes(
            String(
                task?.status ||
                ""
            )
        );
    }

    function getOperationalStatus(id) {
        const direct =
            readArray(
                STORAGE.OPERATIONAL_STATUS
            )
            .find(
                row =>
                    String(
                        row.equipmentId ||
                        ""
                    ) ===
                        String(id)
            );

        if (
            direct?.status
        ) {
            return String(
                direct.status
            );
        }

        const activeRepair =
            readArray(
                STORAGE.MAINTENANCE_REQUESTS
            )
            .some(
                row => {

                    const equipment =
                        String(
                            row.equipmentId ||
                            row.equipmentNumber ||
                            row.vehicleId ||
                            row.vehicleNumber ||
                            ""
                        );

                    const activeStatuses =
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

                    return (
                        equipment ===
                            String(id)
                        &&
                        activeStatuses.has(
                            String(
                                row.status ||
                                ""
                            )
                        )
                    );
                }
            );

        return activeRepair
            ? "maintenance"
            : "available";
    }

    function excavatorSelectable(id) {
        return ![
            "maintenance",
            "service",
            "disabled"
        ].includes(
            getOperationalStatus(
                id
            )
        );
    }

    function getTargetCandidates() {
        const currentTask =
            readJson(
                STORAGE.CURRENT_TASK,
                null
            );

        const currentExcavator =
            String(
                currentTask?.excavatorNumber ||
                currentTask?.excavatorId ||
                ""
            );

        const tasks =
            readArray(
                STORAGE.TASKS
            )
            .filter(
                taskActive
            );

        const candidates =
            [];

        tasks.forEach(
            task => {

                const id =
                    taskId(
                        task
                    );

                if (
                    !id
                ) {
                    return;
                }

                (
                    task.bindings ||
                    []
                )
                .forEach(
                    binding => {

                        const excavator =
                            excavatorId(
                                binding
                            );

                        if (
                            !excavator ||
                            excavator ===
                                currentExcavator ||
                            !excavatorSelectable(
                                excavator
                            )
                        ) {
                            return;
                        }

                        const trucks =
                            [
                                ...(binding.truckIds || []),
                                ...(binding.vehicleIds || []),
                                ...(binding.trucks || [])
                            ]
                            .map(
                                truckId
                            )
                            .filter(
                                Boolean
                            );

                        candidates.push({
                            taskId:
                                id,

                            taskName:
                                task.taskName ||
                                task.area ||
                                task.workArea ||
                                id,

                            task:
                                task,

                            excavator:
                                excavator,

                            currentTruckCount:
                                new Set(
                                    trucks
                                ).size
                        });
                    }
                );
            }
        );

        const map =
            new Map();

        candidates.forEach(
            item => {

                const key =
                    item.taskId +
                    "::" +
                    item.excavator;

                if (
                    !map.has(
                        key
                    )
                ) {
                    map.set(
                        key,
                        item
                    );
                }
            }
        );

        return [
            ...map.values()
        ];
    }

    function findDriverAssignment(
        task,
        profile,
        vehicle
    ) {
        return (
            (
                task?.driverAssignments ||
                []
            )
            .find(
                row =>
                    sameDriver(
                        row,
                        profile
                    )
                    ||
                    String(
                        row.vehicleNumber ||
                        row.vehicleId ||
                        row.truckNumber ||
                        row.truckId ||
                        ""
                    ) ===
                        String(
                            vehicle
                        )
            )
            ||
            null
        );
    }

    function removeTruckFromTask(
        task,
        profile,
        vehicle
    ) {
        if (
            !task
        ) {
            return;
        }

        task.driverAssignments =
            (
                task.driverAssignments ||
                []
            )
            .filter(
                row => {

                    const rowVehicle =
                        String(
                            row.vehicleNumber ||
                            row.vehicleId ||
                            row.truckNumber ||
                            row.truckId ||
                            ""
                        );

                    return !(
                        sameDriver(
                            row,
                            profile
                        )
                        ||
                        rowVehicle ===
                            String(
                                vehicle
                            )
                    );
                }
            );

        (
            task.bindings ||
            []
        )
        .forEach(
            binding => {

                [
                    "truckIds",
                    "vehicleIds",
                    "trucks"
                ]
                .forEach(
                    key => {

                        if (
                            !Array.isArray(
                                binding[key]
                            )
                        ) {
                            return;
                        }

                        binding[key] =
                            binding[key]
                                .filter(
                                    item =>
                                        truckId(
                                            item
                                        ) !==
                                            String(
                                                vehicle
                                            )
                                );
                    }
                );
            }
        );

        task.updatedAt =
            new Date()
                .toISOString();
    }

    function ensureTruckOnBinding(
        task,
        excavator,
        vehicle
    ) {
        let binding =
            (
                task.bindings ||
                []
            )
            .find(
                row =>
                    excavatorId(
                        row
                    ) ===
                        String(
                            excavator
                        )
            );

        if (
            !binding
        ) {
            return false;
        }

        if (
            !Array.isArray(
                binding.truckIds
            )
        ) {
            binding.truckIds =
                [];
        }

        if (
            !binding.truckIds
                .map(
                    truckId
                )
                .includes(
                    String(
                        vehicle
                    )
                )
        ) {
            binding.truckIds.push(
                String(
                    vehicle
                )
            );
        }

        return true;
    }

    function buildTemporaryAssignment(
        targetTask,
        targetExcavator,
        originalAssignment,
        profile,
        vehicle
    ) {
        return {
            ...clone(
                originalAssignment ||
                {}
            ),

            driverId:
                getDriverId(
                    profile
                ),

            personId:
                getDriverId(
                    profile
                ),

            driverName:
                profile?.name ||
                originalAssignment?.driverName ||
                "",

            personName:
                profile?.name ||
                originalAssignment?.personName ||
                "",

            vehicleNumber:
                vehicle,

            vehicleId:
                vehicle,

            truckNumber:
                vehicle,

            truckId:
                vehicle,

            excavatorNumber:
                targetExcavator,

            excavatorId:
                targetExcavator,

            taskId:
                taskId(
                    targetTask
                ),

            dispatchTaskId:
                taskId(
                    targetTask
                ),

            shiftId:
                targetTask.currentShiftId ||
                targetTask.shiftId ||
                "",

            shift:
                targetTask.shift ||
                "",

            shiftDate:
                targetTask.shiftDate ||
                targetTask.date ||
                "",

            loadingPoint:
                targetTask.loadingPoint ||
                targetTask.taskLoadingPoint ||
                "",

            unloadingPoint:
                targetTask.unloadingPoint ||
                targetTask.taskUnloadingPoint ||
                "",

            temporaryLoading:
                true,

            temporaryLoadingStartedAt:
                new Date()
                    .toISOString()
        };
    }

    function buildDriverCurrentTask(
        targetTask,
        targetExcavator,
        originalTask,
        vehicle
    ) {
        return {
            ...clone(
                originalTask ||
                {}
            ),

            taskId:
                taskId(
                    targetTask
                ),

            dispatchTaskId:
                taskId(
                    targetTask
                ),

            shiftId:
                targetTask.currentShiftId ||
                targetTask.shiftId ||
                "",

            shift:
                targetTask.shift ||
                originalTask?.shift ||
                "",

            shiftDate:
                targetTask.shiftDate ||
                targetTask.date ||
                originalTask?.shiftDate ||
                "",

            workArea:
                targetTask.area ||
                targetTask.workArea ||
                "",

            area:
                targetTask.area ||
                targetTask.workArea ||
                "",

            remark:
                targetTask.remark ||
                "",

            vehicleNumber:
                vehicle,

            vehicleId:
                vehicle,

            excavatorNumber:
                targetExcavator,

            excavatorId:
                targetExcavator,

            loadingZoneId:
                targetTask.loadingZoneId ||
                targetTask.taskLoadingZoneId ||
                "",

            loadingZoneName:
                targetTask.loadingZoneName ||
                targetTask.loadingPoint ||
                targetTask.taskLoadingPoint ||
                "",

            loadingPoint:
                targetTask.loadingPoint ||
                targetTask.taskLoadingPoint ||
                "",

            unloadingZoneIds:
                clone(
                    targetTask.unloadingZoneIds ||
                    []
                ),

            unloadingZoneNames:
                clone(
                    targetTask.unloadingZoneNames ||
                    targetTask.unloadingPoint ||
                    targetTask.taskUnloadingPoint ||
                    ""
                ),

            unloadingPoint:
                targetTask.unloadingPoint ||
                targetTask.taskUnloadingPoint ||
                "",

            vehicleClaimed:
                true,

            status:
                originalTask?.status ||
                "working",

            temporaryLoading:
                true,

            temporaryOriginalTaskId:
                originalTask?.taskId ||
                originalTask?.dispatchTaskId ||
                "",

            temporaryOriginalExcavator:
                originalTask?.excavatorNumber ||
                originalTask?.excavatorId ||
                "",

            temporaryLoadingStartedAt:
                new Date()
                    .toISOString()
        };
    }

    function appendTemporaryHistory(
        task,
        summary
    ) {
        task.equipmentAdjustments =
            Array.isArray(
                task.equipmentAdjustments
            )
                ? task.equipmentAdjustments
                : [];

        task.equipmentAdjustments.push({
            adjustmentId:
                "TEMP_LOAD_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2,7),

            time:
                new Date()
                    .toISOString(),

            summary,

            reason:
                "汽车临时装车"
        });
    }

    function syncTaskCollections(
        action
    ) {
        const keys = [
            STORAGE.TASKS,
            STORAGE.SHIFT_EXECUTIONS
        ];

        keys.forEach(
            key => {

                const rows =
                    readArray(
                        key
                    );

                let changed =
                    false;

                rows.forEach(
                    row => {

                        if (
                            action(
                                row
                            )
                        ) {
                            changed =
                                true;
                        }
                    }
                );

                if (
                    changed
                ) {
                    writeArray(
                        key,
                        rows
                    );
                }
            }
        );
    }

    function startTemporaryLoading() {
        const profile =
            getDriverProfile();

        const originalTask =
            readJson(
                STORAGE.CURRENT_TASK,
                null
            );

        if (
            !profile ||
            !originalTask
        ) {
            alert(
                "当前没有有效司机任务，不能开始临时装车。"
            );
            return;
        }

        if (
            readJson(
                STORAGE.TEMP,
                null
            )
        ) {
            alert(
                "当前已经处于临时装车状态，请先结束当前临时装车。"
            );
            return;
        }

        const select =
            $("temporaryLoadingTarget");

        const value =
            String(
                select?.value ||
                ""
            );

        if (
            !value
        ) {
            alert(
                "请选择临时装车的目标挖机。"
            );
            return;
        }

        const [
            targetTaskId,
            targetExcavator
        ] =
            value.split(
                "::"
            );

        const tasks =
            readArray(
                STORAGE.TASKS
            );

        const targetTask =
            tasks.find(
                task =>
                    taskId(
                        task
                    ) ===
                        targetTaskId
            );

        if (
            !targetTask ||
            !taskActive(
                targetTask
            )
        ) {
            alert(
                "目标任务已经不存在或已结束，请重新选择。"
            );
            refreshCandidateOptions();
            return;
        }

        if (
            !excavatorSelectable(
                targetExcavator
            )
        ) {
            alert(
                "目标挖机当前处于维修 / 保养 / 停用状态，不能临时装车。"
            );
            refreshCandidateOptions();
            return;
        }

        const vehicle =
            currentVehicle(
                originalTask
            );

        if (
            !vehicle
        ) {
            alert(
                "当前没有有效车辆。"
            );
            return;
        }

        const originalTaskId =
            taskId(
                originalTask
            );

        const originalMaster =
            tasks.find(
                task =>
                    taskId(
                        task
                    ) ===
                        originalTaskId
            );

        const originalAssignment =
            findDriverAssignment(
                originalMaster,
                profile,
                vehicle
            );

        const snapshot = {
            temporaryId:
                "TEMP_LOAD_" +
                Date.now(),

            startedAt:
                new Date()
                    .toISOString(),

            driverId:
                getDriverId(
                    profile
                ),

            driverName:
                profile.name ||
                "",

            vehicle:
                vehicle,

            originalTaskId:
                originalTaskId,

            originalExcavator:
                originalTask.excavatorNumber ||
                originalTask.excavatorId ||
                "",

            originalCurrentTask:
                clone(
                    originalTask
                ),

            originalAssignment:
                clone(
                    originalAssignment
                ),

            targetTaskId:
                targetTaskId,

            targetExcavator:
                targetExcavator
        };

        syncTaskCollections(
            row => {

                const id =
                    taskId(
                        row
                    );

                let changed =
                    false;

                if (
                    id ===
                        originalTaskId
                ) {
                    removeTruckFromTask(
                        row,
                        profile,
                        vehicle
                    );

                    appendTemporaryHistory(
                        row,
                        `汽车 ${vehicle} 临时离开 ${
                            snapshot.originalExcavator ||
                            "-"
                        }，转往 ${targetExcavator} 装车`
                    );

                    changed =
                        true;
                }

                if (
                    id ===
                        targetTaskId
                ) {
                    if (
                        ensureTruckOnBinding(
                            row,
                            targetExcavator,
                            vehicle
                        )
                    ) {
                        row.driverAssignments =
                            (
                                row.driverAssignments ||
                                []
                            )
                            .filter(
                                assignment =>
                                    !sameDriver(
                                        assignment,
                                        profile
                                    )
                                    &&
                                    String(
                                        assignment.vehicleNumber ||
                                        assignment.vehicleId ||
                                        assignment.truckNumber ||
                                        assignment.truckId ||
                                        ""
                                    ) !==
                                        vehicle
                            );

                        row.driverAssignments.push(
                            buildTemporaryAssignment(
                                row,
                                targetExcavator,
                                originalAssignment,
                                profile,
                                vehicle
                            )
                        );

                        appendTemporaryHistory(
                            row,
                            `汽车 ${vehicle} 临时加入 ${targetExcavator} 装车`
                        );

                        changed =
                            true;
                    }
                }

                return changed;
            }
        );

        localStorage.setItem(
            STORAGE.CURRENT_TASK,
            JSON.stringify(
                buildDriverCurrentTask(
                    targetTask,
                    targetExcavator,
                    originalTask,
                    vehicle
                )
            )
        );

        localStorage.setItem(
            STORAGE.TEMP,
            JSON.stringify(
                snapshot
            )
        );

        /*
         * 切换任务后必须重新开始GPS运输闭环，
         * 防止把原挖机未完成的闭环带入目标任务。
         */
        localStorage.removeItem(
            "driverTransportCycleState"
        );

        closeModal();

        renderTemporaryState();

        alert(
            "临时装车已启用。\n\n" +
            `车辆：${vehicle}\n` +
            `目标挖机：${targetExcavator}\n` +
            `目标任务：${targetTaskId}\n\n` +
            "从现在开始完成的运输趟数，将归入目标挖机和目标任务。\n" +
            "结束临时装车后，系统再恢复原绑定。"
        );
    }

    function restoreOriginalAssignment(
        row,
        temp,
        profile
    ) {
        const id =
            taskId(
                row
            );

        let changed =
            false;

        if (
            id ===
                temp.targetTaskId
        ) {
            removeTruckFromTask(
                row,
                profile,
                temp.vehicle
            );

            appendTemporaryHistory(
                row,
                `汽车 ${temp.vehicle} 结束临时装车，退出 ${temp.targetExcavator}`
            );

            changed =
                true;
        }

        if (
            id ===
                temp.originalTaskId
            &&
            taskActive(
                row
            )
        ) {
            const targetBinding =
                (
                    row.bindings ||
                    []
                )
                .find(
                    binding =>
                        excavatorId(
                            binding
                        ) ===
                            String(
                                temp.originalExcavator ||
                                ""
                            )
                );

            if (
                targetBinding
            ) {
                if (
                    !Array.isArray(
                        targetBinding.truckIds
                    )
                ) {
                    targetBinding.truckIds =
                        [];
                }

                if (
                    !targetBinding.truckIds
                        .map(
                            truckId
                        )
                        .includes(
                            temp.vehicle
                        )
                ) {
                    targetBinding.truckIds.push(
                        temp.vehicle
                    );
                }
            }

            row.driverAssignments =
                (
                    row.driverAssignments ||
                    []
                )
                .filter(
                    assignment =>
                        !sameDriver(
                            assignment,
                            profile
                        )
                        &&
                        String(
                            assignment.vehicleNumber ||
                            assignment.vehicleId ||
                            assignment.truckNumber ||
                            assignment.truckId ||
                            ""
                        ) !==
                            temp.vehicle
                );

            if (
                temp.originalAssignment
            ) {
                row.driverAssignments.push(
                    clone(
                        temp.originalAssignment
                    )
                );
            }

            appendTemporaryHistory(
                row,
                `汽车 ${temp.vehicle} 临时装车结束，恢复原挖机 ${
                    temp.originalExcavator ||
                    "-"
                }`
            );

            changed =
                true;
        }

        return changed;
    }

    function endTemporaryLoading() {
        const temp =
            readJson(
                STORAGE.TEMP,
                null
            );

        if (
            !temp
        ) {
            alert(
                "当前没有临时装车任务。"
            );
            return;
        }

        if (
            !confirm(
                "确认结束临时装车并恢复原任务绑定？"
            )
        ) {
            return;
        }

        const profile =
            getDriverProfile();

        syncTaskCollections(
            row =>
                restoreOriginalAssignment(
                    row,
                    temp,
                    profile
                )
        );

        const currentPublishedTasks =
            readArray(
                STORAGE.TASKS
            );

        const originalStillActive =
            currentPublishedTasks
                .some(
                    row =>
                        taskId(
                            row
                        ) ===
                            temp.originalTaskId
                        &&
                        taskActive(
                            row
                        )
                );

        if (
            originalStillActive &&
            temp.originalCurrentTask
        ) {
            localStorage.setItem(
                STORAGE.CURRENT_TASK,
                JSON.stringify(
                    temp.originalCurrentTask
                )
            );
        } else {
            localStorage.removeItem(
                STORAGE.CURRENT_TASK
            );
        }

        localStorage.removeItem(
            STORAGE.TEMP
        );

        localStorage.removeItem(
            "driverTransportCycleState"
        );

        renderTemporaryState();

        alert(
            originalStillActive
                ? "临时装车已结束，已恢复原任务绑定。"
                : "临时装车已结束，但原任务已经结束或不存在，请等待调度重新分配。"
        );
    }

    function refreshCandidateOptions() {
        const select =
            $("temporaryLoadingTarget");

        if (
            !select
        ) {
            return;
        }

        const candidates =
            getTargetCandidates();

        select.innerHTML =
            '<option value="">请选择目标挖机</option>';

        candidates.forEach(
            item => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    item.taskId +
                    "::" +
                    item.excavator;

                option.textContent =
                    `${item.excavator} · ${item.taskName} · 当前${item.currentTruckCount}台车`;

                select.appendChild(
                    option
                );
            }
        );

        const empty =
            $("temporaryLoadingEmpty");

        if (
            empty
        ) {
            empty.style.display =
                candidates.length
                    ? "none"
                    : "block";
        }
    }

    function renderTemporaryState() {
        const temp =
            readJson(
                STORAGE.TEMP,
                null
            );

        const box =
            $("temporaryLoadingState");

        const startButton =
            $("openTemporaryLoadingButton");

        const endButton =
            $("endTemporaryLoadingButton");

        if (
            box
        ) {
            if (
                temp
            ) {
                box.classList.remove(
                    "hidden"
                );

                box.innerHTML =
                    `<strong>🚜 临时装车中</strong>` +
                    `<span>车辆 ${escapeHtml(temp.vehicle)} → ` +
                    `${escapeHtml(temp.targetExcavator)} · ` +
                    `${escapeHtml(temp.targetTaskId)}</span>`;
            } else {
                box.classList.add(
                    "hidden"
                );

                box.innerHTML =
                    "";
            }
        }

        if (
            startButton
        ) {
            startButton.disabled =
                Boolean(
                    temp
                );

            startButton.textContent =
                temp
                    ? "🚜 临时装车进行中"
                    : "🚜 临时装车";
        }

        if (
            endButton
        ) {
            endButton.classList.toggle(
                "hidden",
                !temp
            );
        }
    }

    function escapeHtml(value) {
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

    function openModal() {
        refreshCandidateOptions();

        $("temporaryLoadingModal")
            ?.classList
            .remove(
                "hidden"
            );
    }

    function closeModal() {
        $("temporaryLoadingModal")
            ?.classList
            .add(
                "hidden"
            );
    }

    function installUi() {
        if (
            $("openTemporaryLoadingButton")
        ) {
            renderTemporaryState();
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.textContent = `
            .temporary-loading-actions {
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:10px;
                margin-top:12px;
            }

            .temporary-loading-button {
                width:100%;
                min-height:44px;
                border:0;
                border-radius:10px;
                background:#7c3aed;
                color:#fff;
                font-weight:900;
                cursor:pointer;
            }

            .temporary-loading-end {
                background:#475569;
            }

            .temporary-loading-state {
                margin-top:12px;
                padding:11px 12px;
                border:1px solid #c4b5fd;
                border-radius:10px;
                background:#f5f3ff;
                color:#5b21b6;
            }

            .temporary-loading-state strong,
            .temporary-loading-state span {
                display:block;
            }

            .temporary-loading-state span {
                margin-top:4px;
                font-size:12px;
            }

            .temporary-loading-modal-card {
                max-width:560px;
            }

            .temporary-loading-tip {
                margin:10px 0 14px;
                padding:10px 12px;
                border-radius:9px;
                background:#eff6ff;
                color:#1e40af;
                line-height:1.6;
                font-size:12px;
            }

            #temporaryLoadingTarget {
                width:100%;
                min-height:42px;
            }

            #temporaryLoadingEmpty {
                display:none;
                margin-top:10px;
                color:#b45309;
                font-size:12px;
            }

            @media(max-width:700px) {
                .temporary-loading-actions {
                    grid-template-columns:1fr;
                }
            }
        `;

        document.head.appendChild(
            style
        );

        const addTrip =
            $("addTripButton");

        const anchor =
            addTrip?.parentElement;

        if (
            anchor
        ) {
            const wrap =
                document.createElement(
                    "div"
                );

            wrap.className =
                "temporary-loading-actions";

            wrap.innerHTML = `
                <button
                    id="openTemporaryLoadingButton"
                    type="button"
                    class="temporary-loading-button"
                >
                    🚜 临时装车
                </button>

                <button
                    id="endTemporaryLoadingButton"
                    type="button"
                    class="temporary-loading-button temporary-loading-end hidden"
                >
                    ↩ 结束临时装车
                </button>
            `;

            const state =
                document.createElement(
                    "div"
                );

            state.id =
                "temporaryLoadingState";

            state.className =
                "temporary-loading-state hidden";

            addTrip.insertAdjacentElement(
                "afterend",
                wrap
            );

            wrap.insertAdjacentElement(
                "afterend",
                state
            );
        }

        const modal =
            document.createElement(
                "div"
            );

        modal.id =
            "temporaryLoadingModal";

        modal.className =
            "modal hidden";

        modal.innerHTML = `
            <div class="modal-card temporary-loading-modal-card">

                <h2>🚜 临时装车</h2>

                <div class="temporary-loading-tip">
                    临时装车不会永久改变你的原任务。
                    启用后，本车后续完成的趟数将归入所选挖机，
                    同时归入该挖机所属生产任务。
                    结束临时装车后恢复原绑定。
                </div>

                <label for="temporaryLoadingTarget">
                    目标挖机 / 目标任务 *
                </label>

                <select id="temporaryLoadingTarget">
                    <option value="">请选择目标挖机</option>
                </select>

                <div id="temporaryLoadingEmpty">
                    当前没有可用于临时装车的其他挖机。
                    目标挖机必须属于一个进行中的生产任务，
                    且不能处于维修、保养或停用状态。
                </div>

                <div class="modal-buttons" style="margin-top:16px;">
                    <button
                        id="startTemporaryLoadingButton"
                        type="button"
                        class="success-button"
                    >
                        开始临时装车
                    </button>

                    <button
                        id="closeTemporaryLoadingButton"
                        type="button"
                        class="secondary-button"
                    >
                        取消
                    </button>
                </div>

            </div>
        `;

        document.body.appendChild(
            modal
        );

        $("openTemporaryLoadingButton")
            ?.addEventListener(
                "click",
                openModal
            );

        $("endTemporaryLoadingButton")
            ?.addEventListener(
                "click",
                endTemporaryLoading
            );

        $("startTemporaryLoadingButton")
            ?.addEventListener(
                "click",
                startTemporaryLoading
            );

        $("closeTemporaryLoadingButton")
            ?.addEventListener(
                "click",
                closeModal
            );

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                        modal
                ) {
                    closeModal();
                }
            }
        );

        renderTemporaryState();
    }

    function safetyRefresh() {
        const temp =
            readJson(
                STORAGE.TEMP,
                null
            );

        if (
            temp &&
            !excavatorSelectable(
                temp.targetExcavator
            )
        ) {
            /*
             * 目标挖机在临时装车期间进入维修/保养/停用，
             * 不自动恢复（避免静默修改生产关系），
             * 只强提醒司机立即结束临时装车。
             */
            const state =
                $("temporaryLoadingState");

            if (
                state
            ) {
                state.innerHTML =
                    `<strong>⚠️ 临时装车目标不可用</strong>` +
                    `<span>${escapeHtml(temp.targetExcavator)} 已进入维修 / 保养 / 停用状态，请立即结束临时装车并等待调度。</span>`;
            }
        }

        renderTemporaryState();
    }

    if (
        document.readyState ===
            "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            installUi
        );
    } else {
        installUi();
    }

    setInterval(
        safetyRefresh,
        5000
    );

    window.addEventListener(
        "storage",
        function (event) {

            if (
                [
                    STORAGE.TASKS,
                    STORAGE.SHIFT_EXECUTIONS,
                    STORAGE.TEMP,
                    STORAGE.OPERATIONAL_STATUS,
                    STORAGE.MAINTENANCE_REQUESTS
                ]
                .includes(
                    event.key
                )
            ) {
                safetyRefresh();
            }
        }
    );

})();
