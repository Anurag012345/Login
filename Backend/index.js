import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import nodemailer from "nodemailer"

const app = express()
app.use(express.json())
app.use(express.urlencoded())
app.use(cors())


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

app.listen(9002, () => {
    console.log("BE started at port 9002")
})
