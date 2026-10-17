/* =========================================================
   矿山管理系统
   管理员统一人员审核
   V2.9.5
========================================================= */

"use strict";


/* =========================================================
   全局状态
========================================================= */

let personnelRecords = [];

let currentPersonId = null;


/* =========================================================
   页面启动
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadPersonnelRecords();

        bindEvents();

        renderPage();

    }
);


/* =========================================================
   读取人员库
========================================================= */

function loadPersonnelRecords() {

    try {

        const data =
            JSON.parse(
                localStorage.getItem(
                    "personnelRecords"
                )
            );


        personnelRecords =
            Array.isArray(data)
                ? data
                : [];


    } catch (error) {

        console.error(
            "人员资料读取失败：",
            error
        );

        personnelRecords = [];

    }


    /*
       兼容早期汽车司机 driverProfile。

       如果旧汽车司机资料存在，
       但 personnelRecords 中还没有，
       自动导入统一人员库。

       以后新入职汽车司机不会再走
       driverProfile 注册流程。
    */

    importLegacyDriverProfile();


    /*
       统一旧数据字段
    */

    personnelRecords =
        personnelRecords.map(
            normalizePersonRecord
        );


    savePersonnelRecords();

}


/* =========================================================
   保存人员库
========================================================= */

function savePersonnelRecords() {

    try {

        localStorage.setItem(
            "personnelRecords",
            JSON.stringify(
                personnelRecords
            )
        );


    } catch (error) {

        console.error(
            "人员资料保存失败：",
            error
        );

        alert(
            "人员资料保存失败，可能是浏览器本地存储空间不足。"
        );

    }

}


/* =========================================================
   导入旧汽车司机
========================================================= */

function importLegacyDriverProfile() {

    let driverProfile = null;


    try {

        driverProfile =
            JSON.parse(
                localStorage.getItem(
                    "driverProfile"
                )
            );


    } catch (error) {

        console.error(
            "旧汽车司机资料读取失败：",
            error
        );

    }


    if (!driverProfile) {
        return;
    }


    const oldId =
        driverProfile.personId ||
        driverProfile.driverId ||
        driverProfile.id ||
        "";


    const exists =
        personnelRecords.some(person => {

            const personId =
                getPersonId(person);


            if (
                oldId &&
                personId === oldId
            ) {

                return true;

            }


            return (
                person.phone &&
                driverProfile.phone &&
                person.phone ===
                    driverProfile.phone &&
                normalizePosition(
                    person.position
                ) ===
                    "汽车司机"
            );

        });


    if (exists) {
        return;
    }


    const imported = {

        ...driverProfile,

        personId:
            oldId ||
            createPersonId(),

        position:
            "汽车司机",

        personnelCategory:
            "司机",

        department:
            driverProfile.department ||
            driverProfile.team ||
            "",

        team:
            driverProfile.team ||
            driverProfile.department ||
            "",

        approvalStatus:
            normalizeApprovalStatus(
                driverProfile
            ),

        personnelStatus:
            getPersonnelStatus(
                driverProfile
            ),

        importedFromLegacyDriver:
            true

    };


    personnelRecords.push(
        imported
    );

}


/* =========================================================
   统一人员数据
========================================================= */

function normalizePersonRecord(person) {

    const normalized = {
        ...person
    };


    normalized.personId =
        getPersonId(person) ||
        createPersonId();


    normalized.position =
        normalizePosition(
            person.position
        );


    normalized.department =
        person.department ||
        person.team ||
        "";


    normalized.team =
        person.team ||
        person.department ||
        "";


    normalized.personnelCategory =
        person.personnelCategory ||
        getPersonnelCategory(
            normalized.position
        );


    normalized.approvalStatus =
        normalizeApprovalStatus(
            person
        );


    normalized.personnelStatus =
        getPersonnelStatus(
            person
        );


    /*
       兼容照片字段
    */

    normalized.idCardPhoto =
        person.idCardPhoto ||
        person.idPhoto ||
        "";


    normalized.passportPhoto =
        person.passportPhoto ||
        "";


    normalized.licensePhoto =
        person.licensePhoto ||
        person.driverLicensePhoto ||
        person.drivingLicensePhoto ||
        "";


    normalized.bankCardPhoto =
        person.bankCardPhoto ||
        "";


    return normalized;

}


