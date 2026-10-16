/* Existing dispatch approvals. Task authoring now lives only in production-board.js. */
document.addEventListener('DOMContentLoaded',function(){
'use strict';
const STORAGE = {

            TASKS:
                "dispatchPublishedTasks",

            LEGACY_TASK:
                "publishedDispatchTask",

            TRIPS:
                "driverTripRecords",

            PERSONNEL:
                "personnelRecords",

            EQUIPMENT:
                "equipmentRecords",

            DRIVER_PROFILE:
                "driverProfile",

            DRIVER_CURRENT_TASK:
                "driverCurrentTask",

            CHANGE_REQUESTS:
                "driverVehicleChangeRequests",

            LEAVES:
                "leaveRequests",

            PENALTIES:
                "penaltyRecords",

            DISPATCH_PROFILE:
                "dispatchUserProfile"
        };
const $ =
            id =>
                document.getElementById(id);
let equipment =
            emptyEquipmentCatalog();
let currentDraft =
            null;
let bindings =
            [];
let driverAssignments =
            [];
let excavatorDriverAssignments =
            [];
let auxiliaryAssignments =
            [];
let selectedExcavatorId =
            null;
let selectedTruckIds =
            [];
let openedTaskId =
            null;
function renderTodoCounts() {

            setText(
                "vehicleChangeTodoCount",
                getChangeRequests()
                    .filter(
                        item =>
                            item.status ===
                            "pending"
                    )
                    .length
            );


            setText(
                "gpsTodoCount",
                getTrips()
                    .filter(
                        item =>

                            item.gpsStatus !==
                                "正常"

                            &&

                            item.gpsStatus !==
                                "normal"

                            &&

                            item.dispatchConfirmation !==
                                "confirmed"

                            &&

                            item.dispatchConfirmation !==
                                "rejected"
                    )
                    .length
            );


            setText(
                "leaveTodoCount",
                getLeaves()
                    .filter(
                        item =>

                            item.status ===
                                "pending"

                            &&

                            item.approverRole ===
                                "dispatch"
                    )
                    .length
            );


            setText(
                "penaltyTodoCount",
                getPenalties()
                    .filter(
                        item =>
                            item.status ===
                            "pending_acknowledgement"
                    )
                    .length
            );
        }

function setText(
            id,
            value
        ) {

            const element =
                $(id);


            if (
                element
            ) {

                element.textContent =
                    value;
            }
        }

function getChangeRequests() {

            const data =
                readJson(
                    STORAGE.CHANGE_REQUESTS,
                    []
                );


            return Array.isArray(
                data
            )
                ? data
                : [];
        }

function readJson(
            key,
            fallback
        ) {

            try {

                const value =
                    localStorage.getItem(
                        key
                    );


                return value
                    ? JSON.parse(
                        value
                    )
                    : fallback;


            } catch (
                error
            ) {

                console.error(
                    "读取数据失败：",
                    key,
                    error
                );


                return fallback;
            }
        }

function getTrips() {

            const data =
                readJson(
                    STORAGE.TRIPS,
                    []
                );


            return Array.isArray(
                data
            )
                ? data
                : [];
        }

function getLeaves() {

            const data =
                readJson(
                    STORAGE.LEAVES,
                    []
                );


            return Array.isArray(
                data
            )
                ? data
                : [];
        }

function getPenalties() {

            const data =
                readJson(
                    STORAGE.PENALTIES,
                    []
                );


            return Array.isArray(
                data
            )
                ? data
                : [];
        }

function populatePenaltyPersonnel() {

            const select =
                $("penaltyPerson");


            if (
                !select
            ) {

                return;
            }


            const people =
                getApprovedDrivers();


            select.innerHTML =
                '<option value="">选择人员</option>';


            people.forEach(
                person => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        person.driverId;


                    option.dataset.name =
                        person.name ||
                        "";


                    option.dataset.team =
                        person.team ||
                        "";


                    option.textContent =
                        `${person.name || "-"} · ${person.team || "-"}`;


                    select.appendChild(
                        option
                    );
                }
            );
        }

function getApprovedDrivers() {

            return getPersonnelRecords()
                .filter(
                    person =>

                        normalizePosition(
                            person.position
                        ) ===
                            "汽车司机"

                        &&

                        isApprovedPerson(
                            person
                        )
                )
                .map(
                    person => ({

                        ...person,

                        personId:
                            getPersonId(
                                person
                            ),

                        driverId:
                            getPersonId(
                                person
                            ),

                        team:
                            person.team ||
                            person.department ||
                            ""
                    })
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

function normalizePosition(
            position
        ) {

            const map = {

                "卡车司机":
                    "汽车司机",

                "运输司机":
                    "汽车司机",

                "矿卡司机":
                    "汽车司机",

                "挖掘机司机":
                    "挖机司机",

                "挖机操作手":
                    "挖机司机",

                "挖掘机操作手":
                    "挖机司机",

                "调度员":
                    "车队长"
            };


            return (
                map[position] ||
                position ||
                ""
            );
        }

function isApprovedPerson(
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

                person.status ===
                    "disabled"

                ||

                person.status ===
                    "resigned"

                ||

                person.approvalStatus ===
                    "rejected"

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

function getPersonId(
            person
        ) {

            return String(

                person?.personId ||

                person?.driverId ||

                person?.employeeId ||

                person?.id ||

                ""

            );
        }

function openVehicleChanges() {

            renderVehicleChanges();


            showModal(
                "vehicleChangeModal"
            );
        }

function renderVehicleChanges() {

            const records =
                getChangeRequests()
                    .filter(
                        item =>
                            item.status ===
                            "pending"
                    );


            const box =
                $("vehicleChangeRequestList");


            if (
                !box
            ) {

                return;
            }


            if (
                !records.length
            ) {

                box.innerHTML =
                    '<div class="empty-placeholder">暂无待审批换车申请</div>';

                return;
            }


            box.innerHTML =
                records.map(
                    item => {

                        const trucks =
                            getAvailableReplacementTrucks(
                                item.taskId
                            );


                        return `

                        <div class="approval-card">

                            <div class="approval-title">

                                <strong>
                                    ${escapeHtml(item.driverName || "-")}
                                </strong>

                                <span>
                                    ${escapeHtml(item.oldVehicleNumber || "-")}
                                </span>

                            </div>


                            <div class="approval-note">
                                ${escapeHtml(item.reason || "-")}
                            </div>


                            <select
                                data-change-vehicle="${escapeHtml(item.requestId)}"
                            >

                                <option value="">
                                    选择新车辆
                                </option>

                                ${
                                    trucks
                                        .map(
                                            truck => `
                                            <option value="${escapeHtml(truck.id)}">
                                                ${escapeHtml(truck.id)}
                                            </option>
                                            `
                                        )
                                        .join(
                                            ""
                                        )
                                }

                            </select>


                            <div class="approval-buttons">

                                <button
                                    type="button"
                                    class="success-button"
                                    data-change-approve="${escapeHtml(item.requestId)}"
                                >
                                    批准
                                </button>

                                <button
                                    type="button"
                                    class="danger-button"
                                    data-change-reject="${escapeHtml(item.requestId)}"
                                >
                                    驳回
                                </button>

                            </div>

                        </div>
                        `;
                    }
                )
                    .join(
                        ""
                    );


            box.querySelectorAll(
                "[data-change-approve]"
            )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            () =>
                                approveVehicleChange(
                                    button.dataset
                                        .changeApprove
                                )
                        );
                    }
                );


            box.querySelectorAll(
                "[data-change-reject]"
            )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            () =>
                                rejectVehicleChange(
                                    button.dataset
                                        .changeReject
                                )
                        );
                    }
                );
        }

function getAvailableReplacementTrucks(
            taskId
        ) {

            reconcileEquipmentWorkingStatus();

            refreshEquipmentCatalog();


            const occupied =
                getOccupiedEquipmentIds(
                    taskId
                );


            return equipment.trucks
                .filter(
                    truck =>

                        isEquipmentDispatchable(
                            truck
                        )

                        &&

                        !occupied.has(
                            truck.id
                        )
                );
        }

function reconcileEquipmentWorkingStatus() {

            const records =
                getEquipmentRecords();


            if (
                !records.length
            ) {

                return;
            }


            /*
             * 当前真正被生产任务占用的全部设备
             */
            const occupiedIds =
                new Set();


            getTasks()
                .filter(
                    task =>

                        task.status ===
                            "pending"

                        ||

                        task.status ===
                            "active"
                )
                .forEach(
                    task => {

                        /*
                         * 挖机 + 汽车
                         */
                        (
                            task.bindings ||
                            []
                        )
                            .forEach(
                                binding => {

                                    if (
                                        binding.excavatorId
                                    ) {

                                        occupiedIds.add(
                                            String(
                                                binding.excavatorId
                                            )
                                        );
                                    }


                                    (
                                        binding.truckIds ||
                                        []
                                    )
                                        .forEach(
                                            truckId => {

                                                if (
                                                    truckId
                                                ) {

                                                    occupiedIds.add(
                                                        String(
                                                            truckId
                                                        )
                                                    );
                                                }
                                            }
                                        );
                                }
                            );


                        /*
                         * 辅助车辆
                         */
                        (
                            task.auxiliaryAssignments ||
                            []
                        )
                            .forEach(
                                item => {

                                    if (
                                        item.vehicleId
                                    ) {

                                        occupiedIds.add(
                                            String(
                                                item.vehicleId
                                            )
                                        );
                                    }
                                }
                            );
                    }
                );


            let changed =
                false;


            records.forEach(
                device => {

                    const normalized =
                        normalizeEquipmentRecord(
                            device
                        );


                    if (
                        !normalized.id
                    ) {

                        return;
                    }


                    /*
                     * 维修、保养、停用绝不修改
                     */
                    if (
                        normalized.status ===
                            "maintenance"

                        ||

                        normalized.status ===
                            "service"

                        ||

                        normalized.status ===
                            "disabled"
                    ) {

                        return;
                    }


                    /*
                     * 真正仍被任务占用
                     */
                    if (
                        occupiedIds.has(
                            String(
                                normalized.id
                            )
                        )
                    ) {

                        return;
                    }


                    /*
                     * 没任务占用，但仍显示作业中
                     */
                    if (
                        normalized.status ===
                            "working"
                    ) {

                        device.status =
                            "available";


                        device.currentStatus =
                            "可用";


                        device.equipmentStatus =
                            "可用";


                        device.updatedAt =
                            new Date()
                                .toISOString();


                        changed =
                            true;
                    }
                }
            );


            if (
                changed
            ) {

                saveEquipmentRecords(
                    records
                );
            }
        }

function getEquipmentRecords() {

            const records =
                readJson(
                    STORAGE.EQUIPMENT,
                    []
                );


            return Array.isArray(
                records
            )
                ? records
                : [];
        }

function getTasks() {

            const data =
                readJson(
                    STORAGE.TASKS,
                    []
                );


            return Array.isArray(
                data
            )
                ? data
                : [];
        }

function normalizeEquipmentRecord(
            record
        ) {

            const id =
                String(

                    record.equipmentNumber ||

                    record.equipmentNo ||

                    record.vehicleNumber ||

                    record.number ||

                    record.code ||

                    record.equipmentId ||

                    record.id ||

                    ""

                ).trim();


            const type =
                String(

                    record.equipmentType ||

                    record.category ||

                    record.equipmentCategory ||

                    record.type ||

                    record.vehicleType ||

                    ""

                ).trim();


            const rawStatus =
                String(

                    record.currentStatus ||

                    record.equipmentStatus ||

                    record.status ||

                    "可用"

                ).trim();


            return {

                ...record,

                id,

                type,

                group:
                    getEquipmentGroup(
                        type
                    ),

                rawStatus,

                status:
                    normalizeEquipmentStatus(
                        rawStatus
                    ),

                reason:

                    record.maintenanceReason ||

                    record.repairReason ||

                    record.statusReason ||

                    record.remark ||

                    ""
            };
        }

function getEquipmentGroup(
            type
        ) {

            const value =
                String(
                    type ||
                    ""
                );


            if (
                value.includes(
                    "挖掘机"
                )

                ||

                value.includes(
                    "挖机"
                )
            ) {

                return "excavators";
            }


            if (
                value.includes(
                    "卡车"
                )

                ||

                value.includes(
                    "矿卡"
                )

                ||

                value.includes(
                    "自卸车"
                )

                ||

                value.includes(
                    "运输车"
                )

                ||

                value.includes(
                    "汽车"
                )
            ) {

                return "trucks";
            }


            if (
                value.includes(
                    "装载机"
                )

                ||

                value.includes(
                    "铲车"
                )
            ) {

                return "loader";
            }


            if (
                value.includes(
                    "洒水车"
                )
            ) {

                return "water";
            }


            if (
                value.includes(
                    "加油车"
                )

                ||

                value.includes(
                    "油罐车"
                )
            ) {

                return "fuel";
            }


            if (
                value.includes(
                    "平路机"
                )

                ||

                value.includes(
                    "平地机"
                )
            ) {

                return "grader";
            }


            if (
                value.includes(
                    "推土机"
                )
            ) {

                return "dozer";
            }


            if (
                value.includes(
                    "大巴"
                )

                ||

                value.includes(
                    "客车"
                )
            ) {

                return "bus";
            }


            return "";
        }

function normalizeEquipmentStatus(
            status
        ) {

            const value =
                String(
                    status ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            if (
                value ===
                    "maintenance"

                ||

                value ===
                    "维修"

                ||

                value ===
                    "维修中"
            ) {

                return "maintenance";
            }


            if (
                value ===
                    "service"

                ||

                value ===
                    "保养"

                ||

                value ===
                    "保养中"
            ) {

                return "service";
            }


            if (
                value ===
                    "disabled"

                ||

                value ===
                    "停用"

                ||

                value ===
                    "报废"
            ) {

                return "disabled";
            }


            if (
                value ===
                    "working"

                ||

                value ===
                    "active"

                ||

                value ===
                    "作业中"

                ||

                value ===
                    "运行中"

                ||

                value ===
                    "使用中"
            ) {

                return "working";
            }


            return "available";
        }

function saveEquipmentRecords(
            records
        ) {

            localStorage.setItem(
                STORAGE.EQUIPMENT,
                JSON.stringify(
                    records
                )
            );
        }

function refreshEquipmentCatalog() {

            const catalog =
                emptyEquipmentCatalog();


            getEquipmentRecords()
                .forEach(
                    record => {

                        const device =
                            normalizeEquipmentRecord(
                                record
                            );


                        if (
                            !device.id ||
                            !device.group
                        ) {

                            return;
                        }


                        catalog[
                            device.group
                        ]
                            .push(
                                device
                            );
                    }
                );


            Object.keys(
                catalog
            )
                .forEach(
                    key => {

                        catalog[key]
                            .sort(
                                (
                                    a,
                                    b
                                ) =>
                                    String(
                                        a.id
                                    )
                                        .localeCompare(
                                            String(
                                                b.id
                                            ),
                                            "zh-CN",
                                            {
                                                numeric:
                                                    true
                                            }
                                        )
                            );
                    }
                );


            equipment =
                catalog;
        }

function emptyEquipmentCatalog() {

            return {

                excavators:
                    [],

                trucks:
                    [],

                loader:
                    [],

                water:
                    [],

                fuel:
                    [],

                grader:
                    [],

                dozer:
                    [],

                bus:
                    []
            };
        }

function getOccupiedEquipmentIds(
            ignoreTaskId = ""
        ) {

            const result =
                new Set();


            getTasks()
                .filter(
                    task =>

                        task.taskId !==
                            ignoreTaskId

                        &&

                        (
                            task.status ===
                                "pending"

                            ||

                            task.status ===
                                "active"
                        )
                )
                .forEach(
                    task => {

                        (
                            task.bindings ||
                            []
                        )
                            .forEach(
                                binding => {

                                    if (
                                        binding.excavatorId
                                    ) {

                                        result.add(
                                            binding.excavatorId
                                        );
                                    }


                                    (
                                        binding.truckIds ||
                                        []
                                    )
                                        .forEach(
                                            id =>
                                                result.add(
                                                    id
                                                )
                                        );
                                }
                            );


                        (
                            task.auxiliaryAssignments ||
                            []
                        )
                            .forEach(
                                item => {

                                    if (
                                        item.vehicleId
                                    ) {

                                        result.add(
                                            item.vehicleId
                                        );
                                    }
                                }
                            );
                    }
                );


            return result;
        }

function isEquipmentDispatchable(
            device
        ) {

            return (
                device &&
                device.status ===
                    "available"
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
                    value ??
                    ""
                );


            return div.innerHTML;
        }

function approveVehicleChange(
            requestId
        ) {

            const select =
                document.querySelector(
                    `[data-change-vehicle="${cssEscape(requestId)}"]`
                );


            const newVehicle =
                select?.value ||
                "";


            if (
                !newVehicle
            ) {

                alert(
                    "请选择替换车辆。"
                );

                return;
            }


            const requests =
                getChangeRequests();


            const request =
                requests.find(
                    item =>
                        item.requestId ===
                        requestId
                );


            if (
                !request
            ) {

                return;
            }


            const oldVehicle =

                request.oldVehicleNumber ||

                request.oldVehicleId;


            request.status =
                "approved";


            request.approvedVehicleId =
                newVehicle;


            request.approvedVehicleNumber =
                newVehicle;


            request.approvedAt =
                new Date()
                    .toISOString();


            request.approvedBy =
                "调度端";


            saveChangeRequests(
                requests
            );


            updateTaskVehicleAfterChange(
                request.taskId,
                request.driverId,
                request.driverName,
                oldVehicle,
                newVehicle
            );


            renderVehicleChanges();

            refreshAll();


            alert(
                `换车已批准：${oldVehicle} → ${newVehicle}`
            );
        }

function cssEscape(
            value
        ) {

            if (
                window.CSS &&
                typeof CSS.escape ===
                    "function"
            ) {

                return CSS.escape(
                    String(
                        value
                    )
                );
            }


            return String(
                value
            )
                .replace(
                    /["\\]/g,
                    "\\$&"
                );
        }

function saveChangeRequests(
            records
        ) {

            localStorage.setItem(
                STORAGE.CHANGE_REQUESTS,
                JSON.stringify(
                    records
                )
            );
        }

function updateTaskVehicleAfterChange(
            taskId,
            driverId,
            driverName,
            oldVehicle,
            newVehicle
        ) {

            const tasks =
                getTasks();


            const task =
                tasks.find(
                    item =>
                        item.taskId ===
                        taskId
                );


            if (
                !task
            ) {

                return;
            }


            let excavatorId =
                "";


            (
                task.bindings ||
                []
            )
                .forEach(
                    binding => {

                        if (
                            (
                                binding.truckIds ||
                                []
                            )
                                .includes(
                                    oldVehicle
                                )
                        ) {

                            excavatorId =
                                binding.excavatorId;
                        }


                        binding.truckIds =
                            (
                                binding.truckIds ||
                                []
                            )
                                .map(
                                    id =>
                                        id ===
                                        oldVehicle
                                            ? newVehicle
                                            : id
                                );
                    }
                );


            const assignment =
                (
                    task.driverAssignments ||
                    []
                )
                    .find(
                        item =>

                            (
                                driverId &&
                                item.driverId ===
                                    driverId
                            )

                            ||

                            (
                                !driverId &&
                                item.driverName ===
                                    driverName
                            )
                    );


            if (
                assignment
            ) {

                assignment.vehicleId =
                    newVehicle;


                assignment.vehicleNumber =
                    newVehicle;
            }


            closeTruckBinding(
                task,
                oldVehicle,
                "故障换车"
            );


            if (
                excavatorId
            ) {

                openTruckBinding(
                    task,
                    excavatorId,
                    newVehicle,
                    "故障替换车辆"
                );
            }


            task.equipmentAdjustments =
                task.equipmentAdjustments ||
                [];


            task.equipmentAdjustments.push({

                adjustmentId:
                    createId(
                        "CHANGE"
                    ),

                time:
                    new Date()
                        .toISOString(),

                summary:
                    `故障换车：${oldVehicle} → ${newVehicle}`,

                driverName:
                    driverName ||
                    ""
            });


            saveTasks(
                tasks
            );


            const localTask =
                readJson(
                    STORAGE.DRIVER_CURRENT_TASK,
                    null
                );


            if (
                localTask &&
                localTask.taskId ===
                    taskId
            ) {

                localTask.vehicleId =
                    newVehicle;


                localTask.vehicleNumber =
                    newVehicle;


                localTask.vehicleClaimed =
                    false;


                localStorage.setItem(
                    STORAGE.DRIVER_CURRENT_TASK,
                    JSON.stringify(
                        localTask
                    )
                );
            }
        }

function closeTruckBinding(
            task,
            truckId,
            reason
        ) {

            const now =
                new Date()
                    .toISOString();


            (
                task.truckBindingHistory ||
                []
            )
                .filter(
                    item =>

                        String(
                            item.truckId
                        ) ===
                            String(
                                truckId
                            )

                        &&

                        !item.endAt
                )
                .forEach(
                    item => {

                        item.endAt =
                            now;


                        item.endReason =
                            reason ||
                            "结束跟随";
                    }
                );
        }

function openTruckBinding(
            task,
            excavatorId,
            truckId,
            reason
        ) {

            task.truckBindingHistory =
                task.truckBindingHistory ||
                [];


            task.truckBindingHistory.push({

                bindingId:
                    createId(
                        "BIND"
                    ),

                excavatorId,

                truckId,

                startAt:
                    new Date()
                        .toISOString(),

                endAt:
                    null,

                reason:
                    reason ||
                    "增加车辆"
            });
        }

function createId(
            prefix
        ) {

            return (

                prefix +
                "_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(
                        36
                    )
                    .slice(
                        2,
                        8
                    )
            );
        }

function saveTasks(
            tasks
        ) {

            localStorage.setItem(
                STORAGE.TASKS,
                JSON.stringify(
                    tasks
                )
            );
        }

function refreshAll() {

            reconcileEquipmentWorkingStatus();

            refreshEquipmentCatalog();

            synchronizeTaskStatus();

            renderProductionBoard();

            renderHistory();

            renderPersonnelStatusBoard();

            renderTodoCounts();

            populatePenaltyPersonnel();


            if (
                currentDraft
            ) {

                renderExcavators();

                renderTrucks();

                renderBindings();

                renderDriverAssignments();

                renderExcavatorDriverAssignments();

                renderAuxiliaryVehicles();

                renderAuxiliaryAssignments();
            }
        }

function synchronizeTaskStatus() {

            const tasks =
                getTasks();


            let changed =
                false;


            tasks.forEach(
                task => {

                    if (
                        task.status !==
                            "pending"

                        &&

                        task.status !==
                            "active"
                    ) {

                        return;
                    }


                    const trips =
                        getValidTaskTrips(
                            task
                        );


                    if (
                        task.status ===
                            "pending"

                        &&

                        trips.length
                    ) {

                        task.status =
                            "active";


                        task.startedAt =
                            task.startedAt ||
                            new Date()
                                .toISOString();


                        changed =
                            true;
                    }
                }
            );


            if (
                changed
            ) {

                saveTasks(
                    tasks
                );
            }
        }

function getValidTaskTrips(
            task
        ) {

            return getTaskTrips(
                task
            )
                .filter(
                    trip =>

                        trip.dispatchConfirmation !==
                            "rejected"

                        &&

                        trip.officialCountEligible !==
                            false
                );
        }

function getTaskTrips(
            task
        ) {

            return getTrips()
                .filter(
                    trip =>

                        trip.taskId ===
                            task.taskId

                        ||

                        trip.dispatchTaskId ===
                            task.taskId
                );
        }

function renderProductionBoard() {

            const tasks =
                getTasks()
                    .filter(
                        task =>

                            task.status ===
                                "pending"

                            ||

                            task.status ===
                                "active"
                    )
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            new Date(
                                b.publishedAt ||
                                0
                            ) -
                            new Date(
                                a.publishedAt ||
                                0
                            )
                    );


            setText(
                "productionTaskCount",
                `${tasks.length} 个进行中任务`
            );


            const board =
                $("productionTaskBoard");


            if (
                !board
            ) {

                return;
            }


            if (
                !tasks.length
            ) {

                board.innerHTML =
                    '<div class="empty-placeholder">当前没有进行中的生产任务</div>';

                return;
            }


            board.innerHTML =
                tasks.map(
                    task => {

                        const trips =
                            getValidTaskTrips(
                                task
                            );


                        return `

                        <button
                            type="button"
                            class="production-task-card ${escapeHtml(task.status)}"
                            data-task="${escapeHtml(task.taskId)}"
                        >

                            <div class="task-card-top">

                                <div>

                                    <strong>
                                        ${escapeHtml(task.area || "-")}
                                    </strong>

                                    <span>
                                        ${escapeHtml(task.shift || "-")}
                                        ·
                                        ${escapeHtml(task.date || task.dateKey || "-")}
                                    </span>

                                </div>


                                <span
                                    class="task-status-pill ${escapeHtml(task.status)}"
                                >
                                    ${
                                        task.status ===
                                        "active"
                                            ? "执行中"
                                            : "待执行"
                                    }
                                </span>

                            </div>


                            <div class="task-stat-grid">

                                <div>

                                    <span>
                                        挖机
                                    </span>

                                    <strong>
                                        ${(task.bindings || []).length}
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        汽车
                                    </span>

                                    <strong>
                                        ${(task.driverAssignments || []).length}
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        司机
                                    </span>

                                    <strong>
                                        ${
                                            (task.driverAssignments || []).length +
                                            (task.excavatorDriverAssignments || []).length
                                        }
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        趟数
                                    </span>

                                    <strong>
                                        ${trips.length}
                                    </strong>

                                </div>

                            </div>

                        </button>
                        `;
                    }
                )
                    .join(
                        ""
                    );


            board.querySelectorAll(
                "[data-task]"
            )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            () =>
                                openTaskDetail(
                                    button.dataset.task
                                )
                        );
                    }
                );
        }

function openTaskDetail(
            taskId
        ) {

            const task =
                getTaskById(
                    taskId
                );


            if (
                !task
            ) {

                return;
            }


            openedTaskId =
                taskId;


            if (
                $("publishedTaskModalTitle")
            ) {

                $("publishedTaskModalTitle")
                    .textContent =
                    "生产任务 · " +
                    (
                        task.area ||
                        "-"
                    );
            }


            const driverHtml =
                (
                    task.driverAssignments ||
                    []
                )
                    .map(
                        item => `

                        <div class="detail-driver-row">

                            <span>
                                🚜 ${escapeHtml(item.excavatorNumber || "-")}
                            </span>

                            <strong>
                                🚚 ${escapeHtml(item.vehicleNumber || "-")}
                            </strong>

                            <b>
                                👷 ${escapeHtml(item.driverName || "-")}
                            </b>

                        </div>
                        `
                    )
                    .join(
                        ""
                    );


            const excavatorStats =
                (
                    task.bindings ||
                    []
                )
                    .map(
                        binding => {

                            const stats =
                                getExcavatorTripStats(
                                    task,
                                    binding.excavatorId
                                );


                            const driver =
                                (
                                    task.excavatorDriverAssignments ||
                                    []
                                )
                                    .find(
                                        item =>
                                            item.excavatorId ===
                                            binding.excavatorId
                                    );


                            return `

                            <div class="approval-card">

                                <div class="approval-title">

                                    <strong>
                                        🚜 ${escapeHtml(binding.excavatorId)}
                                    </strong>

                                    <span>
                                        ${escapeHtml(driver?.driverName || "未分配")}
                                    </span>

                                </div>


                                <div class="approval-detail-grid">

                                    <div>

                                        <span>
                                            挖机车数
                                        </span>

                                        <strong>
                                            ${stats.total}
                                        </strong>

                                    </div>

                                </div>


                                <div class="approval-note">

                                    ${
                                        stats.trucks.length
                                            ? stats.trucks
                                                .map(
                                                    truck =>
                                                        `🚚 ${escapeHtml(truck.truckId)}：${truck.count}车`
                                                )
                                                .join(
                                                    "　"
                                                )
                                            : "暂无有效车数"
                                    }

                                </div>

                            </div>
                            `;
                        }
                    )
                    .join(
                        ""
                    );


            if (
                $("publishedTaskModalContent")
            ) {

                $("publishedTaskModalContent")
                    .innerHTML = `

                    <div class="detail-summary-grid">

                        <div>

                            <span>
                                任务编号
                            </span>

                            <strong>
                                ${escapeHtml(task.taskId)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                班次
                            </span>

                            <strong>
                                ${escapeHtml(task.shift || "-")}
                            </strong>

                        </div>


                        <div>

                            <span>
                                区域
                            </span>

                            <strong>
                                ${escapeHtml(task.area || "-")}
                            </strong>

                        </div>


                        <div>

                            <span>
                                有效趟数
                            </span>

                            <strong>
                                ${getValidTaskTrips(task).length}
                            </strong>

                        </div>

                    </div>


                    <h4>
                        👷 汽车司机 / 汽车 / 挖机
                    </h4>

                    ${
                        driverHtml ||
                        '<div class="empty-placeholder">暂无司机分配</div>'
                    }


                    <h4>
                        🚜 挖机车数统计
                    </h4>

                    ${
                        excavatorStats ||
                        '<div class="empty-placeholder">暂无统计</div>'
                    }


                    <h4>
                        运输路线
                    </h4>

                    <div class="detail-note">

                        ${escapeHtml(task.loadingPoint || "-")}

                        →

                        ${escapeHtml(task.unloadingPoint || "-")}

                    </div>


                    <h4>
                        调度说明
                    </h4>

                    <div class="detail-note">
                        ${escapeHtml(task.remark || "无")}
                    </div>
                    `;
            }


            $("withdrawPublishedTaskButton")
                ?.classList
                .toggle(
                    "hidden",
                    task.status !==
                    "pending"
                );


            $("completePublishedTaskButton")
                ?.classList
                .toggle(
                    "hidden",
                    task.status !==
                    "active"
                );


            showModal(
                "publishedTaskModal"
            );
        }

