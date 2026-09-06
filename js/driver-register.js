/*
=========================================
矿山管理系统
司机登记
driver-register.js V2.2
=========================================
*/

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const submitButton =
            document.getElementById(
                "submitButton"
            );


        if (!submitButton) {

            console.error(
                "未找到提交审核按钮"
            );

            return;

        }


        /*
        =====================================
        检查已有登记状态
        =====================================
        */

        const savedProfile =
            localStorage.getItem(
                "driverProfile"
            );


        if (savedProfile) {

            try {

                const profile =
                    JSON.parse(
                        savedProfile
                    );


                if (
                    profile.status ===
                    "pending"
                ) {

                    location.href =
                        "driver-waiting.html";

                    return;

                }


                if (
                    profile.status ===
                    "approved"
                ) {

                    location.href =
                        "driver-work.html";

                    return;

                }

            }

            catch (error) {

                console.error(
                    "读取司机资料失败：",
                    error
                );

            }

        }



        /*
        =====================================
        点击提交审核
        =====================================
        */

        submitButton.addEventListener(
            "click",
            async function () {

                submitButton.disabled =
                    true;


                submitButton.textContent =
                    "正在提交...";


                try {

                    const driverName =
                        getValue(
                            "driverName"
                        );


                    const phone =
                        getValue(
                            "phone"
                        );


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
                        );


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
                    =====================================
                    基础验证
                    =====================================
                    */

                    if (!driverName) {

                        alert(
                            "请输入姓名"
                        );

                        resetSubmitButton();

                        return;

                    }


                    if (!phone) {

                        alert(
                            "请输入手机号"
                        );

                        resetSubmitButton();

                        return;

                    }


                    if (!emergencyContact) {

                        alert(
                            "请输入紧急联系人"
                        );

                        resetSubmitButton();

                        return;

                    }


                    if (!emergencyPhone) {

                        alert(
                            "请输入紧急联系人电话"
                        );

                        resetSubmitButton();

                        return;

                    }


                    if (!team) {

                        alert(
                            "请选择所属车队"
                        );

                        resetSubmitButton();

                        return;

                    }


                    if (
                        !idCardNumber &&
                        !passportNumber
                    ) {

                        alert(
                            "身份证号和护照号至少填写一项"
                        );

                        resetSubmitButton();

                        return;

                    }



                    /*
                    =====================================
                    获取照片
                    =====================================
                    */

                    const idCardFile =
                        getFile(
                            "idCardPhoto"
                        );


                    const passportFile =
                        getFile(
                            "passportPhoto"
                        );


                    const driverLicenseFile =
                        getFile(
                            "driverLicensePhoto"
                        );


                    const bankCardFile =
                        getFile(
                            "bankCardPhoto"
                        );



                    /*
                    =====================================
                    检查图片类型
                    =====================================
                    */

                    const fileList = [

                        {
                            name:
                                "身份证照片",

                            file:
                                idCardFile
                        },

                        {
                            name:
                                "护照照片",

                            file:
                                passportFile
                        },

                        {
                            name:
                                "驾驶证照片",

                            file:
                                driverLicenseFile
                        },

                        {
                            name:
                                "银行卡照片",

                            file:
                                bankCardFile
                        }

                    ];


                    for (
                        const item
                        of fileList
                    ) {

                        if (
                            item.file &&
                            !item.file.type
                                .startsWith(
                                    "image/"
                                )
                        ) {

                            alert(
                                item.name
                                +
                                "必须上传图片"
                            );

                            resetSubmitButton();

                            return;

                        }

                    }



                    /*
                    =====================================
                    压缩图片
                    =====================================
                    */

                    const idCardPhoto =
                        await compressImage(
                            idCardFile
                        );


                    const passportPhoto =
                        await compressImage(
                            passportFile
                        );


                    const driverLicensePhoto =
                        await compressImage(
                            driverLicenseFile
                        );


                    const bankCardPhoto =
                        await compressImage(
                            bankCardFile
                        );



                    /*
                    =====================================
                    生成人员档案
                    =====================================
                    */

                    const profile = {

                        driverId:
                            "DRIVER_"
                            +
                            Date.now(),

                        name:
                            driverName,

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
                            position ||
                            "卡车司机",

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

                        status:
                            "pending",

                        submittedAt:
                            new Date()
                                .toISOString()

                    };



                    /*
                    =====================================
                    保存本机司机档案
                    =====================================
                    */

                    try {

                        localStorage.setItem(
                            "driverProfile",
                            JSON.stringify(
                                profile
                            )
                        );

                    }

                    catch (storageError) {

                        console.error(
                            storageError
                        );


                        alert(
                            "照片数据太大，浏览器无法保存。请使用较小照片后重新提交。"
                        );

                        resetSubmitButton();

                        return;

                    }



                    /*
                    =====================================
                    同步保存人员记录
                    为后续管理员多人汇总预留
                    =====================================
                    */

                    try {

                        let personnelRecords =
                            JSON.parse(
                                localStorage.getItem(
                                    "personnelRecords"
                                )
                                ||
                                "[]"
                            );


                        if (
                            !Array.isArray(
                                personnelRecords
                            )
                        ) {

                            personnelRecords =
                                [];

                        }


                        personnelRecords.push(
                            profile
                        );


                        localStorage.setItem(
                            "personnelRecords",
                            JSON.stringify(
                                personnelRecords
                            )
                        );

                    }

                    catch (error) {

                        console.warn(
                            "人员汇总记录保存失败：",
                            error
                        );

                    }



                    /*
                    =====================================
                    提交成功
                    =====================================
                    */

                    alert(
                        "信息提交成功，等待管理员审核。"
                    );


                    location.href =
                        "driver-waiting.html";

                }

                catch (error) {

                    console.error(
                        "提交失败：",
                        error
                    );


                    alert(
                        "提交失败，请重新尝试。"
                    );


                    resetSubmitButton();

                }

            }
        );



        /*
        =====================================
        获取文本
        =====================================
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


            return element.value.trim();

        }



        /*
        =====================================
        获取文件
        =====================================
        */

        function getFile(
            id
        ) {

            const element =
                document.getElementById(
                    id
                );


            if (
                !element ||
                !element.files ||
                element.files.length ===
                0
            ) {

                return null;

            }


            return element.files[0];

        }



        /*
        =====================================
        恢复按钮
        =====================================
        */

        function resetSubmitButton() {

            submitButton.disabled =
                false;


            submitButton.textContent =
                "提交审核";

        }

    }
);



