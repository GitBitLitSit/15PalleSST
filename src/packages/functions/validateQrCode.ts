import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { connectToMongo } from "../../database/mongo";
import { verifyJWT } from "../../security/jwt";
import { Member } from "../types/member";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {

    let isAuthenticated = false;
    let authSource = "unknown";

    // Raspberry Pi login
    const apiKey = event.headers["x-api-key"];
    const validApiKey = process.env.RASPBERRY_PI_API_KEY;

    // Admin login
    const token = event.headers.authorization?.split(" ")[1];

    try {
        if (apiKey && apiKey === validApiKey) {
            isAuthenticated = true;
            authSource = "raspberry_pi";
        } else if (token) {
            verifyJWT(token);
            isAuthenticated = true;
            authSource = "admin";
        }

        if (!isAuthenticated) {
            return {
                statusCode: 401,
                body: JSON.stringify({ success: false, error: "Unauthorized: No valid credentials provided" }),
            };
        }

        let { qrUuid } = JSON.parse(event.body || "{}");
        const trimmedQrCode = qrUuid?.trim() ?? "";

        if (!trimmedQrCode) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "QRUuid is required" }),
            };
        }

        const db = await connectToMongo();
        const membersCollection = db.collection<Member>("members");
        const checkinsCollection = db.collection("checkins");

        const member = await membersCollection.findOne({ qrUuid: trimmedQrCode });

        if (!member) {
            return {
                statusCode: 404,
                body: JSON.stringify({ success: false, error: "Member not found" }),
            };
        }

        if (member.blocked) {
            return {
                statusCode: 403,
                body: JSON.stringify({ success: false, error: "Member is blocked" }),
            };
        }

        const lastCheckin = await checkinsCollection.findOne(
            { memberId: member._id },
            { sort: { checkinTime: -1 } }
        );

        const now = new Date();
        const COOLDOWN_MINUTES = 5;
        let warning = null;

        if (lastCheckin) {
            const diffMs = now.getTime() - new Date(lastCheckin.checkinTime).getTime();
            const diffMinutes = diffMs / 1000 / 60;

            if (diffMinutes < COOLDOWN_MINUTES) {
                warning = `Passback Warning: Last scan was ${Math.round(diffMinutes)} minutes ago.`;
            }
        }

        await checkinsCollection.insertOne({
            memberId: member._id,
            checkinTime: now,
            source: authSource,
            passbackWarning: !!warning
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                message: "Access Granted",
                warning: warning,
                member: {
                    firstName: member.firstName,
                    lastName: member.lastName,
                    email: member.email,
                    emailValid: member.emailValid,
                    id: member._id 
                }
            })
        };
    } catch (error) {
        const isJwtError = error instanceof Error && error.message.includes("jwt");
        return {
            statusCode: isJwtError ? 401 : 500,
            body: JSON.stringify({ 
                success: false, 
                error: isJwtError ? "Unauthorized: Invalid Token" : "Internal Server Error" 
            })
        };
    }
};