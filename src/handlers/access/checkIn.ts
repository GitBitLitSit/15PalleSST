import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { connectToMongo } from "../../adapters/database";
import { verifyJWT } from "../../lib/jwt";
import { Member, CheckIn } from "../../lib/types";
import { broadcastToDashboard } from "../../adapters/notification";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {

    let isAuthenticated = false;
    let authSource: CheckIn["source"] = "unknown";

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
        const checkinsCollection = db.collection<CheckIn>("checkins");

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
            { sort: { checkInTime: -1 } }
        );

        const now = new Date();
        const COOLDOWN_MINUTES = 5;
        let warning = null;

        if (lastCheckin) {
            const diffMs = now.getTime() - new Date(lastCheckin.checkInTime).getTime();
            const diffMinutes = diffMs / 1000 / 60;

            if (diffMinutes < COOLDOWN_MINUTES) {
                warning = `Passback Warning: Last scan was ${Math.round(diffMinutes)} minutes ago.`;
            }
        }

        await checkinsCollection.insertOne({
            memberId: member._id,
            checkInTime: now,
            source: authSource,
            passbackWarning: !!warning
        });

        try {
            await broadcastToDashboard({
                type: "NEW_CHECKIN",
                member: {
                    id: member._id,
                    firstName: member.firstName,
                    lastName: member.lastName,
                    email: member.email,
                    createdAt: member.createdAt,
                    blocked: member.blocked,
                    emailValid: member.emailValid
                },
                warning: warning,
                timestamp: now
            });
        } catch (wsError) {
            console.error("Failed to broadcast to dashboard:", wsError);
        }

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
        const isJwtError = error instanceof Error && error.message.includes("JWT");
        return {
            statusCode: isJwtError ? 401 : 500,
            body: JSON.stringify({ 
                success: false, 
                error: isJwtError ? "Unauthorized: Invalid Token" : "Internal Server Error" 
            })
        };
    }
};