/*
=========================================
图片压缩
=========================================
*/

function compressImage(
    file
) {

    return new Promise(
        function (
            resolve,
            reject
        ) {

            if (!file) {

                resolve("");

                return;

            }


            const reader =
                new FileReader();


            reader.onload =
                function (
                    event
                ) {

                    const image =
                        new Image();


                    image.onload =
                        function () {

                            let width =
                                image.width;


                            let height =
                                image.height;


                            const maxSize =
                                1000;


                            if (
                                width >
                                maxSize ||
                                height >
                                maxSize
                            ) {

                                if (
                                    width >
                                    height
                                ) {

                                    height =
                                        Math.round(
                                            height
                                            *
                                            maxSize
                                            /
                                            width
                                        );


                                    width =
                                        maxSize;

                                }

                                else {

                                    width =
                                        Math.round(
                                            width
                                            *
                                            maxSize
                                            /
                                            height
                                        );


                                    height =
                                        maxSize;

                                }

                            }


                            const canvas =
                                document
                                    .createElement(
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


                            context.fillStyle =
                                "#ffffff";


                            context.fillRect(
                                0,
                                0,
                                width,
                                height
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
                                    0.6
                                )
                            );

                        };


                    image.onerror =
                        function () {

                            reject(
                                new Error(
                                    "图片读取失败"
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
                            "文件读取失败"
                        )
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}
