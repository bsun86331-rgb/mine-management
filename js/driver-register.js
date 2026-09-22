/*
=========================================
矿山管理系统
司机注册 / 审核跳转
V2.8.2
=========================================

本版调整：
1. 部门 / 车队继续使用 team 字段保存，并同步 department 字段。
2. 新登记人员生成稳定的 UUID personId；旧 driverId 继续保留兼容。
3. 驳回后重新提交继续使用原 personId / driverId，不重复新增人员。
4. 登记阶段不生成 employeeNo；员工编号由管理员审核通过时生成。
5. personnelRecords 同步时保留已有 employeeNo，并清除旧驳回信息。
6. 同步照片的嵌套字段和顶层字段，兼容管理员审核页面。
*/


document.addEventListener(
    "DOMContentLoaded",
    function () {


        const STORAGE_KEY =
            "driverProfile";


        const submitButton =
            document.getElementById(
                "submitButton"
            );


        /*
        =================================
        读取原资料
        =================================
        */

        let oldProfile =
            readProfile();


        /*
        已经等待审核
        */

        if (
            oldProfile &&
            oldProfile.status ===
            "pending"
        ) {

            location.href =
                "driver-waiting.html";

            return;
        }


        /*
        已经审核通过
        */

        if (
            oldProfile &&
            oldProfile.status ===
            "approved"
        ) {

            location.href =
                "driver-work.html";

            return;
        }


        /*
        审核未通过
        允许修改后重新提交
        */

        if (
            oldProfile &&
            oldProfile.status ===
            "rejected"
        ) {

            showRejectedProfile(
                oldProfile
            );
        }


        /*
        =================================
        提交
        =================================
        */

        if (submitButton) {

            submitButton.addEventListener(
                "click",
                submitRegistration
            );
        }


        async function submitRegistration() {


            submitButton.disabled =
                true;

            submitButton.textContent =
                "正在提交...";


            const name =
                getValue("name");

            const phone =
                getValue("phone");

            const emergencyContact =
                getValue(
                    "emergencyContact"
                );

            const emergencyPhone =
                getValue(
                    "emergencyPhone"
                );

            const idCardNumber =
                getValue(
                    "idCardNumber"
                );

            const passportNumber =
                getValue(
                    "passportNumber"
                );

            const bankCardNumber =
                getValue(
                    "bankCardNumber"
                );

            const position =
                getValue(
                    "position"
                ) || "卡车司机";

            const team =
                getValue(
                    "team"
                );

            const entryDate =
                getValue(
                    "entryDate"
                );

            const remark =
                getValue(
                    "remark"
                );


            /*
            必填检查
            */

            if (!name) {

                fail(
                    "请输入姓名。"
                );

                return;
            }


            if (!phone) {

                fail(
                    "请输入手机号码。"
                );

                return;
            }


            if (!emergencyContact) {

                fail(
                    "请输入紧急联系人。"
                );

                return;
            }


            if (!emergencyPhone) {

                fail(
                    "请输入紧急联系人电话。"
                );

                return;
            }


            if (!team) {

                fail(
                    "请选择部门 / 车队。"
                );

                return;
            }


            if (
                !idCardNumber &&
                !passportNumber
            ) {

                fail(
                    "身份证号码和护照号码至少填写一项。"
                );

                return;
            }


            /*
            =================================
            照片
            =================================
            */

            try {


                const idCardPhoto =
                    await processPhoto(
                        "idCardPhoto",
                        oldProfile?.photos
                            ?.idCard ||
                        oldProfile?.idCardPhoto ||
                        ""
                    );


                const passportPhoto =
                    await processPhoto(
                        "passportPhoto",
                        oldProfile?.photos
                            ?.passport ||
                        oldProfile?.passportPhoto ||
                        ""
                    );


                const driverLicensePhoto =
                    await processPhoto(
                        "driverLicensePhoto",
                        oldProfile?.photos
                            ?.driverLicense ||
                        oldProfile?.driverLicensePhoto ||
                        oldProfile?.licensePhoto ||
                        ""
                    );


                const bankCardPhoto =
                    await processPhoto(
                        "bankCardPhoto",
                        oldProfile?.photos
                            ?.bankCard ||
                        oldProfile?.bankCardPhoto ||
                        ""
                    );


                /*
                =================================
                内部人员ID

                personId：
                - 新登记使用 UUID
                - 驳回后重新提交保留原 personId

                driverId：
                - 保留旧系统兼容
                - 不再作为新的唯一人员编号展示
                =================================
                */

                const personId =
                    oldProfile?.personId ||
                    createPersonId();


                const driverId =
                    oldProfile?.driverId ||
                    (
                        "DRIVER_" +
                        Date.now()
                    );


                const now =
                    new Date()
                        .toISOString();


                const profile = {

                    /*
                    后台内部唯一ID
                    */

                    personId:
                        personId,


                    /*
                    旧系统兼容ID
                    */

                    driverId:
                        driverId,


                    /*
                    employeeNo 不在登记阶段生成。
                    如果旧资料已经存在则仅保留。
                    */

                    employeeNo:
                        oldProfile
                            ?.employeeNo ||
                        "",


                    name:
                        name,

                    phone:
                        phone,

                    emergencyContact:
                        emergencyContact,

                    emergencyPhone:
                        emergencyPhone,

                    idCardNumber:
                        idCardNumber,

                    passportNumber:
                        passportNumber,

                    bankCardNumber:
                        bankCardNumber,

                    position:
                        position,


                    /*
                    部门 / 车队
                    同时保留 team 与 department，
                    兼容现有页面。
                    */

                    team:
                        team,

                    department:
                        team,


                    entryDate:
                        entryDate,

                    remark:
                        remark,


                    /*
                    照片：保留嵌套结构
                    */

                    photos: {

                        idCard:
                            idCardPhoto,

                        passport:
                            passportPhoto,

                        driverLicense:
                            driverLicensePhoto,

                        bankCard:
                            bankCardPhoto
                    },


                    /*
                    照片：同步顶层字段，
                    兼容 admin-review.html
                    */

                    idCardPhoto:
                        idCardPhoto,

                    passportPhoto:
                        passportPhoto,

                    driverLicensePhoto:
                        driverLicensePhoto,

                    licensePhoto:
                        driverLicensePhoto,

                    bankCardPhoto:
                        bankCardPhoto,


                    /*
                    每次重新提交，
                    状态必须重新变成 pending
                    */

                    status:
                        "pending",

                    approvalStatus:
                        "pending",

                    personnelStatus:
                        "待审核",


                    submittedAt:
                        now,

                    updatedAt:
                        now,


                    createdAt:
                        oldProfile
                            ?.createdAt ||
                        oldProfile
                            ?.submittedAt ||
                        now,


                    /*
                    保留重新提交次数
                    */

                    resubmitCount:
                        oldProfile &&
                        oldProfile.status ===
                        "rejected"

                            ? Number(
                                oldProfile
                                    .resubmitCount ||
                                0
                            ) + 1

                            : Number(
                                oldProfile
                                    ?.resubmitCount ||
                                0
                            )
                };


                /*
                =================================
                保存主资料
                =================================
                */

                try {

                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify(
                            profile
                        )
                    );

                } catch (error) {

                    console.error(
                        error
                    );

                    fail(
                        "资料保存失败。照片可能过大，请减少照片后重新提交。"
                    );

                    return;
                }


                /*
                =================================
                同步人员记录
                =================================
                */

                syncPersonnelRecord(
                    profile
                );


                /*
                =================================
                保存成功后进入等待审核页面
                =================================
                */

                alert(
                    "资料提交成功，等待管理员审核。"
                );


                location.href =
                    "driver-waiting.html";


            } catch (error) {


                console.error(
                    "资料提交失败：",
                    error
                );


                fail(
                    error.message ||
                    "资料提交失败，请重新尝试。"
                );

            }

        }


        /*
        =================================
        审核未通过资料回填
        =================================
        */

        function showRejectedProfile(
            profile
        ) {


            const notice =
                document.getElementById(
                    "rejectedNotice"
                );


            if (notice) {

                notice.style.display =
                    "block";
            }


            setValue(
                "name",
                profile.name
            );

            setValue(
                "phone",
                profile.phone
            );

            setValue(
                "emergencyContact",
                profile.emergencyContact
            );

            setValue(
                "emergencyPhone",
                profile.emergencyPhone
            );

            setValue(
                "idCardNumber",
                profile.idCardNumber
            );

            setValue(
                "passportNumber",
                profile.passportNumber
            );

            setValue(
                "bankCardNumber",
                profile.bankCardNumber
            );

            setValue(
                "position",
                profile.position ||
                "卡车司机"
            );

            setValue(
                "team",
                profile.team ||
                profile.department
            );

            setValue(
                "entryDate",
                profile.entryDate
            );

            setValue(
                "remark",
                profile.remark
            );


            submitButton.textContent =
                "修改后重新提交审核";

        }


        /*
        =================================
        人员记录同步
        =================================
        */

        function syncPersonnelRecord(
            profile
        ) {


            let records = [];


            try {

                records =
                    JSON.parse(
                        localStorage.getItem(
                            "personnelRecords"
                        ) || "[]"
                    );

            } catch (error) {

                records = [];
            }


            if (
                !Array.isArray(
                    records
                )
            ) {

                records = [];
            }


            /*
            优先按 personId 查找。
            兼容旧数据时再按 driverId 查找。
            防止重新提交产生重复人员。
            */

            const index =
                records.findIndex(
                    function (item) {

                        const samePersonId =
                            profile.personId &&
                            item.personId ===
                                profile.personId;


                        const sameDriverId =
                            profile.driverId &&
                            item.driverId ===
                                profile.driverId;


                        return (
                            samePersonId ||
                            sameDriverId
                        );

                    }
                );


            if (index >= 0) {

                const oldRecord =
                    records[index] ||
                    {};


                /*
                重新提交时：
                - 用最新资料覆盖
                - 保留已有 employeeNo
                - 保留旧系统可能依赖的其他字段
                */

                records[index] = {

                    ...oldRecord,
                    ...profile,

                    personId:
                        profile.personId ||
                        oldRecord.personId ||
                        createPersonId(),

                    driverId:
                        profile.driverId ||
                        oldRecord.driverId ||
                        "",

                    employeeNo:
                        oldRecord.employeeNo ||
                        profile.employeeNo ||
                        ""
                };


                /*
                驳回后重新提交，清理旧驳回信息
                */

                delete records[index].rejectReason;
                delete records[index].rejectionReason;
                delete records[index].reviewRemark;
                delete records[index].approvalRemark;
                delete records[index].rejectedAt;


                /*
                重新提交为 pending，
                清理旧审核通过时间，避免状态混淆。
                */

                delete records[index].approvedAt;
                delete records[index].approvedBy;
                delete records[index].reviewedAt;
                delete records[index].reviewedBy;


            } else {

                records.push(
                    profile
                );
            }


            try {

                localStorage.setItem(
                    "personnelRecords",
                    JSON.stringify(
                        records
                    )
                );

            } catch (error) {

                console.warn(
                    "人员列表同步失败：",
                    error
                );
            }

        }


        /*
        =================================
        生成内部 UUID
        =================================
        */

        function createPersonId() {


            if (
                window.crypto &&
                typeof window.crypto.randomUUID ===
                    "function"
            ) {

                return window.crypto
                    .randomUUID();

            }


            /*
            兼容不支持 crypto.randomUUID 的旧浏览器
            */

            return (
                "PERSON_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 10)
            );

        }


        /*
        =================================
        读取司机资料
        =================================
        */

        function readProfile() {


            try {


                const value =
                    localStorage.getItem(
                        STORAGE_KEY
                    );


                if (!value) {
                    return null;
                }


                return JSON.parse(
                    value
                );


            } catch (error) {


                console.error(
                    "司机资料损坏：",
                    error
                );


                localStorage.removeItem(
                    STORAGE_KEY
                );


                return null;

            }

        }


        /*
        =================================
        照片处理
        =================================
        */

        async function processPhoto(
            inputId,
            oldPhoto
        ) {


            const input =
                document.getElementById(
                    inputId
                );


            if (
                !input ||
                !input.files ||
                !input.files[0]
            ) {

                return oldPhoto || "";
            }


            const file =
                input.files[0];


            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                throw new Error(
                    "上传文件必须是图片。"
                );
            }


            return await compressImage(
                file
            );

        }


        /*
        =================================
        图片压缩
        =================================
        */

        function compressImage(
            file
        ) {


            return new Promise(
                function (
                    resolve,
                    reject
                ) {


                    const reader =
                        new FileReader();


                    reader.onload =
                        function (event) {


                            const image =
                                new Image();


                            image.onload =
                                function () {


                                    const maxSize =
                                        1000;


                                    let width =
                                        image.width;


                                    let height =
                                        image.height;


                                    if (
                                        width > maxSize ||
                                        height > maxSize
                                    ) {


                                        const ratio =
                                            Math.min(
                                                maxSize / width,
                                                maxSize / height
                                            );


                                        width =
                                            Math.round(
                                                width * ratio
                                            );


                                        height =
                                            Math.round(
                                                height * ratio
                                            );

                                    }


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


                                    const data =
                                        canvas.toDataURL(
                                            "image/jpeg",
                                            0.6
                                        );


                                    resolve(
                                        data
                                    );

                                };


                            image.onerror =
                                function () {

                                    reject(
                                        new Error(
                                            "图片读取失败。"
                                        )
                                    );
                                };


                            image.src =
                                event.target.result;

                        };


                    reader.onerror =
                        function () {

                            reject(
                                new Error(
                                    "图片读取失败。"
                                )
                            );
                        };


                    reader.readAsDataURL(
                        file
                    );

                }
            );

        }


        /*
        =================================
        表单工具
        =================================
        */

        function getValue(
            id
        ) {


            const element =
                document.getElementById(
                    id
                );


            if (!element) {
                return "";
            }


            return (
                element.value || ""
            ).trim();

        }


        function setValue(
            id,
            value
        ) {


            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.value =
                    value || "";
            }

        }


        function fail(
            message
        ) {


            alert(
                message
            );


            submitButton.disabled =
                false;


            submitButton.textContent =

                oldProfile &&
                oldProfile.status ===
                "rejected"

                    ? "修改后重新提交审核"

                    : "提交审核";

        }

    }
);
