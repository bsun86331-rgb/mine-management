/* =========================================================
   矿山管理系统
   V2.11.0 管理员基础资料中心
   人员 + 设备 + 后勤物资
========================================================= */

"use strict";


/* =========================================================
   本地存储
========================================================= */

const STORAGE = {
  PERSONNEL: "personnelRecords",
  EQUIPMENT: "equipmentRecords",
  MATERIALS: "materialRecords",
  MATERIAL_ISSUES: "materialIssueRecords",
  RESIGNATIONS: "resignationSettlementRecords",
  DRIVER_PROFILE: "driverProfile"
};


/* =========================================================
   基础工具
========================================================= */

function readStorage(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch (error) {
    console.error("读取失败：", key, error);
    return fallback;
  }
}


function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


function uid(prefix = "ID") {
  return (
    prefix +
    "-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 7).toUpperCase()
  );
}


function nowISO() {
  return new Date().toISOString();
}


function localDate() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}


function normalizePersonnelPosition(position) {
  const map = {
    "卡车司机": "汽车司机",
    "挖掘机司机": "挖机司机",
    "装载机司机": "铲车司机",
    "大巴": "大巴司机",
    "维修人员": "维修员",
    "修理工": "维修员",
    "维修管理员": "维修管理",
    "修理厂管理员": "维修管理",
    "库房管理员": "库房管理",
    "调度员": "车队长",
    "测量人员": "测量员",
    "安全人员": "安全员",
    "统计员": "统计",
    "财务": "会计",
    "会计员": "会计",
    "后勤人员": "后勤"
  };

  return map[position] || position || "";
}


function personnelStateFields(status) {
  const normalized = String(status || "active");

  if (normalized === "pending") {
    return {
      status: "pending",
      approvalStatus: "pending",
      personnelStatus: "待审核",
      enabled: true
    };
  }

  if (normalized === "disabled") {
    return {
      status: "disabled",
      approvalStatus: "approved",
      personnelStatus: "停用",
      enabled: false
    };
  }

  if (normalized === "resigned") {
    return {
      status: "resigned",
      approvalStatus: "approved",
      personnelStatus: "离职",
      enabled: false
    };
  }

  if (normalized === "working") {
    return {
      status: "working",
      approvalStatus: "approved",
      personnelStatus: "作业中",
      enabled: true
    };
  }

  if (normalized === "leave") {
    return {
      status: "leave",
      approvalStatus: "approved",
      personnelStatus: "请假",
      enabled: true
    };
  }

  return {
    status: "active",
    approvalStatus: "approved",
    personnelStatus: "在职可用",
    enabled: true
  };
}


function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("zh-CN");
}


function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    hour12: false
  });
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}


function showToast(message, type = "success") {
  const toast = document.getElementById("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.className = "toast show " + type;

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 2500);
}


function closeModal(id) {
  const modal = document.getElementById(id);

  if (modal) {
    modal.classList.remove("show");
  }
}


function openModal(id) {
  const modal = document.getElementById(id);

  if (modal) {
    modal.classList.add("show");
  }
}


function goHome() {
  window.location.href = "index.html";
}


function verifyAdminMasterAccess() {
  let session = null;

  try {
    session = JSON.parse(
      sessionStorage.getItem(
        "managementSession"
      )
    );
  } catch (error) {
    session = null;
  }

  if (
    !session ||
    session.verified !== true ||
    normalizePersonnelPosition(
      session.position
    ) !== "管理员" ||
    Number(
      session.expiresAt || 0
    ) <= Date.now()
  ) {
    alert(
      "管理员基础资料中心需要管理员二次验证，请从系统首页重新进入。"
    );

    location.replace(
      "index.html"
    );

    return false;
  }

  const personnel =
    readStorage(
      STORAGE.PERSONNEL,
      []
    );

  const adminId =
    String(
      session.personId ||
      localStorage.getItem(
        "adminPersonId"
      ) ||
      ""
    );

  const admin =
    personnel.find(
      item =>
        String(
          item.personId ||
          item.employeeId ||
          item.driverId ||
          item.id ||
          ""
        ) === adminId
    );

  if (
    !admin ||
    normalizePersonnelPosition(
      admin.position
    ) !== "管理员" ||
    ["rejected","disabled","resigned"].includes(
      String(
        admin.status ||
        ""
      )
    ) ||
    !(
      admin.approvalStatus === "approved" ||
      admin.status === "approved" ||
      admin.status === "active" ||
      admin.personnelStatus === "在职可用"
    )
  ) {
    alert(
      "当前管理员身份无效或已停用。"
    );

    sessionStorage.removeItem(
      "managementSession"
    );

    location.replace(
      "index.html"
    );

    return false;
  }

  localStorage.setItem(
    "adminPersonId",
    adminId
  );

  localStorage.setItem(
    "currentPersonId",
    adminId
  );

  localStorage.setItem(
    "selectedPosition",
    "管理员"
  );

  return true;
}


/* =========================================================
   完全归零 / JSON 备份
========================================================= */

function collectStorageSnapshot(storage) {

  const result = {};


  for (
    let index = 0;
    index < storage.length;
    index++
  ) {

    const key =
      storage.key(index);


    if (!key) {
      continue;
    }


    result[key] =
      storage.getItem(key);
  }


  return result;
}


function buildFullSystemBackup() {

  return {
    meta: {
      product:
        "mine-management",

      backupType:
        "FULL_LOCAL_RESET_BACKUP",

      schemaVersion:
        "1.0",

      createdAt:
        nowISO(),

      page:
        location.href,

      localStorageKeyCount:
        localStorage.length,

      sessionStorageKeyCount:
        sessionStorage.length
    },

    localStorage:
      collectStorageSnapshot(
        localStorage
      ),

    sessionStorage:
      collectStorageSnapshot(
        sessionStorage
      )
  };
}


function backupFileName() {

  const now =
    new Date();


  const stamp = [
    now.getFullYear(),
    String(
      now.getMonth() + 1
    ).padStart(2, "0"),
    String(
      now.getDate()
    ).padStart(2, "0")
  ].join("") +
  "-" +
  [
    String(
      now.getHours()
    ).padStart(2, "0"),
    String(
      now.getMinutes()
    ).padStart(2, "0"),
    String(
      now.getSeconds()
    ).padStart(2, "0")
  ].join("");


  return (
    "mine-management-full-backup-" +
    stamp +
    ".json"
  );
}