function getTaskById(
            id
        ) {

            return getTasks()
                .find(
                    task =>
                        task.taskId ===
                        id
                ) ||
                null;
        }

function getExcavatorTripStats(
            task,
            excavatorId
        ) {

            const trips =
                getValidTaskTrips(
                    task
                );


            const history =
                Array.isArray(
                    task.truckBindingHistory
                )
                    ? task.truckBindingHistory
                    : [];


            const binding =
                (
                    task.bindings ||
                    []
                )
                    .find(
                        item =>
                            item.excavatorId ===
                            excavatorId
                    );


            const currentTrucks =
                binding?.truckIds ||
                [];


            const map =
                new Map();


            let total =
                0;


            function add(
                truckId
            ) {

                total +=
                    1;


                map.set(
                    truckId,
                    (
                        map.get(
                            truckId
                        ) ||
                        0
                    ) +
                    1
                );
            }


            trips.forEach(
                trip => {

                    const truckId =
                        getTripVehicleNumber(
                            trip
                        );


                    if (
                        !truckId
                    ) {

                        return;
                    }


                    const directExcavator =
                        String(

                            trip.excavatorId ||

                            trip.excavatorNumber ||

                            ""

                        );


                    if (
                        directExcavator
                    ) {

                        if (
                            directExcavator ===
                            String(
                                excavatorId
                            )
                        ) {

                            add(
                                truckId
                            );
                        }


                        return;
                    }


                    const tripTime =
                        getTripTime(
                            trip
                        );


                    if (
                        tripTime &&
                        history.length
                    ) {

                        const matched =
                            history.some(
                                record => {

                                    if (
                                        String(
                                            record.excavatorId
                                        ) !==
                                        String(
                                            excavatorId
                                        )
                                    ) {

                                        return false;
                                    }


                                    if (
                                        String(
                                            record.truckId
                                        ) !==
                                        String(
                                            truckId
                                        )
                                    ) {

                                        return false;
                                    }


                                    const start =
                                        new Date(
                                            record.startAt ||
                                            0
                                        );


                                    if (
                                        Number.isNaN(
                                            start.getTime()
                                        )
                                    ) {

                                        return false;
                                    }


                                    let end =
                                        null;


                                    if (
                                        record.endAt
                                    ) {

                                        end =
                                            new Date(
                                                record.endAt
                                            );
                                    }


                                    return (

                                        tripTime >=
                                            start

                                        &&

                                        (
                                            !end

                                            ||

                                            tripTime <=
                                                end
                                        )
                                    );
                                }
                            );


                        if (
                            matched
                        ) {

                            add(
                                truckId
                            );
                        }


                        return;
                    }


                    /*
                     * 老任务兼容
                     */
                    if (
                        currentTrucks.includes(
                            truckId
                        )
                    ) {

                        add(
                            truckId
                        );
                    }
                }
            );


            return {

                total,

                trucks:
                    [
                        ...map.entries()
                    ]
                        .map(
                            (
                                [
                                    truckId,
                                    count
                                ]
                            ) => ({

                                truckId,

                                count
                            })
                        )
            };
        }

function getTripVehicleNumber(
            trip
        ) {

            return String(

                trip.vehicleNumber ||

                trip.vehicleId ||

                trip.truckNumber ||

                trip.truckId ||

                ""

            );
        }

function getTripTime(
            trip
        ) {

            const value =

                trip.completedAt ||

                trip.unloadedAt ||

                trip.unloadTime ||

                trip.endTime ||

                trip.recordedAt ||

                trip.createdAt ||

                trip.time ||

                trip.timestamp;


            if (
                !value
            ) {

                return null;
            }


            const date =
                new Date(
                    value
                );


            return Number.isNaN(
                date.getTime()
            )
                ? null
                : date;
        }

function showModal(
            id
        ) {

            $(id)
                ?.classList
                .remove(
                    "hidden"
                );


            document.body
                .classList
                .add(
                    "modal-open"
                );
        }

function renderHistory() {

            const board =
                $("historyTaskBoard");


            if (
                !board
            ) {

                return;
            }


            let tasks =
                getTasks()
                    .filter(
                        item =>
                            item.status ===
                            "completed"
                    );


            const date =
                $("historyDateFilter")
                    ?.value ||
                "";


            const shift =
                $("historyShiftFilter")
                    ?.value ||
                "";


            const area =
                $("historyAreaFilter")
                    ?.value
                    .trim()
                    .toLowerCase() ||
                "";


            if (
                date
            ) {

                tasks =
                    tasks.filter(
                        task =>
                            task.dateKey ===
                            date
                    );
            }


            if (
                shift
            ) {

                tasks =
                    tasks.filter(
                        task =>
                            task.shift ===
                            shift
                    );
            }


            if (
                area
            ) {

                tasks =
                    tasks.filter(
                        task =>
                            String(
                                task.area ||
                                ""
                            )
                                .toLowerCase()
                                .includes(
                                    area
                                )
                    );
            }


            setText(
                "historyTaskCount",
                `${tasks.length} 个`
            );


            if (
                !tasks.length
            ) {

                board.innerHTML =
                    '<div class="empty-placeholder">暂无历史任务</div>';

                return;
            }


            tasks.sort(
                (
                    a,
                    b
                ) =>
                    new Date(
                        b.completedAt ||
                        0
                    ) -
                    new Date(
                        a.completedAt ||
                        0
                    )
            );


            board.innerHTML =
                tasks.map(
                    task => `

                    <button
                        type="button"
                        class="production-task-card completed"
                        data-history="${escapeHtml(task.taskId)}"
                    >

                        <div class="task-card-top">

                            <div>

                                <strong>
                                    ${escapeHtml(task.area || "-")}
                                </strong>

                                <span>
                                    ${escapeHtml(task.shift || "-")}
                                    ·
                                    ${escapeHtml(task.date || "-")}
                                </span>

                            </div>


                            <span class="task-status-pill completed">
                                已完成
                            </span>

                        </div>


                        <div class="task-stat-grid">

                            <div>

                                <span>
                                    司机
                                </span>

                                <strong>
                                    ${
                                        (task.driverAssignments || []).length +
                                        (task.excavatorDriverAssignments || []).length
                                    }
                                </strong>

                            </div>


                            <div>

                                <span>
                                    趟数
                                </span>

                                <strong>
                                    ${getValidTaskTrips(task).length}
                                </strong>

                            </div>

                        </div>

                    </button>
                    `
                )
                    .join(
                        ""
                    );


            board.querySelectorAll(
                "[data-history]"
            )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            () =>
                                openTaskDetail(
                                    button.dataset
                                        .history
                                )
                        );
                    }
                );
        }

function renderPersonnelStatusBoard() {

            const people = [

                ...getApprovedDrivers(),

                ...getApprovedExcavatorDrivers()
            ];


            setText(
                "personnelCountBadge",
                people.length +
                " 人"
            );


            const box =
                $("personnelStatusBoard");


            if (
                !box
            ) {

                return;
            }


            if (
                !people.length
            ) {

                box.innerHTML =
                    '<div class="empty-placeholder">暂无已审核作业人员</div>';

                return;
            }


            box.innerHTML =
                people.map(
                    person => {

                        const state =
                            getCurrentPersonStatus(
                                person
                            );


                        return `

                        <div class="person-card ${escapeHtml(state.code)}">

                            <div>

                                <strong>
                                    ${escapeHtml(person.name || "-")}
                                </strong>

                                <span>
                                    ${escapeHtml(person.team || "-")}
                                    ·
                                    ${escapeHtml(normalizePosition(person.position))}
                                </span>

                            </div>


                            <span class="person-state">
                                ${escapeHtml(state.label)}
                            </span>

                        </div>
                        `;
                    }
                )
                    .join(
                        ""
                    );
        }

function getApprovedExcavatorDrivers() {

            return getPersonnelRecords()
                .filter(
                    person =>

                        normalizePosition(
                            person.position
                        ) ===
                            "挖机司机"

                        &&

                        isApprovedPerson(
                            person
                        )
                )
                .map(
                    person => ({

                        ...person,

                        personId:
                            getPersonId(
                                person
                            ),

                        driverId:
                            getPersonId(
                                person
                            ),

                        team:
                            person.team ||
                            person.department ||
                            ""
                    })
                );
        }

function getCurrentPersonStatus(
            person
        ) {

            if (
                !isApprovedPerson(
                    person
                )
            ) {

                return {

                    code:
                        "disabled",

                    label:
                        "⚫ 停用"
                };
            }


            const now =
                new Date();


            if (
                hasApprovedLeaveOverlap(
                    person,
                    now,
                    now
                )
            ) {

                return {

                    code:
                        "leave",

                    label:
                        "🟣 请假"
                };
            }


            if (
                getPersonActiveTask(
                    person
                )
            ) {

                return {

                    code:
                        "working",

                    label:
                        "🔴 作业中"
                };
            }


            if (
                hasPendingLeaveAtTime(
                    person,
                    now
                )
            ) {

                return {

                    code:
                        "pending",

                    label:
                        "🟡 请假待审批"
                };
            }


            return {

                code:
                    "available",

                label:
                    "🟢 可调度"
            };
        }

function hasApprovedLeaveOverlap(
            person,
            start,
            end
        ) {

            return getLeaves()
                .some(
                    leave => {

                        if (
                            leave.status !==
                            "approved"
                        ) {

                            return false;
                        }


                        if (
                            !leaveMatchesPerson(
                                leave,
                                person
                            )
                        ) {

                            return false;
                        }


                        const from =
                            new Date(
                                leave.startTime ||
                                leave.startAt
                            );


                        const to =
                            new Date(
                                leave.endTime ||
                                leave.endAt
                            );


                        return (
                            from <=
                                end

                            &&

                            to >=
                                start
                        );
                    }
                );
        }

function leaveMatchesPerson(
            leave,
            person
        ) {

            const leaveId =

                leave.applicantId ||

                leave.personId ||

                "";


            const personId =
                getPersonId(
                    person
                );


            if (
                leaveId &&
                personId
            ) {

                return (
                    String(
                        leaveId
                    ) ===
                    String(
                        personId
                    )
                );
            }


            return (

                String(
                    leave.applicantName ||
                    leave.personName ||
                    ""
                ).trim()

                ===

                String(
                    person.name ||
                    ""
                ).trim()
            );
        }

function getPersonActiveTask(
            person
        ) {

            const id =
                getPersonId(
                    person
                );


            return getTasks()
                .find(
                    task =>

                        (
                            task.status ===
                                "pending"

                            ||

                            task.status ===
                                "active"
                        )

                        &&

                        (
                            (
                                task.driverAssignments ||
                                []
                            )
                                .some(
                                    item =>
                                        String(
                                            item.driverId ||
                                            ""
                                        ) ===
                                        id
                                )

                            ||

                            (
                                task.excavatorDriverAssignments ||
                                []
                            )
                                .some(
                                    item =>
                                        String(
                                            item.driverId ||
                                            ""
                                        ) ===
                                        id
                                )
                        )
                ) ||
                null;
        }

function hasPendingLeaveAtTime(
            person,
            time
        ) {

            return hasPendingLeaveOverlap(

                person,

                time,

                new Date(
                    time.getTime() +
                    1000
                )
            );
        }

function hasPendingLeaveOverlap(
            person,
            start,
            end
        ) {

            return getLeaves()
                .some(
                    leave => {

                        if (
                            leave.status !==
                            "pending"
                        ) {

                            return false;
                        }


                        if (
                            !leaveMatchesPerson(
                                leave,
                                person
                            )
                        ) {

                            return false;
                        }


                        const from =
                            new Date(
                                leave.startTime ||
                                leave.startAt
                            );


                        const to =
                            new Date(
                                leave.endTime ||
                                leave.endAt
                            );


                        return (
                            from <
                                end

                            &&

                            to >
                                start
                        );
                    }
                );
        }

function renderExcavators() {

            if (
                !currentDraft
            ) {

                return;
            }


            const board =
                $("excavatorBoard");


            if (
                !board
            ) {

                return;
            }


            const occupied =
                getOccupiedEquipmentIds();


            board.innerHTML =
                "";


            if (
                !equipment.excavators.length
            ) {

                board.innerHTML =
                    '<div class="empty-placeholder">设备库暂无挖机</div>';

                return;
            }


            equipment.excavators
                .forEach(
                    device => {

                        const selected =
                            selectedExcavatorId ===
                            device.id;


                        const draftUsed =
                            bindings.some(
                                item =>
                                    item.excavatorId ===
                                    device.id
                            );


                        const button =
                            document.createElement(
                                "button"
                            );


                        button.type =
                            "button";


                        button.className =
                            getDeviceClass(
                                device,
                                occupied,
                                selected,
                                draftUsed
                            );


                        let label =
                            equipmentStateLabel(
                                device
                            );


                        if (
                            draftUsed
                        ) {

                            label =
                                "本任务已用";

                        } else if (
                            selected
                        ) {

                            label =
                                "已选择";

                        } else if (
                            occupied.has(
                                device.id
                            )
                        ) {

                            label =
                                "已分配";
                        }


                        button.innerHTML = `

                            <strong>
                                ${escapeHtml(device.id)}
                            </strong>

                            <span>
                                ${escapeHtml(label)}
                            </span>
                        `;


                        button.disabled =
                            draftUsed;


                        button.addEventListener(
                            "click",
                            function () {

                                if (
                                    !isEquipmentDispatchable(
                                        device
                                    )
                                ) {

                                    alert(
                                        `${device.id} 当前状态：${equipmentStateLabel(device)}`
                                    );

                                    return;
                                }


                                if (
                                    occupied.has(
                                        device.id
                                    )
                                ) {

                                    alert(
                                        device.id +
                                        " 已被其他任务占用。"
                                    );

                                    return;
                                }


                                selectedExcavatorId =
                                    selected
                                        ? null
                                        : device.id;


                                selectedTruckIds =
                                    [];


                                renderExcavators();

                                renderTrucks();
                            }
                        );


                        board.appendChild(
                            button
                        );
                    }
                );
        }

function getDeviceClass(
            device,
            occupied,
            selected,
            draftUsed
        ) {

            if (
                draftUsed
            ) {

                return "device-card draft-used";
            }


            if (
                selected
            ) {

                return "device-card selected";
            }


            if (
                device.status ===
                    "maintenance"

                ||

                device.status ===
                    "service"

                ||

                device.status ===
                    "disabled"

                ||

                device.status ===
                    "working"
            ) {

                return "device-card maintenance";
            }


            if (
                occupied.has(
                    device.id
                )
            ) {

                return "device-card occupied";
            }


            return "device-card available";
        }

function equipmentStateLabel(
            device
        ) {

            switch (
                device.status
            ) {

                case "maintenance":
                    return "维修中";


                case "service":
                    return "保养中";


                case "disabled":
                    return "停用";


                case "working":
                    return "作业中";


                default:
                    return "可调配";
            }
        }

function renderTrucks() {

            if (
                !currentDraft
            ) {

                return;
            }


            const board =
                $("truckBoard");


            if (
                !board
            ) {

                return;
            }


            const occupied =
                getOccupiedEquipmentIds();


            const draftUsed =
                new Set(

                    bindings.flatMap(
                        item =>
                            item.truckIds ||
                            []
                    )

                );


            board.innerHTML =
                "";


            if (
                !equipment.trucks.length
            ) {

                board.innerHTML =
                    '<div class="empty-placeholder">设备库暂无运输汽车</div>';

                return;
            }


            equipment.trucks
                .forEach(
                    device => {

                        const selected =
                            selectedTruckIds.includes(
                                device.id
                            );


                        const used =
                            draftUsed.has(
                                device.id
                            );


                        const button =
                            document.createElement(
                                "button"
                            );


                        button.type =
                            "button";


                        button.className =
                            getDeviceClass(
                                device,
                                occupied,
                                selected,
                                used
                            );


                        let label =
                            equipmentStateLabel(
                                device
                            );


                        if (
                            used
                        ) {

                            label =
                                "本任务已用";

                        } else if (
                            selected
                        ) {

                            label =
                                "已选择";

                        } else if (
                            occupied.has(
                                device.id
                            )
                        ) {

                            label =
                                "已分配";
                        }


                        button.innerHTML = `

                            <strong>
                                ${escapeHtml(device.id)}
                            </strong>

                            <span>
                                ${escapeHtml(label)}
                            </span>
                        `;


                        button.disabled =
                            used;


                        button.addEventListener(
                            "click",
                            function () {

                                if (
                                    !selectedExcavatorId
                                ) {

                                    alert(
                                        "请先选择挖机。"
                                    );

                                    return;
                                }


                                if (
                                    !isEquipmentDispatchable(
                                        device
                                    )
                                ) {

                                    alert(
                                        `${device.id} 当前状态：${equipmentStateLabel(device)}`
                                    );

                                    return;
                                }


                                if (
                                    occupied.has(
                                        device.id
                                    )
                                ) {

                                    alert(
                                        device.id +
                                        " 已被其他任务使用。"
                                    );

                                    return;
                                }


                                if (
                                    selectedTruckIds.includes(
                                        device.id
                                    )
                                ) {

                                    selectedTruckIds =
                                        selectedTruckIds
                                            .filter(
                                                id =>
                                                    id !==
                                                    device.id
                                            );

                                } else {

                                    selectedTruckIds.push(
                                        device.id
                                    );
                                }


                                renderTrucks();
                            }
                        );


                        board.appendChild(
                            button
                        );
                    }
                );


            if (
                selectedExcavatorId
            ) {

                setText(
                    "selectedExcavatorInfo",
                    `当前挖机：${selectedExcavatorId} · 已选${selectedTruckIds.length}台汽车`
                );


                $("bindTrucksButton")
                    ?.classList
                    .remove(
                        "hidden"
                    );

            } else {

                setText(
                    "selectedExcavatorInfo",
                    "请先选择挖机"
                );


                $("bindTrucksButton")
                    ?.classList
                    .add(
                        "hidden"
                    );
            }
        }

function renderBindings() {

            const box =
                $("bindingList");


            if (
                !box
            ) {

                return;
            }


            if (
                !bindings.length
            ) {

                box.innerHTML =
                    '<div class="empty-placeholder">暂无设备绑定</div>';

                return;
            }


            box.innerHTML =
                bindings.map(
                    (
                        binding,
                        index
                    ) => `

                    <div class="binding-row">

                        <div>

                            <strong>
                                🚜 ${escapeHtml(binding.excavatorId)}
                            </strong>

                            <span>
                                🚚 ${
                                    (
                                        binding.truckIds ||
                                        []
                                    )
                                        .map(
                                            escapeHtml
                                        )
                                        .join(
                                            "、"
                                        )
                                }
                            </span>

                        </div>


                        <button
                            type="button"
                            class="mini-danger-button"
                            data-remove-binding="${index}"
                        >
                            删除
                        </button>

                    </div>
                    `
                )
                    .join(
                        ""
                    );


            box.querySelectorAll(
                "[data-remove-binding]"
            )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            function () {

                                bindings.splice(
                                    Number(
                                        button.dataset
                                            .removeBinding
                                    ),
                                    1
                                );


                                synchronizeDraftDriverAssignments();

                                synchronizeExcavatorDriverAssignments();


                                renderBindings();

                                renderDriverAssignments();

                                renderExcavatorDriverAssignments();

                                renderExcavators();

                                renderTrucks();
                            }
                        );
                    }
                );
        }

function synchronizeDraftDriverAssignments() {

            const trucks =
                [];


            bindings.forEach(
                binding => {

                    (
                        binding.truckIds ||
                        []
                    )
                        .forEach(
                            truckId => {

                                trucks.push({

                                    truckId,

                                    excavatorId:
                                        binding.excavatorId
                                });
                            }
                        );
                }
            );


            driverAssignments =
                trucks.map(
                    item => {

                        const old =
                            driverAssignments.find(
                                record =>
                                    record.vehicleNumber ===
                                    item.truckId
                            );


                        if (
                            old
                        ) {

                            return {

                                ...old,

                                vehicleId:
                                    item.truckId,

                                vehicleNumber:
                                    item.truckId,

                                excavatorId:
                                    item.excavatorId,

                                excavatorNumber:
                                    item.excavatorId
                            };
                        }


                        return {

                            vehicleId:
                                item.truckId,

                            vehicleNumber:
                                item.truckId,

                            excavatorId:
                                item.excavatorId,

                            excavatorNumber:
                                item.excavatorId,

                            driverId:
                                "",

                            driverName:
                                "",

                            team:
                                ""
                        };
                    }
                );
        }

function synchronizeExcavatorDriverAssignments() {

            const ids =
                bindings
                    .map(
                        item =>
                            item.excavatorId
                    )
                    .filter(
                        Boolean
                    );


            excavatorDriverAssignments =
                ids.map(
                    id => {

                        const old =
                            excavatorDriverAssignments
                                .find(
                                    item =>
                                        item.excavatorId ===
                                        id
                                );


                        return old || {

                            excavatorId:
                                id,

                            driverId:
                                "",

                            driverName:
                                "",

                            team:
                                ""
                        };
                    }
                );
        }

function renderDriverAssignments() {

            if (
                !currentDraft
            ) {

                return;
            }


            synchronizeDraftDriverAssignments();


            const box =
                $("driverAssignmentList");


            if (
                !box
            ) {

                return;
            }


            const total =
                driverAssignments.length;


            const complete =
                driverAssignments
                    .filter(
                        item =>
                            item.driverId
                    )
                    .length;


            setText(
                "driverAssignmentStatus",
                `${complete} / ${total}`
            );


            if (
                !total
            ) {

                box.innerHTML =
                    '<div class="empty-placeholder">请先绑定挖机和汽车</div>';

                return;
            }


            const people =
                getApprovedDrivers();


            box.innerHTML =
                driverAssignments.map(
                    assignment => {

                        const options =
                            people.map(
                                person => {

                                    const state =
                                        getPersonStatusForDraft(
                                            person
                                        );


                                    const alreadyUsed =
                                        driverAssignments.some(
                                            item =>

                                                item.driverId ===
                                                    person.driverId

                                                &&

                                                item.vehicleNumber !==
                                                    assignment.vehicleNumber
                                        );


                                    const disabled =

                                        state.code ===
                                            "leave"

                                        ||

                                        state.code ===
                                            "working"

                                        ||

                                        state.code ===
                                            "disabled"

                                        ||

                                        alreadyUsed;


                                    return `

                                    <option
                                        value="${escapeHtml(person.driverId)}"

                                        ${
                                            assignment.driverId ===
                                            person.driverId
                                                ? "selected"
                                                : ""
                                        }

                                        ${
                                            disabled
                                                ? "disabled"
                                                : ""
                                        }
                                    >

                                        ${escapeHtml(person.name || "-")}

                                        ·

                                        ${escapeHtml(person.team || "-")}

                                        ·

                                        ${
                                            alreadyUsed
                                                ? "本任务已分配"
                                                : escapeHtml(state.label)
                                        }

                                    </option>
                                    `;
                                }
                            )
                                .join(
                                    ""
                                );


                        return `

                        <div class="driver-assignment-row">

                            <div class="assignment-equipment">

                                <strong>
                                    🚚 ${escapeHtml(assignment.vehicleNumber)}
                                </strong>

                                <span>
                                    跟随 🚜 ${escapeHtml(assignment.excavatorNumber)}
                                </span>

                            </div>


                            <select
                                data-driver-truck="${escapeHtml(assignment.vehicleNumber)}"
                            >

                                <option value="">
                                    请选择汽车司机
                                </option>

                                ${options}

                            </select>

                        </div>
                        `;
                    }
                )
                    .join(
                        ""
                    );


            box.querySelectorAll(
                "[data-driver-truck]"
            )
                .forEach(
                    select => {

                        select.addEventListener(
                            "change",
                            function () {

                                assignDriverToTruck(
                                    select.dataset
                                        .driverTruck,
                                    select.value
                                );
                            }
                        );
                    }
                );
        }

function getPersonStatusForDraft(
            person
        ) {

            if (
                !currentDraft
            ) {

                return getCurrentPersonStatus(
                    person
                );
            }


            if (
                !isApprovedPerson(
                    person
                )
            ) {

                return {

                    code:
                        "disabled",

                    label:
                        "⚫ 停用"
                };
            }


            const range =
                getTaskDateRange(
                    currentDraft
                );


            if (
                hasApprovedLeaveOverlap(
                    person,
                    range.start,
                    range.end
                )
            ) {

                return {

                    code:
                        "leave",

                    label:
                        "🟣 本班请假"
                };
            }


            if (
                getPersonActiveTask(
                    person
                )
            ) {

                return {

                    code:
                        "working",

                    label:
                        "🔴 作业中"
                };
            }


            if (
                hasPendingLeaveOverlap(
                    person,
                    range.start,
                    range.end
                )
            ) {

                return {

                    code:
                        "pending",

                    label:
                        "🟡 请假待审批"
                };
            }


            return {

                code:
                    "available",

                label:
                    "🟢 可调度"
            };
        }

function getTaskDateRange(
            task
        ) {

            const dateKey =
                task.dateKey ||
                getLocalDateKey();


            const start =
                new Date(
                    `${dateKey}T${
                        task.shift ===
                        "夜班"
                            ? "20:00:00"
                            : "08:00:00"
                    }`
                );


            const end =
                new Date(
                    start
                );


            if (
                task.shift ===
                    "夜班"
            ) {

                end.setDate(
                    end.getDate() +
                    1
                );


                end.setHours(
                    8,
                    0,
                    0,
                    0
                );

            } else {

                end.setHours(
                    20,
                    0,
                    0,
                    0
                );
            }


            return {

                start,

                end
            };
        }

function getLocalDateKey() {

            const date =
                new Date();


            return [

                date.getFullYear(),

                String(
                    date.getMonth() +
                    1
                )
                    .padStart(
                        2,
                        "0"
                    ),

                String(
                    date.getDate()
                )
                    .padStart(
                        2,
                        "0"
                    )

            ]
                .join(
                    "-"
                );
        }

function assignDriverToTruck(
            truckId,
            driverId
        ) {

            const assignment =
                driverAssignments.find(
                    item =>
                        item.vehicleNumber ===
                        truckId
                );


            if (
                !assignment
            ) {

                return;
            }


            if (
                !driverId
            ) {

                assignment.driverId =
                    "";

                assignment.driverName =
                    "";

                assignment.team =
                    "";


                renderDriverAssignments();

                return;
            }


            const person =
                getApprovedDrivers()
                    .find(
                        item =>
                            item.driverId ===
                            driverId
                    );


            if (
                !person
            ) {

                return;
            }


            const state =
                getPersonStatusForDraft(
                    person
                );


            if (
                state.code ===
                    "leave"
            ) {

                alert(
                    person.name +
                    " 本班请假，不能安排任务。"
                );


                renderDriverAssignments();

                return;
            }


            if (
                state.code ===
                    "working"
            ) {

                alert(
                    person.name +
                    " 已在其他任务中。"
                );


                renderDriverAssignments();

                return;
            }


            assignment.driverId =
                person.driverId;


            assignment.driverName =
                person.name ||
                "";


            assignment.team =
                person.team ||
                "";


            renderDriverAssignments();
        }

