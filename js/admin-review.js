/*
=========================================
矿山管理系统
admin-review.js V2.0

功能：
1. 人员信息汇总表
2. 查看人员详细档案
3. 查看证件照片
4. 审核通过
5. 审核不通过
6. 打印人员档案
7. 打印证件照片
=========================================
*/


document.addEventListener(
    "DOMContentLoaded",
    function () {

        /*
        =====================================
        页面元素
        =====================================
        */

        const emptyMessage =
            document.getElementById(
                "emptyMessage"
            );


        const personnelTableArea =
            document.getElementById(
                "personnelTableArea"
            );


        const personnelTableBody =
            document.getElementById(
                "personnelTableBody"
            );


        const detailSection =
            document.getElementById(
                "detailSection"
            );


        const approveButton =
            document.getElementById(
                "approveButton"
            );


        const rejectButton =
            document.getElementById(
                "rejectButton"
            );


        const printProfileButton =
            document.getElementById(
                "printProfileButton"
            );


        const printPhotosButton =
            document.getElementById(
                "printPhotosButton"
            );


        const closeDetailButton =
            document.getElementById(
                "closeDetailButton"
            );


        /*
        =====================================
        读取人员资料
        =====================================
        */

        const data =
            localStorage.getItem(
                "driverProfile"
            );


        if (!data) {

            emptyMessage.style.display =
                "block";


            personnelTableArea.style.display =
                "none";


            return;

        }


        let profile;


        try {

            profile =
                JSON.parse(
                    data
                );

        }

        catch (error) {

            console.error(
                "人员资料读取失败：",
                error
            );


            alert(
                "人员资料读取失败"
            );


            return;

        }


        /*
        =====================================
        显示汇总表
        =====================================
        */

        emptyMessage.style.display =
            "none";


        personnelTableArea.style.display =
            "block";


        renderPersonnelTable(
            profile
        );



        /*
        =====================================
        查看详情
        =====================================
        */

        window.openPersonnelDetail =
            function () {

                showPersonnelDetail(
                    profile
                );

            };



        /*
        =====================================
        审核通过
        =====================================
        */

        approveButton.addEventListener(
            "click",
            function () {

                const confirmed =
                    confirm(
                        "确认审核通过该人员吗？"
                    );


                if (!confirmed) {

                    return;

                }


                profile.status =
                    "approved";


                profile.approvedAt =
                    new Date()
                        .toISOString();


                profile.rejectedAt =
                    "";


                saveProfile(
                    profile
                );


                alert(
                    "审核已通过"
                );


                refreshPage();

            }
        );



        /*
        =====================================
        审核不通过
        =====================================
        */

        rejectButton.addEventListener(
            "click",
            function () {

                const confirmed =
                    confirm(
                        "确认审核不通过该人员吗？"
                    );


                if (!confirmed) {

                    return;

                }


                profile.status =
                    "rejected";


                profile.rejectedAt =
                    new Date()
                        .toISOString();


                profile.approvedAt =
                    "";


                saveProfile(
                    profile
                );


                alert(
                    "该人员审核未通过"
                );


                refreshPage();

            }
        );



        /*
        =====================================
        打印人员档案
        =====================================
        */

        printProfileButton.addEventListener(
            "click",
            function () {

                printPersonnelProfile(
                    profile
                );

            }
        );



        /*
        =====================================
        打印证件照片
        =====================================
        */

        printPhotosButton.addEventListener(
            "click",
            function () {

                printPersonnelPhotos(
                    profile
                );

            }
        );



        /*
        =====================================
        关闭详情
        =====================================
        */

        closeDetailButton.addEventListener(
            "click",
            function () {

                detailSection.style.display =
                    "none";


                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

    }
);



/*
=========================================
生成人员汇总表
=========================================
*/

function renderPersonnelTable(
    profile
) {

    const tableBody =
        document.getElementById(
            "personnelTableBody"
        );


    tableBody.innerHTML =
        "";


    const row =
        document.createElement(
            "tr"
        );


    row.innerHTML =

        "<td>"
        +
        escapeHtml(
            profile.name || ""
        )
        +
        "</td>"

        +

        "<td>"
        +
        escapeHtml(
            profile.phone || ""
        )
        +
        "</td>"

        +

        "<td>"
        +
        escapeHtml(
            maskSensitive(
                profile.idCardNumber
            )
        )
        +
        "</td>"

        +

        "<td>"
        +
        escapeHtml(
            maskSensitive(
                profile.passportNumber
            )
        )
        +
        "</td>"

        +

        "<td>"
        +
        escapeHtml(
            maskBankCard(
                profile.bankCardNumber
            )
        )
        +
        "</td>"

        +

        "<td>"
        +
        escapeHtml(
            profile.position || ""
        )
        +
        "</td>"

        +

        "<td>"
        +
        escapeHtml(
            profile.team || ""
        )
        +
        "</td>"

        +

        "<td>"
        +
        escapeHtml(
            profile.entryDate ||
            "未填写"
        )
        +
        "</td>"

        +

        "<td>"
        +
        escapeHtml(
            getStatusText(
                profile.status
            )
        )
        +
        "</td>"

        +

        "<td>"
        +
        "<button "
        +
        "type='button' "
        +
        "onclick='openPersonnelDetail()' "
        +
        "style='min-height:40px; margin:0;'>"
        +
        "查看"
        +
        "</button>"
        +
        "</td>";


    tableBody.appendChild(
        row
    );

}



/*
=========================================
显示人员详细档案
=========================================
*/

function showPersonnelDetail(
    profile
) {

    setText(
        "detailName",
        profile.name
    );


    setText(
        "detailPhone",
        profile.phone
    );


    setText(
        "detailIdCardNumber",
        profile.idCardNumber ||
        "未填写"
    );


    setText(
        "detailPassportNumber",
        profile.passportNumber ||
        "未填写"
    );


    setText(
        "detailBankCardNumber",
        profile.bankCardNumber ||
        "未填写"
    );


    setText(
        "detailPosition",
        profile.position
    );


    setText(
        "detailTeam",
        profile.team
    );


    setText(
        "detailEntryDate",
        profile.entryDate ||
        "未填写"
    );


    setText(
        "detailRemark",
        profile.remark ||
        "无"
    );


    setText(
        "detailStatus",
        getStatusText(
            profile.status
        )
    );


    const photos =
        profile.photos || {};


    showPhoto(
        "detailIdCardPhoto",
        "idCardNoPhoto",
        photos.idCard
    );


    showPhoto(
        "detailPassportPhoto",
        "passportNoPhoto",
        photos.passport
    );


    showPhoto(
        "detailDriverLicensePhoto",
        "driverLicenseNoPhoto",
        photos.driverLicense
    );


    showPhoto(
        "detailBankCardPhoto",
        "bankCardNoPhoto",
        photos.bankCard
    );


    const detailSection =
        document.getElementById(
            "detailSection"
        );


    detailSection.style.display =
        "block";


    detailSection.scrollIntoView({
        behavior: "smooth"
    });

}



/*
=========================================
显示照片
=========================================
*/

function showPhoto(
    imageId,
    noPhotoId,
    imageData
) {

    const image =
        document.getElementById(
            imageId
        );


    const noPhoto =
        document.getElementById(
            noPhotoId
        );


    if (imageData) {

        image.src =
            imageData;


        image.style.display =
            "block";


        noPhoto.style.display =
            "none";

    }

    else {

        image.removeAttribute(
            "src"
        );


        image.style.display =
            "none";


        noPhoto.style.display =
            "block";

    }

}



/*
=========================================
保存人员资料
=========================================
*/

function saveProfile(
    profile
) {

    localStorage.setItem(
        "driverProfile",
        JSON.stringify(
            profile
        )
    );

}



/*
=========================================
刷新页面
=========================================
*/

function refreshPage() {

    location.reload();

}



/*
=========================================
打印人员档案
=========================================
*/

function printPersonnelProfile(
    profile
) {

    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {

        alert(
            "浏览器阻止了打印窗口，请允许弹出窗口后重新操作。"
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

                    color: #111;
                }

                h1 {
                    text-align: center;
                }

                table {
                    width: 100%;

                    border-collapse:
                        collapse;

                    margin-top: 25px;
                }

                td {
                    border:
                        1px solid #333;

                    padding:
                        10px;
                }

                td:first-child {
                    width: 160px;

                    font-weight: bold;
                }

            </style>

        </head>


        <body>

            <h1>
                人员信息登记表
            </h1>


            <table>

                <tr>
                    <td>姓名</td>
                    <td>${escapeHtml(profile.name || "")}</td>
                </tr>

                <tr>
                    <td>手机号</td>
                    <td>${escapeHtml(profile.phone || "")}</td>
                </tr>

                <tr>
                    <td>身份证号</td>
                    <td>${escapeHtml(profile.idCardNumber || "未填写")}</td>
                </tr>

                <tr>
                    <td>护照号</td>
                    <td>${escapeHtml(profile.passportNumber || "未填写")}</td>
                </tr>

                <tr>
                    <td>银行卡号</td>
                    <td>${escapeHtml(profile.bankCardNumber || "未填写")}</td>
                </tr>

                <tr>
                    <td>岗位</td>
                    <td>${escapeHtml(profile.position || "")}</td>
                </tr>

                <tr>
                    <td>所属车队</td>
                    <td>${escapeHtml(profile.team || "")}</td>
                </tr>

                <tr>
                    <td>入职日期</td>
                    <td>${escapeHtml(profile.entryDate || "未填写")}</td>
                </tr>

                <tr>
                    <td>审核状态</td>
                    <td>${escapeHtml(getStatusText(profile.status))}</td>
                </tr>

                <tr>
                    <td>备注</td>
                    <td>${escapeHtml(profile.remark || "无")}</td>
                </tr>

            </table>

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



/*
=========================================
打印证件照片
=========================================
*/

function printPersonnelPhotos(
    profile
) {

    const photos =
        profile.photos || {};


    const availablePhotos = [];


    if (photos.idCard) {

        availablePhotos.push({
            title:
                "身份证照片",

            src:
                photos.idCard
        });

    }


    if (photos.passport) {

        availablePhotos.push({
            title:
                "护照照片",

            src:
                photos.passport
        });

    }


    if (photos.driverLicense) {

        availablePhotos.push({
            title:
                "驾驶证照片",

            src:
                photos.driverLicense
        });

    }


    if (photos.bankCard) {

        availablePhotos.push({
            title:
                "银行卡照片",

            src:
                photos.bankCard
        });

    }


    if (
        availablePhotos.length ===
        0
    ) {

        alert(
            "该人员没有上传证件照片"
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
            "浏览器阻止了打印窗口，请允许弹出窗口后重新操作。"
        );

        return;

    }


    let photoHtml =
        "";


    availablePhotos.forEach(
        function (
            photo
        ) {

            photoHtml += `

                <div class="photo-block">

                    <h2>
                        ${escapeHtml(photo.title)}
                    </h2>

                    <img
                        src="${photo.src}"
                        alt="${escapeHtml(photo.title)}"
                    >

                </div>

            `;

        }
    );


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

                    padding:
                        25px;
                }

                h1 {
                    text-align:
                        center;
                }

                .person-name {
                    text-align:
                        center;

                    margin-bottom:
                        30px;
                }

                .photo-block {
                    page-break-inside:
                        avoid;

                    margin-bottom:
                        40px;

                    text-align:
                        center;
                }

                img {
                    max-width:
                        100%;

                    max-height:
                        850px;
                }

            </style>

        </head>


        <body>

            <h1>
                人员证件照片
            </h1>

            <div class="person-name">

                姓名：
                ${escapeHtml(profile.name || "")}

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



/*
=========================================
审核状态文字
=========================================
*/

function getStatusText(
    status
) {

    if (
        status ===
        "pending"
    ) {

        return "待审核";

    }


    if (
        status ===
        "approved"
    ) {

        return "已通过";

    }


    if (
        status ===
        "rejected"
    ) {

        return "审核未通过";

    }


    return "未知";

}



/*
=========================================
设置文字
=========================================
*/

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {
        return;
    }


    element.textContent =
        value || "";

}



/*
=========================================
身份证 / 护照简单脱敏
=========================================
*/

function maskSensitive(
    value
) {

    if (!value) {

        return "未填写";

    }


    if (
        value.length <=
        6
    ) {

        return value;

    }


    return (
        value.slice(
            0,
            3
        )
        +
        "****"
        +
        value.slice(
            -3
        )
    );

}



/*
=========================================
银行卡号脱敏
=========================================
*/

function maskBankCard(
    value
) {

    if (!value) {

        return "未填写";

    }


    if (
        value.length <=
        8
    ) {

        return value;

    }


    return (
        value.slice(
            0,
            4
        )
        +
        " **** **** "
        +
        value.slice(
            -4
        )
    );

}



/*
=========================================
HTML安全处理
=========================================
*/

function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value || ""
        );


    return div.innerHTML;

}