function downloadBackupObject(
  backup
) {

  const text =
    JSON.stringify(
      backup,
      null,
      2
    );


  const blob =
    new Blob(
      [
        text
      ],
      {
        type:
          "application/json;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    backupFileName();


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1500
  );
}


function exportFullSystemBackup() {

  try {

    const backup =
      buildFullSystemBackup();


    downloadBackupObject(
      backup
    );


    showToast(
      "JSON 全量备份已开始下载。"
    );


    return backup;

  } catch (
    error
  ) {

    console.error(
      "系统备份失败：",
      error
    );


    alert(
      "系统备份失败，已取消操作。\n\n" +
      (
        error?.message ||
        String(error)
      )
    );


    return null;
  }
}


function classifyResetStorageKeys() {

  const keys =
    [];


  for (
    let index = 0;
    index < localStorage.length;
    index++
  ) {

    const key =
      localStorage.key(index);


    if (key) {
      keys.push(key);
    }
  }


  const counts = {
    personnel: 0,
    equipment: 0,
    production: 0,
    maintenance: 0,
    warehouse: 0,
    fuel: 0,
    attendance: 0,
    finance: 0,
    chat: 0,
    settings: 0,
    tests: 0,
    other: 0
  };


  keys.forEach(
    key => {

      const value =
        key.toLowerCase();


      if (
        /person|driverprofile|roleperson|employee|人员/.test(value)
      ) {
        counts.personnel++;
        return;
      }


      if (
        /equipment|vehicle|excavator|auxiliary|设备|车辆/.test(value)
      ) {
        counts.equipment++;
        return;
      }


      if (
        /dispatch|trip|transport|task|shift|gps|loading|unload|生产|运输/.test(value)
      ) {
        counts.production++;
        return;
      }


      if (
        /maintenance|repair|fault|维修|保养/.test(value)
      ) {
        counts.maintenance++;
        return;
      }


      if (
        /warehouse|material|stock|holder|库房|物资/.test(value)
      ) {
        counts.warehouse++;
        return;
      }


      if (
        /fuel|油/.test(value)
      ) {
        counts.fuel++;
        return;
      }


      if (
        /attendance|leave|考勤|请假/.test(value)
      ) {
        counts.attendance++;
        return;
      }


      if (
        /payroll|salary|finance|cost|penalty|reward|工资|财务|成本/.test(value)
      ) {
        counts.finance++;
        return;
      }


      if (
        /chat|message|聊天/.test(value)
      ) {
        counts.chat++;
        return;
      }


      if (
        /setting|config|zone|price|volume|设置|配置/.test(value)
      ) {
        counts.settings++;
        return;
      }


      if (
        /test|robot|fixture/i.test(key)
      ) {
        counts.tests++;
        return;
      }


      counts.other++;
    }
  );


  return {
    total:
      keys.length,

    sessionTotal:
      sessionStorage.length,

    keys,

    counts
  };
}


function resetSummaryText() {

  const summary =
    classifyResetStorageKeys();


  const lines = [
    "⚠️ 这是完全归零操作。",
    "",
    "将清空当前浏览器中的全部 mine-management 本地数据，包括：",
    "• 人员登记、审核、人员照片和当前人员身份",
    "• 车辆、挖机、辅助车辆及设备档案/状态",
    "• 调度任务、班次、运输趟次、GPS、临时装车/卸料",
    "• 设备检查、维修、保养及故障记录",
    "• 库房、物资、库存、领用、退还、报废记录",
    "• 加油申请、加油记录",
    "• 考勤、请假、奖罚、工资、成本、报表数据",
    "• 工作聊天消息和照片",
    "• 本地系统设置、页面配置和测试记录",
    "• 当前登录状态和管理员会话",
    "",
    "当前 localStorage 键：" +
      summary.total +
      " 个",
    "当前 sessionStorage 键：" +
      summary.sessionTotal +
      " 个",
    "",
    "执行前会自动下载完整 JSON 备份。",
    "",
    "不会删除：",
    "• GitHub 仓库代码",
    "• GitHub Pages 页面文件",
    "• Supabase 项目 / 数据库表 / Auth 用户",
    "",
    "确定进入第二次确认吗？"
  ];


  return lines.join(
    "\n"
  );
}


function setSystemResetStatus(
  message,
  type = ""
) {

  const box =
    document.getElementById(
      "systemResetStatus"
    );


  if (!box) {
    return;
  }


  box.textContent =
    message || "";


  box.className =
    "system-reset-status" +
    (
      message
        ? " show"
        : ""
    ) +
    (
      type
        ? " " + type
        : ""
    );
}


function startFullSystemReset() {

  const modal =
    document.getElementById(
      "systemResetModal"
    );


  const summary =
    document.getElementById(
      "systemResetSummary"
    );


  const confirmBox =
    document.getElementById(
      "systemResetConfirmBox"
    );


  const confirmInput =
    document.getElementById(
      "systemResetConfirmInput"
    );


  const nextButton =
    document.getElementById(
      "systemResetNextButton"
    );


  const executeButton =
    document.getElementById(
      "systemResetExecuteButton"
    );


  if (
    !modal ||
    !summary
  ) {

    alert(
      "归零确认窗口加载失败，请强制刷新页面后重试。"
    );

    return;
  }


  summary.textContent =
    resetSummaryText()
      .replace(
        "\n确定进入第二次确认吗？",
        ""
      );


  if (confirmBox) {
    confirmBox.classList.remove(
      "show"
    );
  }


  if (confirmInput) {
    confirmInput.value =
      "";
  }


  if (nextButton) {
    nextButton.style.display =
      "";
  }


  if (executeButton) {
    executeButton.classList.remove(
      "show"
    );

    executeButton.disabled =
      false;

    executeButton.textContent =
      "下载备份并归零";
  }


  setSystemResetStatus(
    ""
  );


  modal.classList.add(
    "show"
  );


  modal.setAttribute(
    "aria-hidden",
    "false"
  );
}


function closeSystemResetModal() {

  const modal =
    document.getElementById(
      "systemResetModal"
    );


  if (modal) {
    modal.classList.remove(
      "show"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );
  }
}


function showSystemResetSecondStep() {

  const confirmBox =
    document.getElementById(
      "systemResetConfirmBox"
    );


  const confirmInput =
    document.getElementById(
      "systemResetConfirmInput"
    );


  const nextButton =
    document.getElementById(
      "systemResetNextButton"
    );


  const executeButton =
    document.getElementById(
      "systemResetExecuteButton"
    );


  confirmBox
    ?.classList.add(
      "show"
    );


  if (nextButton) {
    nextButton.style.display =
      "none";
  }


  executeButton
    ?.classList.add(
      "show"
    );


  setSystemResetStatus(
    "第二步：只有输入 RESET 后才会真正删除数据。"
  );


  setTimeout(
    () =>
      confirmInput
        ?.focus(),
    50
  );
}


async function executeFullSystemReset() {

  const input =
    document.getElementById(
      "systemResetConfirmInput"
    );


  const button =
    document.getElementById(
      "systemResetExecuteButton"
    );


  if (
    String(
      input?.value ||
      ""
    ).trim() !==
      "RESET"
  ) {

    setSystemResetStatus(
      "输入内容不是 RESET，系统没有执行任何删除。",
      "error"
    );

    input?.focus();

    return;
  }


  if (button) {
    button.disabled =
      true;

    button.textContent =
      "正在备份...";
  }


  setSystemResetStatus(
    "正在生成并下载 JSON 全量备份，请稍候..."
  );


  let backup;


  try {

    backup =
      buildFullSystemBackup();


    downloadBackupObject(
      backup
    );

  } catch (
    error
  ) {

    console.error(
      "归零前备份失败：",
      error
    );


    setSystemResetStatus(
      "JSON 备份失败，因此已自动取消归零。\n" +
      (
        error?.message ||
        String(error)
      ),
      "error"
    );


    if (button) {
      button.disabled =
        false;

      button.textContent =
        "下载备份并归零";
    }


    return;
  }


  /*
   * 给浏览器一个短暂时间启动文件下载，
   * 再执行存储清空，避免部分内置浏览器中下载与清空竞争。
   */
  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        600
      )
  );


  if (button) {
    button.textContent =
      "正在归零...";
  }


  setSystemResetStatus(
    "备份已触发下载，正在清空本地数据..."
  );


  try {

    localStorage.clear();

    sessionStorage.clear();

  } catch (
    error
  ) {

    console.error(
      "系统数据归零失败：",
      error
    );


    setSystemResetStatus(
      "清空浏览器存储失败。JSON 备份已经下载，但数据没有完全删除。\n" +
      (
        error?.message ||
        String(error)
      ),
      "error"
    );


    if (button) {
      button.disabled =
        false;

      button.textContent =
        "重新尝试归零";
    }


    return;
  }


  const localRemaining =
    localStorage.length;


  const sessionRemaining =
    sessionStorage.length;


  if (
    localRemaining !==
      0 ||
    sessionRemaining !==
      0
  ) {

    setSystemResetStatus(
      "归零校验失败：仍剩余 localStorage " +
      localRemaining +
      " 个键，sessionStorage " +
      sessionRemaining +
      " 个键。已停止跳转，请重试。",
      "error"
    );


    if (button) {
      button.disabled =
        false;

      button.textContent =
        "重新尝试归零";
    }


    return;
  }


  setSystemResetStatus(
    "归零成功：localStorage 0 个键，sessionStorage 0 个键。正在返回首页...",
    "success"
  );


  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        900
      )
  );


  location.replace(
    "index.html?reset=1"
  );
}


/* =========================================================
   Excel 导出
========================================================= */

function excelCellText(
  value
) {

  return String(
    value ??
    ""
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
    );
}


function excelFileStamp() {

  const now =
    new Date();


  return [
    now.getFullYear(),
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    ),
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    )
  ].join(
    ""
  );
}