function renderExcavatorDriverAssignments() {

            if (
                !currentDraft
            ) {

                return;
            }


            ensureExcavatorDriverSection();

            synchronizeExcavatorDriverAssignments();


            const box =
                $("excavatorDriverAssignmentList");


            if (
                !box
            ) {

                return;
            }


            $("excavatorDriverSection")
                ?.classList
                .remove(
                    "hidden"
                );


            const total =
                excavatorDriverAssignments.length;


            const complete =
                excavatorDriverAssignments
                    .filter(
                        item =>
                            item.driverId
                    )
                    .length;


            setText(
                "excavatorDriverStatus",
                `${complete} / ${total}`
            );


            if (
                !total
            ) {

                box.innerHTML =
                    '<div class="empty-placeholder">请先绑定挖机和汽车</div>';

                return;
            }


            const people =
                getApprovedExcavatorDrivers();


            box.innerHTML =
                excavatorDriverAssignments
                    .map(
                        assignment => {

                            const options =
                                people.map(
                                    person => {

                                        const state =
                                            getExcavatorDriverDraftStatus(
                                                person
                                            );


                                        const alreadyUsed =
                                            excavatorDriverAssignments
                                                .some(
                                                    item =>

                                                        item.driverId ===
                                                            person.driverId

                                                        &&

                                                        item.excavatorId !==
                                                            assignment.excavatorId
                                                );


                                        const disabled =

                                            state.code ===
                                                "leave"

                                            ||

                                            state.code ===
                                                "working"

                                            ||

                                            state.code ===
                                                "disabled"

                                            ||

                                            alreadyUsed;


                                        return `

                                        <option
                                            value="${escapeHtml(person.driverId)}"

                                            ${
                                                assignment.driverId ===
                                                person.driverId
                                                    ? "selected"
                                                    : ""
                                            }

                                            ${
                                                disabled
                                                    ? "disabled"
                                                    : ""
                                            }
                                        >

                                            ${escapeHtml(person.name || "-")}

                                            ·

                                            ${escapeHtml(person.team || "-")}

                                            ·

                                            ${
                                                alreadyUsed
                                                    ? "本任务已分配"
                                                    : escapeHtml(state.label)
                                            }

                                        </option>
                                        `;
                                    }
                                )
                                    .join(
                                        ""
                                    );


                            return `

                            <div class="driver-assignment-row">

                                <div class="assignment-equipment">

                                    <strong>
                                        🚜 ${escapeHtml(assignment.excavatorId)}
                                    </strong>

                                    <span>
                                        指定挖机司机
                                    </span>

                                </div>


                                <select
                                    data-excavator-driver="${escapeHtml(assignment.excavatorId)}"
                                >

                                    <option value="">
                                        请选择挖机司机
                                    </option>

                                    ${options}

                                </select>

                            </div>
                            `;
                        }
                    )
                    .join(
                        ""
                    );


            box.querySelectorAll(
                "[data-excavator-driver]"
            )
                .forEach(
                    select => {

                        select.addEventListener(
                            "change",
                            function () {

                                assignExcavatorDriver(
                                    select.dataset
                                        .excavatorDriver,
                                    select.value
                                );
                            }
                        );
                    }
                );
        }

function ensureExcavatorDriverSection() {

            if (
                $("excavatorDriverSection")
            ) {

                return;
            }


            const driverSection =
                $("driverAssignmentSection");


            if (
                !driverSection
            ) {

                return;
            }


            const section =
                document.createElement(
                    "section"
                );


            section.id =
                "excavatorDriverSection";


            section.className =
                "dispatch-card hidden";


            section.innerHTML = `

                <div class="section-title">

                    <div>

                        <h2>
                            🚜 挖机司机分配
                        </h2>

                        <p>
                            为每台挖机指定挖机司机
                        </p>

                    </div>


                    <span
                        id="excavatorDriverStatus"
                        class="count-badge"
                    >
                        0 / 0
                    </span>

                </div>


                <div
                    id="excavatorDriverAssignmentList"
                >

                    <div class="empty-placeholder">
                        请先绑定挖机和汽车
                    </div>

                </div>
            `;


            driverSection.parentNode
                .insertBefore(
                    section,
                    driverSection
                );
        }

function getExcavatorDriverDraftStatus(
            person
        ) {

            return getPersonStatusForDraft(
                person
            );
        }

function assignExcavatorDriver(
            excavatorId,
            driverId
        ) {

            const assignment =
                excavatorDriverAssignments
                    .find(
                        item =>
                            item.excavatorId ===
                            excavatorId
                    );


            if (
                !assignment
            ) {

                return;
            }


            if (
                !driverId
            ) {

                assignment.driverId =
                    "";

                assignment.driverName =
                    "";

                assignment.team =
                    "";


                renderExcavatorDriverAssignments();

                return;
            }


            const person =
                getApprovedExcavatorDrivers()
                    .find(
                        item =>
                            item.driverId ===
                            driverId
                    );


            if (
                !person
            ) {

                return;
            }


            const duplicate =
                excavatorDriverAssignments.some(
                    item =>

                        item.driverId ===
                            driverId

                        &&

                        item.excavatorId !==
                            excavatorId
                );


            if (
                duplicate
            ) {

                alert(
                    "同一名挖机司机不能同时操作两台挖机。"
                );


                renderExcavatorDriverAssignments();

                return;
            }


            const state =
                getExcavatorDriverDraftStatus(
                    person
                );


            if (
                state.code ===
                    "leave"
            ) {

                alert(
                    person.name +
                    " 本班请假。"
                );


                renderExcavatorDriverAssignments();

                return;
            }


            if (
                state.code ===
                    "working"
            ) {

                alert(
                    person.name +
                    " 已在其他生产任务中。"
                );


                renderExcavatorDriverAssignments();

                return;
            }


            assignment.driverId =
                person.driverId;


            assignment.driverName =
                person.name ||
                "";


            assignment.team =
                person.team ||
                "";


            renderExcavatorDriverAssignments();
        }

function renderAuxiliaryVehicles() {

            const type =
                $("auxiliaryTypeSelect")
                    ?.value ||
                "";


            const select =
                $("auxiliaryVehicleSelect");


            if (
                !select
            ) {

                return;
            }


            select.innerHTML =
                '<option value="">选择车辆</option>';


            if (
                !type ||
                !equipment[type]
            ) {

                return;
            }


            const occupied =
                getOccupiedEquipmentIds();


            equipment[type]
                .forEach(
                    vehicle => {

                        const option =
                            document.createElement(
                                "option"
                            );


                        option.value =
                            vehicle.id;


                        const draftUsed =
                            auxiliaryAssignments
                                .some(
                                    item =>
                                        item.vehicleId ===
                                        vehicle.id
                                );


                        const unavailable =

                            !isEquipmentDispatchable(
                                vehicle
                            )

                            ||

                            occupied.has(
                                vehicle.id
                            )

                            ||

                            draftUsed;


                        option.disabled =
                            unavailable;


                        option.textContent =
                            vehicle.id +
                            (
                                unavailable
                                    ? `（${equipmentStateLabel(vehicle)}）`
                                    : ""
                            );


                        select.appendChild(
                            option
                        );
                    }
                );
        }

function renderAuxiliaryAssignments() {

            const box =
                $("auxiliaryAssignmentList");


            if (
                !box
            ) {

                return;
            }


            if (
                !auxiliaryAssignments.length
            ) {

                box.innerHTML =
                    '<div class="empty-placeholder">暂无辅助车辆</div>';

                return;
            }


            box.innerHTML =
                auxiliaryAssignments.map(
                    (
                        item,
                        index
                    ) => `

                    <div class="binding-row">

                        <div>

                            <strong>
                                ${escapeHtml(item.vehicleId)}
                            </strong>

                            <span>
                                ${escapeHtml(item.work)}
                            </span>

                        </div>


                        <button
                            type="button"
                            class="mini-danger-button"
                            data-remove-aux="${index}"
                        >
                            删除
                        </button>

                    </div>
                    `
                )
                    .join(
                        ""
                    );


            box.querySelectorAll(
                "[data-remove-aux]"
            )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            function () {

                                auxiliaryAssignments.splice(
                                    Number(
                                        button.dataset
                                            .removeAux
                                    ),
                                    1
                                );


                                renderAuxiliaryAssignments();

                                renderAuxiliaryVehicles();
                            }
                        );
                    }
                );
        }

function rejectVehicleChange(
            requestId
        ) {

            const reason =
                prompt(
                    "请输入驳回原因："
                );


            if (
                reason ===
                null
            ) {

                return;
            }


            const records =
                getChangeRequests();


            const record =
                records.find(
                    item =>
                        item.requestId ===
                        requestId
                );


            if (
                !record
            ) {

                return;
            }


            record.status =
                "rejected";


            record.rejectReason =
                reason.trim();


            record.rejectedAt =
                new Date()
                    .toISOString();


            record.rejectedBy =
                "调度端";


            saveChangeRequests(
                records
            );


            renderVehicleChanges();

            refreshAll();
        }

function hideModal(
            id
        ) {

            $(id)
                ?.classList
                .add(
                    "hidden"
                );


            document.body
                .classList
                .remove(
                    "modal-open"
                );
        }

function openGpsReview() {

            renderGpsReview();


            showModal(
                "gpsReviewModal"
            );
        }

function renderGpsReview() {

            const records =
                getTrips()
                    .filter(
                        trip =>

                            trip.gpsStatus !==
                                "正常"

                            &&

                            trip.gpsStatus !==
                                "normal"

                            &&

                            trip.dispatchConfirmation !==
                                "confirmed"

                            &&

                            trip.dispatchConfirmation !==
                                "rejected"
                    );


            const box =
                $("gpsReviewList");


            if (
                !box
            ) {

                return;
            }


            if (
                !records.length
            ) {

                box.innerHTML =
                    '<div class="empty-placeholder">暂无GPS异常待审核</div>';

                return;
            }


            box.innerHTML =
                records.map(
                    record => `

                    <div class="approval-card">

                        <div class="approval-title">

                            <strong>
                                ${escapeHtml(record.driverName || "-")}
                            </strong>

                            <span>
                                ${escapeHtml(record.vehicleNumber || "-")}
                            </span>

                        </div>


                        <div class="approval-note">

                            GPS：
                            ${escapeHtml(record.gpsStatus || "异常")}

                            ·

                            ${
                                record.gpsAccuracy
                                    ? "±" +
                                        Math.round(record.gpsAccuracy) +
                                        "米"
                                    : "无定位"
                            }

                        </div>


                        <div class="approval-buttons">

                            <button
                                type="button"
                                class="success-button"
                                data-gps-confirm="${escapeHtml(getTripId(record))}"
                            >
                                确认有效
                            </button>

                            <button
                                type="button"
                                class="danger-button"
                                data-gps-reject="${escapeHtml(getTripId(record))}"
                            >
                                判定无效
                            </button>

                        </div>

                    </div>
                    `
                )
                    .join(
                        ""
                    );


            box.querySelectorAll(
                "[data-gps-confirm]"
            )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            () =>
                                reviewGpsTrip(
                                    button.dataset
                                        .gpsConfirm,
                                    true
                                )
                        );
                    }
                );


            box.querySelectorAll(
                "[data-gps-reject]"
            )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            () =>
                                reviewGpsTrip(
                                    button.dataset
                                        .gpsReject,
                                    false
                                )
                        );
                    }
                );
        }

function getTripId(
            item
        ) {

            return (

                item.tripId ||

                item.id ||

                ""
            );
        }

function reviewGpsTrip(
            tripId,
            approved
        ) {

            const remark =
                prompt(
                    approved
                        ? "确认备注（可空）："
                        : "请输入无效原因："
                );


            if (
                remark ===
                null
            ) {

                return;
            }


            const trips =
                getTrips();


            const record =
                trips.find(
                    item =>
                        getTripId(
                            item
                        ) ===
                        tripId
                );


            if (
                !record
            ) {

                return;
            }


            record.dispatchConfirmation =
                approved
                    ? "confirmed"
                    : "rejected";


            record.officialCountEligible =
                approved;


            record.dispatchReviewedAt =
                new Date()
                    .toISOString();


            record.dispatchReviewedBy =
                "调度端";


            record.dispatchReviewNote =
                remark.trim();


            saveTrips(
                trips
            );


            renderGpsReview();

            refreshAll();
        }

function saveTrips(
            data
        ) {

            localStorage.setItem(
                STORAGE.TRIPS,
                JSON.stringify(
                    data
                )
            );
        }

function openLeaveReview() {

            renderLeaveReview();


            showModal(
                "leaveReviewModal"
            );
        }

function renderLeaveReview() {

            const requests =
                getLeaves()
                    .filter(
                        item =>

                            item.status ===
                                "pending"

                            &&

                            item.approverRole ===
                                "dispatch"
                    );


            const box =
                $("leaveReviewList");


            if (
                !box
            ) {

                return;
            }


            if (
                !requests.length
            ) {

                box.innerHTML =
                    '<div class="empty-placeholder">暂无一线人员请假待审批</div>';

                return;
            }


            box.innerHTML =
                requests.map(
                    item => `

                    <div class="approval-card">

                        <div class="approval-title">

                            <strong>
                                ${escapeHtml(item.applicantName || item.personName || "-")}
                            </strong>

                            <span>
                                ${escapeHtml(item.leaveType || "请假")}
                            </span>

                        </div>


                        <div class="approval-note">

                            ${formatDateTime(item.startTime || item.startAt)}

                            →

                            ${formatDateTime(item.endTime || item.endAt)}

                            <br>

                            ${escapeHtml(item.reason || "-")}

                        </div>


                        <div class="approval-buttons">

                            <button
                                type="button"
                                class="success-button"
                                data-leave-approve="${escapeHtml(item.leaveId)}"
                            >
                                批准
                            </button>

                            <button
                                type="button"
                                class="danger-button"
                                data-leave-reject="${escapeHtml(item.leaveId)}"
                            >
                                驳回
                            </button>

                        </div>

                    </div>
                    `
                )
                    .join(
                        ""
                    );


            box.querySelectorAll(
                "[data-leave-approve]"
            )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            () =>
                                reviewDriverLeave(
                                    button.dataset
                                        .leaveApprove,
                                    true
                                )
                        );
                    }
                );


            box.querySelectorAll(
                "[data-leave-reject]"
            )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            () =>
                                reviewDriverLeave(
                                    button.dataset
                                        .leaveReject,
                                    false
                                )
                        );
                    }
                );
        }

function formatDateTime(
            value
        ) {

            if (
                !value
            ) {

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

function reviewDriverLeave(
            leaveId,
            approved
        ) {

            const note =
                prompt(
                    approved
                        ? "审批备注（可空）："
                        : "请输入驳回原因："
                );


            if (
                note ===
                null
            ) {

                return;
            }


            const records =
                getLeaves();


            const item =
                records.find(
                    record =>
                        record.leaveId ===
                        leaveId
                );


            if (
                !item
            ) {

                return;
            }


            item.status =
                approved
                    ? "approved"
                    : "rejected";


            item.approvedBy =
                "调度端";


            item.approvedAt =
                new Date()
                    .toISOString();


            item.reviewedBy =
                "调度端";


            item.reviewedAt =
                item.approvedAt;


            item.approvalRemark =
                note.trim();


            item.reviewRemark =
                note.trim();


            saveLeaves(
                records
            );


            syncLeaveRequestToDataService(
                item,
                approved
                    ? "调度批准请假"
                    : "调度驳回请假"
            );


            renderLeaveReview();

            refreshAll();
        }

function saveLeaves(
            records
        ) {

            localStorage.setItem(
                STORAGE.LEAVES,
                JSON.stringify(
                    records
                )
            );
        }

function syncLeaveRequestToDataService(
            record,
            label
        ) {

            if (
                !window.MineDataService ||
                !record?.leaveId
            ) {

                return;
            }


            Promise.resolve(
                window.MineDataService.upsert(
                    "leave_requests",
                    record
                )
            )
            .catch(
                error => {

                    console.warn(
                        "DataService " +
                        (label || "请假记录") +
                        " 同步失败，原调度请假流程已保留：",
                        error
                    );
                }
            );
        }

function openMyLeave() {

            const currentId =
                localStorage.getItem(
                    "currentPersonId"
                );


            const person =
                getPersonnelRecords()
                    .find(
                        item =>

                            getPersonId(
                                item
                            ) ===
                                currentId

                            &&

                            normalizePosition(
                                item.position
                            ) ===
                                "车队长"
                    );


            const profile =
                person ||
                readJson(
                    STORAGE.DISPATCH_PROFILE,
                    null
                );


            if (
                profile
            ) {

                if (
                    $("leaveApplicantName")
                ) {

                    $("leaveApplicantName").value =
                        profile.name ||
                        "";
                }


                if (
                    $("leaveApplicantPosition")
                ) {

                    $("leaveApplicantPosition").value =
                        normalizePosition(
                            profile.position ||
                            "车队长"
                        );
                }
            }


            showModal(
                "myLeaveModal"
            );
        }

function submitMyLeave() {

            const name =
                $("leaveApplicantName")
                    ?.value
                    .trim() ||
                "";


            const position =
                $("leaveApplicantPosition")
                    ?.value
                    .trim() ||
                "车队长";


            const start =
                $("leaveStart")
                    ?.value ||
                "";


            const end =
                $("leaveEnd")
                    ?.value ||
                "";


            const reason =
                $("leaveReason")
                    ?.value
                    .trim() ||
                "";


            if (
                !name ||
                !start ||
                !end ||
                !reason
            ) {

                alert(
                    "请完整填写请假申请。"
                );

                return;
            }


            if (
                new Date(
                    end
                ) <=
                new Date(
                    start
                )
            ) {

                alert(
                    "结束时间必须晚于开始时间。"
                );

                return;
            }


            const currentPersonId =
                localStorage.getItem(
                    "currentPersonId"
                ) ||
                createId(
                    "MANAGEMENT"
                );


            const records =
                getLeaves();


            records.push({

                leaveId:
                    createId(
                        "LEAVE"
                    ),

                applicantId:
                    currentPersonId,

                personId:
                    currentPersonId,

                applicantName:
                    name,

                personName:
                    name,

                role:
                    "management",

                position:
                    normalizePosition(
                        position
                    ),

                team:
                    "管理人员",

                leaveType:
                    $("leaveType")
                        ?.value ||
                    "事假",

                startTime:
                    new Date(
                        start
                    )
                        .toISOString(),

                endTime:
                    new Date(
                        end
                    )
                        .toISOString(),

                reason,

                status:
                    "pending",

                approvalRoute:
                    "general_manager",

                approverRole:
                    "general_manager",

                submittedAt:
                    new Date()
                        .toISOString()
            });


            saveLeaves(
                records
            );


            hideModal(
                "myLeaveModal"
            );


            if (
                $("leaveStart")
            ) {
                $("leaveStart").value = "";
            }


            if (
                $("leaveEnd")
            ) {
                $("leaveEnd").value = "";
            }


            if (
                $("leaveReason")
            ) {
                $("leaveReason").value = "";
            }


            alert(
                "请假申请已提交总经理审批。"
            );
        }

function openPenalty() {

            populatePenaltyPersonnel();


            showModal(
                "penaltyModal"
            );
        }

function submitPenalty() {

            const select =
                $("penaltyPerson");


            if (
                !select ||
                !select.value
            ) {

                alert(
                    "请选择人员。"
                );

                return;
            }


            const option =
                select.options[
                    select.selectedIndex
                ];


            const description =
                $("penaltyDescription")
                    ?.value
                    .trim() ||
                "";


            if (
                !description
            ) {

                alert(
                    "请输入违规说明。"
                );

                return;
            }


            const records =
                getPenalties();


            records.push({

                penaltyId:
                    createId(
                        "PENALTY"
                    ),

                personId:
                    select.value,

                personName:
                    option.dataset.name ||
                    "",

                team:
                    option.dataset.team ||
                    "",

                vehicleNumber:
                    $("penaltyVehicle")
                        ?.value
                        .trim() ||
                    "",

                violationType:
                    $("penaltyType")
                        ?.value ||
                    "其他",

                amount:
                    Number(
                        $("penaltyAmount")
                            ?.value ||
                        0
                    ),

                points:
                    Number(
                        $("penaltyPoints")
                            ?.value ||
                        0
                    ),

                description,

                status:
                    "pending_acknowledgement",

                issuedBy:
                    "调度端",

                issuedAt:
                    new Date()
                        .toISOString()
            });


            savePenalties(
                records
            );


            hideModal(
                "penaltyModal"
            );


            if (
                $("penaltyVehicle")
            ) {
                $("penaltyVehicle").value = "";
            }


            if (
                $("penaltyAmount")
            ) {
                $("penaltyAmount").value = "";
            }


            if (
                $("penaltyPoints")
            ) {
                $("penaltyPoints").value = "";
            }


            if (
                $("penaltyDescription")
            ) {
                $("penaltyDescription").value = "";
            }


            refreshAll();


            alert(
                "罚单已下达。"
            );
        }

function savePenalties(
            records
        ) {

            localStorage.setItem(
                STORAGE.PENALTIES,
                JSON.stringify(
                    records
                )
            );
        }

function openPenaltyManager() {

            renderPenaltyManager();


            showModal(
                "penaltyManagerModal"
            );
        }

function renderPenaltyManager() {

            const records =
                getPenalties()
                    .slice()
                    .reverse();


            const box =
                $("penaltyManagerList");


            if (
                !box
            ) {

                return;
            }


            if (
                !records.length
            ) {

                box.innerHTML =
                    '<div class="empty-placeholder">暂无罚单记录</div>';

                return;
            }


            box.innerHTML =
                records.map(
                    item => `

                    <div class="approval-card">

                        <div class="approval-title">

                            <strong>
                                ${escapeHtml(item.personName || "-")}
                            </strong>

                            <span>
                                ${
                                    item.status ===
                                    "acknowledged"
                                        ? "已知晓"
                                        : item.status ===
                                            "processed"
                                            ? "已处理"
                                            : "待确认"
                                }
                            </span>

                        </div>


                        <div class="approval-note">

                            ${escapeHtml(item.violationType || "-")}

                            ·

                            ${escapeHtml(item.description || "-")}

                        </div>


                        <div class="approval-detail-grid">

                            <div>

                                <span>
                                    金额
                                </span>

                                <strong>
                                    ¥${Number(item.amount || 0)}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    扣分
                                </span>

                                <strong>
                                    ${Number(item.points || 0)}
                                </strong>

                            </div>

                        </div>

                    </div>
                    `
                )
                    .join(
                        ""
                    );
        }
$("openVehicleChangeButton")
                ?.addEventListener(
                    "click",
                    openVehicleChanges
                );
$("closeVehicleChangeModal")
                ?.addEventListener(
                    "click",
                    () =>
                        hideModal(
                            "vehicleChangeModal"
                        )
                );
$("openGpsReviewButton")
                ?.addEventListener(
                    "click",
                    openGpsReview
                );
$("closeGpsReviewModal")
                ?.addEventListener(
                    "click",
                    () =>
                        hideModal(
                            "gpsReviewModal"
                        )
                );
$("openLeaveReviewButton")
                ?.addEventListener(
                    "click",
                    openLeaveReview
                );
$("closeLeaveReviewModal")
                ?.addEventListener(
                    "click",
                    () =>
                        hideModal(
                            "leaveReviewModal"
                        )
                );
$("myLeaveButton")
                ?.addEventListener(
                    "click",
                    openMyLeave
                );
$("closeMyLeaveModal")
                ?.addEventListener(
                    "click",
                    () =>
                        hideModal(
                            "myLeaveModal"
                        )
                );
$("submitMyLeaveButton")
                ?.addEventListener(
                    "click",
                    submitMyLeave
                );
$("issuePenaltyButton")
                ?.addEventListener(
                    "click",
                    openPenalty
                );
$("closePenaltyModal")
                ?.addEventListener(
                    "click",
                    () =>
                        hideModal(
                            "penaltyModal"
                        )
                );
$("submitPenaltyButton")
                ?.addEventListener(
                    "click",
                    submitPenalty
                );
$("openPenaltyManagerButton")
                ?.addEventListener(
                    "click",
                    openPenaltyManager
                );
$("closePenaltyManagerModal")
                ?.addEventListener(
                    "click",
                    () =>
                        hideModal(
                            "penaltyManagerModal"
                        )
                );
function refreshSupport(){renderTodoCounts();populatePenaltyPersonnel();}
refreshSupport();setInterval(refreshSupport,5000);
});

"use strict";

const MAINTENANCE_REQUEST_KEY =
    "maintenanceRequests";

function getMaintenanceRequestsForDispatch() {

    try {

        const raw =
            localStorage.getItem(
                MAINTENANCE_REQUEST_KEY
            );


        if (
            !raw
        ) {

            return [];
        }


        const data =
            JSON.parse(
                raw
            );


        return Array.isArray(
            data
        )
            ? data
            : [];

    } catch (
        error
    ) {

        console.error(
            "读取维修申请失败：",
            error
        );


        return [];
    }
}

function saveMaintenanceRequestsForDispatch(
    records
) {

    localStorage.setItem(
        MAINTENANCE_REQUEST_KEY,
        JSON.stringify(
            records
        )
    );
}

function getMaintenanceRequestIdForDispatch(
    item
) {

    return String(

        item?.requestId ||

        item?.maintenanceRequestId ||

        item?.reportId ||

        item?.id ||

        ""
    );
}

function isPendingMaintenanceDispatch(
    item
) {

    return (

        item?.dispatchRequired !==
            false

        &&

        (
            item?.dispatchStatus ===
                "pending"

            ||

            item?.status ===
                "pending_dispatch"
        )
    );
}

function getPendingMaintenanceRequests() {

    return getMaintenanceRequestsForDispatch()
        .filter(
            isPendingMaintenanceDispatch
        )
        .sort(
            (
                a,
                b
            ) =>

                new Date(
                    a.createdAt ||
                    a.reportedAt ||
                    0
                ) -

                new Date(
                    b.createdAt ||
                    b.reportedAt ||
                    0
                )
        );
}

function refreshMaintenanceReviewTodo() {

    const count =
        getPendingMaintenanceRequests()
            .length;


    const element =
        document.getElementById(
            "maintenanceReviewTodoCount"
        );


    if (
        element
    ) {

        element.textContent =
            String(
                count
            );
    }
}

function openMaintenanceReviewModal() {

    renderMaintenanceReviewList();


    document
        .getElementById(
            "maintenanceReviewModal"
        )
        ?.classList
        .remove(
            "hidden"
        );
}

function closeMaintenanceReviewModal() {

    document
        .getElementById(
            "maintenanceReviewModal"
        )
        ?.classList
        .add(
            "hidden"
        );
}

function renderMaintenanceReviewList() {

    const box =
        document.getElementById(
            "maintenanceReviewList"
        );


    if (
        !box
    ) {

        return;
    }


    const records =
        getPendingMaintenanceRequests();


    if (
        !records.length
    ) {

        box.innerHTML = `

            <div class="maintenance-review-empty">

                当前没有待调度审批的维修申请。

            </div>
        `;


        refreshMaintenanceReviewTodo();


        return;
    }


    box.innerHTML =
        records
            .map(
                item => {

                    const requestId =
                        getMaintenanceRequestIdForDispatch(
                            item
                        );


                    const equipmentType =
                        item.equipmentType ||
                        item.vehicleType ||
                        "生产设备";


                    const equipmentNumber =
                        item.equipmentNumber ||
                        item.vehicleNumber ||
                        item.equipmentId ||
                        "-";


                    const applicantName =
                        item.applicantName ||
                        item.personName ||
                        item.driverName ||
                        "-";


                    const applicantPosition =
                        item.applicantPosition ||
                        item.position ||
                        "-";


                    const faultType =
                        item.faultType ||
                        "未填写";


                    const severity =
                        item.severity ||
                        item.faultLevel ||
                        item.level ||
                        "未填写";


                    const description =
                        item.description ||
                        item.faultDescription ||
                        item.remark ||
                        "未填写故障说明";


                    const canMove =
                        item.canMove;


                    const canMoveText =
                        canMove === true
                            ? "可以自行移动"
                            : (
                                canMove === false
                                    ? "不能自行移动"
                                    : "未填写"
                            );


                    const photo =
                        item.photoData ||
                        item.photo ||
                        item.imageData ||
                        "";


                    return `

                        <div class="maintenance-review-card">

                            <div class="maintenance-review-top">

                                <strong>
                                    ${escapeMaintenanceHtml(equipmentType)}
                                    ·
                                    ${escapeMaintenanceHtml(equipmentNumber)}
                                </strong>


                                <span class="maintenance-status-badge">
                                    待调度审批
                                </span>

                            </div>


                            <div class="maintenance-review-info">

                                申请人：
                                ${escapeMaintenanceHtml(applicantName)}
                                （${escapeMaintenanceHtml(applicantPosition)}）

                                <br>

                                故障类型：
                                ${escapeMaintenanceHtml(faultType)}

                                <br>

                                故障等级：
                                ${escapeMaintenanceHtml(severity)}

                                <br>

                                车辆状态：
                                ${escapeMaintenanceHtml(canMoveText)}

                                <br>

                                故障说明：
                                ${escapeMaintenanceHtml(description)}

                                <br>

                                申请时间：
                                ${escapeMaintenanceHtml(
                                    formatMaintenanceDateTime(
                                        item.createdAt ||
                                        item.reportedAt
                                    )
                                )}

                            </div>


                            ${
                                photo
                                    ? `
                                        <img
                                            class="maintenance-review-photo"
                                            src="${escapeMaintenanceAttribute(photo)}"
                                            alt="故障现场照片"
                                        >
                                    `
                                    : ""
                            }


                            <div class="maintenance-review-actions">

                                <button
                                    type="button"
                                    class="success-button"
                                    onclick="approveMaintenanceEntry('${escapeMaintenanceJs(requestId)}')"
                                >
                                    ✅ 批准进厂
                                </button>


                                <button
                                    type="button"
                                    class="danger-button"
                                    onclick="rejectMaintenanceEntry('${escapeMaintenanceJs(requestId)}')"
                                >
                                    ❌ 驳回申请
                                </button>

                            </div>

                        </div>
                    `;
                }
            )
            .join(
                ""
            );


    refreshMaintenanceReviewTodo();
}

