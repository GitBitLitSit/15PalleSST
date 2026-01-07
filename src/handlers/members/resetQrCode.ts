import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { verifyJWT } from "../../lib/jwt";
import { connectToMongo } from "../../adapters/database";
import { Member } from "../../lib/types";
import { ObjectId } from "mongodb";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const token = event.headers.authorization?.split(" ")[1];

    if (!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: "NO_TOKEN_PROVIDED" }),
        };
    }

    try {
        verifyJWT(token);

        let { id } = JSON.parse(event.body || "{}");
        const trimmedId = id?.trim() ?? "";

        if (!trimmedId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "MEMBER_ID_REQUIRED" }),
            };
        }

        if (!ObjectId.isValid(trimmedId)) {
             return {
                statusCode: 400,
                body: JSON.stringify({ error: "INVALID_MEMBER_ID_FORMAT" }),
            };
        }

        const db = await connectToMongo();
        const membersCollection = db.collection<Member>("members");

        const newQrUuid = crypto.randomUUID();

        const result = await membersCollection.updateOne(
            { _id: ObjectId.createFromHexString(trimmedId) as any },
            { $set: { qrUuid: newQrUuid } }
        )

        if (result.matchedCount === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "MEMBER_NOT_FOUND" }),
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                message: "QR_CODE_RESET_SUCCESS",
                qrUuid: newQrUuid
            }),
        };

    } catch (error) {
        console.error("Reset QR Error:", error);
        
        const isJwtError = error instanceof Error && error.message.includes("JWT");
        
        return {
            statusCode: isJwtError ? 401 : 500,
            body: JSON.stringify({ 
                error: isJwtError ? "INVALID_TOKEN" : "INTERNAL_SERVER_ERROR" 
            }),
        };
    }
}