/* =========================================================
   人员ID
========================================================= */

function getPersonId(person) {

    if (!person) {
        return "";
    }


    return (
        person.personId ||
        person.driverId ||
        person.id ||
        ""
    );

}


function createPersonId() {

    return (
        "P-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 7)
            .toUpperCase()
    );

}


/* =========================================================
   岗位名称统一
========================================================= */

function normalizePosition(position) {

    const map = {

        "卡车司机":
            "汽车司机",

        "装载机司机":
            "铲车司机",

        "大巴":
            "大巴司机",

        "测量人员":
            "测量员",

        "后勤人员":
            "后勤",

        "库房管理员":
            "库房管理",

        "维修人员":
            "修理工",

        "调度员":
            "车队长"

    };


    return (
        map[position] ||
        position ||
        ""
    );

}


/* =========================================================
   人员类别
========================================================= */

function getPersonnelCategory(position) {

    const driverPositions = [
        "挖机司机",
        "汽车司机",
        "铲车司机",
        "加油车司机",
        "大巴司机",
        "平路机司机",
        "洒水车司机",
        "推土机司机"
    ];


    if (
        driverPositions.includes(
            position
        )
    ) {

        return "司机";

    }


    if (
        position === "维修管理员" ||
        position === "修理工"
    ) {

        return "维修";

    }


    if (
        [
            "测量员",
            "安全员",
            "统计",
            "会计",
            "后勤",
            "库房管理"
        ].includes(position)
    ) {

        return "中层及职能人员";

    }


    if (
        position === "车队长"
    ) {

        return "生产管理";

    }


    if (
        position === "总经理"
    ) {

        return "总经理";

    }


    if (
        position === "管理员"
    ) {

        return "系统管理";

    }


    return "其他";

}


/* =========================================================
   审核状态统一
========================================================= */

function normalizeApprovalStatus(person) {

    if (
        person.approvalStatus ===
            "approved" ||
        person.status ===
            "approved" ||
        person.status ===
            "active" ||
        person.status ===
            "working" ||
        person.status ===
            "leave" ||
        person.personnelStatus ===
            "在职可用" ||
        person.personnelStatus ===
            "作业中" ||
        person.personnelStatus ===
            "请假"
    ) {

        return "approved";

    }


    if (
        person.approvalStatus ===
            "rejected" ||
        person.status ===
            "rejected"
    ) {

        return "rejected";

    }


    return "pending";

}


/* =========================================================
   人员状态
========================================================= */

function getPersonnelStatus(person) {

    if (
        person.personnelStatus ===
            "离职" ||
        person.status ===
            "resigned"
    ) {

        return "离职";

    }


    if (
        person.personnelStatus ===
            "停用" ||
        person.status ===
            "disabled"
    ) {

        return "停用";

    }


    if (
        person.personnelStatus ===
            "作业中" ||
        person.status ===
            "working"
    ) {

        return "作业中";

    }


    if (
        person.personnelStatus ===
            "请假" ||
        person.status ===
            "leave"
    ) {

        return "请假";

    }


    const approval =
        normalizeApprovalStatus(
            person
        );


    if (
        approval === "approved"
    ) {

        return "在职可用";

    }


    return "待审核";

}


/* =========================================================
   绑定事件
========================================================= */

