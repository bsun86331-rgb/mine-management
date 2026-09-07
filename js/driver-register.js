/*
=========================================
矿山管理系统
司机注册 / 审核跳转
V2.8.1
=========================================
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
                    "请输入所属车队。"
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
                            ?.idCard || ""
                    );


                const passportPhoto =
                    await processPhoto(
                        "passportPhoto",
                        oldProfile?.photos
                            ?.passport || ""
                    );


                const driverLicensePhoto =
                    await processPhoto(
                        "driverLicensePhoto",
                        oldProfile?.photos
                            ?.driverLicense || ""
                    );


                const bankCardPhoto =
                    await processPhoto(
                        "bankCardPhoto",
                        oldProfile?.photos
                            ?.bankCard || ""
                    );


                /*
                保留原司机ID
                rejected重新提交不能生成新司机
                */

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

                    driverId:
                        driverId,

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

                    team:
                        team,

                    entryDate:
                        entryDate,

                    remark:
                        remark,

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
                    每次重新提交，
                    状态必须重新变成 pending
                    */

                    status:
                        "pending",


                    submittedAt:
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
                最重要：
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
                profile.team
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
            按driverId查找，
            防止重新提交产生重复人员。
            */

            const index =
                records.findIndex(
                    function (item) {

                        return (
                            item.driverId ===
                            profile.driverId
                        );
                    }
                );


            if (index >= 0) {

                records[index] =
                    profile;

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
