import { APIGatewayEventRequestContextV2 } from "aws-lambda";

export interface WebSocketRequestContext extends APIGatewayEventRequestContextV2 {
    connectionId: string;
}