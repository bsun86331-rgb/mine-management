<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>司机工作台</title>

    <link
        rel="stylesheet"
        href="css/style.css"
    >

    <link
        rel="stylesheet"
        href="css/driver-work.css?v=2.9.2"
    >

    <style>
        .shift-kpi-card {
            padding: 16px;
        }

        .shift-kpi-grid {
            display: grid;
            grid-template-columns: 1.35fr 1fr 1fr;
            gap: 10px;
        }

        .shift-kpi-item {
            min-height: 106px;
            padding: 14px 12px;
            border: 1px solid #dbeafe;
            border-radius: 14px;
            background: #f8fafc;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
        }

        .shift-kpi-item.primary {
            background: #eff6ff;
            border-color: #bfdbfe;
        }

        .shift-kpi-label {
            color: #64748b;
            font-size: 13px;
            font-weight: 700;
        }

        .shift-kpi-value {
            margin-top: 5px;
            color: #0f172a;
            font-size: 30px;
            line-height: 1.05;
            font-weight: 900;
        }

        .shift-kpi-item.primary .shift-kpi-value {
            color: #1d4ed8;
            font-size: 48px;
        }

        .shift-kpi-sub {
            margin-top: 5px;
            color: #94a3b8;
            font-size: 11px;
        }

        .employee-line {
            margin-top: 5px;
            color: #64748b;
            font-size: 12px;
        }

        @media (max-width: 700px) {
            .shift-kpi-grid {
                grid-template-columns: 1fr 1fr;
            }

            .shift-kpi-item.primary {
                grid-column: 1 / -1;
            }
        }

        /* =========================================================
           V2.10.4A 请假申请界面
           本轮仅调整页面和字段，不改变现有审批数据逻辑
        ========================================================= */

        .leave-policy-box {
            margin: 12px 0 16px;
            padding: 12px;
            border: 1px solid #dbeafe;
            border-radius: 12px;
            background: #f8fbff;
        }

        .leave-policy-title {
            margin-bottom: 8px;
            color: #1e3a8a;
            font-weight: 800;
        }

        .leave-policy-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }

        .leave-policy-item {
            padding: 9px 10px;
            border-radius: 9px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
        }

        .leave-policy-item span {
            display: block;
            color: #64748b;
            font-size: 11px;
        }

        .leave-policy-item strong {
            display: block;
            margin-top: 3px;
            color: #0f172a;
            font-size: 14px;
        }

        .leave-impact-box {
            margin: 12px 0;
            padding: 11px 12px;
            border-radius: 10px;
            background: #fff7ed;
            color: #9a3412;
            font-size: 12px;
            line-height: 1.7;
        }

        .leave-unit-tip {
            margin: 6px 0 12px;
            color: #64748b;
            font-size: 12px;
            line-height: 1.6;
        }

        @media (max-width: 700px) {
            .leave-policy-grid {
                grid-template-columns: 1fr;
            }
        }

    </style>

</head>

<body class="driver-body">

<header class="driver-header">

    <div>
        <h1>🚚 司机工作台</h1>
        <p>Driver Workbench</p>
    </div>

    <span
        id="driverStatusBadge"
        class="status-badge"
    >
        待命
    </span>

</header>