function approveMaintenanceEntry(
    requestId
) {

    const records =
        getMaintenanceRequestsForDispatch();


    const item =
        records.find(
            record =>
                getMaintenanceRequestIdForDispatch(
                    record
                ) ===
                String(
                    requestId
                )
        );


    if (
        !item
    ) {

        alert(
            "没有找到该维修申请。"
        );

        return;
    }


    if (
        !confirm(
            "确认批准该设备进入修理厂？"
        )
    ) {

        return;
    }


    const now =
        new Date()
            .toISOString();


    item.dispatchRequired =
        true;


    item.dispatchStatus =
        "approved";


    item.status =
        "waiting_entry";


    item.dispatchApprovedAt =
        now;


    item.updatedAt =
        now;


    /*
     * 当前 V2.x 本机版暂不强制识别调度本人姓名。
     * 后续 Supabase V3.0 再写入真实审批人员账号。
     */
    item.dispatchApprovedBy =
        "车队长 / 调度";


    saveMaintenanceRequestsForDispatch(
        records
    );


    renderMaintenanceReviewList();


    alert(
        "已批准进厂。该申请现在进入“待进厂”，维修管理可以接车。"
    );
}

function buildMaintenanceRejectionWrites(requests, request, updatedAt) {

    const writes = [];
    const equipmentId = String(
        request?.equipmentId ||
        request?.equipmentNumber ||
        request?.vehicleId ||
        request?.vehicleNumber ||
        ""
    );

    const operationalStatusKey = "equipmentOperationalStatus";
    const operationalRaw = localStorage.getItem(operationalStatusKey);
    let operationalRecords = [];

    if (operationalRaw) {
        try {
            operationalRecords = JSON.parse(operationalRaw);
        } catch (error) {
            return { ok: false, error: "设备状态数据无法读取，驳回未保存。" };
        }
        if (!Array.isArray(operationalRecords)) {
            return { ok: false, error: "设备状态数据格式异常，驳回未保存。" };
        }
    }

    if (equipmentId) {
        operationalRecords = JSON.parse(JSON.stringify(operationalRecords));
        let operationalRecord = operationalRecords.find(
            record => String(record?.equipmentId || "") === equipmentId
        );
        const restoreStatus =
            operationalRecord?.previousStatus &&
            !["maintenance", "service"].includes(operationalRecord.previousStatus)
                ? operationalRecord.previousStatus
                : "available";

        if (!operationalRecord) {
            operationalRecord = { equipmentId };
            operationalRecords.push(operationalRecord);
        }

        operationalRecord.status = restoreStatus;
        operationalRecord.source = "dispatch_rejection";
        operationalRecord.previousStatus = "";
        operationalRecord.updatedAt = updatedAt;

        writes.push({
            key: operationalStatusKey,
            value: JSON.stringify(operationalRecords)
        });

        const excludedKeys = new Set([
            operationalStatusKey,
            "equipmentMeterReadings",
            "equipmentMaintenanceSettings",
            "maintenanceAlerts",
            "equipmentMaintenanceRecords",
            "equipmentUsageChecks",
            "equipmentUsageRecords"
        ]);

        const masterSnapshots = [];
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (!key || excludedKeys.has(key) || !/equipment|vehicle|设备|车辆/i.test(key)) {
                continue;
            }

            const raw = localStorage.getItem(key);
            if (!raw) continue;

            let data;
            try {
                data = JSON.parse(raw);
            } catch (error) {
                continue;
            }

            const nextData = JSON.parse(JSON.stringify(data));
            const list = Array.isArray(nextData)
                ? nextData
                : (nextData && typeof nextData === "object" ? [nextData] : []);
            let changed = false;

            for (const record of list) {
                if (!record || typeof record !== "object") continue;
                const recordId = String(
                    record.equipmentNumber ||
                    record.vehicleNumber ||
                    record.equipmentId ||
                    record.vehicleId ||
                    record.number ||
                    ""
                );
                if (recordId !== equipmentId) continue;

                let recordChanged = false;
                if ("status" in record) {
                    record.status = restoreStatus;
                    recordChanged = true;
                }
                if ("equipmentStatus" in record) {
                    record.equipmentStatus = restoreStatus;
                    recordChanged = true;
                }
                if ("currentStatus" in record) {
                    const labels = {
                        available: "可用",
                        working: "作业中",
                        standby: "备用",
                        maintenance: "维修中",
                        service: "保养中",
                        disabled: "停用"
                    };
                    record.currentStatus = labels[restoreStatus] || restoreStatus;
                    recordChanged = true;
                }
                if (recordChanged) {
                    record.updatedAt = updatedAt;
                    changed = true;
                }
            }

            if (changed) {
                masterSnapshots.push({ key, value: JSON.stringify(nextData) });
            }
        }

        writes.push(...masterSnapshots);
    }

    writes.push({
        key: MAINTENANCE_REQUEST_KEY,
        value: JSON.stringify(requests)
    });

    const originalValues = new Map();
    for (const write of writes) {
        if (!originalValues.has(write.key)) {
            originalValues.set(write.key, localStorage.getItem(write.key));
        }
    }

    const appliedKeys = [];
    try {
        for (const write of writes) {
            localStorage.setItem(write.key, write.value);
            appliedKeys.push(write.key);
        }
        return { ok: true };
    } catch (error) {
        let rollbackFailed = false;
        for (const key of appliedKeys.reverse()) {
            try {
                const originalValue = originalValues.get(key);
                if (originalValue === null) localStorage.removeItem(key);
                else localStorage.setItem(key, originalValue);
            } catch (rollbackError) {
                rollbackFailed = true;
            }
        }
        return {
            ok: false,
            rollbackFailed,
            error: rollbackFailed
                ? "保存失败且本机数据回滚不完整，请立即检查设备和维修申请状态。"
                : "保存失败，已恢复原设备状态，驳回未保存。"
        };
    }
}

function rejectMaintenanceEntry(
    requestId
) {

    const reason =
        prompt(
            "请输入驳回原因："
        );


    if (
        reason ===
        null
    ) {

        return;
    }


    if (
        !reason.trim()
    ) {

        alert(
            "请填写驳回原因。"
        );

        return;
    }


    const records =
        getMaintenanceRequestsForDispatch();


    const item =
        records.find(
            record =>
                getMaintenanceRequestIdForDispatch(
                    record
                ) ===
                String(
                    requestId
                )
        );


    if (
        !item
    ) {

        alert(
            "没有找到该维修申请。"
        );

        return;
    }


    const now =
        new Date()
            .toISOString();


    const nextRecords =
        JSON.parse(
            JSON.stringify(
                records
            )
        );


    const nextItem =
        nextRecords.find(
            record =>
                getMaintenanceRequestIdForDispatch(
                    record
                ) ===
                String(
                    requestId
                )
        );


    nextItem.dispatchRequired =
        true;


    nextItem.dispatchStatus =
        "rejected";


    nextItem.status =
        "rejected";


    nextItem.dispatchRejectReason =
        reason.trim();


    nextItem.dispatchRejectedAt =
        now;


    nextItem.dispatchRejectedBy =
        "车队长 / 调度";


    nextItem.updatedAt =
        now;


    const result =
        buildMaintenanceRejectionWrites(
            nextRecords,
            nextItem,
            now
        );


    if (!result.ok) {
        alert(result.error);
        return;
    }


    renderMaintenanceReviewList();


    alert(
        "该维修申请已驳回，设备状态已恢复。"
    );
}

function formatMaintenanceDateTime(
    value
) {

    if (
        !value
    ) {

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
        "zh-CN"
    );
}

function escapeMaintenanceHtml(
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

function escapeMaintenanceAttribute(
    value
) {

    return escapeMaintenanceHtml(
        value
    )
        .replaceAll(
            '"',
            "&quot;"
        );
}

function escapeMaintenanceJs(
    value
) {

    return String(
        value ??
        ""
    )
        .replaceAll(
            "\\",
            "\\\\"
        )
        .replaceAll(
            "'",
            "\\'"
        )
        .replaceAll(
            "\n",
            "\\n"
        )
        .replaceAll(
            "\r",
            "\\r"
        );
}

document
    .getElementById(
        "openMaintenanceReviewButton"
    )
    ?.addEventListener(
        "click",
        openMaintenanceReviewModal
    );

document
    .getElementById(
        "closeMaintenanceReviewModal"
    )
    ?.addEventListener(
        "click",
        closeMaintenanceReviewModal
    );

document
    .getElementById(
        "maintenanceReviewModal"
    )
    ?.addEventListener(
        "click",
        function (
            event
        ) {

            if (
                event.target ===
                this
            ) {

                closeMaintenanceReviewModal();
            }
        }
    );

refreshMaintenanceReviewTodo();

setInterval(
    refreshMaintenanceReviewTodo,
    5000
);

function dispatchReadArraySafe(
    key
) {

    try {

        const value =
            JSON.parse(
                localStorage.getItem(
                    key
                )
            );


        return Array.isArray(
            value
        )
            ? value
            : [];

    } catch (
        error
    ) {

        return [];
    }
}

function dispatchAuxiliaryCompletionRecords() {

    const auxiliary =
        dispatchReadArraySafe(
            "auxiliaryWorkRecords"
        )
        .filter(
            item =>
                item &&
                (
                    item.status ===
                        "completed"
                    ||
                    item.completedAt
                )
        )
        .map(
            item => ({
                type:
                    "辅助车辆",

                recordId:
                    item.workRecordId ||
                    item.recordId ||
                    item.id ||
                    "",

                taskId:
                    item.taskId ||
                    item.dispatchTaskId ||
                    "",

                person:
                    item.personName ||
                    item.driverName ||
                    item.position ||
                    "-",

                position:
                    item.position ||
                    item.vehicleType ||
                    "辅助车辆",

                vehicle:
                    item.vehicleNumber ||
                    item.vehicleId ||
                    "-",

                work:
                    item.work ||
                    item.workContent ||
                    item.remark ||
                    "-",

                completedAt:
                    item.completedAt ||
                    item.updatedAt ||
                    item.createdAt ||
                    ""
            })
        );


    const fuel =
        dispatchReadArraySafe(
            "fuelRecords"
        )
        .filter(
            item =>
                item &&
                (
                    item.completedAt ||
                    item.createdAt
                )
        )
        .map(
            item => ({
                type:
                    "加油",

                recordId:
                    item.fuelId ||
                    item.recordId ||
                    item.id ||
                    "",

                taskId:
                    item.requestId ||
                    item.taskId ||
                    "",

                person:
                    item.driverName ||
                    item.personName ||
                    "加油车司机",

                position:
                    "加油车司机",

                vehicle:
                    item.vehicleNumber ||
                    item.vehicleId ||
                    "-",

                work:
                    "完成加油 " +
                    Number(
                        item.amount ||
                        item.quantity ||
                        0
                    )
                    .toFixed(
                        1
                    ) +
                    " L",

                completedAt:
                    item.completedAt ||
                    item.createdAt ||
                    ""
            })
        );


    return [
        ...auxiliary,
        ...fuel
    ]
    .sort(
        (
            a,
            b
        ) =>
            new Date(
                b.completedAt ||
                0
            )
            -
            new Date(
                a.completedAt ||
                0
            )
    )
    .slice(
        0,
        20
    );
}

function renderAuxiliaryCompletionFeedback() {

    const box =
        document.getElementById(
            "auxiliaryCompletionList"
        );


    const badge =
        document.getElementById(
            "auxiliaryCompletionCount"
        );


    if (
        !box ||
        !badge
    ) {

        return;
    }


    const records =
        dispatchAuxiliaryCompletionRecords();


    badge.textContent =
        String(
            records.length
        ) +
        " 条";


    if (
        !records.length
    ) {

        box.innerHTML = `
            <div class="empty-placeholder">
                暂无辅助车辆完成记录
            </div>
        `;


        return;
    }


    box.innerHTML =
        records
            .map(
                item => `
                    <div
                        class="record-card"
                        style="margin-bottom:10px;"
                    >
                        <div class="record-top">
                            <strong>
                                ${escapeMaintenanceHtml(item.position)}
                                ·
                                ${escapeMaintenanceHtml(item.vehicle)}
                            </strong>

                            <span class="count-badge">
                                ${escapeMaintenanceHtml(item.type)}
                            </span>
                        </div>

                        <div
                            class="record-info"
                            style="margin-top:8px;"
                        >
                            任务：
                            ${escapeMaintenanceHtml(item.taskId || "-")}
                            <br>

                            作业：
                            ${escapeMaintenanceHtml(item.work || "-")}
                            <br>

                            完成人：
                            ${escapeMaintenanceHtml(item.person || "-")}
                            <br>

                            完成时间：
                            ${formatMaintenanceDateTime(item.completedAt)}
                        </div>
                    </div>
                `
            )
            .join(
                ""
            );
}

renderAuxiliaryCompletionFeedback();

setInterval(
    renderAuxiliaryCompletionFeedback,
    5000
);

window.addEventListener(
    "storage",
    event => {

        if (
            event.key ===
                "auxiliaryWorkRecords"
            ||
            event.key ===
                "fuelRecords"
        ) {

            renderAuxiliaryCompletionFeedback();
        }
    }
);

const TRANSPORT_ZONE_KEY =
    "transportZones";

let currentTransportZoneLocation =
    null;

function readTransportZones() {

    try {

        const data =
            JSON.parse(
                localStorage.getItem(
                    TRANSPORT_ZONE_KEY
                )
            );


        return Array.isArray(
            data
        )
            ? data
            : [];

    } catch (
        error
    ) {

        console.error(
            "读取运输区域失败：",
            error
        );


        return [];
    }
}

function saveTransportZones(
    zones
) {

    localStorage.setItem(
        TRANSPORT_ZONE_KEY,
        JSON.stringify(
            zones
        )
    );
}

function createTransportZoneId() {

    return (
        "ZONE_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .slice(2, 8)
    );
}

function openTransportZoneModal() {

    renderTransportZoneList();



    document
        .getElementById(
            "transportZoneModal"
        )
        ?.classList
        .remove(
            "hidden"
        );
}

function closeTransportZoneModalFn() {

    document
        .getElementById(
            "transportZoneModal"
        )
        ?.classList
        .add(
            "hidden"
        );
}

function toggleZoneMaterialField() {

    const type =
        document
            .getElementById(
                "zoneType"
            )
            ?.value;


    const field =
        document
            .getElementById(
                "zoneMaterialField"
            );


    if (
        field
    ) {

        field.style.display =
            type === "unloading"
                ? ""
                : "none";
    }


    if (
        type !== "unloading"
    ) {

        const material =
            document
                .getElementById(
                    "zoneMaterialType"
                );


        if (
            material
        ) {

            material.value =
                "";
        }
    }
}

function captureTransportZoneLocation() {

    if (
        !navigator.geolocation
    ) {

        alert(
            "当前浏览器不支持 GPS 定位。"
        );

        return;
    }


    const button =
        document
            .getElementById(
                "captureZoneLocationButton"
            );


    if (
        button
    ) {

        button.disabled =
            true;

        button.textContent =
            "正在获取定位…";
    }


    navigator.geolocation
        .getCurrentPosition(

            position => {

                currentTransportZoneLocation = {

                    latitude:
                        Number(
                            position.coords.latitude
                        ),

                    longitude:
                        Number(
                            position.coords.longitude
                        ),

                    accuracy:
                        Number(
                            position.coords.accuracy ||
                            0
                        ),

                    capturedAt:
                        new Date()
                            .toISOString()
                };


                document
                    .getElementById(
                        "zoneLatitude"
                    )
                    .textContent =
                        currentTransportZoneLocation
                            .latitude
                            .toFixed(
                                6
                            );


                document
                    .getElementById(
                        "zoneLongitude"
                    )
                    .textContent =
                        currentTransportZoneLocation
                            .longitude
                            .toFixed(
                                6
                            );


                document
                    .getElementById(
                        "zoneGpsAccuracy"
                    )
                    .textContent =
                        currentTransportZoneLocation
                            .accuracy
                            .toFixed(
                                1
                            ) +
                        " m";


                document
                    .getElementById(
                        "zoneGpsTime"
                    )
                    .textContent =
                        new Date(
                            currentTransportZoneLocation
                                .capturedAt
                        )
                            .toLocaleString(
                                "zh-CN"
                            );


                if (
                    button
                ) {

                    button.disabled =
                        false;

                    button.textContent =
                        "📍 重新获取当前位置";
                }

            },

            error => {

                console.error(
                    "区域定位失败：",
                    error
                );


                if (
                    button
                ) {

                    button.disabled =
                        false;

                    button.textContent =
                        "📍 获取当前位置作为区域中心";
                }


                alert(
                    "定位失败，请检查位置权限和手机 GPS 后重试。"
                );
            },

            {
                enableHighAccuracy:
                    true,

                timeout:
                    15000,

                maximumAge:
                    0
            }
        );
}

function saveTransportZone() {

    const name =
        document
            .getElementById(
                "zoneName"
            )
            ?.value
            .trim();


    const type =
        document
            .getElementById(
                "zoneType"
            )
            ?.value;


    const materialType =
        document
            .getElementById(
                "zoneMaterialType"
            )
            ?.value
            .trim()
        ||
        "";


    const radius =
        Number(
            document
                .getElementById(
                    "zoneRadius"
                )
                ?.value
            ||
            0
        );


    const remark =
        document
            .getElementById(
                "zoneRemark"
            )
            ?.value
            .trim()
        ||
        "";


    if (
        !name
    ) {

        alert(
            "请输入区域名称。"
        );

        return;
    }


    if (
        ![
            "loading",
            "unloading"
        ]
            .includes(
                type
            )
    ) {

        alert(
            "请选择正确的区域类型。"
        );

        return;
    }


    if (
        type === "unloading" &&
        !materialType
    ) {

        alert(
            "卸载区必须填写卸载物料类型。"
        );

        return;
    }


    if (
        radius <
        10
    ) {

        alert(
            "区域有效半径不能小于 10 米。"
        );

        return;
    }


    if (
        !currentTransportZoneLocation
    ) {

        alert(
            "请先到区域中心位置获取 GPS 定位。"
        );

        return;
    }


    const zones =
        readTransportZones();


    const duplicate =
        zones.some(
            item =>
                String(
                    item.name ||
                    ""
                )
                    .trim()
                    .toLowerCase()
                ===
                name
                    .toLowerCase()
        );


    if (
        duplicate
    ) {

        alert(
            "已经存在同名运输区域，请使用不同名称。"
        );

        return;
    }


    zones.push({

        zoneId:
            createTransportZoneId(),

        name,

        zoneType:
            type,

        materialType:
            type === "unloading"
                ? materialType
                : "",

        radius,

        latitude:
            currentTransportZoneLocation
                .latitude,

        longitude:
            currentTransportZoneLocation
                .longitude,

        gpsAccuracy:
            currentTransportZoneLocation
                .accuracy,

        remark,

        enabled:
            true,

        createdAt:
            new Date()
                .toISOString(),

        updatedAt:
            new Date()
                .toISOString()
    });


    saveTransportZones(
        zones
    );


    document
        .getElementById(
            "zoneName"
        )
        .value =
            "";


    document
        .getElementById(
            "zoneMaterialType"
        )
        .value =
            "";


    document
        .getElementById(
            "zoneRemark"
        )
        .value =
            "";


    currentTransportZoneLocation =
        null;


    [
        "zoneLatitude",
        "zoneLongitude",
        "zoneGpsAccuracy",
        "zoneGpsTime"
    ]
        .forEach(
            id => {

                const element =
                    document
                        .getElementById(
                            id
                        );


                if (
                    element
                ) {

                    element.textContent =
                        "-";
                }
            }
        );


    const captureButton =
        document
            .getElementById(
                "captureZoneLocationButton"
            );


    if (
        captureButton
    ) {

        captureButton.textContent =
            "📍 获取当前位置作为区域中心";
    }


    renderTransportZoneList();




    alert(
        "运输区域已保存。"
    );
}

function deleteTransportZone(
    zoneId
) {

    const zones =
        readTransportZones();


    const item =
        zones.find(
            zone =>
                String(
                    zone.zoneId
                ) ===
                String(
                    zoneId
                )
        );


    if (
        !item
    ) {

        return;
    }


    if (
        !confirm(
            "确认删除运输区域“" +
            (
                item.name ||
                ""
            ) +
            "”？"
        )
    ) {

        return;
    }


    saveTransportZones(
        zones.filter(
            zone =>
                String(
                    zone.zoneId
                ) !==
                String(
                    zoneId
                )
        )
    );


    renderTransportZoneList();


}

function renderTransportZoneList() {

    const box =
        document
            .getElementById(
                "transportZoneList"
            );


    if (
        !box
    ) {

        return;
    }


    const zones =
        readTransportZones();


    const count =
        document
            .getElementById(
                "transportZoneCount"
            );


    if (
        count
    ) {

        count.textContent =
            zones.length +
            " 个区域";
    }


    if (
        !zones.length
    ) {

        box.innerHTML = `
            <div class="zone-empty">
                暂无运输区域，请到区域中心位置后创建。
            </div>
        `;

        return;
    }


    box.innerHTML =
        zones
            .map(
                item => {

                    const isLoading =
                        item.zoneType ===
                        "loading";


                    return `
                        <div class="zone-list-card">

                            <div class="zone-list-top">

                                <div>
                                    <div class="zone-list-title">
                                        ${escapeTransportZoneHtml(item.name || "-")}
                                    </div>

                                    <div class="zone-list-info">
                                        ${
                                            isLoading
                                                ? "装载区不预设物料"
                                                : "卸载物料：" +
                                                  escapeTransportZoneHtml(
                                                      item.materialType ||
                                                      "-"
                                                  )
                                        }

                                        <br>

                                        半径：
                                        ${Number(item.radius || 0)} m

                                        · GPS精度：
                                        ${Number(item.gpsAccuracy || 0).toFixed(1)} m

                                        <br>

                                        坐标：
                                        ${Number(item.latitude || 0).toFixed(6)},
                                        ${Number(item.longitude || 0).toFixed(6)}
                                    </div>
                                </div>

                                <span class="zone-type-badge ${
                                    isLoading
                                        ? "zone-type-load"
                                        : "zone-type-unload"
                                }">
                                    ${
                                        isLoading
                                            ? "装载区"
                                            : "卸载区"
                                    }
                                </span>

                            </div>


                            <div class="maintenance-review-actions">

                                <button
                                    type="button"
                                    class="danger-button"
                                    onclick="deleteTransportZone('${escapeTransportZoneJs(item.zoneId)}')"
                                >
                                    删除
                                </button>

                            </div>

                        </div>
                    `;
                }
            )
            .join(
                ""
            );
}

function escapeTransportZoneHtml(
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

function escapeTransportZoneAttribute(
    value
) {

    return escapeTransportZoneHtml(
        value
    )
        .replaceAll(
            '"',
            "&quot;"
        );
}

function escapeTransportZoneJs(
    value
) {

    return String(
        value ??
        ""
    )
        .replaceAll(
            "\\",
            "\\\\"
        )
        .replaceAll(
            "'",
            "\\'"
        )
        .replaceAll(
            "\n",
            "\\n"
        )
        .replaceAll(
            "\r",
            "\\r"
        );
}

document
    .getElementById(
        "transportZoneButton"
    )
    ?.addEventListener(
        "click",
        openTransportZoneModal
    );

document
    .getElementById(
        "closeTransportZoneModal"
    )
    ?.addEventListener(
        "click",
        closeTransportZoneModalFn
    );

document
    .getElementById(
        "transportZoneModal"
    )
    ?.addEventListener(
        "click",
        function (
            event
        ) {

            if (
                event.target ===
                this
            ) {

                closeTransportZoneModalFn();
            }
        }
    );

document
    .getElementById(
        "zoneType"
    )
    ?.addEventListener(
        "change",
        toggleZoneMaterialField
    );

document
    .getElementById(
        "captureZoneLocationButton"
    )
    ?.addEventListener(
        "click",
        captureTransportZoneLocation
    );

document
    .getElementById(
        "saveTransportZoneButton"
    )
    ?.addEventListener(
        "click",
        saveTransportZone
    );

toggleZoneMaterialField();

renderTransportZoneList();

function dispatchReadTripArray(key){
    try{
        const data = JSON.parse(localStorage.getItem(key));
        return Array.isArray(data) ? data : [];
    }catch(error){
        return [];
    }
}

function dispatchTodayDateString(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
}

function dispatchLocalDateString(value){
    if(!value){
        return "";
    }

    /*
     * 本身就是 YYYY-MM-DD 的日期字段时，
     * 直接保留，避免时区再次转换。
     */
    const raw = String(value).trim();

    if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
        return raw;
    }

    const d = new Date(value);

    if(Number.isNaN(d.getTime())){
        return raw.slice(0,10);
    }

    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");

    return `${y}-${m}-${day}`;
}

function dispatchGetUnifiedTrips(){
    /*
     * 新版正式读取 tripRecords。
     * 若当前设备还没有 tripRecords，则兼容旧 driverTripRecords。
     * 避免双写阶段重复统计：优先使用 tripRecords。
     *
     * P0-9C：
     * 无论读取新版还是旧版，都按 tripId / recordId / id 去重，
     * 防止重复提交、重复写入导致正式趟数翻倍。
     */
    const canonical = dispatchReadTripArray("tripRecords");

    const source = canonical.length
        ? canonical
        : dispatchReadTripArray("driverTripRecords");

    const seen = new Set();

    return source.filter(item => {
        const id = window.ProductionBoardCore?.stableTripId(item) || "";

        if(!id){
            return true;
        }

        if(seen.has(id)){
            return false;
        }

        seen.add(id);
        return true;
    });
}

function dispatchIsValidTrip(item){
    return (
        item &&
        window.ProductionBoardCore?.hasStableTripId(item) &&
        item.status !== "cancelled" &&
        item.status !== "rejected" &&
        item.confirmationStatus !== "rejected" &&
        item.dispatchConfirmation !== "rejected" &&
        !/rejected/.test([item.gpsReviewStatus, item.reviewStatus].filter(Boolean).join(" ").toLowerCase()) &&
        !/pending/.test(String(item.gpsReviewStatus || item.reviewStatus || "").toLowerCase()) &&
        !(item.confirmationStatus === "pending" && (item.manualOverride === true || item.gpsStatus === "manual_override" || item.gpsReviewStatus === "pending")) &&
        !(item.dispatchConfirmation === "pending" && (item.manualOverride === true || item.gpsStatus === "manual_override" || item.gpsReviewStatus === "pending")) &&
        item.gpsReviewStatus !== "pending" &&
        item.officialCountEligible !== false
    );
}

function dispatchRenderTripStats(){
    const today = dispatchTodayDateString();

    const todayTrips = dispatchGetUnifiedTrips()
        .filter(dispatchIsValidTrip)
        .filter(item => {
            const time =
                item.completedAt ||
                item.unloadedAt ||
                item.unloadTime ||
                item.endTime ||
                item.createdAt ||
                "";

            return dispatchLocalDateString(time) === today;
        });

    const total = todayTrips.length;

    const coal = todayTrips.filter(item =>
        String(item.materialType || item.material || "").trim() === "煤"
    ).length;

    const waste = todayTrips.filter(item =>
        String(item.materialType || item.material || "").trim() === "渣"
    ).length;

    const totalEl = document.getElementById("dispatchTodayTotalTrips");
    const coalEl = document.getElementById("dispatchTodayCoalTrips");
    const wasteEl = document.getElementById("dispatchTodayWasteTrips");

    if(totalEl) totalEl.textContent = String(total);
    if(coalEl) coalEl.textContent = String(coal);
    if(wasteEl) wasteEl.textContent = String(waste);
}

dispatchRenderTripStats();

setInterval(
    dispatchRenderTripStats,
    5000
);

window.addEventListener(
    "storage",
    dispatchRenderTripStats
);

document.addEventListener(
    "visibilitychange",
    () => {
        if(!document.hidden){
            dispatchRenderTripStats();
        }
    }
);

function manualTripReadArray(key){
    try{
        const data = JSON.parse(localStorage.getItem(key));
        return Array.isArray(data) ? data : [];
    }catch(error){
        return [];
    }
}

function manualTripWriteArray(key,records){
    localStorage.setItem(
        key,
        JSON.stringify(records)
    );
}

function manualTripPendingRecords(){
    /*
     * tripRecords 是新版正式来源。
     * 没有新版数据时才兼容 driverTripRecords，防止双写重复显示。
     */
    const canonical = manualTripReadArray("tripRecords");

    const source =
        canonical.length
            ? canonical
            : manualTripReadArray("driverTripRecords");

    const seen = new Set();

    return source
        .filter(item =>
            item &&
            (
                item.manualOverride === true ||
                item.gpsStatus === "manual_override"
            ) &&
            (
                item.dispatchConfirmation === "pending" ||
                item.gpsReviewStatus === "pending"
            )
        )
        .filter(item => {
            const id = String(
                item.tripId ||
                item.recordId ||
                item.id ||
                ""
            );

            if(!id){
                return true;
            }

            if(seen.has(id)){
                return false;
            }

            seen.add(id);
            return true;
        })
        .sort((a,b)=>
            new Date(
                b.completedAt ||
                b.createdAt ||
                0
            ) -
            new Date(
                a.completedAt ||
                a.createdAt ||
                0
            )
        );
}

function manualTripFormatTime(value){
    if(!value){
        return "-";
    }

    const date = new Date(value);

    if(Number.isNaN(date.getTime())){
        return String(value);
    }

    return date.toLocaleString("zh-CN");
}

function manualTripEscape(value){
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}

function renderManualTripReview(){
    const box = document.getElementById("manualTripReviewList");
    const count = document.getElementById("manualTripReviewCount");

    if(!box){
        return;
    }

    const records = manualTripPendingRecords();

    if(count){
        count.textContent = records.length + " 条";
    }

    if(!records.length){
        box.innerHTML = `
            <div class="empty">
                暂无手动补录待审核记录
            </div>
        `;
        return;
    }

    box.innerHTML = records
        .map(item => {
            const id = String(
                item.tripId ||
                item.recordId ||
                item.id ||
                ""
            );

            return `
                <div class="manual-trip-review-card">

                    <div class="manual-trip-review-top">

                        <div>
                            <div class="manual-trip-review-title">
                                ${manualTripEscape(item.driverName || "-")}
                                ·
                                ${manualTripEscape(item.vehicleNumber || item.vehicleId || "-")}
                            </div>

                            <div class="manual-trip-review-info">
                                物料：
                                <strong>${manualTripEscape(item.materialType || item.material || "-")}</strong>
                                <br>
                                装载区：
                                ${manualTripEscape(item.loadingZoneName || item.loadingPoint || "-")}
                                <br>
                                卸载区：
                                ${manualTripEscape(item.unloadingZoneName || item.unloadingPoint || "-")}
                                <br>
                                装车：
                                ${manualTripFormatTime(item.loadedAt || item.loadTime)}
                                <br>
                                卸料：
                                ${manualTripFormatTime(item.unloadedAt || item.unloadTime || item.completedAt)}
                                <br>
                                任务：
                                ${manualTripEscape(item.taskId || item.dispatchTaskId || "-")}
                            </div>
                        </div>

                        <span class="manual-trip-source-badge">
                            手动补录
                        </span>

                    </div>

                    <div class="manual-trip-review-actions">

                        <button
                            type="button"
                            class="success-button"
                            onclick="reviewManualTrip('${manualTripEscape(id)}','approve')"
                        >
                            ✅ 审核通过
                        </button>

                        <button
                            type="button"
                            class="danger-button"
                            onclick="reviewManualTrip('${manualTripEscape(id)}','reject')"
                        >
                            ❌ 驳回
                        </button>

                    </div>

                </div>
            `;
        })
        .join("");
}

function updateManualTripRecordArray(key,tripId,action){
    const records = manualTripReadArray(key);
    let changed = false;

    const next = records.map(item => {
        const id = String(
            item.tripId ||
            item.recordId ||
            item.id ||
            ""
        );

        if(id !== String(tripId)){
            return item;
        }

        changed = true;

        const approved = action === "approve";

        return {
            ...item,

            dispatchConfirmation:
                approved
                    ? "confirmed"
                    : "rejected",

            gpsReviewStatus:
                approved
                    ? "approved"
                    : "rejected",

            officialCountEligible:
                approved,

            reviewedBy:
                "dispatch",

            reviewedAt:
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString(),

            /*
             * 当前仍是离线优先架构。
             * 调度审核改变后也需要后续同步数据库。
             */
            syncStatus:
                "pending"
        };
    });

    if(changed){
        manualTripWriteArray(
            key,
            next
        );
    }

    return changed;
}

function reviewManualTrip(tripId,action){
    const record = manualTripPendingRecords()
        .find(item =>
            String(
                item.tripId ||
                item.recordId ||
                item.id ||
                ""
            ) === String(tripId)
        );

    if(!record){
        alert("没有找到该手动补录记录，可能已经被处理。");
        renderManualTripReview();
        return;
    }

    const approved = action === "approve";

    const message =
        approved
            ? (
                "确认审核通过该运输趟次？\n\n" +
                "司机：" + (record.driverName || "-") + "\n" +
                "车辆：" + (record.vehicleNumber || record.vehicleId || "-") + "\n" +
                "卸载区：" + (record.unloadingZoneName || record.unloadingPoint || "-") + "\n" +
                "物料：" + (record.materialType || record.material || "-") + "\n\n" +
                "通过后将进入正式生产车数和报表统计。"
            )
            : (
                "确认驳回该手动补录趟次？\n\n" +
                "驳回后该记录保留，但不会进入正式生产统计。"
            );

    if(!confirm(message)){
        return;
    }

    /*
     * driver-work V2.10.2E1 当前会同时写：
     * tripRecords（正式）
     * driverTripRecords（兼容镜像）
     * 所以审核状态需要同步更新两处。
     */
    const canonicalChanged =
        updateManualTripRecordArray(
            "tripRecords",
            tripId,
            action
        );

    const legacyChanged =
        updateManualTripRecordArray(
            "driverTripRecords",
            tripId,
            action
        );

    if(!canonicalChanged && !legacyChanged){
        alert("审核失败：没有找到对应运输记录。");
        return;
    }

    renderManualTripReview();

    /*
     * 审核后立即刷新调度统计。
     */
    if(typeof dispatchRenderTripStats === "function"){
        dispatchRenderTripStats();
    }

    alert(
        approved
            ? "手动补录趟次已审核通过，已进入正式统计。"
            : "手动补录趟次已驳回，不进入正式统计。"
    );
}

document
    .getElementById("openGpsReviewButton")
    ?.addEventListener(
        "click",
        () => {
            setTimeout(
                renderManualTripReview,
                0
            );
        }
    );

document
    .getElementById("closeGpsReviewModal")
    ?.addEventListener(
        "click",
        renderManualTripReview
    );

renderManualTripReview();

setInterval(
    renderManualTripReview,
    5000
);

window.addEventListener(
    "storage",
    renderManualTripReview
);

const DISPATCH_TASK_NAME_COUNTER_KEY =
    "dispatchTaskNameCounters";

let dispatchTaskPublishSnapshot =
    null;
const SHIFT_EXECUTION_STORAGE_KEY="dispatchShiftExecutions";
function corePersonTeam(
    person
) {

    const raw =
        String(
            person?.team ||
            person?.department ||
            ""
        )
        .trim();


    const map = {
        "生产A组":
            "生产A组",
        "A班":
            "生产A组",
        "生产B组":
            "生产B组",
        "B班":
            "生产B组"
    };


    return (
        map[
            raw
        ] ||
        raw
    );
}

function coreReadArray(
    key
) {

    try {

        const data =
            JSON.parse(
                localStorage.getItem(
                    key
                )
            );


        return Array.isArray(
            data
        )
            ? data
            : [];

    } catch (
        error
    ) {

        return [];
    }
}

function coreCollectEquipmentCatalog() {

    const map =
        new Map();


    function add(
        item,
        forcedCategory =
            ""
    ) {

        if (
            !item ||
            typeof item !==
                "object"
        ) {

            return;
        }


        const id =
            coreEquipmentId(
                item
            );


        if (
            !id
        ) {

            return;
        }


        const old =
            map.get(
                id
            ) ||
            {};


        map.set(
            id,
            {
                ...old,
                ...item,

                __id:
                    id,

                __category:
                    forcedCategory ||
                    old.__category ||
                    coreInferEquipmentCategory(
                        item,
                        id
                    )
            }
        );
    }


    /*
     * 扫描已有设备/车辆档案。
     */
    for (
        let index = 0;
        index <
            localStorage.length;
        index++
    ) {

        const key =
            localStorage.key(
                index
            );


        if (
            !key ||
            !/equipment|vehicle|设备|车辆/i
                .test(
                    key
                )
        ) {

            continue;
        }


        if (
            [
                "equipmentOperationalStatus",
                "equipmentMeterReadings",
                "equipmentMaintenanceSettings",
                "maintenanceAlerts",
                "equipmentMaintenanceRecords",
                "equipmentUsageChecks",
                "equipmentUsageRecords"
            ]
            .includes(
                key
            )
        ) {

            continue;
        }


        try {

            const raw =
                localStorage.getItem(
                    key
                );


            if (
                !raw ||
                raw.length >
                    1800000
            ) {

                continue;
            }


            const data =
                JSON.parse(
                    raw
                );


            const rows =
                Array.isArray(
                    data
                )
                    ? data
                    : (
                        data &&
                        typeof data ===
                            "object"
                            ? [
                                data
                            ]
                            : []
                      );


            rows.forEach(
                item =>
                    add(
                        item
                    )
            );

        } catch (
            error
        ) {
            // ignore
        }
    }


    /*
     * 任务历史中出现过的设备作为兜底，
     * 防止设备档案键名不同导致看板漏设备。
     */
    const known =
        shiftCollectKnownEquipment();


    known.excavators
        .forEach(
            id =>
                add(
                    {
                        equipmentNumber:
                            id,
                        equipmentType:
                            "挖机"
                    },
                    "excavator"
                )
        );


    known.vehicles
        .forEach(
            id =>
                add(
                    {
                        vehicleNumber:
                            id,
                        vehicleType:
                            "汽车"
                    },
                    "truck"
                )
        );


    return [
        ...map.values()
    ]
    .sort(
        (
            a,
            b
        ) =>
            String(
                a.__id
            )
            .localeCompare(
                String(
                    b.__id
                ),
                "zh-CN"
            )
    );
}

function coreEquipmentId(
    item
) {

    return String(
        item?.equipmentNumber ||
        item?.vehicleNumber ||
        item?.equipmentId ||
        item?.vehicleId ||
        item?.number ||
        item?.code ||
        item?.id ||
        ""
    )
    .trim();
}

function coreInferEquipmentCategory(
    item,
    id
) {

    const raw =
        (
            coreEquipmentTypeText(
                item,
                id
            ) +
            " " +
            String(
                id ||
                ""
            )
        )
        .toLowerCase();


    if (
        /挖机|挖掘机|excavat|^w[-_ ]?\d/i
            .test(
                raw
            )
    ) {

        return "excavator";
    }


    if (
        /矿卡|矿用卡车|自卸|汽车|卡车|truck|dump|^t[-_ ]?\d/i
            .test(
                raw
            )
    ) {

        return "truck";
    }


    return "auxiliary";
}

function coreEquipmentTypeText(
    item,
    id =
        ""
) {

    return String(
        item?.equipmentType ||
        item?.vehicleType ||
        item?.type ||
        item?.category ||
        item?.equipmentName ||
        item?.vehicleName ||
        item?.name ||
        id ||
        ""
    )
    .trim();
}

function shiftCollectKnownEquipment(){
    const vehicles =
        new Set();

    const excavators =
        new Set();

    [
        ...getPublishedShiftTasks(),
        ...getShiftExecutions()
    ]
        .forEach(item=>{

            (item.bindings || [])
                .forEach(binding=>{

                    const excavator =
                        binding.excavatorNumber ||
                        binding.excavatorId ||
                        binding.excavator ||
                        "";

                    if(excavator){
                        excavators.add(
                            String(excavator)
                        );
                    }

                    [
                        ...(binding.truckIds || []),
                        ...(binding.vehicleIds || []),
                        ...(binding.trucks || [])
                    ]
                        .filter(Boolean)
                        .forEach(id=>{
                            vehicles.add(
                                String(id)
                            );
                        });
                });

            (item.driverAssignments || [])
                .forEach(assignment=>{

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

                    if(vehicle){
                        vehicles.add(
                            String(vehicle)
                        );
                    }

                    if(excavator){
                        excavators.add(
                            String(excavator)
                        );
                    }
                });
        });

    return {
        vehicles:
            [...vehicles].sort(),
        excavators:
            [...excavators].sort()
    };
}

function getPublishedShiftTasks(){
    return shiftReadArray(
        "dispatchPublishedTasks"
    );
}

function shiftReadArray(key){
    try{
        const data =
            JSON.parse(
                localStorage.getItem(key)
            );

        return Array.isArray(data)
            ? data
            : [];
    }catch(error){
        return [];
    }
}

function getShiftExecutions(){
    return shiftReadArray(
        SHIFT_EXECUTION_STORAGE_KEY
    );
}

function shiftTaskId(task){
    return String(
        task?.taskId ||
        task?.dispatchTaskId ||
        task?.id ||
        ""
    );
}

function shiftToday(){
    const date =
        new Date();

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2,"0");

    const day =
        String(
            date.getDate()
        ).padStart(2,"0");

    return `${year}-${month}-${day}`;
}