function bindEvents() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );


    const positionFilter =
        document.getElementById(
            "positionFilter"
        );


    const statusFilter =
        document.getElementById(
            "statusFilter"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            renderPersonnelTable
        );

    }


    if (positionFilter) {

        positionFilter.addEventListener(
            "change",
            renderPersonnelTable
        );

    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            renderPersonnelTable
        );

    }


    document.getElementById(
        "approveButton"
    )?.addEventListener(
        "click",
        approveCurrentPerson
    );


    document.getElementById(
        "rejectButton"
    )?.addEventListener(
        "click",
        openRejectArea
    );


    document.getElementById(
        "confirmRejectButton"
    )?.addEventListener(
        "click",
        rejectCurrentPerson
    );


    document.getElementById(
        "closeDetailButton"
    )?.addEventListener(
        "click",
        closeDetail
    );


    document.getElementById(
        "printProfileButton"
    )?.addEventListener(
        "click",
        printCurrentProfile
    );


    document.getElementById(
        "printPhotosButton"
    )?.addEventListener(
        "click",
        printCurrentPhotos
    );

}


/* =========================================================
   渲染页面
========================================================= */

function renderPage() {

    renderSummary();

    renderPersonnelTable();

}


/* =========================================================
   顶部统计
========================================================= */

function renderSummary() {

    const total =
        personnelRecords.length;


    const pending =
        personnelRecords.filter(
            person =>
                normalizeApprovalStatus(
                    person
                ) === "pending"
        ).length;


    const approved =
        personnelRecords.filter(
            person =>
                normalizeApprovalStatus(
                    person
                ) === "approved"
        ).length;


    const rejected =
        personnelRecords.filter(
            person =>
                normalizeApprovalStatus(
                    person
                ) === "rejected"
        ).length;


    setText(
        "totalCount",
        total
    );


    setText(
        "pendingCount",
        pending
    );


    setText(
        "approvedCount",
        approved
    );


    setText(
        "rejectedCount",
        rejected
    );

}


/* =========================================================
   人员表
========================================================= */

