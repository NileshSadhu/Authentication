var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import Mailgen from "mailgen";
import nodemailer from "nodemailer";
export const emailVerificationMailgenContent = (username, verificationUrl) => {
    return {
        body: {
            name: username,
            intro: "Welcome to our Application. We're excited to have you on board.",
            action: {
                instructions: "To Verify your email please click on the following button.",
                button: {
                    color: "#22BC66",
                    text: "Verify you email.",
                    link: verificationUrl,
                },
            },
            outro: "Need help, or have questions? Just reply to this email, we'd love to help.",
        },
    };
};
export const forgetpasswordMailgenContent = (username, passwordResetUrl) => {
    return {
        body: {
            name: username,
            intro: "We got a request to reset the password pf your account",
            action: {
                instructions: "To reset your password click on the following button or link.",
                button: {
                    color: "#bc2222",
                    text: "Reset Password.",
                    link: passwordResetUrl,
                },
            },
            outro: "Need help, or have questions? Just reply to this email, we'd love to help.",
        },
    };
};
export const sendMail = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const mailgenerator = new Mailgen({
        theme: "default",
        product: {
            name: "Nilesh Sadhu",
            link: "http://nileshSadhulink.com",
        },
    });
    const emailHTML = mailgenerator.generate(options.mailgenContent);
    var transport = nodemailer.createTransport({
        host: process.env.MAILTRAP_HOST,
        port: Number(process.env.MAILTRAP_PORT),
        auth: {
            user: process.env.MAILTRAP_USERNAME,
            pass: process.env.MAILTRAP_PASSWORD,
        },
    });
    const mail = {
        from: "nilesh@example.com",
        to: options.email,
        secure: false,
        subject: options.subject,
        html: emailHTML,
    };
    try {
        yield transport.sendMail(mail);
    }
    catch (error) {
        console.error("Email Services Error", error);
    }
});
