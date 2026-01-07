import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { verifyJWT } from "../../lib/jwt";
import { connectToMongo } from "../../adapters/database";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const token = event.headers.authorization?.split(" ")[1];

    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: "NO_TOKEN_PROVIDED" })};
    }

    try {
        verifyJWT(token);

        const queryParams = event.queryStringParameters || {};
        const page = parseInt(queryParams.page || "1");
        const limit = parseInt(queryParams.limit || "50");
        const skip = (page - 1) * limit;

        const db = await connectToMongo();
        const collection = db.collection("checkins");

        const total = await collection.countDocuments();

        const checkIns = await collection.aggregate([
            { $sort: { checkInTime: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: "members",
                    localField: "memberId",
                    foreignField: "_id",
                    as: "memberData"
                }
            },
            { $unwind: { path: "$memberData", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    member: "$memberData"
                }
            },
            { $project: { memberData: 0 } }
        ]).toArray();

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                data: checkIns,
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
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" })
        };
    }
}