/// <reference path="./.sst/platform/config.d.ts" />

import { env } from "./.sst/platform/src/components";

export default $config({
  app(input) {
    return {
      name: "billiard-club",
      home: "aws",
      providers: {
        aws: { region: "eu-west-1", profile: process.env.AWS_PROFILE },
      },
    };
  },

  async run() {
    const api = new sst.aws.ApiGatewayV2("Api");

    api.route("POST /members", {
      handler: "./src/packages/functions/createMember.handler",
      environment: {
        JWT_SECRET_KEY: process.env.JWT_SECRET_KEY!,
        MONGODB_URI: process.env.MONGODB_URI!,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME!,
        SES_SENDER_EMAIL: process.env.SES_SENDER_EMAIL!,
      },
      architecture: "arm64",
      runtime: "nodejs22.x",
      permissions: [
        {
          actions: ["ses:SendEmail", "ses:SendRawEmail"],
          resources: ["*"] 
        }
      ]
    });

    api.route("POST /admin/login", {
      handler: "./src/packages/functions/adminLogin.handler",
      environment: {
        JWT_SECRET_KEY: process.env.JWT_SECRET_KEY!,
        ADMIN_USERNAME: process.env.ADMIN_USERNAME!,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD!,
      },
      architecture: "arm64",
      runtime: "nodejs22.x",
    });
    
    api.route("POST /qrcode/validate", {
      handler: "./src/packages/functions/validateQrCode.handler",
      environment: {
        RASPBERRY_PI_API_KEY: process.env.RASPBERRY_PI_API_KEY!,
      },
      architecture: "arm64",
      runtime: "nodejs22.x",
    })

    const webSocket = new sst.aws.ApiGatewayWebSocket("RealtimeApi");

    webSocket.route("$connect", {
      handler: "./src/packages/functions/websocket.connect",
      environment: {
        MONGODB_URI: process.env.MONGODB_URI!,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME!,
      }
    });

    webSocket.route("$disconnect", {
      handler: "./src/packages/functions/websocket.disconnect",
      environment: {
        MONGODB_URI: process.env.MONGODB_URI!,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME!,
      }
    });

    api.route("POST /check-in", {
      handler: "./src/packages/functions/checkIn.handler",
      environment: {
        WEBSOCKET_API_URL: webSocket.url,
      },
      permissions: [ 
        {
          actions: ["execute-api:ManageConnections"],
          resources: ["*"]
        }
       ]
    })
  }
});