<main class="driver-main">

    <!-- 人员信息 -->

    <section class="driver-card profile-card">

        <div class="profile-main">

            <div class="profile-icon">
                👷
            </div>

            <div>
                <h2 id="driverName">-</h2>

                <p>
                    <span id="driverPosition">
                        卡车司机
                    </span>
                    ·
                    <span id="driverTeam">
                        -
                    </span>
                </p>

                <p class="employee-line">
                    员工编号：
                    <span id="driverEmployeeNo">-</span>
                </p>
            </div>

        </div>

        <div class="profile-status">
            已审核通过
        </div>

    </section>


    <!-- 本班核心数据 -->

    <section class="driver-card shift-kpi-card">

        <div class="section-title">
            <div>
                <h2>📈 本班实时数据</h2>
                <p>趟数、趟数排名、绩效排名实时显示</p>
            </div>
        </div>

        <div class="shift-kpi-grid">

            <div class="shift-kpi-item primary">
                <span class="shift-kpi-label">本班趟数</span>
                <strong
                    id="todayTripCount"
                    class="shift-kpi-value"
                >
                    0
                </strong>
                <span class="shift-kpi-sub">
                    当前班次累计
                </span>
            </div>

            <div class="shift-kpi-item">
                <span class="shift-kpi-label">本班趟数排名</span>
                <strong
                    id="tripRankValue"
                    class="shift-kpi-value"
                >
                    --
                </strong>
                <span
                    id="tripRankScope"
                    class="shift-kpi-sub"
                >
                    当前班次车辆
                </span>
            </div>

            <div class="shift-kpi-item">
                <span class="shift-kpi-label">本班绩效排名</span>
                <strong
                    id="performanceRankValue"
                    class="shift-kpi-value"
                >
                    --
                </strong>
                <span
                    id="performanceRankScope"
                    class="shift-kpi-sub"
                >
                    当前班次司机
                </span>
            </div>

        </div>

    </section>


    <!-- 快捷待办 -->

    <section class="driver-card">

        <div class="section-title">
            <div>
                <h2>我的待办</h2>
                <p>请假、罚单、换车及GPS审核</p>
            </div>
        </div>


        <div class="todo-grid">

            <button
                id="leaveShortcut"
                type="button"
                class="todo-button"
            >
                <span>🗓</span>
                <strong id="leaveTodoCount">0</strong>
                <small>请假记录</small>
            </button>


            <button
                id="penaltyShortcut"
                type="button"
                class="todo-button"
            >
                <span>⚠️</span>
                <strong id="penaltyTodoCount">0</strong>
                <small>待确认罚单</small>
            </button>


            <button
                id="changeShortcut"
                type="button"
                class="todo-button"
            >
                <span>🔧</span>
                <strong id="changeTodoCount">0</strong>
                <small>换车申请</small>
            </button>


            <button
                id="gpsReviewShortcut"
                type="button"
                class="todo-button"
            >
                <span>📍</span>
                <strong id="gpsReviewTodoCount">0</strong>
                <small>GPS审核</small>
            </button>

        </div>

    </section>


    <!-- GPS -->

    <section
        id="gpsSection"
        class="driver-card"
    >

        <div class="section-title">

            <div>
                <h2>📍 手机定位</h2>
                <p>用于运输趟次现场位置记录</p>
            </div>

            <span
                id="gpsStatusBadge"
                class="mini-badge gray"
            >
                未定位
            </span>

        </div>


        <div class="gps-grid">

            <div>
                <span>定位状态</span>
                <strong id="gpsStatus">
                    未启动
                </strong>
            </div>

            <div>
                <span>定位精度</span>
                <strong id="gpsAccuracy">
                    -
                </strong>
            </div>

            <div>
                <span>最后更新</span>
                <strong id="gpsUpdateTime">
                    -
                </strong>
            </div>

            <div>
                <span>坐标</span>
                <strong id="gpsCoordinates">
                    -
                </strong>
            </div>

        </div>


        <button
            id="startGpsButton"
            type="button"
            class="primary-button full-button"
        >
            📍 开启 / 刷新定位
        </button>

        <p class="tip-text">
            浏览器定位需要允许位置权限。测试阶段每完成一趟会重新获取一次GPS。
        </p>

    </section>


    <!-- 当前任务 -->

    <section
        id="taskSection"
        class="driver-card"
    >

        <div class="section-title">

            <div>
                <h2>📋 当前生产任务</h2>
                <p>只执行调度分配给你的车辆和任务</p>
            </div>

            <span
                id="taskStatus"
                class="mini-badge gray"
            >
                待调度
            </span>

        </div>


        <div
            id="noTaskMessage"
            class="empty-box"
        >
            当前没有生产任务，请等待调度分配。
        </div>


        <div
            id="taskContent"
            class="hidden"
        >

            <div class="task-grid">

                <div>
                    <span>任务编号</span>
                    <strong id="taskId">-</strong>
                </div>

                <div>
                    <span>当前车辆</span>
                    <strong id="taskVehicle">-</strong>
                </div>

                <div>
                    <span>跟随挖机</span>
                    <strong id="taskExcavator">-</strong>
                </div>

                <div>
                    <span>作业区域</span>
                    <strong id="taskArea">-</strong>
                </div>

                <div>
                    <span>班次</span>
                    <strong id="taskShift">-</strong>
                </div>


            </div>


            <div class="route-box">

                <div>
                    <span>装载点</span>
                    <strong id="taskLoadingPoint">-</strong>
                </div>

                <div class="route-arrow">
                    →
                </div>

                <div>
                    <span>卸载点</span>
                    <strong id="taskUnloadingPoint">-</strong>
                </div>

            </div>


            <div
                id="taskRemarkBox"
                class="info-box"
            >
                <strong>调度说明：</strong>
                <span id="taskRemark">无</span>
            </div>


            <div
                id="equipmentCheckBox"
                class="claim-box"
            >

                <div>
                    <strong>设备使用检查</strong>
                    <p>
                        接班后先检查车辆，记录公里数和仪表照片；
                        发现异常时进入异常留证及维修流程。
                    </p>
                </div>

                <button
                    id="equipmentCheckButton"
                    type="button"
                    class="primary-button"
                    onclick="location.href='equipment-check.html'"
                >
                    🧰 设备使用检查
                </button>

            </div>


            <div
                id="vehicleClaimBox"
                class="claim-box"
            >

                <div>
                    <strong>车辆领取状态</strong>
                    <p id="vehicleClaimText">
                        尚未领取调度车辆
                    </p>
                </div>

                <button
                    id="claimVehicleButton"
                    type="button"
                    class="primary-button"
                >
                    领取车辆
                </button>

            </div>


            <div class="work-button-grid">

                <button
                    id="startWorkButton"
                    type="button"
                    class="success-button"
                >
                    ▶ 开始作业
                </button>

                <button
                    id="pauseWorkButton"
                    type="button"
                    class="warning-button hidden"
                >
                    ⏸ 暂停作业
                </button>

                <button
                    id="resumeWorkButton"
                    type="button"
                    class="success-button hidden"
                >
                    ▶ 恢复作业
                </button>

            </div>


            <button
                id="addTripButton"
                type="button"
                class="trip-button hidden"
            >
                🚚 完成一趟
            </button>


            <button
                id="vehicleFaultButton"
                type="button"
                class="danger-outline-button"
            >
                🔧 车辆故障 / 申请换车
            </button>


            <button
                id="maintenanceReportButton"
                type="button"
                class="danger-outline-button"
                onclick="location.href='maintenance-report.html'"
            >
                ⚠️ 异常上报 / 设备维修
            </button>

        </div>

    </section>


    <!-- 今日记录 -->

    <section
        id="tripSection"
        class="driver-card"
    >

        <div class="section-title">

            <div>
                <h2>📊 本班运输记录</h2>
                <p>按当前班次统计，包含GPS状态及调度审核结果</p>
            </div>

            <span
                id="tripCountBadge"
                class="mini-badge blue"
            >
                0趟
            </span>

        </div>

        <div id="tripRecordList">
            <div class="empty-box">
                暂无运输记录
            </div>
        </div>

    </section>


    <!-- 请假 -->

    <section
        id="leaveSection"
        class="driver-card"
    >

        <div class="section-title">

            <div>
                <h2>🗓 请假申请</h2>
                <p>仅支持事假、轮休假；最小请假单位0.5天，由调度审批</p>
            </div>

            <button
                id="openLeaveButton"
                type="button"
                class="primary-small-button"
            >
                + 申请请假
            </button>

        </div>

        <div id="leaveRecordList">
            <div class="empty-box">
                暂无请假记录
            </div>
        </div>

    </section>


    <!-- 罚单 -->

    <section
        id="penaltySection"
        class="driver-card"
    >

        <div class="section-title">

            <div>
                <h2>⚠️ 我的罚单</h2>
                <p>司机可以查看和确认，不能自行删除</p>
            </div>

        </div>

        <div id="penaltyRecordList">
            <div class="empty-box">
                暂无罚单
            </div>
        </div>

    </section>


    <!-- 换车记录 -->

    <section
        id="changeSection"
        class="driver-card"
    >

        <div class="section-title">
            <div>
                <h2>🔧 换车记录</h2>
                <p>换车不换任务，原任务趟数继续累计</p>
            </div>
        </div>

        <div id="vehicleChangeRecordList">
            <div class="empty-box">
                暂无换车申请
            </div>
        </div>

    </section>


    <!-- 我的信息 -->

    <section class="driver-card">

        <div class="section-title">
            <div>
                <h2>👤 我的信息</h2>
            </div>
        </div>

        <div class="task-grid">

            <div>
                <span>姓名</span>
                <strong id="profileName">-</strong>
            </div>

            <div>
                <span>员工编号</span>
                <strong id="profileEmployeeNo">-</strong>
            </div>

            <div>
                <span>手机号</span>
                <strong id="profilePhone">-</strong>
            </div>

            <div>
                <span>岗位</span>
                <strong id="profilePosition">-</strong>
            </div>

            <div>
                <span>部门 / 车队</span>
                <strong id="profileTeam">-</strong>
            </div>

            <div>
                <span>入职日期</span>
                <strong id="profileEntryDate">-</strong>
            </div>

            <div>
                <span>审核状态</span>
                <strong>已通过</strong>
            </div>

        </div>

    </section>


    <button
        type="button"
        class="home-button"
        onclick="location.href='index.html'"
    >
        返回系统首页
    </button>

