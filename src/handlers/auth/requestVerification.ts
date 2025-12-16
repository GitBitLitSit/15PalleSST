import { SESClient } from "@aws-sdk/client-ses";
import { connectToMongo } from "../../adapters/database";
import { Member, EmailVerification } from "../../lib/types";
import { sendVerificationEmail } from "../../adapters/email";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";

const ses = new SESClient({ region: "eu-west-1" });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const SAFE_RESPONSE = {
        statusCode: 200,
        body: JSON.stringify({ message: "If this account exists, a code has been sent." }),
    };

    try {
        let { email } = JSON.parse(event.body || "{}");
        const trimmedEmail = email?.trim() ?? "";

        if (!trimmedEmail) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Email is required" }),
            };
        }

        const db = await connectToMongo();
        const member = await db.collection<Member>("members").findOne({ email: trimmedEmail });

        if (!member) {
            return SAFE_RESPONSE;
        }

        const verificationCollection = db.collection<EmailVerification>("emailVerifications");
        const existingRecord = await verificationCollection.findOne({ memberId: member._id });

        if (existingRecord) {
            const now = new Date();
            const timeDiff = now.getTime() - new Date(existingRecord.createdAt).getTime();
            const COOLDOWN_SECONDS = 60; // 1 Minute Cooldown

            if (timeDiff < COOLDOWN_SECONDS * 1000) {
                return SAFE_RESPONSE;
            }

            await verificationCollection.deleteOne({ _id: existingRecord._id });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        await verificationCollection.insertOne({
            memberId: member._id,
            verificationCode: verificationCode,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 mins
        });

        await sendVerificationEmail(
            process.env.SES_SENDER_EMAIL!,
            trimmedEmail,
            verificationCode,
            member.firstName
        );

        return SAFE_RESPONSE;

    } catch (error) {
        console.error("Request Code Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error" }),
        };
    }
};