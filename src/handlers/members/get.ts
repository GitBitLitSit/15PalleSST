import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { verifyJWT } from "../../lib/jwt";
import { connectToMongo } from "../../adapters/database";
import { Member } from "../../lib/types";

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

        const queryParams = event.queryStringParameters || {};

        const search = queryParams.search?.trim() || "";
        const page = parseInt(queryParams.page || "1");
        const limit = parseInt(queryParams.limit || "20");
        const showBlockedOnly = queryParams.blocked === "true";

        const db = await connectToMongo();
        const collection = db.collection<Member>("members");

        let dbQuery: any = {};

        // Filter by text search
        if (search) {
            const regex = new RegExp(search, "i"); // i case-insensitive
            dbQuery.$or = [
                { firstName: regex },
                { lastName: regex },
                { email: regex },
            ];
        }

        // Filter by blocked status
        if (showBlockedOnly) {
            dbQuery.blocked = true;
        }

        const skip = (page - 1) * limit;

        const [members, total] = await Promise.all([
            collection.find(dbQuery)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            collection.countDocuments(dbQuery),
        ]);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                data: members,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                }
            }),
        };
    } catch (error) {
        return {
            statusCode: error instanceof Error && error.message.includes("JWT") ? 401 : 500,
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        }
    }
}