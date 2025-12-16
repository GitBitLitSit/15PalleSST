import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { connectToMongo } from "../../adapters/database";
import { WebSocketRequestContext } from "./types";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const connectionId = (event.requestContext as WebSocketRequestContext).connectionId;

    const db = await connectToMongo();
    await db.collection("connections").insertOne({
        connectionId,
        connectedAt: new Date(),
    });

    return { statusCode: 200, body: "Connected" };
}