function downloadExcelTable({
  title,
  fileName,
  headers,
  rows
}) {

  if (
    !Array.isArray(
      rows
    ) ||
    !rows.length
  ) {

    showToast(
      "当前没有可导出的数据。",
      "warning"
    );

    return;
  }


  const tableHead =
    "<tr>" +
    headers.map(
      header =>
        "<th>" +
        excelCellText(
          header
        ) +
        "</th>"
    )
    .join(
      ""
    ) +
    "</tr>";


  const tableBody =
    rows.map(
      row =>
        "<tr>" +
        row.map(
          cell =>
            '<td style="mso-number-format:\'\\@\';">' +
            excelCellText(
              cell
            ) +
            "</td>"
        )
        .join(
          ""
        ) +
        "</tr>"
    )
    .join(
      ""
    );


  const html =
    `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body{font-family:"Microsoft YaHei",Arial,sans-serif;}
h2{margin:0 0 12px;}
table{border-collapse:collapse;}
th,td{border:1px solid #999;padding:6px 8px;white-space:nowrap;}
th{background:#f1f5f9;font-weight:700;}
</style>
</head>
<body>
<h2>${excelCellText(title)}</h2>
<table>
<thead>${tableHead}</thead>
<tbody>${tableBody}</tbody>
</table>
</body>
</html>`;


  const blob =
    new Blob(
      [
        "\ufeff",
        html
      ],
      {
        type:
          "application/vnd.ms-excel;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    fileName;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1500
  );


  showToast(
    "Excel 已开始下载。"
  );
}


function exportPersonnelExcel() {

  const records =
    getPersonnel()
      .slice()
      .sort(
        (a, b) =>
          String(
            a.name ||
            ""
          )
          .localeCompare(
            String(
              b.name ||
              ""
            ),
            "zh-CN"
          )
      );


  const headers = [
    "员工编号",
    "姓名",
    "手机号",
    "岗位",
    "所属班组/部门",
    "人员状态",
    "审核状态",
    "身份证号",
    "护照号",
    "入职日期",
    "紧急联系人",
    "紧急联系电话",
    "银行卡号",
    "开户行",
    "备注"
  ];


  const rows =
    records.map(
      person => [
        person.employeeNo ||
        person.employeeId ||
          "",

        person.name ||
          "",

        person.phone ||
          "",

        normalizePersonnelPosition(
          person.position ||
          ""
        ),

        person.team ||
        person.department ||
          "",

        person.personnelStatus ||
        personnelStatusText(
          person.status
        ),

        person.approvalStatus ||
          "",

        person.idCardNumber ||
          "",

        person.passportNumber ||
          "",

        person.entryDate ||
          "",

        person.emergencyContact ||
          "",

        person.emergencyPhone ||
          "",

        person.bankCardNumber ||
          "",

        person.bankName ||
          "",

        person.remark ||
          ""
      ]
    );


  downloadExcelTable({
    title:
      "矿山管理系统 - 人员资料",

    fileName:
      "人员资料-" +
      excelFileStamp() +
      ".xls",

    headers,

    rows
  });
}


function exportEquipmentExcel() {

  const records =
    getEquipment()
      .slice()
      .sort(
        (a, b) =>
          String(
            a.equipmentNumber ||
            ""
          )
          .localeCompare(
            String(
              b.equipmentNumber ||
              ""
            ),
            undefined,
            {
              numeric:
                true
            }
          )
      );


  const headers = [
    "设备编号",
    "设备名称",
    "设备类别",
    "大架号",
    "发动机号",
    "车牌号",
    "所属公司/车队",
    "载重/斗容",
    "燃油类型",
    "当前状态",
    "入场日期",
    "备注"
  ];


  const rows =
    records.map(
      item => [
        item.equipmentNumber ||
          "",

        item.equipmentName ||
          "",

        item.type ||
          "",

        item.frameNumber ||
        item.vin ||
        item.chassisNumber ||
          "",

        item.engineNumber ||
          "",

        item.plateNumber ||
          "",

        item.team ||
          "",

        item.capacity ||
          "",

        item.fuelType ||
          "",

        equipmentStatusText(
          item.status
        ),

        item.entryDate ||
          "",

        item.remark ||
          ""
      ]
    );


  downloadExcelTable({
    title:
      "矿山管理系统 - 设备资料",

    fileName:
      "设备资料-" +
      excelFileStamp() +
      ".xls",

    headers,

    rows
  });
}


function exportMaterialInventoryExcel() {

  const materials =
    getMaterials()
      .slice()
      .sort(
        (a, b) =>
          String(
            a.name ||
            ""
          )
          .localeCompare(
            String(
              b.name ||
              ""
            ),
            "zh-CN"
          )
      );


  const outstandingRows =
    getAllOutstandingMaterials();


  const headers = [
    "物资编号",
    "物资编码",
    "物资名称",
    "分类",
    "规格型号",
    "单位",
    "物资属性",
    "当前可用库存",
    "员工未归还",
    "最低库存",
    "库存状态",
    "参考单价",
    "当前库存参考金额",
    "丢失扣款/单位",
    "损坏扣款/单位",
    "备注"
  ];


  const rows =
    materials.map(
      item => {

        const stock =
          numberValue(
            item.stock ??
            item.availableQty
          );


        const outstanding =
          outstandingRows
            .filter(
              record =>
                record.materialId ===
                  item.materialId
            )
            .reduce(
              (
                sum,
                record
              ) =>
                sum +
                numberValue(
                  record.outstandingQuantity
                ),
              0
            );


        const minimumStock =
          numberValue(
            item.minimumStock
          );


        const referencePrice =
          numberValue(
            item.referencePrice
          );


        let stockState =
          "正常";


        if (
          stock <=
            0
        ) {

          stockState =
            "无库存";

        } else if (
          minimumStock >
            0 &&
          stock <=
            minimumStock
        ) {

          stockState =
            "低库存";
        }


        return [
          item.materialId ||
            "",

          item.code ||
            "",

          item.name ||
            "",

          item.category ||
            "",

          item.spec ||
            "",

          item.unit ||
            "",

          item.type ===
            "returnable"
              ? "可回收物资"
              : (
                  item.type ===
                    "recyclable"
                    ? "可回收物资"
                    : "消耗品"
                ),

          stock,

          outstanding,

          minimumStock ||
            "",

          stockState,

          referencePrice ||
            "",

          referencePrice
            ? (
                stock *
                referencePrice
              ).toFixed(
                2
              )
            : "",

          numberValue(
            item.lostDeduction
          ) ||
            "",

          numberValue(
            item.damageDeduction
          ) ||
            "",

          item.remark ||
            ""
        ];
      }
    );


  downloadExcelTable({
    title:
      "矿山管理系统 - 后勤物资库存",

    fileName:
      "后勤物资库存-" +
      excelFileStamp() +
      ".xls",

    headers,

    rows
  });
}


/* =========================================================
   状态文字
========================================================= */

const PERSONNEL_STATUS = {
  active: "🟢 在职可用",
  working: "🔴 作业中",
  leave: "🟣 请假",
  pending: "🟡 待审核",
  disabled: "⚫ 停用",
  resigned: "⚫ 已离职"
};


const EQUIPMENT_STATUS = {
  available: "🟢 可用",
  working: "🔴 作业中",
  maintenance: "🟡 维修中",
  service: "🟣 保养中",
  standby: "🔵 备用",
  disabled: "⚫ 停用"
};


function personnelStatusText(status) {
  return PERSONNEL_STATUS[status] || status || "-";
}


function equipmentStatusText(status) {
  return EQUIPMENT_STATUS[status] || status || "-";
}


function materialTypeText(type) {
  return type === "returnable"
    ? "🔁 可回收物资"
    : "📦 消耗品";
}


/* =========================================================
   兼容已有卡车司机资料
========================================================= */

function importExistingDriverProfile() {
  let profile;

  try {
    profile = JSON.parse(
      localStorage.getItem(STORAGE.DRIVER_PROFILE)
    );
  } catch {
    profile = null;
  }

  if (!profile || !profile.name) return;

  const personnel = readStorage(STORAGE.PERSONNEL, []);

  const profileId =
    profile.driverId ||
    profile.personId ||
    profile.id ||
    "";

  const exists = personnel.some(person => {
    if (
      profileId &&
      (person.personId === profileId ||
       person.driverId === profileId ||
       person.id === profileId)
    ) {
      return true;
    }

    return (
      person.name === profile.name &&
      person.phone === profile.phone
    );
  });

  if (exists) return;

  personnel.push({
    personId: profileId || uid("PER"),
    driverId: profile.driverId || profileId || "",
    name: profile.name || "",
    phone: profile.phone || "",
    position: normalizePersonnelPosition(
      profile.position || "汽车司机"
    ),
    team: profile.team || "",
    idCardNumber:
      profile.idCardNumber ||
      profile.idCard ||
      "",
    passportNumber:
      profile.passportNumber ||
      profile.passport ||
      "",
    emergencyContact:
      profile.emergencyContact || "",
    emergencyPhone:
      profile.emergencyPhone || "",
    entryDate:
      profile.entryDate || "",
    ...personnelStateFields(
      profile.status === "pending"
        ? "pending"
        : "active"
    ),
    remark: profile.remark || "",
    createdAt:
      profile.createdAt || nowISO(),
    updatedAt: nowISO()
  });

  writeStorage(STORAGE.PERSONNEL, personnel);
}


/* =========================================================
   页面切换
========================================================= */

function switchModule(module) {
  document
    .querySelectorAll(".module-section")
    .forEach(el => el.classList.remove("active"));

  document
    .querySelectorAll(".tab-btn")
    .forEach(el => el.classList.remove("active"));

  const section =
    document.getElementById(module + "Module");

  const tab =
    document.getElementById(module + "Tab");

  if (section) section.classList.add("active");
  if (tab) tab.classList.add("active");

  if (module === "personnel") {
    renderPersonnel();
  }

  if (module === "equipment") {
    renderEquipment();
  }

  if (module === "material") {
    refreshMaterialSelectors();
    renderMaterials();
  }
}


function switchMaterialView(view) {
  document
    .querySelectorAll(".material-view")
    .forEach(el => el.classList.remove("active"));

  document
    .querySelectorAll(".sub-tab")
    .forEach(el => el.classList.remove("active"));

  const viewMap = {
    stock: [
      "materialStockView",
      "materialStockTab"
    ],
    issue: [
      "materialIssueView",
      "materialIssueTab"
    ],
    return: [
      "materialReturnView",
      "materialReturnTab"
    ],
    employee: [
      "materialEmployeeView",
      "materialEmployeeTab"
    ],
    history: [
      "materialHistoryView",
      "materialHistoryTab"
    ],
    settlement: [
      "resignationSettlementView",
      "resignationSettlementTab"
    ]
  };

  const target = viewMap[view];

  if (!target) return;

  document
    .getElementById(target[0])
    ?.classList.add("active");

  document
    .getElementById(target[1])
    ?.classList.add("active");

  refreshMaterialSelectors();

  if (view === "stock") renderMaterials();

  if (view === "return") {
    loadPersonReturnableMaterials();
  }

  if (view === "employee") {
    renderEmployeeMaterials();
  }

  if (view === "history") {
    renderMaterialHistory();
  }

  if (view === "settlement") {
    renderSettlementRecords();
  }
}


/* =========================================================
   统计
========================================================= */

function updateSummary() {
  const personnel =
    readStorage(STORAGE.PERSONNEL, []);

  const equipment =
    readStorage(STORAGE.EQUIPMENT, []);

  const materials =
    readStorage(STORAGE.MATERIALS, []);

  const activePersonnel =
    personnel.filter(person =>
      !["resigned", "disabled"].includes(person.status)
    ).length;

  const outstanding =
    getAllOutstandingMaterials()
      .reduce(
        (sum, item) =>
          sum + numberValue(item.outstandingQuantity),
        0
      );

  setText(
    "activePersonnelCount",
    activePersonnel
  );

  setText(
    "equipmentCount",
    equipment.length
  );

  setText(
    "materialCount",
    materials.length
  );

  setText(
    "unreturnedCount",
    outstanding
  );
}


function setText(id, value) {
  const el = document.getElementById(id);

  if (el) {
    el.textContent = value;
  }
}


/* =========================================================
   人员管理
========================================================= */

function getPersonnel() {
  return readStorage(STORAGE.PERSONNEL, []);
}


function savePersonnelRecords(records) {
  writeStorage(STORAGE.PERSONNEL, records);
}


function openPersonnelModal(personId = "") {
  clearPersonnelForm();

  const title =
    document.getElementById("personnelModalTitle");

  if (!personId) {
    if (title) {
      title.textContent = "👷 新增人员";
    }

    document.getElementById(
      "personnelEntryDate"
    ).value = localDate();

    openModal("personnelModal");
    return;
  }

  const person =
    getPersonnel().find(
      item => item.personId === personId
    );

  if (!person) {
    showToast("未找到人员资料", "error");
    return;
  }

  if (title) {
    title.textContent = "✏️ 编辑人员";
  }

  document.getElementById(
    "personnelId"
  ).value = person.personId || "";

  document.getElementById(
    "personnelName"
  ).value = person.name || "";

  document.getElementById(
    "personnelPhone"
  ).value = person.phone || "";

  document.getElementById(
    "personnelPosition"
  ).value = normalizePersonnelPosition(
    person.position || ""
  );

  document.getElementById(
    "personnelTeam"
  ).value = person.team || "";

  document.getElementById(
    "personnelIdCard"
  ).value =
    person.idCardNumber || "";

  document.getElementById(
    "personnelPassport"
  ).value =
    person.passportNumber || "";

  document.getElementById(
    "personnelEmergencyContact"
  ).value =
    person.emergencyContact || "";

  document.getElementById(
    "personnelEmergencyPhone"
  ).value =
    person.emergencyPhone || "";

  document.getElementById(
    "personnelEntryDate"
  ).value =
    person.entryDate || "";

  document.getElementById(
    "personnelStatus"
  ).value =
    person.status === "resigned"
      ? "disabled"
      : person.status || "active";

  document.getElementById(
    "personnelRemark"
  ).value = person.remark || "";

  openModal("personnelModal");
}


function clearPersonnelForm() {
  [
    "personnelId",
    "personnelName",
    "personnelPhone",
    "personnelTeam",
    "personnelIdCard",
    "personnelPassport",
    "personnelEmergencyContact",
    "personnelEmergencyPhone",
    "personnelEntryDate",
    "personnelRemark"
  ].forEach(id => {
    const el = document.getElementById(id);

    if (el) el.value = "";
  });

  const position =
    document.getElementById(
      "personnelPosition"
    );

  if (position) position.value = "";

  const status =
    document.getElementById(
      "personnelStatus"
    );

  if (status) status.value = "active";
}


function savePersonnel() {
  const personId =
    document
      .getElementById("personnelId")
      .value.trim();

  const name =
    document
      .getElementById("personnelName")
      .value.trim();

  const phone =
    document
      .getElementById("personnelPhone")
      .value.trim();

  const position =
    normalizePersonnelPosition(
      document
        .getElementById("personnelPosition")
        .value
    );

  if (!name) {
    showToast("请填写姓名", "error");
    return;
  }

  if (!phone) {
    showToast("请填写手机号", "error");
    return;
  }

  if (!position) {
    showToast("请选择岗位", "error");
    return;
  }

  const records = getPersonnel();

  const duplicate = records.find(
    item =>
      item.phone === phone &&
      item.personId !== personId &&
      item.status !== "resigned"
  );

  if (duplicate) {
    showToast(
      "该手机号已经存在人员档案",
      "error"
    );
    return;
  }

  const selectedStatus =
    document
      .getElementById(
        "personnelStatus"
      )
      .value;

  const data = {
    name,
    phone,
    position,

    team:
      document
        .getElementById("personnelTeam")
        .value.trim(),

    idCardNumber:
      document
        .getElementById("personnelIdCard")
        .value.trim(),

    passportNumber:
      document
        .getElementById("personnelPassport")
        .value.trim(),

    emergencyContact:
      document
        .getElementById(
          "personnelEmergencyContact"
        )
        .value.trim(),

    emergencyPhone:
      document
        .getElementById(
          "personnelEmergencyPhone"
        )
        .value.trim(),

    entryDate:
      document
        .getElementById(
          "personnelEntryDate"
        )
        .value,

    ...personnelStateFields(
      selectedStatus
    ),

    remark:
      document
        .getElementById(
          "personnelRemark"
        )
        .value.trim(),

    updatedAt: nowISO()
  };

  if (personId) {
    const index = records.findIndex(
      item => item.personId === personId
    );

    if (index < 0) {
      showToast(
        "未找到需要编辑的人员",
        "error"
      );
      return;
    }

    records[index] = {
      ...records[index],
      ...data
    };
  } else {
    records.push({
      personId: uid("PER"),
      ...data,
      createdAt: nowISO()
    });
  }

  savePersonnelRecords(records);

  closeModal("personnelModal");

  renderPersonnel();
  refreshMaterialSelectors();
  updateSummary();

  showToast("人员资料已保存");
}


function renderPersonnel() {
  const container =
    document.getElementById("personnelList");

  if (!container) return;

  const search =
    document
      .getElementById("personnelSearch")
      ?.value
      .trim()
      .toLowerCase() || "";

  const position =
    document
      .getElementById(
        "personnelPositionFilter"
      )
      ?.value || "";

  const status =
    document
      .getElementById(
        "personnelStatusFilter"
      )
      ?.value || "";

  let records = getPersonnel();

  records = records.filter(person => {
    const text = [
      person.name,
      person.phone,
      person.position,
      person.team
    ]
      .join(" ")
      .toLowerCase();

    if (
      search &&
      !text.includes(search)
    ) {
      return false;
    }

    if (
      position &&
      normalizePersonnelPosition(
        person.position
      ) !==
        normalizePersonnelPosition(
          position
        )
    ) {
      return false;
    }

    if (
      status &&
      person.status !== status
    ) {
      return false;
    }

    return true;
  });

  records.sort((a, b) => {
    if (
      a.status === "resigned" &&
      b.status !== "resigned"
    ) return 1;

    if (
      b.status === "resigned" &&
      a.status !== "resigned"
    ) return -1;

    return String(a.name || "")
      .localeCompare(
        String(b.name || ""),
        "zh-CN"
      );
  });

  if (!records.length) {
    container.innerHTML =
      '<div class="empty-state">暂无人员资料</div>';
    return;
  }

  container.innerHTML =
    records.map(person => {

      const outstanding =
        getPersonOutstandingMaterials(
          person.personId
        );

      const outstandingCount =
        outstanding.reduce(
          (sum, item) =>
            sum +
            numberValue(
              item.outstandingQuantity
            ),
          0
        );

      const resigned =
        person.status === "resigned";

      return `
        <article class="record-card">

          <div class="record-main">

            <div class="record-title-row">

              <h3>
                ${escapeHtml(person.name)}
              </h3>

              <span class="status-badge">
                ${escapeHtml(
                  personnelStatusText(
                    person.status
                  )
                )}
              </span>

            </div>

            <div class="record-meta">

              <span>
                👷 ${escapeHtml(
                  normalizePersonnelPosition(
                    person.position
                  ) || "-"
                )}
              </span>

              <span>
                📱 ${escapeHtml(
                  person.phone || "-"
                )}
              </span>

              <span>
                👥 ${escapeHtml(
                  person.team || "未分配"
                )}
              </span>

              <span>
                📅 入职：
                ${escapeHtml(
                  person.entryDate || "-"
                )}
              </span>

            </div>

            ${
              outstandingCount > 0
                ? `
                  <div class="record-warning">
                    ⚠️ 名下有
                    ${outstandingCount}
                    件可回收物资未归还
                  </div>
                `
                : ""
            }

            ${
              resigned
                ? `
                  <div class="resigned-info">
                    离职日期：
                    ${escapeHtml(
                      person.resignationDate ||
                      "-"
                    )}
                  </div>
                `
                : ""
            }

          </div>

          <div class="record-actions">

            ${
              !resigned
                ? `
                  <button
                    class="btn btn-small btn-secondary"
                    onclick="openPersonnelModal('${person.personId}')">
                    编辑
                  </button>

                  <button
                    class="btn btn-small btn-warning"
                    onclick="togglePersonnelDisabled('${person.personId}')">
                    ${
                      person.status === "disabled"
                        ? "恢复"
                        : "停用"
                    }
                  </button>

                  <button
                    class="btn btn-small btn-danger"
                    onclick="openResignationModal('${person.personId}')">
                    办理离职
                  </button>
                `
                : ""
            }

          </div>

        </article>
      `;
    }).join("");
}


function togglePersonnelDisabled(personId) {
  const records = getPersonnel();

  const index =
    records.findIndex(
      item => item.personId === personId
    );

  if (index < 0) return;

  if (records[index].status === "resigned") {
    showToast(
      "已离职人员不能恢复",
      "error"
    );
    return;
  }

  const nextStatus =
    records[index].status === "disabled"
      ? "active"
      : "disabled";

  Object.assign(
    records[index],
    personnelStateFields(
      nextStatus
    )
  );

  records[index].updatedAt =
    nowISO();

  savePersonnelRecords(records);

  renderPersonnel();
  updateSummary();

  showToast("人员状态已更新");
}


/* =========================================================
   设备管理
========================================================= */

function getEquipment() {
  return readStorage(STORAGE.EQUIPMENT, []);
}


function saveEquipmentRecords(records) {
  writeStorage(STORAGE.EQUIPMENT, records);
}


let equipmentCertificatePhotoData =
  "";

let equipmentEntryPhotoData =
  "";


function showEquipmentPhotoPreview(
  previewId,
  data
) {
  const preview =
    document.getElementById(
      previewId
    );

  if (!preview) return;

  if (data) {
    preview.src = data;
    preview.style.display = "block";
  } else {
    preview.removeAttribute("src");
    preview.style.display = "none";
  }
}


function compressEquipmentImage(
  file,
  maxSide = 1400,
  quality = 0.72
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader();

      reader.onerror = () =>
        reject(
          new Error(
            "图片读取失败"
          )
        );

      reader.onload = event => {
        const image =
          new Image();

        image.onerror = () =>
          reject(
            new Error(
              "图片解析失败"
            )
          );

        image.onload = () => {
          let width =
            image.naturalWidth ||
            image.width;

          let height =
            image.naturalHeight ||
            image.height;

          const ratio =
            Math.min(
              1,
              maxSide /
                Math.max(
                  width,
                  height
                )
            );

          width =
            Math.max(
              1,
              Math.round(
                width *
                ratio
              )
            );

          height =
            Math.max(
              1,
              Math.round(
                height *
                ratio
              )
            );

          const canvas =
            document.createElement(
              "canvas"
            );

          canvas.width =
            width;

          canvas.height =
            height;

          const context =
            canvas.getContext(
              "2d"
            );

          context.drawImage(
            image,
            0,
            0,
            width,
            height
          );

          resolve(
            canvas.toDataURL(
              "image/jpeg",
              quality
            )
          );
        };

        image.src =
          event.target.result;
      };

      reader.readAsDataURL(
        file
      );
    }
  );
}