function shiftEscape(value){
    const div =
        document.createElement("div");

    div.textContent =
        String(value ?? "");

    return div.innerHTML;
}

function shiftExecutionDayNumber(
    execution
) {

    if (
        !execution
    ) {

        return 1;
    }


    const taskId =
        String(
            execution.taskId ||
            ""
        );


    const all =
        getShiftExecutions()
            .filter(
                item =>
                    String(
                        item.taskId ||
                        ""
                    ) ===
                        taskId
            );


    const dates =
        all
            .map(
                item =>
                    String(
                        item.date ||
                        ""
                    )
            )
            .filter(
                Boolean
            )
            .sort();


    if (
        !dates.length
    ) {

        return 1;
    }


    const first =
        new Date(
            dates[0] +
            "T00:00:00"
        );


    const current =
        new Date(
            String(
                execution.date ||
                dates[dates.length - 1]
            ) +
            "T00:00:00"
        );


    const diff =
        Math.floor(
            (
                current -
                first
            ) /
            86400000
        );


    return Math.max(
        1,
        diff +
        1
    );
}

function dispatchShiftExecutionTripCount(
    execution
) {

    return dispatchTripsForShiftExecution(
        execution
    )
    .reduce(
        (
            sum,
            item
        ) =>
            sum +
            Math.max(
                1,
                Number(
                    item?.tripCount ||
                    item?.count ||
                    1
                )
            ),
        0
    );
}

function dispatchTripsForShiftExecution(
    execution
) {

    if (
        !execution
    ) {

        return [];
    }


    const shiftId =
        String(
            execution.shiftId ||
            ""
        );


    const taskId =
        String(
            execution.taskId ||
            ""
        );


    const shift =
        String(
            execution.shift ||
            ""
        );


    const date =
        String(
            execution.date ||
            ""
        );


    const startedAt =
        new Date(
            execution.startedAt ||
            execution.createdAt ||
            0
        )
        .getTime();


    return dispatchGetUnifiedTrips()
        .filter(
            dispatchIsValidTrip
        )
        .filter(
            trip => {

                const tripTime =
                    new Date(
                        dispatchTripTime(
                            trip
                        ) ||
                        0
                    )
                    .getTime();


                if (
                    startedAt &&
                    tripTime &&
                    tripTime <
                        startedAt
                ) {

                    return false;
                }


                const tripShiftId =
                    String(
                        trip?.shiftId ||
                        ""
                    );


                if (
                    shiftId &&
                    tripShiftId
                ) {

                    return (
                        tripShiftId ===
                        shiftId
                    );
                }


                /*
                 * 旧运输记录没有 shiftId 时的兼容口径：
                 * 必须同时匹配任务、班次、日期，并且发生在接班时间之后。
                 */
                const tripTaskId =
                    String(
                        trip?.taskId ||
                        trip?.dispatchTaskId ||
                        ""
                    );


                const tripShift =
                    String(
                        trip?.shift ||
                        ""
                    );


                const tripDate =
                    String(
                        trip?.shiftDate ||
                        trip?.productionDate ||
                        dispatchTripTime(
                            trip
                        ) ||
                        ""
                    )
                    .slice(
                        0,
                        10
                    );


                return (
                    (!taskId ||
                        tripTaskId ===
                            taskId) &&
                    (!shift ||
                        tripShift ===
                            shift) &&
                    (!date ||
                        tripDate ===
                            date)
                );
            }
        );
}

function dispatchTripTime(
    item
) {

    return (
        item?.completedAt ||
        item?.unloadedAt ||
        item?.unloadTime ||
        item?.endTime ||
        item?.createdAt ||
        ""
    );
}

"use strict";

/* =========================================================
   一线人员请假待审批醒目提示
   监听现有 leaveTodoCount 的显示值，不接管、不改写原审批逻辑。
========================================================= */

(function initLeaveTodoAttention() {

    const countElement =
        document.getElementById(
            "leaveTodoCount"
        );

    const leaveButton =
        document.getElementById(
            "openLeaveReviewButton"
        );

    const headerBadge =
        document.getElementById(
            "leaveTodoHeaderBadge"
        );


    if (
        !countElement ||
        !leaveButton ||
        !headerBadge
    ) {

        return;
    }


    function getPendingCount() {

        const text =
            String(
                countElement.textContent ||
                ""
            );

        const matched =
            text.match(
                /\d+/
            );


        return matched
            ? Number(
                matched[0]
            )
            : 0;
    }


    function refreshLeaveTodoAttention() {

        const count =
            getPendingCount();

        const hasPending =
            count > 0;


        leaveButton.classList.toggle(
            "leave-todo-attention",
            hasPending
        );


        headerBadge.classList.toggle(
            "is-visible",
            hasPending
        );


        headerBadge.textContent =
            hasPending
                ? count +
                  " 条请假待审批"
                : "";


        leaveButton.setAttribute(
            "aria-label",
            hasPending
                ? "一线人员请假，" +
                  count +
                  " 条待审批"
                : "一线人员请假"
        );
    }


    /*
     * 原 dispatch.js 更新 leaveTodoCount 后，
     * MutationObserver 只负责同步醒目样式。
     */
    const observer =
        new MutationObserver(
            refreshLeaveTodoAttention
        );


    observer.observe(
        countElement,
        {
            childList: true,
            subtree: true,
            characterData: true
        }
    );


    refreshLeaveTodoAttention();

})();


"use strict";

/* =========================================================
   V2.10.6E
   A/B班 + 班次类型 + 全班人员考勤确认
========================================================= */

