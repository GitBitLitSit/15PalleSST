import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { connectToMongo } from "../../adapters/database";
import { verifyJWT } from "../../lib/jwt";
import { sendQrCodeEmail } from "../../adapters/email";
import { MongoServerError } from "mongodb";
import { Member } from "../../lib/types";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const token = event.headers.authorization?.split(" ")[1];
    if(!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: "NO_TOKEN_PROVIDED" }),
        };
    }

    try {
        verifyJWT(token);

        let { firstName, lastName, email, sendEmail } = JSON.parse(event.body || "{}");
        const trimmedFirstName = firstName?.trim() ?? "";
        const trimmedLastName = lastName?.trim() ?? "";
        const trimmedEmail = email?.trim() ?? "";

        if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || typeof sendEmail !== "boolean") {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "MEMBER_REQUIRED" }),
            };
        } else if (trimmedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) === null) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "INVALID_EMAIL_FORMAT" }),
            };
        }

        const db = await connectToMongo();
        const collection = db.collection<Member>("members");

        const qrUuid = crypto.randomUUID();
        const newMember: Member = {
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            email: trimmedEmail,
            createdAt: new Date(),
            blocked: false,
            qrUuid: qrUuid,
            emailValid: false,
        }

        const result = await collection.insertOne(newMember);

        if (sendEmail) {
            const { success, error } = await sendQrCodeEmail(process.env.SES_SENDER_EMAIL!, trimmedFirstName, trimmedLastName, trimmedEmail, qrUuid);

            if (success) {
                await collection.updateOne(
                    { _id: result.insertedId },
                    { $set: { emailValid: true } }
                );

                return {
                    statusCode: 201,
                    body: JSON.stringify({ message: "MEMBER_CREATED_EMAIL_SUCCESS", memberId: result.insertedId }),
                };
            } else {
                return {
                    statusCode: 201,
                    body: JSON.stringify({ message: "MEMBER_CREATED_EMAIL_FAILED", details: error, memberId: result.insertedId }),
                };
            }
        }

        return {
            statusCode: 201,
            body: JSON.stringify({ message: "MEMBER_CREATED", memberId: result.insertedId }),
        }
    } catch (error) {
        // Email already exists
        if (error instanceof MongoServerError && error.code === 11000) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "MEMBER_EMAIL_EXISTS" }),
            };
        }

        // JWT verification error
        if (error instanceof Error && error.message.includes("JWT")) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "INVALID_TOKEN" })
            };
        }

        // Generic error
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        }
    }
}