async function handleEquipmentPhotoChange(
  inputId,
  kind
) {
  const input =
    document.getElementById(
      inputId
    );

  const file =
    input?.files?.[0];

  if (!file) return;

  try {
    const isCertificate =
      kind === "certificate";

    const data =
      await compressEquipmentImage(
        file,
        isCertificate
          ? 1600
          : 1280,
        isCertificate
          ? 0.74
          : 0.68
      );

    if (isCertificate) {
      equipmentCertificatePhotoData =
        data;

      showEquipmentPhotoPreview(
        "equipmentCertificatePreview",
        data
      );
    } else {
      equipmentEntryPhotoData =
        data;

      showEquipmentPhotoPreview(
        "equipmentEntryPhotoPreview",
        data
      );
    }

  } catch (error) {
    console.error(
      "设备图片处理失败：",
      error
    );

    showToast(
      "图片处理失败，请重新选择",
      "error"
    );

    if (input) {
      input.value = "";
    }
  }
}


function clearEquipmentForm() {
  [
    "equipmentId",
    "equipmentNumber",
    "equipmentName",
    "equipmentFrameNumber",
    "equipmentEngineNumber",
    "equipmentPlate",
    "equipmentTeam",
    "equipmentCapacity",
    "equipmentEntryDate",
    "equipmentRemark"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  document.getElementById(
    "equipmentType"
  ).value = "";

  document.getElementById(
    "equipmentFuel"
  ).value = "";

  document.getElementById(
    "equipmentStatus"
  ).value = "available";

  const certificateInput =
    document.getElementById(
      "equipmentCertificatePhoto"
    );

  const entryPhotoInput =
    document.getElementById(
      "equipmentEntryPhoto"
    );

  if (certificateInput) {
    certificateInput.value = "";
  }

  if (entryPhotoInput) {
    entryPhotoInput.value = "";
  }

  equipmentCertificatePhotoData =
    "";

  equipmentEntryPhotoData =
    "";

  showEquipmentPhotoPreview(
    "equipmentCertificatePreview",
    ""
  );

  showEquipmentPhotoPreview(
    "equipmentEntryPhotoPreview",
    ""
  );
}


function openEquipmentModal(equipmentId = "") {
  clearEquipmentForm();

  const title =
    document.getElementById(
      "equipmentModalTitle"
    );

  if (!equipmentId) {
    title.textContent = "🚜 新增设备";

    document.getElementById(
      "equipmentEntryDate"
    ).value = localDate();

    openModal("equipmentModal");
    return;
  }

  const equipment =
    getEquipment().find(
      item =>
        item.equipmentId === equipmentId
    );

  if (!equipment) {
    showToast("未找到设备", "error");
    return;
  }

  title.textContent = "✏️ 编辑设备";

  document.getElementById(
    "equipmentId"
  ).value = equipment.equipmentId || "";

  document.getElementById(
    "equipmentNumber"
  ).value = equipment.equipmentNumber || "";

  document.getElementById(
    "equipmentName"
  ).value = equipment.equipmentName || "";

  document.getElementById(
    "equipmentType"
  ).value = equipment.type || "";

  document.getElementById(
    "equipmentFrameNumber"
  ).value =
    equipment.frameNumber ||
    equipment.vin ||
    equipment.chassisNumber ||
    "";

  document.getElementById(
    "equipmentEngineNumber"
  ).value =
    equipment.engineNumber ||
    "";

  document.getElementById(
    "equipmentPlate"
  ).value = equipment.plateNumber || "";

  document.getElementById(
    "equipmentTeam"
  ).value = equipment.team || "";

  document.getElementById(
    "equipmentCapacity"
  ).value = equipment.capacity || "";

  document.getElementById(
    "equipmentFuel"
  ).value = equipment.fuelType || "";

  document.getElementById(
    "equipmentEntryDate"
  ).value = equipment.entryDate || "";

  document.getElementById(
    "equipmentStatus"
  ).value = equipment.status || "available";

  document.getElementById(
    "equipmentRemark"
  ).value = equipment.remark || "";

  equipmentCertificatePhotoData =
    equipment.certificatePhoto ||
    "";

  equipmentEntryPhotoData =
    equipment.entryPhoto ||
    "";

  showEquipmentPhotoPreview(
    "equipmentCertificatePreview",
    equipmentCertificatePhotoData
  );

  showEquipmentPhotoPreview(
    "equipmentEntryPhotoPreview",
    equipmentEntryPhotoData
  );

  openModal("equipmentModal");
}


function saveEquipment() {
  const equipmentId =
    document
      .getElementById("equipmentId")
      .value.trim();

  const equipmentNumber =
    document
      .getElementById(
        "equipmentNumber"
      )
      .value.trim();

  const type =
    document
      .getElementById(
        "equipmentType"
      )
      .value;

  if (!equipmentNumber) {
    showToast(
      "请填写设备编号",
      "error"
    );
    return;
  }

  if (!type) {
    showToast(
      "请选择设备类别",
      "error"
    );
    return;
  }

  const records = getEquipment();

  const duplicate =
    records.find(
      item =>
        item.equipmentNumber
          ?.toLowerCase() ===
          equipmentNumber.toLowerCase() &&
        item.equipmentId !== equipmentId
    );

  if (duplicate) {
    showToast(
      "该设备编号已经存在",
      "error"
    );
    return;
  }

  const data = {
    equipmentNumber,

    equipmentName:
      document
        .getElementById(
          "equipmentName"
        )
        .value.trim(),

    type,

    frameNumber:
      document
        .getElementById(
          "equipmentFrameNumber"
        )
        .value.trim(),

    engineNumber:
      document
        .getElementById(
          "equipmentEngineNumber"
        )
        .value.trim(),

    plateNumber:
      document
        .getElementById(
          "equipmentPlate"
        )
        .value.trim(),

    team:
      document
        .getElementById(
          "equipmentTeam"
        )
        .value.trim(),

    capacity:
      document
        .getElementById(
          "equipmentCapacity"
        )
        .value.trim(),

    fuelType:
      document
        .getElementById(
          "equipmentFuel"
        )
        .value,

    entryDate:
      document
        .getElementById(
          "equipmentEntryDate"
        )
        .value,

    status:
      document
        .getElementById(
          "equipmentStatus"
        )
        .value,

    remark:
      document
        .getElementById(
          "equipmentRemark"
        )
        .value.trim(),

    certificatePhoto:
      equipmentCertificatePhotoData ||
      "",

    entryPhoto:
      equipmentEntryPhotoData ||
      "",

    updatedAt: nowISO()
  };

  if (equipmentId) {
    const index =
      records.findIndex(
        item =>
          item.equipmentId === equipmentId
      );

    if (index < 0) {
      showToast(
        "未找到设备资料",
        "error"
      );
      return;
    }

    records[index] = {
      ...records[index],
      ...data
    };
  } else {
    records.push({
      equipmentId: uid("EQ"),
      ...data,
      createdAt: nowISO()
    });
  }

  saveEquipmentRecords(records);

  closeModal("equipmentModal");

  renderEquipment();
  updateSummary();

  showToast("设备资料已保存");
}


function renderEquipment() {
  const container =
    document.getElementById(
      "equipmentList"
    );

  if (!container) return;

  const search =
    document
      .getElementById(
        "equipmentSearch"
      )
      ?.value
      .trim()
      .toLowerCase() || "";

  const type =
    document
      .getElementById(
        "equipmentTypeFilter"
      )
      ?.value || "";

  const status =
    document
      .getElementById(
        "equipmentStatusFilter"
      )
      ?.value || "";

  let records = getEquipment();

  records = records.filter(item => {
    const text = [
      item.equipmentNumber,
      item.equipmentName,
      item.type,
      item.frameNumber,
      item.vin,
      item.chassisNumber,
      item.engineNumber,
      item.model,
      item.plateNumber,
      item.team
    ]
      .join(" ")
      .toLowerCase();

    if (
      search &&
      !text.includes(search)
    ) return false;

    if (
      type &&
      item.type !== type
    ) return false;

    if (
      status &&
      item.status !== status
    ) return false;

    return true;
  });

  records.sort((a, b) =>
    String(a.equipmentNumber || "")
      .localeCompare(
        String(b.equipmentNumber || ""),
        undefined,
        {
          numeric: true
        }
      )
  );

  if (!records.length) {
    container.innerHTML =
      '<div class="empty-state">暂无设备资料</div>';
    return;
  }

  container.innerHTML =
    records.map(item => `
      <article class="record-card">

        <div class="record-main">

          <div class="record-title-row">

            <h3>
              ${escapeHtml(
                item.equipmentNumber
              )}
              ${
                item.equipmentName
                  ? " · " +
                    escapeHtml(
                      item.equipmentName
                    )
                  : ""
              }
            </h3>

            <span class="status-badge">
              ${escapeHtml(
                equipmentStatusText(
                  item.status
                )
              )}
            </span>

          </div>

          <div class="record-meta">

            <span>
              🚜 ${escapeHtml(
                item.type || "-"
              )}
            </span>

            <span>
              ⚙️ ${escapeHtml(
                item.engineNumber ||
                "无发动机号"
              )}
            </span>

            <span>
              🔩 ${escapeHtml(
                item.frameNumber ||
                item.vin ||
                item.chassisNumber ||
                "无大架号"
              )}
            </span>

            ${item.certificatePhoto
              ? `
                <span>
                  📄 已录入合格证
                </span>
              `
              : ""
            }

            ${item.entryPhoto
              ? `
                <span>
                  📷 已录入进场照片
                </span>
              `
              : ""
            }

            <span>
              🚘 ${escapeHtml(
                item.plateNumber || "无车牌"
              )}
            </span>

            <span>
              👥 ${escapeHtml(
                item.team || "未分配"
              )}
            </span>

            ${
              item.capacity
                ? `
                  <span>
                    ⚖️ ${escapeHtml(
                      item.capacity
                    )}
                  </span>
                `
                : ""
            }

          </div>

        </div>

        <div class="record-actions">

          <button
            class="btn btn-small btn-secondary"
            onclick="openEquipmentModal('${item.equipmentId}')">
            编辑
          </button>

          <button
            class="btn btn-small btn-warning"
            onclick="toggleEquipmentDisabled('${item.equipmentId}')">
            ${
              item.status === "disabled"
                ? "恢复可用"
                : "停用"
            }
          </button>

        </div>

      </article>
    `).join("");
}


function toggleEquipmentDisabled(equipmentId) {
  const records = getEquipment();

  const index =
    records.findIndex(
      item =>
        item.equipmentId === equipmentId
    );

  if (index < 0) return;

  records[index].status =
    records[index].status === "disabled"
      ? "available"
      : "disabled";

  records[index].updatedAt =
    nowISO();

  saveEquipmentRecords(records);

  renderEquipment();
  updateSummary();

  showToast("设备状态已更新");
}


document
  .getElementById(
    "equipmentCertificatePhoto"
  )
  ?.addEventListener(
    "change",
    function () {
      handleEquipmentPhotoChange(
        "equipmentCertificatePhoto",
        "certificate"
      );
    }
  );


document
  .getElementById(
    "equipmentEntryPhoto"
  )
  ?.addEventListener(
    "change",
    function () {
      handleEquipmentPhotoChange(
        "equipmentEntryPhoto",
        "entry"
      );
    }
  );


/* =========================================================
   物资基础资料
========================================================= */

function getMaterials() {
  return readStorage(STORAGE.MATERIALS, []);
}


function saveMaterials(records) {
  writeStorage(STORAGE.MATERIALS, records);
}


function getMaterialRecords() {
  return readStorage(
    STORAGE.MATERIAL_ISSUES,
    []
  );
}


function saveMaterialRecords(records) {
  writeStorage(
    STORAGE.MATERIAL_ISSUES,
    records
  );
}


function toggleMaterialReturnFields() {
  const type =
    document
      .getElementById("materialType")
      ?.value;

  document
    .querySelectorAll(
      ".returnable-field"
    )
    .forEach(el => {
      el.style.display =
        type === "returnable"
          ? ""
          : "none";
    });
}


function clearMaterialForm() {
  document.getElementById(
    "materialId"
  ).value = "";

  document.getElementById(
    "materialName"
  ).value = "";

  document.getElementById(
    "materialType"
  ).value = "consumable";

  document.getElementById(
    "materialUnit"
  ).value = "";

  document.getElementById(
    "materialStock"
  ).value = 0;

  document.getElementById(
    "materialLostDeduction"
  ).value = 0;

  document.getElementById(
    "materialDamageDeduction"
  ).value = 0;

  document.getElementById(
    "materialRemark"
  ).value = "";

  toggleMaterialReturnFields();
}


function openMaterialModal(materialId = "") {
  clearMaterialForm();

  const title =
    document.getElementById(
      "materialModalTitle"
    );

  if (!materialId) {
    title.textContent =
      "📦 新增物资";

    openModal("materialModal");
    return;
  }

  const material =
    getMaterials().find(
      item =>
        item.materialId === materialId
    );

  if (!material) {
    showToast("未找到物资", "error");
    return;
  }

  title.textContent =
    "✏️ 编辑物资";

  document.getElementById(
    "materialId"
  ).value = material.materialId;

  document.getElementById(
    "materialName"
  ).value = material.name || "";

  document.getElementById(
    "materialType"
  ).value =
    material.type || "consumable";

  document.getElementById(
    "materialUnit"
  ).value = material.unit || "";

  document.getElementById(
    "materialStock"
  ).value =
    numberValue(material.stock);

  document.getElementById(
    "materialLostDeduction"
  ).value =
    numberValue(
      material.lostDeduction
    );

  document.getElementById(
    "materialDamageDeduction"
  ).value =
    numberValue(
      material.damageDeduction
    );

  document.getElementById(
    "materialRemark"
  ).value = material.remark || "";

  toggleMaterialReturnFields();

  openModal("materialModal");
}


function saveMaterial() {
  const materialId =
    document
      .getElementById("materialId")
      .value.trim();

  const name =
    document
      .getElementById("materialName")
      .value.trim();

  const type =
    document
      .getElementById("materialType")
      .value;

  const unit =
    document
      .getElementById("materialUnit")
      .value.trim();

  const stock =
    numberValue(
      document
        .getElementById("materialStock")
        .value
    );

  if (!name) {
    showToast(
      "请填写物资名称",
      "error"
    );
    return;
  }

  if (!unit) {
    showToast(
      "请填写物资单位",
      "error"
    );
    return;
  }

  if (stock < 0) {
    showToast(
      "库存不能小于0",
      "error"
    );
    return;
  }

  const records = getMaterials();

  const duplicate =
    records.find(
      item =>
        item.name
          ?.toLowerCase() ===
          name.toLowerCase() &&
        item.materialId !== materialId
    );

  if (duplicate) {
    showToast(
      "该物资已经存在",
      "error"
    );
    return;
  }

  const data = {
    name,
    type,
    unit,
    stock,

    lostDeduction:
      type === "returnable"
        ? numberValue(
            document
              .getElementById(
                "materialLostDeduction"
              )
              .value
          )
        : 0,

    damageDeduction:
      type === "returnable"
        ? numberValue(
            document
              .getElementById(
                "materialDamageDeduction"
              )
              .value
          )
        : 0,

    remark:
      document
        .getElementById(
          "materialRemark"
        )
        .value.trim(),

    updatedAt: nowISO()
  };

  if (materialId) {
    const index =
      records.findIndex(
        item =>
          item.materialId === materialId
      );

    if (index < 0) {
      showToast(
        "未找到物资资料",
        "error"
      );
      return;
    }

    records[index] = {
      ...records[index],
      ...data
    };
  } else {
    records.push({
      materialId: uid("MAT"),
      ...data,
      createdAt: nowISO()
    });
  }

  saveMaterials(records);

  closeModal("materialModal");

  renderMaterials();
  refreshMaterialSelectors();
  updateSummary();

  showToast("物资资料已保存");
}


function renderMaterials() {
  const container =
    document.getElementById(
      "materialList"
    );

  if (!container) return;

  const search =
    document
      .getElementById(
        "materialSearch"
      )
      ?.value
      .trim()
      .toLowerCase() || "";

  const type =
    document
      .getElementById(
        "materialTypeFilter"
      )
      ?.value || "";

  let records = getMaterials();

  records = records.filter(item => {
    if (
      search &&
      !String(item.name || "")
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }

    if (
      type &&
      item.type !== type
    ) {
      return false;
    }

    return true;
  });

  if (!records.length) {
    container.innerHTML =
      '<div class="empty-state">暂无物资资料</div>';
    return;
  }

  container.innerHTML =
    records.map(item => {

      const outstanding =
        getAllOutstandingMaterials()
          .filter(
            record =>
              record.materialId ===
              item.materialId
          )
          .reduce(
            (sum, record) =>
              sum +
              numberValue(
                record.outstandingQuantity
              ),
            0
          );

      return `
        <article class="record-card">

          <div class="record-main">

            <div class="record-title-row">

              <h3>
                ${escapeHtml(item.name)}
              </h3>

              <span class="status-badge">
                ${materialTypeText(
                  item.type
                )}
              </span>

            </div>

            <div class="record-meta">

              <span>
                📦 库存：
                <strong>
                  ${numberValue(item.stock)}
                  ${escapeHtml(item.unit)}
                </strong>
              </span>

              ${
                item.type === "returnable"
                  ? `
                    <span>
                      👤 员工未归还：
                      ${outstanding}
                      ${escapeHtml(item.unit)}
                    </span>

                    <span>
                      💰 未归还扣款：
                      ${numberValue(
                        item.lostDeduction
                      )}
                      / ${escapeHtml(item.unit)}
                    </span>
                  `
                  : ""
              }

            </div>

          </div>

          <div class="record-actions">

            <button
              class="btn btn-small btn-primary"
              onclick="openStockInModal('${item.materialId}')">
              入库
            </button>

            <button
              class="btn btn-small btn-secondary"
              onclick="openMaterialModal('${item.materialId}')">
              编辑
            </button>

          </div>

        </article>
      `;
    }).join("");
}


/* =========================================================
   物资入库
========================================================= */

function openStockInModal(materialId) {
  const material =
    getMaterials().find(
      item =>
        item.materialId === materialId
    );

  if (!material) {
    showToast("未找到物资", "error");
    return;
  }

  document.getElementById(
    "stockInMaterialId"
  ).value = material.materialId;

  document.getElementById(
    "stockInMaterialName"
  ).value = material.name;

  document.getElementById(
    "stockInCurrentStock"
  ).value =
    `${numberValue(material.stock)} ${material.unit}`;

  document.getElementById(
    "stockInQuantity"
  ).value = 1;

  document.getElementById(
    "stockInDate"
  ).value = localDate();

  document.getElementById(
    "stockInRemark"
  ).value = "";

  openModal("stockInModal");
}


function confirmStockIn() {
  const materialId =
    document
      .getElementById(
        "stockInMaterialId"
      )
      .value;

  const quantity =
    numberValue(
      document
        .getElementById(
          "stockInQuantity"
        )
        .value
    );

  if (quantity <= 0) {
    showToast(
      "入库数量必须大于0",
      "error"
    );
    return;
  }

  const materials = getMaterials();

  const index =
    materials.findIndex(
      item =>
        item.materialId === materialId
    );

  if (index < 0) {
    showToast(
      "未找到物资",
      "error"
    );
    return;
  }

  materials[index].stock =
    numberValue(
      materials[index].stock
    ) + quantity;

  materials[index].updatedAt =
    nowISO();

  saveMaterials(materials);

  const records =
    getMaterialRecords();

  records.push({
    recordId: uid("MATREC"),
    action: "stock_in",
    materialId,
    materialName:
      materials[index].name,
    unit:
      materials[index].unit,
    quantity,
    date:
      document
        .getElementById(
          "stockInDate"
        )
        .value || localDate(),
    remark:
      document
        .getElementById(
          "stockInRemark"
        )
        .value.trim(),
    createdAt: nowISO()
  });

  saveMaterialRecords(records);

  closeModal("stockInModal");

  renderMaterials();
  renderMaterialHistory();
  refreshMaterialSelectors();
  updateSummary();

  showToast("物资已入库");
}


/* =========================================================
   领用
========================================================= */

function refreshMaterialSelectors() {
  const personnel =
    getPersonnel()
      .filter(
        person =>
          ![
            "resigned",
            "disabled"
          ].includes(person.status)
      )
      .sort((a, b) =>
        String(a.name || "")
          .localeCompare(
            String(b.name || ""),
            "zh-CN"
          )
      );

  const materials =
    getMaterials();

  const personOptions =
    '<option value="">请选择员工</option>' +
    personnel.map(person => `
      <option value="${person.personId}">
        ${escapeHtml(person.name)}
        ·
        ${escapeHtml(
          person.position || "-"
        )}
      </option>
    `).join("");

  [
    "issuePerson",
    "returnPerson",
    "employeeMaterialPerson"
  ].forEach(id => {
    const select =
      document.getElementById(id);

    if (!select) return;

    const oldValue = select.value;

    select.innerHTML =
      personOptions;

    if (
      [...select.options].some(
        option =>
          option.value === oldValue
      )
    ) {
      select.value = oldValue;
    }
  });

  const materialSelect =
    document.getElementById(
      "issueMaterial"
    );

  if (materialSelect) {
    const oldValue =
      materialSelect.value;

    materialSelect.innerHTML =
      '<option value="">请选择物资</option>' +
      materials.map(material => `
        <option
          value="${material.materialId}">
          ${escapeHtml(material.name)}
          · 库存
          ${numberValue(material.stock)}
          ${escapeHtml(material.unit)}
        </option>
      `).join("");

    if (
      [...materialSelect.options]
        .some(
          option =>
            option.value === oldValue
        )
    ) {
      materialSelect.value =
        oldValue;
    }
  }

  updateIssueMaterialInfo();
}


function updateIssueMaterialInfo() {
  const materialId =
    document
      .getElementById(
        "issueMaterial"
      )
      ?.value;

  const material =
    getMaterials().find(
      item =>
        item.materialId === materialId
    );

  const stockInput =
    document.getElementById(
      "issueCurrentStock"
    );

  if (!stockInput) return;

  stockInput.value =
    material
      ? `${numberValue(material.stock)} ${material.unit}`
      : "";
}


function issueMaterial() {
  const personId =
    document
      .getElementById(
        "issuePerson"
      )
      .value;

  const materialId =
    document
      .getElementById(
        "issueMaterial"
      )
      .value;

  const quantity =
    numberValue(
      document
        .getElementById(
          "issueQuantity"
        )
        .value
    );

  if (!personId) {
    showToast(
      "请选择领用员工",
      "error"
    );
    return;
  }

  if (!materialId) {
    showToast(
      "请选择领用物资",
      "error"
    );
    return;
  }

  if (quantity <= 0) {
    showToast(
      "领用数量必须大于0",
      "error"
    );
    return;
  }

  const person =
    getPersonnel().find(
      item =>
        item.personId === personId
    );

  if (!person) {
    showToast(
      "未找到员工",
      "error"
    );
    return;
  }

  const materials =
    getMaterials();

  const materialIndex =
    materials.findIndex(
      item =>
        item.materialId === materialId
    );

  if (materialIndex < 0) {
    showToast(
      "未找到物资",
      "error"
    );
    return;
  }

  const material =
    materials[materialIndex];

  if (
    numberValue(material.stock) <
    quantity
  ) {
    showToast(
      "库存不足，无法领用",
      "error"
    );
    return;
  }

  materials[materialIndex].stock =
    numberValue(material.stock) -
    quantity;

  materials[materialIndex].updatedAt =
    nowISO();

  saveMaterials(materials);

  const records =
    getMaterialRecords();

  records.push({
    recordId: uid("MATREC"),
    action: "issue",

    personId:
      person.personId,

    personName:
      person.name,

    position:
      person.position || "",

    team:
      person.team || "",

    materialId:
      material.materialId,

    materialName:
      material.name,

    materialType:
      material.type,

    unit:
      material.unit,

    quantity,

    date:
      document
        .getElementById(
          "issueDate"
        )
        .value || localDate(),

    remark:
      document
        .getElementById(
          "issueRemark"
        )
        .value.trim(),

    createdAt: nowISO()
  });

  saveMaterialRecords(records);

  document.getElementById(
    "issueQuantity"
  ).value = 1;

  document.getElementById(
    "issueRemark"
  ).value = "";

  refreshMaterialSelectors();

  renderMaterials();
  renderMaterialHistory();
  updateSummary();

  showToast("物资领用成功");
}


/* =========================================================
   计算员工未归还物资
========================================================= */

function getPersonOutstandingMaterials(personId) {
  const materials = getMaterials();

  const returnableMap =
    new Map(
      materials
        .filter(
          material =>
            material.type === "returnable"
        )
        .map(
          material => [
            material.materialId,
            material
          ]
        )
    );

  const records =
    getMaterialRecords()
      .filter(
        record =>
          record.personId === personId
      );

  const totals = {};

  records.forEach(record => {
    const material =
      returnableMap.get(
        record.materialId
      );

    if (!material) return;

    if (!totals[record.materialId]) {
      totals[record.materialId] = {
        materialId:
          material.materialId,
        materialName:
          material.name,
        unit:
          material.unit,
        lostDeduction:
          numberValue(
            material.lostDeduction
          ),
        damageDeduction:
          numberValue(
            material.damageDeduction
          ),
        issuedQuantity: 0,
        returnedQuantity: 0
      };
    }

    if (record.action === "issue") {
      totals[
        record.materialId
      ].issuedQuantity +=
        numberValue(record.quantity);
    }

    if (record.action === "return") {
      totals[
        record.materialId
      ].returnedQuantity +=
        numberValue(record.quantity);
    }
  });

  return Object.values(totals)
    .map(item => ({
      ...item,
      outstandingQuantity:
        Math.max(
          0,
          item.issuedQuantity -
          item.returnedQuantity
        )
    }))
    .filter(
      item =>
        item.outstandingQuantity > 0
    );
}


function getAllOutstandingMaterials() {
  const result = [];

  getPersonnel().forEach(person => {
    getPersonOutstandingMaterials(
      person.personId
    ).forEach(item => {
      result.push({
        ...item,
        personId:
          person.personId,
        personName:
          person.name,
        position:
          person.position
      });
    });
  });

  return result;
}


/* =========================================================
   退还
========================================================= */

function loadPersonReturnableMaterials() {
  const personId =
    document
      .getElementById(
        "returnPerson"
      )
      ?.value;

  const select =
    document.getElementById(
      "returnMaterial"
    );

  if (!select) return;

  if (!personId) {
    select.innerHTML =
      '<option value="">请先选择员工</option>';

    setText(
      "returnOutstanding",
      ""
    );

    return;
  }

  const outstanding =
    getPersonOutstandingMaterials(
      personId
    );

  if (!outstanding.length) {
    select.innerHTML =
      '<option value="">该员工暂无待归还物资</option>';

    document.getElementById(
      "returnOutstanding"
    ).value = "";

    return;
  }

  select.innerHTML =
    '<option value="">请选择物资</option>' +
    outstanding.map(item => `
      <option value="${item.materialId}">
        ${escapeHtml(
          item.materialName
        )}
        · 未归还
        ${item.outstandingQuantity}
        ${escapeHtml(item.unit)}
      </option>
    `).join("");

  updateReturnMaterialInfo();
}


function updateReturnMaterialInfo() {
  const personId =
    document
      .getElementById(
        "returnPerson"
      )
      ?.value;

  const materialId =
    document
      .getElementById(
        "returnMaterial"
      )
      ?.value;

  const item =
    getPersonOutstandingMaterials(
      personId
    ).find(
      record =>
        record.materialId === materialId
    );

  const input =
    document.getElementById(
      "returnOutstanding"
    );

  if (!input) return;

  input.value =
    item
      ? `${item.outstandingQuantity} ${item.unit}`
      : "";
}


function returnMaterial() {
  const personId =
    document
      .getElementById(
        "returnPerson"
      )
      .value;

  const materialId =
    document
      .getElementById(
        "returnMaterial"
      )
      .value;

  const quantity =
    numberValue(
      document
        .getElementById(
          "returnQuantity"
        )
        .value
    );

  const condition =
    document
      .getElementById(
        "returnCondition"
      )
      .value;

  if (!personId) {
    showToast(
      "请选择员工",
      "error"
    );
    return;
  }

  if (!materialId) {
    showToast(
      "请选择退还物资",
      "error"
    );
    return;
  }

  if (quantity <= 0) {
    showToast(
      "归还数量必须大于0",
      "error"
    );
    return;
  }

  const outstanding =
    getPersonOutstandingMaterials(
      personId
    ).find(
      item =>
        item.materialId === materialId
    );

  if (!outstanding) {
    showToast(
      "该员工没有此项待归还物资",
      "error"
    );
    return;
  }

  if (
    quantity >
    outstanding.outstandingQuantity
  ) {
    showToast(
      "归还数量不能超过未归还数量",
      "error"
    );
    return;
  }

  const person =
    getPersonnel().find(
      item =>
        item.personId === personId
    );

  const materials =
    getMaterials();

  const materialIndex =
    materials.findIndex(
      item =>
        item.materialId === materialId
    );

  if (materialIndex < 0) {
    showToast(
      "未找到物资",
      "error"
    );
    return;
  }

  /*
    正常退还：
    重新增加库存。

    损坏退还：
    记录退还，但默认不重新进入可用库存。
  */

  if (condition === "normal") {
    materials[materialIndex].stock =
      numberValue(
        materials[materialIndex].stock
      ) + quantity;
  }

  materials[materialIndex].updatedAt =
    nowISO();

  saveMaterials(materials);

  const records =
    getMaterialRecords();

  records.push({
    recordId: uid("MATREC"),
    action: "return",

    personId,
    personName:
      person?.name || "",

    position:
      person?.position || "",

    team:
      person?.team || "",

    materialId,
    materialName:
      materials[materialIndex].name,

    materialType:
      materials[materialIndex].type,

    unit:
      materials[materialIndex].unit,

    quantity,

    condition,

    damageDeduction:
      condition === "damaged"
        ? numberValue(
            materials[
              materialIndex
            ].damageDeduction
          ) * quantity
        : 0,

    date:
      document
        .getElementById(
          "returnDate"
        )
        .value || localDate(),

    remark:
      document
        .getElementById(
          "returnRemark"
        )
        .value.trim(),

    createdAt: nowISO()
  });

  saveMaterialRecords(records);

  document.getElementById(
    "returnQuantity"
  ).value = 1;

  document.getElementById(
    "returnRemark"
  ).value = "";

  loadPersonReturnableMaterials();

  renderMaterials();
  renderMaterialHistory();
  renderEmployeeMaterials();
  renderPersonnel();
  updateSummary();

  showToast("物资退还成功");
}


/* =========================================================
   员工名下物资
========================================================= */

function renderEmployeeMaterials() {
  const container =
    document.getElementById(
      "employeeMaterialSummary"
    );

  if (!container) return;

  const personId =
    document
      .getElementById(
        "employeeMaterialPerson"
      )
      ?.value;

  if (!personId) {
    container.innerHTML =
      '<div class="empty-state">请选择员工查看名下物资</div>';
    return;
  }

  const person =
    getPersonnel().find(
      item =>
        item.personId === personId
    );

  const outstanding =
    getPersonOutstandingMaterials(
      personId
    );

  if (!outstanding.length) {
    container.innerHTML = `
      <div class="info-panel">
        <strong>
          ${escapeHtml(
            person?.name || ""
          )}
        </strong>
        当前没有未归还的可回收物资。
      </div>
    `;
    return;
  }

  const totalDeduction =
    outstanding.reduce(
      (sum, item) =>
        sum +
        item.outstandingQuantity *
        numberValue(
          item.lostDeduction
        ),
      0
    );

  container.innerHTML = `
    <div class="info-panel">

      <h3>
        ${escapeHtml(
          person?.name || ""
        )}
        ·
        ${escapeHtml(
          person?.position || ""
        )}
      </h3>

      <p>
        当前共有
        <strong>
          ${outstanding.reduce(
            (sum, item) =>
              sum +
              item.outstandingQuantity,
            0
          )}
        </strong>
        件可回收物资未归还。
      </p>

    </div>

    ${outstanding.map(item => `
      <article class="record-card">

        <div class="record-main">

          <h3>
            ${escapeHtml(
              item.materialName
            )}
          </h3>

          <div class="record-meta">

            <span>
              领用：
              ${item.issuedQuantity}
              ${escapeHtml(item.unit)}
            </span>

            <span>
              已还：
              ${item.returnedQuantity}
              ${escapeHtml(item.unit)}
            </span>

            <span>
              未还：
              <strong>
                ${item.outstandingQuantity}
                ${escapeHtml(item.unit)}
              </strong>
            </span>

            <span>
              未归还扣款标准：
              ${item.lostDeduction}
              / ${escapeHtml(item.unit)}
            </span>

          </div>

        </div>

      </article>
    `).join("")}

    <div class="deduction-summary">

      如离职时以上物资仍未归还，
      当前预计建议工资扣款：

      <strong>
        ${totalDeduction.toFixed(2)}
      </strong>

    </div>
  `;
}


/* =========================================================
   物资历史
========================================================= */

function renderMaterialHistory() {
  const container =
    document.getElementById(
      "materialHistoryList"
    );

  if (!container) return;

  const search =
    document
      .getElementById(
        "materialHistorySearch"
      )
      ?.value
      .trim()
      .toLowerCase() || "";

  let records =
    getMaterialRecords();

  records = records.filter(record => {
    if (!search) return true;

    return [
      record.personName,
      record.materialName,
      record.position,
      record.team
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  records.sort(
    (a, b) =>
      new Date(
        b.createdAt || b.date || 0
      ) -
      new Date(
        a.createdAt || a.date || 0
      )
  );

  if (!records.length) {
    container.innerHTML =
      '<div class="empty-state">暂无领退记录</div>';
    return;
  }

  container.innerHTML =
    records.map(record => {

      let title = "";
      let detail = "";

      if (
        record.action === "stock_in"
      ) {
        title =
          "📥 物资入库";

        detail = `
          ${escapeHtml(
            record.materialName
          )}
          ×
          ${numberValue(
            record.quantity
          )}
          ${escapeHtml(
            record.unit || ""
          )}
        `;
      }

      if (
        record.action === "issue"
      ) {
        title =
          "📤 员工领用";

        detail = `
          ${escapeHtml(
            record.personName
          )}
          领取
          ${escapeHtml(
            record.materialName
          )}
          ×
          ${numberValue(
            record.quantity
          )}
          ${escapeHtml(
            record.unit || ""
          )}
        `;
      }

      if (
        record.action === "return"
      ) {
        title =
          "📥 员工退还";

        detail = `
          ${escapeHtml(
            record.personName
          )}
          退还
          ${escapeHtml(
            record.materialName
          )}
          ×
          ${numberValue(
            record.quantity
          )}
          ${escapeHtml(
            record.unit || ""
          )}
          ${
            record.condition ===
            "damaged"
              ? " · ⚠️ 损坏"
              : " · 正常"
          }
        `;
      }

      return `
        <article class="record-card">

          <div class="record-main">

            <div class="record-title-row">
              <h3>${title}</h3>
            </div>

            <p>${detail}</p>

            <div class="record-meta">

              <span>
                📅
                ${escapeHtml(
                  record.date || "-"
                )}
              </span>

              ${
                record.remark
                  ? `
                    <span>
                      📝
                      ${escapeHtml(
                        record.remark
                      )}
                    </span>
                  `
                  : ""
              }

            </div>

          </div>

        </article>
      `;
    }).join("");
}


/* =========================================================
   离职
========================================================= */

function openResignationModal(personId) {
  const person =
    getPersonnel().find(
      item =>
        item.personId === personId
    );

  if (!person) {
    showToast(
      "未找到人员",
      "error"
    );
    return;
  }

  if (person.status === "resigned") {
    showToast(
      "该员工已经离职",
      "error"
    );
    return;
  }

  document.getElementById(
    "resignationPersonId"
  ).value = personId;

  document.getElementById(
    "resignationDate"
  ).value = localDate();

  document.getElementById(
    "resignationReason"
  ).value = "";

  document.getElementById(
    "resignationRemark"
  ).value = "";

  document.getElementById(
    "salaryDeductionStatus"
  ).value = "pending";

  document.getElementById(
    "resignationPersonInfo"
  ).innerHTML = `
    <strong>
      ${escapeHtml(person.name)}
    </strong>

    <span>
      ${escapeHtml(
        person.position || "-"
      )}
    </span>

    <span>
      ${escapeHtml(
        person.team || "未分配"
      )}
    </span>

    <span>
      ${escapeHtml(
        person.phone || "-"
      )}
    </span>
  `;

  renderResignationMaterials(
    personId
  );

  openModal("resignationModal");
}


function renderResignationMaterials(personId) {
  const container =
    document.getElementById(
      "resignationMaterialList"
    );

  const summary =
    document.getElementById(
      "resignationDeductionSummary"
    );

  const outstanding =
    getPersonOutstandingMaterials(
      personId
    );

  if (!outstanding.length) {
    container.innerHTML = `
      <div class="success-box">
        🟢 该员工当前没有未归还的可回收物资。
      </div>
    `;

    summary.innerHTML = `
      建议工资扣款：
      <strong>0.00</strong>
    `;

    summary.dataset.total = "0";

    return;
  }

  const total =
    outstanding.reduce(
      (sum, item) =>
        sum +
        item.outstandingQuantity *
        numberValue(
          item.lostDeduction
        ),
      0
    );

  container.innerHTML =
    outstanding.map(item => {

      const deduction =
        item.outstandingQuantity *
        numberValue(
          item.lostDeduction
        );

      return `
        <article class="settlement-material">

          <div>
            <strong>
              ${escapeHtml(
                item.materialName
              )}
            </strong>

            <div>
              未归还：
              ${item.outstandingQuantity}
              ${escapeHtml(item.unit)}
            </div>
          </div>

          <div>
            ${item.outstandingQuantity}
            ×
            ${item.lostDeduction}
            =
            <strong>
              ${deduction.toFixed(2)}
            </strong>
          </div>

        </article>
      `;
    }).join("");

  summary.innerHTML = `
    ⚠️ 未归还物资建议工资扣款合计：
    <strong>
      ${total.toFixed(2)}
    </strong>
  `;

  summary.dataset.total =
    String(total);
}


function confirmResignation() {
  const personId =
    document
      .getElementById(
        "resignationPersonId"
      )
      .value;

  const resignationDate =
    document
      .getElementById(
        "resignationDate"
      )
      .value;

  if (!personId) {
    showToast(
      "人员信息错误",
      "error"
    );
    return;
  }

  if (!resignationDate) {
    showToast(
      "请选择离职日期",
      "error"
    );
    return;
  }

  const personnel =
    getPersonnel();

  const index =
    personnel.findIndex(
      item =>
        item.personId === personId
    );

  if (index < 0) {
    showToast(
      "未找到人员",
      "error"
    );
    return;
  }

  const person =
    personnel[index];

  const outstanding =
    getPersonOutstandingMaterials(
      personId
    );

  const totalDeduction =
    outstanding.reduce(
      (sum, item) =>
        sum +
        item.outstandingQuantity *
        numberValue(
          item.lostDeduction
        ),
      0
    );

  const salaryStatus =
    document
      .getElementById(
        "salaryDeductionStatus"
      )
      .value;

  const settlement = {
    settlementId:
      uid("RESIGN"),

    personId:
      person.personId,

    personName:
      person.name,

    position:
      person.position || "",

    team:
      person.team || "",

    resignationDate,

    resignationReason:
      document
        .getElementById(
          "resignationReason"
        )
        .value.trim(),

    outstandingMaterials:
      outstanding.map(item => ({
        materialId:
          item.materialId,

        materialName:
          item.materialName,

        unit:
          item.unit,

        outstandingQuantity:
          item.outstandingQuantity,

        deductionPerUnit:
          item.lostDeduction,

        deductionAmount:
          item.outstandingQuantity *
          item.lostDeduction
      })),

    suggestedDeduction:
      totalDeduction,

    materialSettlementStatus:
      outstanding.length
        ? "pending_deduction"
        : "cleared",

    salaryDeductionStatus:
      salaryStatus,

    remark:
      document
        .getElementById(
          "resignationRemark"
        )
        .value.trim(),

    createdAt: nowISO()
  };

  const settlements =
    readStorage(
      STORAGE.RESIGNATIONS,
      []
    );

  settlements.push(settlement);

  writeStorage(
    STORAGE.RESIGNATIONS,
    settlements
  );

  personnel[index] = {
    ...personnel[index],

    ...personnelStateFields(
      "resigned"
    ),

    resignationDate,

    resignationReason:
      settlement.resignationReason,

    resignationSettlementId:
      settlement.settlementId,

    resignationSuggestedDeduction:
      totalDeduction,

    salaryDeductionStatus:
      salaryStatus,

    updatedAt: nowISO()
  };

  savePersonnelRecords(personnel);

  closeModal("resignationModal");

  renderPersonnel();
  renderSettlementRecords();
  refreshMaterialSelectors();
  updateSummary();

  showToast(
    totalDeduction > 0
      ? `离职已办理，建议工资扣款 ${totalDeduction.toFixed(2)}`
      : "离职已办理，物资已结清"
  );
}


/* =========================================================
   离职结算记录
========================================================= */

function renderSettlementRecords() {
  const container =
    document.getElementById(
      "settlementList"
    );

  if (!container) return;

  const records =
    readStorage(
      STORAGE.RESIGNATIONS,
      []
    )
      .sort(
        (a, b) =>
          new Date(
            b.createdAt || 0
          ) -
          new Date(
            a.createdAt || 0
          )
      );

  if (!records.length) {
    container.innerHTML =
      '<div class="empty-state">暂无离职结算记录</div>';
    return;
  }

  container.innerHTML =
    records.map(record => {

      const materialCount =
        (record.outstandingMaterials || [])
          .reduce(
            (sum, item) =>
              sum +
              numberValue(
                item.outstandingQuantity
              ),
            0
          );

      return `
        <article class="record-card">

          <div class="record-main">

            <div class="record-title-row">

              <h3>
                ${escapeHtml(
                  record.personName
                )}
              </h3>

              <span class="status-badge">
                已离职
              </span>

            </div>

            <div class="record-meta">

              <span>
                👷
                ${escapeHtml(
                  record.position || "-"
                )}
              </span>

              <span>
                📅 离职：
                ${escapeHtml(
                  record.resignationDate ||
                  "-"
                )}
              </span>

              <span>
                📦 未归还：
                ${materialCount}
                件
              </span>

              <span>
                💰 建议扣款：
                <strong>
                  ${numberValue(
                    record.suggestedDeduction
                  ).toFixed(2)}
                </strong>
              </span>

            </div>

            ${
              (
                record.outstandingMaterials ||
                []
              ).length
                ? `
                  <div class="settlement-detail">

                    ${
                      record.outstandingMaterials
                        .map(item => `
                          <div>
                            ${escapeHtml(
                              item.materialName
                            )}
                            ×
                            ${item.outstandingQuantity}
                            ${escapeHtml(
                              item.unit
                            )}
                            —
                            ${numberValue(
                              item.deductionAmount
                            ).toFixed(2)}
                          </div>
                        `)
                        .join("")
                    }

                  </div>
                `
                : `
                  <div class="success-box">
                    🟢 离职时无未归还物资
                  </div>
                `
            }

            <div class="record-meta">

              <span>
                工资扣款：
                ${salaryStatusText(
                  record.salaryDeductionStatus
                )}
              </span>

            </div>

          </div>

        </article>
      `;
    }).join("");
}


function salaryStatusText(status) {
  const map = {
    pending: "🟡 待确认",
    confirmed: "🟢 已确认",
    waived: "🔵 已免除"
  };

  return map[status] || status || "-";
}


/* =========================================================
   默认日期
========================================================= */

function setDefaultDates() {
  [
    "issueDate",
    "returnDate",
    "stockInDate"
  ].forEach(id => {
    const el =
      document.getElementById(id);

    if (
      el &&
      !el.value
    ) {
      el.value = localDate();
    }
  });
}


/* =========================================================
   点击遮罩关闭弹窗
========================================================= */

function bindModalBackdrop() {
  document
    .querySelectorAll(".modal")
    .forEach(modal => {
      modal.addEventListener(
        "click",
        event => {
          if (
            event.target === modal
          ) {
            modal.classList.remove(
              "show"
            );
          }
        }
      );
    });
}


/* =========================================================
   页面初始化
========================================================= */

function init() {
  if (!verifyAdminMasterAccess()) {
    return;
  }

  importExistingDriverProfile();

  setDefaultDates();

  bindModalBackdrop();

  renderPersonnel();

  renderEquipment();

  renderMaterials();

  refreshMaterialSelectors();

  renderMaterialHistory();

  renderSettlementRecords();

  updateSummary();

  toggleMaterialReturnFields();

  console.log(
    "V2.11.0 管理员基础资料中心已加载"
  );
}


document.addEventListener(
  "DOMContentLoaded",
  init
);
