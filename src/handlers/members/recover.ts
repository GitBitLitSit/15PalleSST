import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { connectToMongo } from "../../adapters/database";
import { Member, EmailVerification } from "../../lib/types";
import { sendQrCodeEmail } from "../../adapters/email";
import QRCode from "qrcode";


export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    try {
        let { email, verificationCode, deliveryMethod } = JSON.parse(event.body || "{}");

        const trimmedEmail = email?.trim() ?? "";
        const trimmedVerificationCode = verificationCode?.trim() ?? "";

        const method = (deliveryMethod === "email") ? "email" : "display";

        if (!trimmedEmail || !trimmedVerificationCode) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Email and confirmation code are required" }),
            };
        }

        const db = await connectToMongo();
        const memberCollection = db.collection<Member>("members");

        const memberRecord = await memberCollection.findOne({ email: trimmedEmail });

        if (!memberRecord) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Member with this email not found" }),
            }
        }

        const emailVerificationCollection = db.collection<EmailVerification>("emailVerifications");

        const emailVerificationRecord = await emailVerificationCollection.findOne({ memberId: memberRecord._id, verificationCode: trimmedVerificationCode });

        if (!emailVerificationRecord) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Invalid email or verification code" }),
            }
        } else if (new Date(emailVerificationRecord.expiresAt) < new Date()) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Verification code has expired" }),
            }
        } else if (emailVerificationRecord.verificationCode !== trimmedVerificationCode) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Invalid verification code" }),
            }
        }

        await memberCollection.updateOne(
            { _id: memberRecord._id },
            { $set: { emailValid: true } }
        );

        await emailVerificationCollection.deleteOne({ _id: emailVerificationRecord._id });

        let responseBody = {};
    
        if (method === "email") {
            await sendQrCodeEmail(process.env.SES_SENDER_EMAIL!, memberRecord.firstName, memberRecord.lastName, memberRecord.email, memberRecord.qrUuid);
            responseBody = { success: true, message: "QR Code has been sent to your email." };
        } else {
            const qrImage = await QRCode.toDataURL(memberRecord.qrUuid);
            responseBody = {
                success: true,
                message: "Code verified successfully.",
                qrImage: qrImage,
                member: memberRecord
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify(responseBody),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error" }),
        };
    }
}