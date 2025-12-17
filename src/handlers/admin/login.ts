import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { generateJWT } from "../../lib/jwt";
import { connectToMongo } from "../../adapters/database";
import bcrypt from "bcryptjs";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const { username, password } = JSON.parse(event.body || "{}");

    const ip = event.requestContext.http.sourceIp;

    if (!username || !password) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing credentials" }) };
    }

    const db = await connectToMongo();
    const adminsCollection = db.collection("admins");
    const failsCollection = db.collection("failed_logins");

    const ipRecord = await failsCollection.findOne({ ip });

    console.log("IP Record:", ipRecord);

    if (ipRecord && ipRecord.lockUntil && ipRecord.lockUntil > new Date()) {
        const minutesLeft = Math.ceil((ipRecord.lockUntil.getTime() - new Date().getTime()) / 60000);

        return { statusCode: 429, body: JSON.stringify({ error: `Too many attempts. blocked for ${minutesLeft} minute(s).` })}
    }

    const adminCount = await adminsCollection.countDocuments();

    if (adminCount === 0) {
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10);

        await adminsCollection.insertOne({
            username: process.env.ADMIN_USERNAME!,
            password: hashedPassword,
            createdAt: new Date(),
            role: "owner",
        })
    }

    const admin = await adminsCollection.findOne({ username });

    const handleFailure = async () => {
        const newAttempts = (ipRecord?.attempts || 0) + 1;
        let updateData: any = { attempts: newAttempts, ip };

        if (newAttempts >= 5) {
            updateData.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
        }

        await failsCollection.updateOne(
            { ip },
            { $set: updateData },
            { upsert: true }
        );

        return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized: Invalid credentials" }) };
    }

    if (!admin) {
        return handleFailure();
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
        return handleFailure();
    }

    await adminsCollection.updateOne(
        { _id: admin._id }, 
        { $unset: { lockUntil: "", loginAttempts: "" } }
    );

    const token = generateJWT(username);

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Login successful", token }),
    }
};