(function initDispatchAttendanceReview() {

    const KEY = {
        PERSONNEL:
            "personnelRecords",

        ATTENDANCE:
            "attendanceRecords",

        SHIFTS:
            "dispatchShiftExecutions",

        TRIPS:
            "tripRecords",

        LEGACY_TRIPS:
            "driverTripRecords",

        ZERO_REPORTS:
            "zeroProductionReports",

        CONFIRMATIONS:
            "dispatchAttendanceConfirmations",

        BATCHES:
            "dispatchAttendanceBatchConfirmations",

        LEAVE_KEYS: [
            "leaveRequests",
            "leaveRecords",
            "driverLeaveRequests"
        ]
    };


    let currentConfirmContext =
        null;


    function readArray(key) {

        try {

            const data =
                JSON.parse(
                    localStorage.getItem(
                        key
                    )
                );


            return Array.isArray(data)
                ? data
                : [];

        } catch (error) {

            return [];
        }
    }


    function saveArray(
        key,
        value
    ) {

        localStorage.setItem(
            key,
            JSON.stringify(
                value
            )
        );
    }


    function esc(value) {

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


    function localDateKey(value) {

        const date =
            value instanceof Date
                ? new Date(
                    value.getTime()
                  )
                : new Date(
                    value
                  );


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
                date.getMonth() + 1
            )
            .padStart(
                2,
                "0"
            ) +
            "-" +
            String(
                date.getDate()
            )
            .padStart(
                2,
                "0"
            )
        );
    }


    function todayKey() {

        return localDateKey(
            new Date()
        );
    }


    function monthKey() {

        return todayKey()
            .slice(
                0,
                7
            );
    }


    function addDays(
        dateKey,
        days
    ) {

        const date =
            new Date(
                dateKey +
                "T00:00:00"
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";
        }


        date.setDate(
            date.getDate() +
            days
        );


        return localDateKey(
            date
        );
    }


    function unit(value) {

        const number =
            Number(
                value ||
                0
            );


        return Number.isFinite(
            number
        )
            ? number.toFixed(
                1
              )
            : "0.0";
    }


    function personId(person) {

        return String(
            person?.personId ||
            person?.employeeId ||
            person?.driverId ||
            person?.workerId ||
            person?.id ||
            person?.employeeNo ||
            ""
        )
        .trim();
    }


    function personName(person) {

        return String(
            person?.name ||
            person?.personName ||
            person?.driverName ||
            person?.workerName ||
            person?.applicantName ||
            ""
        )
        .trim();
    }


    function normalizePosition(position) {

        const map = {
            "卡车司机":
                "汽车司机",

            "挖掘机司机":
                "挖机司机",

            "挖掘机操作手":
                "挖机司机",

            "挖机操作手":
                "挖机司机",

            "装载机司机":
                "铲车司机",

            "维修人员":
                "维修员",

            "库房管理员":
                "库房管理",

            "调度员":
                "车队长",

            "测量人员":
                "测量员",

            "统计员":
                "统计",

            "财务":
                "会计",

            "会计员":
                "会计",

            "后勤人员":
                "后勤"
        };


        return (
            map[
                position
            ] ||
            position ||
            ""
        );
    }


    function samePerson(
        person,
        item
    ) {

        if (
            !person ||
            !item
        ) {

            return false;
        }


        const leftId =
            personId(
                person
            );


        const rightId =
            String(
                item.personId ||
                item.driverId ||
                item.workerId ||
                item.employeeId ||
                item.operatorId ||
                item.applicantId ||
                item.auxiliaryDriverId ||
                item.id ||
                item.employeeNo ||
                ""
            )
            .trim();


        if (
            leftId &&
            rightId
        ) {

            return (
                leftId ===
                rightId
            );
        }


        const leftName =
            personName(
                person
            );


        const rightName =
            String(
                item.personName ||
                item.driverName ||
                item.workerName ||
                item.operatorName ||
                item.applicantName ||
                item.auxiliaryDriverName ||
                item.name ||
                ""
            )
            .trim();


        return Boolean(
            leftName &&
            rightName &&
            leftName ===
                rightName
        );
    }


    function approvedPersonnel() {

        return readArray(
            KEY.PERSONNEL
        )
        .filter(
            person => {

                if (
                    !person ||
                    person.enabled ===
                        false ||
                    person.status ===
                        "rejected" ||
                    person.approvalStatus ===
                        "rejected" ||
                    person.status ===
                        "disabled" ||
                    person.status ===
                        "resigned" ||
                    person.status ===
                        "pending" ||
                    person.status ===
                        "leave" ||
                    person.approvalStatus ===
                        "pending" ||
                    person.personnelStatus ===
                        "停用" ||
                    person.personnelStatus ===
                        "离职" ||
                    person.personnelStatus ===
                        "待审核" ||
                    person.personnelStatus ===
                        "请假"
                ) {

                    return false;
                }


                return (
                    person.status ===
                        "approved" ||
                    person.status ===
                        "active" ||
                    person.status ===
                        "working" ||
                    person.approvalStatus ===
                        "approved" ||
                    person.personnelStatus ===
                        "在职可用" ||
                    person.personnelStatus ===
                        "作业中"
                );
            }
        );
    }


    function attendanceCrew(person) {

        /*
         * V2.10.6H
         * 人员主数据统一以 team 为唯一业务字段：
         * 生产A组 / 生产B组 / 修理组 / 后勤办公组。
         *
         * 调度只读取生产A组、生产B组。
         * 旧字段仅做历史资料读取兼容，不再作为新标准。
         */

        const primaryTeam =
            String(
                person?.team ||
                ""
            )
            .trim();


        if (
            primaryTeam ===
                "生产A组"
        ) {

            return "生产A组";
        }


        if (
            primaryTeam ===
                "生产B组"
        ) {

            return "生产B组";
        }


        if (
            [
                "修理组",
                "后勤办公组"
            ]
            .includes(
                primaryTeam
            )
        ) {

            return "";
        }


        /*
         * 历史数据兼容：
         * A班 / 生产A / 山一车队 -> 生产A组
         * B班 / 生产B / 山二车队 -> 生产B组
         */
        const legacyRaw =
            [
                person?.attendanceCrew,
                person?.shiftGroup,
                person?.workGroup,
                person?.crew,
                person?.department,
                person?.group
            ]
            .filter(
                Boolean
            )
            .join(
                " "
            );


        if (
            /(^|[^A-Z])A班|A组|生产A|山一车队/i
                .test(
                    legacyRaw
                )
        ) {

            return "生产A组";
        }


        if (
            /(^|[^A-Z])B班|B组|生产B|山二车队/i
                .test(
                    legacyRaw
                )
        ) {

            return "生产B组";
        }


        return "";
    }


    function frontlinePersonnel() {

        return approvedPersonnel()
            .filter(
                person =>
                    attendanceCrew(
                        person
                    ) ===
                        "生产A组" ||
                    attendanceCrew(
                        person
                    ) ===
                        "生产B组"
            )
            .sort(
                (
                    a,
                    b
                ) => {

                    const positionCompare =
                        normalizePosition(
                            a.position
                        )
                        .localeCompare(
                            normalizePosition(
                                b.position
                            ),
                            "zh-CN"
                        );


                    if (
                        positionCompare
                    ) {

                        return positionCompare;
                    }


                    return personName(
                        a
                    )
                    .localeCompare(
                        personName(
                            b
                        ),
                        "zh-CN"
                    );
                }
            );
    }


    function selectedCrew() {

        return (
            document
                .getElementById(
                    "attendanceReviewCrew"
                )
                ?.value ||
            ""
        );
    }


    function selectedShiftType() {

        return (
            document
                .getElementById(
                    "attendanceReviewShiftType"
                )
                ?.value ||
            ""
        );
    }


    function isValidShiftType(
        value
    ) {

        return [
            "白班",
            "夜班",
            "白转夜",
            "夜转白"
        ]
        .includes(
            String(
                value ||
                ""
            )
        );
    }


    function shiftUnitsFromType(
        shiftType
    ) {

        if (
            shiftType ===
            "白班"
        ) {

            return {
                white:
                    1,

                night:
                    0,

                total:
                    1,

                onePointFive:
                    false
            };
        }


        if (
            shiftType ===
            "夜班"
        ) {

            return {
                white:
                    0,

                night:
                    1,

                total:
                    1,

                onePointFive:
                    false
            };
        }


        if (
            shiftType ===
            "白转夜"
        ) {

            return {
                white:
                    0.5,

                night:
                    1,

                total:
                    1.5,

                onePointFive:
                    true
            };
        }


        if (
            shiftType ===
            "夜转白"
        ) {

            return {
                white:
                    1,

                night:
                    0.5,

                total:
                    1.5,

                onePointFive:
                    true
            };
        }


        return {
            white:
                0,

            night:
                0,

            total:
                0,

            onePointFive:
                false
        };
    }


    function filteredPersonnel() {

        const crew =
            selectedCrew();


        if (
            !crew
        ) {

            return [];
        }


        return frontlinePersonnel()
            .filter(
                person =>
                    attendanceCrew(
                        person
                    ) ===
                        crew
            );
    }


    function attendanceRecord(
        person,
        date
    ) {

        return (
            readArray(
                KEY.ATTENDANCE
            )
            .find(
                item =>
                    samePerson(
                        person,
                        item
                    ) &&
                    String(
                        item.date ||
                        ""
                    )
                    .slice(
                        0,
                        10
                    ) ===
                        date
            )
            ||
            null
        );
    }


    function punchInfo(record) {

        if (
            record?.checkInAt &&
            record?.checkOutAt
        ) {

            return {
                label:
                    "早晚完整",

                complete:
                    true,

                any:
                    true
            };
        }


        if (
            record?.checkInAt ||
            record?.checkOutAt
        ) {

            return {
                label:
                    "打卡不完整",

                complete:
                    false,

                any:
                    true
            };
        }


        return {
            label:
                "未打卡",

            complete:
                false,

            any:
                false
        };
    }


    function allLeaveRecords() {

        const map =
            new Map();


        KEY.LEAVE_KEYS
        .forEach(
            key => {

                readArray(
                    key
                )
                .forEach(
                    item => {

                        if (
                            item.status !==
                                "approved" &&
                            item.status !==
                                "returned" &&
                            item.approvalStatus !==
                                "approved"
                        ) {

                            return;
                        }


                        const unique =
                            String(
                                item.leaveId ||
                                item.id ||
                                [
                                    item.startTime,
                                    item.endTime,
                                    item.applicantId,
                                    item.applicantName,
                                    item.leaveType
                                ]
                                .join(
                                    "|"
                                )
                            );


                        if (
                            !map.has(
                                unique
                            )
                        ) {

                            map.set(
                                unique,
                                item
                            );
                        }
                    }
                );
            }
        );


        return [
            ...map.values()
        ];
    }


    function effectiveLeaveDays(item) {

        if (
            item.status ===
                "returned"
        ) {

            return Math.max(
                0,
                Number(
                    item.actualLeaveDays ||
                    0
                )
            );
        }


        return Math.max(
            0,
            Number(
                item.leaveDays ||
                0
            )
        );
    }


    function effectiveRotationCovered(item) {

        if (
            item.leaveType !==
                "轮休假"
        ) {

            return 0;
        }


        if (
            item.status ===
                "returned"
        ) {

            return Math.max(
                0,
                Number(
                    item.actualRotationCoveredDays ||
                    0
                )
            );
        }


        return Math.max(
            0,
            Number(
                item.rotationCoveredDays ||
                0
            )
        );
    }


    function leaveSlots(item) {

        const start =
            new Date(
                item.startTime ||
                item.leaveStart ||
                0
            );


        if (
            Number.isNaN(
                start.getTime()
            )
        ) {

            return [];
        }


        const totalHalfDays =
            Math.max(
                0,
                Math.round(
                    effectiveLeaveDays(
                        item
                    ) *
                    2
                )
            );


        const rotationHalfDays =
            Math.max(
                0,
                Math.min(
                    totalHalfDays,
                    Math.round(
                        effectiveRotationCovered(
                            item
                        ) *
                        2
                    )
                )
            );


        let date =
            localDateKey(
                start
            );


        let half =
            start.getHours() >=
                12
                ? "PM"
                : "AM";


        const result =
            [];


        for (
            let index = 0;
            index <
                totalHalfDays;
            index += 1
        ) {

            const rotationPaid =
                item.leaveType ===
                    "轮休假" &&
                index <
                    rotationHalfDays;


            result.push({
                date,

                leaveType:
                    item.leaveType ||
                    "请假",

                rotationPaid,

                deduction:
                    item.leaveType ===
                        "事假" ||
                    (
                        item.leaveType ===
                            "轮休假" &&
                        !rotationPaid
                    )
            });


            if (
                half ===
                "AM"
            ) {

                half =
                    "PM";

            } else {

                half =
                    "AM";

                date =
                    addDays(
                        date,
                        1
                    );
            }
        }


        return result;
    }


    function leaveImpact(
        person,
        date
    ) {

        let rotationPaid =
            0;


        let deduction =
            0;


        const labels =
            [];


        allLeaveRecords()
        .filter(
            item =>
                samePerson(
                    person,
                    item
                )
        )
        .forEach(
            item => {

                leaveSlots(
                    item
                )
                .filter(
                    slot =>
                        slot.date ===
                            date
                )
                .forEach(
                    slot => {

                        if (
                            slot.rotationPaid
                        ) {

                            rotationPaid +=
                                0.5;
                        }


                        if (
                            slot.deduction
                        ) {

                            deduction +=
                                0.5;
                        }


                        labels.push(
                            slot.leaveType +
                            (
                                slot.rotationPaid
                                    ? "（额度内）"
                                    : (
                                        slot.deduction
                                            ? "（扣考勤）"
                                            : ""
                                      )
                            )
                        );
                    }
                );
            }
        );


        return {
            rotationPaid:
                Math.min(
                    1.5,
                    rotationPaid
                ),

            deduction:
                Math.min(
                    1.5,
                    deduction
                ),

            labels:
                [
                    ...new Set(
                        labels
                    )
                ],

            hasLeave:
                labels.length >
                0
        };
    }


    function relevantShiftExecutions(
        date,
        shiftType
    ) {

        const target =
            [];


        if (
            shiftType ===
            "白班"
        ) {

            target.push({
                date,
                shift:
                    "白班"
            });

        } else if (
            shiftType ===
            "夜班"
        ) {

            target.push({
                date,
                shift:
                    "夜班"
            });

        } else if (
            shiftType ===
            "白转夜"
        ) {

            target.push(
                {
                    date,
                    shift:
                        "白班"
                },
                {
                    date,
                    shift:
                        "夜班"
                }
            );

        } else if (
            shiftType ===
            "夜转白"
        ) {

            target.push(
                {
                    date:
                        addDays(
                            date,
                            -1
                        ),
                    shift:
                        "夜班"
                },
                {
                    date,
                    shift:
                        "白班"
                }
            );
        }


        return readArray(
            KEY.SHIFTS
        )
        .filter(
            item => {

                const itemDate =
                    String(
                        item.date ||
                        item.shiftDate ||
                        ""
                    )
                    .slice(
                        0,
                        10
                    );


                const itemShift =
                    String(
                        item.shift ||
                        ""
                    );


                return target.some(
                    key =>
                        key.date ===
                            itemDate &&
                        key.shift ===
                            itemShift
                );
            }
        );
    }


    function assignedAssets(
        person,
        date,
        shiftType
    ) {

        const assets =
            [];


        relevantShiftExecutions(
            date,
            shiftType
        )
        .forEach(
            execution => {

                const prefix =
                    execution.shift ||
                    "";


                (
                    execution.driverAssignments ||
                    []
                )
                .filter(
                    item =>
                        samePerson(
                            person,
                            item
                        )
                )
                .forEach(
                    item => {

                        const number =
                            item.vehicleNumber ||
                            item.vehicleId ||
                            item.truckNumber ||
                            item.truckId ||
                            "";


                        if (
                            number
                        ) {

                            assets.push(
                                prefix +
                                "：" +
                                number
                            );
                        }
                    }
                );


                (
                    execution.bindings ||
                    []
                )
                .filter(
                    item =>
                        samePerson(
                            person,
                            {
                                personId:
                                    item.excavatorDriverId ||
                                    item.operatorId ||
                                    "",

                                personName:
                                    item.excavatorDriverName ||
                                    item.operatorName ||
                                    ""
                            }
                        )
                )
                .forEach(
                    item => {

                        const number =
                            item.excavatorNumber ||
                            item.excavatorId ||
                            "";


                        if (
                            number
                        ) {

                            assets.push(
                                prefix +
                                "：" +
                                number
                            );
                        }
                    }
                );


                (
                    execution.auxiliaryAssignments ||
                    []
                )
                .filter(
                    item =>
                        samePerson(
                            person,
                            item
                        )
                )
                .forEach(
                    item => {

                        const number =
                            item.vehicleNumber ||
                            item.vehicleId ||
                            item.equipmentNumber ||
                            item.equipmentId ||
                            item.auxiliaryNumber ||
                            "";


                        if (
                            number
                        ) {

                            assets.push(
                                prefix +
                                "：" +
                                number
                            );
                        }
                    }
                );
            }
        );


        return [
            ...new Set(
                assets
            )
        ];
    }


    function officialTrips() {

        const canonical =
            readArray(
                KEY.TRIPS
            );


        return canonical.length
            ? canonical
            : readArray(
                KEY.LEGACY_TRIPS
              );
    }


    function validTrip(item) {

        return Boolean(
            item &&
            item.status !==
                "cancelled" &&
            item.dispatchConfirmation !==
                "rejected" &&
            item.officialCountEligible !==
                false
        );
    }


    function tripContextMatch(
        item,
        date,
        shiftType
    ) {

        const rawDate =
            String(
                item.completedAt ||
                item.unloadedAt ||
                item.unloadTime ||
                item.endTime ||
                item.createdAt ||
                item.date ||
                ""
            )
            .slice(
                0,
                10
            );


        const rawShift =
            String(
                item.shift ||
                item.workShift ||
                ""
            );


        if (
            shiftType ===
            "白班"
        ) {

            return (
                rawDate ===
                    date &&
                (
                    !rawShift ||
                    rawShift ===
                        "白班"
                )
            );
        }


        if (
            shiftType ===
            "夜班"
        ) {

            return (
                rawDate ===
                    date &&
                (
                    !rawShift ||
                    rawShift ===
                        "夜班"
                )
            );
        }


        if (
            shiftType ===
            "白转夜"
        ) {

            return (
                rawDate ===
                    date &&
                (
                    !rawShift ||
                    rawShift ===
                        "白班" ||
                    rawShift ===
                        "夜班"
                )
            );
        }


        if (
            shiftType ===
            "夜转白"
        ) {

            if (
                rawShift
            ) {

                return (
                    (
                        rawDate ===
                            addDays(
                                date,
                                -1
                            ) &&
                        rawShift ===
                            "夜班"
                    ) ||
                    (
                        rawDate ===
                            date &&
                        rawShift ===
                            "白班"
                    )
                );
            }


            return (
                rawDate ===
                date
            );
        }


        return false;
    }


    function productionCount(
        person,
        date,
        shiftType
    ) {

        return officialTrips()
            .filter(
                validTrip
            )
            .filter(
                item =>
                    samePerson(
                        person,
                        item
                    )
            )
            .filter(
                item =>
                    tripContextMatch(
                        item,
                        date,
                        shiftType
                    )
            )
            .reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    Math.max(
                        1,
                        Number(
                            item.tripCount ||
                            item.count ||
                            1
                        )
                    ),
                0
            );
    }


    function confirmationId(
        person,
        date
    ) {

        return (
            date +
            "|" +
            (
                personId(
                    person
                ) ||
                personName(
                    person
                )
            )
        );
    }


    function attendanceConfirmation(
        person,
        date
    ) {

        return (
            readArray(
                KEY.CONFIRMATIONS
            )
            .find(
                item =>
                    item.confirmationId ===
                        confirmationId(
                            person,
                            date
                        )
            )
            ||
            null
        );
    }


    function batchId(
        date,
        crew
    ) {

        return (
            "ATT_BATCH_" +
            String(
                date ||
                ""
            )
            .replaceAll(
                "-",
                ""
            ) +
            "_" +
            crew
        );
    }


    function batchConfirmation(
        date,
        crew
    ) {

        const records =
            readArray(
                KEY.BATCHES
            );


        const currentId =
            batchId(
                date,
                crew
            );


        const legacyCrew =
            crew ===
                "生产A组"
                ? "A班"
                : (
                    crew ===
                        "生产B组"
                        ? "B班"
                        : ""
                  );


        const legacyId =
            legacyCrew
                ? batchId(
                    date,
                    legacyCrew
                  )
                : "";


        return (
            records.find(
                item =>
                    item.batchId ===
                        currentId
            )
            ||
            (
                legacyId
                    ? records.find(
                        item =>
                            item.batchId ===
                                legacyId
                      )
                    : null
            )
            ||
            null
        );
    }


    function attendanceFromLeave(
        shiftUnits,
        leave
    ) {

        const cap =
            shiftUnits.total;


        return Math.max(
            0,
            Math.min(
                cap,
                Math.max(
                    0,
                    shiftUnits.total -
                    leave.deduction
                ) +
                leave.rotationPaid
            )
        );
    }


    function dailyRow(
        person,
        date,
        shiftType
    ) {

        const shiftUnits =
            shiftUnitsFromType(
                shiftType
            );


        const attendance =
            attendanceRecord(
                person,
                date
            );


        const punch =
            punchInfo(
                attendance
            );


        const leave =
            leaveImpact(
                person,
                date
            );


        const assets =
            assignedAssets(
                person,
                date,
                shiftType
            );


        const trips =
            productionCount(
                person,
                date,
                shiftType
            );


        const confirmation =
            attendanceConfirmation(
                person,
                date
            );


        const hasCurrentExplanation =
            Boolean(
                confirmation &&
                confirmation.explanationConfirmed ===
                    true
            );


        const needsExplanation =
            !leave.hasLeave &&
            trips ===
                0;


        let attendanceValue =
            0;


        let status =
            "待说明";


        let source =
            "pending";


        if (
            leave.hasLeave
        ) {

            attendanceValue =
                attendanceFromLeave(
                    shiftUnits,
                    leave
                );


            status =
                "请假";

            source =
                "leave";

        } else if (
            trips >
            0
        ) {

            attendanceValue =
                shiftUnits.total;


            status =
                "自动计勤";

            source =
                "production";

        } else if (
            hasCurrentExplanation
        ) {

            attendanceValue =
                confirmation.countAttendance ===
                    false
                    ? 0
                    : shiftUnits.total;


            status =
                confirmation.countAttendance ===
                    false
                    ? "已说明不计勤"
                    : "已说明计勤";

            source =
                "explanation";
        }


        return {
            person,

            date,

            shiftType,

            shiftUnits,

            attendance,

            punch,

            leave,

            assets,

            trips,

            confirmation,

            needsExplanation,

            hasCurrentExplanation,

            attendanceValue,

            status,

            source,

            pending:
                needsExplanation &&
                !hasCurrentExplanation
        };
    }


    function resetSummary() {

        const values = {
            attendanceReviewPersonCount:
                "0",

            attendanceReviewDayTotal:
                "0.0",

            attendanceReviewPendingCount:
                "0",

            attendanceReviewDeductionTotal:
                "0.0"
        };


        Object.entries(
            values
        )
        .forEach(
            (
                [
                    id,
                    value
                ]
            ) => {

                const element =
                    document.getElementById(
                        id
                    );


                if (
                    element
                ) {

                    element.textContent =
                        value;
                }
            }
        );
    }


    function selectedDailyContext() {

        return {
            date:
                document
                    .getElementById(
                        "attendanceReviewDate"
                    )
                    ?.value ||
                todayKey(),

            crew:
                selectedCrew(),

            shiftType:
                selectedShiftType()
        };
    }


    function visibleRows() {

        const context =
            selectedDailyContext();


        if (
            !context.crew ||
            !isValidShiftType(
                context.shiftType
            )
        ) {

            return [];
        }


        return filteredPersonnel()
            .map(
                person =>
                    dailyRow(
                        person,
                        context.date,
                        context.shiftType
                    )
            );
    }


    function renderBatchStatus(
        rows
    ) {

        const box =
            document.getElementById(
                "attendanceBatchStatus"
            );


        if (
            !box
        ) {

            return;
        }


        const {
            date,
            crew,
            shiftType
        } =
            selectedDailyContext();


        if (
            !crew ||
            !isValidShiftType(
                shiftType
            )
        ) {

            box.innerHTML =
                "请先选择 <strong>生产A组 / 生产B组</strong> 和 <strong>白班 / 夜班 / 白转夜 / 夜转白</strong>。";

            return;
        }


        const batch =
            batchConfirmation(
                date,
                crew
            );


        const pending =
            rows.filter(
                row =>
                    row.pending
            )
            .length;


        if (
            batch
        ) {

            const sameShift =
                batch.shiftType ===
                    shiftType;


            box.innerHTML =
                (
                    sameShift
                        ? "✅ "
                        : "⚠️ "
                ) +
                "<strong>" +
                esc(
                    date +
                    " " +
                    crew
                ) +
                "</strong>" +
                " 已确认班次：" +
                esc(
                    batch.shiftType
                ) +
                " · 当前选择：" +
                esc(
                    shiftType
                ) +
                " · 待说明：" +
                esc(
                    pending
                ) +
                " 人" +
                (
                    sameShift
                        ? ""
                        : '<div class="attendance-batch-warning">当前班次与已保存班次不同，重新确认本班次会覆盖当天该班组的调度确认。</div>'
                );

            return;
        }


        box.innerHTML =
            "<strong>" +
            esc(
                date +
                " " +
                crew +
                " " +
                shiftType
            ) +
            "</strong>" +
            " · 共 " +
            esc(
                rows.length
            ) +
            " 人 · 待说明 " +
            esc(
                pending
            ) +
            " 人。";
    }


    function renderDaily() {

        const body =
            document.getElementById(
                "attendanceDailyBody"
            );


        if (
            !body
        ) {

            return;
        }


        const {
            crew,
            shiftType
        } =
            selectedDailyContext();


        if (
            !crew ||
            !isValidShiftType(
                shiftType
            )
        ) {

            resetSummary();


            body.innerHTML =
                '<tr><td colspan="10" class="attendance-review-empty">请先选择生产A组 / 生产B组，再选择白班、夜班、白转夜或夜转白。</td></tr>';


            renderBatchStatus(
                []
            );


            return;
        }


        const rows =
            visibleRows();


        const total =
            rows.reduce(
                (
                    sum,
                    row
                ) =>
                    sum +
                    row.attendanceValue,
                0
            );


        const pending =
            rows.filter(
                row =>
                    row.pending
            )
            .length;


        const deduction =
            rows.reduce(
                (
                    sum,
                    row
                ) =>
                    sum +
                    row.leave.deduction,
                0
            );


        const personCount =
            document.getElementById(
                "attendanceReviewPersonCount"
            );


        const dayTotal =
            document.getElementById(
                "attendanceReviewDayTotal"
            );


        const pendingCount =
            document.getElementById(
                "attendanceReviewPendingCount"
            );


        const deductionTotal =
            document.getElementById(
                "attendanceReviewDeductionTotal"
            );


        if (
            personCount
        ) {

            personCount.textContent =
                String(
                    rows.length
                );
        }


        if (
            dayTotal
        ) {

            dayTotal.textContent =
                unit(
                    total
                );
        }


        if (
            pendingCount
        ) {

            pendingCount.textContent =
                String(
                    pending
                );
        }


        if (
            deductionTotal
        ) {

            deductionTotal.textContent =
                unit(
                    deduction
                );
        }


        renderBatchStatus(
            rows
        );


        if (
            !rows.length
        ) {

            body.innerHTML =
                '<tr><td colspan="10" class="attendance-review-empty">当前班组没有一线人员。</td></tr>';

            return;
        }


        body.innerHTML =
            rows
            .map(
                row => {

                    const explanation =
                        row.confirmation?.explanationConfirmed
                            ? (
                                [
                                    row.confirmation.workType,
                                    row.confirmation.remark
                                ]
                                .filter(
                                    Boolean
                                )
                                .join(
                                    " · "
                                )
                              )
                            : "";


                    const leaveText =
                        row.leave.hasLeave
                            ? row.leave.labels.join(
                                "、"
                              )
                            : "无";


                    const statusClass =
                        row.source ===
                            "leave"
                            ? "leave"
                            : (
                                row.pending
                                    ? "pending"
                                    : "ok"
                              );


                    const assets =
                        row.assets.length
                            ? row.assets.join(
                                " / "
                              )
                            : "-";


                    return `
                        <tr>
                            <td>
                                ${
                                    row.pending
                                        ? `
                                            <input
                                                type="checkbox"
                                                class="attendance-pending-select"
                                                data-attendance-pending-person="${esc(personId(row.person) || personName(row.person))}"
                                            >
                                        `
                                        : "-"
                                }
                            </td>

                            <td>
                                <div class="attendance-review-name">
                                    ${esc(personName(row.person) || "-")}
                                </div>

                                <div class="attendance-review-sub">
                                    ${esc(normalizePosition(row.person.position) || "-")}
                                    · ${esc(row.person.employeeNo || personId(row.person) || "-")}
                                    · ${esc(attendanceCrew(row.person) || "-")}
                                </div>
                            </td>

                            <td>
                                <span class="attendance-asset">
                                    ${esc(assets)}
                                </span>
                            </td>

                            <td>
                                <strong>${esc(row.trips)}</strong>
                            </td>

                            <td>
                                ${esc(row.punch.label)}
                            </td>

                            <td>
                                <span class="${row.leave.hasLeave ? "attendance-leave" : ""}">
                                    ${esc(leaveText)}
                                </span>

                                ${
                                    row.leave.hasLeave
                                        ? `
                                            <div class="attendance-review-sub">
                                                轮休计勤 ${unit(row.leave.rotationPaid)}
                                                · 扣 ${unit(row.leave.deduction)}
                                            </div>
                                        `
                                        : ""
                                }
                            </td>

                            <td>
                                <strong>${unit(row.attendanceValue)}</strong>
                                <div class="attendance-review-sub">
                                    ${esc(row.shiftType)}
                                </div>
                            </td>

                            <td>
                                ${
                                    explanation
                                        ? esc(explanation)
                                        : (
                                            row.source === "production"
                                                ? "有生产车数，自动计勤"
                                                : (
                                                    row.source === "leave"
                                                        ? "按请假规则计算"
                                                        : "待调度说明"
                                                  )
                                          )
                                }
                            </td>

                            <td>
                                <span class="attendance-review-status ${statusClass}">
                                    ${esc(row.status)}
                                </span>
                            </td>

                            <td>
                                ${
                                    row.needsExplanation
                                        ? `
                                            <button
                                                type="button"
                                                class="attendance-review-action"
                                                data-attendance-explain-person="${esc(personId(row.person) || personName(row.person))}"
                                            >
                                                ${
                                                    row.hasCurrentExplanation
                                                        ? "修改说明"
                                                        : "填写说明"
                                                }
                                            </button>
                                        `
                                        : "-"
                                }
                            </td>
                        </tr>
                    `;
                }
            )
            .join(
                ""
            );


        body
        .querySelectorAll(
            "[data-attendance-explain-person]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        openExplanation(
                            button.dataset.attendanceExplainPerson
                        );
                    }
                );
            }
        );


        const selectAll =
            document.getElementById(
                "attendanceSelectAllPending"
            );


        if (
            selectAll
        ) {

            selectAll.checked =
                false;
        }
    }


    function getSelectedPendingPeople() {

        const values =
            [
                ...document.querySelectorAll(
                    "#attendanceDailyBody [data-attendance-pending-person]:checked"
                )
            ]
            .map(
                input =>
                    String(
                        input.dataset.attendancePendingPerson ||
                        ""
                    )
            )
            .filter(
                Boolean
            );


        return filteredPersonnel()
            .filter(
                person =>
                    values.includes(
                        personId(
                            person
                        ) ||
                        personName(
                            person
                        )
                    )
            );
    }


    function saveExplanation(
        person,
        date,
        crew,
        shiftType,
        workType,
        remark,
        countAttendance
    ) {

        const records =
            readArray(
                KEY.CONFIRMATIONS
            );


        const id =
            confirmationId(
                person,
                date
            );


        const index =
            records.findIndex(
                item =>
                    item.confirmationId ===
                        id
            );


        const previous =
            index >=
                0
                ? records[
                    index
                  ]
                : {};


        const shift =
            shiftUnitsFromType(
                shiftType
            );


        const now =
            new Date()
            .toISOString();


        const record = {
            ...previous,

            confirmationId:
                id,

            personId:
                personId(
                    person
                ),

            personName:
                personName(
                    person
                ),

            employeeNo:
                person.employeeNo ||
                "",

            position:
                normalizePosition(
                    person.position
                ),

            crew,

            date,

            shiftType,

            whiteUnits:
                shift.white,

            nightUnits:
                shift.night,

            shiftAttendanceUnits:
                shift.total,

            onePointFive:
                shift.onePointFive,

            explanationConfirmed:
                true,

            workType,

            remark,

            countAttendance:
                Boolean(
                    countAttendance
                ),

            explanationConfirmedAt:
                now,

            confirmedBy:
                crew +
                "调度",

            updatedAt:
                now
        };


        if (
            index >=
            0
        ) {

            records[
                index
            ] =
                record;

        } else {

            records.push(
                record
            );
        }


        saveArray(
            KEY.CONFIRMATIONS,
            records
        );
    }


    function applyBulkExplanation(
        countAttendance
    ) {

        const {
            date,
            crew,
            shiftType
        } =
            selectedDailyContext();


        if (
            !crew ||
            !isValidShiftType(
                shiftType
            )
        ) {

            alert(
                "请先选择生产A组 / 生产B组和考勤班次。"
            );

            return;
        }


        const people =
            getSelectedPendingPeople();


        if (
            !people.length
        ) {

            alert(
                "请先勾选需要批量说明的人员。"
            );

            return;
        }


        const reason =
            document
                .getElementById(
                    "attendanceBulkReason"
                )
                ?.value ||
            "";


        const remark =
            document
                .getElementById(
                    "attendanceBulkRemark"
                )
                ?.value
                ?.trim() ||
            "";


        if (
            !reason
        ) {

            alert(
                "请选择批量原因。"
            );

            return;
        }


        if (
            reason ===
                "其他" &&
            !remark
        ) {

            alert(
                "原因选择“其他”时，请填写批量说明。"
            );

            return;
        }


        people.forEach(
            person => {

                saveExplanation(
                    person,
                    date,
                    crew,
                    shiftType,
                    reason,
                    remark,
                    countAttendance
                );
            }
        );


        renderDaily();


        alert(
            "已批量处理 " +
            people.length +
            " 人。\n\n" +
            (
                countAttendance
                    ? "本批人员按所选班次计入考勤。"
                    : "本批人员确认不计考勤。"
            )
        );
    }


    function openExplanation(
        personValue
    ) {

        const {
            date,
            crew,
            shiftType
        } =
            selectedDailyContext();


        const person =
            filteredPersonnel()
            .find(
                item =>
                    (
                        personId(
                            item
                        ) ||
                        personName(
                            item
                        )
                    ) ===
                        String(
                            personValue
                        )
            );


        if (
            !person
        ) {

            alert(
                "没有找到该人员。"
            );

            return;
        }


        const row =
            dailyRow(
                person,
                date,
                shiftType
            );


        if (
            !row.needsExplanation
        ) {

            alert(
                "该人员当前不需要零车数说明。"
            );

            renderDaily();

            return;
        }


        currentConfirmContext = {
            person,
            date,
            crew,
            shiftType
        };


        const box =
            document.getElementById(
                "attendanceConfirmPerson"
            );


        if (
            box
        ) {

            box.innerHTML =
                "<strong>" +
                esc(
                    personName(
                        person
                    ) ||
                    "-"
                ) +
                "</strong>" +
                " · " +
                esc(
                    normalizePosition(
                        person.position
                    ) ||
                    "-"
                ) +
                " · " +
                esc(
                    crew
                ) +
                "<br>" +
                "日期：" +
                esc(
                    date
                ) +
                " · 班次：" +
                esc(
                    shiftType
                ) +
                " · 分车/设备：" +
                esc(
                    row.assets.length
                        ? row.assets.join(
                            " / "
                          )
                        : "-"
                ) +
                "<br>" +
                "生产车数：0 · 打卡：" +
                esc(
                    row.punch.label
                );
        }


        const existing =
            row.confirmation;


        const workType =
            document.getElementById(
                "attendanceConfirmWorkType"
            );


        const count =
            document.getElementById(
                "attendanceConfirmCount"
            );


        const remark =
            document.getElementById(
                "attendanceConfirmRemark"
            );


        if (
            workType
        ) {

            workType.value =
                existing?.workType ||
                "";
        }


        if (
            count
        ) {

            count.value =
                existing?.countAttendance ===
                    false
                    ? "no"
                    : "yes";
        }


        if (
            remark
        ) {

            remark.value =
                existing?.remark ||
                "";
        }


        document
            .getElementById(
                "attendanceConfirmModal"
            )
            ?.classList
            .remove(
                "hidden"
            );
    }


    function closeExplanation() {

        currentConfirmContext =
            null;


        document
            .getElementById(
                "attendanceConfirmModal"
            )
            ?.classList
            .add(
                "hidden"
            );
    }


    function saveSingleExplanation() {

        if (
            !currentConfirmContext
        ) {

            return;
        }


        const workType =
            document
                .getElementById(
                    "attendanceConfirmWorkType"
                )
                ?.value ||
            "";


        const countAttendance =
            document
                .getElementById(
                    "attendanceConfirmCount"
                )
                ?.value ===
            "yes";


        const remark =
            document
                .getElementById(
                    "attendanceConfirmRemark"
                )
                ?.value
                ?.trim() ||
            "";


        if (
            !workType
        ) {

            alert(
                "请选择实际情况。"
            );

            return;
        }


        if (
            workType ===
                "其他" &&
            !remark
        ) {

            alert(
                "选择“其他”时，请填写调度说明。"
            );

            return;
        }


        const {
            person,
            date,
            crew,
            shiftType
        } =
            currentConfirmContext;


        saveExplanation(
            person,
            date,
            crew,
            shiftType,
            workType,
            remark,
            countAttendance
        );


        closeExplanation();

        renderDaily();
    }


    function confirmAttendanceBatch() {

        const {
            date,
            crew,
            shiftType
        } =
            selectedDailyContext();


        if (
            !crew ||
            !isValidShiftType(
                shiftType
            )
        ) {

            alert(
                "请先选择生产A组 / 生产B组和考勤班次。"
            );

            return;
        }


        const rows =
            visibleRows();


        if (
            !rows.length
        ) {

            alert(
                "当前班组没有可确认人员。"
            );

            return;
        }


        const unresolved =
            rows.filter(
                row =>
                    row.pending
            );


        if (
            unresolved.length
        ) {

            alert(
                "还有 " +
                unresolved.length +
                " 名人员没有请假、没有车数，也没有调度说明。\n\n" +
                "请先逐个说明或使用“全选待说明人员”批量处理。"
            );

            return;
        }


        const shift =
            shiftUnitsFromType(
                shiftType
            );


        const records =
            readArray(
                KEY.CONFIRMATIONS
            );


        const now =
            new Date()
            .toISOString();


        rows.forEach(
            row => {

                const id =
                    confirmationId(
                        row.person,
                        date
                    );


                const index =
                    records.findIndex(
                        item =>
                            item.confirmationId ===
                                id
                    );


                const previous =
                    index >=
                        0
                        ? records[
                            index
                          ]
                        : {};


                const record = {
                    ...previous,

                    confirmationId:
                        id,

                    personId:
                        personId(
                            row.person
                        ),

                    personName:
                        personName(
                            row.person
                        ),

                    employeeNo:
                        row.person.employeeNo ||
                        "",

                    position:
                        normalizePosition(
                            row.person.position
                        ),

                    crew,

                    date,

                    shiftType,

                    whiteUnits:
                        shift.white,

                    nightUnits:
                        shift.night,

                    shiftAttendanceUnits:
                        shift.total,

                    onePointFive:
                        shift.onePointFive,

                    productionCount:
                        row.trips,

                    assignedAssets:
                        row.assets,

                    leaveLabels:
                        row.leave.labels,

                    leaveDeduction:
                        row.leave.deduction,

                    rotationPaid:
                        row.leave.rotationPaid,

                    attendanceSource:
                        row.source,

                    countAttendance:
                        row.source ===
                            "explanation"
                            ? previous.countAttendance !==
                                false
                            : row.attendanceValue >
                                0,

                    confirmedAttendance:
                        row.attendanceValue,

                    batchConfirmed:
                        true,

                    batchConfirmedAt:
                        now,

                    confirmedBy:
                        crew +
                        "调度",

                    updatedAt:
                        now
                };


                if (
                    row.source ===
                        "production"
                ) {

                    record.workType =
                        "正常生产";

                    record.remark =
                        "有生产车数，按所选班次自动计勤。";
                }


                if (
                    row.source ===
                        "leave"
                ) {

                    record.workType =
                        "请假";

                    record.remark =
                        row.leave.labels.join(
                            "、"
                        );
                }


                if (
                    index >=
                    0
                ) {

                    records[
                        index
                    ] =
                        record;

                } else {

                    records.push(
                        record
                    );
                }
            }
        );


        saveArray(
            KEY.CONFIRMATIONS,
            records
        );


        const batches =
            readArray(
                KEY.BATCHES
            );


        const id =
            batchId(
                date,
                crew
            );


        const batchIndex =
            batches.findIndex(
                item =>
                    item.batchId ===
                        id
            );


        const batchRecord = {
            batchId:
                id,

            date,

            crew,

            shiftType,

            personCount:
                rows.length,

            attendanceTotal:
                rows.reduce(
                    (
                        sum,
                        row
                    ) =>
                        sum +
                        row.attendanceValue,
                    0
                ),

            productionAttendanceCount:
                rows.filter(
                    row =>
                        row.source ===
                            "production"
                )
                .length,

            leaveCount:
                rows.filter(
                    row =>
                        row.source ===
                            "leave"
                )
                .length,

            explainedZeroCount:
                rows.filter(
                    row =>
                        row.source ===
                            "explanation"
                )
                .length,

            confirmedAt:
                now,

            confirmedBy:
                crew +
                "调度",

            sourceVersion:
                "V2.10.6E"
        };


        if (
            batchIndex >=
            0
        ) {

            batches[
                batchIndex
            ] =
                batchRecord;

        } else {

            batches.push(
                batchRecord
            );
        }


        saveArray(
            KEY.BATCHES,
            batches
        );


        renderDaily();

        renderMonthly();


        alert(
            date +
            " " +
            crew +
            " " +
            shiftType +
            " 考勤确认完成。\n\n" +
            "人员：" +
            rows.length +
            " 人\n" +
            "合计考勤：" +
            unit(
                batchRecord.attendanceTotal
            ) +
            "\n\n最终考勤仍由管理员统一审核确认。"
        );
    }


    function monthDates(month) {

        if (
            !/^\d{4}-\d{2}$/
                .test(
                    month
                )
        ) {

            return [];
        }


        const [
            year,
            monthNumber
        ] =
            month
            .split(
                "-"
            )
            .map(
                Number
            );


        const lastDay =
            new Date(
                year,
                monthNumber,
                0
            )
            .getDate();


        const current =
            todayKey();


        const dates =
            [];


        for (
            let day = 1;
            day <=
                lastDay;
            day += 1
        ) {

            const key =
                month +
                "-" +
                String(
                    day
                )
                .padStart(
                    2,
                    "0"
                );


            if (
                key >
                current
            ) {

                break;
            }


            dates.push(
                key
            );
        }


        return dates;
    }


    function personActivityDates(
        person,
        month
    ) {

        const dates =
            new Set();


        readArray(
            KEY.ATTENDANCE
        )
        .filter(
            item =>
                samePerson(
                    person,
                    item
                ) &&
                String(
                    item.date ||
                    ""
                )
                .startsWith(
                    month
                )
        )
        .forEach(
            item =>
                dates.add(
                    String(
                        item.date
                    )
                    .slice(
                        0,
                        10
                    )
                )
        );


        officialTrips()
        .filter(
            item =>
                samePerson(
                    person,
                    item
                )
        )
        .forEach(
            item => {

                const date =
                    String(
                        item.completedAt ||
                        item.unloadedAt ||
                        item.createdAt ||
                        item.date ||
                        ""
                    )
                    .slice(
                        0,
                        10
                    );


                if (
                    date.startsWith(
                        month
                    )
                ) {

                    dates.add(
                        date
                    );
                }
            }
        );


        allLeaveRecords()
        .filter(
            item =>
                samePerson(
                    person,
                    item
                )
        )
        .forEach(
            item => {

                leaveSlots(
                    item
                )
                .forEach(
                    slot => {

                        if (
                            slot.date.startsWith(
                                month
                            )
                        ) {

                            dates.add(
                                slot.date
                            );
                        }
                    }
                );
            }
        );


        return dates;
    }


    function monthlyPersonSummary(
        person,
        month
    ) {

        const confirmations =
            readArray(
                KEY.CONFIRMATIONS
            )
            .filter(
                item =>
                    samePerson(
                        person,
                        item
                    ) &&
                    String(
                        item.date ||
                        ""
                    )
                    .startsWith(
                        month
                    ) &&
                    item.batchConfirmed ===
                        true
            );


        const confirmedDates =
            new Set(
                confirmations.map(
                    item =>
                        String(
                            item.date
                        )
                        .slice(
                            0,
                            10
                        )
                )
            );


        const activityDates =
            personActivityDates(
                person,
                month
            );


        let pending =
            0;


        activityDates.forEach(
            date => {

                if (
                    !confirmedDates.has(
                        date
                    )
                ) {

                    pending +=
                        1;
                }
            }
        );


        return {
            person,

            attendance:
                confirmations.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.confirmedAttendance ||
                            0
                        ),
                    0
                ),

            white:
                confirmations.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.whiteUnits ||
                            0
                        ),
                    0
                ),

            night:
                confirmations.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.nightUnits ||
                            0
                        ),
                    0
                ),

            onePointFiveDays:
                confirmations.filter(
                    item =>
                        item.onePointFive ===
                            true
                )
                .length,

            deduction:
                confirmations.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.leaveDeduction ||
                            0
                        ),
                    0
                ),

            rotationPaid:
                confirmations.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.rotationPaid ||
                            0
                        ),
                    0
                ),

            zeroExplained:
                confirmations.filter(
                    item =>
                        item.explanationConfirmed ===
                            true
                )
                .length,

            pending
        };
    }


    function renderMonthly() {

        const body =
            document.getElementById(
                "attendanceMonthlyBody"
            );


        if (
            !body
        ) {

            return;
        }


        const crew =
            selectedCrew();


        if (
            !crew
        ) {

            body.innerHTML =
                '<tr><td colspan="9" class="attendance-review-empty">请先选择生产A组或生产B组。</td></tr>';

            return;
        }


        const month =
            document
                .getElementById(
                    "attendanceReviewMonth"
                )
                ?.value ||
            monthKey();


        const rows =
            filteredPersonnel()
            .map(
                person =>
                    monthlyPersonSummary(
                        person,
                        month
                    )
            );


        if (
            !rows.length
        ) {

            body.innerHTML =
                '<tr><td colspan="9" class="attendance-review-empty">当前班组暂无月度人员数据。</td></tr>';

            return;
        }


        body.innerHTML =
            rows
            .map(
                row => `
                    <tr>
                        <td>
                            <div class="attendance-review-name">
                                ${esc(personName(row.person) || "-")}
                            </div>

                            <div class="attendance-review-sub">
                                ${esc(normalizePosition(row.person.position) || "-")}
                                · ${esc(row.person.employeeNo || personId(row.person) || "-")}
                            </div>
                        </td>

                        <td class="attendance-month-positive">
                            ${unit(row.attendance)}
                        </td>

                        <td>${unit(row.white)}</td>

                        <td>${unit(row.night)}</td>

                        <td>${esc(row.onePointFiveDays)}</td>

                        <td>${unit(row.deduction)}</td>

                        <td>${unit(row.rotationPaid)}</td>

                        <td>${esc(row.zeroExplained)} 天</td>

                        <td class="${row.pending > 0 ? "attendance-month-warning" : ""}">
                            ${esc(row.pending)} 条
                        </td>
                    </tr>
                `
            )
            .join(
                ""
            );
    }


    function refreshAll() {

        renderDaily();

        renderMonthly();
    }


    function openReview() {

        const modal =
            document.getElementById(
                "attendanceReviewModal"
            );


        if (
            !modal
        ) {

            return;
        }


        const date =
            document.getElementById(
                "attendanceReviewDate"
            );


        const month =
            document.getElementById(
                "attendanceReviewMonth"
            );


        if (
            date &&
            !date.value
        ) {

            date.value =
                todayKey();
        }


        if (
            month &&
            !month.value
        ) {

            month.value =
                monthKey();
        }


        refreshAll();


        modal.classList.remove(
            "hidden"
        );
    }


    function closeReview() {

        document
            .getElementById(
                "attendanceReviewModal"
            )
            ?.classList
            .add(
                "hidden"
            );
    }


    function setTab(tab) {

        const monthly =
            tab ===
                "monthly";


        document
            .getElementById(
                "attendanceDailyTab"
            )
            ?.classList
            .toggle(
                "active",
                !monthly
            );


        document
            .getElementById(
                "attendanceMonthlyTab"
            )
            ?.classList
            .toggle(
                "active",
                monthly
            );


        document
            .getElementById(
                "attendanceDailyPanel"
            )
            ?.classList
            .toggle(
                "hidden",
                monthly
            );


        document
            .getElementById(
                "attendanceMonthlyPanel"
            )
            ?.classList
            .toggle(
                "hidden",
                !monthly
            );


        if (
            monthly
        ) {

            renderMonthly();

        } else {

            renderDaily();
        }
    }


    document
        .getElementById(
            "attendanceReviewButton"
        )
        ?.addEventListener(
            "click",
            openReview
        );


    document
        .getElementById(
            "closeAttendanceReviewModal"
        )
        ?.addEventListener(
            "click",
            closeReview
        );


    document
        .getElementById(
            "attendanceReviewModal"
        )
        ?.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    this
                ) {

                    closeReview();
                }
            }
        );


    document
        .getElementById(
            "attendanceConfirmModal"
        )
        ?.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    this
                ) {

                    closeExplanation();
                }
            }
        );


    document
        .getElementById(
            "cancelAttendanceConfirmationButton"
        )
        ?.addEventListener(
            "click",
            closeExplanation
        );


    document
        .getElementById(
            "saveAttendanceConfirmationButton"
        )
        ?.addEventListener(
            "click",
            saveSingleExplanation
        );


    [
        "attendanceReviewDate",
        "attendanceReviewCrew",
        "attendanceReviewShiftType"
    ]
    .forEach(
        id => {

            document
                .getElementById(
                    id
                )
                ?.addEventListener(
                    "change",
                    refreshAll
                );
        }
    );


    document
        .getElementById(
            "attendanceReviewMonth"
        )
        ?.addEventListener(
            "change",
            renderMonthly
        );


    document
        .getElementById(
            "attendanceSelectAllPending"
        )
        ?.addEventListener(
            "change",
            function () {

                const checked =
                    this.checked;


                document
                    .querySelectorAll(
                        "#attendanceDailyBody [data-attendance-pending-person]"
                    )
                    .forEach(
                        input => {

                            input.checked =
                                checked;
                        }
                    );
            }
        );


    document
        .getElementById(
            "attendanceBulkCountButton"
        )
        ?.addEventListener(
            "click",
            () =>
                applyBulkExplanation(
                    true
                )
        );


    document
        .getElementById(
            "attendanceBulkNoCountButton"
        )
        ?.addEventListener(
            "click",
            () =>
                applyBulkExplanation(
                    false
                )
        );


    document
        .getElementById(
            "confirmAttendanceBatchButton"
        )
        ?.addEventListener(
            "click",
            confirmAttendanceBatch
        );


    document
        .getElementById(
            "attendanceDailyTab"
        )
        ?.addEventListener(
            "click",
            () =>
                setTab(
                    "daily"
                )
        );


    document
        .getElementById(
            "attendanceMonthlyTab"
        )
        ?.addEventListener(
            "click",
            () =>
                setTab(
                    "monthly"
                )
        );


    window.addEventListener(
        "storage",
        function (event) {

            if (
                [
                    KEY.PERSONNEL,
                    KEY.ATTENDANCE,
                    KEY.SHIFTS,
                    KEY.TRIPS,
                    KEY.LEGACY_TRIPS,
                    KEY.CONFIRMATIONS,
                    KEY.BATCHES,
                    ...KEY.LEAVE_KEYS
                ]
                .includes(
                    event.key
                )
            ) {

                refreshAll();
            }
        }
    );

    /* =========================================================
       V2.11.0B
       对外暴露调度人员筛选接口
       供生产系统其他模块及自动化回归读取
    ========================================================= */

    window.approvedPersonnel = approvedPersonnel;


})();

