import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { verifyJWT } from "../../lib/jwt";
import { connectToMongo } from "../../adapters/database";
import { Member } from "../../lib/types";
import { ObjectId } from "mongodb";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const token = event.headers.authorization?.split(" ")[1];

    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: "NO_TOKEN_PROVIDED" }) };
    }

    try {
        verifyJWT(token);
        
        const id = event.pathParameters?.id;

        if (!id) {
            return { statusCode: 400, body: JSON.stringify({ error: "MEMBER_ID_REQUIRED_IN_PATH" }) };
        }

        const db = await connectToMongo();
        const collection = db.collection<Member>("members");

        const result = await collection.deleteOne({ _id: new ObjectId(id) as any });

        if (result.deletedCount === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: "MEMBER_NOT_FOUND" }) };
        }

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
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