function renderPersonnelTable() {

    const tbody =
        document.getElementById(
            "personnelTableBody"
        );


    const tableArea =
        document.getElementById(
            "personnelTableArea"
        );


    const emptyMessage =
        document.getElementById(
            "emptyMessage"
        );


    if (
        !tbody ||
        !tableArea ||
        !emptyMessage
    ) {

        return;

    }


    const keyword =
        (
            document.getElementById(
                "searchInput"
            )?.value || ""
        )
            .trim()
            .toLowerCase();


    const positionFilter =
        document.getElementById(
            "positionFilter"
        )?.value || "";


    const statusFilter =
        document.getElementById(
            "statusFilter"
        )?.value || "";


    const filtered =
        personnelRecords
            .filter(person => {

                const position =
                    normalizePosition(
                        person.position
                    );


                const approval =
                    normalizeApprovalStatus(
                        person
                    );


                if (
                    positionFilter &&
                    position !==
                        positionFilter
                ) {

                    return false;

                }


                if (
                    statusFilter &&
                    approval !==
                        statusFilter
                ) {

                    return false;

                }


                if (keyword) {

                    const searchable =
                        [
                            person.name,
                            person.phone,
                            person.department,
                            person.team,
                            position
                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                    if (
                        !searchable.includes(
                            keyword
                        )
                    ) {

                        return false;

                    }

                }


                return true;

            })
            .sort(sortPersonnel);


    tbody.innerHTML = "";


    if (
        filtered.length === 0
    ) {

        tableArea.style.display =
            "none";


        emptyMessage.style.display =
            "block";


        emptyMessage.innerHTML =
            personnelRecords.length === 0
                ? "<p>当前没有人员登记信息。</p>"
                : "<p>没有符合当前筛选条件的人员。</p>";


        return;

    }


    emptyMessage.style.display =
        "none";


    tableArea.style.display =
        "block";


    filtered.forEach(person => {

        const row =
            document.createElement(
                "tr"
            );


        const personId =
            getPersonId(person);


        const approval =
            normalizeApprovalStatus(
                person
            );


        row.innerHTML = `

            <td>
                ${escapeHtml(
                    person.name || "-"
                )}
            </td>

            <td>
                ${escapeHtml(
                    person.phone || "-"
                )}
            </td>

            <td>
                ${escapeHtml(
                    normalizePosition(
                        person.position
                    ) || "-"
                )}
            </td>

            <td>
                ${escapeHtml(
                    person.department ||
                    person.team ||
                    "-"
                )}
            </td>

            <td>
                ${escapeHtml(
                    person.entryDate ||
                    "-"
                )}
            </td>

            <td>
                ${escapeHtml(
                    formatDateTime(
                        person.submittedAt ||
                        person.createdAt
                    )
                )}
            </td>

            <td>
                ${createStatusBadge(
                    approval
                )}
            </td>

            <td>

                <button
                    type="button"
                    onclick="openPersonDetail(
                        '${escapeJs(personId)}'
                    )"
                >
                    查看 / 审核
                </button>

            </td>

        `;


        tbody.appendChild(
            row
        );

    });

}


/* =========================================================
   排序

   待审核优先
========================================================= */

function sortPersonnel(a, b) {

    const priority = {
        pending: 0,
        rejected: 1,
        approved: 2
    };


    const aStatus =
        normalizeApprovalStatus(a);


    const bStatus =
        normalizeApprovalStatus(b);


    const statusDifference =
        priority[aStatus] -
        priority[bStatus];


    if (statusDifference !== 0) {

        return statusDifference;

    }


    const aTime =
        new Date(
            a.submittedAt ||
            a.createdAt ||
            0
        ).getTime();


    const bTime =
        new Date(
            b.submittedAt ||
            b.createdAt ||
            0
        ).getTime();


    return bTime - aTime;

}


/* =========================================================
   状态标签
========================================================= */

function createStatusBadge(status) {

    if (
        status === "approved"
    ) {

        return `
            <span
                class="
                    status-badge
                    status-approved
                "
            >
                已通过
            </span>
        `;

    }


    if (
        status === "rejected"
    ) {

        return `
            <span
                class="
                    status-badge
                    status-rejected
                "
            >
                已驳回
            </span>
        `;

    }


    return `
        <span
            class="
                status-badge
                status-pending
            "
        >
            待审核
        </span>
    `;

}


/* =========================================================
   打开人员详情
========================================================= */

function openPersonDetail(personId) {

    const person =
        findPersonById(
            personId
        );


    if (!person) {

        alert(
            "未找到该人员资料。"
        );

        return;

    }


    currentPersonId =
        personId;


    setText(
        "detailName",
        person.name || "-"
    );


    setText(
        "detailPhone",
        person.phone || "-"
    );


    setText(
        "detailEmergencyContact",
        person.emergencyContact ||
        "-"
    );


    setText(
        "detailEmergencyPhone",
        person.emergencyPhone ||
        "-"
    );


    setText(
        "detailIdCardNumber",
        person.idCardNumber ||
        "-"
    );


    setText(
        "detailPassportNumber",
        person.passportNumber ||
        "-"
    );


    setText(
        "detailBankCardNumber",
        person.bankCardNumber ||
        "-"
    );


    const position =
        normalizePosition(
            person.position
        );


    setText(
        "detailPosition",
        position || "-"
    );


    setText(
        "detailCategory",
        person.personnelCategory ||
        getPersonnelCategory(position)
    );


    setText(
        "detailTeam",
        person.department ||
        person.team ||
        "-"
    );


    setText(
        "detailEntryDate",
        person.entryDate ||
        "-"
    );


    setText(
        "detailRemark",
        person.remark ||
        "-"
    );


    setText(
        "detailStatus",
        getStatusText(
            normalizeApprovalStatus(
                person
            )
        )
    );


    showPhoto(
        "detailIdCardPhoto",
        "idCardNoPhoto",
        person.idCardPhoto
    );


    showPhoto(
        "detailPassportPhoto",
        "passportNoPhoto",
        person.passportPhoto
    );


    showPhoto(
        "detailDriverLicensePhoto",
        "driverLicenseNoPhoto",
        person.licensePhoto ||
        person.driverLicensePhoto
    );


    showPhoto(
        "detailBankCardPhoto",
        "bankCardNoPhoto",
        person.bankCardPhoto
    );


    /*
       总经理和管理员
       显示安全提示
    */

    const securityNotice =
        document.getElementById(
            "securityNotice"
        );


    if (securityNotice) {

        securityNotice.style.display =
            (
                position ===
                    "总经理" ||
                position ===
                    "管理员"
            )
                ? "block"
                : "none";

    }


    /*
       关闭驳回输入框
    */

    const rejectArea =
        document.getElementById(
            "rejectArea"
        );


    if (rejectArea) {

        rejectArea.style.display =
            "none";

    }


    const rejectReasonInput =
        document.getElementById(
            "rejectReasonInput"
        );


    if (rejectReasonInput) {

        rejectReasonInput.value =
            person.rejectReason ||
            "";

    }


    updateReviewButtons(
        person
    );


    const detailSection =
        document.getElementById(
            "detailSection"
        );


    detailSection.style.display =
        "block";


    detailSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* =========================================================
   审核按钮状态
========================================================= */

function updateReviewButtons(person) {

    const approveButton =
        document.getElementById(
            "approveButton"
        );


    const rejectButton =
        document.getElementById(
            "rejectButton"
        );


    if (
        !approveButton ||
        !rejectButton
    ) {

        return;

    }


    const status =
        normalizeApprovalStatus(
            person
        );


    if (
        status === "approved"
    ) {

        approveButton.textContent =
            "✅ 已审核通过";


        rejectButton.textContent =
            "重新驳回";


    } else if (
        status === "rejected"
    ) {

        approveButton.textContent =
            "✅ 改为审核通过";


        rejectButton.textContent =
            "❌ 已驳回 / 修改原因";


    } else {

        approveButton.textContent =
            "✅ 审核通过";


        rejectButton.textContent =
            "❌ 审核不通过";

    }

}


/* =========================================================
   审核通过
========================================================= */

function approveCurrentPerson() {

    const person =
        findPersonById(
            currentPersonId
        );


    if (!person) {

        alert(
            "请先选择需要审核的人员。"
        );

        return;

    }


    const name =
        person.name ||
        "该人员";


    const position =
        normalizePosition(
            person.position
        );


    const confirmed =
        confirm(
            "确认通过以下人员的入职审核？\n\n" +
            "姓名：" +
            name +
            "\n" +
            "岗位：" +
            position
        );


    if (!confirmed) {
        return;
    }


    const index =
        findPersonIndex(
            currentPersonId
        );


    if (index < 0) {
        return;
    }


    const oldPerson =
        personnelRecords[index];


    /*
       审核通过

       保留人员原有全部字段，
       只更新审核相关字段。
    */

    personnelRecords[index] = {

        ...oldPerson,

        personId:
            getPersonId(
                oldPerson
            ),

        position:
            position,

        status:
            "approved",

        approvalStatus:
            "approved",

        personnelStatus:
            "在职可用",

        approvedAt:
            new Date().toISOString(),

        reviewedAt:
            new Date().toISOString(),

        approvedBy:
            "管理员",

        reviewedBy:
            "管理员",

        rejectReason:
            "",

        rejectionReason:
            "",

        reviewRemark:
            "",

        updatedAt:
            new Date().toISOString()

    };


    savePersonnelRecords();


    /*
       如果是历史汽车司机资料，
       同步旧 driverProfile。

       这样旧的司机工作页面如果暂时
       仍读取 driverProfile，
       不会因为本次统一审核而失效。
    */

    syncLegacyDriverProfile(
        personnelRecords[index]
    );


    alert(
        position === "总经理" ||
        position === "管理员"
            ?
            "审核通过。\n该岗位进入系统前还需要进行密码验证。"
            :
            "审核通过。\n该人员现在可以进入对应工作页面。"
    );


    renderPage();


    openPersonDetail(
        currentPersonId
    );

}


/* =========================================================
   打开驳回区域
========================================================= */

function openRejectArea() {

    const person =
        findPersonById(
            currentPersonId
        );


    if (!person) {

        alert(
            "请先选择需要审核的人员。"
        );

        return;

    }


    const rejectArea =
        document.getElementById(
            "rejectArea"
        );


    const input =
        document.getElementById(
            "rejectReasonInput"
        );


    rejectArea.style.display =
        "block";


    input.value =
        person.rejectReason ||
        person.rejectionReason ||
        person.reviewRemark ||
        "";


    input.focus();


    rejectArea.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}


/* =========================================================
   审核驳回
========================================================= */

function rejectCurrentPerson() {

    const person =
        findPersonById(
            currentPersonId
        );


    if (!person) {

        alert(
            "请先选择需要审核的人员。"
        );

        return;

    }


    const input =
        document.getElementById(
            "rejectReasonInput"
        );


    const reason =
        input.value.trim();


    if (!reason) {

        alert(
            "请填写审核不通过的原因。"
        );

        input.focus();

        return;

    }


    const confirmed =
        confirm(
            "确认驳回该人员的入职申请？\n\n" +
            "姓名：" +
            (person.name || "-") +
            "\n" +
            "岗位：" +
            normalizePosition(
                person.position
            ) +
            "\n\n" +
            "原因：" +
            reason
        );


    if (!confirmed) {
        return;
    }


    const index =
        findPersonIndex(
            currentPersonId
        );


    if (index < 0) {
        return;
    }


    const oldPerson =
        personnelRecords[index];


    personnelRecords[index] = {

        ...oldPerson,

        personId:
            getPersonId(
                oldPerson
            ),

        position:
            normalizePosition(
                oldPerson.position
            ),

        status:
            "rejected",

        approvalStatus:
            "rejected",

        personnelStatus:
            "待审核",

        rejectReason:
            reason,

        rejectionReason:
            reason,

        reviewRemark:
            reason,

        rejectedAt:
            new Date().toISOString(),

        reviewedAt:
            new Date().toISOString(),

        reviewedBy:
            "管理员",

        updatedAt:
            new Date().toISOString()

    };


    savePersonnelRecords();


    syncLegacyDriverProfile(
        personnelRecords[index]
    );


    alert(
        "已驳回。\n员工可以根据驳回原因修改资料后重新提交。"
    );


    renderPage();


    openPersonDetail(
        currentPersonId
    );

}


/* =========================================================
   兼容旧汽车司机 driverProfile
========================================================= */

function syncLegacyDriverProfile(person) {

    if (
        normalizePosition(
            person.position
        ) !== "汽车司机"
    ) {

        return;

    }


    let oldDriver = null;


    try {

        oldDriver =
            JSON.parse(
                localStorage.getItem(
                    "driverProfile"
                )
            );


    } catch (error) {

        oldDriver = null;

    }


    /*
       只有本机本来存在旧 driverProfile
       才同步。

       新统一注册的汽车司机不再创建
       driverProfile。
    */

    if (!oldDriver) {
        return;
    }


    const oldId =
        oldDriver.personId ||
        oldDriver.driverId ||
        oldDriver.id ||
        "";


    const personId =
        getPersonId(person);


    const samePerson =
        (
            oldId &&
            oldId === personId
        ) ||
        (
            oldDriver.phone &&
            person.phone &&
            oldDriver.phone ===
                person.phone
        );


    if (!samePerson) {
        return;
    }


    const updatedDriver = {

        ...oldDriver,

        ...person,

        driverId:
            oldDriver.driverId ||
            personId,

        personId:
            personId,

        position:
            "卡车司机"

    };


    localStorage.setItem(
        "driverProfile",
        JSON.stringify(
            updatedDriver
        )
    );

}


/* =========================================================
   查找人员
========================================================= */

function findPersonById(personId) {

    if (!personId) {
        return null;
    }


    return (
        personnelRecords.find(
            person =>
                getPersonId(
                    person
                ) === personId
        ) ||
        null
    );

}


function findPersonIndex(personId) {

    if (!personId) {
        return -1;
    }


    return personnelRecords.findIndex(
        person =>
            getPersonId(
                person
            ) === personId
    );

}


/* =========================================================
   关闭详情
========================================================= */

function closeDetail() {

    currentPersonId = null;


    const detailSection =
        document.getElementById(
            "detailSection"
        );


    if (detailSection) {

        detailSection.style.display =
            "none";

    }


    const rejectArea =
        document.getElementById(
            "rejectArea"
        );


    if (rejectArea) {

        rejectArea.style.display =
            "none";

    }

}


/* =========================================================
   照片显示
========================================================= */

function showPhoto(
    imageId,
    emptyId,
    source
) {

    const image =
        document.getElementById(
            imageId
        );


    const empty =
        document.getElementById(
            emptyId
        );


    if (
        !image ||
        !empty
    ) {

        return;

    }


    if (source) {

        image.src =
            source;


        image.style.display =
            "block";


        empty.style.display =
            "none";


    } else {

        image.removeAttribute(
            "src"
        );


        image.style.display =
            "none";


        empty.style.display =
            "block";

    }

}


/* =========================================================
   打印人员档案
========================================================= */

function printCurrentProfile() {

    const person =
        findPersonById(
            currentPersonId
        );


    if (!person) {

        alert(
            "请先选择人员。"
        );

        return;

    }


    const position =
        normalizePosition(
            person.position
        );


    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {

        alert(
            "浏览器阻止了打印窗口，请允许弹出窗口后重试。"
        );

        return;

    }


    printWindow.document.write(`
        <!DOCTYPE html>

        <html lang="zh-CN">

        <head>

            <meta charset="UTF-8">

            <title>
                人员档案
            </title>

            <style>

                body {
                    font-family:
                        Arial,
                        "Microsoft YaHei",
                        sans-serif;
                    padding: 30px;
                    color: #111827;
                }

                h1 {
                    text-align: center;
                    margin-bottom: 30px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                td {
                    border: 1px solid #94a3b8;
                    padding: 10px;
                }

                td:first-child {
                    width: 180px;
                    font-weight: bold;
                    background: #f8fafc;
                }

                .footer {
                    margin-top: 40px;
                    text-align: right;
                }

            </style>

        </head>

        <body>

            <h1>
                员工个人档案
            </h1>

            <table>

                <tr>
                    <td>姓名</td>
                    <td>
                        ${escapeHtml(
                            person.name || "-"
                        )}
                    </td>
                </tr>

                <tr>
                    <td>手机号</td>
                    <td>
                        ${escapeHtml(
                            person.phone || "-"
                        )}
                    </td>
                </tr>

                <tr>
                    <td>岗位</td>
                    <td>
                        ${escapeHtml(
                            position || "-"
                        )}
                    </td>
                </tr>

                <tr>
                    <td>人员类别</td>
                    <td>
                        ${escapeHtml(
                            person.personnelCategory ||
                            getPersonnelCategory(
                                position
                            )
                        )}
                    </td>
                </tr>

                <tr>
                    <td>部门 / 车队</td>
                    <td>
                        ${escapeHtml(
                            person.department ||
                            person.team ||
                            "-"
                        )}
                    </td>
                </tr>

                <tr>
                    <td>入职日期</td>
                    <td>
                        ${escapeHtml(
                            person.entryDate ||
                            "-"
                        )}
                    </td>
                </tr>

                <tr>
                    <td>身份证号码</td>
                    <td>
                        ${escapeHtml(
                            person.idCardNumber ||
                            "-"
                        )}
                    </td>
                </tr>

                <tr>
                    <td>护照号码</td>
                    <td>
                        ${escapeHtml(
                            person.passportNumber ||
                            "-"
                        )}
                    </td>
                </tr>

                <tr>
                    <td>银行卡号</td>
                    <td>
                        ${escapeHtml(
                            person.bankCardNumber ||
                            "-"
                        )}
                    </td>
                </tr>

                <tr>
                    <td>紧急联系人</td>
                    <td>
                        ${escapeHtml(
                            person.emergencyContact ||
                            "-"
                        )}
                    </td>
                </tr>

                <tr>
                    <td>紧急联系电话</td>
                    <td>
                        ${escapeHtml(
                            person.emergencyPhone ||
                            "-"
                        )}
                    </td>
                </tr>

                <tr>
                    <td>审核状态</td>
                    <td>
                        ${escapeHtml(
                            getStatusText(
                                normalizeApprovalStatus(
                                    person
                                )
                            )
                        )}
                    </td>
                </tr>

                <tr>
                    <td>备注</td>
                    <td>
                        ${escapeHtml(
                            person.remark ||
                            "-"
                        )}
                    </td>
                </tr>

            </table>

            <div class="footer">
                打印时间：
                ${escapeHtml(
                    new Date()
                        .toLocaleString()
                )}
            </div>

        </body>

        </html>
    `);


    printWindow.document.close();


    printWindow.focus();


    setTimeout(
        function () {

            printWindow.print();

        },
        300
    );

}


/* =========================================================
   打印证件照片
========================================================= */

function printCurrentPhotos() {

    const person =
        findPersonById(
            currentPersonId
        );


    if (!person) {

        alert(
            "请先选择人员。"
        );

        return;

    }


    const photos = [

        {
            name: "身份证照片",
            data:
                person.idCardPhoto
        },

        {
            name: "护照照片",
            data:
                person.passportPhoto
        },

        {
            name:
                "驾驶证 / 操作证照片",

            data:
                person.licensePhoto ||
                person.driverLicensePhoto
        },

        {
            name: "银行卡照片",
            data:
                person.bankCardPhoto
        }

    ].filter(
        item => item.data
    );


    if (
        photos.length === 0
    ) {

        alert(
            "该人员没有上传证件照片。"
        );

        return;

    }


    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {

        alert(
            "浏览器阻止了打印窗口，请允许弹出窗口后重试。"
        );

        return;

    }


    const photoHtml =
        photos.map(photo => `

            <div class="photo">

                <h2>
                    ${escapeHtml(
                        photo.name
                    )}
                </h2>

                <img
                    src="${photo.data}"
                    alt="${escapeHtml(
                        photo.name
                    )}"
                >

            </div>

        `).join("");


    printWindow.document.write(`
        <!DOCTYPE html>

        <html lang="zh-CN">

        <head>

            <meta charset="UTF-8">

            <title>
                证件照片
            </title>

            <style>

                body {
                    font-family:
                        Arial,
                        "Microsoft YaHei",
                        sans-serif;
                    padding: 20px;
                }

                h1 {
                    text-align: center;
                }

                .person {
                    text-align: center;
                    margin-bottom: 30px;
                }

                .photo {
                    page-break-inside: avoid;
                    margin-bottom: 30px;
                    text-align: center;
                }

                .photo img {
                    max-width: 100%;
                    max-height: 700px;
                    object-fit: contain;
                }

            </style>

        </head>

        <body>

            <h1>
                员工证件照片
            </h1>

            <div class="person">
                姓名：
                ${escapeHtml(
                    person.name || "-"
                )}
                &nbsp;&nbsp;
                岗位：
                ${escapeHtml(
                    normalizePosition(
                        person.position
                    ) || "-"
                )}
            </div>

            ${photoHtml}

        </body>

        </html>
    `);


    printWindow.document.close();


    printWindow.focus();


    setTimeout(
        function () {

            printWindow.print();

        },
        500
    );

}


/* =========================================================
   工具函数
========================================================= */

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
            value ?? "-";

    }

}


function getStatusText(status) {

    if (
        status === "approved"
    ) {

        return "已通过";

    }


    if (
        status === "rejected"
    ) {

        return "已驳回";

    }


    return "待审核";

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

        return value;

    }


    return date.toLocaleString(
        "zh-CN",
        {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* =========================================================
   防止表格内容破坏HTML
========================================================= */

function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   onclick 字符串安全
========================================================= */

function escapeJs(value) {

    return String(
        value ?? ""
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
            ""
        )
        .replaceAll(
            "\r",
            ""
        );

}