</main>


<!-- 请假弹窗 -->

<div
    id="leaveModal"
    class="modal hidden"
>

    <div class="modal-card">

        <h2>🗓 请假申请</h2>

        <div class="approval-tip">
            一线司机请假自动提交给调度审批。
            请假最小单位为0.5天。
        </div>


        <label for="leaveType">
            请假类型 *
        </label>

        <select id="leaveType">
            <option value="事假">事假</option>
            <option value="轮休假">轮休假</option>
        </select>


        <div
            id="rotationLeavePolicyBox"
            class="leave-policy-box"
        >

            <div class="leave-policy-title">
                轮休假额度
            </div>

            <div class="leave-policy-grid">

                <div class="leave-policy-item">
                    <span>是否享有轮休假</span>
                    <strong id="rotationLeaveEligible">-</strong>
                </div>

                <div class="leave-policy-item">
                    <span>当前轮休周期</span>
                    <strong id="rotationLeaveCurrentCycle">-</strong>
                </div>

                <div class="leave-policy-item">
                    <span>周期总额度</span>
                    <strong id="rotationLeaveQuota">-</strong>
                </div>

                <div class="leave-policy-item">
                    <span>本周期已使用</span>
                    <strong id="rotationLeaveUsed">-</strong>
                </div>

                <div class="leave-policy-item">
                    <span>本周期剩余</span>
                    <strong id="rotationLeaveRemaining">-</strong>
                </div>

                <div class="leave-policy-item">
                    <span>额度规则</span>
                    <strong>到期重新计算，不跨周期结转</strong>
                </div>

            </div>

        </div>


        <label for="leaveDays">
            本次申请天数 *
        </label>

        <input
            id="leaveDays"
            type="number"
            min="0.5"
            step="0.5"
            value="0.5"
            inputmode="decimal"
        >

        <p class="leave-unit-tip">
            只能按0.5天递增，例如：0.5、1、1.5、2天。
        </p>


        <label for="leaveStart">
            开始时间 *
        </label>

        <input
            id="leaveStart"
            type="datetime-local"
        >


        <label for="leaveEnd">
            结束时间 *
        </label>

        <input
            id="leaveEnd"
            type="datetime-local"
        >


        <div
            id="leaveAttendanceImpact"
            class="leave-impact-box"
        >
            事假：批准后按实际请假天数扣考勤。<br>
            轮休假：额度内不扣考勤，超出轮休额度的部分扣考勤。
        </div>


        <label for="leaveContactPhone">
            联系电话
        </label>

        <input
            id="leaveContactPhone"
            type="tel"
        >


        <label for="leaveReason">
            请假原因 *
        </label>

        <textarea
            id="leaveReason"
            placeholder="请输入请假原因"
        ></textarea>


        <div class="modal-buttons">

            <button
                id="submitLeaveButton"
                type="button"
                class="success-button"
            >
                提交调度审批
            </button>

            <button
                id="closeLeaveButton"
                type="button"
                class="secondary-button"
            >
                取消
            </button>

        </div>

    </div>

</div>


<!-- 换车弹窗 -->

<div
    id="vehicleChangeModal"
    class="modal hidden"
>

    <div class="modal-card">

        <h2>🔧 车辆故障 / 申请换车</h2>

        <div class="approval-tip">
            调度批准新车辆以前，不能使用新车记录运输趟数。
        </div>


        <label for="vehicleFaultReason">
            故障或换车原因 *
        </label>

        <textarea
            id="vehicleFaultReason"
            placeholder="例如：右后轮故障，车辆无法继续正常作业。"
        ></textarea>


        <div class="modal-buttons">

            <button
                id="submitVehicleChangeButton"
                type="button"
                class="danger-button"
            >
                提交换车申请
            </button>

            <button
                id="closeVehicleChangeButton"
                type="button"
                class="secondary-button"
            >
                取消
            </button>

        </div>

    </div>

</div>


<footer>
    矿山管理系统 · 汽车司机端 V2.10.4A
</footer>

<script src="js/driver-work.js?v=2.9.2"></script>

</body>
</html>
