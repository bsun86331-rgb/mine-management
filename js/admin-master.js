/* =========================================================
   矿山管理系统
   V2.9.4A 管理员基础资料中心
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
    position: profile.position || "卡车司机",
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
    status:
      profile.status === "approved"
        ? "active"
        : profile.status === "pending"
        ? "pending"
        : "active",
    approvalStatus:
      profile.status || "approved",
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
  ).value = person.position || "";

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
    document
      .getElementById("personnelPosition")
      .value;

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

    status:
      document
        .getElementById(
          "personnelStatus"
        )
        .value,

    remark:
      document
        .getElementById(
          "personnelRemark"
        )
        .value.trim(),

    approvalStatus: "approved",
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
      person.position !== position
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
                  person.position || "-"
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

  records[index].status =
    records[index].status === "disabled"
      ? "active"
      : "disabled";

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


function clearEquipmentForm() {
  [
    "equipmentId",
    "equipmentNumber",
    "equipmentName",
    "equipmentBrand",
    "equipmentModel",
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
    "equipmentBrand"
  ).value = equipment.brand || "";

  document.getElementById(
    "equipmentModel"
  ).value = equipment.model || "";

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

    brand:
      document
        .getElementById(
          "equipmentBrand"
        )
        .value.trim(),

    model:
      document
        .getElementById(
          "equipmentModel"
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
      item.brand,
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
              🏭 ${escapeHtml(
                [
                  item.brand,
                  item.model
                ]
                  .filter(Boolean)
                  .join(" ") || "-"
              )}
            </span>

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

    status: "resigned",

    enabled: false,

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
    "V2.9.4A 管理员基础资料中心已加载"
  );
}


document.addEventListener(
  "DOMContentLoaded",
  init
);
