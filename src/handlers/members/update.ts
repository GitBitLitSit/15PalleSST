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

        const { firstName, lastName, email, blocked } = JSON.parse(event.body || "{}");

        const db = await connectToMongo();
        const collection = db.collection<Member>("members");

        const member = await collection.findOne({ _id: new ObjectId(id) as any });

        if (!member) {
            return { statusCode: 404, body: JSON.stringify({ error: "MEMBER_NOT_FOUND" }) };
        }

        const updateFields: Partial<Member> = {};

        if (email) {
            const trimmedEmail = email.trim().toLowerCase();

            if (trimmedEmail !== member.email) {
                const emailConflict = await collection.findOne({ email: trimmedEmail });
                if (emailConflict) {
                    return { statusCode: 409, body: JSON.stringify({ error: "MEMBER_EMAIL_EXISTS" }) };
                }

                updateFields.email = trimmedEmail;
            }
        }

        if (firstName && firstName.trim()) {
            updateFields.firstName = firstName.trim();
        }

        if (lastName && lastName.trim()) {
            updateFields.lastName = lastName.trim();
        }

        if (typeof blocked === "boolean") {
            updateFields.blocked = blocked;
        }

        if (Object.keys(updateFields).length > 0) {
            await collection.updateOne({ _id: new ObjectId(id) as any }, { $set: updateFields });

            const updatedMember = { ...member, ...updateFields };
            return { statusCode: 200, body: JSON.stringify({ success: true, member: updatedMember }) };
        }

        return { statusCode: 200, body: JSON.stringify({ success: true, member }) };
    } catch (error) {
        if (error instanceof Error && error.message.includes("JWT")) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "INVALID_TOKEN" })
            };
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR", details: error instanceof Error ? error.message : String(error) })
        }
    }
}