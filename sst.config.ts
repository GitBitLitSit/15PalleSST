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
      handler: "./src/handlers/members/create.handler",
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
      handler: "./src/handlers/admin/login.handler",
      environment: {
        JWT_SECRET_KEY: process.env.JWT_SECRET_KEY!,
        ADMIN_USERNAME: process.env.ADMIN_USERNAME!,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD!,
      },
      architecture: "arm64",
      runtime: "nodejs22.x",
    });

    api.route("GET /members", {
      handler: "./src/handlers/members/get.handler",
      environment: {
        JWT_SECRET_KEY: process.env.JWT_SECRET_KEY!,
        MONGODB_URI: process.env.MONGODB_URI!,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME!,
      },
      architecture: "arm64",
      runtime: "nodejs22.x",
    })

    api.route("POST /members/reset-qrcode", {
      handler: "./src/handlers/members/resetQrCode.handler",
      environment: {
        JWT_SECRET_KEY: process.env.JWT_SECRET_KEY!,
        MONGODB_URI: process.env.MONGODB_URI!,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME!,
      },
      architecture: "arm64",
      runtime: "nodejs22.x",
    });

    api.route("POST /members/recover", {
      handler: "./src/handlers/members/recover.handler",
      environment: {
        MONGODB_URI: process.env.MONGODB_URI!,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME!,
        SES_SENDER_EMAIL: process.env.SES_SENDER_EMAIL!,
      },
      permissions: [
        {
          actions: ["ses:SendEmail", "ses:SendRawEmail"],
          resources: ["*"]
        }
      ]
    });

    api.route("POST /auth/request-verification", {
      handler: "./src/handlers/auth/requestVerification.handler",
      environment: {
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
    })

    const webSocket = new sst.aws.ApiGatewayWebSocket("RealtimeApi");

    webSocket.route("$connect", {
      handler: "./src/handlers/websocket/connect.handler",
      environment: {
        MONGODB_URI: process.env.MONGODB_URI!,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME!,
      }
    });

    webSocket.route("$disconnect", {
      handler: "./src/handlers/websocket/disconnect.handler",
      environment: {
        MONGODB_URI: process.env.MONGODB_URI!,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME!,
      }
    });

    api.route("POST /check-in", {
      handler: "./src/handlers/access/checkIn.handler",
      environment: {
        WEBSOCKET_API_URL: webSocket.url,
        MONGODB_URI: process.env.MONGODB_URI!,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME!,
        JWT_SECRET_KEY: process.env.JWT_SECRET_KEY!,
        RASPBERRY_PI_API_KEY: process.env.RASPBERRY_PI_API_KEY!,
      },
      permissions: [ 
        {
          actions: ["execute-api:ManageConnections"],
          resources: ["*"]
        }
       ]
    })
    
    const site = new sst.aws.Nextjs("MyWeb", {
      path: "frontend",
      environment: {
        NEXT_PUBLIC_API_URL: api.url,
        NEXT_PUBLIC_WEBSOCKET_API_URL: webSocket.url,
      },
    });

    return {
      api: api.url,
      site: site.url,
    };
  }
});