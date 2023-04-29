// import express from "express"
// import cors from "cors"
// import mongoose from "mongoose"
// import nodemailer from "nodemailer"

const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const nodemailer = require("nodemailer")

const https = require("https");
const qs = require("querystring");

const checksum_lib = require("./Paytm/checksum")
const config = require("./Paytm/config")

const app = express()
app.use(express.json())
app.use(express.urlencoded())
app.use(cors())

const parseUrl = express.urlencoded({ extended: false });
const parseJson = express.json({ extended: false });

mongoose.connect("mongodb://127.0.0.1:27017/myLoginRegisterDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log("Connected to Database"))
    .catch((err) => console.log("Something Went Wrong"))

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    is_verified: Boolean,

})

//for send mail
const sendVerifyMail = async (name, email, user_id) => {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: "Rawatanurag362@gmail.com",
                pass: ""
            }
        })
        const mailOptions = {
            from: "rawatanurag362@gmail.com",
            to: email,
            subject: "For Verification Mail",
            html: '<p>Hii ' + name + ', Please click here http://localhost:3000/verify?id=' + user_id + 'to Verify Your Account</p>'
        }
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error)
            } else {
                console.log("Email has been Send: ", info.response)
            }

        })
    } catch (error) {
        console.log(error.message)
    }
}


const User = new mongoose.model("User", userSchema)
//Routes
app.post("/login", async (req, res) => {
    let user = await User.findOne({ email: req.body.email })
    if (user) {
        if (req.body.password === user.password) {
            res.send({ message: "Login Sucessfull", user: user })
        } else {
            res.send({ message: "Password didn't match" })
        }
    } else {
        res.send({ message: "User Not Found" })
    }

})

app.post("/sign-in", async (req, res) => {
    let user = await User.findOne({ email: req.body.email })
    if (user !== null && user !== undefined) {
        res.send({ message: "User Already Exist" })
    }
    else {
        const newuser = new User({
            name: req.body.username,
            email: req.body.email,
            password: req.body.password,
            is_verified: false
        })
        const userData = await newuser.save()

        if (userData) {
            sendVerifyMail(req.body.username, req.body.email, userData._id)
            res.send({ message: "Successfully Registerd" })
        }
    }

})

app.get('/verify', (req, res) => {
    verifyMail(req, res)
})

const verifyMail = async (req, res) => {
    try {
        let updateInfo = await User.updateOne({ _id: req.query.id }, { $set: { is_verified: true } })

        console.log(updateInfo);
        res.send({ message: "Successfully Verified" })

    } catch (error) {
        console.log(error.message)
    }
}

app.post("/paynow", [parseUrl, parseJson], (req, res) => {
    // Route for making payment

    var paymentDetails = {
        amount: req.body.amount,
        customerId: req.body.name,
        customerEmail: req.body.email,
        customerPhone: req.body.phone,
    };
    if (
        !paymentDetails.amount ||
        !paymentDetails.customerId ||
        !paymentDetails.customerEmail ||
        !paymentDetails.customerPhone
    ) {
        res.status(400).send("Payment failed");
    } else {
        var params = {};
        params["MID"] = config.PaytmConfig.mid;
        params["WEBSITE"] = config.PaytmConfig.website;
        params["CHANNEL_ID"] = "WEB";
        params["INDUSTRY_TYPE_ID"] = "Retail";
        params["ORDER_ID"] = "TEST_" + new Date().getTime();
        params["CUST_ID"] = paymentDetails.customerId;
        params["TXN_AMOUNT"] = paymentDetails.amount;
        params["CALLBACK_URL"] = "http://localhost:3000/callback";
        params["EMAIL"] = paymentDetails.customerEmail;
        params["MOBILE_NO"] = paymentDetails.customerPhone;

        checksum_lib.genchecksum(
            params,
            config.PaytmConfig.key,
            function (err, checksum) {
                var txn_url =
                    "https://securegw-stage.paytm.in/theia/processTransaction"; // for staging
                // var txn_url = "https://securegw.paytm.in/theia/processTransaction"; // for production

                var form_fields = "";
                for (var x in params) {
                    form_fields +=
                        "<input type='hidden' name='" + x + "' value='" + params[x] + "' >";
                }
                form_fields +=
                    "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";

                res.writeHead(200, { "Content-Type": "text/html" });
                res.write(
                    '<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' +
                    txn_url +
                    '" name="f1">' +
                    form_fields +
                    '</form><script type="text/javascript">document.f1.submit();</script></body></html>'
                );
                res.end();
            }
        );
    }
});

app.post("/callback", (req, res) => {
    // Route for verifiying payment

    var body = "";

    req.on("data", function (data) {
        body += data;
    });

    req.on("end", function () {
        var html = "";
        var post_data = qs.parse(body);

        // received params in callback
        console.log("Callback Response: ", post_data, "n");

        // verify the checksum
        var checksumhash = post_data.CHECKSUMHASH;
        // delete post_data.CHECKSUMHASH;
        var result = checksum_lib.verifychecksum(
            post_data,
            config.PaytmConfig.key,
            checksumhash
        );
        console.log("Checksum Result => ", result, "n");

        // Send Server-to-Server request to verify Order Status
        var params = { MID: config.PaytmConfig.mid, ORDERID: post_data.ORDERID };

        checksum_lib.genchecksum(
            params,
            config.PaytmConfig.key,
            function (err, checksum) {
                params.CHECKSUMHASH = checksum;
                post_data = "JsonData=" + JSON.stringify(params);

                var options = {
                    hostname: "securegw-stage.paytm.in", // for staging
                    // hostname: 'securegw.paytm.in', // for production
                    port: 443,
                    path: "/merchant-status/getTxnStatus",
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Content-Length": post_data.length,
                    },
                };

                // Set up the request
                var response = "";
                var post_req = https.request(options, function (post_res) {
                    post_res.on("data", function (chunk) {
                        response += chunk;
                    });

                    post_res.on("end", function () {
                        console.log("S2S Response: ", response, "n");

                        var _result = JSON.parse(response);
                        if (_result.STATUS == "TXN_SUCCESS") {
                            res.send("payment sucess");
                        } else {
                            res.send("payment failed");
                        }
                    });
                });

                // post the data
                post_req.write(post_data);
                post_req.end();
            }
        );
    });
});

app.listen(9002, () => {
    console.log("BE started at port 9002")
})