(function initDispatchRewardPenaltyOvertime() {

    const KEY = {
        PERSONNEL: "personnelRecords",
        SHIFTS: "dispatchShiftExecutions",
        TASKS: "dispatchPublishedTasks",
        REWARDS: "rewardRecords",
        PENALTIES: "penaltyRecords",
        OVERTIME: "overtimeRecords"
    };


    function readArray(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }


    function saveArray(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }


    function esc(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }


    function todayKey() {
        const date = new Date();

        return (
            date.getFullYear() +
            "-" +
            String(date.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(date.getDate()).padStart(2, "0")
        );
    }


    function monthKey() {
        return todayKey().slice(0, 7);
    }


    function personId(person) {
        return String(
            person?.personId ||
            person?.employeeId ||
            person?.driverId ||
            person?.id ||
            person?.employeeNo ||
            ""
        ).trim();
    }


    function personName(person) {
        return String(
            person?.name ||
            person?.personName ||
            person?.driverName ||
            person?.workerName ||
            ""
        ).trim();
    }


    function employeeNo(person) {
        return String(
            person?.employeeNo ||
            person?.employeeId ||
            person?.personId ||
            person?.driverId ||
            person?.id ||
            "-"
        ).trim();
    }


    function normalizePosition(position) {
        const map = {
            "卡车司机": "汽车司机",
            "挖掘机司机": "挖机司机",
            "挖掘机操作手": "挖机司机",
            "挖机操作手": "挖机司机"
        };

        return map[position] || position || "";
    }


    function isApproved(person) {
        if (
            !person ||
            person.enabled === false ||
            person.status === "rejected" ||
            person.approvalStatus === "rejected" ||
            person.status === "disabled" ||
            person.status === "resigned" ||
            person.status === "pending" ||
            person.status === "leave" ||
            person.approvalStatus === "pending" ||
            person.personnelStatus === "停用" ||
            person.personnelStatus === "离职" ||
            person.personnelStatus === "待审核" ||
            person.personnelStatus === "请假"
        ) {
            return false;
        }

        return (
            person.approvalStatus === "approved" ||
            person.status === "approved" ||
            person.status === "active" ||
            person.status === "working" ||
            person.personnelStatus === "在职可用" ||
            person.personnelStatus === "作业中"
        );
    }


    function crew(person) {

        const primaryTeam =
            String(
                person?.team ||
                ""
            )
            .trim();


        if (
            primaryTeam ===
                "生产A组"
        ) {
            return "生产A组";
        }


        if (
            primaryTeam ===
                "生产B组"
        ) {
            return "生产B组";
        }


        if (
            [
                "修理组",
                "后勤办公组"
            ]
            .includes(
                primaryTeam
            )
        ) {
            return "";
        }


        const legacyRaw = [
            person?.attendanceCrew,
            person?.shiftGroup,
            person?.workGroup,
            person?.crew,
            person?.department,
            person?.group
        ]
        .filter(Boolean)
        .join(" ");


        if (
            /(^|[^A-Z])A班|A组|生产A|山一车队/i
                .test(
                    legacyRaw
                )
        ) {
            return "生产A组";
        }


        if (
            /(^|[^A-Z])B班|B组|生产B|山二车队/i
                .test(
                    legacyRaw
                )
        ) {
            return "生产B组";
        }


        return "";
    }


    function samePerson(person, item) {
        if (!person || !item) {
            return false;
        }

        const leftId = personId(person);

        const rightId = String(
            item.personId ||
            item.driverId ||
            item.employeeId ||
            item.workerId ||
            item.operatorId ||
            item.id ||
            item.employeeNo ||
            ""
        ).trim();

        if (leftId && rightId) {
            return leftId === rightId;
        }

        const leftName = personName(person);

        const rightName = String(
            item.personName ||
            item.driverName ||
            item.workerName ||
            item.operatorName ||
            item.name ||
            ""
        ).trim();

        return Boolean(
            leftName &&
            rightName &&
            leftName === rightName
        );
    }


    function frontlinePeopleByCrew(selectedCrew) {
        if (!["生产A组", "生产B组"].includes(selectedCrew)) {
            return [];
        }

        return readArray(KEY.PERSONNEL)
            .filter(
                person =>
                    isApproved(person) &&
                    crew(person) === selectedCrew
            )
            .sort(
                (a, b) =>
                    personName(a).localeCompare(
                        personName(b),
                        "zh-CN"
                    )
            );
    }


    function assignmentVehicleNumbers(person, workDate) {
        const exactDate = String(workDate || "").slice(0, 10);
        const numbers = [];

        /*
         * 先找所选日期的班次执行记录；
         * 没有则读取当前 active 班次；
         * 最后兼容主生产任务中的绑定。
         */
        let executions = readArray(KEY.SHIFTS)
            .filter(
                item =>
                    String(
                        item.date ||
                        item.shiftDate ||
                        ""
                    ).slice(0, 10) === exactDate
            );

        if (!executions.length) {
            executions = readArray(KEY.SHIFTS)
                .filter(
                    item =>
                        item?.status === "active"
                );
        }

        executions.forEach(execution => {

            (execution.driverAssignments || [])
                .filter(item => samePerson(person, item))
                .forEach(item => {
                    const value =
                        item.vehicleNumber ||
                        item.vehicleId ||
                        item.truckNumber ||
                        item.truckId ||
                        "";

                    if (value) {
                        numbers.push(value);
                    }
                });

            (execution.bindings || [])
                .filter(
                    item =>
                        samePerson(
                            person,
                            {
                                personId:
                                    item.excavatorDriverId ||
                                    item.operatorId ||
                                    "",

                                personName:
                                    item.excavatorDriverName ||
                                    item.operatorName ||
                                    ""
                            }
                        )
                )
                .forEach(item => {
                    const value =
                        item.excavatorNumber ||
                        item.excavatorId ||
                        "";

                    if (value) {
                        numbers.push(value);
                    }
                });

            (execution.auxiliaryAssignments || [])
                .filter(item => samePerson(person, item))
                .forEach(item => {
                    const value =
                        item.vehicleNumber ||
                        item.vehicleId ||
                        item.equipmentNumber ||
                        item.equipmentId ||
                        item.auxiliaryNumber ||
                        "";

                    if (value) {
                        numbers.push(value);
                    }
                });
        });

        if (!numbers.length) {
            readArray(KEY.TASKS)
                .filter(
                    task =>
                        ![
                            "completed",
                            "cancelled",
                            "withdrawn"
                        ].includes(task?.status)
                )
                .forEach(task => {

                    (task.driverAssignments || [])
                        .filter(item => samePerson(person, item))
                        .forEach(item => {
                            const value =
                                item.vehicleNumber ||
                                item.vehicleId ||
                                item.truckNumber ||
                                item.truckId ||
                                "";

                            if (value) {
                                numbers.push(value);
                            }
                        });

                    (task.bindings || [])
                        .filter(
                            item =>
                                samePerson(
                                    person,
                                    {
                                        personId:
                                            item.excavatorDriverId ||
                                            item.operatorId ||
                                            "",

                                        personName:
                                            item.excavatorDriverName ||
                                            item.operatorName ||
                                            ""
                                    }
                                )
                        )
                        .forEach(item => {
                            const value =
                                item.excavatorNumber ||
                                item.excavatorId ||
                                "";

                            if (value) {
                                numbers.push(value);
                            }
                        });
                });
        }

        return [
            ...new Set(
                numbers
                    .map(item => String(item).trim())
                    .filter(Boolean)
            )
        ];
    }


    function refreshPersonOptions() {
        const selectedCrew =
            document.getElementById("rpoCrew")?.value || "";

        const workDate =
            document.getElementById("rpoWorkDate")?.value ||
            todayKey();

        const select =
            document.getElementById("rpoPerson");

        if (!select) {
            return;
        }

        if (!selectedCrew) {
            select.innerHTML =
                '<option value="">请先选择生产班组</option>';
            return;
        }

        const people =
            frontlinePeopleByCrew(selectedCrew);

        if (!people.length) {
            select.innerHTML =
                '<option value="">该生产班组暂无在职人员</option>';
            return;
        }

        select.innerHTML =
            '<option value="">选择人员 / 绑定车号</option>' +
            people
            .map(person => {

                const id =
                    personId(person) ||
                    employeeNo(person) ||
                    personName(person);

                const vehicles =
                    assignmentVehicleNumbers(
                        person,
                        workDate
                    );

                const vehicleText =
                    vehicles.length
                        ? vehicles.join(" / ")
                        : "未绑定车号";

                return (
                    '<option ' +
                    'value="' +
                    esc(id) +
                    '" ' +
                    'data-vehicle="' +
                    esc(vehicles.join(" / ")) +
                    '">' +
                    esc(
                        personName(person) +
                        "｜工号：" +
                        employeeNo(person) +
                        "｜车号：" +
                        vehicleText
                    ) +
                    "</option>"
                );
            })
            .join("");
    }


    function selectedPersonContext() {
        const select =
            document.getElementById("rpoPerson");

        const selectedCrew =
            document.getElementById("rpoCrew")?.value || "";

        const value =
            select?.value || "";

        const person =
            frontlinePeopleByCrew(selectedCrew)
            .find(
                item =>
                    (
                        personId(item) ||
                        employeeNo(item) ||
                        personName(item)
                    ) === value
            )
            ||
            null;

        const option =
            select?.options[
                select.selectedIndex
            ];

        return {
            person,
            vehicleNumber:
                option?.dataset?.vehicle || ""
        };
    }


    function resetForm() {
        const type =
            document.getElementById("rpoRecordType");

        const date =
            document.getElementById("rpoWorkDate");

        const crewSelect =
            document.getElementById("rpoCrew");

        const amount =
            document.getElementById("rpoAmount");

        const description =
            document.getElementById("rpoDescription");

        if (type) {
            type.value = "reward";
        }

        if (date) {
            date.value = todayKey();
        }

        if (crewSelect) {
            crewSelect.value = "";
        }

        if (amount) {
            amount.value = "";
        }

        if (description) {
            description.value = "";
        }

        refreshPersonOptions();
    }


    function openIssue() {
        resetForm();

        document
            .getElementById("rewardPenaltyModal")
            ?.classList
            .remove("hidden");
    }


    function closeIssue() {
        document
            .getElementById("rewardPenaltyModal")
            ?.classList
            .add("hidden");
    }


    function makeId(prefix) {
        return (
            prefix +
            "_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 7)
        );
    }


    function submitRecord() {
        const type =
            document.getElementById("rpoRecordType")?.value || "";

        const workDate =
            document.getElementById("rpoWorkDate")?.value || "";

        const selectedCrew =
            document.getElementById("rpoCrew")?.value || "";

        const context =
            selectedPersonContext();

        const person =
            context.person;

        const vehicleNumber =
            context.vehicleNumber;

        const amount =
            Number(
                document.getElementById("rpoAmount")?.value ||
                0
            );

        const description =
            document
                .getElementById("rpoDescription")
                ?.value
                ?.trim() ||
            "";

        if (!["reward", "penalty", "overtime"].includes(type)) {
            alert("请选择有效类型。");
            return;
        }

        if (!workDate) {
            alert("请选择发生日期。");
            return;
        }

        if (!["生产A组", "生产B组"].includes(selectedCrew)) {
            alert("请选择生产A组或生产B组。");
            return;
        }

        if (!person) {
            alert("请选择人员。");
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            alert("金额必须大于0。");
            return;
        }

        if (!description) {
            alert("请填写奖罚 / 加班事由。");
            return;
        }

        const now =
            new Date().toISOString();

        const common = {
            personId:
                personId(person),

            employeeId:
                person.employeeId || "",

            employeeNo:
                person.employeeNo || "",

            personName:
                personName(person),

            position:
                normalizePosition(person.position),

            crew:
                selectedCrew,

            vehicleNumber,

            amount,

            description,

            workDate,

            date:
                workDate,

            createdAt:
                now,

            issuedAt:
                now,

            issuedBy:
                "车队长 / 调度",

            source:
                "dispatch"
        };

        if (type === "reward") {
            const rows =
                readArray(KEY.REWARDS);

            rows.push({
                ...common,
                rewardId:
                    makeId("REWARD"),
                rewardType:
                    "调度奖励",
                status:
                    "issued"
            });

            saveArray(
                KEY.REWARDS,
                rows
            );

        } else if (type === "penalty") {
            const rows =
                readArray(KEY.PENALTIES);

            rows.push({
                ...common,
                penaltyId:
                    makeId("PENALTY"),
                violationType:
                    "调度罚款",
                penaltyType:
                    "调度罚款",
                points:
                    0,
                status:
                    "pending_acknowledgement"
            });

            saveArray(
                KEY.PENALTIES,
                rows
            );

        } else {
            const rows =
                readArray(KEY.OVERTIME);

            rows.push({
                ...common,
                overtimeId:
                    makeId("OVERTIME"),
                overtimeType:
                    "调度加班",
                status:
                    "issued"
            });

            saveArray(
                KEY.OVERTIME,
                rows
            );
        }

        closeIssue();
        refreshManagerCount();

        alert(
            (
                type === "reward"
                    ? "奖励"
                    : (
                        type === "penalty"
                            ? "罚款"
                            : "加班"
                      )
            ) +
            "记录已保存。"
        );
    }


    function normalizeRecord(type, item) {
        return {
            type,

            personName:
                item.personName ||
                item.driverName ||
                item.name ||
                "",

            employeeNo:
                item.employeeNo ||
                item.employeeId ||
                "",

            position:
                item.position || "",

            crew:
                item.crew || "",

            vehicleNumber:
                item.vehicleNumber || "",

            amount:
                Number(
                    item.amount ||
                    item.rewardAmount ||
                    item.penaltyAmount ||
                    0
                ),

            description:
                item.description ||
                item.remark ||
                "",

            date:
                String(
                    item.workDate ||
                    item.date ||
                    item.createdAt ||
                    item.issuedAt ||
                    ""
                )
                .slice(0, 10),

            createdAt:
                item.createdAt ||
                item.issuedAt ||
                "",

            status:
                item.status || "issued"
        };
    }


    function allRecords() {
        return [
            ...readArray(KEY.REWARDS)
                .map(
                    item =>
                        normalizeRecord(
                            "reward",
                            item
                        )
                ),

            ...readArray(KEY.PENALTIES)
                .map(
                    item =>
                        normalizeRecord(
                            "penalty",
                            item
                        )
                ),

            ...readArray(KEY.OVERTIME)
                .map(
                    item =>
                        normalizeRecord(
                            "overtime",
                            item
                        )
                )
        ]
        .sort(
            (a, b) =>
                new Date(
                    b.createdAt ||
                    b.date
                ) -
                new Date(
                    a.createdAt ||
                    a.date
                )
        );
    }


    function recordMonth(record) {
        return String(
            record.date || ""
        )
        .slice(0, 7);
    }


    function refreshManagerCount() {
        const count =
            allRecords()
            .filter(
                item =>
                    recordMonth(item) === monthKey() &&
                    item.status !== "cancelled" &&
                    item.status !== "rejected"
            )
            .length;

        const box =
            document.getElementById(
                "rewardPenaltyTodoCount"
            );

        if (box) {
            box.textContent =
                String(count);
        }
    }


    function openManager() {
        const month =
            document.getElementById("rpoManagerMonth");

        if (month && !month.value) {
            month.value = monthKey();
        }

        renderManager();

        document
            .getElementById("rewardPenaltyManagerModal")
            ?.classList
            .remove("hidden");
    }


    function closeManager() {
        document
            .getElementById("rewardPenaltyManagerModal")
            ?.classList
            .add("hidden");
    }


    function renderManager() {
        const list =
            document.getElementById(
                "rewardPenaltyManagerList"
            );

        if (!list) {
            return;
        }

        const month =
            document.getElementById("rpoManagerMonth")?.value ||
            monthKey();

        const type =
            document.getElementById("rpoManagerType")?.value ||
            "";

        const rows =
            allRecords()
            .filter(
                item =>
                    recordMonth(item) === month &&
                    (
                        !type ||
                        item.type === type
                    )
            );

        const activeRows =
            rows.filter(
                item =>
                    item.status !== "cancelled" &&
                    item.status !== "rejected"
            );

        const rewardTotal =
            activeRows
            .filter(item => item.type === "reward")
            .reduce((sum, item) => sum + item.amount, 0);

        const penaltyTotal =
            activeRows
            .filter(item => item.type === "penalty")
            .reduce((sum, item) => sum + item.amount, 0);

        const overtimeAmount =
            activeRows
            .filter(item => item.type === "overtime")
            .reduce((sum, item) => sum + item.amount, 0);

        const mapping = {
            rpoRewardTotal:
                rewardTotal.toFixed(2),

            rpoPenaltyTotal:
                penaltyTotal.toFixed(2),

            rpoOvertimeAmountTotal:
                overtimeAmount.toFixed(2),

            rpoRecordTotal:
                String(activeRows.length)
        };

        Object.entries(mapping)
        .forEach(([id, value]) => {
            const element =
                document.getElementById(id);

            if (element) {
                element.textContent = value;
            }
        });

        if (!rows.length) {
            list.innerHTML =
                '<div class="dispatch-rpo-empty">当前月份暂无奖罚 / 加班记录。</div>';
            return;
        }

        list.innerHTML =
            rows.map(item => {

                const typeText =
                    item.type === "reward"
                        ? "奖励"
                        : (
                            item.type === "penalty"
                                ? "罚款"
                                : "加班"
                          );

                const cancelled =
                    item.status === "cancelled" ||
                    item.status === "rejected";

                return `
                    <div class="dispatch-rpo-card">

                        <div class="dispatch-rpo-card-top">

                            <div>
                                <div class="dispatch-rpo-card-title">
                                    ${esc(item.personName || "-")}
                                    ·
                                    ${typeText}
                                </div>

                                <div class="dispatch-rpo-card-sub">
                                    ${esc(item.date || "-")}
                                    ·
                                    ${esc(item.crew || "-")}
                                    ·
                                    工号：${esc(item.employeeNo || "-")}
                                </div>
                            </div>

                            <span class="dispatch-rpo-badge ${
                                cancelled
                                    ? "cancelled"
                                    : item.type
                            }">
                                ${
                                    cancelled
                                        ? "已撤销"
                                        : typeText
                                }
                            </span>

                        </div>

                        <div class="dispatch-rpo-card-grid">

                            <div>
                                <span>金额</span>
                                <strong>¥ ${item.amount.toFixed(2)}</strong>
                            </div>

                            <div>
                                <span>绑定车号</span>
                                <strong>${esc(item.vehicleNumber || "未绑定")}</strong>
                            </div>

                            <div>
                                <span>岗位</span>
                                <strong>${esc(item.position || "-")}</strong>
                            </div>

                            <div>
                                <span>状态</span>
                                <strong>${esc(item.status || "-")}</strong>
                            </div>

                        </div>

                        <div class="dispatch-rpo-note" style="margin-bottom:0;">
                            <strong>事由：</strong>
                            ${esc(item.description || "-")}
                        </div>

                    </div>
                `;
            })
            .join("");
    }


    document
        .getElementById("issueRewardPenaltyButton")
        ?.addEventListener(
            "click",
            openIssue
        );


    document
        .getElementById("closeRewardPenaltyModal")
        ?.addEventListener(
            "click",
            closeIssue
        );


    document
        .getElementById("submitRewardPenaltyButton")
        ?.addEventListener(
            "click",
            submitRecord
        );


    document
        .getElementById("rpoCrew")
        ?.addEventListener(
            "change",
            refreshPersonOptions
        );


    document
        .getElementById("rpoWorkDate")
        ?.addEventListener(
            "change",
            refreshPersonOptions
        );


    document
        .getElementById("openRewardPenaltyManagerButton")
        ?.addEventListener(
            "click",
            openManager
        );


    document
        .getElementById("closeRewardPenaltyManagerModal")
        ?.addEventListener(
            "click",
            closeManager
        );


    [
        "rpoManagerMonth",
        "rpoManagerType"
    ]
    .forEach(id => {
        document
            .getElementById(id)
            ?.addEventListener(
                "change",
                renderManager
            );
    });


    document
        .getElementById("rewardPenaltyModal")
        ?.addEventListener(
            "click",
            function (event) {
                if (event.target === this) {
                    closeIssue();
                }
            }
        );


    document
        .getElementById("rewardPenaltyManagerModal")
        ?.addEventListener(
            "click",
            function (event) {
                if (event.target === this) {
                    closeManager();
                }
            }
        );


    window.addEventListener(
        "storage",
        function (event) {
            if (
                [
                    KEY.PERSONNEL,
                    KEY.SHIFTS,
                    KEY.TASKS,
                    KEY.REWARDS,
                    KEY.PENALTIES,
                    KEY.OVERTIME
                ]
                .includes(event.key)
            ) {
                refreshPersonOptions();
                refreshManagerCount();
                renderManager();
            }
        }
    );


    refreshPersonOptions();
    refreshManagerCount();

})();

"use strict";

/* =========================================================
   V2.13.7 临时非卸载区卸料审核

   来源：
   localStorage.temporaryUnloadRequests

   待审核：
   status = pending_dispatch

   审核通过：
   1. request.status = approved
   2. 生成一条正式 tripRecords
   3. officialCountEligible = true
   4. 调度端 / 报表端按正常运输趟次统计

   驳回：
   1. request.status = rejected
   2. 不生成正式趟次
========================================================= */

const TEMP_UNLOAD_REQUEST_KEY =
    "temporaryUnloadRequests";

const TEMP_UNLOAD_TRIP_KEY =
    "tripRecords";


function temporaryUnloadReadArray(
    key
) {

    try {

        const rows =
            JSON.parse(
                localStorage.getItem(
                    key
                ) ||
                "[]"
            );


        return Array.isArray(
            rows
        )
            ? rows
            : [];


    } catch (
        error
    ) {

        return [];
    }
}


function temporaryUnloadWriteArray(
    key,
    rows
) {

    localStorage.setItem(
        key,
        JSON.stringify(
            rows
        )
    );
}


function temporaryUnloadEscape(
    value
) {

    const box =
        document.createElement(
            "div"
        );


    box.textContent =
        String(
            value ??
            ""
        );


    return box.innerHTML;
}


function temporaryUnloadFormatTime(
    value
) {

    if (
        !value
    ) {

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

        return String(
            value
        );
    }


    return date.toLocaleString(
        "zh-CN"
    );
}


function temporaryUnloadPendingRows() {

    return temporaryUnloadReadArray(
        TEMP_UNLOAD_REQUEST_KEY
    )
    .filter(
        item =>
            item &&
            String(
                item.status ||
                ""
            ) ===
                "pending_dispatch"
    )
    .sort(
        (
            a,
            b
        ) =>
            new Date(
                b.createdAt ||
                0
            )
            -
            new Date(
                a.createdAt ||
                0
            )
    );
}


function temporaryUnloadTripId(
    request
) {

    return (
        "TEMP-UNLOAD-TRIP-" +
        String(
            request.requestId ||
            ""
        )
    );
}


function temporaryUnloadOfficialTripExists(
    request
) {

    const tripId =
        temporaryUnloadTripId(
            request
        );


    return temporaryUnloadReadArray(
        TEMP_UNLOAD_TRIP_KEY
    )
    .some(
        item =>
            String(
                item.tripId ||
                item.recordId ||
                item.id ||
                ""
            ) ===
                tripId
            ||
            String(
                item.temporaryUnloadRequestId ||
                ""
            ) ===
                String(
                    request.requestId ||
                    ""
                )
    );
}


function temporaryUnloadBuildOfficialTrip(
    request
) {

    const tripId =
        temporaryUnloadTripId(
            request
        );


    const completedAt =
        request?.temporaryUnloadGps?.timestamp ||
        request?.createdAt ||
        new Date()
            .toISOString();


    return {

        tripId,
        recordId:
            tripId,

        taskId:
            request.taskId ||
            request.dispatchTaskId ||
            "",

        dispatchTaskId:
            request.dispatchTaskId ||
            request.taskId ||
            "",

        shiftId:
            request.shiftId ||
            "",

        shift:
            request.shift ||
            "",

        shiftDate:
            request.shiftDate ||
            "",

        driverId:
            request.driverId ||
            request.personId ||
            "",

        personId:
            request.personId ||
            request.driverId ||
            "",

        driverName:
            request.driverName ||
            "",

        vehicleId:
            request.vehicleId ||
            request.vehicleNumber ||
            "",

        vehicleNumber:
            request.vehicleNumber ||
            request.vehicleId ||
            "",

        excavatorId:
            request.excavatorId ||
            request.excavatorNumber ||
            "",

        excavatorNumber:
            request.excavatorNumber ||
            request.excavatorId ||
            "",

        loadingZoneId:
            request.loadingZoneId ||
            "",

        loadingZoneName:
            request.loadingZoneName ||
            "",

        loadingPoint:
            request.loadingZoneName ||
            "",

        unloadingZoneId:
            "TEMPORARY_NON_ZONE",

        unloadingZoneName:
            "临时非卸载区",

        unloadingPoint:
            "临时非卸载区",

        materialType:
            request.materialType ||
            request.material ||
            "渣",

        material:
            request.material ||
            request.materialType ||
            "渣",

        loadedAt:
            request.loadedAt ||
            "",

        completedAt,

        unloadedAt:
            completedAt,

        unloadLatitude:
            request.unloadLatitude ??
            request?.temporaryUnloadGps?.latitude ??
            null,

        unloadLongitude:
            request.unloadLongitude ??
            request?.temporaryUnloadGps?.longitude ??
            null,

        gpsAccuracy:
            request.gpsAccuracy ??
            request?.temporaryUnloadGps?.accuracy ??
            null,

        status:
            "completed",

        tripCount:
            1,

        dispatchConfirmation:
            "confirmed",

        officialCountEligible:
            true,

        temporaryUnload:
            true,

        temporaryUnloadReason:
            request.reason ||
            "",

        temporaryUnloadRemark:
            request.remark ||
            "",

        temporaryUnloadRequestId:
            request.requestId ||
            "",

        source:
            "temporary_unload_dispatch_approved",

        approvedBy:
            "dispatch",

        approvedAt:
            new Date()
                .toISOString(),

        syncStatus:
            "pending"
    };
}


function temporaryUnloadApprove(
    requestId
) {

    const requests =
        temporaryUnloadReadArray(
            TEMP_UNLOAD_REQUEST_KEY
        );


    const index =
        requests.findIndex(
            item =>
                String(
                    item.requestId ||
                    ""
                ) ===
                    String(
                        requestId
                    )
        );


    if (
        index <
            0
    ) {

        alert(
            "没有找到该临时卸料记录，可能已经被处理。"
        );

        renderTemporaryUnloadReview();

        return;
    }


    const request =
        requests[
            index
        ];


    if (
        request.status !==
            "pending_dispatch"
    ) {

        alert(
            "该记录已经处理。"
        );

        renderTemporaryUnloadReview();

        return;
    }


    const ok =
        confirm(
            "确认该临时卸料有效并计入正式趟次？\n\n" +
            "司机：" +
            (
                request.driverName ||
                "-"
            ) +
            "\n车辆：" +
            (
                request.vehicleNumber ||
                request.vehicleId ||
                "-"
            ) +
            "\n物料：" +
            (
                request.materialType ||
                request.material ||
                "-"
            ) +
            "\n原因：" +
            (
                request.reason ||
                "-"
            )
        );


    if (
        !ok
    ) {

        return;
    }


    if (
        !temporaryUnloadOfficialTripExists(
            request
        )
    ) {

        const trips =
            temporaryUnloadReadArray(
                TEMP_UNLOAD_TRIP_KEY
            );


        trips.push(
            temporaryUnloadBuildOfficialTrip(
                request
            )
        );


        temporaryUnloadWriteArray(
            TEMP_UNLOAD_TRIP_KEY,
            trips
        );
    }


    requests[
        index
    ] = {

        ...request,

        status:
            "approved",

        dispatchConfirmation:
            "confirmed",

        officialCountEligible:
            true,

        reviewedAt:
            new Date()
                .toISOString(),

        updatedAt:
            new Date()
                .toISOString()
    };


    temporaryUnloadWriteArray(
        TEMP_UNLOAD_REQUEST_KEY,
        requests
    );


    renderTemporaryUnloadReview();


    if (
        typeof dispatchRenderTripStats ===
            "function"
    ) {

        dispatchRenderTripStats();
    }


    alert(
        "临时卸料已确认。\n\n已生成 1 条正式运输趟次，并进入生产统计。"
    );
}


function temporaryUnloadReject(
    requestId
) {

    const requests =
        temporaryUnloadReadArray(
            TEMP_UNLOAD_REQUEST_KEY
        );


    const index =
        requests.findIndex(
            item =>
                String(
                    item.requestId ||
                    ""
                ) ===
                    String(
                        requestId
                    )
        );


    if (
        index <
            0
    ) {

        alert(
            "没有找到该临时卸料记录，可能已经被处理。"
        );

        renderTemporaryUnloadReview();

        return;
    }


    const request =
        requests[
            index
        ];


    if (
        request.status !==
            "pending_dispatch"
    ) {

        alert(
            "该记录已经处理。"
        );

        renderTemporaryUnloadReview();

        return;
    }


    const ok =
        confirm(
            "确认驳回该临时卸料？\n\n驳回后不会计入正式趟次。"
        );


    if (
        !ok
    ) {

        return;
    }


    requests[
        index
    ] = {

        ...request,

        status:
            "rejected",

        dispatchConfirmation:
            "rejected",

        officialCountEligible:
            false,

        reviewedAt:
            new Date()
                .toISOString(),

        updatedAt:
            new Date()
                .toISOString()
    };


    temporaryUnloadWriteArray(
        TEMP_UNLOAD_REQUEST_KEY,
        requests
    );


    renderTemporaryUnloadReview();


    if (
        typeof dispatchRenderTripStats ===
            "function"
    ) {

        dispatchRenderTripStats();
    }


    alert(
        "临时卸料已驳回，不计入正式统计。"
    );
}


function renderTemporaryUnloadReview() {

    const rows =
        temporaryUnloadPendingRows();


    const todoCount =
        document.getElementById(
            "temporaryUnloadTodoCount"
        );


    const modalCount =
        document.getElementById(
            "temporaryUnloadReviewCount"
        );


    const list =
        document.getElementById(
            "temporaryUnloadReviewList"
        );


    if (
        todoCount
    ) {

        todoCount.textContent =
            String(
                rows.length
            );
    }


    if (
        modalCount
    ) {

        modalCount.textContent =
            rows.length +
            " 条";
    }


    if (
        !list
    ) {

        return;
    }


    if (
        !rows.length
    ) {

        list.innerHTML = `
            <div class="empty-placeholder">
                暂无临时卸料待确认记录
            </div>
        `;

        return;
    }


    list.innerHTML =
        rows.map(
            item => {

                const id =
                    String(
                        item.requestId ||
                        ""
                    );


                const lat =
                    item.unloadLatitude ??
                    item?.temporaryUnloadGps?.latitude ??
                    "";


                const lon =
                    item.unloadLongitude ??
                    item?.temporaryUnloadGps?.longitude ??
                    "";


                const accuracy =
                    item.gpsAccuracy ??
                    item?.temporaryUnloadGps?.accuracy ??
                    "";


                return `
                    <div class="temp-unload-review-card">

                        <div class="temp-unload-review-title">
                            ${temporaryUnloadEscape(
                                item.driverName ||
                                "-"
                            )}
                            ·
                            ${temporaryUnloadEscape(
                                item.vehicleNumber ||
                                item.vehicleId ||
                                "-"
                            )}
                        </div>

                        <div class="temp-unload-review-info">
                            任务：
                            <strong>${temporaryUnloadEscape(
                                item.taskId ||
                                item.dispatchTaskId ||
                                "-"
                            )}</strong>
                            <br>

                            班次：
                            ${temporaryUnloadEscape(
                                item.shift ||
                                "-"
                            )}
                            ·
                            ${temporaryUnloadEscape(
                                item.shiftId ||
                                "-"
                            )}
                            <br>

                            物料：
                            <strong>${temporaryUnloadEscape(
                                item.materialType ||
                                item.material ||
                                "-"
                            )}</strong>
                            <br>

                            原因：
                            <strong>${temporaryUnloadEscape(
                                item.reason ||
                                "-"
                            )}</strong>
                            <br>

                            说明：
                            ${temporaryUnloadEscape(
                                item.remark ||
                                "-"
                            )}
                            <br>

                            卸料时间：
                            ${temporaryUnloadFormatTime(
                                item?.temporaryUnloadGps?.timestamp ||
                                item.createdAt
                            )}
                            <br>

                            GPS：
                            ${temporaryUnloadEscape(
                                lat
                            )},
                            ${temporaryUnloadEscape(
                                lon
                            )}
                            ${
                                accuracy !== ""
                                    ? " · 精度 ±" +
                                      temporaryUnloadEscape(
                                          accuracy
                                      ) +
                                      "m"
                                    : ""
                            }
                            <br>

                            记录：
                            <code>${temporaryUnloadEscape(
                                id
                            )}</code>
                        </div>

                        <div class="temp-unload-review-actions">
                            <button
                                type="button"
                                class="temp-unload-approve"
                                onclick="temporaryUnloadApprove('${temporaryUnloadEscape(
                                    id
                                )}')"
                            >
                                ✅ 确认有效并计入
                            </button>

                            <button
                                type="button"
                                class="temp-unload-reject"
                                onclick="temporaryUnloadReject('${temporaryUnloadEscape(
                                    id
                                )}')"
                            >
                                ❌ 驳回
                            </button>
                        </div>

                    </div>
                `;
            }
        )
        .join("");
}


function openTemporaryUnloadReview() {

    renderTemporaryUnloadReview();


    document
        .getElementById(
            "temporaryUnloadReviewModal"
        )
        ?.classList
        .remove(
            "hidden"
        );
}


function closeTemporaryUnloadReview() {

    document
        .getElementById(
            "temporaryUnloadReviewModal"
        )
        ?.classList
        .add(
            "hidden"
        );
}


document
    .getElementById(
        "openWorkshopBoardButton"
    )
    ?.addEventListener(
        "click",
        function () {

            location.href =
                "maintenance.html?view=dispatch-board";
        }
    );


document
    .getElementById(
        "openTemporaryUnloadReviewButton"
    )
    ?.addEventListener(
        "click",
        openTemporaryUnloadReview
    );


document
    .getElementById(
        "closeTemporaryUnloadReviewButton"
    )
    ?.addEventListener(
        "click",
        closeTemporaryUnloadReview
    );


window.temporaryUnloadApprove =
    temporaryUnloadApprove;


window.temporaryUnloadReject =
    temporaryUnloadReject;


renderTemporaryUnloadReview();


setInterval(
    renderTemporaryUnloadReview,
    3000
);


window.addEventListener(
    "storage",
    function (
        event
    ) {

        if (
            [
                TEMP_UNLOAD_REQUEST_KEY,
                TEMP_UNLOAD_TRIP_KEY
            ]
            .includes(
                event.key
            )
        ) {

            renderTemporaryUnloadReview();


            if (
                typeof dispatchRenderTripStats ===
                    "function"
            ) {

                dispatchRenderTripStats();
            }
        }
    }
);


/* 零产量异常报备：车队长/调度审核后才视为完成。 */
document.addEventListener("DOMContentLoaded", function initZeroProductionReview() {
    "use strict";
    const KEY = "zeroProductionReports";
    const button = document.getElementById("openZeroProductionReviewButton");
    const modal = document.getElementById("zeroProductionReviewModal");
    const list = document.getElementById("zeroProductionReviewList");
    const count = document.getElementById("zeroProductionTodoCount");

    function readReports() {
        try {
            const data = JSON.parse(localStorage.getItem(KEY) || "[]");
            return Array.isArray(data) ? data : [];
        } catch (_) {
            return [];
        }
    }

    function getReviewer() {
        try {
            const profile = JSON.parse(localStorage.getItem("dispatchUserProfile") || "null");
            const positionMap = { "调度员": "车队长" };
            const selectedPosition = localStorage.getItem("selectedPosition") || profile?.position || "";
            const position = positionMap[String(selectedPosition).trim()] || String(selectedPosition).trim();
            const personId = String(
                localStorage.getItem("currentPersonId") ||
                profile?.personId ||
                profile?.employeeId ||
                profile?.id ||
                ""
            );
            if (position !== "车队长" || !personId) return null;

            const personnel = JSON.parse(localStorage.getItem("personnelRecords") || "[]");
            if (!Array.isArray(personnel)) return null;
            const person = personnel.find(item =>
                String(item.personId || item.employeeId || item.driverId || item.id || "") === personId &&
                (positionMap[String(item.position || "").trim()] || String(item.position || "").trim()) === "车队长"
            );
            if (!person) return null;

            const approved =
                person.approvalStatus === "approved" ||
                ["approved", "active", "working"].includes(person.status) ||
                ["在职可用", "作业中"].includes(person.personnelStatus);
            if (!approved) return null;

            const name = String(person.name || profile?.name || "");
            if (!name) return null;
            return { id: personId, name, position: "车队长" };
        } catch (_) {
            return null;
        }
    }

    function esc(value) {
        const node = document.createElement("span");
        node.textContent = String(value ?? "");
        return node.innerHTML;
    }

    function pending(report) {
        /* 兼容旧版“已报备”记录：未留下审核人，故仍需人工审核。 */
        return ["pending_review", "reported"].includes(String(report.status || ""));
    }

    function render() {
        const reviewer = getReviewer();
        if (!button || !count || !list) return;
        button.style.display = reviewer ? "" : "none";
        const items = readReports();
        const queue = items.map((report, index) => ({ report, index }))
            .filter(item => pending(item.report));
        count.textContent = String(queue.length);
        list.innerHTML = queue.length ? queue.map(({ report, index }) => `
            <article class="maintenance-review-card">
                <div class="maintenance-review-top">
                    <strong>${esc(report.personName || "未记录姓名")} · ${esc(report.position || "岗位未记录")}</strong>
                    <span class="maintenance-status-badge">待审核</span>
                </div>
                <div class="maintenance-review-info">
                    日期：${esc(report.date || "-")}<br>
                    报备原因：${esc(report.reason || "-")}<br>
                    说明：${esc(report.remark || "-")}<br>
                    提交时间：${esc(report.submittedAt || report.createdAt || "-")}
                </div>
                <div class="maintenance-review-actions">
                    <button type="button" class="success-button" data-zero-review="approve" data-index="${index}">审核通过</button>
                    <button type="button" class="danger-button" data-zero-review="reject" data-index="${index}">驳回并要求补充</button>
                </div>
            </article>
        `).join("") : '<div class="maintenance-review-empty">暂无待审核的零产量报备。</div>';
    }

    function act(index, decision) {
        const reviewer = getReviewer();
        if (!reviewer) {
            alert("仅车队长 / 调度员可以审核零产量报备。");
            render();
            return;
        }
        const items = readReports();
        const report = items[Number(index)];
        if (!report || !pending(report)) {
            alert("该报备已被处理或不存在，请刷新列表后重试。");
            render();
            return;
        }

        let reviewReason = "";
        if (decision === "rejected") {
            reviewReason = prompt("请填写驳回原因，司机将根据原因补充后重新报备：", "");
            if (reviewReason === null) return;
            reviewReason = reviewReason.trim();
            if (!reviewReason) {
                alert("驳回时必须填写原因。");
                return;
            }
        }

        const now = new Date().toISOString();
        report.status = decision;
        report.reviewedBy = reviewer.id;
        report.reviewedByName = reviewer.name;
        report.approverRole = reviewer.position;
        report.reviewedAt = now;
        report.updatedAt = now;
        if (decision === "rejected") report.reviewReason = reviewReason;
        else delete report.reviewReason;

        localStorage.setItem(KEY, JSON.stringify(items));
        render();
    }

    if (button && modal) {
        button.addEventListener("click", function() {
            if (!getReviewer()) {
                alert("仅车队长 / 调度员可以审核零产量报备。");
                render();
                return;
            }
            render();
            modal.classList.remove("hidden");
        });
    }
    document.getElementById("closeZeroProductionReviewModal")?.addEventListener("click", function() {
        modal?.classList.add("hidden");
    });
    list?.addEventListener("click", function(event) {
        const target = event.target.closest("[data-zero-review]");
        if (!target) return;
        act(target.dataset.index, target.dataset.zeroReview === "approve" ? "approved" : "rejected");
    });
    window.addEventListener("storage", function(event) {
        if (event.key === KEY || event.key === "dispatchUserProfile") render();
    });
    render();
});
